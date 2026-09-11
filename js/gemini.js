// ترجمان — کلاینت Gemini API (مستقیماً از مرورگر کاربر به Google؛ بدون واسطه)
(function () {
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  function toneInstruction(toneId, lang) {
    const map = {
      literary: 'Use a formal, literary, well-edited register appropriate for print.',
      colloquial: 'Use a natural, everyday spoken register, as a native speaker would casually say it.',
      cinematic: 'Use a punchy, natural cinematic/subtitle register: concise, rhythmic, easy to read aloud, matching how characters actually speak on screen.',
    };
    return map[toneId] || map.literary;
  }

  function glossaryBlock() {
    const g = window.Tarjoman.storage.getGlossary();
    if (!g.length) return '';
    const lines = g.map((x) => `- "${x.source}" -> "${x.target}"`).join('\n');
    return `\n\nAlways use these exact term equivalents when they appear:\n${lines}`;
  }

  async function callGemini(model, body, { maxAttempts } = {}) {
    const keys = window.Tarjoman.keys;
    if (!keys.isUnlocked()) throw Object.assign(new Error('locked'), { code: 'locked' });
    const attempts = maxAttempts || Math.max(1, keys.activeCount());
    if (!attempts) throw Object.assign(new Error('no-key'), { code: 'no-key' });

    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const k = keys.nextActive();
      if (!k) break;
      try {
        const res = await fetch(`${BASE}${model}:generateContent?key=${encodeURIComponent(k.value)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status === 401 || res.status === 403) {
          lastErr = new Error(`key-rejected-${res.status}`);
          continue; // try next key
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw Object.assign(new Error('api-error'), { detail: text, status: res.status });
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (e.code === 'locked') throw e;
      }
    }
    throw lastErr || new Error('all-keys-failed');
  }

  function extractText(json) {
    try {
      return json.candidates[0].content.parts.map((p) => p.text || '').join('').trim();
    } catch (e) {
      return '';
    }
  }

  function langName(code) {
    const f = (window.TARJOMAN_LANGS || []).find((l) => l.code === code);
    return f ? `${f.en} (${f.native})` : code;
  }

  const Gemini = {
    async translateText({ text, sourceLang, targetLang, tone, model }) {
      const src = sourceLang && sourceLang !== 'auto' ? `from ${langName(sourceLang)} ` : '';
      const prompt = `Translate the following text ${src}into ${langName(targetLang)}.
${toneInstruction(tone)}
Return ONLY the translated text, with no preamble, no quotes, no explanations.${glossaryBlock()}

TEXT:
"""${text}"""`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ text: prompt }] }],
      });
      return extractText(json);
    },

    async extractAndTranslateImage({ base64, mimeType, targetLang, tone, model }) {
      const prompt = `This image contains text (it may be a photo, screenshot, sign, or document page).
1. Read all the visible text carefully, preserving structure/line breaks where meaningful.
2. Translate it into ${langName(targetLang)}. ${toneInstruction(tone)}${glossaryBlock()}
Return ONLY the translated text.`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] }],
      });
      return extractText(json);
    },

    async translateLongText({ text, targetLang, tone, model }) {
      const prompt = `Translate the following document into ${langName(targetLang)}. ${toneInstruction(tone)}
Preserve paragraph breaks and structure as closely as possible.${glossaryBlock()}

DOCUMENT:
"""${text}"""`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ text: prompt }] }],
      });
      return extractText(json);
    },

    async transcribeAndTranslate({ base64, mimeType, sourceLang, targetLang, model }) {
      const prompt = `Listen to this audio clip. Transcribe the speech${sourceLang && sourceLang !== 'auto' ? ` (it is in ${langName(sourceLang)})` : ''}, then translate the transcript into ${langName(targetLang)}.
Respond ONLY as strict JSON: {"transcript": "...", "translation": "..."} with no markdown fences.`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] }],
      });
      const raw = extractText(json).replace(/^```json|```$/g, '').trim();
      try {
        return JSON.parse(raw);
      } catch (e) {
        return { transcript: '', translation: raw };
      }
    },

    async translateBatch({ items, targetLang, tone, model }) {
      // items: [{id, text}] — برای زیرنویس، دسته‌ای ترجمه می‌کنیم تا هم‌زمان سریع و منسجم باشد
      const prompt = `Translate each numbered line into ${langName(targetLang)}. ${toneInstruction(tone)}
Keep each translation on its own line, prefixed with the same number and a period, in the exact same order. Do not merge or split lines. Keep translations concise enough to read comfortably at subtitle speed.${glossaryBlock()}

LINES:
${items.map((it, i) => `${i + 1}. ${it.text.replace(/\n/g, ' ')}`).join('\n')}`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ text: prompt }] }],
      });
      const raw = extractText(json);
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      const out = items.map((it, i) => {
        const line = lines.find((l) => l.match(new RegExp(`^${i + 1}\\.`)));
        return { id: it.id, text: line ? line.replace(new RegExp(`^${i + 1}\\.\\s*`), '') : it.text };
      });
      return out;
    },

    async synthesizeSpeech({ text, model, voice }) {
      const settings = window.Tarjoman.storage.getSettings();
      const json = await callGemini(model || settings.modelTts, {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || settings.ttsVoice || 'Kore' } } },
        },
      });
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
      const data = part && (part.inlineData?.data || part.inline_data?.data);
      const mime = part && (part.inlineData?.mimeType || part.inline_data?.mime_type) || 'audio/L16;rate=24000';
      if (!data) throw new Error('no-audio');
      return pcmBase64ToWavUrl(data, mime);
    },
  };

  // خروجی TTS جمینای معمولاً PCM خام است؛ آن را به یک WAV قابل پخش تبدیل می‌کنیم.
  function pcmBase64ToWavUrl(base64, mime) {
    const rateMatch = /rate=(\d+)/.exec(mime || '');
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const pcm = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const wavBuffer = buildWav(pcm, sampleRate, 1, 16);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  function buildWav(pcmBytes, sampleRate, numChannels, bitsPerSample) {
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const buffer = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(buffer);
    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, pcmBytes.length, true);
    new Uint8Array(buffer, 44).set(pcmBytes);
    return buffer;
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.gemini = Gemini;
  window.Tarjoman.langName = langName;
})();
