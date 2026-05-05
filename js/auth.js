const PERSONA_AUTH_TOKEN_KEY = 'persona_google_id_token';
const PERSONA_AUTH_USER_KEY = 'persona_google_user';

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
          renderAuthState();
          location.reload();
        } catch (e) {
          const box = document.getElementById('googleLoginState');
          if (box) box.textContent = String(e?.message || e || '로그인 실패');
        }
      }
    });
    window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'medium', width: 240 });
  } catch (e) {
    target.textContent = '로그인 설정 확인 실패';
  }
}

function signOutGoogle() {
  clearPersonaAuth();
  renderAuthState();
  location.reload();
}

window.getPersonaAuthToken = getPersonaAuthToken;
window.getPersonaAuthUser = getPersonaAuthUser;
window.appendPersonaAuthToUrl = appendPersonaAuthToUrl;
window.initGoogleLogin = initGoogleLogin;
window.signOutGoogle = signOutGoogle;
