// ترجمان — لایه‌ی ذخیره‌سازی محلی
(function () {
  const NS = 'tarjoman.';

  const DEFAULT_SETTINGS = {
    uiLang: (navigator.language || 'fa').slice(0, 2).match(/fa|en|ar|tr/) ? (navigator.language || 'fa').slice(0, 2) : 'fa',
    theme: 'system',
    defaultTarget: 'en',
    defaultTone: 'literary',
    modelText: 'auto',
    modelTts: 'auto',
    ttsVoice: 'Kore',
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  const Storage = {
    getSettings() {
      return Object.assign({}, DEFAULT_SETTINGS, readJSON('settings', {}));
    },
    saveSettings(patch) {
      const merged = Object.assign({}, this.getSettings(), patch);
      writeJSON('settings', merged);
      return merged;
    },

    getHistory() {
      return readJSON('history', []);
    },
    addHistory(entry) {
      const list = this.getHistory();
      list.unshift(Object.assign({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), ts: Date.now() }, entry));
      writeJSON('history', list.slice(0, 300));
      return list;
    },
    clearHistory() {
      writeJSON('history', []);
    },

    getGlossary() {
      return readJSON('glossary', []);
    },
    addGlossaryTerm(source, target) {
      const list = this.getGlossary();
      list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), source, target });
      writeJSON('glossary', list);
      return list;
    },
    removeGlossaryTerm(id) {
      const list = this.getGlossary().filter((g) => g.id !== id);
      writeJSON('glossary', list);
      return list;
    },

    // بلاب رمزنگاری‌شده‌ی کلیدها
    getKeyVault() {
      return readJSON('keyvault', null); // {salt, iv, cipher}
    },
    saveKeyVault(vault) {
      writeJSON('keyvault', vault);
    },
    hasVault() {
      return !!this.getKeyVault();
    },
    clearVault() {
      localStorage.removeItem(NS + 'keyvault');
    },
  };

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.storage = Storage;
})();
