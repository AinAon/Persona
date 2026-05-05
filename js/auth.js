const PERSONA_AUTH_TOKEN_KEY = 'persona_google_id_token';
const PERSONA_AUTH_USER_KEY = 'persona_google_user';
const PERSONA_ADMIN_PASSWORD = '1234';
const PERSONA_GOOGLE_OAUTH_TOKEN_KEY = 'persona_google_oauth_token';
const PERSONA_GOOGLE_OAUTH_EXPIRES_AT_KEY = 'persona_google_oauth_expires_at';
const PERSONA_GOOGLE_DRIVE_FILE_ID_KEY = 'persona_google_drive_file_id';
const PERSONA_GOOGLE_SHEET_ID_KEY = 'persona_google_sheet_id';
const GOOGLE_RW_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
].join(' ');

let _googleOauthClientId = '';
let _googleTokenClient = null;

function getPersonaAuthToken() {
  try { return localStorage.getItem(PERSONA_AUTH_TOKEN_KEY) || ''; } catch { return ''; }
}

function getPersonaAuthUser() {
  try {
    const raw = localStorage.getItem(PERSONA_AUTH_USER_KEY) || '';
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getPersonaAccountKey() {
  const user = getPersonaAuthUser();
  return String(user?.userId || user?.email || 'local_default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getPersonaAdminKey() {
  return `persona_admin_enabled_${getPersonaAccountKey()}`;
}

function getPersonaStorageMode() {
  return isPersonaAdminMode() ? 'admin' : 'user';
}

function getPersonaStorageNamespace() {
  if (getPersonaStorageMode() === 'admin') return 'admin_local_default';
  const accountKey = getPersonaAccountKey();
  return `${getPersonaStorageMode()}_${accountKey}`;
}

function isPersonaAdminMode() {
  try {
    const qs = new URLSearchParams(location.search || '');
    if (qs.get('basic') === '1' || sessionStorage.getItem('persona_force_basic') === '1') return false;
  } catch {}
  try { return localStorage.getItem(getPersonaAdminKey()) === '1'; } catch { return false; }
}

function setPersonaAdminMode(enabled) {
  try {
    if (enabled) localStorage.setItem(getPersonaAdminKey(), '1');
    else localStorage.removeItem(getPersonaAdminKey());
  } catch {}
  applyPersonaAdminGate();
}

function applyPersonaAdminGate() {
  const isAdmin = isPersonaAdminMode();
  document.body?.classList.toggle('is-admin', isAdmin);
  document.body?.classList.toggle('is-basic-user', !isAdmin);
  const label = document.getElementById('adminModeState');
  if (label) label.textContent = isAdmin ? '관리자 모드 활성화' : '일반 계정 모드';
  const input = document.getElementById('adminPasswordInput');
  if (input && isAdmin) input.value = '';
}

function enableAdminModeFromInput() {
  const input = document.getElementById('adminPasswordInput');
  const value = String(input?.value || '').trim();
  if (value !== PERSONA_ADMIN_PASSWORD) {
    const label = document.getElementById('adminModeState');
    if (label) label.textContent = '비밀번호가 맞지 않습니다';
    return;
  }
  setPersonaAdminMode(true);
  location.reload();
}

function disableAdminMode() {
  setPersonaAdminMode(false);
  location.reload();
}

function installPersonaAdminStyle() {
  if (document.getElementById('personaAdminGateStyle')) return;
  const style = document.createElement('style');
  style.id = 'personaAdminGateStyle';
  style.textContent = `
body.is-basic-user #btabArchive,
body.is-basic-user #archivePane,
body.is-basic-user #chatRefreshBtn,
body.is-basic-user #chatProfileToggleBtn,
body.is-basic-user .chat-settings-btn,
body.is-basic-user #itab-image,
body.is-basic-user #itab-context,
body.is-basic-user #itab-opts-image,
body.is-basic-user #itab-opts-context,
body.is-basic-user #imageArea,
body.is-basic-user #popupDeleteBtn,
body.is-basic-user #editDeleteTitleBtn,
body.is-basic-user .archive-batch-delete,
body.is-basic-user .archive-batch-cancel,
body.is-basic-user .persona-card.add-card,
body.is-basic-user button[onclick*="openRestoreModal"],
body.is-basic-user button[onclick*="clearImageCache"],
body.is-basic-user button[onclick*="clearTtsAudioCache"],
body.is-basic-user button[onclick*="openEmotionManager"],
body.is-basic-user button[onclick*="deleteChat"],
body.is-basic-user button[onclick*="resetChat"],
body.is-basic-user button[onclick*="openInviteModal"],
body.is-basic-user .composer-tools-item#toolMode_image,
body.is-basic-user .composer-tools-item#toolMode_project,
body.is-basic-user [data-admin-only="true"] {
  display: none !important;
}
body.is-basic-user .input-tabbar {
  display: none !important;
}
`;
  document.head.appendChild(style);
}

function setPersonaAuth(token, user) {
  try {
    localStorage.setItem(PERSONA_AUTH_TOKEN_KEY, String(token || ''));
    localStorage.setItem(PERSONA_AUTH_USER_KEY, JSON.stringify(user || null));
  } catch {}
}

function clearPersonaAuth() {
  try {
    localStorage.removeItem(PERSONA_AUTH_TOKEN_KEY);
    localStorage.removeItem(PERSONA_AUTH_USER_KEY);
  } catch {}
}

function setGoogleWorkspaceToken(token, expiresInSec) {
  const ttl = Number(expiresInSec || 0);
  const expiresAt = Date.now() + Math.max(60, ttl) * 1000;
  try {
    localStorage.setItem(PERSONA_GOOGLE_OAUTH_TOKEN_KEY, String(token || ''));
    localStorage.setItem(PERSONA_GOOGLE_OAUTH_EXPIRES_AT_KEY, String(expiresAt));
  } catch {}
}

function getGoogleWorkspaceToken() {
  try {
    const token = localStorage.getItem(PERSONA_GOOGLE_OAUTH_TOKEN_KEY) || '';
    const expiresAt = Number(localStorage.getItem(PERSONA_GOOGLE_OAUTH_EXPIRES_AT_KEY) || 0);
    if (!token || !expiresAt || Date.now() > (expiresAt - 30000)) return '';
    return token;
  } catch {
    return '';
  }
}

async function requestGoogleWorkspaceToken(interactive = true) {
  if (!_googleTokenClient || !_googleOauthClientId) return '';
  const current = getGoogleWorkspaceToken();
  if (current) return current;
  return await new Promise((resolve) => {
    _googleTokenClient.callback = (resp) => {
      if (!resp || resp.error) return resolve('');
      setGoogleWorkspaceToken(resp.access_token || '', Number(resp.expires_in || 0));
      resolve(getGoogleWorkspaceToken());
    };
    _googleTokenClient.requestAccessToken({
      prompt: interactive ? 'consent' : '',
      scope: GOOGLE_RW_SCOPES
    });
  });
}

async function ensureGoogleWorkspaceAccess(interactive = true) {
  const user = getPersonaAuthUser();
  if (!user || isPersonaAdminMode()) return '';
  return await requestGoogleWorkspaceToken(interactive);
}

function isWorkerUrl(url) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !url) return false;
  try {
    const u = new URL(String(url), window.location.href);
    return u.href.startsWith(wUrl + '/');
  } catch {
    return false;
  }
}

function appendPersonaAuthToUrl(url) {
  if (isPersonaAdminMode()) return url;
  const token = getPersonaAuthToken();
  if (!token || !isWorkerUrl(url)) return url;
  try {
    const u = new URL(String(url), window.location.href);
    if (!u.searchParams.get('authToken')) u.searchParams.set('authToken', token);
    return u.toString();
  } catch {
    return url;
  }
}

(function installPersonaAuthFetchPatch() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function personaAuthFetch(input, init = {}) {
    if (isPersonaAdminMode()) return nativeFetch(input, init);
    const token = getPersonaAuthToken();
    const url = typeof input === 'string' ? input : input?.url;
    if (!token || !isWorkerUrl(url)) return nativeFetch(input, init);

    const headers = new Headers(init?.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return nativeFetch(input, { ...init, headers });
  };
})();

async function verifyGoogleCredential(credential) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !credential) return null;
  const res = await fetch(`${wUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'google login failed');
  setPersonaAuth(credential, data.user);
  return data.user;
}

function renderAuthState() {
  const box = document.getElementById('googleLoginState');
  const user = getPersonaAuthUser();
  if (!box) return;
  if (!user) {
    box.textContent = '로그인 필요';
    return;
  }
  box.textContent = user.email || user.name || user.userId || 'Google 로그인됨';
  applyPersonaAdminGate();
}

async function initGoogleLogin() {
  renderAuthState();
  const target = document.getElementById('googleLoginButton');
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!target || !wUrl) return;
  try {
    const cfgRes = await fetch(`${wUrl}/auth/config`, { cache: 'no-store' });
    const cfg = await cfgRes.json();
    if (!cfg?.enabled || !cfg?.clientId) {
      target.textContent = 'GOOGLE_CLIENT_ID 미설정';
      return;
    }
    _googleOauthClientId = String(cfg.clientId || '').trim();
    if (!window.google?.accounts?.id) {
      target.textContent = 'Google SDK 로딩 중';
      setTimeout(initGoogleLogin, 700);
      return;
    }
    target.textContent = '';
    window.google.accounts.id.initialize({
      client_id: cfg.clientId,
      callback: async (response) => {
        try {
          await verifyGoogleCredential(response?.credential || '');
          await ensureGoogleWorkspaceAccess(true).catch(() => '');
          renderAuthState();
          location.reload();
        } catch (e) {
          const box = document.getElementById('googleLoginState');
          if (box) box.textContent = String(e?.message || e || '로그인 실패');
        }
      }
    });
    window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'medium', width: 240 });
    if (window.google?.accounts?.oauth2 && _googleOauthClientId) {
      _googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: _googleOauthClientId,
        scope: GOOGLE_RW_SCOPES,
        callback: () => {}
      });
    }
  } catch (e) {
    target.textContent = '로그인 설정 확인 실패';
  }
}

function signOutGoogle() {
  setPersonaAdminMode(false);
  clearPersonaAuth();
  try {
    localStorage.removeItem(PERSONA_GOOGLE_OAUTH_TOKEN_KEY);
    localStorage.removeItem(PERSONA_GOOGLE_OAUTH_EXPIRES_AT_KEY);
    localStorage.removeItem(PERSONA_GOOGLE_DRIVE_FILE_ID_KEY);
    localStorage.removeItem(PERSONA_GOOGLE_SHEET_ID_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${PERSONA_GOOGLE_DRIVE_FILE_ID_KEY}_`) || key.startsWith(`${PERSONA_GOOGLE_SHEET_ID_KEY}_`)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
  renderAuthState();
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  installPersonaAdminStyle();
  applyPersonaAdminGate();
});

window.getPersonaAuthToken = getPersonaAuthToken;
window.getPersonaAuthUser = getPersonaAuthUser;
window.appendPersonaAuthToUrl = appendPersonaAuthToUrl;
window.initGoogleLogin = initGoogleLogin;
window.signOutGoogle = signOutGoogle;
window.isPersonaAdminMode = isPersonaAdminMode;
window.applyPersonaAdminGate = applyPersonaAdminGate;
window.enableAdminModeFromInput = enableAdminModeFromInput;
window.disableAdminMode = disableAdminMode;
window.getPersonaStorageMode = getPersonaStorageMode;
window.getPersonaStorageNamespace = getPersonaStorageNamespace;
window.ensureGoogleWorkspaceAccess = ensureGoogleWorkspaceAccess;
window.getGoogleWorkspaceToken = getGoogleWorkspaceToken;
window.PERSONA_GOOGLE_DRIVE_FILE_ID_KEY = PERSONA_GOOGLE_DRIVE_FILE_ID_KEY;
window.PERSONA_GOOGLE_SHEET_ID_KEY = PERSONA_GOOGLE_SHEET_ID_KEY;
