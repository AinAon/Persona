// ── 채팅 모델 목록 (페르소나 편집 + 드로어에서 공유) ──
const CHAT_MODELS = [
  { value: '', label: '기본 (채팅방 설정 따름)' },
  { group: 'Google' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Lite' },
  { value: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro' },
  { value: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash' },  
  { group: 'OpenAI' },
  { value: 'gpt-5.4-nano',  label: 'GPT-5.4 Nano' },
  { value: 'gpt-5.4-mini',  label: 'GPT-5.4 Mini' },
  { value: 'gpt-5.4',       label: 'GPT-5.4' },
  { group: 'xAI' },
  { value: 'grok-4-1-fast-reasoning-latest',     label: 'Grok-4.1 Reason' },
  { value: 'grok-4-1-fast-non-reasoning-latest', label: 'Grok-4.1 Non' },
  { value: 'grok-4.20-reasoning-latest',         label: 'Grok-4.20 Reason' },
  { value: 'grok-4.20-non-reasoning-latest',     label: 'Grok-4.20 Non' },
];

function buildModelSelect(id, selectedValue, style = '') {
  const opts = CHAT_MODELS.map(m => {
    if (m.group) return `<optgroup label="${m.group}">`;
    const sel = m.value === (selectedValue || '') ? 'selected' : '';
    return `<option value="${m.value}" ${sel}>${m.label}</option>`;
  }).join('');
  return `<select class="edit-input" id="${id}" style="width:100%;${style}">${opts}</select>`;
}

// ══════════════════════════════
//  UTILS (UI)
// ══════════════════════════════
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 마크다운 렌더러 초기화
function initMarked() {
  if (typeof marked === 'undefined') return;
  marked.setOptions({
    breaks: true,       // 줄바꿈 → <br>
    gfm: true,          // GitHub Flavored Markdown
    highlight: (code, lang) => {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
    }
  });
}

// mermaid 초기화
function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true });
  }
}

// 마크다운 → HTML 변환 (mermaid 블록 포함)
function mdRender(text) {
  if (typeof marked === 'undefined') {
    // fallback: 기존 fmt
    return esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  }
  // mermaid 블록 임시 치환
  const mermaidBlocks = [];
  const replaced = text.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push(code.trim());
    return `<div class="mermaid-placeholder" data-idx="${idx}" data-code="${encodeURIComponent(code.trim())}"></div>`;
  });
  const html = marked.parse(replaced);
  return html;
}

// mermaid 블록 실제 렌더링 (DOM 삽입 후 호출)
async function renderMermaidBlocks(container) {
  if (typeof mermaid === 'undefined') return;
  const placeholders = container.querySelectorAll('.mermaid-placeholder');
  for (const ph of placeholders) {
    if (ph.dataset.rendered) continue;
    const code = ph.dataset.code ? decodeURIComponent(ph.dataset.code) : null;
    if (!code) continue;
    try {
      const id = 'mermaid-' + Math.random().toString(36).slice(2);
      const { svg } = await mermaid.render(id, code);
      ph.innerHTML = svg;
      ph.dataset.rendered = '1';
    } catch(e) {
      ph.innerHTML = `<pre style="color:var(--muted);font-size:11px;white-space:pre-wrap">${esc(code)}</pre>`;
      ph.dataset.rendered = '1';
    }
  }
}

function fmt(s) { return mdRender(s); }

function sanitizeUserInputValue(value) {
  return String(value || '').replace(/[\u200B-\u200D\u2060\uFEFF\uFFFC]/g, '');
}

function isImageAttachment(a) {
  return a?.type === 'image';
}

function getAttachmentPreviewUrl(a) {
  return a?.previewUrl || a?.transportUrl || a?.dataUrl || '';
}

function getAttachmentStoredUrl(a) {
  return a?.transportUrl || a?.dataUrl || getAttachmentPreviewUrl(a);
}

async function getAttachmentOriginalUrl(a) {
  if (!a) return '';
  if (a.originalDataUrl) return a.originalDataUrl;
  if (a.originalCacheKey) {
    const cached = await idbGet(a.originalCacheKey).catch(() => null);
    if (cached) return cached;
  }
  const fallback = a?.dataUrl || a?.previewUrl || '';
  return typeof fallback === 'string' && fallback.startsWith('data:') ? fallback : '';
}

async function getAttachmentRequestUrl(a, model, isImageReq) {
  if (!isImageAttachment(a)) return '';
  const original = await getAttachmentOriginalUrl(a);
  const stored = getAttachmentStoredUrl(a);
  if (isImageReq && model.startsWith('gpt-image')) return original || stored;
  if (model.startsWith('gemini')) return original || stored;
  return stored || original;
}

async function cleanupAttachmentCaches(items) {
  await Promise.all((items || []).map(a => a?.originalCacheKey ? idbDel(a.originalCacheKey).catch(() => {}) : Promise.resolve()));
}

function buildUserMessageContent(text, imageUrls) {
  const imgs = (imageUrls || []).filter(Boolean);
  if (!imgs.length) return text || '(파일)';
  const content = [];
  if (text) content.push({ type: 'text', text });
  imgs.forEach(url => content.push({ type: 'image_url', image_url: { url } }));
  return content;
}

function getTargetModelForRequest(session, isImageReq) {
  if (isImageReq) {
    return document.getElementById('imageModelSelect')?.value || 'grok-imagine-image-pro';
  }
  const pListForModel = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const targetModel = pListForModel.find(p => p.defaultModel)?.defaultModel
    || document.getElementById('chatModeSelect')?.value
    || 'grok-4.20-non-reasoning-latest';
  const sel = document.getElementById('chatModeSelect');
  if (sel && sel.value !== targetModel) sel.value = targetModel;
  return targetModel;
}

function getPersonaModel(persona) {
  return persona?.defaultModel || document.getElementById('chatModeSelect')?.value || 'grok-4.20-non-reasoning-latest';
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRespondingPersonas(session, pList) {
  if (pList.length <= 1) return pList;
  if (session.responseMode === 'all') return shuffleArray(pList);
  return [shuffleArray(pList)[0]];
}

function wrapPersonaReply(pid, reply) {
  const cleaned = cleanContent(String(reply || '').trim()) || '...';
  return `[${pid}]${cleaned}[/${pid}]`;
}

async function buildAttachmentRecord(file) {
  const id = uid();
  const isImg = file.type.startsWith('image/');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });

  const record = {
    id,
    type: isImg ? 'image' : 'file',
    name: file.name,
    mimeType: file.type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
    dataUrl,
    previewUrl: dataUrl,
    transportUrl: dataUrl,
    originalCacheKey: null
  };

  if (!isImg) return record;

  const cacheKey = `attachment_original_${id}`;
  record.originalCacheKey = cacheKey;
  await idbSet(cacheKey, dataUrl).catch(() => {});

  const previewUrl = await resizeImage(dataUrl, 512, 0.82).catch(() => dataUrl);
  record.previewUrl = previewUrl || dataUrl;
  record.dataUrl = record.previewUrl;

  const fname = makeImageFilename('uploaded') + '.jpg';
  record.transportUrl = await uploadToR2(dataUrl, 'img_uploaded', fname).catch(() => dataUrl);
  return record;
}

async function addFilesToAttachments(fileList, source = 'picker') {
  const files = [...(fileList || [])];
  if (!files.length) return 0;
  let added = 0;
  for (const file of files) {
    const record = await buildAttachmentRecord(file);
    record.source = source;
    attachments.push(record);
    added++;
    renderAttachmentPreviews();
  }
  return added;
}

function setComposerDragActive(active) {
  const bar = document.querySelector('.chat-input-bar');
  const row = document.querySelector('.input-row');
  const attachmentsRow = document.getElementById('attachmentsRow');
  [bar, row, attachmentsRow].forEach(el => {
    if (!el) return;
    el.style.transition = 'box-shadow .12s ease, border-color .12s ease, background-color .12s ease';
    el.style.boxShadow = active ? '0 0 0 1px rgba(255,255,255,.22), 0 0 0 4px rgba(255,255,255,.06)' : '';
    el.style.backgroundColor = active && el === attachmentsRow ? 'rgba(255,255,255,.04)' : '';
  });
}

