'use strict';
const E = require('../public/js/evaluator');
const { evaluate, normalizeForComparison, extractArticle, stripArticle,
        getArticleGender, getArticleNumber, levenshtein, isLikelyTypo,
        detectMissingArticle, detectArticleIssue, detectNumberIssue,
        areLemmasPluralRelated, mapToSM2Quality } = E;

let passed = 0, failed = 0;
function assert(cond, desc) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}
function makeCard(front, variants = [], accepted_answers = [], back = '') {
  return { front, back, variants: JSON.stringify(variants), accepted_answers: JSON.stringify(accepted_answers) };
}

// ── normalizeForComparison ────────────────────────────────────────────────────
console.log('\nnormalizeForComparison:');
assert(normalizeForComparison("L'uomo") === "l'uomo",       'apostrofo NFC');
assert(normalizeForComparison('  Ciao  ') === 'ciao',       'trim + lowercase');
assert(normalizeForComparison('Ciao!') === 'ciao',          'punteggiatura finale');
assert(normalizeForComparison('il  gatto') === 'il gatto',  'spazi multipli');

// ── extractArticle / stripArticle ─────────────────────────────────────────────
console.log('\nextractArticle / stripArticle:');
assert(extractArticle("la camera") === 'la',   'la');
assert(extractArticle("il gatto") === 'il',    'il');
assert(extractArticle("l'uomo") === "l'",      "l'");
assert(extractArticle("gli uomini") === 'gli', 'gli');
assert(extractArticle("le mani") === 'le',     'le');
assert(extractArticle("veloce") === null,      'nessun articolo');
assert(stripArticle("la camera") === 'camera', 'stripArticle la');
assert(stripArticle("gli occhi") === 'occhi',  'stripArticle gli');
assert(stripArticle("l'uomo") === 'uomo',      "stripArticle l'");

// ── getArticleGender / getArticleNumber ───────────────────────────────────────
console.log('\ngetArticleGender / getArticleNumber:');
assert(getArticleGender('il')  === 'masc', 'il → masc');
assert(getArticleGender('lo')  === 'masc', 'lo → masc');
assert(getArticleGender('i')   === 'masc', 'i → masc');
assert(getArticleGender('gli') === 'masc', 'gli → masc');
assert(getArticleGender('la')  === 'fem',  'la → fem');
assert(getArticleGender('le')  === 'fem',  'le → fem');
assert(getArticleGender("l'")  === null,   "l' → ambiguo");
assert(getArticleNumber('il')  === 'singular', 'il → singular');
assert(getArticleNumber('gli') === 'plural',   'gli → plural');
assert(getArticleNumber('le')  === 'plural',   'le → plural');
assert(getArticleNumber('la')  === 'singular', 'la → singular');

// ── levenshtein ───────────────────────────────────────────────────────────────
console.log('\nlevenshtein:');
assert(levenshtein('kitten','sitting') === 3, 'kitten→sitting');
assert(levenshtein('abc','abc') === 0,        'uguale');
assert(levenshtein('','abc') === 3,           'vuoto');
assert(levenshtein('veloce','velice') === 1,  'veloce→velice');

// ── isLikelyTypo ──────────────────────────────────────────────────────────────
console.log('\nisLikelyTypo:');
assert(isLikelyTypo('veloce','velice') === true,         'veloce typo');
assert(isLikelyTypo('il','lo') === false,                'articoli corti: no');
assert(isLikelyTypo('pena','pene') === false,            'blacklist');
assert(isLikelyTypo('entusiasmmo','entusiasmo') === true,'lungo typo');

// ── detectMissingArticle ──────────────────────────────────────────────────────
console.log('\ndetectMissingArticle:');
assert(detectMissingArticle('camera', 'la camera') === true,  'camera vs la camera');
assert(detectMissingArticle('la camera', 'la camera') === false, 'articolo presente');
assert(detectMissingArticle('veloce', 'veloce') === false,    'senza articolo: no');

