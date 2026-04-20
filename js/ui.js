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
  if (align === 'right') {
    return `<div class="msg-meta-row msg-meta-right"><div class="msg-time msg-time-right">${label}</div><div class="msg-actions msg-actions-right"></div></div>`;
  }
  return `<div class="msg-meta-row msg-meta-left"><div class="msg-actions msg-actions-left"></div><div class="msg-time msg-time-left">${label}</div></div>`;
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
  const abs = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now).replace(',', '');
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'long'
  }).format(now);
  return {
    role: 'system',
    content:
      `Reference clock (fixed): Asia/Seoul (KST, UTC+09:00). ` +
      `Current Seoul time: ${text} (${abs}, ${weekday}). ` +
      `When answering any time/date question, always use Asia/Seoul. ` +
      `For relative words (today/tomorrow/yesterday), include exact absolute date (YYYY-MM-DD). ` +
      `If user wording conflicts with date context, explicitly clarify with absolute date.`
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
  updateChatHeaderAvatarVisibility();
}

function updateChatHeaderAvatarVisibility() {
  const avatarsEl = document.getElementById('chatHeaderAvatars');
  if (!avatarsEl) return;
  const hidden = getChatAvatarStyle() === 'hidden';
  avatarsEl.style.display = hidden ? 'none' : '';
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
  btn.title = on ? '숨긴 채팅 보기 중' : '숨긴 채팅 숨기기';
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
    const userActions = group.querySelector('.msg-meta-right .msg-actions');
    if (userMsg && userActions && !userActions.querySelector('.user-copy-btn')) {
      const btn = document.createElement('button');
      btn.className = 'copy-btn user-copy-btn';
      btn.type = 'button';
      btn.title = '복사';
      btn.dataset.copyText = encodeCopyPayload(userMsg.innerText || '');
      btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
      btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
      userActions.appendChild(btn);
    }

    const aiActions = group.querySelector('.msg-meta-left .msg-actions');
    const aiBubble = group.querySelector('.ai-msg:last-child .bubble-col:last-child .ai-bubble');
    if (aiActions && aiBubble && !aiBubble.querySelector('img')) {
      const btn = aiActions.querySelector('.copy-btn') || document.createElement('button');
      if (!aiActions.querySelector('.copy-btn')) {
        btn.className = 'copy-btn';
        btn.type = 'button';
        btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
        aiActions.appendChild(btn);
      }
      btn.title = '복사';
      btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
      btn.dataset.copyText = encodeCopyPayload(aiBubble.innerText || '');
    }
  }

  container.querySelectorAll('pre').forEach(pre => {
    if (pre.dataset.copyEnhanced === '1') return;
    const code = pre.querySelector('code');
    if (!code) return;
    const text = code?.innerText || pre.innerText || '';
    const langClass = [...(code.classList || [])].find(c => c.startsWith('language-')) || '';
    const lang = langClass ? langClass.replace('language-', '') : 'code';
    const langLabel = lang.charAt(0).toUpperCase() + lang.slice(1);

    const head = document.createElement('div');
    head.className = 'code-block-head';
    const title = document.createElement('span');
    title.className = 'code-block-lang';
    title.textContent = langLabel;

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.type = 'button';
    btn.title = 'Copy code';
    btn.setAttribute('aria-label', 'Copy code');
    btn.dataset.copyText = encodeCopyPayload(text);
    btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
    btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
    head.appendChild(title);
    head.appendChild(btn);

    const body = document.createElement('div');
    body.className = 'code-block-body';
    body.appendChild(code);

    pre.classList.add('code-copy-wrap');
    pre.innerHTML = '';
    pre.appendChild(head);
    pre.appendChild(body);
    pre.dataset.copyEnhanced = '1';
  });
}

function attachMessageMeta(container, ts, align = 'left') {
  if (!container || !ts) return;
  if (container.querySelector('.msg-time')) return;
  const metaHTML = buildTimeMetaHTML(ts, align);
  if (!metaHTML) return;
  if (align === 'left') {
    const leftTarget = container.querySelector('.ai-msg:last-child .bubble-col:last-child')
      || container.querySelector('.bubble-col:last-child')
      || container;
    leftTarget.insertAdjacentHTML('beforeend', metaHTML);
    return;
  }
  const rightWrap = container.querySelector('.user-msg-wrap')
    || container.querySelector('.user-msg')
    || container;
  rightWrap.insertAdjacentHTML('afterend', metaHTML);
}

function updateChatBottomAnchor(area = document.getElementById('chatArea')) {
  if (!area) return;
  area.querySelectorAll('.chat-bottom-anchor').forEach(el => el.classList.remove('chat-bottom-anchor'));
  const firstContent = [...area.children].find(el => el.id !== 'chatEmpty2');
  if (firstContent) firstContent.classList.add('chat-bottom-anchor');
}

function stickChatToBottom(area = document.getElementById('chatArea')) {
  if (!area) return;
  area.scrollTop = area.scrollHeight;
}

function layoutHorizontalMasonryRows(root = document) {
  const rows = root.querySelectorAll('.bubble-img-container.multi');
  rows.forEach(row => {
    const wraps = [...row.querySelectorAll('.inline-image-wrap')];
    if (!wraps.length) return;
    const imgs = wraps.map(w => w.querySelector('img')).filter(Boolean);
    if (imgs.length !== wraps.length) return;
    if (imgs.some(img => !img.naturalWidth || !img.naturalHeight)) return;

    const rowWidth = row.clientWidth || row.getBoundingClientRect().width;
    if (!rowWidth) return;
    const style = getComputedStyle(row);
    const gap = parseFloat(style.columnGap || style.gap || '8') || 8;
    const available = Math.max(40, rowWidth - gap * Math.max(0, imgs.length - 1));

    const ratios = imgs.map(img => img.naturalWidth / img.naturalHeight);
    const ratioSum = ratios.reduce((sum, r) => sum + r, 0);
    if (!ratioSum) return;

    const rowHeight = available / ratioSum;
    const widths = ratios.map(r => r * rowHeight);
    if (widths.length > 1) {
      const consumed = widths.slice(0, -1).reduce((a, b) => a + b, 0);
      widths[widths.length - 1] = Math.max(12, available - consumed);
    }

    wraps.forEach((wrap, i) => {
      wrap.style.height = `${rowHeight}px`;
      wrap.style.width = `${Math.max(12, widths[i] || 12)}px`;
      const img = imgs[i];
      if (img) {
        img.style.width = '100%';
        img.style.height = '100%';
      }
    });
  });
}

function bindImageLoadBottomStick(area = document.getElementById('chatArea')) {
  if (!area) return;
  area.querySelectorAll('.inline-image-wrap img, .ai-bubble img, .bubble-img').forEach(img => {
    if (img.dataset.bottomStickBound === '1') return;
    img.dataset.bottomStickBound = '1';
    const onLoad = () => {
      layoutHorizontalMasonryRows(area);
      if (area.dataset.imageLoadStick === '1') {
        requestAnimationFrame(() => stickChatToBottom(area));
      }
    };
    img.addEventListener('load', onLoad, { passive: true });
    img.addEventListener('error', onLoad, { passive: true });
  });
}

function sanitizeUserInputValue(value) {
  return sanitizeTextForUnicodeSafety(value);
}

