// ══════════════════════════════
//  INDEXED DB (로컬 이미지 캐싱)
// ══════════════════════════════
const IMAGE_CACHE_SIZES = {
  HD: 1200,
  MD: 600,
  LD: 300,
  THUMB: 150,
  AVATAR_W: 240,
  AVATAR_H: 360,
};

const PROFILE_RECT_WIDTH_STEPS = [160, 240, 320, 480, 600, 900, 1200];
const PROFILE_CIRCLE_STEPS = [42, 56, 80, 96, 128, 160, 192];
const PROFILE_FULL_WIDTH_STEPS = [640, 960, 1200];

// ══════════════════════════════
//  IMAGE FETCH & CACHE
// ══════════════════════════════

// ══════════════════════════════
//  R2 파일 목록 캐시
// ══════════════════════════════
const _imageListCache = {}; // { pid: ['profile/p_riley/riley_neutral.jpg', ...] }
const REMOTE_SAVE_DEBOUNCE_MS = 1200;
let _remoteIndexSaveTimer = null;
let _remoteIndexPayload = null;
const _remoteSessionSaveTimers = {};
const _remoteSessionPayloadById = {};

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

// 브라우저 HTTP 캐시 버스팅 (clearImageCache 후 재로드 시 강제 재요청)
function cacheBustUrl(url) {
  const t = getImageCacheBustToken();
  if (!t) return url;
  return url + (url.includes('?') ? '&' : '?') + 't=' + t;
}

const _neutralCache = {};

async function getNeutralImage(pid) {
  if (_neutralCache[pid]) return _neutralCache[pid];
  // IDB 시도
  try {
    const cachedA = await idbGet(`emotion_${pid}_neutral_a`);
    if (cachedA) { _neutralCache[pid] = cachedA; return cachedA; }
    const cached = await idbGet(`emotion_${pid}_neutral`);
    if (cached) { _neutralCache[pid] = cached; return cached; }
  } catch(e) {}
  // IDB 없으면 직접 fetch
  return await loadNeutralDirect(pid);
}

function pickClosestStep(steps, requiredPx) {
  const target = Math.max(1, Math.round(requiredPx || 1));
  for (const step of steps) {
    if (step >= target) return step;
  }
  return steps[steps.length - 1];
}

function getStepCandidates(steps, requiredPx) {
  const target = pickClosestStep(steps, requiredPx);
  const sorted = [...steps].sort((a, b) => a - b);
  const hi = sorted.filter((s) => s >= target);
  const lo = sorted.filter((s) => s < target).reverse();
  return [...hi, ...lo];
}

function getScreenDpr() {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Number(window.devicePixelRatio || 1));
}

function getEmotionKeyForCache(emotion, letter = '') {
  const eid = (emotion || 'neutral').toLowerCase();
  if (letter) return `${eid}_${letter}`;
  return eid === 'neutral' ? 'neutral_a' : eid;
}

async function getEmotionCircleThumb(pid, emotion = 'neutral', letter = '', displayPx = 80) {
  const needed = displayPx * getScreenDpr();
  const cacheKey = getEmotionKeyForCache(emotion, letter);
  try {
    for (const size of getStepCandidates(PROFILE_CIRCLE_STEPS, needed)) {
      const exact = await idbGet(`emotion_${pid}_${cacheKey}_c_${size}`);
      if (exact) return exact;
    }
    const legacy = await idbGet(`emotion_${pid}_${cacheKey}_circle_thumb`);
    if (legacy) return legacy;
    if (!letter && cacheKey !== 'neutral_a') {
      for (const size of getStepCandidates(PROFILE_CIRCLE_STEPS, needed)) {
        const neutralExact = await idbGet(`emotion_${pid}_neutral_a_c_${size}`);
        if (neutralExact) return neutralExact;
      }
    }
    const neutralLegacy = await idbGet(`emotion_${pid}_neutral_a_circle_thumb`);
    if (neutralLegacy) return neutralLegacy;
  } catch(e) {}
  return null;
}