// ── detectArticleIssue ────────────────────────────────────────────────────────
console.log('\ndetectArticleIssue:');
// Genere errato
assert(detectArticleIssue('il mano', 'la mano') === 'gender',        'il mano → gender');
assert(detectArticleIssue('la studente', 'lo studente') === 'gender', 'la studente → gender');
// Forma articolo sbagliata (stesso genere)
assert(detectArticleIssue('il studente', 'lo studente') === 'wrong_article', 'il studente → wrong_article');
assert(detectArticleIssue('i amici', 'gli amici') === 'wrong_article',       'i amici → wrong_article');
// Nessun errore / lemmi diversi
assert(detectArticleIssue('la mano', 'la mano') === null, 'uguale → null');
assert(detectArticleIssue('il gatto', 'la luna') === null, 'lemmi diversi → null');

// ── detectNumberIssue ─────────────────────────────────────────────────────────
console.log('\ndetectNumberIssue:');
// Singolare vs plurale (stesso lemma)
const n1 = detectNumberIssue('la mani', 'le mani');
assert(n1 && n1.detected === true, 'la mani vs le mani: detected');
assert(n1 && n1.direction === 'used_singular', 'la mani: direction=used_singular');
// Singolare vs plurale (lemmi correlati: occhio/occhi)
const n2 = detectNumberIssue("l'occhio", 'gli occhi');
assert(n2 && n2.detected === true, "l'occhio vs gli occhi: detected");
// Nessun errore di numero
assert(detectNumberIssue('il gatto', 'la luna') === null, 'lemmi non correlati → null');
assert(detectNumberIssue('il gatto', 'il cane') === null, 'stesso numero → null');
// Plurale usato invece di singolare
const n3 = detectNumberIssue('i gatto', 'il gatto');
assert(n3 && n3.detected === true && n3.direction === 'used_plural', 'i gatto → used_plural');

// ── areLemmasPluralRelated ────────────────────────────────────────────────────
console.log('\nareLemmasPluralRelated:');
assert(areLemmasPluralRelated('gatto','gatti') === true, 'gatto/gatti');
assert(areLemmasPluralRelated('occhio','occhi') === true,'occhio/occhi');
assert(areLemmasPluralRelated('amica','amiche') === true,'amica/amiche');
assert(areLemmasPluralRelated('mano','mano') === false,  'stesso: false');
assert(areLemmasPluralRelated('gatto','luna') === false, 'non correlati: false');

// ── evaluate: correct_exact ───────────────────────────────────────────────────
console.log('\nevaluate — correct_exact:');
{
  const r = evaluate('la camera', makeCard('la camera'));
  assert(r.status === 'correct_exact', 'status');
  assert(r.accepted === true, 'accepted');
  assert(r.score === 1.0, 'score');
  assert(mapToSM2Quality(r) === 5, 'SM-2 = 5');
  assert(r.saveToErrorNotebook === false, 'non salvato');
}

// ── evaluate: parentesi nel target ───────────────────────────────────────────
console.log('\nevaluate — parentesi:');
{
  const r = evaluate('della', makeCard('della (di + la)'));
  assert(r.status === 'correct_exact', 'status');
}

// ── evaluate: correct_normalized ─────────────────────────────────────────────
console.log('\nevaluate — correct_normalized:');
{
  const r = evaluate("l'uomo", makeCard("l'uomo")); // curly vs straight
  assert(r.accepted === true && (r.status === 'correct_exact' || r.status === 'correct_normalized'), 'apostrofo');
}

// ── evaluate: correct_synonym ─────────────────────────────────────────────────
console.log('\nevaluate — correct_synonym:');
{
  const v = [{ answer:'la stanza', variant_type:'synonym', accepted:true, note:'"Stanza" è sinonimo.', contexts:'[]' }];
  const r = evaluate('la stanza', makeCard('la camera', v));
  assert(r.status === 'correct_synonym', 'status');
  assert(r.accepted === true, 'accepted');
  assert(mapToSM2Quality(r) === 5, 'SM-2 = 5');
  assert(r.saveToErrorNotebook === false, 'non salvato');
}

