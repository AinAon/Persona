const GOOGLE_WORKSPACE_SYNC_DEBOUNCE_MS = 1200;
let _googleWorkspaceSyncTimer = null;
let _googleWorkspaceSyncInFlight = false;
let _googleWorkspaceSyncQueued = false;

async function gFetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function workspaceLocalKey(key) {
  const ns = typeof getPersonaStorageNamespace === 'function' ? getPersonaStorageNamespace() : 'user_local_default';
  return `${key}_${ns}`;
}

function getWorkspaceLocalItem(key) {
  try { return localStorage.getItem(workspaceLocalKey(key)) || ''; } catch { return ''; }
}

function setWorkspaceLocalItem(key, value) {
  try { localStorage.setItem(workspaceLocalKey(key), String(value || '')); } catch {}
}

async function ensureDrivePersonaFile(token) {
  const key = typeof PERSONA_GOOGLE_DRIVE_FILE_ID_KEY !== 'undefined' ? PERSONA_GOOGLE_DRIVE_FILE_ID_KEY : 'persona_google_drive_file_id';
  const existingId = getWorkspaceLocalItem(key);
  if (existingId) return existingId;

  const q = encodeURIComponent("name='persona_user_data.json' and trashed=false");
  const list = await gFetchJson(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const found = Array.isArray(list.files) && list.files.length ? String(list.files[0].id || '') : '';
  if (found) {
    setWorkspaceLocalItem(key, found);
    return found;
  }

  const boundary = `persona_boundary_${Date.now()}`;
  const meta = { name: 'persona_user_data.json', mimeType: 'application/json' };
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(meta),
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    JSON.stringify({ version: 1, personas: [], sessions: [], profile: null }),
    `\r\n--${boundary}--`
  ].join('');
  const create = await gFetchJson('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  const id = String(create?.id || '');
  if (id) setWorkspaceLocalItem(key, id);
  return id;
}

async function ensurePersonaSheet(token) {
  const key = typeof PERSONA_GOOGLE_SHEET_ID_KEY !== 'undefined' ? PERSONA_GOOGLE_SHEET_ID_KEY : 'persona_google_sheet_id';
  const existingId = getWorkspaceLocalItem(key);
  if (existingId) return existingId;

  const q = encodeURIComponent("name='Persona User Data' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const list = await gFetchJson(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => ({ files: [] }));
  const found = Array.isArray(list.files) && list.files.length ? String(list.files[0].id || '') : '';
  if (found) {
    setWorkspaceLocalItem(key, found);
    return found;
  }

  const created = await gFetchJson('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title: 'Persona User Data' },
      sheets: [
        { properties: { title: 'Personas' } },
        { properties: { title: 'Sessions' } },
        { properties: { title: 'Profile' } }
      ]
    })
  });
  const id = String(created?.spreadsheetId || '');
  if (id) setWorkspaceLocalItem(key, id);
  return id;
}

function buildGoogleWorkspacePayload() {
  const livePersonas = typeof personas !== 'undefined' && Array.isArray(personas) ? personas : null;
  const liveSessions = typeof sessions !== 'undefined' && Array.isArray(sessions) ? sessions : null;
  const localPersonas = typeof getLocalPersonas === 'function' ? getLocalPersonas() : null;
  const localIndex = typeof getLocalSessionIndex === 'function' ? getLocalSessionIndex() : null;
  const personaList = livePersonas || (Array.isArray(localPersonas) ? localPersonas : []);
  const sessionIndex = liveSessions ? buildIndex() : (Array.isArray(localIndex) ? localIndex : []);
  const sessionRows = [];
  for (const item of sessionIndex) {
    const id = item?.id;
    if (!id) continue;
    const live = liveSessions ? liveSessions.find(s => s?.id === id) : null;
    const localHistory = typeof getLocalSession === 'function' ? getLocalSession(id) : [];
    const history = Array.isArray(live?.history) && live._loaded === true ? live.history : (localHistory || []);
    sessionRows.push({ ...item, history: Array.isArray(history) ? history : [] });
  }
  const localProfile = typeof getLocalUserProfile === 'function' ? getLocalUserProfile() : null;
  const profile = (typeof userProfile !== 'undefined' && userProfile) ? userProfile : (localProfile || null);
  return {
    version: 1,
    savedAt: Date.now(),
    storageNamespace: typeof getPersonaStorageNamespace === 'function' ? getPersonaStorageNamespace() : '',
    personas: personaList,
    sessions: sessionRows,
    profile
  };
}