async function getNeutralImageThumb(pid, displayPx = 80) {
  const circle = await getEmotionCircleThumb(pid, 'neutral', '', displayPx);
  if (circle) return circle;
  try {
    const cachedA = await idbGet(`emotion_${pid}_neutral_a_thumb`);
    if (cachedA) return cachedA;
    const cached = await idbGet(`emotion_${pid}_neutral_thumb`);
    if (cached) return cached;
    const legacyCircle = await idbGet(`emotion_${pid}_neutral_circle`);
    if (legacyCircle) return legacyCircle;
    const ldA = await idbGet(`emotion_${pid}_neutral_a_ld`);
    if (ldA) return ldA;
    const ld = await idbGet(`emotion_${pid}_neutral_ld`);
    if (ld) return ld;
  } catch(e) {}
  return await getNeutralImage(pid);
}

async function getEmotionRectImage(pid, emotion = 'neutral', letter = '', displayPx = 200) {
  const cacheKey = getEmotionKeyForCache(emotion, letter);
  const needed = displayPx * getScreenDpr();
  try {
    for (const width of getStepCandidates(PROFILE_RECT_WIDTH_STEPS, needed)) {
      const exact = await idbGet(`emotion_${pid}_${cacheKey}_b_${width}`);
      if (exact) return exact;
    }
    const md = await idbGet(`emotion_${pid}_${cacheKey}`);
    if (md) return md;
    const ld = await idbGet(`emotion_${pid}_${cacheKey}_ld`);
    if (ld) return ld;

    if (!letter && cacheKey !== 'neutral_a') {
      for (const width of getStepCandidates(PROFILE_RECT_WIDTH_STEPS, needed)) {
        const neutralExact = await idbGet(`emotion_${pid}_neutral_a_b_${width}`);
        if (neutralExact) return neutralExact;
      }
      const neutralMd = await idbGet(`emotion_${pid}_neutral_a`);
      if (neutralMd) return neutralMd;
    }
  } catch(e) {}
  return null;
}

async function getEmotionImage(pid, emotion, displayPx = 200) {
  const tiered = await getEmotionRectImage(pid, emotion || 'neutral', '', displayPx);
  if (tiered) return tiered;
  const cacheKey = getEmotionKeyForCache(emotion || 'neutral');
  const key = `emotion_${pid}_${cacheKey}`;
  try {
    const cached = await idbGet(key);
    if (cached) return cached;
    if ((emotion || 'neutral') === 'neutral') {
      const cachedA = await idbGet(`emotion_${pid}_neutral_a`);
      if (cachedA) return cachedA;
    }
    const ld = await idbGet(`${key}_ld`);
    if (ld) return ld;
    const neutralA = await idbGet(`emotion_${pid}_neutral_a`);
    if (neutralA) return neutralA;
    return await idbGet(`emotion_${pid}_neutral`) || null;
  } catch(e) { return null; }
}


// ══════════════════════════════
//  EMOTION SUFFIX SYSTEM (_a ~ _z)
// ══════════════════════════════
function pickRandomSuffix() {
  return String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
}

