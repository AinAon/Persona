// Storage layer: IndexedDB + LocalStorage helpers
const IDB_NAME = 'personachat_v4';
const IDB_STORE = 'images';
const IDB_VER = 3;
const LEGACY_TO_ADMIN_MIGRATED_KEY = 'pc4_migrated_to_admin_v1';
const LEGACY_IDB_TO_ADMIN_MIGRATED_KEY = 'pc4_idb_migrated_to_admin_v1';
let _idb = null;

function getStorageNsPrefix() {
  try {
    const ns = (typeof getPersonaStorageNamespace === 'function' ? getPersonaStorageNamespace() : 'user_local_default');
    return `pc4ns:${String(ns || 'user_local_default')}:`;
  } catch {
    return 'pc4ns:user_local_default:';
  }
}

function toScopedKey(key) {
  return `${getStorageNsPrefix()}${String(key || '')}`;
}

function toScopedIdbKey(key) {
  return toScopedKey(key);
}

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
  const scopedKey = toScopedIdbKey(key);
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, scopedKey);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(key) {
  const db = await openIDB();
  const scopedKey = toScopedIdbKey(key);
  return new Promise((res, rej) => {
    const store = db.transaction(IDB_STORE).objectStore(IDB_STORE);
    const req = store.get(scopedKey);
    req.onsuccess = () => {
      if (req.result !== undefined || getStorageNsPrefix() !== 'pc4ns:admin_local_default:') return res(req.result);
      const legacyReq = store.get(key);
      legacyReq.onsuccess = () => res(legacyReq.result);
      legacyReq.onerror = () => rej(legacyReq.error);
    };
    req.onerror = () => rej(req.error);
  });
}

async function idbDel(key) {
  const db = await openIDB();
  const scopedKey = toScopedIdbKey(key);
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(scopedKey);
    if (getStorageNsPrefix() === 'pc4ns:admin_local_default:') store.delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbDelByPrefix(prefix) {
  const db = await openIDB();
  const rawPrefix = String(prefix || '');
  if (!rawPrefix) return 0;
  const start = toScopedIdbKey(rawPrefix);
  const end = `${start}\uffff`;
  return new Promise((res, rej) => {
    let deleted = 0;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const range = IDBKeyRange.bound(start, end, false, false);
    const req = store.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      cursor.delete();
      deleted++;
      cursor.continue();
    };
    tx.oncomplete = () => res(deleted);
    tx.onerror = () => rej(tx.error);
    req.onerror = () => rej(req.error);
  });
}

async function idbClearAll() {
  const db = await openIDB();
  const start = getStorageNsPrefix();
  const end = `${start}\uffff`;
  return new Promise((res, rej) => {
    let deleted = 0;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.openCursor(IDBKeyRange.bound(start, end, false, false));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      cursor.delete();
      deleted++;
      cursor.continue();
    };
    tx.oncomplete = () => res(deleted);
    tx.onerror = () => rej(tx.error);
    req.onerror = () => rej(req.error);
  });
}

function getLocalItem(key) {
  try { return localStorage.getItem(toScopedKey(key)); } catch { return null; }
}

function setLocalItem(key, value) {
  try { localStorage.setItem(toScopedKey(key), value); return true; } catch { return false; }
}

function removeLocalItem(key) {
  try { localStorage.removeItem(toScopedKey(key)); return true; } catch { return false; }
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

function migrateLegacyLocalStorageToAdminNamespaceOnce() {
  try {
    if (localStorage.getItem(LEGACY_TO_ADMIN_MIGRATED_KEY) === '1') return;
    const adminNs = `pc4ns:admin_local_default:`;
    const keysToMove = [
      CACHE_PERSONAS_KEY,
      CACHE_INDEX_KEY,
      CACHE_USER_KEY,
      'img_cache_bust',
      'group_router_debug',
      'em_cache_ping'
    ];
    for (const k of keysToMove) {
      const v = localStorage.getItem(k);
      if (v != null && localStorage.getItem(`${adminNs}${k}`) == null) {
        localStorage.setItem(`${adminNs}${k}`, v);
      }
      localStorage.removeItem(k);
    }
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (!key.startsWith(CACHE_SESSION_PREFIX)) continue;
      const val = localStorage.getItem(key);
      if (val != null && localStorage.getItem(`${adminNs}${key}`) == null) {
        localStorage.setItem(`${adminNs}${key}`, val);
      }
      localStorage.removeItem(key);
    }
    localStorage.setItem(LEGACY_TO_ADMIN_MIGRATED_KEY, '1');
  } catch {}
}

migrateLegacyLocalStorageToAdminNamespaceOnce();

async function migrateLegacyIdbToAdminNamespaceOnce() {
  try {
    if (localStorage.getItem(LEGACY_IDB_TO_ADMIN_MIGRATED_KEY) === '1') return;
    const db = await openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        const key = String(cursor.key || '');
        if (key && !key.startsWith('pc4ns:')) {
          store.put(cursor.value, `pc4ns:admin_local_default:${key}`);
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      req.onerror = () => rej(req.error);
    });
    localStorage.setItem(LEGACY_IDB_TO_ADMIN_MIGRATED_KEY, '1');
  } catch {}
}

migrateLegacyIdbToAdminNamespaceOnce();