// ── evaluate: legacy accepted_answers ─────────────────────────────────────────
console.log('\nevaluate — legacy:');
{
  const r = evaluate('rapido', makeCard('veloce', [], ['rapido']));
  assert(r.status === 'correct_synonym', 'status');
  assert(r.accepted === true, 'accepted');
}

// ── evaluate: almost_correct_missing_article ──────────────────────────────────
console.log('\nevaluate — missing article:');
{
  const r = evaluate('camera', makeCard('la camera'));
  assert(r.status === 'almost_correct_missing_article', 'status');
  assert(r.accepted === false, 'rejected (lemma_and_article)');
  assert(r.errorType === 'missing_article', 'errorType');
  assert(mapToSM2Quality(r) === 3, 'SM-2 = 3 (non accettato)');
}
{
  const r = evaluate('camera', makeCard('la camera'), { mode: 'lemma_only' });
  assert(r.accepted === true, 'accettato in lemma_only');
  assert(mapToSM2Quality(r) === 4, 'SM-2 = 4 in lemma_only');
}

// ── evaluate: almost_correct_gender ──────────────────────────────────────────
console.log('\nevaluate — gender error:');
{
  const r = evaluate('il mano', makeCard('la mano'));
  assert(r.status === 'almost_correct_gender', 'il mano → gender');
  assert(r.accepted === false, 'non accettato');
  assert(r.errorType === 'gender', 'errorType');
  assert(mapToSM2Quality(r) === 2, 'SM-2 = 2');
  assert(r.saveToErrorNotebook === true, 'salvato nel quaderno');
  assert(r.feedbackExplanation.includes('femminile') || r.feedbackExplanation.includes('Mano'), 'spiegazione genere');
}
{
  const r = evaluate('il problema', makeCard('il problema'));
  assert(r.status === 'correct_exact', 'il problema è maschile: esatto');
}

// ── evaluate: almost_correct_wrong_article ────────────────────────────────────
console.log('\nevaluate — wrong article form:');
{
  const r = evaluate('il studente', makeCard('lo studente'));
  assert(r.status === 'almost_correct_wrong_article', 'il studente → wrong_article');
  assert(r.accepted === false, 'non accettato');
  assert(r.errorType === 'wrong_article', 'errorType');
  assert(mapToSM2Quality(r) === 2, 'SM-2 = 2');
  assert(r.feedbackExplanation.includes('lo') || r.feedbackExplanation.includes('s+consonante'), 'spiegazione lo');
}
{
  const r = evaluate('i amici', makeCard('gli amici'));
  assert(r.status === 'almost_correct_wrong_article', 'i amici → wrong_article');
  assert(r.feedbackExplanation.includes('gli'), 'spiegazione gli');
}

// ── evaluate: almost_correct_number ──────────────────────────────────────────
console.log('\nevaluate — number error:');
{
  // Singolare invece di plurale
  const r1 = evaluate('la mano', makeCard('le mani'));
  assert(r1.status === 'almost_correct_number', 'la mano vs le mani: number');
  assert(r1.accepted === false, 'non accettato');
  assert(r1.errorType === 'number', 'errorType');
  assert(mapToSM2Quality(r1) === 2, 'SM-2 = 2');
  assert(r1.feedbackExplanation.includes('singolare') || r1.feedbackExplanation.includes('plurale'), 'testo numero');
}
{
  // Plurale invece di singolare
  const r2 = evaluate('gli occhi', makeCard("l'occhio"));
  assert(r2.status === 'almost_correct_number', 'gli occhi vs occhio: number');
  assert(r2.secondaryIssues !== undefined, 'secondaryIssues presente');
}
{
  // Double error: genere + numero
  const r3 = evaluate('le braccio', makeCard('il braccio'));
  // Singolare la vs il → same number (le → plural, il → singular) → number issue?
  // Actually 'le' is plural, 'il' is singular → detectNumberIssue
  // lemmas: braccio === braccio → same → number detected, secondary: gender mismatch
  assert(r3.status === 'almost_correct_number' || r3.status === 'almost_correct_gender', 'double error rilevato');
}

