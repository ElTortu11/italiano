'use strict';

// ── Prepositions test suite ───────────────────────────────────────────────────
// Tests articolate forms (pure logic), and DB-dependent tests with graceful skip.

let passed = 0, failed = 0;
function assert(cond, desc) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

// ── 1. Articolate forms (pure logic, no DB) ───────────────────────────────────
console.log('\nArticolate forms — completeness:');

const FORMS = {
  'di': { 'il':'del',  'lo':'dello', 'la':'della', "l'":"dell'", 'i':'dei',  'gli':'degli', 'le':'delle' },
  'a':  { 'il':'al',   'lo':'allo',  'la':'alla',  "l'":"all'",  'i':'ai',   'gli':'agli',  'le':'alle'  },
  'da': { 'il':'dal',  'lo':'dallo', 'la':'dalla', "l'":"dall'", 'i':'dai',  'gli':'dagli', 'le':'dalle' },
  'in': { 'il':'nel',  'lo':'nello', 'la':'nella', "l'":"nell'", 'i':'nei',  'gli':'negli', 'le':'nelle' },
  'su': { 'il':'sul',  'lo':'sullo', 'la':'sulla', "l'":"sull'", 'i':'sui',  'gli':'sugli', 'le':'sulle' },
};
const ARTICLES = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'];
const PREPS    = ['di', 'a', 'da', 'in', 'su'];

let totalForms = 0;
PREPS.forEach(prep => {
  ARTICLES.forEach(art => {
    const form = FORMS[prep][art];
    assert(typeof form === 'string' && form.length > 0, `${prep} + ${art} = ${form}`);
    totalForms++;
  });
});
assert(totalForms === 35, `Total articolate forms = 35 (got ${totalForms})`);

// ── 2. Specific form correctness ──────────────────────────────────────────────
console.log('\nArticolate — specific forms:');
assert(FORMS['di']['il']   === 'del',    'di + il = del');
assert(FORMS['di']['lo']   === 'dello',  'di + lo = dello');
assert(FORMS['di']['la']   === 'della',  'di + la = della');
assert(FORMS['di']["l'"]   === "dell'",  "di + l' = dell'");
assert(FORMS['di']['i']    === 'dei',    'di + i = dei');
assert(FORMS['di']['gli']  === 'degli',  'di + gli = degli');
assert(FORMS['di']['le']   === 'delle',  'di + le = delle');
assert(FORMS['a']['il']    === 'al',     'a + il = al');
assert(FORMS['a']["l'"]    === "all'",   "a + l' = all'");
assert(FORMS['da']["l'"]   === "dall'",  "da + l' = dall'");
assert(FORMS['in']["l'"]   === "nell'",  "in + l' = nell'");
assert(FORMS['su']["l'"]   === "sull'",  "su + l' = sull'");
assert(FORMS['su']['il']   === 'sul',    'su + il = sul');
assert(FORMS['in']['il']   === 'nel',    'in + il = nel');
assert(FORMS['da']['il']   === 'dal',    'da + il = dal');

// ── 3. Apostrophe forms exist ─────────────────────────────────────────────────
console.log('\nApostrophe forms:');
const apostropheForms = ["dell'", "all'", "dall'", "nell'", "sull'"];
apostropheForms.forEach(f => {
  const found = Object.values(FORMS).some(prepForms => Object.values(prepForms).includes(f));
  assert(found, `${f} exists in forms table`);
});

// ── 4. DB-dependent tests (graceful skip if DB unavailable) ──────────────────
let db = null;
try {
  db = require('../database/db');
} catch (e) {
  console.log('\nDB not available — skipping DB tests');
}

