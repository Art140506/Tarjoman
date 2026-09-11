// ترجمان — استخراج متن از اسناد (PDF/DOCX/TXT) به‌صورت کاملاً سمت‌کاربر
(function () {
  async function extractFromPDF(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdfjs-not-loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';
    const doc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n\n';
    }
    return text.trim();
  }

  async function extractFromDOCX(arrayBuffer) {
    if (!window.mammoth) throw new Error('mammoth-not-loaded');
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return (result.value || '').trim();
  }

  function extractFromTXT(text) {
    return text.trim();
  }

  async function extractDocumentText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      const buf = await file.arrayBuffer();
      return extractFromPDF(buf);
    }
    if (name.endsWith('.docx')) {
      const buf = await file.arrayBuffer();
      return extractFromDOCX(buf);
    }
    // txt یا هر متن ساده‌ی دیگر
    return extractFromTXT(await file.text());
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.documents = { extractDocumentText, fileToBase64 };
})();