// ── evaluate: ambiguous ───────────────────────────────────────────────────────
console.log('\nevaluate — ambiguous:');
{
  const v = [{ answer:"l'udito", variant_type:'ambiguous_alt', accepted:true,
    note: '"El oído" può riferirsi all\'orecchio o all\'udito.', contexts:'[]' }];
  const r = evaluate("l'udito", makeCard("l'orecchio", v, [], 'el oído'));
  assert(r.status === 'ambiguous', 'status');
  assert(r.accepted === true, 'accepted = true');
  assert(r.score === null, 'score = null');
  assert(mapToSM2Quality(r) === null, 'SM-2 = null (non aggiornare)');
  assert(r.saveToErrorNotebook === false, 'non salvato');
  assert(r.needsContentReview === true, 'needsContentReview = true');
}

// ── evaluate: almost_correct_spelling ────────────────────────────────────────
console.log('\nevaluate — spelling:');
{
  const r = evaluate('entusiasmmo', makeCard('entusiasmo'));
  assert(r.status === 'almost_correct_spelling', 'status');
  assert(r.accepted === false, 'non accettato');
  assert(r.saveToErrorNotebook === false, 'non salvato nel quaderno');
  assert(mapToSM2Quality(r) === 3, 'SM-2 = 3');
}

// ── evaluate: incorrect_related_word ─────────────────────────────────────────
console.log('\nevaluate — near_miss:');
{
  const v = [{ answer:'avere', variant_type:'near_miss', accepted:false,
    note:'"Avere" esprime il possesso, "tenere" = sujetar.', contexts:'[]' }];
  const r = evaluate('avere', makeCard('tenere', v));
  assert(r.status === 'incorrect_related_word', 'status');
  assert(r.accepted === false, 'non accettato');
  assert(mapToSM2Quality(r) === 1, 'SM-2 = 1');
}

// ── evaluate: incorrect ───────────────────────────────────────────────────────
console.log('\nevaluate — incorrect:');
{
  const r = evaluate('il sole', makeCard('la luna'));
  assert(r.status === 'incorrect', 'status');
  assert(r.saveToErrorNotebook === true, 'salvato nel quaderno');
  assert(mapToSM2Quality(r) === 0, 'SM-2 = 0');
}

// ── evaluate: contextual variant con context mismatch ────────────────────────
console.log('\nevaluate — contextual context mismatch:');
{
  // camera da letto è valida solo con prompt "el dormitorio"
  const v = [{ answer:'la camera da letto', variant_type:'contextual', accepted:true,
    note:'Usato per camera da letto.', contexts:'["el dormitorio"]' }];
  // Prompt = "la habitación" (generico) → non corrisponde a "el dormitorio"
  const r1 = evaluate('la camera da letto', { front:'la camera', back:'la habitación',
    variants: JSON.stringify(v), accepted_answers:'[]' });
  assert(r1.status === 'incorrect_related_word', 'camera da letto fuori contesto');

  // Prompt = "el dormitorio" → corrisponde
  const r2 = evaluate('la camera da letto', { front:'la camera', back:'el dormitorio',
    variants: JSON.stringify(v), accepted_answers:'[]' });
  assert(r2.status === 'correct_contextual', 'camera da letto in contesto giusto');
}

