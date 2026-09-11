// ترجمان — تجزیه و بازسازی زیرنویس (SRT/VTT/ASS) با کنترل CPS
(function () {
  function srtTimeToMs(t) {
    const m = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/.exec(t);
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
  function msToVttTime(ms) {
    return msToSrtTime(ms).replace(',', '.');
  }

  function parseSRT(content) {
    const blocks = content.replace(/\r/g, '').trim().split(/\n\n+/);
    return blocks.map((block, i) => {
      const lines = block.split('\n');
      let idx = 0;
      if (/^\d+$/.test(lines[0])) idx = 1; // خط شماره
      const timeLine = lines[idx] || '';
      const [start, end] = timeLine.split('-->').map((s) => s.trim());
      const text = lines.slice(idx + 1).join('\n');
      return { id: i + 1, startMs: srtTimeToMs(start), endMs: srtTimeToMs(end), text };
    }).filter((c) => c.text !== undefined);
  }

  function buildSRT(cues) {
    return cues.map((c, i) => `${i + 1}\n${msToSrtTime(c.startMs)} --> ${msToSrtTime(c.endMs)}\n${c.text}`).join('\n\n') + '\n';
  }

  function parseVTT(content) {
    const body = content.replace(/\r/g, '').replace(/^WEBVTT.*\n+/, '');
    const blocks = body.trim().split(/\n\n+/);
    let n = 0;
    return blocks.map((block) => {
      const lines = block.split('\n').filter(Boolean);
      const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx === -1) return null;
      const [start, end] = lines[timeLineIdx].split('-->').map((s) => s.trim().split(' ')[0]);
      const text = lines.slice(timeLineIdx + 1).join('\n');
      n++;
      return { id: n, startMs: srtTimeToMs(start.replace('.', ',')), endMs: srtTimeToMs(end.replace('.', ',')), text };
    }).filter(Boolean);
  }

  function buildVTT(cues) {
    return 'WEBVTT\n\n' + cues.map((c) => `${msToVttTime(c.startMs)} --> ${msToVttTime(c.endMs)}\n${c.text}`).join('\n\n') + '\n';
  }

  // پشتیبانی پایه‌ی ASS: فقط خطوط Dialogue را استخراج و بازنویسی می‌کند؛ بقیه‌ی فایل (استایل‌ها) دست‌نخورده می‌ماند.
  function assTimeToMs(t) {
    const m = /(\d):(\d{2}):(\d{2})\.(\d{2})/.exec(t);
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
    const lines = content.replace(/\r/g, '').split('\n');
    const cues = [];
    let n = 0;
    let format = null;
    for (const line of lines) {
      if (/^Format:/i.test(line) && line.toLowerCase().includes('dialogue')) continue;
      if (/^Format:/i.test(line)) {
        format = line.replace(/^Format:\s*/i, '').split(',').map((s) => s.trim());
      }
      if (/^Dialogue:/i.test(line)) {
        const rest = line.replace(/^Dialogue:\s*/i, '');
        const fields = format ? format.length : 10;
        const parts = rest.split(',');
        const head = parts.slice(0, fields - 1).join(',').split(',');
        const text = parts.slice(fields - 1).join(',');
        n++;
        cues.push({
          id: n, raw: line,
          startMs: assTimeToMs(head[1] || '0:00:00.00'),
          endMs: assTimeToMs(head[2] || '0:00:00.00'),
          text: text.replace(/\\N/g, '\n'),
        });
      }
    }
    return { cues, lines };
  }
  function buildASS(originalLines, cues) {
    let ci = 0;
    return originalLines.map((line) => {
      if (/^Dialogue:/i.test(line) && cues[ci]) {
        const cue = cues[ci++];
        const prefixEnd = line.indexOf(cue.raw ? '' : '');
        // بازسازی از روی raw با جایگزینی فقط متن انتهایی
        const rest = line.replace(/^Dialogue:\s*/i, '');
        const parts = rest.split(',');
        const fields = 10;
        const headParts = parts.slice(0, fields - 1);
        const newText = cue.text.replace(/\n/g, '\\N');
        return 'Dialogue: ' + headParts.join(',') + ',' + newText;
      }
      return line;
    }).join('\n');
  }

  function cps(cue) {
    const durSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
    const len = (cue.text || '').replace(/\n/g, ' ').length;
    return +(len / durSec).toFixed(1);
  }

  function detectFormat(filename, content) {
    if (/\.vtt$/i.test(filename) || content.trim().startsWith('WEBVTT')) return 'vtt';
    if (/\.ass$/i.test(filename) || /\[Script Info\]/.test(content)) return 'ass';
    return 'srt';
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.subtitles = { parseSRT, buildSRT, parseVTT, buildVTT, parseASS, buildASS, cps, detectFormat };
})();
