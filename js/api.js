// ══════════════════════════════
//  INDEXED DB (로컬 이미지 캐싱)
// ══════════════════════════════
const IDB_NAME = 'personachat_v4', IDB_STORE = 'images', IDB_VER = 2;
let _idb = null;

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
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

// ══════════════════════════════
//  IMAGE FETCH & CACHE
// ══════════════════════════════

// ══════════════════════════════
//  R2 파일 목록 캐시
// ══════════════════════════════
const _imageListCache = {}; // { pid: ['profile/p_riley/riley_neutral.jpg', ...] }

async function getImageList(pid) {
  if (_imageListCache[pid]) return _imageListCache[pid];
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) return [];
    const resp = await fetch(`${wUrl}/image-list/profile/${pid}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    _imageListCache[pid] = data.keys || [];
    return _imageListCache[pid];
  } catch(e) { return []; }
}

// 파일 목록에서 특정 emotion의 suffix 목록 추출
function getSuffixesForEmotion(keys, pid, emotion) {
  if (!emotion) return { suffixed: [], hasBase: false };
  // 폴더 키(슬래시로 끝나거나 파일명 없는 것) 제외
  const validKeys = keys.filter(k => k.match(/\.jpg$/i));
  const suffix_re = new RegExp(`profile/${pid}/${pid}_${emotion}_([a-z])\.jpg$`);
  const suffixed = validKeys
    .map(k => { const m = k.match(suffix_re); return m ? m[1] : null; })
    .filter(Boolean);
  const base = `profile/${pid}/${pid}_${emotion}.jpg`;
  const hasBase = validKeys.includes(base);
  return { suffixed, hasBase };
}

const _neutralCache = {};

async function getNeutralImage(pid) {
  if (_neutralCache[pid]) return _neutralCache[pid];
  // IDB 시도
  try {
    const cached = await idbGet(`emotion_${pid}_neutral`);
    if (cached) { _neutralCache[pid] = cached; return cached; }
  } catch(e) {}
  // IDB 없으면 직접 fetch
  return await loadNeutralDirect(pid);
}

async function getNeutralImageThumb(pid) {
  try {
    const cached = await idbGet(`emotion_${pid}_neutral_thumb`);
    if (cached) return cached;
  } catch(e) {}
  return await getNeutralImage(pid); // fallback to MD
}

async function getEmotionImage(pid, emotion) {
  const key = `emotion_${pid}_${emotion || 'neutral'}`;
  try {
    const cached = await idbGet(key);
    if (cached) return cached;
    return await idbGet(`emotion_${pid}_neutral`) || null;
  } catch(e) { return null; }
}


// ══════════════════════════════
//  EMOTION SUFFIX SYSTEM (_a ~ _z)
// ══════════════════════════════
function pickRandomSuffix() {
  return String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
}

async function getEmotionImageSuffixed(pid, emotion, letter) {
  if (letter === null || letter === undefined) return null;
  const idbKey = letter
    ? `emotion_${pid}_${emotion}_${letter}`
    : `emotion_${pid}_${emotion}`;
  try {
    const cached = await idbGet(idbKey);
    if (cached) return cached;
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) return null;
    const url = letter
      ? `${wUrl}/image/profile/${pid}/${pid}_${emotion}_${letter}.jpg`
      : `${wUrl}/image/profile/${pid}/${pid}_${emotion}.jpg`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[emotion] 404: ${url}`);
      return null;
    }
    const blob = await resp.blob();
    const dataUrl = await new Promise(r => {
      const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
    });
    const emotionKey = idbKey.replace(`emotion_${pid}_`, '');
    const { sqMd } = await generateThumbnailSet(dataUrl, pid, emotionKey);
    console.log(`[emotion] cached: ${idbKey}`);
    return sqMd;
  } catch(e) {
    console.error(`[emotion] error pid=${pid} emotion=${emotion} letter=${letter}:`, e);
    return null;
  }
}

