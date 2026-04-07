// ══════════════════════════════
//  CROP EDITOR (페르소나 이미지 2:3)
// ══════════════════════════════
let _cropState = { scale: 1, x: 0, y: 0, imgW: 0, imgH: 0, onConfirm: null };

function openCropEditor(dataUrl, onConfirm) {
  _cropState.onConfirm = onConfirm; _cropState.scale = 1; _cropState.x = 0; _cropState.y = 0;
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  
  img.onload = () => {
    _cropState.imgW = img.naturalWidth; _cropState.imgH = img.naturalHeight;
    const cw = container.offsetWidth, ch = container.offsetHeight;
    const minScale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    _cropState.minScale = minScale; _cropState.scale = minScale;
    _cropState.x = (cw - (_cropState.imgW * minScale)) / 2;
    _cropState.y = (ch - (_cropState.imgH * minScale)) / 2;
    applyCropTransform();
  };
  img.src = dataUrl; document.getElementById('cropOverlay').classList.add('open'); setupCropInteraction();
}

function closeCropEditor() { document.getElementById('cropOverlay').classList.remove('open'); }

function applyCropTransform() {
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _cropState.scale;
  const iw = _cropState.imgW * s, ih = _cropState.imgH * s;
  _cropState.x = Math.min(0, Math.max(cw - iw, _cropState.x));
  _cropState.y = Math.min(0, Math.max(ch - ih, _cropState.y));
  img.style.width = iw + 'px'; img.style.height = ih + 'px';
  img.style.transform = `translate(${_cropState.x}px, ${_cropState.y}px)`;
}

function confirmCrop() {
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _cropState.scale;
  const sx = -_cropState.x / s, sy = -_cropState.y / s, sw = cw / s, sh = ch / s;
  const canvas = document.createElement('canvas'); 
  canvas.width = 800; canvas.height = 1200;
  const ctx = canvas.getContext('2d'); 
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 800, 1200);
  const result = canvas.toDataURL('image/jpeg', 0.93); 
  closeCropEditor(); 
  if (_cropState.onConfirm) _cropState.onConfirm(result);
}

// ══════════════════════════════
//  AVATAR CROP EDITOR (프로필 1:1)
// ══════════════════════════════
let _avatarCropState = { scale: 1, x: 0, y: 0, imgW: 0, imgH: 0, onConfirm: null };

function openAvatarCropEditor(dataUrl, onConfirm) {
  _avatarCropState.onConfirm = onConfirm;
  _avatarCropState.scale = 1; _avatarCropState.x = 0; _avatarCropState.y = 0;
  const img = document.getElementById('cropImgAvatar');
  const container = document.getElementById('cropContainerAvatar');

  img.onload = () => {
    _avatarCropState.imgW = img.naturalWidth; _avatarCropState.imgH = img.naturalHeight;
    const cw = container.offsetWidth, ch = container.offsetHeight;
    const minScale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    _avatarCropState.minScale = minScale; _avatarCropState.scale = minScale;
    _avatarCropState.x = (cw - img.naturalWidth * minScale) / 2;
    _avatarCropState.y = (ch - img.naturalHeight * minScale) / 2;
    applyAvatarCropTransform();
  };
  img.src = dataUrl;
  document.getElementById('cropOverlayAvatar').classList.add('open');
  setupAvatarCropInteraction();
}

function closeAvatarCropEditor() { document.getElementById('cropOverlayAvatar').classList.remove('open'); }

function applyAvatarCropTransform() {
  const img = document.getElementById('cropImgAvatar');
  const container = document.getElementById('cropContainerAvatar');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _avatarCropState.scale;
  const iw = _avatarCropState.imgW * s, ih = _avatarCropState.imgH * s;
  _avatarCropState.x = Math.min(0, Math.max(cw - iw, _avatarCropState.x));
  _avatarCropState.y = Math.min(0, Math.max(ch - ih, _avatarCropState.y));
  img.style.width = iw + 'px'; img.style.height = ih + 'px';
  img.style.transform = `translate(${_avatarCropState.x}px, ${_avatarCropState.y}px)`;
}

function confirmAvatarCrop() {
  const img = document.getElementById('cropImgAvatar');
  const container = document.getElementById('cropContainerAvatar');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _avatarCropState.scale;
  const sx = -_avatarCropState.x / s, sy = -_avatarCropState.y / s;
  const sw = cw / s, sh = ch / s;
  const SIZE = 600;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // 원형 클리핑
  ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
  const result = canvas.toDataURL('image/png');
  closeAvatarCropEditor();
  if (_avatarCropState.onConfirm) _avatarCropState.onConfirm(result);
}

