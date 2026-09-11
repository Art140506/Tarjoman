// ترجمان — کنترلر اصلی برنامه
(function () {
  const T = window.Tarjoman;
  const storage = T.storage;
  const i18n = T.i18n;

  let settings = storage.getSettings();

  // ---------- ابزارهای عمومی ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-visible'), 2400);
  }

  function currentLocale() { return settings.uiLang; }
  function tt(key) { return i18n.t(currentLocale(), key); }

  function openModal(id) { $(id).style.display = 'flex'; }
  function closeModal(id) { $(id).style.display = 'none'; }
  $all('[data-close-modal]').forEach((btn) => btn.addEventListener('click', (e) => {
    closeModal('#' + e.target.closest('.modal-overlay').id);
  }));
  $all('.modal-overlay').forEach((ov) => ov.addEventListener('click', (e) => {
    if (e.target === ov) ov.style.display = 'none';
  }));

  // ---------- ناوبری ----------
  const TABS = [
    { id: 'text', icon: '<path d="M4 6h16M4 12h10M4 18h7"/>' },
    { id: 'live', icon: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>' },
    { id: 'resources', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-4.5-4.5a2 2 0 0 0-2.8 0L9 16"/>' },
    { id: 'subtitle', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>' },
    { id: 'settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>' },
  ];

  function navButton(tabId) {
    const b = document.createElement('button');
    b.className = 'nav-btn';
    b.dataset.tab = tabId;
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TABS.find((t) => t.id === tabId).icon}</svg><span data-i18n="nav_${tabId}"></span>`;
    b.addEventListener('click', () => switchTab(tabId));
    return b;
  }

  function renderNav() {
    const rail = $('#navRail'), bar = $('#bottomNav');
    rail.innerHTML = ''; bar.innerHTML = '';
    TABS.forEach((t) => { rail.appendChild(navButton(t.id)); bar.appendChild(navButton(t.id)); });
  }

  function switchTab(tabId) {
    $all('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.tab === tabId));
    $all('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tabId));
  }

  // ---------- پرکردن انتخابگرهای زبان ----------
  function fillLangSelect(select, { withAuto } = {}) {
    select.innerHTML = '';
    if (withAuto) {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = tt('auto_detect');
      select.appendChild(opt);
    }
    window.TARJOMAN_LANGS.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `${l.native} · ${l.en}`;
      select.appendChild(opt);
    });
  }

  function fillToneChips(container, onPick, current) {
    container.innerHTML = '';
    window.TARJOMAN_TONES.forEach((tone) => {
      const b = document.createElement('button');
      b.className = 'chip' + (tone.id === current ? ' is-active' : '');
      b.textContent = tone[currentLocale()] || tone.en;
      b.dataset.tone = tone.id;
      b.addEventListener('click', () => {
        $all('.chip', container).forEach((c) => c.classList.remove('is-active'));
        b.classList.add('is-active');
        onPick(tone.id);
      });
      container.appendChild(b);
    });
  }

  // ---------- تب متن ----------
  const srcLangSel = () => $('#srcLang');
  const tgtLangSel = () => $('#tgtLang');
  let textTone = settings.defaultTone;

  function initTextTab() {
    fillLangSelect(srcLangSel(), { withAuto: true });
    srcLangSel().value = 'auto';
    fillLangSelect(tgtLangSel());
    tgtLangSel().value = settings.defaultTarget;
    fillToneChips($('#toneChips'), (id) => (textTone = id), textTone);

    $('#btnSwap').addEventListener('click', () => {
      if (srcLangSel().value === 'auto') { toast(tt('error_generic')); return; }
      const a = srcLangSel().value, b = tgtLangSel().value;
      srcLangSel().value = b; tgtLangSel().value = a;
      const srcT = $('#srcText').value, resT = $('#resultText').textContent;
      if (!$('#resultText').classList.contains('is-placeholder')) {
        $('#srcText').value = resT;
        renderResult('');
      }
    });

    $('#btnClearText').addEventListener('click', () => {
      $('#srcText').value = '';
      renderResult('');
    });

    $('#btnCopy').addEventListener('click', () => {
      const text = $('#resultText').textContent;
      if (!text || $('#resultText').classList.contains('is-placeholder')) return;
      navigator.clipboard?.writeText(text);
      toast(tt('copied'));
    });

    $('#btnListen').addEventListener('click', async () => {
      const text = $('#resultText').textContent;
      if (!text || $('#resultText').classList.contains('is-placeholder')) return;
      await speak(text);
    });

    $('#btnTranslate').addEventListener('click', doTranslate);
  }

  function renderResult(text) {
    const el = $('#resultText');
    if (!text) {
      el.textContent = tt('result_placeholder');
      el.classList.add('is-placeholder');
    } else {
      el.textContent = text;
      el.classList.remove('is-placeholder');
    }
  }

  async function doTranslate() {
    const text = $('#srcText').value.trim();
    if (!text) return;
    if (!guardKeys()) return;
    const btn = $('#btnTranslate');
    setBusy(btn, true, 'translating');
    try {
      const out = await T.gemini.translateText({
        text, sourceLang: srcLangSel().value, targetLang: tgtLangSel().value, tone: textTone,
      });
      renderResult(out);
      storage.addHistory({ kind: 'text', source: text, target: out, targetLang: tgtLangSel().value, tone: textTone });
    } catch (e) {
      handleGeminiError(e);
    } finally {
      setBusy(btn, false, 'translate');
    }
  }

  function setBusy(btn, busy, key) {
    btn.disabled = busy;
    btn.innerHTML = busy ? `<span class="spinner"></span> ${tt(key)}` : tt(key);
  }

  function guardKeys() {
    if (!T.keys.isUnlocked()) {
      toast(T.keys.hasVault() ? tt('error_locked') : tt('error_no_key'));
      switchTab('settings');
      return false;
    }
    if (!T.keys.activeCount()) {
      toast(tt('error_no_key'));
      switchTab('settings');
      return false;
    }
    return true;
  }

  function handleGeminiError(e) {
    console.error(e);
    if (e && e.code === 'locked') { toast(tt('error_locked')); switchTab('settings'); return; }
    if (e && e.code === 'no-key') { toast(tt('error_no_key')); switchTab('settings'); return; }
    if (e && e.code === 'network') { toast(tt('error_network')); return; }
    if (e && e.code === 'all-keys-failed') { toast(tt('error_all_keys')); switchTab('settings'); return; }
    toast(tt('error_generic'));
  }

  async function speak(text) {
    try {
      const url = await T.gemini.synthesizeSpeech({ text });
      const player = $('#ttsPlayer');
      player.src = url;
      await player.play();
    } catch (e) {
      // پشتیبان: گفتار داخلی مرورگر
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(u);
      } else {
        handleGeminiError(e);
      }
    }
  }

  // ---------- تب همزمان ----------
  let mediaRecorder, mediaChunks = [], liveMime = 'audio/webm';
  function initLiveTab() {
    fillLangSelect($('#liveLangA'));
    fillLangSelect($('#liveLangB'));
    $('#liveLangA').value = settings.uiLang === 'en' ? 'en' : settings.uiLang;
    $('#liveLangB').value = settings.defaultTarget;

    $('#btnMic').addEventListener('click', toggleRecording);
  }

  async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    if (!guardKeys()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      liveMime = mimeCandidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
      mediaRecorder = liveMime ? new MediaRecorder(stream, { mimeType: liveMime }) : new MediaRecorder(stream);
      mediaChunks = [];
      mediaRecorder.ondataavailable = (e) => mediaChunks.push(e.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        $('#btnMic').classList.remove('is-recording');
        $('#micStatus').textContent = tt('live_hint');
        onRecordingReady();
      };
      mediaRecorder.start();
      $('#btnMic').classList.add('is-recording');
      $('#micStatus').textContent = tt('recording');
    } catch (e) {
      toast(tt('error_mic'));
    }
  }

  async function onRecordingReady() {
    const blob = new Blob(mediaChunks, { type: liveMime || 'audio/webm' });
    if (blob.size < 800) return; // ضبط خیلی کوتاه/خالی
    const base64 = await blobToBase64(blob);
    const langA = $('#liveLangA').value, langB = $('#liveLangB').value;
    // فرض: کاربر معمولاً به نوبت بین دو زبان صحبت می‌کند؛ همیشه به‌سمت زبان مقابل ترجمه می‌کنیم و تشخیص خودکار می‌گذاریم مدل مبدأ را تعیین کند.
    addBubble('…', '', 'a', true);
    try {
      const res = await T.gemini.transcribeAndTranslate({
        base64, mimeType: (liveMime || 'audio/webm').split(';')[0], sourceLang: 'auto', targetLang: langB,
      });
      updateLastBubble(res.transcript, res.translation, 'a');
      storage.addHistory({ kind: 'live', source: res.transcript, target: res.translation, targetLang: langB });
      speak(res.translation).catch(() => {});
    } catch (e) {
      removeLastBubble();
      handleGeminiError(e);
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function addBubble(src, tr, side, loading) {
    const div = document.createElement('div');
    div.className = `bubble from-${side}` + (loading ? ' is-loading' : '');
    div.innerHTML = `<div class="bubble-lead">${tt('you_said')}</div><div class="bubble-src">${escapeHtml(src)}</div><div class="bubble-tr">${escapeHtml(tr)}</div>`;
    $('#conversation').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  function updateLastBubble(src, tr) {
    const div = $('#conversation').lastElementChild;
    if (!div) return;
    div.classList.remove('is-loading');
    div.querySelector('.bubble-src').textContent = src;
    div.querySelector('.bubble-tr').textContent = tr;
  }
  function removeLastBubble() {
    const div = $('#conversation').lastElementChild;
    if (div) div.remove();
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------- تب منابع ----------
  let resTone = settings.defaultTone;
  function initResourcesTab() {
    fillLangSelect($('#resTgtLang'));
    $('#resTgtLang').value = settings.defaultTarget;
    fillToneChips($('#resToneChips'), (id) => (resTone = id), resTone);

    $all('#resourceSubtabs .chip').forEach((chip) => chip.addEventListener('click', () => {
      $all('#resourceSubtabs .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      $('#resSubCamera').style.display = chip.dataset.sub === 'camera' ? '' : 'none';
      $('#resSubDoc').style.display = chip.dataset.sub === 'doc' ? '' : 'none';
    }));

    $('#imageDropzone').addEventListener('click', () => $('#imageInput').click());
    $('#imageInput').addEventListener('change', (e) => e.target.files[0] && handleImage(e.target.files[0]));

    $('#docDropzone').addEventListener('click', () => $('#docInput').click());
    $('#docInput').addEventListener('change', (e) => e.target.files[0] && handleDoc(e.target.files[0]));

    ['imageDropzone', 'docDropzone'].forEach((id) => {
      const el = $('#' + id);
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('is-drag'); });
      el.addEventListener('dragleave', () => el.classList.remove('is-drag'));
      el.addEventListener('drop', (e) => {
        e.preventDefault(); el.classList.remove('is-drag');
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (id === 'imageDropzone') handleImage(f); else handleDoc(f);
      });
    });

    $('#resCopy').addEventListener('click', () => {
      const text = $('#resResultText').textContent;
      if (!text) return;
      navigator.clipboard?.writeText(text);
      toast(tt('copied'));
    });
  }

  async function handleImage(file) {
    if (!guardKeys()) return;
    const preview = $('#imagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    $('#resStatus').textContent = tt('extracting');
    $('#resSourceText').textContent = '';
    setResPlaceholder('');
    try {
      const base64 = await T.documents.fileToBase64(file);
      const out = await T.gemini.extractAndTranslateImage({
        base64, mimeType: file.type || 'image/jpeg', targetLang: $('#resTgtLang').value, tone: resTone,
      });
      setResPlaceholder(out);
      storage.addHistory({ kind: 'image', target: out, targetLang: $('#resTgtLang').value });
    } catch (e) {
      handleGeminiError(e);
    } finally {
      $('#resStatus').textContent = '';
    }
  }

  async function handleDoc(file) {
    if (!guardKeys()) return;
    $('#resSourceText').textContent = file.name;
    $('#resSourceText').classList.remove('is-placeholder');
    $('#resStatus').textContent = tt('extracting');
    setResPlaceholder('');
    try {
      const text = await T.documents.extractDocumentText(file);
      $('#resStatus').textContent = tt('translating');
      const out = await T.gemini.translateLongText({ text, targetLang: $('#resTgtLang').value, tone: resTone });
      setResPlaceholder(out);
      storage.addHistory({ kind: 'document', target: out, targetLang: $('#resTgtLang').value });
    } catch (e) {
      handleGeminiError(e);
    } finally {
      $('#resStatus').textContent = '';
    }
  }

  function setResPlaceholder(text) {
    const el = $('#resResultText');
    if (!text) { el.textContent = tt('result_placeholder'); el.classList.add('is-placeholder'); }
    else { el.textContent = text; el.classList.remove('is-placeholder'); }
  }

  // ---------- تب زیرنویس ----------
  let subState = null; // {format, cues, originalLines?}
  let subTone = settings.defaultTone;
  function initSubtitleTab() {
    fillLangSelect($('#subTgtLang'));
    $('#subTgtLang').value = settings.defaultTarget;
    fillToneChips($('#subToneChips'), (id) => (subTone = id), 'cinematic');
    $all('#subToneChips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.tone === 'cinematic'));
    subTone = 'cinematic';

    $('#subDropzone').addEventListener('click', () => $('#subInput').click());
    $('#subInput').addEventListener('change', (e) => e.target.files[0] && loadSubtitle(e.target.files[0]));
    $('#btnProcessSub').addEventListener('click', processSubtitles);
    $('#btnDownloadSub').addEventListener('click', downloadSubtitle);
  }

  async function loadSubtitle(file) {
    try {
      const content = await file.text();
      const fmt = T.subtitles.detectFormat(file.name, content);
      let cues;
      if (fmt === 'srt') cues = T.subtitles.parseSRT(content);
      else if (fmt === 'vtt') cues = T.subtitles.parseVTT(content);
      else { const r = T.subtitles.parseASS(content); cues = r.cues; subState = { originalLines: r.lines }; }
      subState = Object.assign(subState || {}, { format: fmt, cues, filename: file.name });
      renderCues();
      $('#btnProcessSub').disabled = false;
      $('#btnDownloadSub').style.display = 'none';
    } catch (e) {
      toast(tt('error_file'));
    }
  }

  function renderCues() {
    const table = $('#cueTable');
    table.innerHTML = '';
    subState.cues.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'cue-row';
      const cpsVal = T.subtitles.cps(c);
      row.innerHTML = `
        <div class="cue-time">${msLabel(c.startMs)}<br>${msLabel(c.endMs)}</div>
        <div>
          <div class="cue-text-src">${escapeHtml(c.text)}</div>
          ${c.translated ? `<div class="cue-text-tr">${escapeHtml(c.translated)} <span class="cue-cps ${cpsVal > +$('#cpsLimit').value ? 'over' : ''}">${cpsVal} CPS</span></div>` : ''}
        </div>`;
      table.appendChild(row);
    });
  }
  function msLabel(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function processSubtitles() {
    if (!guardKeys() || !subState) return;
    const btn = $('#btnProcessSub');
    setBusy(btn, true, 'process');
    try {
      const targetLang = $('#subTgtLang').value;
      const BATCH = 25;
      for (let i = 0; i < subState.cues.length; i += BATCH) {
        const chunk = subState.cues.slice(i, i + BATCH).map((c) => ({ id: c.id, text: c.text }));
        const out = await T.gemini.translateBatch({ items: chunk, targetLang, tone: subTone });
        out.forEach((o) => {
          const cue = subState.cues.find((c) => c.id === o.id);
          if (cue) cue.translated = o.text;
        });
        renderCues();
      }
      $('#btnDownloadSub').style.display = '';
      toast(tt('process'));
    } catch (e) {
      handleGeminiError(e);
    } finally {
      setBusy(btn, false, 'process');
    }
  }

  function downloadSubtitle() {
    if (!subState) return;
    const cues = subState.cues.map((c) => ({ ...c, text: c.translated || c.text }));
    let content, ext;
    if (subState.format === 'srt') { content = T.subtitles.buildSRT(cues); ext = 'srt'; }
    else if (subState.format === 'vtt') { content = T.subtitles.buildVTT(cues); ext = 'vtt'; }
    else { content = T.subtitles.buildASS(subState.originalLines, cues); ext = 'ass'; }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (subState.filename || 'subtitle').replace(/\.[^.]+$/, '') + `.${$('#subTgtLang').value}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- تب تنظیمات ----------
  const THEMES = [
    { id: 'system', dot: 'linear-gradient(135deg,#FBF8F2 50%,#14120F 50%)' },
    { id: 'light', dot: '#FBF8F2' },
    { id: 'dark', dot: '#14120F' },
    { id: 'amber', dot: '#1C1408' },
    { id: 'turquoise', dot: '#082F2D' },
  ];

  function initSettingsTab() {
    $all('#uiLangChips .chip').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.lang === settings.uiLang);
      chip.addEventListener('click', () => {
        settings = storage.saveSettings({ uiLang: chip.dataset.lang });
        applyLocaleEverywhere();
      });
    });

    const grid = $('#themeGrid');
    grid.innerHTML = '';
    THEMES.forEach((th) => {
      const el = document.createElement('button');
      el.className = 'theme-swatch' + (th.id === settings.theme ? ' is-active' : '');
      el.innerHTML = `<div class="swatch-dot" style="background:${th.dot}; border:1px solid var(--border)"></div><span data-i18n="theme_${th.id}"></span>`;
      el.addEventListener('click', () => {
        settings = storage.saveSettings({ theme: th.id });
        T.theme.apply(th.id);
        $all('.theme-swatch', grid).forEach((s) => s.classList.remove('is-active'));
        el.classList.add('is-active');
      });
      grid.appendChild(el);
    });

    fillLangSelect($('#defTgtLang'));
    $('#defTgtLang').value = settings.defaultTarget;
    $('#defTgtLang').addEventListener('change', () => { settings = storage.saveSettings({ defaultTarget: $('#defTgtLang').value }); });

    fillToneChips($('#defToneChips'), (id) => { settings = storage.saveSettings({ defaultTone: id }); }, settings.defaultTone);

    $('#modelText').value = settings.modelText;
    $('#modelTts').value = settings.modelTts;
    $('#modelText').addEventListener('change', () => { settings = storage.saveSettings({ modelText: $('#modelText').value.trim() || settings.modelText }); });
    $('#modelTts').addEventListener('change', () => { settings = storage.saveSettings({ modelTts: $('#modelTts').value.trim() || settings.modelTts }); });

    renderKeyVaultUI();
    $('#btnSetupPass').addEventListener('click', async () => {
      const pass = $('#setupPass').value;
      if (pass.length < 4) { toast(tt('error_generic')); return; }
      await T.keys.setup(pass, []);
      renderKeyVaultUI();
    });
    $('#btnUnlock').addEventListener('click', async () => {
      const pass = $('#unlockPass').value;
      try { await T.keys.unlock(pass); renderKeyVaultUI(); renderKeyList(); }
      catch (e) { toast(tt('error_generic')); }
    });
    $('#btnAddKey').addEventListener('click', () => {
      $('#newKeyLabel').value = ''; $('#newKeyValue').value = '';
      openModal('#addKeyModal');
    });
    $('#btnSaveKey').addEventListener('click', async () => {
      const label = $('#newKeyLabel').value.trim() || tt('key_label');
      const value = $('#newKeyValue').value.trim();
      if (!value) return;
      const updated = await T.keys.add(label, value);
      const added = updated[updated.length - 1];
      closeModal('#addKeyModal');
      renderKeyList();
      toast(tt('save'));
      detectAndApplyModels(value, added && added.id);
    });
  }

  // بلافاصله پس از افزودن کلید، مدل‌های در دسترسِ همان کلید را از خود Google می‌پرسد،
  // بهترین مدل متن/بینایی و بهترین مدل TTS را خودکار در تنظیمات می‌نشاند، و کل فهرست رتبه‌بندی‌شده
  // را روی خودِ کلید ذخیره می‌کند تا در صورت خطا، موتور جایگزین بدون درخواست دوباره‌ی ListModels امتحان شود
  async function detectAndApplyModels(apiKey, keyId) {
    toast(tt('detecting_models'));
    try {
      const { textModel, ttsModel, textOptions, ttsOptions } = await T.gemini.detectBestModels(apiKey);
      if (keyId) await T.keys.setModelCandidates(keyId, { textModels: textOptions, ttsModels: ttsOptions });
      const patch = {};
      if (textModel) patch.modelText = textModel;
      if (ttsModel) patch.modelTts = ttsModel;
      if (!Object.keys(patch).length) { toast(tt('model_detect_failed')); return; }
      settings = storage.saveSettings(patch);
      const modelTextInput = $('#modelText');
      const modelTtsInput = $('#modelTts');
      if (modelTextInput) modelTextInput.value = settings.modelText;
      if (modelTtsInput) modelTtsInput.value = settings.modelTts;
      toast(`${tt('models_detected')}: ${settings.modelText}`);
    } catch (e) {
      toast(tt('model_detect_failed'));
    }
  }

  function renderKeyVaultUI() {
    const hasVault = T.keys.hasVault();
    const unlocked = T.keys.isUnlocked();
    $('#keysLockedView').style.display = hasVault && !unlocked ? '' : 'none';
    $('#keysSetupView').style.display = !hasVault ? '' : 'none';
    $('#keysManagerView').style.display = unlocked ? '' : 'none';
    if (unlocked) renderKeyList();
  }

  function renderKeyList() {
    const list = $('#keyList');
    const keys = T.keys.list();
    if (!keys.length) { list.innerHTML = `<div class="empty-state">${tt('no_keys')}</div>`; return; }
    list.innerHTML = '';
    keys.forEach((k) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `
        <div class="meta">
          <strong>${escapeHtml(k.label)}</strong>
          <span>•••• ${escapeHtml(k.value.slice(-4))}</span>
        </div>
        <div class="actions">
          <span class="badge ${k.active ? 'on' : ''}">${k.active ? tt('active') : tt('inactive')}</span>
          <button class="btn ghost sm" data-act="toggle">${k.active ? tt('inactive') : tt('active')}</button>
          <button class="btn danger sm" data-act="delete">${tt('delete')}</button>
        </div>`;
      row.querySelector('[data-act="toggle"]').addEventListener('click', async () => { await T.keys.toggle(k.id); renderKeyList(); });
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => { await T.keys.remove(k.id); renderKeyList(); });
      list.appendChild(row);
    });
  }

  // ---------- تاریخچه و واژه‌نامه ----------
  function initHistoryGlossary() {
    $('#btnHistory').addEventListener('click', () => { renderHistory(); openModal('#historyModal'); });
    $('#btnGlossary').addEventListener('click', () => { renderGlossary(); openModal('#glossaryModal'); });
    $('#btnClearHistory').addEventListener('click', () => { storage.clearHistory(); renderHistory(); });
    $('#btnAddGloss').addEventListener('click', () => {
      const s = $('#glossSource').value.trim(), tgt = $('#glossTarget').value.trim();
      if (!s || !tgt) return;
      storage.addGlossaryTerm(s, tgt);
      $('#glossSource').value = ''; $('#glossTarget').value = '';
      renderGlossary();
    });
  }

  function renderHistory() {
    const list = $('#historyList');
    const items = storage.getHistory();
    if (!items.length) { list.innerHTML = `<div class="empty-state">${tt('empty_history')}</div>`; return; }
    list.innerHTML = '';
    items.slice(0, 100).forEach((it) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `<div class="meta"><strong>${escapeHtml((it.source || '').slice(0, 40) || tt('nav_' + (it.kind === 'document' ? 'resources' : it.kind === 'image' ? 'resources' : it.kind === 'live' ? 'live' : 'text')))}</strong><span>${escapeHtml((it.target || '').slice(0, 60))}</span></div>`;
      list.appendChild(row);
    });
  }

  function renderGlossary() {
    const list = $('#glossList');
    const items = storage.getGlossary();
    if (!items.length) { list.innerHTML = `<div class="empty-state">${tt('empty_glossary')}</div>`; return; }
    list.innerHTML = '';
    items.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `<div class="meta"><strong>${escapeHtml(g.source)}</strong><span>→ ${escapeHtml(g.target)}</span></div><button class="btn danger sm">${tt('delete')}</button>`;
      row.querySelector('button').addEventListener('click', () => { storage.removeGlossaryTerm(g.id); renderGlossary(); });
      list.appendChild(row);
    });
  }

  // ---------- بازتنظیم زبان رابط در همه‌جا ----------
  function applyLocaleEverywhere() {
    i18n.applyLocale(settings.uiLang);
    fillToneChips($('#toneChips'), (id) => (textTone = id), textTone);
    fillToneChips($('#resToneChips'), (id) => (resTone = id), resTone);
    fillToneChips($('#subToneChips'), (id) => (subTone = id), subTone);
    fillToneChips($('#defToneChips'), (id) => { settings = storage.saveSettings({ defaultTone: id }); }, settings.defaultTone);
    [srcLangSel(), tgtLangSel(), $('#liveLangA'), $('#liveLangB'), $('#resTgtLang'), $('#subTgtLang'), $('#defTgtLang')].forEach((sel) => {
      const val = sel.value;
      fillLangSelect(sel, { withAuto: sel === srcLangSel() });
      sel.value = val;
    });
    if ($('#resultText').classList.contains('is-placeholder')) renderResult('');
    if ($('#resResultText').classList.contains('is-placeholder')) setResPlaceholder('');
  }

  // ---------- شروع ----------
  function boot() {
    renderNav();
    initTextTab();
    initLiveTab();
    initResourcesTab();
    initSubtitleTab();
    initSettingsTab();
    initHistoryGlossary();
    T.theme.apply(settings.theme);
    i18n.applyLocale(settings.uiLang);
    switchTab('text');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
