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
let _editMultiUploadQueue = [];

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

function formatMessageTime(ts) {
  if (!ts) return '';
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date(ts));
    const pick = t => parts.find(p => p.type === t)?.value || '';
    return `${pick('year')}년 ${pick('month')}월 ${pick('day')}일 ${pick('hour')}:${pick('minute')}`;
  } catch {
    return '';
  }
}

function buildTimeMetaHTML(ts, align = 'left') {
  const label = formatMessageTime(ts);
  if (!label) return '';
  return `<div class="msg-time msg-time-${align}">${label}</div>`;
}

function encodeCopyPayload(text) {
  try {
    return btoa(unescape(encodeURIComponent(String(text || ''))));
  } catch {
    return '';
  }
}

function decodeCopyPayload(payload) {
  try {
    return decodeURIComponent(escape(atob(payload || '')));
  } catch {
    return String(payload || '');
  }
}

function buildCurrentTimeSystemMessage() {
  const now = new Date();
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  return {
    role: 'system',
    content: `Seoul time: ${text}. Use only if relevant.`
  };
}

function getChatAvatarStyle() {
  const session = getActiveSession();
  const override = session?.chatProfileOverride || null; // 'on' | 'off' | null
  const baseStyle = userProfile.chatAvatarStyle || 'square';
  if (override === 'off') return 'hidden';
  if (override === 'on') return baseStyle === 'hidden' ? 'square' : baseStyle;
  return baseStyle;
}

function iconRefreshSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
}

function iconSettingsSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
}

function iconEyeOpenSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function iconEyeClosedSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.76 21.76 0 0 1-3.17 4.56"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

function iconTrashSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
}

function iconEyeToggleSVG(showing = false) {
  return showing ? iconEyeOpenSVG() : iconEyeClosedSVG();
}

function updateChatHeaderActionButtons() {
  const btn = document.getElementById('chatProfileToggleBtn');
  if (!btn) return;
  const session = getActiveSession();
  const override = session?.chatProfileOverride || null;
  const effective = getChatAvatarStyle();
  const on = effective !== 'hidden';
  btn.classList.toggle('on', on);
  btn.innerHTML = on ? iconEyeOpenSVG() : iconEyeClosedSVG();
  btn.title = `프로필 표시 ${on ? 'ON' : 'OFF'} (클릭해서 전환)`;
  if (!override) btn.classList.remove('on');
}

function getChatHiddenFilterEnabled() {
  return !!window._showHiddenChats;
}

function updateChatListVisibilityButton() {
  const btn = document.getElementById('chatHiddenToggleBtn');
  if (!btn) return;
  const on = getChatHiddenFilterEnabled();
  btn.classList.toggle('on', on);
  btn.innerHTML = on ? iconEyeOpenSVG() : iconEyeClosedSVG();
  btn.title = on ? '숨긴 채팅 표시 중' : '숨긴 채팅 보기';
}

function toggleChatHiddenVisibility() {
  window._showHiddenChats = !getChatHiddenFilterEnabled();
  updateChatListVisibilityButton();
  renderChatList();
}

async function refreshCurrentChat() {
  const session = getActiveSession();
  if (!session || !activeChatId) return;
  if (session._demo) {
    showToast('데모 채팅은 새로고침 대상이 아니야');
    return;
  }
  await loadSession(activeChatId);
  renderChatArea();
  showToast('대화를 새로고침했어');
}

function toggleChatProfileOverride() {
  const session = getActiveSession();
  if (!session || !activeChatId) return;
  const cur = session.chatProfileOverride || null;
  session.chatProfileOverride = cur === 'off' ? 'on' : 'off';
  updateChatHeaderActionButtons();
  renderChatArea();
  saveSession(activeChatId);
  saveIndex();
}

function enhanceRenderedMessage(container) {
  if (!container) return;
  const group = container.classList?.contains('msg-group') ? container : container.querySelector?.('.msg-group');
  if (group) {
    const userMsg = group.querySelector('.user-msg');
    if (userMsg && !group.querySelector('.user-copy-btn')) {
      const btn = document.createElement('button');
      btn.className = 'copy-btn user-copy-btn';
      btn.type = 'button';
      btn.title = '복사';
      btn.dataset.copyText = encodeCopyPayload(userMsg.innerText || '');
      btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
      btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
      const wrap = document.createElement('div');
      wrap.className = 'user-msg-wrap';
      userMsg.parentNode.insertBefore(wrap, userMsg);
      wrap.appendChild(userMsg);
      wrap.appendChild(btn);
    }
    group.querySelectorAll('.msg-pname').forEach(nameRow => {
      const bubble = nameRow.parentElement?.querySelector('.ai-bubble');
      if (!bubble || bubble.querySelector('img')) return;
      const btn = nameRow.querySelector('.copy-btn') || document.createElement('button');
      if (!nameRow.querySelector('.copy-btn')) {
        btn.className = 'copy-btn';
        btn.type = 'button';
        btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
        nameRow.appendChild(btn);
      }
      btn.title = '복사';
      btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
      btn.dataset.copyText = encodeCopyPayload(bubble.innerText || '');
    });
  }
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.dataset.copyEnhanced === '1') return;
    const code = pre.querySelector('code');
    const text = code?.innerText || pre.innerText || '';
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.type = 'button';
    btn.dataset.copyText = encodeCopyPayload(text);
    btn.textContent = '복사';
    btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
    pre.classList.add('code-copy-wrap');
    pre.appendChild(btn);
    pre.dataset.copyEnhanced = '1';
  });
}

function attachMessageMeta(container, ts, align = 'left') {
  if (!container || !ts) return;
  if (container.querySelector('.msg-time')) return;
  const label = formatMessageTime(ts);
  if (!label) return;
  const cls = align === 'right' ? 'msg-time msg-time-right' : 'msg-time msg-time-left';
  if (align === 'left') {
    const leftTarget = container.querySelector('.ai-msg:last-child .bubble-col:last-child')
      || container.querySelector('.bubble-col:last-child')
      || container;
    leftTarget.insertAdjacentHTML('beforeend', `<div class="${cls}">${label}</div>`);
    return;
  }
  const rightWrap = container.querySelector('.user-msg-wrap');
  if (rightWrap) rightWrap.insertAdjacentHTML('afterend', `<div class="${cls}">${label}</div>`);
  else container.insertAdjacentHTML('beforeend', `<div class="${cls}">${label}</div>`);
}

function updateChatBottomAnchor(area = document.getElementById('chatArea')) {
  if (!area) return;
  area.querySelectorAll('.chat-bottom-anchor').forEach(el => el.classList.remove('chat-bottom-anchor'));
  const firstContent = [...area.children].find(el => el.id !== 'chatEmpty2');
  if (firstContent) firstContent.classList.add('chat-bottom-anchor');
}

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
    const selected = document.getElementById('imageModelSelect')?.value || 'grok-imagine-image-pro';
    return selected;
  }
  const pListForModel = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const targetModel = pListForModel.find(p => p.defaultModel)?.defaultModel
    || document.getElementById('chatModeSelect')?.value
    || 'grok-4.20-non-reasoning-latest';
  const sel = document.getElementById('chatModeSelect');
  if (sel && sel.value !== targetModel) sel.value = targetModel;
  return targetModel;
}

function buildChatPreviewText(text) {
  const raw = String(text || '').replace(/\n/g, ' ').trim();
  if (!raw) return '';
  if (/(^|\s)(생성 오류|연결 실패)\s*:/.test(raw) || /API Error:|NOT_FOUND|INVALID_ARGUMENT|Gemini Image Error:/i.test(raw)) {
    return '[오류] 이미지 생성 실패';
  }
  return raw.slice(0, 120);
}

function getPersonaModel(persona) {
  return persona?.defaultModel || document.getElementById('chatModeSelect')?.value || 'grok-4.20-non-reasoning-latest';
}

function sanitizeChatListPreview(text) {
  const raw = String(text || '').trim();
  if (/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/i.test(raw)) {
    return '[이미지]';
  }
  return raw;
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

function getSessionPersonas(session) {
  const seen = new Set();
  return (session?.participantPids || [])
    .filter(pid => {
      if (!pid || seen.has(pid)) return false;
      seen.add(pid);
      return true;
    })
    .map(pid => getPersona(pid))
    .filter(Boolean);
}

function wrapPersonaReply(pid, reply) {
  const text = String(reply || '').trim() || '...';
  const alreadyWrapped = new RegExp(`^\\[${pid}\\][\\s\\S]*\\[\\/${pid}\\]$`, 'i').test(text);
  if (alreadyWrapped) return text;
  return `[${pid}]${text}[/${pid}]`;
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
    originalCacheKey: null,
    uploading: !!isImg,
    uploadError: false
  };

  if (!isImg) return record;

  const cacheKey = `attachment_original_${id}`;
  record.originalCacheKey = cacheKey;
  await idbSet(cacheKey, dataUrl).catch(() => {});

  const previewUrl = await resizeImage(dataUrl, 512, 0.82).catch(() => dataUrl);
  record.previewUrl = previewUrl || dataUrl;
  record.dataUrl = record.previewUrl;
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
    if (record.type === 'image') {
      const fname = makeImageFilename('uploaded') + '.jpg';
      uploadToR2(record.previewUrl || record.dataUrl, 'img_uploaded', fname)
        .then(url => {
          record.transportUrl = url || record.transportUrl;
          record.uploading = false;
          record.uploadError = false;
          renderAttachmentPreviews();
        })
        .catch(() => {
          record.uploading = false;
          record.uploadError = true;
          renderAttachmentPreviews();
        });
    }
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
    if (e.__personaDropHandled) return;
    e.__personaDropHandled = true;
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
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
let _speechRecognition = null;
let _speechListening = false;
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

function updateMicButtonState(active) {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  btn.classList.toggle('active', !!active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.title = active ? '음성 입력 중지' : '음성 입력';
}

function stopMicInput() {
  if (_speechRecognition) {
    try { _speechRecognition.stop(); } catch(e) {}
  }
  _speechListening = false;
  updateMicButtonState(false);
}

function toggleMicInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('이 브라우저는 음성 입력을 지원하지 않습니다.');
    return;
  }
  if (_speechListening) {
    stopMicInput();
    return;
  }
  const input = document.getElementById('userInput');
  if (!input) return;

  const recognition = new SpeechRecognition();
  _speechRecognition = recognition;
  recognition.lang = 'ko-KR';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    _speechListening = true;
    updateMicButtonState(true);
    showToast('음성 입력을 듣는 중입니다.', 1200);
  };
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0]?.transcript || '';
    }
    const next = sanitizeUserInputValue(transcript).trim();
    if (!next) return;
    input.value = next;
    autoResize(input);
  };
  recognition.onerror = () => {
    _speechListening = false;
    updateMicButtonState(false);
    showToast('음성 입력을 처리하지 못했습니다.');
  };
  recognition.onend = () => {
    _speechListening = false;
    updateMicButtonState(false);
  };
  recognition.start();
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
  const src = p.neutral_md || p.image;
  return src ? `<img src="${src}">` : defaultAvatar(p.hue);
}