function setupAvatarCropInteraction() {
  const container = document.getElementById('cropContainerAvatar');
  let dragging = false, lastMX, lastMY;
  container.onmousedown = e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; container.classList.add('grabbing'); e.preventDefault(); };
  window._avatarMouseMove = e => {
    if (!dragging) return;
    _avatarCropState.x += e.clientX - lastMX; _avatarCropState.y += e.clientY - lastMY;
    lastMX = e.clientX; lastMY = e.clientY; applyAvatarCropTransform();
  };
  window._avatarMouseUp = () => { dragging = false; container.classList.remove('grabbing'); };
  window.addEventListener('mousemove', window._avatarMouseMove);
  window.addEventListener('mouseup', window._avatarMouseUp);

  container.onwheel = e => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const delta = e.deltaY > 0 ? 0.92 : 1.09;
    const newScale = Math.min(5, Math.max(_avatarCropState.minScale, _avatarCropState.scale * delta));
    const ratio = newScale / _avatarCropState.scale;
    _avatarCropState.x = cx - rect.left - (cx - rect.left - _avatarCropState.x) * ratio;
    _avatarCropState.y = cy - rect.top  - (cy - rect.top  - _avatarCropState.y) * ratio;
    _avatarCropState.scale = newScale; applyAvatarCropTransform();
  };

  let lastTouches = null;
  container.ontouchstart = e => { lastTouches = e.touches; e.preventDefault(); };
  container.ontouchmove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouches?.length === 1) {
      _avatarCropState.x += e.touches[0].clientX - lastTouches[0].clientX;
      _avatarCropState.y += e.touches[0].clientY - lastTouches[0].clientY;
    } else if (e.touches.length === 2 && lastTouches?.length === 2) {
      const prevDist = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY);
      const newDist  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = newDist / prevDist;
      const midX = (e.touches[0].clientX + e.touches[1].clientX)/2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY)/2;
      const rect = container.getBoundingClientRect();
      const ox = midX - rect.left, oy = midY - rect.top;
      const newScale = Math.min(5, Math.max(_avatarCropState.minScale, _avatarCropState.scale * ratio));
      const sr = newScale / _avatarCropState.scale;
      _avatarCropState.x = ox - (ox - _avatarCropState.x) * sr;
      _avatarCropState.y = oy - (oy - _avatarCropState.y) * sr;
      _avatarCropState.scale = newScale;
    }
    lastTouches = e.touches; applyAvatarCropTransform();
  };
  container.ontouchend = e => { lastTouches = e.touches; };
}

function openCropEditor(dataUrl, onConfirm) {
  _cropState.onConfirm = onConfirm; _cropState.scale = 1; _cropState.x = 0; _cropState.y = 0;
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  
  img.onload = () => {
    _cropState.imgW = img.naturalWidth; _cropState.imgH = img.naturalHeight;
    const cw = container.offsetWidth, ch = container.offsetHeight;
    const minScale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    _cropState.minScale = minScale; _cropState.scale = minScale;
    _cropState.x = (cw - (_cropState.imgW * minScale)) / 2;
    _cropState.y = (ch - (_cropState.imgH * minScale)) / 2;
    applyCropTransform();
  };
  img.src = dataUrl; document.getElementById('cropOverlay').classList.add('open'); setupCropInteraction();
}

function closeCropEditor() { document.getElementById('cropOverlay').classList.remove('open'); }

function applyCropTransform() {
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _cropState.scale;
  const iw = _cropState.imgW * s, ih = _cropState.imgH * s;
  _cropState.x = Math.min(0, Math.max(cw - iw, _cropState.x));
  _cropState.y = Math.min(0, Math.max(ch - ih, _cropState.y));
  img.style.width = iw + 'px'; img.style.height = ih + 'px';
  img.style.transform = `translate(${_cropState.x}px, ${_cropState.y}px)`;
}

function confirmCrop() {
  const img = document.getElementById('cropImg'), container = document.getElementById('cropContainer');
  const cw = container.offsetWidth, ch = container.offsetHeight, s = _cropState.scale;
  const sx = -_cropState.x / s, sy = -_cropState.y / s, sw = cw / s, sh = ch / s;
  
  // 캔버스 크기를 800x1200 고해상도로 변경
  const canvas = document.createElement('canvas'); 
  canvas.width = 800; 
  canvas.height = 1200;
  
  const ctx = canvas.getContext('2d'); 
  ctx.imageSmoothingEnabled = true; 
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 800, 1200);
  
  // 압축 없는 무손실 PNG 포맷으로 추출 (진짜 원본)
  const result = canvas.toDataURL('image/jpeg', 0.93); 
  
  closeCropEditor(); 
  if (_cropState.onConfirm) _cropState.onConfirm(result);
}

function setupCropInteraction() {
  const container = document.getElementById('cropContainer');
  let dragging = false, lastMX, lastMY;
  container.onmousedown = e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; container.classList.add('grabbing'); e.preventDefault(); };
  window.onmousemove = e => {
    if (!dragging) return;
    _cropState.x += e.clientX - lastMX; _cropState.y += e.clientY - lastMY;
    lastMX = e.clientX; lastMY = e.clientY; applyCropTransform();
  };
  window.onmouseup = () => { dragging = false; container.classList.remove('grabbing'); };

  container.onwheel = e => {
    e.preventDefault();
    const rect = container.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const delta = e.deltaY > 0 ? 0.92 : 1.09;
    const newScale = Math.min(3, Math.max(_cropState.minScale, _cropState.scale * delta));
    const ratio = newScale / _cropState.scale;
    _cropState.x = cx - rect.left - (cx - rect.left - _cropState.x) * ratio;
    _cropState.y = cy - rect.top  - (cy - rect.top  - _cropState.y) * ratio;
    _cropState.scale = newScale; applyCropTransform();
  };

  let lastTouches = null;
  container.ontouchstart = e => { lastTouches = e.touches; e.preventDefault(); };
  container.ontouchmove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouches?.length === 1) {
      _cropState.x += e.touches[0].clientX - lastTouches[0].clientX;
      _cropState.y += e.touches[0].clientY - lastTouches[0].clientY;
    } else if (e.touches.length === 2 && lastTouches?.length === 2) {
      const prevDist = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY);
      const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = newDist / prevDist;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2, midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = container.getBoundingClientRect(), ox = midX - rect.left, oy = midY - rect.top;
      const newScale = Math.min(3, Math.max(_cropState.minScale, _cropState.scale * ratio)), sr = newScale / _cropState.scale;
      _cropState.x = ox - (ox - _cropState.x) * sr; _cropState.y = oy - (oy - _cropState.y) * sr;
      _cropState.scale = newScale;
    }
    lastTouches = e.touches; applyCropTransform();
  };
  container.ontouchend = e => { lastTouches = e.touches; };
}
