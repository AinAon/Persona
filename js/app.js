// ══════════════════════════════
//  DEMO CHAT REPLY LOGIC
// ══════════════════════════════
function setLoading(isLoading, text) {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (!overlay) return;
  if (textEl && typeof text === 'string') textEl.textContent = text;
  overlay.classList.toggle('hidden', !isLoading);
}

function startDemoChat() {
  const session = {
    id: 'demo_' + uid(),
    participantPids: personas.slice(0,2).map(p=>p.pid),
    responseMode: 'all',
    worldContext: '',
    history: [], updatedAt: Date.now(), lastPreview: 'Demo',
    _loaded: true, _demo: true
  };
  sessions.push(session);
  activeChatId = session.id;
  switchTab('chat');
  openChat(session.id);
}

function openEmotionManager() {
  const v = Date.now();
  let pid = '';
  try {
    if (typeof editingPid === 'string' && editingPid) pid = editingPid;
  } catch {}
  const qs = new URLSearchParams({ v: String(v) });
  if (pid) qs.set('pid', pid);
  window.open(`./emotion-manager.html?${qs.toString()}`, '_blank', 'noopener,noreferrer');
}

window.getDemoReply = function(session) {
  const pids = session.participantPids;
  
  // 사용자의 마지막 입력 메시지 추출
  let userText = '';
  if (session.history && session.history.length > 0) {
    const lastMsg = session.history[session.history.length - 1];
    if (lastMsg.role === 'user') {
      userText = typeof lastMsg.content === 'string' 
        ? lastMsg.content 
        : (Array.isArray(lastMsg.content) ? lastMsg.content.find(c => c.type === 'text')?.text || '' : String(lastMsg.content || ''));
    }
  }

  // '/모든감정' 명령어 처리
  if (userText.trim() === '/모든감정') {
    let result = '';
    for (const pid of pids) {
      for (const emotion of EMOTIONS) {
        result += `[${pid}][emotion:${emotion}](테스트) 현재 감정: ${emotion}[/${pid}]\n\n`;
      }
    }
    return result.trim();
  }

  // 기본 데모 응답
  const e1 = EMOTIONS[demoEmotionIdx % EMOTIONS.length]; demoEmotionIdx++;
  const e2 = EMOTIONS[demoEmotionIdx % EMOTIONS.length]; demoEmotionIdx++;
  if (pids.length === 1) return `[${pids[0]}][emotion:${e1}](demo) ${e1}[/${pids[0]}]`;
  return `[${pids[0]}][emotion:${e1}](demo) ${e1}[/${pids[0]}]\n\n[${pids[1]}][emotion:${e2}](demo) ${e2}[/${pids[1]}]`;
};

// ══════════════════════════════
//  INITIALIZATION
// ══════════════════════════════
function loadPersonasFromCache() {
  try {
    const cached = getLocalPersonas();
    if (cached) {
      const parsed = cached;
      if (parsed && parsed.length) {
        // pid 중복 제거
        const seen = new Set();
        personas = parsed.filter(p => {
          if (seen.has(p.pid)) return false;
          seen.add(p.pid); return true;
        });
        return true;
      }
    }
  } catch(e) {}
  return false;
}

function loadSessionsFromCache() {
  try {
    const cached = getLocalSessionIndex();
    if (cached) {
      const validPids = new Set((personas || []).map(p => p.pid));

      const cleaned = (cached || [])
        .map(item => {
          const participantPids = Array.from(
            new Set((item.participantPids || []).filter(pid => validPids.has(pid)))
          );

          return {
            ...item,
            participantPids
          };
        })
        .filter(item => (item.participantPids || []).length > 0);

      sessions = cleaned.map(item => ({ ...item, history: [], _loaded: false }));

      // 로컬 인덱스도 정리본으로 덮어씀
      setLocalSessionIndex(cleaned);
    }
  } catch (e) {}
}