async function getPersonaCircleThumb(pid, emotion = 'neutral', letter = '', displayPx = 80) {
  try {
    const hit = await getEmotionCircleThumb(pid, emotion, letter, displayPx);
    if (hit) return hit;
  } catch {}
  return await getNeutralImageThumb(pid, displayPx);
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
  ensureSettingsMemoryPanel();
  renderPublicMemoryList();
  renderMemoryMeta();
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
let _suppressPersonaTapUntil = 0;
let _chatOpenToken = 0;

async function getRandomPersonaGridImage(pid) {
  const emotions = ['neutral', 'subtlesmile', 'shy', 'surprise'];
  const preferredLetters = ['a', 'b', 'c', 'd'];

  try {
    const keys = await getImageList(pid);
    const candidates = [];

    for (const key of keys || []) {
      const m = key.match(new RegExp(`^profile/${pid}/${pid}_([a-z]+)(?:_([a-z]))?\\.jpg$`, 'i'));
      if (!m) continue;
      const emotion = (m[1] || '').toLowerCase();
      const letter = (m[2] || '').toLowerCase();
      if (!emotions.includes(emotion)) continue;
      if (letter && !preferredLetters.includes(letter)) continue;
      candidates.push({ emotion, letter });
    }

    // If preferred files exist, choose one at random.
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      const img = await getEmotionImageSuffixed(pid, picked.emotion, picked.letter || '');
      if (img) return img;
    }

    // Fallback order with randomized letters a-d then base.
    const shuffledEmotions = shuffleArray(emotions);
    const shuffledLetters = shuffleArray(preferredLetters);
    for (const emotion of shuffledEmotions) {
      for (const letter of [...shuffledLetters, '']) {
        const img = await getEmotionImageSuffixed(pid, emotion, letter);
        if (img) return img;
      }
    }
  } catch (e) {}

  return null;
}

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
    card.draggable = false;

    const neutral = await getNeutralABaseImageHD(p.pid) || await idbGet(`em_full_${p.pid}_neutral_a`);

    // 새 render 호출이 이미 시작됐으면 이 루프 중단
    if (myVersion !== _personaGridRenderVersion) return;

    const imgSrc = neutral;
    const nametagBg = `hsl(${p.hue},45%,22%)`;
    const isCeleb = p.type === 'celebrity';
    const celebStroke = isCeleb ? `box-shadow: inset 0 0 0 1.5px hsl(${p.hue},70%,60%), 0 0 8px hsl(${p.hue},60%,40%);` : '';
    card.innerHTML = `
      <div class="persona-card-img" style="${celebStroke}; aspect-ratio: 1 / 3; overflow: hidden; max-height: 1000px;">
        ${imgSrc ? `<img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">` : defaultAvatar(p.hue)}
      </div>
      <div class="persona-card-name" style="background:${nametagBg}">${esc(p.name)}</div>`;

    let pointerStartX = 0, pointerStartY = 0;
    card.addEventListener('pointerdown', e => { pointerStartX = e.clientX; pointerStartY = e.clientY; });
    card.addEventListener('pointerup', e => {
      if (Date.now() < _suppressPersonaTapUntil) return;
      if (card.dataset.dragging === '1') return;
      const dx = Math.abs(e.clientX - pointerStartX);
      const dy = Math.abs(e.clientY - pointerStartY);
      if (dx < 8 && dy < 8) {
        const now = Date.now();
        const isDoubleTap = _lastPersonaTapPid === p.pid && (now - _lastPersonaTapAt) <= 320;
        _lastPersonaTapPid = p.pid;
        _lastPersonaTapAt = now;
        if (isDoubleTap) {
          openLatestOneOnOneChatForPersona(p.pid);
          return;
        }
        selectPersonaForChat(p.pid);
      }
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
  setupPersonaGridBlankTapClear(grid);
}

function setupPersonaGridBlankTapClear(grid) {
  if (grid.dataset.blankTapBound === '1') return;
  grid.dataset.blankTapBound = '1';

  grid.addEventListener('click', e => {
    if (Date.now() < _suppressPersonaTapUntil) return;
    if (e.target !== grid) return; // 카드가 아닌, 빈 공간 터치/클릭만 처리
    if (!_selectedPersonaPid) return;
    clearPersonaSelection();
  });
}

function setupTouchDrag(grid) {
  if (grid.dataset.touchDragBound === '1') return;
  grid.dataset.touchDragBound = '1';

  const LONG_PRESS_MS = 280;
  const MOVE_CANCEL_PX = 12;
  const REORDER_MS = 180;
  const getCards = () => [...grid.querySelectorAll('.persona-card[data-pid]')];
  const getAddCard = () => grid.querySelector('.persona-card.add-card');

  let holdTimer = null;
  let pressStart = null;
  let isDragging = false;
  let dragEl = null;
  let dragPid = null;
  let ghost = null;
  let slotEl = null;
  let pressType = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function setNoSelect(on) {
    document.documentElement.classList.toggle('dragging-no-select', !!on);
    document.body.classList.toggle('dragging-no-select', !!on);
    const sel = window.getSelection?.();
    if (sel && sel.type !== 'None') sel.removeAllRanges();
  }

  function clearVisuals() {
    getCards().forEach(c => {
      c.style.transition = '';
      c.style.transform = '';
      c.style.display = '';
      c.style.opacity = '';
      c.style.visibility = '';
      delete c.dataset.dragging;
    });
    if (ghost?.parentNode) ghost.parentNode.removeChild(ghost);
    if (slotEl?.parentNode) slotEl.parentNode.removeChild(slotEl);
    ghost = null;
    slotEl = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function animateGridReflow(moveFn) {
    const targets = [...getCards()];
    if (slotEl) targets.push(slotEl);
    const firstRects = new Map(targets.map(el => [el, el.getBoundingClientRect()]));
    moveFn();
    const secondTargets = [...getCards()];
    if (slotEl) secondTargets.push(slotEl);
    secondTargets.forEach(el => {
      const first = firstRects.get(el);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = `transform ${REORDER_MS}ms cubic-bezier(.22,.8,.24,1)`;
        el.style.transform = '';
      });
    });
  }

  function ensureSlot() {
    if (slotEl) return slotEl;
    slotEl = document.createElement('div');
    slotEl.className = 'persona-card drag-slot';
    const addCard = getAddCard();
    if (addCard) grid.insertBefore(slotEl, addCard);
    else grid.appendChild(slotEl);
    return slotEl;
  }

  function getInsertionReference(x, y) {
    const cards = getCards().filter(c => c !== dragEl);
    if (!cards.length) return { beforeEl: null };
    let closest = cards[0];
    let best = Infinity;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < best) {
        best = d;
        closest = card;
      }
    }
    const r = closest.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const sameRowBias = Math.abs(y - cy) <= r.height * 0.35;
    const beforeEl = sameRowBias
      ? (x < cx ? closest : closest.nextSibling)
      : (y < cy ? closest : closest.nextSibling);
    return { beforeEl };
  }

  function finishDrag(commit = true) {
    clearTimeout(holdTimer);
    holdTimer = null;
    setNoSelect(false);
    if (!isDragging) return;
    isDragging = false;

    const finalOrder = commit ? [...grid.children]
      .filter(el => el.classList?.contains('persona-card'))
      .map(el => {
        if (el === slotEl) return dragPid;
        if (el === dragEl) return null;
        return el.dataset?.pid || null;
      })
      .filter(Boolean) : null;
    clearVisuals();
    dragEl = null;
    dragPid = null;
    pressStart = null;
    pressType = null;

    if (!commit || !finalOrder) return;
    _suppressPersonaTapUntil = Date.now() + 260;
    personas.sort((a, b) => finalOrder.indexOf(a.pid) - finalOrder.indexOf(b.pid));
    savePersonas();
    renderPersonaGrid();
  }

  function beginPress(card, x, y, type) {
    if (!card || isDragging) return;
    setNoSelect(true);
    pressStart = { x, y };
    pressType = type;
    holdTimer = setTimeout(() => {
      isDragging = true;
      dragEl = card;
      dragPid = card.dataset.pid;
      card.dataset.dragging = '1';

      const rect = card.getBoundingClientRect();
      dragOffsetX = Math.max(0, Math.min(rect.width, pressStart.x - rect.left));
      dragOffsetY = Math.max(0, Math.min(rect.height, pressStart.y - rect.top));
      ghost = card.cloneNode(true);
      ghost.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 999;
        opacity: 0.95;
        pointer-events: none;
        border-radius: 14px;
        box-shadow: 0 14px 34px rgba(0,0,0,.45);
        transform: scale(1.04);
      `;
      document.body.appendChild(ghost);
      navigator.vibrate?.(20);
    }, LONG_PRESS_MS);
  }

  function movePress(x, y, preventDefaultFn = null) {
    if (!isDragging) {
      if (!pressStart) return;
      const dx = Math.abs(x - pressStart.x);
      const dy = Math.abs(y - pressStart.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
        clearTimeout(holdTimer);
        holdTimer = null;
        setNoSelect(false);
        pressStart = null;
        pressType = null;
      }
      return;
    }

    if (preventDefaultFn) preventDefaultFn();
    ghost.style.left = `${x - dragOffsetX}px`;
    ghost.style.top = `${y - dragOffsetY}px`;

    if (!slotEl) {
      ensureSlot();
      animateGridReflow(() => {
        grid.insertBefore(slotEl, dragEl);
        dragEl.style.display = 'none';
      });
    }
    const { beforeEl } = getInsertionReference(x, y);
    const currentNext = slotEl.nextSibling;
    if (beforeEl === slotEl || beforeEl === currentNext) return;
    animateGridReflow(() => {
      grid.insertBefore(slotEl, beforeEl || getAddCard());
    });
  }

  grid.addEventListener('contextmenu', e => {
    if (e.target.closest('.persona-card[data-pid]')) e.preventDefault();
  });
  grid.addEventListener('selectstart', e => {
    if (e.target.closest('.persona-card[data-pid]')) e.preventDefault();
  });
  grid.addEventListener('dragstart', e => {
    if (e.target.closest('.persona-card[data-pid]')) e.preventDefault();
  });

  grid.addEventListener('touchstart', e => {
    const card = e.target.closest('.persona-card[data-pid]');
    if (!card || !e.touches?.length) return;
    const t = e.touches[0];
    beginPress(card, t.clientX, t.clientY, 'touch');
  }, { passive: true });

  grid.addEventListener('touchmove', e => {
    if (!e.touches?.length || pressType !== 'touch') return;
    const t = e.touches[0];
    movePress(t.clientX, t.clientY, () => e.preventDefault());
  }, { passive: false });

  grid.addEventListener('touchend', () => finishDrag(true), { passive: true });
  grid.addEventListener('touchcancel', () => finishDrag(false), { passive: true });

  grid.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const card = e.target.closest('.persona-card[data-pid]');
    if (!card) return;
    beginPress(card, e.clientX, e.clientY, 'mouse');
  });

  window.addEventListener('mousemove', e => {
    if (pressType !== 'mouse') return;
    movePress(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (pressType !== 'mouse') return;
    finishDrag(true);
  });
}