function sanitizeTextForUnicodeSafety(value) {
  let s = String(value || '');
  // Control chars except common whitespace
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  // Zero-width / bidi / invisible formatting controls
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFFC]/g, '');
  // Interlinear annotation controls
  s = s.replace(/[\uFFF9-\uFFFB]/g, '');
  // Known accidental foreign-token artifact observed in chat
  s = s.replace(/(^|[\s\[\(\{'"`])հիմա(?=$|[\s\]\)\}'"`.,!?;:])/gi, '$1');
  return s;
}

function extractFirstUrlFromText(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"')]+/i);
  return m ? m[0] : '';
}

function extractImageUrlFromApiData(data) {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data.image_url,
    data.imageUrl,
    data.url,
    data.image,
    data.output_image_url,
    Array.isArray(data.images) ? data.images[0] : '',
    data?.output?.[0]?.url,
    data?.result?.image_url
  ];
  for (const c of candidates) {
    const u = String(c || '').trim();
    if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  }
  const fromMd = String(data.reply || '').match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/i);
  if (fromMd?.[1]) return fromMd[1];
  return extractFirstUrlFromText(data.reply || '');
}

function normalizeGeneratedMarkdown(text) {
  let s = String(text || '');
  if (/!\[generated\](?!\()/i.test(s)) {
    const u = extractFirstUrlFromText(s);
    if (u) s = s.replace(/!\[generated\](?!\()/ig, `![generated](${u})`);
  }
  return s;
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

function isInlineDataImageUrl(url) {
  return /^data:image\//i.test(String(url || ''));
}

function sanitizeImageUrlForHistory(url) {
  const u = String(url || '').trim();
  if (!u || isInlineDataImageUrl(u)) return '';
  return u;
}

function serializeAttachmentForHistory(a) {
  if (!a) return null;
  const url = sanitizeImageUrlForHistory(getAttachmentStoredUrl(a));
  if (!url) return null;
  return {
    type: a.type === 'image' ? 'image' : 'file',
    name: a.name || '',
    mimeType: a.mimeType || '',
    url,
    previewUrl: getAttachmentPreviewUrl(a) || url
  };
}

function getMessageAttachments(msg) {
  if (Array.isArray(msg?.attachments) && msg.attachments.length) {
    return msg.attachments
      .map(a => ({
        type: a?.type === 'image' ? 'image' : 'file',
        name: a?.name || '',
        mimeType: a?.mimeType || '',
        url: a?.url || '',
        previewUrl: a?.previewUrl || a?.url || ''
      }))
      .filter(a => !!a.url);
  }
  if (Array.isArray(msg?.content)) {
    return msg.content
      .filter(c => c?.type === 'image_url' && c?.image_url?.url)
      .map(c => ({ type: 'image', name: 'image', mimeType: 'image/jpeg', url: c.image_url.url, previewUrl: c.image_url.url }));
  }
  return [];
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
  if (!a) return '';
  if (!isImageAttachment(a)) return getAttachmentStoredUrl(a) || '';
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

function buildUserMessageContentV2(text, imageUrls, fileRefs = []) {
  const imgs = (imageUrls || []).filter(Boolean);
  const files = (fileRefs || []).filter(f => f && f.url);
  if (!imgs.length && !files.length) return text || '(file)';
  const fileText = files.length
    ? `\n\nAttached files:\n${files.map(f => `- ${f.name || 'file'}: ${f.url}`).join('\n')}`
    : '';
  const content = [];
  const mergedText = `${text || ''}${fileText}`.trim();
  if (mergedText) content.push({ type: 'text', text: mergedText });
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
  const raw = sanitizeTextForUnicodeSafety(text).replace(/\n/g, ' ').trim();
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
  const raw = sanitizeTextForUnicodeSafety(text).trim();
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

function isImageWorkflowMessage(msg) {
  return !!msg?._imageWorkflow;
}

function sanitizeMessageContentForTextContext(content, preserveImages = false) {
  if (Array.isArray(content)) {
    if (preserveImages) return content;
    const filtered = content.filter(c => c?.type !== 'image_url');
    if (!filtered.length) return '(image omitted)';
    return filtered;
  }
  if (typeof content === 'string') {
    return content
      .replace(/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/gi, '[image]')
      .trim();
  }
  return content;
}

function buildApiMessagesFromHistory(history, currentUserMsg, currentContent, isImageReq) {
  return (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => isImageReq || !isImageWorkflowMessage(m))
    .map(m => ({
      role: m.role,
      content: sanitizeMessageContentForTextContext(m === currentUserMsg ? currentContent : m.content, m === currentUserMsg)
    }));
}

async function getImageDimensionsFromDataUrl(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function normalizeAttachmentImageForChat(dataUrl) {
  const meta = await getImageDimensionsFromDataUrl(dataUrl);
  if (!meta || !meta.width || !meta.height) return dataUrl;

  const MAX_ORIGINAL_EDGE = 2048;
  const LONG_EDGE_TARGET = 2000;
  const longEdge = Math.max(meta.width, meta.height);
  if (longEdge <= MAX_ORIGINAL_EDGE) return dataUrl;

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.width || meta.width;
      const srcH = img.height || meta.height;
      const scale = LONG_EDGE_TARGET / Math.max(srcW, srcH);
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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
    uploading: true,
    uploadError: false
  };

  if (!isImg) return record;

  const cacheKey = `attachment_original_${id}`;
  record.originalCacheKey = cacheKey;
  await idbSet(cacheKey, dataUrl).catch(() => {});

  const previewUrl = await normalizeAttachmentImageForChat(dataUrl).catch(() => dataUrl);
  record.previewUrl = previewUrl || dataUrl;
  record.dataUrl = record.previewUrl;
  return record;
}

function makeUploadFilenameForAttachment(file, isImg) {
  if (isImg) return `${makeImageFilename('uploaded')}.jpg`;
  const rawName = String(file?.name || '').trim();
  const ext = rawName.includes('.') ? rawName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const fallbackExt = 'bin';
  const safeExt = ext || fallbackExt;
  return `${makeImageFilename('uploaded_file')}.${safeExt}`;
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
    const isImg = record.type === 'image';
    const uploadSource = isImg ? (record.previewUrl || record.dataUrl) : record.dataUrl;
    const fname = makeUploadFilenameForAttachment(file, isImg);
    record.uploadPromise = uploadToR2(uploadSource, 'img_uploaded', fname)
      .then(url => {
        record.transportUrl = url || record.transportUrl;
        record.uploading = false;
        record.uploadError = false;
        renderAttachmentPreviews();
        return record.transportUrl;
      })
      .catch(() => {
        record.uploading = false;
        record.uploadError = true;
        renderAttachmentPreviews();
        return record.transportUrl;
      });
  }
  return added;
}

function setComposerDragActive(active) {
  const row = document.querySelector('.input-row');
  if (!row) return;
  row.style.transition = 'box-shadow .12s ease, border-color .12s ease, background-color .12s ease';
  row.style.boxShadow = active ? '0 0 0 1px rgba(255,255,255,.22), 0 0 0 4px rgba(255,255,255,.06)' : '';
  row.style.backgroundColor = '';
}

function initUserInputGuards() {
  const input = document.getElementById('userInput');
  if (!input) return;
  const row = document.querySelector('.input-row');
  if (!row) return;
  let dragDepth = 0;

  input.addEventListener('paste', e => {
    const items = [...(e.clipboardData?.items || [])];
    const hasImage = items.some(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (hasImage) {
      e.preventDefault();
      const files = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);
      if (!files.length) return;
      addFilesToAttachments(files, 'paste')
        .then(added => { if (added > 0) showToast(`클립보드 이미지 ${added}개를 첨부했어요.`); })
        .catch(err => showToast('클립보드 이미지 첨부 실패: ' + (err?.message || err)));
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

  [row].forEach(el => {
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
  const popupImg = document.getElementById('popupImg');
  if (popupImg && !popupImg.dataset.panBound) {
    popupImg.dataset.panBound = '1';
    popupImg.addEventListener('mousedown', startPopupPan);
    popupImg.addEventListener('touchstart', startPopupPan, { passive: false });
    popupImg.addEventListener('wheel', handlePopupWheelZoom, { passive: false });
    window.addEventListener('mousemove', movePopupPan);
    window.addEventListener('touchmove', movePopupPan, { passive: false });
    window.addEventListener('mouseup', endPopupPan);
    window.addEventListener('touchend', endPopupPan, { passive: true });
    window.addEventListener('touchcancel', endPopupPan, { passive: true });
  }
  const imageModelSelect = document.getElementById('imageModelSelect');
  if (imageModelSelect && !imageModelSelect.dataset.boundChange) {
    imageModelSelect.dataset.boundChange = '1';
    _lastImageModelValue = String(imageModelSelect.value || '');
    imageModelSelect.addEventListener('change', handleImageModelChanged);
  }
});

let _chatListRefreshTimer = null;
function scheduleChatListRefresh(delay = 120) {
  if (_chatListRefreshTimer) clearTimeout(_chatListRefreshTimer);
  _chatListRefreshTimer = setTimeout(() => {
    _chatListRefreshTimer = null;
    renderChatList().catch(() => {});
  }, delay);
}

let _chatAreaRefreshTimer = null;
function scheduleChatAreaRefresh(delay = 140) {
  if (!activeChatId) return;
  if (_chatAreaRefreshTimer) clearTimeout(_chatAreaRefreshTimer);
  _chatAreaRefreshTimer = setTimeout(() => {
    _chatAreaRefreshTimer = null;
    renderChatArea().catch(() => {});
  }, delay);
}

let _globalCacheWarmupToken = 0;
let _activeChatWarmupToken = 0;
let _startupWarmupRunning = false;
let _globalWarmupRunning = false;

async function runGlobalCacheWarmup() {
  const token = ++_globalCacheWarmupToken;
  _globalWarmupRunning = true;
  try {

    // 1) Persona grid priority: neutral_a only
    for (const p of (personas || [])) {
      if (token !== _globalCacheWarmupToken) return;
      await getNeutralABaseImageHD(p.pid).catch(() => null);
    }

    // 2) Chat list priority: by updatedAt desc
    const sorted = [...(sessions || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const seen = new Set();
    for (const s of sorted) {
      if (token !== _globalCacheWarmupToken) return;
      const pids = (s.participantPids || []);
      for (const pid of pids) {
        if (token !== _globalCacheWarmupToken) return;
        if (seen.has(pid)) continue;
        seen.add(pid);
        await getNeutralImageThumb(pid, 80).catch(() => null);
      }
    }
  } finally {
    _globalWarmupRunning = false;
    scheduleChatListRefresh(120);
  }
}

async function runStartupVisualWarmup(onProgress) {
  const token = ++_globalCacheWarmupToken;
  _startupWarmupRunning = true;

  try {
    const personaList = Array.isArray(personas) ? personas : [];
    const sortedSessions = [...(sessions || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const chatThumbPids = [];
    const seen = new Set();

    for (const s of sortedSessions) {
      for (const pid of (s.participantPids || [])) {
        if (!pid) continue;
        if (typeof getPersona === 'function' && !getPersona(pid)) continue;
        if (seen.has(pid)) continue;

        seen.add(pid);
        chatThumbPids.push(pid);
      }
    }

    const total = Math.max(1, personaList.length + chatThumbPids.length);
    let done = 0;

    const tick = (label) => {
      done += 1;
      try { onProgress?.(done, total, label); } catch (e) {}
    };

    // 1) Persona grid image base first (neutral_a)
    for (const p of personaList) {
      if (token !== _globalCacheWarmupToken) return;
      if (!p?.pid) continue;

      await getNeutralABaseImageHD(p.pid).catch(() => null);
      tick(`grid ${p.pid}`);
    }

    // 2) Chat list circle thumbnails
    for (const pid of chatThumbPids) {
      if (token !== _globalCacheWarmupToken) return;
      if (!pid) continue;
      if (typeof getPersona === 'function' && !getPersona(pid)) continue;

      await getNeutralImageThumb(pid, 80).catch(() => null);
      tick(`chat ${pid}`);
    }
  } finally {
    _startupWarmupRunning = false;
  }
}

async function runActiveChatWarmup(sessionId) {
  const token = ++_activeChatWarmupToken;
  const session = (sessions || []).find((x) => x.id === sessionId);
  if (!session) return;

  // Entered room first: participant avatars immediately.
  const pList = getSessionPersonas(session);
  for (const p of pList) {
    if (token !== _activeChatWarmupToken || activeChatId !== sessionId) return;
    await Promise.all([
      getNeutralImageThumb(p.pid, 42).catch(() => null),
      getNeutralImageThumb(p.pid, 80).catch(() => null),
    ]);
  }
  scheduleChatListRefresh(80);
  scheduleChatAreaRefresh(80);

  // Then recent assistant messages first.
  const history = Array.isArray(session.history) ? session.history : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (token !== _activeChatWarmupToken || activeChatId !== sessionId) return;
    const msg = history[i];
    if (!msg || msg.role !== 'assistant' || typeof msg.content !== 'string') continue;
    const renderPersonas = msg.personaSnapshot
      ? msg.personaSnapshot.map((snap) => getPersona(snap.pid) || { pid: snap.pid, name: snap.name, image: null, hue: 0, _ghost: true })
      : pList;
    const segments = parseResponse(msg.content, renderPersonas);
    for (const seg of segments) {
      if (token !== _activeChatWarmupToken || activeChatId !== sessionId) return;
      const persona = renderPersonas[seg.idx];
      if (!persona || !seg.content?.trim?.()) continue;
      const suffix = msg._suffixes?.[`${persona.pid}:${seg.emotion}`] || '';
      if (suffix) {
        await getEmotionImageSuffixed(persona.pid, seg.emotion, suffix, 200).catch(() => null);
      } else {
        await getEmotionImage(persona.pid, seg.emotion, 200).catch(() => null);
      }
      await getPersonaCircleThumb(persona.pid, seg.emotion, suffix, 80).catch(() => null);
    }
    scheduleChatAreaRefresh(90);
  }
}

window.addEventListener('persona-cache-updated', () => {
  if (_startupWarmupRunning || _globalWarmupRunning) return;
  scheduleChatListRefresh(100);
  scheduleChatAreaRefresh(110);
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
  document.getElementById('btabArchive')?.classList.toggle('active', tab === 'archive');
  // 패널 표시
  document.getElementById('personaPane').style.display = tab === 'persona' ? 'flex' : 'none';
  document.getElementById('chatPane').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('settingsPane').style.display = tab === 'settings' ? 'flex' : 'none';
  const archivePaneEl = document.getElementById('archivePane');
  if (archivePaneEl) archivePaneEl.style.display = tab === 'archive' ? 'flex' : 'none';
  if (tab === 'settings') renderSettingsPane();
  if (tab === 'archive') renderArchivePane();
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
    const celebStroke = '';
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

      showToast('이미지 선택됨 - 저장 버튼을 눌러줘');
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
  if (!wUrl) { alert('Worker URL 없음'); return; }

  showToast(`총${files.length}개 업로드 중...`, 10000);
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
  showToast(`총${ok}개 성공${fail ? ` / ${fail}개 실패` : ''}`);
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
  showToast(`이미지 ${files.length}개 업로드 시작`);

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
  showToast(`업로드 완료: ${ok}${fail ? `, 실패 ${fail}개` : ''}`);
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
    showToast('새 이미지 저장 중...', 5000);
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
      alert('업로드 실패: ' + e.message);
      return;
    }
    delete p._pendingImage;
  }
  savePersonas(); renderPersonaGrid(); goMain();
  showToast('저장됨 ✓');
}

// ===============
//  CHAT LIST & SWIPE DELETE
// ===============


// ===============
//  마크다운 렌더링 데모
// ===============
const _DEMO_SLIDES = [
  { label: "표(Table)", text: "| 항목 | 금액 | 비고 |\n|---|---:|---|\n| 매출 | 12,500,000 | 1분기 |\n| 매입 | 8,200,000 | 원자재 |\n| **영업이익** | **4,300,000** | 34.4% |" },
  { label: "코드 블록", text: "```python\ndef greet(name):\n    return '?덈뀞, ' + name\n\nprint(greet('Riley'))\n```" },
  { label: "紐⑸줉 & ?몄슜", text: "**?ㅻ뒛 ????*\n\n1. 湲고쉷???묒꽦\n2. ?붿옄??由щ럭\n3. 諛고룷 ?뺤씤\n\n> ?꾨꼍??肄붾뱶蹂대떎 ?숈옉?섎뒗 肄붾뱶媛 ?ル떎" },
  { label: "Mermaid", text: "```mermaid\nflowchart LR\n  A[?ъ슜?? --> B{?뚯떛}\n  B --> C[?섎Ⅴ?뚮굹]\n  B --> D[留덊겕?ㅼ슫]\n  C --> E[媛먯젙이미지]\n  D --> F[?뚮뜑留?\n```" },
  { label: "紐⑤뜽 鍮꾧탳", text: "| 紐⑤뜽 | ?띾룄 | 鍮꾩쟾 | 이미지?앹꽦 |\n|---|:---:|:---:|:---:|\n| grok-4-1-fast-non-reasoning | ?△슒??| ??| ??|\n| grok-3-mini | ?△슒 | ??| ??|\n| claude-sonnet | ?△슒 | ??| ??|\n| gemini-2.5-pro | ??| ??| ??|\n| gpt-4o | ?△슒 | ??| ??|" }
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
      lastPreview: '수식 · 코드 · Mermaid'
    };
    sessions.unshift(s);
  }
  s.history = [];
  s._loaded = true;
  activeChatId = s.id;
  // 메인화면 및 채팅 탭 활성화 후 chatScreen으로
  show('chatScreen');
  // 하단바 active 상태 갱신
  ['Persona','Chat','Settings'].forEach(t =>
    document.getElementById('btab'+t)?.classList.toggle('active', false)
  );
  document.getElementById('chatHeaderNames').textContent = '렌더링 데모';
  document.getElementById('chatHeaderAvatars').innerHTML =
    '<div class="chat-header-av" style="background:hsl(220,20%,14%);border-color:hsl(220,28%,22%);font-size:18px;display:flex;align-items:center;justify-content:center"></div>';
  const area = document.getElementById('chatArea');
  area.innerHTML = '';
  _showDemoSlide(area);
  const input = document.getElementById('userInput');
  if (input) { input.placeholder = 'Enter 눌러 다음 슬라이드'; input.value = ''; input.focus(); }
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
    <div class="msg-av" style="background:hsl(220,20%,14%);border-color:hsl(220,28%,22%);font-size:16px;display:flex;align-items:center;justify-content:center"></div>
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

let _chatListRenderVersion = 0;

async function renderChatList() {
  const list = document.getElementById('chatList');
  const empty = document.getElementById('chatEmpty');
  const myVersion = ++_chatListRenderVersion;
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

  const frag = document.createDocumentFragment();

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
    if (myVersion !== _chatListRenderVersion) return;
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
    frag.appendChild(wrap);
  }
  if (myVersion !== _chatListRenderVersion) return;
  list.querySelectorAll('.chat-list-wrap').forEach(e => e.remove());
  list.appendChild(frag);
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
          <div style="font-size:11px;color:var(--muted)">삭제: ${timeLabel(s.deletedAt || s.updatedAt || Date.now())}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="restoreDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border2);background:transparent;color:var(--text);font-size:12px;cursor:pointer">강제복구</button>
          <button onclick="purgeDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid hsl(0,30%,24%);background:hsl(0,20%,12%);color:hsl(0,70%,68%);font-size:12px;cursor:pointer">?영구삭제</button>
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
  showToast('채팅이 복원되었습니다');
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
  if (newBtn) newBtn.textContent = p?.name ? `${p.name} 와 채팅` : '와(과) 채팅';
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

function handleInAppBackNavigation() {
  const imagePopup = document.getElementById('imagePopup');
  if (imagePopup?.classList.contains('active')) {
    closeImagePopup();
    return true;
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
      return true;
    }
  }

  const cropOverlay = document.getElementById('cropOverlay');
  if (cropOverlay?.classList.contains('open') && typeof closeCropEditor === 'function') {
    closeCropEditor();
    return true;
  }
  const cropOverlayAvatar = document.getElementById('cropOverlayAvatar');
  if (cropOverlayAvatar?.classList.contains('open') && typeof closeAvatarCropEditor === 'function') {
    closeAvatarCropEditor();
    return true;
  }

  const editScreen = document.getElementById('editScreen');
  if (editScreen?.classList.contains('active')) {
    goMain();
    return true;
  }

  const chatScreen = document.getElementById('chatScreen');
  if (chatScreen?.classList.contains('active')) {
    goMain();
    return true;
  }

  if (activeTab !== 'persona') {
    switchTab('persona');
    return true;
  }

  if (_selectedPersonaPid) {
    clearPersonaSelection();
    return true;
  }
  return false;
}

function handleEscBackNavigation(event) {
  if (!event || event.key !== 'Escape') return;
  if (isEditableElement(event.target)) return;
  if (handleInAppBackNavigation()) event.preventDefault();
}

function ensureGlobalBackHandler() {
  if (window.__personaBackBound) return;
  window.__personaBackBound = true;
  document.addEventListener('keydown', handleEscBackNavigation);
  window.addEventListener('popstate', () => {
    if (handleInAppBackNavigation()) {
      try { history.pushState({ personaBackGuard: 1 }, '', location.href); } catch {}
    }
  });
  try { history.pushState({ personaBackGuard: 1 }, '', location.href); } catch {}
}

ensureGlobalBackHandler();

if (!window.__personaMasonryResizeBound) {
  window.__personaMasonryResizeBound = true;
  let masonryResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(masonryResizeTimer);
    masonryResizeTimer = setTimeout(() => layoutHorizontalMasonryRows(document.getElementById('chatArea') || document), 80);
  });
}

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
  if (!confirm('이 채팅방을 삭제할까요? 저장된 내용은 모두 사라져요')) return;
  const id = activeChatId;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('채팅이 휴지통으로 이동되었습니다.');
  saveIndex(); closeDrawer(); activeChatId = null; goMain(); switchTab('chat');
}

async function deleteChat(id) {
  if (!confirm('이 채팅을 삭제할까요?')) return;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('채팅이 휴지통으로 이동되었습니다.');
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
  showToast(s.hidden ? '채팅이 숨겨졌어요.' : '채팅이 다시 보이게 했어요.');
}

// ===============
//  NEW CHAT MODAL
// ===============
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
    const neutral = await getEmotionImage(p.pid, 'neutral', 200);
    const imgSrc = neutral || p.image;
    card.innerHTML = `
      <div class="select-card-img">${imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue)}</div>
      <div class="select-card-name">${esc(p.name)}</div>
      <div class="check"></div>`;
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
  closeNewChatModal();
  saveSession(session.id);
  saveIndex();
  if (typeof flushPendingRemoteSaves === 'function') flushPendingRemoteSaves();
  renderChatList();
  openChat(session.id);
}

// ===============
//  CHAT AREA & MESSAGES
// ===============
async function openChat(id) {
  _isDemoMode = false;
  activeChatId = id;
  runActiveChatWarmup(id).catch(() => {});
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
    const headSrc = p.neutral_thumb || '';
    const img = headSrc ? `<img src="${headSrc}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
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
  updateChatHeaderAvatarVisibility();

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

  // 첫 번째 페르소나 기본 모델을 일시적으로만 동기화
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

  // _loaded 없으면 무조건 로드
  if (!s._loaded) {
    loadSession(id);
    return;
  }

  // KV updatedAt 비교 후 로컬보다 최신이면 강제 리프레시
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
    document.getElementById('emptyText').textContent = pList.map(p=>p.name).join(', ') + '님께 메시지를 입력해보세요';
    return;
  }
  area.classList.add('has-messages');
  empty.style.display = 'none';
  area.dataset.imageLoadStick = '1';
  setTimeout(() => {
    if (document.getElementById('chatArea') === area) area.dataset.imageLoadStick = '0';
  }, 2600);

  const fragment = document.createDocumentFragment();
  for (const msg of session.history) {
    const el = document.createElement('div');
    if (msg.role === 'user') {
  let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.find(c=>c.type==='text')?.text||'(메시지)' : '(또는 텍스트)');
  el.innerHTML = msg._rendered || renderUserMessageHTML(msg);
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
  bindImageLoadBottomStick(area);
  layoutHorizontalMasonryRows(area);
  requestAnimationFrame(() => { stickChatToBottom(area); });
  if (_pendingArchiveFocus) setTimeout(() => focusPendingArchiveMessage(), 40);
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
    showToast('클립보드에 복사되었습니다', 1200);
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = btn.dataset.orig; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(plainText).then(markDone).catch(() => { doFallback(); markDone(); });
  } else { doFallback(); markDone(); }
}

async function renderAIResponseHTML(rawText, pList, suffixes = {}, createdAt = null, forceOneToOne = null) {
  const segments = parseResponse(rawText, pList);
  const isOneToOne = forceOneToOne == null ? (pList || []).length <= 1 : !!forceOneToOne;
  let html = '';
  for (const seg of segments) {
    seg.content = sanitizeTextForUnicodeSafety(seg.content);
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
    const celebStroke = '';
    
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
    const plainWithoutImage = String(seg.content || '')
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\s+/g, '')
      .trim();
    const isImageOnly = hasImg && !plainWithoutImage;
    const bubbleWrapClass = hasImg ? 'bubble-wrap has-img' : 'bubble-wrap';
    const bubbleClass = hasImg
      ? `ai-bubble md-content has-img${isImageOnly ? ' ai-bubble-image-only' : ''}`
      : 'ai-bubble md-content';

    // 클릭 시 팝업 연결 (이미지에 onclick 주입)
    let renderedContent = fmtContent;
    if (hasImg && imageUrls.length > 0) {
      renderedContent = fmtContent.replace(
        /<img([^>]*?)src="([^"]+)"([^>]*?)>/gi,
        (_, pre, src, post) => {
          const safeSrc = String(src || '').replace(/'/g, "\\'");
          const safeKey = String(extractR2ImageKey(src) || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `<div class="inline-image-wrap"><img${pre}src="${src}"${post} onclick="openImagePopup('${safeSrc}')" style="cursor:pointer"><div class="inline-image-actions"><button class="image-popup-action-btn" onclick="addImageSourceToComposer('${safeSrc}','generated.jpg')" title="소스로 추가"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button><button class="image-popup-action-btn" onclick="downloadImage('${safeSrc}','generated.jpg')" title="다운로드"><svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg></button></div></div>`;
        }
      );
    }

    // 저장 버튼
    const dlBtn = '';

    html += `<div class="ai-msg ${hasImg ? 'ai-msg-img' : 'ai-msg-text'} ${isOneToOne ? 'one-to-one' : ''}" style="${opacity}">
      <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);${celebStroke};${avDisplay}${avShape}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'${safeThumb}','${safeSuffix}')">${baseImg}</div>
      <div class="bubble-col">
        <div class="msg-pname" style="color:hsl(${h},65%,72%)">
          <span class="msg-pname-text">${esc(p.name)}${p._ghost?`<span style="font-size:9px;opacity:.5">(삭제)</span>`:''}</span>
          
        </div>
        <div class="${bubbleWrapClass}">
          <div class="${bubbleClass}" style="background:hsl(${h},25%,13%);color:hsl(${h},55%,85%)">${renderedContent}</div>
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
    const html = await renderAIResponseHTML(segReply, [p], suffixes, createdAt, (pList || []).length <= 1);
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
      tgtArea.dataset.imageLoadStick = '1';
      setTimeout(() => {
        if (document.getElementById('chatArea') === tgtArea) tgtArea.dataset.imageLoadStick = '0';
      }, 2600);
      bindImageLoadBottomStick(tgtArea);
      layoutHorizontalMasonryRows(tgtArea);
      stickChatToBottom(tgtArea);
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

// ===============
//  INPUT BAR & SEND
// ===============
function setMode(m) {
  currentMode = m;
  const selectEl = document.getElementById('chatModeSelect');
  if (selectEl && selectEl.value !== m) selectEl.value = m;
}

// ===============
//  입력 탭 (채팅 / 이미지 / 컨텍스트)
// ===============
let _inputTab = 'chat'; // 현재 입력 탭
let _chatGeneration = null;
let _lastImageModelValue = '';
let _popupZoomed = false;
let _popupPanning = false;
let _popupPanOffset = { x: 0, y: 0 };
let _popupPanLast = { x: 0, y: 0 };
let _popupZoomLevel = 1;
let _popupSuppressCloseUntil = 0;

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

function updateComposerToolButtonForMode(normalizedMode) {
  const btn = document.getElementById('toolBtn');
  if (!btn) return;
  const isImage = normalizedMode === 'image';
  const isProject = normalizedMode === 'project';
  btn.classList.toggle('active', isImage || isProject);
  if (isImage) {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    return;
  }
  if (isProject) {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l2-3h14l2 3"/><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M9 12h6"/></svg>';
    return;
  }
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 12h8M16.5 7.5l-8 4.5M16.5 16.5l-8-4.5"/></svg>';
}

function setImageProvider(provider) {
  const select = document.getElementById('imageModelSelect');
  if (!select) return;
  const valueMap = {
    gemini: 'gemini-3.1-flash-image-preview',
    openai: 'gpt-image-1.5',
    xai: 'grok-imagine-image-pro'
  };
  const selectedValue = valueMap[provider] || valueMap.xai;
  if (select.value !== selectedValue) select.value = selectedValue;
  document.getElementById('imgProvGemini')?.classList.toggle('on', provider === 'gemini');
  document.getElementById('imgProvOpenAI')?.classList.toggle('on', provider === 'openai');
  document.getElementById('imgProvXai')?.classList.toggle('on', provider === 'xai');
}

function syncImageProviderButtonsFromSelect() {
  const selected = document.getElementById('imageModelSelect')?.value || '';
  const provider = selected.startsWith('gemini')
    ? 'gemini'
    : selected.startsWith('gpt-image')
      ? 'openai'
      : 'xai';
  setImageProvider(provider);
}

function clearImageWorkflowHistory(session) {
  if (!session || !Array.isArray(session.history)) return;
  const before = session.history.length;
  session.history = session.history.filter(m => !isImageWorkflowMessage(m));
  if (session.history.length === before) return;
  const latest = session.history.at(-1);
  const latestText = typeof latest?.content === 'string'
    ? latest.content
    : (Array.isArray(latest?.content) ? (latest.content.find(c => c?.type === 'text')?.text || '') : '');
  session.lastPreview = sanitizeChatListPreview(buildChatPreviewText(latestText));
  session.updatedAt = Date.now();
  renderChatArea().catch(() => {});
  renderChatList();
  if (!session._demo) { saveSession(session.id); saveIndex(); }
}

function handleImageModelChanged() {
  const select = document.getElementById('imageModelSelect');
  if (!select) return;
  const nextModel = String(select.value || '');
  if (_lastImageModelValue && nextModel && _lastImageModelValue !== nextModel) {
    const session = getActiveSession();
    if (session) clearImageWorkflowHistory(session);
    attachments = [];
    renderAttachmentPreviews();
    showToast('모델 변경으로 이미지 참조/히스토리를 초기화했습니다.');
  }
  _lastImageModelValue = nextModel;
  syncImageProviderButtonsFromSelect();
}

function switchInputTab(tab) {
  _inputTab = tab;
  const normalized = tab === 'context' ? 'project' : tab;
  const tabbar = document.querySelector('.input-tabbar');
  if (tabbar) {
    const show = (tab === 'image' || tab === 'context');
    tabbar.style.display = show ? 'flex' : 'none';
    tabbar.classList.toggle('image-floating', tab === 'image');
    if (tab === 'image') {
      tabbar.classList.remove('image-enter');
      void tabbar.offsetWidth;
      tabbar.classList.add('image-enter');
    } else {
      tabbar.classList.remove('image-enter');
    }
  }
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
  // 도구 버튼/배지 UI 동기화
  ['chat','image','project'].forEach(t => {
    document.getElementById('toolMode_' + t)?.classList.toggle('active', t === normalized);
  });
  if (normalized === 'image') handleImageModelChanged();
  updateComposerToolButtonForMode(normalized);
  const chip = document.getElementById('composerModeChip');
  if (chip) {
    if (normalized === 'image') {
      chip.textContent = '이미지 생성';
      chip.classList.add('show');
    } else if (normalized === 'project') {
      chip.textContent = '프로젝트 파일';
      chip.classList.add('show');
    } else {
      chip.classList.remove('show');
    }
  }
  const menu = document.getElementById('composerToolsMenu');
  if (menu) menu.classList.add('hidden');
// 영역 분리 제거: 뷰와 무관하게 항상 단일 chatArea 유지
}

function toggleComposerTools() {
  const menu = document.getElementById('composerToolsMenu');
  if (!menu) return;
  menu.classList.toggle('hidden');
}

function selectToolMode(mode) {
  if (mode === 'project') {
    switchInputTab('context');
    showToast('?프로젝트 기능은 준비중이야');
    return;
  }
  if (mode === 'image') {
    switchInputTab('image');
    return;
  }
  switchInputTab('chat');
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
  el.style.height = Math.min(el.scrollHeight, 220) + 'px';
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

  return `${worldPart}${userPart}${personaPart}

형식:
${formatEx}
emotion: ${EMOTIONS.join('/')}
규칙: emotion 태그는 반드시 pid 태그 바로 뒤에 한 번만. 내용 안에 [감정명] 태그 넣기 금지. 이름: 접두사 금지.${modeInstr ? '\n' + modeInstr : ''}
인칭은 자연스러운 맥락에서만 가급적 사용. 매 발화 시작에 붙이지 말 것
필요한 태그 내용은 마크다운(**, 코드블록, 목록 등) 사용 가능`;
}

function renderUserBubbleHTML(text, atts) {
  let html = '';
  atts.forEach(a => {
    const url = getAttachmentPreviewUrl(a);
    html += `
    <div class="bubble-img-container">
      <img class="bubble-img" src="${url}" onclick="openImagePopup('${url}')">
    </div>`;
  });
  if (text) html += fmt(text);
  return html;
}

function renderUserBubbleHTMLV2(text, atts) {
  let html = '';
  (atts || []).forEach(a => {
    const isImg = isImageAttachment(a);
    const viewUrl = isImg ? getAttachmentPreviewUrl(a) : (a?.url || a?.transportUrl || a?.dataUrl || '');
    const dlUrl = a?.url || getAttachmentStoredUrl(a) || viewUrl;
    if (!viewUrl) return;
    const safeViewUrl = String(viewUrl).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeName = String(a?.name || (isImg ? 'image' : 'file')).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (isImg) {
      html += `
      <div class="bubble-img-container">
        <div class="inline-image-wrap">
          <img class="bubble-img" src="${viewUrl}" onclick="openImagePopup('${safeViewUrl}')">
          <div class="inline-image-actions">
            <button class="image-popup-action-btn" onclick="downloadImage('${safeViewUrl}','${safeName}')" title="다운로드">
              <svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    } else {
      html += `
      <div class="bubble-file-container">
        <a class="bubble-file-link" href="${dlUrl}" target="_blank" rel="noopener">${esc(a?.name || 'file')}</a>
      </div>`;
    }
  });
  if (text) html += fmt(text);
  return html;
}

function renderUserMessageHTML(msg) {
  const attachmentsForRender = getMessageAttachments(msg);
  const text = typeof msg?.content === 'string'
    ? msg.content
    : (Array.isArray(msg?.content) ? msg.content.find(c => c?.type === 'text')?.text || '' : '');
  const cleanedText = attachmentsForRender.length ? text.replace(/\n\nAttached files:\n[\s\S]*$/m, '') : text;
  return `<div class="msg-group"><div class="user-msg">${renderUserBubbleHTMLV3(cleanedText, attachmentsForRender)}</div></div>`;
}

function renderUserBubbleHTMLV3(text, atts) {
  let html = '';
  let imageItemsHtml = '';
  let imageCount = 0;
  (atts || []).forEach(a => {
    const isImg = isImageAttachment(a);
    const viewUrl = isImg ? getAttachmentPreviewUrl(a) : (a?.url || a?.transportUrl || a?.dataUrl || '');
    const dlUrl = a?.url || getAttachmentStoredUrl(a) || viewUrl;
    if (!viewUrl) return;
    const safeViewUrl = String(viewUrl).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeName = String(a?.name || (isImg ? 'image' : 'file')).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeKey = String(extractR2ImageKey(viewUrl) || safeViewUrl).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (isImg) {
      imageCount++;
      imageItemsHtml += `
      <div class="inline-image-wrap">
        <img class="bubble-img" src="${viewUrl}" onclick="openImagePopup('${safeViewUrl}')">
        <div class="inline-image-actions">
          <button class="image-popup-action-btn" onclick="addImageSourceToComposer('${safeViewUrl}','${safeName}')" title="소스로 추가">
            <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
          <button class="image-popup-action-btn" onclick="downloadImage('${safeViewUrl}','${safeName}')" title="다운로드">
            <svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg>
          </button>
        </div>
      </div>`;
    } else {
      html += `
      <div class="bubble-file-container">
        <a class="bubble-file-link" href="${dlUrl}" target="_blank" rel="noopener">${esc(a?.name || 'file')}</a>
      </div>`;
    }
  });
  if (imageItemsHtml) html += `<div class="bubble-img-container${imageCount > 1 ? ' multi' : ''}">${imageItemsHtml}</div>`;
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
  const pendingImageUploads = attachments.filter(isImageAttachment).map(a => a?.uploadPromise).filter(Boolean);
  if (pendingImageUploads.length) await Promise.allSettled(pendingImageUploads);
  const historyImageUrls = attachments
    .filter(isImageAttachment)
    .map(getAttachmentStoredUrl)
    .map(sanitizeImageUrlForHistory)
    .filter(Boolean);
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

  // 이미지 편집용 참조 이미지: attachments 클리어 전에 미리 캡처
  const userHTML = renderUserBubbleHTMLV3(text, attachments);
  
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
    ? buildUserMessageContentV2(text, historyImageUrls, attachments.filter(a => !isImageAttachment(a)).map(a => ({ name: a.name || 'file', url: getAttachmentStoredUrl(a) })).filter(f => !!f.url))
    : text || '(빈글)';
  const requestFileRefs = [];
  for (const attachment of attachments.filter(a => !isImageAttachment(a))) {
    const fileUrl = await getAttachmentRequestUrl(attachment, targetModel, isImageReq);
    if (fileUrl) requestFileRefs.push({ name: attachment.name || 'file', url: fileUrl });
  }
  const requestMsgContent = attachments.length > 0
    ? buildUserMessageContentV2(text, requestImageUrls, requestFileRefs)
    : text || '(빈글)';

  const nowTs = Date.now();
  const persistedAttachments = attachments.map(serializeAttachmentForHistory).filter(Boolean);
  const userMsg = {
    role:'user',
    content: msgContent,
    attachments: persistedAttachments,
    createdAt: nowTs,
    _imageWorkflow: !!isImageReq,
    _rendered:`<div class="msg-group"><div class="user-msg">${userHTML}</div></div>`
  };
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
    layoutHorizontalMasonryRows(area);
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
    let generatedImageUrl = '';
    if (session._demo) {
      await new Promise(r => setTimeout(r, 600));
      reply = window.getDemoReply ? window.getDemoReply(session) : '데모 응답 오류';
    } else {
      try {
        const apiMessages = [
          { role:'system', content: buildSystemPrompt(session) },
          buildCurrentTimeSystemMessage(),
          ...buildApiMessagesFromHistory(session.history, userMsg, requestMsgContent, isImageReq)
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
            const personaFileRefs = [];
            for (const attachment of sentAttachments.filter(a => !isImageAttachment(a))) {
              const fileUrl = await getAttachmentRequestUrl(attachment, getPersonaModel(persona), false);
              if (fileUrl) personaFileRefs.push({ name: attachment.name || 'file', url: fileUrl });
            }
            const personaRequestMsgContent = sentAttachments.length > 0
              ? buildUserMessageContentV2(text, personaImageUrls, personaFileRefs)
              : text || '(빈글)';
            const personaMessages = [
              { role:'system', content: buildSystemPrompt(session, [persona]) },
              buildCurrentTimeSystemMessage(),
              ...buildApiMessagesFromHistory(session.history, userMsg, personaRequestMsgContent, isImageReq)
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
              parts.push(`[${persona.pid}]응답생성 오류: ${data.error||'알 수 없는 오류'}[/${persona.pid}]`);
            } else {
              parts.push(wrapPersonaReply(persona.pid, sanitizeTextForUnicodeSafety(data.reply || '')));
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
          reply = sanitizeTextForUnicodeSafety(data.reply || '');
          if (isImageReq) {
            const rawImageUrl = extractImageUrlFromApiData(data);
            const proxiedImageUrl = /^https?:\/\//i.test(rawImageUrl || '')
              ? `${wUrl}/image-fetch?url=${encodeURIComponent(rawImageUrl)}`
              : '';
            const safeImageUrl = proxiedImageUrl || rawImageUrl;
            if (safeImageUrl) {
              generatedImageUrl = safeImageUrl;
              reply = `![generated](${safeImageUrl})`;
            } else {
              throw new Error('이미지 URL 응답이 비어 있습니다.');
            }
          }
        }
        }
      } catch(e) {
        if (e?.name === 'AbortError') throw e;
        const pid0 = session.participantPids?.[0] || 'p';
        reply = sanitizeTextForUnicodeSafety(`[${pid0}]연결 실패: ${e.message}[/${pid0}]`);
      }
    }
    reply = normalizeGeneratedMarkdown(sanitizeTextForUnicodeSafety(reply));

    if (thinkEl.parentNode) thinkEl.remove();
    
    // 백그라운드 처리 중 세션이 삭제되었는지 체크
    const currentSession = sessions.find(s => s.id === session.id);
    if (!currentSession) return;

    // 생성된 이미지의 data URL / 원격 URL 모두 R2에 업로드 후 교체
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
    currentSession.history.push({
      role:'assistant',
      content:reply,
      createdAt: assistantCreatedAt,
      personaSnapshot,
      _suffixes: suffixes,
      _imageWorkflow: !!isImageReq
    });

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
    if (isImageReq && generatedImageUrl) {
      attachments = [{
        id: uid(),
        type: 'image',
        name: 'reference-1-generated.jpg',
        mimeType: 'image/jpeg',
        dataUrl: generatedImageUrl,
        previewUrl: generatedImageUrl,
        transportUrl: generatedImageUrl,
        uploading: false,
        uploadError: false,
        source: 'generated'
      }];
      renderAttachmentPreviews();
    }
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
  addFilesToAttachments(input.files, 'picker').catch(e => showToast('파일 추가 실패: ' + e.message));
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
      ? `<img src="${getAttachmentPreviewUrl(a) || a.dataUrl || ''}">`
      : `<div class="attachment-file">${a.name || '파일'}</div>`;
    const status = a.uploading
      ? `<div class="attachment-status"><div class="attachment-spinner"></div></div>`
      : a.uploadError
        ? `<div class="attachment-status attachment-status-error">!</div>`
        : '';
    div.innerHTML = `${media}${status}<button class="remove-btn" onclick="removeAttachment(${i})">x</button>`;
    row.appendChild(div);
  });
  const hasImageAttachment = attachments.some(a => a?.type === 'image');
  if (hasImageAttachment) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'attachment-add-thumb';
    addBtn.onclick = () => document.getElementById('fileInput')?.click();
    addBtn.innerHTML = '<span class="plus">+</span><span class="label">ADD</span>';
    row.appendChild(addBtn);
  }
}

function guessImageNameFromUrl(url, fallback = 'reference-from-chat.jpg') {
  try {
    const u = new URL(String(url || '').trim());
    const base = String(u.pathname || '').split('/').pop() || '';
    if (base) return base;
  } catch {}
  return fallback;
}

function addImageSourceToComposer(url, name = '') {
  const target = String(url || '').trim();
  if (!target) return;
  if (!Array.isArray(attachments)) attachments = [];
  const exists = attachments.some(a => a?.type === 'image' && (
    String(getAttachmentStoredUrl(a) || '').trim() === target ||
    String(getAttachmentPreviewUrl(a) || '').trim() === target ||
    String(a?.dataUrl || '').trim() === target
  ));
  if (exists) {
    showToast('이미 소스로 추가되어 있습니다.');
    return;
  }
  attachments.push({
    id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name: name || guessImageNameFromUrl(target),
    mimeType: 'image/jpeg',
    dataUrl: target,
    previewUrl: target,
    transportUrl: target,
    uploading: false,
    uploadError: false,
    source: 'bubble'
  });
  renderAttachmentPreviews();
  document.getElementById('userInput')?.focus();
  showToast('이미지를 소스에 추가했습니다.');
}
async function removeAttachment(i) {
  const removed = attachments.splice(i,1)[0];
  if (removed?.originalCacheKey) await idbDel(removed.originalCacheKey).catch(() => {});
  renderAttachmentPreviews();
}

// ================================
//  SETTINGS DRAWER & PROMPT MODAL
// ================================
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
const neutral = await getNeutralImageThumb(p.pid, 42);
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
      const headSrc = p.neutral_thumb || '';
      const img = headSrc ? `<img src="${headSrc}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
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
  const img = session?.userOverride?.image || userProfile?.image || '';
  const safeImg = String(img).replace(/"/g, '&quot;');

  return safeImg
    ? `<img src="${safeImg}" style="width:100%;height:100%;object-fit:cover;object-position:top">`
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
  saveIndex(); showToast('유저 프로필 저장됨'); renderDrawerBody(s);
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
    const neutral = await getEmotionImage(p.pid, 'neutral', 200);
    const imgSrc = neutral || p.image;
    card.innerHTML = `
      <div class="select-card-img">${imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue)}</div>
      <div class="select-card-name">${esc(p.name)}</div>
      <div class="check" style="position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;background:var(--text);display:none;align-items:center;justify-content:center;font-size:10px"></div>`;
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

// ================================
//  ARCHIVE
// ================================
let _archiveFilter = 'all';
let _archiveItems = [];
let _archiveLoaded = false;
let _archivePopupContext = null;
let _pendingArchiveFocus = null;
const ARCHIVE_MANIFEST_CACHE_KEY = 'archive_manifest_v1';
const ARCHIVE_INITIAL_LOAD = 30;
const ARCHIVE_LOAD_MORE = 10;
const ARCHIVE_PREFETCH_PAGES = 1;
let _archiveVisibleCount = ARCHIVE_INITIAL_LOAD;
let _archiveScrollBound = false;
let _archiveSelectionMode = false;
let _archiveSelectedKeys = new Set();
let _archiveLongPressTimer = null;

function extractR2ImageKey(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const local = raw.match(/\/image\/(.+)$/i);
  if (local?.[1]) return decodeURIComponent(local[1].split('?')[0]);
  try {
    const u = new URL(raw);
    const fromPath = String(u.pathname || '').match(/\/image\/(.+)$/i);
    if (fromPath?.[1]) return decodeURIComponent(fromPath[1].split('?')[0]);
  } catch {}
  return '';
}

function getArchiveTypeByKey(key) {
  if (String(key || '').startsWith('img_generated/')) return 'generated';
  if (String(key || '').startsWith('img_uploaded/')) return 'upload';
  return 'other';
}

function getFilenameFromR2Key(key, fallback = 'image.jpg') {
  const raw = String(key || '').trim();
  if (!raw) return fallback;
  const base = raw.split('/').pop() || '';
  return base || fallback;
}

function normalizeArchiveKey(rawKey) {
  const raw = String(rawKey || '').trim();
  if (!raw) return '';
  const fromUrl = extractR2ImageKey(raw);
  if (fromUrl) return fromUrl;
  try {
    const u = new URL(raw);
    const p = decodeURIComponent(String(u.pathname || '').replace(/^\/+/, ''));
    if (p.startsWith('img_generated/') || p.startsWith('img_uploaded/')) return p;
  } catch {}
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function buildArchiveSourceMap() {
  const out = new Map();
  (sessions || []).forEach((s) => {
    const sid = s?.id;
    if (!sid || !Array.isArray(s.history)) return;
    s.history.forEach((m, idx) => {
      const urls = new Set();
      const c = m?.content;
      if (typeof c === 'string') {
        const mdMatches = c.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi) || [];
        mdMatches.forEach((token) => {
          const hit = token.match(/\((https?:\/\/[^)\s]+)\)/i);
          if (hit?.[1]) urls.add(hit[1]);
        });
      } else if (Array.isArray(c)) {
        c.forEach((part) => {
          if (part?.type === 'image_url' && part?.image_url?.url) urls.add(part.image_url.url);
        });
      }
      (m?.attachments || []).forEach((a) => {
        const url = getAttachmentStoredUrl(a) || a?.url || a?.transportUrl || '';
        if (url) urls.add(url);
      });
      urls.forEach((url) => {
        const key = extractR2ImageKey(url);
        if (!key || out.has(key)) return;
        out.set(key, { chatId: sid, messageIndex: idx });
      });
    });
  });
  return out;
}

async function loadArchiveManifestFromR2() {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return [];
  const [genRes, uploadRes] = await Promise.all([
    fetch(`${wUrl}/image-list/img_generated`).then((r) => r.ok ? r.json() : { keys: [] }).catch(() => ({ keys: [] })),
    fetch(`${wUrl}/image-list/img_uploaded`).then((r) => r.ok ? r.json() : { keys: [] }).catch(() => ({ keys: [] })),
  ]);
  const keys = [...(genRes?.keys || []), ...(uploadRes?.keys || [])];
  const sourceMap = buildArchiveSourceMap();
  const now = Date.now();
  const seen = new Set();
  return keys
    .filter(Boolean)
    .map((key) => {
      const normalizedKey = normalizeArchiveKey(key);
      if (!normalizedKey || seen.has(normalizedKey)) return null;
      seen.add(normalizedKey);
      const mapped = sourceMap.get(normalizedKey) || sourceMap.get(key) || {};
      return {
        key: normalizedKey,
        url: `${wUrl}/image/${encodeURIComponent(normalizedKey).replace(/%2F/gi, '/')}`,
        type: getArchiveTypeByKey(normalizedKey),
        chatId: mapped.chatId || null,
        messageIndex: Number.isFinite(mapped.messageIndex) ? mapped.messageIndex : null,
        updatedAt: now,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function ensureArchiveManifest() {
  if (_archiveLoaded) return;
  const cached = await idbGet(ARCHIVE_MANIFEST_CACHE_KEY).catch(() => null);
  if (Array.isArray(cached) && cached.length) {
    _archiveItems = cached
      .map((it) => {
        const normalizedKey = normalizeArchiveKey(it?.key || it?.url);
        if (!normalizedKey) return null;
        const base = wUrlForImage();
        return {
          ...it,
          key: normalizedKey,
          url: base ? `${base}/image/${encodeURIComponent(normalizedKey).replace(/%2F/gi, '/')}` : String(it?.url || ''),
          type: getArchiveTypeByKey(normalizedKey),
        };
      })
      .filter(Boolean);
  }
  renderArchiveGrid();
  const fresh = await loadArchiveManifestFromR2();
  _archiveItems = fresh;
  _archiveLoaded = true;
  await idbSet(ARCHIVE_MANIFEST_CACHE_KEY, fresh).catch(() => {});
}

function wUrlForImage() {
  return (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
}

function setArchiveFilter(filter) {
  _archiveFilter = filter;
  _archiveVisibleCount = ARCHIVE_INITIAL_LOAD;
  _archiveSelectionMode = false;
  _archiveSelectedKeys = new Set();
  document.getElementById('archiveFilterAll')?.classList.toggle('active', filter === 'all');
  document.getElementById('archiveFilterGenerated')?.classList.toggle('active', filter === 'generated');
  document.getElementById('archiveFilterUpload')?.classList.toggle('active', filter === 'upload');
  renderArchiveGrid();
  prefetchArchiveNextPage();
}

function getFilteredArchiveItems() {
  if (_archiveFilter === 'all') return _archiveItems;
  return (_archiveItems || []).filter((it) => it.type === _archiveFilter);
}

function renderArchiveGrid() {
  const grid = document.getElementById('archiveGrid');
  const empty = document.getElementById('archiveEmpty');
  if (!grid || !empty) return;
  const rows = getFilteredArchiveItems();
  if (!rows.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    empty.textContent = _archiveLoaded ? '아카이브 이미지가 없습니다.' : '이미지를 불러오는 중...';
    return;
  }
  empty.style.display = 'none';
  const visible = rows.slice(0, _archiveVisibleCount);
  grid.innerHTML = visible.map((it) => {
    const safeUrl = String(it.url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeKey = String(it.key || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeFile = String(getFilenameFromR2Key(it.key, 'image.jpg')).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const selected = _archiveSelectedKeys.has(it.key) ? ' selected' : '';
    return `<div class="archive-card${selected}" onclick="handleArchiveCardTap('${safeKey}')" oncontextmenu="return false" onpointerdown="startArchiveLongPress(event,'${safeKey}')" onpointerup="cancelArchiveLongPress()" onpointerleave="cancelArchiveLongPress()" onpointercancel="cancelArchiveLongPress()">
      <img src="${it.url}" loading="lazy" onerror="handleArchiveImageError(this,'${safeKey}')">
      <div class="archive-card-check">✓</div>
      <div class="archive-card-actions" onclick="event.stopPropagation()">
        <button class="archive-action-btn icon" onclick="editArchiveImage('${safeKey}')" title="편집하기" aria-label="편집하기">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="archive-action-btn icon" onclick="jumpToImageConversation('${safeKey}')" title="대화로 이동" aria-label="대화로 이동">
          <svg viewBox="0 0 24 24"><path d="M4 6h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2"/><circle cx="9" cy="11.5" r="1"/><circle cx="12" cy="11.5" r="1"/><circle cx="15" cy="11.5" r="1"/></svg>
        </button>
        <button class="archive-action-btn icon" onclick="downloadImage('${safeUrl}','${safeFile}')" title="다운로드" aria-label="다운로드">
          <svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
  updateArchiveSelectionUi();
  if (rows.length > visible.length) {
    empty.style.display = 'block';
    empty.textContent = `스크롤하면 더 불러옵니다 (${visible.length}/${rows.length})`;
  } else {
    empty.style.display = 'none';
  }
}

async function renderArchivePane() {
  if (typeof preloadAllSessions === 'function') {
    await preloadAllSessions().catch(() => {});
  }
  setArchiveFilter(_archiveFilter || 'all');
  await ensureArchiveManifest();
  renderArchiveGrid();
  bindArchiveInfiniteScroll();
  prefetchArchiveNextPage();
}

function bindArchiveInfiniteScroll() {
  if (_archiveScrollBound) return;
  const pane = document.querySelector('#archivePane .archive-pane');
  if (!pane) return;
  _archiveScrollBound = true;
  pane.addEventListener('contextmenu', (e) => e.preventDefault());
  pane.addEventListener('scroll', () => {
    const nearBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 140;
    if (!nearBottom) return;
    const total = getFilteredArchiveItems().length;
    if (_archiveVisibleCount >= total) return;
    _archiveVisibleCount = Math.min(total, _archiveVisibleCount + ARCHIVE_LOAD_MORE);
    renderArchiveGrid();
    prefetchArchiveNextPage();
  }, { passive: true });
}

function prefetchArchiveNextPage() {
  const rows = getFilteredArchiveItems();
  if (!rows.length) return;
  const start = _archiveVisibleCount;
  const end = Math.min(rows.length, start + (ARCHIVE_LOAD_MORE * ARCHIVE_PREFETCH_PAGES));
  if (end <= start) return;
  rows.slice(start, end).forEach((it) => {
    const img = new Image();
    img.src = it.url;
  });
}

function handleArchiveImageError(imgEl, key) {
  if (!imgEl) return;
  imgEl.style.opacity = '0.25';
  imgEl.alt = 'broken';
  imgEl.dataset.broken = '1';
  const card = imgEl.closest('.archive-card');
  if (card) card.title = `이미지를 불러오지 못했습니다: ${key}`;
}

async function editArchiveImage(key) {
  const normalizedKey = normalizeArchiveKey(key);
  const hit = (_archiveItems || []).find((it) => normalizeArchiveKey(it.key) === normalizedKey);
  if (!hit?.url) {
    showToast('이미지 정보를 찾을 수 없습니다.');
    return;
  }
  const persona1Pid = Array.isArray(personas) && personas[0]?.pid ? personas[0].pid : null;
  if (!persona1Pid) {
    showToast('페르소나 1을 찾을 수 없습니다.');
    return;
  }
  const session = {
    id: uid(), participantPids: [persona1Pid],
    roomName: '',
    responseMode: 'auto',
    worldContext: '',
    history: [], updatedAt: Date.now(), lastPreview: '', _loaded: true
  };
  sessions.push(session);
  activeChatId = session.id;
  saveIndex();
  await renderChatList();
  switchTab('chat');
  await openChat(session.id);
  switchInputTab('image');
  addImageSourceToComposer(hit.url, getFilenameFromR2Key(hit.key, 'image.jpg'));
  showToast('편집용 새 채팅을 열었습니다.');
}

function openArchiveImagePopup(key) {
  if (_archiveSelectionMode) return;
  const hit = (_archiveItems || []).find((it) => it.key === key);
  if (!hit?.url) return;
  openImagePopup(hit.url);
  _archivePopupContext = hit;
  const deleteBtn = document.getElementById('popupDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = 'inline-flex';
}

function startArchiveLongPress(e, key) {
  if (_archiveSelectionMode) return;
  if (e?.pointerType === 'mouse' && e?.button !== 0) return;
  cancelArchiveLongPress();
  _archiveLongPressTimer = setTimeout(() => {
    _archiveSelectionMode = true;
    _archiveSelectedKeys.add(key);
    renderArchiveGrid();
    try { navigator.vibrate?.(20); } catch {}
  }, 420);
}

function cancelArchiveLongPress() {
  if (!_archiveLongPressTimer) return;
  clearTimeout(_archiveLongPressTimer);
  _archiveLongPressTimer = null;
}

function handleArchiveCardTap(key) {
  cancelArchiveLongPress();
  if (_archiveSelectionMode) {
    if (_archiveSelectedKeys.has(key)) _archiveSelectedKeys.delete(key);
    else _archiveSelectedKeys.add(key);
    if (_archiveSelectedKeys.size === 0) _archiveSelectionMode = false;
    renderArchiveGrid();
    return;
  }
  openArchiveImagePopup(key);
}

function updateArchiveSelectionUi() {
  const btn = document.getElementById('archiveBatchDeleteBtn');
  const cancelBtn = document.getElementById('archiveBatchCancelBtn');
  if (!btn) return;
  const cnt = _archiveSelectedKeys.size;
  btn.disabled = cnt <= 0;
  btn.title = cnt > 0 ? `선택 삭제 (${cnt})` : '선택 삭제';
  if (cancelBtn) cancelBtn.style.display = _archiveSelectionMode ? 'inline-flex' : 'none';
}

function clearArchiveSelection() {
  _archiveSelectedKeys = new Set();
  _archiveSelectionMode = false;
  renderArchiveGrid();
}

async function deleteSelectedArchiveImages() {
  const keys = [..._archiveSelectedKeys];
  if (!keys.length) return;
  if (!confirm(`선택한 ${keys.length}개 이미지를 R2에서 삭제할까요?`)) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  let deleted = 0;
  const deletedKeySet = new Set();
  for (const key of keys) {
    const targetKey = normalizeArchiveKey(key);
    const res = await fetch(`${wUrl}/image/${encodeURIComponent(targetKey).replace(/%2F/gi, '/')}`, { method: 'DELETE' }).catch(() => null);
    if (res && (res.ok || res.status === 404)) {
      deleted++;
      deletedKeySet.add(targetKey);
    }
  }
  if (deleted > 0) {
    _archiveItems = (_archiveItems || []).filter((it) => !deletedKeySet.has(normalizeArchiveKey(it.key)));
    await idbSet(ARCHIVE_MANIFEST_CACHE_KEY, _archiveItems).catch(() => {});
  }
  _archiveSelectedKeys = new Set();
  _archiveSelectionMode = false;
  renderArchiveGrid();
  showToast(`${deleted}개 삭제했습니다.`);
}

async function deletePopupImageFromArchive() {
  const ctx = _archivePopupContext;
  if (!ctx?.key) return;
  if (!confirm('이 이미지를 아카이브와 R2에서 삭제할까요?')) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  const targetKey = normalizeArchiveKey(ctx.key);
  const res = await fetch(`${wUrl}/image/${encodeURIComponent(targetKey).replace(/%2F/gi, '/')}`, { method: 'DELETE' }).catch(() => null);
  if (!res || (!res.ok && res.status !== 404)) {
    showToast('삭제에 실패했습니다.');
    return;
  }
  _archiveItems = (_archiveItems || []).filter((it) => normalizeArchiveKey(it.key) !== targetKey);
  await idbSet(ARCHIVE_MANIFEST_CACHE_KEY, _archiveItems).catch(() => {});
  closeImagePopup();
  renderArchiveGrid();
  if (res.status === 404) {
    showToast('R2에는 이미 없는 항목이라 목록에서 정리했습니다.');
    return;
  }
  showToast('아카이브에서 삭제했습니다.');
}

async function jumpToImageConversation(keyOrUrl) {
  const normalizedKey = extractR2ImageKey(keyOrUrl) || String(keyOrUrl || '');
  const hit = (_archiveItems || []).find((it) => it.key === normalizedKey || it.url === keyOrUrl);
  if (!hit?.chatId) {
    showToast('대화 위치를 찾지 못했습니다.');
    return;
  }
  _pendingArchiveFocus = { key: hit.key || normalizedKey, url: hit.url };
  switchTab('chat');
  await openChat(hit.chatId);
  setTimeout(() => focusPendingArchiveMessage(), 60);
}

function focusPendingArchiveMessage() {
  const pending = _pendingArchiveFocus;
  if (!pending) return;
  const area = document.getElementById('chatArea');
  if (!area) return;
  const key = pending.key;
  const match = [...area.querySelectorAll('img')].find((img) => {
    const src = img.getAttribute('src') || '';
    return extractR2ImageKey(src) === key || src === pending.url;
  });
  if (!match) return;
  _pendingArchiveFocus = null;
  const target = match.closest('.msg-group') || match;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('archive-jump-focus');
  setTimeout(() => target.classList.remove('archive-jump-focus'), 1300);
}

// ================================
//  PROFILE POPUP
// ================================
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
    // 1. 해당 감정의 HD 이미지 (투명도 포함)
    const hdUrl = await getEmotionImageHD(pid, eid, suffix);
    if (hdUrl && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${hdUrl}">`;
      return;
    }

    // 2. 해당 감정의 해상도 전체 이미지 (em_full_)
    const full = await idbGet(`em_full_${pid}_${target}`);
    if (full && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${full}">`;
      return;
    }

    // 3. 마지막 하단: 무표정 해상도
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

// ================================
//  IMAGE POPUP & DOWNLOAD
// ================================
let _popupImgUrl = '';

function openImagePopup(url) {
  _popupImgUrl = url;
  _archivePopupContext = null;
  const overlay = document.getElementById('imagePopup');
  const img = document.getElementById('popupImg');
  const deleteBtn = document.getElementById('popupDeleteBtn');
  if (!overlay || !img) return;
  if (deleteBtn) deleteBtn.style.display = 'none';
  img.src = url;
  img.classList.remove('zoomed');
  img.classList.remove('panning');
  _popupZoomed = false;
  _popupZoomLevel = 1;
  _popupPanning = false;
  _popupPanOffset = { x: 0, y: 0 };
  _popupPanLast = { x: 0, y: 0 };
  applyPopupImageTransform();
  updatePopupZoomButtonIcon();
  overlay.classList.add('active');
}

function closeImagePopup(e = null) {
  if (e?.stopPropagation) e.stopPropagation();
  if (Date.now() < _popupSuppressCloseUntil) return;
  const img = document.getElementById('popupImg');
  if (img) {
    img.classList.remove('zoomed');
    img.classList.remove('panning');
  }
  _popupZoomed = false;
  _popupZoomLevel = 1;
  _popupPanning = false;
  _popupPanOffset = { x: 0, y: 0 };
  _popupPanLast = { x: 0, y: 0 };
  applyPopupImageTransform();
  document.getElementById('imagePopup')?.classList.remove('active');
  document.getElementById('popupDeleteBtn')?.style && (document.getElementById('popupDeleteBtn').style.display = 'none');
  _popupImgUrl = '';
  _archivePopupContext = null;
}

function handlePopupImageTap(e = null) {
  if (e?.stopPropagation) e.stopPropagation();
  if (_popupZoomed) {
    togglePopupImageZoom();
    _popupSuppressCloseUntil = Date.now() + 180;
    return;
  }
  closeImagePopup(e);
}

function togglePopupImageZoom() {
  const img = document.getElementById('popupImg');
  if (!img) return;
  _popupZoomed = !_popupZoomed;
  _popupZoomLevel = _popupZoomed ? Math.max(1.6, _popupZoomLevel) : 1;
  img.classList.toggle('zoomed', _popupZoomed);
  if (!_popupZoomed) {
    _popupPanning = false;
    _popupPanOffset = { x: 0, y: 0 };
    _popupPanLast = { x: 0, y: 0 };
    img.classList.remove('panning');
  }
  applyPopupImageTransform();
  updatePopupZoomButtonIcon();
}

function applyPopupImageTransform() {
  const img = document.getElementById('popupImg');
  if (!img) return;
  if (!_popupZoomed) {
    img.style.transform = '';
    return;
  }
  img.style.transform = `translate(${_popupPanOffset.x}px, ${_popupPanOffset.y}px) scale(${_popupZoomLevel})`;
}

function getPopupPanPoint(e) {
  if (e?.touches?.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e?.changedTouches?.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e?.clientX || 0, y: e?.clientY || 0 };
}

function startPopupPan(e) {
  if (!_popupZoomed) return;
  const img = document.getElementById('popupImg');
  if (!img) return;
  const p = getPopupPanPoint(e);
  _popupPanning = true;
  _popupPanLast = p;
  img.classList.add('panning');
  if (e?.cancelable) e.preventDefault();
}

function movePopupPan(e) {
  if (!_popupZoomed || !_popupPanning) return;
  const p = getPopupPanPoint(e);
  const dx = p.x - _popupPanLast.x;
  const dy = p.y - _popupPanLast.y;
  _popupPanLast = p;
  _popupPanOffset.x += dx;
  _popupPanOffset.y += dy;
  _popupSuppressCloseUntil = Date.now() + 220;
  applyPopupImageTransform();
  if (e?.cancelable) e.preventDefault();
}

function endPopupPan() {
  if (!_popupPanning) return;
  const img = document.getElementById('popupImg');
  _popupPanning = false;
  _popupSuppressCloseUntil = Date.now() + 220;
  if (img) img.classList.remove('panning');
}

function handlePopupWheelZoom(e) {
  const overlay = document.getElementById('imagePopup');
  if (!overlay?.classList.contains('active')) return;
  if (e?.cancelable) e.preventDefault();
  const next = _popupZoomLevel + (e.deltaY < 0 ? 0.2 : -0.2);
  _popupZoomLevel = Math.min(4, Math.max(1, Number(next.toFixed(2))));
  _popupZoomed = _popupZoomLevel > 1.01;
  const img = document.getElementById('popupImg');
  if (img) img.classList.toggle('zoomed', _popupZoomed);
  if (!_popupZoomed) {
    _popupPanOffset = { x: 0, y: 0 };
    _popupPanLast = { x: 0, y: 0 };
  }
  _popupSuppressCloseUntil = Date.now() + 220;
  applyPopupImageTransform();
  updatePopupZoomButtonIcon();
}

function updatePopupZoomButtonIcon() {
  const btn = document.getElementById('popupZoomBtn');
  if (!btn) return;
  btn.classList.toggle('active', _popupZoomed);
  btn.innerHTML = getZoomIconSvg(_popupZoomed);
}

function getZoomIconSvg(isZoomed) {
  return isZoomed
    ? '<svg viewBox="0 0 24 24"><polyline points="3 9 3 3 9 3"/><polyline points="15 21 21 21 21 15"/><line x1="3" y1="3" x2="10" y2="10"/><line x1="21" y1="21" x2="14" y2="14"/></svg>'
    : '<svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
}

function downloadPopupImage() {
  if (!_popupImgUrl) return;
  const name = _archivePopupContext?.key
    ? getFilenameFromR2Key(_archivePopupContext.key, 'image.jpg')
    : 'generated.jpg';
  downloadImage(_popupImgUrl, name);
}

async function copyPopupImageToClipboard() {
  await copyImageToClipboard(_popupImgUrl);
}

async function copyImageToClipboard(url) {
  const target = String(url || '').trim();
  if (!target) return;
  const fallbackCopyText = async (txt) => {
    const value = String(txt || '').trim();
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch {
      return false;
    }
  };
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    const ok = await fallbackCopyText(target);
    if (ok) {
      showToast('이미지 URL을 클립보드에 복사했습니다.');
      return;
    }
    showToast('클립보드 이미지 복사를 지원하지 않는 환경입니다.');
    return;
  }
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    const proxied = /^https?:\/\//i.test(target) && wUrl
      ? `${wUrl}/image-fetch?url=${encodeURIComponent(target)}`
      : target;
    const res = await fetch(proxied);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    showToast('이미지를 클립보드에 복사했습니다.');
  } catch (e) {
    const ok = await fallbackCopyText(target);
    if (ok) {
      showToast('이미지 URL을 클립보드에 복사했습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(target);
      showToast('이미지 URL을 클립보드에 복사했습니다.');
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
  }
}

// Image-only clipboard override (no URL text fallback)
async function copyImageToClipboard(url) {
  const target = String(url || '').trim();
  if (!target) return;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    showToast('이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.');
    return;
  }
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    const proxied = /^https?:\/\//i.test(target) && wUrl
      ? `${wUrl}/image-fetch?url=${encodeURIComponent(target)}`
      : target;
    const res = await fetch(proxied, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed (${res.status})`);
    const srcBlob = await res.blob();
    const imageBlob = await (async () => {
      if (String(srcBlob.type || '').startsWith('image/png')) return srcBlob;
      const bitmap = await createImageBitmap(srcBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return await new Promise((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('png conversion failed')), 'image/png');
      });
    })();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]);
    showToast('이미지를 클립보드에 복사했습니다.');
  } catch {
    showToast('이미지 복사에 실패했습니다.');
  }
}

function toggleInlineImageZoom(btn) {
  const wrap = btn?.closest?.('.inline-image-wrap');
  const img = wrap?.querySelector?.('img');
  if (!img) return;
  const zoomed = !img.classList.contains('zoomed');
  img.classList.toggle('zoomed', zoomed);
  btn.classList.toggle('active', zoomed);
  btn.innerHTML = getZoomIconSvg(zoomed);
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
    // fetch 실패 (CORS 정책 위반으로 안됨)
    window.open(url, '_blank');
  }
}

// ================================
//  RATIO MODAL (UI)
// ================================
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
  const label = btn?.querySelector('span');
  if (label) label.textContent = ratio;
  
  // 활성시 스타일 적용
  document.querySelectorAll('#ratioPopup .ratio-item').forEach(el => {
    el.classList.toggle('active', el.textContent === ratio);
  });
  
  document.getElementById('ratioPopup').classList.add('hidden');
}

// 팝업 버튼 클릭 시 닫기
document.addEventListener('click', (e) => {
  const popup = document.getElementById('ratioPopup');
  const btn = document.getElementById('imgRatioBtn');
  if (popup && !popup.contains(e.target) && btn && !btn.contains(e.target)) {
    popup.classList.add('hidden');
  }

  const tools = document.getElementById('composerToolsMenu');
  const toolBtn = document.getElementById('toolBtn');
  if (tools && !tools.contains(e.target) && toolBtn && !toolBtn.contains(e.target)) {
    tools.classList.add('hidden');
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
  showToast(`삭제 완료 (${res.deleted || 0}/${ids.length})`);
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
      <button onclick="clearMemorySelection('private_profile','${esc(pid)}'); renderPrivateMemoryList('${esc(pid)}');" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">선택하제</button>
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
  const ticker = startMemoryProgressTicker(`개인 메모리 최적화 (${pid})`);
  showToast(`개인 메모리 최적화를 시작했습니다: ${pid}`);
  try {
    const res = await optimizeMemoriesApi({
      sessionId: session?.id || '',
      participantPids: [pid],
      includePublic: false
    });
    if (res?.ok) {
      showToast(`Private optimize done: ${res.optimized || 0} merged, ${res.removed || 0} removed`);
      setMemoryProgressLine(`개인 메모리 최적화 완료 (${pid}): ${res.optimized || 0} 정리, ${res.removed || 0} 제거`, false);
      renderPrivateMemoryList(pid, true);
      return;
    }
    const hint = res?.status ? ` (HTTP ${res.status})` : '';
    const err = String(res?.error || '').trim();
    const detail = String(res?.detail || '').trim();
    const msg = err || detail ? `: ${err || detail}` : '';
    showToast(`Private memory optimize failed${hint}${msg}`);
    setMemoryProgressLine(`개인 메모리 최적화 실패 (${pid})`, false);
    if (detail) showToast(`Detail: ${detail.slice(0, 120)}`);
    console.error('optimizePrivateMemoryNow failed', { pid, res, raw: JSON.stringify(res || {}) });
  } finally {
    clearInterval(ticker);
    renderMemoryMeta();
  }
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
  if (line.dataset.busy === '1') return;
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

function setMemoryProgressLine(text = '', busy = false) {
  const line = document.getElementById('memoryMetaLine');
  if (!line) return;
  if (busy) {
    line.dataset.busy = '1';
    line.textContent = text || '메모리 최적화 작업 중...';
    return;
  }
  delete line.dataset.busy;
  if (text) line.textContent = text;
}

function startMemoryProgressTicker(label = '메모리 최적화') {
  const steps = [
    `${label}: 백그라운드에서 작업 중입니다.`,
    `${label}: 중복/유사 항목 분석 중...`,
    `${label}: 병합 및 정리 적용 중...`,
  ];
  let idx = 0;
  setMemoryProgressLine(steps[0], true);
  return setInterval(() => {
    idx = (idx + 1) % steps.length;
    setMemoryProgressLine(steps[idx], true);
  }, 1200);
}

async function optimizeMemoryNow() {
  if (!confirm('메모리를 최적화할까요? 중복/유사 항목을 정리합니다.')) return;
  const session = getActiveSession();
  const participantPids = Array.from(new Set((personas || []).map(p => p.pid).filter(Boolean)));
  const ticker = startMemoryProgressTicker('메모리 최적화');
  showToast('메모리 최적화를 백그라운드에서 시작했습니다.');
  try {
    const res = await optimizeMemoriesApi({
      sessionId: session?.id || '',
      participantPids
    });
    if (res?.ok) {
      showToast(`최적화 완료: ${res.optimized || 0}개 정리, ${res.removed || 0}개 제거`);
      setMemoryProgressLine(`메모리 최적화 완료: ${res.optimized || 0} 정리, ${res.removed || 0} 제거`, false);
      renderPublicMemoryList(true);
      if (editingPid) renderPrivateMemoryList(editingPid, true);
    } else {
      showToast('메모리 최적화 실패');
      setMemoryProgressLine('메모리 최적화 실패', false);
    }
  } finally {
    clearInterval(ticker);
    renderMemoryMeta();
  }
}