async function getEmotionImageSuffixed(pid, emotion, letter, displayPx = 200) {
  if (letter === null || letter === undefined) return null;
  const cachedTiered = await getEmotionRectImage(pid, emotion, letter, displayPx);
  if (cachedTiered) return cachedTiered;
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
    const resp = await fetch(cacheBustUrl(url));
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
    const tiered = await getEmotionRectImage(pid, emotion, letter, displayPx);
    if (tiered) return tiered;
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
  const normalizedBase = (!letter && eid === 'neutral') ? 'neutral_a' : eid;
  const target = letter ? `${eid}_${letter}` : normalizedBase;
  const strictBaseOnly = !letter && normalizedBase === 'neutral_a';
  try {
    const bestA = pickClosestStep(PROFILE_FULL_WIDTH_STEPS, IMAGE_CACHE_SIZES.HD * getScreenDpr());
    const fullTier = await idbGet(`emotion_${pid}_${target}_a_${bestA}`);
    if (fullTier) return fullTier;
    const hd = await idbGet(`emotion_${pid}_${target}_hd`);
    if (hd) return hd;
    const full = await idbGet(`em_full_${pid}_${target}`);
    if (full) {
      const resized = await resizeImage(full, IMAGE_CACHE_SIZES.HD, 0.9);
      await idbSet(`emotion_${pid}_${target}_hd`, resized).catch(() => {});
      return resized;
    }
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
    } else if (!strictBaseOnly && suffixed.length > 0) {
      const randomLetter = suffixed[Math.floor(Math.random() * suffixed.length)];
      url = `${wUrl}/image/profile/${pid}/${pid}_${eid}_${randomLetter}.jpg`;
    }
    
    if (!url) return null;
    const resp = await fetch(cacheBustUrl(url));
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise(r => {
      const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
    });
    const generated = await generateThumbnailSet(dataUrl, pid, target).catch(() => null);
    if (generated?.fullHd) return generated.fullHd;
    const hd = await resizeImage(dataUrl, IMAGE_CACHE_SIZES.HD, 0.9);
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

function drawProgressiveScaledCanvas(sourceCanvas, targetW, targetH) {
  let work = sourceCanvas;
  while (work.width / 2 > targetW && work.height / 2 > targetH) {
    const halfW = Math.max(targetW, Math.round(work.width / 2));
    const halfH = Math.max(targetH, Math.round(work.height / 2));
    const half = document.createElement('canvas');
    half.width = halfW;
    half.height = halfH;
    const halfCtx = half.getContext('2d');
    halfCtx.imageSmoothingEnabled = true;
    halfCtx.imageSmoothingQuality = 'high';
    halfCtx.drawImage(work, 0, 0, work.width, work.height, 0, 0, halfW, halfH);
    work = half;
  }

  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(work, 0, 0, work.width, work.height, 0, 0, targetW, targetH);
  return out;
}

async function generateThumbnailSet(fullDataUrl, pid, emotion = 'neutral_a') {
  const img = await loadImageElement(fullDataUrl);
  const W = img.naturalWidth, H = img.naturalHeight;

  const fullSource = document.createElement('canvas');
  fullSource.width = W;
  fullSource.height = H;
  fullSource.getContext('2d').drawImage(img, 0, 0, W, H);

  const cropX = Math.round(W * 0.17);
  const cropY = Math.round(H * 0.05);
  const cropW = Math.max(1, W - cropX * 2);
  const cropH = Math.max(1, Math.min(H - cropY, Math.round(cropW * 1.5)));

  const rectSource = document.createElement('canvas');
  rectSource.width = cropW;
  rectSource.height = cropH;
  rectSource.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const circleSide = Math.max(1, Math.min(cropW, cropH));
  const circleX = Math.max(0, Math.round((cropW - circleSide) / 2));
  const circleY = Math.max(0, Math.round((cropH - circleSide) / 2));
  const circleSource = document.createElement('canvas');
  circleSource.width = circleSide;
  circleSource.height = circleSide;
  circleSource.getContext('2d').drawImage(rectSource, circleX, circleY, circleSide, circleSide, 0, 0, circleSide, circleSide);

  const records = [];

  const fullWidths = [...new Set(PROFILE_FULL_WIDTH_STEPS.map((w) => Math.min(w, W)))];
  for (const outW of fullWidths) {
    const outH = Math.max(1, Math.round(H * (outW / W)));
    const cv = drawProgressiveScaledCanvas(fullSource, outW, outH);
    records.push({ key: `emotion_${pid}_${emotion}_a_${outW}`, url: cv.toDataURL('image/jpeg', 0.9) });
  }

  const rectWidths = [...new Set(PROFILE_RECT_WIDTH_STEPS.map((w) => Math.min(w, cropW)))];
  for (const outW of rectWidths) {
    const outH = Math.max(1, Math.round(outW * 1.5));
    const cv = drawProgressiveScaledCanvas(rectSource, outW, outH);
    records.push({ key: `emotion_${pid}_${emotion}_b_${outW}`, url: cv.toDataURL('image/jpeg', 0.9) });
  }

  const circleSizes = [...new Set(PROFILE_CIRCLE_STEPS.map((s) => Math.min(s, circleSide)))];
  for (const side of circleSizes) {
    const base = drawProgressiveScaledCanvas(circleSource, side, side);
    const ccv = document.createElement('canvas');
    ccv.width = side;
    ccv.height = side;
    const cctx = ccv.getContext('2d');
    cctx.drawImage(base, 0, 0, side, side);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.beginPath();
    cctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
    cctx.fill();
    records.push({ key: `emotion_${pid}_${emotion}_c_${side}`, url: ccv.toDataURL('image/png') });
  }

  const mdW = Math.min(IMAGE_CACHE_SIZES.MD, cropW);
  const ldW = Math.min(IMAGE_CACHE_SIZES.LD, cropW);
  const hdW = Math.min(IMAGE_CACHE_SIZES.HD, W);
  const mainCircleSize = pickClosestStep(PROFILE_CIRCLE_STEPS, 160);

  const rectMd = records.find((x) => x.key === `emotion_${pid}_${emotion}_b_${mdW}`)?.url || fullDataUrl;
  const rectLd = records.find((x) => x.key === `emotion_${pid}_${emotion}_b_${ldW}`)?.url || rectMd;
  const fullHd = records.find((x) => x.key === `emotion_${pid}_${emotion}_a_${hdW}`)?.url || fullDataUrl;
  const circleMain = records.find((x) => x.key === `emotion_${pid}_${emotion}_c_${mainCircleSize}`)?.url
    || records.find((x) => x.key.startsWith(`emotion_${pid}_${emotion}_c_`))?.url
    || rectMd;

  await Promise.all([
    idbSet(`emotion_${pid}_${emotion}`, rectMd),
    idbSet(`emotion_${pid}_${emotion}_hd`, fullHd),
    idbSet(`emotion_${pid}_${emotion}_ld`, rectLd),
    idbSet(`emotion_${pid}_${emotion}_thumb`, circleMain),
    idbSet(`emotion_${pid}_${emotion}_circle`, circleMain),
    idbSet(`emotion_${pid}_${emotion}_circle_thumb`, circleMain),
    ...records.map((x) => idbSet(x.key, x.url)),
  ]);

  return { sqMd: rectMd, sqLd: rectLd, thumb: circleMain, fullHd, avatarPng: circleMain };
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
        const resp = await fetch(cacheBustUrl(url));
        console.log('[neutral]', url, resp.status);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const dataUrl = await new Promise(r => {
          const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob);
        });
        // square crop + circle crop 생성 후 IDB 저장
        const { sqMd } = await generateThumbnailSet(dataUrl, pid, 'neutral_a');
        _neutralCache[pid] = sqMd;
        return sqMd;
      } catch(e) { continue; }
    }
  } catch(e) {}
  return null;
}