function personasSignature(list) {
  try {
    return JSON.stringify((list || []).map(p => ({
      pid: p?.pid || '',
      name: p?.name || '',
      image: p?.image || '',
      neutral_md: p?.neutral_md || '',
      updatedAt: Number(p?.updatedAt || 0)
    })));
  } catch(e) {
    return '';
  }
}

function sessionIndexSignature(list) {
  try {
    return JSON.stringify((list || []).map((s) => ({
      id: s?.id || '',
      updatedAt: Number(s?.updatedAt || 0),
      participantPids: Array.from(new Set(s?.participantPids || [])).sort(),
      roomName: s?.roomName || '',
      lastPreview: s?.lastPreview || ''
    })));
  } catch (e) {
    return '';
  }
}

function getLocalArchiveManifestSignature() {
  return idbGet(typeof ARCHIVE_MANIFEST_CACHE_KEY !== 'undefined' ? ARCHIVE_MANIFEST_CACHE_KEY : 'archive_manifest_v1')
    .then((items) => (typeof archiveManifestSignature === 'function' ? archiveManifestSignature(items || []) : ''))
    .catch(() => '');
}

async function fetchRemoteSessionIndex() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return [];
  try {
    const res = await fetch(wUrl + '/sessions', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

async function refreshCurrentChatIfStale(id) {
  const sid = String(id || activeChatId || '').trim();
  if (!sid) return false;
  const session = sessions.find((x) => x.id === sid);
  if (!session) return false;
  const localLastTs = Array.isArray(session.history) ? session.history.reduce((max, m) => Math.max(max, Number(m?.createdAt || 0)), 0) : 0;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return false;
  try {
    const res = await fetch(wUrl + '/session/' + sid, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const remoteHistory = Array.isArray(data?.session?.history) ? data.session.history : [];
    const remoteLastTs = remoteHistory.reduce((max, m) => Math.max(max, Number(m?.createdAt || 0)), 0);
    if (remoteLastTs > localLastTs) {
      await loadSession(sid);
      if (activeChatId === sid) renderChatArea();
      return true;
    }
  } catch (e) {}
  return false;
}

async function refreshAllCaches(options = {}) {
  const { force = false, showLoading = true, loadingLabel = '로컬 캐시 확인 중...' } = options;
  if (showLoading) {
    setLoading(true, loadingLabel);
    if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(true);
  }
  try {
    if (showLoading) setLoading(true, '로컬 캐시 로드 중...');
    const hasLocalPersonas = loadPersonasFromCache();
    if (!hasLocalPersonas) personas = DEFAULT_PERSONAS.map(p => ({ ...p, tags: [...p.tags] }));
    loadSessionsFromCache();
    if (typeof ensureArchiveManifest === 'function') await ensureArchiveManifest();
    if (typeof renderPersonaGrid === 'function') await renderPersonaGrid();
    if (typeof renderChatList === 'function') await renderChatList();
    if (activeTab === 'archive' && typeof renderArchiveGrid === 'function') renderArchiveGrid();

    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) return;

    if (showLoading) setLoading(true, '페르소나 비교 중...');
    const personasChanged = await syncPersonasFromWorkerForStartup(wUrl, 12000).catch(() => false);
    if (personasChanged && typeof renderPersonaGrid === 'function') await renderPersonaGrid();

    if (showLoading) setLoading(true, '채팅 목록 비교 중...');
    const localIndexSig = sessionIndexSignature(getLocalSessionIndex() || []);
    const remoteIndex = await fetchRemoteSessionIndex();
    const remoteIndexSig = sessionIndexSignature(remoteIndex);
    if (force || (remoteIndexSig && remoteIndexSig !== localIndexSig)) {
      await loadIndex();
    }
    if (typeof renderChatList === 'function') await renderChatList();

    if (showLoading) setLoading(true, '아카이브 비교 중...');
    const localArchiveSig = await getLocalArchiveManifestSignature();
    const remoteArchiveChanged = typeof refreshArchiveManifestIfChanged === 'function'
      ? await refreshArchiveManifestIfChanged(force || !localArchiveSig)
      : false;
    if (remoteArchiveChanged && activeTab === 'archive' && typeof renderArchiveGrid === 'function') renderArchiveGrid();

    if (activeChatId) {
      if (showLoading) setLoading(true, '현재 채팅 비교 중...');
      await refreshCurrentChatIfStale(activeChatId);
    }
  } finally {
    if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);
    if (showLoading) setLoading(false);
  }
}

function preloadMemoryMetaLight() {
  if (typeof getMemoryMetaApi !== 'function') return;
  const sessionId = String(activeChatId || '');
  getMemoryMetaApi(sessionId)
    .then((meta) => {
      if (!meta || typeof meta !== 'object') return;
      window.__memoryMetaCache = {
        sessionId,
        meta,
        fetchedAt: Date.now()
      };
    })
    .catch(() => {});
}

window.refreshAllCachesManual = async function() {
  await refreshAllCaches({ force: true, showLoading: true, loadingLabel: '수동 새로고침 준비 중...' });
};

async function syncPersonasFromWorkerForStartup(wUrl, timeoutMs = 4000) {
  if (!wUrl) return false;
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), timeoutMs));
  const result = await Promise.race([
    fetch(wUrl + '/personas', { cache: 'no-store' })
      .then(r => r.json())
      .catch(() => ({})),
    timeout
  ]);
  if (!result || result.timedOut) return false;

  const kvPersonas = Array.isArray(result.personas) ? result.personas : [];
  if (kvPersonas.length) {
    const prevByPid = new Map((personas || []).map(p => [String(p?.pid || ''), p]));
    const seen = new Set();
    const nextPersonas = kvPersonas.filter(p => {
      if (!p?.pid || seen.has(p.pid)) return false;
      seen.add(p.pid);
      return true;
    });
    const changedPids = nextPersonas
      .map((p) => String(p?.pid || '').trim())
      .filter(Boolean)
      .filter((pid) => {
        const next = nextPersonas.find((x) => String(x?.pid || '') === pid) || null;
        const prev = prevByPid.get(pid) || null;
        if (!prev || !next) return true;
        const nextUpdatedAt = Number(next.updatedAt || 0);
        const prevUpdatedAt = Number(prev.updatedAt || 0);
        if (nextUpdatedAt > prevUpdatedAt) return true;
        const nextImageUrl = String(next.imageUrl || '');
        const prevImageUrl = String(prev.imageUrl || '');
        return !!nextImageUrl && nextImageUrl !== prevImageUrl;
      });
    const samePersonas = personasSignature(nextPersonas) === personasSignature(personas);
    if (!samePersonas) {
      personas = nextPersonas;
      setLocalPersonas(personas);
      if (changedPids.length) {
        for (const pid of changedPids) {
          try {
            if (typeof idbDelByPrefix === 'function') await idbDelByPrefix(`emotion_${pid}_`);
          } catch {}
          try {
            if (typeof _neutralCache !== 'undefined') delete _neutralCache[pid];
          } catch {}
          try {
            if (typeof _imageListCache !== 'undefined') delete _imageListCache[pid];
          } catch {}
        }
        try { setImageCacheBustToken(Date.now().toString()); } catch {}
      }
      return true;
    }
    return false;
  }

  const celebs = await fetch('celebrity.json')
    .then(r => r.ok ? r.json() : [])
    .catch(() => []);
  if (!Array.isArray(celebs) || !celebs.length) return false;

  const nextCelebs = celebs.map(p => ({ ...p, type: p.type || 'celebrity' }));
  const sameCelebs = personasSignature(nextCelebs) === personasSignature(personas);
  if (!sameCelebs) {
    personas = nextCelebs;
    setLocalPersonas(personas);
  }

  fetch(wUrl + '/personas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personas })
  }).catch(() => {});

  return !sameCelebs;
}

