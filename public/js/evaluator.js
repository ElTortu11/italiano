/**
 * Evaluator — motore di valutazione risposte per l'app italiano.
 * Funziona sia nel browser (window.Evaluator) che in Node.js (module.exports).
 */
(function (root) {
  'use strict';

  // ── Articoli italiani ────────────────────────────────────────────────────────
  const DEF_ARTICLES  = ["il","lo","la","l'","l’","i","gli","le"];
  const INDEF_ARTICLES = ["un","uno","una","un'","un’"];
  const ALL_ARTICLES  = [...DEF_ARTICLES, ...INDEF_ARTICLES];
  // Sorted longest-first so "gli" is matched before "i", "l'" before "la", etc.
  const ALL_ARTICLES_SORTED = ALL_ARTICLES.slice().sort((a, b) => b.length - a.length);

  // ── Coppie false-positive da non accettare come typo ────────────────────────
  // Parole corte che differiscono di 1 lettera ma hanno significato diverso.
  const SPELLING_BLACKLIST_PAIRS = new Set([
    'pena|pene','anno|hanno','vino|vivo','cara|caro','caso|casso',
    'casa|cassa','pane|pane','sera|sere','bene|pene','la|le','il|lo',
    'ore|are','del|dei','un|uno','fare|faro','male|male',
  ]);
  function inBlacklist(a, b) {
    return SPELLING_BLACKLIST_PAIRS.has(`${a}|${b}`) || SPELLING_BLACKLIST_PAIRS.has(`${b}|${a}`);
  }

  // ── Normalizzazione superficiale ─────────────────────────────────────────────
  /**
   * Rimuove differenze superficiali (maiuscole, spazi, apostrofi, punteggiatura
   * finale) ma NON tocca accenti, articoli, genere o numero.
   */
  function normalizeForComparison(s) {
    if (!s) return '';
    return s
      .normalize('NFC')
      .toLowerCase()
      .trim()
      .replace(/[''`‘’‚‛]/g, "'")  // apostrofi tipografici → retti
      .replace(/[.,!?;:]+$/g, '')                        // punteggiatura finale
      .replace(/\s+/g, ' ');
  }

  // ── Estrazione articolo e lemma ──────────────────────────────────────────────
  function extractArticle(s) {
    const n = normalizeForComparison(s);
    if (n.startsWith("l'")) return "l'";
    for (const art of ALL_ARTICLES_SORTED) {
      if (n === art) continue;
      if (n.startsWith(art + ' ') || n.startsWith(art + "'")) return art;
    }
    return null;
  }

  function stripArticle(s) {
    const n = normalizeForComparison(s);
    if (n.startsWith("l'")) return n.slice(2).trim();
    for (const art of ALL_ARTICLES_SORTED) {
      if (n === art) continue;
      if (n.startsWith(art + ' ')) return n.slice(art.length + 1).trim();
      if (n.startsWith(art + "'")) return n.slice(art.length + 1).trim();
    }
    return n;
  }

  // ── Distanza di Levenshtein ──────────────────────────────────────────────────
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) {
      dp[i] = [i];
      for (let j = 1; j <= n; j++) dp[i][j] = (i === 0) ? j : 0;
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  /**
   * Restituisce true solo se la differenza sembra un typo minore, non una
   * parola diversa.
   */
  function isLikelyTypo(user, target) {
    if (!user || !target) return false;
    const ul = user.length, tl = target.length;
    if (ul < 4 || tl < 4) return false;   // parole corte: nessuna tolleranza
    const lenDiff = Math.abs(ul - tl);
    if (lenDiff > 3) return false;
    const dist = levenshtein(user, target);
    const maxLen = Math.max(ul, tl);
    if (maxLen <= 6  && dist > 1) return false;
    if (maxLen <= 10 && dist > 2) return false;
    if (maxLen > 10  && dist > 3) return false;
    if (inBlacklist(user, target)) return false;
    return dist >= 1;
  }

  // ── Rilevamento errori di articolo/genere ────────────────────────────────────
  function detectMissingArticle(userN, targetN) {
    const targetArt = extractArticle(targetN);
    if (!targetArt) return false;                     // target non ha articolo
    const targetLemma = stripArticle(targetN);
    return userN === targetLemma;
  }

  function detectWrongArticle(userN, targetN) {
    const userArt   = extractArticle(userN);
    const targetArt = extractArticle(targetN);
    if (!userArt || !targetArt) return false;
    const userLemma   = stripArticle(userN);
    const targetLemma = stripArticle(targetN);
    return userLemma === targetLemma && userArt !== targetArt;
  }

  // Spiegazione specifiche per genere/articolo errato
  const GENDER_EXCEPTIONS = {
    'mano':      '"Mano" è femminile: si dice "la mano", anche se termina in -o.',
    'problema':  '"Problema" è maschile (dal greco): "il problema", "i problemi".',
    'programma': '"Programma" è maschile: "il programma", "i programmi".',
    'sistema':   '"Sistema" è maschile: "il sistema", "i sistemi".',
    'tema':      '"Tema" è maschile: "il tema", "i temi".',
    'poeta':     '"Poeta" è maschile: "il poeta", "i poeti".',
    'dentista':  '"Dentista" è maschile o femminile: "il dentista" / "la dentista".',
    'orecchio':  '"Orecchio" è maschile: "l\'orecchio". Plurale irregolare: "le orecchie".',
  };

  function genderExplanation(userN, targetN) {
    const lemma = stripArticle(targetN);
    const targetArt = extractArticle(targetN);
    return GENDER_EXCEPTIONS[lemma] ||
      `Articolo errato: si dice "${targetN}", non "${userN}".`;
  }

  // ── Valutazione principale ───────────────────────────────────────────────────
  /**
   * @param {string} typed       - risposta dell'utente
   * @param {object} card        - oggetto flashcard (card.front = risposta target,
   *                               card.variants = JSON, card.accepted_answers = JSON)
   * @param {object} [options]
   * @param {string} [options.mode='lemma_and_article'] - 'lemma_only' | 'lemma_and_article' | 'exact_phrase'
   * @returns {object} risultato strutturato
   */
  function evaluate(typed, card, options) {
    options = options || {};
    const mode = options.mode || 'lemma_and_article';

    const userRaw = (typed || '').trim();
    const userN   = normalizeForComparison(userRaw);

    // Target: strip trailing parenthetical (e.g. "della (di + la)" → "della")
    const targetRaw   = (card.front || '').trim();
    const targetClean = targetRaw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const targetN     = normalizeForComparison(targetClean);

    // Parse variants (structured JSON from answer_variants table)
    let variants = [];
    try { variants = JSON.parse(card.variants || '[]'); } catch (_) {}
    if (!Array.isArray(variants)) variants = [];

    // Parse legacy flat accepted_answers
    let legacyAccepted = [];
    try { legacyAccepted = JSON.parse(card.accepted_answers || '[]'); } catch (_) {}
    if (!Array.isArray(legacyAccepted)) legacyAccepted = [];

    const base = {
      userAnswer:           userRaw,
      normalizedUserAnswer: userN,
      targetAnswer:         targetClean,
      matchedAnswer:        null,
      saveToErrorNotebook:  false,
    };

    // ── 1. Corrispondenza esatta ──────────────────────────────────────────────
    if (userN === targetN) {
      return { ...base, status: 'correct_exact', accepted: true, score: 1.0,
        errorType: null, feedbackTitle: 'Corretto!', feedbackExplanation: null,
        matchedAnswer: targetClean };
    }

    // ── 2. Corrispondenza normalizzata (es. apostrofo tipografico vs retto) ───
    const targetStripped = normalizeForComparison(targetClean.replace(/\s*\([^)]*\)\s*$/, ''));
    if (userN === targetStripped && userN !== targetN) {
      return { ...base, status: 'correct_normalized', accepted: true, score: 1.0,
        errorType: null, feedbackTitle: 'Corretto!', feedbackExplanation: null,
        matchedAnswer: targetClean };
    }

    // ── 3. Varianti strutturate (answer_variants) ─────────────────────────────
    for (const v of variants) {
      const vN  = normalizeForComparison(v.answer || '');
      if (!vN || userN !== vN) continue;

      const vAccepted = v.accepted !== 0 && v.accepted !== false;

      if (!vAccepted) {
        // near_miss: parola correlata ma non corretta
        return { ...base, status: 'incorrect_related_word', accepted: false, score: 0.1,
          errorType: 'related_word', matchedAnswer: v.answer,
          feedbackTitle: 'Parola correlata, non esatta',
          feedbackExplanation: v.note
            || `"${v.answer}" è una parola correlata ma non equivalente. La risposta richiesta era "${targetClean}".`,
          saveToErrorNotebook: true };
      }

      const vType = v.variant_type || v.type || 'synonym';

      if (vType === 'no_article' || vType === 'lemma_only') {
        const accepted = mode === 'lemma_only';
        return { ...base,
          status: 'almost_correct_missing_article', accepted, score: accepted ? 0.9 : 0.7,
          errorType: accepted ? null : 'missing_article', matchedAnswer: v.answer,
          feedbackTitle: accepted ? 'Corretto!' : 'Quasi corretto',
          feedbackExplanation: accepted ? null
            : `La parola è giusta, ma in questa modalità è richiesto l'articolo. La risposta completa è "${targetClean}".`,
          saveToErrorNotebook: !accepted };
      }

      if (vType === 'contextual') {
        let contexts = [];
        try { contexts = JSON.parse(v.contexts || '[]'); } catch (_) {}
        return { ...base, status: 'correct_contextual', accepted: true, score: 0.9,
          errorType: null, matchedAnswer: v.answer,
          feedbackTitle: 'Corretto in questo contesto',
          feedbackExplanation: v.note || `"${v.answer}" è corretto. La risposta principale era "${targetClean}".`,
          saveToErrorNotebook: false };
      }

      if (vType === 'plural_form' || vType === 'singular_form') {
        return { ...base, status: 'correct_contextual', accepted: true, score: 0.85,
          errorType: null, matchedAnswer: v.answer,
          feedbackTitle: vType === 'plural_form' ? 'Forma plurale accettata' : 'Forma singolare accettata',
          feedbackExplanation: v.note || `"${v.answer}" è la forma ${vType === 'plural_form' ? 'plurale' : 'singolare'}. La risposta principale era "${targetClean}".`,
          saveToErrorNotebook: false };
      }

      // synonym / register_variant / regional → accettato pienamente
      const isSynonym   = ['synonym','register','register_variant','regional'].includes(vType);
      const statusKey   = isSynonym ? 'correct_synonym' : 'correct_contextual';
      const titleKey    = isSynonym ? 'Sinonimo valido' : 'Corretto';
      const defaultNote = `"${v.answer}" è ${isSynonym ? 'un sinonimo corretto' : 'accettato'}. La parola obiettivo era "${targetClean}".`;
      return { ...base, status: statusKey, accepted: true, score: isSynonym ? 0.95 : 0.9,
        errorType: null, matchedAnswer: v.answer,
        feedbackTitle: titleKey,
        feedbackExplanation: v.note ? `${v.note} La parola obiettivo era "${targetClean}".` : defaultNote,
        saveToErrorNotebook: false };
    }

    // ── 4. accepted_answers legacy (lista semplice) ──────────────────────────
    for (const a of legacyAccepted) {
      if (userN === normalizeForComparison(a)) {
        return { ...base, status: 'correct_synonym', accepted: true, score: 0.95,
          errorType: null, matchedAnswer: a,
          feedbackTitle: 'Sinonimo valido',
          feedbackExplanation: `"${a}" è una risposta accettata. La parola obiettivo era "${targetClean}".`,
          saveToErrorNotebook: false };
      }
    }

    // ── 5. Articolo mancante (auto-rilevato) ─────────────────────────────────
    if (detectMissingArticle(userN, targetN)) {
      const accepted = mode === 'lemma_only';
      return { ...base,
        status: 'almost_correct_missing_article', accepted, score: accepted ? 0.9 : 0.7,
        errorType: accepted ? null : 'missing_article', matchedAnswer: null,
        feedbackTitle: accepted ? 'Corretto!' : 'Quasi corretto',
        feedbackExplanation: accepted ? null
          : `Manca l'articolo. La risposta completa è "${targetClean}".`,
        saveToErrorNotebook: !accepted };
    }

    // ── 6. Articolo sbagliato / errore di genere (auto-rilevato) ────────────
    if (detectWrongArticle(userN, targetN)) {
      return { ...base, status: 'almost_correct_wrong_article', accepted: false, score: 0.3,
        errorType: 'wrong_article', matchedAnswer: null,
        feedbackTitle: 'Quasi corretto',
        feedbackExplanation: genderExplanation(userN, targetN),
        saveToErrorNotebook: true };
    }

    // ── 7. Typo ortografico ──────────────────────────────────────────────────
    const allTargets = [
      targetN,
      ...variants.filter(v => v.accepted !== 0 && v.accepted !== false)
                 .map(v => normalizeForComparison(v.answer || ''))
                 .filter(Boolean),
      ...legacyAccepted.map(a => normalizeForComparison(a)).filter(Boolean),
    ];
    for (const t of allTargets) {
      if (t && isLikelyTypo(userN, t)) {
        const display = t === targetN ? targetClean : t;
        return { ...base, status: 'almost_correct_spelling', accepted: false, score: 0.5,
          errorType: 'spelling', matchedAnswer: null,
          feedbackTitle: 'Quasi corretto',
          feedbackExplanation: `Piccolo errore ortografico. Hai scritto "${userRaw}", la forma corretta è "${display}".`,
          saveToErrorNotebook: false };
      }
    }

    // ── 8. Sbagliato ────────────────────────────────────────────────────────
    return { ...base, status: 'incorrect', accepted: false, score: 0.0,
      errorType: 'wrong_word', matchedAnswer: null,
      feedbackTitle: 'Non corretto',
      feedbackExplanation: null,
      saveToErrorNotebook: true };
  }

  // ── Mappatura SM-2 ───────────────────────────────────────────────────────────
  /**
   * Mappa il risultato della valutazione a un punteggio SM-2 (0-5).
   * @param {object} result - output di evaluate()
   * @param {object} [opts]
   * @param {string} [opts.mode='lemma_and_article']
   * @returns {number} qualità SM-2 (0-5)
   */
  function mapToSM2Quality(result, opts) {
    opts = opts || {};
    switch (result.status) {
      case 'correct_exact':                   return 5;
      case 'correct_normalized':              return 5;
      case 'correct_synonym':                 return 5;
      case 'correct_contextual':              return 4;
      case 'almost_correct_spelling':         return 3;
      case 'almost_correct_missing_article':  return result.accepted ? 4 : 2;
      case 'almost_correct_wrong_article':    return 2;
      case 'almost_correct_gender':           return 2;
      case 'almost_correct_number':           return 2;
      case 'incorrect_related_word':          return 1;
      case 'incorrect':                       return 0;
      default:                                return 0;
    }
  }

  // ── Esporta ──────────────────────────────────────────────────────────────────
  const Evaluator = {
    evaluate,
    normalizeForComparison,
    extractArticle,
    stripArticle,
    levenshtein,
    isLikelyTypo,
    detectMissingArticle,
    detectWrongArticle,
    mapToSM2Quality,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaluator;
  } else {
    root.Evaluator = Evaluator;
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