async function clearImageCache() {
  if (!confirm('이미지 캐시를 전부 삭제하고 R2에서 다시 받을까요?')) return;
  try {
    // IDB 전체 삭제 (모든 캐시 키)
    await idbClearAll();

    // 메모리 캐시 즉시 비우기
    Object.keys(_neutralCache).forEach(k => delete _neutralCache[k]);
    Object.keys(_imageListCache).forEach(k => delete _imageListCache[k]);

    // 브라우저 HTTP 캐시 버스트용 타임스탬프 저장
    // → 다음 로드 시 R2 URL에 ?t= 붙여서 강제 재요청
    setImageCacheBustToken(Date.now().toString());

    showToast('캐시 삭제 완료. 재시작할게요...');
    setTimeout(() => location.reload(), 800);
  } catch(e) { showToast('캐시 삭제 실패: ' + e.message); }
}

// ══════════════════════════════
//  STORAGE API (Worker KV / LocalStorage)
// ══════════════════════════════
function savePersonas() {
  // 이미지 데이터 제외 후 저장 (용량 절약)
  const toSave = personas.map(p => {
    const { neutral_md, neutral_hd, neutral_thumb, image, ...rest } = p;
    return rest;
  });
  setLocalPersonas(toSave);
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
    participantPids:Array.from(new Set(s.participantPids || [])), roomName:s.roomName||'',
    responseMode:s.responseMode, worldContext:s.worldContext,
    userOverride: s.userOverride || null,
    userProfileMode: s.userProfileMode || 'default',
    overrideModel: s.overrideModel || null,
    chatProfileOverride: s.chatProfileOverride || null,
    hidden: !!s.hidden
  }));
}

async function saveIndex() {
  const idx = buildIndex();
  setLocalSessionIndex(idx);
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  // 인덱스 저장
  _remoteIndexPayload = idx;
  if (_remoteIndexSaveTimer) clearTimeout(_remoteIndexSaveTimer);
  _remoteIndexSaveTimer = setTimeout(() => {
    const payload = _remoteIndexPayload;
    _remoteIndexPayload = null;
    _remoteIndexSaveTimer = null;
    if (!payload) return;
    fetch(wUrl + '/sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: payload })
    }).catch(() => {});
  }, REMOTE_SAVE_DEBOUNCE_MS);
}