const ENABLE_STARTUP_CACHE_PROCEDURES = true;
let _loadingLogoHoldBound = false;

function bindLoadingLogoHoldToRecover() {
  if (_loadingLogoHoldBound) return;
  const logo = document.getElementById('loadingLogo');
  const overlay = document.getElementById('loadingOverlay');
  if (!logo || !overlay) return;
  _loadingLogoHoldBound = true;

  const HOLD_MS = 1000;
  let timer = null;
  let activePointerId = null;
  let triggered = false;

  const clearHold = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    activePointerId = null;
  };

  const startHold = (pointerId = null) => {
    if (overlay.classList.contains('hidden')) return;
    triggered = false;
    clearHold();
    activePointerId = pointerId;
    timer = setTimeout(() => {
      triggered = true;
      clearHold();
      if (typeof window.forceRecoverApp === 'function') window.forceRecoverApp();
    }, HOLD_MS);
  };

  logo.addEventListener('pointerdown', (e) => {
    startHold(e.pointerId);
  });
  logo.addEventListener('pointerup', () => clearHold());
  logo.addEventListener('pointercancel', () => clearHold());
  logo.addEventListener('pointerleave', () => clearHold());
  logo.addEventListener('pointermove', (e) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return;
    if (e.buttons === 0 && !triggered) clearHold();
  });
}

