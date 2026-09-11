// ترجمان — صندوق کلید محلی (رمزنگاری AES-GCM با Web Crypto، بدون هیچ سرور)
(function () {
  const storage = () => window.Tarjoman.storage;

  let memoryKeys = null; // [{id, label, value, active}] — فقط پس از باز شدن قفل، در حافظه
  let cryptoKey = null;  // CryptoKey مشتق‌شده از رمز محلی، فقط در حافظه

  function b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function unb64(str) {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  }

  async function deriveKey(passphrase, saltB64) {
    const enc = new TextEncoder();
    const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return { key, saltB64: b64(salt) };
  }

  async function encryptKeys(passphrase, keysArray) {
    const { key, saltB64 } = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(keysArray)));
    cryptoKey = key;
    return { salt: saltB64, iv: b64(iv), cipher: b64(cipherBuf) };
  }

  async function decryptVault(passphrase, vault) {
    const { key } = await deriveKey(passphrase, vault.salt);
    const iv = unb64(vault.iv);
    const cipher = unb64(vault.cipher);
    const dec = new TextDecoder();
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    cryptoKey = key;
    return JSON.parse(dec.decode(plainBuf));
  }

  const Keys = {
    isUnlocked() {
      return Array.isArray(memoryKeys);
    },
    hasVault() {
      return storage().hasVault();
    },

    async setup(passphrase, initialKeys) {
      memoryKeys = initialKeys || [];
      const vault = await encryptKeys(passphrase, memoryKeys);
      storage().saveKeyVault(vault);
      return true;
    },

    async unlock(passphrase) {
      const vault = storage().getKeyVault();
      if (!vault) throw new Error('no-vault');
      memoryKeys = await decryptVault(passphrase, vault);
      return memoryKeys;
    },

    lock() {
      memoryKeys = null;
      cryptoKey = null;
    },

    async persist() {
      if (!cryptoKey || !memoryKeys) return;
      const vault = storage().getKeyVault();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(JSON.stringify(memoryKeys)));
      storage().saveKeyVault({ salt: vault.salt, iv: b64(iv), cipher: b64(cipherBuf) });
    },

    list() {
      return memoryKeys || [];
    },

    async add(label, value) {
      if (!this.isUnlocked()) throw new Error('locked');
      memoryKeys.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), label, value, active: true });
      await this.persist();
      return memoryKeys;
    },

    async remove(id) {
      if (!this.isUnlocked()) throw new Error('locked');
      memoryKeys = memoryKeys.filter((k) => k.id !== id);
      await this.persist();
      return memoryKeys;
    },

    async toggle(id) {
      if (!this.isUnlocked()) throw new Error('locked');
      memoryKeys = memoryKeys.map((k) => (k.id === id ? Object.assign({}, k, { active: !k.active }) : k));
      await this.persist();
      return memoryKeys;
    },

    // یک کلید فعال را برمی‌گرداند و اشاره‌گر چرخشی را جلو می‌برد (چرخش ساده‌ی round-robin)
    _cursor: 0,
    nextActive() {
      const active = (memoryKeys || []).filter((k) => k.active && k.value);
      if (!active.length) return null;
      const k = active[this._cursor % active.length];
      this._cursor++;
      return k;
    },
    activeCount() {
      return (memoryKeys || []).filter((k) => k.active && k.value).length;
    },
  };

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.keys = Keys;
})();