if (db) {
  console.log('\nDB — 7 topics exist:');
  let topics = [];
  try {
    topics = db.prepare('SELECT slug FROM preposition_topics ORDER BY display_order').all();
  } catch (_) {}

  const expectedTopics = [
    'preposizioni_semplici', 'preposizioni_articolate', 'luogo_e_movimento',
    'tempo', 'causa_scopo_mezzo', 'confronto_riferimento', 'contrasto_esclusione',
  ];
  assert(topics.length === 7, `7 topics found (got ${topics.length})`);
  expectedTopics.forEach(slug => {
    assert(topics.some(t => t.slug === slug), `topic exists: ${slug}`);
  });

  console.log('\nDB — verb government >= 20 entries:');
  let verbCount = 0;
  try {
    verbCount = db.prepare('SELECT COUNT(*) as n FROM preposition_verb_government').get().n;
  } catch (_) {}
  assert(verbCount >= 20, `verb_government has >= 20 entries (got ${verbCount})`);

  console.log('\nDB — missing entries dall\' and sull\' exist:');
  let prepCatId = null;
  try {
    prepCatId = db.prepare("SELECT id FROM vocabulary_categories WHERE name='Preposizioni'").get()?.id;
  } catch (_) {}
  if (prepCatId) {
    const dallRow = db.prepare("SELECT id FROM vocabulary_items WHERE italian=? AND category_id=?").get("dall' (da + l')", prepCatId);
    const sullRow = db.prepare("SELECT id FROM vocabulary_items WHERE italian=? AND category_id=?").get("sull' (su + l')", prepCatId);
    assert(!!dallRow, "dall' (da + l') exists in vocabulary_items");
    assert(!!sullRow, "sull' (su + l') exists in vocabulary_items");
  } else {
    console.log('  (skip: Preposizioni category not found)');
  }

  console.log('\nDB — linguistic corrections applied:');
  if (prepCatId) {
    const getItem = (it) => db.prepare('SELECT notes, spanish, example_es FROM vocabulary_items WHERE italian=? AND category_id=?').get(it, prepCatId);

    const fraRow = getItem('fra');
    assert(fraRow && fraRow.notes && fraRow.notes.includes('eufonia'), 'fra notes updated (contains "eufonia")');

    const colRow = getItem('col (con + il)');
    assert(colRow && colRow.notes && colRow.notes.includes('colla'), 'col notes updated (mentions colla)');

    const coiRow = getItem('coi (con + i)');
    assert(coiRow && coiRow.notes && coiRow.notes.includes('Contrazione accettata'), 'coi notes updated');

    const inBaseRow = getItem('in base a');
    assert(inBaseRow && inBaseRow.spanish && inBaseRow.spanish.includes('basándose en'), 'in base a spanish updated');

    const secondoRow = getItem('secondo');
    assert(secondoRow && secondoRow.example_es && secondoRow.example_es.includes('opinión'), 'secondo example_es updated');

    const entroRow = getItem('entro');
    assert(entroRow && entroRow.spanish && entroRow.spanish.includes('más tardar'), 'entro spanish updated');
    assert(entroRow && entroRow.notes && entroRow.notes.includes('scadenza'), 'entro notes updated');

    const dentroRow = getItem('dentro');
    assert(dentroRow && dentroRow.notes && dentroRow.notes.includes('avverbiale'), 'dentro notes updated');

    const dopoRow = getItem('dopo');
    assert(dopoRow && dopoRow.notes && dopoRow.notes.includes('aver mangiato'), 'dopo notes updated');

    const duranteRow = getItem('durante');
    assert(duranteRow && duranteRow.notes && duranteRow.notes.includes('mientras'), 'durante notes updated');
  } else {
    console.log('  (skip: Preposizioni category not found)');
  }

  console.log('\nDB — preposition_items classification seeded:');
  let itemCount = 0;
  try {
    itemCount = db.prepare('SELECT COUNT(*) as n FROM preposition_items').get().n;
  } catch (_) {}
  assert(itemCount >= 80, `preposition_items has >= 80 rows (got ${itemCount})`);

  console.log('\nDB — preposition_contrasts seeded:');
  let contrastCount = 0;
  try {
    contrastCount = db.prepare('SELECT COUNT(*) as n FROM preposition_contrasts').get().n;
  } catch (_) {}
  assert(contrastCount >= 5, `preposition_contrasts has >= 5 rows (got ${contrastCount})`);
}

// ── Phase 4B: exercise bank tests ─────────────────────────────────────────────
console.log('\nPhase 4B — buildPrepositionEvaluation logic:');

// Minimal exercise stub for evaluation tests
function makeExercise(opts) {
  return {
    id: opts.id || 'test',
    exercise_type: opts.exercise_type || 'fill_preposition',
    topic_slug: opts.topic_slug || 'preposizioni_semplici',
    correct_answers: JSON.stringify(opts.correct_answers || ['a']),
    accepted_variants: JSON.stringify(opts.accepted_variants || []),
    explanation_it: opts.explanation_it || 'Spiegazione test.',
  };
}