async function saveSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  const history = s.history.map(({_rendered,...rest})=>rest);
  setLocalSession(id, history);
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  const session = { ...buildIndex().find(x=>x.id===id), history };
  _remoteSessionPayloadById[id] = session;
  if (_remoteSessionSaveTimers[id]) clearTimeout(_remoteSessionSaveTimers[id]);
  _remoteSessionSaveTimers[id] = setTimeout(() => {
    const payload = _remoteSessionPayloadById[id];
    delete _remoteSessionPayloadById[id];
    delete _remoteSessionSaveTimers[id];
    if (!payload) return;
    fetch(wUrl + '/session/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: payload })
    }).catch(() => {});
  }, REMOTE_SAVE_DEBOUNCE_MS);
}

function flushPendingRemoteSaves() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;

  if (_remoteIndexPayload) {
    const payload = _remoteIndexPayload;
    _remoteIndexPayload = null;
    if (_remoteIndexSaveTimer) {
      clearTimeout(_remoteIndexSaveTimer);
      _remoteIndexSaveTimer = null;
    }
    fetch(wUrl + '/sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: payload }),
      keepalive: true
    }).catch(() => {});
  }

  for (const [id, payload] of Object.entries(_remoteSessionPayloadById)) {
    if (!payload) continue;
    if (_remoteSessionSaveTimers[id]) {
      clearTimeout(_remoteSessionSaveTimers[id]);
      delete _remoteSessionSaveTimers[id];
    }
    delete _remoteSessionPayloadById[id];
    fetch(wUrl + '/session/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: payload }),
      keepalive: true
    }).catch(() => {});
  }
}

if (!window.__remoteSaveFlushBound) {
  window.__remoteSaveFlushBound = true;
  window.addEventListener('pagehide', flushPendingRemoteSaves);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingRemoteSaves();
  });
}

async function loadIndex() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const res = await fetch(wUrl + '/sessions');
    const data = await res.json();
    const index = Array.isArray(data.sessions) ? data.sessions : [];
    const activeIds = new Set(index.map(item => item?.id).filter(Boolean));

    // Remote index is authoritative to prevent deleted/orphan sessions from resurrecting.
    sessions = index.map(item => ({ ...item, history: [], _loaded: false }));
    setLocalSessionIndex(index);

    // Remove stale local session caches that are no longer present in remote index.
    try {
      const cached = getLocalSessionIndex();
      if (Array.isArray(cached)) {
        for (const s of cached) {
          const sid = s?.id;
          if (sid && !activeIds.has(sid)) removeLocalSession(sid);
        }
      }
    } catch(e) {}

    renderChatList();
  } catch(e) {}
}

async function loadSession(id) {
  const s = sessions.find(x=>x.id===id); if (!s) return;
  // 로컬 캐시 먼저
  if (!s._loaded) {
    try {
      const cached = getLocalSession(id);
      if (cached) {
        s.history = cached;
        s._loaded = true;
        if (activeChatId === id) renderChatArea();
      }
    } catch(e) {}
  }
  // KV에서 로드
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const res = await fetch(wUrl + '/session/' + id);
    const data = await res.json();
    const remoteSession = data?.session || null;
    if (!remoteSession) {
      // Session missing in KV: keep UI/index consistent and avoid zombie sessions.
      sessions = sessions.filter(x => x.id !== id);
      removeLocalSession(id);
      setLocalSessionIndex(buildIndex());
      if (activeChatId === id) activeChatId = null;
      renderChatList();
      return;
    }

    const remoteHistory = Array.isArray(remoteSession.history) ? remoteSession.history : [];
    s.history = remoteHistory;
    s._loaded = true;
    setLocalSession(id, s.history);
    if (activeChatId === id) renderChatArea();
  } catch(e) {}
}

async function preloadAllSessions() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  for (const s of sessions) {
    if (s._loaded) continue;
    try {
      const cached = getLocalSession(s.id);
      if (cached) { s.history = cached; s._loaded = true; continue; }
    } catch(e) {}
    if (!wUrl) continue;
    try {
      const res = await fetch(wUrl + '/session/' + s.id);
      const data = await res.json();
      if (data.session?.history) {
        s.history = data.session.history;
        s._loaded = true;
        setLocalSession(s.id, s.history);
      }
    } catch(e) {}
  }
}