async function init() {
  bindLoadingLogoHoldToRecover();
  let loadingEscapeTimer = null;
  const cachedPersonas = getLocalPersonas();
  const cachedSessionIndex = getLocalSessionIndex();
  const shouldBlockLoading = true;
  // Failsafe: loading overlay should not stay forever if init flow is interrupted.
  let loadingFailsafe = shouldBlockLoading ? setTimeout(() => {
    try {
      if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(true);
      setLoading(true, '로딩이 지연되고 있습니다. 로고를 1초 이상 길게 눌러 진입하세요.');
    } catch(e) {}
  }, 15000) : null;
  if (shouldBlockLoading) setLoading(true, '캐시 상태 점검 준비...');
  if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);
  if (shouldBlockLoading) loadingEscapeTimer = setTimeout(() => {
    try { if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(true); } catch(e) {}
  }, 8000);
  if (!shouldBlockLoading) setLoading(false);
  loadUserProfile();
  applyFontSize(userProfile.fontSize || 15);
  switchTab(userProfile.defaultTab || 'persona');
  // 캐시에서 즉시 로드 (로딩 중 표시)
  const hasLocalPersonas = loadPersonasFromCache();
  if (!hasLocalPersonas) personas = DEFAULT_PERSONAS.map(p=>({...p, tags:[...p.tags]}));
  loadSessionsFromCache();

  // KV에서 프로필 동기화 (name/bio/image — 기기별 설정은 로컬 유지)
  loadUserProfileKV().then(() => {
    if (activeTab === 'settings') renderSettingsPane();
  }).catch(()=>{});
  await refreshAllCaches({ force: false, showLoading: true, loadingLabel: '로컬 캐시 로드 중...' });
  preloadMemoryMetaLight();
  if (loadingEscapeTimer) clearTimeout(loadingEscapeTimer);
  clearTimeout(loadingFailsafe);
  if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);
  return;

  // neutral 이미지 IDB에서 로드 (neutral_a 우선)
  for (const [pid] of Object.entries(EMOTION_PROFILE_MAP)) {
    const key = `emotion_${pid}_neutral_a`;
    try {
      const cached = await idbGet(key) || await idbGet(`emotion_${pid}_neutral`);
      if (cached) _neutralCache[pid] = cached;
    } catch(e) {}
  }

  // 앱 시작 시에는 전체 생성 대신 상태 점검만 수행
  if (ENABLE_STARTUP_CACHE_PROCEDURES) {
    await checkCacheStateWithProgress((done, total, label, isMissing) => {
      const tail = isMissing ? ' (missing)' : '';
      if (shouldBlockLoading) setLoading(true, `캐시 점검 ${done}/${total} - ${label}${tail}`);
    }).catch(() => null);
  }

  // 진입 전 최소 시각 캐시 로딩(그리드 + 채팅목록)
  if (ENABLE_STARTUP_CACHE_PROCEDURES) {
    await runStartupVisualWarmup((done, total, label) => {
      if (shouldBlockLoading) setLoading(true, `시작 준비 ${done}/${total} - ${label}`);
    }).catch(() => null);
  }

  // 페르소나 그리드 + 채팅 목록 렌더링
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (wUrl) {
    if (shouldBlockLoading) setLoading(true, '초기 동기화 확인 중...');
    await syncPersonasFromWorkerForStartup(wUrl, 12000).catch(() => false);
  }
  if (typeof renderPersonaGrid === 'function') await renderPersonaGrid();
  if (typeof renderChatList === 'function') await renderChatList();

  if (shouldBlockLoading) setLoading(false);
  if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);

  // 백그라운드 워밍업(추가 캐시 보강)
  setTimeout(() => { runGlobalCacheWarmup().catch(() => {}); }, 200);


  // 백그라운드: Worker KV에서 페르소나 + 세션 동기화
  if (wUrl) {
    loadIndex().catch(()=>{});

    // KV에서 페르소나 로드 (celebrity.json + GAS 대체)
    // duplicate personas sync disabled (already synced during loading)
    /* fetch(wUrl + '/personas').then(r => r.json()).then(data => {
      const kvPersonas = data.personas || [];
      if (kvPersonas.length) {
        // pid 기준 중복 제거
        const seen = new Set();
        const nextPersonas = kvPersonas.filter(p => {
          if (seen.has(p.pid)) return false;
          seen.add(p.pid); return true;
        });
        const samePersonas = personasSignature(nextPersonas) === personasSignature(personas);
        if (!samePersonas) {
          personas = nextPersonas;
          setLocalPersonas(personas);
          preloadEmotionImages();
        }
      } else {
        // KV에 없으면 celebrity.json에서 초기 로드 (최초 1회)
        fetch('celebrity.json').then(r => r.ok ? r.json() : []).catch(() => []).then(celebs => {
          if (!celebs.length) return;
          personas = celebs.map(p => ({ ...p, type: p.type || 'celebrity' }));
          setLocalPersonas(personas);
          // KV에도 저장
          fetch(wUrl + '/personas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personas })
          }).catch(()=>{});
          preloadEmotionImages();
        });
      }
    }).catch(() => {}); */
  }
  if (loadingEscapeTimer) clearTimeout(loadingEscapeTimer);
  clearTimeout(loadingFailsafe);
}

// 앱 실행
window.forceRecoverApp = async function() {
  try {
    setLoading(false);
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (wUrl) {
      const pRes = await fetch(wUrl + '/personas', { cache: 'no-store' });
      const pData = await pRes.json().catch(() => ({}));
      if (Array.isArray(pData.personas)) {
        const seen = new Set();
        personas = pData.personas.filter(p => p && p.pid && !seen.has(p.pid) && seen.add(p.pid));
        setLocalPersonas(personas);
      }
      await loadIndex();
      if (typeof preloadAllSessions === 'function') await preloadAllSessions();
    }
    if (typeof renderPersonaGrid === 'function') await renderPersonaGrid();
    if (typeof renderChatList === 'function') await renderChatList();
    if (sessions?.length && typeof openChat === 'function') await openChat(sessions[0].id);
  } catch(e) {
    console.error('forceRecoverApp failed:', e);
  } finally {
    try { if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false); } catch(e) {}
    setLoading(false);
  }
};
init().catch((e) => {
  console.error('init failed:', e);
  try { setLoading(false); } catch(err) {}
});
