// Simple IndexedDB helper (no external libs)
const DB_NAME = 'qr-item-tracker';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';

export const db = {
  _db: null,

  async open() {
    if (this._db) return this._db;
    this._db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const store = db.createObjectStore(STORE_ITEMS, { keyPath: 'code' });
          store.createIndex('byBorrower', 'borrower', { unique: false });
          store.createIndex('byDate', 'borrowedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._db;
  },

  async get(code) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      tx.oncomplete = () => {};
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.get(code);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async put(item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(code) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      store.delete(code);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async all() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = req.result || [];
        arr.sort((a,b)=>b.borrowedAt - a.borrowedAt);
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
