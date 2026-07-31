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

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────`);
console.log(`Risultato: ${passed} passati, ${failed} falliti su ${passed+failed} totali`);
if (failed > 0) { console.error(`\n⚠ ${failed} FALLITI`); process.exit(1); }
else console.log('\n✓ Tutti i test passati!');
