const db = require('./db');

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS vocabulary_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      name_it TEXT,
      icon TEXT DEFAULT '📚',
      color TEXT DEFAULT '#1e6b45',
      parent_id INTEGER REFERENCES vocabulary_categories(id),
      is_custom INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS vocabulary_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      italian TEXT NOT NULL,
      spanish TEXT NOT NULL,
      italian_definition TEXT,
      category_id INTEGER REFERENCES vocabulary_categories(id),
      word_type TEXT DEFAULT 'noun',
      gender TEXT,
      article TEXT,
      plural TEXT,
      example_it TEXT,
      example_es TEXT,
      synonyms TEXT DEFAULT '[]',
      antonyms TEXT DEFAULT '[]',
      collocations TEXT DEFAULT '[]',
      register TEXT DEFAULT 'neutral',
      cefr_level TEXT DEFAULT 'B1',
      tags TEXT DEFAULT '[]',
      notes TEXT,
      false_friend_note TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(italian, category_id)
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocabulary_id INTEGER REFERENCES vocabulary_items(id),
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      direction TEXT DEFAULT 'it-es',
      category_id INTEGER,
      ef REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review INTEGER DEFAULT (unixepoch()),
      last_review INTEGER,
      total_reviews INTEGER DEFAULT 0,
      correct_reviews INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      duration_minutes REAL DEFAULT 0,
      activities TEXT DEFAULT '[]',
      flashcards_reviewed INTEGER DEFAULT 0,
      new_words_learned INTEGER DEFAULT 0,
      exercises_completed INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      started_at INTEGER DEFAULT (unixepoch()),
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      minutes_studied REAL DEFAULT 0,
      flashcards_reviewed INTEGER DEFAULT 0,
      new_words INTEGER DEFAULT 0,
      exercises INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      goal_met INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_text TEXT NOT NULL,
      corrected_text TEXT,
      explanation TEXT,
      category TEXT DEFAULT 'grammar',
      importance INTEGER DEFAULT 2,
      mastery INTEGER DEFAULT 0,
      times_seen INTEGER DEFAULT 1,
      times_correct INTEGER DEFAULT 0,
      next_review INTEGER DEFAULT (unixepoch()),
      source TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conjugation_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verb TEXT NOT NULL,
      tense TEXT NOT NULL,
      person TEXT NOT NULL,
      correct_form TEXT NOT NULL,
      user_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      attempted_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS grammar_progress (
      topic_id TEXT PRIMARY KEY,
      mastery REAL DEFAULT 0,
      times_practiced INTEGER DEFAULT 0,
      last_practiced INTEGER,
      accuracy REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS writing_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      type TEXT DEFAULT 'free',
      user_text TEXT,
      corrected_text TEXT,
      feedback TEXT DEFAULT '{}',
      word_count INTEGER DEFAULT 0,
      cefr_estimate TEXT,
      completed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      requirement_type TEXT NOT NULL,
      requirement_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      earned INTEGER DEFAULT 0,
      earned_at INTEGER,
      claimed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      unlocked INTEGER DEFAULT 0,
      unlocked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS verb_scores (
      verb TEXT NOT NULL,
      tense TEXT NOT NULL,
      best_correct INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      last_practiced INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (verb, tense)
    );

    CREATE INDEX IF NOT EXISTS idx_verb_scores_verb ON verb_scores(verb);
    CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);
    CREATE INDEX IF NOT EXISTS idx_flashcards_category ON flashcards(category_id);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_category ON vocabulary_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_errors_next_review ON errors(next_review);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(date);
  `);


  // Default settings
  const defaults = [
    ['goal_level', 'B2'],
    ['daily_minutes', '30'],
    ['daily_new_cards', '15'],
    ['theme', 'auto'],
    ['language_explanations', 'es'],
    ['streak', '0'],
    ['best_streak', '0'],
    ['last_study_date', ''],
    ['total_minutes', '0'],
    ['total_words_learned', '0'],
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)`);
  defaults.forEach(([k, v]) => insertSetting.run(k, v));
}

module.exports = { createSchema };