// ══════════════════════════════
//  PERSONA EDIT
// ══════════════════════════════
let isNewPersona = false;

async function openPersonaEdit(pid) {
  editingPid = pid; isNewPersona = false;
  const p = getPersona(pid);
  document.getElementById('editTitle').textContent = p ? p.name || '페르소나 편집' : '새 페르소나';
    const hdImage = p ? await getEmotionImageHD(p.pid, 'neutral_a') || await idbGet(`em_full_${p.pid}_neutral_a`) : null;
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
    <div id="editMultiDropzone" class="edit-multi-dropzone" role="button" tabindex="0" onclick="document.getElementById('editMultiImgInput').click()">
      <div class="edit-multi-dropzone-icon">
        <svg viewBox="0 0 24 24"><path d="M12 16V6"/><path d="M8.5 9.5L12 6l3.5 3.5"/><path d="M20 16.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5"/><path d="M7 12.5a4 4 0 0 1 7.4-2.1A3.5 3.5 0 1 1 17 17"/></svg>
      </div>
      <div class="edit-multi-dropzone-title">감정 이미지 여러 장 업로드</div>
      <div class="edit-multi-dropzone-sub">파일을 드래그해서 놓거나 클릭해 선택</div>
    </div>
    <div id="editMultiUploadList" class="edit-upload-list"></div>

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
  _editMultiUploadQueue = [];
  renderEditMultiUploadList();
  initEditMultiDropzone();
  ensureEditPrivateMemoryPanel(p.pid);
  renderPrivateMemoryList(p.pid);
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
      idbSet(`em_full_${p.pid}_neutral_a`, cropped).catch(() => {});
      p._pendingImage = cropped;

      const { sqMd, fullHd, avatarPng } = await generateThumbnailSet(cropped, p.pid, 'neutral_a');

      // 메모리
      p.image = sqMd;
      p.neutral_md = sqMd;
      p.neutral_hd = fullHd;
      p.neutral_thumb = avatarPng;
      _neutralCache[p.pid] = sqMd;

      showToast('이미지 선택됨 — 저장 버튼을 눌러줘');
    });
  };
  reader.readAsDataURL(file);
}

async function handleMultiImageUpload(input) {
  const files = [...(input?.files || [])];
  if (!files.length) return;
  await handleMultiImageFiles(files);
  if (input) input.value = '';
  return;
  const p = getPersona(editingPid); if (!p) return;
  const filesLegacy = [...input.files]; if (!filesLegacy.length) return;
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
            const { sqMd } = await generateThumbnailSet(resized, p.pid, 'neutral_a').catch(() => ({ sqMd: null }));
            if (sqMd) {
              _neutralCache[p.pid] = sqMd;
              renderPersonaGrid();
            }
          } else {
            const emotionKey = letter ? `${emotion}_${letter}` : emotion;
            await generateThumbnailSet(resized, p.pid, emotionKey).catch(() => {});
          }
        }
      } else { fail++; }
    } catch(e) { fail++; }
  }
  if (typeof _imageListCache !== 'undefined') delete _imageListCache[p.pid];
  showToast(`✓ ${ok}개 완료${fail ? ` / ${fail}개 실패` : ''}`);
  input.value = '';
}

function renderEditMultiUploadList() {
  const list = document.getElementById('editMultiUploadList');
  if (!list) return;
  if (!_editMultiUploadQueue.length) {
    list.innerHTML = '';
    list.style.display = 'none';
    return;
  }
  list.style.display = 'grid';
  list.innerHTML = _editMultiUploadQueue.map(item => {
    const thumb = item.preview
      ? `<img src="${item.preview}" alt="${esc(item.name || 'upload')}">`
      : `<div class="edit-upload-file">${esc((item.name || '').slice(0, 12) || 'file')}</div>`;
    const stateClass = item.status === 'done' ? 'is-done' : (item.status === 'fail' ? 'is-fail' : 'is-uploading');
    const stateBadge = item.status === 'done'
      ? `<div class="edit-upload-state done">완료</div>`
      : item.status === 'fail'
        ? `<div class="edit-upload-state fail">실패</div>`
        : `<div class="edit-upload-state"><div class="attachment-spinner"></div></div>`;
    return `<div class="edit-upload-thumb ${stateClass}">${thumb}${stateBadge}</div>`;
  }).join('');
}

function initEditMultiDropzone_legacy() {
  const zone = document.getElementById('editMultiDropzone');
  const input = document.getElementById('editMultiImgInput');
  if (!zone || !input || zone.dataset.bound === '1') return;
  zone.dataset.bound = '1';

  let dragDepth = 0;
  const mark = (on) => zone.classList.toggle('dragover', !!on);
  const hasImageFiles = (dt) => {
    const files = [...(dt?.files || [])];
    if (files.some(f => (f?.type || '').startsWith('image/'))) return true;
    const items = [...(dt?.items || [])];
    return items.some(it => it.kind === 'file' && (it.type || '').startsWith('image/'));
  };

  zone.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    input.click();
  });

  zone.addEventListener('dragenter', e => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth++;
    mark(true);
  });

  zone.addEventListener('dragover', e => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    mark(true);
  });

  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) mark(false);
  });

  zone.addEventListener('drop', async e => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    mark(false);
    const files = [...(e.dataTransfer?.files || [])].filter(f => (f?.type || '').startsWith('image/'));
    if (!files.length) {
      showToast('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    if (!files.length) {
      showToast('이미지 파일만 업로드할 수 있어');
      return;
    }
    await handleMultiImageFiles(files);
  });
}

async function handleMultiImageFiles_legacy(fileList) {
  const p = getPersona(editingPid); if (!p) return;
  const files = [...(fileList || [])].filter(f => (f?.type || '').startsWith('image/'));
  if (!files.length) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) { alert('Worker URL ?놁쓬'); return; }

  showToast(`??${files.length}媛??낅줈??以?..`, 10000);
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
            const { sqMd } = await generateThumbnailSet(resized, p.pid, 'neutral_a').catch(() => ({ sqMd: null }));
            if (sqMd) {
              _neutralCache[p.pid] = sqMd;
              renderPersonaGrid();
            }
          } else {
            const emotionKey = letter ? `${emotion}_${letter}` : emotion;
            await generateThumbnailSet(resized, p.pid, emotionKey).catch(() => {});
          }
        }
      } else { fail++; }
    } catch(e) { fail++; }
  }
  if (typeof _imageListCache !== 'undefined') delete _imageListCache[p.pid];
  showToast(`??${ok}媛??꾨즺${fail ? ` / ${fail}媛??ㅽ뙣` : ''}`);
}

