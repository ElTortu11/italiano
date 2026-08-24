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

// ── 6. Phase 5B additions ─────────────────────────────────────────────────────
if (db) {
  console.log('\n6 — Phase 5B: Verb metadata completeness:');
  const missingAux = db.prepare("SELECT infinitive FROM verbs WHERE auxiliary IS NULL OR auxiliary=''").all();
  assert(missingAux.length === 0, `All verbs have auxiliary (missing: ${missingAux.map(v=>v.infinitive).join(',')||'none'})`);

  const missingPP = db.prepare("SELECT infinitive FROM verbs WHERE past_participle IS NULL OR past_participle=''").all();
  assert(missingPP.length === 0, `All verbs have past_participle (missing: ${missingPP.map(v=>v.infinitive).join(',')||'none'})`);

  const missingGroup = db.prepare("SELECT infinitive FROM verbs WHERE conjugation_group IS NULL OR conjugation_group=''").all();
  assert(missingGroup.length === 0, `All verbs have conjugation_group (missing: ${missingGroup.map(v=>v.infinitive).join(',')||'none'})`);

  const totalVerbs = db.prepare('SELECT COUNT(*) as n FROM verbs').get().n;
  assert(totalVerbs >= 90, `At least 90 verbs seeded (got ${totalVerbs})`);
}

if (db) {
  console.log('\n7 — Phase 5B: auxiliary_variants column:');
  const cols = db.prepare("PRAGMA table_info(verbs)").all().map(c=>c.name);
  assert(cols.includes('auxiliary_variants'), 'auxiliary_variants column exists on verbs');
  assert(cols.includes('auxiliary_note'), 'auxiliary_note column exists on verbs');

  const passare = db.prepare("SELECT auxiliary_variants FROM verbs WHERE infinitive='passare'").get();
  if (passare && passare.auxiliary_variants) {
    try {
      const parsed = JSON.parse(passare.auxiliary_variants);
      assert(parsed.length >= 2, `passare has >= 2 auxiliary_variants (got ${parsed.length})`);
    } catch(_) { assert(false, 'passare auxiliary_variants is valid JSON'); }
  }

  const finire = db.prepare("SELECT auxiliary_variants FROM verbs WHERE infinitive='finire'").get();
  if (finire && finire.auxiliary_variants) {
    try {
      const parsed = JSON.parse(finire.auxiliary_variants);
      assert(parsed.length >= 2, `finire has >= 2 auxiliary_variants (got ${parsed.length})`);
    } catch(_) {}
  }
}

if (db) {
  console.log('\n8 — Phase 5B: Critical forms:');
  const getF = (inf, tense, person) => {
    const v = db.prepare('SELECT id FROM verbs WHERE infinitive=?').get(inf);
    if (!v) return null;
    const r = db.prepare('SELECT form FROM verb_conjugations WHERE verb_id=? AND tense=? AND person=?').get(v.id, tense, person);
    return r ? r.form : null;
  };
  assert(getF('piacere','present_indicative','lui/lei') === 'piace', 'piacere/presente/lui-lei = piace');
  assert(getF('piacere','present_indicative','loro') === 'piacciono', 'piacere/presente/loro = piacciono');
  assert(getF('morire','present_indicative','io') === 'muoio', 'morire/presente/io = muoio');
  assert(getF('essere','future_simple','io') === 'sarò', 'essere/futuro/io = sarò');
  assert(getF('avere','future_simple','io') === 'avrò', 'avere/futuro/io = avrò');
  assert(getF('essere','subjunctive_present','io') === 'sia', 'essere/congiuntivo/io = sia');
  assert(getF('avere','subjunctive_present','noi') === 'abbiamo', 'avere/congiuntivo/noi = abbiamo');
  assert(getF('sedere','present_indicative','io') === 'siedo', 'sedere/presente/io = siedo');
  assert(getF('rimanere','present_indicative','io') === 'rimango', 'rimanere/presente/io = rimango');
  assert(getF('dare','present_indicative','lui/lei') === 'dà', 'dare/presente/lui-lei = dà');
  assert(getF('finire','present_indicative','io') === 'finisco', 'finire/presente/io = finisco (isc)');
  assert(getF('venire','future_simple','io') === 'verrò', 'venire/futuro/io = verrò');
}

if (db) {
  console.log('\n9 — Phase 5B: New exercise types:');
  const exRows = db.prepare('SELECT * FROM conjugation_exercises').all();
  assert(exRows.length >= 140, `At least 140 total exercises (got ${exRows.length})`);

  const exTypes = new Set(exRows.map(e => e.exercise_type));
  ['single_form','full_paradigm','auxiliary_participle','choose_tense','prossimo_vs_imperfetto',
   'verbi_speciali','irregolarita','riflessivi'].forEach(t => {
    assert(exTypes.has(t), `Exercise type present: ${t}`);
  });

  const irrCount = exRows.filter(e => e.exercise_type === 'irregolarita').length;
  assert(irrCount >= 5, `At least 5 irregolarita exercises (got ${irrCount})`);
  const rifCount = exRows.filter(e => e.exercise_type === 'riflessivi').length;
  assert(rifCount >= 5, `At least 5 riflessivi exercises (got ${rifCount})`);
  const chooseCount = exRows.filter(e => e.exercise_type === 'choose_tense').length;
  assert(chooseCount >= 15, `At least 15 choose_tense exercises (got ${chooseCount})`);
  const piCount = exRows.filter(e => e.exercise_type === 'prossimo_vs_imperfetto').length;
  assert(piCount >= 12, `At least 12 prossimo_vs_imperfetto exercises (got ${piCount})`);

  const missingExpl = exRows.filter(e => !e.explanation_it || e.explanation_it === '').length;
  assert(missingExpl <= 10, `Most exercises have explanation_it (${missingExpl} missing)`);
}