function initUserInputGuards() {
  const input = document.getElementById('userInput');
  if (!input) return;
  const composer = document.querySelector('.chat-input-bar');
  let dragDepth = 0;

  input.addEventListener('paste', e => {
    const items = [...(e.clipboardData?.items || [])];
    const hasImage = items.some(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (hasImage) {
      e.preventDefault();
      showToast('클립보드 이미지 붙여넣기는 아직 지원하지 않아요. 파일 첨부 버튼을 사용해 주세요.');
      return;
    }
    requestAnimationFrame(() => autoResize(input));
  });

  const onDragEnter = e => {
    if (!(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    setComposerDragActive(true);
  };

  const onDragOver = e => {
    if (!(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setComposerDragActive(true);
  };

  const onDragLeave = e => {
    if (!(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setComposerDragActive(false);
  };

  const onDrop = async e => {
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    dragDepth = 0;
    setComposerDragActive(false);
    const added = await addFilesToAttachments(files, 'drop');
    if (added > 0) {
      showToast(`${added}개 파일을 첨부했어요.`);
      input.focus();
    }
  };

  [composer, input, document.getElementById('attachmentsRow')].filter(Boolean).forEach(el => {
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
  });
}

// 라이브러리 초기화 (스크립트 로드 후)
window.addEventListener('load', () => {
  initMarked();
  initMermaid();
  initUserInputGuards();
});
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function timeLabel(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff/60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}시간 전`;
  return `${Math.floor(diff/86400000)}일 전`;
}

// ══════════════════════════════
//  TOAST / LOADING
// ══════════════════════════════
let toastTimer = null;
function showToast(msg, duration = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}
function setLoading(show, text = 'Loading...') {
  const el = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').textContent = text;
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

// ══════════════════════════════
//  AVATAR HTML
// ══════════════════════════════
function defaultAvatar(h) {
  return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="14" r="7" fill="hsl(${h},40%,35%)"/>
    <ellipse cx="18" cy="30" rx="11" ry="7" fill="hsl(${h},40%,28%)"/>
  </svg>`;
}
function avatarHTML(p) {
  return p.image ? `<img src="${p.image}">` : defaultAvatar(p.hue);
}

// ══════════════════════════════
//  TAB SWITCHING & SETTINGS
// ══════════════════════════════
function switchTab(tab) {
  activeTab = tab;
  // 하단 탭 활성화
  document.getElementById('btabPersona').classList.toggle('active', tab === 'persona');
  document.getElementById('btabChat').classList.toggle('active', tab === 'chat');
  document.getElementById('btabSettings').classList.toggle('active', tab === 'settings');
  // 패널 표시
  document.getElementById('personaPane').style.display = tab === 'persona' ? 'flex' : 'none';
  document.getElementById('chatPane').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('settingsPane').style.display = tab === 'settings' ? 'flex' : 'none';
  if (tab === 'settings') renderSettingsPane();
  // 페르소나 선택 초기화
  if (tab !== 'persona') clearPersonaSelection();
}

function renderSettingsPane() {
  const av = document.getElementById('settingsUserAv');
  if (av) av.innerHTML = userProfile.image
    ? `<img src="${userProfile.image}" style="width:100%;height:100%;object-fit:cover;">`
    : `<svg viewBox="0 0 36 36" style="width:100%;height:100%"><circle cx="18" cy="14" r="7" fill="hsl(220,30%,35%)"/><ellipse cx="18" cy="30" rx="11" ry="7" fill="hsl(220,30%,28%)"/></svg>`;
  // 삭제 버튼 표시/숨김
  const delBtn = document.getElementById('settingsDelAvBtn');
  if (delBtn) delBtn.style.display = userProfile.image ? 'block' : 'none';
  const nameEl = document.getElementById('settingsUserName');
  const bioEl = document.getElementById('settingsUserBio');
  if (nameEl) nameEl.value = userProfile.name || '';
  if (bioEl) bioEl.value = userProfile.bio || '';
  
  // 시작 화면 설정
  const tabEl = document.getElementById('settingsDefaultTab');
  if (tabEl) tabEl.value = userProfile.defaultTab || 'persona';

  // 글씨 크기 슬라이더
  const fs = userProfile.fontSize || 15;
  const fsEl = document.getElementById('settingsFontSize');
  const fsLabel = document.getElementById('settingsFontSizeLabel');
  if (fsEl) fsEl.value = fs;
  if (fsLabel) fsLabel.textContent = fs + 'px';

  // 썸네일 스타일 설정 추가
  const avStyleEl = document.getElementById('settingsAvatarStyle');
  if (avStyleEl) avStyleEl.value = userProfile.chatAvatarStyle || 'square';
}

function previewFontSize(val) {
  const v = parseInt(val);
  const label = document.getElementById('settingsFontSizeLabel');
  if (label) label.textContent = v + 'px';
  applyFontSize(v);
}

function applyFontSize(size) {
  document.documentElement.style.setProperty('--chat-font-size', (size || 15) + 'px');
}

function saveSettingsUserProfile() {
  userProfile.name = document.getElementById('settingsUserName')?.value.trim() || '';
  userProfile.bio = document.getElementById('settingsUserBio')?.value.trim() || '';
  userProfile.defaultTab = document.getElementById('settingsDefaultTab')?.value || 'persona';
  userProfile.chatAvatarStyle = document.getElementById('settingsAvatarStyle')?.value || 'square';
  userProfile.fontSize = parseInt(document.getElementById('settingsFontSize')?.value || 15);
  applyFontSize(userProfile.fontSize);
  saveUserProfile();
  saveUserProfileKV();
  showToast('설정 저장됨 ✓');
}

function handleSettingsUserImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openAvatarCropEditor(e.target.result, async (cropped) => {
      userProfile.image = cropped;
      saveUserProfile();
      renderSettingsPane();
      idbSet('user_profile_hd', e.target.result).catch(()=>{});
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function deleteSettingsUserImage() {
  if (!confirm('프로필 이미지를 삭제할까요?')) return;
  userProfile.image = null;
  saveUserProfile();
  renderSettingsPane();
  idbSet('user_profile_hd', null).catch(()=>{});
}

// ══════════════════════════════
//  PERSONA GRID
// ══════════════════════════════
let _personaGridRenderVersion = 0;

async function renderPersonaGrid() {
  const COLS = 3;
  const grid = document.getElementById('personaGrid');
  grid.innerHTML = '';

  const myVersion = ++_personaGridRenderVersion;

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];
    const card = document.createElement('div');
    card.className = 'persona-card';
    card.dataset.pid = p.pid;
    card.draggable = true;

    const neutral = await getEmotionImageHD(p.pid, 'neutral') || await getNeutralImage(p.pid);

    // 새 render 호출이 이미 시작됐으면 이 루프 중단
    if (myVersion !== _personaGridRenderVersion) return;

    const imgSrc = neutral || p.image;
    const nametagBg = `hsl(${p.hue},45%,22%)`;
    const isCeleb = p.type === 'celebrity';
    const celebStroke = isCeleb ? `box-shadow: inset 0 0 0 1.5px hsl(${p.hue},70%,60%), 0 0 8px hsl(${p.hue},60%,40%);` : '';
    card.innerHTML = `
      <div class="persona-card-img" style="${celebStroke}; aspect-ratio: 1 / 3; overflow: hidden;">
        ${imgSrc ? `<img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">` : defaultAvatar(p.hue)}
      </div>
      <div class="persona-card-name" style="background:${nametagBg}">${esc(p.name)}</div>`;

    let pointerStartX = 0, pointerStartY = 0;
    card.addEventListener('pointerdown', e => { pointerStartX = e.clientX; pointerStartY = e.clientY; });
    card.addEventListener('pointerup', e => {
      if (card.dataset.dragging === '1') return;
      const dx = Math.abs(e.clientX - pointerStartX);
      const dy = Math.abs(e.clientY - pointerStartY);
      if (dx < 8 && dy < 8) {
        if (_selectedPersonaPid === p.pid) {
          openPersonaEdit(p.pid);
        } else {
          selectPersonaForChat(p.pid);
        }
      }
    });

    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('pid', p.pid);
      setTimeout(() => { card.style.opacity = '0.01'; }, 0);
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '';
      delete card.dataset.dragging;
      grid.querySelectorAll('.persona-card[data-pid]').forEach(c => { c.style.transition = ''; c.style.transform = ''; });
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      const fromPid = [...grid.querySelectorAll('.persona-card[data-pid]')].find(c => c.style.opacity === '0.01')?.dataset.pid;
      if (!fromPid || fromPid === p.pid) return;

      const cards = [...grid.querySelectorAll('.persona-card[data-pid]')];
      const order = cards.map(c => c.dataset.pid);
      const fromIdx = order.indexOf(fromPid);
      const toIdx = order.indexOf(p.pid);
      if (fromIdx === toIdx) return;

      const newOrder = [...order];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, fromPid);

      const gridRect = grid.getBoundingClientRect();
      const gap = 12;
      const colWidth = (gridRect.width - gap * (COLS - 1)) / COLS;
      const rowHeight = card.getBoundingClientRect().height + gap;

      cards.forEach((c, i) => {
        const newPos = newOrder.indexOf(c.dataset.pid);
        const curRow = Math.floor(i / COLS), curCol = i % COLS;
        const newRow = Math.floor(newPos / COLS), newCol = newPos % COLS;
        const tx = (newCol - curCol) * (colWidth + gap);
        const ty = (newRow - curRow) * rowHeight;
        c.style.transition = 'transform .2s cubic-bezier(.25,.8,.25,1)';
        if (c.style.opacity !== '0.01') c.style.transform = `translate(${tx}px,${ty}px)`;
      });
      card._pendingOrder = newOrder;
    });
    card.addEventListener('drop', e => {
      e.preventDefault();
      const fromPid = e.dataTransfer.getData('pid');
      if (!fromPid || fromPid === p.pid) return;
      if (card._pendingOrder) {
        personas.sort((a, b) => card._pendingOrder.indexOf(a.pid) - card._pendingOrder.indexOf(b.pid));
        delete card._pendingOrder;
      }
      savePersonas();
      renderPersonaGrid();
    });

    grid.appendChild(card);
  }

  if (myVersion !== _personaGridRenderVersion) return;

  const addCard = document.createElement('div');
  addCard.className = 'persona-card add-card';
  addCard.onclick = () => createNewPersona();
  addCard.innerHTML = `
    <div class="add-card-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>`;
  grid.appendChild(addCard);

  setupTouchDrag(grid);
}

function setupTouchDrag(grid) {
  let dragEl = null, ghost = null, dragPid = null, currentOrder = null;
  const getCards = () => [...grid.querySelectorAll('.persona-card[data-pid]')];
  const COLS = 3;

  grid.addEventListener('touchstart', e => {
    const card = e.target.closest('.persona-card[data-pid]');
    if (!card) return;

    let holdTimer = null, isDragging = false;
    const touch0 = e.touches[0];
    let lastX = touch0.clientX, lastY = touch0.clientY;

    holdTimer = setTimeout(() => {
      isDragging = true; dragEl = card; dragPid = card.dataset.pid;
      card.dataset.dragging = '1'; currentOrder = getCards().map(c => c.dataset.pid);

      const rect = card.getBoundingClientRect();
      ghost = card.cloneNode(true);
      ghost.style.cssText = `
        position:fixed;z-index:999; left:${rect.left}px;top:${rect.top}px;
        width:${rect.width}px;height:${rect.height}px; opacity:.9;pointer-events:none;
        border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,.5); transform:scale(1.06); transition:transform .1s;
      `;
      document.body.appendChild(ghost);
      card.style.opacity = '0';
      navigator.vibrate?.(30);
    }, 300);

    const onMove = e2 => {
      const t = e2.touches[0];
      const dx = t.clientX - touch0.clientX, dy = t.clientY - touch0.clientY;

      if (!isDragging) {
        if (Math.abs(dx) > 18 || Math.abs(dy) > 18) clearTimeout(holdTimer);
        return;
      }
      e2.preventDefault();
      lastX = t.clientX; lastY = t.clientY;

      const rect = dragEl.getBoundingClientRect();
      ghost.style.left = (t.clientX - rect.width / 2) + 'px';
      ghost.style.top = (t.clientY - rect.height / 2) + 'px';

      const cards = getCards();
      let targetPid = null, minDist = Infinity;
      for (const c of cards) {
        if (c === dragEl) continue;
        const r = c.getBoundingClientRect();
        const dist = Math.hypot(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
        if (dist < minDist && dist < r.width) { minDist = dist; targetPid = c.dataset.pid; }
      }
      if (!targetPid) return;

      const fromIdx = currentOrder.indexOf(dragPid), toIdx = currentOrder.indexOf(targetPid);
      if (fromIdx === toIdx) return;

      const newOrder = [...currentOrder];
      newOrder.splice(fromIdx, 1); newOrder.splice(toIdx, 0, dragPid);

      const gridRect = grid.getBoundingClientRect(), gap = 12;
      const colWidth = (gridRect.width - gap * (COLS - 1)) / COLS;
      const rowHeight = dragEl.getBoundingClientRect().height + gap;

      cards.forEach((c, i) => {
        const curPos = currentOrder.indexOf(c.dataset.pid), newPos = newOrder.indexOf(c.dataset.pid);
        const tx = (newPos % COLS - curPos % COLS) * (colWidth + gap);
        const ty = (Math.floor(newPos / COLS) - Math.floor(curPos / COLS)) * rowHeight;
        c.style.transition = 'transform .2s cubic-bezier(.25,.8,.25,1)';
        c.style.transform = c === dragEl ? '' : `translate(${tx}px,${ty}px)`;
      });
      currentOrder = newOrder;
    };

    const onEnd = () => {
      clearTimeout(holdTimer);
      document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd);
      if (!isDragging) return;
      if (ghost) { document.body.removeChild(ghost); ghost = null; }
      dragEl.style.opacity = '';
      getCards().forEach(c => { c.style.transition = ''; c.style.transform = ''; });
      if (currentOrder) {
        personas.sort((a, b) => currentOrder.indexOf(a.pid) - currentOrder.indexOf(b.pid));
        savePersonas(); renderPersonaGrid();
      }
      dragEl = null; dragPid = null; currentOrder = null;
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, { passive: true });
}

// ══════════════════════════════
//  PERSONA EDIT
// ══════════════════════════════
let isNewPersona = false;

async function openPersonaEdit(pid) {
  editingPid = pid; isNewPersona = false;
  const p = getPersona(pid);
  document.getElementById('editTitle').textContent = p ? p.name || '페르소나 편집' : '새 페르소나';
  const hdImage = p ? await getEmotionImageHD(p.pid, 'neutral') : null;
  renderEditBody(p || { pid, name:'', bio:'', tags:[], hue:200, image:null }, hdImage);
  renderEditFooter(!!p);
  show('editScreen');
}

function createNewPersona() {
  const p = { pid: nextPid(), name: '', bio: '', tags: [], hue: 200, image: null };
  isNewPersona = true; editingPid = p.pid;
  personas.push(p);
  document.getElementById('editTitle').textContent = '새 페르소나';
  renderEditBody(p, null); renderEditFooter(false);
  show('editScreen');
}

function renderEditFooter(isExisting) {
  const footer = document.getElementById('editFooter');
  const p = getPersona(editingPid);
  if (isExisting) {
    footer.innerHTML = `
      <button class="edit-delete-btn" onclick="deletePersonaFromEdit()">삭제</button>
      <button class="edit-cancel-btn" onclick="cancelPersonaEdit()">취소</button>
      <button class="edit-save-btn" onclick="savePersonaEdit()">저장</button>`;
  } else {
    footer.innerHTML = `
      <button class="edit-cancel-btn" onclick="cancelPersonaEdit()">취소</button>
      <button class="edit-save-btn" onclick="savePersonaEdit()">생성</button>`;
  }
}

function cancelPersonaEdit() {
  if (isNewPersona) personas = personas.filter(p => p.pid !== editingPid);
  goMain();
}

function deletePersonaFromEdit() {
  if (personas.length <= 1) { showToast('마지막 페르소나는 삭제할 수 없어'); return; }
  if (!confirm('이 페르소나를 삭제할까?')) return;
  personas = personas.filter(p => p.pid !== editingPid);
  savePersonas(); renderPersonaGrid(); goMain();
}

function renderEditBody(p, hdImage = null) {
  const body = document.getElementById('editBody');
  const neutral = hdImage || _neutralCache[p.pid] || p.image;

  body.innerHTML = `
    <div class="edit-big-img-wrap" onclick="document.getElementById('editImgInput').click()">
      ${neutral ? `<img src="${neutral}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block">` : defaultAvatar(p.hue)}
      <div class="edit-big-img-overlay">
        <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </div>
    </div>
    <input type="file" id="editImgInput" style="display:none" accept="image/*" onchange="handleEditImage(this)">
    <input type="file" id="editMultiImgInput" style="display:none" accept="image/*" multiple onchange="handleMultiImageUpload(this)">
    <button onclick="document.getElementById('editMultiImgInput').click()" style="width:100%;padding:9px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--muted);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer;margin-top:6px">
      📁 감정 이미지 일괄 업로드 (파일명 그대로 저장)
    </button>

    <div>
      <div class="edit-section-title">Identity Details</div>

      <div class="edit-field-label">PID ${isNewPersona?'<span style="font-size:9px;color:var(--muted)">(변경 가능)</span>':'<span style="font-size:9px;color:var(--muted)">(읽기 전용)</span>'}</div>
      <input class="edit-input" id="editPid" value="${esc(p.pid)}" placeholder="p_riley" ${isNewPersona?'':'readonly'} style="width:100%;font-family:monospace;font-size:12px;color:var(--muted);${isNewPersona?'':'opacity:.6;cursor:default'}">

      <div class="edit-field-label">NAME</div>
      <input class="edit-input" id="editName" value="${esc(p.name)}" placeholder="이름" style="width:100%">

      <div class="edit-field-row" style="margin-top:0">
        <div>
          <div class="edit-field-label">GENDER</div>
          <select class="edit-input" id="editGender" style="width:100%">
            <option value="" ${!p.gender?'selected':''}>선택 안 함</option>
            <option value="male" ${p.gender==='male'?'selected':''}>Male</option>
            <option value="female" ${p.gender==='female'?'selected':''}>Female</option>
            <option value="nonbinary" ${p.gender==='nonbinary'?'selected':''}>Non-binary</option>
            <option value="other" ${p.gender==='other'?'selected':''}>Other</option>
          </select>
        </div>
        <div>
          <div class="edit-field-label">AGE / BIRTH YEAR</div>
          <input class="edit-input" id="editAge" value="${esc(p.age||'')}" placeholder="예: 28, 1996" style="width:100%">
        </div>
      </div>

      <div class="edit-field-label">MBTI TYPE</div>
      <input class="edit-input" id="editMbti" value="${esc(p.mbti||'')}" placeholder="예: INTJ-A" style="width:100%">

      <div class="edit-field-row">
        <div>
          <div class="edit-field-label">NICKNAME (쉼표 구분)</div>
          <input class="edit-input" id="editNicknames" value="${esc((p.nicknames||[]).join(', '))}" placeholder="닉네임" style="width:100%">
        </div>
        <div>
          <div class="edit-field-label">나를 부르는 호칭</div>
          <input class="edit-input" id="editUserTitle" value="${esc(p.userTitle||'')}" placeholder="예: 선생님" style="width:100%">
        </div>
      </div>
    </div>

    <div>
      <div class="edit-section-title">Personality</div>

      <div class="edit-field-label">PERSONALITY TRAITS (최대 6개)</div>
      <div class="tags-wrap">
        ${TRAIT_OPTIONS.map(t => `<div class="tag ${(p.tags||[]).includes(t)?'on':''}" onclick="toggleEditTrait('${t}',this)">${t}</div>`).join('')}
      </div>

      <div class="edit-field-label" style="margin-top:14px">COLOR</div>
      <div class="hue-swatches">
        ${HUE_PRESETS.map(h => `<div class="hue-swatch ${h===p.hue?'on':''}" style="background:hsl(${h},60%,62%)" onclick="selectEditHue(${h},this)"></div>`).join('')}
      </div>
    </div>

    <div>
      <div class="edit-section-title">Description</div>
      <div class="edit-field-label">ROLE / INTRODUCTION</div>
      <textarea class="edit-textarea" id="editBio" placeholder="어떤 역할인지 짧게 적어줘" style="height:90px">${esc(p.bio)}</textarea>
    </div>

    <div>
      <div class="edit-section-title">Model</div>
      <div class="edit-field-label">기본 응답 모델 (이 페르소나가 참여한 채팅의 기본값)</div>
      ${buildModelSelect('editDefaultModel', p.defaultModel || '')}
    </div>`;
}

function selectEditHue(h, el) {
  document.querySelectorAll('#editBody .hue-swatch').forEach(s => s.classList.remove('on'));
  el.classList.add('on'); el.dataset.hue = h;
}
function toggleEditTrait(trait, el) {
  const selected = [...document.querySelectorAll('#editBody .tag.on')];
  if (el.classList.contains('on')) { el.classList.remove('on'); return; }
  if (selected.length >= 6) return;
  el.classList.add('on');
}
function handleEditImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const originalDataUrl = e.target.result;
    openCropEditor(originalDataUrl, async (cropped) => {
      // 화면 즉시 반영
      const av = document.querySelector('#editBody .edit-big-img-wrap');
      if (av) av.innerHTML = `<img src="${cropped}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"><div class="edit-big-img-overlay"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;

      const p = getPersona(editingPid); if (!p) return;

      // 3단계 썸네일 생성
      idbSet(`em_full_${p.pid}_neutral`, cropped).catch(() => {});
      p._pendingImage = cropped;

      const { sqMd, fullHd, circSm } = await generateThumbnailSet(cropped, p.pid, 'neutral');

      // 메모리
      p.image = sqMd;
      p.neutral_md = sqMd;
      p.neutral_hd = fullHd;
      p.neutral_thumb = circSm;
      _neutralCache[p.pid] = sqMd;

      showToast('이미지 선택됨 — 저장 버튼을 눌러줘');
    });
  };
  reader.readAsDataURL(file);
}

async function handleMultiImageUpload(input) {
  const p = getPersona(editingPid); if (!p) return;
  const files = [...input.files]; if (!files.length) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) { alert('Worker URL 없음'); return; }

  showToast(`⏳ ${files.length}개 업로드 중...`, 10000);
  let ok = 0, fail = 0;
  for (const file of files) {
    try {
      const dataUrl = await new Promise(r => {
        const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(file);
      });
      const resized = await resizeImage(dataUrl, 1200, 0.93);
      const b64 = resized.split(',')[1];
      const byteArr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: 'image/jpeg' });
      const form = new FormData();
      form.append('file', blob, file.name);
      form.append('folder', `profile/${p.pid}`);
      const res = await fetch(wUrl + '/image', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) {
        ok++;
        const fname = file.name.replace(/\.jpg$/i, '');
        const namePrefix = p.pid + '_';
        if (fname.startsWith(namePrefix)) {
          const rest = fname.slice(namePrefix.length);
          const parts = rest.split('_');
          const emotion = parts[0];
          const letter = parts[1] || '';
          if (emotion === 'neutral') {
            const { sqMd } = await generateThumbnailSet(resized, p.pid, 'neutral').catch(() => ({ sqMd: null }));
            if (sqMd) {
              _neutralCache[p.pid] = sqMd;
              renderPersonaGrid();
            }
          } else {
            const idbKey = letter ? `emotion_${p.pid}_${emotion}_${letter}` : `emotion_${p.pid}_${emotion}`;
            const md = await resizeImage(resized, 300, 0.85).catch(() => null);
            if (md) idbSet(idbKey, md).catch(() => {});
          }
        }
      } else { fail++; }
    } catch(e) { fail++; }
  }
  if (typeof _imageListCache !== 'undefined') delete _imageListCache[p.pid];
  showToast(`✓ ${ok}개 완료${fail ? ` / ${fail}개 실패` : ''}`);
  input.value = '';
}

async function savePersonaEdit() {
  const p = getPersona(editingPid); if (!p) return;
  const newPid = document.getElementById('editPid')?.value.trim();
  if (isNewPersona && newPid && newPid !== p.pid) {
    personas = personas.filter(x => x.pid !== p.pid);
    p.pid = newPid;
    editingPid = newPid;
    personas.push(p);
  }
  p.name = document.getElementById('editName').value.trim() || '페르소나';
  p.bio = document.getElementById('editBio').value.trim();
  const selSwatch = document.querySelector('#editBody .hue-swatch.on');
  if (selSwatch?.dataset.hue) p.hue = parseInt(selSwatch.dataset.hue);
  p.tags = [...document.querySelectorAll('#editBody .tag.on')].map(el => el.textContent);
  p.nicknames = (document.getElementById('editNicknames')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  p.userTitle = document.getElementById('editUserTitle')?.value.trim() || '';
  p.age = document.getElementById('editAge')?.value.trim() || '';
  p.gender = document.getElementById('editGender')?.value || '';
  p.mbti = document.getElementById('editMbti')?.value.trim() || '';
  p.defaultModel = document.getElementById('editDefaultModel')?.value || '';
  isNewPersona = false;

  if (p._pendingImage) {
    showToast('⏳ 이미지 저장 중...', 5000);
    try {
      const workerUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
      if (!workerUrl) throw new Error('Worker URL 없음');
      const b64 = p._pendingImage.split(',')[1];
      const byteArr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: 'image/jpeg' });
      const fname = `${p.pid}_neutral.jpg`;
      const form = new FormData();
      form.append('file', blob, fname);
      form.append('folder', `profile/${p.pid}`);
      const res = await fetch(workerUrl + '/image', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || '업로드 실패');
      p.imageUrl = data.url;
    } catch(e) {
      alert('이미지 저장 실패: ' + e.message);
      return;
    }
    delete p._pendingImage;
  }
  savePersonas(); renderPersonaGrid(); goMain();
  showToast('저장됨 ✓');
}

// ══════════════════════════════
//  CHAT LIST & SWIPE DELETE
// ══════════════════════════════


// ══════════════════════════════
//  마크다운 렌더링 데모
// ══════════════════════════════
const _DEMO_SLIDES = [
  { label: "표 (Table)", text: "| 항목 | 금액 | 비고 |\n|---|---:|---|\n| 매출 | 12,500,000 | 1분기 |\n| 매입 | 8,200,000 | 원자재 |\n| **영업이익** | **4,300,000** | 34.4% |" },
  { label: "코드 블록", text: "```python\ndef greet(name):\n    return '안녕, ' + name\n\nprint(greet('Riley'))\n```" },
  { label: "목록 & 인용", text: "**오늘 할 일**\n\n1. 기획서 작성\n2. 디자인 리뷰\n3. 배포 확인\n\n> 완벽한 코드보다 동작하는 코드가 낫다" },
  { label: "Mermaid", text: "```mermaid\nflowchart LR\n  A[사용자] --> B{파싱}\n  B --> C[페르소나]\n  B --> D[마크다운]\n  C --> E[감정이미지]\n  D --> F[렌더링]\n```" },
  { label: "모델 비교", text: "| 모델 | 속도 | 비전 | 이미지생성 |\n|---|:---:|:---:|:---:|\n| grok-4-1-fast-non-reasoning | ⚡⚡⚡ | ✓ | ✗ |\n| grok-3-mini | ⚡⚡ | ✗ | ✗ |\n| claude-sonnet | ⚡⚡ | ✓ | ✗ |\n| gemini-2.5-pro | ⚡ | ✓ | ✓ |\n| gpt-4o | ⚡⚡ | ✓ | ✓ |" }
];

let _demoSlideIdx = 0;
let _isDemoMode = false;

function openMarkdownDemo() {
  _demoSlideIdx = 0;
  _isDemoMode = true;
  let s = sessions.find(x => x._markdownDemo);
  if (!s) {
    s = {
      id: 'demo-markdown',
      _demo: true,
      _markdownDemo: true,
      participantPids: [],
      history: [],
      roomName: '렌더링 데모',
      updatedAt: Date.now(),
      lastPreview: '표 · 코드 · Mermaid'
    };
    sessions.unshift(s);
  }
  s.history = [];
  s._loaded = true;
  activeChatId = s.id;
  // 메인화면 → 채팅 탭 활성화 후 chatScreen으로
  show('chatScreen');
  // 탭바 active 상태 갱신
  ['Persona','Chat','Settings'].forEach(t =>
    document.getElementById('btab'+t)?.classList.toggle('active', false)
  );
  document.getElementById('chatHeaderNames').textContent = '렌더링 데모';
  document.getElementById('chatHeaderAvatars').innerHTML =
    '<div class="chat-header-av" style="background:hsl(220,20%,14%);border-color:hsl(220,28%,22%);font-size:18px;display:flex;align-items:center;justify-content:center">✦</div>';
  const area = document.getElementById('chatArea');
  area.innerHTML = '';
  _showDemoSlide(area);
  const input = document.getElementById('userInput');
  if (input) { input.placeholder = 'Enter → 다음 슬라이드'; input.value = ''; input.focus(); }
}

function _showDemoSlide(area) {
  if (_demoSlideIdx >= _DEMO_SLIDES.length) {
    const el = document.createElement('div');
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">— 데모 끝 —<br><br><span style="font-size:11px;opacity:.6">진짜 채팅을 시작해봐</span></div>`;
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    document.getElementById('userInput').placeholder = '메시지를 입력하세요';
    return;
  }
  const slide = _DEMO_SLIDES[_demoSlideIdx];
  const el = document.createElement('div');
  el.className = 'msg-group ai-msgs';
  el.innerHTML = `<div class="ai-msg">
    <div class="msg-av" style="background:hsl(220,20%,14%);border-color:hsl(220,28%,22%);font-size:16px;display:flex;align-items:center;justify-content:center">✦</div>
    <div class="bubble-col">
      <div class="msg-pname" style="color:hsl(220,60%,68%)">${slide.label}</div>
      <div class="ai-bubble md-content" style="background:hsl(220,22%,10%);border:1px solid hsl(220,28%,20%);color:hsl(220,50%,88%)">${mdRender(slide.text)}</div>
    </div>
  </div>`;
  area.appendChild(el);
  renderMermaidBlocks(area);
  area.scrollTop = area.scrollHeight;
  _demoSlideIdx++;
}

async function renderChatList() {
  const list = document.getElementById('chatList');
  const empty = document.getElementById('chatEmpty');
  list.querySelectorAll('.chat-list-item').forEach(e => e.remove());
  if (!sessions.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  let sorted = [...sessions].sort((a,b) => b.updatedAt - a.updatedAt);
  if (_chatSearchQuery) {
    sorted = sorted.filter(s => {
      const name = (s.roomName || (s.participantPids||[]).map(pid=>getPersona(pid)?.name||'').join(' ')).toLowerCase();
      const preview = (s.lastPreview||'').toLowerCase();
      return name.includes(_chatSearchQuery) || preview.includes(_chatSearchQuery);
    });
  }

  for (const s of sorted) {
    const pList = (s.participantPids || []).map(pid => getPersona(pid)).filter(Boolean);
    const roomName = s.roomName || pList.map(p=>p.name).join(', ') || '채팅';

    const wrap = document.createElement('div');
    wrap.className = 'chat-list-wrap';

    const delBtn = document.createElement('div');
    delBtn.className = 'chat-delete-reveal';
    delBtn.innerHTML = '🗑';
    delBtn.onclick = () => deleteChat(s.id);
    wrap.appendChild(delBtn);

    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.onclick = () => openChat(s.id);

    const avEls = await Promise.all(pList.map(async p => {
      const neutral = await getNeutralImageThumb(p.pid);
      const imgSrc = neutral || p.image;
      const imgHTML = imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue);
      return `<div class="chat-av-item" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%)">${imgHTML}</div>`;
    }));
    const avWidth = pList.length > 0 ? (80 + (pList.length - 1) * 52) : 80;

    item.innerHTML = `
      <div class="chat-avatars-row" style="width:${avWidth}px;flex-shrink:0">${avEls.join('')}</div>
      <div class="chat-list-info">
        <div class="chat-list-names">${esc(roomName)}</div>
        <div class="chat-list-preview">${esc(s.lastPreview || '대화를 시작해봐')}</div>
      </div>
      <div class="chat-list-meta">
        <span class="chat-list-time">${timeLabel(s.updatedAt)}</span>
      </div>`;

    setupSwipeDelete(item, wrap, s.id);
    wrap.appendChild(item);
    list.appendChild(wrap);
  }
}

let _chatSearchQuery = '';
function filterChatList(q) {
  _chatSearchQuery = q.toLowerCase().trim();
  renderChatList();
}

let _selectedPersonaPid = null;
function selectPersonaForChat(pid) {
  _selectedPersonaPid = pid;
  const btn = document.getElementById('personaStartBtn');
  const bar = document.getElementById('personaStartBar');
  if (btn && bar) {
    btn.classList.add('visible');
    document.querySelectorAll('.persona-card[data-pid]').forEach(c => {
      c.style.opacity = c.dataset.pid === pid ? '1' : '0.5';
    });
  }
}
function clearPersonaSelection() {
  _selectedPersonaPid = null;
  const btn = document.getElementById('personaStartBtn');
  if (btn) btn.classList.remove('visible');
  document.querySelectorAll('.persona-card[data-pid]').forEach(c => { c.style.opacity = ''; });
}
function startChatFromPersona() {
  if (!_selectedPersonaPid) return;
  const session = {
    id: uid(), participantPids: [_selectedPersonaPid],
    roomName: '',
    responseMode: 'auto',
    worldContext: '',
    history: [], updatedAt: Date.now(), lastPreview: '', _loaded: true
  };
  sessions.push(session);
  activeChatId = session.id;
  clearPersonaSelection();
  saveIndex(); renderChatList(); openChat(session.id);
}

function setupSwipeDelete(item, wrap, id) {
  let startX = 0, startY = 0, currentX = 0, tracking = false, revealed = false;
  const REVEAL_W = 72, THRESHOLD = 40;
  const setTranslate = (x, animate = false) => {
    item.style.transition = animate ? 'transform .25s cubic-bezier(.25,.8,.25,1)' : 'none';
    item.style.transform = `translateX(${x}px)`;
  };
  const reveal = () => { revealed = true; setTranslate(-REVEAL_W, true); item.onclick = null; };
  const close  = () => { revealed = false; setTranslate(0, true); item.onclick = () => openChat(id); };

  item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true; }, { passive: true });
  item.addEventListener('touchmove', e => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX, dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 12 && Math.abs(dx) < dy) { tracking = false; return; }
    if (dx > 0 && !revealed) return;
    e.preventDefault();
    currentX = Math.max(-REVEAL_W, Math.min(0, (revealed ? -REVEAL_W : 0) + dx));
    setTranslate(currentX);
  }, { passive: false });
  item.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (revealed) { dx > THRESHOLD ? close() : reveal(); } else { dx < -THRESHOLD ? reveal() : close(); }
  });
  wrap.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchstart', e => { if (revealed && !wrap.contains(e.target)) close(); }, { passive: true });
}

function deleteChatFromDrawer() {
  if (!confirm('이 채팅방을 삭제할까? 대화 내용이 모두 사라져.')) return;
  const id = activeChatId;
  sessions = sessions.filter(s => s.id !== id);
  try { localStorage.removeItem(CACHE_SESSION_PREFIX + id); } catch(e) {}
  saveIndex(); closeDrawer(); activeChatId = null; goMain(); switchTab('chat');
}

function deleteChat(id) {
  if (!confirm('이 채팅을 삭제할까?')) return;
  sessions = sessions.filter(s => s.id !== id);
  try { localStorage.removeItem(CACHE_SESSION_PREFIX + id); } catch(e) {}
  renderChatList(); saveIndex();
}

// ══════════════════════════════
//  NEW CHAT MODAL
// ══════════════════════════════
function openNewChatModal() {
  selectedPids = []; newChatMode = 'auto';
  ['auto','all','random'].forEach(m => document.getElementById(`newMode_${m}`).classList.toggle('on', m === 'auto'));
  document.getElementById('newWorldContext').value = '';
  document.getElementById('startChatBtn').disabled = true;
  renderSelectGrid();
  document.getElementById('newChatModal').classList.add('open');
}
function closeNewChatModal() { document.getElementById('newChatModal').classList.remove('open'); }

async function renderSelectGrid() {
  const grid = document.getElementById('selectGrid');
  grid.innerHTML = '';
  for (const p of personas) {
    const card = document.createElement('div');
    card.className = 'select-card'; card.style.position = 'relative';
    card.onclick = () => toggleSelectPid(p.pid, card);
    const neutral = await getNeutralImage(p.pid);
    const imgSrc = neutral || p.image;
    card.innerHTML = `
      <div class="select-card-img">${imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue)}</div>
      <div class="select-card-name">${esc(p.name)}</div>
      <div class="check">✓</div>`;
    grid.appendChild(card);
  }
}
function toggleSelectPid(pid, card) {
  const idx = selectedPids.indexOf(pid);
  if (idx > -1) { selectedPids.splice(idx, 1); card.classList.remove('selected'); }
  else {
    if (selectedPids.length >= MAX_PARTICIPANTS) { showToast(`최대 ${MAX_PARTICIPANTS}명까지 참여 가능해`); return; }
    selectedPids.push(pid); card.classList.add('selected');
  }
  document.getElementById('startChatBtn').disabled = selectedPids.length === 0;
}
function setNewMode(m) {
  newChatMode = m;
  ['auto','all','random'].forEach(x => document.getElementById(`newMode_${x}`).classList.toggle('on', x === m));
}

function startNewChat() {
  if (!selectedPids.length) return;
  const session = {
    id: uid(), participantPids: [...selectedPids],
    roomName: document.getElementById('newRoomName')?.value.trim() || '',
    responseMode: newChatMode,
    worldContext: document.getElementById('newWorldContext').value.trim(),
    history: [], updatedAt: Date.now(), lastPreview: '', _loaded: true
  };
  sessions.push(session);
  activeChatId = session.id;
  closeNewChatModal(); saveIndex(); renderChatList(); openChat(session.id);
}

// ══════════════════════════════
//  CHAT AREA & MESSAGES
// ══════════════════════════════
async function openChat(id) {
  _isDemoMode = false;
  activeChatId = id;
  const s = getActiveSession(); if (!s) return;
  const pList = (s.participantPids || []).map(pid => getPersona(pid)).filter(Boolean);

  const avatarsEl = document.getElementById('chatHeaderAvatars');
  avatarsEl.innerHTML = pList.map(p => {
    const img = p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
    return `<div class="chat-header-av" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%);width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;">${img}</div>`;
  }).join('');
  document.getElementById('chatHeaderNames').textContent = s.roomName || pList.map(p=>p.name).join(', ');

  pList.forEach(async (p, i) => {
    const img = await getNeutralImage(p.pid); // 사각 crop 소스 호출
    if (img) {
      const avEl = avatarsEl.children[i];
      if (avEl) avEl.innerHTML = `<img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
    }
  });

  show('chatScreen');
  switchInputTab('chat');

  // 첫 번째 페르소나 기본 모델을 표시용으로만 동기화
  const modelEl = document.getElementById('chatModeSelect');
  if (modelEl) {
    const effectiveModel = pList.find(p => p.defaultModel)?.defaultModel
      || '';
    if (effectiveModel) modelEl.value = effectiveModel;
  }

  await Promise.race([
    Promise.all(pList.map(p => getNeutralImage(p.pid))),
    new Promise(r => setTimeout(r, 2000))
  ]);
  renderChatArea();

  // _loaded 안 됐으면 무조건 로드
  if (!s._loaded) {
    loadSession(id);
    return;
  }

  // KV updatedAt 비교 → 로컬보다 최신이면 강제 리프레시
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (wUrl && !s._demo) {
    fetch(wUrl + '/session/' + id)
      .then(r => r.json())
      .then(data => {
        const kvUpdatedAt = data.session?.updatedAt;
        if (kvUpdatedAt && kvUpdatedAt > (s.updatedAt || 0)) {
          loadSession(id); // 최신 내용으로 교체
        }
      })
      .catch(() => {});
  }
}

function goMain() {
  _isDemoMode = false;
  activeChatId = null;
  const input = document.getElementById('userInput');
  if (input) input.placeholder = '메시지를 입력하세요';
  show('mainScreen');
  renderChatList();
}

async function renderChatArea() {
  const session = getActiveSession(); if (!session) return;
  if (session._markdownDemo) return; // 데모는 직접 관리
  const area = document.getElementById('chatArea');
  const empty = document.getElementById('chatEmpty2');

  if (!session.history || !session.history.length) {
    [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
    empty.style.display = 'flex';
    const pList = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
    document.getElementById('emptyText').textContent = pList.map(p=>p.name).join(', ') + '에게 뭐든 던져봐';
    return;
  }
  empty.style.display = 'none';

  const fragment = document.createDocumentFragment();
  for (const msg of session.history) {
    const el = document.createElement('div');
    if (msg.role === 'user') {
  let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.find(c=>c.type==='text')?.text||'(메시지)' : '(메시지)');
  el.innerHTML = msg._rendered || `<div class="msg-group"><div class="user-msg">${fmt(text)}</div></div>`;
} else {
      const pList = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
      const renderPersonas = msg.personaSnapshot
        ? msg.personaSnapshot.map(snap => getPersona(snap.pid) || { pid:snap.pid, name:snap.name, image:null, hue:0, _ghost:true })
        : pList;
      el.innerHTML = await renderAIResponseHTML(msg.content, renderPersonas, msg._suffixes || {});
    }
    if (el.firstElementChild) fragment.appendChild(el.firstElementChild);
  }
  [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
  area.appendChild(fragment);
  renderMermaidBlocks(area);
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

function buildEmotionCard(p, emotion, letter, dataUrl) {
  const h = p.hue || 0;
  const label = letter ? `${emotion}_${letter}` : emotion;
  const imgHtml = dataUrl ? `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(h);
  
  const safePid = p.pid.replace(/'/g, "\\'");
  const safeEmotion = emotion.replace(/'/g, "\\'");
  const safeLetter = (letter || '').replace(/'/g, "\\'");
  
  const avStyle = userProfile.chatAvatarStyle || 'square';
  const avDisplay = avStyle === 'hidden' ? 'display:none;' : '';
  const avShape = avStyle === 'circle' ? 'border-radius:50%; width:min(25vw,80px); height:min(25vw,80px); aspect-ratio:1/1; max-height:80px;' : '';

  return `<div class="ai-msg" style="margin-bottom:4px">
    <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);cursor:pointer;${avDisplay}${avShape}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'','${safeLetter}')">${imgHtml}</div>
    <div class="bubble-col">
      <div class="msg-pname" style="color:hsl(${h},65%,72%);display:block">${esc(p.name)}</div>
      <div class="ai-bubble" style="background:hsl(${h},25%,13%);border:1px solid hsl(${h},32%,26%);color:hsl(${h},55%,85%);font-size:12px">${esc(label)}</div>
    </div>
  </div>`;
}


function copyBubble(btn, text) {
  const doFallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  };
  const markDone = () => {
    btn.classList.add('copied');
    btn.querySelector('svg')?.style && (btn.querySelector('svg').style.display = 'none');
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 9 7 13 15 5"/></svg>';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = btn.dataset.orig; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(markDone).catch(() => { doFallback(); markDone(); });
  } else { doFallback(); markDone(); }
}

async function renderAIResponseHTML(rawText, pList, suffixes = {}) {
  const segments = parseResponse(rawText, pList);
  let html = '';
  for (const seg of segments) {
    if (!seg.content.trim()) continue;
    const p = pList[seg.idx];
    const h = p._ghost ? 0 : p.hue;
    const opacity = p._ghost ? 'opacity:.35;' : '';
    let baseImg = avatarHTML(p);
    let thumbSrc = p.image || '';
    const suffix = suffixes[`${p.pid}:${seg.emotion}`] || '';
    const dataUrl = suffix ? await getEmotionImageSuffixed(p.pid, seg.emotion, suffix) : await getEmotionImage(p.pid, seg.emotion);
    
    if (dataUrl) { 
      baseImg = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`; 
      thumbSrc = dataUrl; 
    }
    
    const safePid = p.pid.replace(/'/g, "\\'");
    const safeEmotion = (seg.emotion||'neutral').replace(/'/g, "\\'");
    const safeSuffix = suffix.replace(/'/g, "\\'");
    const safeThumb = thumbSrc.replace(/'/g, "\\'");
    const celebStroke = p.type === 'celebrity' ? `box-shadow: inset 0 0 0 1.5px hsl(${h},70%,60%), 0 0 6px hsl(${h},60%,40%);` : '';
    
    // 설정에 따른 스타일 결정
    const avStyle = userProfile.chatAvatarStyle || 'square';
    const avDisplay = avStyle === 'hidden' ? 'display:none;' : '';
    const avShape = avStyle === 'circle' ? 'border-radius:50%; width:min(25vw,80px); height:min(25vw,80px); aspect-ratio:1/1; max-height:80px;' : '';
    
    const fmtContent = fmt(seg.content);

    // AI 생성 이미지 감지 (마크다운 ![](url) 또는 plain URL)
    const imgUrlRe = /https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|gif|webp)(?:[?#][^\s"')]*)?/gi;
    const imageUrls = [...(seg.content.matchAll(imgUrlRe))].map(m => m[0]);
    const hasImg = imageUrls.length > 0 || /<img/i.test(fmtContent);
    const bubbleWrapClass = hasImg ? 'bubble-wrap has-img' : 'bubble-wrap';
    const bubbleClass = hasImg ? 'ai-bubble md-content has-img' : 'ai-bubble md-content';

    // 클릭 → 팝업 연결 (이미지에 onclick 주입)
    let renderedContent = fmtContent;
    if (hasImg && imageUrls.length > 0) {
      renderedContent = fmtContent.replace(
        /<img([^>]*?)src="([^"]+)"([^>]*?)>/gi,
        (_, pre, src, post) =>
          `<img${pre}src="${src}"${post} onclick="openImagePopup('${src.replace(/'/g,"\\'")}')" style="cursor:pointer">`
      );
    }

    // 저장 버튼
    const dlBtn = hasImg && imageUrls.length > 0
      ? `<div class="ai-img-actions">${imageUrls.map(u=>`<button class="img-download-btn" onclick="downloadImage('${u.replace(/'/g,"\\'")}','generated.jpg')">⬇ 저장</button>`).join('')}</div>`
      : '';

    html += `<div class="ai-msg" style="${opacity}">
      <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);${celebStroke};${avDisplay}${avShape}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'${safeThumb}','${safeSuffix}')">${baseImg}</div>
      <div class="bubble-col">
        <div class="msg-pname" style="color:hsl(${h},65%,72%)">
          <span class="msg-pname-text">${esc(p.name)}${p._ghost?`<span style="font-size:9px;opacity:.5">(삭제됨)</span>`:''}</span>
          ${hasImg ? '' : `<button class="copy-btn" onclick="copyBubble(this,${JSON.stringify(seg.content)})" title="복사">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>
          </button>`}
        </div>
        <div class="${bubbleWrapClass}">
          <div class="${bubbleClass}" style="background:hsl(${h},25%,13%);border:1px solid hsl(${h},32%,26%);color:hsl(${h},55%,85%)">${renderedContent}${dlBtn}</div>
        </div>
      </div>
    </div>`;
  }
  return `<div class="msg-group ai-msgs">${html}</div>`;
}

// 콘텐츠에서 모델이 잘못 추가한 태그 제거
// [worry]...[/worry], [emotion:worry], [p_xxx]...[/p_xxx] 등
function cleanContent(text) {
  const emotionPat = EMOTIONS.join('|');
  return text
    // [emotionName]...[/emotionName] 감싸기 → 내용만 남김
    .replace(new RegExp(`\\[(${emotionPat})\\]([\\s\\S]*?)\\[\\/(${emotionPat})\\]`, 'gi'), '$2')
    // 단독 [emotionName] 또는 [/emotionName]
    .replace(new RegExp(`\\[\\/?(?:${emotionPat})\\]`, 'gi'), '')
    // [emotion:xxx] 태그
    .replace(/\[emotion:\s*\w+\s*\]/gi, '')
    // 이름: 으로 시작하는 접두어 (pid 태그 없이 이름만 붙는 경우)
    .replace(/^\s*\w+\s*:\s*/, '')
    .trim();
}

function parseResponse(text, pList) {
  const tagPattern = pList.map(p => p.pid).join('|');
  if (!tagPattern) return [{ idx:0, content:text.trim(), emotion:'neutral' }];
  const cleaned = text.replace(/\([^)]+\)\s*(?=\[)/g, '');
  
  const segRegex = new RegExp(`\\[(${tagPattern})\\]\\s*(?:\\[emotion:\\s*([a-zA-Z]+)\\s*\\])?([\\s\\S]*?)(?=\\[\\/?(?:${tagPattern})\\]|$)`, 'g');
  const parts = [];
  let m;
  while ((m = segRegex.exec(cleaned)) !== null) {
    const pid = m[1];
    const parsedEmotion = m[2] ? m[2].toLowerCase() : 'neutral';
    const emotion = EMOTIONS.includes(parsedEmotion) ? parsedEmotion : 'neutral';
    
    let content = m[3].trim();
    if (!content) continue;
    const idx = pList.findIndex(p => p.pid === pid);
    if (idx !== -1) {
      const namePrefix = new RegExp(`^${pList[idx].name}\\s*:\\s*`, 'i');
      content = content.replace(namePrefix, '').trim();
      content = cleanContent(content); // 잔여 감정태그 제거
      if (content) parts.push({ idx, content, emotion });
    }
  }
  if (!parts.length) {
    let fallback = text.replace(new RegExp(`\\[\\/?(?:${tagPattern})\\]`, 'g'), '');
    fallback = fallback.replace(/\[emotion:\s*[a-zA-Z]+\s*\]/ig, '').trim();
    fallback = cleanContent(fallback);
    parts.push({ idx: 0, content: fallback || text.trim(), emotion: 'neutral' });
  }
  return parts;
}

// ══════════════════════════════
//  INPUT BAR & SEND
// ══════════════════════════════
function setMode(m) {
  currentMode = m;
  const selectEl = document.getElementById('chatModeSelect');
  if (selectEl && selectEl.value !== m) selectEl.value = m;
}

// ══════════════════════════════
//  입력 탭 (채팅 / 이미지 / 컨텍스트)
// ══════════════════════════════
let _inputTab = 'chat'; // 현재 입력 탭

function switchInputTab(tab) {
  _inputTab = tab;
  // 탭 버튼 active 토글
  ['chat','image','context'].forEach(t => {
    document.getElementById('itab-' + t)?.classList.toggle('active', t === tab);
    const opts = document.getElementById('itab-opts-' + t);
    if (opts) opts.classList.toggle('hidden', t !== tab);
  });
  // placeholder
  const input = document.getElementById('userInput');
  if (input) {
    input.placeholder = tab === 'image' ? '이미지 생성 프롬프트...'
      : tab === 'context' ? '질문하거나 분석을 요청해봐...'
      : '메시지를 입력해봐...';
  }
  // 영역 분리 제거: 탭과 무관하게 항상 단일 chatArea 유지
}

function addContextUrl() {
  const url = prompt('URL을 입력해줘:');
  if (!url) return;
  showToast('URL 추가됨 (기능 준비중)');
}

function handleContextFile(input) {
  const files = [...input.files]; if (!files.length) return;
  showToast(`${files.length}개 파일 추가됨 (기능 준비중)`);
  input.value = '';
}
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (_isDemoMode) {
      // 데모 모드
      const input = document.getElementById('userInput');
      if (input) input.value = '';
      _showDemoSlide(document.getElementById('chatArea'));
    } else {
      sendMessage();
    }
  }
}
function autoResize(el) {
  const cleaned = sanitizeUserInputValue(el.value);
  if (cleaned !== el.value) {
    const prevPos = el.selectionStart;
    const removed = el.value.length - cleaned.length;
    el.value = cleaned;
    if (typeof prevPos === 'number' && typeof el.setSelectionRange === 'function') {
      const nextPos = Math.max(0, prevPos - removed);
      el.setSelectionRange(nextPos, nextPos);
    }
  }
  el.style.height='auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function buildSystemPrompt(session, pListOverride = null) {
  const pList = pListOverride || (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const worldPart = session.worldContext ? `${session.worldContext}\n\n` : '';
  
  const uMode = session.userProfileMode || 'default';
  let userPart = '';
  if (uMode !== 'none') {
    const u = uMode === 'custom' && session.userOverride ? session.userOverride : userProfile;
    if (u.name || u.bio) {
      userPart = `[사용자] ${u.name||'사용자'}`;
      if (u.bio) userPart += `: ${u.bio}`;
      userPart += '\n\n';
    }
  }

  const isGroup = pList.length > 1;
  const modeInstr = !isGroup ? '' :
    session.responseMode === 'all' ? '전원 응답.' :
    session.responseMode === 'random' ? '한 명만 응답.' :
    '한 명: 사실질문/단순확인. 전원: 의사결정/비교/논쟁/열린질문.';

  const personaPart = pList.map(p => {
    let desc = `[${p.pid}] 이름:${p.name}`;
    if (p.age) desc += `, 나이/생년:${p.age}`;
    if (p.bio) desc += `\n소개: ${p.bio}`;
    if (p.tags && p.tags.length) desc += `\n성격/말투: ${p.tags.join(', ')}`;
    if (p.userTitle) desc += `\n나를 부르는 호칭: ${p.userTitle} (자연스러운 맥락에서만 가끔 사용. 매 발화마다 붙이지 말 것)`;
    if (p.nicknames && p.nicknames.length) desc += `\n애칭: ${p.nicknames.join(', ')}`;
    return desc;
  }).join('\n\n');

  const formatEx = pList.map(p => `[${p.pid}][emotion:감정]내용[/${p.pid}]`).join('\n');

  return `${worldPart}${userPart}${personaPart}\n\n형식:\n${formatEx}\nemotion: ${EMOTIONS.join('/')}\n규칙: emotion 태그는 반드시 pid 태그 바로 뒤에 한 번만. 내용 안에 [감정명] 태그 절대 금지. 이름: 접두어 금지.${modeInstr ? '\n'+modeInstr : ''}\n호칭은 자연스러운 맥락에서만 가끔 사용. 매 발화 시작에 붙이지 말 것.\n필요시 태그 내용에 마크다운(표, 코드블록, 목록 등) 사용 가능.`;
}

function renderUserBubbleHTML(text, atts) {
  let html = '';
  atts.forEach(a => {
    const url = getAttachmentPreviewUrl(a);
    html += `
    <div class="bubble-img-container">
      <img class="bubble-img" src="${url}" onclick="openImagePopup('${url}')">
      <button class="img-download-btn" onclick="downloadImage('${url}', '${esc(a.name)}')">저장</button>
    </div>`;
  });
  if (text) html += fmt(text);
  return html;
}

async function sendMessage() {
  if (isLoading) return;
  const session = getActiveSession(); if (!session) return;
  const input = document.getElementById('userInput');
  const text = sanitizeUserInputValue(input.value).trim();
  if (!text && !attachments.length) return;

  const isImageReq = (_inputTab === 'image');
  const targetModel = getTargetModelForRequest(session, isImageReq);
  const historyImageUrls = attachments.filter(isImageAttachment).map(getAttachmentStoredUrl).filter(Boolean);
  const requestImageUrls = [];
  for (const attachment of attachments.filter(isImageAttachment)) {
    const imageUrl = await getAttachmentRequestUrl(attachment, targetModel, isImageReq);
    if (imageUrl) requestImageUrls.push(imageUrl);
  }
  const sentAttachments = attachments.slice();

  isLoading = true;
  document.getElementById('sendBtn').disabled = true;
  input.value = ''; input.style.height = 'auto';

  // 이미지 탭 참조 이미지는 채팅에 표시 안 함 — 텍스트 프롬프트만 보여줌
  const userHTML = renderUserBubbleHTML(text, attachments);
  
  let msgContent = text || '(파일)';
  if (attachments.length > 0) {
    msgContent = [];
    if (text) msgContent.push({ type: 'text', text: text });
    attachments.forEach(a => {
      if (a.type === 'image') {
        msgContent.push({ type: 'image_url', image_url: { url: a.dataUrl } });
      }
    });
  }

  msgContent = attachments.length > 0
    ? buildUserMessageContent(text, historyImageUrls)
    : text || '(?뚯씪)';
  const requestMsgContent = attachments.length > 0
    ? buildUserMessageContent(text, requestImageUrls)
    : text || '(?뚯씪)';

  const userMsg = { role:'user', content: msgContent, _rendered:`<div class="msg-group"><div class="user-msg">${userHTML}</div></div>` };
  session.history.push(userMsg);
  session.updatedAt = Date.now();

  // 이미지 편집용 참조 이미지: attachments 클리어 전에 미리 캡처
  const refImages = [...requestImageUrls];

  attachments = [];
  renderAttachmentPreviews();

  // imageArea는 display:none — 탭 무관하게 항상 chatArea 사용
  const area = document.getElementById('chatArea');
  document.getElementById('chatEmpty2').style.display = 'none';

  const userEl = document.createElement('div');
  userEl.innerHTML = userMsg._rendered;
  if (userEl.firstElementChild) area.appendChild(userEl.firstElementChild);

  // 로딩 플레이스홀더
  const thinkEl = document.createElement('div');
  thinkEl.className = 'thinking-bubble';
  if (isImageReq) {
    thinkEl.innerHTML = `<div class="img-gen-placeholder">
      <div class="img-gen-shimmer"></div>
      <div class="img-gen-body">
        <svg class="img-gen-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="18" width="64" height="46" rx="6" stroke="currentColor" stroke-width="2.5"/>
          <circle cx="40" cy="41" r="13" stroke="currentColor" stroke-width="2.5"/>
          <circle cx="40" cy="41" r="6" stroke="currentColor" stroke-width="2"/>
          <rect x="28" y="11" width="24" height="10" rx="3" stroke="currentColor" stroke-width="2"/>
          <circle cx="62" cy="27" r="3" fill="currentColor" opacity=".6"/>
        </svg>
        <span class="img-gen-label">이미지 생성 중</span>
        <div class="img-gen-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  } else {
    thinkEl.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  }
  area.appendChild(thinkEl);
  area.scrollTop = area.scrollHeight;

  const pListAll = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);

  if (text === '/감정') {
    thinkEl.remove();
    const personaSnapshot = pListAll.map(p=>({pid:p.pid, name:p.name}));
    let html = '<div class="msg-group ai-msgs">';

    for (const p of pListAll) {
      const keys = await getImageList(p.pid);
      if (!keys.length) {
        for (const emotion of EMOTIONS) {
          const dataUrl = await getEmotionImageSuffixed(p.pid, emotion, '') || await getNeutralImage(p.pid);
          html += buildEmotionCard(p, emotion, '', dataUrl);
        }
      } else {
        const sorted = [...keys].sort();
        for (const key of sorted) {
          const fname = key.split('/').pop().replace(/\.jpg$/i, '');
          const rest = fname.startsWith(p.pid + '_') ? fname.slice(p.pid.length + 1) : fname;
          if (!rest) continue;
          const parts = rest.split('_');
          const emotion = parts[0];
          if (!emotion) continue;
          const letter = parts[1] || '';
          const idbKey = letter ? `emotion_${p.pid}_${emotion}_${letter}` : `emotion_${p.pid}_${emotion}`;
          let dataUrl = null;
          try { dataUrl = await idbGet(idbKey); } catch(e) {}
          if (!dataUrl) dataUrl = await getEmotionImageSuffixed(p.pid, emotion, letter);
          html += buildEmotionCard(p, emotion, letter, dataUrl);
        }
      }
    }
    html += '</div>';

    const replyEl = document.createElement('div');
    replyEl.innerHTML = html;
    if (replyEl.firstElementChild) area.appendChild(replyEl.firstElementChild);
    area.scrollTop = area.scrollHeight;

    session.history.push({ role:'assistant', content:'(감정 테스트)', personaSnapshot, _suffixes: {} });
    session.lastPreview = '(감정 테스트)'; session.updatedAt = Date.now();
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    input.focus();
    if (!session._demo) { saveSession(session.id); saveIndex(); }
    renderChatList();
    await cleanupAttachmentCaches(sentAttachments);
    return;
  }

  // 백그라운드 처리를 위한 분리된 비동기 함수
  const processApiAndRender = async () => {
    let reply = '';
    if (session._demo) {
      await new Promise(r => setTimeout(r, 600));
      reply = window.getDemoReply ? window.getDemoReply(session) : '데모 응답 오류';
    } else {
      try {
        const apiMessages = [
          { role:'system', content: buildSystemPrompt(session) },
          ...session.history
            .filter(m => m.role==='user'||m.role==='assistant')
            .map(m => ({ role:m.role, content: m === userMsg ? requestMsgContent : m.content }))
        ];
        const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');

        // targetModel is resolved before we clear attachments.

        if (!isImageReq) {
          const responders = pickRespondingPersonas(session, pListAll);
          const parts = [];
          for (const persona of responders) {
            const personaImageUrls = [];
            for (const attachment of sentAttachments.filter(isImageAttachment)) {
              const imageUrl = await getAttachmentRequestUrl(attachment, getPersonaModel(persona), false);
              if (imageUrl) personaImageUrls.push(imageUrl);
            }
            const personaRequestMsgContent = sentAttachments.length > 0
              ? buildUserMessageContent(text, personaImageUrls)
              : text || '(?뚯씪)';
            const personaMessages = [
              { role:'system', content: buildSystemPrompt(session, [persona]) },
              ...session.history
                .filter(m => m.role==='user'||m.role==='assistant')
                .map(m => ({ role:m.role, content: m === userMsg ? personaRequestMsgContent : m.content }))
            ];
            const res = await fetch(wUrl + '/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: personaMessages,
                model: getPersonaModel(persona)
              })
            });
            const data = await res.json();
            if (data.result !== 'success') {
              parts.push(`[${persona.pid}]?앹꽦 ?ㅻ쪟: ${data.error||'?????녿뒗 ?ㅻ쪟'}[/${persona.pid}]`);
            } else {
              parts.push(wrapPersonaReply(persona.pid, data.reply || ''));
            }
          }
          reply = parts.join('\n');
        } else {
        const ratio = typeof _selectedRatio !== 'undefined' ? _selectedRatio : "1:1";

        // 모델별 파라미터 분기
        const RATIO_TO_OPENAI_SIZE = {
          '1:1':'1024x1024', '16:9':'1536x1024', '9:16':'1024x1536',
          '4:3':'1536x1152', '3:4':'1152x1536', '3:2':'1536x1024',
          '2:3':'1024x1536', '21:9':'1536x1024', '9:21':'1024x1536'
        };
        const isGptImg = targetModel.startsWith('gpt-image');

        let reqBody;
        if (isImageReq) {
          // 이미지 생성/편집: API는 messages 배열이 아닌 prompt 문자열 기대
          const promptText = text || '(image)';
          reqBody = {
            model: targetModel,
            prompt: promptText,
            ...(isGptImg
              ? { size: RATIO_TO_OPENAI_SIZE[ratio] || '1024x1024' }
              : { aspect_ratio: ratio }
            ),
            ...(refImages.length > 0 ? { images: refImages } : {})
          };
        } else {
          // 채팅: 기존 messages 배열
          reqBody = {
            messages: apiMessages,
            model: targetModel
          };
        }

        // 브라우저 타임아웃 없음 (Worker 30s 한계 주의)
        const res = await fetch(wUrl + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });
        const data = await res.json();
        if (data.result !== 'success') {
          const pid0 = session.participantPids?.[0] || 'p';
          reply = `[${pid0}]생성 오류: ${data.error||'알 수 없는 오류'}[/${pid0}]`;
        } else { reply = data.reply || ''; }
        }
      } catch(e) {
        const pid0 = session.participantPids?.[0] || 'p';
        reply = `[${pid0}]연결 실패: ${e.message}[/${pid0}]`;
      }
    }

    if (thinkEl.parentNode) thinkEl.remove();
    
    // 백그라운드 처리 중 세션이 유지되었는지 체크
    const currentSession = sessions.find(s => s.id === session.id);
    if (!currentSession) return;

    // 생성된 이미지가 data URL이면 R2에 업로드 후 교체
    if (isImageReq && reply.includes('data:image')) {
      const dataUrlRe = /!\[.*?\]\((data:image\/[^)]+)\)/g;
      let m;
      while ((m = dataUrlRe.exec(reply)) !== null) {
        const dataUrl = m[1];
        const fname = makeImageFilename('generated') + '.jpg';
        const r2Url = await uploadToR2(dataUrl, 'img_generated', fname).catch(() => dataUrl);
        reply = reply.replace(dataUrl, r2Url);
      }
    }

    const pList = pListAll;
    const personaSnapshot = pList.map(p=>({pid:p.pid, name:p.name}));
    const suffixes = await resolveMessageSuffixes(reply, pList);

    currentSession.history.push({ role:'assistant', content:reply, personaSnapshot, _suffixes: suffixes });

    const parsed = parseResponse(reply, pList);
    const firstContent = parsed[0]?.content || '';
    currentSession.lastPreview = firstContent.replace(/\n/g, ' ').slice(0, 120);
    currentSession.updatedAt = Date.now();

    // 사용자가 해당 채팅방을 그대로 보고 있다면 화면에 즉시 렌더링
    if (activeChatId === currentSession.id) {
      const replyEl = document.createElement('div');
      replyEl.innerHTML = await renderAIResponseHTML(reply, pList, suffixes);
      if (replyEl.firstElementChild) {
        // chatArea로 통일
        const tgtArea = document.getElementById('chatArea');
        tgtArea.appendChild(replyEl.firstElementChild);
        renderMermaidBlocks(tgtArea);
        tgtArea.scrollTop = tgtArea.scrollHeight;
      }
    }

    if (!currentSession._demo) { saveSession(currentSession.id); saveIndex(); }
    renderChatList();
    await cleanupAttachmentCaches(sentAttachments);
    
    // 완료 후 항상 락 해제 (이미지/채팅 공통)
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    setTimeout(() => input.focus(), 10);
  };

  // 이미지/채팅 모두 await — 이미지 생성 중 추가 전송 차단
  await processApiAndRender();
}

function handleFileSelect(input) {
  addFilesToAttachments(input.files, 'picker').catch(e => showToast('泥⑤? ?ㅽ뙣: ' + e.message));
  input.value = '';
  return;
  [...input.files].forEach(file => {
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      const isImg = file.type.startsWith('image/');
      let finalUrl = dataUrl;
      // 이미지는 즉시 R2에 업로드
      if (isImg) {
        const fname = makeImageFilename('uploaded') + '.jpg';
        finalUrl = await uploadToR2(dataUrl, 'img_uploaded', fname).catch(() => dataUrl);
      }
      attachments.push({ type: isImg ? 'image' : 'file', name: file.name, dataUrl: finalUrl });
      renderAttachmentPreviews();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function renderAttachmentPreviews() {
  const row = document.getElementById('attachmentsRow');
  row.innerHTML = '';
  attachments.forEach((a,i) => {
    const div = document.createElement('div'); div.className = 'attachment-thumb';
    div.innerHTML = `${a.type==='image'?`<img src="${a.dataUrl}">`:`<div style="font-size:11px;color:var(--muted);padding:4px">📄</div>`}<button class="remove-btn" onclick="removeAttachment(${i})">×</button>`;
    row.appendChild(div);
  });
}
async function removeAttachment(i) {
  const removed = attachments.splice(i,1)[0];
  if (removed?.originalCacheKey) await idbDel(removed.originalCacheKey).catch(() => {});
  renderAttachmentPreviews();
}

// ══════════════════════════════
//  SETTINGS DRAWER & PROMPT MODAL
// ══════════════════════════════
function openDrawer() {
  const s = getActiveSession(); if (!s) return;
  const el = document.getElementById('chatDrawer');
  renderDrawerBody(s); el.classList.add('open');
}
function closeDrawer() { document.getElementById('chatDrawer').classList.remove('open'); }

async function renderDrawerBody(s) {
  const body = document.getElementById('drawerBody');
  const pList = (s.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const isGroup = pList.length > 1;
  const canInvite = pList.length < MAX_PARTICIPANTS;

  const personaCards = await Promise.all(pList.map(async p => {
    const neutral = await getNeutralImage(p.pid); // 사각 crop 소스 호출
    const imgSrc = neutral || p.image;
    const imgHTML = imgSrc
      ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block">`
      : `<div style="width:100%;height:100%">${defaultAvatar(p.hue)}</div>`;
    const kickable = isGroup ? `onclick="toggleKickOverlay('${p.pid}',this)"` : '';
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
      <div id="kickWrap_${p.pid}" style="position:relative;width:60px;height:60px;border-radius:50%;overflow:hidden;border:1.5px solid hsl(${p.hue},28%,22%);cursor:${isGroup?'pointer':'default'};flex-shrink:0" ${kickable}>
        ${imgHTML}
        <div id="kickOverlay_${p.pid}" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.55);align-items:center;justify-content:center;font-size:22px">🗑</div>
      </div>
      <div style="font-size:10px;color:var(--muted);text-align:center;width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
    </div>`;
  }));

  const inviteBtn = canInvite ? `
    <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
      <div onclick="openInviteModal()" style="width:60px;height:60px;border-radius:50%;border:1.5px dashed var(--border2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .15s"
        onmouseover="this.style.borderColor='var(--muted)'" onmouseout="this.style.borderColor='var(--border2)'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div style="font-size:10px;color:var(--muted2);text-align:center">초대</div>
    </div>` : '';

  const uMode = s.userProfileMode || 'default';
  const showCustom = uMode === 'custom';

  body.innerHTML = `
    <div>
      <div class="field-label">대화방 이름</div>
      <div style="display:flex;gap:7px">
        <input class="edit-input" id="drawerRoomName" value="${esc(s.roomName||'')}" placeholder="${esc(pList.map(p=>p.name).join(', '))}" style="font-size:13px;padding:8px 12px;flex:1">
        <button onclick="saveRoomName()" style="padding:8px 14px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer;white-space:nowrap">저장</button>
      </div>
    </div>
    <div>
      <div class="field-label" style="margin-bottom:6px">이 채팅방 응답 모델</div>
      <div style="display:flex;gap:6px;align-items:center">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">${pList.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--card)"><span style="font-size:12px;color:var(--text)">${esc(p.name)}</span><span style="font-size:11px;color:var(--muted)">${esc(p.defaultModel || '미설정')}</span></div>`).join('') || `<div style="font-size:11px;color:var(--muted)">참여 중인 페르소나가 없어</div>`}</div>
        <button onclick="applyDrawerModel()" style="padding:7px 12px;border-radius:9px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">적용</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">비워두면 페르소나 기본 모델 사용</div>
    </div>
    <div>
      <div class="field-label" style="margin-bottom:8px">내 프로필</div>
      <div class="mode-btns" style="margin-bottom:${showCustom?'10px':'0'}">
        <button class="mode-btn ${uMode==='default'?'on':''}" onclick="setUserProfileMode('default')">기본 프로필</button>
        <button class="mode-btn ${uMode==='none'?'on':''}" onclick="setUserProfileMode('none')">정하지 않음</button>
        <button class="mode-btn ${uMode==='custom'?'on':''}" onclick="setUserProfileMode('custom')">직접 입력</button>
      </div>
      ${showCustom ? `
      <input type="file" id="drawerUserImgInput" style="display:none" accept="image/*" onchange="handleDrawerUserImage(this)">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border2);flex-shrink:0;cursor:pointer" onclick="document.getElementById('drawerUserImgInput').click()">
          ${getUserAvatarHTML(s)}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <input class="edit-input" id="drawerUserName" value="${esc(s.userOverride?.name||'')}" placeholder="이름" style="font-size:13px;padding:7px 10px">
          <textarea class="edit-input" id="drawerUserBio" placeholder="이 채팅방에서의 나..." style="font-size:12px;padding:7px 10px;resize:none;height:56px;border-radius:10px;line-height:1.5">${esc(s.userOverride?.bio||'')}</textarea>
        </div>
      </div>
      <button onclick="saveDrawerUserProfile()" style="width:100%;margin-top:8px;padding:8px;border-radius:9px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer">저장</button>
      ` : ''}
    </div>
    ${isGroup ? `
    <div>
      <div class="field-label">응답 방식</div>
      <div class="mode-btns">
        <button class="mode-btn ${s.responseMode==='auto'?'on':''}" onclick="setDrawerMode('auto')">🎲 상황에 맞게</button>
        <button class="mode-btn ${s.responseMode==='all'?'on':''}" onclick="setDrawerMode('all')">👥 전원</button>
        <button class="mode-btn ${s.responseMode==='random'?'on':''}" onclick="setDrawerMode('random')">🎯 무작위</button>
      </div>
    </div>` : ''}
    <div>
      <div class="field-label">세계관 / 공통 지침</div>
      <textarea class="world-input" oninput="syncWorldContext(this.value)" placeholder="모든 페르소나에게 적용할 설정이나 세계관을 입력하세요...">${esc(s.worldContext||'')}</textarea>
    </div>
    <div>
      <div class="field-label">참여 페르소나${isGroup ? ' · 탭하면 추방' : ''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${personaCards.join('')}${inviteBtn}</div>
    </div>`;
}

function toggleKickOverlay(pid, el) {
  const overlay = document.getElementById(`kickOverlay_${pid}`);
  if (!overlay) return;
  if (overlay.style.display === 'flex') {
    if (confirm(`${getPersona(pid)?.name || pid}를 추방할까?\n대화 기록은 유지돼.`)) { kickPersona(pid); } else { overlay.style.display = 'none'; }
  } else {
    document.querySelectorAll('[id^="kickOverlay_"]').forEach(o => o.style.display = 'none');
    overlay.style.display = 'flex';
  }
}

function kickPersona(pid) {
  const s = getActiveSession(); if (!s) return;
  if (s.participantPids.length <= 1) { showToast('마지막 페르소나는 추방할 수 없어'); return; }
  const p = getPersona(pid);
  if (!confirm(`${p?.name || pid}를 이 채팅방에서 추방할까?\n대화 기록은 유지돼.`)) return;
  s.participantPids = s.participantPids.filter(id => id !== pid);
  s.updatedAt = Date.now();
  saveIndex(); renderDrawerBody(s);
  
  const pList = s.participantPids.map(id => getPersona(id)).filter(Boolean);
  const avatarsEl = document.getElementById('chatHeaderAvatars');
  if (avatarsEl) {
    avatarsEl.innerHTML = pList.map(p => {
      const img = p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
      return `<div class="chat-header-av" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%);width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;">${img}</div>`;
    }).join('');
    
    pList.forEach(async (p, i) => {
      const img = await getNeutralImage(p.pid); // 사각 crop 소스 호출
      if (img) {
        const avEl = avatarsEl.children[i];
        if (avEl) avEl.innerHTML = `<img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
      }
    });
  }
  const namesEl = document.getElementById('chatHeaderNames');
  if (namesEl) namesEl.textContent = pList.map(p=>p.name).join(', ');
  showToast(`${p?.name || '페르소나'} 추방됨`);
}

function setUserProfileMode(mode) {
  const s = getActiveSession(); if (!s) return;
  s.userProfileMode = mode;
  if (mode !== 'custom') s.userOverride = null;
  saveIndex(); renderDrawerBody(s);
}

function getUserAvatarHTML(session) {
  const img = session.userOverride?.image || userProfile.image;
  return img
    ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:top">`
    : `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%"><circle cx="18" cy="14" r="7" fill="hsl(220,30%,35%)"/><ellipse cx="18" cy="30" rx="11" ry="7" fill="hsl(220,30%,28%)"/></svg>`;
}

function saveDrawerUserProfile() {
  const s = getActiveSession(); if (!s) return;
  const name = document.getElementById('drawerUserName')?.value.trim();
  const bio = document.getElementById('drawerUserBio')?.value.trim();
  const prevImg = s.userOverride?.image;
  if (!s.userOverride) s.userOverride = {};
  s.userOverride.name = name; s.userOverride.bio = bio;
  if (prevImg) s.userOverride.image = prevImg;
  saveIndex(); showToast('내 프로필 저장됨'); renderDrawerBody(s);
}

function resetDrawerUserProfile() {
  const s = getActiveSession(); if (!s) return;
  delete s.userOverride;
  saveIndex(); showToast('기본 프로필로 되돌림'); renderDrawerBody(s);
}

function handleDrawerUserImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openCropEditor(e.target.result, (cropped) => {
      const s = getActiveSession(); if (!s) return;
      if (!s.userOverride) s.userOverride = {};
      s.userOverride.image = cropped;
      saveIndex(); renderDrawerBody(s);
    });
  };
  reader.readAsDataURL(file);
}

function saveRoomName() {
  const s = getActiveSession(); if (!s) return;
  const val = document.getElementById('drawerRoomName')?.value.trim();
  s.roomName = val || '';
  saveIndex(); renderChatList(); showToast('방 이름 저장됨');
}

function openInviteModal() {
  const s = getActiveSession(); if (!s) return;
  selectedPids = []; renderInviteGrid(s);
  document.getElementById('inviteModal').classList.add('open');
}
function closeInviteModal() { document.getElementById('inviteModal').classList.remove('open'); }

async function renderInviteGrid(s) {
  const grid = document.getElementById('inviteGrid');
  grid.innerHTML = '';
  const available = personas.filter(p => !(s.participantPids||[]).includes(p.pid));
  for (const p of available) {
    const card = document.createElement('div');
    card.className = 'select-card'; card.style.position = 'relative';
    card.onclick = () => toggleInvitePid(p.pid, card, s);
    const neutral = await getNeutralImage(p.pid);
    const imgSrc = neutral || p.image;
    card.innerHTML = `
      <div class="select-card-img">${imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue)}</div>
      <div class="select-card-name">${esc(p.name)}</div>
      <div class="check" style="position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;background:var(--text);display:none;align-items:center;justify-content:center;font-size:10px">✓</div>`;
    grid.appendChild(card);
  }
  if (!available.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:13px;padding:20px">초대할 페르소나가 없어</div>`; }
  document.getElementById('inviteConfirmBtn').disabled = true;
}

function toggleInvitePid(pid, card, s) {
  const idx = selectedPids.indexOf(pid);
  const cur = (s.participantPids||[]).length + selectedPids.length;
  if (idx > -1) {
    selectedPids.splice(idx, 1); card.classList.remove('selected');
    card.querySelector('.check').style.display = 'none';
  } else {
    if (cur >= MAX_PARTICIPANTS) { showToast(`최대 ${MAX_PARTICIPANTS}명까지 가능해`); return; }
    selectedPids.push(pid); card.classList.add('selected');
    card.querySelector('.check').style.display = 'flex';
  }
  document.getElementById('inviteConfirmBtn').disabled = selectedPids.length === 0;
}

function confirmInvite() {
  const s = getActiveSession(); if (!s) return;
  s.participantPids = [...(s.participantPids||[]), ...selectedPids];
  s.updatedAt = Date.now();
  saveIndex(); closeInviteModal(); closeDrawer(); openChat(s.id); showToast(`${selectedPids.length}명 초대됨`);
}

function applyDrawerModel() {
  const s = getActiveSession(); if (!s) return;
  const pList = (s.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const effective = pList.find(p => p.defaultModel)?.defaultModel || document.getElementById('chatModeSelect')?.value || '';
  const sel = document.getElementById('chatModeSelect');
  if (sel && effective) sel.value = effective;
  showToast('이제 채팅방 공통 모델 대신 각 페르소나 기본 모델을 사용해요.');
}

function setDrawerMode(m) {
  const s = getActiveSession(); if (!s) return;
  s.responseMode = m; saveIndex(); renderDrawerBody(s);
}
function syncWorldContext(val) {
  const s = getActiveSession(); if (!s) return;
  s.worldContext = val; saveIndex();
}

function showPromptModal() {
  const s = getActiveSession(); if (!s) return;
  const prompt = buildSystemPrompt(s);
  const est = Math.round(prompt.length / 3.5);
  document.getElementById('promptModalBody').textContent = prompt;
  document.getElementById('promptTokenEst').textContent = `≈${est} 토큰`;
  document.getElementById('promptModal').classList.add('open');
  closeDrawer();
}
function closePromptModal() { document.getElementById('promptModal').classList.remove('open'); }

async function refreshChat() {
  const s = getActiveSession(); if (!s) return;
  s._loaded = false; closeDrawer(); await loadSession(s.id);
}
function resetChat() {
  const s = getActiveSession(); if (!s) return;
  if (!confirm('대화 기록을 지울까? 페르소나 설정은 유지돼.')) return;
  s.history = []; s._loaded = true; s.lastPreview = ''; s.updatedAt = Date.now();
  closeDrawer(); renderChatArea(); saveSession(s.id); saveIndex();
}
async function compressChat() {
  const s = getActiveSession(); if (!s || s.history.length < 4) { alert('압축할 대화가 부족해.'); return; }
  if (!confirm('대화를 요약 압축할까?')) return;
  const histText = s.history.map(m=>`${m.role==='user'?'사용자':'AI'}: ${typeof m.content==='string'?m.content:'(메시지)'}`).join('\n');
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) { alert('Worker URL 없음'); return; }
    const pList = (s.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
    const compressModel = s.overrideModel
      || pList.find(p=>p.defaultModel)?.defaultModel
      || document.getElementById('chatModeSelect')?.value
      || 'grok-4.20-non-reasoning-latest';
    const res = await fetch(wUrl + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: compressModel,
        messages: [
          { role:'system', content:'대화를 핵심만 남겨 간결하게 요약해줘. 한국어로.' },
          { role:'user',   content:`아래 대화를 요약해줘.\n\n${histText}` }
        ]
      })
    });
    const data = await res.json();
    if (data?.result === 'success') {
      s.history = [{ role:'assistant', content:`[이전 대화 요약]\n${data.reply}`,
        personaSnapshot:(s.participantPids||[]).map(pid=>({pid,name:getPersona(pid)?.name||pid})) }];
      s.updatedAt = Date.now(); s.lastPreview = '[압축됨]';
      closeDrawer(); renderChatArea(); saveSession(s.id); saveIndex();
    } else { alert('압축 실패: ' + (data?.error || '알 수 없는 오류')); }
  } catch(e) { alert('압축 실패: ' + e.message); }
}

// ══════════════════════════════
//  PROFILE POPUP
// ══════════════════════════════
async function openProfilePopup(pid, emotion, hue, fallbackSrc, suffix = '') {
  const popup = document.getElementById('profilePopup');
  const imgEl = document.getElementById('profilePopupImg');
  imgEl.style.borderColor = `hsl(${hue},40%,35%)`;
  imgEl.innerHTML = fallbackSrc ? `<img src="${fallbackSrc}">` : defaultAvatar(hue);
  popup.classList.add('open');

  if (!pid) return;
  const eid = emotion || 'neutral';
  const target = suffix ? `${eid}_${suffix}` : eid;

  try {
    // 1. 해당 감정의 HD 이미지 (접미사 포함)
    const hdUrl = await getEmotionImageHD(pid, eid, suffix);
    if (hdUrl && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${hdUrl}">`;
      return;
    }

    // 2. 해당 감정의 원본 전체 이미지 (em_full_)
    const full = await idbGet(`em_full_${pid}_${target}`);
    if (full && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${full}">`;
      return;
    }

    // 3. 마지막 수단: 무표정 원본
    if (eid !== 'neutral') {
      const neutralFull = await idbGet(`em_full_${pid}_neutral`);
      if (neutralFull && popup.classList.contains('open')) {
        imgEl.innerHTML = `<img src="${neutralFull}">`;
      }
    }
  } catch(e) {
    console.error('Popup image load error:', e);
  }
}

function closeProfilePopup() { document.getElementById('profilePopup').classList.remove('open'); }

// ══════════════════════════════
//  IMAGE POPUP & DOWNLOAD
// ══════════════════════════════
let _popupImgUrl = '';

function openImagePopup(url) {
  _popupImgUrl = url;
  const overlay = document.getElementById('imagePopup');
  const img = document.getElementById('popupImg');
  if (!overlay || !img) return;
  img.src = url;
  overlay.classList.add('active');
}

function closeImagePopup() {
  document.getElementById('imagePopup')?.classList.remove('active');
  _popupImgUrl = '';
}

async function downloadImage(url, filename = 'generated.jpg') {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch(e) {
    // fetch 실패(CORS 등)면 새 탭으로 열기
    window.open(url, '_blank');
  }
}

// ══════════════════════════════
//  RATIO MODAL (UI)
// ══════════════════════════════
let _selectedRatio = '1:1';

function openRatioModal() { document.getElementById('ratioModal')?.classList.add('open'); }
function closeRatioModal() { document.getElementById('ratioModal')?.classList.remove('open'); }

function toggleRatioPopup() {
  const popup = document.getElementById('ratioPopup');
  popup.classList.toggle('hidden');
}

function selectRatio(ratio) {
  _selectedRatio = ratio;
  const btn = document.getElementById('imgRatioBtn');
  if (btn) btn.textContent = ratio;
  
  // 활성화 스타일 적용
  document.querySelectorAll('#ratioPopup .ratio-item').forEach(el => {
    el.classList.toggle('active', el.textContent === ratio);
  });
  
  document.getElementById('ratioPopup').classList.add('hidden');
}

// 팝업 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  const popup = document.getElementById('ratioPopup');
  const btn = document.getElementById('imgRatioBtn');
  if (popup && !popup.contains(e.target) && btn && !btn.contains(e.target)) {
    popup.classList.add('hidden');
  }
});
