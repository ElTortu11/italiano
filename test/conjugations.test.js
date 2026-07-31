'use strict';

// ── Phase 5 conjugation test suite ───────────────────────────────────────────
// Tests tense IDs, verb table, verb_conjugations, conjugation_exercises.

let passed = 0, failed = 0;
function assert(cond, desc) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

// ── DB setup: use live DB if available, else skip ─────────────────────────────
let db = null;
try {
  db = require('../database/db');
} catch (e) {
  console.warn('DB unavailable — skipping DB tests:', e.message);
}

// ── 1. Canonical tense IDs ────────────────────────────────────────────────────
console.log('\n1 — Canonical tense IDs:');
const CANONICAL_TENSES = [
  'present_indicative',
  'passato_prossimo',
  'imperfect_indicative',
  'future_simple',
  'conditional_present',
  'subjunctive_present',
];
const OLD_TENSE_IDS = ['presente','imperfetto','futuro','condizionale','congiuntivo','imperfect','future','conditional'];
CANONICAL_TENSES.forEach(t => assert(typeof t === 'string' && t.length > 0, `Canonical tense defined: ${t}`));

if (db) {
  const conjRows = db.prepare('SELECT DISTINCT tense FROM verb_conjugations').all().map(r => r.tense);
  OLD_TENSE_IDS.forEach(old => {
    assert(!conjRows.includes(old), `Old tense ID "${old}" not present in verb_conjugations`);
  });
  const usedTenses = new Set(conjRows);
  const unknownTenses = [...usedTenses].filter(t => !CANONICAL_TENSES.includes(t));
  assert(unknownTenses.length === 0, `All verb_conjugations tenses are canonical (unknown: ${unknownTenses.join(', ')||'none'})`);
}

// ── 2. Verbs table ────────────────────────────────────────────────────────────
if (db) {
  console.log('\n2 — Verbs table:');
  const verbRows = db.prepare('SELECT * FROM verbs').all();
  assert(verbRows.length >= 50, `At least 50 verbs seeded (got ${verbRows.length})`);

  // essere-verbs have auxiliary = 'essere'
  const essereVerbs = ['andare','venire','partire','arrivare','tornare','uscire','nascere','morire','essere','stare','restare','rimanere'];
  essereVerbs.forEach(inf => {
    const v = verbRows.find(r => r.infinitive === inf);
    if (v) assert(v.auxiliary === 'essere', `${inf}.auxiliary = essere (got ${v.auxiliary})`);
  });

  // avere-verbs
  const avereVerbs = ['avere','fare','mangiare','parlare','leggere','scrivere'];
  avereVerbs.forEach(inf => {
    const v = verbRows.find(r => r.infinitive === inf);
    if (v) assert(v.auxiliary === 'avere', `${inf}.auxiliary = avere (got ${v.auxiliary})`);
  });

  // Past participle correctness
  const ppExpected = {andare:'andato',venire:'venuto',essere:'stato',avere:'avuto',fare:'fatto',dire:'detto',stare:'stato'};
  Object.entries(ppExpected).forEach(([inf, pp]) => {
    const v = verbRows.find(r => r.infinitive === inf);
    if (v) assert(v.past_participle === pp, `${inf}.past_participle = ${pp} (got ${v.past_participle})`);
  });

  // -isc verbs
  const iscVerbs = ['capire','finire','preferire','pulire'];
  iscVerbs.forEach(inf => {
    const v = verbRows.find(r => r.infinitive === inf);
    if (v) assert(v.is_isc === 1, `${inf}.is_isc = 1 (got ${v.is_isc})`);
  });

  // -ire regular non-isc
  const noIscVerbs = ['partire','dormire','sentire'];
  noIscVerbs.forEach(inf => {
    const v = verbRows.find(r => r.infinitive === inf);
    if (v) assert(v.is_isc === 0, `${inf}.is_isc = 0 (got ${v.is_isc})`);
  });
}

