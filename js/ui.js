// ══════════════════════════════
//  UTILS (UI)
// ══════════════════════════════
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) { return esc(s).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>'); }
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
    ? `<img src="${userProfile.image}" style="width:100%;height:100%;object-fit:cover;object-position:top">`
    : `<svg viewBox="0 0 36 36" style="width:100%;height:100%"><circle cx="18" cy="14" r="7" fill="hsl(220,30%,35%)"/><ellipse cx="18" cy="30" rx="11" ry="7" fill="hsl(220,30%,28%)"/></svg>`;
  const nameEl = document.getElementById('settingsUserName');
  const bioEl = document.getElementById('settingsUserBio');
  if (nameEl) nameEl.value = userProfile.name || '';
  if (bioEl) bioEl.value = userProfile.bio || '';
  
  const tabEl = document.getElementById('settingsDefaultTab');
  if (tabEl) tabEl.value = userProfile.defaultTab || 'persona';
}

function saveSettingsUserProfile() {
  userProfile.name = document.getElementById('settingsUserName')?.value.trim() || '';
  userProfile.bio = document.getElementById('settingsUserBio')?.value.trim() || '';
  userProfile.defaultTab = document.getElementById('settingsDefaultTab')?.value || 'persona';
  saveUserProfile();
  showToast('설정 저장됨 ✓');
}

function handleSettingsUserImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openCropEditor(e.target.result, (cropped) => {
      userProfile.image = cropped;
      saveUserProfile();
      renderSettingsPane();
      idbSet('user_profile_hd', e.target.result).catch(()=>{});
    });
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════
//  PERSONA GRID
// ══════════════════════════════
async function renderPersonaGrid() {
  const COLS = 3;
  const grid = document.getElementById('personaGrid');
  grid.innerHTML = '';

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];
    const card = document.createElement('div');
    card.className = 'persona-card';
    card.dataset.pid = p.pid;
    card.draggable = true;

    const neutral = await getEmotionImageHD(p.pid, 'neutral') || await getNeutralImage(p.pid);
    const imgSrc = neutral || p.image;
    const nametagBg = `hsl(${p.hue},40%,18%)`;
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
  // celebrity 제한 제거 - 모든 페르소나 편집 가능
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
  // celebrity 제한 제거

  body.innerHTML = `
    <!-- 큰 이미지 영역 -->
    <div class="edit-big-img-wrap" onclick="document.getElementById('editImgInput').click()">
      ${neutral ? `<img src="${neutral}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block">` : defaultAvatar(p.hue)}
      <div class="edit-big-img-overlay">
        <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </div>
    </div>
    <input type="file" id="editImgInput" style="display:none" accept="image/*" onchange="handleEditImage(this)">
    <!-- 다중 이미지 업로드 (감정 이미지 등) -->
    <input type="file" id="editMultiImgInput" style="display:none" accept="image/*" multiple onchange="handleMultiImageUpload(this)">
    <button onclick="document.getElementById('editMultiImgInput').click()" style="width:100%;padding:9px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--muted);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer;margin-top:6px">
      📁 감정 이미지 일괄 업로드 (파일명 그대로 저장)
    </button>

    <!-- Identity Details 섹션 -->
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

    <!-- Personality 섹션 -->
    <div>
      <div class="edit-section-title">Personality</div>

      <div class="edit-field-label">PERSONALITY TRAITS (최대 6개)</div>
      <div class="tags-wrap">
        ${TRAIT_OPTIONS.map(t => `<div class="tag ${(p.tags||[]).includes(t)?'on':''}" onclick="toggleEditTrait('${t}',this)">${t}</div>`).join('')}
      </div>

      <div class="edit-field-label" style="margin-top:14px">COLOR</div>
      <div class="hue-swatches">
        ${HUE_PRESETS.map(h => `<div class="hue-swatch ${h===p.hue?'on':''}" style="background:hsl(${h},55%,55%)" onclick="selectEditHue(${h},this)"></div>`).join('')}
      </div>
    </div>

    <!-- Description 섹션 -->
    <div>
      <div class="edit-section-title">Description</div>
      <div class="edit-field-label">ROLE / INTRODUCTION</div>
      <textarea class="edit-textarea" id="editBio" placeholder="어떤 역할인지 짧게 적어줘" style="height:90px">${esc(p.bio)}</textarea>
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
      // 화면 즉시 반영 (cropped는 이제 화질 손실 없는 800x1200 PNG)
      const av = document.querySelector('#editBody .edit-big-img-wrap');
      if (av) av.innerHTML = `<img src="${cropped}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"><div class="edit-big-img-overlay"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;

      const p = getPersona(editingPid); if (!p) return;

      // 3단계 썸네일 생성 (full → square crop 2:3 → circle crop)
      idbSet(`em_full_${p.pid}_neutral`, cropped).catch(() => {});
      p._pendingImage = cropped;

      const { sqMd, sqHd, circSm } = await generateThumbnailSet(cropped, p.pid, 'neutral');

      // 메모리
      p.image = sqMd;
      p.neutral_md = sqMd;
      p.neutral_hd = sqHd;
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
        // 파일명에서 emotion 파싱해서 IDB 캐싱
        // 예: riley_neutral_a.jpg → emotion=neutral, letter=a
        const fname = file.name.replace(/\.jpg$/i, '');
        const namePrefix = p.pid + '_';
        if (fname.startsWith(namePrefix)) {
          const rest = fname.slice(namePrefix.length); // neutral_a 또는 neutral
          const parts = rest.split('_');
          const emotion = parts[0];
          const letter = parts[1] || '';
          // neutral이면 썸네일 생성 + _neutralCache 업데이트
          if (emotion === 'neutral') {
            const { sqMd } = await generateThumbnailSet(resized, p.pid, 'neutral').catch(() => ({ sqMd: null }));
            if (sqMd) {
              _neutralCache[p.pid] = sqMd;
              renderPersonaGrid();
            }
          } else {
            // 일반 감정 이미지 IDB 캐싱
            const idbKey = letter ? `emotion_${p.pid}_${emotion}_${letter}` : `emotion_${p.pid}_${emotion}`;
            const md = await resizeImage(resized, 300, 0.85).catch(() => null);
            if (md) idbSet(idbKey, md).catch(() => {});
          }
        }
      } else { fail++; }
    } catch(e) { fail++; }
  }
  // 파일 목록 캐시 초기화
  if (typeof _imageListCache !== 'undefined') delete _imageListCache[p.pid];
  showToast(`✓ ${ok}개 완료${fail ? ` / ${fail}개 실패` : ''}`);
  input.value = '';
}

