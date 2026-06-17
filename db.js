const DB_NAME = 'trastero-db';
const DB_VERSION = 1;

let database;

export const db = {
  async init() {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        db.createObjectStore('items', { keyPath: 'id' });
        db.createObjectStore('pending', { autoIncrement: true });
      };

      request.onsuccess = (e) => {
        database = e.target.result;
        resolve();
      };
    });
  },

  async add(store, value) {
    const tx = database.transaction(store, 'readwrite');
    tx.objectStore(store).add(value);
  },

  async getAll(store) {
    return new Promise((resolve) => {
      const tx = database.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();

      req.onsuccess = () => resolve(req.result);
    });
  },

  async clear(store) {
    const tx = database.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
  }
};

await db.init();