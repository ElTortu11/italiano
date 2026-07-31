/**
 * Evaluator — motore di valutazione risposte per l'app italiano.
 * Funziona sia nel browser (window.Evaluator) che in Node.js (module.exports).
 *
 * Stati di valutazione:
 *   correct_exact            — risposta identica al target (dopo normalizzazione)
 *   correct_normalized       — identica dopo correzione apostrofo/spazi
 *   correct_synonym          — sinonimo pieno o variante di registro accettata
 *   correct_contextual       — risposta valida nel contesto specifico
 *   almost_correct_spelling  — piccolo typo ortografico
 *   almost_correct_missing_article — lemma corretto, articolo assente
 *   almost_correct_wrong_article   — lemma + genere corretti, forma articolo sbagliata
 *   almost_correct_gender          — stesso lemma, genere errato
 *   almost_correct_number          — numero sbagliato (sing/pl)
 *   incorrect_related_word   — parola correlata ma non equivalente
 *   incorrect                — risposta errata
 *   ambiguous                — prompt non abbastanza specifico
 */
(function (root) {
  'use strict';

  // ── Articoli italiani ────────────────────────────────────────────────────────
  const DEF_ARTICLES   = ["il","lo","la","l'","l'","i","gli","le"];
  const INDEF_ARTICLES = ["un","uno","una","un'","un'"];
  const ALL_ARTICLES   = [...DEF_ARTICLES, ...INDEF_ARTICLES];
  const ALL_ARTICLES_SORTED = ALL_ARTICLES.slice().sort((a, b) => b.length - a.length);

  // Genere articolo: maschile (masc) / femminile (fem) / null (l', un' = ambigui)
  const MASC_ARTICLES = new Set(['il','lo','i','gli','un','uno']);
  const FEM_ARTICLES  = new Set(['la','le','una']);
  // "l'" e "un'" sono ambigui → null

  // Numero articolo: singular / plural / null
  const PLURAL_ARTICLES   = new Set(['i','gli','le']);
  const SINGULAR_ARTICLES = new Set(['il','lo','la',"l'",'un','uno','una',"un'"]);

  // ── Blacklist per i typo ─────────────────────────────────────────────────────
  const SPELLING_BLACKLIST = new Set([
    'pena|pene','anno|hanno','vino|vivo','cara|caro','caso|casso',
    'casa|cassa','sera|sere','bene|pene','la|le','il|lo',
    'ore|are','del|dei','un|uno','fare|faro',
  ]);
  function inBlacklist(a, b) {
    return SPELLING_BLACKLIST.has(`${a}|${b}`) || SPELLING_BLACKLIST.has(`${b}|${a}`);
  }

  // ── Normalizzazione ──────────────────────────────────────────────────────────
  function normalizeForComparison(s) {
    if (!s) return '';
    return s
      .normalize('NFC')
      .toLowerCase()
      .trim()
      .replace(/[''`''‚‛]/g, "'")
      .replace(/[.,!?;:]+$/g, '')
      .replace(/\s+/g, ' ');
  }

  // ── Articolo / lemma ─────────────────────────────────────────────────────────
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

  function getArticleGender(art) {
    if (!art) return null;
    if (MASC_ARTICLES.has(art)) return 'masc';
    if (FEM_ARTICLES.has(art))  return 'fem';
    return null; // l' / un' = ambiguo
  }

  function getArticleNumber(art) {
    if (!art) return null;
    if (PLURAL_ARTICLES.has(art))   return 'plural';
    if (SINGULAR_ARTICLES.has(art)) return 'singular';
    return null;
  }

  // ── Levenshtein ──────────────────────────────────────────────────────────────
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) {
      dp[i] = [i];
      for (let j = 1; j <= n; j++) dp[i][j] = (i === 0) ? j : 0;
    }
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function isLikelyTypo(user, target) {
    if (!user || !target) return false;
    const ul = user.length, tl = target.length;
    if (ul < 4 || tl < 4) return false;
    if (Math.abs(ul - tl) > 3) return false;
    const dist = levenshtein(user, target);
    const maxLen = Math.max(ul, tl);
    if (maxLen <= 6  && dist > 1) return false;
    if (maxLen <= 10 && dist > 2) return false;
    if (maxLen > 10  && dist > 3) return false;
    if (inBlacklist(user, target)) return false;
    return dist >= 1;
  }

  // ── Rilevamento problemi di articolo ─────────────────────────────────────────
  function detectMissingArticle(userN, targetN) {
    const targetArt = extractArticle(targetN);
    if (!targetArt) return false;
    return userN === stripArticle(targetN);
  }

  /**
   * Analizza un potenziale errore di articolo (stesso lemma, articolo diverso).
   * @returns {'gender'|'wrong_article'|null}
   */
  function detectArticleIssue(userN, targetN) {
    const userArt   = extractArticle(userN);
    const targetArt = extractArticle(targetN);
    if (!userArt || !targetArt || userArt === targetArt) return null;
    if (stripArticle(userN) !== stripArticle(targetN)) return null;

    // Se i numeri differiscono, è un errore di numero, non di articolo
    const userNum   = getArticleNumber(userArt);
    const targetNum = getArticleNumber(targetArt);
    if (userNum && targetNum && userNum !== targetNum) return null;

    const userGender   = getArticleGender(userArt);
    const targetGender = getArticleGender(targetArt);
    if (userGender && targetGender && userGender !== targetGender) return 'gender';
    return 'wrong_article';
  }

  /**
   * Controlla se i lemmi potrebbero essere singolare/plurale dello stesso sostantivo.
   */
  function areLemmasPluralRelated(a, b) {
    if (!a || !b || a === b) return false;
    if (Math.min(a.length, b.length) < 3) return false;
    const transforms = [
      [/o$/, 'i'], [/a$/, 'e'], [/e$/, 'i'],
      [/i$/, 'o'], [/e$/, 'a'], [/i$/, 'e'],
      [/io$/, 'i'], [/i$/, 'io'],             // occhio→occhi
      [/ca$/, 'che'], [/che$/, 'ca'],          // amica→amiche
      [/ga$/, 'ghe'], [/ghe$/, 'ga'],
      [/o$/, 'a'], [/a$/, 'o'],                // uovo→uova, braccio→braccia
    ];
    for (const [pat, rep] of transforms) {
      if (a.replace(pat, rep) === b || b.replace(pat, rep) === a) return true;
    }
    // Plurali irregolari lunghi (uomo/uomini): Levenshtein ≤ 2
    return levenshtein(a, b) <= 2 && Math.max(a.length, b.length) >= 5;
  }

  /**
   * Rileva se utente e target hanno numero diverso (sing/pl).
   * @returns {{detected:true, secondary:string[], direction:string}|null}
   */
  function detectNumberIssue(userN, targetN) {
    const userArt   = extractArticle(userN);
    const targetArt = extractArticle(targetN);
    if (!userArt || !targetArt) return null;
    const userNum   = getArticleNumber(userArt);
    const targetNum = getArticleNumber(targetArt);
    if (!userNum || !targetNum || userNum === targetNum) return null;

    const userLemma   = stripArticle(userN);
    const targetLemma = stripArticle(targetN);
    const related = userLemma === targetLemma || areLemmasPluralRelated(userLemma, targetLemma);
    if (!related) return null;

    const secondary = [];
    const userGender   = getArticleGender(userArt);
    const targetGender = getArticleGender(targetArt);
    if (userGender && targetGender && userGender !== targetGender) secondary.push('article_gender');
    return { detected: true, secondary, direction: userNum === 'singular' ? 'used_singular' : 'used_plural' };
  }

  // ── Spiegazioni genere ────────────────────────────────────────────────────────
  const GENDER_NOTES = {
    'mano':      '"Mano" è femminile (la mano), anche se termina in -o.',
    'foto':      '"Foto" è femminile: la foto, le foto.',
    'moto':      '"Moto" è femminile: la moto, le moto.',
    'auto':      '"Auto" è femminile: la auto / l\'auto.',
    'radio':     '"Radio" è femminile: la radio.',
    'problema':  '"Problema" è maschile (dal greco): il problema, i problemi.',
    'programma': '"Programma" è maschile: il programma, i programmi.',
    'sistema':   '"Sistema" è maschile: il sistema, i sistemi.',
    'tema':      '"Tema" è maschile: il tema, i temi.',
    'poeta':     '"Poeta" è maschile: il poeta, i poeti.',
    'orecchio':  '"Orecchio" è maschile: l\'orecchio. Plurale irregolare: le orecchie.',
  };

  function buildGenderExplanation(userN, targetN) {
    const lemma = stripArticle(targetN);
    return GENDER_NOTES[lemma] ||
      `Articolo errato per il genere: si dice "${targetN}", non "${userN}".`;
  }

  function buildArticleExplanation(userN, targetN) {
    const userArt   = extractArticle(userN);
    const targetArt = extractArticle(targetN);
    const lemma = stripArticle(targetN);
    // Common wrong-form cases
    if (targetArt === 'lo' && userArt === 'il')
      return `"${lemma}" inizia con s+consonante, z, x, gn, ps o y → vuole "lo", non "il".`;
    if (targetArt === 'gli' && userArt === 'i')
      return `"${lemma}" inizia con vocale, s+consonante, z, gn o ps → vuole "gli", non "i".`;
    if (targetArt === "l'" && (userArt === 'il' || userArt === 'la'))
      return `Prima di una parola che inizia con vocale si usa "l'", non "${userArt}".`;
    return `La forma corretta dell'articolo è "${targetN}", non "${userN}".`;
  }

  // ── Valutazione principale ───────────────────────────────────────────────────
  /**
   * @param {string} typed
   * @param {object} card   — card.front=target, card.back=prompt ES, card.variants=JSON,
   *                          card.accepted_answers=JSON
   * @param {object} [opts]
   * @param {'lemma_and_article'|'lemma_only'|'exact_phrase'} [opts.mode]
   * @returns {EvalResult}
   */
  function evaluate(typed, card, opts) {
    opts = opts || {};
    const mode    = opts.mode || 'lemma_and_article';
    const userRaw = (typed || '').trim();
    const userN   = normalizeForComparison(userRaw);

    const targetRaw   = (card.front || '').trim();
    const targetClean = targetRaw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const targetN     = normalizeForComparison(targetClean);

    // Prompt in spagnolo (usato per il context-matching delle varianti)
    const promptN = normalizeForComparison(card.back || '');

    let variants = [];
    try { variants = JSON.parse(card.variants || '[]'); } catch (_) {}
    if (!Array.isArray(variants)) variants = [];

    let legacyAccepted = [];
    try { legacyAccepted = JSON.parse(card.accepted_answers || '[]'); } catch (_) {}
    if (!Array.isArray(legacyAccepted)) legacyAccepted = [];

    const base = {
      userAnswer:           userRaw,
      normalizedUserAnswer: userN,
      targetAnswer:         targetClean,
      matchedAnswer:        null,
      saveToErrorNotebook:  false,
      secondaryIssues:      [],
      needsContentReview:   false,
    };

    // ── 1. Esatto ────────────────────────────────────────────────────────────
    if (userN === targetN) {
      return { ...base, status: 'correct_exact', accepted: true, score: 1.0,
        errorType: null, feedbackTitle: 'Corretto!', feedbackExplanation: null,
        matchedAnswer: targetClean };
    }

    // ── 2. Normalizzato ──────────────────────────────────────────────────────
    // (apostrofo tipografico, maiuscola, punteggiatura finale)
    const targetStripped = normalizeForComparison(targetClean.replace(/\s*\([^)]*\)\s*$/, ''));
    if (userN === targetStripped) {
      return { ...base, status: 'correct_normalized', accepted: true, score: 1.0,
        errorType: null, feedbackTitle: 'Corretto!', feedbackExplanation: null,
        matchedAnswer: targetClean };
    }

    // ── 3. Varianti strutturate ──────────────────────────────────────────────
    for (const v of variants) {
      const vN = normalizeForComparison(v.answer || '');
      if (!vN || userN !== vN) continue;

      const vAccepted = v.accepted !== 0 && v.accepted !== false;
      const vType     = v.variant_type || v.type || 'synonym';

      // Ambiguo: il prompt non contiene abbastanza contesto
      if (vType === 'ambiguous_alt') {
        return { ...base, status: 'ambiguous', accepted: true, score: null,
          errorType: null, matchedAnswer: v.answer,
          feedbackTitle: 'Domanda ambigua',
          feedbackExplanation: v.note || `Senza contesto aggiuntivo, questa risposta potrebbe essere valida. La domanda sarà rivista.`,
          saveToErrorNotebook: false, needsContentReview: true };
      }

      // Near-miss: non accettato
      if (!vAccepted) {
        return { ...base, status: 'incorrect_related_word', accepted: false, score: 0.1,
          errorType: 'related_word', matchedAnswer: v.answer,
          feedbackTitle: 'Parola correlata, non esatta',
          feedbackExplanation: v.note || `"${v.answer}" è correlata ma non equivalente. La risposta richiesta era "${targetClean}".`,
          saveToErrorNotebook: true };
      }

      // Forma senza articolo
      if (vType === 'no_article' || vType === 'lemma_only') {
        const accepted = mode === 'lemma_only';
        return { ...base, status: 'almost_correct_missing_article', accepted, score: accepted ? 0.9 : 0.7,
          errorType: accepted ? null : 'missing_article', matchedAnswer: v.answer,
          feedbackTitle: accepted ? 'Corretto!' : 'Quasi corretto',
          feedbackExplanation: accepted ? null : `La parola è giusta, ma è richiesto l'articolo. La risposta completa è "${targetClean}".`,
          saveToErrorNotebook: !accepted };
      }

      // Forma plurale / singolare: verifica contesto
      if (vType === 'plural_form' || vType === 'singular_form') {
        let contexts = [];
        try { contexts = JSON.parse(v.contexts || '[]'); } catch (_) {}
        // Se il prompt non suggerisce il numero corrispondente → non accettare
        if (contexts.length > 0 && promptN) {
          const ctxMatch = contexts.some(c => normalizeForComparison(c) === promptN
            || promptN.includes(normalizeForComparison(c)));
          if (!ctxMatch) {
            return { ...base, status: 'incorrect_related_word', accepted: false, score: 0.1,
              errorType: 'wrong_number_context',
              feedbackTitle: 'Numero sbagliato',
              feedbackExplanation: v.note || `"${v.answer}" è la forma ${vType === 'plural_form' ? 'plurale' : 'singolare'}, ma il prompt richiede il ${vType === 'plural_form' ? 'singolare' : 'plurale'}. La risposta corretta era "${targetClean}".`,
              saveToErrorNotebook: false };
          }
        }
        return { ...base, status: 'correct_contextual', accepted: true, score: 0.85,
          errorType: null, matchedAnswer: v.answer,
          feedbackTitle: vType === 'plural_form' ? 'Forma plurale accettata' : 'Forma singolare accettata',
          feedbackExplanation: v.note || `"${v.answer}" è la forma ${vType === 'plural_form' ? 'plurale' : 'singolare'}. La risposta principale era "${targetClean}".`,
          saveToErrorNotebook: false };
      }

      // Variante contestuale: valida solo se il prompt corrisponde ai contesti dichiarati
      if (vType === 'contextual') {
        let contexts = [];
        try { contexts = JSON.parse(v.contexts || '[]'); } catch (_) {}
        if (contexts.length > 0 && promptN) {
          const ctxMatch = contexts.some(c => {
            const cn = normalizeForComparison(c);
            return promptN === cn || promptN.includes(cn) || cn.includes(promptN);
          });
          if (!ctxMatch) {
            return { ...base, status: 'incorrect_related_word', accepted: false, score: 0.1,
              errorType: 'wrong_context',
              feedbackTitle: 'Corretto in un altro contesto',
              feedbackExplanation: v.note || `"${v.answer}" è valido in un contesto diverso. Qui la risposta richiesta era "${targetClean}".`,
              saveToErrorNotebook: false };
          }
        }
        return { ...base, status: 'correct_contextual', accepted: true, score: 0.9,
          errorType: null, matchedAnswer: v.answer,
          feedbackTitle: 'Corretto in questo contesto',
          feedbackExplanation: v.note || `"${v.answer}" è corretto qui. La risposta principale era "${targetClean}".`,
          saveToErrorNotebook: false };
      }

      // Sinonimo / registro / regionale → accettato pienamente
      const isSynonym = ['synonym','register','register_variant','regional'].includes(vType);
      return { ...base, status: isSynonym ? 'correct_synonym' : 'correct_contextual',
        accepted: true, score: isSynonym ? 0.95 : 0.9,
        errorType: null, matchedAnswer: v.answer,
        feedbackTitle: isSynonym ? 'Sinonimo valido' : 'Corretto',
        feedbackExplanation: v.note
          ? `${v.note} La parola obiettivo era "${targetClean}".`
          : `"${v.answer}" è ${isSynonym ? 'un sinonimo corretto' : 'accettato'}. La parola obiettivo era "${targetClean}".`,
        saveToErrorNotebook: false };
    }

    // ── 4. accepted_answers legacy ────────────────────────────────────────────
    for (const a of legacyAccepted) {
      if (userN === normalizeForComparison(a)) {
        return { ...base, status: 'correct_synonym', accepted: true, score: 0.95,
          errorType: null, matchedAnswer: a,
          feedbackTitle: 'Sinonimo valido',
          feedbackExplanation: `"${a}" è una risposta accettata. La parola obiettivo era "${targetClean}".`,
          saveToErrorNotebook: false };
      }
    }

    // ── 5. Articolo mancante ──────────────────────────────────────────────────
    if (detectMissingArticle(userN, targetN)) {
      const accepted = mode === 'lemma_only';
      return { ...base, status: 'almost_correct_missing_article', accepted, score: accepted ? 0.9 : 0.7,
        errorType: accepted ? null : 'missing_article',
        feedbackTitle: accepted ? 'Corretto!' : 'Quasi corretto',
        feedbackExplanation: accepted ? null : `Manca l'articolo. La risposta completa è "${targetClean}".`,
        saveToErrorNotebook: !accepted };
    }

    // ── 6. Errore di numero (singolare vs plurale) ────────────────────────────
    const numIssue = detectNumberIssue(userN, targetN);
    if (numIssue) {
      const direction = numIssue.direction === 'used_singular'
        ? 'Hai usato la forma singolare ma era richiesta la forma plurale.'
        : 'Hai usato la forma plurale ma era richiesta la forma singolare.';
      return { ...base, status: 'almost_correct_number', accepted: false, score: 0.3,
        errorType: 'number', secondaryIssues: numIssue.secondary,
        feedbackTitle: 'Quasi corretto',
        feedbackExplanation: `${direction} La risposta corretta è "${targetClean}".`,
        saveToErrorNotebook: true };
    }

    // ── 7. Errore di genere / forma dell'articolo ─────────────────────────────
    const artIssue = detectArticleIssue(userN, targetN);
    if (artIssue === 'gender') {
      return { ...base, status: 'almost_correct_gender', accepted: false, score: 0.3,
        errorType: 'gender',
        feedbackTitle: 'Quasi corretto',
        feedbackExplanation: buildGenderExplanation(userN, targetN),
        saveToErrorNotebook: true };
    }
    if (artIssue === 'wrong_article') {
      return { ...base, status: 'almost_correct_wrong_article', accepted: false, score: 0.35,
        errorType: 'wrong_article',
        feedbackTitle: 'Quasi corretto',
        feedbackExplanation: buildArticleExplanation(userN, targetN),
        saveToErrorNotebook: true };
    }

    // ── 8. Typo ortografico ───────────────────────────────────────────────────
    const allTargets = [
      targetN,
      ...variants.filter(v => v.accepted !== 0 && v.accepted !== false)
                 .map(v => normalizeForComparison(v.answer || '')).filter(Boolean),
      ...legacyAccepted.map(a => normalizeForComparison(a)).filter(Boolean),
    ];
    for (const t of allTargets) {
      if (t && isLikelyTypo(userN, t)) {
        const display = t === targetN ? targetClean : t;
        return { ...base, status: 'almost_correct_spelling', accepted: false, score: 0.5,
          errorType: 'spelling',
          feedbackTitle: 'Quasi corretto',
          feedbackExplanation: `Piccolo errore ortografico. Hai scritto "${userRaw}", la forma corretta è "${display}".`,
          saveToErrorNotebook: false };
      }
    }

    // ── 9. Sbagliato ─────────────────────────────────────────────────────────
    return { ...base, status: 'incorrect', accepted: false, score: 0.0,
      errorType: 'wrong_word', feedbackTitle: 'Non corretto', feedbackExplanation: null,
      saveToErrorNotebook: true };
  }

  // ── SM-2 ─────────────────────────────────────────────────────────────────────
  /**
   * @returns {number|null} — null per 'ambiguous' (non aggiornare SM-2)
   */
  function mapToSM2Quality(result) {
    switch (result.status) {
      case 'correct_exact':                   return 5;
      case 'correct_normalized':              return 5;
      case 'correct_synonym':                 return 5;
      case 'correct_contextual':              return 4;
      case 'almost_correct_spelling':         return 3;
      case 'almost_correct_missing_article':  return result.accepted ? 4 : 3;
      case 'almost_correct_wrong_article':    return 2;
      case 'almost_correct_gender':           return 2;
      case 'almost_correct_number':           return 2;
      case 'incorrect_related_word':          return 1;
      case 'incorrect':                       return 0;
      case 'ambiguous':                       return null; // non aggiornare SM-2
      default:                                return 0;
    }
  }

  // ── Esporta ───────────────────────────────────────────────────────────────────
  const Evaluator = {
    evaluate,
    normalizeForComparison,
    extractArticle,
    stripArticle,
    getArticleGender,
    getArticleNumber,
    levenshtein,
    isLikelyTypo,
    detectMissingArticle,
    detectArticleIssue,
    detectNumberIssue,
    areLemmasPluralRelated,
    mapToSM2Quality,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Evaluator;
  else root.Evaluator = Evaluator;

})(typeof globalThis !== 'undefined' ? globalThis : this);
