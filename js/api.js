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
const _neutralCache = {};

async function getNeutralImage(pid) {
  if (_neutralCache[pid]) return _neutralCache[pid];
  const key = `emotion_${pid}_neutral`;
  try {
    const cached = await idbGet(key);
    if (cached) { _neutralCache[pid] = cached; return cached; }
  } catch(e) {}
  return null;
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
  if (!letter) return null;
  const idbKey = `emotion_${pid}_${emotion}_${letter}`;
  try {
    const cached = await idbGet(idbKey);
    if (cached) return cached;
    // 캐시 없으면 fetch
    const name = EMOTION_PROFILE_MAP[pid] || pid;
    const url = `profile/${name}/${name}_${emotion}_${letter}.jpg`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise(r => {
      const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
    });
    const [md, hd] = await Promise.all([
      resizeImage(dataUrl, 300, 0.85),
      resizeImage(dataUrl, 1000, 0.9),
    ]);
    await idbSet(idbKey, md);
    await idbSet(idbKey + '_hd', hd);
    return md;
  } catch(e) { return null; }
}

// 메시지 렌더링 전 suffix 결정 (없으면 랜덤 선택 + 파일 존재 여부 확인)
async function resolveMessageSuffixes(rawText, pList, existingSuffixes = null) {
  if (existingSuffixes) return existingSuffixes;
  const segments = parseResponse(rawText, pList);
  const suffixes = {};
  for (const seg of segments) {
    const p = pList[seg.idx];
    if (!p) continue;
    const key = `${p.pid}:${seg.emotion}`;
    if (suffixes[key] !== undefined) continue;
    const letter = pickRandomSuffix();
    const img = await getEmotionImageSuffixed(p.pid, seg.emotion, letter);
    suffixes[key] = img ? letter : null; // null = 파일 없음 → neutral fallback
  }
  return suffixes;
}

async function getEmotionImageHD(pid, emotion) {
  const eid = emotion || 'neutral';
  try {
    const full = await idbGet(`em_full_${pid}_${eid}`);
    if (full) return full;
    const hd = await idbGet(`emotion_${pid}_${eid}_hd`);
    if (hd) return hd;
    return await idbGet(`emotion_${pid}_${eid}`) || null;
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

  // 크롭 좌표
  const cropX = Math.round(W * 0.17);
  const cropY = Math.round(H * 0.05);
  const cropW = W - cropX * 2;           // 66% of W
  const cropH = Math.round(cropW * 1.5); // 2:3 유지

  // ── 사각형 crop (2:3) ──
  const sqCanvas = document.createElement('canvas');
  sqCanvas.width = cropW; sqCanvas.height = cropH;
  sqCanvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  const sqJpg = sqCanvas.toDataURL('image/jpeg', 0.93);

  // ── 원형 crop (정사각형 + 원 마스크 → PNG) ──
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
  const [sqMd, sqHd, circSm] = await Promise.all([
    resizeImage(sqJpg, 300, 0.85),   // 사각형 MD → grid / bubble
    resizeImage(sqJpg, 1000, 0.9),   // 사각형 HD → edit / popup
    resizeImage(circPng, 200, 0.9),  // 원형 SM → avatars
  ]);

  // IDB 저장
  await Promise.all([
    idbSet(`emotion_${pid}_${emotion}`, sqMd),
    idbSet(`emotion_${pid}_${emotion}_hd`, sqHd),
    idbSet(`emotion_${pid}_${emotion}_circle`, circSm),
  ]);

  return { sqMd, sqHd, circSm };
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
  const celebPids = personas.filter(p => p.type === 'celebrity').map(p => p.pid);
  for (const pid of celebPids) {
    for (const emotion of EMOTIONS) {
      const key = `emotion_${pid}_${emotion}`;
      const keyHD = `emotion_${pid}_${emotion}_hd`;
      try {
        const cached = await idbGet(key);
        const cachedHD = await idbGet(keyHD);
        if (cached && cachedHD) {
          if (emotion === 'neutral') _neutralCache[pid] = cached;
          continue;
        }
        const url = `profile/${pid}/${pid}_${emotion}.jpg`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const dataUrl = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob); });

        if (!cached) {
          const resized = await resizeImage(dataUrl, 300, 0.85);
          await idbSet(key, resized);
          if (emotion === 'neutral') _neutralCache[pid] = resized;
        } else {
          if (emotion === 'neutral') _neutralCache[pid] = cached;
        }
        if (!cachedHD) {
          const hd = await resizeImage(dataUrl, 1000, 0.9);
          await idbSet(keyHD, hd);
        }
      } catch(e) {}
    }
  }
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
      (k.startsWith('emotion_') || k.startsWith('em_full_')) &&
      !k.includes('_neutral')
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
  try { localStorage.setItem(CACHE_PERSONAS_KEY, JSON.stringify(personas)); } catch(e) {}
  const customOnly = personas.filter(p => p.type !== 'celebrity').map(p => ({
    ...p,
    neutral_md:    p.neutral_md    || _neutralCache[p.pid] || null,
    neutral_hd:    p.neutral_hd    || null,
    neutral_thumb: p.neutral_thumb || null,
  }));
  gasCall({ action:'savePersonas', personas: customOnly });
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
  try { localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(buildIndex())); } catch(e) {}
  gasCall({ action:'saveIndex', index:buildIndex() });
}

