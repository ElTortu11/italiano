/* ═══════════════════════════════════════════════════════════════════════════
   Italiano App — main SPA controller
   ═══════════════════════════════════════════════════════════════════════════ */

// ── API client ────────────────────────────────────────────────────────────
const API = {
  async get(path) {
    const r = await fetch('/api' + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch('/api' + path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch('/api' + path, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch('/api' + path, { method:'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

// ── Toast ─────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Theme ──────────────────────────────────────────────────────────────────
let currentTheme = localStorage.getItem('theme') || 'auto';
function applyTheme(t) {
  currentTheme = t;
  localStorage.setItem('theme', t);
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const dark = currentTheme === 'dark' || (currentTheme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  btn.innerHTML = dark
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}
applyTheme(currentTheme);

// ── Router ────────────────────────────────────────────────────────────────
const ROUTES = {
  dashboard: { title:'Bacheca', render: renderDashboard },
  session: { title:'Sessione del giorno', render: renderSession },
  flashcards: { title:'Flashcard', render: renderFlashcards },
  vocabulary: { title:'Vocabolario', render: renderVocabulary },
  conjugation: { title:'Coniugazioni', render: renderConjugation },
  grammar: { title:'Grammatica', render: renderGrammar },
  completamento: { title:'Completamento', render: renderCompletamento },
  writing: { title:'Scrittura', render: renderWriting },
  reading: { title:'Lettura', render: renderReading },
  errors: { title:'Quaderno degli errori', render: renderErrors },
  progress: { title:'Progressi', render: renderProgress },
  rewards: { title:'Premi', render: renderRewards },
  settings: { title:'Impostazioni', render: renderSettings },
};

let currentRoute = 'dashboard';

// ── Study timer ───────────────────────────────────────────────────────────────
const STUDY_ROUTES = new Set(['session','flashcards','conjugation','writing']);
const studyTimer = {
  sessionStart: null,
  lastFlush: null,
  _interval: null,
  totalSeconds: 0,

  async init() {
    try {
      const s = await API.get('/dashboard/stats');
      this.totalSeconds = Math.round((s.todayMinutes || 0) * 60);
    } catch(e) {}
  },

  start() {
    if (this._interval) return;
    this.sessionStart = Date.now();
    this.lastFlush = Date.now();
    this._interval = setInterval(() => this._tick(), 1000);
    this._updateDisplay(true);
  },

  stop() {
    if (!this._interval) return;
    this._flush();
    clearInterval(this._interval);
    this._interval = null;
    this.sessionStart = null;
    this._updateDisplay(false);
  },

  _sinceFlush() {
    return this.lastFlush ? Math.floor((Date.now() - this.lastFlush) / 1000) : 0;
  },

  _elapsed() {
    return this.sessionStart ? Math.floor((Date.now() - this.sessionStart) / 1000) : 0;
  },

  _tick() {
    this._updateDisplay(true);
    if (this._sinceFlush() >= 300) this._flush();
  },

  _updateDisplay(visible) {
    const wrap = document.getElementById('study-timer');
    const el   = document.getElementById('timer-display');
    if (!wrap || !el) return;
    wrap.style.display = visible ? 'flex' : 'none';
    if (visible) {
      const total = this.totalSeconds + this._elapsed();
      const m = Math.floor(total / 60);
      const s = total % 60;
      el.textContent = `${m}:${String(s).padStart(2,'0')}`;
    }
  },

  _flush() {
    const secs = this._sinceFlush();
    if (secs < 5) return;
    this.totalSeconds += secs;
    this.lastFlush = Date.now();
    API.post('/stats/heartbeat', { seconds: secs }).catch(() => {});
  },
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) studyTimer._flush();
});
window.addEventListener('beforeunload', () => studyTimer._flush());

function navigate(route) {
  if (!ROUTES[route]) route = 'dashboard';

  if (STUDY_ROUTES.has(currentRoute) && !STUDY_ROUTES.has(route)) studyTimer.stop();
  if (!STUDY_ROUTES.has(currentRoute) && STUDY_ROUTES.has(route)) studyTimer.start();

  currentRoute = route;
  document.getElementById('topbar-title').textContent = ROUTES[route].title;

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading"><div class="spinner"></div> Caricamento...</div>`;

  ROUTES[route].render(content).catch(err => {
    content.innerHTML = `<div class="alert alert-error">Errore: ${err.message}</div>`;
  });
}

// ── Sidebar toggle ────────────────────────────────────────────────────────
let sidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
function applySidebarState() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const icon = document.getElementById('toggle-icon');
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  main.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  if (icon) {
    icon.innerHTML = sidebarCollapsed
      ? '<polyline points="9 18 15 12 9 6"/>'
      : '<polyline points="15 18 9 12 15 6"/>';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = {
  pct: v => Math.round((v || 0) * 100),
  mins: v => v < 60 ? `${Math.round(v)}min` : `${Math.floor(v/60)}h ${Math.round(v%60)}min`,
  date: s => new Date(s).toLocaleDateString('es', { day:'numeric', month:'short' }),
  num: n => (n||0).toLocaleString(),
  interval: secs => {
    const d = Math.round(secs / 86400);
    if (d <= 0) return 'oggi';
    if (d === 1) return 'domani';
    if (d < 7) return `tra ${d} giorni`;
    if (d < 30) return `tra ${Math.round(d/7)} sett.`;
    return `tra ${Math.round(d/30)} mes.`;
  },
};

function progressBar(pct, cls='') {
  return `<div class="progress-bar-wrap"><div class="progress-bar ${cls}" style="width:${Math.min(100,pct)}%"></div></div>`;
}

function cefrBadge(level) {
  const map = { A1:'badge-gray', A2:'badge-gray', B1:'badge-blue', B2:'badge-green', C1:'badge-gold', C2:'badge-gold' };
  return `<span class="badge ${map[level]||'badge-gray'}">${level}</span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function renderDashboard(el) {
  const data = await API.get('/stats/dashboard');
  const goalPct = Math.min(100, Math.round((data.todayMinutes / data.dailyGoalMinutes) * 100));

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">¡Buongiorno! 👋</div>
        <div class="section-sub">Obiettivo: ${data.goalLevel} · Obiettivo giornaliero: ${data.dailyGoalMinutes} minuti</div>
      </div>
      <button class="btn btn-primary" data-route="session">Inizia sessione →</button>
    </div>

    <!-- Quick stats -->
    <div class="grid-4 mb-4">
      <div class="stat-tile stat-tile-accent">
        <div class="stat-tile-label">Serie attuale</div>
        <div class="stat-tile-value">🔥 ${data.streak}</div>
        <div class="stat-tile-sub">Migliore: ${data.bestStreak} giorni</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Parole imparate</div>
        <div class="stat-tile-value">${fmt.num(data.learnedWords)}</div>
        <div class="stat-tile-sub">di ${fmt.num(data.totalWords)} totali</div>
      </div>
      <div class="stat-tile ${data.dueCards > 0 ? 'stat-tile-gold' : ''}">
        <div class="stat-tile-label">Ripetizioni in sospeso</div>
        <div class="stat-tile-value">${data.dueCards}</div>
        <div class="stat-tile-sub">flashcard in scadenza</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Studiato oggi</div>
        <div class="stat-tile-value">${Math.round(data.todayMinutes)}min</div>
        <div class="stat-tile-sub">Obiettivo: ${data.dailyGoalMinutes} min</div>
      </div>
    </div>

    <!-- Today's goal progress -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">Obiettivo di oggi</div>
          <div class="card-subtitle">${data.dailyGoalMinutes} minuti · ${goalPct}% completato</div>
        </div>
        ${data.goalMet ? '<span class="badge badge-green">✓ Obiettivo raggiunto</span>' : ''}
      </div>
      ${progressBar(goalPct)}
      <div class="flex justify-between mt-2 text-xs text-muted">
        <span>${Math.round(data.todayMinutes)} min studiati</span>
        <span>${data.todayCards} flashcard ripetute</span>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <!-- Weak categories -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Aree deboli</div>
          <button class="btn btn-sm btn-ghost" data-route="progress">Vedi tutto</button>
        </div>
        ${data.weakCategories.length ? data.weakCategories.map(c => `
          <div class="flex items-center gap-3 mb-3">
            <span style="font-size:1.2rem">${c.icon}</span>
            <div style="flex:1">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">${c.name}</span>
                <span class="text-muted">${c.acc ? fmt.pct(c.acc)+'%' : '—'}</span>
              </div>
              ${progressBar(c.acc ? fmt.pct(c.acc) : 0)}
            </div>
          </div>`).join('') : '<div class="text-muted text-sm">Ancora pochi dati!</div>'}
      </div>

      <!-- Recent errors -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Errori recenti</div>
          <button class="btn btn-sm btn-ghost" data-route="errors">Vedi quaderno</button>
        </div>
        ${data.recentErrors.length ? data.recentErrors.map(e => `
          <div class="mb-3 pb-3 border-b" style="border-bottom:1px solid var(--border)">
            <div class="text-sm italic text-red">${e.original_text.substring(0,60)}${e.original_text.length>60?'…':''}</div>
            <div class="text-xs text-muted mt-1">${e.corrected_text ? '→ '+e.corrected_text.substring(0,50) : ''}</div>
          </div>`).join('') : '<div class="text-muted text-sm">Nessun errore ancora!</div>'}
      </div>
    </div>

    <!-- Quick actions -->
    <div class="card">
      <div class="card-title mb-4">Accesso rapido</div>
      <div class="grid-3">
        ${[
          { route:'flashcards', icon:'🗃️', label:'Flashcard', sub: data.dueCards+' in sospeso' },
          { route:'conjugation', icon:'⚡', label:'Coniugare', sub:'Pratica veloce' },
          { route:'vocabulary', icon:'📖', label:'Vocabolario', sub:'Esplora categorie' },
          { route:'writing', icon:'✍️', label:'Scrittura', sub:'Composizione libera' },
          { route:'grammar', icon:'📐', label:'Grammatica', sub:'Regole ed esercizi' },
          { route:'errors', icon:'⚠️', label:'Errori', sub:'Ripassare e correggere' },
        ].map(a => `
          <button class="card" style="text-align:left;cursor:pointer;border-color:var(--border)" data-route="${a.route}">
            <div style="font-size:1.5rem;margin-bottom:6px">${a.icon}</div>
            <div class="font-medium text-sm">${a.label}</div>
            <div class="text-xs text-muted">${a.sub}</div>
          </button>`).join('')}
      </div>
    </div>
  `;

  el.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════════════════════════════════════════
async function renderSession(el) {
  const data = await API.get('/session/today');
  const { dueCount, newCount } = data;

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Sessione del giorno</div>
        <div class="section-sub">${new Date().toLocaleDateString('it', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="stat-tile ${dueCount > 0 ? 'stat-tile-gold' : ''}">
        <div class="stat-tile-label">Flashcard in scadenza</div>
        <div class="stat-tile-value">${dueCount}</div>
        <div class="stat-tile-sub">Necessitano ripasso ora</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Parole nuove disponibili</div>
        <div class="stat-tile-value">${newCount}</div>
        <div class="stat-tile-sub">Ancora da studiare</div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-2">Piano di sessione suggerito</div>
      <div class="text-sm text-muted mb-4">Basato sui tuoi dati di progresso e obiettivi</div>
      <div id="session-plan">
        ${buildSessionPlan(dueCount, newCount)}
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Avvio rapido</div>
      <div class="grid-2">
        <button class="btn btn-primary btn-lg btn-block" id="start-flashcards">
          🗃️ Ripassa flashcard ${dueCount > 0 ? `(${dueCount})` : ''}
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-conjugation">
          ⚡ Pratica di coniugazione
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-vocab">
          📖 Vocabolario nuovo
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-writing">
          ✍️ Esercizio di scrittura
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-title mb-2">Metodologia di questa sessione</div>
      <div class="text-sm text-muted" style="line-height:1.8">
        <strong>SM-2</strong> — L'algoritmo di ripetizione spaziata programma ogni flashcard in base alle tue prestazioni.<br>
        <strong>70% input · 15% SRS · 15% produzione</strong> — Proporzione ottimale per B1→C1.<br>
        <strong>Costanza</strong> — 30–45 min al giorno supera di gran lunga le sessioni lunghe sporadiche.
      </div>
    </div>
  `;

  el.querySelector('#start-flashcards').addEventListener('click', () => navigate('flashcards'));
  el.querySelector('#start-conjugation').addEventListener('click', () => navigate('conjugation'));
  el.querySelector('#start-vocab').addEventListener('click', () => navigate('vocabulary'));
  el.querySelector('#start-writing').addEventListener('click', () => navigate('writing'));
}

function buildSessionPlan(due, newW) {
  const steps = [];
  if (due > 0) steps.push({ icon:'🗃️', label:`Ripassa ${Math.min(due, 30)} flashcard in scadenza`, mins:10, route:'flashcards' });
  if (newW > 0) steps.push({ icon:'✨', label:`Impara ${Math.min(newW, 15)} parole nuove`, mins:10, route:'flashcards' });
  steps.push({ icon:'⚡', label:'5 esercizi di coniugazione', mins:5, route:'conjugation' });
  steps.push({ icon:'✍️', label:'Scrivi 80–120 parole in italiano', mins:10, route:'writing' });
  steps.push({ icon:'⚠️', label:'Ripassa 3 errori del quaderno', mins:5, route:'errors' });
  const total = steps.reduce((s, x) => s + x.mins, 0);
  return `
    ${steps.map((s, i) => `
      <div class="flex items-center gap-3 mb-3 pb-3" style="border-bottom:1px solid var(--border)">
        <span style="background:var(--accent-bg);color:var(--accent);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${i+1}</span>
        <span style="font-size:1rem">${s.icon}</span>
        <div style="flex:1"><div class="text-sm font-medium">${s.label}</div></div>
        <span class="text-xs text-muted">${s.mins}min</span>
      </div>`).join('')}
    <div class="flex justify-between text-sm mt-2">
      <span class="text-muted">Durata stimata</span>
      <span class="font-medium text-accent">${total} minuti</span>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// FLASHCARDS
// ══════════════════════════════════════════════════════════════════════════════
let fcState = { cards: [], index: 0, flipped: false, reviewed: 0, correct: 0, mode: 'due', typingMode: false, pendingCategoryId: null, pendingCategoryName: '' };

function showModeModal(el, tab) {
  showModal('Come vuoi studiare?', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:4px 0">
      <div style="text-align:center;padding:24px 16px;border:1.5px solid var(--border);border-radius:12px">
        <div style="font-size:2.8rem">🃏</div>
        <div style="font-weight:700;margin-top:10px;font-size:1rem">Classico</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;line-height:1.4">Gira la carta e autovalutati</div>
      </div>
      <div style="text-align:center;padding:24px 16px;border:1.5px solid var(--border);border-radius:12px">
        <div style="font-size:2.8rem">✍️</div>
        <div style="font-weight:700;margin-top:10px;font-size:1rem">Scrittura</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;line-height:1.4">Vedi lo spagnolo → scrivi in italiano con l'articolo</div>
      </div>
    </div>
  `, [
    { label: '🃏 Classico', cls: 'btn-outline', action: () => {
      fcState.typingMode = false;
      closeModal();
      loadFlashcards(el, tab);
      document.getElementById('fc-mode-label') && (document.getElementById('fc-mode-label').textContent = '🃏 Classico');
    }},
    { label: '✍️ Scrittura', cls: 'btn-primary', action: () => {
      fcState.typingMode = true;
      closeModal();
      loadFlashcards(el, tab);
      document.getElementById('fc-mode-label') && (document.getElementById('fc-mode-label').textContent = '✍️ Scrittura');
    }},
  ]);
}

async function renderFlashcards(el) {
  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Flashcard</div>
        <div class="section-sub">Ripetizione spaziata SM-2</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" id="fc-mode-change">
          <span id="fc-mode-label">${fcState.typingMode ? '✍️ Scrittura' : '🃏 Classico'}</span> ▾
        </button>
        <button class="btn btn-outline btn-sm" id="fc-add-btn">+ Nuova scheda</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-mode="due">In scadenza</button>
      <button class="tab-btn" data-mode="new">Nuove</button>
      <button class="tab-btn" data-mode="all">Tutte</button>
      <button class="tab-btn" data-mode="verbi">Verbi</button>
    </div>

    <div id="fc-container">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  let currentTab = 'due';

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.mode;
      loadFlashcards(el, currentTab);
    });
  });

  el.querySelector('#fc-mode-change').addEventListener('click', () => showModeModal(el, currentTab));
  el.querySelector('#fc-add-btn').addEventListener('click', () => showAddCardModal());

  const pendingCat = fcState.pendingCategoryId || null;
  if (pendingCat) {
    fcState.pendingCategoryId = null;
    loadFlashcards(el, 'due', pendingCat);
  } else {
    showModeModal(el, currentTab);
  }
}

async function loadFlashcards(el, mode, catId = null) {
  const container = document.getElementById('fc-container');
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    let cards;
    const catParam = catId ? `&category=${catId}` : '';
    if (mode === 'due') cards = await API.get(`/flashcards/due?limit=50${catParam}`);
    else if (mode === 'new') cards = await API.get(`/flashcards/new?limit=30${catParam}`);
    else if (mode === 'verbi') {
      const verbs = await API.get('/conjugation/verb-flashcards');
      renderVerbFlashcards(container, verbs);
      return;
    } else {
      const data = await API.get('/vocabulary/words?limit=100');
      showWordListView(container, data.words);
      return;
    }

    if (!cards.length) {
      const msg = mode === 'due'
        ? 'Nessun ripasso in sospeso! Torna domani o studia nuove schede.'
        : 'Hai studiato tutte le parole disponibili!';
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-title">${msg}</div></div>`;
      return;
    }

    fcState = { cards, index: 0, flipped: false, reviewed: 0, correct: 0, mode, typingMode: fcState.typingMode, pendingCategoryId: null, pendingCategoryName: '' };
    renderFlashcard(container);
  } catch(e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function renderVerbFlashcards(container, verbs) {
  let idx = 0, flipped = false;
  function render() {
    const v = verbs[idx];
    const formsHTML = Object.entries(v.presente).map(([p, f]) =>
      `<div style="display:flex;gap:12px;justify-content:center"><span style="color:var(--text-muted);width:32px;text-align:right">${p}</span><strong>${f}</strong></div>`
    ).join('');
    container.innerHTML = `
      <div class="mb-3 flex items-center justify-between text-sm text-muted">
        <span>${idx + 1} / ${verbs.length}</span>
        <span style="color:var(--text-muted);font-size:0.8rem">Verbi in infinito</span>
      </div>
      ${progressBar(Math.round(idx / verbs.length * 100))}
      <div style="height:16px"></div>
      <div class="flashcard-scene" id="fc-scene">
        <div class="flashcard" id="fc-card">
          <div class="flashcard-face flashcard-front">
            <div style="font-size:1rem;opacity:0.5;margin-bottom:8px">⚡ Verbo</div>
            <div class="flashcard-word">${v.verb}</div>
            <div class="flashcard-tap-hint">Tocca per vedere</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-word" style="color:var(--accent);margin-bottom:16px">${v.translation}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Presente indicativo</div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem">${formsHTML}</div>
          </div>
        </div>
      </div>
      <div class="flex gap-2 justify-center mt-4">
        <button class="btn btn-outline" id="vf-prev" ${idx===0?'disabled':''}>← Indietro</button>
        <button class="btn btn-primary" id="vf-next">${idx < verbs.length-1 ? 'Avanti →' : 'Terminare ✓'}</button>
      </div>`;
    document.getElementById('fc-card').addEventListener('click', () => {
      if (!flipped) { document.getElementById('fc-card').classList.add('flipped'); flipped = true; }
    });
    document.getElementById('vf-next').addEventListener('click', () => {
      if (idx < verbs.length - 1) { idx++; flipped = false; render(); }
      else container.innerHTML = `<div class="card" style="text-align:center;padding:40px"><div style="font-size:3rem">🎉</div><div class="section-title mt-3">Tutti i verbi completati!</div></div>`;
    });
    document.getElementById('vf-prev').addEventListener('click', () => {
      if (idx > 0) { idx--; flipped = false; render(); }
    });
  }
  render();
}

function renderFlashcard(container) {
  const { cards, index } = fcState;
  if (index >= cards.length) {
    const acc = fcState.reviewed > 0 ? Math.round((fcState.correct / fcState.reviewed) * 100) : 0;
    const modeLabel = fcState.typingMode ? 'Modalità Scrittura' : 'Modalità Classica';
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:3rem;margin-bottom:16px">🎯</div>
        <div class="section-title mb-2">Sessione completata</div>
        <div class="text-muted mb-1">${modeLabel}</div>
        <div class="text-muted mb-4">${fcState.reviewed} schede · ${acc}% di precisione</div>
        <div class="grid-2 mb-4" style="max-width:300px;margin:0 auto">
          <div class="stat-tile"><div class="stat-tile-label">Ripetute</div><div class="stat-tile-value">${fcState.reviewed}</div></div>
          <div class="stat-tile stat-tile-accent"><div class="stat-tile-label">Precisione</div><div class="stat-tile-value">${acc}%</div></div>
        </div>
        <button class="btn btn-primary" onclick="navigate('dashboard')">Torna alla bacheca</button>
      </div>`;
    API.post('/milestones/check', {}).catch(() => {});
    return;
  }

  if (fcState.typingMode) {
    renderFlashcardTyping(container);
    return;
  }

  const card = cards[index];
  const progress = Math.round((index / cards.length) * 100);
  const nextReview = card.interval > 0 ? `Intervallo: ${card.interval} giorni` : 'Scheda nuova';

  container.innerHTML = `
    <div class="mb-3 flex items-center justify-between text-sm text-muted">
      <span>${index + 1} / ${cards.length}</span>
      <span>${nextReview}</span>
    </div>
    ${progressBar(progress)}
    <div style="height:16px"></div>

    <div class="flashcard-scene" id="fc-scene">
      <div class="flashcard" id="fc-card">
        <div class="flashcard-face flashcard-front">
          ${card.category_icon ? `<div style="font-size:1.2rem;opacity:0.5">${card.category_icon} ${card.category_name||''}</div>` : ''}
          <div class="flashcard-word">${card.front}</div>
          ${card.gender ? `<div class="flashcard-subinfo">${card.article||''} — ${card.gender==='m'?'maschile':'femminile'}${card.plural?' — pl: '+card.plural:''}</div>` : ''}
          <div class="flashcard-tap-hint">Tocca per vedere la risposta</div>
        </div>
        <div class="flashcard-face flashcard-back">
          <div class="flashcard-word" style="color:var(--accent)">${card.back}</div>
          ${card.example_it ? `<div class="flashcard-example"><em>${card.example_it}</em><br><span class="text-muted">${card.example_es||''}</span></div>` : ''}
          ${card.notes ? `<div class="text-xs text-muted" style="margin-top:8px">${card.notes}</div>` : ''}
        </div>
      </div>
    </div>

    <div id="fc-actions" class="mt-4" style="display:none">
      <div class="text-center text-sm text-muted mb-3">Come è andata?</div>
      <div class="fc-quality-btns">
        <button class="fc-quality-btn q-0" data-q="0">❌<span>Non ricordavo</span></button>
        <button class="fc-quality-btn q-1" data-q="1">😓<span>Con difficoltà</span></button>
        <button class="fc-quality-btn q-3" data-q="3">🙂<span>Bene</span></button>
        <button class="fc-quality-btn q-5" data-q="5">⚡<span>Molto facile</span></button>
      </div>
    </div>
  `;

  const fcCard = document.getElementById('fc-card');
  fcCard.addEventListener('click', () => {
    if (!fcState.flipped) {
      fcCard.classList.add('flipped');
      fcState.flipped = true;
      document.getElementById('fc-actions').style.display = 'block';
    }
  });

  container.querySelectorAll('.fc-quality-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = parseInt(btn.dataset.q);
      try {
        await API.post(`/flashcards/${card.id}/review`, { quality: q });
        fcState.reviewed++;
        if (q >= 3) fcState.correct++;
        fcState.index++;
        fcState.flipped = false;
        renderFlashcard(container);
      } catch(e) { toast('Errore nel salvataggio', 'error'); }
    });
  });
}

function renderFlashcardTyping(container) {
  const { cards, index } = fcState;
  const card = cards[index];
  const progress = Math.round((index / cards.length) * 100);

  container.innerHTML = `
    <div class="mb-3 flex items-center justify-between text-sm text-muted">
      <span>${index + 1} / ${cards.length}</span>
      <span>${card.interval > 0 ? 'Intervallo: '+card.interval+' giorni' : 'Scheda nuova'}</span>
    </div>
    ${progressBar(progress)}
    <div style="height:16px"></div>

    <div class="fc-typing-card" id="fc-typing-card">
      <div class="fc-typing-lang">Spagnolo → Italiano</div>
      ${card.category_icon ? `<div class="fc-typing-cat">${card.category_icon} ${card.category_name||''}</div>` : ''}
      <div class="fc-typing-word">${card.back}</div>
      ${card.category_name === 'Preposizioni'
        ? `<div class="fc-typing-hint">Scrivi la preposizione in italiano</div>`
        : card.word_type === 'verb'
          ? `<div class="fc-typing-hint">Scrivi il verbo all'infinito</div>`
          : `<div class="fc-typing-hint">Scrivi con l'articolo (es: <em>il cane</em>, <em>la casa</em>, <em>l'uomo</em>)</div>`
      }
      <div class="fc-typing-input-wrap">
        <input id="fc-type-input" class="fc-typing-input" placeholder="${card.category_name === 'Preposizioni' ? 'preposizione...' : card.word_type === 'verb' ? 'infinito...' : 'articolo + parola...'}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button class="btn btn-primary" id="fc-type-check">Controlla</button>
      </div>
      <div id="fc-type-result" style="display:none;margin-top:12px"></div>
      <div id="fc-type-example" style="display:none;margin-top:8px;font-size:0.85rem" class="flashcard-example"></div>
    </div>

    <div class="flex gap-2 justify-center mt-3" id="fc-type-actions">
      <button class="btn btn-outline btn-sm" id="fc-type-skip">Salta</button>
      <button class="btn btn-primary" id="fc-type-next" style="display:none">Avanti → <span style="opacity:.6;font-size:0.8em">→</span></button>
    </div>
    <div style="display:none;text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:6px" id="fc-key-hint"></div>
  `;

  const input = document.getElementById('fc-type-input');
  input.focus();

  function normalize(s) { return s.trim().toLowerCase().replace(/\s+/g,' '); }

  function goNext() {
    fcState.index++;
    renderFlashcard(container);
  }

  async function check() {
    const typed = input.value.trim();
    if (!typed) return;

    const correct = card.front;
    const isOk = normalize(typed) === normalize(correct);
    const quality = isOk ? 5 : 1;

    input.disabled = true;
    input.style.borderColor = isOk ? 'var(--accent)' : '#ef4444';

    const resultEl = document.getElementById('fc-type-result');
    resultEl.style.display = 'block';
    if (isOk) {
      resultEl.innerHTML = `<div class="fc-type-feedback correct">✓ Corretto!</div>`;
    } else {
      resultEl.innerHTML = `<div class="fc-type-feedback wrong">✗ Risposta: <strong>${correct}</strong></div>`;
    }

    if (card.example_it) {
      const exEl = document.getElementById('fc-type-example');
      exEl.style.display = 'block';
      exEl.innerHTML = `<em>${card.example_it}</em> <span class="text-muted">— ${card.example_es||''}</span>`;
    }

    try {
      await API.post(`/flashcards/${card.id}/review`, { quality });
      fcState.reviewed++;
      if (isOk) fcState.correct++;
    } catch(e) { toast('Errore nel salvataggio', 'error'); }

    document.getElementById('fc-type-check').style.display = 'none';
    const nextBtn = document.getElementById('fc-type-next');
    nextBtn.style.display = 'inline-flex';
    document.getElementById('fc-key-hint').textContent = '→ tasto destro per avanzare';
    document.getElementById('fc-key-hint').style.display = 'block';

    // ArrowRight to advance — setTimeout prevents current Enter from immediately firing
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        document.removeEventListener('keydown', onKey);
        goNext();
      }
    };
    setTimeout(() => document.addEventListener('keydown', onKey), 50);
  }

  document.getElementById('fc-type-check').addEventListener('click', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });

  document.getElementById('fc-type-skip').addEventListener('click', async () => {
    await API.post(`/flashcards/${card.id}/review`, { quality: 1 }).catch(()=>{});
    fcState.index++;
    renderFlashcard(container);
  });

  document.getElementById('fc-type-next').addEventListener('click', goNext);
}

function showWordListView(container, words) {
  container.innerHTML = `
    <div class="mb-3 flex gap-2">
      <input type="search" id="word-search" placeholder="Cerca parola..." style="max-width:300px">
    </div>
    <div class="word-list" id="word-list">
      ${words.map(w => wordItemHTML(w)).join('')}
    </div>`;

  document.getElementById('word-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.word-item').forEach(el => {
      el.style.display = (el.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  });
}

function wordItemHTML(w) {
  const reps = w.repetitions || 0;
  const masteryClass = reps === 0 ? 'new' : reps < 3 ? 'learning' : 'learned';
  return `<div class="word-item" data-id="${w.id}">
    <div class="word-mastery ${masteryClass}"></div>
    <div class="word-it">${w.italian}</div>
    <div class="word-es">${w.spanish}</div>
  </div>`;
}

function showAddCardModal() {
  showModal('Nuova flashcard', `
    <div class="form-group"><label class="form-label">Fronte (italiano)</label><input id="fc-front" placeholder="es. andare"></div>
    <div class="form-group"><label class="form-label">Retro (spagnolo)</label><input id="fc-back" placeholder="es. ir"></div>
  `, [
    { label:'Annulla', action:'close', cls:'btn-outline' },
    { label:'Crea scheda', action: async () => {
      const front = document.getElementById('fc-front').value.trim();
      const back = document.getElementById('fc-back').value.trim();
      if (!front || !back) { toast('Compila entrambi i campi', 'error'); return; }
      await API.post('/flashcards', { front, back });
      toast('Scheda creata');
      closeModal();
      navigate('flashcards');
    }, cls:'btn-primary' },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// VOCABULARY
// ══════════════════════════════════════════════════════════════════════════════
async function renderVocabulary(el) {
  const categories = await API.get('/vocabulary/categories');

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Vocabolario</div>
        <div class="section-sub">${categories.length} categorie · ${categories.reduce((s,c)=>s+c.word_count,0)} parole</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" id="add-word-btn">+ Aggiungi parola</button>
        <button class="btn btn-outline btn-sm" id="add-cat-btn">+ Categoria</button>
      </div>
    </div>

    <div class="mb-4">
      <input type="search" id="cat-search" placeholder="Cerca categoria..." style="max-width:320px">
    </div>

    <div class="grid-3 category-cards-grid" id="cat-grid">
      ${categories.map(c => categoryCardHTML(c)).join('')}
    </div>

  `;

  el.querySelector('#cat-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    el.querySelectorAll('.category-card').forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  el.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => openCategory(el, parseInt(card.dataset.id)));
  });

  el.querySelector('#add-word-btn').addEventListener('click', () => showAddWordModal(categories));
  el.querySelector('#add-cat-btn').addEventListener('click', showAddCategoryModal);
}

function categoryCardHTML(c) {
  const pct = c.word_count > 0 ? Math.round((c.learned_count / c.word_count) * 100) : 0;
  const acc = c.accuracy ? Math.round(c.accuracy * 100) : null;
  return `
    <div class="category-card" data-id="${c.id}">
      <div class="category-card-top">
        <span class="category-icon">${c.icon}</span>
        ${acc !== null ? `<span class="badge badge-${acc>=80?'green':acc>=60?'blue':'red'}">${acc}%</span>` : ''}
      </div>
      <div class="category-name">${c.name}</div>
      <div class="category-count">${c.word_count} parole · ${c.learned_count||0} imparate</div>
      ${progressBar(pct)}
      <div class="category-progress-text">
        <span>${pct}% dominato</span>
        ${c.next_review ? `<span>pross. ripasso ${fmt.interval(Math.max(0,(c.next_review-Date.now()/1000)))}</span>` : ''}
      </div>
    </div>`;
}

async function openCategory(el, catId) {
  showModal('Caricamento...', `<div class="loading"><div class="spinner"></div></div>`, []);
  const modal = document.querySelector('#active-modal .modal');
  if (modal) modal.style.maxWidth = '680px';

  const [data, cats] = await Promise.all([
    API.get(`/vocabulary/words?category=${catId}&limit=200`),
    API.get('/vocabulary/categories'),
  ]);
  const { words } = data;
  const cat = cats.find(c => c.id === catId);

  const bodyHTML = `
    <div style="margin-bottom:12px">
      <input type="search" id="cat-word-filter" placeholder="Filtra parole..." style="width:100%">
    </div>
    <div class="word-list" id="cat-word-list" style="max-height:55dvh;overflow-y:auto">
      ${words.map(w => wordItemHTML(w)).join('')}
    </div>`;

  closeModal();
  showModal(`${cat?.icon||'📚'} ${cat?.name||'Categoria'} · ${words.length} parole`, bodyHTML, [
    { label: '🃏 Classico', cls: 'btn-outline', action: () => {
      fcState.typingMode = false;
      fcState.pendingCategoryId = catId;
      closeModal();
      navigate('flashcards');
    }},
    { label: '✍️ Scrittura', cls: 'btn-primary', action: () => {
      fcState.typingMode = true;
      fcState.pendingCategoryId = catId;
      closeModal();
      navigate('flashcards');
    }},
  ]);

  const newModal = document.querySelector('#active-modal .modal');
  if (newModal) newModal.style.maxWidth = '680px';

  document.getElementById('cat-word-filter')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#cat-word-list .word-item').forEach(item => {
      item.style.display = !q || item.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.querySelectorAll('#cat-word-list .word-item').forEach(item => {
    item.addEventListener('click', () => showWordDetail(parseInt(item.dataset.id)));
  });
}

async function showWordDetail(id) {
  const w = await API.get(`/vocabulary/words/${id}`);
  const collocs = (() => { try { return JSON.parse(w.collocations||'[]'); } catch { return []; } })();
  showModal(w.italian, `
    <div class="mb-3">
      <div class="flex gap-2 flex-wrap mb-2">
        ${w.word_type ? `<span class="badge badge-gray">${w.word_type}</span>` : ''}
        ${w.register && w.register!=='neutral' ? `<span class="badge badge-orange">${w.register}</span>` : ''}
      </div>
      <div class="text-sm text-muted mb-1">${w.article||''} <strong style="font-size:1.1rem">${w.italian}</strong> ${w.plural?'— pl: '+w.plural:''}</div>
      <div class="text-accent font-bold" style="font-size:1.2rem">${w.spanish}</div>
    </div>
    ${w.italian_definition ? `<div class="mb-3 text-sm text-muted"><em>${w.italian_definition}</em></div>` : ''}
    ${w.example_it ? `
      <div class="mb-3 bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <div class="italic">"${w.example_it}"</div>
        <div class="text-muted mt-1">${w.example_es||''}</div>
      </div>` : ''}
    ${collocs.length ? `<div class="mb-3"><div class="text-xs font-medium text-muted mb-2 uppercase tracking-wide">Colocaciones</div>${collocs.map(c=>`<span class="tag">${c}</span> `).join('')}</div>` : ''}
    ${w.notes ? `<div class="alert alert-info mt-2 text-xs">${w.notes}</div>` : ''}
    ${w.false_friend_note ? `<div class="alert alert-warn mt-2 text-xs">⚠️ <strong>Falso amico:</strong> ${w.false_friend_note}</div>` : ''}
  `, [
    { label:'Chiudi', action:'close', cls:'btn-outline' },
  ]);
}

function showAddWordModal(categories) {
  showModal('Aggiungi parola', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Italiano</label><input id="w-it" placeholder="es. andare"></div>
      <div class="form-group"><label class="form-label">Spagnolo</label><input id="w-es" placeholder="es. ir"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Categoria</label>
        <select id="w-cat">${categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Livello QCER</label>
        <select id="w-lv"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Esempio in italiano</label><input id="w-ex-it" placeholder="Vado a Roma."></div>
    <div class="form-group"><label class="form-label">Traduzione dell'esempio</label><input id="w-ex-es" placeholder="Voy a Roma."></div>
    <div class="form-group"><label class="form-label">Note</label><input id="w-notes" placeholder="Osservazioni opzionali"></div>
  `, [
    { label:'Annulla', action:'close', cls:'btn-outline' },
    { label:'Aggiungi', action: async () => {
      const italian = document.getElementById('w-it').value.trim();
      const spanish = document.getElementById('w-es').value.trim();
      if (!italian || !spanish) { toast('Italiano e spagnolo sono obbligatori', 'error'); return; }
      await API.post('/vocabulary/words', {
        italian, spanish,
        category_id: parseInt(document.getElementById('w-cat').value),
        cefr_level: document.getElementById('w-lv').value,
        example_it: document.getElementById('w-ex-it').value,
        example_es: document.getElementById('w-ex-es').value,
        notes: document.getElementById('w-notes').value,
      });
      toast('Parola aggiunta con flashcard');
      closeModal();
      navigate('vocabulary');
    }, cls:'btn-primary' },
  ]);
}

function showAddCategoryModal() {
  showModal('Nuova categoria', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nome</label><input id="cat-name" placeholder="Viaggi"></div>
      <div class="form-group"><label class="form-label">Emoji</label><input id="cat-icon" placeholder="✈️" style="max-width:80px"></div>
    </div>
  `, [
    { label:'Annulla', action:'close', cls:'btn-outline' },
    { label:'Crea', action: async () => {
      const name = document.getElementById('cat-name').value.trim();
      const icon = document.getElementById('cat-icon').value.trim() || '📚';
      if (!name) { toast('Il nome è obbligatorio', 'error'); return; }
      await API.post('/vocabulary/categories', { name, icon });
      toast('Categoria creata');
      closeModal();
      navigate('vocabulary');
    }, cls:'btn-primary' },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// CONJUGATION
// ══════════════════════════════════════════════════════════════════════════════
const ALL_TENSES = ['presente','passato_prossimo','imperfetto','futuro','condizionale'];
const TENSE_LABELS = {
  presente: 'Presente', passato_prossimo: 'Passato', imperfetto: 'Imperfetto',
  futuro: 'Futuro', condizionale: 'Condizionale', congiuntivo: 'Congiuntivo',
};
function expandForms(form) {
  const norm = s => s.normalize('NFC').toLowerCase().trim();
  if (!form) return [''];
  const f = norm(form);
  const esserePfx = ['sono ','sei ','è ','siamo ','siete '];
  for (const pfx of esserePfx) {
    if (f.startsWith(pfx)) {
      const rest = f.slice(pfx.length);
      if (rest.endsWith('o')) return [f, pfx + rest.slice(0,-1) + 'a', pfx + rest.slice(0,-1) + 'o/a'];
      if (rest.endsWith('i')) return [f, pfx + rest.slice(0,-1) + 'e', pfx + rest.slice(0,-1) + 'i/e'];
    }
  }
  return [f];
}

const TENSE_HINTS = {
  presente: 'Presente Indicativo — Cosa fa adesso?',
  imperfetto: 'Imperfetto — Azione passata abituale o in corso',
  futuro: 'Futuro Semplice — Cosa farà?',
  condizionale: 'Condizionale Presente — Cosa farebbe? (vorrei...)',
  congiuntivo: 'Congiuntivo Presente — Penso che... Spero che...',
  passato_prossimo: 'Passato Prossimo — Azione passata completata',
};
let conjState = { answered: false, streak: 0, correct: 0, total: 0, selectedTenses: [...ALL_TENSES] };
const DRILL_TENSES = ['presente','passato_prossimo','imperfetto','futuro','condizionale','congiuntivo'];
let drillState = { phase:'pick', verb:null, translation:'', conjugations:{}, tenses:[...DRILL_TENSES], tenseIndex:0, highWater:-1, mistakes:[], reviewIndex:0, score:{correct:0,total:0}, tenseScores:[], verbList:[] };

async function renderConjugation(el) {
  const verbs = await API.get('/conjugation/verbs');

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Coniugazioni</div>
        <div class="section-sub">${verbs.length} verbi disponibili</div>
      </div>
      <div class="flex items-center gap-3">
        <div class="stat-tile" style="padding:8px 16px;min-width:0">
          <div class="stat-tile-label">Serie</div>
          <div class="stat-tile-value" id="conj-streak">0</div>
        </div>
        <div class="stat-tile" style="padding:8px 16px;min-width:0">
          <div class="stat-tile-label">Precisione</div>
          <div class="stat-tile-value" id="conj-acc">—</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="practice">Pratica</button>
      <button class="tab-btn" data-tab="drill">Per verbo</button>
      <button class="tab-btn" data-tab="reference">Riferimento</button>
      <button class="tab-btn" data-tab="scores">Punteggi</button>
    </div>

    <div id="conj-pills-card" class="card mb-3" style="padding:12px 16px">
      <div class="text-sm font-medium mb-2" style="color:var(--text-muted)">Tempi da praticare:</div>
      <div class="flex flex-wrap gap-2" id="tense-pills">
        ${ALL_TENSES.map(t => `
          <button class="tense-pill ${conjState.selectedTenses.includes(t)?'active':''}" data-tense="${t}">
            ${TENSE_LABELS[t]}
          </button>`).join('')}
      </div>
    </div>
    <div id="conj-tab-content">
      <div id="conj-exercise-area"></div>
    </div>
  `;

  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const pillsCard = document.getElementById('conj-pills-card');
      if (tab === 'reference') {
        pillsCard.style.display = 'none';
        renderConjugationReference(el, verbs);
      } else if (tab === 'drill') {
        pillsCard.style.display = 'none';
        drillState = { phase:'pick', verb:null, translation:'', conjugations:{}, tenses:[...DRILL_TENSES], tenseIndex:0, highWater:-1, mistakes:[], reviewIndex:0, score:{correct:0,total:0}, tenseScores:[], verbList:verbs };
        renderDrillTab(document.getElementById('conj-tab-content'), verbs);
      } else if (tab === 'scores') {
        pillsCard.style.display = 'none';
        renderVerbScores(document.getElementById('conj-tab-content'));
      } else {
        pillsCard.style.display = '';
        loadConjugationExercise(el);
      }
    });
  });

  el.querySelectorAll('.tense-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const t = pill.dataset.tense;
      if (conjState.selectedTenses.includes(t)) {
        if (conjState.selectedTenses.length === 1) return;
        conjState.selectedTenses = conjState.selectedTenses.filter(x => x !== t);
        pill.classList.remove('active');
      } else {
        conjState.selectedTenses.push(t);
        pill.classList.add('active');
      }
    });
  });

  loadConjugationExercise(el);
}

async function loadConjugationExercise(el) {
  const area = document.getElementById('conj-exercise-area');
  if (!area) return;
  area.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const tenses = conjState.selectedTenses.join(',');
    const ex = await API.get(`/conjugation/exercise?tenses=${tenses}`);
    conjState.answered = false;
    renderExerciseUI(area, ex);
  } catch(e) {
    area.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function renderExerciseUI(area, ex) {
  const persons = ['io','tu','lui','noi','voi','loro'];
  area.innerHTML = `
    <div class="conj-exercise">
      <div class="conj-prompt">Coniuga al <strong>${ex.tense_display}</strong></div>
      <div class="conj-verb">${ex.verb}</div>
      <div class="conj-tense">${TENSE_HINTS[ex.tense] || ex.tense_display}</div>

      <div class="conj-full-grid" id="conj-grid">
        ${persons.map(p => `
          <div class="conj-row" data-person="${p}">
            <span class="conj-pronoun">${p}</span>
            <input class="conj-input conj-input-person" data-person="${p}"
              placeholder="..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <span class="conj-row-icon" id="icon-${p}"></span>
          </div>`).join('')}
      </div>

      <div class="flex gap-2 justify-center mt-4" id="conj-btn-row">
        <button class="btn btn-outline" id="conj-skip">Salta</button>
        <button class="btn btn-primary" id="conj-check">Controlla</button>
        <button class="btn btn-outline" id="conj-retry" style="display:none">Riprova</button>
        <button class="btn btn-outline" id="conj-show" style="display:none">Mostra le risposte</button>
        <button class="btn btn-primary" id="conj-next" style="display:none">Avanti →</button>
      </div>
    </div>`;

  const inputs = area.querySelectorAll('.conj-input-person');
  inputs[0].focus();

  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (i < inputs.length - 1) inputs[i+1].focus();
        else checkAnswers();
      }
    });
  });

  document.getElementById('conj-check').addEventListener('click', checkAnswers);
  document.getElementById('conj-skip').addEventListener('click', () => {
    conjState.streak = 0;
    loadConjugationExercise(document.getElementById('app-content'));
  });
  let arrowListener = null;

  function goNext() {
    if (arrowListener) { document.removeEventListener('keydown', arrowListener); arrowListener = null; }
    loadConjugationExercise(document.getElementById('app-content'));
  }

  document.getElementById('conj-next').addEventListener('click', goNext);
  document.getElementById('conj-retry').addEventListener('click', () => {
    if (arrowListener) { document.removeEventListener('keydown', arrowListener); arrowListener = null; }
    inputs.forEach(inp => {
      inp.disabled = false;
      inp.value = '';
      inp.style.borderColor = '';
    });
    persons.forEach(p => { document.getElementById('icon-' + p).textContent = ''; });
    document.getElementById('conj-check').style.display = 'inline-flex';
    document.getElementById('conj-retry').style.display = 'none';
    document.getElementById('conj-show').style.display = 'none';
    document.getElementById('conj-next').style.display = 'none';
    conjState.answered = false;
    inputs[0].focus();
  });
  document.getElementById('conj-show').addEventListener('click', () => {
    inputs.forEach(inp => {
      const person = inp.dataset.person;
      const correct = (ex.all_forms || {})[person] || '';
      const isOk = inp.value.trim().toLowerCase() === correct.toLowerCase();
      if (!isOk) {
        inp.value = correct;
        inp.style.borderColor = '#f59e0b';
        document.getElementById('icon-' + person).textContent = '';
      }
    });
    document.getElementById('conj-show').style.display = 'none';
  });

  async function checkAnswers() {
    if (conjState.answered) return;
    conjState.answered = true;
    let correctCount = 0;

    for (const inp of inputs) {
      const person = inp.dataset.person;
      const answer = inp.value.trim();
      const correct = (ex.all_forms || {})[person] || '';
      const isOk = answer.toLowerCase() === correct.toLowerCase();
      if (isOk) correctCount++;

      inp.disabled = true;
      inp.style.borderColor = isOk ? 'var(--accent)' : '#ef4444';
      const icon = document.getElementById('icon-' + person);
      icon.textContent = isOk ? '✓' : '✗';
      icon.style.color = isOk ? 'var(--accent)' : '#ef4444';

      await API.post('/conjugation/check', { verb: ex.verb, tense: ex.tense, person, answer: answer || '__skip__' });
    }

    conjState.total += persons.length;
    conjState.correct += correctCount;
    if (correctCount === persons.length) conjState.streak++;
    else conjState.streak = 0;

    const acc = Math.round((conjState.correct / conjState.total) * 100);
    const streakEl = document.getElementById('conj-streak');
    const accEl = document.getElementById('conj-acc');
    if (streakEl) streakEl.textContent = conjState.streak;
    if (accEl) accEl.textContent = acc + '%';

    document.getElementById('conj-check').style.display = 'none';
    document.getElementById('conj-skip').style.display = 'none';
    document.getElementById('conj-retry').style.display = 'inline-flex';
    if (correctCount < persons.length) document.getElementById('conj-show').style.display = 'inline-flex';
    const nextBtn = document.getElementById('conj-next');
    nextBtn.style.display = 'inline-flex';
    nextBtn.focus();
    nextBtn.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); } });
  }
}

// ── Verb drill mode ──────────────────────────────────────────────────────────
function renderDrillTab(container, verbList) {
  if (verbList) drillState.verbList = verbList;
  const area = document.getElementById('conj-exercise-area');

  if (drillState.phase === 'pick') {
    area.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    (async () => {
    let verbsData;
    try { verbsData = await API.get('/conjugation/verbs-with-translations'); }
    catch(e) { area.innerHTML = `<div class="alert alert-error">Errore nel caricamento dei verbi</div>`; return; }

    let selectedVerb = null;

    const render = (filter = '') => {
      const q = filter.toLowerCase();
      const filtered = q ? verbsData.filter(({verb, translation}) => verb.includes(q) || translation.toLowerCase().includes(q)) : verbsData;
      area.innerHTML = `
        <div class="card" style="padding:16px 20px">
          <div style="font-weight:600;font-size:1.05rem;margin-bottom:10px">Scegli un verbo</div>
          <input id="drill-search" class="input" placeholder="Cerca verbo o traduzione..." value="${filter}" style="margin-bottom:8px">
          <div id="drill-verb-list" style="height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
            ${filtered.map(({verb, translation}) => `
              <div class="drill-verb-row ${selectedVerb===verb?'drill-verb-selected':''}" data-verb="${verb}"
                style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border-subtle)">
                <span style="font-weight:500">${verb}</span>
                <span style="color:var(--text-muted);font-size:0.82rem">${translation}</span>
              </div>`).join('')}
            ${filtered.length === 0 ? `<div style="padding:16px;text-align:center;color:var(--text-muted)">Nessun risultato</div>` : ''}
          </div>
          ${selectedVerb ? `<div style="margin:8px 0;font-size:0.9rem;color:var(--accent);font-weight:600">✓ ${selectedVerb}</div>` : `<div style="height:28px;margin:4px 0"></div>`}
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Tempi:</div>
          <div class="flex flex-wrap gap-2 mb-3" id="drill-tense-picks">
            ${DRILL_TENSES.map(t => `<button class="tense-pill ${drillState.tenses.includes(t)?'active':''}" data-t="${t}">${TENSE_LABELS[t]}</button>`).join('')}
          </div>
          <button class="btn btn-primary btn-block" id="drill-start" ${selectedVerb?'':'disabled'} style="margin-top:8px">Inizia →</button>
        </div>
      `;

      document.getElementById('drill-search').focus();
      document.getElementById('drill-search').setSelectionRange(filter.length, filter.length);

      document.getElementById('drill-search').addEventListener('input', e => render(e.target.value));

      document.getElementById('drill-verb-list').querySelectorAll('.drill-verb-row').forEach(row => {
        row.addEventListener('click', () => { selectedVerb = row.dataset.verb; render(document.getElementById('drill-search').value); });
      });

      document.getElementById('drill-tense-picks').querySelectorAll('.tense-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const t = pill.dataset.t;
          if (drillState.tenses.includes(t)) {
            if (drillState.tenses.length === 1) return;
            drillState.tenses = drillState.tenses.filter(x => x !== t);
          } else {
            drillState.tenses.push(t);
          }
          render(document.getElementById('drill-search').value);
        });
      });

      const startBtn = document.getElementById('drill-start');
      if (startBtn && !startBtn.disabled) {
        startBtn.addEventListener('click', async () => {
          try {
            const data = await API.get(`/conjugation/verb-data/${selectedVerb}`);
            drillState.verb = selectedVerb;
            drillState.translation = data.translation;
            drillState.conjugations = data.conjugations;
            drillState.tenseIndex = 0;
            drillState.highWater = -1;
            drillState.mistakes = [];
            drillState.score = { correct: 0, total: 0 };
            drillState.tenseScores = [];
            drillState.phase = 'practice';
            renderDrillTense(area);
          } catch(e) { toast('Errore nel caricamento del verbo', 'error'); }
        });
      }
    };

    render();
    })();
    return;
  }

  if (drillState.phase === 'practice') { renderDrillTense(area); return; }
  if (drillState.phase === 'review')   { renderDrillReview(area); return; }
  if (drillState.phase === 'done')     { renderDrillDone(area); return; }
}

function renderDrillTense(area) {
  const activeTenses = drillState.tenses.filter(t => drillState.conjugations[t]);
  if (drillState.tenseIndex >= activeTenses.length) {
    if (drillState.mistakes.length > 0) {
      drillState.phase = 'review';
      drillState.reviewIndex = 0;
      renderDrillReview(area);
    } else {
      drillState.phase = 'done';
      renderDrillDone(area);
    }
    return;
  }

  const tense = activeTenses[drillState.tenseIndex];
  const forms = drillState.conjugations[tense];
  const progress = `${drillState.tenseIndex + 1} / ${activeTenses.length}`;
  const alreadyScored = drillState.tenseScores.some(s => s.tense === tense);
  const canGoBack = drillState.tenseIndex > 0;
  const canGoFwd = drillState.highWater >= drillState.tenseIndex;

  area.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" id="drill-prev" class="btn btn-outline" style="padding:2px 10px;font-size:0.9rem;${canGoBack?'':'visibility:hidden'}">←</button>
          <div style="font-size:0.8rem;color:var(--text-muted)">${progress} — ${drillState.verb} (${drillState.translation})</div>
          <button type="button" id="drill-nav-fwd" class="btn btn-outline" style="padding:2px 10px;font-size:0.9rem;${canGoFwd?'':'visibility:hidden'}">→</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)" id="drill-score-display">✓ ${drillState.score.correct}/${drillState.score.total}</div>
      </div>
      <div style="font-weight:700;font-size:1.15rem;margin-bottom:4px">${TENSE_LABELS[tense]}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">${TENSE_HINTS[tense]||''}</div>
      <div id="drill-forms">
        ${['io','tu','lui','noi','voi','loro'].map(person => {
          const label = person === 'lui' ? 'lui/lei' : person;
          return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:52px;font-size:0.9rem;color:var(--text-muted);flex-shrink:0">${label}</div>
            <input class="input drill-input" data-person="${person}"
              placeholder="${label}..."
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              style="flex:1;padding:8px 12px">
            <div class="drill-result" data-person="${person}" style="width:28px;text-align:center;font-size:1.1rem"></div>
          </div>
        `; }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap" id="drill-btns">
        <button type="button" class="btn btn-primary" id="drill-check">Controlla</button>
        <button type="button" class="btn btn-outline" id="drill-show" style="display:none">Mostra risposte</button>
        <button type="button" class="btn btn-outline" id="drill-retry" style="display:none">Riprova</button>
        <button type="button" class="btn btn-primary" id="drill-next" style="display:none">Avanti →</button>
      </div>
    </div>
  `;

  const inputs = [...area.querySelectorAll('.drill-input')];
  inputs[0].focus();

  let isLocked = alreadyScored;
  let pendingKey = null;

  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); i < inputs.length - 1 ? inputs[i+1].focus() : doCheck(); }
    });
  });

  function doCheck() {
    if (area.querySelector('#drill-next').style.display !== 'none') return;
    let correct = 0;
    inputs.forEach(inp => {
      const person = inp.dataset.person;
      const typed = inp.value.normalize('NFC').toLowerCase().trim();
      const ok = expandForms(forms[person]||'').includes(typed);
      inp.style.borderColor = ok ? 'var(--accent)' : '#ef4444';
      inp.disabled = true;
      area.querySelector(`.drill-result[data-person="${person}"]`).textContent = ok ? '✓' : '✗';
      if (!isLocked) {
        drillState.score.total++;
        if (ok) { drillState.score.correct++; correct++; }
        else { drillState.mistakes.push({ tense, person, correct: forms[person], typed: inp.value }); }
      } else {
        if (ok) correct++;
      }
    });
    if (!isLocked) {
      drillState.tenseScores.push({ tense, correct, total: inputs.length });
      isLocked = true;
    }
    const scoreEl = area.querySelector('#drill-score-display');
    if (scoreEl) scoreEl.textContent = `✓ ${drillState.score.correct}/${drillState.score.total}`;

    document.getElementById('drill-check').style.display = 'none';
    if (correct < inputs.length) {
      document.getElementById('drill-show').style.display = 'inline-flex';
      document.getElementById('drill-retry').style.display = 'inline-flex';
    }
    document.getElementById('drill-next').style.display = 'inline-flex';

    pendingKey = e => { if (e.key === 'ArrowRight' || e.key === 'Enter') { document.removeEventListener('keydown', pendingKey); pendingKey = null; goNext(); } };
    setTimeout(() => document.addEventListener('keydown', pendingKey), 50);
  }

  function goNext() {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    drillState.highWater = Math.max(drillState.highWater, drillState.tenseIndex);
    drillState.tenseIndex++;
    renderDrillTense(area);
  }

  function goPrev() {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    drillState.tenseIndex--;
    renderDrillTense(area);
  }

  document.getElementById('drill-check').addEventListener('click', doCheck);
  document.getElementById('drill-show').addEventListener('click', () => {
    inputs.forEach(inp => {
      const person = inp.dataset.person;
      const resultEl = area.querySelector(`.drill-result[data-person="${person}"]`);
      if (inp.disabled && resultEl && resultEl.textContent === '✗') {
        inp.value = forms[person] || '';
        inp.style.borderColor = '#f59e0b';
        resultEl.textContent = '→';
      }
    });
  });
  document.getElementById('drill-retry').addEventListener('click', () => {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    inputs.forEach(inp => {
      inp.value = '';
      inp.style.borderColor = '';
      inp.disabled = false;
      area.querySelector(`.drill-result[data-person="${inp.dataset.person}"]`).textContent = '';
    });
    document.getElementById('drill-check').style.display = 'inline-flex';
    document.getElementById('drill-show').style.display = 'none';
    document.getElementById('drill-retry').style.display = 'none';
    document.getElementById('drill-next').style.display = 'none';
    inputs[0].focus();
  });
  document.getElementById('drill-next').addEventListener('click', goNext);
  if (canGoBack) document.getElementById('drill-prev').addEventListener('click', goPrev);
  if (canGoFwd) document.getElementById('drill-nav-fwd').addEventListener('click', goNext);
}

function renderDrillReview(area) {
  if (drillState.reviewIndex >= drillState.mistakes.length) {
    drillState.phase = 'done';
    renderDrillDone(area);
    return;
  }

  const mistake = drillState.mistakes[drillState.reviewIndex];
  const total = drillState.mistakes.length;
  area.innerHTML = `
    <div class="card">
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Ripasso errori — ${drillState.reviewIndex+1}/${total}</div>
      <div style="font-weight:700;font-size:1.1rem;margin-bottom:2px">${drillState.verb} — ${TENSE_LABELS[mistake.tense]}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Soggetto: <strong>${mistake.person}</strong></div>
      <div style="margin-bottom:12px">
        <input id="drill-retry-input" class="input" placeholder="${mistake.person}..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          style="width:100%;font-size:1.1rem">
      </div>
      <div id="drill-retry-result" style="min-height:32px;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-primary" id="drill-retry-check">Controlla</button>
        <button type="button" class="btn btn-primary" id="drill-retry-next" style="display:none">Avanti →</button>
      </div>
    </div>
  `;

  const inp = document.getElementById('drill-retry-input');
  inp.focus();

  function doRetryCheck() {
    const typed = inp.value.normalize('NFC').toLowerCase().trim();
    const expected = expandForms(mistake.correct||'')[0];
    const ok = expandForms(mistake.correct||'').includes(typed);
    inp.disabled = true;
    inp.style.borderColor = ok ? 'var(--accent)' : '#ef4444';
    const res = document.getElementById('drill-retry-result');
    if (ok) res.innerHTML = `<span style="color:var(--accent);font-weight:600">✓ Corretto!</span>`;
    else res.innerHTML = `<span style="color:#ef4444">✗ Risposta: <strong>${mistake.correct}</strong></span>`;
    document.getElementById('drill-retry-check').style.display = 'none';
    document.getElementById('drill-retry-next').style.display = 'inline-flex';
    const onKey = e => { if (e.key === 'ArrowRight'||e.key==='Enter') { document.removeEventListener('keydown',onKey); goRetryNext(); } };
    setTimeout(() => document.addEventListener('keydown', onKey), 50);
  }

  function goRetryNext() {
    drillState.reviewIndex++;
    renderDrillReview(area);
  }

  inp.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); doRetryCheck(); } });
  document.getElementById('drill-retry-check').addEventListener('click', doRetryCheck);
  document.getElementById('drill-retry-next').addEventListener('click', goRetryNext);
}

function renderDrillDone(area) {
  const { correct, total } = drillState.score;
  const pct = total > 0 ? Math.round(correct/total*100) : 0;
  const emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪';
  if (drillState.tenseScores.length > 0) {
    API.post('/verb-scores', { verb: drillState.verb, tenseScores: drillState.tenseScores }).catch(() => {});
  }
  area.innerHTML = `
    <div class="card" style="text-align:center;padding:32px 24px">
      <div style="font-size:2.5rem;margin-bottom:8px">${emoji}</div>
      <div style="font-size:1.3rem;font-weight:700;margin-bottom:4px">${drillState.verb}</div>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:20px">${drillState.translation}</div>
      <div style="font-size:2rem;font-weight:700;color:${pct>=80?'var(--accent)':'#f59e0b'};margin-bottom:4px">${pct}%</div>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:24px">${correct} / ${total} corrette</div>
      ${drillState.mistakes.length > 0 ? `
        <div style="text-align:left;margin-bottom:20px">
          <div style="font-weight:600;margin-bottom:8px;font-size:0.9rem">Errori:</div>
          ${[...new Map(drillState.mistakes.map(m=>[`${m.tense}-${m.person}`,m])).values()].map(m => `
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;padding:4px 8px;background:var(--bg-secondary);border-radius:6px">
              <span style="color:var(--text-muted)">${TENSE_LABELS[m.tense]} — ${m.person}</span>
              <span style="font-weight:600">${m.correct}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-outline" id="drill-again">Ripeti verbo</button>
        <button class="btn btn-primary" id="drill-new">Nuovo verbo</button>
      </div>
    </div>
  `;

  document.getElementById('drill-again').addEventListener('click', () => {
    drillState.tenseIndex = 0; drillState.highWater = -1; drillState.mistakes = []; drillState.score = {correct:0,total:0}; drillState.tenseScores = []; drillState.phase = 'practice';
    renderDrillTense(area);
  });
  document.getElementById('drill-new').addEventListener('click', () => {
    drillState.phase = 'pick';
    renderDrillTab(null, drillState.verbList || []);
  });
}

async function renderVerbScores(area) {
  area.innerHTML = `<div class="loading"><div class="spinner"></div> Caricamento...</div>`;
  const rows = await API.get('/verb-scores').catch(() => []);

  // Aggregate by verb
  const byVerb = {};
  rows.forEach(r => {
    if (!byVerb[r.verb]) byVerb[r.verb] = { bestTotal: 0, xpTotal: 0, tenses: {} };
    byVerb[r.verb].tenses[r.tense] = { best: r.best_correct, xp: r.xp };
    byVerb[r.verb].bestTotal += r.best_correct;
    byVerb[r.verb].xpTotal += r.xp;
  });

  const verbEntries = Object.entries(byVerb).sort((a, b) => b[1].xpTotal - a[1].xpTotal);
  const totalXP = verbEntries.reduce((s, [, v]) => s + v.xpTotal, 0);
  const totalBest = verbEntries.reduce((s, [, v]) => s + v.bestTotal, 0);
  const maxPossibleAll = verbEntries.length * 36;

  if (verbEntries.length === 0) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px 24px">
      <div style="font-size:2.5rem;margin-bottom:12px">📚</div>
      <div style="font-weight:600;font-size:1.1rem;margin-bottom:6px">Nessun verbo praticato ancora</div>
      <div style="color:var(--text-muted);font-size:0.9rem">Completa un esercizio "Per verbo" per iniziare a guadagnare punti</div>
    </div>`;
    return;
  }

  const TENSE_SHORT = { presente:'Pres.', imperfetto:'Imperf.', futuro:'Fut.', condizionale:'Cond.', congiuntivo:'Cong.', passato_prossimo:'Pass.' };

  area.innerHTML = `
    <div class="card mb-3" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:2rem;font-weight:800;color:var(--accent);line-height:1">${totalXP} XP</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">${verbEntries.length} / 100 verbi praticati</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1rem;font-weight:700">${totalBest} / ${maxPossibleAll} pt</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">punteggio massimo raggiunto</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">max 36 pt per verbo (6 tempi × 6 forme)</div>
      </div>
    </div>
    <div id="verb-scores-list">
      ${verbEntries.map(([verb, data]) => {
        const tenseCount = Object.keys(data.tenses).length;
        const maxPossible = tenseCount * 6;
        const pct = maxPossible > 0 ? Math.round(data.bestTotal / maxPossible * 100) : 0;
        const barColor = pct >= 90 ? 'var(--accent)' : pct >= 60 ? '#f59e0b' : '#ef4444';
        return `
        <div class="card mb-2" style="padding:12px 16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
            <div style="font-weight:600">${verb}</div>
            <div style="font-size:0.85rem;font-weight:700;color:var(--accent)">${data.xpTotal} XP</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:0.78rem;color:var(--text-muted)">${Object.entries(data.tenses).map(([t, s]) => `${TENSE_SHORT[t]||t} ${s.best}/6`).join(' · ')}</div>
            <div style="font-size:0.8rem;font-weight:600">${data.bestTotal}/${maxPossible}</div>
          </div>
          <div style="height:7px;background:var(--surface-2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.6s ease"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderConjugationReference(el, verbs) {
  const area = document.getElementById('conj-tab-content');
  area.innerHTML = `
    <div class="card">
      <div class="card-title mb-3">Riferimento verbi</div>
      <div class="flex gap-2 mb-4">
        <select id="ref-verb" style="max-width:200px">
          ${verbs.map(v=>`<option>${v}</option>`).join('')}
        </select>
        <select id="ref-tense" style="max-width:200px">
          ${['presente','imperfetto','futuro','condizionale','congiuntivo','passato_prossimo'].map(t=>`<option value="${t}">${{
            presente:'Presente Indicativo',imperfetto:'Imperfetto',futuro:'Futuro Semplice',
            condizionale:'Condizionale Presente',congiuntivo:'Congiuntivo Presente',passato_prossimo:'Passato Prossimo'
          }[t]||t}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" id="ref-load">Ver</button>
      </div>
      <div id="ref-table"></div>
    </div>`;

  async function loadRef() {
    const verb = document.getElementById('ref-verb').value;
    const tense = document.getElementById('ref-tense').value;
    const ex = await API.get(`/conjugation/exercise`);
    // Get all forms via check endpoint trick — load exercise for that verb/tense
    const tableEl = document.getElementById('ref-table');
    const res = await API.post('/conjugation/check', { verb, tense, person:'io', answer: '__placeholder__' });
    if (res.all_forms) {
      tableEl.innerHTML = `
        <table class="conj-table">
          <tr><th>Persona</th><th>Forma</th></tr>
          ${Object.entries(res.all_forms).map(([p,f])=>`<tr><td style="font-weight:500">${p}</td><td>${f}</td></tr>`).join('')}
        </table>`;
    }
  }

  area.querySelector('#ref-load').addEventListener('click', loadRef);
}

// ══════════════════════════════════════════════════════════════════════════════
// GRAMMAR
// ══════════════════════════════════════════════════════════════════════════════
const GRAMMAR_TOPICS = [
  { id:'articles', title:'Articoli determinativi e indeterminativi', level:'A2', desc:'Il/la/lo/l\'/i/gli/le — un/una/uno/un\'', content: `
    <h3 style="margin-bottom:12px">Articoli determinativi</h3>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Genere/Numero</th><th>Uso</th><th>Esempio</th></tr>
      <tr><td>il</td><td>Masc. sing. — consonante normale</td><td>il libro, il cane</td></tr>
      <tr><td>lo</td><td>Masc. sing. — s+cons., z, gn, ps, x, y</td><td>lo studente, lo zaino</td></tr>
      <tr><td>l'</td><td>Masc./Fem. sing. — vocale</td><td>l'amico, l'amica</td></tr>
      <tr><td>la</td><td>Fem. sing. — consonante</td><td>la casa, la donna</td></tr>
      <tr><td>i</td><td>Masc. plur. — consonante normale</td><td>i libri, i cani</td></tr>
      <tr><td>gli</td><td>Masc. plur. — vocale, s+cons., z...</td><td>gli studenti, gli amici</td></tr>
      <tr><td>le</td><td>Fem. plur.</td><td>le case, le amiche</td></tr>
    </table></div>
    <div class="alert alert-info mt-4">🇪🇸 Differenza rispetto allo spagnolo: l'italiano ha più forme. Inoltre, i possessivi richiedono l'articolo: <strong>il mio libro</strong> (non ~~mio libro~~), tranne al singolare con familiari stretti: <em>mia madre, mio padre, mia sorella</em>.</div>
  `},
  { id:'prepositions', title:'Preposizioni articolate', level:'A2', desc:'del, dello, della, nel, nel...', content: `
    <h3 style="margin-bottom:12px">Preposizioni articolate</h3>
    <p class="text-sm text-muted mb-3">In italiano, le preposizioni semplici si combinano con l'articolo determinativo per formare un'unica parola.</p>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Prep.</th><th>+il</th><th>+lo</th><th>+l'</th><th>+la</th><th>+i</th><th>+gli</th><th>+le</th></tr>
      <tr><td><strong>di</strong></td><td>del</td><td>dello</td><td>dell'</td><td>della</td><td>dei</td><td>degli</td><td>delle</td></tr>
      <tr><td><strong>a</strong></td><td>al</td><td>allo</td><td>all'</td><td>alla</td><td>ai</td><td>agli</td><td>alle</td></tr>
      <tr><td><strong>da</strong></td><td>dal</td><td>dallo</td><td>dall'</td><td>dalla</td><td>dai</td><td>dagli</td><td>dalle</td></tr>
      <tr><td><strong>in</strong></td><td>nel</td><td>nello</td><td>nell'</td><td>nella</td><td>nei</td><td>negli</td><td>nelle</td></tr>
      <tr><td><strong>su</strong></td><td>sul</td><td>sullo</td><td>sull'</td><td>sulla</td><td>sui</td><td>sugli</td><td>sulle</td></tr>
    </table></div>
    <div class="alert alert-warn mt-4">⚠️ In spagnolo esistono solo <strong>del</strong> (de+el) e <strong>al</strong> (a+el). In italiano il sistema è completo per tutte le principali preposizioni.</div>
  `},
  { id:'congiuntivo', title:'Il Congiuntivo', level:'B2', desc:'Penso che... Sebbene... Nonostante...', content: `
    <h3 style="margin-bottom:12px">Il Congiuntivo — la sfida più importante per i madrelingua spagnoli</h3>
    <p class="text-sm mb-3">Il congiuntivo italiano si usa più del subjuntivo spagnolo. Nota i contesti:</p>
    <div class="mb-4">
      <div class="font-medium mb-2">1. Dopo verbi di opinione, sentimento, volontà + <em>che</em></div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        Penso <strong>che sia</strong> giusto. (Credo che sia giusto)<br>
        Spero <strong>che tu venga</strong>. (Spero che tu venga)<br>
        Voglio <strong>che tu stia</strong> bene. (Voglio che tu stia bene)
      </div>
    </div>
    <div class="mb-4">
      <div class="font-medium mb-2">2. Dopo connettivi concessivi e finali</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Sebbene/Benché/Nonostante</strong> sia stanco, continuo. (Benché sia stanco)<br>
        <strong>Affinché</strong> tu capisca... (Perché tu capisca)<br>
        <strong>Prima che</strong> arrivi... (Prima che arrivi)
      </div>
    </div>
    <div class="mb-3">
      <div class="font-medium mb-2">Irregolari essenziali</div>
      <div class="overflow-auto"><table class="conj-table">
        <tr><th>Infinito</th><th>io/tu/lui</th><th>noi</th><th>voi</th><th>loro</th></tr>
        <tr><td>essere</td><td>sia</td><td>siamo</td><td>siate</td><td>siano</td></tr>
        <tr><td>avere</td><td>abbia</td><td>abbiamo</td><td>abbiate</td><td>abbiano</td></tr>
        <tr><td>fare</td><td>faccia</td><td>facciamo</td><td>facciate</td><td>facciano</td></tr>
        <tr><td>andare</td><td>vada</td><td>andiamo</td><td>andiate</td><td>vadano</td></tr>
        <tr><td>venire</td><td>venga</td><td>veniamo</td><td>veniate</td><td>vengano</td></tr>
        <tr><td>potere</td><td>possa</td><td>possiamo</td><td>possiate</td><td>possano</td></tr>
        <tr><td>volere</td><td>voglia</td><td>vogliamo</td><td>vogliate</td><td>vogliano</td></tr>
        <tr><td>sapere</td><td>sappia</td><td>sappiamo</td><td>sappiate</td><td>sappiano</td></tr>
      </table></div>
    </div>
  `},
  { id:'periodo_ipotetico', title:'Periodo Ipotetico', level:'B2', desc:'Se + congiuntivo/condizionale', content: `
    <h3 style="margin-bottom:12px">I tre tipi di periodo ipotetico in italiano</h3>
    <div class="mb-4">
      <div class="badge badge-green mb-2">Tipo I — Reale/Possibile</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + presente → futuro (o presente)</strong><br>
        <em>Se studi, <strong>passerai</strong> l'esame.</em> (Se studi, passerai l'esame)
      </div>
    </div>
    <div class="mb-4">
      <div class="badge badge-blue mb-2">Tipo II — Improbabile</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + congiuntivo imperfetto → condizionale presente</strong><br>
        <em>Se <strong>studiassi</strong>, <strong>passerei</strong> l'esame.</em> (Se studiassi, passerei l'esame)
      </div>
    </div>
    <div class="mb-4">
      <div class="badge badge-red mb-2">Tipo III — Impossibile (passato)</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + congiuntivo trapassato → condizionale passato</strong><br>
        <em>Se <strong>avessi studiato</strong>, <strong>avrei passato</strong> l'esame.</em> (Se avessi studiato, avrei passato l'esame)
      </div>
    </div>
    <div class="alert alert-warn">⚠️ Misto (molto italiano): <em>Se avessi studiato, <strong>passeresti</strong> l'esame adesso.</em> — Cond. passato + Cond. presente</div>
  `},
  { id:'ne_ci', title:'Le particelle NE e CI', level:'B1', desc:'Ne ho tre. Ci penso. Non ci credo.', content: `
    <h3 style="margin-bottom:12px">NE e CI — due particelle senza equivalente diretto in spagnolo</h3>
    <div class="mb-4">
      <div class="font-medium mb-2">NE — partitivo e di riferimento</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <em>Quanti libri hai? <strong>Ne</strong> ho tre.</em> (Quanti libri hai? Ne ho tre)<br>
        <em>Parliamo di politica? Preferirei non <strong>parlarne</strong>.</em> (Non voglio parlare di questo)<br>
        <em><strong>Ne</strong> ho abbastanza!</em> (Ne ho abbastanza / Sono stufo!)
      </div>
    </div>
    <div class="mb-4">
      <div class="font-medium mb-2">CI — locativo e di riferimento a un'idea</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <em>Vai a Roma? Sì, <strong>ci</strong> vado domani.</em> (Sì, vado lì domani)<br>
        <em><strong>Ci</strong> penso.</em> (Ci penso su)<br>
        <em>Non <strong>ci</strong> credo.</em> (Non ci credo)<br>
        <em><strong>Ce la</strong> fai?</em> (Riesci? / Ce la fai?)
      </div>
    </div>
  `},
  { id:'false_friends', title:'Falsi Amici', level:'B1', desc:'Burro, caldo, camera, parente...', content: `
    <h3 style="margin-bottom:12px">I falsi amici più pericolosi per i madrelingua spagnoli</h3>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Italiano</th><th>Sembra significare...</th><th>Significa in realtà</th><th>In spagnolo è...</th></tr>
      <tr><td><strong>il burro</strong></td><td>il somaro</td><td class="text-accent">il burro (mantequilla)</td><td>l'asino / il somaro</td></tr>
      <tr><td><strong>caldo</strong></td><td>il brodo</td><td class="text-accent">caldo / calore</td><td>il brodo</td></tr>
      <tr><td><strong>la camera</strong></td><td>la fotocamera</td><td class="text-accent">la stanza</td><td>la macchina fotografica</td></tr>
      <tr><td><strong>il parente</strong></td><td>il genitore</td><td class="text-accent">il familiare</td><td>i genitori</td></tr>
      <tr><td><strong>sensibile</strong></td><td>ragionevole</td><td class="text-accent">sensibile (emotivo)</td><td>ragionevole / sensato</td></tr>
      <tr><td><strong>annoiare</strong></td><td>irritare</td><td class="text-accent">annoiare</td><td>irritare / infastidire</td></tr>
      <tr><td><strong>pretendere</strong></td><td>fingere</td><td class="text-accent">esigere / reclamare</td><td>fingere</td></tr>
      <tr><td><strong>morbido</strong></td><td>morboso</td><td class="text-accent">morbido / soffice</td><td>morboso</td></tr>
      <tr><td><strong>conveniente</strong></td><td>adeguato</td><td class="text-accent">economico / a buon prezzo</td><td>adeguato / opportuno</td></tr>
      <tr><td><strong>il pavimento</strong></td><td>il selciato</td><td class="text-accent">il pavimento interno</td><td>il selciato / l'asfalto</td></tr>
    </table></div>
  `},
];

async function renderGrammar(el) {
  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Grammatica</div>
        <div class="section-sub">Percorso progressivo B1 → C1</div>
      </div>
    </div>

    <div id="grammar-list">
      ${GRAMMAR_TOPICS.map(t => `
        <div class="card mb-3" style="cursor:pointer" data-topic="${t.id}">
          <div class="flex items-center gap-3">
            <div style="flex:1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium">${t.title}</span>
                ${cefrBadge(t.level)}
              </div>
              <div class="text-sm text-muted">${t.desc}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0;color:var(--text-3)"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>`).join('')}
    </div>

    <div id="grammar-detail" style="display:none"></div>
  `;

  el.querySelectorAll('[data-topic]').forEach(card => {
    card.addEventListener('click', () => {
      const topic = GRAMMAR_TOPICS.find(t => t.id === card.dataset.topic);
      if (!topic) return;
      const detail = document.getElementById('grammar-detail');
      const list = document.getElementById('grammar-list');
      detail.style.display = 'block';
      list.style.display = 'none';
      detail.innerHTML = `
        <button class="btn btn-ghost btn-sm mb-4" id="back-grammar">← Indietro</button>
        <div class="card">
          <div class="flex items-center gap-2 mb-4">
            <div class="section-title">${topic.title}</div>
            ${cefrBadge(topic.level)}
          </div>
          ${topic.content}
        </div>`;
      detail.querySelector('#back-grammar').addEventListener('click', () => {
        detail.style.display = 'none';
        list.style.display = 'block';
      });
      API.put('/settings', { [`grammar_viewed_${topic.id}`]: new Date().toISOString() }).catch(() => {});
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// WRITING
// ══════════════════════════════════════════════════════════════════════════════
async function renderWriting(el) {
  const [prompts, exercises] = await Promise.all([
    API.get('/writing/prompts'),
    API.get('/writing/exercises'),
  ]);

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Scrittura</div>
        <div class="section-sub">Scrittura e produzione scritta in italiano</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-wtab="new">Nuovo esercizio</button>
      <button class="tab-btn" data-wtab="history">Cronologia</button>
    </div>

    <div id="writing-tab"></div>
  `;

  el.querySelectorAll('[data-wtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-wtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.wtab === 'new') renderWritingNew(el, prompts);
      else renderWritingHistory(el, exercises);
    });
  });

  renderWritingNew(el, prompts);
}

function renderWritingNew(el, prompts) {
  const tab = document.getElementById('writing-tab');
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  tab.innerHTML = `
    <div class="writing-prompt-card">
      <div class="writing-prompt-label">Proposta di esercizio</div>
      <div class="writing-prompt-text">${prompt?.prompt || 'Scrivi un testo libero in italiano.'}</div>
      <div class="writing-meta">
        <span>Tipo: ${prompt?.type || 'libero'}</span>
        <span>Obiettivo: min. 80 parole</span>
      </div>
    </div>

    <div class="card mb-4">
      <label class="form-label">Il tuo testo in italiano</label>
      <textarea id="writing-text" placeholder="Scrivi qui il tuo testo in italiano..." style="min-height:200px"></textarea>
      <div class="flex justify-between mt-2">
        <span class="text-xs text-muted" id="word-count">0 parole</span>
        <span class="text-xs text-muted">Scrivi in italiano, senza tradurre mentalmente dallo spagnolo.</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <button class="btn btn-primary" id="save-writing">Salva e rivedi</button>
      <button class="btn btn-outline" id="new-prompt-btn">Altro esercizio</button>
    </div>

    <div class="card">
      <div class="card-title mb-2">Consigli per questo esercizio</div>
      <ul class="text-sm text-muted" style="padding-left:20px;line-height:2">
        <li>Usa il vocabolario che hai imparato di recente nelle flashcard</li>
        <li>Pratica i tempi verbali che studi nelle coniugazioni</li>
        <li>Prova a usare almeno 2 connettivi: <em>tuttavia, inoltre, quindi, sebbene...</em></li>
        <li>Scrivi prima senza correzioni, poi rileggi</li>
      </ul>
    </div>
  `;

  const textarea = tab.querySelector('#writing-text');
  textarea.addEventListener('input', () => {
    const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    document.getElementById('word-count').textContent = `${words} parol${words!==1?'e':'a'}`;
  });

  tab.querySelector('#save-writing').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (text.length < 20) { toast('Il testo è troppo corto', 'error'); return; }
    try {
      if (prompt?.id) {
        await API.put(`/writing/exercises/${prompt.id}`, { user_text: text });
      } else {
        await API.post('/writing/exercises', { prompt: 'Testo libero', type: 'free' });
      }
      toast('Testo salvato. Ottimo lavoro!');
      textarea.value = '';
    } catch(e) {
      toast('Errore nel salvataggio', 'error');
    }
  });

  tab.querySelector('#new-prompt-btn').addEventListener('click', () => navigate('writing'));
}

function renderWritingHistory(el, exercises) {
  const tab = document.getElementById('writing-tab');
  const completed = exercises.filter(e => e.user_text);
  tab.innerHTML = `
    <div class="section-sub mb-4">${completed.length} testi scritti</div>
    ${completed.length ? completed.map(e => `
      <div class="card mb-3">
        <div class="flex justify-between mb-2">
          <span class="badge badge-gray">${e.type}</span>
          <span class="text-xs text-muted">${fmt.date(e.created_at*1000)}</span>
        </div>
        <div class="text-sm text-muted mb-2 italic">"${e.prompt.substring(0,80)}..."</div>
        <div class="text-sm" style="line-height:1.8">${e.user_text?.substring(0,200)}${(e.user_text?.length||0)>200?'…':''}</div>
        <div class="text-xs text-muted mt-2">${e.word_count} parole</div>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-icon">✍️</div><div class="empty-state-title">Non hai ancora scritto nessun testo</div></div>'}
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// READING
// ══════════════════════════════════════════════════════════════════════════════
const READING_TEXTS = [
  { id:1, title:"L'importanza delle lingue straniere", level:'B1', text:`Parlare una lingua straniera è una competenza sempre più importante nel mondo moderno. Non solo permette di comunicare con persone di diversi paesi, ma apre anche nuove opportunità di lavoro e arricchisce la comprensione culturale.

L'italiano, in particolare, è una lingua ricca di storia e cultura. È la lingua di Dante, Michelangelo e Leonardo da Vinci. Studiare l'italiano significa accedere a secoli di arte, letteratura e musica.

Molti esperti sostengono che il modo migliore per imparare una lingua è l'immersione totale: vivere nel paese, parlare con i nativi e leggere molto. Tuttavia, con le risorse online disponibili oggi, è possibile creare un ambiente di immersione anche senza spostarsi.

La costanza è fondamentale: è meglio studiare trenta minuti ogni giorno che tre ore una volta alla settimana.`,
    questions: [
      { q:'Perché è importante parlare una lingua straniera?', a:'Permette di comunicare con persone di paesi diversi, apre opportunità di lavoro e arricchisce la comprensione culturale.' },
      { q:'Qual è il metodo migliore per imparare secondo gli esperti?', a:'L\'immersione totale: vivere nel paese, parlare con i nativi e leggere molto.' },
      { q:'Cosa dice il testo sulla costanza?', a:'È meglio studiare 30 minuti ogni giorno che 3 ore una volta alla settimana.' },
    ]},
  { id:2, title:"Il caffè italiano", level:'A2', text:`Il caffè è parte integrante della cultura italiana. Gli italiani bevono il caffè in modo molto diverso rispetto ad altri paesi.

Il caffè espresso è la bevanda più comune: si beve in piedi al bancone del bar, in pochi secondi. È piccolo, concentrato e molto forte.

Al mattino, gli italiani preferiscono il cappuccino o il caffè latte. Dopo pranzo e dopo cena, invece, si beve solo l'espresso. Ordinare un cappuccino dopo pranzo in Italia potrebbe sembrare strano ai locali.

Il bar italiano non è solo un posto dove bere il caffè. È un luogo di incontro sociale, dove le persone si fermano per chiacchierare e iniziare la giornata.`,
    questions: [
      { q:'Come bevono l\'espresso gli italiani?', a:'In piedi al bancone del bar, in pochi secondi.' },
      { q:'Quale bevanda è strano ordinare dopo pranzo?', a:'Il cappuccino.' },
      { q:'Che funzione sociale ha il bar italiano?', a:'È un luogo di incontro dove le persone si fermano a chiacchierare e iniziare la giornata.' },
    ]},
];

async function renderReading(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Lettura</div>
    </div>
    <div id="reading-content">
      <div class="grid-2">
        ${READING_TEXTS.map(t => `
          <div class="card" style="cursor:pointer" data-text-id="${t.id}">
            <div class="flex justify-between mb-2">
              ${cefrBadge(t.level)}
              <span class="text-xs text-muted">${t.text.split(' ').length} parole</span>
            </div>
            <div class="font-medium mb-1">${t.title}</div>
            <div class="text-sm text-muted">${t.text.substring(0,100)}...</div>
          </div>`).join('')}
        <div class="card" style="border-style:dashed;display:flex;align-items:center;justify-content:center;padding:32px;color:var(--text-3)">
          <div style="text-align:center">
            <div style="font-size:2rem;margin-bottom:8px">+</div>
            <div class="text-sm">Più testi a breve</div>
          </div>
        </div>
      </div>
    </div>
    <div id="reading-viewer" style="display:none"></div>
  `;

  el.querySelectorAll('[data-text-id]').forEach(card => {
    card.addEventListener('click', () => {
      const text = READING_TEXTS.find(t => t.id === parseInt(card.dataset.textId));
      if (!text) return;
      showReadingText(el, text);
    });
  });
}

function showReadingText(el, text) {
  const viewer = document.getElementById('reading-viewer');
  const content = document.getElementById('reading-content');
  viewer.style.display = 'block';
  content.style.display = 'none';

  viewer.innerHTML = `
    <button class="btn btn-ghost btn-sm mb-4" id="back-reading">← Indietro</button>
    <div class="card mb-4">
      <div class="flex items-center gap-2 mb-4">
        <div class="section-title">${text.title}</div>
        ${cefrBadge(text.level)}
      </div>
      <div style="line-height:2;font-size:0.95rem">${text.text.split('\n\n').map(p=>`<p style="margin-bottom:1em">${p}</p>`).join('')}</div>
    </div>

    <div class="card">
      <div class="card-title mb-3">Comprensione della lettura</div>
      ${text.questions.map((q, i) => `
        <div class="mb-4">
          <div class="font-medium text-sm mb-2">${i+1}. ${q.q}</div>
          <textarea placeholder="Scrivi la tua risposta in italiano..." style="min-height:60px" data-answer="${q.a}" class="answer-area"></textarea>
          <div class="answer-reveal text-sm text-accent mt-2" style="display:none">✓ ${q.a}</div>
        </div>`).join('')}
      <button class="btn btn-outline btn-sm" id="reveal-answers">Vedi risposte</button>
    </div>
  `;

  viewer.querySelector('#back-reading').addEventListener('click', () => {
    viewer.style.display = 'none';
    content.style.display = 'block';
  });

  viewer.querySelector('#reveal-answers').addEventListener('click', () => {
    viewer.querySelectorAll('.answer-reveal').forEach(r => r.style.display = 'block');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ══════════════════════════════════════════════════════════════════════════════
async function renderErrors(el) {
  const errors = await API.get('/errors');

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Quaderno degli errori</div>
        <div class="section-sub">${errors.length} errori registrati</div>
      </div>
      <button class="btn btn-outline btn-sm" id="add-error-btn">+ Registra errore</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-etab="pending">In sospeso</button>
      <button class="tab-btn" data-etab="all">Tutti</button>
      <button class="tab-btn" data-etab="mastered">Corretti</button>
      <button class="tab-btn" data-etab="verbi">Verbi</button>
      <button class="tab-btn" data-etab="parole">Parole</button>
    </div>

    <div id="error-list"></div>
  `;

  function renderErrorList(filter) {
    const list = document.getElementById('error-list');
    let filtered = errors;
    if (filter === 'pending') filtered = errors.filter(e => e.mastery < 2);
    else if (filter === 'mastered') filtered = errors.filter(e => e.mastery === 2);

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${filter==='mastered'?'🏆':'✅'}</div><div class="empty-state-title">${filter==='mastered'?'Non hai ancora corretto nessun errore':'Nessun errore in sospeso!'}</div></div>`;
      return;
    }

    list.innerHTML = filtered.map(e => `
      <div class="error-item ${e.mastery===2?'mastered':''}" data-id="${e.id}">
        <div class="flex justify-between mb-1">
          <span class="badge ${['badge-gray','badge-orange','badge-green'][e.mastery||0]}">${['Imparando','In corso','Corretto'][e.mastery||0]}</span>
          <span class="badge badge-${e.importance===3?'red':e.importance===2?'orange':'gray'}">${['','Bassa','Media','Alta'][e.importance||2]}</span>
        </div>
        <div class="error-original">"${e.original_text}"</div>
        ${e.corrected_text ? `<div class="error-corrected">→ "${e.corrected_text}"</div>` : ''}
        ${e.explanation ? `<div class="error-explanation">${e.explanation}</div>` : ''}
        <div class="error-meta">
          <span class="badge badge-gray">${e.category}</span>
          <span class="text-xs text-muted">${e.times_seen}x visto</span>
          ${e.times_correct > 0 ? `<span class="text-xs text-accent">${e.times_correct}x corretto</span>` : ''}
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-sm btn-primary review-correct-btn" data-id="${e.id}">✓ Ce l'ho fatta</button>
          <button class="btn btn-sm btn-outline review-wrong-btn" data-id="${e.id}">✗ Ancora difficile</button>
          <button class="btn btn-sm btn-ghost delete-error-btn" data-id="${e.id}">Elimina</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.review-correct-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await API.post(`/errors/${btn.dataset.id}/review`, { correct: true });
        toast('Progresso registrato!');
        navigate('errors');
      });
    });
    list.querySelectorAll('.review-wrong-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await API.post(`/errors/${btn.dataset.id}/review`, { correct: false });
        toast('Ripasso programmato');
        navigate('errors');
      });
    });
    list.querySelectorAll('.delete-error-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questo errore?')) return;
        await API.del(`/errors/${btn.dataset.id}`);
        navigate('errors');
      });
    });
  }

  const TENSE_IT = { presente:'Presente', imperfetto:'Imperfetto', futuro:'Futuro', condizionale:'Condizionale', congiuntivo:'Congiuntivo', passato_prossimo:'Passato Prossimo' };

  async function renderVerbStats() {
    const list = document.getElementById('error-list');
    const stats = await API.get('/conjugation/stats');
    if (!stats.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-title">Ancora nessun tentativo</div><div class="empty-state-sub">Pratica le conjugazioni per vedere le tue statistiche</div></div>`;
      return;
    }
    list.innerHTML = stats.map(v => {
      const pct = v.accuracy;
      const color = pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--orange)' : '#ef4444';
      const tenseBars = v.tenses.map(t => {
        const tc = t.accuracy >= 80 ? 'var(--accent)' : t.accuracy >= 50 ? 'var(--orange)' : '#ef4444';
        return `<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem">
          <span style="width:110px;color:var(--text-muted)">${TENSE_IT[t.tense]||t.tense}</span>
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px">
            <div style="width:${t.accuracy}%;height:100%;background:${tc};border-radius:3px"></div>
          </div>
          <span style="width:36px;text-align:right;color:${tc}">${t.accuracy}%</span>
          <span style="color:var(--text-muted)">${t.correct}/${t.total}</span>
        </div>`;
      }).join('');
      return `<div class="card mb-3">
        <div class="flex items-center justify-between mb-2">
          <div style="font-weight:700;font-size:1.05rem">⚡ ${v.verb}</div>
          <div style="font-weight:700;color:${color};font-size:1.1rem">${pct}%</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">${tenseBars}</div>
      </div>`;
    }).join('');
  }

  async function renderParoleMastery() {
    const list = document.getElementById('error-list');
    const data = await API.get('/flashcards/mastery');
    const cols = [
      { key:'nonLaSo', label:'Non la so', icon:'🔴', desc:'0–2 corrette' },
      { key:'inCorso', label:'In corso', icon:'🟡', desc:'3–9 corrette' },
      { key:'dominata', label:'Dominata', icon:'🟢', desc:'10+ corrette' },
    ];
    list.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${cols.map(col => {
        const words = data[col.key] || [];
        const wordRows = words.slice(0,30).map(w =>
          `<div class="word-item" style="padding:8px 12px">
            <div class="word-it" style="font-size:0.85rem">${w.front||w.italian}</div>
            <div class="word-es" style="font-size:0.8rem">${w.back||w.spanish}</div>
            <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0">${w.correct_reviews||0}✓</span>
          </div>`
        ).join('');
        return `<div class="card">
          <div style="font-weight:700;margin-bottom:4px">${col.icon} ${col.label}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">${col.desc} · ${words.length} parole</div>
          ${words.length ? `<div class="word-list">${wordRows}</div>${words.length>30?`<div class="text-xs text-muted mt-2">+${words.length-30} altri</div>`:''}` : '<div class="text-sm text-muted">Nessuna parola</div>'}
        </div>`;
      }).join('')}
    </div>`;
  }

  el.querySelectorAll('[data-etab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-etab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.etab;
      if (tab === 'verbi') renderVerbStats();
      else if (tab === 'parole') renderParoleMastery();
      else renderErrorList(tab);
    });
  });

  el.querySelector('#add-error-btn').addEventListener('click', () => {
    showModal('Registra errore', `
      <div class="form-group"><label class="form-label">Testo originale (scorretto)</label><textarea id="err-orig" rows="2" placeholder="Ho freddo. Sto freddo."></textarea></div>
      <div class="form-group"><label class="form-label">Correzione</label><input id="err-corr" placeholder="Ho freddo."></div>
      <div class="form-group"><label class="form-label">Spiegazione</label><textarea id="err-expl" rows="2" placeholder="Usare 'avere' per le sensazioni fisiche, non 'stare'"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Categoria</label>
          <select id="err-cat"><option>grammar</option><option>vocabulary</option><option>conjugation</option><option>false_friend</option><option>other</option></select>
        </div>
        <div class="form-group"><label class="form-label">Importanza</label>
          <select id="err-imp"><option value="1">Bassa</option><option value="2" selected>Media</option><option value="3">Alta</option></select>
        </div>
      </div>
    `, [
      { label:'Annulla', action:'close', cls:'btn-outline' },
      { label:'Registra', action: async () => {
        const orig = document.getElementById('err-orig').value.trim();
        if (!orig) { toast('Il testo originale è obbligatorio', 'error'); return; }
        await API.post('/errors', {
          original_text: orig,
          corrected_text: document.getElementById('err-corr').value.trim(),
          explanation: document.getElementById('err-expl').value.trim(),
          category: document.getElementById('err-cat').value,
          importance: parseInt(document.getElementById('err-imp').value),
        });
        toast('Errore registrato');
        closeModal();
        navigate('errors');
      }, cls:'btn-primary' },
    ]);
  });

  renderErrorList('pending');
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRESS
// ══════════════════════════════════════════════════════════════════════════════
async function renderProgress(el) {
  const data = await API.get('/stats/progress');
  const dashboard = await API.get('/stats/dashboard');

  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Progressi</div>
    </div>

    <!-- Summary stats -->
    <div class="grid-4 mb-4">
      <div class="stat-tile stat-tile-accent">
        <div class="stat-tile-label">Serie attuale</div>
        <div class="stat-tile-value">🔥 ${dashboard.streak}</div>
        <div class="stat-tile-sub">Migliore: ${dashboard.bestStreak}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Parole imparate</div>
        <div class="stat-tile-value">${dashboard.learnedWords}</div>
        <div class="stat-tile-sub">di ${dashboard.totalWords}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Settimana attuale</div>
        <div class="stat-tile-value">${Math.round(dashboard.weekMinutes)}min</div>
        <div class="stat-tile-sub">${dashboard.weekDays} giorni attivi</div>
      </div>
      <div class="stat-tile ${dashboard.weekAccuracy > 0 ? 'stat-tile-accent' : ''}">
        <div class="stat-tile-label">Precisione settimana</div>
        <div class="stat-tile-value">${dashboard.weekAccuracy ? fmt.pct(dashboard.weekAccuracy) : '—'}%</div>
        <div class="stat-tile-sub">nelle flashcard</div>
      </div>
    </div>

    <!-- Vocabulary by category -->
    <div class="card mb-4">
      <div class="card-title mb-4">Vocabolario per categoria</div>
      ${data.categoryProgress.map(c => {
        const pct = c.total > 0 ? Math.round((c.learned / c.total) * 100) : 0;
        const acc = c.accuracy !== null ? Math.round(c.accuracy * 100) : null;
        return `<div class="mb-4">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span>${c.icon}</span>
              <span class="text-sm font-medium">${c.name}</span>
            </div>
            <div class="flex items-center gap-2">
              ${acc !== null ? `<span class="text-xs text-muted">${acc}% precisione</span>` : ''}
              <span class="text-xs text-muted">${c.learned}/${c.total}</span>
            </div>
          </div>
          ${progressBar(pct)}
        </div>`;
      }).join('')}
    </div>

    <!-- Activity last 30 days -->
    <div class="card mb-4">
      <div class="card-title mb-3">Attività — ultimi 30 giorni</div>
      <div class="activity-calendar" id="act-calendar"></div>
      <div class="flex gap-4 mt-3 text-xs text-muted">
        <span>🟩 Obiettivo raggiunto</span>
        <span>🟦 Hai studiato</span>
        <span>⬜ Nessuno studio</span>
      </div>
    </div>

    <!-- Error stats -->
    ${data.errorsByCategory.length ? `
      <div class="card mb-4">
        <div class="card-title mb-3">Errori per categoria</div>
        ${data.errorsByCategory.map(e => `
          <div class="flex items-center gap-3 mb-3">
            <span class="badge badge-gray">${e.category}</span>
            <div style="flex:1">
              ${progressBar(e.total > 0 ? Math.round(e.resolved/e.total*100) : 0)}
            </div>
            <span class="text-xs text-muted">${e.resolved}/${e.total} corretti</span>
          </div>`).join('')}
      </div>` : ''}

    <!-- Level estimate -->
    <div class="card">
      <div class="card-title mb-3">Stima del livello</div>
      <div class="alert alert-info">Questa stima è indicativa e si basa sulla tua attività nell'app, non su una valutazione ufficiale del QCER.</div>
      <div class="mt-3">
        ${[
          { label:'Vocabolario attivo', pct: Math.min(100, Math.round((dashboard.learnedWords/500)*100)), note:`${dashboard.learnedWords}/500 parole per B2` },
          { label:'Costanza', pct: Math.min(100, Math.round((dashboard.streak/30)*100)), note:`${dashboard.streak}/30 giorni di serie` },
          { label:'Precisione generale', pct: Math.min(100, Math.round((dashboard.weekAccuracy||0)*100)), note:`${fmt.pct(dashboard.weekAccuracy||0)}% nelle flashcard` },
        ].map(m => `
          <div class="mb-4">
            <div class="flex justify-between mb-1">
              <span class="text-sm font-medium">${m.label}</span>
              <span class="text-sm text-muted">${m.note}</span>
            </div>
            ${progressBar(m.pct)}
          </div>`).join('')}
      </div>
    </div>
  `;

  // Activity calendar
  const calEl = document.getElementById('act-calendar');
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const stat = data.last30.find(s => s.date === ds);
    const div = document.createElement('div');
    div.className = `cal-day${stat?.goal_met ? ' level-4' : stat?.minutes_studied > 0 ? ' level-2' : ''}`;
    div.title = ds + (stat ? ` — ${Math.round(stat.minutes_studied)}min` : ' — nessuno studio');
    calEl.appendChild(div);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REWARDS
// ══════════════════════════════════════════════════════════════════════════════
async function renderRewards(el) {
  const [rewards, milestones] = await Promise.all([API.get('/rewards'), API.get('/milestones')]);

  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Premi e traguardi</div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-rtab="rewards">I miei premi</button>
      <button class="tab-btn" data-rtab="milestones">Traguardi</button>
    </div>
    <div id="rewards-tab"></div>
  `;

  function showRewardsTab(tab) {
    const rtab = document.getElementById('rewards-tab');
    if (tab === 'rewards') {
      rtab.innerHTML = `
        <div class="flex justify-end mb-4">
          <button class="btn btn-primary btn-sm" id="add-reward-btn">+ Nuovo premio</button>
        </div>
        ${rewards.length ? rewards.map(r => `
          <div class="card mb-3">
            <div class="flex justify-between mb-2">
              <div class="font-medium">${r.title}</div>
              <span class="badge ${r.earned?'badge-gold':'badge-gray'}">${r.earned?'🏆 Guadagnato':'In sospeso'}</span>
            </div>
            ${r.description ? `<div class="text-sm text-muted mb-2">${r.description}</div>` : ''}
            <div class="text-xs text-muted mb-2">Requisito: ${r.requirement_type} — ${r.requirement_value}</div>
            ${progressBar(Math.min(100, Math.round((r.current_value/r.requirement_value)*100)))}
            ${r.earned && !r.claimed ? `<button class="btn btn-sm btn-primary mt-2 claim-reward" data-id="${r.id}">Riscatta premio</button>` : ''}
          </div>`).join('')
        : '<div class="empty-state"><div class="empty-state-icon">🎁</div><div class="empty-state-title">Crea il tuo primo premio personale</div></div>'}
      `;
      rtab.querySelector('#add-reward-btn')?.addEventListener('click', () => {
        showModal('Nuovo premio', `
          <div class="form-group"><label class="form-label">Premio</label><input id="rw-title" placeholder="Guardare un film italiano"></div>
          <div class="form-group"><label class="form-label">Descrizione</label><input id="rw-desc" placeholder="Opzionale"></div>
          <div class="form-group"><label class="form-label">Obiettivo</label><input id="rw-val" type="number" placeholder="7" min="1"></div>
          <div class="form-group"><label class="form-label">Tipo di obiettivo</label>
            <select id="rw-type"><option value="days_streak">Giorni di serie</option><option value="words_learned">Parole imparate</option><option value="sessions">Sessioni completate</option></select>
          </div>
        `, [
          { label:'Annulla', action:'close', cls:'btn-outline' },
          { label:'Crea', action: async () => {
            const title = document.getElementById('rw-title').value.trim();
            const val = parseFloat(document.getElementById('rw-val').value);
            if (!title || !val) { toast('Compila tutti i campi', 'error'); return; }
            await API.post('/rewards', { title, description: document.getElementById('rw-desc').value, requirement_type: document.getElementById('rw-type').value, requirement_value: val });
            toast('Premio creato'); closeModal(); navigate('rewards');
          }, cls:'btn-primary' },
        ]);
      });
      rtab.querySelectorAll('.claim-reward')?.forEach(btn => {
        btn.addEventListener('click', async () => {
          await API.put(`/rewards/${btn.dataset.id}`, { claimed: 1 });
          toast('🎉 Premio riscattato!'); navigate('rewards');
        });
      });
    } else {
      rtab.innerHTML = `
        <div class="grid-2">
          ${milestones.map(m => `
            <div class="card ${m.unlocked?'':'opacity-60'}">
              <div class="flex items-center gap-2 mb-2">
                <span style="font-size:1.5rem">${m.unlocked?'🏆':'🔒'}</span>
                <div>
                  <div class="font-medium text-sm">${m.title}</div>
                  <div class="text-xs text-muted">${m.category}</div>
                </div>
              </div>
              <div class="text-sm text-muted">${m.description}</div>
              ${m.unlocked ? `<div class="text-xs text-accent mt-2">Sbloccato ${m.unlocked_at ? fmt.date(m.unlocked_at*1000) : ''}</div>` : ''}
            </div>`).join('')}
        </div>`;
    }
  }

  el.querySelectorAll('[data-rtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-rtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showRewardsTab(btn.dataset.rtab);
    });
  });

  showRewardsTab('rewards');
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPLETAMENTO (CLOZE)
// ══════════════════════════════════════════════════════════════════════════════

const CLOZE = {
  articoli: [
    { title:'Al bar', text:'Ogni mattina Marco ordina ___ caffè e ___ cornetto. ___ barista lo conosce già. Sulla vetrina ci sono ___ paste e ___ pasticcini.', answers:['un','un','Il','delle','dei'] },
    { title:'Lo sport', text:'___ sport più praticato in Italia è ___ calcio. ___ squadra della mia città ha vinto ___ campionato. Guardo ___ partite in televisione.', answers:['Lo','il','La','il','le'] },
    { title:'La famiglia', text:'___ mio fratello è ___ medico bravo. Ha ___ figlia di tre anni e ___ figlio di cinque. ___ bambini sono molto vivaci.', answers:['Il','un','una','un','I'] },
    { title:'La natura', text:'___ sole sorge a est e tramonta a ovest. ___ luna piena illumina ___ notte. ___ stelle brillano nel cielo sereno.', answers:['Il','La','la','Le'] },
    { title:'In città', text:'___ centro storico è pieno di turisti. ___ negozi aprono alle nove. ___ piazze della città sono bellissime e ___ fontane sono famose nel mondo.', answers:['Il','I','Le','le'] },
    { title:'Gli animali', text:'___ gatto di Lucia dorme tutto ___ giorno sul divano. ___ cani del vicino abbaiano sempre. ___ aquile volano sulle montagne alte.', answers:['Il','il','I','Le'] },
    { title:'Nello zaino', text:'Nella borsa ho ___ smartphone, ___ portafoglio e ___ chiavi di casa. Stamattina ho dimenticato ___ ombrello.', answers:['uno','un','le',"l'"] },
    { title:'Il viaggio', text:'___ estate scorsa ho visitato ___ Sicilia con ___ miei genitori. ___ isola è bellissima e ___ cibo è straordinario.', answers:["L'",'la','i',"L'",'il'] },
    { title:'La salute', text:'Ho ___ mal di testa terribile. ___ medico mi ha prescritto ___ farmaci. Devo bere ___ acqua e riposarmi.', answers:['un','Il','dei',"dell'"] },
    { title:'Al mercato', text:'Ho comprato ___ pomodori freschi, ___ insalata e ___ uova. ___ venditore era molto simpatico e mi ha fatto ___ sconto.', answers:['dei',"un'",'delle','Il','uno'] },
    { title:'La scuola di lingue', text:'Studio in ___ scuola di lingue privata. ___ professore di italiano si chiama Carlo. ___ lezioni sono ogni giorno alle nove.', answers:['una','Il','Le'] },
    { title:'Natale', text:'A Natale prepariamo ___ albero e ___ presepe. ___ bambini aspettano ___ regali con entusiasmo. È ___ periodo magico.', answers:["l'",'il','I','i','un'] },
    { title:'La tecnologia', text:'___ smartphone è diventato indispensabile. ___ applicazioni che uso di più sono per ___ foto e ___ messaggi. Non ricordo ___ vita senza internet.', answers:['Lo','Le','le','i','la'] },
    { title:'Per cena', text:'Per cena ho preparato ___ zuppa di verdure e ___ pane tostato. Come dessert ho preso ___ yogurt alla frutta e ___ frutto di stagione.', answers:['una','del','uno','un'] },
    { title:"L'arte italiana", text:"___ arte italiana è famosa nel mondo. ___ Colosseo e ___ Fontana di Trevi sono ___ simboli di Roma. Ogni anno arrivano ___ milioni di turisti.", answers:["L'",'Il','la','i','dei'] },
    { title:'Il lavoro', text:'___ mio collega ha trovato ___ lavoro nuovo. Lavora in ___ azienda multinazionale. Ha ___ ufficio bellissimo al quinto piano.', answers:['Il','un',"un'",'un'] },
    { title:'Lo sport invernale', text:'___ sci è ___ sport invernale che pratico ogni anno. ___ piste di Courmayeur sono fantastiche. Ho comprato ___ sci nuovi.', answers:['Lo','uno','Le','degli'] },
    { title:'La musica', text:'___ musica classica mi rilassa molto. Ascolto spesso ___ sinfonie di Beethoven e ___ opere di Verdi. ___ violino è ___ strumento che preferisco.', answers:['La','le','le','Il','lo'] },
    { title:'Il tempo libero', text:'Nel tempo libero leggo ___ romanzi e guardo ___ film. ___ domenica vado al cinema con ___ miei amici. Mi piacciono ___ film di fantascienza.', answers:['dei','dei','La','i','i'] },
    { title:'Al ristorante', text:'Ho ordinato ___ antipasto, ___ primo piatto e ___ secondo. Come dessert ho preso ___ tiramisù. ___ conto era molto ragionevole.', answers:['un','un','un','il','Il'] },
  ],
  preposizioni: [
    { title:'Vita quotidiana', text:'Marco si sveglia ___ sei ___ mattina. Fa colazione ___ cucina e poi va ___ lavoro. Torna ___ casa la sera.', answers:['alle','di','in','al','a'] },
    { title:'Le origini', text:'Giulia viene ___ Napoli ma studia ___ Bologna. Ogni mese torna ___ casa sua ___ treno.', answers:['da','a','a','in'] },
    { title:'Una serata fuori', text:'Ieri sera sono uscito ___ cena ___ mia moglie. Siamo andati ___ un ristorante vicino ___ teatro.', answers:['a','con','in','al'] },
    { title:'Vacanze in Grecia', text:"Quest'estate vado ___ Grecia ___ tutta la famiglia. Partiamo ___ Roma ___ aereo e arriviamo ___ Atene la sera.", answers:['in','con','da','in','ad'] },
    { title:'A scuola', text:'Gli studenti arrivano ___ scuola ___ otto. Il professore entra ___ classe e comincia la lezione.', answers:['a','alle','in'] },
    { title:'Le stagioni', text:"D'estate vado ___ mare con gli amici. D'inverno preferisco stare ___ casa. ___ primavera mi piace camminare ___ parco.", answers:['al','a','In','nel'] },
    { title:'Una lettera', text:'Ho scritto ___ mia amica che vive ___ Madrid. Le ho parlato ___ mio lavoro e ___ miei sogni futuri.', answers:['alla','a','del','dei'] },
    { title:'Dal medico', text:'Domani ho un appuntamento ___ medico. Lo studio si trova ___ terzo piano ___ una clinica vicino ___ stazione.', answers:['dal','al','di','alla'] },
    { title:'Il museo', text:'Siamo andati ___ museo ___ piedi. Il biglietto costa dodici euro ___ adulto. Le opere provengono ___ tutto il mondo.', answers:['al','a','per','da'] },
    { title:'La ricetta', text:'La ricetta ___ pasta alla carbonara viene ___ Lazio. Si prepara ___ pancetta, uova e formaggio. Non si usa ___ nessun caso la panna.', answers:['della','dal','con','in'] },
    { title:'Casa mia', text:'Abito ___ terzo piano ___ un palazzo storico. Il mio appartamento è ___ centro ___ una bella città italiana.', answers:['al','di','in','di'] },
    { title:'In treno', text:'Parto ___ Milano ___ le otto e arrivo ___ Roma ___ mezzogiorno. Il viaggio dura due ore ___ treno.', answers:['da','alle','a','a','in'] },
    { title:'Le vacanze estive', text:"Quest'estate resto ___ Italia. Vado ___ Puglia ___ luglio. Starò ___ un agriturismo vicino ___ mare.", answers:['in','in','a','in','al'] },
    { title:'Sport e amici', text:'Il sabato mattina vado ___ palestra. Poi faccio una passeggiata ___ parco. La domenica gioco ___ calcio ___ amici.', answers:['in','nel','a','con'] },
    { title:'In ufficio', text:"Lavoro ___ un'azienda ___ Milano. Arrivo ___ ufficio ___ le nove e parto ___ le sei.", answers:['in','di','in','alle','alle'] },
    { title:'La spesa', text:'Ogni settimana vado ___ supermercato ___ fare la spesa. Compro frutta e verdura e qualcosa ___ cena. Pago spesso ___ contanti.', answers:['al','per','per','in'] },
    { title:"All'università", text:"Studio Economia ___ Università ___ Bologna. Il mio corso inizia ___ nove ___ mattina.", answers:["all'",'di','alle','di'] },
    { title:'Un fine settimana', text:'Il sabato vado ___ cinema. La domenica resto ___ casa. Ogni sera leggo ___ un\'ora prima ___ dormire.', answers:['al','a','per','di'] },
    { title:"L'aeroporto", text:"Per andare ___ aeroporto parto ___ casa ___ le sei. Il volo decolla ___ le otto e un quarto.", answers:["all'",'da','alle','alle'] },
    { title:'Una lettera', text:'Ho ricevuto una lettera ___ miei genitori che vivono ___ Spagna. Mi hanno scritto ___ nuovo lavoro e ___ mia sorella.', answers:['dai','in','del','della'] },
  ],
};

let clozeState = { type: null, index: 0, highWater: -1, score: { correct: 0, total: 0 } };

function normCloze(s) {
  return (s || '').normalize('NFC').toLowerCase().trim().replace(/[''`‘’]/g, "'");
}