async function writeDriveWorkspaceSnapshot(token, payload) {
  const fileId = await ensureDrivePersonaFile(token);
  if (!fileId) return;
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Drive sync failed: HTTP ${res.status}`);
}

async function readDriveWorkspaceSnapshot(token) {
  const fileId = await ensureDrivePersonaFile(token);
  if (!fileId) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function writeSheetValues(token, sheetId, range, rows) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => {});
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });
  if (!res.ok) throw new Error(`Sheets sync failed: HTTP ${res.status}`);
}

async function writeSheetsWorkspaceSnapshot(token, payload) {
  const sheetId = await ensurePersonaSheet(token);
  if (!sheetId) return;
  const personaRows = [['pid', 'name', 'bio', 'updatedAt']];
  for (const p of (payload.personas || [])) {
    personaRows.push([String(p?.pid || ''), String(p?.name || ''), String(p?.bio || ''), String(p?.updatedAt || '')]);
  }
  const sessionRows = [['id', 'roomName', 'messageCount', 'lastMessageAt', 'updatedAt']];
  for (const s of (payload.sessions || [])) {
    sessionRows.push([String(s?.id || ''), String(s?.roomName || ''), String(s?.messageCount || 0), String(s?.lastMessageAt || ''), String(s?.updatedAt || '')]);
  }
  const profileRows = [['key', 'value']];
  for (const [key, value] of Object.entries(payload.profile || {})) {
    profileRows.push([String(key), typeof value === 'string' ? value : JSON.stringify(value)]);
  }
  await writeSheetValues(token, sheetId, 'Personas!A1:D', personaRows);
  await writeSheetValues(token, sheetId, 'Sessions!A1:E', sessionRows);
  await writeSheetValues(token, sheetId, 'Profile!A1:B', profileRows);
}

async function flushGoogleWorkspaceSync() {
  if (typeof isPersonaAdminMode === 'function' && isPersonaAdminMode()) return;
  if (typeof ensureGoogleWorkspaceAccess !== 'function') return;
  if (_googleWorkspaceSyncInFlight) {
    _googleWorkspaceSyncQueued = true;
    return;
  }
  const token = await ensureGoogleWorkspaceAccess(false);
  if (!token) return;
  _googleWorkspaceSyncInFlight = true;
  try {
    const payload = buildGoogleWorkspacePayload();
    await writeDriveWorkspaceSnapshot(token, payload);
    await writeSheetsWorkspaceSnapshot(token, payload);
  } finally {
    _googleWorkspaceSyncInFlight = false;
    if (_googleWorkspaceSyncQueued) {
      _googleWorkspaceSyncQueued = false;
      scheduleGoogleWorkspaceSync();
    }
  }
}

function scheduleGoogleWorkspaceSync() {
  if (_googleWorkspaceSyncTimer) clearTimeout(_googleWorkspaceSyncTimer);
  _googleWorkspaceSyncTimer = setTimeout(() => {
    _googleWorkspaceSyncTimer = null;
    flushGoogleWorkspaceSync().catch(() => {});
  }, GOOGLE_WORKSPACE_SYNC_DEBOUNCE_MS);
}

async function loadGoogleWorkspaceData(interactive = false) {
  if (typeof isPersonaAdminMode === 'function' && isPersonaAdminMode()) return false;
  if (typeof ensureGoogleWorkspaceAccess !== 'function') return false;
  const token = await ensureGoogleWorkspaceAccess(interactive);
  if (!token) return false;
  const payload = await readDriveWorkspaceSnapshot(token);
  if (!payload || typeof payload !== 'object') return false;
  if (Array.isArray(payload.personas) && payload.personas.length) setLocalPersonas(payload.personas);
  if (Array.isArray(payload.sessions)) {
    const index = payload.sessions.map(({ history, ...rest }) => rest);
    setLocalSessionIndex(index);
    for (const s of payload.sessions) {
      if (s?.id && Array.isArray(s.history)) setLocalSession(s.id, s.history);
    }
  }
  if (payload.profile && typeof payload.profile === 'object') setLocalUserProfile(payload.profile);
  return true;
}

function syncPersonasToGoogleWorkspace() { scheduleGoogleWorkspaceSync(); }
function syncIndexToGoogleWorkspace() { scheduleGoogleWorkspaceSync(); }
function syncSessionToGoogleWorkspace() { scheduleGoogleWorkspaceSync(); }
function syncProfileToGoogleWorkspace() { scheduleGoogleWorkspaceSync(); }

window.loadGoogleWorkspaceData = loadGoogleWorkspaceData;
window.syncPersonasToGoogleWorkspace = syncPersonasToGoogleWorkspace;
window.syncIndexToGoogleWorkspace = syncIndexToGoogleWorkspace;
window.syncSessionToGoogleWorkspace = syncSessionToGoogleWorkspace;
window.syncProfileToGoogleWorkspace = syncProfileToGoogleWorkspace;