// R2에 이미지 업로드 유틸리티 (데이터 URL을 서버 URL로 변환)
async function uploadToR2(imageRef, folder, fname) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !imageRef || typeof imageRef !== 'string') return imageRef;

  try {
    const form = new FormData();
    if (imageRef.startsWith('data:')) {
      const [header, b64 = ''] = imageRef.split(',');
      const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const byteArr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: mime });
      form.append('file', blob, fname);
    } else if (/^https?:\/\//i.test(imageRef)) {
      form.append('sourceUrl', imageRef);
      form.append('fileName', fname);
    } else {
      return imageRef;
    }
    form.append('folder', folder);

    const res = await fetch(wUrl + '/image', { method: 'POST', body: form });
    const data = await res.json();
    return data.url || imageRef;
  } catch(e) {
    console.error('R2 Upload failed:', e);
    return imageRef;
  }
}

// 파일명 생성: prefix_YYYYMMDDhhmm_xxxxx
function makeImageFilename(prefix) {
  const n = new Date();
  const dt = n.getFullYear().toString()
    + String(n.getMonth()+1).padStart(2,'0')
    + String(n.getDate()).padStart(2,'0')
    + String(n.getHours()).padStart(2,'0')
    + String(n.getMinutes()).padStart(2,'0');
  const rand = Math.random().toString(36).slice(2,7);
  return `${prefix}_${dt}_${rand}`;
}

// ── 기기별 로컬 전용 키 (KV 동기화 제외) ──
const LOCAL_ONLY_PROFILE_KEYS = ['defaultTab', 'chatAvatarStyle', 'fontSize'];

function saveUserProfile() {
  setLocalUserProfile(userProfile);
}

function loadUserProfile() {
  try {
    const cached = getLocalUserProfile();
    if (cached) userProfile = cached;
  } catch(e) {}
}

// KV에 name/bio/image 저장 (기기별 설정 제외)
async function saveUserProfileKV() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const kvProfile = {};
    for (const [k, v] of Object.entries(userProfile)) {
      if (!LOCAL_ONLY_PROFILE_KEYS.includes(k)) kvProfile[k] = v;
    }
    // 프로필 이미지가 data URL이면 R2에 먼저 업로드
    if (kvProfile.image && kvProfile.image.startsWith('data:')) {
      const fname = makeImageFilename('profile') + '.jpg';
      const r2Url = await uploadToR2(kvProfile.image, 'img_profile', fname);
      kvProfile.image = r2Url;
      userProfile.image = r2Url; // 로컬도 R2 URL로 교체
      saveUserProfile();
    }
    await fetch(wUrl + '/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: JSON.stringify(kvProfile) })
    });
  } catch(e) { console.warn('KV profile save failed:', e); }
}

// KV에서 name/bio/image 로드 → 기기별 설정은 유지
async function loadUserProfileKV() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  try {
    const res = await fetch(wUrl + '/profile');
    const data = await res.json();
    if (!data.profile) return;
    const kvProfile = JSON.parse(data.profile);
    // 로컬 기기별 설정 보존, KV 데이터 병합
    const localOnly = {};
    LOCAL_ONLY_PROFILE_KEYS.forEach(k => { if (userProfile[k] !== undefined) localOnly[k] = userProfile[k]; });
    userProfile = { ...userProfile, ...kvProfile, ...localOnly };
    saveUserProfile();
  } catch(e) {}
}

// Memory API
async function listMemoriesApi(scope, owner = '', limit = 50) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return [];
  const qs = new URLSearchParams({
    scope: String(scope || ''),
    owner: String(owner || ''),
    limit: String(limit || 50)
  });
  try {
    const res = await fetch(`${wUrl}/memory/list?${qs.toString()}`);
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function upsertMemoryApi({ scope, owner = '', text = '', source = 'manual', createdAt } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return { ok: false, duplicate: false, item: null };
  try {
    const res = await fetch(`${wUrl}/memory/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, owner, text, source, createdAt })
    });
    return await res.json();
  } catch {
    return { ok: false, duplicate: false, item: null };
  }
}

async function deleteMemoryApi({ scope, owner = '', id = '', force = false } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id) return { ok: false };
  try {
    const res = await fetch(`${wUrl}/memory/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, owner, id, force: !!force })
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

async function deleteMemoryBatchApi({ scope, owner = '', ids = [], force = false } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  const cleanIds = Array.isArray(ids) ? ids.map(x => String(x || '').trim()).filter(Boolean) : [];
  if (!wUrl || !cleanIds.length) return { ok: false, deleted: 0, requested: 0 };
  try {
    const res = await fetch(`${wUrl}/memory/delete-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, owner, ids: cleanIds, force: !!force })
    });
    return await res.json();
  } catch {
    return { ok: false, deleted: 0, requested: cleanIds.length };
  }
}

async function setMemoryLockApi({ scope, owner = '', id = '', locked = false } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id) return { ok: false, item: null };
  try {
    const res = await fetch(`${wUrl}/memory/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, owner, id, locked: !!locked })
    });
    return await res.json();
  } catch {
    return { ok: false, item: null };
  }
}

