/**
 * Feedback — componente visivo unificato per tutti gli esercizi.
 * Funziona sia nel browser (window.Feedback) che in Node.js (module.exports).
 *
 * API pubblica:
 *   Feedback.buildHTML(evaluation, context, opts)  → string HTML (testabile in Node.js)
 *   Feedback.render({ container, evaluation, context, actions, compact })  → void
 */
(function (root) {
  'use strict';

  // ── Configurazione stati ─────────────────────────────────────────────────────
  const STATUS_CFG = {
    correct_exact:                  { cls:'fb-correct',    icon:'✓', role:'status', label:'Corretto' },
    correct_normalized:             { cls:'fb-correct',    icon:'✓', role:'status', label:'Corretto' },
    correct_synonym:                { cls:'fb-synonym',    icon:'✓', role:'status', label:'Sinonimo valido' },
    correct_contextual:             { cls:'fb-contextual', icon:'ⓘ', role:'status', label:'Corretto nel contesto' },
    almost_correct_spelling:        { cls:'fb-almost',     icon:'◐', role:'alert',  label:'Quasi corretto' },
    almost_correct_missing_article: { cls:'fb-almost',     icon:'◐', role:'alert',  label:'Quasi corretto' },
    almost_correct_wrong_article:   { cls:'fb-almost',     icon:'◐', role:'alert',  label:'Quasi corretto' },
    almost_correct_gender:          { cls:'fb-almost',     icon:'◐', role:'alert',  label:'Quasi corretto' },
    almost_correct_number:          { cls:'fb-almost',     icon:'◐', role:'alert',  label:'Quasi corretto' },
    incorrect_related_word:         { cls:'fb-wrong',      icon:'✕', role:'alert',  label:'Parola correlata' },
    incorrect:                      { cls:'fb-wrong',      icon:'✕', role:'alert',  label:'Non corretto' },
    ambiguous:                      { cls:'fb-ambiguous',  icon:'?', role:'status', label:'Domanda ambigua' },
  };

  // ── Escape HTML ──────────────────────────────────────────────────────────────
  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Azioni per stato ─────────────────────────────────────────────────────────
  function defaultActions(status) {
    const base = { showContinue: true, showRetry: false, showNotebook: false, showReport: false };
    if (status === 'ambiguous')                    return { ...base, showReport: true };
    if (status.startsWith('almost_'))              return { ...base, showRetry: true };
    if (status === 'incorrect' || status === 'incorrect_related_word')
      return { ...base, showRetry: true, showNotebook: true };
    return base;
  }

  // ── Generazione HTML ─────────────────────────────────────────────────────────
  /**
   * @param {object} evaluation    — risultato di Evaluator.evaluate()
   * @param {object} [context]     — { exerciseType, example, alternatives }
   * @param {object} [opts]
   * @param {boolean} [opts.compact=false] — layout compatto (no dettaglio risposta)
   * @returns {string} HTML (sicuro, tutto escaped)
   */
  function buildHTML(evaluation, context, opts) {
    context = context || {};
    opts    = opts    || {};
    const compact = opts.compact || false;

    const { status, feedbackTitle, feedbackExplanation,
            userAnswer, targetAnswer, matchedAnswer,
            accepted, secondaryIssues } = evaluation;

    const cfg = STATUS_CFG[status] || STATUS_CFG['incorrect'];
    const title = feedbackTitle || cfg.label;

    // Blocco risposta: mostra solo se non è un esatto o ambiguo
    const showAnswerBlock = !compact
      && !['correct_exact','correct_normalized','ambiguous'].includes(status);

    let answerBlock = '';
    if (showAnswerBlock) {
      const displayed = matchedAnswer || targetAnswer;
      answerBlock = `
        <div class="fb-answer-block">
          <div class="fb-answer-row">
            <span class="fb-answer-label">Hai scritto:</span>
            <span class="fb-answer-value fb-answer-user">${esc(userAnswer)}</span>
          </div>
          <div class="fb-answer-row">
            <span class="fb-answer-label">${accepted ? 'Parola obiettivo:' : 'Risposta corretta:'}</span>
            <span class="fb-answer-value fb-answer-correct">${esc(displayed || targetAnswer)}</span>
          </div>
        </div>`;
    }

    // Spiegazione
    let explanation = '';
    if (feedbackExplanation) {
      explanation = `<p class="fb-explanation">${esc(feedbackExplanation)}</p>`;
    }
    if (status === 'ambiguous' && !feedbackExplanation) {
      explanation = `<p class="fb-explanation">Questa risposta potrebbe essere valida. La domanda non verrà conteggiata nei tuoi progressi.</p>`;
    }

    // Esempio (se disponibile)
    let exampleBlock = '';
    if (context.example) {
      exampleBlock = `
        <details class="fb-example">
          <summary class="fb-example-toggle">Mostra esempio</summary>
          <p class="fb-example-text">${esc(context.example)}</p>
        </details>`;
    }

    // Varianti/alternative
    let alternativesBlock = '';
    if (context.alternatives && context.alternatives.length > 0) {
      alternativesBlock = `<p class="fb-alternatives"><span class="fb-alt-label">Accettato anche:</span> ${
        context.alternatives.map(a => `<em>${esc(a)}</em>`).join(', ')
      }</p>`;
    }

    // Problemi secondari
    let secondaryBlock = '';
    if (secondaryIssues && secondaryIssues.length > 0 && status === 'almost_correct_number') {
      const issues = secondaryIssues.map(i => i === 'article_gender' ? 'genere articolo' : i).join(', ');
      secondaryBlock = `<p class="fb-secondary">Problema aggiuntivo: ${esc(issues)}.</p>`;
    }

    return `<div class="fb-card ${esc(cfg.cls)}" role="${esc(cfg.role)}" aria-live="${cfg.role === 'alert' ? 'assertive' : 'polite'}">
  <div class="fb-header">
    <span class="fb-icon" aria-hidden="true">${cfg.icon}</span>
    <span class="fb-title">${esc(title)}</span>
  </div>
  ${answerBlock}
  ${explanation}
  ${secondaryBlock}
  ${exampleBlock}
  ${alternativesBlock}
  <div class="fb-actions" data-fb-actions></div>
</div>`;
  }

  // ── Render DOM ───────────────────────────────────────────────────────────────
  /**
   * Renderizza il feedback in un elemento DOM e registra le azioni.
   *
   * @param {object} p
   * @param {HTMLElement} p.container    — elemento dove inserire il feedback
   * @param {object}      p.evaluation   — risultato di Evaluator.evaluate()
   * @param {object}      [p.context]    — { example, alternatives, exerciseType }
   * @param {object}      [p.actions]    — { onContinue, onRetry, onOpenNotebook, onReport }
   * @param {boolean}     [p.compact]    — layout compatto
   */
  function render({ container, evaluation, context, actions, compact }) {
    actions = actions || {};
    const html = buildHTML(evaluation, context, { compact });
    container.innerHTML = html;

    const actionsEl = container.querySelector('[data-fb-actions]');
    if (!actionsEl) return;

    const { status } = evaluation;
    const show = defaultActions(status);

    // Bottoni
    const btns = [];
    if (show.showContinue && actions.onContinue) {
      btns.push({ label: 'Continua', cls: 'btn btn-primary', cb: actions.onContinue, primary: true });
    }
    if (show.showRetry && actions.onRetry) {
      btns.push({ label: 'Riprova', cls: 'btn btn-outline btn-sm', cb: actions.onRetry, primary: false });
    }
    if (show.showNotebook && actions.onOpenNotebook) {
      btns.push({ label: 'Apri nel quaderno', cls: 'btn btn-outline btn-sm', cb: actions.onOpenNotebook, primary: false });
    }
    if (show.showReport && actions.onReport) {
      btns.push({ label: 'Segnala', cls: 'btn btn-outline btn-sm', cb: actions.onReport, primary: false });
    }

    // Fallback: se onContinue non è fornito ma il bottone è atteso, aggiungi vuoto
    if (show.showContinue && !actions.onContinue) {
      btns.push({ label: 'Continua', cls: 'btn btn-primary', cb: null, primary: true });
    }

    btns.forEach(({ label, cls, cb, primary }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = cls;
      btn.type = 'button';
      if (primary) btn.setAttribute('data-fb-primary', '');
      if (cb) btn.addEventListener('click', cb);
      actionsEl.appendChild(btn);
    });

    // Autofocus sull'azione primaria (con un breve delay per non rompere il flusso)
    const primary = actionsEl.querySelector('[data-fb-primary]');
    if (primary) setTimeout(() => primary.focus(), 80);

    // Gestione keyboard: Enter sulle azioni
    actionsEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'BUTTON') e.target.click();
    });
  }

  // ── Esporta ──────────────────────────────────────────────────────────────────
  const Feedback = { buildHTML, render, esc, STATUS_CFG, defaultActions };

  if (typeof module !== 'undefined' && module.exports) module.exports = Feedback;
  else root.Feedback = Feedback;

})(typeof globalThis !== 'undefined' ? globalThis : this);