// 메시지 렌더링 전 suffix 결정 (파일 목록 기반 랜덤 선택)
async function resolveMessageSuffixes(rawText, pList, existingSuffixes = null) {
  if (existingSuffixes) return existingSuffixes;
  const segments = parseResponse(rawText, pList);
  const suffixes = {};
  for (const seg of segments) {
    const p = pList[seg.idx];
    if (!p) continue;
    const key = `${p.pid}:${seg.emotion}`;
    if (suffixes[key] !== undefined) continue;
    // 파일 목록에서 해당 감정의 suffix 목록 추출
    const keys = await getImageList(p.pid);
    const { suffixed, hasBase } = getSuffixesForEmotion(keys, p.pid, seg.emotion);
    if (suffixed.length > 0) {
      // 랜덤 suffix 선택
      suffixes[key] = suffixed[Math.floor(Math.random() * suffixed.length)];
    } else if (hasBase) {
      suffixes[key] = ''; // suffix 없는 기본 파일
    } else {
      suffixes[key] = null; // 없음 → neutral fallback
    }
  }
  return suffixes;
}

async function getEmotionImageHD(pid, emotion, letter = '') {
  const eid = emotion || 'neutral';
  const target = letter ? `${eid}_${letter}` : eid;
  try {
    const full = await idbGet(`em_full_${pid}_${target}`);
    if (full) return full;
    const hd = await idbGet(`emotion_${pid}_${target}_hd`);
    if (hd) return hd;
    const md = await idbGet(`emotion_${pid}_${target}`);
    if (md) return md;
  } catch(e) {}
  
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) return null;
    const keys = await getImageList(pid);
    const { suffixed, hasBase } = getSuffixesForEmotion(keys, pid, eid);
    let url = null;
    
    // 명시된 letter가 있으면 우선 사용
    if (letter && suffixed.includes(letter)) {
      url = `${wUrl}/image/profile/${pid}/${pid}_${eid}_${letter}.jpg`;
    } else if (hasBase && !letter) {
      url = `${wUrl}/image/profile/${pid}/${pid}_${eid}.jpg`;
    } else if (suffixed.length > 0) {
      const randomLetter = suffixed[Math.floor(Math.random() * suffixed.length)];
      url = `${wUrl}/image/profile/${pid}/${pid}_${eid}_${randomLetter}.jpg`;
    }
    
    if (!url) return null;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise(r => {
      const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
    });
    const hd = await resizeImage(dataUrl, 1000, 0.9);
    await idbSet(`emotion_${pid}_${target}_hd`, hd).catch(() => {});
    return hd;
  } catch(e) { return null; }
}


// ══════════════════════════════
//  3단계 썸네일 생성 (full / square crop / circle crop)
//  좌우 17%, 상단 5% crop, 2:3 유지
// ══════════════════════════════
function loadImageElement(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

async function generateThumbnailSet(fullDataUrl, pid, emotion = 'neutral') {
  const img = await loadImageElement(fullDataUrl);
  const W = img.naturalWidth, H = img.naturalHeight;

  // 크롭 좌표 (사각형 crop용)
  const cropX = Math.round(W * 0.17);
  const cropY = Math.round(H * 0.05);
  const cropW = W - cropX * 2;           // 66% of W
  const cropH = Math.round(cropW * 1.5); // 2:3 유지

  // ── 사각형 crop MD (채팅 말풍선용) ──
  const sqCanvas = document.createElement('canvas');
  sqCanvas.width = cropW; sqCanvas.height = cropH;
  sqCanvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  const sqJpg = sqCanvas.toDataURL('image/jpeg', 0.93);

  // ── FULL 리사이즈 HD (그리드, 편집, 팝업용 - crop 없음) ──
  const fullCanvas = document.createElement('canvas');
  const maxW = 1000, scale = Math.min(1, maxW / W);
  fullCanvas.width = Math.round(W * scale);
  fullCanvas.height = Math.round(H * scale);
  fullCanvas.getContext('2d').drawImage(img, 0, 0, fullCanvas.width, fullCanvas.height);
  const fullJpg = fullCanvas.toDataURL('image/jpeg', 0.9);

  // ── 원형 crop (아바타용) ──
  const circDiam = cropW;
  const circCanvas = document.createElement('canvas');
  circCanvas.width = circDiam; circCanvas.height = circDiam;
  const cCtx = circCanvas.getContext('2d');
  cCtx.drawImage(img, cropX, cropY, circDiam, circDiam, 0, 0, circDiam, circDiam);
  cCtx.globalCompositeOperation = 'destination-in';
  cCtx.beginPath();
  cCtx.arc(circDiam / 2, circDiam / 2, circDiam / 2, 0, Math.PI * 2);
  cCtx.fill();
  const circPng = circCanvas.toDataURL('image/png');

  // 리사이즈
  const [sqMd, circSm] = await Promise.all([
    resizeImage(sqJpg, 300, 0.85),   // 사각형 MD → 채팅 말풍선
    resizeImage(circPng, 200, 0.9),  // 원형 SM → 아바타
  ]);

  // IDB 저장
  await Promise.all([
    idbSet(`emotion_${pid}_${emotion}`, sqMd),        // 말풍선용 square crop
    idbSet(`emotion_${pid}_${emotion}_hd`, fullJpg),  // 그리드/팝업용 FULL HD
    idbSet(`emotion_${pid}_${emotion}_circle`, circSm), // 아바타용 circle
  ]);

  return { sqMd, fullHd: fullJpg, circSm };
}

// 원형 썸네일 불러오기 (없으면 square MD fallback)
async function getNeutralImageCircle(pid) {
  try {
    const cached = await idbGet(`emotion_${pid}_neutral_circle`);
    if (cached) return cached;
  } catch(e) {}
  return await getNeutralImage(pid);
}

async function resizeImage(dataUrl, maxPx, quality = 0.88) {
  return new Promise(r => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx/img.width, maxPx/img.height, 1);
      const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h); r(cv.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => r(dataUrl); img.src = dataUrl;
  });
}

