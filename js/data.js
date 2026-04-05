// ══════════════════════════════
//  CONSTANTS & DATA
// ══════════════════════════════
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwc2pNBmXpeDLHqc7tGff4kVByDbcG1ijLRzxNTiKjSklSo4dcm61R5XNOAghaAGozz/exec';
const GAS_SECRET = 'persona_chat_2025';
const WORKER_URL = 'https://persona-worker.persona-worker.workers.dev/';
const HUE_PRESETS = [158, 210, 260, 300, 330, 20, 45, 80];

const EMOTIONS = ['angry','arousal','confusion','contempt','cry','disgust','ecstasy','happy','horror',
  'laugh','neutral','orgasm','pain','playful','relief','sad','shy','subtlesmile','surprise','worry'];

const EMOTION_PROFILE_MAP = { 'p_riley': 'riley' };
const MAX_PARTICIPANTS = 4;

const PID_POOL = [
  'mango','kiwi','peach','plum','lime','fig','pear','cherry','grape','melon',
  'lemon','guava','lychee','papaya','mango','apricot','berry','coconut','date','olive',
  'paris','tokyo','berlin','milan','cairo','oslo','dubai','lima','seoul','prague',
  'vienna','zurich','lisbon','sydney','bangkok','nairobi','bogota','athens','delhi','kyoto',
  'venice','dublin','bruges','riga','tbilisi','baku','tashkent','almaty','yangon','hanoi',
  'porto','seville','valencia','bologna','florence','bologna','genova','trieste','brest','ghent',
  'bruges','antwerp','liege','namur','arlon','dinant','spa','liege','leuven','hasselt',
  'cork','galway','limerick','tralee','kilkenny','sligo','athlone','drogheda','dundalk','wexford',
  'olomouc','plzen','ostrava','brno','liberec','zlin','opava','havirov','prostejov','prerov'
];

let _pidPoolIdx = 0;
function nextPid() {
  const name = PID_POOL[_pidPoolIdx % PID_POOL.length];
  _pidPoolIdx++;
  return `p_${name}_${Date.now().toString(36).slice(-3)}`;
}

const TRAIT_MAP = {
  '공감형':'empathetic','논리적':'logical','직관적':'intuitive','직설적':'blunt',
  '철학적':'philosophical','팩트중심':'fact-driven','유머러스':'humorous','신중한':'cautious',
  '도전적':'challenging','현실적':'realistic','냉소적':'cynical','도발적':'provocative',
  '무관심':'indifferent','따뜻하게':'warm','간결하게':'concise','친근하게':'friendly',
  '격식있게':'formal','캐주얼하게':'casual','건방지게':'cocky','무례하게':'rude',
  '싸늘하게':'cold','다정하게':'affectionate','쿨하게':'cool','불만스럽게':'disgruntled',
  '열정적으로':'passionate','진지하게':'serious','엉뚱하게':'quirky'
};
const TRAIT_OPTIONS = Object.keys(TRAIT_MAP);

// ══════════════════════════════
//  STATE VARIABLES
// ══════════════════════════════
let personas = [];   
let sessions = [];   
let activeChatId = null;
let activeTab = 'persona';
let currentMode = 'fast';
let newChatMode = 'auto';
let selectedPids = [];
let editingPid = null;   
let attachments = [];
let isLoading = false;
let demoEmotionIdx = 0;

const CACHE_PERSONAS_KEY = 'pc4_personas';
const CACHE_INDEX_KEY = 'pc4_index';
const CACHE_SESSION_PREFIX = 'pc4_sess_';
const CACHE_USER_KEY = 'pc4_user';

let userProfile = { name: '', bio: '', image: null };

const DEFAULT_PERSONAS = []; // celebrity.json에서 로드

// ══════════════════════════════
//  BASIC DATA UTILS
// ══════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function getPersona(pid) { return personas.find(p => p.pid === pid); }
function getSession(id) { return sessions.find(s => s.id === id); }
function getActiveSession() { return sessions.find(s => s.id === activeChatId); }