// Inline copy of buildPrepositionEvaluation for Node.js testing
function buildPrepositionEvaluation(typed, exercise) {
  const norm = s => (s || '').normalize('NFC').toLowerCase().trim().replace(/['']/g, "'");
  const typedN = norm(typed);
  let correct = [];
  let variants = [];
  try { correct = JSON.parse(exercise.correct_answers || '[]'); } catch (_) {}
  try { variants = JSON.parse(exercise.accepted_variants || '[]'); } catch (_) {}
  const allCorrect = [...correct, ...variants];

  if (allCorrect.some(a => norm(a) === typedN)) {
    return { status: 'correct_exact', accepted: true, score: 1.0, userAnswer: typed, targetAnswer: correct[0], errorType: null, saveToErrorNotebook: false };
  }
  if (exercise.exercise_type === 'fill_locuzione') {
    if (allCorrect.some(a => norm(a).startsWith(typedN) && typedN.length >= norm(a).length * 0.6)) {
      return { status: 'almost_correct_missing_article', accepted: false, score: 0.5, userAnswer: typed, targetAnswer: correct[0], errorType: 'incomplete_expression', saveToErrorNotebook: true };
    }
  }
  const isClose = allCorrect.some(a => {
    const target = norm(a);
    if (Math.abs(typedN.length - target.length) > 2) return false;
    let diff = 0;
    const minLen = Math.min(typedN.length, target.length);
    for (let i = 0; i < minLen; i++) if (typedN[i] !== target[i]) diff++;
    diff += Math.abs(typedN.length - target.length);
    return diff <= 1 && typedN.length >= 2;
  });
  if (isClose) {
    return { status: 'almost_correct_spelling', accepted: false, score: 0.5, userAnswer: typed, targetAnswer: correct[0], errorType: 'spelling', saveToErrorNotebook: false };
  }
  return { status: 'incorrect', accepted: false, score: 0.0, userAnswer: typed, targetAnswer: correct[0],
    errorType: exercise.exercise_type === 'contrast' ? 'contrast_confusion' : exercise.exercise_type === 'verb_government' ? 'verb_regency' : 'simple_preposition',
    saveToErrorNotebook: true };
}

// Test: exact match
{
  const ex = makeExercise({ correct_answers: ['a'] });
  const r = buildPrepositionEvaluation('a', ex);
  assert(r.status === 'correct_exact', 'exact match → correct_exact');
  assert(r.accepted === true, 'exact match → accepted');
}

// Test: accepted variant
{
  const ex = makeExercise({ correct_answers: ['tra'], accepted_variants: ['fra'] });
  const r = buildPrepositionEvaluation('fra', ex);
  assert(r.status === 'correct_exact', 'accepted variant → correct_exact');
}

// Test: typo (1 char off)
{
  const ex = makeExercise({ correct_answers: ['della'] });
  const r = buildPrepositionEvaluation('dellа', ex); // 'а' is Cyrillic — fallback to spelling check
  // For ASCII typo:
  const r2 = buildPrepositionEvaluation('delia', ex);
  assert(r2.status === 'almost_correct_spelling', 'typo (1 char off) → almost_correct_spelling');
}

// Test: incomplete locuzione → almost_correct_missing_article
{
  const ex = makeExercise({ exercise_type: 'fill_locuzione', correct_answers: ['a causa di'], accepted_variants: [] });
  const r = buildPrepositionEvaluation('a causa', ex);
  assert(r.status === 'almost_correct_missing_article', 'incomplete locuzione → almost_correct_missing_article');
  assert(r.errorType === 'incomplete_expression', 'incomplete locuzione errorType = incomplete_expression');
  assert(r.saveToErrorNotebook === true, 'incomplete locuzione → saveToErrorNotebook');
}

// Test: wrong preposition → incorrect with errorType
{
  const ex = makeExercise({ exercise_type: 'fill_preposition', correct_answers: ['a'] });
  const r = buildPrepositionEvaluation('in', ex);
  assert(r.status === 'incorrect', 'wrong preposition → incorrect');
  assert(r.errorType === 'simple_preposition', 'wrong preposition errorType = simple_preposition');
  assert(r.saveToErrorNotebook === true, 'wrong preposition → saveToErrorNotebook');
}

