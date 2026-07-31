/**
 * Test unitari per public/js/evaluator.js
 * Esecuzione: node test/evaluator.test.js
 */
'use strict';
const Evaluator = require('../public/js/evaluator');
const { evaluate, normalizeForComparison, extractArticle, stripArticle,
        levenshtein, isLikelyTypo, detectMissingArticle, detectWrongArticle,
        mapToSM2Quality } = Evaluator;

let passed = 0, failed = 0;

function assert(cond, desc) {
  if (cond) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    failed++;
  }
}

function makeCard(front, variants = [], accepted_answers = []) {
  return { front, back: 'placeholder', variants: JSON.stringify(variants), accepted_answers: JSON.stringify(accepted_answers) };
}

// ── normalizeForComparison ────────────────────────────────────────────────────
console.log('\nnormalizeForComparison:');
assert(normalizeForComparison("L'uomo") === "l'uomo",        'apostrofo NFC');
assert(normalizeForComparison('  Ciao  ') === 'ciao',        'trim + lowercase');
assert(normalizeForComparison('Ciao!') === 'ciao',           'punteggiatura finale rimossa');
assert(normalizeForComparison('il  gatto') === 'il gatto',   'spazi multipli normalizzati');
assert(normalizeForComparison('’').includes("'"),       'apostrofo tipografico');

// ── extractArticle / stripArticle ────────────────────────────────────────────
console.log('\nextractArticle / stripArticle:');
assert(extractArticle("la camera") === 'la',    'la');
assert(extractArticle("il gatto") === 'il',     'il');
assert(extractArticle("l'uomo") === "l'",       "l'");
assert(extractArticle("gli uomini") === 'gli',  'gli');
assert(extractArticle("veloce") === null,       'nessun articolo');
assert(stripArticle("la camera") === 'camera',  'stripArticle la');
assert(stripArticle("l'uomo") === 'uomo',       "stripArticle l'");
assert(stripArticle("il sangue") === 'sangue',  'stripArticle il');
assert(stripArticle("veloce") === 'veloce',     'stripArticle senza articolo');

// ── levenshtein ───────────────────────────────────────────────────────────────
console.log('\nlevenshtein:');
assert(levenshtein('kitten','sitting') === 3, 'kitten→sitting = 3');
assert(levenshtein('abc','abc') === 0,        'uguale = 0');
assert(levenshtein('','abc') === 3,           'vuoto = lunghezza');
assert(levenshtein('veloce','velice') === 1,  'veloce→velice = 1');

// ── isLikelyTypo ─────────────────────────────────────────────────────────────
console.log('\nisLikelyTypo:');
assert(isLikelyTypo('veloce','velice') === true,    'typo veloce');
assert(isLikelyTypo('bello','belo') === true,        'typo bello');
assert(isLikelyTypo('il','lo') === false,            'articoli corti: no typo');
assert(isLikelyTypo('pena','pene') === false,        'blacklist: no typo');
assert(isLikelyTypo('casa','cassa') === false,       'stesso len, dist 1 ma parola diversa — blacklisted? no...actually casa/cassa=ok let me check: length 4 vs 5, dist=1, ok it passes BUT casa is 4 chars so should fail length check');
// casa = 4 chars < 4 → no typo (min 4 is exclusive, < 4 would fail)
// Actually we check ul < 4, casa has ul=4, so it's equal to 4, not less than 4
// Let me verify: casa has 4 chars, tl=cassa has 5 chars, both >=4, lenDiff=1
// dist=levenshtein(casa,cassa)=1, maxLen=5 <=6, so maxLen<=6 && dist>1 is false, so typo=true
// That's wrong! casa vs cassa should not be a typo
// Actually both have length >=4, let me reconsider...
// The blacklist has 'casa|cassa', so this should return false via inBlacklist

assert(isLikelyTypo('entusiasmio','entusiasmo') === true, 'typo lungo entusiasmo');
assert(isLikelyTypo('abc','xyz') === false,                'completamente diverso');

// ── detectMissingArticle ──────────────────────────────────────────────────────
console.log('\ndetectMissingArticle:');
assert(detectMissingArticle('camera', normalizeForComparison('la camera')) === true,  'camera vs la camera');
assert(detectMissingArticle('gatto', normalizeForComparison('il gatto')) === true,    'gatto vs il gatto');
assert(detectMissingArticle('la camera', normalizeForComparison('la camera')) === false, 'la camera = articolo presente');
assert(detectMissingArticle('rapido', normalizeForComparison('rapido')) === false,    'senza articolo: no missing');

// ── detectWrongArticle ────────────────────────────────────────────────────────
console.log('\ndetectWrongArticle:');
assert(detectWrongArticle('il mano', normalizeForComparison('la mano')) === true,   'il mano → la mano');
assert(detectWrongArticle('lo gatto', normalizeForComparison('il gatto')) === true, 'lo gatto → il gatto');
assert(detectWrongArticle('la mano', normalizeForComparison('la mano')) === false,  'stesso articolo: no errore');
assert(detectWrongArticle('mano', normalizeForComparison('la mano')) === false,     'articolo mancante ≠ sbagliato');

