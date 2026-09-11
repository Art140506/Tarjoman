// ترجمان — استخراج متن از اسناد (PDF/DOCX/TXT) به‌صورت کاملاً سمت‌کاربر
(function () {
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

  function getExtension(name) {
    const m = /\.([^.]+)$/.exec(String(name || '').toLowerCase());
    return m ? m[1] : '';
  }

  function validateFile(file) {
    if (!file || typeof file.name !== 'string') throw new Error('invalid-file');
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error('unsupported-file');
    if (file.size > MAX_FILE_BYTES) throw new Error('file-too-large');
  }

  async function extractFromPDF(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdfjs-not-loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';
    const doc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str || '').join(' ').trim());
    }
    return pages.filter(Boolean).join('\n\n').trim();
  }

  async function extractFromDOCX(arrayBuffer) {
    if (!window.mammoth) throw new Error('mammoth-not-loaded');
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return (result.value || '').trim();
  }

  function extractFromTXT(text) {
    return String(text || '').replace(/^\uFEFF/, '').trim();
  }

  async function extractDocumentText(file) {
    validateFile(file);
    const ext = getExtension(file.name);
    if (ext === 'pdf') return extractFromPDF(await file.arrayBuffer());
    if (ext === 'docx') return extractFromDOCX(await file.arrayBuffer());
    return extractFromTXT(await file.text());
  }

  function fileToBase64(file) {
    validateFile(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.onabort = () => reject(new Error('file-read-aborted'));
      reader.readAsDataURL(file);
    });
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.documents = { extractDocumentText, fileToBase64, validateFile, MAX_FILE_BYTES };
})();
