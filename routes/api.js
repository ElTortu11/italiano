const express = require('express');
const router = express.Router();
const db = require('../database/db');

const now = () => Math.floor(Date.now() / 1000);
const today = () => new Date().toISOString().split('T')[0];

// ── Health ──────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ ok: true }));

// ── Settings ────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)');
  const upsertMany = db.transaction((entries) => {
    entries.forEach(([k, v]) => update.run(k, String(v), now()));
  });
  upsertMany(Object.entries(req.body));
  res.json({ ok: true });
});

// ── Dashboard / Stats ───────────────────────────────────────────────────────
router.get('/stats/dashboard', (req, res) => {
  const todayStr = today();

  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => settings[r.key] = r.value);

  const totalWords = db.prepare('SELECT COUNT(*) as n FROM vocabulary_items').get().n;
  const learnedWords = db.prepare('SELECT COUNT(*) as n FROM flashcards WHERE repetitions >= 2').get().n;
  const dueCards = db.prepare('SELECT COUNT(*) as n FROM flashcards WHERE next_review <= ?').get(now()).n;

  const todayStats = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(todayStr) || {};
  const streak = parseInt(settings.streak || 0);
  const bestStreak = parseInt(settings.best_streak || 0);

  const weekStats = db.prepare(`
    SELECT SUM(minutes_studied) as mins, SUM(flashcards_reviewed) as cards,
           COUNT(*) as days, AVG(accuracy) as acc
    FROM daily_stats WHERE date >= date('now', '-7 days')
  `).get() || {};

  const recentErrors = db.prepare(`
    SELECT id, original_text, corrected_text, category, importance, mastery
    FROM errors WHERE mastery < 2 ORDER BY importance DESC, created_at DESC LIMIT 5
  `).all();

  const weakCategories = db.prepare(`
    SELECT vc.name, vc.icon,
           COUNT(f.id) as total,
           SUM(CASE WHEN f.repetitions >= 2 THEN 1 ELSE 0 END) as learned,
           AVG(CASE WHEN f.total_reviews > 0 THEN CAST(f.correct_reviews as REAL)/f.total_reviews ELSE null END) as acc
    FROM vocabulary_categories vc
    JOIN flashcards f ON f.category_id = vc.id
    GROUP BY vc.id
    HAVING total > 0
    ORDER BY acc ASC NULLS FIRST
    LIMIT 3
  `).all();

  const recentMilestones = db.prepare(`
    SELECT * FROM milestones WHERE unlocked = 1 ORDER BY unlocked_at DESC LIMIT 3
  `).all();

  res.json({
    totalWords, learnedWords, dueCards, streak, bestStreak,
    todayMinutes: todayStats.minutes_studied || 0,
    todayCards: todayStats.flashcards_reviewed || 0,
    goalMet: todayStats.goal_met || 0,
    weekMinutes: weekStats.mins || 0,
    weekDays: weekStats.days || 0,
    weekAccuracy: weekStats.acc || 0,
    goalLevel: settings.goal_level || 'B2',
    dailyGoalMinutes: parseInt(settings.daily_minutes || 30),
    recentErrors, weakCategories, recentMilestones,
  });
});

// ── Progress ─────────────────────────────────────────────────────────────────
router.get('/stats/progress', (req, res) => {
  const last30 = db.prepare(`
    SELECT date, minutes_studied, flashcards_reviewed, accuracy, goal_met
    FROM daily_stats WHERE date >= date('now', '-30 days') ORDER BY date ASC
  `).all();

  const categoryProgress = db.prepare(`
    SELECT vc.id, vc.name, vc.icon, vc.color,
           COUNT(f.id) as total,
           SUM(CASE WHEN f.repetitions >= 2 THEN 1 ELSE 0 END) as learned,
           SUM(CASE WHEN f.repetitions = 0 THEN 1 ELSE 0 END) as unseen,
           AVG(CASE WHEN f.total_reviews > 0 THEN CAST(f.correct_reviews as REAL)/f.total_reviews ELSE null END) as accuracy
    FROM vocabulary_categories vc
    LEFT JOIN flashcards f ON f.category_id = vc.id
    GROUP BY vc.id ORDER BY vc.sort_order
  `).all();

  const errorsByCategory = db.prepare(`
    SELECT category, COUNT(*) as total,
           SUM(CASE WHEN mastery = 2 THEN 1 ELSE 0 END) as resolved
    FROM errors GROUP BY category
  `).all();

  const conjugationStats = db.prepare(`
    SELECT verb, tense,
           COUNT(*) as attempts,
           SUM(is_correct) as correct
    FROM conjugation_attempts GROUP BY verb, tense ORDER BY correct*1.0/attempts ASC LIMIT 10
  `).all();

  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => settings[r.key] = r.value);

  res.json({ last30, categoryProgress, errorsByCategory, conjugationStats, settings });
});

// ── Vocabulary Categories ────────────────────────────────────────────────────
router.get('/vocabulary/categories', (req, res) => {
  const cats = db.prepare(`
    SELECT vc.*,
      COUNT(DISTINCT vi.id) as word_count,
      SUM(CASE WHEN f.repetitions >= 2 THEN 1 ELSE 0 END) as learned_count,
      AVG(CASE WHEN f.total_reviews > 0 THEN CAST(f.correct_reviews as REAL)/f.total_reviews ELSE null END) as accuracy,
      MIN(f.next_review) as next_review
    FROM vocabulary_categories vc
    LEFT JOIN vocabulary_items vi ON vi.category_id = vc.id
    LEFT JOIN flashcards f ON f.vocabulary_id = vi.id
    GROUP BY vc.id ORDER BY vc.sort_order, vc.name
  `).all();
  res.json(cats);
});