function renderCompletamento(el) {
  if (!clozeState.type) {
    el.innerHTML = `
      <div class="section-header">
        <div class="section-title">Completamento</div>
        <div class="section-sub">Riempi gli spazi con l'articolo o la preposizione corretta</div>
      </div>
      <div class="card" style="max-width:460px">
        <div style="font-weight:600;margin-bottom:16px">Scegli la categoria:</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <button type="button" class="btn btn-primary" id="pick-art" style="justify-content:flex-start;gap:12px">
            <span style="font-size:1.3rem">📝</span>
            <span><strong>Articoli</strong><br><small style="font-weight:400;opacity:0.8">il, lo, la, l', un, dei… — 20 testi</small></span>
          </button>
          <button type="button" class="btn btn-outline" id="pick-prep" style="justify-content:flex-start;gap:12px">
            <span style="font-size:1.3rem">📍</span>
            <span><strong>Preposizioni</strong><br><small style="font-weight:400;opacity:0.8">di, a, da, nel, alla… — 20 testi</small></span>
          </button>
        </div>
      </div>
    `;
    el.querySelector('#pick-art').onclick = () => {
      clozeState = { type:'articoli', index:0, highWater:-1, score:{correct:0,total:0} };
      renderClozeEx(el);
    };
    el.querySelector('#pick-prep').onclick = () => {
      clozeState = { type:'preposizioni', index:0, highWater:-1, score:{correct:0,total:0} };
      renderClozeEx(el);
    };
    return;
  }
  renderClozeEx(el);
}

