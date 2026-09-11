// ترجمان — کلاینت Gemini API (مستقیماً از مرورگر کاربر به Google؛ بدون واسطه)
(function () {
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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

  // ---------- تنظیمات مقاوم‌سازی درخواست (چرخش کلید + چرخش مدل + تایم‌اوت) ----------
  const DEFAULT_TEXT_TIMEOUT_MS = 25000; // برای نت کند: به‌جای شکست زودهنگام، صبر منطقی
  const DEFAULT_TTS_TIMEOUT_MS = 40000;  // تولید/دانلود صدا معمولاً کندتر است
  const MAX_MODELS_PER_KEY = 4;          // سقف تعداد موتور برای هر کلید، تا روی نت کند طولانی نشود
  const MAX_NETWORK_FAILURES_TOTAL = 3;  // بعد از این تعداد خطای شبکه/تایم‌اوت پیاپی، به‌جای گشتن بی‌فایده روی همه‌ی کلید/مدل‌ها، سریع خطای «شبکه» می‌دهیم
  const LIST_MODELS_TIMEOUT_MS = 15000;

  // فقط به‌عنوان آخرین راه‌حل، برای کلیدهایی که هنوز تشخیص خودکار رویشان اجرا نشده
  const FALLBACK_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const FALLBACK_TTS_MODELS = ['gemini-2.5-flash-preview-tts'];

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  // فهرست موتورهای قابل‌امتحان برای یک کلید مشخص: اول مدل درخواستی، بعد مدل‌های شناسایی‌شده‌ی همان کلید،
  // و در آخر یک فهرست عمومی پشتیبان — بدون تکرار، با سقف تعداد
  function candidateModelsForKey(keyEntry, requestedModel, kind) {
    const cached = window.Tarjoman.keys.getModelCandidates(keyEntry.id, kind) || [];
    const fallback = kind === 'tts' ? FALLBACK_TTS_MODELS : FALLBACK_TEXT_MODELS;
    const seen = new Set();
    const out = [];
    [requestedModel, ...cached, ...fallback].forEach((m) => {
      if (m && !seen.has(m)) { seen.add(m); out.push(m); }
    });
    return out.slice(0, MAX_MODELS_PER_KEY);
  }

  async function callGemini(model, body, { kind = 'text', timeoutMs } = {}) {
    const keys = window.Tarjoman.keys;
    if (!keys.isUnlocked()) throw Object.assign(new Error('locked'), { code: 'locked' });
    if (!keys.activeCount()) throw Object.assign(new Error('no-key'), { code: 'no-key' });
    const effectiveTimeout = timeoutMs || (kind === 'tts' ? DEFAULT_TTS_TIMEOUT_MS : DEFAULT_TEXT_TIMEOUT_MS);
    const keyAttempts = keys.activeCount();

    let lastErr;
    let networkFailures = 0;

    for (let ki = 0; ki < keyAttempts; ki++) {
      const k = keys.nextActive();
      if (!k) break;
      const candidates = candidateModelsForKey(k, model, kind);

      for (let mi = 0; mi < candidates.length; mi++) {
        const tryModel = candidates[mi];
        try {
          const res = await fetchWithTimeout(
            `${BASE}${tryModel}:generateContent?key=${encodeURIComponent(k.value)}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
            effectiveTimeout
          );

          if (res.status === 401) {
            // کلید نامعتبر/بی‌اعتبار است؛ امتحان موتور دیگر با همین کلید فایده‌ای ندارد — مستقیم برو سراغ کلید بعدی
            lastErr = Object.assign(new Error('key-invalid'), { status: 401, model: tryModel });
            break;
          }
          if (res.status === 429 || res.status === 403 || res.status === 404 || res.status >= 500) {
            // سهمیه/دسترسی/منسوخ‌شدنِ همین موتور می‌تواند دلیل باشد؛ موتور بعدیِ همین کلید را امتحان کن
            lastErr = Object.assign(new Error(`model-rejected-${res.status}`), { status: res.status, model: tryModel });
            continue;
          }
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            lastErr = Object.assign(new Error('api-error'), { detail: text, status: res.status, model: tryModel });
            continue;
          }

          const json = await res.json();
          if (mi > 0) {
            // موتور جایگزین جواب داد؛ دفعه‌ی بعد مستقیم همین را امتحان کن (سریع‌تر، به‌خصوص روی نت کند)
            keys.promoteModel(k.id, kind, tryModel).catch(() => {});
            window.Tarjoman.storage.saveSettings(kind === 'tts' ? { modelTts: tryModel } : { modelText: tryModel });
          }
          return json;
        } catch (e) {
          lastErr = Object.assign(new Error(e && e.name === 'AbortError' ? 'network-timeout' : 'network-error'), { cause: e, model: tryModel });
          networkFailures++;
          if (networkFailures >= MAX_NETWORK_FAILURES_TOTAL) {
            throw Object.assign(new Error('network'), { code: 'network' });
          }
          continue;
        }
      }
    }
    throw lastErr || Object.assign(new Error('all-keys-failed'), { code: 'all-keys-failed' });
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

  // ---------- تشخیص خودکار مدل‌های در دسترس یک کلید (ListModels) ----------

  // فهرست مدل‌های موجود برای یک کلید مشخص را از خود API می‌گیرد (بدون مصرف سهمیه‌ی تولید محتوا)
  async function listModels(apiKey) {
    let out = [];
    let pageToken = '';
    for (let i = 0; i < 5; i++) { // حداکثر ۵ صفحه، برای احتیاط در برابر حساب‌های با مدل‌های زیاد
      const url = `${LIST_URL}?key=${encodeURIComponent(apiKey)}&pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const res = await fetchWithTimeout(url, {}, LIST_MODELS_TIMEOUT_MS);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw Object.assign(new Error('list-models-failed'), { status: res.status, detail: text });
      }
      const json = await res.json();
      out = out.concat(json.models || []);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
    return out;
  }

  // امتیازدهی: مدل‌های flash (سریع‌تر، سهمیه‌ی رایگان بیشتر) بر pro ترجیح دارند؛
  // بین نسخه‌ها، جدیدترین انتخاب می‌شود؛ نسخه‌های preview/exp کمی عقب‌تر قرار می‌گیرند
  function scoreModel(m) {
    const n = (m.name || '').toLowerCase();
    let s = 0;
    if (n.includes('flash')) s += 100;
    else if (n.includes('pro')) s += 80;
    else s += 40;
    const ver = /(\d+)(?:\.(\d+))?/.exec(n);
    if (ver) s += parseFloat(`${ver[1]}.${ver[2] || 0}`) * 10;
    if (n.includes('preview') || n.includes('exp')) s -= 5;
    if (n.includes('lite')) s -= 2;
    return s;
  }

  function supportsGenerate(m) {
    return (m.supportedGenerationMethods || []).includes('generateContent');
  }

  function bareName(m) {
    return (m.name || '').replace(/^models\//, '');
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
      }, { kind: 'text' });
      return extractText(json);
    },

    async extractAndTranslateImage({ base64, mimeType, targetLang, tone, model }) {
      const prompt = `This image contains text (it may be a photo, screenshot, sign, or document page).
1. Read all the visible text carefully, preserving structure/line breaks where meaningful.
2. Translate it into ${langName(targetLang)}. ${toneInstruction(tone)}${glossaryBlock()}
Return ONLY the translated text.`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] }],
      }, { kind: 'text' });
      return extractText(json);
    },

    async translateLongText({ text, targetLang, tone, model }) {
      const prompt = `Translate the following document into ${langName(targetLang)}. ${toneInstruction(tone)}
Preserve paragraph breaks and structure as closely as possible.${glossaryBlock()}

DOCUMENT:
"""${text}"""`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ text: prompt }] }],
      }, { kind: 'text' });
      return extractText(json);
    },

    async transcribeAndTranslate({ base64, mimeType, sourceLang, targetLang, model }) {
      const prompt = `Listen to this audio clip. Transcribe the speech${sourceLang && sourceLang !== 'auto' ? ` (it is in ${langName(sourceLang)})` : ''}, then translate the transcript into ${langName(targetLang)}.
Respond ONLY as strict JSON: {"transcript": "...", "translation": "..."} with no markdown fences.`;
      const json = await callGemini(model || window.Tarjoman.storage.getSettings().modelText, {
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] }],
      }, { kind: 'text' });
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
      }, { kind: 'text' });
      const raw = extractText(json);
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      const out = items.map((it, i) => {
        const line = lines.find((l) => l.match(new RegExp(`^${i + 1}\\.`)));
        return { id: it.id, text: line ? line.replace(new RegExp(`^${i + 1}\\.\\s*`), '') : it.text };
      });
      return out;
    },

    // با گرفتن لیست مدل‌های در دسترسِ این کلید از خود Google، بهترین مدل متن و بهترین مدل TTS را انتخاب می‌کند
    async detectBestModels(apiKey) {
      const models = await listModels(apiKey);
      const usable = models.filter(supportsGenerate);
      const textCandidates = usable.filter((m) => !/tts|embedding|aqa/i.test(m.name));
      const ttsCandidates = usable.filter((m) => /tts/i.test(m.name));
      textCandidates.sort((a, b) => scoreModel(b) - scoreModel(a));
      ttsCandidates.sort((a, b) => scoreModel(b) - scoreModel(a));
      return {
        textModel: textCandidates[0] ? bareName(textCandidates[0]) : null,
        ttsModel: ttsCandidates[0] ? bareName(ttsCandidates[0]) : null,
        textOptions: textCandidates.map(bareName),
        ttsOptions: ttsCandidates.map(bareName),
      };
    },

    async synthesizeSpeech({ text, model, voice }) {
      const settings = window.Tarjoman.storage.getSettings();
      const json = await callGemini(model || settings.modelTts, {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || settings.ttsVoice || 'Kore' } } },
        },
      }, { kind: 'tts' });
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