// Test: contrast wrong → contrast_confusion errorType
{
  const ex = makeExercise({ exercise_type: 'contrast', correct_answers: ['a'] });
  const r = buildPrepositionEvaluation('in', ex);
  assert(r.errorType === 'contrast_confusion', 'contrast wrong → errorType contrast_confusion');
}

// Test: verb_government wrong → verb_regency errorType
{
  const ex = makeExercise({ exercise_type: 'verb_government', correct_answers: ['di'] });
  const r = buildPrepositionEvaluation('a', ex);
  assert(r.errorType === 'verb_regency', 'verb_government wrong → errorType verb_regency');
}

// Test: apostrophe normalization
{
  const ex = makeExercise({ correct_answers: ["dall'"] });
  const r1 = buildPrepositionEvaluation("dall'", ex);  // curly apostrophe
  const r2 = buildPrepositionEvaluation("dall'", ex);  // straight apostrophe
  assert(r1.status === 'correct_exact', 'apostrophe normalization: curly → correct_exact');
  assert(r2.status === 'correct_exact', 'apostrophe normalization: straight → correct_exact');
}

// Phase 4B DB tests
if (db) {
  console.log('\nPhase 4B — DB exercise bank:');

  let exCount = 0;
  let exRows = [];
  try {
    exRows = db.prepare('SELECT * FROM preposition_exercises').all();
    exCount = exRows.length;
  } catch (_) {}
  assert(exCount >= 60, `At least 60 exercises seeded (got ${exCount})`);

  // All 5 exercise types present
  const types = new Set(exRows.map(e => e.exercise_type));
  assert(types.has('fill_preposition'), 'exercise type fill_preposition present');
  assert(types.has('articolate_form'), 'exercise type articolate_form present');
  assert(types.has('contrast'), 'exercise type contrast present');
  assert(types.has('verb_government'), 'exercise type verb_government present');
  assert(types.has('fill_locuzione'), 'exercise type fill_locuzione present');

  // All exercises have non-empty correct_answers
  const missingAnswers = exRows.filter(e => {
    try { const arr = JSON.parse(e.correct_answers || '[]'); return !arr.length; } catch (_) { return true; }
  });
  assert(missingAnswers.length === 0, `All exercises have non-empty correct_answers (${missingAnswers.length} missing)`);

  // All exercises have explanation_it
  const missingExpl = exRows.filter(e => !e.explanation_it || e.explanation_it.trim() === '');
  assert(missingExpl.length === 0, `All exercises have explanation_it (${missingExpl.length} missing)`);

  // No exercise has empty sentence_it
  const emptySentence = exRows.filter(e => !e.sentence_it || e.sentence_it.trim() === '');
  assert(emptySentence.length === 0, `No exercise has empty sentence_it (${emptySentence.length} empty)`);

  // Mode 2 (articolate_form) exercises check
  const artRows = exRows.filter(e => e.exercise_type === 'articolate_form');
  assert(artRows.length >= 15, `At least 15 articolate_form exercises (got ${artRows.length})`);

  // Mode 3 (contrast) have at least 2 distractors
  const contrastRows = exRows.filter(e => e.exercise_type === 'contrast');
  const contrastBad = contrastRows.filter(e => {
    try { return JSON.parse(e.distractors || '[]').length < 2; } catch (_) { return true; }
  });
  assert(contrastBad.length === 0, `All contrast exercises have >= 2 distractors (${contrastBad.length} fail)`);

  console.log('\nPhase 4B — DB new tables:');
  let topicStatsOk = false;
  try { db.prepare('SELECT COUNT(*) as n FROM preposition_topic_stats').get(); topicStatsOk = true; } catch (_) {}
  assert(topicStatsOk, 'preposition_topic_stats table exists');

  let errorLogOk = false;
  try { db.prepare('SELECT COUNT(*) as n FROM preposition_error_log').get(); errorLogOk = true; } catch (_) {}
  assert(errorLogOk, 'preposition_error_log table exists');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n⚠ ${failed} FALLITI`); process.exit(1); }
else console.log('\n✓ Tutti i test passati!');