function renderClozeEx(el) {
  const exs = CLOZE[clozeState.type];
  if (clozeState.index >= exs.length) { renderClozeDone(el); return; }

  const ex = exs[clozeState.index];
  const parts = ex.text.split('___');
  const canGoBack = clozeState.index > 0;
  const canGoFwd = clozeState.highWater >= clozeState.index;
  const progress = `${clozeState.index + 1} / ${exs.length}`;
  const typeLabel = clozeState.type === 'articoli' ? '📝 Articoli' : '📍 Preposizioni';

  let textHTML = '';
  parts.forEach((part, i) => {
    textHTML += part;
    if (i < parts.length - 1) {
      const w = Math.max((ex.answers[i]?.length || 4) * 13 + 16, 44);
      textHTML += `<input class="cloze-input" data-index="${i}" style="width:${w}px" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
    }
  });

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" id="cloze-prev" class="btn btn-outline" style="padding:2px 10px;font-size:0.9rem;${canGoBack?'':'visibility:hidden'}">←</button>
          <div style="font-size:0.8rem;color:var(--text-muted)">${progress} — ${typeLabel}</div>
          <button type="button" id="cloze-nav-fwd" class="btn btn-outline" style="padding:2px 10px;font-size:0.9rem;${canGoFwd?'':'visibility:hidden'}">→</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)" id="cloze-score">✓ ${clozeState.score.correct}/${clozeState.score.total}</div>
      </div>
      <div style="font-weight:600;font-size:1rem;margin-bottom:14px">${ex.title}</div>
      <div class="cloze-text">${textHTML}</div>
      <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="cloze-check">Controlla</button>
        <button type="button" class="btn btn-outline" id="cloze-show" style="display:none">Mostra risposte</button>
        <button type="button" class="btn btn-outline" id="cloze-retry" style="display:none">Riprova</button>
        <button type="button" class="btn btn-primary" id="cloze-next" style="display:none">Avanti →</button>
      </div>
    </div>
  `;

  const inputs = [...el.querySelectorAll('.cloze-input')];
  if (inputs[0]) inputs[0].focus();

  let isLocked = false;
  let pendingKey = null;

  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); i < inputs.length - 1 ? inputs[i+1].focus() : doCheck(); }
    });
  });

  function doCheck() {
    if (el.querySelector('#cloze-next').style.display !== 'none') return;
    let correct = 0;
    inputs.forEach((inp, i) => {
      const typed = normCloze(inp.value);
      const ok = typed === normCloze(ex.answers[i]);
      inp.style.borderColor = ok ? 'var(--accent)' : '#ef4444';
      inp.dataset.result = ok ? 'ok' : 'wrong';
      inp.disabled = true;
      if (!isLocked) { clozeState.score.total++; if (ok) { clozeState.score.correct++; correct++; } }
      else if (ok) correct++;
    });
    if (!isLocked) isLocked = true;
    const scoreEl = el.querySelector('#cloze-score');
    if (scoreEl) scoreEl.textContent = `✓ ${clozeState.score.correct}/${clozeState.score.total}`;
    el.querySelector('#cloze-check').style.display = 'none';
    if (correct < inputs.length) {
      el.querySelector('#cloze-show').style.display = 'inline-flex';
      el.querySelector('#cloze-retry').style.display = 'inline-flex';
    }
    el.querySelector('#cloze-next').style.display = 'inline-flex';
    pendingKey = e => { if (e.key === 'ArrowRight' || e.key === 'Enter') { document.removeEventListener('keydown', pendingKey); pendingKey = null; goNext(); } };
    setTimeout(() => document.addEventListener('keydown', pendingKey), 50);
  }

  function goNext() {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    clozeState.highWater = Math.max(clozeState.highWater, clozeState.index);
    clozeState.index++;
    renderClozeEx(el);
  }

  function goPrev() {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    clozeState.index--;
    renderClozeEx(el);
  }

  el.querySelector('#cloze-check').addEventListener('click', doCheck);
  el.querySelector('#cloze-show').addEventListener('click', () => {
    inputs.forEach((inp, i) => {
      if (inp.dataset.result === 'wrong') {
        inp.value = ex.answers[i];
        inp.style.borderColor = '#f59e0b';
      }
    });
  });
  el.querySelector('#cloze-retry').addEventListener('click', () => {
    if (pendingKey) { document.removeEventListener('keydown', pendingKey); pendingKey = null; }
    inputs.forEach(inp => { inp.value = ''; inp.style.borderColor = ''; inp.disabled = false; delete inp.dataset.result; });
    el.querySelector('#cloze-check').style.display = 'inline-flex';
    el.querySelector('#cloze-show').style.display = 'none';
    el.querySelector('#cloze-retry').style.display = 'none';
    el.querySelector('#cloze-next').style.display = 'none';
    inputs[0]?.focus();
  });
  el.querySelector('#cloze-next').addEventListener('click', goNext);
  if (canGoBack) el.querySelector('#cloze-prev').addEventListener('click', goPrev);
  if (canGoFwd) el.querySelector('#cloze-nav-fwd').addEventListener('click', goNext);
}