async function preloadEmotionImages() {
  // 감정 이미지는 on-demand 로드 (suffix 시스템)
  // neutral만 메모리 캐싱 (IDB 생략 → 모바일 호환성)
  for (const p of personas) {
    if (_neutralCache[p.pid]) continue;
    await loadNeutralDirect(p.pid);
  }
}

// neutral 이미지: 파일 목록 기반 → 없으면 직접 URL 시도
async function loadNeutralDirect(pid) {
  if (_neutralCache[pid]) return _neutralCache[pid];
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) return null;

    // 1. 파일 목록으로 찾기
    const keys = await getImageList(pid);
    const { suffixed, hasBase } = getSuffixesForEmotion(keys, pid, 'neutral');
    let candidates = [];
    if (hasBase) candidates.push(`${wUrl}/image/profile/${pid}/${pid}_neutral.jpg`);
    if (suffixed.length > 0) {
      const letter = suffixed[Math.floor(Math.random() * suffixed.length)];
      candidates.push(`${wUrl}/image/profile/${pid}/${pid}_neutral_${letter}.jpg`);
    }

    // 2. 목록 비어있으면 직접 시도
    if (!candidates.length) {
      candidates = [
        `${wUrl}/image/profile/${pid}/${pid}_neutral.jpg`,
        ...'abcde'.split('').map(l => `${wUrl}/image/profile/${pid}/${pid}_neutral_${l}.jpg`)
      ];
    }

    console.log('[neutral] trying candidates for', pid, candidates.slice(0,3));
    for (const url of candidates) {
      try {
        const resp = await fetch(url);
        console.log('[neutral]', url, resp.status);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const dataUrl = await new Promise(r => {
          const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
        });
        // square crop + circle crop 생성 후 IDB 저장
        const { sqMd } = await generateThumbnailSet(dataUrl, pid, 'neutral');
        _neutralCache[pid] = sqMd;
        return sqMd;
      } catch(e) { continue; }
    }
  } catch(e) {}
  return null;
}

async function clearImageCache() {
  if (!confirm('감정 이미지 캐시를 삭제하고 다시 로드할까?\n(커스텀 페르소나 이미지는 유지돼)')) return;
  try {
    const db = await openIDB();
    const keys = await new Promise((res, rej) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const toDelete = keys.filter(k =>
      k.startsWith('emotion_') || k.startsWith('em_full_')
    );
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    for (const k of toDelete) store.delete(k);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    showToast(`캐시 ${toDelete.length}개 삭제됨. 재시작할게요...`);
    setTimeout(() => location.reload(), 1000);
  } catch(e) { showToast('캐시 삭제 실패: ' + e.message); }
}

// ══════════════════════════════
//  GAS / STORAGE API
// ══════════════════════════════
async function gasCall(body) {
  try {
    const res = await fetch(GAS_URL, { method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({secretKey:GAS_SECRET,...body}) });
    return await res.json();
  } catch(e) { return null; }
}

function savePersonas() {
  // 이미지 데이터 제외 후 저장 (용량 절약)
  const toSave = personas.map(p => {
    const { neutral_md, neutral_hd, neutral_thumb, image, ...rest } = p;
    return rest;
  });
  try { localStorage.setItem(CACHE_PERSONAS_KEY, JSON.stringify(toSave)); } catch(e) {}
  // Worker KV에 저장
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (wUrl) {
    fetch(wUrl + '/personas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personas: toSave })
    }).catch(() => {});
  }
}