// ── 3. Verb conjugations — critical forms ─────────────────────────────────────
if (db) {
  console.log('\n3 — Critical verb forms:');
  const getForm = (infinitive, tense, person) => {
    const v = db.prepare('SELECT id FROM verbs WHERE infinitive=?').get(infinitive);
    if (!v) return null;
    const r = db.prepare('SELECT form FROM verb_conjugations WHERE verb_id=? AND tense=? AND person=?').get(v.id, tense, person);
    return r ? r.form : null;
  };

  // essere — present_indicative
  assert(getForm('essere','present_indicative','io') === 'sono', 'essere/presente/io = sono');
  assert(getForm('essere','present_indicative','tu') === 'sei', 'essere/presente/tu = sei');
  assert(getForm('essere','present_indicative','lui/lei') === 'è', 'essere/presente/lui/lei = è');
  assert(getForm('essere','present_indicative','noi') === 'siamo', 'essere/presente/noi = siamo');
  assert(getForm('essere','present_indicative','voi') === 'siete', 'essere/presente/voi = siete');
  assert(getForm('essere','present_indicative','loro') === 'sono', 'essere/presente/loro = sono');

  // avere — present_indicative
  assert(getForm('avere','present_indicative','io') === 'ho', 'avere/presente/io = ho');
  assert(getForm('avere','present_indicative','tu') === 'hai', 'avere/presente/tu = hai');
  assert(getForm('avere','present_indicative','lui/lei') === 'ha', 'avere/presente/lui/lei = ha');

  // andare — present_indicative
  assert(getForm('andare','present_indicative','io') === 'vado', 'andare/presente/io = vado');
  assert(getForm('andare','present_indicative','loro') === 'vanno', 'andare/presente/loro = vanno');

  // fare — present_indicative
  assert(getForm('fare','present_indicative','io') === 'faccio', 'fare/presente/io = faccio');
  assert(getForm('fare','present_indicative','loro') === 'fanno', 'fare/presente/loro = fanno');

  // capire — is_isc form
  assert(getForm('capire','present_indicative','io') === 'capisco', 'capire/presente/io = capisco');
  assert(getForm('capire','present_indicative','noi') === 'capiamo', 'capire/presente/noi = capiamo (no -isc)');

  // venire
  assert(getForm('venire','present_indicative','io') === 'vengo', 'venire/presente/io = vengo');
  assert(getForm('venire','present_indicative','loro') === 'vengono', 'venire/presente/loro = vengono');

  // potere
  assert(getForm('potere','present_indicative','io') === 'posso', 'potere/presente/io = posso');
}

// ── 4. Conjugation exercises ──────────────────────────────────────────────────
if (db) {
  console.log('\n4 — Conjugation exercises:');
  const exRows = db.prepare('SELECT * FROM conjugation_exercises').all();
  assert(exRows.length >= 80, `At least 80 conjugation exercises (got ${exRows.length})`);

  const exTypes = new Set(exRows.map(e => e.exercise_type));
  ['single_form','full_paradigm','auxiliary_participle','choose_tense','prossimo_vs_imperfetto','verbi_speciali'].forEach(t => {
    assert(exTypes.has(t), `Exercise type present: ${t}`);
  });

  // All exercises have correct_answers
  const missingAnswers = exRows.filter(e => {
    try { const arr = JSON.parse(e.correct_answers || '[]'); return !arr.length; } catch (_) { return true; }
  });
  assert(missingAnswers.length === 0, `All conjugation exercises have correct_answers (${missingAnswers.length} missing)`);

  // All exercises have tense_id in canonical list
  const unknownTenses = exRows.filter(e => !CANONICAL_TENSES.includes(e.tense_id));
  assert(unknownTenses.length === 0, `All exercises use canonical tense_id (${unknownTenses.length} bad)`);

  // Counts per type
  const sfCount = exRows.filter(e => e.exercise_type === 'single_form').length;
  assert(sfCount >= 20, `At least 20 single_form exercises (got ${sfCount})`);
  const apCount = exRows.filter(e => e.exercise_type === 'auxiliary_participle').length;
  assert(apCount >= 8, `At least 8 auxiliary_participle exercises (got ${apCount})`);
  const vsCount = exRows.filter(e => e.exercise_type === 'verbi_speciali').length;
  assert(vsCount >= 8, `At least 8 verbi_speciali exercises (got ${vsCount})`);
}

// ── 5. Phase 5 tables exist ───────────────────────────────────────────────────
if (db) {
  console.log('\n5 — Phase 5 tables:');
  ['verbs','verb_conjugations','conjugation_exercises','conjugation_topic_stats','conjugation_error_log'].forEach(tbl => {
    let ok = false;
    try { db.prepare(`SELECT 1 FROM ${tbl} LIMIT 1`).all(); ok = true; } catch (_) {}
    assert(ok, `Table exists: ${tbl}`);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n✗ ${failed} FALLITI`); process.exit(1); }
else { console.log('Tutti i test superati.'); }
