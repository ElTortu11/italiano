# italiano — Personal Italian Learning App

Live at **italiano-mathi.up.railway.app**

A self-hosted SPA for learning Italian vocabulary and conjugations, built with Node.js + Express + SQLite (no ORMs, no frameworks, no external APIs).

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 24 (`node:sqlite` / `DatabaseSync`) |
| Server | Express.js (hash-routing SPA) |
| DB | SQLite via Railway Volume (`/data/italiano.db`) |
| Frontend | Vanilla JS, single `app.js` + `app.css` |
| Deploy | Railway (auto-deploy on `git push`) |
| Cache | Service worker (`italiano-v7`) |

---

## Features

### Vocabulario
- 100+ words across 21+ thematic categories (il corpo, la casa, i colori…)
- Click a category → popup with word list + search filter
- Mastery indicator per word (dot color based on `correct_reviews`)
- Two study modes: **Clásico** (flip cards) or **Escritura** (typing)

### Flashcards
- **Clásico mode** — spaced repetition (SM-2): Bien / Difícil / Mal buttons
- **Escritura mode** — type the Italian word with article
  - Press **Enter** to check
  - Press **→** (or Enter again) to advance to next card
  - Result + example shown inline without needing to scroll
- **Verbi tab** — flip cards showing infinitive → translation + presente forms
- Category-filtered sessions: vocabulary → category → mode → filtered flashcards
- Progress bar + score shown throughout

### Conjugaciones
- **Práctica tab** — random verb/tense drill; choose which tenses to include
  - Wrong answers turn red; correct answer hidden by default
  - **Riprova** to retry blanked inputs; **Mostra le risposte** to reveal
  - **Siguiente →** advances; tracks streak + accuracy
- **Por verbo tab** *(new)* — focused drill on a single verb
  - Search and pick from all 100 verbs
  - Select which tenses to practice (Presente → Passato → Imperfetto → Futuro → Condizionale → Congiuntivo)
  - Fill in all 6 persons per tense; Enter moves between fields, Enter/→ advances tense
  - **Ver respuestas** reveals answers for wrong forms
  - After all tenses: review round for every mistake
  - Final score screen with per-tense error summary; retry or pick new verb
- **Referencia tab** — full conjugation table for any verb

### Cuaderno de errores
- **Pendientes / Todos / Corregidos** tabs for grammar errors
- **Verbi tab** — accuracy bars per verb and tense (from `conjugation_attempts` table)
- **Parole tab** — word mastery breakdown: No la sé / En curso / Dominada

### Dashboard
- Today's stats: minutes studied, cards reviewed, goal progress
- Weekly summary, streak, best streak
- Weak categories highlight, recent errors, milestones

---

## Verb database

100 verbs with full conjugations across 6 tenses (Presente, Passato Prossimo, Imperfetto, Futuro, Condizionale, Congiuntivo):

- **Irregulars**: essere, avere, fare, andare, venire, potere, volere, dovere, sapere, dire, stare, bere, dare, tenere, vedere, vivere, scegliere, mettere, chiedere, rispondere, decidere, conoscere, correre, perdere, spendere, vincere, rimanere, salire, piacere, ridere, piangere, togliere, offrire, aprire, sedere, morire, nascere, crescere, sorridere, risolvere, accendere, uscire, leggere, scrivere, prendere, capire, dormire, mangiare, bere, cominciare
- **Regular -ARE**: parlare, aspettare, aiutare, chiamare, comprare, cucinare, guardare, imparare, incontrare, lavorare, passare, pensare, portare, provare, ricordare, salutare, trovare, usare, camminare, cantare, continuare, fermare, interessare, lavare, nuotare, preparare, suonare, diventare, entrare, tornare, restare, sembrare, arrivare
- **-care/-gare**: giocare, cercare, pagare, spiegare, mancare
- **-iare**: studiare, iniziare, lasciare, viaggiare
- **Regular -ERE**: credere, ricevere
- **Regular -IRE**: partire, sentire, seguire, finire, preferire, spedire, pulire

Conjugation helpers (`regAre`, `regEre`, `regIre`) in `routes/api.js` generate all regular forms programmatically; irregulars are defined explicitly.

---

## Data model (SQLite)

```
vocabulary_categories   id, name, name_it, icon, color, sort_order
vocabulary_items        id, italian, spanish, category_id, article, gender, plural,
                        example_it, example_es, cefr_level, UNIQUE(italian, category_id)
flashcards              id, vocabulary_id, front, back, direction, category_id,
                        ef, interval, repetitions, next_review, correct_reviews, total_reviews
conjugation_attempts    id, verb, tense, person, correct_form, user_answer, is_correct
errors                  id, original_text, corrected_text, category, mastery, times_correct
study_sessions / daily_stats / settings / rewards / milestones
```

---

## Running locally

```bash
npm install
node database/seed.js   # drops & recreates vocabulary tables, seeds 321 words
node server.js          # → http://localhost:3000
```

Set `DB_PATH` env var to use a custom SQLite path (Railway Volume: `/data/italiano.db`).

---

## Seeding

`database/seed.js` drops `flashcards`, `vocabulary_items`, and `vocabulary_categories` before re-creating them, making it fully idempotent. `UNIQUE` constraints on both tables prevent duplicates from any partial re-run.

---

## Deployment

Push to `master` → Railway auto-deploys. The service worker (`public/sw.js`) version must be bumped on any CSS/JS change so clients invalidate their cache. Current version: **v7**.

After a new deploy, open in incognito or press **Ctrl+Shift+R** once to force cache refresh.
