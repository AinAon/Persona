// Storage layer: IndexedDB + LocalStorage helpers
const IDB_NAME = 'personachat_v4';
const IDB_STORE = 'images';
const IDB_VER = 3;
let _idb = null;

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(IDB_STORE)) db.deleteObjectStore(IDB_STORE);
      db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => {
      _idb = e.target.result;
      res(_idb);
    };
    req.onerror = () => rej(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbDel(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbClearAll() {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

function getLocalItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function setLocalItem(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function removeLocalItem(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

function getLocalJSON(key, fallback = null) {
  const raw = getLocalItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function setLocalJSON(key, value) {
  return setLocalItem(key, JSON.stringify(value));
}

function getLocalPersonas() { return getLocalJSON(CACHE_PERSONAS_KEY, null); }
function setLocalPersonas(data) { return setLocalJSON(CACHE_PERSONAS_KEY, data); }
function getLocalSessionIndex() { return getLocalJSON(CACHE_INDEX_KEY, null); }
function setLocalSessionIndex(data) { return setLocalJSON(CACHE_INDEX_KEY, data); }
function getLocalSession(id) { return getLocalJSON(CACHE_SESSION_PREFIX + id, null); }
function setLocalSession(id, data) { return setLocalJSON(CACHE_SESSION_PREFIX + id, data); }
function removeLocalSession(id) { return removeLocalItem(CACHE_SESSION_PREFIX + id); }
function getLocalUserProfile() { return getLocalJSON(CACHE_USER_KEY, null); }
function setLocalUserProfile(data) { return setLocalJSON(CACHE_USER_KEY, data); }
function getImageCacheBustToken() { return getLocalItem('img_cache_bust'); }
function setImageCacheBustToken(token) { return setLocalItem('img_cache_bust', String(token)); }