if (db) {
  console.log('\n10 — Phase 5B: Error log new columns:');
  const errCols = db.prepare("PRAGMA table_info(conjugation_error_log)").all().map(c=>c.name);
  ['exercise_id','subject','exercise_mode','secondary_issues','auxiliary','participle',
   'last_reviewed_at','review_count','correct_streak','mastery_status'].forEach(col => {
    assert(errCols.includes(col), `conjugation_error_log has column: ${col}`);
  });
}

if (db) {
  console.log('\n11 — Phase 5B: No Spanish forms in verb_conjugations:');
  const spanish = db.prepare("SELECT v.infinitive, vc.form FROM verb_conjugations vc JOIN verbs v ON v.id=vc.verb_id WHERE vc.form IN ('hablan','comen','viven','soy','eres','somos')").all();
  assert(spanish.length === 0, `No Spanish forms in verb_conjugations (found: ${spanish.map(r=>r.form).join(',')||'none'})`);
}

if (db) {
  console.log('\n12 — 100 verbs, exact list, no duplicates:');
  const CRITICAL_VERBS = ['aiutare','alzarsi','chiamarsi','fermarsi','lavarsi','ricordarsi',
    'sedersi','sentirsi','vestirsi','svegliarsi','essere','avere','andare','fare','venire',
    'parlare','studiare','capire','piacere','mancare'];
  const actualVerbs = db.prepare('SELECT infinitive FROM verbs').all().map(r=>r.infinitive);
  assert(actualVerbs.length === 100, `Exactly 100 verbs (found ${actualVerbs.length})`);
  const dups = db.prepare('SELECT infinitive, COUNT(*) as n FROM verbs GROUP BY infinitive HAVING n>1').all();
  assert(dups.length === 0, `No duplicate verb infinitives (found: ${dups.map(d=>d.infinitive).join(',')||'none'})`);
  CRITICAL_VERBS.forEach(inf => {
    assert(actualVerbs.includes(inf), `Verb present: ${inf}`);
  });
}

if (db) {
  console.log('\n13 — Full conjugation audit (3600 positions):');
  const TENSES = ['present_indicative','passato_prossimo','imperfect_indicative','future_simple','conditional_present','subjunctive_present'];
  const PERSONS = ['io','tu','lui/lei','noi','voi','loro'];
  const totalV = db.prepare('SELECT COUNT(*) as n FROM verbs').get().n;
  const totalForms = db.prepare("SELECT COUNT(*) as n FROM verb_conjugations WHERE form IS NOT NULL AND form != ''").get().n;
  const expected = totalV * 6 * 6;
  assert(totalForms === expected, `Form coverage: ${totalForms}/${expected} (${totalV} verbs × 36)`);
  assert(totalForms >= 3600, `At least 3600 forms stored (found ${totalForms})`);

  // Check a sample of reflexive forms
  const rfVerb = db.prepare("SELECT id FROM verbs WHERE infinitive='alzarsi'").get();
  if (rfVerb) {
    const rf = db.prepare("SELECT form FROM verb_conjugations WHERE verb_id=? AND tense='present_indicative' AND person='io'").get(rfVerb.id);
    assert(rf && rf.form === 'mi alzo', `alzarsi io = mi alzo (found: ${rf && rf.form})`);
    const rfPP = db.prepare("SELECT form FROM verb_conjugations WHERE verb_id=? AND tense='passato_prossimo' AND person='io'").get(rfVerb.id);
    assert(rfPP && rfPP.form.includes('sono'), `alzarsi passato prossimo has essere (found: ${rfPP && rfPP.form})`);
  }
}

if (db) {
  console.log('\n14 — Reflexive exercises: 8 priority verbs covered:');
  const REFL_VERBS = ['chiamarsi','lavarsi','fermarsi','ricordarsi','sentirsi','sedersi','vestirsi','svegliarsi'];
  const rifCount = db.prepare("SELECT COUNT(*) as n FROM conjugation_exercises WHERE exercise_type='riflessivi'").get().n;
  assert(rifCount >= 16, `At least 16 riflessivi exercises (found ${rifCount})`);
  REFL_VERBS.forEach(inf => {
    const n = db.prepare("SELECT COUNT(*) as n FROM conjugation_exercises WHERE exercise_type='riflessivi' AND (prompt_it LIKE ? OR context_sentence LIKE ?)").get('%'+inf+'%', '%'+inf+'%').n;
    assert(n >= 1, `Reflexive exercise exists for ${inf} (found ${n})`);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n✗ ${failed} FALLITI`); process.exit(1); }
else { console.log('Tutti i test superati.'); }
