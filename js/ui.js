// ?? 梨꾪똿 紐⑤뜽 紐⑸줉 (?섎Ⅴ?뚮굹 ?몄쭛 + ?쒕줈?댁뿉??怨듭쑀) ??
const CHAT_MODELS = [
  { value: '', label: '湲곕낯 (梨꾪똿諛??ㅼ젙 ?곕쫫)' },
  { group: 'Google' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Lite $0.25 / $1.50' },
  { value: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro $2.00 / $12.00' },
  { value: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash $0.30 / $1.20' },  
  { group: 'OpenAI' },
  { value: 'gpt-5.4-nano',  label: 'GPT-5.4 Nano $0.20 / $1.25' },
  { value: 'gpt-5.4-mini',  label: 'GPT-5.4 Mini $0.75 / $4.50' },
  { value: 'gpt-5.4',       label: 'GPT-5.4 $2.50 / $15.00' },
  { group: 'xAI' },
  { value: 'grok-4-1-fast-reasoning-latest',     label: 'Grok-4.1 Reason $0.20 / $0.50' },
  { value: 'grok-4-1-fast-non-reasoning-latest', label: 'Grok-4.1 Non $0.20 / $0.50' },
  { value: 'grok-4.20-reasoning-latest',         label: 'Grok-4.20 Reason $3.00 / $15.00' },
  { value: 'grok-4.20-non-reasoning-latest',     label: 'Grok-4.20 Non $3.00 / $15.00' },
];

const TTS_VOICES = [
  { value: 'Cherry', label: 'Cherry (諛앷퀬 湲띿젙?곸씠硫?移쒓렐?섍퀬 ?먯뿰?ㅻ윭???딆? ?ъ꽦)' },
  { value: 'Serena', label: 'Serena (遺?쒕윭???딆? ?ъ꽦)' },
  { value: 'Chelsie', label: 'Chelsie (2D 媛???ъ옄移쒓뎄 ?ㅽ???' },
  { value: 'Momo', label: 'Momo (?λ궃湲?媛?앺븯怨?苡뚰솢?섍쾶 湲곗슫??遺곷룍??二쇰뒗 ?ъ꽦)' },
  { value: 'Vivian', label: 'Vivian (?먯떊媛??덇퀬 洹?ъ슦硫??쎄컙 湲곗꽭媛 ?밸떦???ъ꽦)' },
  { value: 'Maia', label: 'Maia (吏?곸엫怨?遺?쒕윭???議고솕???ъ꽦)' },
  { value: 'Bella', label: 'Bella (?좎? 留덉떆吏留?痍⑦빐??二쇰㉨? ?섎몢瑜댁? ?딅뒗 ?대┛ ?뚮?)' },
  { value: 'Jennifer', label: 'Jennifer (?꾨━誘몄뾼 ?쒕꽕留덊떛 ?덉쭏??紐⑹냼由? 誘멸뎅 ?곸뼱 ??湲곕컲)' },
  { value: 'Katerina', label: 'Katerina (由щ벉媛먯씠 ?띾??섍퀬 湲곗뼲???⑤뒗 ?깆닕???ъ꽦)' },
  { value: 'Mia', label: 'Mia (遊꾨Ъ泥섎읆 遺?쒕읇怨?媛??대┛ ?덉쿂??怨좊텇怨좊텇???ъ꽦)' },
  { value: 'Bellona', label: 'Bellona (?곸썒?곸씤 ?낆옣?④낵 ?꾨꼍??諛쒖쓬??媛吏?媛뺣젰?섍퀬 紐낅즺??紐⑹냼由?' },
  { value: 'Bunny', label: 'Bunny (洹?ъ????섏튂???대┛ ?뚮?)' },
  { value: 'Elias', label: 'Elias (?숈닠???꾧꺽?④낵 ?ㅽ넗由ы뀛留곸뿉 ?μ닕??吏?곸씤 ?ъ꽦)' },
  { value: 'Nini', label: 'Nini (?몄젅誘몄쿂??遺?쒕읇怨??좉탳 ?욎씤 紐⑹냼由?' },
  { value: 'Seren', label: 'Seren (?좊뱾湲????ｊ린 醫뗭? 遺?쒕읇怨?李⑤텇??紐⑹냼由?' },
  { value: 'Stella', label: 'Stella (?됱냼??硫랁븳 10? ?뚮? 媛숈?留??뺤쓽瑜??몄튌 ??媛뺣떒 ?덈뒗 紐⑹냼由?' },
  { value: 'Sonrisa', label: 'Sonrisa (苡뚰솢?섍퀬 ?명뼢?곸씤 ?ㅽ??? ?쇳떞 ?꾨찓由ъ뭅 ??湲곕컲)' },
  { value: 'Sohee', label: 'Sohee (?곕쑜?섍퀬 苡뚰솢?섎ŉ 媛먯젙 ?쒗쁽???띾????쒓뎅???몃땲)' },
  { value: 'Ono Anna', label: 'Ono Anna (?곷━?섍퀬 ?쒓린李??뚭퓠移쒓뎄 ?ㅽ???' },
];
const TTS_TONES = [
  { value: '', label: '湲곕낯' },
  { value: 'calm', label: '李⑤텇?? },
  { value: 'warm', label: '?곕쑜?? },
  { value: 'cool', label: '?됱냼/荑⑦넠' },
  { value: 'bright', label: '諛앷퀬 寃쎌풄?? },
  { value: 'serious', label: '吏꾩?/?⑦샇?? },
  { value: '__custom__', label: '吏곸젒 ?낅젰' },
];
const TTS_EMOTION_STRENGTHS = [
  { value: 'low', label: '?쏀븯寃? },
  { value: 'medium', label: '以묎컙' },
  { value: 'high', label: '媛뺥븯寃? },
];
let _editMultiUploadQueue = [];
const UI_LOCAL_PREFS_KEY = 'pc4_ui_local_prefs';
let _uiLocalPrefs = null;

function ensureUiLocalPrefsLoaded() {
  if (_uiLocalPrefs) return _uiLocalPrefs;
  try {
    const raw = localStorage.getItem(UI_LOCAL_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    _uiLocalPrefs = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    _uiLocalPrefs = {};
  }
  if (typeof _uiLocalPrefs.showHiddenChats !== 'boolean') _uiLocalPrefs.showHiddenChats = false;
  if (typeof _uiLocalPrefs.showHiddenPersonas !== 'boolean') _uiLocalPrefs.showHiddenPersonas = false;
  if (!_uiLocalPrefs.chatProfileOverrides || typeof _uiLocalPrefs.chatProfileOverrides !== 'object') {
    _uiLocalPrefs.chatProfileOverrides = {};
  }
  return _uiLocalPrefs;
}

function saveUiLocalPrefs() {
  const prefs = ensureUiLocalPrefsLoaded();
  try { localStorage.setItem(UI_LOCAL_PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

function getChatProfileOverrideLocal(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  const prefs = ensureUiLocalPrefsLoaded();
  const v = prefs.chatProfileOverrides?.[id];
  return (v === 'on' || v === 'off') ? v : null;
}

function setChatProfileOverrideLocal(sessionId, value) {
  const id = String(sessionId || '').trim();
  if (!id) return;
  const prefs = ensureUiLocalPrefsLoaded();
  if (value === 'on' || value === 'off') prefs.chatProfileOverrides[id] = value;
  else delete prefs.chatProfileOverrides[id];
  saveUiLocalPrefs();
}

function buildModelSelect(id, selectedValue, style = '') {
  const opts = CHAT_MODELS.map(m => {
    if (m.group) return `<optgroup label="${m.group}">`;
    const sel = m.value === (selectedValue || '') ? 'selected' : '';
    return `<option value="${m.value}" ${sel}>${m.label}</option>`;
  }).join('');
  return `<select class="edit-input" id="${id}" style="width:100%;${style}">${opts}</select>`;
}

function buildSimpleSelect(id, options, selectedValue, style = '') {
  const opts = (options || []).map(o => {
    const sel = String(o.value || '') === String(selectedValue || '') ? 'selected' : '';
    return `<option value="${esc(o.value || '')}" ${sel}>${esc(o.label || o.value || '')}</option>`;
  }).join('');
  return `<select class="edit-input" id="${id}" style="width:100%;${style}">${opts}</select>`;
}

function getChatModelLabel(modelValue = '') {
  const key = String(modelValue || '');
  const found = CHAT_MODELS.find((m) => !m.group && m.value === key);
  return found?.label || key || '誘몄꽕??;
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  UTILS (UI)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 留덊겕?ㅼ슫 ?뚮뜑??珥덇린??
function initMarked() {
  if (typeof marked === 'undefined') return;
  marked.setOptions({
    breaks: true,       // 以꾨컮轅???<br>
    gfm: true,          // GitHub Flavored Markdown
    highlight: (code, lang) => {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
    }
  });
}

// mermaid 珥덇린??
function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true });
  }
}

// 留덊겕?ㅼ슫 ??HTML 蹂??(mermaid 釉붾줉 ?ы븿)
function mdRender(text) {
  if (typeof marked === 'undefined') {
    // fallback: 湲곗〈 fmt
    return esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  }
  // mermaid 釉붾줉 ?꾩떆 移섑솚
  const mermaidBlocks = [];
  const replaced = text.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push(code.trim());
    return `<div class="mermaid-placeholder" data-idx="${idx}" data-code="${encodeURIComponent(code.trim())}"></div>`;
  });
  const html = marked.parse(replaced);
  return html;
}

// mermaid 釉붾줉 ?ㅼ젣 ?뚮뜑留?(DOM ?쎌엯 ???몄텧)
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
    return `${pick('year')}??${pick('month')}??${pick('day')}??${pick('hour')}:${pick('minute')}`;
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
  const override = getChatProfileOverrideLocal(session?.id) || null; // 'on' | 'off' | null
  const baseStyle = userProfile.chatAvatarStyle || 'square';
  if (override === 'off') return 'hidden';
  if (override === 'on') return baseStyle === 'hidden' ? 'square' : baseStyle;
  return baseStyle;
}

function iconRefreshSVG() {
  return '<img src="assets/ui-icons/refresh.svg" alt="">';
}

function iconSettingsSVG() {
  return '<img src="assets/ui-icons/setting.svg" alt="">';
}

function iconEyeOpenSVG() {
  return '<img src="assets/ui-icons/eye-open.svg" alt="">';
}

function iconEyeClosedSVG() {
  return '<img src="assets/ui-icons/eye-close.svg" alt="">';
}

function iconCloseXSVG() {
  return '<img src="assets/ui-icons/Invisible.svg" alt="">';
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
  const override = getChatProfileOverrideLocal(session?.id) || null;
  const effective = getChatAvatarStyle();
  const on = effective !== 'hidden';
  btn.classList.toggle('on', on);
  btn.innerHTML = on ? iconEyeOpenSVG() : iconEyeClosedSVG();
  btn.title = `?꾨줈???쒖떆 ${on ? 'ON' : 'OFF'} (?대┃?댁꽌 ?꾪솚)`;
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
  return !!ensureUiLocalPrefsLoaded().showHiddenChats;
}

function getPersonaHiddenFilterEnabled() {
  return !!ensureUiLocalPrefsLoaded().showHiddenPersonas;
}

function updatePersonaListVisibilityButton() {
  const btn = document.getElementById('personaHiddenToggleBtn');
  if (!btn) return;
  const on = getPersonaHiddenFilterEnabled();
  btn.classList.toggle('on', on);
  btn.innerHTML = iconCloseXSVG();
  btn.title = on ? '?④릿 ?섎Ⅴ?뚮굹 蹂닿린 以? : '?④릿 ?섎Ⅴ?뚮굹 ?④린湲?;
}

function togglePersonaHiddenVisibility() {
  const prefs = ensureUiLocalPrefsLoaded();
  prefs.showHiddenPersonas = !getPersonaHiddenFilterEnabled();
  saveUiLocalPrefs();
  updatePersonaListVisibilityButton();
  renderPersonaGrid();
}

function getChatListAvatarVisibilityEnabled() {
  if (typeof window._showChatListAvatars === 'boolean') return window._showChatListAvatars;
  return userProfile?.chatListAvatarVisibility !== false;
}

function setSettingsSegmentValue(inputId, value, groupId) {
  const input = document.getElementById(inputId);
  if (input) input.value = value;
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.settings-seg-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.value === value);
  });
}

function updateChatListVisibilityButton() {
  const btn = document.getElementById('chatHiddenToggleBtn');
  if (!btn) return;
  const on = getChatHiddenFilterEnabled();
  btn.classList.toggle('on', on);
  btn.innerHTML = iconCloseXSVG();
  btn.title = on ? '?④릿 梨꾪똿 蹂닿린 以? : '?④릿 梨꾪똿 ?④린湲?;
}

function toggleChatHiddenVisibility() {
  const prefs = ensureUiLocalPrefsLoaded();
  prefs.showHiddenChats = !getChatHiddenFilterEnabled();
  saveUiLocalPrefs();
  updateChatListVisibilityButton();
  renderChatList();
}

function updateChatListAvatarVisibilityButton() {
  const btn = document.getElementById('chatListAvatarToggleBtn');
  if (!btn) return;
  const on = getChatListAvatarVisibilityEnabled();
  btn.classList.toggle('on', on);
  btn.innerHTML = on ? iconEyeOpenSVG() : iconEyeClosedSVG();
  btn.title = on ? '梨꾪똿 紐⑸줉 ?몃꽕???쒖떆 以? : '梨꾪똿 紐⑸줉 ?몃꽕???④? 以?;
}

function toggleChatListAvatarVisibility() {
  window._showChatListAvatars = !getChatListAvatarVisibilityEnabled();
  userProfile.chatListAvatarVisibility = window._showChatListAvatars;
  saveUserProfile();
  updateChatListAvatarVisibilityButton();
  renderChatList();
}

async function refreshCurrentChat() {
  const session = getActiveSession();
  if (!session || !activeChatId) return;
  if (session._demo) {
    showToast('?곕え 梨꾪똿? ?덈줈怨좎묠 ??곸씠 ?꾨땲??);
    return;
  }
  await loadSession(activeChatId, { forceRemote: true });
  renderChatArea();
  showToast('??붾? ?덈줈怨좎묠?덉뼱');
}

function toggleChatProfileOverride() {
  const session = getActiveSession();
  if (!session || !activeChatId) return;
  const cur = getChatProfileOverrideLocal(session.id) || null;
  setChatProfileOverrideLocal(session.id, cur === 'off' ? 'on' : 'off');
  updateChatHeaderActionButtons();
  renderChatArea();
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
      btn.title = '蹂듭궗';
      btn.dataset.copyText = encodeCopyPayload(userMsg.innerText || '');
      btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
      btn.onclick = () => copyBubble(btn, btn.dataset.copyText, true);
      userActions.appendChild(btn);
    }

    const aiActions = group.querySelector('.msg-meta-left .msg-actions');
    const aiBubble = group.querySelector('.ai-msg:last-child .bubble-col:last-child .ai-bubble');
    if (aiActions && aiBubble && !aiBubble.querySelector('img')) {
      const aiMsg = group.querySelector('.ai-msg:last-child');
      const aiEmotion = String(aiMsg?.dataset?.emotion || '').trim();
      const existingTts = aiActions.querySelector('.tts-btn');
      if (!existingTts) {
        const ttsBtn = createTtsButton(aiBubble.innerText || '', { emotion: aiEmotion });
        aiActions.appendChild(ttsBtn);
      } else {
        existingTts.dataset.ttsText = encodeCopyPayload(aiBubble.innerText || '');
        existingTts.dataset.ttsEmotion = aiEmotion;
      }

      const btn = aiActions.querySelector('.copy-btn:not(.tts-btn)') || document.createElement('button');
      if (!aiActions.querySelector('.copy-btn:not(.tts-btn)')) {
        btn.className = 'copy-btn';
        btn.type = 'button';
        btn.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="11" rx="2"/><path d="M13 5V3.5A1.5 1.5 0 0 0 11.5 2h-7A1.5 1.5 0 0 0 3 3.5v10A1.5 1.5 0 0 0 4.5 15H5"/></svg>';
        aiActions.appendChild(btn);
      }
      btn.title = '蹂듭궗';
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

function isChatNearBottom(area = document.getElementById('chatArea'), threshold = 56) {
  if (!area) return true;
  return (area.scrollTop + area.clientHeight) >= (area.scrollHeight - threshold);
}

function bindChatAutoStick(area = document.getElementById('chatArea')) {
  if (!area) return;
  if (area.dataset.autoStickBound === '1') return;
  area.dataset.autoStickBound = '1';
  if (!area.dataset.autoStick) area.dataset.autoStick = '1';
  area.addEventListener('scroll', () => {
    area.dataset.autoStick = isChatNearBottom(area) ? '1' : '0';
  }, { passive: true });
}

function stickChatToBottom(area = document.getElementById('chatArea'), options = {}) {
  if (!area) return;
  const force = !!options.force;
  if (!force && area.dataset.autoStick === '0') return;
  area.scrollTop = area.scrollHeight;
  if (force) area.dataset.autoStick = '1';
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
    hydrateImageElementFromChatCache(img);
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
  s = s.replace(/(^|[\s\[\(\{'"`])卵諾爛蘿(?=$|[\s\]\)\}'"`.,!?;:])/gi, '$1');
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
const CHAT_IMAGE_CACHE_PREFIX = 'chat_img_';
function chatImageCacheKey(url) {
  return `${CHAT_IMAGE_CACHE_PREFIX}${String(url || '').trim()}`;
}
function canUseUrlForChatCache(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}
async function cacheChatImageForUrl(url, dataUrl) {
  const targetUrl = String(url || '').trim();
  const data = String(dataUrl || '').trim();
  if (!canUseUrlForChatCache(targetUrl) || !/^data:image\//i.test(data)) return;
  await idbSet(chatImageCacheKey(targetUrl), data).catch(() => {});
}
async function getCachedChatImageForUrl(url) {
  const targetUrl = String(url || '').trim();
  if (!canUseUrlForChatCache(targetUrl)) return '';
  return await idbGet(chatImageCacheKey(targetUrl)).catch(() => '');
}
function hydrateImageElementFromChatCache(img) {
  if (!img || img.dataset.chatCacheHydrateBound === '1') return;
  img.dataset.chatCacheHydrateBound = '1';
  const src = String(img.getAttribute('src') || '').trim();
  if (canUseUrlForChatCache(src)) {
    getCachedChatImageForUrl(src).then((cached) => {
      if (!cached || img.getAttribute('src') !== src) return;
      img.dataset.originalSrc = src;
      img.src = cached;
    }).catch(() => {});
  }
  img.addEventListener('error', () => {
    const original = String(img.dataset.originalSrc || '').trim();
    if (!original || img.getAttribute('src') === original) return;
    img.src = original;
  }, { passive: true });
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
  const previewUrl = sanitizeImageUrlForHistory(getAttachmentPreviewUrl(a)) || url;
  return {
    type: a.type === 'image' ? 'image' : 'file',
    name: a.name || '',
    mimeType: a.mimeType || '',
    url,
    previewUrl
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
  await Promise.all((items || []).map(async (a) => {
    if (!a?.originalCacheKey) return;
    const keepForChatCache = isImageAttachment(a) && !a?.uploadError;
    if (keepForChatCache) return;
    await idbDel(a.originalCacheKey).catch(() => {});
  }));
}

function buildUserMessageContent(text, imageUrls) {
  const imgs = (imageUrls || []).filter(Boolean);
  if (!imgs.length) return text || '(?뚯씪)';
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
  if (/(^|\s)(?앹꽦 ?ㅻ쪟|?곌껐 ?ㅽ뙣)\s*:/.test(raw) || /API Error:|NOT_FOUND|INVALID_ARGUMENT|Gemini Image Error:/i.test(raw)) {
    return '[?ㅻ쪟] ?대?吏 ?앹꽦 ?ㅽ뙣';
  }
  return raw.slice(0, 120);
}

function getPersonaModel(sessionOrPersona, maybePersona = null) {
  const session = maybePersona ? sessionOrPersona : null;
  const persona = maybePersona || sessionOrPersona || null;
  const pid = String(persona?.pid || '');
  const overrideByPersona = session?.personaModelOverrides && pid ? session.personaModelOverrides[pid] : '';
  return overrideByPersona
    || session?.overrideModel
    || persona?.defaultModel
    || document.getElementById('chatModeSelect')?.value
    || 'grok-4.20-non-reasoning-latest';
}

function stripPersonaTagsForPreview(text, session = null) {
  let out = String(text || '');
  out = out.replace(/\[emotion:\s*[^\]]+\]/gi, '');
  const pids = Array.isArray(session?.participantPids) ? session.participantPids : [];
  for (const pid of pids) {
    const safePid = String(pid || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!safePid) continue;
    const openTag = new RegExp(`\\[${safePid}\\]`, 'gi');
    const closeTag = new RegExp(`\\[\\/${safePid}\\]`, 'gi');
    out = out.replace(openTag, '').replace(closeTag, '');
  }
  return out;
}

function sanitizeChatListPreview(text, session = null) {
  const raw = sanitizeTextForUnicodeSafety(stripPersonaTagsForPreview(text, session)).trim();
  if (/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/i.test(raw)) {
    return '[?대?吏]';
  }
  return raw;
}

function buildSessionPreviewFallback(session) {
  if (!session || !Array.isArray(session.history) || !session.history.length) return '';
  const last = [...session.history].reverse().find(m => m && m.role !== 'system');
  if (!last) return '';
  let text = '';
  if (typeof last.content === 'string') {
    text = last.content;
  } else if (Array.isArray(last.content)) {
    const textParts = last.content
      .filter(c => c?.type === 'text' && typeof c?.text === 'string')
      .map(c => c.text.trim())
      .filter(Boolean);
    if (textParts.length) {
      text = textParts.join(' ');
    } else if (last.content.some(c => c?.type === 'image' || c?.type === 'image_url' || c?.type === 'input_image')) {
      text = '[?대?吏]';
    }
  }
  const built = sanitizeChatListPreview(buildChatPreviewText(text), session);
  return built || sanitizeChatListPreview(text, session) || '';
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

let _groupRouterDebug = false;
try {
  _groupRouterDebug = localStorage.getItem('group_router_debug') === '1';
} catch {}
function logGroupRouterDebug(label, payload = null) {
  if (!_groupRouterDebug) return;
  try {
    if (payload == null) console.log(`[group-router] ${label}`);
    else console.log(`[group-router] ${label}`, payload);
  } catch {}
}
window.toggleGroupRouterDebug = function(force) {
  _groupRouterDebug = typeof force === 'boolean' ? force : !_groupRouterDebug;
  try { localStorage.setItem('group_router_debug', _groupRouterDebug ? '1' : '0'); } catch {}
  try { showToast(`Group router debug: ${_groupRouterDebug ? 'ON' : 'OFF'}`); } catch {}
  return _groupRouterDebug;
};

function getRouterModel(session, pList = []) {
  return session?.overrideModel
    || pList.find((p) => p?.defaultModel)?.defaultModel
    || document.getElementById('chatModeSelect')?.value
    || 'grok-4.20-non-reasoning-latest';
}

function extractJsonObject(raw = '') {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(txt.slice(start, end + 1)); } catch { return null; }
}

async function planGroupResponse(session, pList, userText = '') {
  const fallbackResponders = pickRespondingPersonas(session, pList);
  if (!Array.isArray(pList) || pList.length <= 1) {
    return { responders: fallbackResponders, delivery: 'sequential' };
  }
  if (session?.responseMode === 'all') {
    logGroupRouterDebug('plan.fixed.all', { pids: (pList || []).map((p) => p.pid), delivery: 'parallel' });
    return { responders: shuffleArray(pList), delivery: 'parallel' };
  }
  if (session?.responseMode === 'random') {
    logGroupRouterDebug('plan.fixed.random', { pid: shuffleArray(pList)[0]?.pid, delivery: 'sequential' });
    return { responders: [shuffleArray(pList)[0]], delivery: 'sequential' };
  }
  if (session?.responseMode !== 'auto') {
    return { responders: fallbackResponders, delivery: 'sequential' };
  }

  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return { responders: fallbackResponders, delivery: 'sequential' };

  try {
    const candidates = pList.map((p) => ({ pid: String(p?.pid || ''), name: String(p?.name || '') })).filter((x) => x.pid);
    const routerMessages = [
      {
        role: 'system',
        content: [
          '?덈뒗 洹몃９梨꾪똿 ?쇱슦?곕떎.',
          '二쇱뼱吏??ъ슜???낅젰??蹂닿퀬 ?묐떟?먯? ?묐떟 諛⑹떇??寃곗젙?대씪.',
          '諛섎뱶??JSON ??媛쒕쭔 異쒕젰.',
          '?ㅽ궎留?',
          '{"mode":"one|all","delivery":"sequential|parallel","pids":["pid1","pid2",...]}',
          '- mode=one?대㈃ pids??1媛?',
          '- mode=all?대㈃ pids???꾨낫??以?2紐??댁긽 ?먮뒗 ?꾩썝.',
          '- ?꾨낫???녿뒗 pid???덈? ?ｌ? 留?寃?'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          text: String(userText || ''),
          responseMode: session?.responseMode || 'auto',
          candidates
        })
      }
    ];
    const res = await fetch(wUrl + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getRouterModel(session, pList),
        participant_pids: candidates.map((c) => c.pid),
        user_id: 'user_default',
        session_id: String(session?.id || ''),
        messages: routerMessages
      })
    });
    const data = await res.json().catch(() => ({}));
    const parsed = extractJsonObject(data?.reply || '');
    if (!parsed || typeof parsed !== 'object') {
      logGroupRouterDebug('plan.router.invalid-json', { reply: String(data?.reply || '').slice(0, 300) });
      return { responders: fallbackResponders, delivery: 'sequential' };
    }

    const allowed = new Set(candidates.map((c) => c.pid));
    const mode = parsed.mode === 'all' ? 'all' : 'one';
    const delivery = parsed.delivery === 'parallel' ? 'parallel' : 'sequential';
    const picked = Array.isArray(parsed.pids) ? parsed.pids.map((x) => String(x || '').trim()).filter((x) => allowed.has(x)) : [];
    let selectedPids = [];
    if (mode === 'all') {
      selectedPids = picked.length ? Array.from(new Set(picked)) : pList.map((p) => p.pid);
      if (selectedPids.length < 2) selectedPids = pList.map((p) => p.pid);
    } else {
      selectedPids = [picked[0] || shuffleArray(pList)[0].pid];
    }
    const orderMap = new Map(pList.map((p) => [p.pid, p]));
    const responders = selectedPids.map((pid) => orderMap.get(pid)).filter(Boolean);
    if (!responders.length) return { responders: fallbackResponders, delivery: 'sequential' };
    logGroupRouterDebug('plan.router.result', {
      mode,
      delivery,
      selectedPids,
      routerModel: getRouterModel(session, pList)
    });
    return { responders, delivery };
  } catch {
    logGroupRouterDebug('plan.router.error-fallback');
    return { responders: fallbackResponders, delivery: 'sequential' };
  }
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

function extractAssistantContentForPid(rawContent, pid = '') {
  const text = typeof rawContent === 'string' ? rawContent : '';
  const targetPid = String(pid || '').trim();
  if (!text || !targetPid) return text;
  const escapedPid = targetPid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[${escapedPid}\\]([\\s\\S]*?)\\[\\/${escapedPid}\\]`, 'gi');
  const chunks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    let body = String(m[1] || '').trim();
    body = body.replace(/^\[emotion:\s*[a-zA-Z]+\s*\]/i, '').trim();
    body = cleanContent(body);
    if (body) chunks.push(body);
  }
  return chunks.join('\n').trim();
}

function buildApiMessagesFromHistory(history, currentUserMsg, currentContent, isImageReq, targetPid = '') {
  return (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => isImageReq || !isImageWorkflowMessage(m))
    .map(m => {
      const role = m.role;
      let content = sanitizeMessageContentForTextContext(m === currentUserMsg ? currentContent : m.content, m === currentUserMsg);
      if (role === 'assistant' && targetPid) {
        content = extractAssistantContentForPid(content, targetPid);
        if (!content) return null;
      }
      return { role, content };
    })
    .filter(Boolean);
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
        cacheChatImageForUrl(record.transportUrl, record.previewUrl || '').catch(() => {});
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
        .then(added => { if (added > 0) showToast(`?대┰蹂대뱶 ?대?吏 ${added}媛쒕? 泥⑤??덉뼱??`); })
        .catch(err => showToast('?대┰蹂대뱶 ?대?吏 泥⑤? ?ㅽ뙣: ' + (err?.message || err)));
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
      showToast(`${added}媛??뚯씪??泥⑤??덉뼱??`);
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

// ?쇱씠釉뚮윭由?珥덇린??(?ㅽ겕由쏀듃 濡쒕뱶 ??
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
function scheduleChatListRefresh(delay = 120, force = false) {
  if (_chatListRefreshTimer) clearTimeout(_chatListRefreshTimer);
  _chatListRefreshTimer = setTimeout(() => {
    _chatListRefreshTimer = null;
    renderChatList({ force }).catch(() => {});
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

function getSessionLastMessageSortTs(session) {
  if (!session || typeof session !== 'object') return 0;
  if (Array.isArray(session.history) && session.history.length > 0) {
    return session.history.reduce((max, m) => Math.max(max, Number(m?.createdAt || 0)), 0);
  }
  return Number(session.lastMessageAt || session.updatedAt || 0);
}

async function runGlobalCacheWarmup() {
  const token = ++_globalCacheWarmupToken;
  _globalWarmupRunning = true;
  try {

    // 1) Persona grid priority: neutral_a only
    for (const p of (personas || [])) {
      if (token !== _globalCacheWarmupToken) return;
      await getNeutralABaseImageHD(p.pid).catch(() => null);
    }

    // 2) Chat list priority: by last message time desc
    const sorted = [...(sessions || [])].sort((a, b) => getSessionLastMessageSortTs(b) - getSessionLastMessageSortTs(a));
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
    // Temporarily disable chat list auto refresh from startup/global warmup.
    // scheduleChatListRefresh(120);
  }
}

async function runStartupVisualWarmup(onProgress) {
  const token = ++_globalCacheWarmupToken;
  _startupWarmupRunning = true;

  try {
    const personaList = Array.isArray(personas) ? personas : [];
    const sortedSessions = [...(sessions || [])].sort((a, b) => getSessionLastMessageSortTs(b) - getSessionLastMessageSortTs(a));

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
  scheduleChatListRefresh(100, true);
  scheduleChatAreaRefresh(110);
});

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function timeLabel(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '諛⑷툑';
  if (diff < 3600000) return `${Math.floor(diff/60000)}遺???;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}?쒓컙 ??;
  return `${Math.floor(diff/86400000)}????;
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  TOAST / LOADING
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
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
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (!overlay) return;
  if (textEl) textEl.textContent = text;
  overlay.classList.toggle('hidden', !show);
}
function setLoadingEscapeVisible(show) {
  const logo = document.getElementById('loadingLogo');
  if (!logo) return;
  logo.classList.toggle('escape-available', !!show);
}

function updateMicButtonState(active) {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  btn.classList.toggle('active', !!active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.title = active ? '?뚯꽦 ?낅젰 以묒?' : '?뚯꽦 ?낅젰';
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
    showToast('??釉뚮씪?곗????뚯꽦 ?낅젰??吏?먰븯吏 ?딆뒿?덈떎.');
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
    showToast('?뚯꽦 ?낅젰???ｋ뒗 以묒엯?덈떎.', 1200);
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
    showToast('?뚯꽦 ?낅젰??泥섎━?섏? 紐삵뻽?듬땲??');
  };
  recognition.onend = () => {
    _speechListening = false;
    updateMicButtonState(false);
  };
  recognition.start();
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  AVATAR HTML
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
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

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  TAB SWITCHING & SETTINGS
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
function switchTab(tab) {
  activeTab = tab;
  // ?섎떒 ???쒖꽦??
  document.getElementById('btabPersona').classList.toggle('active', tab === 'persona');
  document.getElementById('btabChat').classList.toggle('active', tab === 'chat');
  document.getElementById('btabSettings').classList.toggle('active', tab === 'settings');
  document.getElementById('btabArchive')?.classList.toggle('active', tab === 'archive');
  // ?⑤꼸 ?쒖떆
  document.getElementById('personaPane').style.display = tab === 'persona' ? 'flex' : 'none';
  document.getElementById('chatPane').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('settingsPane').style.display = tab === 'settings' ? 'flex' : 'none';
  const archivePaneEl = document.getElementById('archivePane');
  if (archivePaneEl) archivePaneEl.style.display = tab === 'archive' ? 'flex' : 'none';
  if (tab === 'settings') renderSettingsPane();
  if (tab === 'archive') renderArchivePane();
  // ?섎Ⅴ?뚮굹 ?좏깮 珥덇린??
  if (tab !== 'persona') clearPersonaSelection();
}

function renderSettingsPane() {
  const av = document.getElementById('settingsUserAv');
  if (av) av.innerHTML = userProfile.image
    ? `<img src="${userProfile.image}" style="width:100%;height:100%;object-fit:cover;">`
    : `<svg viewBox="0 0 36 36" style="width:100%;height:100%"><circle cx="18" cy="14" r="7" fill="hsl(220,30%,35%)"/><ellipse cx="18" cy="30" rx="11" ry="7" fill="hsl(220,30%,28%)"/></svg>`;
  // ??젣 踰꾪듉 ?쒖떆/?④?
  const delBtn = document.getElementById('settingsDelAvBtn');
  if (delBtn) delBtn.style.display = userProfile.image ? 'block' : 'none';
  const nameEl = document.getElementById('settingsUserName');
  const bioEl = document.getElementById('settingsUserBio');
  const memoryBioEl = document.getElementById('settingsMemoryBio');
  const hpEl = document.getElementById('settingsHallucinationPolicy');
  if (nameEl) nameEl.value = userProfile.name || '';
  if (bioEl) bioEl.value = userProfile.bio || '';
  if (memoryBioEl) memoryBioEl.value = userProfile.memoryBio || '';
  if (hpEl) hpEl.value = userProfile.hallucinationPolicy || '';
  
  // ?쒖옉 ?붾㈃ ?ㅼ젙
  const tabEl = document.getElementById('settingsDefaultTab');
  if (tabEl) tabEl.value = userProfile.defaultTab || 'persona';
  setSettingsSegmentValue('settingsDefaultTab', userProfile.defaultTab || 'persona', 'settingsDefaultTabSeg');

  // 湲???ш린 ?щ씪?대뜑
  const fs = userProfile.fontSize || 15;
  const fsEl = document.getElementById('settingsFontSize');
  const fsLabel = document.getElementById('settingsFontSizeLabel');
  if (fsEl) fsEl.value = fs;
  if (fsLabel) fsLabel.textContent = fs + 'px';

  // ?몃꽕???ㅽ????ㅼ젙 異붽?
  const avStyleEl = document.getElementById('settingsAvatarStyle');
  if (avStyleEl) avStyleEl.value = userProfile.chatAvatarStyle || 'square';
  setSettingsSegmentValue('settingsAvatarStyle', userProfile.chatAvatarStyle || 'square', 'settingsAvatarStyleSeg');
  const listAvVal = getChatListAvatarVisibilityEnabled() ? 'show' : 'hide';
  setSettingsSegmentValue('settingsChatListAvatarStyle', listAvVal, 'settingsChatListAvatarSeg');
  const typingEl = document.getElementById('settingsTypingSpeed');
  if (typingEl) typingEl.value = getBubbleTypingSpeedPreset();
  setSettingsSegmentValue('settingsTypingSpeed', getBubbleTypingSpeedPreset(), 'settingsTypingSpeedSeg');
  // Public/private memory UI disabled by policy.
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

function getBubbleTypingSpeedPreset() {
  const speed = String(userProfile?.typingSpeed || 'medium');
  if (speed === 'slow') return 'slow';
  if (speed === 'medium') return 'medium';
  return 'fast';
}

function getBubbleTypingDelay(ch = '') {
  const punct = /[.!??귨펯竊?/.test(String(ch || ''));
  const speed = getBubbleTypingSpeedPreset();
  if (speed === 'slow') return punct ? 180 : 84;
  if (speed === 'medium') return punct ? 130 : 60;
  return punct ? 90 : 42;
}

function saveSettingsUserProfile() {
  userProfile.name = document.getElementById('settingsUserName')?.value.trim() || '';
  userProfile.bio = document.getElementById('settingsUserBio')?.value.trim() || '';
  userProfile.memoryBio = document.getElementById('settingsMemoryBio')?.value.trim() || '';
  userProfile.hallucinationPolicy = document.getElementById('settingsHallucinationPolicy')?.value.trim() || '';
  userProfile.defaultTab = document.getElementById('settingsDefaultTab')?.value || 'persona';
  userProfile.chatAvatarStyle = document.getElementById('settingsAvatarStyle')?.value || 'square';
  const listAvSetting = document.getElementById('settingsChatListAvatarStyle')?.value || 'show';
  userProfile.chatListAvatarVisibility = listAvSetting !== 'hide';
  window._showChatListAvatars = userProfile.chatListAvatarVisibility;
  userProfile.typingSpeed = document.getElementById('settingsTypingSpeed')?.value || 'medium';
  userProfile.fontSize = parseInt(document.getElementById('settingsFontSize')?.value || 15);
  applyFontSize(userProfile.fontSize);
  saveUserProfile();
  saveUserProfileKV();
  savePersonaMemoryBioKV(userProfile.memoryBio || '').catch(() => {});
  updateChatListAvatarVisibilityButton();
  renderChatList();
  showToast('?ㅼ젙 ??λ맖 ??);
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
  if (!confirm('?꾨줈???대?吏瑜???젣?좉퉴??')) return;
  userProfile.image = null;
  saveUserProfile();
  renderSettingsPane();
  idbSet('user_profile_hd', null).catch(()=>{});
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  PERSONA GRID
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
let _personaGridRenderVersion = 0;
let _suppressPersonaTapUntil = 0;
let _chatOpenToken = 0;
let _lastPersonaGridSignature = '';
let _lastChatListSignature = '';

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

async function preloadImageDecode(src) {
  if (!src) return;
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (typeof img.decode === 'function') {
      await img.decode().catch(() => {});
      return;
    }
    await new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  } catch (e) {}
}

async function renderPersonaGrid() {
  const COLS = 3;
  const grid = document.getElementById('personaGrid');
  const sourcePersonas = getPersonaHiddenFilterEnabled() ? (personas || []) : (personas || []).filter(p => !p?.hidden);
  const signature = JSON.stringify((personas || []).map((p) => ({
    pid: p?.pid || '',
    name: p?.name || '',
    hue: Number(p?.hue || 0),
    type: p?.type || '',
    image: p?.image || '',
    hidden: !!p?.hidden,
    updatedAt: Number(p?.updatedAt || 0)
  })).concat([`showHidden:${getPersonaHiddenFilterEnabled()}`]));
  if (grid && grid.children.length && signature === _lastPersonaGridSignature) return;
  _lastPersonaGridSignature = signature;
  const fragment = document.createDocumentFragment();

  const myVersion = ++_personaGridRenderVersion;

  for (let i = 0; i < sourcePersonas.length; i++) {
    const p = sourcePersonas[i];
    const card = document.createElement('div');
    card.className = 'persona-card';
    card.dataset.pid = p.pid;
    card.draggable = false;

    const neutral = await getNeutralABaseImageHD(p.pid) || await idbGet(`em_full_${p.pid}_neutral_a`);

    // ??render ?몄텧???대? ?쒖옉?먯쑝硫???猷⑦봽 以묐떒
    if (myVersion !== _personaGridRenderVersion) return;

    const imgSrc = neutral;
    if (imgSrc) await preloadImageDecode(imgSrc);
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

    fragment.appendChild(card);
  }

  if (myVersion !== _personaGridRenderVersion) return;

  const addCard = document.createElement('div');
  addCard.className = 'persona-card add-card';
  addCard.onclick = () => createNewPersona();
  addCard.innerHTML = `
    <div class="add-card-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>`;
  fragment.appendChild(addCard);

  grid.innerHTML = '';
  grid.appendChild(fragment);

  setupTouchDrag(grid);
  setupPersonaGridBlankTapClear(grid);
  updatePersonaListVisibilityButton();
}

function setupPersonaGridBlankTapClear(grid) {
  if (grid.dataset.blankTapBound === '1') return;
  grid.dataset.blankTapBound = '1';

  grid.addEventListener('click', e => {
    if (Date.now() < _suppressPersonaTapUntil) return;
    if (e.target !== grid) return; // 移대뱶媛 ?꾨땶, 鍮?怨듦컙 ?곗튂/?대┃留?泥섎━
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

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  PERSONA EDIT
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
let isNewPersona = false;

async function openPersonaEdit(pid) {
  editingPid = pid; isNewPersona = false;
  const p = getPersona(pid);
  document.getElementById('editTitle').textContent = p ? p.name || '?섎Ⅴ?뚮굹 ?몄쭛' : '???섎Ⅴ?뚮굹';
    const hdImage = p ? await getEmotionImageHD(p.pid, 'neutral_a') || await idbGet(`em_full_${p.pid}_neutral_a`) : null;
  renderEditBody(p || { pid, name:'', bio:'', tags:[], hue:200, image:null }, hdImage);
  renderEditFooter(!!p);
  show('editScreen');
}

function createNewPersona() {
  const p = { pid: nextPid(), name: '', bio: '', tags: [], hue: 200, image: null, hidden: false };
  isNewPersona = true; editingPid = p.pid;
  personas.push(p);
  document.getElementById('editTitle').textContent = '???섎Ⅴ?뚮굹';
  renderEditBody(p, null); renderEditFooter(false);
  show('editScreen');
}

function renderEditFooter(isExisting) {
  const footer = document.getElementById('editFooter');
  const deleteBtn = document.getElementById('editDeleteTitleBtn');
  if (deleteBtn) deleteBtn.style.display = isExisting ? 'inline-flex' : 'none';
  if (isExisting) {
    footer.innerHTML = `
      <button class="edit-cancel-btn" onclick="cancelPersonaEdit()">痍⑥냼</button>
      <button class="edit-save-btn" onclick="savePersonaEdit()">???/button>`;
  } else {
    footer.innerHTML = `
      <button class="edit-cancel-btn" onclick="cancelPersonaEdit()">痍⑥냼</button>
      <button class="edit-save-btn" onclick="savePersonaEdit()">?앹꽦</button>`;
  }
}

function cancelPersonaEdit() {
  if (isNewPersona) personas = personas.filter(p => p.pid !== editingPid);
  goMain();
}

function deletePersonaFromEdit() {
  if (personas.length <= 1) { showToast('留덉?留??섎Ⅴ?뚮굹????젣?????놁뼱'); return; }
  if (!confirm('???섎Ⅴ?뚮굹瑜???젣?좉퉴?')) return;
  if (!confirm('?뺣쭚 ??젣?좉퉴? ???묒뾽? ?섎룎由????놁뼱.')) return;
  personas = personas.filter(p => p.pid !== editingPid);
  savePersonas(); renderPersonaGrid(); goMain();
}

function renderEditBody(p, hdImage = null) {
  const body = document.getElementById('editBody');
  const neutral = hdImage || _neutralCache[p.pid] || p.image;
  const toneValues = new Set((TTS_TONES || []).map(x => String(x.value || '')));
  const rawTone = String(p.ttsTone || '').trim();
  const toneSelectValue = rawTone && !toneValues.has(rawTone) ? '__custom__' : rawTone;
  const toneCustomValue = toneSelectValue === '__custom__' ? rawTone : '';

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
     ?뱚 媛먯젙 ?대?吏 ?쇨큵 ?낅줈??(?뚯씪紐?洹몃?濡????
    </button>
    <div id="editMultiDropzone" class="edit-multi-dropzone" role="button" tabindex="0" onclick="document.getElementById('editMultiImgInput').click()">
      <div class="edit-multi-dropzone-icon">
        <svg viewBox="0 0 24 24"><path d="M12 16V6"/><path d="M8.5 9.5L12 6l3.5 3.5"/><path d="M20 16.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5"/><path d="M7 12.5a4 4 0 0 1 7.4-2.1A3.5 3.5 0 1 1 17 17"/></svg>
      </div>
      <div class="edit-multi-dropzone-title">媛먯젙 ?대?吏 ?щ윭 ???낅줈??/div>
      <div class="edit-multi-dropzone-sub">?뚯씪???쒕옒洹명빐???볤굅???대┃???좏깮</div>
    </div>
    <div id="editMultiUploadList" class="edit-upload-list"></div>

    <div>
      <div class="edit-section-title">Identity Details</div>

      <div class="edit-field-label">PID ${isNewPersona?'<span style="font-size:9px;color:var(--muted)">(蹂寃?媛??</span>':'<span style="font-size:9px;color:var(--muted)">(?쎄린 ?꾩슜)</span>'}</div>
      <input class="edit-input" id="editPid" value="${esc(p.pid)}" placeholder="p_riley" ${isNewPersona?'':'readonly'} style="width:100%;font-family:monospace;font-size:12px;color:var(--muted);${isNewPersona?'':'opacity:.6;cursor:default'}">

      <div class="edit-field-label">NAME</div>
      <input class="edit-input" id="editName" value="${esc(p.name)}" placeholder="?대쫫" style="width:100%">

      <div class="edit-field-label">VISIBILITY</div>
      <select class="edit-input" id="editHidden" style="width:100%">
        <option value="false" ${!p.hidden ? 'selected' : ''}>?쒖떆</option>
        <option value="true" ${p.hidden ? 'selected' : ''}>?④?</option>
      </select>

      <div class="edit-field-row" style="margin-top:0">
        <div>
          <div class="edit-field-label">GENDER</div>
          <select class="edit-input" id="editGender" style="width:100%">
            <option value="" ${!p.gender?'selected':''}>?좏깮 ????/option>
            <option value="male" ${p.gender==='male'?'selected':''}>Male</option>
            <option value="female" ${p.gender==='female'?'selected':''}>Female</option>
            <option value="nonbinary" ${p.gender==='nonbinary'?'selected':''}>Non-binary</option>
            <option value="other" ${p.gender==='other'?'selected':''}>Other</option>
          </select>
        </div>
        <div>
          <div class="edit-field-label">AGE / BIRTH YEAR</div>
          <input class="edit-input" id="editAge" value="${esc(p.age||'')}" placeholder="?? 28, 1996" style="width:100%">
        </div>
      </div>

      <div class="edit-field-label">MBTI TYPE</div>
      <input class="edit-input" id="editMbti" value="${esc(p.mbti||'')}" placeholder="?? INTJ-A" style="width:100%">

      <div class="edit-field-row">
        <div>
          <div class="edit-field-label">NICKNAME (?쇳몴 援щ텇)</div>
          <input class="edit-input" id="editNicknames" value="${esc((p.nicknames||[]).join(', '))}" placeholder="?됰꽕?? style="width:100%">
        </div>
        <div>
          <div class="edit-field-label">?섎? 遺瑜대뒗 ?몄묶</div>
          <input class="edit-input" id="editUserTitle" value="${esc(p.userTitle||'')}" placeholder="?? ?좎깮?? style="width:100%">
        </div>
      </div>
    </div>

    <div>
      <div class="edit-section-title">Personality</div>

      <div class="edit-field-label">PERSONALITY TRAITS (理쒕? 6媛?</div>
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
      <textarea class="edit-textarea" id="editBio" placeholder="?대뼡 ??븷?몄? 吏㏐쾶 ?곸뼱以? style="height:min(42dvh, 360px); min-height:220px">${esc(p.bio)}</textarea>
    </div>

    <div>
      <div class="edit-section-title">Model</div>
      <div class="edit-field-label">湲곕낯 ?묐떟 紐⑤뜽 (???섎Ⅴ?뚮굹媛 李몄뿬??梨꾪똿??湲곕낯媛?</div>
      ${buildModelSelect('editDefaultModel', p.defaultModel || '')}
      <div style="margin-top:10px">
        <div class="edit-field-label">?뚯꽦 紐⑹냼由?(蹂댁씠???대쫫 + ?ㅻ챸)</div>
        ${buildSimpleSelect('editTtsVoice', TTS_VOICES, p.ttsVoice || '')}
      </div>
      <div class="edit-field-label" style="margin-top:10px">?뚯꽦 ??硫붾え (TTS Prompt)</div>
      <textarea class="edit-textarea" id="editTtsPrompt" placeholder="?? ?쒓뎅???ъ꽦 蹂댁씠?? 李⑤텇?섍퀬 ?먮졆?섍쾶. 媛먯젙 怨쇱옣 ?놁씠 ?꾨떖." style="height:90px">${esc(p.ttsPrompt || '')}</textarea>
      <div class="edit-field-row" style="margin-top:10px">
        <div>
          <div class="edit-field-label">湲곕낯 ??(TTS Tone)</div>
          ${buildSimpleSelect('editTtsTone', TTS_TONES, toneSelectValue)}
        </div>
        <div>
          <div class="edit-field-label">湲곕낯 ??(吏곸젒 ?낅젰)</div>
          <input class="edit-input" id="editTtsToneCustom" placeholder="?? ??퀬 ?대갚?섍쾶, 臾몄옣 ?앹? 吏㏐쾶 ?딄린" value="${esc(toneCustomValue)}" style="width:100%;${toneSelectValue === '__custom__' ? '' : 'display:none;'}">
        </div>
      </div>
      <div style="margin-top:10px">
        <div class="edit-field-label">媛먯젙 諛섏쁺 媛뺣룄</div>
        ${buildSimpleSelect('editTtsEmotionStrength', TTS_EMOTION_STRENGTHS, p.ttsEmotionStrength || 'medium')}
      </div>
    </div>`;
  const ttsToneSel = document.getElementById('editTtsTone');
  if (ttsToneSel) {
    ttsToneSel.onchange = () => {
      const custom = document.getElementById('editTtsToneCustom');
      if (!custom) return;
      const isCustom = ttsToneSel.value === '__custom__';
      custom.style.display = isCustom ? '' : 'none';
      if (!isCustom) custom.value = '';
    };
  }
  // Persona memory panel is hidden; memory is managed by vault markdown files.
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
      // ?붾㈃ 利됱떆 諛섏쁺
      const av = document.querySelector('#editBody .edit-big-img-wrap');
      if (av) av.innerHTML = `<img src="${cropped}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"><div class="edit-big-img-overlay"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;

      const p = getPersona(editingPid); if (!p) return;

      // 3?④퀎 ?몃꽕???앹꽦
      idbSet(`em_full_${p.pid}_neutral_a`, cropped).catch(() => {});
      p._pendingImage = cropped;

      const { sqMd, fullHd, avatarPng } = await generateThumbnailSet(cropped, p.pid, 'neutral_a');

      // 硫붾え由?
      p.image = sqMd;
      p.neutral_md = sqMd;
      p.neutral_hd = fullHd;
      p.neutral_thumb = avatarPng;
      _neutralCache[p.pid] = sqMd;

      showToast('?대?吏 ?좏깮??- ???踰꾪듉???뚮윭以?);
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
      ? `<div class="edit-upload-state done">?꾨즺</div>`
      : item.status === 'fail'
        ? `<div class="edit-upload-state fail">?ㅽ뙣</div>`
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
      showToast('?대?吏 ?뚯씪留??낅줈?쒗븷 ???덉뼱??');
      return;
    }
    if (!files.length) {
      showToast('?대?吏 ?뚯씪留??낅줈?쒗븷 ???덉뼱');
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

  showToast(`珥?{files.length}媛??낅줈??以?..`, 10000);
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
  showToast(`珥?{ok}媛??깃났${fail ? ` / ${fail}媛??ㅽ뙣` : ''}`);
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
      showToast('?대?吏 ?뚯씪留??낅줈?쒗븷 ???덉뼱??');
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
  if (!wUrl) { alert('Worker URL ?놁쓬'); return; }

  _editMultiUploadQueue = files.map((file, idx) => ({
    id: `upload_${Date.now()}_${idx}`,
    name: file.name,
    preview: URL.createObjectURL(file),
    status: 'uploading'
  }));
  renderEditMultiUploadList();
  showToast(`?대?吏 ${files.length}媛??낅줈???쒖옉`);

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
  showToast(`?낅줈???꾨즺: ${ok}${fail ? `, ?ㅽ뙣 ${fail}媛? : ''}`);
}

async function savePersonaEdit() {
  const p = getPersona(editingPid); if (!p) return;
  const personaUpdatedAt = Date.now();
  const newPid = document.getElementById('editPid')?.value.trim();
  if (isNewPersona && newPid && newPid !== p.pid) {
    personas = personas.filter(x => x.pid !== p.pid);
    p.pid = newPid;
    editingPid = newPid;
    personas.push(p);
  }
  p.name = document.getElementById('editName').value.trim() || '?섎Ⅴ?뚮굹';
  p.bio = document.getElementById('editBio').value.trim();
  const selSwatch = document.querySelector('#editBody .hue-swatch.on');
  if (selSwatch?.dataset.hue) p.hue = parseInt(selSwatch.dataset.hue);
  p.tags = [...document.querySelectorAll('#editBody .tag.on')].map(el => el.textContent);
  p.nicknames = (document.getElementById('editNicknames')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  p.userTitle = document.getElementById('editUserTitle')?.value.trim() || '';
  p.age = document.getElementById('editAge')?.value.trim() || '';
  p.gender = document.getElementById('editGender')?.value || '';
  p.mbti = document.getElementById('editMbti')?.value.trim() || '';
  p.hidden = document.getElementById('editHidden')?.value === 'true';
  p.defaultModel = document.getElementById('editDefaultModel')?.value || '';
  p.ttsModel = 'qwen3-tts-flash-realtime';
  p.ttsVoice = document.getElementById('editTtsVoice')?.value || '';
  p.ttsPrompt = document.getElementById('editTtsPrompt')?.value.trim() || '';
  const ttsToneSel = document.getElementById('editTtsTone')?.value || '';
  const ttsToneCustom = document.getElementById('editTtsToneCustom')?.value.trim() || '';
  p.ttsTone = ttsToneSel === '__custom__' ? ttsToneCustom : ttsToneSel;
  p.ttsEmotionEnabled = true;
  p.ttsEmotionStrength = document.getElementById('editTtsEmotionStrength')?.value || 'medium';
  isNewPersona = false;

  if (p._pendingImage) {
    showToast('???대?吏 ???以?..', 5000);
    try {
      const workerUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
      if (!workerUrl) throw new Error('Worker URL ?놁쓬');
      const b64 = p._pendingImage.split(',')[1];
      const byteArr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: 'image/jpeg' });
      const fname = `${p.pid}_neutral_a.jpg`;
      const form = new FormData();
      form.append('file', blob, fname);
      form.append('folder', `profile/${p.pid}`);
      const res = await fetch(workerUrl + '/image', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || '?낅줈???ㅽ뙣');
      p.imageUrl = `${data.url}${String(data.url).includes('?') ? '&' : '?'}v=${personaUpdatedAt}`;
    } catch(e) {
      alert('?낅줈???ㅽ뙣: ' + e.message);
      return;
    }
    delete p._pendingImage;
  }
  p.updatedAt = personaUpdatedAt;
  savePersonas(); renderPersonaGrid(); goMain();
  showToast('??λ맖 ??);
}

// ===============
//  CHAT LIST & SWIPE DELETE
// ===============


// ===============
//  留덊겕?ㅼ슫 ?뚮뜑留??곕え
// ===============
const _DEMO_SLIDES = [
  { label: "??Table)", text: "| ??ぉ | 湲덉븸 | 鍮꾧퀬 |\n|---|---:|---|\n| 留ㅼ텧 | 12,500,000 | 1遺꾧린 |\n| 留ㅼ엯 | 8,200,000 | ?먯옄??|\n| **?곸뾽?댁씡** | **4,300,000** | 34.4% |" },
  { label: "肄붾뱶 釉붾줉", text: "```python\ndef greet(name):\n    return '??덈? ' + name\n\nprint(greet('Riley'))\n```" },
  { label: "筌뤴뫖以?& ?紐꾩뒠", text: "**??삳뮎 ????*\n\n1. 疫꿸퀬????臾믨쉐\n2. ?遺우쁽???귐됰윮\n3. 獄쏄퀬猷??類ㅼ뵥\n\n> ?袁④펾???꾨뗀諭띈퉪?????덉삂??롫뮉 ?꾨뗀諭뜹첎? ??ル뼄" },
  { label: "Mermaid", text: "```mermaid\nflowchart LR\n  A[????? --> B{???뼓}\n  B --> C[??롡뀮???돌]\n  B --> D[筌띾뜇寃??쇱뒲]\n  C --> E[揶쏅Ŋ?숈씠誘몄?]\n  D --> F[???쐭筌?\n```" },
  { label: "筌뤴뫀????쑨??, text: "| 筌뤴뫀??| ??얜즲 | ??쑴??| ?대?吏??밴쉐 |\n|---|:---:|:---:|:---:|\n| grok-4-1-fast-non-reasoning | ??녹뒕??| ??| ??|\n| grok-3-mini | ??녹뒕 | ??| ??|\n| claude-sonnet | ??녹뒕 | ??| ??|\n| gemini-2.5-pro | ??| ??| ??|\n| gpt-4o | ??녹뒕 | ??| ??|" }
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
      roomName: '?뚮뜑留??곕え',
      updatedAt: Date.now(),
      lastPreview: '?섏떇 쨌 肄붾뱶 쨌 Mermaid'
    };
    sessions.unshift(s);
  }
  s.history = [];
  s._loaded = true;
  activeChatId = s.id;
  // 硫붿씤?붾㈃ 諛?梨꾪똿 ???쒖꽦????chatScreen?쇰줈
  show('chatScreen');
  // ?섎떒諛?active ?곹깭 媛깆떊
  ['Persona','Chat','Settings'].forEach(t =>
    document.getElementById('btab'+t)?.classList.toggle('active', false)
  );
  document.getElementById('chatHeaderNames').textContent = '?뚮뜑留??곕え';
  document.getElementById('chatHeaderAvatars').innerHTML =
    '<div class="chat-header-av" style="background:hsl(220,20%,14%);border-color:hsl(220,28%,22%);font-size:18px;display:flex;align-items:center;justify-content:center"></div>';
  const area = document.getElementById('chatArea');
  area.innerHTML = '';
  _showDemoSlide(area);
  const input = document.getElementById('userInput');
  if (input) { input.placeholder = 'Enter ?뚮윭 ?ㅼ쓬 ?щ씪?대뱶'; input.value = ''; input.focus(); }
}

function _showDemoSlide(area) {
  if (_demoSlideIdx >= _DEMO_SLIDES.length) {
    const el = document.createElement('div');
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">???곕え ????br><br><span style="font-size:11px;opacity:.6">吏꾩쭨 梨꾪똿???쒖옉?대킄</span></div>`;
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    document.getElementById('userInput').placeholder = '硫붿떆吏瑜??낅젰?섏꽭??;
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

async function getChatListNeutralThumb(p) {
  if (!p?.pid) return '';
  const circle = await getEmotionCircleThumb(p.pid, 'neutral', '', 80).catch(() => null);
  return circle || p.neutral_thumb || await getNeutralImageThumb(p.pid, 80).catch(() => null) || '';
}

async function renderChatList(options = {}) {
  const force = !!options?.force;
  const list = document.getElementById('chatList');
  const empty = document.getElementById('chatEmpty');
  const signature = JSON.stringify({
    search: _chatSearchQuery || '',
    showHidden: getChatHiddenFilterEnabled(),
    showListAvatars: getChatListAvatarVisibilityEnabled(),
    activeChatId: activeChatId || '',
    sessions: (sessions || []).map(s => ({
      id: s?.id || '',
      updatedAt: Number(s?.updatedAt || 0),
      lastMessageAt: Number(s?.lastMessageAt || 0),
      roomName: s?.roomName || '',
      lastPreview: s?.lastPreview || '',
      hidden: !!s?.hidden,
      participants: (s?.participantPids || []).map(pid => {
        const p = getPersona(pid);
        return {
          pid,
          name: p?.name || '',
          image: p?.image || '',
          neutral_thumb: p?.neutral_thumb || '',
          hue: Number(p?.hue || 0),
          updatedAt: Number(p?.updatedAt || 0)
        };
      })
    }))
  });
  if (!force && list && list.children.length && signature === _lastChatListSignature) return;
  _lastChatListSignature = signature;
  const myVersion = ++_chatListRenderVersion;
  list.querySelectorAll('.chat-list-wrap').forEach(e => e.remove());
  list.querySelectorAll('.chat-list-item').forEach(e => e.remove());
  if (!sessions.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  let sorted = [...sessions].sort((a,b) => getSessionLastMessageSortTs(b) - getSessionLastMessageSortTs(a));
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
    const showListAvatars = getChatListAvatarVisibilityEnabled();
    const roomName = s.roomName || pList.map(p=>p.name).join(', ') || '梨꾪똿';
    const isSinglePersonaChat = pList.length === 1;
    const fallbackAccentByPid = (pid) => {
      const key = String(pid || '').toLowerCase();
      if (/(hongdan|?띾떒)/i.test(key)) return 2;
      if (/(riley|?쇱씪由?/i.test(key)) return 26;
      if (/(avery|?먯씠踰꾨━)/i.test(key)) return 212;
      return 220;
    };
    const accentHue = (() => {
      if (isSinglePersonaChat) {
        const h = Number(pList[0]?.hue);
        if (Number.isFinite(h)) return h;
        return fallbackAccentByPid((s.participantPids || [])[0] || '');
      }
      return 220;
    })();
    const itemBgStyle = isSinglePersonaChat
      ? `background:linear-gradient(180deg, hsl(${accentHue},26%,13%), hsl(${accentHue},24%,10%));`
      : `background:linear-gradient(180deg, hsl(220,8%,10%), hsl(220,8%,8%));`;

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

    const avEls = showListAvatars ? await Promise.all(pList.map(async p => {
      const imgSrc = await getChatListNeutralThumb(p);
      const imgHTML = imgSrc ? `<img src="${imgSrc}" width="80" height="80" loading="lazy" decoding="async">` : defaultAvatar(p.hue);
      return `<div class="chat-av-item" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%)">${imgHTML}</div>`;
    })) : [];
    if (myVersion !== _chatListRenderVersion) return;
    const avWidth = showListAvatars ? (pList.length > 0 ? (80 + (pList.length - 1) * 52) : 80) : 0;

    const previewText = sanitizeChatListPreview(s.lastPreview || buildSessionPreviewFallback(s), s) || '??붾? ?쒖옉?대킄';
    const lastMsgTs = getSessionLastMessageSortTs(s);
    item.innerHTML = `
      <div class="chat-avatars-row" style="width:${avWidth}px;flex-shrink:0;${showListAvatars ? '' : 'display:none;'}">${avEls.join('')}</div>
      <div class="chat-list-info">
        <div class="chat-list-names" style="${isSinglePersonaChat ? `color:hsl(${accentHue},72%,78%);` : ''}">${esc(roomName)}</div>
        <div class="chat-list-preview" style="${isSinglePersonaChat ? `color:hsl(${accentHue},32%,72%);` : ''}">${esc(previewText)}</div>
      </div>
      <div class="chat-list-meta">
        <span class="chat-list-time" style="${isSinglePersonaChat ? `color:hsl(${accentHue},24%,62%);` : ''}">${timeLabel(lastMsgTs || s.updatedAt)}</span>
      </div>`;
    item.style.cssText += itemBgStyle;

    setupSwipeDelete(item, wrap, s.id);
    wrap.appendChild(item);
    frag.appendChild(wrap);
  }
  if (myVersion !== _chatListRenderVersion) return;
  list.querySelectorAll('.chat-list-wrap').forEach(e => e.remove());
  list.appendChild(frag);
  updateChatListVisibilityButton();
  updateChatListAvatarVisibilityButton();
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

const _restoreAutoPurgeTriedIds = new Set();

async function renderRestoreList() {
  const wrap = document.getElementById('restoreList');
  if (!wrap) return;
  wrap.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 2px">遺덈윭?ㅻ뒗 以?..</div>`;
  const deleted = await listDeletedSessionsRemote();
  const isMeaningfulRecoverable = (s) => {
    const count = Number(s?.messageCount || 0);
    const preview = String(s?.lastPreview || '').trim();
    return count > 0 || preview.length > 0;
  };
  const emptySessions = (deleted || []).filter(s => s?.id && !isMeaningfulRecoverable(s));
  for (const s of emptySessions) {
    if (_restoreAutoPurgeTriedIds.has(s.id)) continue;
    _restoreAutoPurgeTriedIds.add(s.id);
    purgeSessionRemote(s.id).catch(() => {});
  }
  const sorted = [...(deleted || []).filter(isMeaningfulRecoverable)]
    .sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
  if (!sorted.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 2px">蹂듭썝 媛?ν븳 梨꾪똿???놁뒿?덈떎.</div>`;
    return;
  }
  wrap.innerHTML = sorted.map(s => {
    const names = (s.roomName || (s.participantPids || []).map(pid => getPersona(pid)?.name || '').filter(Boolean).join(', ') || '梨꾪똿');
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border2);border-radius:10px;background:var(--card)">
        <div style="flex:1;min-width:0;display:grid;gap:3px">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(names)}</div>
          <div style="font-size:11px;line-height:1.45;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(sanitizeChatListPreview(String(s.lastPreview || s.lastMessagePreview || '').trim(), s) || '대화 미리보기 없음')}</div>
          <div style="font-size:11px;color:var(--muted)">삭제: ${timeLabel(s.deletedAt || s.updatedAt || Date.now())}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="restoreDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border2);background:transparent;color:var(--text);font-size:12px;cursor:pointer">媛뺤젣蹂듦뎄</button>
          <button onclick="purgeDeletedChat('${s.id}')" style="padding:7px 10px;border-radius:9px;border:1px solid hsl(0,30%,24%);background:hsl(0,20%,12%);color:hsl(0,70%,68%);font-size:12px;cursor:pointer">?곴뎄??젣</button>
        </div>
      </div>
    `;
  }).join('');
}

async function restoreDeletedChat(id) {
  if (!id) return;
  const res = await restoreDeletedSessionRemote(id);
  if (!res?.ok) {
    showToast('梨꾪똿 蹂듭썝 ?ㅽ뙣');
    return;
  }
  await loadIndex();
  await renderRestoreList();
  renderChatList();
  showToast('梨꾪똿??蹂듭썝?섏뿀?듬땲??);
}

async function purgeDeletedChat(id) {
  if (!id) return;
  if (!confirm('??梨꾪똿 李뚭볼湲곕? KV?먯꽌 ?곴뎄??젣?좉퉴?? 蹂듦뎄?????놁뒿?덈떎.')) return;
  const res = await purgeSessionRemote(id);
  if (!res?.ok) {
    showToast('?곴뎄??젣 ?ㅽ뙣');
    return;
  }
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await renderRestoreList();
  renderChatList();
  showToast('KV?먯꽌 ?곴뎄??젣?덉뒿?덈떎.');
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
  // Double-tap on persona card should always start a fresh 1:1 chat.
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
    editBtn.textContent = '?섎Ⅴ?뚮굹 ?섏젙';
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
  if (newBtn) newBtn.textContent = p?.name ? `${p.name}?먭쾶 留?嫄멸린` : '留?嫄멸린';
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

function handleGlobalShortcutKeys(event) {
  if (!event) return;
  if (activeTab !== 'chat') return;
  if (!event.ctrlKey || event.altKey || event.shiftKey) return;
  if (event.code !== 'Backquote') return;
  try {
    if (window.matchMedia && !window.matchMedia('(pointer:fine)').matches) return;
  } catch {}
  event.preventDefault();
  event.stopPropagation();
  if (activeChatId) toggleChatProfileOverride();
  else toggleChatListAvatarVisibility();
}

function ensureGlobalBackHandler() {
  if (window.__personaBackBound) return;
  window.__personaBackBound = true;
  document.addEventListener('keydown', handleEscBackNavigation);
  document.addEventListener('keydown', handleGlobalShortcutKeys);
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
    masonryResizeTimer = setTimeout(() => {
      const area = document.getElementById('chatArea');
      layoutHorizontalMasonryRows(area || document);
      if (!area) return;
      const chatScreenOpen = document.getElementById('chatScreen')?.classList.contains('active');
      if (!chatScreenOpen || !activeChatId) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          stickChatToBottom(area);
        });
      });
    }, 80);
  });
}

function setupSwipeDelete(item, wrap, id) {
  let startX = 0, startY = 0, currentX = 0, tracking = false, revealed = false;
  let pointerTracking = false, pointerId = null;
  const REVEAL_W = 144, THRESHOLD = 40;
  const setTranslate = (x, animate = false) => {
    item.style.transition = animate ? 'transform .25s cubic-bezier(.25,.8,.25,1)' : 'none';
    item.style.transform = `translateX(${x}px)`;
  };
  const reveal = () => { revealed = true; setTranslate(-REVEAL_W, true); item.onclick = null; };
  const close  = () => { revealed = false; setTranslate(0, true); item.onclick = () => openChat(id); };
  const onMove = (x, y, preventDefault) => {
    if (!tracking) return;
    const dx = x - startX;
    const dy = Math.abs(y - startY);
    if (dy > 12 && Math.abs(dx) < dy) { tracking = false; return; }
    if (dx > 0 && !revealed) return;
    if (preventDefault) preventDefault();
    currentX = Math.max(-REVEAL_W, Math.min(0, (revealed ? -REVEAL_W : 0) + dx));
    setTranslate(currentX);
  };
  const onEnd = (x) => {
    if (!tracking) return;
    tracking = false;
    const dx = x - startX;
    if (revealed) { dx > THRESHOLD ? close() : reveal(); } else { dx < -THRESHOLD ? reveal() : close(); }
  };

  item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true; }, { passive: true });
  item.addEventListener('touchmove', e => {
    onMove(e.touches[0].clientX, e.touches[0].clientY, () => e.preventDefault());
  }, { passive: false });
  item.addEventListener('touchend', e => {
    onEnd(e.changedTouches[0].clientX);
  });

  item.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    pointerTracking = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
    try { item.setPointerCapture(pointerId); } catch {}
  });
  item.addEventListener('pointermove', e => {
    if (!pointerTracking || e.pointerId !== pointerId) return;
    onMove(e.clientX, e.clientY, () => e.preventDefault());
  });
  item.addEventListener('pointerup', e => {
    if (!pointerTracking || e.pointerId !== pointerId) return;
    pointerTracking = false;
    try { item.releasePointerCapture(pointerId); } catch {}
    onEnd(e.clientX);
    pointerId = null;
  });
  item.addEventListener('pointercancel', e => {
    if (!pointerTracking || e.pointerId !== pointerId) return;
    pointerTracking = false;
    tracking = false;
    try { item.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
    close();
  });
  wrap.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchstart', e => { if (revealed && !wrap.contains(e.target)) close(); }, { passive: true });
  document.addEventListener('pointerdown', e => { if (revealed && !wrap.contains(e.target)) close(); }, { passive: true });
}

async function deleteChatFromDrawer() {
  if (!confirm('??梨꾪똿諛⑹쓣 ??젣?좉퉴?? ??λ맂 ?댁슜? 紐⑤몢 ?щ씪?몄슂')) return;
  const id = activeChatId;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('梨꾪똿???댁??듭쑝濡??대룞?섏뿀?듬땲??');
  saveIndex(); closeDrawer(); activeChatId = null; goMain(); switchTab('chat');
}

async function deleteChat(id) {
  if (!confirm('??梨꾪똿????젣?좉퉴??')) return;
  sessions = sessions.filter(s => s.id !== id);
  removeLocalSession(id);
  await deleteSessionRemote(id).catch(() => {});
  showToast('梨꾪똿???댁??듭쑝濡??대룞?섏뿀?듬땲??');
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
  showToast(s.hidden ? '梨꾪똿???④꺼議뚯뼱??' : '梨꾪똿???ㅼ떆 蹂댁씠寃??덉뼱??');
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
  const available = (personas || []).filter(p => !p?.hidden);
  for (const p of available) {
    const card = document.createElement('div');
    card.className = 'select-card'; card.style.position = 'relative';
    card.onclick = () => toggleSelectPid(p.pid, card);
    const neutral = await getEmotionImage(p.pid, 'neutral', 420) || await getNeutralImage(p.pid);
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
    if (selectedPids.length >= MAX_PARTICIPANTS) { showToast(`理쒕? ${MAX_PARTICIPANTS}紐낃퉴吏 李몄뿬 媛?ν빐`); return; }
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
  if (!s._loaded) {
    try {
      const cached = getLocalSession(id);
      if (Array.isArray(cached)) {
        s.history = cached;
        s._loaded = true;
      }
    } catch(e) {}
  }
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
    const img = headSrc ? `<img src="${headSrc}" width="42" height="42" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
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
      if (avEl) {
        const cur = avEl.querySelector('img')?.getAttribute('src') || '';
        if (cur !== img) avEl.innerHTML = `<img src="${img}" width="42" height="42" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
      }
    }
  });

  show('chatScreen');
  switchInputTab('chat');
  setChatBusy(hasActiveGeneration(id));

  // 泥?踰덉㎏ ?섎Ⅴ?뚮굹???꾩옱 ?좏슚 紐⑤뜽??UI???숆린??(湲곕낯/梨꾪똿諛??ㅻ쾭?쇱씠??諛섏쁺)
  const modelEl = document.getElementById('chatModeSelect');
  if (modelEl) {
    const firstPersona = pList[0] || null;
    const effectiveModel = (firstPersona ? getPersonaModel(s, firstPersona) : '')
      || '';
    if (effectiveModel) modelEl.value = effectiveModel;
  }

  renderChatArea();
  if (s._demo) return;
  if (!s._loaded) {
    await loadSession(id);
    if (openToken !== _chatOpenToken || activeChatId !== id) return;
    renderChatArea();
  }
  if (typeof refreshCurrentChatIfStale === 'function') {
    refreshCurrentChatIfStale(id).then((changed) => {
      if (!changed) return;
      if (openToken !== _chatOpenToken || activeChatId !== id) return;
      renderChatArea();
    }).catch(() => {});
  }
}

function goMain() {
  _isDemoMode = false;
  activeChatId = null;
  const input = document.getElementById('userInput');
  if (input) input.placeholder = '硫붿떆吏瑜??낅젰?섏꽭??;
  show('mainScreen');
  renderChatList();
}

async function renderChatArea() {
  const session = getActiveSession(); if (!session) return;
  const renderSessionId = session.id;
  if (session._markdownDemo) return; // ?곕え??吏곸젒 愿由?  const area = document.getElementById('chatArea');
  const empty = document.getElementById('chatEmpty2');
  bindChatAutoStick(area);
  area.dataset.autoStick = '1';

  if (!session.history || !session.history.length) {
    area.classList.remove('has-messages');
    [...area.children].forEach(c => { if (c.id !== 'chatEmpty2') c.remove(); });
    empty.style.display = 'flex';
    const pList = (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
    document.getElementById('emptyText').textContent = pList.map(p=>p.name).join(', ') + '?섍퍡 硫붿떆吏瑜??낅젰?대낫?몄슂';
    return;
  }
  area.classList.add('has-messages');
  empty.style.display = 'none';
  area.dataset.imageLoadStick = '1';
  setTimeout(() => {
    if (document.getElementById('chatArea') === area) area.dataset.imageLoadStick = '0';
  }, 2600);

  const fragment = document.createDocumentFragment();
  let shouldSavePatchedSuffix = false;
  for (const msg of session.history) {
    const el = document.createElement('div');
    if (msg.role === 'user') {
  let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.find(c=>c.type==='text')?.text||'(硫붿떆吏)' : '(?먮뒗 ?띿뒪??');
  el.innerHTML = msg._rendered || renderUserMessageHTML(msg);
} else {
      const pList = getSessionPersonas(session);
      const renderPersonas = msg.personaSnapshot
        ? msg.personaSnapshot.map(snap => getPersona(snap.pid) || { pid:snap.pid, name:snap.name, image:null, hue:0, _ghost:true })
        : pList;
      if (!msg._suffixes || typeof msg._suffixes !== 'object') msg._suffixes = {};
      el.innerHTML = await renderAIResponseHTML(msg.content, renderPersonas, msg._suffixes);
      if (renderAIResponseHTML._lastSuffixPatched) shouldSavePatchedSuffix = true;
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
  requestAnimationFrame(() => { stickChatToBottom(area, { force: true }); });
  if (_pendingArchiveFocus) setTimeout(() => focusPendingArchiveMessage(), 40);
  if (shouldSavePatchedSuffix && !session._demo) {
    session.updatedAt = Date.now();
    saveSession(session.id);
    saveIndex();
  }
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
    showToast('?대┰蹂대뱶??蹂듭궗?섏뿀?듬땲??, 1200);
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = btn.dataset.orig; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(plainText).then(markDone).catch(() => { doFallback(); markDone(); });
  } else { doFallback(); markDone(); }
}

async function renderAIResponseHTML(rawText, pList, suffixes = {}, createdAt = null, forceOneToOne = null) {
  let suffixPatched = false;
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
    const suffixKey = `${p.pid}:${seg.emotion}`;
    let suffix = suffixes[suffixKey] || '';
    let dataUrl = avStyle !== 'circle'
      ? (suffix
        ? await getEmotionImageSuffixed(p.pid, seg.emotion, suffix, rectDisplayPx)
        : await getEmotionImage(p.pid, seg.emotion, rectDisplayPx))
      : null;
    if (!dataUrl) {
      const fallbackSuffix = await resolveFallbackSuffixForMissingEmotion(p.pid, seg.emotion, suffix);
      if (fallbackSuffix !== null && fallbackSuffix !== suffix) {
        suffix = fallbackSuffix;
        suffixes[suffixKey] = fallbackSuffix;
        suffixPatched = true;
        dataUrl = avStyle !== 'circle'
          ? (suffix
            ? await getEmotionImageSuffixed(p.pid, seg.emotion, suffix, rectDisplayPx)
            : await getEmotionImage(p.pid, seg.emotion, rectDisplayPx))
          : null;
      }
    }
    if (!dataUrl) {
      suffix = '';
      suffixes[suffixKey] = '';
      suffixPatched = true;
      dataUrl = await getEmotionImage(p.pid, 'neutral', rectDisplayPx);
    }
    const circleThumb = await getPersonaCircleThumb(p.pid, seg.emotion, suffix, circleDisplayPx);
    
    if (dataUrl) { 
      baseImg = `<img src="${dataUrl}" width="400" height="600" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
      thumbSrc = dataUrl; 
    }
    if (circleThumb) thumbSrc = circleThumb;
    
    const safePid = p.pid.replace(/'/g, "\\'");
    const safeEmotion = (seg.emotion||'neutral').replace(/'/g, "\\'");
    const safeSuffix = suffix.replace(/'/g, "\\'");
    const safeThumb = thumbSrc.replace(/'/g, "\\'");
    const celebStroke = '';
    
    // ?ㅼ젙???곕Ⅸ ?ㅽ???寃곗젙
    const avDisplay = avStyle === 'hidden' ? 'display:none;' : '';
    const avShape = avStyle === 'circle' ? 'border-radius:50%; width:min(25vw,80px); height:min(25vw,80px); aspect-ratio:1/1; max-height:80px;' : '';
    if (avStyle === 'circle' && circleThumb) {
      baseImg = `<img src="${circleThumb}" width="80" height="80" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
    }
    
    const fmtContent = fmt(seg.content);

    // AI ?앹꽦 ?대?吏 媛먯? (留덊겕?ㅼ슫 ![](url) ?먮뒗 plain URL)
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

    // ?대┃ ???앹뾽 ?곌껐 (?대?吏??onclick 二쇱엯)
    let renderedContent = fmtContent;
    if (hasImg && imageUrls.length > 0) {
      renderedContent = fmtContent.replace(
        /<img([^>]*?)src="([^"]+)"([^>]*?)>/gi,
        (_, pre, src, post) => {
          const safeSrc = String(src || '').replace(/'/g, "\\'");
          const safeKey = String(extractR2ImageKey(src) || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `<div class="inline-image-wrap"><img${pre}src="${src}"${post} onclick="openImagePopup('${safeSrc}')" style="cursor:pointer"><div class="inline-image-actions"><button class="image-popup-action-btn" onclick="addImageSourceToComposer('${safeSrc}','generated.jpg')" title="?뚯뒪濡?異붽?"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button><button class="image-popup-action-btn" onclick="downloadImage('${safeSrc}','generated.jpg')" title="?ㅼ슫濡쒕뱶"><svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg></button></div></div>`;
        }
      );
    }

    // ???踰꾪듉
    const dlBtn = '';

    html += `<div class="ai-msg ${hasImg ? 'ai-msg-img' : 'ai-msg-text'} ${isOneToOne ? 'one-to-one' : ''}" data-pid="${esc(p.pid)}" data-emotion="${esc(safeEmotion)}" style="${opacity}">
      <div class="msg-av" style="background:hsl(${h},20%,11%);border-color:hsl(${h},28%,22%);${celebStroke};${avDisplay}${avShape}" onclick="openProfilePopup('${safePid}','${safeEmotion}',${h},'${safeThumb}','${safeSuffix}')">${baseImg}</div>
      <div class="bubble-col">
        <div class="msg-pname" style="color:hsl(${h},65%,72%)">
          <span class="msg-pname-text">${esc(p.name)}${p._ghost?`<span style="font-size:9px;opacity:.5">(??젣)</span>`:''}</span>
          
        </div>
        <div class="${bubbleWrapClass}">
          <div class="${bubbleClass}" style="background:hsl(${h},25%,13%);color:hsl(${h},55%,85%)">${renderedContent}</div>
        </div>
      </div>
    </div>`;
  }
  renderAIResponseHTML._lastSuffixPatched = suffixPatched;
  return `<div class="msg-group ai-msgs">${html}</div>`;
}

async function appendAIReplySequentially(reply, pList, suffixes, createdAt, tgtArea, renderSessionId, allowedEmotionMap = null) {
  const segments = parseResponse(reply, pList, allowedEmotionMap);
  const delays = segments.length > 1 ? 240 : 0;
  for (let i = 0; i < segments.length; i++) {
    if (isSessionGenerationCancelled(renderSessionId) || activeChatId !== renderSessionId) return;
    const seg = segments[i];
    const segText = seg?.content?.trim?.() ? seg.content : '';
    if (!segText) continue;
    const p = pList[seg.idx] || pList[0];
    if (!p) continue;
    const segReply = `[${p.pid}][emotion:${seg.emotion || 'neutral'}]${segText}[/${p.pid}]`;
    const html = await renderAIResponseHTML(segReply, [p], suffixes, createdAt, (pList || []).length <= 1);
    if (isSessionGenerationCancelled(renderSessionId) || activeChatId !== renderSessionId) return;
    const replyEl = document.createElement('div');
    replyEl.innerHTML = html;
    if (replyEl.firstElementChild) {
      replyEl.firstElementChild.classList.add('msg-enter');
      attachMessageMeta(replyEl.firstElementChild, createdAt, 'left');
      enhanceRenderedMessage(replyEl.firstElementChild);
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

// 肄섑뀗痢좎뿉??紐⑤뜽???섎せ 異붽????쒓렇 ?쒓굅
// [worry]...[/worry], [emotion:worry], [p_xxx]...[/p_xxx] ??
function cleanContent(text) {
  const emotionPat = EMOTIONS.join('|');
  return text
    // [emotionName]...[/emotionName] 媛먯떥湲????댁슜留??④?
    .replace(new RegExp(`\\[(${emotionPat})\\]([\\s\\S]*?)\\[\\/(${emotionPat})\\]`, 'gi'), '$2')
    // ?⑤룆 [emotionName] ?먮뒗 [/emotionName]
    .replace(new RegExp(`\\[\\/?(?:${emotionPat})\\]`, 'gi'), '')
    // [emotion:xxx] ?쒓렇
    .replace(/\[emotion:\s*\w+\s*\]/gi, '')
    // ?대쫫: ?쇰줈 ?쒖옉?섎뒗 ?묐몢??(pid ?쒓렇 ?놁씠 ?대쫫留?遺숇뒗 寃쎌슦)
    .replace(/^\s*\w+\s*:\s*/, '')
    .trim();
}

function clampEmotionForPid(parsedEmotion, pid, allowedEmotionMap = null) {
  const e = String(parsedEmotion || '').toLowerCase();
  const safe = EMOTIONS.includes(e) ? e : 'neutral';
  const allowed = allowedEmotionMap && pid ? allowedEmotionMap[pid] : null;
  if (!Array.isArray(allowed) || !allowed.length) return safe;
  if (allowed.includes(safe)) return safe;
  if (allowed.includes('neutral')) return 'neutral';
  return String(allowed[0] || 'neutral');
}

async function resolveFallbackSuffixForMissingEmotion(pid, emotion, requestedSuffix = '') {
  try {
    const keys = await getImageList(pid);
    const info = getSuffixesForEmotion(keys, pid, emotion);
    const req = String(requestedSuffix || '').toLowerCase();
    if (req && Array.isArray(info?.suffixed) && info.suffixed.includes(req)) return req;
    if (Array.isArray(info?.suffixed) && info.suffixed.length > 0) return info.suffixed[0];
    if (info?.hasBase) return '';
  } catch {}
  return null;
}

async function buildPersonaAvailableEmotionMap(pList) {
  const out = {};
  const list = Array.isArray(pList) ? pList : [];
  for (const p of list) {
    const pid = String(p?.pid || '');
    if (!pid) continue;
    try {
      const keys = await getImageList(pid);
      const allowed = [];
      const hasNeutralA = keys.includes(`profile/${pid}/${pid}_neutral_a.jpg`);
      const hasNeutral = keys.includes(`profile/${pid}/${pid}_neutral.jpg`);
      if (hasNeutralA || hasNeutral) allowed.push('neutral');
      for (const emotion of EMOTIONS) {
        if (emotion === 'neutral') continue;
        const { suffixed, hasBase } = getSuffixesForEmotion(keys, pid, emotion);
        if ((suffixed && suffixed.length) || hasBase) allowed.push(emotion);
      }
      out[pid] = [...new Set(allowed)];
      if (!out[pid].length) out[pid] = ['neutral'];
    } catch {
      out[pid] = ['neutral'];
    }
  }
  return out;
}

function parseResponse(text, pList, allowedEmotionMap = null) {
  const tagPattern = pList.map(p => p.pid).join('|');
  if (!tagPattern) return [{ idx:0, content:text.trim(), emotion:'neutral' }];
  const cleaned = text.replace(/\([^)]+\)\s*(?=\[)/g, '');
  
  const segRegex = new RegExp(`\\[(${tagPattern})\\]\\s*(?:\\[emotion:\\s*([a-zA-Z]+)\\s*\\])?([\\s\\S]*?)(?=\\[\\/?(?:${tagPattern})\\]|$)`, 'g');
  const parts = [];
  let m;
  while ((m = segRegex.exec(cleaned)) !== null) {
    const pid = m[1];
    const parsedEmotion = m[2] ? m[2].toLowerCase() : 'neutral';
    
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
      const emotion = clampEmotionForPid(parsedEmotion, pid, allowedEmotionMap);
      const namePrefix = new RegExp(`^${pList[idx].name}\\s*:\\s*`, 'i');
      content = content.replace(namePrefix, '').trim();
      content = cleanContent(content); // ?붿뿬 媛먯젙?쒓렇 ?쒓굅
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
//  ?낅젰 ??(梨꾪똿 / ?대?吏 / 而⑦뀓?ㅽ듃)
// ===============
let _inputTab = 'chat'; // ?꾩옱 ?낅젰 ??
const _chatGenerations = new Map();

function getChatGeneration(sessionId) {
  const key = String(sessionId || '').trim();
  if (!key) return null;
  return _chatGenerations.get(key) || null;
}

function hasActiveGeneration(sessionId) {
  const gen = getChatGeneration(sessionId);
  return !!(gen && !gen.cancelled);
}

function isSessionGenerationCancelled(sessionId) {
  const gen = getChatGeneration(sessionId);
  return !gen || !!gen.cancelled;
}

function setChatGeneration(sessionId, generation) {
  const key = String(sessionId || '').trim();
  if (!key || !generation) return;
  _chatGenerations.set(key, generation);
}

function clearChatGeneration(sessionId, expectedGeneration = null) {
  const key = String(sessionId || '').trim();
  if (!key) return;
  const current = _chatGenerations.get(key);
  if (!current) return;
  if (expectedGeneration && current !== expectedGeneration) return;
  _chatGenerations.delete(key);
}
let _lastImageModelValue = '';
let _popupZoomed = false;
let _popupPanning = false;
let _popupPanOffset = { x: 0, y: 0 };
let _popupPanLast = { x: 0, y: 0 };
let _popupPanStart = { x: 0, y: 0 };
let _popupPanMoved = false;
let _popupZoomLevel = 1;
let _popupSuppressCloseUntil = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let _ttsCurrentBtn = null;
let _ttsCurrentUtter = null;
let _ttsCurrentAudio = null;
let _ttsCurrentAudioUrl = '';

function ttsSpeakerIconSVG() {
  return '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3l4-3v10l-4-3H3z"/><path d="M13 7.2a2.6 2.6 0 0 1 0 3.6"/><path d="M14.8 5.6a4.8 4.8 0 0 1 0 6.8"/></svg>';
}

function ttsStopCurrent() {
  try { window.speechSynthesis?.cancel?.(); } catch {}
  try {
    if (_ttsCurrentAudio) {
      _ttsCurrentAudio.onended = null;
      _ttsCurrentAudio.onerror = null;
      _ttsCurrentAudio.pause();
      _ttsCurrentAudio.src = '';
    }
  } catch {}
  _ttsCurrentAudio = null;
  if (_ttsCurrentAudioUrl) {
    try { URL.revokeObjectURL(_ttsCurrentAudioUrl); } catch {}
  }
  _ttsCurrentAudioUrl = '';
  if (_ttsCurrentBtn) _ttsCurrentBtn.classList.remove('speaking');
  _ttsCurrentBtn = null;
  _ttsCurrentUtter = null;
}

function pickKoreanFemaleVoice() {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  if (!voices.length) return null;
  const ko = voices.filter(v => /^ko(-|_)?/i.test(String(v.lang || '')) || /korean|ko-kr/i.test(String(v.name || '')));
  const women = ko.filter(v => /female|woman|girl|yuna|sora|sunhi|jihye|nari/i.test(String(v.name || '')));
  return women[0] || ko[0] || voices[0] || null;
}

function speakTextWithBrowserTts(rawText, btn = null) {
  const text = String(rawText || '').trim();
  if (!text) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    showToast('??釉뚮씪?곗???TTS瑜?吏?먰븯吏 ?딆뒿?덈떎.');
    return;
  }
  if (_ttsCurrentBtn && _ttsCurrentBtn === btn) {
    ttsStopCurrent();
    return;
  }
  ttsStopCurrent();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = 1.0;
  utter.pitch = 1.05;
  utter.volume = 1.0;
  const voice = pickKoreanFemaleVoice();
  if (voice) utter.voice = voice;
  utter.onend = () => {
    if (_ttsCurrentBtn) _ttsCurrentBtn.classList.remove('speaking');
    _ttsCurrentBtn = null;
    _ttsCurrentUtter = null;
  };
  utter.onerror = () => {
    if (_ttsCurrentBtn) _ttsCurrentBtn.classList.remove('speaking');
    _ttsCurrentBtn = null;
    _ttsCurrentUtter = null;
    showToast('TTS ?ъ깮???ㅽ뙣?덉뒿?덈떎.');
  };
  _ttsCurrentBtn = btn || null;
  _ttsCurrentUtter = utter;
  if (_ttsCurrentBtn) _ttsCurrentBtn.classList.add('speaking');
  synth.speak(utter);
}

function resolveActiveTtsConfig() {
  const s = sessions.find(x => x.id === activeChatId);
  const pids = Array.isArray(s?.participantPids) ? s.participantPids : [];
  const firstPersona = pids.length ? getPersona(pids[0]) : null;
  const model = 'qwen3-tts-flash-realtime';
  const voice = String(firstPersona?.ttsVoice || '').trim() || 'Serena';
  const prompt = String(firstPersona?.ttsPrompt || '').trim();
  const tone = String(firstPersona?.ttsTone || '').trim();
  const emotionEnabled = true;
  const emotionStrength = String(firstPersona?.ttsEmotionStrength || 'medium').trim() || 'medium';
  return { model, voice, prompt, tone, emotionEnabled, emotionStrength };
}

function toKoreanNativeUnder100(n) {
  const num = Math.trunc(Number(n || 0));
  if (!Number.isFinite(num) || num <= 0 || num >= 100) return '';
  const ones = ['', '??, '??, '??, '??, '?ㅼ꽢', '?ъ꽢', '?쇨낢', '?щ뜜', '?꾪솄'];
  const tens = ['', '??, '?ㅻЪ', '?쒕Ⅸ', '留덊쓷', '??, '?덉닚', '?쇳쓷', '?щ뱺', '?꾪쓷'];
  const t = Math.floor(num / 10);
  const o = num % 10;
  return `${tens[t]}${ones[o]}`;
}

function toKoreanSinoInteger(n) {
  let num = Math.trunc(Number(n || 0));
  if (!Number.isFinite(num)) return '';
  if (num === 0) return '??;
  const negative = num < 0;
  if (negative) num = Math.abs(num);
  const digits = ['', '??, '??, '??, '??, '??, '??, '移?, '??, '援?];
  const smallUnits = ['', '??, '諛?, '泥?];
  const bigUnits = ['', '留?, '??, '議?, '寃?];
  let group = 0;
  let out = '';
  while (num > 0 && group < bigUnits.length) {
    const part = num % 10000;
    if (part > 0) {
      const p1 = Math.floor(part / 1000);
      const p2 = Math.floor((part % 1000) / 100);
      const p3 = Math.floor((part % 100) / 10);
      const p4 = part % 10;
      const vals = [p1, p2, p3, p4];
      let chunk = '';
      vals.forEach((v, i) => {
        if (!v) return;
        const unitIdx = 3 - i;
        chunk += `${v === 1 && unitIdx > 0 ? '' : digits[v]}${smallUnits[unitIdx]}`;
      });
      out = `${chunk}${bigUnits[group]}${out}`;
    }
    num = Math.floor(num / 10000);
    group += 1;
  }
  return negative ? `留덉씠?덉뒪 ${out}` : out;
}

function toKoreanNumberForTtsToken(token) {
  const raw = String(token || '').replace(/,/g, '');
  if (!/^-?\d+$/.test(raw)) return token;
  const n = Number(raw);
  if (!Number.isFinite(n)) return token;
  const abs = Math.abs(n);
  if (abs >= 1 && abs <= 99) {
    const native = toKoreanNativeUnder100(abs);
    if (native) return n < 0 ? `留덉씠?덉뒪 ${native}` : native;
  }
  return toKoreanSinoInteger(n) || token;
}

function toKoreanPhoneDigits(token) {
  const digits = String(token || '').replace(/\D/g, '');
  if (!digits) return token;
  const map = ['怨?, '??, '??, '??, '??, '??, '??, '移?, '??, '援?];
  return digits.split('').map((d) => map[Number(d)] || d).join('');
}

function toKoreanCounterUnder100(n) {
  const num = Math.trunc(Number(n || 0));
  if (!Number.isFinite(num) || num <= 0 || num >= 100) return '';
  if (num === 20) return '?ㅻТ';
  return toKoreanNativeUnder100(num);
}

function toKoreanSinoDecimal(raw) {
  const s = String(raw || '').replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return raw;
  if (!s.includes('.')) return toKoreanSinoInteger(s);
  const negative = s.startsWith('-');
  const [intPart, fracPart = ''] = (negative ? s.slice(1) : s).split('.');
  const digitMap = ['??, '??, '??, '??, '??, '??, '??, '移?, '??, '援?];
  const left = toKoreanSinoInteger(intPart);
  const right = fracPart.split('').map((d) => digitMap[Number(d)] || d).join('');
  return `${negative ? '留덉씠?덉뒪 ' : ''}${left}??{right}`;
}

function normalizeTtsReadableText(rawText) {
  let text = sanitizeTextForUnicodeSafety(String(rawText || ''));
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\(([^)]*)\)|\[([^\]]*)\]|\{([^}]*)\}/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/[*_#|~<>]/g, ' ')
    .replace(/[_=]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/\b(0\d{1,2})[-\s]?(\d{3,4})[-\s]?(\d{4})\b/g, (_, a, b, c) => {
    return `${toKoreanPhoneDigits(a)}??${toKoreanPhoneDigits(b)}??${toKoreanPhoneDigits(c)}`;
  });
  text = text.replace(/(\d{2,4})\s*??s*(\d{1,2})\s*??s*(\d{1,2})\s*??g, (_, y, m, d) => {
    const year = toKoreanSinoInteger(y);
    const monthNum = Number(String(m).replace(/,/g, ''));
    const month = monthNum === 6 ? '?좎썡' : (monthNum === 10 ? '?쒖썡' : `${toKoreanSinoInteger(m)}??);
    const day = `${toKoreanSinoInteger(d)}??;
    return `${year}??${month} ${day}`;
  });
  text = text.replace(/(\d{1,2})\s*??g, (_, m) => {
    const monthNum = Number(String(m).replace(/,/g, ''));
    if (monthNum === 6) return '?좎썡';
    if (monthNum === 10) return '?쒖썡';
    return `${toKoreanSinoInteger(m)}??;
  });
  text = text.replace(/(\d{1,2})\s*??g, (_, h) => {
    const hourNum = Number(String(h).replace(/,/g, ''));
    const spoken = toKoreanNativeUnder100(hourNum) || toKoreanSinoInteger(h);
    return `${spoken}??;
  });
  text = text.replace(/(-?\d[\d,]*)\s*(遺?珥?????/g, (_, n, unit) => {
    return `${toKoreanSinoInteger(n)}${unit}`;
  });
  text = text.replace(/(\d{1,2})\s*(媛?紐?留덈━|?|沅???蹂?????踰?/g, (_, n, unit) => {
    const spoken = toKoreanCounterUnder100(n) || toKoreanSinoInteger(n);
    return `${spoken} ${unit}`;
  });
  text = text.replace(/(-?\d[\d,]*(?:\.\d+)?)\s*(???щ윭|kg|g|km|cm|mm|m짼|m2|m|L|l|ml|%|????/g, (_, n, unit) => {
    const unitMap = {
      kg: '?щ줈洹몃옩', g: '洹몃옩', km: '?щ줈誘명꽣', cm: '?쇳떚誘명꽣', mm: '諛由щ???,
      m: '誘명꽣', m2: '?쒓낢誘명꽣', 'm짼': '?쒓낢誘명꽣', L: '由ы꽣', l: '由ы꽣', ml: '諛由щ━??,
      '%': '?쇱꽱??, '??: '??, ?? '??, ?щ윭: '?щ윭', ?? '??,
    };
    const spoken = toKoreanSinoDecimal(n);
    return `${spoken} ${unitMap[unit] || unit}`;
  });
  text = text.replace(/\d[\d,]*/g, (m) => toKoreanNumberForTtsToken(m));
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

async function speakTextWithServerTts(rawText, btn = null, opts = {}) {
  const text = normalizeTtsReadableText(rawText);
  if (!text) return;
  if (_ttsCurrentBtn && _ttsCurrentBtn === btn) {
    ttsStopCurrent();
    return;
  }
  ttsStopCurrent();

  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) throw new Error('WORKER_URL missing');
  const cfg = resolveActiveTtsConfig();
  const model = 'qwen3-tts-flash-realtime';
  const emotion = String(opts?.emotion || '').trim();
  const payload = {
    text,
    sessionId: String(activeChatId || ''),
    model,
    voice: cfg.voice || 'Cherry',
    prompt: cfg.prompt || '',
    tone: cfg.tone || '',
    emotion,
    emotionEnabled: !!cfg.emotionEnabled,
    emotionStrength: cfg.emotionStrength || 'medium',
    format: 'mp3',
  };
  const localCacheKey = await makeLocalTtsCacheKey(payload);

  _ttsCurrentBtn = btn || null;
  if (_ttsCurrentBtn) _ttsCurrentBtn.classList.add('speaking');
  const cachedBlob = await getLocalTtsAudioBlob(localCacheKey);
  if (cachedBlob) {
    await playTtsBlob(cachedBlob);
    return;
  }
  const res = await fetch(`${wUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    _ttsCurrentBtn?.classList.remove('speaking');
    _ttsCurrentBtn = null;
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `TTS ${res.status}`);
  }

  const blob = await res.blob();
  await idbSet(localCacheKey, blob).catch(() => {});
  await playTtsBlob(blob);
}

async function sha256HexBrowser(input = '') {
  const data = new TextEncoder().encode(String(input || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeLocalTtsCacheKey(payload = {}) {
  const basis = JSON.stringify({
    v: 1,
    sessionId: String(payload.sessionId || ''),
    text: String(payload.text || ''),
    model: String(payload.model || ''),
    voice: String(payload.voice || ''),
    prompt: String(payload.prompt || ''),
    tone: String(payload.tone || ''),
    emotion: String(payload.emotion || ''),
    emotionEnabled: !!payload.emotionEnabled,
    emotionStrength: String(payload.emotionStrength || ''),
    format: String(payload.format || 'mp3'),
    language: 'Korean',
  });
  return `tts_audio_${await sha256HexBrowser(basis)}`;
}

async function getLocalTtsAudioBlob(key = '') {
  if (!key) return null;
  const cached = await idbGet(key).catch(() => null);
  if (cached instanceof Blob) return cached;
  if (cached instanceof ArrayBuffer) return new Blob([cached], { type: 'audio/mpeg' });
  return null;
}

async function playTtsBlob(blob) {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  _ttsCurrentAudio = audio;
  _ttsCurrentAudioUrl = audioUrl;
  audio.onended = () => ttsStopCurrent();
  audio.onerror = () => {
    ttsStopCurrent();
    showToast('TTS ?ъ깮???ㅽ뙣?덉뒿?덈떎.');
  };
  await audio.play();
}

async function clearTtsAudioCache() {
  if (!confirm('濡쒖뺄 蹂댁씠??罹먯떆瑜??꾨? ??젣?좉퉴?')) return;
  const deleted = await idbDelByPrefix('tts_audio_').catch(() => 0);
  showToast(`蹂댁씠??罹먯떆 ??젣?? ${deleted || 0}媛?);
}

function createTtsButton(text = '', opts = {}) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn tts-btn';
  btn.type = 'button';
  btn.title = '?쎌뼱二쇨린';
  btn.dataset.ttsText = encodeCopyPayload(text || '');
  btn.dataset.ttsEmotion = String(opts?.emotion || '');
  btn.innerHTML = ttsSpeakerIconSVG();
  btn.onclick = async () => {
    const target = decodeCopyPayload(btn.dataset.ttsText || '') || String(text || '');
    const emotion = String(btn.dataset.ttsEmotion || '').trim();
    try {
      await speakTextWithServerTts(target, btn, { emotion });
    } catch (e) {
      console.warn('[tts] server failed:', e?.message || e);
      if (_ttsCurrentBtn) _ttsCurrentBtn.classList.remove('speaking');
      _ttsCurrentBtn = null;
      showToast('TTS ?ъ깮???ㅽ뙣?덉뒿?덈떎.');
    }
  };
  return btn;
}

function supportsLiveStreamModel(model = '') {
  const m = String(model || '');
  return m.startsWith('gemini') || m.startsWith('grok') || m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4');
}

function updateThinkingStreamPreview(thinkEl, text) {
  if (!thinkEl) return;
  const safe = esc(String(text || '').trim() || '...');
  thinkEl.innerHTML = `<div class="thinking-stream-preview" style="white-space:pre-wrap;line-height:1.55;color:var(--text);max-width:min(78vw,740px)">${safe}</div>`;
}

function extractStreamingEmotion(raw = '') {
  const m = String(raw || '').match(/\[emotion:\s*([a-zA-Z]+)\s*\]/i);
  if (!m) return '';
  const e = String(m[1] || '').toLowerCase();
  return EMOTIONS.includes(e) ? e : '';
}

async function createLiveStreamBubble(tgtArea, persona, createdAt, renderSessionId, emotion = 'neutral') {
  if (!tgtArea || !persona) return null;
  const safeEmotion = EMOTIONS.includes(String(emotion || '').toLowerCase()) ? String(emotion).toLowerCase() : 'neutral';
  let preferredCircle = '';
  let preferredRect = '';
  try { preferredCircle = await getEmotionCircleThumb(persona.pid, safeEmotion, '', 80) || ''; } catch {}
  try { preferredRect = await getEmotionImage(persona.pid, safeEmotion, 200) || ''; } catch {}
  const seed = `[${persona.pid}][emotion:${safeEmotion}]...[/${persona.pid}]`;
  const html = await renderAIResponseHTML(seed, [persona], {}, createdAt, true);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild;
  if (!root) return null;
  const avatarImg = root.querySelector('.msg-av img');
  if (avatarImg && (preferredCircle || preferredRect)) {
    avatarImg.setAttribute('src', preferredCircle || preferredRect);
  }
  root.classList.add('msg-enter');
  attachMessageMeta(root, createdAt, 'left');
  enhanceRenderedMessage(root);
  tgtArea.appendChild(root);
  updateChatBottomAnchor(tgtArea);
  renderMermaidBlocks(tgtArea);
  bindImageLoadBottomStick(tgtArea);
  layoutHorizontalMasonryRows(tgtArea);
  stickChatToBottom(tgtArea);
  const bubbleEl = root.querySelector('.ai-bubble');
  return { root, bubbleEl, pid: persona.pid, renderSessionId };
}

function updateLiveStreamBubbleText(state, text, tgtArea) {
  if (!state?.bubbleEl || !tgtArea) return;
  if (isSessionGenerationCancelled(state.renderSessionId) || activeChatId !== state.renderSessionId) return;
  const pidRe = new RegExp(`\\[\\/?${state.pid}\\]`, 'g');
  const clean = String(text || '')
    .replace(pidRe, '')
    .replace(/\[emotion:\s*[^\]]+\]/gi, '')
    .replace(/\[(?:emotion:[^\]]*)?$/i, '')
    .replace(/\[\/?[a-zA-Z0-9_:-]{1,48}$/g, '')
    .trim();
  state.bubbleEl.innerHTML = fmt(clean || '...');
  renderMermaidBlocks(tgtArea);
  layoutHorizontalMasonryRows(tgtArea);
  stickChatToBottom(tgtArea);
}

async function finalizeLiveStreamBubble(state, reply, pList, suffixes, createdAt, tgtArea, renderSessionId) {
  if (!state?.root || !tgtArea) return false;
  if (isSessionGenerationCancelled(renderSessionId) || activeChatId !== renderSessionId) return false;
  const html = await renderAIResponseHTML(reply, pList, suffixes, createdAt, (pList || []).length <= 1);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const nextRoot = wrap.firstElementChild;
  if (!nextRoot) return false;
  state.root.replaceWith(nextRoot);
  nextRoot.classList.add('msg-enter');
  attachMessageMeta(nextRoot, createdAt, 'left');
  enhanceRenderedMessage(nextRoot);
  updateChatBottomAnchor(tgtArea);
  renderMermaidBlocks(tgtArea);
  bindImageLoadBottomStick(tgtArea);
  layoutHorizontalMasonryRows(tgtArea);
  stickChatToBottom(tgtArea);
  state.root = nextRoot;
  state.bubbleEl = nextRoot.querySelector('.ai-bubble');
  return true;
}

async function fetchChatStreamSSE(url, body, signal, onDelta) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `stream request failed (${res.status})`);
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep = buf.indexOf('\n\n');
    while (sep !== -1) {
      const evt = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const dataLine = evt.split('\n').map((l) => l.trim()).find((l) => l.startsWith('data:'));
      if (!dataLine) {
        sep = buf.indexOf('\n\n');
        continue;
      }
      const payload = dataLine.slice(5).trim();
      if (!payload) {
        sep = buf.indexOf('\n\n');
        continue;
      }
      try {
        const obj = JSON.parse(payload);
        if (obj?.type === 'delta' && typeof obj?.text === 'string') {
          full += obj.text;
          await Promise.resolve(onDelta?.(obj.text, full));
        } else if (obj?.type === 'done' && typeof obj?.reply === 'string') {
          full = obj.reply;
        } else if (obj?.type === 'error') {
          throw new Error(obj?.error || 'stream error');
        }
      } catch (e) {
        if (e instanceof Error) throw e;
      }
      sep = buf.indexOf('\n\n');
    }
  }
  return full;
}

function setChatBusy(isBusy) {
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.onclick = isBusy ? stopGeneration : sendMessage;
    sendBtn.title = isBusy ? '?묐떟 以묒?' : '硫붿떆吏 蹂대궡湲?;
    sendBtn.innerHTML = isBusy
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  }
}

function stopGeneration() {
  const sid = String(activeChatId || '').trim();
  if (!sid) return;
  const gen = getChatGeneration(sid);
  if (!gen) return;
  gen.cancelled = true;
  try { gen.controller?.abort(); } catch {}
  clearChatGeneration(sid, gen);
  const area = document.getElementById('chatArea');
  const thinkEl = area?.querySelector?.('.thinking-bubble');
  if (thinkEl) thinkEl.remove();
  isLoading = hasActiveGeneration(activeChatId);
  setChatBusy(hasActiveGeneration(activeChatId));
  showToast('?묐떟??以묒??덉뼱??');
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
    openai: 'gpt-image-2',
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
  session.lastPreview = sanitizeChatListPreview(buildChatPreviewText(latestText), session);
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
    showToast('紐⑤뜽 蹂寃쎌쑝濡??대?吏 李몄“/?덉뒪?좊━瑜?珥덇린?뷀뻽?듬땲??');
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
  // ??踰꾪듉 active ?좉?
  ['chat','image','context'].forEach(t => {
    document.getElementById('itab-' + t)?.classList.toggle('active', t === tab);
    const opts = document.getElementById('itab-opts-' + t);
    if (opts) opts.classList.toggle('hidden', t !== tab);
  });
  // placeholder
  const input = document.getElementById('userInput');
  if (input) {
    input.placeholder = tab === 'image' ? '?대?吏 ?앹꽦 ?꾨＼?꾪듃...'
      : tab === 'context' ? '吏덈Ц?섍굅??遺꾩꽍???붿껌?대킄...'
      : '硫붿떆吏瑜??낅젰?대킄...';
  }
  // ?꾧뎄 踰꾪듉/諛곗? UI ?숆린??
  ['chat','image','project'].forEach(t => {
    document.getElementById('toolMode_' + t)?.classList.toggle('active', t === normalized);
  });
  if (normalized === 'image') handleImageModelChanged();
  updateComposerToolButtonForMode(normalized);
  const chip = document.getElementById('composerModeChip');
  if (chip) {
    if (normalized === 'image') {
      chip.textContent = '?대?吏 ?앹꽦';
      chip.classList.add('show');
    } else if (normalized === 'project') {
      chip.textContent = '?꾨줈?앺듃 ?뚯씪';
      chip.classList.add('show');
    } else {
      chip.classList.remove('show');
    }
  }
  const menu = document.getElementById('composerToolsMenu');
  if (menu) menu.classList.add('hidden');
// ?곸뿭 遺꾨━ ?쒓굅: 酉곗? 臾닿??섍쾶 ??긽 ?⑥씪 chatArea ?좎?
}

function toggleComposerTools() {
  const menu = document.getElementById('composerToolsMenu');
  if (!menu) return;
  menu.classList.toggle('hidden');
}

function selectToolMode(mode) {
  if (mode === 'project') {
    switchInputTab('context');
    showToast('??꾨줈?앺듃 湲곕뒫? 以鍮꾩쨷?댁빞');
    return;
  }
  if (mode === 'image') {
    switchInputTab('image');
    return;
  }
  switchInputTab('chat');
}

function addContextUrl() {
  const url = prompt('URL???낅젰?댁쨾:');
  if (!url) return;
  showToast('URL 異붽???(湲곕뒫 以鍮꾩쨷)');
}

function handleContextFile(input) {
  const files = [...input.files]; if (!files.length) return;
  showToast(`${files.length}媛??뚯씪 異붽???(湲곕뒫 以鍮꾩쨷)`);
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

function flattenTextForMemory(content) {
  if (!content) return '';
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(x => x && x.type === 'text')
      .map(x => String(x.text || '').trim())
      .filter(Boolean)
      .join(' ');
  }
  return String(content || '').trim();
}

function summarizeHistoryForMemory(history = []) {
  const out = [];
  for (let i = history.length - 1; i >= 0 && out.length < 4; i--) {
    const m = history[i] || {};
    const role = String(m.role || '');
    if (role !== 'user' && role !== 'assistant') continue;
    const t = flattenTextForMemory(m.content).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    out.push(`${role}: ${t.length > 120 ? `${t.slice(0, 120)}...` : t}`);
  }
  return out.reverse().join(' | ');
}

function buildPersonaCrossSessionMemory(session, pList = []) {
  const curId = String(session?.id || '');
  const lines = [];
  const sourceSessions = Array.isArray(sessions) ? sessions : [];
  for (const p of (pList || [])) {
    const pid = String(p?.pid || '').trim();
    if (!pid) continue;
    const related = sourceSessions
      .filter(s => String(s?.id || '') && String(s.id) !== curId)
      .filter(s => Array.isArray(s?.participantPids) && s.participantPids.includes(pid))
      .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
      .slice(0, 5);
    if (!related.length) continue;
    lines.push(`[${pid}] cross-session context:`);
    for (const rs of related) {
      const title = String(rs?.roomName || rs?.id || '').trim() || 'room';
      const snippet = summarizeHistoryForMemory(Array.isArray(rs?.history) ? rs.history : []);
      if (!snippet) continue;
      lines.push(`- ${title}: ${snippet}`);
    }
  }
  if (!lines.length) return '';
  lines.push('- ???댁슜? ?곗냽??李멸퀬?? ?꾩옱 諛⑹쓽 理쒖떊 ????붿껌??理쒖슦?좎쑝濡?泥섎━.');
  return lines.join('\n');
}

function buildSystemPrompt(session, pListOverride = null, availableEmotionMap = null) {
  const pList = pListOverride || (session.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const worldPart = session.worldContext ? `${session.worldContext}\n\n` : '';
  
  const uMode = session.userProfileMode || 'default';
  let userPart = '';
  if (uMode !== 'none') {
    const u = uMode === 'custom' && session.userOverride ? session.userOverride : userProfile;
    if (u.name || u.bio) {
      userPart = `[?ъ슜?? ${u.name||'?ъ슜??}`;
      if (u.bio) userPart += `: ${u.bio}`;
      userPart += '\n\n';
    }
  }

  const isGroup = pList.length > 1;
  const modeInstr = !isGroup ? '' :
	session.responseMode === 'all' ? '?꾩썝 ?묐떟.' :
	session.responseMode === 'random' ? '??紐낅쭔 ?묐떟.' :
	'??紐? ?ъ떎吏덈Ц/?⑥닚?뺤씤. ?꾩썝: ?섏궗寃곗젙/鍮꾧탳/?쇱웳/?대┛吏덈Ц.';

  const personaPart = pList.map(p => {
    let desc = `[${p.pid}] ?대쫫:${p.name}`;
    if (p.age) desc += `, ?섏씠/?앸뀈:${p.age}`;
    if (p.bio) desc += `\n?뚭컻: ${p.bio}`;
    if (p.tags && p.tags.length) desc += `\n?깃꺽/留먰닾: ${p.tags.join(', ')}`;
    if (p.userTitle) desc += `\n?섎? 遺瑜대뒗 ?몄묶: ${p.userTitle} (?먯뿰?ㅻ윭??留λ씫?먯꽌留?媛???ъ슜. 留?諛쒗솕留덈떎 遺숈씠吏 留?寃?`;
    if (p.nicknames && p.nicknames.length) desc += `\n?좎묶: ${p.nicknames.join(', ')}`;
    const allowed = availableEmotionMap?.[p.pid];
    if (Array.isArray(allowed) && allowed.length) {
      desc += `\n?ъ슜 媛?ν븳 媛먯젙: ${allowed.join('/')}`;
    }
    return desc;
  }).join('\n\n');

  const formatEx = pList.map(p => `[${p.pid}][emotion:媛먯젙]?댁슜[/${p.pid}]`).join('\n');
  const antiHallucinationBase = [
    '怨듯넻 吏移??꾩닔): ?ъ떎??吏?대궡吏 留?寃?',
    '洹쇨굅媛 ?녾굅???뺤떎?섏? ?딆쑝硫?紐⑤Ⅸ?ㅺ퀬 ?듯븯怨? 異붿젙/媛?뺤쓣 紐낇솗???쒖떆??寃?',
    '?섏튂/?좎쭨/怨좎쑀紐낆궗???뺤떊???놁쑝硫??⑥젙?섏? 留?寃?',
  ].join('\n');
  const userHallucinationPolicy = (userProfile?.hallucinationPolicy || '').trim();
  const antiHallucinationPart = userHallucinationPolicy
    ? `${antiHallucinationBase}\n?ъ슜??異붽? 吏移? ${userHallucinationPolicy}`
    : antiHallucinationBase;
  const crossSessionPart = buildPersonaCrossSessionMemory(session, pList);

  return `${worldPart}${userPart}${personaPart}

?뺤떇:
${formatEx}
emotion: ${EMOTIONS.join('/')}
洹쒖튃: emotion ?쒓렇??諛섎뱶??pid ?쒓렇 諛붾줈 ?ㅼ뿉 ??踰덈쭔. ?댁슜 ?덉뿉 [媛먯젙紐? ?쒓렇 ?ｊ린 湲덉?. ?대쫫: ?묐몢??湲덉?.
媛?pid???먯떊??"?ъ슜 媛?ν븳 媛먯젙" 紐⑸줉 ?덉뿉?쒕쭔 emotion???좏깮.
媛먯젙 ?댁슜(以묒슂): neutral? 湲곕낯媛믪쑝濡??⑤컻?섏? 留먭퀬, 媛?ν븳 寃쎌슦 neutral ?댁쇅 媛먯젙???곗꽑 ?좏깮??寃?
媛먯젙 蹂??以묒슂): ?댁쟾 諛쒗솕? ?숈씪 媛먯젙 怨좎젙???쇳븯怨? 臾몃㎘ 蹂?붿뿉 留욎떠 媛먯젙???곴레?곸쑝濡?諛붽퓭 ?ъ슜??寃?${modeInstr ? '\n' + modeInstr : ''}
?몄묶? ?먯뿰?ㅻ윭??留λ씫?먯꽌留?媛湲됱쟻 ?ъ슜. 留?諛쒗솕 ?쒖옉??遺숈씠吏 留?寃??꾩슂???쒓렇 ?댁슜? 留덊겕?ㅼ슫(**, 肄붾뱶釉붾줉, 紐⑸줉 ?? ?ъ슜 媛??
${antiHallucinationPart}${crossSessionPart ? `\n\n${crossSessionPart}` : ''}`;
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
            <button class="image-popup-action-btn" onclick="downloadImage('${safeViewUrl}','${safeName}')" title="?ㅼ슫濡쒕뱶">
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
          <button class="image-popup-action-btn" onclick="addImageSourceToComposer('${safeViewUrl}','${safeName}')" title="?뚯뒪濡?異붽?">
            <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
          <button class="image-popup-action-btn" onclick="downloadImage('${safeViewUrl}','${safeName}')" title="?ㅼ슫濡쒕뱶">
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
  if (hasActiveGeneration(activeChatId)) return;
  const session = getActiveSession(); if (!session) return;
  if (session._loaded !== true && typeof loadSession === 'function') {
    try { await loadSession(session.id); } catch(e) {}
  }
  const renderSessionId = session.id;
  if (_speechListening) stopMicInput();
  const input = document.getElementById('userInput');
  const text = sanitizeUserInputValue(input.value).trim();
  if (!text && !attachments.length) return;

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

  const generationRef = { controller: new AbortController(), cancelled: false, sessionId: renderSessionId };
  setChatGeneration(renderSessionId, generationRef);
  isLoading = hasActiveGeneration(activeChatId);
  setChatBusy(hasActiveGeneration(activeChatId));
  input.value = ''; input.style.height = 'auto';

  // ?대?吏 ?몄쭛??李몄“ ?대?吏: attachments ?대━???꾩뿉 誘몃━ 罹≪쿂
  const userHTML = renderUserBubbleHTMLV3(text, attachments);
  
  let msgContent = text || '(?뚯씪)';
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
    : text || '(鍮덇?)';
  const requestFileRefs = [];
  for (const attachment of attachments.filter(a => !isImageAttachment(a))) {
    const fileUrl = await getAttachmentRequestUrl(attachment, targetModel, isImageReq);
    if (fileUrl) requestFileRefs.push({ name: attachment.name || 'file', url: fileUrl });
  }
  const requestMsgContent = attachments.length > 0
    ? buildUserMessageContentV2(text, requestImageUrls, requestFileRefs)
    : text || '(鍮덇?)';

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
  if (!session._demo) {
    saveSession(session.id);
    saveIndex();
  }

  // ?대?吏 ?몄쭛??李몄“ ?대?吏: attachments ?대━???꾩뿉 誘몃━ 罹≪쿂
  const refImages = [...requestImageUrls];

  attachments = [];
  renderAttachmentPreviews();

  // imageArea??display:none ????臾닿??섍쾶 ??긽 chatArea ?ъ슜
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

  // 濡쒕뵫 ?뚮젅?댁뒪???
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
        <span class="img-gen-label">?대?吏 ?앹꽦 以?/span>
        <div class="img-gen-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  } else {
    thinkEl.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  }
  area.appendChild(thinkEl);
  updateChatBottomAnchor(area);
  stickChatToBottom(area, { force: true });

  const pListAll = getSessionPersonas(session);

  if (text === '/媛먯젙') {
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
      attachMessageMeta(replyEl.firstElementChild, emotionTestCreatedAt, 'left');
      enhanceRenderedMessage(replyEl.firstElementChild);
      area.appendChild(replyEl.firstElementChild);
      updateChatBottomAnchor(area);
    }
    stickChatToBottom(area, { force: true });

    session.history.push({ role:'assistant', content:'(媛먯젙 ?뚯뒪??', createdAt: emotionTestCreatedAt, personaSnapshot, _suffixes: {} });
    session.lastPreview = '(媛먯젙 ?뚯뒪??'; session.updatedAt = Date.now();
    clearChatGeneration(renderSessionId, generationRef);
    isLoading = hasActiveGeneration(activeChatId);
    setChatBusy(hasActiveGeneration(activeChatId));
    input.focus();
    if (!session._demo) { saveSession(session.id); saveIndex(); }
    renderChatList();
    await cleanupAttachmentCaches(sentAttachments);
    return;
  }

  // 諛깃렇?쇱슫??泥섎━瑜??꾪븳 遺꾨━??鍮꾨룞湲??⑥닔
  const processApiAndRender = async () => {
    const CHAT_REQUEST_TIMEOUT_MS = 65000;
    const fetchWithTimeout = async (url, options = {}, timeoutMs = CHAT_REQUEST_TIMEOUT_MS) => {
      return await Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`request timeout (${timeoutMs}ms)`)), timeoutMs))
      ]);
    };
    let reply = '';
    let generatedImageUrl = '';
    let availableEmotionMap = null;
    if (session._demo) {
      await new Promise(r => setTimeout(r, 600));
      reply = window.getDemoReply ? window.getDemoReply(session) : '?곕え ?묐떟 ?ㅻ쪟';
    } else {
      try {
        availableEmotionMap = await buildPersonaAvailableEmotionMap(pListAll);
        const apiMessages = [
          { role:'system', content: buildSystemPrompt(session, null, availableEmotionMap) },
          buildCurrentTimeSystemMessage(),
          ...buildApiMessagesFromHistory(session.history, userMsg, requestMsgContent, isImageReq)
        ];
        const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');

        // targetModel is resolved before we clear attachments.

        if (!isImageReq) {
          const plan = await planGroupResponse(session, pListAll, text || '');
          const responders = Array.isArray(plan?.responders) && plan.responders.length ? plan.responders : pickRespondingPersonas(session, pListAll);
          const runSequential = plan?.delivery === 'sequential';
          logGroupRouterDebug('send.non-image.plan', {
            responseMode: session?.responseMode,
            responders: responders.map((p) => p.pid),
            delivery: runSequential ? 'sequential' : 'parallel'
          });
          const responderEntries = responders.map((persona) => ({
            persona,
            model: getPersonaModel(session, persona)
          }));
          const groupedByModel = new Map();
          for (const entry of responderEntries) {
            const key = entry.model || 'grok-4.20-non-reasoning-latest';
            if (!groupedByModel.has(key)) groupedByModel.set(key, []);
            groupedByModel.get(key).push(entry.persona);
          }
          logGroupRouterDebug('send.non-image.grouped-by-model', [...groupedByModel.entries()].map(([model, personas]) => ({
            model,
            pids: personas.map((p) => p.pid)
          })));
          const replyByPid = new Map();
          const attachmentByModel = new Map();
          const getGroupAttachments = async (model) => {
            if (attachmentByModel.has(model)) return attachmentByModel.get(model);
            const groupImageUrls = [];
            for (const attachment of sentAttachments.filter(isImageAttachment)) {
              const imageUrl = await getAttachmentRequestUrl(attachment, model, false);
              if (imageUrl) groupImageUrls.push(imageUrl);
            }
            const groupFileRefs = [];
            for (const attachment of sentAttachments.filter(a => !isImageAttachment(a))) {
              const fileUrl = await getAttachmentRequestUrl(attachment, model, false);
              if (fileUrl) groupFileRefs.push({ name: attachment.name || 'file', url: fileUrl });
            }
            const packed = { groupImageUrls, groupFileRefs };
            attachmentByModel.set(model, packed);
            return packed;
          };
          const runPersonaCall = async (persona, model) => {
            const { groupImageUrls, groupFileRefs } = await getGroupAttachments(model);
            try {
              const personaRequestMsgContent = sentAttachments.length > 0
                ? buildUserMessageContentV2(text, groupImageUrls, groupFileRefs)
                : text || '(鍮덇?)';
                const personaMessages = [
                  { role:'system', content: buildSystemPrompt(session, [persona], availableEmotionMap) },
                  buildCurrentTimeSystemMessage(),
                  ...buildApiMessagesFromHistory(session.history, userMsg, personaRequestMsgContent, isImageReq, persona.pid)
                ];
              const payload = {
                messages: personaMessages,
                model,
                participant_pids: [persona.pid],
                user_id: 'user_default',
                session_id: String(session?.id || '')
              };
              let rawReply = '';
              {
                const res = await fetchWithTimeout(wUrl + '/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.result !== 'success') {
                  replyByPid.set(persona.pid, `[${persona.pid}]?묐떟?앹꽦 ?ㅻ쪟: ${data.error||'?????녿뒗 ?ㅻ쪟'}[/${persona.pid}]`);
                  return;
                }
                rawReply = data.reply || '';
              }
              rawReply = sanitizeTextForUnicodeSafety(rawReply || '');
              const parsedSelf = parseResponse(rawReply, [persona], availableEmotionMap);
              logGroupRouterDebug('send.non-image.persona.raw', {
                pid: persona.pid,
                model,
                rawPreview: rawReply.slice(0, 220),
                parsedSegments: Array.isArray(parsedSelf) ? parsedSelf.length : 0
              });
              if (Array.isArray(parsedSelf) && parsedSelf.length > 0) {
                const mergedContent = parsedSelf
                  .map((seg) => String(seg?.content || '').trim())
                  .filter(Boolean)
                  .join('\n')
                  .trim();
                const chosenEmotion = String(parsedSelf[0]?.emotion || 'neutral');
                const safeEmotion = EMOTIONS.includes(chosenEmotion) ? chosenEmotion : 'neutral';
                const finalContent = mergedContent || rawReply || '...';
                replyByPid.set(persona.pid, `[${persona.pid}][emotion:${safeEmotion}]${finalContent}[/${persona.pid}]`);
              } else {
                replyByPid.set(persona.pid, wrapPersonaReply(persona.pid, rawReply));
              }
            } catch (e) {
              replyByPid.set(persona.pid, `[${persona.pid}]?묐떟?앹꽦 ?ㅻ쪟: ?ㅽ듃?뚰겕 ?먮뒗 泥섎━ ?ㅻ쪟[/${persona.pid}]`);
            }
          };

          if (runSequential) {
            for (const entry of responderEntries) {
              await runPersonaCall(entry.persona, entry.model);
            }
          } else {
            await Promise.all([...groupedByModel.entries()].map(async ([model, personasInGroup]) => {
              await getGroupAttachments(model);
              await Promise.all(personasInGroup.map(async (persona) => {
                await runPersonaCall(persona, model);
              }));
            }));
          }
          reply = responders.map((persona) => replyByPid.get(persona.pid) || `[${persona.pid}]?묐떟?앹꽦 ?ㅻ쪟: ?묐떟 ?꾨씫[/${persona.pid}]`).join('\n');
        } else {
        const ratio = typeof _selectedRatio !== 'undefined' ? _selectedRatio : "1:1";

        // 紐⑤뜽蹂??뚮씪誘명꽣 遺꾧린
        const RATIO_TO_OPENAI_SIZE = {
          '1:1':'1024x1024', '16:9':'1536x1024', '9:16':'1024x1536',
          '4:3':'1536x1152', '3:4':'1152x1536', '3:2':'1536x1024',
          '2:3':'1024x1536', '21:9':'1536x1024', '9:21':'1024x1536'
        };
        const isGptImg = targetModel.startsWith('gpt-image');

        let reqBody;
        if (isImageReq) {
          // ?대?吏 ?앹꽦/?몄쭛: API??messages 諛곗뿴???꾨땶 prompt 臾몄옄??湲곕?
          const promptText = text || '(image)';
          reqBody = {
            model: targetModel,
            prompt: promptText,
            participant_pids: Array.from(new Set(session.participantPids || [])),
            user_id: 'user_default',
            session_id: String(session?.id || ''),
            resolution: _selectedImageResolution,
            ...(isGptImg && refImages.length === 0
              ? { size: RATIO_TO_OPENAI_SIZE[ratio] || '1024x1024' }
              : { aspect_ratio: ratio }
            ),
            ...(refImages.length > 0 ? { images: refImages } : {})
          };
        } else {
          // 梨꾪똿: 湲곗〈 messages 諛곗뿴
          reqBody = {
            messages: apiMessages,
            model: targetModel,
            participant_pids: Array.from(new Set(session.participantPids || [])),
            user_id: 'user_default',
            session_id: String(session?.id || '')
          };
        }

       // 釉뚮씪?곗? ??꾩븘???놁쓬 (Worker 30s ?쒓퀎 二쇱쓽)
        const res = await fetchWithTimeout(wUrl + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: generationRef.controller.signal
        }, CHAT_REQUEST_TIMEOUT_MS);
        const data = await res.json();
        if (data.result !== 'success') {
          const pid0 = session.participantPids?.[0] || 'p';
          reply = `[${pid0}]?앹꽦 ?ㅻ쪟: ${data.error||'?????녿뒗 ?ㅻ쪟'}[/${pid0}]`;
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
              throw new Error('?대?吏 URL ?묐떟??鍮꾩뼱 ?덉뒿?덈떎.');
            }
          }
        }
        }
      } catch(e) {
        if (e?.name === 'AbortError') throw e;
        const pid0 = session.participantPids?.[0] || 'p';
        reply = sanitizeTextForUnicodeSafety(`[${pid0}]?곌껐 ?ㅽ뙣: ${e.message}[/${pid0}]`);
      }
    }
    reply = normalizeGeneratedMarkdown(sanitizeTextForUnicodeSafety(reply));

    if (thinkEl.parentNode) thinkEl.remove();
    
    // 諛깃렇?쇱슫??泥섎━ 以??몄뀡????젣?섏뿀?붿? 泥댄겕
    const currentSession = sessions.find(s => s.id === session.id);
    if (!currentSession) return;

    // ?앹꽦???대?吏??data URL / ?먭꺽 URL 紐⑤몢 R2???낅줈????援먯껜
    if (isImageReq && /!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/i.test(reply)) {
      const dataUrlRe = /!\[.*?\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/g;
      let m;
      while ((m = dataUrlRe.exec(reply)) !== null) {
        const imageRef = m[1];
        const fname = makeImageFilename('generated') + '.jpg';
        const r2Url = await uploadToR2(imageRef, 'img_generated', fname).catch(() => '');
        if (r2Url && !/^data:image\//i.test(String(r2Url))) {
          if (/^data:image\//i.test(String(imageRef || ''))) {
            cacheChatImageForUrl(r2Url, imageRef).catch(() => {});
          }
          reply = reply.replace(imageRef, r2Url);
        } else {
          reply = reply.replace(m[0], '[generated image upload failed]');
        }
      }
    }

    const pList = pListAll;
    const personaSnapshot = pList.map(p=>({pid:p.pid, name:p.name}));
    const suffixes = await resolveMessageSuffixes(reply, pList);

    const assistantCreatedAt = Date.now();
    const lastHist = currentSession.history?.[currentSession.history.length - 1];
    const normalizeDupText = (v) => String(v || '')
      .replace(/\[[a-zA-Z0-9_:-]+\]/g, '')
      .replace(/\[\/[a-zA-Z0-9_:-]+\]/g, '')
      .replace(/\[emotion:[^\]]*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const duplicateAssistant =
      lastHist?.role === 'assistant' &&
      normalizeDupText(lastHist?.content || '') === normalizeDupText(reply || '') &&
      (assistantCreatedAt - Number(lastHist?.createdAt || 0)) <= 5000;
    if (duplicateAssistant) {
      showToast('以묐났 ?묐떟???먮룞?쇰줈 ?뺣━?덉뼱??');
      await cleanupAttachmentCaches(sentAttachments);
      isLoading = false;
      document.getElementById('sendBtn').disabled = false;
      setTimeout(() => input.focus(), 10);
      return;
    }

    currentSession.history.push({
      role:'assistant',
      content:reply,
      createdAt: assistantCreatedAt,
      personaSnapshot,
      _suffixes: suffixes,
      _imageWorkflow: !!isImageReq
    });

    const parsed = parseResponse(reply, pList, availableEmotionMap);
    const firstContent = parsed[0]?.content || '';
    currentSession.lastPreview = sanitizeChatListPreview(buildChatPreviewText(firstContent), currentSession);
    currentSession.updatedAt = Date.now();

    // ?ъ슜?먭? ?대떦 梨꾪똿諛⑹쓣 洹몃?濡?蹂닿퀬 ?덈떎硫??붾㈃??利됱떆 ?뚮뜑留?    if (activeChatId === currentSession.id) {
      const tgtArea = document.getElementById('chatArea');
      tgtArea.classList.add('has-messages');
      if (!isImageReq && (pList || []).length <= 1) {
        await appendAIReplyStreamingOneToOne(reply, pList, suffixes, assistantCreatedAt, tgtArea, currentSession.id, availableEmotionMap);
      } else {
        await appendAIReplySequentially(reply, pList, suffixes, assistantCreatedAt, tgtArea, currentSession.id, availableEmotionMap);
      }
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
    // Public/private memory extraction disabled.
    await cleanupAttachmentCaches(sentAttachments);
    
    // ?꾨즺 ????긽 ???댁젣 (?대?吏/梨꾪똿 怨듯넻)
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    setTimeout(() => input.focus(), 10);
  };

  // ?대?吏/梨꾪똿 紐⑤몢 await ???대?吏 ?앹꽦 以?異붽? ?꾩넚 李⑤떒
  try { await processApiAndRender(); } catch (e) { if (e?.name !== 'AbortError') throw e; } finally {
    clearChatGeneration(renderSessionId, generationRef);
    isLoading = hasActiveGeneration(activeChatId);
    setChatBusy(hasActiveGeneration(activeChatId));
  }
}

function handleFileSelect(input) {
  addFilesToAttachments(input.files, 'picker').catch(e => showToast('?뚯씪 異붽? ?ㅽ뙣: ' + e.message));
  input.value = '';
  return;
  [...input.files].forEach(file => {
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      const isImg = file.type.startsWith('image/');
      let finalUrl = dataUrl;
      // ?대?吏??利됱떆 R2???낅줈??
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
      : `<div class="attachment-file">${a.name || '?뚯씪'}</div>`;
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
    showToast('?대? ?뚯뒪濡?異붽??섏뼱 ?덉뒿?덈떎.');
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
  showToast('?대?吏瑜??뚯뒪??異붽??덉뒿?덈떎.');
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
       <div id="kickOverlay_${p.pid}" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.55);align-items:center;justify-content:center;font-size:22px">?뿊</div>
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
     <div style="font-size:10px;color:var(--muted2);text-align:center">珥덈?</div>
   </div>` : '';

const uMode = s.userProfileMode || 'default';
const showCustom = uMode === 'custom';

body.innerHTML = `
   <div>
     <div class="field-label">??붾갑 ?대쫫</div>
     <div style="display:flex;gap:7px">
       <input class="edit-input" id="drawerRoomName" value="${esc(s.roomName||'')}" placeholder="${esc(pList.map(p=>p.name).join(', '))}" style="font-size:13px;padding:8px 12px;flex:1">
       <button onclick="saveRoomName()" style="padding:8px 14px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer;white-space:nowrap">???/button>
     </div>
   </div>
   <div>
      <div class="field-label" style="margin-bottom:6px">??梨꾪똿諛??묐떟 紐⑤뜽</div>
      <div style="display:flex;gap:6px;align-items:center">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">${pList.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--card)"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:12px;color:var(--text)">${esc(p.name)}</span><span style="font-size:10px;color:var(--muted)">湲곕낯: ${esc(getChatModelLabel(p.defaultModel || ''))}</span></div><div style="min-width:210px;max-width:240px">${buildModelSelect(`drawerModel_${p.pid}`, s?.personaModelOverrides?.[p.pid] || '', 'font-size:11px;padding:7px 9px;border-radius:9px')}</div></div>`).join('') || `<div style="font-size:11px;color:var(--muted)">李몄뿬 以묒씤 ?섎Ⅴ?뚮굹媛 ?놁뼱</div>`}</div>
        <button onclick="applyDrawerModel()" style="padding:7px 12px;border-radius:9px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">?곸슜</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">媛??됱뿉??紐⑤뜽 ?좏깮 ???곸슜. 鍮?媛믪씠硫??대떦 ?섎Ⅴ?뚮굹 湲곕낯 紐⑤뜽 ?ъ슜</div>
    </div>
   <div>
     <div class="field-label" style="margin-bottom:8px">???꾨줈??/div>
     <div class="mode-btns" style="margin-bottom:${showCustom?'10px':'0'}">
       <button class="mode-btn ${uMode==='default'?'on':''}" onclick="setUserProfileMode('default')">湲곕낯 ?꾨줈??/button>
       <button class="mode-btn ${uMode==='none'?'on':''}" onclick="setUserProfileMode('none')">?뺥븯吏 ?딆쓬</button>
       <button class="mode-btn ${uMode==='custom'?'on':''}" onclick="setUserProfileMode('custom')">吏곸젒 ?낅젰</button>
     </div>
     ${showCustom ? `
     <input type="file" id="drawerUserImgInput" style="display:none" accept="image/*" onchange="handleDrawerUserImage(this)">
     <div style="display:flex;gap:10px;align-items:flex-start">
       <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border2);flex-shrink:0;cursor:pointer" onclick="document.getElementById('drawerUserImgInput').click()">
         ${getUserAvatarHTML(s)}
       </div>
       <div style="flex:1;display:flex;flex-direction:column;gap:6px">
         <input class="edit-input" id="drawerUserName" value="${esc(s.userOverride?.name||'')}" placeholder="?대쫫" style="font-size:13px;padding:7px 10px">
         <textarea class="edit-input" id="drawerUserBio" placeholder="??梨꾪똿諛⑹뿉?쒖쓽 ??.." style="font-size:12px;padding:7px 10px;resize:none;height:56px;border-radius:10px;line-height:1.5">${esc(s.userOverride?.bio||'')}</textarea>
       </div>
     </div>
     <button onclick="saveDrawerUserProfile()" style="width:100%;margin-top:8px;padding:8px;border-radius:9px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-family:'Pretendard',sans-serif;font-size:12px;cursor:pointer">???/button>
     ` : ''}
   </div>
   ${isGroup ? `
   <div>
     <div class="field-label">?묐떟 諛⑹떇</div>
     <div class="mode-btns">
       <button class="mode-btn ${s.responseMode==='auto'?'on':''}" onclick="setDrawerMode('auto')">?렡 ?곹솴??留욊쾶</button>
       <button class="mode-btn ${s.responseMode==='all'?'on':''}" onclick="setDrawerMode('all')">?뫁 ?꾩썝</button>
       <button class="mode-btn ${s.responseMode==='random'?'on':''}" onclick="setDrawerMode('random')">?렞 臾댁옉??/button>
     </div>
   </div>` : ''}
   <div>
     <div class="field-label">?멸퀎愿 / 怨듯넻 吏移?/div>
     <textarea class="world-input" oninput="syncWorldContext(this.value)" placeholder="紐⑤뱺 ?섎Ⅴ?뚮굹?먭쾶 ?곸슜???ㅼ젙?대굹 ?멸퀎愿???낅젰?섏꽭??..">${esc(s.worldContext||'')}</textarea>
   </div>
   <div>
     <div class="field-label">李몄뿬 ?섎Ⅴ?뚮굹${isGroup ? ' 쨌 ??븯硫?異붾갑' : ''}</div>
     <div style="display:flex;gap:10px;flex-wrap:wrap">${personaCards.join('')}${inviteBtn}</div>
   </div>`;
}

function toggleKickOverlay(pid, el) {
const overlay = document.getElementById(`kickOverlay_${pid}`);
if (!overlay) return;
if (overlay.style.display === 'flex') {
if (confirm(`${getPersona(pid)?.name || pid}瑜?異붾갑?좉퉴?\n???湲곕줉? ?좎???`)) { kickPersona(pid); } else { overlay.style.display = 'none'; }
} else {
document.querySelectorAll('[id^="kickOverlay_"]').forEach(o => o.style.display = 'none');
overlay.style.display = 'flex';
}
}

function kickPersona(pid) {
const s = getActiveSession(); if (!s) return;
if (s.participantPids.length <= 1) { showToast('留덉?留??섎Ⅴ?뚮굹??異붾갑?????놁뼱'); return; }
const p = getPersona(pid);
if (!confirm(`${p?.name || pid}瑜???梨꾪똿諛⑹뿉??異붾갑?좉퉴?\n???湲곕줉? ?좎???`)) return;
  s.participantPids = s.participantPids.filter(id => id !== pid);
  s.updatedAt = Date.now();
  saveIndex(); renderDrawerBody(s);
  
  const pList = s.participantPids.map(id => getPersona(id)).filter(Boolean);
  const avatarsEl = document.getElementById('chatHeaderAvatars');
  if (avatarsEl) {
    avatarsEl.innerHTML = pList.map(p => {
      const headSrc = p.neutral_thumb || '';
      const img = headSrc ? `<img src="${headSrc}" width="42" height="42" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">` : defaultAvatar(p.hue);
      return `<div class="chat-header-av" style="background:hsl(${p.hue},22%,14%);border-color:hsl(${p.hue},30%,26%);width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;">${img}</div>`;
    }).join('');
    
    pList.forEach(async (p, i) => {
      const img = await getNeutralImageThumb(p.pid, 42);
    if (img) {
      const avEl = avatarsEl.children[i];
      if (avEl) {
        const cur = avEl.querySelector('img')?.getAttribute('src') || '';
        if (cur !== img) avEl.innerHTML = `<img src="${img}" width="42" height="42" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:top;">`;
      }
    }
  });
  }
  const namesEl = document.getElementById('chatHeaderNames');
  if (namesEl) namesEl.textContent = pList.map(p=>p.name).join(', ');
  showToast(`${p?.name || '?섎Ⅴ?뚮굹'} 異붾갑??);
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
  saveIndex(); showToast('?좎? ?꾨줈????λ맖'); renderDrawerBody(s);
}

function resetDrawerUserProfile() {
  const s = getActiveSession(); if (!s) return;
  delete s.userOverride;
  saveIndex(); showToast('湲곕낯 ?꾨줈?꾨줈 ?섎룎由?); renderDrawerBody(s);
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
  saveIndex(); renderChatList(); showToast('諛??대쫫 ??λ맖');
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
  const available = (personas || []).filter(p => !p?.hidden && !(s.participantPids||[]).includes(p.pid));
  for (const p of available) {
    const card = document.createElement('div');
    card.className = 'select-card'; card.style.position = 'relative';
    card.onclick = () => toggleInvitePid(p.pid, card, s);
    const neutral = await getEmotionImage(p.pid, 'neutral', 420) || await getNeutralImage(p.pid);
    const imgSrc = neutral || p.image;
    card.innerHTML = `
      <div class="select-card-img">${imgSrc ? `<img src="${imgSrc}">` : defaultAvatar(p.hue)}</div>
      <div class="select-card-name">${esc(p.name)}</div>
      <div class="check" style="position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;background:var(--text);display:none;align-items:center;justify-content:center;font-size:10px"></div>`;
    grid.appendChild(card);
  }
  if (!available.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:13px;padding:20px">珥덈????섎Ⅴ?뚮굹媛 ?놁뼱</div>`; }
  document.getElementById('inviteConfirmBtn').disabled = true;
}

function toggleInvitePid(pid, card, s) {
  const idx = selectedPids.indexOf(pid);
  const cur = (s.participantPids||[]).length + selectedPids.length;
  if (idx > -1) {
    selectedPids.splice(idx, 1); card.classList.remove('selected');
    card.querySelector('.check').style.display = 'none';
  } else {
    if (cur >= MAX_PARTICIPANTS) { showToast(`理쒕? ${MAX_PARTICIPANTS}紐낃퉴吏 媛?ν빐`); return; }
    selectedPids.push(pid); card.classList.add('selected');
    card.querySelector('.check').style.display = 'flex';
  }
  document.getElementById('inviteConfirmBtn').disabled = selectedPids.length === 0;
}

function confirmInvite() {
  const s = getActiveSession(); if (!s) return;
  s.participantPids = Array.from(new Set([...(s.participantPids || []), ...selectedPids]));
  s.updatedAt = Date.now();
  saveIndex(); closeInviteModal(); closeDrawer(); openChat(s.id); showToast(`${selectedPids.length}紐?珥덈???);
}

function applyDrawerModel() {
  const s = getActiveSession(); if (!s) return;
  const pList = (s.participantPids||[]).map(pid=>getPersona(pid)).filter(Boolean);
  const overrides = {};
  for (const p of pList) {
    const sel = document.getElementById(`drawerModel_${p.pid}`);
    const picked = String(sel?.value || '').trim();
    if (picked) overrides[p.pid] = picked;
  }
  // Per-persona override瑜??곗꽑 ?ъ슜?섎?濡??덇굅??諛??⑥씪 override???댁젣
  s.overrideModel = null;
  s.personaModelOverrides = Object.keys(overrides).length ? overrides : null;
  s.updatedAt = Date.now();
  saveIndex();
  if (typeof flushPendingRemoteSaves === 'function') flushPendingRemoteSaves();
  showToast('梨꾪똿諛?紐⑤뜽 ?ㅼ젙???곸슜?덉뼱.');
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
  document.getElementById('promptTokenEst').textContent = `??{est} ?좏겙`;
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
  if (!confirm('???湲곕줉??吏?멸퉴? ?섎Ⅴ?뚮굹 ?ㅼ젙? ?좎???')) return;
  s.history = []; s._loaded = true; s.lastPreview = ''; s.updatedAt = Date.now();
  closeDrawer(); renderChatArea(); saveSession(s.id); saveIndex();
}
async function compressChat() {
  const s = getActiveSession(); if (!s || s.history.length < 4) { alert('?뺤텞????붽? 遺議깊빐.'); return; }
  if (!confirm('??붾? ?붿빟 ?뺤텞?좉퉴?')) return;
  const histText = s.history.map(m=>`${m.role==='user'?'?ъ슜??:'AI'}: ${typeof m.content==='string'?m.content:'(硫붿떆吏)'}`).join('\n');
  try {
    const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
    if (!wUrl) { alert('Worker URL ?놁쓬'); return; }
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
        user_id: 'user_default',
        session_id: String(s?.id || ''),
        messages: [
		{ role:'system', content:'??붾? ?듭떖留??④꺼 媛꾧껐?섍쾶 ?붿빟?댁쨾. ?쒓뎅?대줈.' },
		{ role:'user',   content:`?꾨옒 ??붾? ?붿빟?댁쨾.\n\n${histText}` }
        ]
      })
    });
	const data = await res.json();
		if (data?.result === 'success') {
		s.history = [{ role:'assistant', content:`[?댁쟾 ????붿빟]\n${data.reply}`,
		personaSnapshot:(s.participantPids||[]).map(pid=>({pid,name:getPersona(pid)?.name||pid})) }];
		s.updatedAt = Date.now(); s.lastPreview = '[?뺤텞??';
		closeDrawer(); renderChatArea(); saveSession(s.id); saveIndex();
		} else { alert('?뺤텞 ?ㅽ뙣: ' + (data?.error || '?????녿뒗 ?ㅻ쪟')); }
	} catch(e) { alert('?뺤텞 ?ㅽ뙣: ' + e.message); }
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
  _archiveLoaded = true;
  renderArchiveGrid();
}

function archiveManifestSignature(items = []) {
  return JSON.stringify((items || []).map((it) => normalizeArchiveKey(it?.key || it?.url)).filter(Boolean).sort());
}

async function refreshArchiveManifestIfChanged(force = false) {
  const fresh = await loadArchiveManifestFromR2().catch(() => []);
  const currentSig = archiveManifestSignature(_archiveItems || []);
  const freshSig = archiveManifestSignature(fresh || []);
  if (!force && currentSig === freshSig) return false;
  _archiveItems = Array.isArray(fresh) ? fresh : [];
  _archiveLoaded = true;
  await idbSet(ARCHIVE_MANIFEST_CACHE_KEY, _archiveItems).catch(() => {});
  if (activeTab === 'archive') renderArchiveGrid();
  return true;
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
    empty.textContent = _archiveLoaded ? '?꾩뭅?대툕 ?대?吏媛 ?놁뒿?덈떎.' : '?대?吏瑜?遺덈윭?ㅻ뒗 以?..';
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
      <div class="archive-card-check">??/div>
      <div class="archive-card-actions" onclick="event.stopPropagation()">
        <button class="archive-action-btn icon" onclick="editArchiveImage('${safeKey}')" title="?몄쭛?섍린" aria-label="?몄쭛?섍린">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="archive-action-btn icon" onclick="jumpToImageConversation('${safeKey}')" title="??붾줈 ?대룞" aria-label="??붾줈 ?대룞">
          <svg viewBox="0 0 24 24"><path d="M4 6h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2"/><circle cx="9" cy="11.5" r="1"/><circle cx="12" cy="11.5" r="1"/><circle cx="15" cy="11.5" r="1"/></svg>
        </button>
        <button class="archive-action-btn icon" onclick="downloadImage('${safeUrl}','${safeFile}')" title="?ㅼ슫濡쒕뱶" aria-label="?ㅼ슫濡쒕뱶">
          <svg viewBox="0 0 24 24"><path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 21h16"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.archive-card > img').forEach((img) => hydrateImageElementFromChatCache(img));
  updateArchiveSelectionUi();
  if (rows.length > visible.length) {
    empty.style.display = 'block';
    empty.textContent = `?ㅽ겕濡ㅽ븯硫???遺덈윭?듬땲??(${visible.length}/${rows.length})`;
  } else {
    empty.style.display = 'none';
  }
}

async function renderArchivePane() {
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
  if (card) card.title = `?대?吏瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲?? ${key}`;
}

async function editArchiveImage(key) {
  const normalizedKey = normalizeArchiveKey(key);
  const hit = (_archiveItems || []).find((it) => normalizeArchiveKey(it.key) === normalizedKey);
  if (!hit?.url) {
    showToast('?대?吏 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
    return;
  }
  const persona1Pid = Array.isArray(personas) && personas[0]?.pid ? personas[0].pid : null;
  if (!persona1Pid) {
    showToast('?섎Ⅴ?뚮굹 1??李얠쓣 ???놁뒿?덈떎.');
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
  showToast('?몄쭛????梨꾪똿???댁뿀?듬땲??');
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
  btn.title = cnt > 0 ? `?좏깮 ??젣 (${cnt})` : '?좏깮 ??젣';
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
  if (!confirm(`?좏깮??${keys.length}媛??대?吏瑜?R2?먯꽌 ??젣?좉퉴??`)) return;
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
  showToast(`${deleted}媛???젣?덉뒿?덈떎.`);
}

async function deletePopupImageFromArchive() {
  const ctx = _archivePopupContext;
  if (!ctx?.key) return;
  if (!confirm('???대?吏瑜??꾩뭅?대툕? R2?먯꽌 ??젣?좉퉴??')) return;
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) return;
  const targetKey = normalizeArchiveKey(ctx.key);
  const res = await fetch(`${wUrl}/image/${encodeURIComponent(targetKey).replace(/%2F/gi, '/')}`, { method: 'DELETE' }).catch(() => null);
  if (!res || (!res.ok && res.status !== 404)) {
    showToast('??젣???ㅽ뙣?덉뒿?덈떎.');
    return;
  }
  _archiveItems = (_archiveItems || []).filter((it) => normalizeArchiveKey(it.key) !== targetKey);
  await idbSet(ARCHIVE_MANIFEST_CACHE_KEY, _archiveItems).catch(() => {});
  closeImagePopup();
  renderArchiveGrid();
  if (res.status === 404) {
    showToast('R2?먮뒗 ?대? ?녿뒗 ??ぉ?대씪 紐⑸줉?먯꽌 ?뺣━?덉뒿?덈떎.');
    return;
  }
  showToast('?꾩뭅?대툕?먯꽌 ??젣?덉뒿?덈떎.');
}

async function jumpToImageConversation(keyOrUrl) {
  const normalizedKey = extractR2ImageKey(keyOrUrl) || String(keyOrUrl || '');
  const hit = (_archiveItems || []).find((it) => it.key === normalizedKey || it.url === keyOrUrl);
  if (!hit?.chatId) {
    showToast('????꾩튂瑜?李얠? 紐삵뻽?듬땲??');
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
    // 1. ?대떦 媛먯젙??HD ?대?吏 (?щ챸???ы븿)
    const hdUrl = await getEmotionImageHD(pid, eid, suffix);
    if (hdUrl && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${hdUrl}">`;
      return;
    }

    // 2. ?대떦 媛먯젙???댁긽???꾩껜 ?대?吏 (em_full_)
    const full = await idbGet(`em_full_${pid}_${target}`);
    if (full && popup.classList.contains('open')) {
      imgEl.innerHTML = `<img src="${full}">`;
      return;
    }

    // 3. 留덉?留??섎떒: 臾댄몴???댁긽??
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
  hydrateImageElementFromChatCache(img);
  img.classList.remove('zoomed');
  img.classList.remove('panning');
  _popupZoomed = false;
  _popupZoomLevel = 1;
  _popupPanning = false;
  _popupPanOffset = { x: 0, y: 0 };
  _popupPanLast = { x: 0, y: 0 };
  _popupPanStart = { x: 0, y: 0 };
  _popupPanMoved = false;
  applyPopupImageTransform();
  updatePopupZoomButtonIcon();
  overlay.classList.add('active');
}

function closeImagePopup(e = null) {
  if (e?.stopPropagation) e.stopPropagation();
  if (Date.now() < _popupSuppressCloseUntil) return;
  if (_popupPanMoved) {
    _popupPanMoved = false;
    _popupSuppressCloseUntil = Date.now() + 180;
    return;
  }
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
  _popupPanStart = { x: 0, y: 0 };
  _popupPanMoved = false;
  applyPopupImageTransform();
  document.getElementById('imagePopup')?.classList.remove('active');
  document.getElementById('popupDeleteBtn')?.style && (document.getElementById('popupDeleteBtn').style.display = 'none');
  _popupImgUrl = '';
  _archivePopupContext = null;
}

function handlePopupImageTap(e = null) {
  if (e?.stopPropagation) e.stopPropagation();
  if (_popupPanMoved) {
    _popupPanMoved = false;
    _popupSuppressCloseUntil = Date.now() + 180;
    return;
  }
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
  _popupPanStart = p;
  _popupPanMoved = false;
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
  if (!_popupPanMoved) {
    const movedX = Math.abs(p.x - _popupPanStart.x);
    const movedY = Math.abs(p.y - _popupPanStart.y);
    if (movedX > 4 || movedY > 4) _popupPanMoved = true;
  }
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
      showToast('?대?吏 URL???대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.');
      return;
    }
    showToast('?대┰蹂대뱶 ?대?吏 蹂듭궗瑜?吏?먰븯吏 ?딅뒗 ?섍꼍?낅땲??');
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
    showToast('?대?吏瑜??대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.');
  } catch (e) {
    const ok = await fallbackCopyText(target);
    if (ok) {
      showToast('?대?吏 URL???대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.');
      return;
    }
    try {
      await navigator.clipboard.writeText(target);
      showToast('?대?吏 URL???대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.');
    } catch {
      showToast('?대┰蹂대뱶 蹂듭궗???ㅽ뙣?덉뒿?덈떎.');
    }
  }
}

// Image-only clipboard override (no URL text fallback)
async function copyImageToClipboard(url) {
  const target = String(url || '').trim();
  if (!target) return;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    showToast('??釉뚮씪?곗????대?吏 ?대┰蹂대뱶 蹂듭궗瑜?吏?먰븯吏 ?딆뒿?덈떎.');
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
    showToast('?대?吏瑜??대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.');
  } catch {
    showToast('?대?吏 蹂듭궗???ㅽ뙣?덉뒿?덈떎.');
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
    // fetch ?ㅽ뙣 (CORS ?뺤콉 ?꾨컲?쇰줈 ?덈맖)
    window.open(url, '_blank');
  }
}

// ================================
//  RATIO MODAL (UI)
// ================================
let _selectedRatio = '1:1';
let _selectedImageResolution = '1k';

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
  
  // ?쒖꽦???ㅽ????곸슜
  document.querySelectorAll('#ratioPopup .ratio-item').forEach(el => {
    el.classList.toggle('active', el.textContent === ratio);
  });
  
  document.getElementById('ratioPopup').classList.add('hidden');
}

function selectImageResolution(level) {
  _selectedImageResolution = (String(level || '').toLowerCase() === '2k') ? '2k' : '1k';
  document.querySelectorAll('#ratioPopup .ratio-res-btn').forEach((el) => {
    el.classList.toggle('active', String(el.dataset.resolution || '').toLowerCase() === _selectedImageResolution);
  });
}

// ?앹뾽 踰꾪듉 ?대┃ ???リ린
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
  block.style.marginTop = '4px';
  block.style.paddingBottom = '8px';
  block.innerHTML = `
    <div style="padding:12px;border:1px solid var(--border2);border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0));">
      <div class="field-label" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <span>Public Memory</span>
        <span style="font-size:10px;color:var(--muted);font-weight:500;letter-spacing:.04em">AUTO + MANUAL</span>
      </div>
      <div id="memoryMetaLine" style="font-size:11px;color:var(--muted);margin:-1px 0 10px 0;padding:8px 10px;border:1px dashed var(--border2);border-radius:10px;background:rgba(255,255,255,.015)">Loading memory status...</div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
        <textarea id="publicMemoryInput" class="edit-input" placeholder="Rememberable user fact..." style="flex:1;height:78px;resize:none;line-height:1.55;border-radius:12px"></textarea>
        <button onclick="addPublicMemoryManual()" style="height:78px;min-width:72px;padding:0 12px;border-radius:12px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:12px;cursor:pointer;font-family:'Pretendard',sans-serif;font-weight:600">Save</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0 10px">
      <button onclick="optimizeMemoryNow()" style="width:100%;height:34px;padding:0 8px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;font-family:'Pretendard',sans-serif;font-weight:600;white-space:nowrap">硫붾え由ъ턀?곹솕</button>
      <button onclick="rebuildMemoryNow()" style="width:100%;height:34px;padding:0 8px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;font-family:'Pretendard',sans-serif;font-weight:600;white-space:nowrap">硫붾え由ъ옱?앹꽦</button>
      <button onclick="toggleMemorySelectAll('public_profile','global',true); renderPublicMemoryList();" style="width:100%;height:34px;padding:0 8px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;white-space:nowrap">?꾩껜?좏깮</button>
      <button onclick="clearMemorySelection('public_profile','global'); renderPublicMemoryList();" style="width:100%;height:34px;padding:0 8px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;white-space:nowrap">?좏깮?댁젣</button>
      <button onclick="deleteSelectedMemories('public_profile','global')" style="width:100%;height:34px;padding:0 8px;border-radius:10px;border:1px solid hsl(0,28%,32%);background:hsl(0,24%,16%);color:#ffd7dd;font-size:11px;cursor:pointer;white-space:nowrap">?좏깮??젣</button>
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
const _memoryInlineEdit = { id: '', scope: '', owner: '', value: '' };
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
  const freshRes = await listMemoriesApi(scope, owner, limit);
  const fresh = Array.isArray(freshRes) ? freshRes : (Array.isArray(freshRes?.items) ? freshRes.items : []);
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
  const lockTitle = locked ? '?좉툑 ?댁젣' : '?좉툑';
  const lockNext = locked ? 'false' : 'true';
  const deleteDisabled = locked ? 'disabled' : '';
  const editDisabled = locked ? 'disabled' : '';
  const editOpacity = locked ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
  const deleteOpacity = locked ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
  const selected = getMemorySelectionSet(item.scope || '', item.owner || '').has(item.id);
  const cacheOwner = item.scope === 'public_profile' ? 'global' : (item.owner || editingPid || '');
  const isEditing = _memoryInlineEdit.id === item.id
    && _memoryInlineEdit.scope === (item.scope || '')
    && _memoryInlineEdit.owner === cacheOwner;
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border2);border-radius:12px;background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0));">
    <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleMemoryItemSelection('${item.scope || ''}','${item.owner || ''}','${item.id}',this.checked)" style="margin-top:4px;cursor:pointer;accent-color:hsl(196,72%,56%)" />
    <div style="flex:1">
      <div style="display:inline-flex;align-items:center;font-size:10px;color:var(--muted);margin-bottom:5px;padding:2px 7px;border:1px solid var(--border2);border-radius:999px;text-transform:uppercase;letter-spacing:.06em">${esc(scopeBadge)}</div>
      ${isEditing
        ? `<textarea oninput="memoryInlineEditInput(this.value)" style="width:100%;min-height:72px;resize:vertical;padding:8px 10px;border-radius:10px;border:1px solid var(--muted);background:var(--card);color:var(--text);font-size:12px;line-height:1.58;font-family:'Pretendard',sans-serif">${esc(_memoryInlineEdit.value || String(item.text || ''))}</textarea>
           <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:7px">
             <button onclick="saveMemoryInlineEdit('${item.id}','${item.scope || ''}','${cacheOwner}')" style="padding:5px 10px;border-radius:9px;border:1px solid var(--border2);background:var(--text);color:var(--bg);font-size:11px;cursor:pointer">???/button>
             <button onclick="cancelMemoryInlineEdit('${item.scope || ''}','${cacheOwner}')" style="padding:5px 10px;border-radius:9px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">痍⑥냼</button>
           </div>`
        : `<div style="font-size:12px;line-height:1.58;color:var(--text)">${safeText}</div>`}
    </div>
    <button onclick="toggleMemoryLockItem('${item.id}','${item.scope || ''}','${item.owner || ''}',${lockNext})" title="${lockTitle}" style="flex-shrink:0;width:30px;height:30px;border-radius:9px;border:1px solid var(--border2);background:rgba(255,255,255,.02);color:${locked ? 'hsl(45,80%,68%)' : 'var(--muted)'};display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${memoryLockIconSVG(locked)}</button>
    <button onclick="editMemoryItem('${item.id}','${item.scope || ''}','${item.owner || ''}')" title="Edit" ${editDisabled} style="flex-shrink:0;width:30px;height:30px;border-radius:9px;border:1px solid var(--border2);background:rgba(255,255,255,.02);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;${editOpacity}">${memoryEditIconSVG()}</button>
    <button onclick="${onDelete}('${item.id}','${item.scope || ''}','${item.owner || ''}')" title="??젣" ${deleteDisabled} style="flex-shrink:0;width:30px;height:30px;border-radius:9px;border:1px solid var(--border2);background:rgba(255,255,255,.02);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;${deleteOpacity}">${memoryTrashIconSVG()}</button>
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
    showToast('?좏깮??硫붾え由ш? ?놁뒿?덈떎.');
    return;
  }
  const res = await deleteMemoryBatchApi({ scope, owner, ids });
  if (!res?.ok) {
    showToast('?좏깮??젣 ?ㅽ뙣');
    return;
  }
  const current = getMemoryListFromCache(scope, owner) || [];
  const idSet = new Set(ids);
  setMemoryListToCache(scope, owner, current.filter(it => !idSet.has(it.id)));
  clearMemorySelection(scope, owner);
  showToast(`??젣 ?꾨즺 (${res.deleted || 0}/${ids.length})`);
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
    showToast('??젣 ?ㅽ뙣. ?좉툑 ?곹깭?몄? ?뺤씤?섏꽭??');
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
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
      <div class="edit-section-title" style="margin:0">Private Memory</div>
      <button onclick="optimizePrivateMemoryNow('${esc(pid)}')" style="padding:7px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer;font-family:'Pretendard',sans-serif;font-weight:600">理쒖쟻??/button>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <textarea id="privateMemoryInput" class="edit-input" placeholder="Memory for ${esc(pid)}..." style="flex:1;height:74px;resize:none;line-height:1.55;border-radius:12px"></textarea>
      <button onclick="addPrivateMemoryManual('${esc(pid)}')" style="height:74px;min-width:72px;padding:0 12px;border-radius:12px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:12px;cursor:pointer;font-family:'Pretendard',sans-serif;font-weight:600">Save</button>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px">
      <button onclick="toggleMemorySelectAll('private_profile','${esc(pid)}',true); renderPrivateMemoryList('${esc(pid)}');" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">?꾩껜?좏깮</button>
      <button onclick="clearMemorySelection('private_profile','${esc(pid)}'); renderPrivateMemoryList('${esc(pid)}');" style="padding:7px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-size:11px;cursor:pointer">?좏깮?댁젣</button>
      <button onclick="deleteSelectedMemories('private_profile','${esc(pid)}')" style="padding:7px 10px;border-radius:10px;border:1px solid hsl(0,28%,32%);background:hsl(0,24%,16%);color:#ffd7dd;font-size:11px;cursor:pointer">?좏깮??젣</button>
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
  const ticker = startMemoryProgressTicker(`媛쒖씤 硫붾え由?理쒖쟻??(${pid})`);
  showToast(`媛쒖씤 硫붾え由?理쒖쟻?붾? ?쒖옉?덉뒿?덈떎: ${pid}`);
  try {
    const res = await optimizeMemoriesApi({
      sessionId: session?.id || '',
      participantPids: [pid],
      includePublic: false
    });
    if (res?.ok) {
      showToast(`Private optimize done: ${res.optimized || 0} merged, ${res.removed || 0} removed`);
      setMemoryProgressLine(`媛쒖씤 硫붾え由?理쒖쟻???꾨즺 (${pid}): ${res.optimized || 0} ?뺣━, ${res.removed || 0} ?쒓굅`, false);
      renderPrivateMemoryList(pid, true);
      return;
    }
    const hint = res?.status ? ` (HTTP ${res.status})` : '';
    const err = String(res?.error || '').trim();
    const detail = String(res?.detail || '').trim();
    const msg = err || detail ? `: ${err || detail}` : '';
    showToast(`Private memory optimize failed${hint}${msg}`);
    setMemoryProgressLine(`媛쒖씤 硫붾え由?理쒖쟻???ㅽ뙣 (${pid})`, false);
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
    showToast('??젣 ?ㅽ뙣. ?좉툑 ?곹깭?몄? ?뺤씤?섏꽭??');
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
    showToast('?좉툑 蹂寃??ㅽ뙣');
    return;
  }
  showToast(locked ? '硫붾え由??좉툑?? : '硫붾え由??좉툑 ?댁젣');
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
  _memoryInlineEdit.id = id;
  _memoryInlineEdit.scope = scope;
  _memoryInlineEdit.owner = cacheOwner;
  _memoryInlineEdit.value = String(target.text || '');
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
}

function memoryInlineEditInput(value = '') {
  _memoryInlineEdit.value = String(value || '');
}

function cancelMemoryInlineEdit(scope = '', owner = '') {
  const cacheOwner = scope === 'public_profile' ? 'global' : (owner || editingPid || '');
  _memoryInlineEdit.id = '';
  _memoryInlineEdit.scope = '';
  _memoryInlineEdit.owner = '';
  _memoryInlineEdit.value = '';
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
}

async function saveMemoryInlineEdit(id, scope = '', owner = '') {
  if (!id || !scope) return;
  const cacheOwner = scope === 'public_profile' ? 'global' : (owner || editingPid || '');
  const current = getMemoryListFromCache(scope, cacheOwner) || await getMemoryListCached(scope, cacheOwner, 120);
  const target = current.find(it => it.id === id);
  if (!target) return;
  const clean = String(_memoryInlineEdit.value || '').replace(/^\s*profile\s*:\s*/i, '').trim();
  if (!clean) {
    showToast('鍮?硫붾え由щ뒗 ??ν븷 ???놁뒿?덈떎.');
    return;
  }
  if (clean === String(target.text || '').trim()) {
    cancelMemoryInlineEdit(scope, cacheOwner);
    return;
  }

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
    showToast('硫붾え由??섏젙 ?ㅽ뙣');
    return;
  }
  _memoryInlineEdit.id = '';
  _memoryInlineEdit.scope = '';
  _memoryInlineEdit.owner = '';
  _memoryInlineEdit.value = '';
  if (scope === 'public_profile') renderPublicMemoryList();
  if (scope === 'private_profile') renderPrivateMemoryList(cacheOwner);
  showToast('硫붾え由??섏젙 ?꾨즺');
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
  const cached = window.__memoryMetaCache;
  const isFreshCache = !!(
    cached &&
    cached.sessionId === String(sessionId || '') &&
    cached.meta &&
    (Date.now() - Number(cached.fetchedAt || 0)) < 15000
  );
  const meta = isFreshCache ? cached.meta : await getMemoryMetaApi(sessionId);
  if (!isFreshCache && meta && typeof meta === 'object') {
    window.__memoryMetaCache = {
      sessionId: String(sessionId || ''),
      meta,
      fetchedAt: Date.now()
    };
  }
  if (!meta?.ok) {
    line.textContent = '硫붾え由??곹깭瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??';
    return;
  }
  const lastExtract = formatMemoryMetaTime(meta?.session?.lastExtractedAt || 0);
  const lastOptimize = formatMemoryMetaTime(meta?.global?.lastOptimizedAt || 0);
  line.textContent = `理쒓렐 ?뺣━: ${lastExtract} / 理쒓렐 理쒖쟻?? ${lastOptimize}`;
}

function setMemoryProgressLine(text = '', busy = false) {
  const line = document.getElementById('memoryMetaLine');
  if (!line) return;
  if (busy) {
    line.dataset.busy = '1';
    line.textContent = text || '硫붾え由?理쒖쟻???묒뾽 以?..';
    return;
  }
  delete line.dataset.busy;
  if (text) line.textContent = text;
}

function startMemoryProgressTicker(label = '硫붾え由?理쒖쟻??) {
  const steps = [
    `${label}: 諛깃렇?쇱슫?쒖뿉???묒뾽 以묒엯?덈떎.`,
    `${label}: 以묐났/?좎궗 ??ぉ 遺꾩꽍 以?..`,
    `${label}: 蹂묓빀 諛??뺣━ ?곸슜 以?..`,
  ];
  let idx = 0;
  setMemoryProgressLine(steps[0], true);
  return setInterval(() => {
    idx = (idx + 1) % steps.length;
    setMemoryProgressLine(steps[idx], true);
  }, 1200);
}

async function optimizeMemoryNow() {
  if (!confirm('硫붾え由щ? 理쒖쟻?뷀븷源뚯슂? 以묐났/?좎궗 ??ぉ???뺣━?⑸땲??')) return;
  const session = getActiveSession();
  const participantPids = Array.from(new Set((personas || []).map(p => p.pid).filter(Boolean)));
  const ticker = startMemoryProgressTicker('硫붾え由?理쒖쟻??);
  showToast('硫붾え由?理쒖쟻?붾? 諛깃렇?쇱슫?쒖뿉???쒖옉?덉뒿?덈떎.');
  try {
    const res = await optimizeMemoriesApi({
      sessionId: session?.id || '',
      participantPids
    });
    if (res?.ok) {
      showToast(`理쒖쟻???꾨즺: ${res.optimized || 0}媛??뺣━, ${res.removed || 0}媛??쒓굅`);
      setMemoryProgressLine(`硫붾え由?理쒖쟻???꾨즺: ${res.optimized || 0} ?뺣━, ${res.removed || 0} ?쒓굅`, false);
      renderPublicMemoryList(true);
      if (editingPid) renderPrivateMemoryList(editingPid, true);
    } else {
      showToast('硫붾え由?理쒖쟻???ㅽ뙣');
      setMemoryProgressLine('硫붾え由?理쒖쟻???ㅽ뙣', false);
    }
  } finally {
    clearInterval(ticker);
    renderMemoryMeta();
  }
}

async function appendAIReplyStreamingOneToOne(reply, pList, suffixes, createdAt, tgtArea, renderSessionId, allowedEmotionMap = null) {
  const segments = parseResponse(reply, pList, allowedEmotionMap);
  if (!Array.isArray(segments) || segments.length !== 1) {
    return appendAIReplySequentially(reply, pList, suffixes, createdAt, tgtArea, renderSessionId, allowedEmotionMap);
  }
  const seg = segments[0];
  const segText = seg?.content?.trim?.() ? seg.content : '';
  if (!segText) return;
  const p = pList[seg.idx] || pList[0];
  if (!p) return;

  const container = document.createElement('div');
  tgtArea.appendChild(container);
  let mounted = null;
  const emotion = seg.emotion || 'neutral';
  const fullText = String(segText);
  const lengths = [];
  const total = fullText.length;
  let cursor = 0;
  while (cursor < total) {
    const remaining = total - cursor;
    const step = remaining > 500 ? 14 : (remaining > 200 ? 10 : 6);
    cursor = Math.min(total, cursor + step);
    lengths.push(cursor);
  }

  for (const len of lengths) {
    if (isSessionGenerationCancelled(renderSessionId) || activeChatId !== renderSessionId) return;
    const partial = fullText.slice(0, len);
    const segReply = `[${p.pid}][emotion:${emotion}]${partial}[/${p.pid}]`;
    const html = await renderAIResponseHTML(segReply, [p], suffixes, createdAt, true);
    if (isSessionGenerationCancelled(renderSessionId) || activeChatId !== renderSessionId) return;
    container.innerHTML = html;
    const nextEl = container.firstElementChild;
    if (!nextEl) continue;
    if (mounted) {
      mounted.replaceWith(nextEl);
      mounted = nextEl;
    } else {
      mounted = nextEl;
      mounted.classList.add('msg-enter');
      tgtArea.appendChild(mounted);
    }
    attachMessageMeta(mounted, createdAt, 'left');
    enhanceRenderedMessage(mounted);
    updateChatBottomAnchor(tgtArea);
    renderMermaidBlocks(tgtArea);
    bindImageLoadBottomStick(tgtArea);
    layoutHorizontalMasonryRows(tgtArea);
    stickChatToBottom(tgtArea);
    const ch = partial.slice(-1);
    await sleep(getBubbleTypingDelay(ch));
  }
}

async function rebuildMemoryNow() {
  const session = getActiveSession();
  if (!session) {
    showToast('?쒖꽦 梨꾪똿???놁뒿?덈떎.');
    return;
  }
  if (!confirm('?꾩옱 梨꾪똿 湲곕줉 湲곗??쇰줈 硫붾え由щ? ?ъ깮?깊븷源뚯슂? ?섎룞 硫붾え由щ뒗 ?좎??섍퀬 ?먮룞(chat) 硫붾え由щ쭔 ?ш뎄?깅맗?덈떎.')) return;
  const participantPids = Array.from(new Set((session.participantPids || []).filter(Boolean)));
  const ticker = startMemoryProgressTicker('硫붾え由??ъ깮??);
  showToast('硫붾え由??ъ깮?깆쓣 諛깃렇?쇱슫?쒖뿉???쒖옉?덉뒿?덈떎.');
  try {
    const res = await rebuildMemoriesApi({
      sessionId: session.id,
      participantPids,
      history: (session.history || []).map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt || Date.now()
      })),
      includePublic: true
    });
    if (res?.ok) {
      showToast(`?ъ깮???꾨즺: ${res.cleared || 0} ?쒓굅, ${res.saved || 0} ???);
      setMemoryProgressLine(`硫붾え由??ъ깮???꾨즺: ${res.cleared || 0} ?쒓굅, ${res.saved || 0} ???, false);
      renderPublicMemoryList(true);
      if (editingPid) renderPrivateMemoryList(editingPid, true);
    } else {
      showToast('硫붾え由??ъ깮???ㅽ뙣');
      setMemoryProgressLine('硫붾え由??ъ깮???ㅽ뙣', false);
    }
  } finally {
    clearInterval(ticker);
    renderMemoryMeta();
  }
}



