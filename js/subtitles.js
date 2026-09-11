// ترجمان — تجزیه و بازسازی زیرنویس (SRT/VTT/ASS) با کنترل CPS
(function () {
  function srtTimeToMs(t) {
    const m = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/.exec(String(t || ''));
    if (!m) return 0;
    return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4];
  }
  function msToSrtTime(ms) {
    ms = Math.max(0, Math.round(ms));
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000); ms -= m * 60000;
    const s = Math.floor(ms / 1000); ms -= s * 1000;
    const pad = (n, l) => String(n).padStart(l, '0');
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  }
  function msToVttTime(ms) { return msToSrtTime(ms).replace(',', '.'); }

  function parseSRT(content) {
    const blocks = String(content || '').replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\n+/).filter(Boolean);
    return blocks.map((block, i) => {
      const lines = block.split('\n');
      let idx = /^\d+$/.test(lines[0].trim()) ? 1 : 0;
      const timeLine = lines[idx] || '';
      if (!timeLine.includes('-->')) return null;
      const [start, end] = timeLine.split('-->').map((s) => s.trim());
      const text = lines.slice(idx + 1).join('\n').trim();
      if (!text) return null;
      return { id: i + 1, startMs: srtTimeToMs(start), endMs: srtTimeToMs(end), text };
    }).filter(Boolean);
  }

  function buildSRT(cues) {
    return cues.map((c, i) => `${i + 1}\n${msToSrtTime(c.startMs)} --> ${msToSrtTime(c.endMs)}\n${c.text || ''}`).join('\n\n') + '\n';
  }

  function parseVTT(content) {
    const body = String(content || '').replace(/^\uFEFF/, '').replace(/\r/g, '').replace(/^WEBVTT[^\n]*(?:\n|$)/i, '');
    const blocks = body.trim().split(/\n\n+/).filter(Boolean);
    let n = 0;
    return blocks.map((block) => {
      const lines = block.split('\n');
      const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx === -1) return null;
      const [start, end] = lines[timeLineIdx].split('-->').map((s) => s.trim().split(/\s+/)[0]);
      const text = lines.slice(timeLineIdx + 1).join('\n').trim();
      if (!text) return null;
      n++;
      return { id: n, startMs: srtTimeToMs(start.replace('.', ',')), endMs: srtTimeToMs(end.replace('.', ',')), text };
    }).filter(Boolean);
  }

  function buildVTT(cues) {
    return 'WEBVTT\n\n' + cues.map((c) => `${msToVttTime(c.startMs)} --> ${msToVttTime(c.endMs)}\n${c.text || ''}`).join('\n\n') + '\n';
  }

  function assTimeToMs(t) {
    const m = /(\d+):(\d{2}):(\d{2})\.(\d{2})/.exec(String(t || ''));
    if (!m) return 0;
    return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4] * 10;
  }
  function msToAssTime(ms) {
    ms = Math.max(0, Math.round(ms));
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000); ms -= m * 60000;
    const s = Math.floor(ms / 1000); ms -= s * 1000;
    const cs = Math.floor(ms / 10);
    const pad = (n, l) => String(n).padStart(l, '0');
    return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
  }

  function parseASS(content) {
    const lines = String(content || '').replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
    const cues = [];
    let n = 0;
    let dialogueFormat = null;
    for (const line of lines) {
      if (/^Format:/i.test(line)) {
        const fields = line.replace(/^Format:\s*/i, '').split(',').map((s) => s.trim());
        if (fields.some((f) => /^start$/i.test(f)) && fields.some((f) => /^end$/i.test(f))) dialogueFormat = fields;
      }
      if (/^Dialogue:/i.test(line)) {
        const rest = line.replace(/^Dialogue:\s*/i, '');
        const fields = dialogueFormat || ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
        const textIndex = fields.findIndex((f) => /^text$/i.test(f));
        const startIndex = fields.findIndex((f) => /^start$/i.test(f));
        const endIndex = fields.findIndex((f) => /^end$/i.test(f));
        const count = Math.max(textIndex, startIndex, endIndex) + 1;
        const parts = rest.split(',');
        if (startIndex < 0 || endIndex < 0 || textIndex < 0 || parts.length < count) continue;
        const head = parts.slice(0, textIndex);
        const text = parts.slice(textIndex).join(',');
        n++;
        cues.push({ id: n, raw: line, startMs: assTimeToMs(head[startIndex] || ''), endMs: assTimeToMs(head[endIndex] || ''), text: text.replace(/\\N/g, '\n') });
      }
    }
    return { cues, lines, dialogueFormat };
  }

  function buildASS(originalLines, cues, dialogueFormat) {
    const fields = dialogueFormat || ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
    const textIndex = fields.findIndex((f) => /^text$/i.test(f));
    let ci = 0;
    return originalLines.map((line) => {
      if (!/^Dialogue:/i.test(line) || !cues[ci]) return line;
      const cue = cues[ci++];
      const rest = line.replace(/^Dialogue:\s*/i, '');
      const parts = rest.split(',');
      const head = parts.slice(0, Math.max(textIndex, 0));
      const newText = String(cue.text || '').replace(/\n/g, '\\N');
      return 'Dialogue: ' + head.join(',') + (head.length ? ',' : '') + newText;
    }).join('\n');
  }

  function cps(cue) {
    const durSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
    const len = (cue.text || '').replace(/\n/g, ' ').length;
    return +(len / durSec).toFixed(1);
  }

  function detectFormat(filename, content) {
    if (/\.vtt$/i.test(filename) || String(content || '').trim().startsWith('WEBVTT')) return 'vtt';
    if (/\.ass$/i.test(filename) || /\[Script Info\]/i.test(String(content || ''))) return 'ass';
    return 'srt';
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.subtitles = { parseSRT, buildSRT, parseVTT, buildVTT, parseASS, buildASS, cps, detectFormat };
})();