function buildIndex() {
  return sessions.filter(s=>!s._demo).map(s=>({
    id:s.id, updatedAt:s.updatedAt, lastPreview:s.lastPreview,
    participantPids:s.participantPids, roomName:s.roomName||'',
    responseMode:s.responseMode, worldContext:s.worldContext,
    userOverride: s.userOverride || null,
    userProfileMode: s.userProfileMode || 'default'
  }));
}

async function saveIndex() {
  const idx = buildIndex();
  try { localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(idx)); } catch(e) {}
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  // 인덱스 저장
  fetch(wUrl + '/sessions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions: idx })
  }).catch(() => {});
}

async function saveSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  const history = s.history.map(({_rendered,...rest})=>rest);
  try { localStorage.setItem(CACHE_SESSION_PREFIX+id, JSON.stringify(history)); } catch(e) {}
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  const session = { ...buildIndex().find(x=>x.id===id), history };
  fetch(wUrl + '/session/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session })
  }).catch(() => {});
}

async function loadIndex() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const res = await fetch(wUrl + '/sessions');
    const data = await res.json();
    const index = data.sessions || [];
    const updatedSessions = index.map(item => {
      const exist = sessions.find(s => s.id === item.id);
      return exist ? { ...exist, ...item } : { ...item, history: [], _loaded: false };
    });
    const localOnly = sessions.filter(s => !index.find(item => item.id === s.id));
    sessions = [...updatedSessions, ...localOnly];
    try { localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index)); } catch(e) {}
    renderChatList();
  } catch(e) {}
}

async function loadSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  // 로컬 캐시 먼저
  if (!s._loaded) {
    try {
      const cached = localStorage.getItem(CACHE_SESSION_PREFIX+id);
      if (cached) { s.history = JSON.parse(cached); s._loaded = true; renderChatArea(); }
    } catch(e) {}
  }
  // KV에서 로드
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const res = await fetch(wUrl + '/session/' + id);
    const data = await res.json();
    if (data.session?.history?.length) {
      s.history = data.session.history;
      s._loaded = true;
      try { localStorage.setItem(CACHE_SESSION_PREFIX+id, JSON.stringify(s.history)); } catch(e) {}
      renderChatArea();
    } else { s._loaded = true; }
  } catch(e) {}
}

async function preloadAllSessions() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  for (const s of sessions) {
    if (s._loaded) continue;
    try {
      const cached = localStorage.getItem(CACHE_SESSION_PREFIX+s.id);
      if (cached) { s.history = JSON.parse(cached); s._loaded = true; continue; }
    } catch(e) {}
    if (!wUrl) continue;
    try {
      const res = await fetch(wUrl + '/session/' + s.id);
      const data = await res.json();
      if (data.session?.history) {
        s.history = data.session.history;
        s._loaded = true;
        try { localStorage.setItem(CACHE_SESSION_PREFIX+s.id, JSON.stringify(s.history)); } catch(e) {}
      }
    } catch(e) {}
  }
}

// R2에 이미지 업로드 유틸리티 (데이터 URL을 서버 URL로 변환)
async function uploadToR2(dataUrl, folder, fname) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  // 이미 외부 URL이거나 유효하지 않은 데이터면 그대로 반환
  if (!wUrl || !dataUrl.startsWith('data:')) return dataUrl;

  try {
    const b64 = dataUrl.split(',')[1];
    const byteArr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([byteArr], { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', blob, fname);
    form.append('folder', folder);

    const res = await fetch(wUrl + '/image', { method: 'POST', body: form });
    const data = await res.json();
    return data.url || dataUrl;
  } catch(e) {
    console.error('R2 Upload failed:', e);
    return dataUrl;
  }
}

function saveUserProfile() {
  try { localStorage.setItem(CACHE_USER_KEY, JSON.stringify(userProfile)); } catch(e) {}
}

function loadUserProfile() {
  try {
    const cached = localStorage.getItem(CACHE_USER_KEY);
    if (cached) userProfile = JSON.parse(cached);
  } catch(e) {}
}