router.post('/vocabulary/categories', (req, res) => {
  const { name, icon = '📚', color = '#1e6b45' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(`INSERT INTO vocabulary_categories(name,icon,color,is_custom) VALUES(?,?,?,1)`).run(name, icon, color);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/vocabulary/categories/:id', (req, res) => {
  db.prepare('DELETE FROM vocabulary_categories WHERE id=? AND is_custom=1').run(req.params.id);
  res.json({ ok: true });
});

// ── Vocabulary Words ─────────────────────────────────────────────────────────
router.get('/vocabulary/words', (req, res) => {
  const { category, cefr, type, search, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT vi.*, f.id as flashcard_id, f.ef, f.repetitions, f.next_review, f.correct_reviews, f.total_reviews
             FROM vocabulary_items vi LEFT JOIN flashcards f ON f.vocabulary_id = vi.id WHERE 1=1`;
  const params = [];
  if (category) { sql += ' AND vi.category_id = ?'; params.push(category); }
  if (cefr) { sql += ' AND vi.cefr_level = ?'; params.push(cefr); }
  if (type) { sql += ' AND vi.word_type = ?'; params.push(type); }
  if (search) { sql += ' AND (vi.italian LIKE ? OR vi.spanish LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ` ORDER BY vi.id LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  const words = db.prepare(sql).all(...params);
  const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as n FROM').replace(/ORDER BY.*$/, '')).get(...params.slice(0, -2))?.n || 0;
  res.json({ words, total });
});

router.get('/vocabulary/words/:id', (req, res) => {
  const word = db.prepare(`SELECT vi.*, f.id as flashcard_id, f.ef, f.repetitions, f.next_review, f.interval, f.correct_reviews, f.total_reviews
    FROM vocabulary_items vi LEFT JOIN flashcards f ON f.vocabulary_id = vi.id WHERE vi.id = ?`).get(req.params.id);
  if (!word) return res.status(404).json({ error: 'not found' });
  res.json(word);
});

router.post('/vocabulary/words', (req, res) => {
  const { italian, spanish, category_id, word_type, gender, article, plural, example_it, example_es,
    cefr_level, notes, false_friend_note, collocations, register } = req.body;
  if (!italian || !spanish) return res.status(400).json({ error: 'italian and spanish required' });
  const r = db.prepare(`
    INSERT INTO vocabulary_items(italian,spanish,category_id,word_type,gender,article,plural,example_it,example_es,cefr_level,notes,false_friend_note,collocations,register,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(italian, spanish, category_id||null, word_type||'noun', gender||null, article||null, plural||null,
    example_it||null, example_es||null, cefr_level||'B1', notes||null, false_friend_note||null,
    JSON.stringify(collocations||[]), register||'neutral', now());
  // Create flashcard
  db.prepare(`INSERT INTO flashcards(vocabulary_id,front,back,direction,category_id) VALUES(?,?,?,?,?)`)
    .run(r.lastInsertRowid, italian, spanish, 'it-es', category_id||null);
  res.json({ id: r.lastInsertRowid });
});

router.put('/vocabulary/words/:id', (req, res) => {
  const fields = ['italian','spanish','category_id','word_type','gender','article','plural','example_it','example_es','cefr_level','notes','false_friend_note','register'];
  const updates = fields.filter(f => req.body[f] !== undefined);
  if (!updates.length) return res.json({ ok: true });
  const sql = `UPDATE vocabulary_items SET ${updates.map(f=>f+'=?').join(',')}, updated_at=? WHERE id=?`;
  db.prepare(sql).run(...updates.map(f => req.body[f]), now(), req.params.id);
  res.json({ ok: true });
});

router.delete('/vocabulary/words/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE vocabulary_id=?').run(req.params.id);
  db.prepare('DELETE FROM vocabulary_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Flashcards ───────────────────────────────────────────────────────────────
router.get('/flashcards/due', (req, res) => {
  const { category, limit = 20 } = req.query;
  let sql = `SELECT f.*, vi.italian, vi.spanish, vi.example_it, vi.example_es, vi.gender, vi.article, vi.plural,
               vi.collocations, vi.notes, vi.word_type, vc.name as category_name, vc.icon as category_icon
             FROM flashcards f
             LEFT JOIN vocabulary_items vi ON vi.id = f.vocabulary_id
             LEFT JOIN vocabulary_categories vc ON vc.id = f.category_id
             WHERE f.next_review <= ?`;
  const params = [now()];
  if (category) { sql += ' AND f.category_id = ?'; params.push(category); }
  sql += ` ORDER BY f.next_review ASC LIMIT ?`;
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

router.get('/flashcards/new', (req, res) => {
  const { category, limit = 15 } = req.query;
  let sql = `SELECT f.*, vi.italian, vi.spanish, vi.example_it, vi.example_es, vi.gender, vi.article,
               vi.collocations, vi.notes, vi.word_type, vc.name as category_name
             FROM flashcards f
             LEFT JOIN vocabulary_items vi ON vi.id = f.vocabulary_id
             LEFT JOIN vocabulary_categories vc ON vc.id = f.category_id
             WHERE f.repetitions = 0`;
  const params = [];
  if (category) { sql += ' AND f.category_id = ?'; params.push(category); }
  sql += ` ORDER BY RANDOM() LIMIT ?`;
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

// SM-2 review endpoint
router.post('/flashcards/:id/review', (req, res) => {
  const { quality } = req.body; // 0-5
  if (quality === undefined) return res.status(400).json({ error: 'quality required' });
  const card = db.prepare('SELECT * FROM flashcards WHERE id=?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'not found' });

  let { ef, interval, repetitions } = card;
  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ef);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  interval = Math.max(1, Math.round(interval * (0.95 + Math.random() * 0.1)));
  const nextReview = now() + interval * 86400;

  db.prepare(`UPDATE flashcards SET ef=?,interval=?,repetitions=?,next_review=?,last_review=?,
    total_reviews=total_reviews+1, correct_reviews=correct_reviews+? WHERE id=?`)
    .run(ef, interval, repetitions, nextReview, now(), quality >= 3 ? 1 : 0, req.params.id);

  // Update daily stats
  db.prepare(`INSERT INTO daily_stats(date,flashcards_reviewed,accuracy)
    VALUES(?,1,?) ON CONFLICT(date) DO UPDATE SET
    flashcards_reviewed=flashcards_reviewed+1,
    accuracy=(accuracy*flashcards_reviewed + ?)/(flashcards_reviewed+1)`)
    .run(today(), quality >= 3 ? 1 : 0, quality >= 3 ? 1 : 0);

  res.json({ ef, interval, repetitions, nextReview });
});

router.post('/flashcards', (req, res) => {
  const { front, back, direction = 'it-es', category_id } = req.body;
  if (!front || !back) return res.status(400).json({ error: 'front and back required' });
  const r = db.prepare('INSERT INTO flashcards(front,back,direction,category_id) VALUES(?,?,?,?)').run(front, back, direction, category_id||null);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/flashcards/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/flashcards/mastery', (req, res) => {
  const cards = db.prepare(`
    SELECT f.id, f.front, f.back, f.correct_reviews, f.total_reviews, f.repetitions,
      vi.italian, vi.spanish, vi.article,
      vc.name as category_name, vc.icon as category_icon
    FROM flashcards f
    LEFT JOIN vocabulary_items vi ON f.vocabulary_id = vi.id
    LEFT JOIN vocabulary_categories vc ON vi.category_id = vc.id
    ORDER BY f.correct_reviews ASC, f.total_reviews DESC
  `).all();
  res.json({
    nonLaSo: cards.filter(c => (c.correct_reviews || 0) < 3),
    inCorso: cards.filter(c => (c.correct_reviews || 0) >= 3 && (c.correct_reviews || 0) < 10),
    dominata: cards.filter(c => (c.correct_reviews || 0) >= 10),
  });
});

// ── Daily Session ────────────────────────────────────────────────────────────
router.get('/session/today', (req, res) => {
  const todayStr = today();
  let session = db.prepare('SELECT * FROM study_sessions WHERE date=? ORDER BY id DESC LIMIT 1').get(todayStr);
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => settings[r.key] = r.value);
  const dueCount = db.prepare('SELECT COUNT(*) as n FROM flashcards WHERE next_review <= ?').get(now()).n;
  const newCount = db.prepare('SELECT COUNT(*) as n FROM flashcards WHERE repetitions = 0').get().n;
  res.json({ session, dueCount, newCount, settings });
});

router.post('/session/start', (req, res) => {
  const { duration_minutes = 30 } = req.body;
  const todayStr = today();
  const r = db.prepare(`INSERT INTO study_sessions(date,duration_minutes,started_at) VALUES(?,?,?)`)
    .run(todayStr, duration_minutes, now());
  res.json({ id: r.lastInsertRowid });
});

router.post('/session/:id/complete', (req, res) => {
  const { flashcards_reviewed = 0, exercises_completed = 0, accuracy = 0 } = req.body;
  const session = db.prepare('SELECT * FROM study_sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const durationMins = (now() - session.started_at) / 60;

  db.prepare(`UPDATE study_sessions SET completed=1,ended_at=?,duration_minutes=?,flashcards_reviewed=?,exercises_completed=?,accuracy=? WHERE id=?`)
    .run(now(), durationMins, flashcards_reviewed, exercises_completed, accuracy, req.params.id);

  // Update daily stats
  db.prepare(`INSERT INTO daily_stats(date,minutes_studied,goal_met)
    VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET
    minutes_studied=minutes_studied+?,
    goal_met=CASE WHEN minutes_studied+? >= ? THEN 1 ELSE 0 END`)
    .run(today(), durationMins, durationMins >= 30 ? 1 : 0, durationMins, durationMins,
      parseInt(db.prepare('SELECT value FROM settings WHERE key=?').get('daily_minutes')?.value || 30));

  // Update streak
  updateStreak();
  res.json({ ok: true, durationMins });
});

function updateStreak() {
  const todayStr = today();
  const lastDate = db.prepare("SELECT value FROM settings WHERE key='last_study_date'").get()?.value;
  const streakVal = parseInt(db.prepare("SELECT value FROM settings WHERE key='streak'").get()?.value || 0);
  const bestStreak = parseInt(db.prepare("SELECT value FROM settings WHERE key='best_streak'").get()?.value || 0);

  let newStreak = streakVal;
  if (!lastDate) {
    newStreak = 1;
  } else {
    const diff = Math.floor((new Date(todayStr) - new Date(lastDate)) / 86400000);
    if (diff === 0) return; // already counted today
    if (diff === 1) newStreak = streakVal + 1;
    else newStreak = 1;
  }

  const update = db.prepare('INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)');
  update.run('streak', String(newStreak), now());
  update.run('last_study_date', todayStr, now());
  if (newStreak > bestStreak) update.run('best_streak', String(newStreak), now());
}

// ── Errors ───────────────────────────────────────────────────────────────────
router.get('/errors', (req, res) => {
  const { mastery, category } = req.query;
  let sql = 'SELECT * FROM errors WHERE 1=1';
  const params = [];
  if (mastery !== undefined) { sql += ' AND mastery=?'; params.push(parseInt(mastery)); }
  if (category) { sql += ' AND category=?'; params.push(category); }
  sql += ' ORDER BY importance DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/errors', (req, res) => {
  const { original_text, corrected_text, explanation, category = 'grammar', importance = 2, source } = req.body;
  if (!original_text) return res.status(400).json({ error: 'original_text required' });
  const r = db.prepare(`INSERT INTO errors(original_text,corrected_text,explanation,category,importance,source) VALUES(?,?,?,?,?,?)`)
    .run(original_text, corrected_text||null, explanation||null, category, importance, source||null);
  res.json({ id: r.lastInsertRowid });
});

router.put('/errors/:id', (req, res) => {
  const { mastery, corrected_text, explanation, category, importance } = req.body;
  const fields = [];
  const vals = [];
  if (mastery !== undefined) { fields.push('mastery=?'); vals.push(mastery); }
  if (corrected_text !== undefined) { fields.push('corrected_text=?'); vals.push(corrected_text); }
  if (explanation !== undefined) { fields.push('explanation=?'); vals.push(explanation); }
  if (category !== undefined) { fields.push('category=?'); vals.push(category); }
  if (importance !== undefined) { fields.push('importance=?'); vals.push(importance); }
  if (!fields.length) return res.json({ ok: true });
  db.prepare(`UPDATE errors SET ${fields.join(',')},updated_at=? WHERE id=?`).run(...vals, now(), req.params.id);
  res.json({ ok: true });
});

router.post('/errors/:id/review', (req, res) => {
  const { correct } = req.body;
  const error = db.prepare('SELECT * FROM errors WHERE id=?').get(req.params.id);
  if (!error) return res.status(404).json({ error: 'not found' });
  const timesCorrect = error.times_correct + (correct ? 1 : 0);
  const mastery = timesCorrect >= 3 ? 2 : (timesCorrect >= 1 ? 1 : 0);
  const nextReview = now() + (correct ? 7 * 86400 : 2 * 86400);
  db.prepare(`UPDATE errors SET times_seen=times_seen+1,times_correct=?,mastery=?,next_review=?,updated_at=? WHERE id=?`)
    .run(timesCorrect, mastery, nextReview, now(), req.params.id);
  res.json({ ok: true, mastery });
});

router.delete('/errors/:id', (req, res) => {
  db.prepare('DELETE FROM errors WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Conjugation ──────────────────────────────────────────────────────────────
// ── Conjugation helpers ──────────────────────────────────────────────────────
const PERSONS = ['io','tu','lui','noi','voi','loro'];
function t(forms) { return Object.fromEntries(PERSONS.map((p,i) => [p, forms[i]])); }
function ppA(pp) {
  return t(['ho','hai','ha','abbiamo','avete','hanno'].map(a => `${a} ${pp}`));
}
function ppE(pp) {
  const base = pp.replace(/o$/,'');
  return t([`sono ${base}o`,`sei ${base}o`,`è ${base}o`,`siamo ${base}i`,`siete ${base}i`,`sono ${base}i`]);
}
// Accept both masculine and feminine for essere-auxiliary forms
function expandForms(form) {
  const norm = s => s.normalize('NFC').toLowerCase().trim();
  const f = norm(form);
  const esserePfx = ['sono ','sei ','è ','siamo ','siete '];
  for (const pfx of esserePfx) {
    if (f.startsWith(pfx)) {
      const rest = f.slice(pfx.length);
      if (rest.endsWith('o')) return [f, pfx + rest.slice(0,-1) + 'a'];
      if (rest.endsWith('i')) return [f, pfx + rest.slice(0,-1) + 'e'];
    }
  }
  return [f];
}
function regAre(s, pp, aux='avere') {
  const fs = s+'er';
  return {
    presente:     t([s+'o',s+'i',s+'a',s+'iamo',s+'ate',s+'ano']),
    imperfetto:   t([s+'avo',s+'avi',s+'ava',s+'avamo',s+'avate',s+'avano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  t([s+'i',s+'i',s+'i',s+'iamo',s+'iate',s+'ino']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}
function regAreH(s, sh, pp, aux='avere') { // -care/-gare verbs
  const fs = sh+'er';
  return {
    presente:     t([s+'o',sh+'i',s+'a',sh+'iamo',s+'ate',s+'ano']),
    imperfetto:   t([s+'avo',s+'avi',s+'ava',s+'avamo',s+'avate',s+'avano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  t([sh+'i',sh+'i',sh+'i',sh+'iamo',sh+'iate',sh+'ino']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}
function regAreI(s, pp, aux='avere') { // -iare verbs keeping 'i' (studiare, iniziare)
  const fs = s+'er';
  return {
    presente:     t([s+'o',s,s+'a',s+'amo',s+'ate',s+'ano']),
    imperfetto:   t([s+'avo',s+'avi',s+'ava',s+'avamo',s+'avate',s+'avano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  t([s,s,s,s+'amo',s+'ate',s+'no']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}
function regAreCI(sb, pp, aux='avere') { // -ciare/-giare dropping 'i' (lasciare, viaggiare)
  const si = sb+'i', fs = sb+'er';
  return {
    presente:     t([si+'o',si,si+'a',si+'amo',si+'ate',si+'ano']),
    imperfetto:   t([si+'avo',si+'avi',si+'ava',si+'avamo',si+'avate',si+'avano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  t([si,si,si,si+'amo',si+'ate',si+'no']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}
function regEre(s, pp, aux='avere') {
  const fs = s+'er';
  return {
    presente:     t([s+'o',s+'i',s+'e',s+'iamo',s+'ete',s+'ono']),
    imperfetto:   t([s+'evo',s+'evi',s+'eva',s+'evamo',s+'evate',s+'evano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  t([s+'a',s+'a',s+'a',s+'iamo',s+'iate',s+'ano']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}
function regIre(s, pp, aux='avere', isc=false) {
  const fs = s+'ir';
  return {
    presente:     isc ? t([s+'isco',s+'isci',s+'isce',s+'iamo',s+'ite',s+'iscono'])
                      : t([s+'o',s+'i',s+'e',s+'iamo',s+'ite',s+'ono']),
    imperfetto:   t([s+'ivo',s+'ivi',s+'iva',s+'ivamo',s+'ivate',s+'ivano']),
    futuro:       t([fs+'ò',fs+'ai',fs+'à',fs+'emo',fs+'ete',fs+'anno']),
    condizionale: t([fs+'ei',fs+'esti',fs+'ebbe',fs+'emmo',fs+'este',fs+'ebbero']),
    congiuntivo:  isc ? t([s+'isca',s+'isca',s+'isca',s+'iamo',s+'iate',s+'iscano'])
                      : t([s+'a',s+'a',s+'a',s+'iamo',s+'iate',s+'ano']),
    passato_prossimo: aux==='essere' ? ppE(pp) : ppA(pp),
  };
}

const VERBS = {
  essere: {
    presente: { io:'sono', tu:'sei', lui:'è', noi:'siamo', voi:'siete', loro:'sono' },
    imperfetto: { io:'ero', tu:'eri', lui:'era', noi:'eravamo', voi:'eravate', loro:'erano' },
    futuro: { io:'sarò', tu:'sarai', lui:'sarà', noi:'saremo', voi:'sarete', loro:'saranno' },
    condizionale: { io:'sarei', tu:'saresti', lui:'sarebbe', noi:'saremmo', voi:'sareste', loro:'sarebbero' },
    congiuntivo: { io:'sia', tu:'sia', lui:'sia', noi:'siamo', voi:'siate', loro:'siano' },
    passato_prossimo: { io:'sono stato', tu:'sei stato', lui:'è stato', noi:'siamo stati', voi:'siete stati', loro:'sono stati' },
  },
  avere: {
    presente: { io:'ho', tu:'hai', lui:'ha', noi:'abbiamo', voi:'avete', loro:'hanno' },
    imperfetto: { io:'avevo', tu:'avevi', lui:'aveva', noi:'avevamo', voi:'avevate', loro:'avevano' },
    futuro: { io:'avrò', tu:'avrai', lui:'avrà', noi:'avremo', voi:'avrete', loro:'avranno' },
    condizionale: { io:'avrei', tu:'avresti', lui:'avrebbe', noi:'avremmo', voi:'avreste', loro:'avrebbero' },
    congiuntivo: { io:'abbia', tu:'abbia', lui:'abbia', noi:'abbiamo', voi:'abbiate', loro:'abbiano' },
    passato_prossimo: { io:'ho avuto', tu:'hai avuto', lui:'ha avuto', noi:'abbiamo avuto', voi:'avete avuto', loro:'hanno avuto' },
  },
  fare: {
    presente: { io:'faccio', tu:'fai', lui:'fa', noi:'facciamo', voi:'fate', loro:'fanno' },
    imperfetto: { io:'facevo', tu:'facevi', lui:'faceva', noi:'facevamo', voi:'facevate', loro:'facevano' },
    futuro: { io:'farò', tu:'farai', lui:'farà', noi:'faremo', voi:'farete', loro:'faranno' },
    condizionale: { io:'farei', tu:'faresti', lui:'farebbe', noi:'faremmo', voi:'fareste', loro:'farebbero' },
    congiuntivo: { io:'faccia', tu:'faccia', lui:'faccia', noi:'facciamo', voi:'facciate', loro:'facciano' },
    passato_prossimo: { io:'ho fatto', tu:'hai fatto', lui:'ha fatto', noi:'abbiamo fatto', voi:'avete fatto', loro:'hanno fatto' },
  },
  andare: {
    presente: { io:'vado', tu:'vai', lui:'va', noi:'andiamo', voi:'andate', loro:'vanno' },
    imperfetto: { io:'andavo', tu:'andavi', lui:'andava', noi:'andavamo', voi:'andavate', loro:'andavano' },
    futuro: { io:'andrò', tu:'andrai', lui:'andrà', noi:'andremo', voi:'andrete', loro:'andranno' },
    condizionale: { io:'andrei', tu:'andresti', lui:'andrebbe', noi:'andremmo', voi:'andreste', loro:'andrebbero' },
    congiuntivo: { io:'vada', tu:'vada', lui:'vada', noi:'andiamo', voi:'andiate', loro:'vadano' },
    passato_prossimo: { io:'sono andato', tu:'sei andato', lui:'è andato', noi:'siamo andati', voi:'siete andati', loro:'sono andati' },
  },
  venire: {
    presente: { io:'vengo', tu:'vieni', lui:'viene', noi:'veniamo', voi:'venite', loro:'vengono' },
    imperfetto: { io:'venivo', tu:'venivi', lui:'veniva', noi:'venivamo', voi:'venivate', loro:'venivano' },
    futuro: { io:'verrò', tu:'verrai', lui:'verrà', noi:'verremo', voi:'verrete', loro:'verranno' },
    condizionale: { io:'verrei', tu:'verresti', lui:'verrebbe', noi:'verremmo', voi:'verreste', loro:'verrebbero' },
    congiuntivo: { io:'venga', tu:'venga', lui:'venga', noi:'veniamo', voi:'veniate', loro:'vengano' },
    passato_prossimo: { io:'sono venuto', tu:'sei venuto', lui:'è venuto', noi:'siamo venuti', voi:'siete venuti', loro:'sono venuti' },
  },
  potere: {
    presente: { io:'posso', tu:'puoi', lui:'può', noi:'possiamo', voi:'potete', loro:'possono' },
    imperfetto: { io:'potevo', tu:'potevi', lui:'poteva', noi:'potevamo', voi:'potevate', loro:'potevano' },
    futuro: { io:'potrò', tu:'potrai', lui:'potrà', noi:'potremo', voi:'potrete', loro:'potranno' },
    condizionale: { io:'potrei', tu:'potresti', lui:'potrebbe', noi:'potremmo', voi:'potreste', loro:'potrebbero' },
    congiuntivo: { io:'possa', tu:'possa', lui:'possa', noi:'possiamo', voi:'possiate', loro:'possano' },
    passato_prossimo: { io:'ho potuto', tu:'hai potuto', lui:'ha potuto', noi:'abbiamo potuto', voi:'avete potuto', loro:'hanno potuto' },
  },
  volere: {
    presente: { io:'voglio', tu:'vuoi', lui:'vuole', noi:'vogliamo', voi:'volete', loro:'vogliono' },
    imperfetto: { io:'volevo', tu:'volevi', lui:'voleva', noi:'volevamo', voi:'volevate', loro:'volevano' },
    futuro: { io:'vorrò', tu:'vorrai', lui:'vorrà', noi:'vorremo', voi:'vorrete', loro:'vorranno' },
    condizionale: { io:'vorrei', tu:'vorresti', lui:'vorrebbe', noi:'vorremmo', voi:'vorreste', loro:'vorrebbero' },
    congiuntivo: { io:'voglia', tu:'voglia', lui:'voglia', noi:'vogliamo', voi:'vogliate', loro:'vogliano' },
    passato_prossimo: { io:'ho voluto', tu:'hai voluto', lui:'ha voluto', noi:'abbiamo voluto', voi:'avete voluto', loro:'hanno voluto' },
  },
  sapere: {
    presente: { io:'so', tu:'sai', lui:'sa', noi:'sappiamo', voi:'sapete', loro:'sanno' },
    imperfetto: { io:'sapevo', tu:'sapevi', lui:'sapeva', noi:'sapevamo', voi:'sapevate', loro:'sapevano' },
    futuro: { io:'saprò', tu:'saprai', lui:'saprà', noi:'sapremo', voi:'saprete', loro:'sapranno' },
    condizionale: { io:'saprei', tu:'sapresti', lui:'saprebbe', noi:'sapremmo', voi:'sapreste', loro:'saprebbero' },
    congiuntivo: { io:'sappia', tu:'sappia', lui:'sappia', noi:'sappiamo', voi:'sappiate', loro:'sappiano' },
    passato_prossimo: { io:'ho saputo', tu:'hai saputo', lui:'ha saputo', noi:'abbiamo saputo', voi:'avete saputo', loro:'hanno saputo' },
  },
  parlare: {
    presente: { io:'parlo', tu:'parli', lui:'parla', noi:'parliamo', voi:'parlate', loro:'parlano' },
    imperfetto: { io:'parlavo', tu:'parlavi', lui:'parlava', noi:'parlavamo', voi:'parlavate', loro:'parlavano' },
    futuro: { io:'parlerò', tu:'parlerai', lui:'parlerà', noi:'parleremo', voi:'parlerete', loro:'parleranno' },
    condizionale: { io:'parlerei', tu:'parleresti', lui:'parlerebbe', noi:'parleremmo', voi:'parlereste', loro:'parlerebbero' },
    congiuntivo: { io:'parli', tu:'parli', lui:'parli', noi:'parliamo', voi:'parliate', loro:'parlino' },
    passato_prossimo: { io:'ho parlato', tu:'hai parlato', lui:'ha parlato', noi:'abbiamo parlato', voi:'avete parlato', loro:'hanno parlato' },
  },
  capire: {
    presente: { io:'capisco', tu:'capisci', lui:'capisce', noi:'capiamo', voi:'capite', loro:'capiscono' },
    imperfetto: { io:'capivo', tu:'capivi', lui:'capiva', noi:'capivamo', voi:'capivate', loro:'capivano' },
    futuro: { io:'capirò', tu:'capirai', lui:'capirà', noi:'capiremo', voi:'capirete', loro:'capiranno' },
    condizionale: { io:'capirei', tu:'capiresti', lui:'capirebbe', noi:'capiremmo', voi:'capireste', loro:'capirebbero' },
    congiuntivo: { io:'capisca', tu:'capisca', lui:'capisca', noi:'capiamo', voi:'capiate', loro:'capiscano' },
    passato_prossimo: { io:'ho capito', tu:'hai capito', lui:'ha capito', noi:'abbiamo capito', voi:'avete capito', loro:'hanno capito' },
  },
  dire: {
    presente: { io:'dico', tu:'dici', lui:'dice', noi:'diciamo', voi:'dite', loro:'dicono' },
    imperfetto: { io:'dicevo', tu:'dicevi', lui:'diceva', noi:'dicevamo', voi:'dicevate', loro:'dicevano' },
    futuro: { io:'dirò', tu:'dirai', lui:'dirà', noi:'diremo', voi:'direte', loro:'diranno' },
    condizionale: { io:'direi', tu:'diresti', lui:'direbbe', noi:'diremmo', voi:'direste', loro:'direbbero' },
    congiuntivo: { io:'dica', tu:'dica', lui:'dica', noi:'diciamo', voi:'diciate', loro:'dicano' },
    passato_prossimo: { io:'ho detto', tu:'hai detto', lui:'ha detto', noi:'abbiamo detto', voi:'avete detto', loro:'hanno detto' },
  },
  stare: {
    presente: { io:'sto', tu:'stai', lui:'sta', noi:'stiamo', voi:'state', loro:'stanno' },
    imperfetto: { io:'stavo', tu:'stavi', lui:'stava', noi:'stavamo', voi:'stavate', loro:'stavano' },
    futuro: { io:'starò', tu:'starai', lui:'starà', noi:'staremo', voi:'starete', loro:'staranno' },
    condizionale: { io:'starei', tu:'staresti', lui:'starebbe', noi:'staremmo', voi:'stareste', loro:'starebbero' },
    congiuntivo: { io:'stia', tu:'stia', lui:'stia', noi:'stiamo', voi:'stiate', loro:'stiano' },
    passato_prossimo: { io:'sono stato', tu:'sei stato', lui:'è stato', noi:'siamo stati', voi:'siete stati', loro:'sono stati' },
  },
  uscire: {
    presente: { io:'esco', tu:'esci', lui:'esce', noi:'usciamo', voi:'uscite', loro:'escono' },
    imperfetto: { io:'uscivo', tu:'uscivi', lui:'usciva', noi:'uscivamo', voi:'uscivate', loro:'uscivano' },
    futuro: { io:'uscirò', tu:'uscirai', lui:'uscirà', noi:'usciremo', voi:'uscirete', loro:'usciranno' },
    condizionale: { io:'uscirei', tu:'usciresti', lui:'uscirebbe', noi:'usciremmo', voi:'uscireste', loro:'uscirebbero' },
    congiuntivo: { io:'esca', tu:'esca', lui:'esca', noi:'usciamo', voi:'usciate', loro:'escano' },
    passato_prossimo: { io:'sono uscito', tu:'sei uscito', lui:'è uscito', noi:'siamo usciti', voi:'siete usciti', loro:'sono usciti' },
  },
  leggere: {
    presente: { io:'leggo', tu:'leggi', lui:'legge', noi:'leggiamo', voi:'leggete', loro:'leggono' },
    imperfetto: { io:'leggevo', tu:'leggevi', lui:'leggeva', noi:'leggevamo', voi:'leggevate', loro:'leggevano' },
    futuro: { io:'leggerò', tu:'leggerai', lui:'leggerà', noi:'leggeremo', voi:'leggerete', loro:'leggeranno' },
    condizionale: { io:'leggerei', tu:'leggeresti', lui:'leggerebbe', noi:'leggeremmo', voi:'leggereste', loro:'leggerebbero' },
    congiuntivo: { io:'legga', tu:'legga', lui:'legga', noi:'leggiamo', voi:'leggiate', loro:'leggano' },
    passato_prossimo: { io:'ho letto', tu:'hai letto', lui:'ha letto', noi:'abbiamo letto', voi:'avete letto', loro:'hanno letto' },
  },
  scrivere: {
    presente: { io:'scrivo', tu:'scrivi', lui:'scrive', noi:'scriviamo', voi:'scrivete', loro:'scrivono' },
    imperfetto: { io:'scrivevo', tu:'scrivevi', lui:'scriveva', noi:'scrivevamo', voi:'scrivevate', loro:'scrivevano' },
    futuro: { io:'scriverò', tu:'scriverai', lui:'scriverà', noi:'scriveremo', voi:'scriverete', loro:'scriveranno' },
    condizionale: { io:'scriverei', tu:'scriveresti', lui:'scriverebbe', noi:'scriveremmo', voi:'scrivereste', loro:'scriverebbero' },
    congiuntivo: { io:'scriva', tu:'scriva', lui:'scriva', noi:'scriviamo', voi:'scriviate', loro:'scrivano' },
    passato_prossimo: { io:'ho scritto', tu:'hai scritto', lui:'ha scritto', noi:'abbiamo scritto', voi:'avete scritto', loro:'hanno scritto' },
  },
  mangiare: {
    presente: { io:'mangio', tu:'mangi', lui:'mangia', noi:'mangiamo', voi:'mangiate', loro:'mangiano' },
    imperfetto: { io:'mangiavo', tu:'mangiavi', lui:'mangiava', noi:'mangiavamo', voi:'mangiavate', loro:'mangiavano' },
    futuro: { io:'mangerò', tu:'mangerai', lui:'mangerà', noi:'mangeremo', voi:'mangerete', loro:'mangeranno' },
    condizionale: { io:'mangerei', tu:'mangeresti', lui:'mangerebbe', noi:'mangeremmo', voi:'mangereste', loro:'mangerebbero' },
    congiuntivo: { io:'mangi', tu:'mangi', lui:'mangi', noi:'mangiamo', voi:'mangiate', loro:'mangino' },
    passato_prossimo: { io:'ho mangiato', tu:'hai mangiato', lui:'ha mangiato', noi:'abbiamo mangiato', voi:'avete mangiato', loro:'hanno mangiato' },
  },
  bere: {
    presente: { io:'bevo', tu:'bevi', lui:'beve', noi:'beviamo', voi:'bevete', loro:'bevono' },
    imperfetto: { io:'bevevo', tu:'bevevi', lui:'beveva', noi:'bevevamo', voi:'bevevate', loro:'bevevano' },
    futuro: { io:'berrò', tu:'berrai', lui:'berrà', noi:'berremo', voi:'berrete', loro:'berranno' },
    condizionale: { io:'berrei', tu:'berresti', lui:'berrebbe', noi:'berremmo', voi:'berreste', loro:'berrebbero' },
    congiuntivo: { io:'beva', tu:'beva', lui:'beva', noi:'beviamo', voi:'beviate', loro:'bevano' },
    passato_prossimo: { io:'ho bevuto', tu:'hai bevuto', lui:'ha bevuto', noi:'abbiamo bevuto', voi:'avete bevuto', loro:'hanno bevuto' },
  },
  dormire: {
    presente: { io:'dormo', tu:'dormi', lui:'dorme', noi:'dormiamo', voi:'dormite', loro:'dormono' },
    imperfetto: { io:'dormivo', tu:'dormivi', lui:'dormiva', noi:'dormivamo', voi:'dormivate', loro:'dormivano' },
    futuro: { io:'dormirò', tu:'dormirai', lui:'dormirà', noi:'dormiremo', voi:'dormirete', loro:'dormiranno' },
    condizionale: { io:'dormirei', tu:'dormiresti', lui:'dormirebbe', noi:'dormiremmo', voi:'dormireste', loro:'dormirebbero' },
    congiuntivo: { io:'dorma', tu:'dorma', lui:'dorma', noi:'dormiamo', voi:'dormiate', loro:'dormano' },
    passato_prossimo: { io:'ho dormito', tu:'hai dormito', lui:'ha dormito', noi:'abbiamo dormito', voi:'avete dormito', loro:'hanno dormito' },
  },
  prendere: {
    presente: { io:'prendo', tu:'prendi', lui:'prende', noi:'prendiamo', voi:'prendete', loro:'prendono' },
    imperfetto: { io:'prendevo', tu:'prendevi', lui:'prendeva', noi:'prendevamo', voi:'prendevate', loro:'prendevano' },
    futuro: { io:'prenderò', tu:'prenderai', lui:'prenderà', noi:'prenderemo', voi:'prenderete', loro:'prenderanno' },
    condizionale: { io:'prenderei', tu:'prenderesti', lui:'prenderebbe', noi:'prenderemmo', voi:'prendereste', loro:'prenderebbero' },
    congiuntivo: { io:'prenda', tu:'prenda', lui:'prenda', noi:'prendiamo', voi:'prendiate', loro:'prendano' },
    passato_prossimo: { io:'ho preso', tu:'hai preso', lui:'ha preso', noi:'abbiamo preso', voi:'avete preso', loro:'hanno preso' },
  },
  // ── Modal verbs ──────────────────────────────────────────────────────────────
  dovere: {
    presente:     t(['devo','devi','deve','dobbiamo','dovete','devono']),
    imperfetto:   t(['dovevo','dovevi','doveva','dovevamo','dovevate','dovevano']),
    futuro:       t(['dovrò','dovrai','dovrà','dovremo','dovrete','dovranno']),
    condizionale: t(['dovrei','dovresti','dovrebbe','dovremmo','dovreste','dovrebbero']),
    congiuntivo:  t(['debba','debba','debba','dobbiamo','dobbiate','debbano']),
    passato_prossimo: ppA('dovuto'),
  },
  // ── Important irregulars ─────────────────────────────────────────────────────
  dare: {
    presente:     t(['do','dai','dà','diamo','date','danno']),
    imperfetto:   t(['davo','davi','dava','davamo','davate','davano']),
    futuro:       t(['darò','darai','darà','daremo','darete','daranno']),
    condizionale: t(['darei','daresti','darebbe','daremmo','dareste','darebbero']),
    congiuntivo:  t(['dia','dia','dia','diamo','diate','diano']),
    passato_prossimo: ppA('dato'),
  },
  tenere: {
    presente:     t(['tengo','tieni','tiene','teniamo','tenete','tengono']),
    imperfetto:   t(['tenevo','tenevi','teneva','tenevamo','tenevate','tenevano']),
    futuro:       t(['terrò','terrai','terrà','terremo','terrete','terranno']),
    condizionale: t(['terrei','terresti','terrebbe','terremmo','terreste','terrebbero']),
    congiuntivo:  t(['tenga','tenga','tenga','teniamo','teniate','tengano']),
    passato_prossimo: ppA('tenuto'),
  },
  vedere: {
    presente:     t(['vedo','vedi','vede','vediamo','vedete','vedono']),
    imperfetto:   t(['vedevo','vedevi','vedeva','vedevamo','vedevate','vedevano']),
    futuro:       t(['vedrò','vedrai','vedrà','vedremo','vedrete','vedranno']),
    condizionale: t(['vedrei','vedresti','vedrebbe','vedremmo','vedreste','vedrebbero']),
    congiuntivo:  t(['veda','veda','veda','vediamo','vediate','vedano']),
    passato_prossimo: ppA('visto'),
  },
  vivere: {
    presente:     t(['vivo','vivi','vive','viviamo','vivete','vivono']),
    imperfetto:   t(['vivevo','vivevi','viveva','vivevamo','vivevate','vivevano']),
    futuro:       t(['vivrò','vivrai','vivrà','vivremo','vivrete','vivranno']),
    condizionale: t(['vivrei','vivresti','vivrebbe','vivremmo','vivreste','vivrebbero']),
    congiuntivo:  t(['viva','viva','viva','viviamo','viviate','vivano']),
    passato_prossimo: ppA('vissuto'),
  },
  scegliere: {
    presente:     t(['scelgo','scegli','sceglie','scegliamo','scegliete','scelgono']),
    imperfetto:   t(['sceglievo','sceglievi','sceglieva','sceglievamo','sceglievate','sceglievano']),
    futuro:       t(['sceglierò','sceglierai','sceglierà','sceglieremo','sceglierete','sceglieranno']),
    condizionale: t(['sceglierei','sceglieresti','sceglierebbe','sceglieremmo','scegliereste','sceglierebbero']),
    congiuntivo:  t(['scelga','scelga','scelga','scegliamo','scegliate','scelgano']),
    passato_prossimo: ppA('scelto'),
  },
  mettere: {
    presente:     t(['metto','metti','mette','mettiamo','mettete','mettono']),
    imperfetto:   t(['mettevo','mettevi','metteva','mettevamo','mettevate','mettevano']),
    futuro:       t(['metterò','metterai','metterà','metteremo','metterete','metteranno']),
    condizionale: t(['metterei','metteresti','metterebbe','metteremmo','mettereste','metterebbero']),
    congiuntivo:  t(['metta','metta','metta','mettiamo','mettiate','mettano']),
    passato_prossimo: ppA('messo'),
  },
  chiedere: {
    presente:     t(['chiedo','chiedi','chiede','chiediamo','chiedete','chiedono']),
    imperfetto:   t(['chiedevo','chiedevi','chiedeva','chiedevamo','chiedevate','chiedevano']),
    futuro:       t(['chiederò','chiederai','chiederà','chiederemo','chiederete','chiederanno']),
    condizionale: t(['chiederei','chiederesti','chiederebbe','chiederemmo','chiedereste','chiederebbero']),
    congiuntivo:  t(['chieda','chieda','chieda','chiediamo','chiediate','chiedano']),
    passato_prossimo: ppA('chiesto'),
  },
  rispondere: {
    presente:     t(['rispondo','rispondi','risponde','rispondiamo','rispondete','rispondono']),
    imperfetto:   t(['rispondevo','rispondevi','rispondeva','rispondevamo','rispondevate','rispondevano']),
    futuro:       t(['risponderò','risponderai','risponderà','risponderemo','risponderete','risponderanno']),
    condizionale: t(['risponderei','risponderesti','risponderebbe','risponderemmo','rispondereste','risponderebbero']),
    congiuntivo:  t(['risponda','risponda','risponda','rispondiamo','rispondiate','rispondano']),
    passato_prossimo: ppA('risposto'),
  },
  decidere: {
    presente:     t(['decido','decidi','decide','decidiamo','decidete','decidono']),
    imperfetto:   t(['decidevo','decidevi','decideva','decidevamo','decidevate','decidevano']),
    futuro:       t(['deciderò','deciderai','deciderà','decideremo','deciderete','decideranno']),
    condizionale: t(['deciderei','decideresti','deciderebbe','decideremmo','decidereste','deciderebbero']),
    congiuntivo:  t(['decida','decida','decida','decidiamo','decidiate','decidano']),
    passato_prossimo: ppA('deciso'),
  },
  conoscere: {
    presente:     t(['conosco','conosci','conosce','conosciamo','conoscete','conoscono']),
    imperfetto:   t(['conoscevo','conoscevi','conosceva','conoscevamo','conoscevate','conoscevano']),
    futuro:       t(['conoscerò','conoscerai','conoscerà','conosceremo','conoscerete','conosceranno']),
    condizionale: t(['conoscerei','conosceresti','conoscerebbe','conosceremmo','conoscereste','conoscerebbero']),
    congiuntivo:  t(['conosca','conosca','conosca','conosciamo','conosciate','conoscano']),
    passato_prossimo: ppA('conosciuto'),
  },
  correre: {
    presente:     t(['corro','corri','corre','corriamo','correte','corrono']),
    imperfetto:   t(['correvo','correvi','correva','correvamo','correvate','correvano']),
    futuro:       t(['correrò','correrai','correrà','correremo','correrete','correranno']),
    condizionale: t(['correrei','correresti','correrebbe','correremmo','correreste','correrebbero']),
    congiuntivo:  t(['corra','corra','corra','corriamo','corriate','corrano']),
    passato_prossimo: ppA('corso'),
  },
  perdere: {
    presente:     t(['perdo','perdi','perde','perdiamo','perdete','perdono']),
    imperfetto:   t(['perdevo','perdevi','perdeva','perdevamo','perdevate','perdevano']),
    futuro:       t(['perderò','perderai','perderà','perderemo','perderete','perderanno']),
    condizionale: t(['perderei','perderesti','perderebbe','perderemmo','perdereste','perderebbero']),
    congiuntivo:  t(['perda','perda','perda','perdiamo','perdiate','perdano']),
    passato_prossimo: ppA('perso'),
  },
  spendere: {
    presente:     t(['spendo','spendi','spende','spendiamo','spendete','spendono']),
    imperfetto:   t(['spendevo','spendevi','spendeva','spendevamo','spendevate','spendevano']),
    futuro:       t(['spenderò','spenderai','spenderà','spenderemo','spenderete','spenderanno']),
    condizionale: t(['spenderei','spenderesti','spenderebbe','spenderemmo','spendereste','spenderebbero']),
    congiuntivo:  t(['spenda','spenda','spenda','spendiamo','spendiate','spendano']),
    passato_prossimo: ppA('speso'),
  },
  vincere: {
    presente:     t(['vinco','vinci','vince','vinciamo','vincete','vincono']),
    imperfetto:   t(['vincevo','vincevi','vinceva','vincevamo','vincevate','vincevano']),
    futuro:       t(['vincerò','vincerai','vincerà','vinceremo','vincerete','vinceranno']),
    condizionale: t(['vincerei','vinceresti','vincerebbe','vinceremmo','vincereste','vincerebbero']),
    congiuntivo:  t(['vinca','vinca','vinca','vinciamo','vinciate','vincano']),
    passato_prossimo: ppA('vinto'),
  },
  rimanere: {
    presente:     t(['rimango','rimani','rimane','rimaniamo','rimanete','rimangono']),
    imperfetto:   t(['rimanevo','rimanevi','rimaneva','rimanevamo','rimanevate','rimanevano']),
    futuro:       t(['rimarrò','rimarrai','rimarrà','rimarremo','rimarrete','rimarranno']),
    condizionale: t(['rimarrei','rimarresti','rimarrebbe','rimarremmo','rimarreste','rimarrebbero']),
    congiuntivo:  t(['rimanga','rimanga','rimanga','rimaniamo','rimaniate','rimangano']),
    passato_prossimo: ppE('rimasto'),
  },
  salire: {
    presente:     t(['salgo','sali','sale','saliamo','salite','salgono']),
    imperfetto:   t(['salivo','salivi','saliva','salivamo','salivate','salivano']),
    futuro:       t(['salirò','salirai','salirà','saliremo','salirete','saliranno']),
    condizionale: t(['salirei','saliresti','salirebbe','saliremmo','salireste','salirebbero']),
    congiuntivo:  t(['salga','salga','salga','saliamo','saliate','salgano']),
    passato_prossimo: ppE('salito'),
  },
  piacere: {
    presente:     t(['piaccio','piaci','piace','piacciamo','piacete','piacciono']),
    imperfetto:   t(['piacevo','piacevi','piaceva','piacevamo','piacevate','piacevano']),
    futuro:       t(['piacerò','piacerai','piacerà','piaceremo','piacerete','piaceranno']),
    condizionale: t(['piacerei','piaceresti','piacerebbe','piaceremmo','piacereste','piacerebbero']),
    congiuntivo:  t(['piaccia','piaccia','piaccia','piacciamo','piacciate','piacciano']),
    passato_prossimo: ppE('piaciuto'),
  },
  ridere: {
    presente:     t(['rido','ridi','ride','ridiamo','ridete','ridono']),
    imperfetto:   t(['ridevo','ridevi','rideva','ridevamo','ridevate','ridevano']),
    futuro:       t(['riderò','riderai','riderà','rideremo','riderete','rideranno']),
    condizionale: t(['riderei','rideresti','riderebbe','rideremmo','ridereste','riderebbero']),
    congiuntivo:  t(['rida','rida','rida','ridiamo','ridiate','ridano']),
    passato_prossimo: ppA('riso'),
  },
  piangere: {
    presente:     t(['piango','piangi','piange','piangiamo','piangete','piangono']),
    imperfetto:   t(['piangevo','piangevi','piangeva','piangevamo','piangevate','piangevano']),
    futuro:       t(['piangerò','piangerai','piangerà','piangeremo','piangerete','piangeranno']),
    condizionale: t(['piangerei','piangeresti','piangerebbe','piangeremmo','piangereste','piangerebbero']),
    congiuntivo:  t(['pianga','pianga','pianga','piangiamo','piangiate','piangano']),
    passato_prossimo: ppA('pianto'),
  },
  togliere: {
    presente:     t(['tolgo','togli','toglie','togliamo','togliete','tolgono']),
    imperfetto:   t(['toglievo','toglievi','toglieva','toglievamo','toglievate','toglievano']),
    futuro:       t(['toglierò','toglierai','toglierà','toglieremo','toglierete','toglieranno']),
    condizionale: t(['toglierei','toglieresti','toglierebbe','toglieremmo','togliereste','toglierebbero']),
    congiuntivo:  t(['tolga','tolga','tolga','togliamo','togliate','tolgano']),
    passato_prossimo: ppA('tolto'),
  },
  offrire: {
    presente:     t(['offro','offri','offre','offriamo','offrite','offrono']),
    imperfetto:   t(['offrivo','offrivi','offriva','offrivamo','offrivate','offrivano']),
    futuro:       t(['offrirò','offrirai','offrirà','offriremo','offrirete','offriranno']),
    condizionale: t(['offrirei','offriresti','offrirebbe','offriremmo','offrireste','offrirebbero']),
    congiuntivo:  t(['offra','offra','offra','offriamo','offriate','offrano']),
    passato_prossimo: ppA('offerto'),
  },
  aprire: {
    presente:     t(['apro','apri','apre','apriamo','aprite','aprono']),
    imperfetto:   t(['aprivo','aprivi','apriva','aprivamo','aprivate','aprivano']),
    futuro:       t(['aprirò','aprirai','aprirà','apriremo','aprirete','apriranno']),
    condizionale: t(['aprirei','apriresti','aprirebbe','apriremmo','aprireste','aprirebbero']),
    congiuntivo:  t(['apra','apra','apra','apriamo','apriate','aprano']),
    passato_prossimo: ppA('aperto'),
  },
  sedere: {
    presente:     t(['siedo','siedi','siede','sediamo','sedete','siedono']),
    imperfetto:   t(['sedevo','sedevi','sedeva','sedevamo','sedevate','sedevano']),
    futuro:       t(['sederò','sederai','sederà','sederemo','sederete','sederanno']),
    condizionale: t(['sederei','sederesti','sederebbe','sederemmo','sedereste','sederebbero']),
    congiuntivo:  t(['sieda','sieda','sieda','sediamo','sediate','siedano']),
    passato_prossimo: ppE('seduto'),
  },
  morire: {
    presente:     t(['muoio','muori','muore','moriamo','morite','muoiono']),
    imperfetto:   t(['morivo','morivi','moriva','morivamo','morivate','morivano']),
    futuro:       t(['morirò','morirai','morirà','moriremo','morirete','moriranno']),
    condizionale: t(['morirei','moriresti','morirebbe','moriremmo','morireste','morirebbero']),
    congiuntivo:  t(['muoia','muoia','muoia','moriamo','moriate','muoiano']),
    passato_prossimo: ppE('morto'),
  },
  nascere: {
    presente:     t(['nasco','nasci','nasce','nasciamo','nascete','nascono']),
    imperfetto:   t(['nascevo','nascevi','nasceva','nascevamo','nascevate','nascevano']),
    futuro:       t(['nascerò','nascerai','nascerà','nasceremo','nascerete','nasceranno']),
    condizionale: t(['nascerei','nasceresti','nascerebbe','nasceremmo','nascereste','nascerebbero']),
    congiuntivo:  t(['nasca','nasca','nasca','nasciamo','nasciate','nascano']),
    passato_prossimo: ppE('nato'),
  },
  crescere: {
    presente:     t(['cresco','cresci','cresce','cresciamo','crescete','crescono']),
    imperfetto:   t(['crescevo','crescevi','cresceva','crescevamo','crescevate','crescevano']),
    futuro:       t(['crescerò','crescerai','crescerà','cresceremo','crescerete','cresceranno']),
    condizionale: t(['crescerei','cresceresti','crescerebbe','cresceremmo','crescereste','crescerebbero']),
    congiuntivo:  t(['cresca','cresca','cresca','cresciamo','cresciate','crescano']),
    passato_prossimo: ppE('cresciuto'),
  },
  sorridere: {
    presente:     t(['sorrido','sorridi','sorride','sorridiamo','sorridete','sorridono']),
    imperfetto:   t(['sorridevo','sorridevi','sorrideva','sorridevamo','sorridevate','sorridevano']),
    futuro:       t(['sorriderò','sorriderai','sorriderà','sorrideremo','sorriderete','sorrideranno']),
    condizionale: t(['sorriderei','sorrideresti','sorriderebbe','sorrideremmo','sorridereste','sorriderebbero']),
    congiuntivo:  t(['sorrida','sorrida','sorrida','sorridiamo','sorridiate','sorridano']),
    passato_prossimo: ppA('sorriso'),
  },
  risolvere: {
    presente:     t(['risolvo','risolvi','risolve','risolviamo','risolvete','risolvono']),
    imperfetto:   t(['risolvevo','risolvevi','risolveva','risolvevamo','risolvevate','risolvevano']),
    futuro:       t(['risolverò','risolverai','risolverà','risolveremo','risolverete','risolveranno']),
    condizionale: t(['risolverei','risolveresti','risolverebbe','risolveremmo','risolvereste','risolverebbero']),
    congiuntivo:  t(['risolva','risolva','risolva','risolviamo','risolviate','risolvano']),
    passato_prossimo: ppA('risolto'),
  },
  accendere: {
    presente:     t(['accendo','accendi','accende','accendiamo','accendete','accendono']),
    imperfetto:   t(['accendevo','accendevi','accendeva','accendevamo','accendevate','accendevano']),
    futuro:       t(['accenderò','accenderai','accenderà','accenderemo','accenderete','accenderanno']),
    condizionale: t(['accenderei','accenderesti','accenderebbe','accenderemmo','accendereste','accenderebbero']),
    congiuntivo:  t(['accenda','accenda','accenda','accendiamo','accendiate','accendano']),
    passato_prossimo: ppA('acceso'),
  },
  cominciare: {
    presente:     t(['comincio','cominci','comincia','cominciamo','cominciate','cominciano']),
    imperfetto:   t(['cominciavo','cominciavi','cominciava','cominciavamo','cominciavate','cominciavano']),
    futuro:       t(['comincerò','comincerai','comincerà','cominceremo','comincerete','cominceranno']),
    condizionale: t(['comincerei','cominceresti','comincerebbe','cominceremmo','comincereste','comincerebbero']),
    congiuntivo:  t(['cominci','cominci','cominci','cominciamo','cominciate','comincino']),
    passato_prossimo: ppA('cominciato'),
  },
  // ── Regular -ARE (avere) ─────────────────────────────────────────────────────
  aspettare:   regAre('aspett','aspettato'),
  aiutare:     regAre('aiut','aiutato'),
  chiamare:    regAre('chiam','chiamato'),
  comprare:    regAre('compr','comprato'),
  cucinare:    regAre('cucin','cucinato'),
  guardare:    regAre('guard','guardato'),
  imparare:    regAre('impar','imparato'),
  incontrare:  regAre('incontr','incontrato'),
  lavorare:    regAre('lavor','lavorato'),
  passare:     regAre('pass','passato'),
  pensare:     regAre('pens','pensato'),
  portare:     regAre('port','portato'),
  provare:     regAre('prov','provato'),
  ricordare:   regAre('ricord','ricordato'),
  salutare:    regAre('salut','salutato'),
  trovare:     regAre('trov','trovato'),
  usare:       regAre('us','usato'),
  camminare:   regAre('cammin','camminato'),
  cantare:     regAre('cant','cantato'),
  continuare:  regAre('continu','continuato'),
  fermare:     regAre('ferm','fermato'),
  interessare: regAre('interess','interessato'),
  lavare:      regAre('lav','lavato'),
  nuotare:     regAre('nuot','nuotato'),
  preparare:   regAre('prepar','preparato'),
  suonare:     regAre('suon','suonato'),
  // ── Regular -ARE (essere) ────────────────────────────────────────────────────
  diventare:   regAre('divent','diventato','essere'),
  entrare:     regAre('entr','entrato','essere'),
  tornare:     regAre('torn','tornato','essere'),
  restare:     regAre('rest','restato','essere'),
  sembrare:    regAre('sembr','sembrato','essere'),
  arrivare:    regAre('arriv','arrivato','essere'),
  // ── -care/-gare verbs ────────────────────────────────────────────────────────
  giocare:     regAreH('gioc','gioch','giocato'),
  cercare:     regAreH('cerc','cerch','cercato'),
  pagare:      regAreH('pag','pagh','pagato'),
  spiegare:    regAreH('spieg','spiegh','spiegato'),
  mancare:     regAreH('manc','manch','mancato'),
  // ── -iare verbs (keep i) ─────────────────────────────────────────────────────
  studiare:    regAreI('studi','studiato'),
  iniziare:    regAreI('inizi','iniziato'),
  // ── -ciare/-giare verbs (drop i) ─────────────────────────────────────────────
  lasciare:    regAreCI('lasc','lasciato'),
  viaggiare:   regAreCI('viagg','viaggiato'),
  // ── Regular -ERE ─────────────────────────────────────────────────────────────
  credere:     regEre('cred','creduto'),
  ricevere:    regEre('ricev','ricevuto'),
  // ── Regular -IRE ─────────────────────────────────────────────────────────────
  partire:     regIre('part','partito','essere'),
  sentire:     regIre('sent','sentito'),
  seguire:     regIre('segu','seguito'),
  // ── Regular -IRE (ISC) ───────────────────────────────────────────────────────
  finire:      regIre('fin','finito','avere',true),
  preferire:   regIre('prefer','preferito','avere',true),
  spedire:     regIre('sped','spedito','avere',true),
  pulire:      regIre('pul','pulito','avere',true),
};

const VERB_ES = {
  essere:'ser / estar', avere:'tener / haber', fare:'hacer', andare:'ir',
  venire:'venir', potere:'poder', volere:'querer', sapere:'saber',
  parlare:'hablar', capire:'entender / comprender', dire:'decir', stare:'estar (bien/mal)',
  uscire:'salir', leggere:'leer', scrivere:'escribir', mangiare:'comer',
  bere:'beber', dormire:'dormir', prendere:'tomar / coger',
  dovere:'deber / tener que', dare:'dar', tenere:'tener / sujetar',
  vedere:'ver', vivere:'vivir', scegliere:'elegir / escoger', mettere:'poner',
  chiedere:'pedir / preguntar', rispondere:'responder', decidere:'decidir',
  conoscere:'conocer', correre:'correr', perdere:'perder', spendere:'gastar',
  vincere:'ganar / vencer', rimanere:'quedarse', salire:'subir', piacere:'gustar',
  ridere:'reír', piangere:'llorar', togliere:'quitar / sacar', offrire:'ofrecer',
  aprire:'abrir', sedere:'sentarse', morire:'morir', nascere:'nacer',
  crescere:'crecer', sorridere:'sonreír', risolvere:'resolver', accendere:'encender',
  cominciare:'empezar / comenzar', aspettare:'esperar', aiutare:'ayudar',
  chiamare:'llamar', comprare:'comprar', cucinare:'cocinar', guardare:'mirar / ver',
  imparare:'aprender', incontrare:'encontrar / conocer', lavorare:'trabajar',
  passare:'pasar', pensare:'pensar', portare:'llevar', provare:'intentar / probar',
  ricordare:'recordar', salutare:'saludar', trovare:'encontrar / hallar',
  usare:'usar / utilizar', camminare:'caminar', cantare:'cantar',
  continuare:'continuar', fermare:'parar / detener', interessare:'interesar',
  lavare:'lavar', nuotare:'nadar', preparare:'preparar', suonare:'tocar (instrumento)',
  diventare:'convertirse en / hacerse', entrare:'entrar', tornare:'volver / regresar',
  restare:'quedarse', sembrare:'parecer', arrivare:'llegar',
  giocare:'jugar', cercare:'buscar', pagare:'pagar', spiegare:'explicar',
  mancare:'faltar / echar de menos', studiare:'estudiar', iniziare:'empezar / iniciar',
  lasciare:'dejar', viaggiare:'viajar', credere:'creer', ricevere:'recibir',
  partire:'salir / partir', sentire:'sentir / oír', seguire:'seguir',
  finire:'terminar / acabar', preferire:'preferir', spedire:'enviar / mandar',
  pulire:'limpiar',
};

router.get('/conjugation/verbs', (req, res) => {
  res.json(Object.keys(VERBS));
});

router.get('/conjugation/verbs-with-translations', (req, res) => {
  res.json(Object.keys(VERBS).map(v => ({ verb: v, translation: VERB_ES[v] || v })));
});

router.get('/conjugation/verb-flashcards', (req, res) => {
  const cards = Object.keys(VERBS).map(verb => ({
    verb,
    translation: VERB_ES[verb] || verb,
    presente: VERBS[verb].presente,
  }));
  res.json(cards);
});

router.get('/conjugation/verb-data/:verb', (req, res) => {
  const verb = req.params.verb;
  if (!VERBS[verb]) return res.status(404).json({ error: 'unknown verb' });
  res.json({ verb, translation: VERB_ES[verb] || verb, conjugations: VERBS[verb] });
});

router.get('/conjugation/stats', (req, res) => {
  const rows = db.prepare(`
    SELECT verb, tense,
      COUNT(*) as total,
      SUM(is_correct) as correct
    FROM conjugation_attempts
    GROUP BY verb, tense
    ORDER BY verb, tense
  `).all();

  const byVerb = {};
  rows.forEach(r => {
    if (!byVerb[r.verb]) byVerb[r.verb] = { verb: r.verb, tenses: [], total: 0, correct: 0 };
    const acc = Math.round(r.correct * 100 / r.total);
    byVerb[r.verb].tenses.push({ tense: r.tense, total: r.total, correct: r.correct, accuracy: acc });
    byVerb[r.verb].total += r.total;
    byVerb[r.verb].correct += r.correct;
  });

  const result = Object.values(byVerb).map(v => ({
    ...v,
    accuracy: Math.round(v.correct * 100 / v.total),
  })).sort((a, b) => a.accuracy - b.accuracy);

  res.json(result);
});

router.get('/conjugation/exercise', (req, res) => {
  const verbs = Object.keys(VERBS);
  const validTenses = ['presente','imperfetto','futuro','condizionale','passato_prossimo','congiuntivo'];
  const allowedTenses = req.query.tenses
    ? req.query.tenses.split(',').filter(t => validTenses.includes(t))
    : ['presente','imperfetto','futuro','condizionale','passato_prossimo'];
  if (allowedTenses.length === 0) return res.status(400).json({ error: 'no valid tenses selected' });

  const weakVerbs = db.prepare(`
    SELECT verb, tense, SUM(is_correct)*1.0/COUNT(*) as acc
    FROM conjugation_attempts WHERE tense IN (${allowedTenses.map(()=>'?').join(',')})
    GROUP BY verb, tense ORDER BY acc ASC LIMIT 5
  `).all(...allowedTenses);

  let verb, tense;
  if (weakVerbs.length > 0 && Math.random() > 0.5) {
    const pick = weakVerbs[Math.floor(Math.random() * weakVerbs.length)];
    verb = pick.verb; tense = pick.tense;
  } else {
    verb = verbs[Math.floor(Math.random() * verbs.length)];
    tense = allowedTenses[Math.floor(Math.random() * allowedTenses.length)];
  }

  const verbData = VERBS[verb];
  if (!verbData || !verbData[tense]) {
    return res.json({ verb:'parlare', tense:'presente', tense_display:'Presente Indicativo', all_forms: VERBS.parlare.presente });
  }

  const tenseName = { presente:'Presente Indicativo', imperfetto:'Imperfetto', futuro:'Futuro Semplice',
    condizionale:'Condizionale Presente', congiuntivo:'Congiuntivo Presente', passato_prossimo:'Passato Prossimo' };

  res.json({ verb, tense, tense_display: tenseName[tense] || tense, all_forms: verbData[tense] });
});

router.post('/conjugation/check', (req, res) => {
  const { verb, tense, person, answer } = req.body;
  const verbData = VERBS[verb];
  if (!verbData || !verbData[tense]) return res.status(400).json({ error: 'invalid verb/tense' });
  const correct_form = verbData[tense][person];
  const is_correct = expandForms(correct_form).includes(answer.normalize('NFC').trim().toLowerCase()) ? 1 : 0;
  db.prepare('INSERT INTO conjugation_attempts(verb,tense,person,correct_form,user_answer,is_correct) VALUES(?,?,?,?,?,?)')
    .run(verb, tense, person, correct_form, answer, is_correct);
  res.json({ is_correct, correct_form, all_forms: verbData[tense] });
});

// ── Study time heartbeat ─────────────────────────────────────────────────────
router.post('/stats/heartbeat', (req, res) => {
  const { seconds = 0 } = req.body;
  if (seconds < 5) return res.json({ ok: true });
  const mins = seconds / 60;
  const goal = parseInt(db.prepare("SELECT value FROM settings WHERE key='daily_minutes'").get()?.value || 30);
  db.prepare(`INSERT INTO daily_stats(date, minutes_studied, goal_met) VALUES(?, ?, 0)
    ON CONFLICT(date) DO UPDATE SET
    minutes_studied = minutes_studied + ?,
    goal_met = CASE WHEN minutes_studied + ? >= ? THEN 1 ELSE 0 END`)
    .run(today(), mins, mins, mins, goal);
  res.json({ ok: true });
});

// ── Writing ──────────────────────────────────────────────────────────────────
router.get('/writing/prompts', (req, res) => {
  res.json(db.prepare('SELECT * FROM writing_exercises WHERE user_text IS NULL ORDER BY RANDOM() LIMIT 5').all());
});

router.get('/writing/exercises', (req, res) => {
  res.json(db.prepare('SELECT * FROM writing_exercises ORDER BY created_at DESC LIMIT 20').all());
});

router.post('/writing/exercises', (req, res) => {
  const { prompt, type = 'free' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const r = db.prepare('INSERT INTO writing_exercises(prompt,type) VALUES(?,?)').run(prompt, type);
  res.json({ id: r.lastInsertRowid });
});

router.put('/writing/exercises/:id', (req, res) => {
  const { user_text, corrected_text, feedback, cefr_estimate } = req.body;
  const word_count = (user_text || '').trim().split(/\s+/).filter(Boolean).length;
  db.prepare(`UPDATE writing_exercises SET user_text=?,corrected_text=?,feedback=?,word_count=?,cefr_estimate=?,completed=1 WHERE id=?`)
    .run(user_text||null, corrected_text||null, JSON.stringify(feedback||{}), word_count, cefr_estimate||null, req.params.id);
  res.json({ ok: true });
});

// ── Rewards ──────────────────────────────────────────────────────────────────
router.get('/rewards', (req, res) => res.json(db.prepare('SELECT * FROM rewards ORDER BY created_at DESC').all()));

router.post('/rewards', (req, res) => {
  const { title, description, requirement_type, requirement_value } = req.body;
  if (!title || !requirement_type || requirement_value === undefined) return res.status(400).json({ error: 'missing fields' });
  const r = db.prepare('INSERT INTO rewards(title,description,requirement_type,requirement_value) VALUES(?,?,?,?)').run(title, description||null, requirement_type, requirement_value);
  res.json({ id: r.lastInsertRowid });
});

router.put('/rewards/:id', (req, res) => {
  const { earned, claimed, current_value } = req.body;
  const updates = []; const vals = [];
  if (earned !== undefined) { updates.push('earned=?'); vals.push(earned); if (earned) { updates.push('earned_at=?'); vals.push(now()); } }
  if (claimed !== undefined) { updates.push('claimed=?'); vals.push(claimed); }
  if (current_value !== undefined) { updates.push('current_value=?'); vals.push(current_value); }
  if (!updates.length) return res.json({ ok: true });
  db.prepare(`UPDATE rewards SET ${updates.join(',')} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

router.delete('/rewards/:id', (req, res) => {
  db.prepare('DELETE FROM rewards WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Milestones ───────────────────────────────────────────────────────────────
router.get('/milestones', (req, res) => res.json(db.prepare('SELECT * FROM milestones ORDER BY unlocked DESC, id').all()));

router.post('/milestones/check', (req, res) => {
  const stats = db.prepare('SELECT value FROM settings WHERE key="streak"').get()?.value || 0;
  const words = db.prepare('SELECT COUNT(*) as n FROM flashcards WHERE repetitions >= 2').get().n;
  const sessions = db.prepare('SELECT COUNT(*) as n FROM study_sessions WHERE completed=1').get().n;

  const checks = [
    { id:'first_session', condition: sessions >= 1 },
    { id:'streak_7', condition: parseInt(stats) >= 7 },
    { id:'streak_30', condition: parseInt(stats) >= 30 },
    { id:'words_50', condition: words >= 50 },
    { id:'words_200', condition: words >= 200 },
    { id:'words_500', condition: words >= 500 },
  ];

  const update = db.prepare('UPDATE milestones SET unlocked=1,unlocked_at=? WHERE id=? AND unlocked=0');
  const unlocked = [];
  checks.forEach(c => {
    if (c.condition) {
      const r = update.run(now(), c.id);
      if (r.changes > 0) unlocked.push(c.id);
    }
  });
  res.json({ unlocked });
});

// ── Export / Import ──────────────────────────────────────────────────────────
router.get('/export', (req, res) => {
  const data = {
    exported_at: new Date().toISOString(),
    settings: db.prepare('SELECT * FROM settings').all(),
    vocabulary_categories: db.prepare('SELECT * FROM vocabulary_categories').all(),
    vocabulary_items: db.prepare('SELECT * FROM vocabulary_items').all(),
    flashcards: db.prepare('SELECT * FROM flashcards').all(),
    errors: db.prepare('SELECT * FROM errors').all(),
    daily_stats: db.prepare('SELECT * FROM daily_stats').all(),
    rewards: db.prepare('SELECT * FROM rewards').all(),
    milestones: db.prepare('SELECT * FROM milestones').all(),
    writing_exercises: db.prepare('SELECT * FROM writing_exercises').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="italiano-backup-${today()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

// ── Verb Scores ──────────────────────────────────────────────────────────────
router.get('/verb-scores', (req, res) => {
  const rows = db.prepare('SELECT verb, tense, best_correct, xp, attempts, last_practiced FROM verb_scores ORDER BY verb, tense').all();
  res.json(rows);
});

router.post('/verb-scores', (req, res) => {
  const { verb, tenseScores } = req.body;
  if (!verb || !Array.isArray(tenseScores)) return res.status(400).json({ error: 'invalid' });
  const upsert = db.prepare(`
    INSERT INTO verb_scores (verb, tense, best_correct, xp, attempts, last_practiced)
    VALUES (?, ?, ?, ?, 1, unixepoch())
    ON CONFLICT(verb, tense) DO UPDATE SET
      best_correct = MAX(best_correct, excluded.best_correct),
      xp = xp + excluded.xp,
      attempts = attempts + 1,
      last_practiced = unixepoch()
  `);
  const txn = db.transaction((scores) => {
    scores.forEach(({ tense, correct }) => {
      if (!tense || correct == null) return;
      upsert.run(verb, tense, correct, correct);
    });
  });
  txn(tenseScores);
  res.json({ ok: true });
});

module.exports = router;