// ── evaluate: plural_form context mismatch ────────────────────────────────────
console.log('\nevaluate — plural_form context:');
{
  // arancioni accettata solo con prompt esplicito plurale
  const v = [{ answer:'arancioni', variant_type:'plural_form', accepted:true,
    note:'Forma plurale.', contexts:'["naranjas"]' }];
  const rSing = evaluate('arancioni', { front:'arancione', back:'naranja',
    variants: JSON.stringify(v), accepted_answers:'[]' });
  assert(rSing.status === 'incorrect_related_word', 'arancioni fuori contesto (singular prompt)');

  const rPl = evaluate('arancioni', { front:'arancione', back:'naranjas',
    variants: JSON.stringify(v), accepted_answers:'[]' });
  assert(rPl.status === 'correct_contextual', 'arancioni in contesto plurale');
}

// ── evaluate: corretto_contextual non contabilizzato come pieno dominio ───────
console.log('\nevaluate — SM-2 per corretto_contextual:');
{
  const v = [{ answer:'rapido', variant_type:'contextual', accepted:true, note:'', contexts:'[]' }];
  const r = evaluate('rapido', makeCard('veloce', v));
  assert(r.status === 'correct_contextual', 'status');
  assert(mapToSM2Quality(r) === 4, 'SM-2 = 4 (non pieno dominio)');
}

// ── evaluate: ambiguous non aggiorna SM-2 ────────────────────────────────────
console.log('\nevaluate — ambiguous non aggiorna SM-2:');
{
  const v = [{ answer:"l'udito", variant_type:'ambiguous_alt', accepted:true, note:'', contexts:'[]' }];
  const r = evaluate("l'udito", makeCard("l'orecchio", v));
  assert(r.status === 'ambiguous', 'status');
  const q = mapToSM2Quality(r);
  assert(q === null, 'SM-2 = null → non chiamare API');
}

// ── evaluate: JSON malformato / vuoto ────────────────────────────────────────
console.log('\nevaluate — JSON malformato:');
{
  const card = { front:'la camera', back:'', variants:'INVALID_JSON', accepted_answers:'null' };
  const r = evaluate('la camera', card);
  assert(r.status === 'correct_exact', 'JSON malformato ignorato, match esatto OK');
}
{
  const card = { front:'la camera', back:'', variants:'[]', accepted_answers:'[]' };
  const r = evaluate('la stanza', card);
  assert(r.status === 'incorrect', 'nessuna variante → incorrect');
}

// ── evaluate: dati vecchi senza answer_variants ───────────────────────────────
console.log('\nevaluate — card senza varianti:');
{
  const card = { front:'veloce', back:'rápido' }; // nessun campo variants
  const r = evaluate('veloce', card);
  assert(r.status === 'correct_exact', 'front match senza variants');
}

// ── XSS: feedbackExplanation non deve eseguire JS ────────────────────────────
console.log('\nevaluate — sicurezza XSS:');
{
  // La risposta dell'utente non deve mai essere inserita in HTML non escaped
  // In evaluator.js le spiegazioni contengono userRaw come testo puro (non HTML)
  const xssAttempt = '<img src=x onerror=alert(1)>';
  const r = evaluate(xssAttempt, makeCard('la camera'));
  // La spiegazione può contenere la stringa, ma non deve essere markup
  // Il test verifica che evaluate() non crashe e che il contenuto sia stringa
  assert(typeof r.feedbackExplanation === 'string' || r.feedbackExplanation === null, 'feedbackExplanation è stringa');
  assert(typeof r.feedbackTitle === 'string', 'feedbackTitle è stringa');
  // Il contenuto grezzo DEVE essere escaped a livello feedback.js, non evaluator.js
  // (evaluator.js produce testo; feedback.js fa l'escaping per HTML)
  assert(r.userAnswer === xssAttempt, 'userAnswer preservato come testo grezzo');
}

// ── Riepilogo ─────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n⚠ ${failed} FALLITI`); process.exit(1); }
else console.log('\n✓ Tutti i test passati!');