function initEditMultiDropzone() {
  const zone = document.getElementById('editMultiDropzone');
  const input = document.getElementById('editMultiImgInput');
  if (!zone || !input || zone.dataset.bound === '1') return;
  zone.dataset.bound = '1';

  let dragDepth = 0;
  const mark = (on) => zone.classList.toggle('dragover', !!on);
  const hasImageFiles = (dt) => {
    const files = [...(dt?.files || [])];
    if (files.some(f => (f?.type || '').startsWith('image/'))) return true;
    const items = [...(dt?.items || [])];
    return items.some(it => it.kind === 'file' && (it.type || '').startsWith('image/'));
  };

  zone.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    input.click();
  });

  zone.addEventListener('dragenter', e => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth++;
    mark(true);
  });

  zone.addEventListener('dragover', e => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    mark(true);
  });

  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) mark(false);
  });

  zone.addEventListener('drop', async e => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    mark(false);
    const files = [...(e.dataTransfer?.files || [])].filter(f => (f?.type || '').startsWith('image/'));
    if (!files.length) {
      showToast('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    await handleMultiImageFiles(files);
  });
}

async function handleMultiImageFiles(fileList) {
  const p = getPersona(editingPid); if (!p) return;
  const files = [...(fileList || [])].filter(f => (f?.type || '').startsWith('image/'));
  if (!files.length) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) { alert('Worker URL 없음'); return; }

  _editMultiUploadQueue = files.map((file, idx) => ({
    id: `upload_${Date.now()}_${idx}`,
    name: file.name,
    preview: URL.createObjectURL(file),
    status: 'uploading'
  }));
  renderEditMultiUploadList();
  showToast(`이미지 ${files.length}장 업로드 시작`);

  let ok = 0, fail = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const queueItem = _editMultiUploadQueue[i];
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        ok++;
        const fname = file.name.replace(/\.jpg$/i, '');
        const namePrefix = p.pid + '_';
        if (fname.startsWith(namePrefix)) {
          const rest = fname.slice(namePrefix.length);
          const parts = rest.split('_');
          const emotion = parts[0];
          const letter = parts[1] || '';
          if (emotion === 'neutral') {
            const { sqMd } = await generateThumbnailSet(resized, p.pid, 'neutral_a').catch(() => ({ sqMd: null }));
            if (sqMd) {
              _neutralCache[p.pid] = sqMd;
              renderPersonaGrid();
            }
          } else {
            const emotionKey = letter ? `${emotion}_${letter}` : emotion;
            await generateThumbnailSet(resized, p.pid, emotionKey).catch(() => {});
          }
        }
        if (queueItem) queueItem.status = 'done';
      } else {
        fail++;
        if (queueItem) queueItem.status = 'fail';
      }
    } catch (e) {
      fail++;
      if (queueItem) queueItem.status = 'fail';
    }
    renderEditMultiUploadList();
  }
  if (typeof _imageListCache !== 'undefined') delete _imageListCache[p.pid];
  showToast(`업로드 완료: ${ok}장${fail ? `, 실패 ${fail}장` : ''}`);
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
      const fname = `${p.pid}_neutral_a.jpg`;
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
  list.querySelectorAll('.chat-list-wrap').forEach(e => e.remove());
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
  if (!getChatHiddenFilterEnabled()) {
    sorted = sorted.filter(s => !s.hidden);
  }

  for (const s of sorted) {
    const pList = (s.participantPids || []).map(pid => getPersona(pid)).filter(Boolean);
    const roomName = s.roomName || pList.map(p=>p.name).join(', ') || '채팅';

    const wrap = document.createElement('div');
    wrap.className = 'chat-list-wrap';

    const hideBtn = document.createElement('div');
    hideBtn.className = 'chat-hide-reveal';
    hideBtn.innerHTML = s.hidden ? iconEyeOpenSVG() : iconEyeClosedSVG();
    hideBtn.onclick = () => toggleChatHidden(s.id);
    wrap.appendChild(hideBtn);

    const delBtn = document.createElement('div');
    delBtn.className = 'chat-delete-reveal';
    delBtn.innerHTML = iconTrashSVG();
    delBtn.onclick = () => deleteChat(s.id);
    wrap.appendChild(delBtn);

    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.onclick = () => openChat(s.id);

    const avEls = await Promise.all(pList.map(async p => {
      const neutral = await getNeutralImageThumb(p.pid, 80);
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
  updateChatListVisibilityButton();
}

let _chatSearchQuery = '';
function filterChatList(q) {
  _chatSearchQuery = q.toLowerCase().trim();
  renderChatList();
}

function closeRestoreModal() {
  const modal = document.getElementById('restoreModal');
  if (modal) modal.classList.remove('open');
}

async function openRestoreModal() {
  const modal = document.getElementById('restoreModal');
  if (!modal) return;
  modal.classList.add('open');
  await renderRestoreList();
}

async function renderRestoreList() {
  const wrap = document.getElementById('restoreList');
  if (!wrap) return;
  wrap.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 2px">불러오는 중...</div>`;
  const deleted = await listDeletedSessionsRemote();
  const sorted = [...deleted].sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
  if (!sorted.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 2px">복원 가능한 채팅이 없습니다.</div>`;
    return;
  }
  wrap.innerHTML = sorted.map(s => {
    const names = (s.roomName || (s.participantPids || []).map(pid => getPersona(pid)?.name || '').filter(Boolean).join(', ') || '채팅');
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border2);border-radius:10px;background:var(--card)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(names)}</div>
          <div style="font-size:11px;color:var(--muted)">발견: ${timeLabel(s.deletedAt || s.updatedAt || Date.now())}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="restoreDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border2);background:transparent;color:var(--text);font-size:12px;cursor:pointer">강제복구</button>
          <button onclick="purgeDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid hsl(0,30%,24%);background:hsl(0,20%,12%);color:hsl(0,70%,68%);font-size:12px;cursor:pointer">영구삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

async function restoreDeletedChat(id) {
  if (!id) return;
  const res = await restoreDeletedSessionRemote(id);
  if (!res?.ok) {
    showToast('채팅 복원 실패');
    return;
  }
  await loadIndex();
  await renderRestoreList();
  renderChatList();
  showToast('채팅이 복원되었습니다.');
}

async function purgeDeletedChat(id) {
  if (!id) return;
  if (!confirm('이 채팅 찌꺼기를 KV에서 영구삭제할까요? 복구할 수 없습니다.')) return;
  const res = await purgeSessionRemote(id);
  if (!res?.ok) {
    showToast('영구삭제 실패');
    return;
  }
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await renderRestoreList();
  renderChatList();
  showToast('KV에서 영구삭제했습니다.');
}

let _selectedPersonaPid = null;
let _lastPersonaTapPid = null;
let _lastPersonaTapAt = 0;

function findLatestOneOnOneSessionForPid(pid) {
  if (!pid) return null;
  const candidates = (sessions || []).filter((s) =>
    !s?._demo &&
    Array.isArray(s?.participantPids) &&
    s.participantPids.length === 1 &&
    s.participantPids[0] === pid,
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return candidates[0] || null;
}

function openLatestOneOnOneChatForPersona(pid) {
  const target = findLatestOneOnOneSessionForPid(pid);
  if (target?.id) {
    clearPersonaSelection();
    switchTab('chat');
    openChat(target.id);
    return;
  }
  _selectedPersonaPid = pid;
  startChatFromPersona();
}

function ensurePersonaActionButtons() {
  const bar = document.getElementById('personaStartBar');
  const startBtn = document.getElementById('personaStartBtn');
  if (!bar || !startBtn) return { bar, startBtn, editBtn: null };

  let actions = document.getElementById('personaStartActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'personaStartActions';
    actions.className = 'persona-start-actions';
    if (startBtn.parentElement === bar) {
      bar.appendChild(actions);
      actions.appendChild(startBtn);
    } else {
      actions.appendChild(startBtn);
      bar.appendChild(actions);
    }
  }

  let editBtn = document.getElementById('personaEditBtn');
  if (!editBtn) {
    editBtn = document.createElement('button');
    editBtn.id = 'personaEditBtn';
    editBtn.className = 'persona-start-chat-btn secondary';
    editBtn.type = 'button';
    editBtn.textContent = '페르소나 수정';
    editBtn.onclick = () => editSelectedPersona();
    actions.appendChild(editBtn);
  } else if (editBtn.parentElement !== actions) {
    actions.appendChild(editBtn);
  }

  return { bar, startBtn, editBtn };
}

function selectPersonaForChat(pid) {
  _selectedPersonaPid = pid;
  const { bar, startBtn: newBtn, editBtn } = ensurePersonaActionButtons();
  if (bar) bar.classList.add('visible');
  if (newBtn) newBtn.classList.add('visible');
  if (editBtn) editBtn.classList.add('visible');
  const p = getPersona(pid);
  if (newBtn) newBtn.textContent = p?.name ? `${p.name} 새 채팅` : '새 채팅';
  document.querySelectorAll('.persona-card[data-pid]').forEach(c => {
    c.style.opacity = c.dataset.pid === pid ? '1' : '0.5';
  });
}
function clearPersonaSelection() {
  _selectedPersonaPid = null;
  const bar = document.getElementById('personaStartBar');
  const newBtn = document.getElementById('personaStartBtn');
  const editBtn = document.getElementById('personaEditBtn');
  if (bar) bar.classList.remove('visible');
  if (newBtn) newBtn.classList.remove('visible');
  if (editBtn) editBtn.classList.remove('visible');
  document.querySelectorAll('.persona-card[data-pid]').forEach(c => { c.style.opacity = ''; });
}

function editSelectedPersona() {
  if (!_selectedPersonaPid) return;
  openPersonaEdit(_selectedPersonaPid);
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

function isEditableElement(el) {
  if (!el) return false;
  const tag = String(el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable;
}

function handleEscBackNavigation(event) {
  if (!event || event.key !== 'Escape') return;
  if (isEditableElement(event.target)) return;

  const imagePopup = document.getElementById('imagePopup');
  if (imagePopup?.classList.contains('active')) {
    closeImagePopup();
    event.preventDefault();
    return;
  }

  const closers = [
    ['chatDrawer', closeDrawer],
    ['promptModal', closePromptModal],
    ['inviteModal', closeInviteModal],
    ['restoreModal', closeRestoreModal],
    ['newChatModal', closeNewChatModal],
    ['ratioModal', closeRatioModal],
    ['profilePopup', closeProfilePopup],
  ];
  for (const [id, fn] of closers) {
    const el = document.getElementById(id);
    if (el?.classList.contains('open')) {
      fn();
      event.preventDefault();
      return;
    }
  }

  const cropOverlay = document.getElementById('cropOverlay');
  if (cropOverlay?.classList.contains('open') && typeof closeCropEditor === 'function') {
    closeCropEditor();
    event.preventDefault();
    return;
  }
  const cropOverlayAvatar = document.getElementById('cropOverlayAvatar');
  if (cropOverlayAvatar?.classList.contains('open') && typeof closeAvatarCropEditor === 'function') {
    closeAvatarCropEditor();
    event.preventDefault();
    return;
  }

  const editScreen = document.getElementById('editScreen');
  if (editScreen?.classList.contains('active')) {
    goMain();
    event.preventDefault();
    return;
  }

  const chatScreen = document.getElementById('chatScreen');
  if (chatScreen?.classList.contains('active')) {
    goMain();
    event.preventDefault();
    return;
  }

  if (activeTab !== 'persona') {
    switchTab('persona');
    event.preventDefault();
    return;
  }

  if (_selectedPersonaPid) {
    clearPersonaSelection();
    event.preventDefault();
  }
}

function ensureGlobalEscHandler() {
  if (window.__personaEscBound) return;
  window.__personaEscBound = true;
  document.addEventListener('keydown', handleEscBackNavigation);
}

ensureGlobalEscHandler();

function setupSwipeDelete(item, wrap, id) {
  let startX = 0, startY = 0, currentX = 0, tracking = false, revealed = false;
  const REVEAL_W = 144, THRESHOLD = 40;
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

async function deleteChatFromDrawer() {
  if (!confirm('이 채팅방을 삭제할까? 대화 내용이 모두 사라져.')) return;
  const id = activeChatId;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('채팅을 휴지통으로 이동했습니다.');
  saveIndex(); closeDrawer(); activeChatId = null; goMain(); switchTab('chat');
}

async function deleteChat(id) {
  if (!confirm('이 채팅을 삭제할까?')) return;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('채팅을 휴지통으로 이동했습니다.');
  renderChatList(); saveIndex();
}

async function toggleChatHidden(id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  s.hidden = !s.hidden;
  s.updatedAt = Date.now();
  saveSession(id);
  saveIndex();
  await renderChatList();
  showToast(s.hidden ? '채팅을 숨겼어요.' : '채팅을 다시 보이게 했어요.');
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
  const openToken = ++_chatOpenToken;
  const s = getActiveSession(); if (!s) return;
  const pList = getSessionPersonas(s);
  const area = document.getElementById('chatArea');
  const empty = document.getElementById('chatEmpty2');
  if (area) {
    area.classList.remove('has-messages');
    [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
    area.scrollTop = 0;
  }
  if (empty) empty.style.display = 'flex';

  const avatarsEl = document.getElementById('chatHeaderAvatars');
  avatarsEl.innerHTML = pList.map(p => {
    const img = p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
    return `<div class="chat-header-av" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%);width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;">${img}</div>`;
  }).join('');
  document.getElementById('chatHeaderNames').textContent = s.roomName || pList.map(p=>p.name).join(', ');
  const actionsEl = document.querySelector('.chat-header-actions');
  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="chat-action-btn" id="chatProfileToggleBtn" onclick="toggleChatProfileOverride()" title="Profile on/off">${iconEyeOpenSVG()}</button>
      <button class="chat-action-btn" id="chatRefreshBtn" onclick="refreshCurrentChat()" title="Refresh">${iconRefreshSVG()}</button>
      <button class="chat-settings-btn" onclick="openDrawer()" title="Settings">${iconSettingsSVG()}</button>
    `;
  }
  updateChatHeaderActionButtons();

  pList.forEach(async (p, i) => {
    if (openToken !== _chatOpenToken || activeChatId !== id) return;
    const img = await getNeutralImageThumb(p.pid, 42);
    if (openToken !== _chatOpenToken || activeChatId !== id) return;
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
    Promise.all(pList.map(p => getNeutralImageThumb(p.pid, 42))),
    new Promise(r => setTimeout(r, 2000))
  ]);
  if (openToken !== _chatOpenToken || activeChatId !== id) return;
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
  const renderSessionId = session.id;
  if (session._markdownDemo) return; // 데모는 직접 관리
  const area = document.getElementById('chatArea');
  const empty = document.getElementById('chatEmpty2');

  if (!session.history || !session.history.length) {
    area.classList.remove('has-messages');
    [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
    empty.style.display = 'flex';
    const pList = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
    document.getElementById('emptyText').textContent = pList.map(p=>p.name).join(', ') + '에게 뭐든 던져봐';
    return;
  }
  area.classList.add('has-messages');
  empty.style.display = 'none';

  const fragment = document.createDocumentFragment();
  for (const msg of session.history) {
    const el = document.createElement('div');
    if (msg.role === 'user') {
  let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.find(c=>c.type==='text')?.text||'(메시지)' : '(메시지)');
  el.innerHTML = msg._rendered || `<div class="msg-group"><div class="user-msg">${fmt(text)}</div></div>`;
} else {
      const pList = getSessionPersonas(session);
      const renderPersonas = msg.personaSnapshot
        ? msg.personaSnapshot.map(snap => getPersona(snap.pid) || { pid:snap.pid, name:snap.name, image:null, hue:0, _ghost:true })
        : pList;
      el.innerHTML = await renderAIResponseHTML(msg.content, renderPersonas, msg._suffixes || {});
    }
    if (activeChatId !== renderSessionId) return;
    if (el.firstElementChild) {
      enhanceRenderedMessage(el.firstElementChild);
      attachMessageMeta(el.firstElementChild, msg.createdAt, msg.role === 'user' ? 'right' : 'left');
      fragment.appendChild(el.firstElementChild);
    }
  }
  if (activeChatId !== renderSessionId) return;
  [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
  area.appendChild(fragment);
  updateChatBottomAnchor(area);
  renderMermaidBlocks(area);
  area.querySelectorAll('.msg-group').forEach(enhanceRenderedMessage);
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

function buildEmotionCard(p, emotion, letter, dataUrl) {
  const h = p.hue || 0;
  const label = letter ? `${emotion}_${letter}` : emotion;
  const imgHtml = dataUrl ? `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(h);
  
  const safePid = p.pid.replace(/'/g, "\\'");
  const safeEmotion = emotion.replace(/'/g, "\\'");
  const safeLetter = (letter || '').replace(/'/g, "\\'");
  
  const avStyle = getChatAvatarStyle();
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


function copyBubble(btn, text, encoded = false) {
  const plainText = encoded ? decodeCopyPayload(text) : String(text || '');
  const doFallback = () => {
    const ta = document.createElement('textarea');
    ta.value = plainText; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  };
  const markDone = () => {
    btn.classList.add('copied');
    btn.querySelector('svg')?.style && (btn.querySelector('svg').style.display = 'none');
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 9 7 13 15 5"/></svg>';
    showToast('클립보드에 복사됐습니다', 1200);
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = btn.dataset.orig; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(plainText).then(markDone).catch(() => { doFallback(); markDone(); });
  } else { doFallback(); markDone(); }
}

async function renderAIResponseHTML(rawText, pList, suffixes = {}, createdAt = null) {
  const segments = parseResponse(rawText, pList);
  let html = '';
  for (const seg of segments) {
    if (!seg.content.trim()) continue;
    const p = pList[seg.idx];
    const h = p._ghost ? 0 : p.hue;
    const opacity = p._ghost ? 'opacity:.35;' : '';
    const avStyle = getChatAvatarStyle();
    const rectDisplayPx = 200;
    const circleDisplayPx = 80;
    let baseImg = avatarHTML(p);
    let thumbSrc = p.neutral_thumb || p.image || '';
    const suffix = suffixes[`${p.pid}:${seg.emotion}`] || '';
    const dataUrl = avStyle !== 'circle'
      ? (suffix
        ? await getEmotionImageSuffixed(p.pid, seg.emotion, suffix, rectDisplayPx)
        : await getEmotionImage(p.pid, seg.emotion, rectDisplayPx))
      : null;
    const circleThumb = await getPersonaCircleThumb(p.pid, seg.emotion, suffix, circleDisplayPx);
    
    if (dataUrl) { 
      baseImg = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`; 
      thumbSrc = dataUrl; 
    }
    if (circleThumb) thumbSrc = circleThumb;
    
    const safePid = p.pid.replace(/'/g, "\\'");
    const safeEmotion = (seg.emotion||'neutral').replace(/'/g, "\\'");
    const safeSuffix = suffix.replace(/'/g, "\\'");
    const safeThumb = thumbSrc.replace(/'/g, "\\'");
    const celebStroke = p.type === 'celebrity' ? `box-shadow: inset 0 0 0 1.5px hsl(${h},70%,60%), 0 0 6px hsl(${h},60%,40%);` : '';
    
    // 설정에 따른 스타일 결정
    const avDisplay = avStyle === 'hidden' ? 'display:none;' : '';
    const avShape = avStyle === 'circle' ? 'border-radius:50%; width:min(25vw,80px); height:min(25vw,80px); aspect-ratio:1/1; max-height:80px;' : '';
    if (avStyle === 'circle' && circleThumb) {
      baseImg = `<img src="${circleThumb}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
    }
    
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

    html += `<div class="ai-msg ${hasImg ? 'ai-msg-img' : 'ai-msg-text'}" style="${opacity}">
      <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);${celebStroke};${avDisplay}${avShape}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'${safeThumb}','${safeSuffix}')">${baseImg}</div>
      <div class="bubble-col">
        <div class="msg-pname" style="color:hsl(${h},65%,72%)">
          <span class="msg-pname-text">${esc(p.name)}${p._ghost?`<span style="font-size:9px;opacity:.5">(삭제됨)</span>`:''}</span>
          ${hasImg ? '' : `<button class="copy-btn" type="button" title="복사">
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

async function appendAIReplySequentially(reply, pList, suffixes, createdAt, tgtArea, renderSessionId) {
  const segments = parseResponse(reply, pList);
  const delays = segments.length > 1 ? 240 : 0;
  for (let i = 0; i < segments.length; i++) {
    if (_chatGeneration?.cancelled || activeChatId !== renderSessionId) return;
    const seg = segments[i];
    const segText = seg?.content?.trim?.() ? seg.content : '';
    if (!segText) continue;
    const p = pList[seg.idx] || pList[0];
    if (!p) continue;
    const segReply = `[${p.pid}][emotion:${seg.emotion || 'neutral'}]${segText}[/${p.pid}]`;
    const html = await renderAIResponseHTML(segReply, [p], suffixes, createdAt);
    if (_chatGeneration?.cancelled || activeChatId !== renderSessionId) return;
    const replyEl = document.createElement('div');
    replyEl.innerHTML = html;
    if (replyEl.firstElementChild) {
      replyEl.firstElementChild.classList.add('msg-enter');
      enhanceRenderedMessage(replyEl.firstElementChild);
      attachMessageMeta(replyEl.firstElementChild, createdAt, 'left');
      tgtArea.appendChild(replyEl.firstElementChild);
      updateChatBottomAnchor(tgtArea);
      renderMermaidBlocks(tgtArea);
      tgtArea.scrollTop = tgtArea.scrollHeight;
    }
    if (delays && i < segments.length - 1) await sleep(delays);
  }
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
    const pidWrapRe = new RegExp(`^\\[${pid}\\]([\\s\\S]*?)\\[\\/${pid}\\]$`, 'i');
    let unwrapMatch = content.match(pidWrapRe);
    while (unwrapMatch) {
      content = (unwrapMatch[1] || '').trim();
      unwrapMatch = content.match(pidWrapRe);
    }
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
let _chatGeneration = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setChatBusy(isBusy) {
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.onclick = isBusy ? stopGeneration : sendMessage;
    sendBtn.title = isBusy ? '응답 중지' : '메시지 보내기';
    sendBtn.innerHTML = isBusy
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  }
}

function stopGeneration() {
  if (!_chatGeneration) return;
  _chatGeneration.cancelled = true;
  try { _chatGeneration.controller?.abort(); } catch {}
  _chatGeneration = null;
  const area = document.getElementById('chatArea');
  const thinkEl = area?.querySelector?.('.thinking-bubble');
  if (thinkEl) thinkEl.remove();
  isLoading = false;
  setChatBusy(false);
  showToast('응답을 중지했어요.');
}

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
  if (e.key !== 'Enter' || e.isComposing) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  if (_isDemoMode) {
    const input = document.getElementById('userInput');
    if (input) input.value = '';
    _showDemoSlide(document.getElementById('chatArea'));
  } else {
    sendMessage();
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
  const renderSessionId = session.id;
  if (_speechListening) stopMicInput();
  const input = document.getElementById('userInput');
  const text = sanitizeUserInputValue(input.value).trim();
  if (!text && !attachments.length) return;
  const shouldAutoMemorySave = /(기억해|기억해줘|remember this|note this|메모해|기록해)/i.test(text);

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
  _chatGeneration = { controller: new AbortController(), cancelled: false, sessionId: renderSessionId };
  setChatBusy(true);
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

  const nowTs = Date.now();
  const userMsg = { role:'user', content: msgContent, createdAt: nowTs, _rendered:`<div class="msg-group"><div class="user-msg">${userHTML}</div></div>` };
  session.history.push(userMsg);
  session.updatedAt = Date.now();

  // 이미지 편집용 참조 이미지: attachments 클리어 전에 미리 캡처
  const refImages = [...requestImageUrls];

  attachments = [];
  renderAttachmentPreviews();

  // imageArea는 display:none — 탭 무관하게 항상 chatArea 사용
  const area = document.getElementById('chatArea');
  area.classList.add('has-messages');
  document.getElementById('chatEmpty2').style.display = 'none';

  const userEl = document.createElement('div');
  userEl.innerHTML = userMsg._rendered;
  if (userEl.firstElementChild) {
    userEl.firstElementChild.classList.add('msg-enter');
    enhanceRenderedMessage(userEl.firstElementChild);
    attachMessageMeta(userEl.firstElementChild, userMsg.createdAt, 'right');
    area.appendChild(userEl.firstElementChild);
    updateChatBottomAnchor(area);
  }

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
  updateChatBottomAnchor(area);
  area.scrollTop = area.scrollHeight;

  const pListAll = getSessionPersonas(session);

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

    const emotionTestCreatedAt = Date.now();
    const replyEl = document.createElement('div');
    replyEl.innerHTML = html;
    if (replyEl.firstElementChild) {
      replyEl.firstElementChild.classList.add('msg-enter');
      enhanceRenderedMessage(replyEl.firstElementChild);
      attachMessageMeta(replyEl.firstElementChild, emotionTestCreatedAt, 'left');
      area.appendChild(replyEl.firstElementChild);
      updateChatBottomAnchor(area);
    }
    area.scrollTop = area.scrollHeight;

    session.history.push({ role:'assistant', content:'(감정 테스트)', createdAt: emotionTestCreatedAt, personaSnapshot, _suffixes: {} });
    session.lastPreview = '(감정 테스트)'; session.updatedAt = Date.now();
    isLoading = false;
    _chatGeneration = null;
    setChatBusy(false);
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
          buildCurrentTimeSystemMessage(),
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
              buildCurrentTimeSystemMessage(),
              ...session.history
                .filter(m => m.role==='user'||m.role==='assistant')
                .map(m => ({ role:m.role, content: m === userMsg ? personaRequestMsgContent : m.content }))
            ];
            const res = await fetch(wUrl + '/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: personaMessages,
                model: getPersonaModel(persona),
                participant_pids: [persona.pid]
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
            participant_pids: Array.from(new Set(session.participantPids || [])),
            ...(isGptImg && refImages.length === 0
              ? { size: RATIO_TO_OPENAI_SIZE[ratio] || '1024x1024' }
              : { aspect_ratio: ratio }
            ),
            ...(refImages.length > 0 ? { images: refImages } : {})
          };
        } else {
          // 채팅: 기존 messages 배열
          reqBody = {
            messages: apiMessages,
            model: targetModel,
            participant_pids: Array.from(new Set(session.participantPids || []))
          };
        }

        // 브라우저 타임아웃 없음 (Worker 30s 한계 주의)
        const res = await fetch(wUrl + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: _chatGeneration.controller.signal
        });
        const data = await res.json();
        if (data.result !== 'success') {
          const pid0 = session.participantPids?.[0] || 'p';
          reply = `[${pid0}]생성 오류: ${data.error||'알 수 없는 오류'}[/${pid0}]`;
        } else {
          reply = data.reply || '';
          if (isImageReq) {
            const rawImageUrl = String(data.image_url || '').trim();
            const proxiedImageUrl = rawImageUrl ? `${wUrl}/image-fetch?url=${encodeURIComponent(rawImageUrl)}` : '';
            const safeImageUrl = proxiedImageUrl || rawImageUrl;
            if (safeImageUrl) {
              if (/!\[[^\]]*\]\(([^)]*)\)/.test(reply)) {
                reply = reply.replace(/!\[([^\]]*)\]\(([^)]*)\)/, (_m, alt) => `![${alt || 'generated'}](${safeImageUrl})`);
              } else {
                reply = `![generated](${safeImageUrl})`;
              }
            }
          }
        }
        }
      } catch(e) {
        if (e?.name === 'AbortError') throw e;
        const pid0 = session.participantPids?.[0] || 'p';
        reply = `[${pid0}]연결 실패: ${e.message}[/${pid0}]`;
      }
    }

    if (thinkEl.parentNode) thinkEl.remove();
    
    // 백그라운드 처리 중 세션이 유지되었는지 체크
    const currentSession = sessions.find(s => s.id === session.id);
    if (!currentSession) return;

    // 생성된 이미지는 data URL / 원격 URL 모두 R2에 업로드 후 교체
    if (isImageReq && /!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/i.test(reply)) {
      const dataUrlRe = /!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/g;
      let m;
      while ((m = dataUrlRe.exec(reply)) !== null) {
        const imageRef = m[1];
        const fname = makeImageFilename('generated') + '.jpg';
        const r2Url = await uploadToR2(imageRef, 'img_generated', fname).catch(() => imageRef);
        reply = reply.replace(imageRef, r2Url);
      }
    }

    const pList = pListAll;
    const personaSnapshot = pList.map(p=>({pid:p.pid, name:p.name}));
    const suffixes = await resolveMessageSuffixes(reply, pList);

    const assistantCreatedAt = Date.now();
    currentSession.history.push({ role:'assistant', content:reply, createdAt: assistantCreatedAt, personaSnapshot, _suffixes: suffixes });

    const parsed = parseResponse(reply, pList);
    const firstContent = parsed[0]?.content || '';
    currentSession.lastPreview = sanitizeChatListPreview(buildChatPreviewText(firstContent));
    currentSession.updatedAt = Date.now();

    // 사용자가 해당 채팅방을 그대로 보고 있다면 화면에 즉시 렌더링
    if (activeChatId === currentSession.id) {
      const tgtArea = document.getElementById('chatArea');
      tgtArea.classList.add('has-messages');
      await appendAIReplySequentially(reply, pList, suffixes, assistantCreatedAt, tgtArea, currentSession.id);
    }

    if (!currentSession._demo) { saveSession(currentSession.id); saveIndex(); }
    renderChatList();
    if (!currentSession._demo && (shouldAutoMemorySave || ((currentSession.history?.length || 0) % 12 === 0))) {
      extractSessionMemories(currentSession).catch(() => {});
    }
    await cleanupAttachmentCaches(sentAttachments);
    
    // 완료 후 항상 락 해제 (이미지/채팅 공통)
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    setTimeout(() => input.focus(), 10);
  };

  // 이미지/채팅 모두 await — 이미지 생성 중 추가 전송 차단
  try { await processApiAndRender(); } catch (e) { if (e?.name !== 'AbortError') throw e; } finally { isLoading = false; _chatGeneration = null; setChatBusy(false); }
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
    if (a.uploading) div.classList.add('is-uploading');
    if (a.uploadError) div.classList.add('upload-error');
    const media = a.type === 'image'
      ? `<img src="${a.dataUrl}">`
      : `<div class="attachment-file">${a.name || '파일'}</div>`;
    const status = a.uploading
      ? `<div class="attachment-status"><div class="attachment-spinner"></div></div>`
      : a.uploadError
        ? `<div class="attachment-status attachment-status-error">!</div>`
        : '';
    div.innerHTML = `${media}${status}<button class="remove-btn" onclick="removeAttachment(${i})">×</button>`;
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
    const kickable = isGroup ? `onclick="kickPersona('${p.pid}')"` : '';
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
      const img = await getNeutralImageThumb(p.pid, 42);
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
  s.participantPids = Array.from(new Set([...(s.participantPids || []), ...selectedPids]));
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
        participant_pids: Array.from(new Set(s.participantPids || [])),
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
  const circleSrc = await getPersonaCircleThumb(pid, emotion, suffix);
  const initialSrc = fallbackSrc || circleSrc;
  imgEl.innerHTML = initialSrc ? `<img src="${initialSrc}">` : defaultAvatar(hue);
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
      const neutralFull = await idbGet(`em_full_${pid}_neutral_a`) || await idbGet(`em_full_${pid}_neutral`);
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

function ensureSettingsMemoryPanel() {
  const pane = document.getElementById('settingsPane');
  if (!pane) return;
  if (document.getElementById('publicMemoryList')) return;
  const scroller = pane.querySelector('div[style*="overflow-y:auto"]') || pane;
  if (!scroller) return;
  const block = document.createElement('div');
  block.style.paddingTop = '20px';
  block.style.borderTop = '1px solid var(--border)';
  block.innerHTML = `
    <div class="field-label" style="margin-bottom:10px">Public Memory</div>
    <div id="memoryMetaLine" style="font-size:11px;color:var(--muted);margin:-2px 0 8px 0">Loading memory status...</div>
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <textarea id="publicMemoryInput" class="edit-input" placeholder="Rememberable user fact..." style="flex:1;height:72px;resize:none;line-height:1.5"></textarea>
      <button onclick="addPublicMemoryManual()" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:12px;cursor:pointer;font-family:'Pretendard',sans-serif">Save</button>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button onclick="optimizeMemoryNow()" style="padding:8px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:12px;cursor:pointer;font-family:'Pretendard',sans-serif">메모리최적화</button>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px">
      <button onclick="toggleMemorySelectAll('public_profile','global',true); renderPublicMemoryList();" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">전체선택</button>
      <button onclick="clearMemorySelection('public_profile','global'); renderPublicMemoryList();" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">선택해제</button>
      <button onclick="deleteSelectedMemories('public_profile','global')" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:#3a1f24;color:#ffd7dd;font-size:11px;cursor:pointer">선택삭제</button>
    </div>
    <div id="publicMemoryList" style="display:flex;flex-direction:column;gap:8px"></div>
  `;
  scroller.appendChild(block);
}

function memoryLockIconSVG(locked) {
  if (locked) {
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.3-2.2"/></svg>';
}

function memoryTrashIconSVG() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
}

function memoryEditIconSVG() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
}

const _memoryListCache = {};
const _memorySelection = {};
function memoryCacheKey(scope, owner = '') { return `${scope || ''}::${owner || ''}`; }
function getMemoryListFromCache(scope, owner = '') {
  const key = memoryCacheKey(scope, owner);
  return Array.isArray(_memoryListCache[key]) ? _memoryListCache[key] : null;
}
function setMemoryListToCache(scope, owner = '', items = []) {
  const key = memoryCacheKey(scope, owner);
  _memoryListCache[key] = Array.isArray(items) ? [...items] : [];
}
async function getMemoryListCached(scope, owner = '', limit = 120, force = false) {
  if (!force) {
    const cached = getMemoryListFromCache(scope, owner);
    if (cached) return cached;
  }
  const fresh = await listMemoriesApi(scope, owner, limit);
  setMemoryListToCache(scope, owner, fresh);
  return getMemoryListFromCache(scope, owner) || [];
}
function sortMemoryList(items) {
  return [...(items || [])].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

function getMemorySelectionSet(scope, owner = '') {
  const key = memoryCacheKey(scope, owner);
  if (!_memorySelection[key]) _memorySelection[key] = new Set();
  return _memorySelection[key];
}

function toggleMemoryItemSelection(scope, owner = '', id = '', checked = false) {
  if (!id || !scope) return;
  const set = getMemorySelectionSet(scope, owner);
  if (checked) set.add(id);
  else set.delete(id);
}

function clearMemorySelection(scope, owner = '') {
  const key = memoryCacheKey(scope, owner);
  _memorySelection[key] = new Set();
}

function toggleMemorySelectAll(scope, owner = '', checked = false) {
  const items = getMemoryListFromCache(scope, owner) || [];
  const set = getMemorySelectionSet(scope, owner);
  set.clear();
  if (checked) items.forEach(it => set.add(it.id));
}

function memoryItemRowHTML(item, onDelete) {
  const scopeBadge = String(item.scope || '').replace('_', ' ');
  const displayText = String(item.text || '').replace(/^\s*profile\s*:\s*/i, '');
  const safeText = esc(displayText);
  const locked = !!item.locked;
  const lockTitle = locked ? '잠금 해제' : '잠금';
  const lockNext = locked ? 'false' : 'true';
  const deleteDisabled = locked ? 'disabled' : '';
  const editDisabled = locked ? 'disabled' : '';
  const editOpacity = locked ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
  const deleteOpacity = locked ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
  const selected = getMemorySelectionSet(item.scope || '', item.owner || '').has(item.id);
  return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--card)">
    <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleMemoryItemSelection('${item.scope || ''}','${item.owner || ''}','${item.id}',this.checked)" style="margin-top:3px;cursor:pointer" />
    <div style="flex:1">
      <div style="font-size:10px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">${esc(scopeBadge)}</div>
      <div style="font-size:12px;line-height:1.5;color:var(--text)">${safeText}</div>
    </div>
    <button onclick="toggleMemoryLockItem('${item.id}','${item.scope || ''}','${item.owner || ''}',${lockNext})" title="${lockTitle}" style="flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:${locked ? 'hsl(45,80%,68%)' : 'var(--muted)'};display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${memoryLockIconSVG(locked)}</button>
    <button onclick="editMemoryItem('${item.id}','${item.scope || ''}','${item.owner || ''}')" title="Edit" ${editDisabled} style="flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;${editOpacity}">${memoryEditIconSVG()}</button>
    <button onclick="${onDelete}('${item.id}','${item.scope || ''}','${item.owner || ''}')" title="삭제" ${deleteDisabled} style="flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;${deleteOpacity}">${memoryTrashIconSVG()}</button>
  </div>`;
}

async function renderPublicMemoryList(force = false) {
  const wrap = document.getElementById('publicMemoryList');
  if (!wrap) return;
  const items = sortMemoryList(await getMemoryListCached('public_profile', 'global', 120, !!force));
  if (!items.length) {
    wrap.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:4px 2px">No public memory yet.</div>`;
    return;
  }
  wrap.innerHTML = items.map(item => memoryItemRowHTML(item, 'deletePublicMemoryItem')).join('');
}

async function addPublicMemoryManual() {
  const input = document.getElementById('publicMemoryInput');
  const text = (input?.value?.trim() || '').replace(/^\s*profile\s*:\s*/i, '');
  if (!text) return;
  const res = await upsertMemoryApi({
    scope: 'public_profile',
    owner: 'global',
    text,
    source: 'manual'
  });
  if (res?.ok) {
    input.value = '';
    showToast(res.duplicate ? 'Already saved memory.' : 'Public memory saved.');
    const current = getMemoryListFromCache('public_profile', 'global') || [];
    if (res.item) {
      const next = [res.item, ...current.filter(it => it.id !== res.item.id)];
      setMemoryListToCache('public_profile', 'global', next);
    }
    renderPublicMemoryList();
  } else {
    showToast('Failed to save memory.');
  }
}

async function deleteSelectedMemories(scope = '', owner = '') {
  if (!scope) return;
  const set = getMemorySelectionSet(scope, owner);
  const ids = [...set];
  if (!ids.length) {
    showToast('선택된 메모리가 없습니다.');
    return;
  }
  const res = await deleteMemoryBatchApi({ scope, owner, ids });
  if (!res?.ok) {
    showToast('선택삭제 실패');
    return;
  }
  const current = getMemoryListFromCache(scope, owner) || [];
  const idSet = new Set(ids);
  setMemoryListToCache(scope, owner, current.filter(it => !idSet.has(it.id)));
  clearMemorySelection(scope, owner);
  showToast(`선택삭제 완료 (${res.deleted || 0}/${ids.length})`);
  if (scope === 'public_profile') {
    renderPublicMemoryList();
    renderMemoryMeta();
  } else if (scope === 'private_profile') {
    renderPrivateMemoryList(owner || editingPid);
  }
}

async function deletePublicMemoryItem(id, scope = 'public_profile', owner = 'global') {
  if (!id || !scope) return;
  const res = await deleteMemoryApi({
    scope,
    owner,
    id
  });
  if (res?.ok) {
    showToast('Public memory deleted.');
    const current = getMemoryListFromCache(scope, owner) || [];
    setMemoryListToCache(scope, owner, current.filter(it => it.id !== id));
    toggleMemoryItemSelection(scope, owner, id, false);
    renderPublicMemoryList();
    renderMemoryMeta();
  } else {
    showToast('삭제 실패. 잠금 상태인지 확인하세요.');
  }
}

function ensureEditPrivateMemoryPanel(pid) {
  const body = document.getElementById('editBody');
  if (!body || !pid) return;
  const existing = document.getElementById('editPrivateMemoryWrap');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'editPrivateMemoryWrap';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
      <div class="edit-section-title" style="margin:0">Private Memory</div>
      <button onclick="optimizePrivateMemoryNow('${esc(pid)}')" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;font-family:'Pretendard',sans-serif">최적화</button>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <textarea id="privateMemoryInput" class="edit-input" placeholder="Memory for ${esc(pid)}..." style="flex:1;height:64px;resize:none;line-height:1.5"></textarea>
      <button onclick="addPrivateMemoryManual('${esc(pid)}')" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:12px;cursor:pointer;font-family:'Pretendard',sans-serif">Save</button>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px">
      <button onclick="toggleMemorySelectAll('private_profile','${esc(pid)}',true); renderPrivateMemoryList('${esc(pid)}');" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">전체선택</button>
      <button onclick="clearMemorySelection('private_profile','${esc(pid)}'); renderPrivateMemoryList('${esc(pid)}');" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">선택해제</button>
      <button onclick="deleteSelectedMemories('private_profile','${esc(pid)}')" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:#3a1f24;color:#ffd7dd;font-size:11px;cursor:pointer">선택삭제</button>
    </div>
    <div id="privateMemoryList" style="display:flex;flex-direction:column;gap:8px"></div>
  `;
  body.appendChild(wrap);
}

async function renderPrivateMemoryList(pid, force = false) {
  const wrap = document.getElementById('privateMemoryList');
  if (!wrap || !pid) return;
  const items = sortMemoryList(await getMemoryListCached('private_profile', pid, 120, !!force));
  if (!items.length) {
    wrap.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:4px 2px">No private memory yet.</div>`;
    return;
  }
  wrap.innerHTML = items.map(item => memoryItemRowHTML(item, 'deletePrivateMemoryItem')).join('');
}

async function addPrivateMemoryManual(pid) {
  const input = document.getElementById('privateMemoryInput');
  const text = (input?.value?.trim() || '').replace(/^\s*profile\s*:\s*/i, '');
  if (!text || !pid) return;
  const res = await upsertMemoryApi({
    scope: 'private_profile',
    owner: pid,
    text,
    source: 'manual'
  });
  if (res?.ok) {
    input.value = '';
    showToast(res.duplicate ? 'Already saved memory.' : 'Private memory saved.');
    const current = getMemoryListFromCache('private_profile', pid) || [];
    if (res.item) {
      const next = [res.item, ...current.filter(it => it.id !== res.item.id)];
      setMemoryListToCache('private_profile', pid, next);
    }
    renderPrivateMemoryList(pid, true);
  } else {
    showToast('Failed to save memory.');
  }
}

// Override: keep diagnostics explicit for private-only optimization failures.
async function optimizePrivateMemoryNow(pid) {
  if (!pid) return;
  if (!confirm(`Optimize only ${pid} private memory?`)) return;
  const session = getActiveSession();
  const res = await optimizeMemoriesApi({
    sessionId: session?.id || '',
    participantPids: [pid],
    includePublic: false
  });
  if (res?.ok) {
    showToast(`Private optimize done: ${res.optimized || 0} merged, ${res.removed || 0} removed`);
    renderPrivateMemoryList(pid, true);
    return;
  }
  const hint = res?.status ? ` (HTTP ${res.status})` : '';
  const err = String(res?.error || '').trim();
  const detail = String(res?.detail || '').trim();
  const msg = err || detail ? `: ${err || detail}` : '';
  showToast(`Private memory optimize failed${hint}${msg}`);
  if (detail) showToast(`Detail: ${detail.slice(0, 120)}`);
  console.error('optimizePrivateMemoryNow failed', { pid, res, raw: JSON.stringify(res || {}) });
}

async function deletePrivateMemoryItem(id, scope = 'private_profile', owner = '') {
  const pid = owner || editingPid;
  if (!id || !pid || !scope) return;
  const res = await deleteMemoryApi({
    scope,
    owner: pid,
    id
  });
  if (res?.ok) {
    showToast('Private memory deleted.');
    const current = getMemoryListFromCache(scope, pid) || [];
    setMemoryListToCache(scope, pid, current.filter(it => it.id !== id));
    toggleMemoryItemSelection(scope, pid, id, false);
    renderPrivateMemoryList(pid);
  } else {
    showToast('삭제 실패. 잠금 상태인지 확인하세요.');
  }
}

async function toggleMemoryLockItem(id, scope = '', owner = '', locked = false) {
  if (!id || !scope) return;
  const cacheOwner = scope === 'public_profile' ? 'global' : (owner || editingPid || '');
  const current = getMemoryListFromCache(scope, cacheOwner) || await getMemoryListCached(scope, cacheOwner, 120);
  const prev = current.map(it => ({ ...it }));
  const optimistic = current.map(it => it.id === id ? { ...it, locked: !!locked } : it);
  setMemoryListToCache(scope, cacheOwner, optimistic);
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);

  const res = await setMemoryLockApi({ id, scope, owner: cacheOwner, locked: !!locked });
  if (!res?.ok) {
    setMemoryListToCache(scope, cacheOwner, prev);
    if (scope === 'public_profile') renderPublicMemoryList();
    if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
    showToast('잠금 변경 실패');
    return;
  }
  showToast(locked ? '메모리 잠금됨' : '메모리 잠금 해제');
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
}

async function editMemoryItem(id, scope = '', owner = '') {
  if (!id || !scope) return;
  const cacheOwner = scope === 'public_profile' ? 'global' : (owner || editingPid || '');
  const current = getMemoryListFromCache(scope, cacheOwner) || await getMemoryListCached(scope, cacheOwner, 120);
  const target = current.find(it => it.id === id);
  if (!target) return;
  if (target.locked) {
    showToast('Locked memory cannot be edited.');
    return;
  }

  const edited = prompt('메모리 수정', String(target.text || ''));
  if (edited === null) return;
  const clean = String(edited || '').replace(/^\s*profile\s*:\s*/i, '').trim();
  if (!clean) {
    showToast('빈 메모리는 저장할 수 없습니다.');
    return;
  }
  if (clean === String(target.text || '').trim()) return;

  const prev = current.map(it => ({ ...it }));
  const optimistic = current.map(it => it.id === id ? { ...it, text: clean } : it);
  setMemoryListToCache(scope, cacheOwner, optimistic);
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);

  const res = await updateMemoryApi({ id, scope, owner: cacheOwner, text: clean });
  if (!res?.ok) {
    setMemoryListToCache(scope, cacheOwner, prev);
    if (scope === 'public_profile') renderPublicMemoryList();
    if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
    showToast('메모리 수정 실패');
    return;
  }
  showToast('메모리 수정 완료');
}

