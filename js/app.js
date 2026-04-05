// ══════════════════════════════
//  DEMO CHAT REPLY LOGIC
// ══════════════════════════════
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
    const cached = localStorage.getItem(CACHE_PERSONAS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length) { personas = parsed; return true; }
    }
  } catch(e) {}
  return false;
}

function loadSessionsFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_INDEX_KEY);
    if (cached) {
      const index = JSON.parse(cached);
      sessions = (index||[]).map(item=>({...item, history:[], _loaded:false}));
    }
  } catch(e) {}
}

async function init() {
  loadUserProfile();
  // 캐시에서 즉시 로드 (로딩 중 표시)
  if (!loadPersonasFromCache()) personas = DEFAULT_PERSONAS.map(p=>({...p, tags:[...p.tags]}));
  loadSessionsFromCache();

  // neutral 이미지 IDB에서 로드
  for (const [pid] of Object.entries(EMOTION_PROFILE_MAP)) {
    const key = `emotion_${pid}_neutral`;
    try {
      const cached = await idbGet(key);
      if (cached) _neutralCache[pid] = cached;
    } catch(e) {}
  }

  // neutral 이미지 없으면 직접 fetch (최초 1회)
  const missing = Object.entries(EMOTION_PROFILE_MAP).filter(([pid]) => !_neutralCache[pid]);
  if (missing.length) {
    await Promise.allSettled(missing.map(async ([pid]) => {
      try {
        // 통일된 pid를 경로와 파일명에 그대로 사용
        const url = `profile/${pid}/${pid}_neutral.png`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });
        const resized = await resizeImage(dataUrl, 300, 0.85);
        const hd = await resizeImage(dataUrl, 600, 0.9);
        _neutralCache[pid] = resized;
        await idbSet(`emotion_${pid}_neutral`, resized);
        await idbSet(`emotion_${pid}_neutral_hd`, hd);
      } catch(e) {}
    }));
  }

  // 페르소나 그리드 + 채팅 목록 렌더링 후 로컬 화면 우선 렌더링
  renderPersonaGrid();
  renderChatList();
  
  // 로컬 우선 로드: 0.2초 후 무조건 로딩 화면 제거
  setTimeout(() => { setLoading(false); }, 200);

  // 백그라운드 작업 (이미지 캐싱 및 서버 동기화)
    if (GAS_URL) {
    loadIndex()
      .then(() => preloadAllSessions())
      .catch(()=>{});
      
    // celebrity (GitHub 직접 fetch) + custom (드라이브 GAS) 병합 로드
    Promise.allSettled([
      fetch('celebrity.json').then(r => r.ok ? r.json() : []).catch(() => []),
      gasCall({ action: 'loadPersonas' })
    ]).then(([celebResult, customResult]) => {
      const celebs  = Array.isArray(celebResult.value) ? celebResult.value : [];
      const customs = customResult.value?.result === 'success' ? (customResult.value.personas || []) : [];

      // 중복 방지: 셀럽의 pid 목록(p_chloe, p_clara 등) 추출
      const celebPids = celebs.map(p => p.pid);

      // hidden 제외 + 커스텀 목록에 셀럽과 똑같은 pid가 있으면 무시하고 합치기
      const merged = [
        ...celebs.filter(p => !p.hidden).map(p => ({ ...p, type: 'celebrity' })),
        ...customs.filter(p => !p.hidden && !celebPids.includes(p.pid)).map(p => ({ ...p, type: 'custom' }))
      ];

      if (merged.length) {
        // neutral 이미지 IDB 캐싱
        for (const p of merged) {
          // celebrity: neutral_md 필드
          if (p.neutral_md && !_neutralCache[p.pid]) {
            _neutralCache[p.pid] = p.neutral_md;
            idbSet(`emotion_${p.pid}_neutral`, p.neutral_md).catch(()=>{});
            if (p.neutral_hd) idbSet(`emotion_${p.pid}_neutral_hd`, p.neutral_hd).catch(()=>{});
          }
          // custom: image 필드 (기존 방식)
          const neutralData = p.neutral_md || p.image || null;
			if (neutralData && !_neutralCache[p.pid]) {
				_neutralCache[p.pid] = neutralData;
				idbSet(`emotion_${p.pid}_neutral`, neutralData).catch(()=>{});
				if (p.neutral_hd) idbSet(`emotion_${p.pid}_neutral_hd`, p.neutral_hd).catch(()=>{});
				if (p.neutral_thumb) idbSet(`emotion_${p.pid}_neutral_thumb`, p.neutral_thumb).catch(()=>{});
		}
          // 메모리/캐시에는 이미지 필드 제외
          delete p.neutral_thumb; delete p.neutral_md; delete p.neutral_hd; delete p.image;
        }
		personas = merged;
		try { localStorage.setItem(CACHE_PERSONAS_KEY, JSON.stringify(personas)); } catch(e) {}
		renderPersonaGrid();
		preloadEmotionImages(); // ← 여기로 이동
      }
    }).catch(() => {});
  }
}

// 앱 실행
init();