async function updateMemoryApi({ scope, owner = '', id = '', text = '' } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id || !String(text || '').trim()) return { ok: false, item: null };
  try {
    const res = await fetch(`${wUrl}/memory/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, owner, id, text: String(text || '') })
    });
    return await res.json();
  } catch {
    return { ok: false, item: null };
  }
}

async function purgeMemoryApi({ scope = '', owner = '', all = false } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return { ok: false, deleted: 0, deletedPrefixes: [] };
  try {
    const res = await fetch(`${wUrl}/memory/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: String(scope || ''),
        owner: String(owner || ''),
        all: !!all
      })
    });
    return await res.json();
  } catch {
    return { ok: false, deleted: 0, deletedPrefixes: [] };
  }
}

async function extractSessionMemories(session, { forceFull = false } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !session) return { ok: false, saved: 0, duplicate: 0, processed: 0, cursor: 0, error: 'WORKER_URL/session missing' };
  try {
    const payload = {
      sessionId: session.id,
      forceFull: !!forceFull,
      participantPids: Array.from(new Set(session.participantPids || [])),
      history: (session.history || []).map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt || Date.now()
      }))
    };
    const res = await fetch(`${wUrl}/memory/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!res.ok) {
      return {
        ok: false,
        saved: 0,
        duplicate: 0,
        processed: 0,
        cursor: 0,
        status: res.status,
        error: data?.error || `HTTP ${res.status}`,
        detail: raw ? String(raw).slice(0, 220) : ''
      };
    }
    return data || { ok: false, saved: 0, duplicate: 0, processed: 0, cursor: 0, error: 'empty response' };
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message || '') : '';
    return { ok: false, saved: 0, duplicate: 0, processed: 0, cursor: 0, error: msg || 'network_error' };
  }
}

async function optimizeMemoriesApi({ sessionId = '', participantPids = [], includePublic = true } = {}) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return { ok: false, optimized: 0, removed: 0, error: 'WORKER_URL missing' };
  try {
    const res = await fetch(`${wUrl}/memory/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: String(sessionId || ''),
        participantPids: Array.from(new Set(participantPids || [])),
        includePublic: includePublic !== false
      })
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!res.ok) {
      return {
        ok: false,
        optimized: 0,
        removed: 0,
        status: res.status,
        error: data?.error || `HTTP ${res.status}`,
        detail: raw ? String(raw).slice(0, 220) : ''
      };
    }
    return data || { ok: false, optimized: 0, removed: 0, error: 'empty response' };
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message || '') : '';
    return { ok: false, optimized: 0, removed: 0, error: msg || 'network_error' };
  }
}

async function getMemoryMetaApi(sessionId = '') {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return { ok: false, session: { lastExtractedAt: 0, lastOptimizedAt: 0 }, global: { lastOptimizedAt: 0 } };
  try {
    const qs = new URLSearchParams({ sessionId: String(sessionId || '') });
    const res = await fetch(`${wUrl}/memory/meta?${qs.toString()}`);
    return await res.json();
  } catch {
    return { ok: false, session: { lastExtractedAt: 0, lastOptimizedAt: 0 }, global: { lastOptimizedAt: 0 } };
  }
}

async function deleteSessionRemote(id) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id) return { ok: false };
  try {
    const res = await fetch(`${wUrl}/session/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

async function listDeletedSessionsRemote() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return [];
  try {
    const res = await fetch(`${wUrl}/sessions/recoverable`);
    const data = await res.json();
    return data.sessions || [];
  } catch {
    return [];
  }
}

async function restoreDeletedSessionRemote(id) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id) return { ok: false };
  try {
    const res = await fetch(`${wUrl}/session/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

async function purgeSessionRemote(id) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl || !id) return { ok: false };
  try {
    const res = await fetch(`${wUrl}/session/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}