async function saveMemoryFromCurrentChat() {
  const s = getActiveSession(); if (!s) return;
  const res = await extractSessionMemories(s);
  if (res?.ok) {
    showToast(`Memory saved: ${res.saved || 0}, duplicates: ${res.duplicate || 0}, processed: ${res.processed || 0}`);
    renderPublicMemoryList(true);
    if (editingPid) renderPrivateMemoryList(editingPid, true);
    renderMemoryMeta();
    closeDrawer();
  } else {
    const hint = res?.status ? ` (HTTP ${res.status})` : '';
    const err = String(res?.error || '').trim();
    const detail = String(res?.detail || '').trim();
    const msg = err || detail ? `: ${err || detail}` : '';
    showToast(`Memory save failed${hint}${msg}`);
    console.error('saveMemoryFromCurrentChat failed', { res, raw: JSON.stringify(res || {}) });
  }
}

function formatMemoryMetaTime(ts) {
  if (!ts) return '-';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(ts));
  } catch {
    return '-';
  }
}

async function renderMemoryMeta() {
  const line = document.getElementById('memoryMetaLine');
  if (!line) return;
  const sessionId = activeChatId || '';
  const meta = await getMemoryMetaApi(sessionId);
  if (!meta?.ok) {
    line.textContent = '메모리 상태를 불러오지 못했습니다.';
    return;
  }
  const lastExtract = formatMemoryMetaTime(meta?.session?.lastExtractedAt || 0);
  const lastOptimize = formatMemoryMetaTime(meta?.global?.lastOptimizedAt || 0);
  line.textContent = `최근 정리: ${lastExtract} / 최근 최적화: ${lastOptimize}`;
}

async function optimizeMemoryNow() {
  if (!confirm('메모리를 최적화할까요? 중복/유사 항목을 정리합니다.')) return;
  const session = getActiveSession();
  const participantPids = Array.from(new Set((personas || []).map(p => p.pid).filter(Boolean)));
  const res = await optimizeMemoriesApi({
    sessionId: session?.id || '',
    participantPids
  });
  if (res?.ok) {
    showToast(`최적화 완료: ${res.optimized || 0}개 정리, ${res.removed || 0}개 제거`);
    renderPublicMemoryList(true);
    if (editingPid) renderPrivateMemoryList(editingPid, true);
    renderMemoryMeta();
  } else {
    showToast('메모리 최적화 실패');
  }
}
