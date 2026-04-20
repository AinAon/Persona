// ══════════════════════════════
//  DEMO CHAT REPLY LOGIC
// ══════════════════════════════
function setLoading(isLoading, text) {
  console.log('Loading state:', isLoading, text);

  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  if (overlay) {
    overlay.classList.toggle('hidden', !isLoading);

    // 이 줄 추가
    if (!isLoading) overlay.classList.add('hidden');
  }

  if (loadingText && text !== undefined) {
    loadingText.textContent = text;
  }
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
    const seen = new Set();
    const nextPersonas = kvPersonas.filter(p => {
      if (!p?.pid || seen.has(p.pid)) return false;
      seen.add(p.pid);
      return true;
    });
    const samePersonas = personasSignature(nextPersonas) === personasSignature(personas);
    if (!samePersonas) {
      personas = nextPersonas;
      setLocalPersonas(personas);
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

async function init() {
  let loadingEscapeTimer = null;
  // Failsafe: loading overlay should not stay forever if init flow is interrupted.
  const loadingFailsafe = setTimeout(() => {
    try {
      if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(true);
      setLoading(false);
      if (typeof renderPersonaGrid === 'function') renderPersonaGrid();
      if (typeof renderChatList === 'function') renderChatList();
    } catch(e) {}
  }, 15000);
  setLoading(true, '캐시 상태 점검 준비...');
  if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);
  loadingEscapeTimer = setTimeout(() => {
    try { if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(true); } catch(e) {}
  }, 8000);
  loadUserProfile();
  applyFontSize(userProfile.fontSize || 15);
  switchTab(userProfile.defaultTab || 'persona');
  // 캐시에서 즉시 로드 (로딩 중 표시)
  const hasLocalPersonas = loadPersonasFromCache();
  if (!hasLocalPersonas) personas = DEFAULT_PERSONAS.map(p=>({...p, tags:[...p.tags]}));
  loadSessionsFromCache();

  // KV에서 프로필 동기화 (name/bio/image — 기기별 설정은 로컬 유지)
  loadUserProfileKV().then(() => renderSettingsPane()).catch(()=>{});

  // neutral 이미지 IDB에서 로드 (neutral_a 우선)
  for (const [pid] of Object.entries(EMOTION_PROFILE_MAP)) {
    const key = `emotion_${pid}_neutral_a`;
    try {
      const cached = await idbGet(key) || await idbGet(`emotion_${pid}_neutral`);
      if (cached) _neutralCache[pid] = cached;
    } catch(e) {}
  }

  // 앱 시작 시에는 전체 생성 대신 상태 점검만 수행
  await checkCacheStateWithProgress((done, total, label, isMissing) => {
    const tail = isMissing ? ' (missing)' : '';
    setLoading(true, `캐시 점검 ${done}/${total} - ${label}${tail}`);
  }).catch(() => null);

  // 진입 전 최소 시각 캐시 로딩(그리드 + 채팅목록)
  await runStartupVisualWarmup((done, total, label) => {
    setLoading(true, `시작 준비 ${done}/${total} - ${label}`);
  }).catch(() => null);

  // 페르소나 그리드 + 채팅 목록 렌더링
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (wUrl) {
    setLoading(true, '초기 동기화 확인 중...');
    await syncPersonasFromWorkerForStartup(wUrl, 4500).catch(() => false);
  }
  if (typeof renderPersonaGrid === 'function') await renderPersonaGrid();
  if (typeof renderChatList === 'function') await renderChatList();

  setLoading(false);
  if (typeof setLoadingEscapeVisible === 'function') setLoadingEscapeVisible(false);

  // 백그라운드 워밍업(추가 캐시 보강)
  setTimeout(() => { runGlobalCacheWarmup().catch(() => {}); }, 200);


  // 백그라운드: Worker KV에서 페르소나 + 세션 동기화
  if (wUrl) {
    loadIndex().then(() => preloadAllSessions()).catch(()=>{});

    // KV에서 페르소나 로드 (celebrity.json + GAS 대체)
    fetch(wUrl + '/personas').then(r => r.json()).then(data => {
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
    }).catch(() => {});
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
