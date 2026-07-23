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
const VERBS = {
  essere: {
    presente: { io:'sono', tu:'sei', lui:'è', noi:'siamo', voi:'siete', loro:'sono' },
    imperfetto: { io:'ero', tu:'eri', lui:'era', noi:'eravamo', voi:'eravate', loro:'erano' },
    futuro: { io:'sarò', tu:'sarai', lui:'sarà', noi:'saremo', voi:'sarete', loro:'saranno' },
    condizionale: { io:'sarei', tu:'saresti', lui:'sarebbe', noi:'saremmo', voi:'sareste', loro:'sarebbero' },
    congiuntivo: { io:'sia', tu:'sia', lui:'sia', noi:'siamo', voi:'siate', loro:'siano' },
    passato_prossimo: { io:'sono stato/a', tu:'sei stato/a', lui:'è stato', noi:'siamo stati/e', voi:'siete stati/e', loro:'sono stati/e' },
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
    passato_prossimo: { io:'sono andato/a', tu:'sei andato/a', lui:'è andato', noi:'siamo andati/e', voi:'siete andati/e', loro:'sono andati/e' },
  },
  venire: {
    presente: { io:'vengo', tu:'vieni', lui:'viene', noi:'veniamo', voi:'venite', loro:'vengono' },
    imperfetto: { io:'venivo', tu:'venivi', lui:'veniva', noi:'venivamo', voi:'venivate', loro:'venivano' },
    futuro: { io:'verrò', tu:'verrai', lui:'verrà', noi:'verremo', voi:'verrete', loro:'verranno' },
    condizionale: { io:'verrei', tu:'verresti', lui:'verrebbe', noi:'verremmo', voi:'verreste', loro:'verrebbero' },
    congiuntivo: { io:'venga', tu:'venga', lui:'venga', noi:'veniamo', voi:'veniate', loro:'vengano' },
    passato_prossimo: { io:'sono venuto/a', tu:'sei venuto/a', lui:'è venuto', noi:'siamo venuti/e', voi:'siete venuti/e', loro:'sono venuti/e' },
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
};

router.get('/conjugation/verbs', (req, res) => {
  res.json(Object.keys(VERBS));
});

router.get('/conjugation/exercise', (req, res) => {
  const verbs = Object.keys(VERBS);
  const tenses = ['presente','imperfetto','futuro','condizionale','congiuntivo','passato_prossimo'];
  const persons = ['io','tu','lui','noi','voi','loro'];

  // Weight by error rate
  const weakVerbs = db.prepare(`
    SELECT verb, tense, SUM(is_correct)*1.0/COUNT(*) as acc
    FROM conjugation_attempts GROUP BY verb, tense ORDER BY acc ASC LIMIT 5
  `).all();

  let verb, tense;
  if (weakVerbs.length > 0 && Math.random() > 0.5) {
    const pick = weakVerbs[Math.floor(Math.random() * weakVerbs.length)];
    verb = pick.verb;
    tense = pick.tense;
  } else {
    verb = verbs[Math.floor(Math.random() * verbs.length)];
    tense = tenses[Math.floor(Math.random() * tenses.length)];
  }

  const person = persons[Math.floor(Math.random() * persons.length)];
  const verbData = VERBS[verb];
  if (!verbData || !verbData[tense]) {
    return res.json({ verb: 'parlare', tense: 'presente', person: 'io', answer: 'parlo' });
  }

  const tenseName = { presente:'Presente Indicativo', imperfetto:'Imperfetto', futuro:'Futuro Semplice',
    condizionale:'Condizionale Presente', congiuntivo:'Congiuntivo Presente', passato_prossimo:'Passato Prossimo' };

  res.json({
    verb, tense, person,
    tense_display: tenseName[tense] || tense,
    answer: verbData[tense][person],
    all_forms: verbData[tense],
  });
});

router.post('/conjugation/check', (req, res) => {
  const { verb, tense, person, answer } = req.body;
  const verbData = VERBS[verb];
  if (!verbData || !verbData[tense]) return res.status(400).json({ error: 'invalid verb/tense' });
  const correct_form = verbData[tense][person];
  const is_correct = answer.trim().toLowerCase() === correct_form.toLowerCase() ? 1 : 0;
  db.prepare('INSERT INTO conjugation_attempts(verb,tense,person,correct_form,user_answer,is_correct) VALUES(?,?,?,?,?,?)')
    .run(verb, tense, person, correct_form, answer, is_correct);
  res.json({ is_correct, correct_form, all_forms: verbData[tense] });
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

module.exports = router;