// ── evaluate: correct_exact ───────────────────────────────────────────────────
console.log('\nevaluate — correct_exact:');
{
  const r = evaluate('la camera', makeCard('la camera'));
  assert(r.status === 'correct_exact', 'status');
  assert(r.accepted === true, 'accepted');
  assert(r.score === 1.0, 'score');
  assert(mapToSM2Quality(r) === 5, 'SM-2 = 5');
}

// ── evaluate: correct_exact con parentesi ────────────────────────────────────
console.log('\nevaluate — parentesi nel target:');
{
  const r = evaluate('della', makeCard('della (di + la)'));
  assert(r.status === 'correct_exact', 'status');
}

// ── evaluate: correct_normalized ─────────────────────────────────────────────
console.log('\nevaluate — correct_normalized (apostrofo):');
{
  const r = evaluate("l’uomo", makeCard("l'uomo"));
  assert(r.status === 'correct_exact' || r.status === 'correct_normalized', 'apostrofo curvo = ok');
  assert(r.accepted === true, 'accepted');
}

// ── evaluate: correct_synonym (strutturato) ───────────────────────────────────
console.log('\nevaluate — correct_synonym:');
{
  const variants = [{ answer: 'la stanza', variant_type: 'synonym', accepted: true, note: '"Stanza" è sinonimo di "camera".', contexts: '[]' }];
  const r = evaluate('la stanza', makeCard('la camera', variants));
  assert(r.status === 'correct_synonym', 'status');
  assert(r.accepted === true, 'accepted');
  assert(r.matchedAnswer === 'la stanza', 'matchedAnswer');
  assert(mapToSM2Quality(r) === 5, 'SM-2 = 5');
}

// ── evaluate: correct_synonym (legacy accepted_answers) ──────────────────────
console.log('\nevaluate — legacy accepted_answers:');
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
  assert(r.accepted === false, 'accepted = false (lemma_and_article mode)');
  assert(r.errorType === 'missing_article', 'errorType');
  assert(mapToSM2Quality(r) === 2, 'SM-2 = 2');
  assert(r.feedbackExplanation.includes('la camera'), 'spiegazione menziona target');
}
{
  const r = evaluate('camera', makeCard('la camera'), { mode: 'lemma_only' });
  assert(r.status === 'almost_correct_missing_article', 'status in lemma_only mode');
  assert(r.accepted === true, 'accepted = true in lemma_only mode');
  assert(mapToSM2Quality(r) === 4, 'SM-2 = 4 in lemma_only');
}

// ── evaluate: almost_correct_wrong_article ────────────────────────────────────
console.log('\nevaluate — wrong article:');
{
  const r = evaluate('il mano', makeCard('la mano'));
  assert(r.status === 'almost_correct_wrong_article', 'status');
  assert(r.accepted === false, 'accepted = false');
  assert(mapToSM2Quality(r) === 2, 'SM-2 = 2');
}

// ── evaluate: almost_correct_spelling ────────────────────────────────────────
console.log('\nevaluate — spelling typo:');
{
  const r = evaluate('entusiasmmo', makeCard('entusiasmo'));
  assert(r.status === 'almost_correct_spelling', 'status');
  assert(r.accepted === false, 'not accepted');
  assert(r.saveToErrorNotebook === false, 'non salvato nel quaderno');
  assert(mapToSM2Quality(r) === 3, 'SM-2 = 3');
}

// ── evaluate: incorrect_related_word ─────────────────────────────────────────
console.log('\nevaluate — near_miss:');
{
  const variants = [{ answer: 'cattivo', variant_type: 'near_miss', accepted: false, note: '"Cattivo" significa malo, non brutto.', contexts: '[]' }];
  const r = evaluate('cattivo', makeCard('brutto', variants));
  assert(r.status === 'incorrect_related_word', 'status');
  assert(r.accepted === false, 'accepted = false');
  assert(r.saveToErrorNotebook === true, 'salvato nel quaderno');
  assert(mapToSM2Quality(r) === 1, 'SM-2 = 1');
}

// ── evaluate: incorrect ───────────────────────────────────────────────────────
console.log('\nevaluate — incorrect:');
{
  const r = evaluate('il sole', makeCard('la luna'));
  assert(r.status === 'incorrect', 'status');
  assert(r.accepted === false, 'accepted = false');
  assert(r.saveToErrorNotebook === true, 'salvato nel quaderno');
  assert(mapToSM2Quality(r) === 0, 'SM-2 = 0');
}

// ── evaluate: contextual variant ─────────────────────────────────────────────
console.log('\nevaluate — contextual:');
{
  const variants = [{ answer: 'arancioni', variant_type: 'plural_form', accepted: true, note: 'Forma plurale.', contexts: '[]' }];
  const r = evaluate('arancioni', makeCard('arancione', variants));
  assert(r.status === 'correct_contextual', 'status');
  assert(r.accepted === true, 'accepted');
  assert(mapToSM2Quality(r) === 4, 'SM-2 = 4');
}

// ── Riepilogo ─────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} test totali`);
if (failed > 0) {
  console.error(`\n⚠ ${failed} test falliti`);
  process.exit(1);
} else {
  console.log('\n✓ Tutti i test passati!');
}