async function saveSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  const history = s.history.map(({_rendered,...rest})=>rest);
  try { localStorage.setItem(CACHE_SESSION_PREFIX+id, JSON.stringify(history)); } catch(e) {}
  const res = await gasCall({ action:'saveSession', sessionId:id, history });
  if (res?.result==='success') showToast('💾 저장됨');
}

async function loadIndex() {
  const res = await gasCall({ action:'loadIndex' });
  if (!res || res.result!=='success') return;
  const index = res.index || [];
  
  // 1. 서버 데이터로 기존 방 업데이트
  const updatedSessions = index.map(item => {
    const exist = sessions.find(s => s.id === item.id);
    return exist ? { ...exist, ...item } : { ...item, history: [], _loaded: false };
  });

  // 2. 서버에는 없지만 현재 로컬 메모리에 띄워져 있는 방 (데모방 등 1회용 방) 메모리 유지
  const localOnly = sessions.filter(s => !index.find(item => item.id === s.id));
  
  // 3. 서버 목록과 로컬 1회용 방을 병합하여 화면 메모리에 적용
  sessions = [...updatedSessions, ...localOnly];

  // 로컬 저장소에는 서버에서 가져온 진짜 목록(index)만 저장 (데모방 제외)
  try { localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index)); } catch(e) {}
  renderChatList();
}

async function loadSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  if (!s._loaded) {
    try {
      const cached = localStorage.getItem(CACHE_SESSION_PREFIX+id);
      if (cached) { s.history = JSON.parse(cached); s._loaded = true; renderChatArea(); }
    } catch(e) {}
  }
  const lastIndex = s.history ? s.history.length : 0;
  const res = await gasCall({ action:'loadSession', sessionId:id, lastIndex });
  if (res?.result==='success') {
    const fetched = res.newMessages || res.history || [];
    const newMsgs = res.newMessages ? res.newMessages : fetched.slice(lastIndex);
    if (newMsgs.length > 0) {
      s.history = [...(s.history||[]), ...newMsgs];
      s._loaded = true;
      try { localStorage.setItem(CACHE_SESSION_PREFIX+id, JSON.stringify(s.history)); } catch(e) {}
      renderChatArea();
    } else { s._loaded = true; }
  }
}

async function preloadAllSessions() {
  for (const s of sessions) {
    if (s._loaded) continue;
    try {
      const cached = localStorage.getItem(CACHE_SESSION_PREFIX+s.id);
      if (cached) { s.history = JSON.parse(cached); s._loaded = true; }
    } catch(e) {}
    const res = await gasCall({ action:'loadSession', sessionId:s.id });
    if (res?.result==='success') {
      s.history = res.history || [];
      s._loaded = true;
      try { localStorage.setItem(CACHE_SESSION_PREFIX+s.id, JSON.stringify(s.history)); } catch(e) {}
    }
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