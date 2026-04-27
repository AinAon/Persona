// Lightweight reminder core (web-first, push-adapter-ready)
(function () {
  const STORAGE_KEY = 'reminders_v1';
  const TICK_MS = 15000;
  let started = false;
  let tickTimer = null;
  let reminders = [];
  let pushAdapter = async () => false;

  function uid() {
    return 'rmd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      reminders = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      reminders = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch (_) {}
  }

  function normalizeDueAt(value) {
    const ts = typeof value === 'number' ? value : Date.parse(String(value || ''));
    return Number.isFinite(ts) ? ts : Date.now();
  }

  async function notifyReminder(reminder) {
    const title = String(reminder.title || '리마인더');
    const body = String(reminder.body || '');
    const channel = String(reminder.channel || 'inapp');
    const channels = channel.split(',').map((v) => v.trim()).filter(Boolean);

    if (channels.includes('inapp')) {
      const msg = body ? `[리마인더] ${title}: ${body}` : `[리마인더] ${title}`;
      if (typeof showToast === 'function') showToast(msg, 4000);
      else console.log(msg);
    }

    if (channels.includes('push')) {
      try { await pushAdapter(reminder); } catch (_) {}
    }
  }

  async function runDueCheck() {
    const now = Date.now();
    let dirty = false;
    for (const item of reminders) {
      if (!item || item.doneAt || item.notifiedAt) continue;
      const dueAt = normalizeDueAt(item.dueAt);
      if (dueAt <= now) {
        await notifyReminder(item);
        item.notifiedAt = now;
        dirty = true;
      }
    }
    if (dirty) save();
  }

  function list() {
    return reminders.slice().sort((a, b) => normalizeDueAt(a.dueAt) - normalizeDueAt(b.dueAt));
  }

  function create(payload = {}) {
    const reminder = {
      id: String(payload.id || uid()),
      title: String(payload.title || '리마인더'),
      body: String(payload.body || ''),
      dueAt: normalizeDueAt(payload.dueAt),
      channel: String(payload.channel || 'inapp'),
      tags: Array.isArray(payload.tags) ? payload.tags.map((x) => String(x)) : [],
      createdAt: Date.now(),
      notifiedAt: null,
      doneAt: null
    };
    reminders.push(reminder);
    save();
    return reminder;
  }

  function remove(id) {
    const target = String(id || '');
    const before = reminders.length;
    reminders = reminders.filter((x) => String(x?.id || '') !== target);
    if (reminders.length !== before) save();
    return reminders.length !== before;
  }

  function done(id) {
    const target = String(id || '');
    const item = reminders.find((x) => String(x?.id || '') === target);
    if (!item) return false;
    item.doneAt = Date.now();
    save();
    return true;
  }

  async function testNow(payload = {}) {
    const item = create({ ...payload, dueAt: Date.now() - 1 });
    await runDueCheck();
    return item;
  }

  function registerPushAdapter(fn) {
    if (typeof fn === 'function') pushAdapter = fn;
  }

  function init() {
    if (started) return;
    started = true;
    load();
    runDueCheck().catch(() => {});
    tickTimer = setInterval(() => { runDueCheck().catch(() => {}); }, TICK_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) runDueCheck().catch(() => {});
    });
  }

  window.reminders = {
    init,
    list,
    create,
    remove,
    done,
    testNow,
    registerPushAdapter,
    stop: function () {
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = null;
      started = false;
    }
  };
})();