async function savePersonaEdit() {
  const p = getPersona(editingPid); if (!p) return;
  // celebrity 저장 허용
  // PID: 신규 페르소나만 변경 가능
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
  isNewPersona = false;

  // 이미지 R2 업로드
  if (p._pendingImage) {
    showToast('⏳ 이미지 저장 중...', 5000);
    try {
      const workerUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
      if (!workerUrl) throw new Error('Worker URL 없음');
      // base64 → Blob
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
      return `<div class="chat-av-item" style="background:hsl(${p.hue},20%,11%);border-color:hsl(${p.hue},28%,22%)">${imgHTML}</div>`;
    }));
    const avWidth = pList.length > 0 ? (66 + (pList.length - 1) * 48) : 66;

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

// 선택된 페르소나 (페르소나 탭 → 채팅 시작)
let _selectedPersonaPid = null;
function selectPersonaForChat(pid) {
  _selectedPersonaPid = pid;
  const btn = document.getElementById('personaStartBtn');
  const bar = document.getElementById('personaStartBar');
  if (btn && bar) {
    btn.classList.add('visible');
    // 선택 강조
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
  gasCall({ action: 'deleteSession', sessionId: id });
  saveIndex(); closeDrawer(); activeChatId = null; goMain(); switchTab('chat');
}

function deleteChat(id) {
  if (!confirm('이 채팅을 삭제할까?')) return;
  sessions = sessions.filter(s => s.id !== id);
  try { localStorage.removeItem(CACHE_SESSION_PREFIX + id); } catch(e) {}
  gasCall({ action: 'deleteSession', sessionId: id });
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
  activeChatId = id;
  const s = getActiveSession(); if (!s) return;
  const pList = (s.participantPids || []).map(pid => getPersona(pid)).filter(Boolean);

  const avatarsEl = document.getElementById('chatHeaderAvatars');
  avatarsEl.innerHTML = pList.map(p => {
    const img = p.image ? `<img src="${p.image}">` : defaultAvatar(p.hue);
    return `<div class="chat-header-av" style="background:hsl(${p.hue},20%,11%);border-color:hsl(${p.hue},28%,22%)">${img}</div>`;
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
  // neutral 이미지 먼저 로드 (최대 2초 대기)
  await Promise.race([
    Promise.all(pList.map(p => getNeutralImage(p.pid))),
    new Promise(r => setTimeout(r, 2000))
  ]);
  renderChatArea();
  if (!s._loaded) loadSession(id);
}

function goMain() { show('mainScreen'); renderChatList(); }

async function renderChatArea() {
  const session = getActiveSession(); if (!session) return;
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
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

function buildEmotionCard(p, emotion, letter, dataUrl) {
  const h = p.hue || 0;
  const label = letter ? `${emotion}_${letter}` : emotion;
  // ...
  const safePid = p.pid.replace(/'/g, "\\'");
  const safeEmotion = emotion.replace(/'/g, "\\'");
  const safeLetter = (letter || '').replace(/'/g, "\\'");
  
  return `<div class="ai-msg" style="margin-bottom:4px">
    <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);cursor:pointer" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'','${safeLetter}')">${imgHtml}</div>
    <div class="bubble-col">
      <div class="msg-pname" style="color:hsl(${h},60%,68%);display:block">${esc(p.name)}</div>
      <div class="ai-bubble" style="background:hsl(${h},22%,10%);border:1px solid hsl(${h},28%,20%);color:hsl(${h},50%,82%);font-size:12px">${esc(label)}</div>
    </div>
  </div>`;
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
    
    html += `<div class="ai-msg" style="${opacity}">
      <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);${celebStroke}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'${safeThumb}','${safeSuffix}')">${baseImg}</div>
      <div class="bubble-col">
        <div class="msg-pname" style="color:hsl(${h},60%,68%)">${esc(p.name)}${p._ghost?`<span style="font-size:9px;opacity:.5">(삭제됨)</span>`:''}</div>
        <div class="ai-bubble" style="background:hsl(${h},22%,10%);border:1px solid hsl(${h},28%,20%);color:hsl(${h},50%,82%)">${fmt(seg.content)}</div>
      </div>
    </div>`;
  }
  return `<div class="msg-group ai-msgs">${html}</div>`;
}

function parseResponse(text, pList) {
  const tagPattern = pList.map(p => p.pid).join('|');
  if (!tagPattern) return [{ idx:0, content:text.trim(), emotion:'neutral' }];
  const cleaned = text.replace(/\([^)]+\)\s*(?=\[)/g, '');
  
  // 변경 1: 태그 사이의 공백, 콜론 뒤의 공백, 대소문자를 모두 허용하도록 정규식 수정
  const segRegex = new RegExp(`\\[(${tagPattern})\\]\\s*(?:\\[emotion:\\s*([a-zA-Z]+)\\s*\\])?([\\s\\S]*?)(?=\\[\\/?(?:${tagPattern})\\]|$)`, 'g');
  const parts = [];
  let m;
  while ((m = segRegex.exec(cleaned)) !== null) {
    const pid = m[1];
    // 변경 2: 추출된 감정 문자열을 소문자로 변환하여 EMOTIONS 배열과 비교
    const parsedEmotion = m[2] ? m[2].toLowerCase() : 'neutral';
    const emotion = EMOTIONS.includes(parsedEmotion) ? parsedEmotion : 'neutral';
    
    let content = m[3].trim();
    if (!content) continue;
    const idx = pList.findIndex(p => p.pid === pid);
    if (idx !== -1) {
      const namePrefix = new RegExp(`^${pList[idx].name}\\s*:\\s*`, 'i');
      content = content.replace(namePrefix, '').trim();
      if (content) parts.push({ idx, content, emotion });
    }
  }
  if (!parts.length) {
    let fallback = text.replace(new RegExp(`\\[\\/?(?:${tagPattern})\\]`, 'g'), '');
    // 변경 3: fallback 처리 시에도 공백과 대소문자를 무시하고 태그를 삭제하도록 정규식 수정
    fallback = fallback.replace(/\[emotion:\s*[a-zA-Z]+\s*\]/ig, '').trim();
    parts.push({ idx: 0, content: fallback || text.trim(), emotion: 'neutral' });
  }
  return parts;
}

// ══════════════════════════════
//  INPUT BAR & SEND
// ══════════════════════════════
function setMode(m) {
  currentMode = m;
  document.getElementById('modefast').classList.toggle('active', m==='fast');
  document.getElementById('modethink').classList.toggle('active', m==='think');
}
function handleKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height='auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

function buildSystemPrompt(session) {
  const pList = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
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

  // 누락되었던 변수 생성 로직 추가
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

  return `${worldPart}${userPart}${personaPart}\n\n형식:\n${formatEx}\nemotion: ${EMOTIONS.join('/')}${modeInstr ? '\n'+modeInstr : ''}\n호칭은 자연스러운 맥락에서만 가끔 사용. 매 발화 시작에 붙이지 말 것.`;
}

function renderUserBubbleHTML(text, atts) {
  let html = '';
  atts.forEach(a => { html += a.type==='image' ? `<img class="user-msg-img" src="${a.dataUrl}" alt="${esc(a.name)}">` : `<div class="user-msg-file">📄 ${esc(a.name)}</div>`; });
  if (text) html += fmt(text);
  return html;
}

async function sendMessage() {
  if (isLoading) return;
  const session = getActiveSession(); if (!session) return;
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text && !attachments.length) return;

  isLoading = true;
  document.getElementById('sendBtn').disabled = true;
  input.value = ''; input.style.height = 'auto';

  const userHTML = renderUserBubbleHTML(text, attachments);
  const userMsg = { role:'user', content: text||'(파일)', _rendered:`<div class="msg-group"><div class="user-msg">${userHTML}</div></div>` };
  session.history.push(userMsg);
  session.updatedAt = Date.now();
  attachments = [];
  renderAttachmentPreviews();

  const area = document.getElementById('chatArea');
  document.getElementById('chatEmpty2').style.display = 'none';
  const userEl = document.createElement('div');
  userEl.innerHTML = userMsg._rendered;
  if (userEl.firstElementChild) area.appendChild(userEl.firstElementChild);

  const thinkEl = document.createElement('div');
  thinkEl.className = 'thinking-bubble';
  thinkEl.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  area.appendChild(thinkEl);
  area.scrollTop = area.scrollHeight;

  let reply = '';
  const pListAll = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);

  // /감정 명령어: R2 파일 목록 기반으로 모든 변형 표시
  if (text === '/감정') {
    thinkEl.remove();
    const personaSnapshot = pListAll.map(p=>({pid:p.pid, name:p.name}));
    let html = '<div class="msg-group ai-msgs">';

    for (const p of pListAll) {
      const keys = await getImageList(p.pid);
      if (!keys.length) {
        // 파일 없으면 EMOTIONS 기본 목록으로
        for (const emotion of EMOTIONS) {
          const dataUrl = await getEmotionImageSuffixed(p.pid, emotion, '') || await getNeutralImage(p.pid);
          html += buildEmotionCard(p, emotion, '', dataUrl);
        }
      } else {
        // 파일 목록 정렬 후 전부 표시
        const sorted = [...keys].sort();
        for (const key of sorted) {
          const fname = key.split('/').pop().replace(/\.jpg$/i, '');
          const rest = fname.startsWith(p.pid + '_') ? fname.slice(p.pid.length + 1) : fname;
          if (!rest) continue; // 폴더 키 스킵
          const parts = rest.split('_');
          const emotion = parts[0];
          if (!emotion) continue; // 빈 emotion 스킵
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

    // 히스토리에는 파일명 목록으로 저장
    session.history.push({ role:'assistant', content:'(감정 테스트)', personaSnapshot, _suffixes: {} });
    session.lastPreview = '(감정 테스트)'; session.updatedAt = Date.now();
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    input.focus();
    if (!session._demo) { saveSession(session.id); saveIndex(); }
    renderChatList();
    return;
  }

  if (session._demo) {
    await new Promise(r => setTimeout(r, 600));
    reply = window.getDemoReply ? window.getDemoReply(session) : '데모 응답 오류';
  } else {
    try {
      const apiMessages = [
        { role:'system', content: buildSystemPrompt(session) },
        ...session.history
          .filter(m => m.role==='user'||m.role==='assistant')
          .map(m => ({ role:m.role, content: typeof m.content==='string' ? m.content : m.content.find?.(c=>c.type==='text')?.text||'' }))
      ];
      const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
      const res = await fetch(wUrl + '/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: apiMessages, model: 'grok-4-1-fast' })
      });
      const data = await res.json();
      if (data.result !== 'success') {
        const pid0 = session.participantPids?.[0] || 'p';
        reply = `[${pid0}]${data.error||'오류 발생'}[/${pid0}]`;
      } else { reply = data.reply || ''; }
    } catch(e) {
      const pid0 = session.participantPids?.[0] || 'p';
      reply = `[${pid0}]연결 실패: ${e.message}[/${pid0}]`;
    }
  }

  thinkEl.remove();
  const pList = pListAll;
  const personaSnapshot = pList.map(p=>({pid:p.pid, name:p.name}));

  // suffix 결정 → 메시지에 저장 (재진입 시 같은 이미지 유지)
  const suffixes = await resolveMessageSuffixes(reply, pList);
  session.history.push({ role:'assistant', content:reply, personaSnapshot, _suffixes: suffixes });

  const parsed = parseResponse(reply, pList);
  const firstContent = parsed[0]?.content || '';
  session.lastPreview = firstContent.replace(/\n/g, ' ').slice(0, 120);
  session.updatedAt = Date.now();

  const replyEl = document.createElement('div');
  replyEl.innerHTML = await renderAIResponseHTML(reply, pList, suffixes);
  if (replyEl.firstElementChild) area.appendChild(replyEl.firstElementChild);
  area.scrollTop = area.scrollHeight;

  isLoading = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();

  if (!session._demo) { saveSession(session.id); saveIndex(); }
  renderChatList();
}

function handleFileSelect(input) {
  [...input.files].forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      attachments.push({ type:file.type.startsWith('image/')?'image':'file', name:file.name, dataUrl:e.target.result });
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
function removeAttachment(i) { attachments.splice(i,1); renderAttachmentPreviews(); }

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
      return `<div class="chat-header-av" style="background:hsl(${p.hue},20%,11%);border-color:hsl(${p.hue},28%,22%);width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;">${img}</div>`;
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
    const res = await gasCall({ action:'chat', messages:[
      {role:'system',content:'대화를 핵심만 남겨 간결하게 요약해줘. 한국어로.'},
      {role:'user',content:`아래 대화를 요약해줘.\n\n${histText}`}
    ]});
    if (res?.result==='success') {
      s.history = [{role:'assistant',content:`[이전 대화 요약]\n${res.reply}`,personaSnapshot:(s.participantPids||[]).map(pid=>({pid,name:getPersona(pid)?.name||pid}))}];
      s.updatedAt = Date.now(); s.lastPreview = '[압축됨]';
      closeDrawer(); renderChatArea(); saveSession(s.id); saveIndex();
    }
  } catch(e) { alert('압축 실패'); }
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