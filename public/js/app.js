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
  dashboard: { title:'Panel', render: renderDashboard },
  session: { title:'Sesión diaria', render: renderSession },
  flashcards: { title:'Flashcards', render: renderFlashcards },
  vocabulary: { title:'Vocabulario', render: renderVocabulary },
  conjugation: { title:'Conjugaciones', render: renderConjugation },
  grammar: { title:'Gramática', render: renderGrammar },
  writing: { title:'Escritura', render: renderWriting },
  reading: { title:'Lectura', render: renderReading },
  errors: { title:'Cuaderno de errores', render: renderErrors },
  progress: { title:'Progreso', render: renderProgress },
  rewards: { title:'Recompensas', render: renderRewards },
  settings: { title:'Configuración', render: renderSettings },
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
  content.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`;

  ROUTES[route].render(content).catch(err => {
    content.innerHTML = `<div class="alert alert-error">Error al cargar: ${err.message}</div>`;
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
    if (d <= 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d < 7) return `en ${d} días`;
    if (d < 30) return `en ${Math.round(d/7)} sem.`;
    return `en ${Math.round(d/30)} mes.`;
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
        <div class="section-sub">Objetivo: ${data.goalLevel} · Meta diaria: ${data.dailyGoalMinutes} minutos</div>
      </div>
      <button class="btn btn-primary" data-route="session">Iniciar sesión →</button>
    </div>

    <!-- Quick stats -->
    <div class="grid-4 mb-4">
      <div class="stat-tile stat-tile-accent">
        <div class="stat-tile-label">Racha actual</div>
        <div class="stat-tile-value">🔥 ${data.streak}</div>
        <div class="stat-tile-sub">Mejor: ${data.bestStreak} días</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Palabras aprendidas</div>
        <div class="stat-tile-value">${fmt.num(data.learnedWords)}</div>
        <div class="stat-tile-sub">de ${fmt.num(data.totalWords)} total</div>
      </div>
      <div class="stat-tile ${data.dueCards > 0 ? 'stat-tile-gold' : ''}">
        <div class="stat-tile-label">Repasos pendientes</div>
        <div class="stat-tile-value">${data.dueCards}</div>
        <div class="stat-tile-sub">flashcards vencidas</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Hoy estudiado</div>
        <div class="stat-tile-value">${Math.round(data.todayMinutes)}min</div>
        <div class="stat-tile-sub">Meta: ${data.dailyGoalMinutes} min</div>
      </div>
    </div>

    <!-- Today's goal progress -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">Meta de hoy</div>
          <div class="card-subtitle">${data.dailyGoalMinutes} minutos · ${goalPct}% completado</div>
        </div>
        ${data.goalMet ? '<span class="badge badge-green">✓ Meta cumplida</span>' : ''}
      </div>
      ${progressBar(goalPct)}
      <div class="flex justify-between mt-2 text-xs text-muted">
        <span>${Math.round(data.todayMinutes)} min estudiados</span>
        <span>${data.todayCards} flashcards repasadas</span>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <!-- Weak categories -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Áreas débiles</div>
          <button class="btn btn-sm btn-ghost" data-route="progress">Ver todo</button>
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
          </div>`).join('') : '<div class="text-muted text-sm">¡Aún no hay datos suficientes!</div>'}
      </div>

      <!-- Recent errors -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Errores recientes</div>
          <button class="btn btn-sm btn-ghost" data-route="errors">Ver cuaderno</button>
        </div>
        ${data.recentErrors.length ? data.recentErrors.map(e => `
          <div class="mb-3 pb-3 border-b" style="border-bottom:1px solid var(--border)">
            <div class="text-sm italic text-red">${e.original_text.substring(0,60)}${e.original_text.length>60?'…':''}</div>
            <div class="text-xs text-muted mt-1">${e.corrected_text ? '→ '+e.corrected_text.substring(0,50) : ''}</div>
          </div>`).join('') : '<div class="text-muted text-sm">¡Sin errores registrados todavía!</div>'}
      </div>
    </div>

    <!-- Quick actions -->
    <div class="card">
      <div class="card-title mb-4">Acceso rápido</div>
      <div class="grid-3">
        ${[
          { route:'flashcards', icon:'🗃️', label:'Flashcards', sub: data.dueCards+' pendientes' },
          { route:'conjugation', icon:'⚡', label:'Conjugar', sub:'Práctica rápida' },
          { route:'vocabulary', icon:'📖', label:'Vocabulario', sub:'Explorar categorías' },
          { route:'writing', icon:'✍️', label:'Escribir', sub:'Redacción libre' },
          { route:'grammar', icon:'📐', label:'Gramática', sub:'Reglas y ejercicios' },
          { route:'errors', icon:'⚠️', label:'Errores', sub:'Repasar y corregir' },
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
        <div class="section-title">Sesión diaria</div>
        <div class="section-sub">${new Date().toLocaleDateString('es', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="stat-tile ${dueCount > 0 ? 'stat-tile-gold' : ''}">
        <div class="stat-tile-label">Flashcards vencidas</div>
        <div class="stat-tile-value">${dueCount}</div>
        <div class="stat-tile-sub">Necesitan repaso ahora</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Palabras nuevas disponibles</div>
        <div class="stat-tile-value">${newCount}</div>
        <div class="stat-tile-sub">Sin estudiar todavía</div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-2">Plan de sesión sugerido</div>
      <div class="text-sm text-muted mb-4">Basado en tus datos de progreso y objetivos</div>
      <div id="session-plan">
        ${buildSessionPlan(dueCount, newCount)}
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Inicio rápido</div>
      <div class="grid-2">
        <button class="btn btn-primary btn-lg btn-block" id="start-flashcards">
          🗃️ Repasar flashcards ${dueCount > 0 ? `(${dueCount})` : ''}
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-conjugation">
          ⚡ Práctica de conjugación
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-vocab">
          📖 Vocabulario nuevo
        </button>
        <button class="btn btn-outline btn-lg btn-block" id="start-writing">
          ✍️ Ejercicio de escritura
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-title mb-2">Metodología de esta sesión</div>
      <div class="text-sm text-muted" style="line-height:1.8">
        <strong>SM-2</strong> — El algoritmo de repetición espaciada programa cada flashcard según tu rendimiento.<br>
        <strong>70% input · 15% SRS · 15% producción</strong> — Proporción óptima para B1→C1.<br>
        <strong>Constancia</strong> — 30–45 min diarios supera ampliamente a sesiones largas esporádicas.
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
  if (due > 0) steps.push({ icon:'🗃️', label:`Repasar ${Math.min(due, 30)} flashcards vencidas`, mins:10, route:'flashcards' });
  if (newW > 0) steps.push({ icon:'✨', label:`Aprender ${Math.min(newW, 15)} palabras nuevas`, mins:10, route:'flashcards' });
  steps.push({ icon:'⚡', label:'5 ejercicios de conjugación', mins:5, route:'conjugation' });
  steps.push({ icon:'✍️', label:'Escribir 80–120 palabras en italiano', mins:10, route:'writing' });
  steps.push({ icon:'⚠️', label:'Repasar 3 errores del cuaderno', mins:5, route:'errors' });
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
      <span class="text-muted">Duración estimada</span>
      <span class="font-medium text-accent">${total} minutos</span>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// FLASHCARDS
// ══════════════════════════════════════════════════════════════════════════════
let fcState = { cards: [], index: 0, flipped: false, reviewed: 0, correct: 0, mode: 'due', typingMode: false, pendingCategoryId: null, pendingCategoryName: '' };

function showModeModal(el, tab) {
  showModal('¿Cómo quieres estudiar?', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:4px 0">
      <div style="text-align:center;padding:24px 16px;border:1.5px solid var(--border);border-radius:12px">
        <div style="font-size:2.8rem">🃏</div>
        <div style="font-weight:700;margin-top:10px;font-size:1rem">Clásico</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;line-height:1.4">Voltea la tarjeta y autoevalúate</div>
      </div>
      <div style="text-align:center;padding:24px 16px;border:1.5px solid var(--border);border-radius:12px">
        <div style="font-size:2.8rem">✍️</div>
        <div style="font-weight:700;margin-top:10px;font-size:1rem">Escritura</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;line-height:1.4">Ves el español → escribe en italiano con artículo</div>
      </div>
    </div>
  `, [
    { label: '🃏 Clásico', cls: 'btn-outline', action: () => {
      fcState.typingMode = false;
      closeModal();
      loadFlashcards(el, tab);
      document.getElementById('fc-mode-label') && (document.getElementById('fc-mode-label').textContent = '🃏 Clásico');
    }},
    { label: '✍️ Escritura', cls: 'btn-primary', action: () => {
      fcState.typingMode = true;
      closeModal();
      loadFlashcards(el, tab);
      document.getElementById('fc-mode-label') && (document.getElementById('fc-mode-label').textContent = '✍️ Escritura');
    }},
  ]);
}

async function renderFlashcards(el) {
  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Flashcards</div>
        <div class="section-sub">Repetición espaciada SM-2</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" id="fc-mode-change">
          <span id="fc-mode-label">${fcState.typingMode ? '✍️ Escritura' : '🃏 Clásico'}</span> ▾
        </button>
        <button class="btn btn-outline btn-sm" id="fc-add-btn">+ Nueva tarjeta</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-mode="due">Vencidas</button>
      <button class="tab-btn" data-mode="new">Nuevas</button>
      <button class="tab-btn" data-mode="all">Todas</button>
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
        ? '¡Sin repasos pendientes! Vuelve mañana o estudia tarjetas nuevas.'
        : '¡Has estudiado todas las palabras disponibles!';
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
        <button class="btn btn-outline" id="vf-prev" ${idx===0?'disabled':''}>← Anterior</button>
        <button class="btn btn-primary" id="vf-next">${idx < verbs.length-1 ? 'Siguiente →' : 'Terminare ✓'}</button>
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
    const modeLabel = fcState.typingMode ? 'Modo Escritura' : 'Modo Clásico';
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:3rem;margin-bottom:16px">🎯</div>
        <div class="section-title mb-2">Sesión completada</div>
        <div class="text-muted mb-1">${modeLabel}</div>
        <div class="text-muted mb-4">${fcState.reviewed} tarjetas · ${acc}% de aciertos</div>
        <div class="grid-2 mb-4" style="max-width:300px;margin:0 auto">
          <div class="stat-tile"><div class="stat-tile-label">Repasadas</div><div class="stat-tile-value">${fcState.reviewed}</div></div>
          <div class="stat-tile stat-tile-accent"><div class="stat-tile-label">Aciertos</div><div class="stat-tile-value">${acc}%</div></div>
        </div>
        <button class="btn btn-primary" onclick="navigate('dashboard')">Volver al panel</button>
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
  const nextReview = card.interval > 0 ? `Intervalo: ${card.interval} días` : 'Tarjeta nueva';

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
          <div class="flashcard-tap-hint">Toca para ver la respuesta</div>
        </div>
        <div class="flashcard-face flashcard-back">
          <div class="flashcard-word" style="color:var(--accent)">${card.back}</div>
          ${card.example_it ? `<div class="flashcard-example"><em>${card.example_it}</em><br><span class="text-muted">${card.example_es||''}</span></div>` : ''}
          ${card.notes ? `<div class="text-xs text-muted" style="margin-top:8px">${card.notes}</div>` : ''}
        </div>
      </div>
    </div>

    <div id="fc-actions" class="mt-4" style="display:none">
      <div class="text-center text-sm text-muted mb-3">¿Cómo te fue?</div>
      <div class="fc-quality-btns">
        <button class="fc-quality-btn q-0" data-q="0">❌<span>No la recordé</span></button>
        <button class="fc-quality-btn q-1" data-q="1">😓<span>Con dificultad</span></button>
        <button class="fc-quality-btn q-3" data-q="3">🙂<span>Bien</span></button>
        <button class="fc-quality-btn q-5" data-q="5">⚡<span>Muy fácil</span></button>
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
      } catch(e) { toast('Error al guardar repaso', 'error'); }
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
      <span>${card.interval > 0 ? 'Intervalo: '+card.interval+' días' : 'Tarjeta nueva'}</span>
    </div>
    ${progressBar(progress)}
    <div style="height:16px"></div>

    <div class="fc-typing-card" id="fc-typing-card">
      <div class="fc-typing-lang">Español → Italiano</div>
      ${card.category_icon ? `<div class="fc-typing-cat">${card.category_icon} ${card.category_name||''}</div>` : ''}
      <div class="fc-typing-word">${card.back}</div>
      <div class="fc-typing-hint">Escribe con artículo (ej: <em>il cane</em>, <em>la casa</em>, <em>l'uomo</em>)</div>
      <div class="fc-typing-input-wrap">
        <input id="fc-type-input" class="fc-typing-input" placeholder="artículo + palabra..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button class="btn btn-primary" id="fc-type-check">Comprobar</button>
      </div>
      <div id="fc-type-result" style="display:none;margin-top:12px"></div>
      <div id="fc-type-example" style="display:none;margin-top:8px;font-size:0.85rem" class="flashcard-example"></div>
    </div>

    <div class="flex gap-2 justify-center mt-3" id="fc-type-actions">
      <button class="btn btn-outline btn-sm" id="fc-type-skip">Saltar</button>
      <button class="btn btn-primary" id="fc-type-next" style="display:none">Siguiente → <span style="opacity:.6;font-size:0.8em">→</span></button>
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
      resultEl.innerHTML = `<div class="fc-type-feedback correct">✓ ¡Correcto!</div>`;
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
    } catch(e) { toast('Error al guardar', 'error'); }

    document.getElementById('fc-type-check').style.display = 'none';
    const nextBtn = document.getElementById('fc-type-next');
    nextBtn.style.display = 'inline-flex';
    document.getElementById('fc-key-hint').textContent = '→ tecla derecha para siguiente';
    document.getElementById('fc-key-hint').style.display = 'block';

    // ArrowRight to advance
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        document.removeEventListener('keydown', onKey);
        goNext();
      }
    };
    document.addEventListener('keydown', onKey);
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
      <input type="search" id="word-search" placeholder="Buscar palabra..." style="max-width:300px">
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
  showModal('Nueva flashcard', `
    <div class="form-group"><label class="form-label">Frente (italiano)</label><input id="fc-front" placeholder="es. andare"></div>
    <div class="form-group"><label class="form-label">Reverso (español)</label><input id="fc-back" placeholder="es. ir"></div>
  `, [
    { label:'Cancelar', action:'close', cls:'btn-outline' },
    { label:'Crear tarjeta', action: async () => {
      const front = document.getElementById('fc-front').value.trim();
      const back = document.getElementById('fc-back').value.trim();
      if (!front || !back) { toast('Completa ambos campos', 'error'); return; }
      await API.post('/flashcards', { front, back });
      toast('Tarjeta creada');
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
        <div class="section-title">Vocabulario</div>
        <div class="section-sub">${categories.length} categorías · ${categories.reduce((s,c)=>s+c.word_count,0)} palabras</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" id="add-word-btn">+ Añadir palabra</button>
        <button class="btn btn-outline btn-sm" id="add-cat-btn">+ Categoría</button>
      </div>
    </div>

    <div class="mb-4">
      <input type="search" id="cat-search" placeholder="Buscar categoría..." style="max-width:320px">
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
      <div class="category-count">${c.word_count} palabras · ${c.learned_count||0} aprendidas</div>
      ${progressBar(pct)}
      <div class="category-progress-text">
        <span>${pct}% dominado</span>
        ${c.next_review ? `<span>próx. repaso ${fmt.interval(Math.max(0,(c.next_review-Date.now()/1000)))}</span>` : ''}
      </div>
    </div>`;
}

async function openCategory(el, catId) {
  showModal('Cargando...', `<div class="loading"><div class="spinner"></div></div>`, []);
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
      <input type="search" id="cat-word-filter" placeholder="Filtrar palabras..." style="width:100%">
    </div>
    <div class="word-list" id="cat-word-list" style="max-height:55dvh;overflow-y:auto">
      ${words.map(w => wordItemHTML(w)).join('')}
    </div>`;

  closeModal();
  showModal(`${cat?.icon||'📚'} ${cat?.name||'Categoría'} · ${words.length} palabras`, bodyHTML, [
    { label: '🃏 Clásico', cls: 'btn-outline', action: () => {
      fcState.typingMode = false;
      fcState.pendingCategoryId = catId;
      closeModal();
      navigate('flashcards');
    }},
    { label: '✍️ Escritura', cls: 'btn-primary', action: () => {
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
    ${w.false_friend_note ? `<div class="alert alert-warn mt-2 text-xs">⚠️ <strong>Falso amigo:</strong> ${w.false_friend_note}</div>` : ''}
  `, [
    { label:'Cerrar', action:'close', cls:'btn-outline' },
  ]);
}

function showAddWordModal(categories) {
  showModal('Añadir palabra', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Italiano</label><input id="w-it" placeholder="es. andare"></div>
      <div class="form-group"><label class="form-label">Español</label><input id="w-es" placeholder="es. ir"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Categoría</label>
        <select id="w-cat">${categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Nivel MCER</label>
        <select id="w-lv"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Ejemplo en italiano</label><input id="w-ex-it" placeholder="Vado a Roma."></div>
    <div class="form-group"><label class="form-label">Traducción del ejemplo</label><input id="w-ex-es" placeholder="Voy a Roma."></div>
    <div class="form-group"><label class="form-label">Notas</label><input id="w-notes" placeholder="Observaciones opcionales"></div>
  `, [
    { label:'Cancelar', action:'close', cls:'btn-outline' },
    { label:'Añadir', action: async () => {
      const italian = document.getElementById('w-it').value.trim();
      const spanish = document.getElementById('w-es').value.trim();
      if (!italian || !spanish) { toast('Italiano y español son obligatorios', 'error'); return; }
      await API.post('/vocabulary/words', {
        italian, spanish,
        category_id: parseInt(document.getElementById('w-cat').value),
        cefr_level: document.getElementById('w-lv').value,
        example_it: document.getElementById('w-ex-it').value,
        example_es: document.getElementById('w-ex-es').value,
        notes: document.getElementById('w-notes').value,
      });
      toast('Palabra añadida con flashcard');
      closeModal();
      navigate('vocabulary');
    }, cls:'btn-primary' },
  ]);
}

function showAddCategoryModal() {
  showModal('Nueva categoría', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nombre</label><input id="cat-name" placeholder="Viajes"></div>
      <div class="form-group"><label class="form-label">Emoji</label><input id="cat-icon" placeholder="✈️" style="max-width:80px"></div>
    </div>
  `, [
    { label:'Cancelar', action:'close', cls:'btn-outline' },
    { label:'Crear', action: async () => {
      const name = document.getElementById('cat-name').value.trim();
      const icon = document.getElementById('cat-icon').value.trim() || '📚';
      if (!name) { toast('El nombre es obligatorio', 'error'); return; }
      await API.post('/vocabulary/categories', { name, icon });
      toast('Categoría creada');
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
const TENSE_HINTS = {
  presente: 'Presente Indicativo — ¿Qué hace ahora?',
  imperfetto: 'Imperfetto — Acción pasada habitual o en curso',
  futuro: 'Futuro Semplice — ¿Qué hará?',
  condizionale: 'Condizionale Presente — ¿Qué haría? (vorrei...)',
  congiuntivo: 'Congiuntivo Presente — Penso che... Spero che...',
  passato_prossimo: 'Passato Prossimo — Acción pasada completada',
};
let conjState = { answered: false, streak: 0, correct: 0, total: 0, selectedTenses: [...ALL_TENSES] };
const DRILL_TENSES = ['presente','passato_prossimo','imperfetto','futuro','condizionale','congiuntivo'];
let drillState = { phase:'pick', verb:null, translation:'', conjugations:{}, tenses:[...DRILL_TENSES], tenseIndex:0, mistakes:[], reviewIndex:0, score:{correct:0,total:0}, verbList:[] };

async function renderConjugation(el) {
  const verbs = await API.get('/conjugation/verbs');

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Conjugaciones</div>
        <div class="section-sub">${verbs.length} verbos disponibles</div>
      </div>
      <div class="flex items-center gap-3">
        <div class="stat-tile" style="padding:8px 16px;min-width:0">
          <div class="stat-tile-label">Racha</div>
          <div class="stat-tile-value" id="conj-streak">0</div>
        </div>
        <div class="stat-tile" style="padding:8px 16px;min-width:0">
          <div class="stat-tile-label">Aciertos</div>
          <div class="stat-tile-value" id="conj-acc">—</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="practice">Práctica</button>
      <button class="tab-btn" data-tab="drill">Por verbo</button>
      <button class="tab-btn" data-tab="reference">Referencia</button>
    </div>

    <div id="conj-tab-content">
      <div class="card mb-3" style="padding:12px 16px">
        <div class="text-sm font-medium mb-2" style="color:var(--text-muted)">Tiempos a practicar:</div>
        <div class="flex flex-wrap gap-2" id="tense-pills">
          ${ALL_TENSES.map(t => `
            <button class="tense-pill ${conjState.selectedTenses.includes(t)?'active':''}" data-tense="${t}">
              ${TENSE_LABELS[t]}
            </button>`).join('')}
        </div>
      </div>
      <div id="conj-exercise-area"></div>
    </div>
  `;

  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const pillsCard = document.getElementById('tense-pills').closest('.card');
      if (tab === 'reference') {
        pillsCard.style.display = 'none';
        renderConjugationReference(el, verbs);
      } else if (tab === 'drill') {
        pillsCard.style.display = 'none';
        drillState = { phase:'pick', verb:null, translation:'', conjugations:{}, tenses:[...DRILL_TENSES], tenseIndex:0, mistakes:[], reviewIndex:0, score:{correct:0,total:0}, verbList:verbs };
        renderDrillTab(document.getElementById('conj-tab-content'), verbs);
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
      <div class="conj-prompt">Conjuga en <strong>${ex.tense_display}</strong></div>
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
        <button class="btn btn-outline" id="conj-skip">Saltar</button>
        <button class="btn btn-primary" id="conj-check">Comprobar</button>
        <button class="btn btn-outline" id="conj-retry" style="display:none">Riprova</button>
        <button class="btn btn-outline" id="conj-show" style="display:none">Mostra le risposte</button>
        <button class="btn btn-primary" id="conj-next" style="display:none">Siguiente →</button>
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
    catch(e) { area.innerHTML = `<div class="alert alert-error">Error al cargar verbos</div>`; return; }

    let selectedVerb = null;

    const render = (filter = '') => {
      const q = filter.toLowerCase();
      const filtered = q ? verbsData.filter(({verb, translation}) => verb.includes(q) || translation.toLowerCase().includes(q)) : verbsData;
      area.innerHTML = `
        <div class="card" style="padding:16px 20px">
          <div style="font-weight:600;font-size:1.05rem;margin-bottom:10px">Elige un verbo</div>
          <input id="drill-search" class="input" placeholder="Buscar verbo o traducción..." value="${filter}" style="margin-bottom:8px">
          <div id="drill-verb-list" style="height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
            ${filtered.map(({verb, translation}) => `
              <div class="drill-verb-row ${selectedVerb===verb?'drill-verb-selected':''}" data-verb="${verb}"
                style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border-subtle)">
                <span style="font-weight:500">${verb}</span>
                <span style="color:var(--text-muted);font-size:0.82rem">${translation}</span>
              </div>`).join('')}
            ${filtered.length === 0 ? `<div style="padding:16px;text-align:center;color:var(--text-muted)">Sin resultados</div>` : ''}
          </div>
          ${selectedVerb ? `<div style="margin:8px 0;font-size:0.9rem;color:var(--accent);font-weight:600">✓ ${selectedVerb}</div>` : `<div style="height:28px;margin:4px 0"></div>`}
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Tiempos:</div>
          <div class="flex flex-wrap gap-2 mb-3" id="drill-tense-picks">
            ${DRILL_TENSES.map(t => `<button class="tense-pill ${drillState.tenses.includes(t)?'active':''}" data-t="${t}">${TENSE_LABELS[t]}</button>`).join('')}
          </div>
          <button class="btn btn-primary btn-block" id="drill-start" ${selectedVerb?'':'disabled'}>Empezar →</button>
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
            drillState.mistakes = [];
            drillState.score = { correct: 0, total: 0 };
            drillState.phase = 'practice';
            renderDrillTense(area);
          } catch(e) { toast('Error al cargar verbo', 'error'); }
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

  area.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:0.8rem;color:var(--text-muted)">${progress} — ${drillState.verb} (${drillState.translation})</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">✓ ${drillState.score.correct}/${drillState.score.total}</div>
      </div>
      <div style="font-weight:700;font-size:1.15rem;margin-bottom:4px">${TENSE_LABELS[tense]}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">${TENSE_HINTS[tense]||''}</div>
      <div id="drill-forms">
        ${['io','tu','lui','noi','voi','loro'].map(person => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:40px;font-size:0.9rem;color:var(--text-muted);flex-shrink:0">${person}</div>
            <input class="input drill-input" data-person="${person}"
              placeholder="${person}..."
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              style="flex:1;padding:8px 12px">
            <div class="drill-result" data-person="${person}" style="width:28px;text-align:center;font-size:1.1rem"></div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap-2;margin-top:16px;justify-content:flex-end" id="drill-btns">
        <button class="btn btn-primary" id="drill-check">Comprobar</button>
        <button class="btn btn-outline" id="drill-show" style="display:none">Ver respuestas</button>
        <button class="btn btn-primary" id="drill-next" style="display:none">Siguiente →</button>
      </div>
    </div>
  `;

  const inputs = [...area.querySelectorAll('.drill-input')];
  inputs[0].focus();
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
      const expected = (forms[person]||'').toLowerCase().trim();
      const typed = inp.value.toLowerCase().trim();
      const ok = typed === expected;
      inp.style.borderColor = ok ? 'var(--accent)' : '#ef4444';
      inp.disabled = true;
      area.querySelector(`.drill-result[data-person="${person}"]`).textContent = ok ? '✓' : '✗';
      drillState.score.total++;
      if (ok) { drillState.score.correct++; correct++; }
      else { drillState.mistakes.push({ tense, person, correct: forms[person], typed: inp.value }); }
    });
    document.getElementById('drill-check').style.display = 'none';
    if (correct < inputs.length) document.getElementById('drill-show').style.display = 'inline-flex';
    document.getElementById('drill-next').style.display = 'inline-flex';

    const onKey = e => { if (e.key === 'ArrowRight' || e.key === 'Enter') { document.removeEventListener('keydown', onKey); goNext(); } };
    document.addEventListener('keydown', onKey);
  }

  function goNext() {
    drillState.tenseIndex++;
    renderDrillTense(area);
  }

  document.getElementById('drill-check').addEventListener('click', doCheck);
  document.getElementById('drill-show').addEventListener('click', () => {
    inputs.forEach(inp => {
      if (inp.disabled && inp.style.borderColor.includes('4444')) {
        const person = inp.dataset.person;
        inp.value = forms[person] || '';
        inp.style.borderColor = '#f59e0b';
      }
    });
  });
  document.getElementById('drill-next').addEventListener('click', goNext);
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
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Repaso de errores — ${drillState.reviewIndex+1}/${total}</div>
      <div style="font-weight:700;font-size:1.1rem;margin-bottom:2px">${drillState.verb} — ${TENSE_LABELS[mistake.tense]}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Sujeto: <strong>${mistake.person}</strong></div>
      <div style="margin-bottom:12px">
        <input id="drill-retry-input" class="input" placeholder="${mistake.person}..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          style="width:100%;font-size:1.1rem">
      </div>
      <div id="drill-retry-result" style="min-height:32px;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-primary" id="drill-retry-check">Comprobar</button>
        <button class="btn btn-primary" id="drill-retry-next" style="display:none">Siguiente →</button>
      </div>
    </div>
  `;

  const inp = document.getElementById('drill-retry-input');
  inp.focus();

  function doRetryCheck() {
    const typed = inp.value.toLowerCase().trim();
    const expected = (mistake.correct||'').toLowerCase().trim();
    const ok = typed === expected;
    inp.disabled = true;
    inp.style.borderColor = ok ? 'var(--accent)' : '#ef4444';
    const res = document.getElementById('drill-retry-result');
    if (ok) res.innerHTML = `<span style="color:var(--accent);font-weight:600">✓ ¡Correcto!</span>`;
    else res.innerHTML = `<span style="color:#ef4444">✗ Risposta: <strong>${mistake.correct}</strong></span>`;
    document.getElementById('drill-retry-check').style.display = 'none';
    document.getElementById('drill-retry-next').style.display = 'inline-flex';
    const onKey = e => { if (e.key === 'ArrowRight'||e.key==='Enter') { document.removeEventListener('keydown',onKey); goRetryNext(); } };
    document.addEventListener('keydown', onKey);
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
  area.innerHTML = `
    <div class="card" style="text-align:center;padding:32px 24px">
      <div style="font-size:2.5rem;margin-bottom:8px">${emoji}</div>
      <div style="font-size:1.3rem;font-weight:700;margin-bottom:4px">${drillState.verb}</div>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:20px">${drillState.translation}</div>
      <div style="font-size:2rem;font-weight:700;color:${pct>=80?'var(--accent)':'#f59e0b'};margin-bottom:4px">${pct}%</div>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:24px">${correct} / ${total} correctas</div>
      ${drillState.mistakes.length > 0 ? `
        <div style="text-align:left;margin-bottom:20px">
          <div style="font-weight:600;margin-bottom:8px;font-size:0.9rem">Errores:</div>
          ${[...new Map(drillState.mistakes.map(m=>[`${m.tense}-${m.person}`,m])).values()].map(m => `
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;padding:4px 8px;background:var(--bg-secondary);border-radius:6px">
              <span style="color:var(--text-muted)">${TENSE_LABELS[m.tense]} — ${m.person}</span>
              <span style="font-weight:600">${m.correct}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-outline" id="drill-again">Repetir verbo</button>
        <button class="btn btn-primary" id="drill-new">Nuevo verbo</button>
      </div>
    </div>
  `;

  document.getElementById('drill-again').addEventListener('click', () => {
    drillState.tenseIndex = 0; drillState.mistakes = []; drillState.score = {correct:0,total:0}; drillState.phase = 'practice';
    renderDrillTense(area);
  });
  document.getElementById('drill-new').addEventListener('click', () => {
    drillState.phase = 'pick';
    renderDrillTab(null, drillState.verbList || []);
  });
}

function renderConjugationReference(el, verbs) {
  const area = document.getElementById('conj-tab-content');
  area.innerHTML = `
    <div class="card">
      <div class="card-title mb-3">Referencia de verbos</div>
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
  { id:'articles', title:'Artículos definidos e indefinidos', level:'A2', desc:'Il/la/lo/l\'/i/gli/le — un/una/uno/un\'', content: `
    <h3 style="margin-bottom:12px">Artículos definidos</h3>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Género/Número</th><th>Uso</th><th>Ejemplo</th></tr>
      <tr><td>il</td><td>Masc. sing. — consonante normal</td><td>il libro, il cane</td></tr>
      <tr><td>lo</td><td>Masc. sing. — s+cons., z, gn, ps, x, y</td><td>lo studente, lo zaino</td></tr>
      <tr><td>l'</td><td>Masc./Fem. sing. — vocal</td><td>l'amico, l'amica</td></tr>
      <tr><td>la</td><td>Fem. sing. — consonante</td><td>la casa, la donna</td></tr>
      <tr><td>i</td><td>Masc. plural — consonante normal</td><td>i libri, i cani</td></tr>
      <tr><td>gli</td><td>Masc. plural — vocal, s+cons., z...</td><td>gli studenti, gli amici</td></tr>
      <tr><td>le</td><td>Fem. plural</td><td>le case, le amiche</td></tr>
    </table></div>
    <div class="alert alert-info mt-4">🇪🇸 Diferencia del español: el italiano tiene más formas. Además, los posesivos requieren artículo: <strong>il mio libro</strong> (no ~~mio libro~~), excepto en singular con familiares próximos: <em>mia madre, mio padre, mia sorella</em>.</div>
  `},
  { id:'prepositions', title:'Preposiciones articuladas', level:'A2', desc:'del, dello, della, nel, nel...', content: `
    <h3 style="margin-bottom:12px">Preposizioni articolate</h3>
    <p class="text-sm text-muted mb-3">En italiano, las preposiciones simples se combinan con el artículo definido para formar una sola palabra.</p>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Prep.</th><th>+il</th><th>+lo</th><th>+l'</th><th>+la</th><th>+i</th><th>+gli</th><th>+le</th></tr>
      <tr><td><strong>di</strong></td><td>del</td><td>dello</td><td>dell'</td><td>della</td><td>dei</td><td>degli</td><td>delle</td></tr>
      <tr><td><strong>a</strong></td><td>al</td><td>allo</td><td>all'</td><td>alla</td><td>ai</td><td>agli</td><td>alle</td></tr>
      <tr><td><strong>da</strong></td><td>dal</td><td>dallo</td><td>dall'</td><td>dalla</td><td>dai</td><td>dagli</td><td>dalle</td></tr>
      <tr><td><strong>in</strong></td><td>nel</td><td>nello</td><td>nell'</td><td>nella</td><td>nei</td><td>negli</td><td>nelle</td></tr>
      <tr><td><strong>su</strong></td><td>sul</td><td>sullo</td><td>sull'</td><td>sulla</td><td>sui</td><td>sugli</td><td>sulle</td></tr>
    </table></div>
    <div class="alert alert-warn mt-4">⚠️ En español solo existen <strong>del</strong> (de+el) y <strong>al</strong> (a+el). En italiano el sistema es completo para todas las preposiciones principales.</div>
  `},
  { id:'congiuntivo', title:'Il Congiuntivo', level:'B2', desc:'Penso che... Sebbene... Nonostante...', content: `
    <h3 style="margin-bottom:12px">El Congiuntivo — el reto más importante para hispanohablantes</h3>
    <p class="text-sm mb-3">El congiuntivo italiano se usa más que el subjuntivo español. Fíjate en los contextos:</p>
    <div class="mb-4">
      <div class="font-medium mb-2">1. Tras verbos de opinión, sentimiento, voluntad + <em>che</em></div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        Penso <strong>che sia</strong> giusto. (Creo que es correcto)<br>
        Spero <strong>che tu venga</strong>. (Espero que vengas)<br>
        Voglio <strong>che tu stia</strong> bene. (Quiero que estés bien)
      </div>
    </div>
    <div class="mb-4">
      <div class="font-medium mb-2">2. Tras conectores concesivos y finales</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Sebbene/Benché/Nonostante</strong> sia stanco, continuo. (Aunque esté cansado)<br>
        <strong>Affinché</strong> tu capisca... (Para que entiendas)<br>
        <strong>Prima che</strong> arrivi... (Antes de que llegue)
      </div>
    </div>
    <div class="mb-3">
      <div class="font-medium mb-2">Irregulares esenciales</div>
      <div class="overflow-auto"><table class="conj-table">
        <tr><th>Infinitivo</th><th>io/tu/lui</th><th>noi</th><th>voi</th><th>loro</th></tr>
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
    <h3 style="margin-bottom:12px">Las tres frases condicionales del italiano</h3>
    <div class="mb-4">
      <div class="badge badge-green mb-2">Tipo I — Real/Posible</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + presente → futuro (o presente)</strong><br>
        <em>Se studi, <strong>passerai</strong> l'esame.</em> (Si estudias, pasarás el examen)
      </div>
    </div>
    <div class="mb-4">
      <div class="badge badge-blue mb-2">Tipo II — Improbable</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + congiuntivo imperfetto → condizionale presente</strong><br>
        <em>Se <strong>studiassi</strong>, <strong>passerei</strong> l'esame.</em> (Si estudiara, pasaría el examen)
      </div>
    </div>
    <div class="mb-4">
      <div class="badge badge-red mb-2">Tipo III — Imposible (pasado)</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <strong>Se + congiuntivo trapassato → condizionale passato</strong><br>
        <em>Se <strong>avessi studiato</strong>, <strong>avrei passato</strong> l'esame.</em> (Si hubiera estudiado, habría pasado)
      </div>
    </div>
    <div class="alert alert-warn">⚠️ Mixto (muy italiano): <em>Se avessi studiato, <strong>passeresti</strong> l'esame adesso.</em> — Cond. pasado + Cond. presente</div>
  `},
  { id:'ne_ci', title:'Le particelle NE e CI', level:'B1', desc:'Ne ho tre. Ci penso. Non ci credo.', content: `
    <h3 style="margin-bottom:12px">Ne y Ci — dos partículas sin equivalente directo en español</h3>
    <div class="mb-4">
      <div class="font-medium mb-2">NE — partitivo y de referencia</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <em>Quanti libri hai? <strong>Ne</strong> ho tre.</em> (¿Cuántos libros tienes? Tengo tres <em>de ellos</em>)<br>
        <em>Parliamo di politica? Preferirei non <strong>parlarne</strong>.</em> (¿Hablamos de política? Preferiría no hablar <em>de eso</em>)<br>
        <em><strong>Ne</strong> ho abbastanza!</em> (¡Ya estoy harto! / ¡Tengo suficiente <em>de ello</em>!)
      </div>
    </div>
    <div class="mb-4">
      <div class="font-medium mb-2">CI — locativo y de referencia a idea</div>
      <div class="bg-surface-2 p-3 rounded text-sm" style="background:var(--surface-2)">
        <em>Vai a Roma? Sì, <strong>ci</strong> vado domani.</em> (¿Vas a Roma? Sí, voy <em>allí</em> mañana)<br>
        <em><strong>Ci</strong> penso.</em> (Lo pienso / Pienso en <em>ello</em>)<br>
        <em>Non <strong>ci</strong> credo.</em> (No me lo creo / No creo en <em>ello</em>)<br>
        <em><strong>Ce la</strong> fai?</em> (¿Puedes? / ¿Te las arreglas?)
      </div>
    </div>
  `},
  { id:'false_friends', title:'Falsi Amici', level:'B1', desc:'Burro, caldo, camera, parente...', content: `
    <h3 style="margin-bottom:12px">Los falsos amigos más peligrosos para hispanohablantes</h3>
    <div class="overflow-auto"><table class="conj-table">
      <tr><th>Italiano</th><th>Parece que significa...</th><th>En realidad significa</th><th>El español es...</th></tr>
      <tr><td><strong>il burro</strong></td><td>el burro</td><td class="text-accent">la mantequilla</td><td>l'asino / il somaro</td></tr>
      <tr><td><strong>caldo</strong></td><td>el caldo (sopa)</td><td class="text-accent">caliente</td><td>il brodo</td></tr>
      <tr><td><strong>la camera</strong></td><td>la cámara</td><td class="text-accent">la habitación</td><td>la macchina fotografica</td></tr>
      <tr><td><strong>il parente</strong></td><td>el padre/la madre</td><td class="text-accent">el familiar</td><td>i genitori</td></tr>
      <tr><td><strong>sensibile</strong></td><td>sensato</td><td class="text-accent">sensible (emocional)</td><td>ragionevole / sensato</td></tr>
      <tr><td><strong>annoiare</strong></td><td>molestar</td><td class="text-accent">aburrir</td><td>irritare / infastidire</td></tr>
      <tr><td><strong>pretendere</strong></td><td>pretender (fingir)</td><td class="text-accent">exigir / reclamar</td><td>fingere</td></tr>
      <tr><td><strong>morbido</strong></td><td>mórbido</td><td class="text-accent">suave / blando</td><td>morboso</td></tr>
      <tr><td><strong>conveniente</strong></td><td>conveniente</td><td class="text-accent">barato / económico</td><td>adeguato / opportuno</td></tr>
      <tr><td><strong>il pavimento</strong></td><td>el pavimento</td><td class="text-accent">el suelo interior</td><td>il selciato / l'asfalto</td></tr>
    </table></div>
  `},
];

async function renderGrammar(el) {
  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Gramática</div>
        <div class="section-sub">Ruta progresiva B1 → C1</div>
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
        <button class="btn btn-ghost btn-sm mb-4" id="back-grammar">← Volver</button>
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
        <div class="section-title">Escritura</div>
        <div class="section-sub">Redacción y producción escrita en italiano</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-wtab="new">Nuevo ejercicio</button>
      <button class="tab-btn" data-wtab="history">Historial</button>
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
      <div class="writing-prompt-label">Propuesta de ejercicio</div>
      <div class="writing-prompt-text">${prompt?.prompt || 'Escribe un texto libre en italiano.'}</div>
      <div class="writing-meta">
        <span>Tipo: ${prompt?.type || 'libre'}</span>
        <span>Objetivo: mín. 80 palabras</span>
      </div>
    </div>

    <div class="card mb-4">
      <label class="form-label">Tu texto en italiano</label>
      <textarea id="writing-text" placeholder="Scrivi qui il tuo testo in italiano..." style="min-height:200px"></textarea>
      <div class="flex justify-between mt-2">
        <span class="text-xs text-muted" id="word-count">0 palabras</span>
        <span class="text-xs text-muted">Escribe en italiano, sin traducir mentalmente desde el español.</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <button class="btn btn-primary" id="save-writing">Guardar y revisar</button>
      <button class="btn btn-outline" id="new-prompt-btn">Otro ejercicio</button>
    </div>

    <div class="card">
      <div class="card-title mb-2">Consejos para este ejercicio</div>
      <ul class="text-sm text-muted" style="padding-left:20px;line-height:2">
        <li>Usa vocabulario que hayas aprendido recientemente en tus flashcards</li>
        <li>Practica los tiempos verbales que estudias en conjugaciones</li>
        <li>Intenta usar al menos 2 conectores: <em>tuttavia, inoltre, quindi, sebbene...</em></li>
        <li>Escribe primero sin corrección, luego relée</li>
      </ul>
    </div>
  `;

  const textarea = tab.querySelector('#writing-text');
  textarea.addEventListener('input', () => {
    const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    document.getElementById('word-count').textContent = `${words} palabra${words!==1?'s':''}`;
  });

  tab.querySelector('#save-writing').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (text.length < 20) { toast('El texto es demasiado corto', 'error'); return; }
    try {
      if (prompt?.id) {
        await API.put(`/writing/exercises/${prompt.id}`, { user_text: text });
      } else {
        await API.post('/writing/exercises', { prompt: 'Texto libre', type: 'free' });
      }
      toast('Texto guardado. ¡Buen trabajo!');
      textarea.value = '';
    } catch(e) {
      toast('Error al guardar', 'error');
    }
  });

  tab.querySelector('#new-prompt-btn').addEventListener('click', () => navigate('writing'));
}

function renderWritingHistory(el, exercises) {
  const tab = document.getElementById('writing-tab');
  const completed = exercises.filter(e => e.user_text);
  tab.innerHTML = `
    <div class="section-sub mb-4">${completed.length} textos escritos</div>
    ${completed.length ? completed.map(e => `
      <div class="card mb-3">
        <div class="flex justify-between mb-2">
          <span class="badge badge-gray">${e.type}</span>
          <span class="text-xs text-muted">${fmt.date(e.created_at*1000)}</span>
        </div>
        <div class="text-sm text-muted mb-2 italic">"${e.prompt.substring(0,80)}..."</div>
        <div class="text-sm" style="line-height:1.8">${e.user_text?.substring(0,200)}${(e.user_text?.length||0)>200?'…':''}</div>
        <div class="text-xs text-muted mt-2">${e.word_count} palabras</div>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-icon">✍️</div><div class="empty-state-title">Aún no has escrito ningún texto</div></div>'}
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
      { q:'¿Por qué es importante hablar una lengua extranjera?', a:'Permite comunicarse con personas de diferentes países, abre oportunidades de trabajo y enriquece la comprensión cultural.' },
      { q:'¿Cuál es el mejor método para aprender según los expertos?', a:'La inmersión total: vivir en el país, hablar con nativos y leer mucho.' },
      { q:'¿Qué dice el texto sobre la constancia?', a:'Es mejor estudiar 30 minutos cada día que 3 horas una vez por semana.' },
    ]},
  { id:2, title:"Il caffè italiano", level:'A2', text:`Il caffè è parte integrante della cultura italiana. Gli italiani bevono il caffè in modo molto diverso rispetto ad altri paesi.

Il caffè espresso è la bevanda più comune: si beve in piedi al bancone del bar, in pochi secondi. È piccolo, concentrato e molto forte.

Al mattino, gli italiani preferiscono il cappuccino o il caffè latte. Dopo pranzo e dopo cena, invece, si beve solo l'espresso. Ordinare un cappuccino dopo pranzo in Italia potrebbe sembrare strano ai locali.

Il bar italiano non è solo un posto dove bere il caffè. È un luogo di incontro sociale, dove le persone si fermano per chiacchierare e iniziare la giornata.`,
    questions: [
      { q:'¿Cómo beben el espresso los italianos?', a:'De pie en la barra del bar, en pocos segundos.' },
      { q:'¿Qué bebida es rara ordenar después del almuerzo?', a:'El cappuccino.' },
      { q:'¿Qué función social tiene el bar italiano?', a:'Es un lugar de encuentro donde la gente se detiene a charlar y comenzar el día.' },
    ]},
];

async function renderReading(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Lectura</div>
    </div>
    <div id="reading-content">
      <div class="grid-2">
        ${READING_TEXTS.map(t => `
          <div class="card" style="cursor:pointer" data-text-id="${t.id}">
            <div class="flex justify-between mb-2">
              ${cefrBadge(t.level)}
              <span class="text-xs text-muted">${t.text.split(' ').length} palabras</span>
            </div>
            <div class="font-medium mb-1">${t.title}</div>
            <div class="text-sm text-muted">${t.text.substring(0,100)}...</div>
          </div>`).join('')}
        <div class="card" style="border-style:dashed;display:flex;align-items:center;justify-content:center;padding:32px;color:var(--text-3)">
          <div style="text-align:center">
            <div style="font-size:2rem;margin-bottom:8px">+</div>
            <div class="text-sm">Más textos próximamente</div>
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
    <button class="btn btn-ghost btn-sm mb-4" id="back-reading">← Volver</button>
    <div class="card mb-4">
      <div class="flex items-center gap-2 mb-4">
        <div class="section-title">${text.title}</div>
        ${cefrBadge(text.level)}
      </div>
      <div style="line-height:2;font-size:0.95rem">${text.text.split('\n\n').map(p=>`<p style="margin-bottom:1em">${p}</p>`).join('')}</div>
    </div>

    <div class="card">
      <div class="card-title mb-3">Comprensión lectora</div>
      ${text.questions.map((q, i) => `
        <div class="mb-4">
          <div class="font-medium text-sm mb-2">${i+1}. ${q.q}</div>
          <textarea placeholder="Escribe tu respuesta en español..." style="min-height:60px" data-answer="${q.a}" class="answer-area"></textarea>
          <div class="answer-reveal text-sm text-accent mt-2" style="display:none">✓ ${q.a}</div>
        </div>`).join('')}
      <button class="btn btn-outline btn-sm" id="reveal-answers">Ver respuestas</button>
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
        <div class="section-title">Cuaderno de errores</div>
        <div class="section-sub">${errors.length} errores registrados</div>
      </div>
      <button class="btn btn-outline btn-sm" id="add-error-btn">+ Registrar error</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-etab="pending">Pendientes</button>
      <button class="tab-btn" data-etab="all">Todos</button>
      <button class="tab-btn" data-etab="mastered">Corregidos</button>
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
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${filter==='mastered'?'🏆':'✅'}</div><div class="empty-state-title">${filter==='mastered'?'Aún no has corregido errores completamente':'¡Sin errores pendientes!'}</div></div>`;
      return;
    }

    list.innerHTML = filtered.map(e => `
      <div class="error-item ${e.mastery===2?'mastered':''}" data-id="${e.id}">
        <div class="flex justify-between mb-1">
          <span class="badge ${['badge-gray','badge-orange','badge-green'][e.mastery||0]}">${['Aprendiendo','En progreso','Corregido'][e.mastery||0]}</span>
          <span class="badge badge-${e.importance===3?'red':e.importance===2?'orange':'gray'}">${['','Baja','Media','Alta'][e.importance||2]}</span>
        </div>
        <div class="error-original">"${e.original_text}"</div>
        ${e.corrected_text ? `<div class="error-corrected">→ "${e.corrected_text}"</div>` : ''}
        ${e.explanation ? `<div class="error-explanation">${e.explanation}</div>` : ''}
        <div class="error-meta">
          <span class="badge badge-gray">${e.category}</span>
          <span class="text-xs text-muted">${e.times_seen}x visto</span>
          ${e.times_correct > 0 ? `<span class="text-xs text-accent">${e.times_correct}x correcto</span>` : ''}
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-sm btn-primary review-correct-btn" data-id="${e.id}">✓ Lo tengo</button>
          <button class="btn btn-sm btn-outline review-wrong-btn" data-id="${e.id}">✗ Aún me cuesta</button>
          <button class="btn btn-sm btn-ghost delete-error-btn" data-id="${e.id}">Eliminar</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.review-correct-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await API.post(`/errors/${btn.dataset.id}/review`, { correct: true });
        toast('¡Progreso registrado!');
        navigate('errors');
      });
    });
    list.querySelectorAll('.review-wrong-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await API.post(`/errors/${btn.dataset.id}/review`, { correct: false });
        toast('Repaso programado');
        navigate('errors');
      });
    });
    list.querySelectorAll('.delete-error-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este error?')) return;
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
          ${words.length ? `<div class="word-list">${wordRows}</div>${words.length>30?`<div class="text-xs text-muted mt-2">+${words.length-30} más</div>`:''}` : '<div class="text-sm text-muted">Nessuna parola</div>'}
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
    showModal('Registrar error', `
      <div class="form-group"><label class="form-label">Texto original (incorrecto)</label><textarea id="err-orig" rows="2" placeholder="Ho freddo. Sto freddo."></textarea></div>
      <div class="form-group"><label class="form-label">Corrección</label><input id="err-corr" placeholder="Ho freddo."></div>
      <div class="form-group"><label class="form-label">Explicación</label><textarea id="err-expl" rows="2" placeholder="Usar 'avere' para sensaciones físicas, no 'stare'"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Categoría</label>
          <select id="err-cat"><option>grammar</option><option>vocabulary</option><option>conjugation</option><option>false_friend</option><option>other</option></select>
        </div>
        <div class="form-group"><label class="form-label">Importancia</label>
          <select id="err-imp"><option value="1">Baja</option><option value="2" selected>Media</option><option value="3">Alta</option></select>
        </div>
      </div>
    `, [
      { label:'Cancelar', action:'close', cls:'btn-outline' },
      { label:'Registrar', action: async () => {
        const orig = document.getElementById('err-orig').value.trim();
        if (!orig) { toast('El texto original es obligatorio', 'error'); return; }
        await API.post('/errors', {
          original_text: orig,
          corrected_text: document.getElementById('err-corr').value.trim(),
          explanation: document.getElementById('err-expl').value.trim(),
          category: document.getElementById('err-cat').value,
          importance: parseInt(document.getElementById('err-imp').value),
        });
        toast('Error registrado');
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
      <div class="section-title">Progreso</div>
    </div>

    <!-- Summary stats -->
    <div class="grid-4 mb-4">
      <div class="stat-tile stat-tile-accent">
        <div class="stat-tile-label">Racha actual</div>
        <div class="stat-tile-value">🔥 ${dashboard.streak}</div>
        <div class="stat-tile-sub">Mejor: ${dashboard.bestStreak}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Palabras aprendidas</div>
        <div class="stat-tile-value">${dashboard.learnedWords}</div>
        <div class="stat-tile-sub">de ${dashboard.totalWords}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-label">Semana actual</div>
        <div class="stat-tile-value">${Math.round(dashboard.weekMinutes)}min</div>
        <div class="stat-tile-sub">${dashboard.weekDays} días activos</div>
      </div>
      <div class="stat-tile ${dashboard.weekAccuracy > 0 ? 'stat-tile-accent' : ''}">
        <div class="stat-tile-label">Precisión semana</div>
        <div class="stat-tile-value">${dashboard.weekAccuracy ? fmt.pct(dashboard.weekAccuracy) : '—'}%</div>
        <div class="stat-tile-sub">en flashcards</div>
      </div>
    </div>

    <!-- Vocabulary by category -->
    <div class="card mb-4">
      <div class="card-title mb-4">Vocabulario por categoría</div>
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
              ${acc !== null ? `<span class="text-xs text-muted">${acc}% aciertos</span>` : ''}
              <span class="text-xs text-muted">${c.learned}/${c.total}</span>
            </div>
          </div>
          ${progressBar(pct)}
        </div>`;
      }).join('')}
    </div>

    <!-- Activity last 30 days -->
    <div class="card mb-4">
      <div class="card-title mb-3">Actividad — últimos 30 días</div>
      <div class="activity-calendar" id="act-calendar"></div>
      <div class="flex gap-4 mt-3 text-xs text-muted">
        <span>🟩 Meta cumplida</span>
        <span>🟦 Estudiaste</span>
        <span>⬜ Sin estudio</span>
      </div>
    </div>

    <!-- Error stats -->
    ${data.errorsByCategory.length ? `
      <div class="card mb-4">
        <div class="card-title mb-3">Errores por categoría</div>
        ${data.errorsByCategory.map(e => `
          <div class="flex items-center gap-3 mb-3">
            <span class="badge badge-gray">${e.category}</span>
            <div style="flex:1">
              ${progressBar(e.total > 0 ? Math.round(e.resolved/e.total*100) : 0)}
            </div>
            <span class="text-xs text-muted">${e.resolved}/${e.total} corregidos</span>
          </div>`).join('')}
      </div>` : ''}

    <!-- Level estimate -->
    <div class="card">
      <div class="card-title mb-3">Estimación de nivel</div>
      <div class="alert alert-info">Esta estimación es orientativa y se basa en tu actividad en la app, no en una evaluación oficial del MCER.</div>
      <div class="mt-3">
        ${[
          { label:'Vocabulario activo', pct: Math.min(100, Math.round((dashboard.learnedWords/500)*100)), note:`${dashboard.learnedWords}/500 palabras para B2` },
          { label:'Consistencia', pct: Math.min(100, Math.round((dashboard.streak/30)*100)), note:`${dashboard.streak}/30 días de racha` },
          { label:'Precisión general', pct: Math.min(100, Math.round((dashboard.weekAccuracy||0)*100)), note:`${fmt.pct(dashboard.weekAccuracy||0)}% en flashcards` },
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
    div.title = ds + (stat ? ` — ${Math.round(stat.minutes_studied)}min` : ' — sin estudio');
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
      <div class="section-title">Recompensas e hitos</div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-rtab="rewards">Mis recompensas</button>
      <button class="tab-btn" data-rtab="milestones">Hitos</button>
    </div>
    <div id="rewards-tab"></div>
  `;

  function showRewardsTab(tab) {
    const rtab = document.getElementById('rewards-tab');
    if (tab === 'rewards') {
      rtab.innerHTML = `
        <div class="flex justify-end mb-4">
          <button class="btn btn-primary btn-sm" id="add-reward-btn">+ Nueva recompensa</button>
        </div>
        ${rewards.length ? rewards.map(r => `
          <div class="card mb-3">
            <div class="flex justify-between mb-2">
              <div class="font-medium">${r.title}</div>
              <span class="badge ${r.earned?'badge-gold':'badge-gray'}">${r.earned?'🏆 Ganada':'Pendiente'}</span>
            </div>
            ${r.description ? `<div class="text-sm text-muted mb-2">${r.description}</div>` : ''}
            <div class="text-xs text-muted mb-2">Requisito: ${r.requirement_type} — ${r.requirement_value}</div>
            ${progressBar(Math.min(100, Math.round((r.current_value/r.requirement_value)*100)))}
            ${r.earned && !r.claimed ? `<button class="btn btn-sm btn-primary mt-2 claim-reward" data-id="${r.id}">Reclamar recompensa</button>` : ''}
          </div>`).join('')
        : '<div class="empty-state"><div class="empty-state-icon">🎁</div><div class="empty-state-title">Crea tu primera recompensa personal</div></div>'}
      `;
      rtab.querySelector('#add-reward-btn')?.addEventListener('click', () => {
        showModal('Nueva recompensa', `
          <div class="form-group"><label class="form-label">Recompensa</label><input id="rw-title" placeholder="Ver una película italiana"></div>
          <div class="form-group"><label class="form-label">Descripción</label><input id="rw-desc" placeholder="Opcional"></div>
          <div class="form-group"><label class="form-label">Objetivo</label><input id="rw-val" type="number" placeholder="7" min="1"></div>
          <div class="form-group"><label class="form-label">Tipo de objetivo</label>
            <select id="rw-type"><option value="days_streak">Días de racha</option><option value="words_learned">Palabras aprendidas</option><option value="sessions">Sesiones completadas</option></select>
          </div>
        `, [
          { label:'Cancelar', action:'close', cls:'btn-outline' },
          { label:'Crear', action: async () => {
            const title = document.getElementById('rw-title').value.trim();
            const val = parseFloat(document.getElementById('rw-val').value);
            if (!title || !val) { toast('Completa todos los campos', 'error'); return; }
            await API.post('/rewards', { title, description: document.getElementById('rw-desc').value, requirement_type: document.getElementById('rw-type').value, requirement_value: val });
            toast('Recompensa creada'); closeModal(); navigate('rewards');
          }, cls:'btn-primary' },
        ]);
      });
      rtab.querySelectorAll('.claim-reward')?.forEach(btn => {
        btn.addEventListener('click', async () => {
          await API.put(`/rewards/${btn.dataset.id}`, { claimed: 1 });
          toast('🎉 ¡Recompensa reclamada!'); navigate('rewards');
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
              ${m.unlocked ? `<div class="text-xs text-accent mt-2">Desbloqueado ${m.unlocked_at ? fmt.date(m.unlocked_at*1000) : ''}</div>` : ''}
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
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
async function renderSettings(el) {
  const settings = await API.get('/settings');

  el.innerHTML = `
    <div class="section-title mb-4">Configuración</div>

    <div class="card mb-4">
      <div class="card-title mb-4">Objetivo y nivel</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Objetivo de nivel</label>
          <select id="s-goal"><option value="B2" ${settings.goal_level==='B2'?'selected':''}>B2 — Nivel intermedio avanzado</option><option value="C1" ${settings.goal_level==='C1'?'selected':''}>C1 — Nivel avanzado</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Minutos diarios</label>
          <select id="s-mins">
            ${[15,20,30,45,60,90].map(m=>`<option value="${m}" ${settings.daily_minutes==m?'selected':''}>${m} minutos</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tarjetas nuevas por día</label>
        <select id="s-cards">
          ${[5,10,15,20,25,30].map(n=>`<option value="${n}" ${settings.daily_new_cards==n?'selected':''}>${n} tarjetas</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Apariencia</div>
      <div class="form-group">
        <label class="form-label">Tema</label>
        <select id="s-theme">
          <option value="auto" ${currentTheme==='auto'?'selected':''}>Automático (sistema)</option>
          <option value="light" ${currentTheme==='light'?'selected':''}>Claro</option>
          <option value="dark" ${currentTheme==='dark'?'selected':''}>Oscuro</option>
        </select>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-4">Datos</div>
      <div class="flex gap-2 flex-wrap">
        <a href="/api/export" download class="btn btn-outline">⬇️ Exportar todos mis datos</a>
      </div>
      <div class="form-hint mt-2">Los datos se exportan en formato JSON. Úsalos como copia de seguridad o para migrar a otro dispositivo.</div>
    </div>

    <div class="card mb-4">
      <div class="card-title mb-2">Plan de estudio recomendado</div>
      <div class="text-sm text-muted" style="line-height:2">
        <strong>Basado en investigación sobre adquisición de idiomas (Krashen, Nation, Webb):</strong><br>
        — <strong>70%</strong> input comprensible (lectura + escucha al nivel i+1)<br>
        — <strong>15%</strong> repetición espaciada con Anki/flashcards (SM-2)<br>
        — <strong>15%</strong> producción activa (escritura, conjugaciones)<br>
        — <strong>30–45 min/día</strong> supera ampliamente a sesiones largas esporádicas<br>
        — El <strong>congiuntivo</strong> es el objetivo gramatical #1 para hispanohablantes en B2
      </div>
    </div>

    <button class="btn btn-primary" id="save-settings">Guardar configuración</button>
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
    toast('Configuración guardada');
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