function renderClozeDone(el) {
  const { correct, total } = clozeState.score;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  const emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪';
  const label = clozeState.type === 'articoli' ? 'Articoli' : 'Preposizioni';
  el.innerHTML = `
    <div class="card" style="text-align:center;padding:32px 24px">
      <div style="font-size:2.5rem;margin-bottom:8px">${emoji}</div>
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:4px">${label} — completato!</div>
      <div style="font-size:2rem;font-weight:700;color:${pct>=80?'var(--accent)':'#f59e0b'};margin-bottom:4px">${pct}%</div>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:24px">${correct} / ${total} corretti</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button type="button" class="btn btn-outline" id="cloze-again">Riprova</button>
        <button type="button" class="btn btn-primary" id="cloze-new">Cambia categoria</button>
      </div>
    </div>
  `;
  el.querySelector('#cloze-again').addEventListener('click', () => {
    clozeState = { type:clozeState.type, index:0, highWater:-1, score:{correct:0,total:0} };
    renderClozeEx(el);
  });
  el.querySelector('#cloze-new').addEventListener('click', () => {
    clozeState = { type:null, index:0, highWater:-1, score:{correct:0,total:0} };
    renderCompletamento(el);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
async function renderSettings(el) {
  const settings = await API.get('/settings');

  el.innerHTML = `
    <div class="section-title mb-4">Impostazioni</div>

    <div class="card mb-4">
      <div class="card-title mb-4">Obiettivo e livello</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Obiettivo di livello</label>
          <select id="s-goal"><option value="B2" ${settings.goal_level==='B2'?'selected':''}>B2 — Livello intermedio avanzato</option><option value="C1" ${settings.goal_level==='C1'?'selected':''}>C1 — Livello avanzato</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Minuti giornalieri</label>
          <select id="s-mins">
            ${[15,20,30,45,60,90].map(m=>`<option value="${m}" ${settings.daily_minutes==m?'selected':''}>${m} minuti</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Schede nuove al giorno</label>
        <select id="s-cards">
          ${[5,10,15,20,25,30].map(n=>`<option value="${n}" ${settings.daily_new_cards==n?'selected':''}>${n} schede</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Aspetto</div>
      <div class="form-group">
        <label class="form-label">Tema</label>
        <select id="s-theme">
          <option value="auto" ${currentTheme==='auto'?'selected':''}>Automatico (sistema)</option>
          <option value="light" ${currentTheme==='light'?'selected':''}>Chiaro</option>
          <option value="dark" ${currentTheme==='dark'?'selected':''}>Scuro</option>
        </select>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Dati</div>
      <div class="flex gap-2 flex-wrap">
        <a href="/api/export" download class="btn btn-outline">⬇️ Esporta tutti i miei dati</a>
      </div>
      <div class="form-hint mt-2">I dati vengono esportati in formato JSON. Usali come backup o per migrare su un altro dispositivo.</div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-2">Piano di studio consigliato</div>
      <div class="text-sm text-muted" style="line-height:2">
        <strong>Basato sulla ricerca sull'acquisizione delle lingue (Krashen, Nation, Webb):</strong><br>
        — <strong>70%</strong> input comprensibile (lettura + ascolto al livello i+1)<br>
        — <strong>15%</strong> ripetizione spaziata con Anki/flashcard (SM-2)<br>
        — <strong>15%</strong> produzione attiva (scrittura, coniugazioni)<br>
        — <strong>30–45 min/giorno</strong> supera di gran lunga le sessioni lunghe sporadiche<br>
        — Il <strong>congiuntivo</strong> è l'obiettivo grammaticale #1 per i madrelingua spagnoli a B2
      </div>
    </div>

    <button class="btn btn-primary" id="save-settings">Salva impostazioni</button>
  `;

  el.querySelector('#save-settings').addEventListener('click', async () => {
    const newSettings = {
      goal_level: document.getElementById('s-goal').value,
      daily_minutes: document.getElementById('s-mins').value,
      daily_new_cards: document.getElementById('s-cards').value,
      theme: document.getElementById('s-theme').value,
    };
    await API.put('/settings', newSettings);
    applyTheme(newSettings.theme);
    toast('Impostazioni salvate');
  });

  document.getElementById('s-theme').addEventListener('change', e => applyTheme(e.target.value));
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
function showModal(title, bodyHTML, buttons = []) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';

  const btnsHTML = buttons.map((b, i) => `<button class="btn ${b.cls||'btn-outline'}" data-btn-index="${i}">${b.label}</button>`).join('');

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="btn btn-ghost btn-icon btn-sm" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">${btnsHTML}</div>
    </div>`;

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  buttons.forEach((b, i) => {
    overlay.querySelector(`[data-btn-index="${i}"]`).addEventListener('click', async () => {
      if (b.action === 'close') { closeModal(); return; }
      try { await b.action(); } catch(e) { toast(e.message || 'Error', 'error'); }
    });
  });

  document.body.appendChild(overlay);
  overlay.querySelector('input, textarea')?.focus();
}

function closeModal() {
  document.getElementById('active-modal')?.remove();
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Sidebar toggle
  applySidebarState();
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed);
    applySidebarState();
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = { auto:'light', light:'dark', dark:'auto' }[currentTheme] || 'auto';
    applyTheme(next);
  });

  // Nav items
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });

  // Init study timer (loads today's saved time)
  studyTimer.init();

  // Load dashboard stats for topbar
  try {
    const data = await API.get('/stats/dashboard');
    document.getElementById('streak-count').textContent = data.streak || 0;
    if (data.dueCards > 0) {
      const badge = document.getElementById('nav-due-badge');
      const mobileBadge = document.getElementById('mobile-due-badge');
      if (badge) { badge.textContent = data.dueCards; badge.style.display = 'flex'; }
      if (mobileBadge) { mobileBadge.style.display = 'flex'; }
    }
  } catch(e) { /* ignore */ }

  // Navigate to route from hash or default
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);

  // Update hash on navigate
  const origNavigate = navigate;
  window.navigate = (route) => {
    location.hash = route;
    origNavigate(route);
  };
  window.addEventListener('hashchange', () => {
    const r = location.hash.replace('#', '');
    if (r && ROUTES[r] && r !== currentRoute) navigate(r);
  });
});
