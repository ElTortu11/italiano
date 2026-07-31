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

    CREATE TABLE IF NOT EXISTS answer_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocabulary_id INTEGER NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
      answer TEXT NOT NULL,
      variant_type TEXT NOT NULL DEFAULT 'synonym',
      accepted INTEGER DEFAULT 1,
      note TEXT,
      contexts TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(vocabulary_id, answer)
    );

    CREATE INDEX IF NOT EXISTS idx_answer_variants_vocab ON answer_variants(vocabulary_id);

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

  // ── Preposizioni category (idempotent) ──────────────────────────────────────
  db.prepare(`INSERT OR IGNORE INTO vocabulary_categories(name,name_it,icon,color,sort_order) VALUES(?,?,?,?,?)`)
    .run('Preposizioni','Preposizioni','📍','#b45309',22);

  const prepCatId = db.prepare(`SELECT id FROM vocabulary_categories WHERE name='Preposizioni'`).get()?.id;
  if (prepCatId) {
    const insW = db.prepare(`
      INSERT OR IGNORE INTO vocabulary_items(italian,spanish,category_id,word_type,gender,article,plural,example_it,example_es,cefr_level,notes,false_friend_note,collocations)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insF = db.prepare(`INSERT OR IGNORE INTO flashcards(vocabulary_id,front,back,direction,category_id,next_review) VALUES(?,?,?,?,?,?)`);
    const now = Math.floor(Date.now()/1000);
    const preps = [
      ['di','de / del','A1','Sono di Madrid.','Soy de Madrid.','Provenienza, possesso, argomento'],
      ['a','a / en','A1','Vado a Roma.','Voy a Roma.','Luogo, moto a luogo, ora'],
      ['da','de / desde / por','A1','Vengo da Parigi.','Vengo de París.','Provenienza, causa, durata, agente'],
      ['in','en','A1','Vivo in Italia.','Vivo en Italia.','Luogo, mezzo di trasporto, mese/stagione'],
      ['con','con','A1','Vengo con te.','Vengo contigo.','Compagnia, mezzo, modo'],
      ['su','en / sobre','A1','Il libro è sul tavolo.','El libro está sobre la mesa.','Luogo sopra, argomento'],
      ['per','por / para','A1','Questo è per te.','Esto es para ti.','Destinatario, scopo, causa, durata'],
      ['tra','entre / en (tiempo)','A1','Arrivo tra due ore.','Llego en dos horas.','Distanza spaziale/temporale, relazione'],
      ['fra','entre (variante di tra)','A1','Fra amici tutto è più facile.','Entre amigos todo es más fácil.','Equivalente di "tra", uso interchangeable'],
      ['del (di + il)','del','A1','il sapore del caffè','el sabor del café','di + il (maschile singolare)'],
      ['dello (di + lo)','del','A1','il profumo dello zucchero','el aroma del azúcar','di + lo (maschile, davanti a s+cons, z…)'],
      ['della (di + la)','de la','A1','la porta della chiesa','la puerta de la iglesia','di + la (femminile singolare)'],
      ["dell' (di + l')",'del / de la','A1',"il colore dell'arancia",'el color de la naranja',"di + l' (davanti a vocale)"],
      ['dei (di + i)','de los','A1','la lista dei compiti','la lista de los deberes','di + i (maschile plurale)'],
      ['degli (di + gli)','de los','A1','il nome degli studenti','el nombre de los estudiantes','di + gli (maschile plurale)'],
      ['delle (di + le)','de las','A1','il colore delle foglie','el color de las hojas','di + le (femminile plurale)'],
      ['al (a + il)','al','A1','Vado al mercato.','Voy al mercado.','a + il (maschile singolare)'],
      ['allo (a + lo)','al','A1','Vado allo stadio.','Voy al estadio.','a + lo'],
      ['alla (a + la)','a la','A1','Vado alla stazione.','Voy a la estación.','a + la (femminile singolare)'],
      ["all' (a + l')",'al / a la','A1',"Vado all'aeroporto.",'Voy al aeropuerto.',"a + l' (davanti a vocale)"],
      ['ai (a + i)','a los','A1','Parla ai ragazzi.','Habla a los chicos.','a + i (maschile plurale)'],
      ['agli (a + gli)','a los','A1','Agli studenti piace.','A los estudiantes les gusta.','a + gli'],
      ['alle (a + le)','a las','A1','Arrivo alle tre.','Llego a las tres.','a + le — usato per l\'ora'],
      ['dal (da + il)','del / desde el','A1','Vengo dal dentista.','Vengo del dentista.','da + il'],
      ['dallo (da + lo)','del / desde el','A1','Esco dallo stadio.','Salgo del estadio.','da + lo'],
      ['dalla (da + la)','de la / desde la','A1','Vengo dalla stazione.','Vengo de la estación.','da + la (femminile singolare)'],
      ['dai (da + i)','de los','A1','Torno dai nonni.','Vuelvo a casa de mis abuelos.','da + i'],
      ['dagli (da + gli)','de los','A2','Dagli amici si impara.','De los amigos se aprende.','da + gli'],
      ['dalle (da + le)','de las','A2','Arriva dalle montagne.','Viene de las montañas.','da + le (femminile plurale)'],
      ['nel (in + il)','en el','A1','Il gatto è nel giardino.','El gato está en el jardín.','in + il'],
      ['nello (in + lo)','en el','A1','Cammino nello stesso posto.','Camino en el mismo lugar.','in + lo'],
      ['nella (in + la)','en la','A1','Vivo nella città.','Vivo en la ciudad.','in + la (femminile singolare)'],
      ["nell' (in + l')",'en el/la','A1',"Nuoto nell'acqua.",'Nado en el agua.',"in + l' (davanti a vocale)"],
      ['nei (in + i)','en los','A1','Nei weekend riposo.','Los fines de semana descanso.','in + i'],
      ['negli (in + gli)','en los','A2',"Negli anni '90 era diverso.",'En los años 90 era diferente.','in + gli'],
      ['nelle (in + le)','en las','A1','In vacanza viaggio spesso.','En las vacaciones viajo a menudo.','in + le (femminile plurale)'],
      ['sul (su + il)','en el / sobre el','A1','Il libro è sul tavolo.','El libro está sobre la mesa.','su + il'],
      ['sullo (su + lo)','en el / sobre el','A2','Scrive sullo stesso tema.','Escribe sobre el mismo tema.','su + lo'],
      ['sulla (su + la)','en la / sobre la','A1','Siediti sulla sedia.','Siéntate en la silla.','su + la (femminile singolare)'],
      ['sui (su + i)','en los / sobre los','A2','Sui giornali si leggono molte notizie.','En los periódicos se leen muchas noticias.','su + i'],
      ['sugli (su + gli)','en los','A2','Gli uccelli cantano sugli alberi.','Los pájaros cantan en los árboles.','su + gli'],
      ['sulle (su + le)','en las / sobre las','A2',"Sulle montagne c'è neve.",'En las montañas hay nieve.','su + le (femminile plurale)'],
      ['col (con + il)','con el','A2','Mangio col cucchiaio.','Como con la cuchara.','Forma contratta di con + il (colloquiale)'],
      ['coi (con + i)','con los','B1','Gioca coi bambini.','Juega con los niños.','Forma contratta di con + i (colloquiale/letterario)'],
      ['sopra','encima de / sobre','A2','Il quadro è sopra il divano.','El cuadro está encima del sofá.','Indica posizione superiore'],
      ['sotto','debajo de / bajo','A2','Il gatto è sotto il letto.','El gato está debajo de la cama.','Indica posizione inferiore'],
      ['davanti a','delante de / ante','A2','Aspettami davanti al cinema.','Espérame delante del cine.','Posizione anteriore'],
      ['dietro (a/di)','detrás de','A2','La chiave è dietro la porta.','La llave está detrás de la puerta.','Posizione posteriore'],
      ['vicino a','cerca de','A2','Abito vicino alla stazione.','Vivo cerca de la estación.','Prossimità spaziale'],
      ['lontano da','lejos de','A2','Sono lontano da casa.','Estoy lejos de casa.','Distanza spaziale'],
      ['dentro','dentro de','A2','Il gatto è dentro la scatola.','El gato está dentro de la caja.','Interno di qualcosa'],
      ['fuori (da)','fuera (de)','A2','Aspetta fuori dalla porta.','Espera fuera de la puerta.','Esterno di qualcosa'],
      ['lungo','a lo largo de','B1','Cammino lungo il fiume.','Camino a lo largo del río.','Parallelo a qualcosa'],
      ['verso','hacia','A2','Cammino verso la piazza.','Camino hacia la plaza.','Direzione approssimativa'],
      ['contro','contra','A2','È caduto contro il muro.','Chocó contra la pared.','Opposizione, contatto violento'],
      ['durante','durante','A1','Ho dormito durante il film.','Me dormí durante la película.','Simultaneità temporale'],
      ['dopo','después de','A1','Ci vediamo dopo cena.','Nos vemos después de cenar.','Posteriorità temporale'],
      ['prima (di)','antes (de)','A1','Arrivo prima delle otto.','Llego antes de las ocho.','Anteriorità temporale'],
      ['invece di','en vez de / en lugar de','B1','Invece di urlare, parla.','En vez de gritar, habla.','Sostituzione'],
      ['attraverso','a través de','B1','Passiamo attraverso il parco.','Pasamos a través del parque.','Attraversamento di uno spazio'],
      ['oltre','más allá de / además de','B1',"Oltre il ponte c'è un bar.",'Más allá del puente hay un bar.','Superamento di limite spaziale o aggiunta'],
      ['secondo','según','B1','Secondo me hai torto.','Según yo, estás equivocado.','Fonte, punto di vista'],
      ['circa','aproximadamente / alrededor de','A2','Costa circa venti euro.','Cuesta aproximadamente veinte euros.','Approssimazione'],
      ['tranne','excepto / salvo','B1','Vengono tutti tranne lui.','Vienen todos excepto él.','Esclusione. Sinonimi: eccetto, salvo'],
      ['eccetto','excepto','B1','Tutti eccetto me.','Todos excepto yo.','Esclusione. Sinonimo di tranne'],
      ['salvo','salvo / excepto','B1','Tutto bene, salvo un piccolo problema.','Todo bien, salvo un pequeño problema.','Esclusione, riserva'],
      ['senza','sin','A1','Non posso vivere senza caffè.','No puedo vivir sin café.','Mancanza'],
      ['fino a','hasta','A2','Lavoro fino alle sei.','Trabajo hasta las seis.','Limite temporale o spaziale'],
      ['entro','antes de (plazo) / para','B1','Consegna entro venerdì.','Entrega para el viernes.','Limite massimo di tempo (scadenza)'],
      ['insieme a','junto a / junto con','A2','Vengo insieme a te.','Vengo junto a ti.','Compagnia'],
      ['nonostante','a pesar de','B1','Nonostante la pioggia siamo usciti.','A pesar de la lluvia salimos.','Concessione, contrasto'],
      ['grazie a','gracias a','A2',"Grazie a te ho superato l'esame.",'Gracias a ti aprobé el examen.','Causa positiva'],
      ['a causa di','a causa de','B1','Il volo è cancellato a causa dello sciopero.','El vuelo está cancelado a causa de la huelga.','Causa negativa'],
      ['in mezzo a','en medio de','A2','In mezzo alla confusione non capivo nulla.','En medio del caos no entendía nada.','Posizione centrale'],
      ['di fronte a','frente a / enfrente de','A2','Il bar è di fronte alla chiesa.','El bar está frente a la iglesia.','Posizione anteriore'],
      ['accanto a','al lado de','A2','Siediti accanto a me.','Siéntate a mi lado.','Prossimità laterale'],
      ['a fianco di','al lado de','B1','Cammino a fianco di mia sorella.','Camino al lado de mi hermana.','Sinonimo di accanto a (più formale)'],
      ['in seguito a','tras / a raíz de','B2',"In seguito all'incidente ha cambiato vita.",'Tras el accidente cambió de vida.','Causa o conseguenza (formale)'],
      ['rispetto a','respecto a / en comparación con','B1','Rispetto a ieri fa più caldo.','En comparación con ayer hace más calor.','Confronto, paragone'],
      ['a partire da','a partir de','B1','A partire da domani tutto cambia.','A partir de mañana todo cambia.','Punto di inizio temporale'],
      ['in base a','en base a / basándose en','B2','Decidiamo in base ai risultati.','Decidimos en base a los resultados.','Criterio, riferimento'],
      ['a differenza di','a diferencia de','B2','A differenza di suo fratello, studia molto.','A diferencia de su hermano, estudia mucho.','Contrasto/distinzione'],
      ['ad eccezione di','a excepción de','B2','Tutti, ad eccezione di Marco, erano d\'accordo.','Todos, a excepción de Marco, estaban de acuerdo.','Esclusione formale'],
      ['per mezzo di','por medio de / mediante','B2','Comunicava per mezzo di lettere.','Se comunicaba por medio de cartas.','Strumento, canale'],
      ['a proposito di','a propósito de / hablando de','B1','A proposito di Marco, lo hai visto?','A propósito de Marco, ¿lo has visto?','Introduce un argomento'],
      ['in quanto a','en cuanto a','B2','In quanto a coraggio, non gli manca nulla.','En cuanto a valor, no le falta nada.','Riguardo a, per quanto riguarda'],
      ['nei confronti di','respecto a / hacia (actitud)','B2','Ha un atteggiamento ostile nei confronti di tutti.','Tiene una actitud hostil hacia todos.','Relazione di comportamento/atteggiamento'],
      ['nei pressi di','cerca de / en las inmediaciones de','B1',"L'hotel è nei pressi della stazione.",'El hotel está cerca de la estación.','Vicinanza spaziale (più formale di vicino a)'],
      ['al di là di','más allá de','B1','Al di là delle aspettative.','Más allá de las expectativas.','Superamento di un limite (fisico o figurato)'],
      ['al di sopra di','por encima de','B2',"È al di sopra delle possibilità.",'Está por encima de las posibilidades.','Superiore a un livello'],
      ['al di sotto di','por debajo de','B2','È al di sotto della media.','Está por debajo de la media.','Inferiore a un livello'],
      ['in cima a','en lo alto de / en la cima de','B1',"In cima alla montagna c'è un rifugio.",'En la cima de la montaña hay un refugio.','Punto più alto'],
      ['in fondo a','al fondo de / al final de','A2','Il bagno è in fondo al corridoio.','El baño está al fondo del pasillo.','Punto più lontano/basso'],
      ['per via di','por culpa de / debido a','B1','Ho perso il treno per via del traffico.','Perdí el tren debido al tráfico.','Causa (spesso negativa, colloquiale)'],
      ['a condizione di','a condición de','B2','Ti aiuto a condizione di ricevere il tuo aiuto.','Te ayudo a condición de recibir tu ayuda.','Condizionalità'],
      ['allo scopo di','con el fin de / con el objetivo de','B2','Studio allo scopo di migliorare.','Estudio con el fin de mejorar.','Finalità (formale)'],
      ['in favore di','a favor de','B2','Voto in favore della proposta.','Voto a favor de la propuesta.','Sostegno, vantaggio'],
    ];
    preps.forEach(([it, es, lv, ex_it, ex_es, notes]) => {
      const r = insW.run(it, es, prepCatId, 'other', null, null, null, ex_it, ex_es, lv, notes, null, '[]');
      if (r.lastInsertRowid) insF.run(r.lastInsertRowid, it, es, 'it-es', prepCatId, now);
    });

    // Correct existing wrong/incomplete entries already in the DB (idempotent UPDATEs)
    const fixPrep = db.prepare(`UPDATE vocabulary_items SET example_it=?, example_es=?, spanish=?, notes=? WHERE italian=? AND category_id=?`);
    const fixes = [
      // "hai torto" = estás equivocado — NOT "tienes razón"
      ['Secondo me hai torto.', 'Según yo, estás equivocado.', 'según', 'Fonte, punto di vista', 'secondo', prepCatId],
      // "dai nonni" here = destination (to grandparents' house), not origin
      ['Torno dai nonni.', 'Vuelvo a casa de mis abuelos.', 'de los', 'da + i', 'dai (da + i)', prepCatId],
      // "dallo" can mean "del" or "desde el"
      ['Esco dallo stadio.', 'Salgo del estadio.', 'del / desde el', 'da + lo', 'dallo (da + lo)', prepCatId],
      // Improve unnatural examples
      ['In vacanza viaggio spesso.', 'En las vacaciones viajo a menudo.', 'en las', 'in + le (femminile plurale)', 'nelle (in + le)', prepCatId],
      ['Sui giornali si leggono molte notizie.', 'En los periódicos se leen muchas noticias.', 'en los / sobre los', 'su + i', 'sui (su + i)', prepCatId],
      ['Gli uccelli cantano sugli alberi.', 'Los pájaros cantan en los árboles.', 'en los', 'su + gli', 'sugli (su + gli)', prepCatId],
    ];
    fixes.forEach(([ex_it, ex_es, es, notes, italian, catId]) => {
      fixPrep.run(ex_it, ex_es, es, notes, italian, catId);
    });
  }

  // ── Schema migrations for existing databases ──────────────────────────────
  try {
    db.exec(`ALTER TABLE vocabulary_items ADD COLUMN accepted_answers TEXT DEFAULT '[]'`);
  } catch (_) { /* column already exists */ }
  try { db.exec(`ALTER TABLE errors ADD COLUMN vocabulary_item_id INTEGER`); } catch (_) {}
  try { db.exec(`ALTER TABLE errors ADD COLUMN evaluation_status TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE errors ADD COLUMN prompt_shown TEXT`); } catch (_) {}

  // Fix vocabulary items that have wrong/misleading data in existing DBs
  const fixVocab = db.prepare(`
    UPDATE vocabulary_items SET notes=?, example_it=?, example_es=?, plural=?
    WHERE italian=? AND (notes IS NULL OR notes != ?)
  `);
  const vocabFixes = [
    // sangue: plural "i sangui" is very rare — clarify in notes
    [
      'Normalmente usato solo al singolare. Il plurale "i sangui" è rarissimo e letterario.',
      "C'è del sangue sulla camicia.",
      'Hay sangre en la camisa.',
      'i sangui (rarissimo)',
      'il sangue',
      'Normalmente usato solo al singolare. Il plurale "i sangui" è rarissimo e letterario.',
    ],
  ];
  vocabFixes.forEach(([notes, ex_it, ex_es, plural, italian, notesCheck]) => {
    fixVocab.run(notes, ex_it, ex_es, plural, italian, notesCheck);
  });

  // Fix specific vocab notes without touching example
  const fixVocabNoteOnly = db.prepare(`UPDATE vocabulary_items SET notes=? WHERE italian=? AND (notes IS NULL OR notes != ?)`);
  const noteOnlyFixes = [
    ['Spesso invariabile (fiori arancione), ma anche "arancioni" è accettato. Dipende dal contesto.', 'arancione', 'Spesso invariabile (fiori arancione), ma anche "arancioni" è accettato. Dipende dal contesto.'],
    ['Ausiliare per i verbi transitivi e molti intransitivi. La scelta tra avere ed essere va imparata verbo per verbo.', 'avere', 'Ausiliare per i verbi transitivi e molti intransitivi. La scelta tra avere ed essere va imparata verbo per verbo.'],
    ['Verbo modale — di solito regge un infinito, che può essere sottinteso se chiaro dal contesto (es: "Puoi venire?" "Sì, posso.").', 'potere', 'Verbo modale — di solito regge un infinito, che può essere sottinteso se chiaro dal contesto (es: "Puoi venire?" "Sì, posso.").'],
    ['Come l\'articolo "un": buon ragazzo, buon amico, buono studente, buono zio, buona ragazza, buon\'amica, buoni amici, buone idee.', 'buono', 'Come l\'articolo "un": buon ragazzo, buon amico, buono studente, buono zio, buona ragazza, buon\'amica, buoni amici, buone idee.'],
    ['Sentire = oír/percibir/sentir. Ascoltare = escuchar deliberadamente. Es: "Sento un rumore" (oigo) vs "Ascolto la musica" (escucho).', 'sentire', 'Sentire = oír/percibir/sentir. Ascoltare = escuchar deliberadamente. Es: "Sento un rumore" (oigo) vs "Ascolto la musica" (escucho).'],
    ['Tenere ≠ "tener" (poseer). Usare "avere" per il possesso. Tenere = sostenere, mantenere, custodire, tener sujeto.', 'tenere', 'Tenere ≠ "tener" (poseer). Usare "avere" per il possesso. Tenere = sostenere, mantenere, custodire, tener sujeto.'],
    ['Pensare che + congiuntivo (soggetti diversi). Stesso soggetto: pensare di + infinito (es: "Penso di partire").', 'pensare', 'Pensare che + congiuntivo (soggetti diversi). Stesso soggetto: pensare di + infinito (es: "Penso di partire").'],
    ['Credere che + congiuntivo (soggetti diversi). Stesso soggetto: credere di + infinito (es: "Credo di aver capito").', 'credere', 'Credere che + congiuntivo (soggetti diversi). Stesso soggetto: credere di + infinito (es: "Credo di aver capito").'],
    ['Sperare che + congiuntivo (soggetti diversi). Stesso soggetto: sperare di + infinito (es: "Spero di riuscirci").', 'sperare', 'Sperare che + congiuntivo (soggetti diversi). Stesso soggetto: sperare di + infinito (es: "Spero di riuscirci").'],
  ];
  noteOnlyFixes.forEach(([notes, italian, check]) => fixVocabNoteOnly.run(notes, italian, check));

  // Fix camera da letto example (dormitorio ≠ habitación genérica)
  db.prepare(`UPDATE vocabulary_items SET example_es=? WHERE italian=? AND example_es LIKE '%habitación%' AND example_es NOT LIKE '%dormitorio%'`)
    .run('El dormitorio está en el primer piso.', 'la camera');

  // Fix conveniente false friend note (it CAN mean apropiado/adecuado per Treccani)
  db.prepare(`UPDATE vocabulary_items SET spanish=?, false_friend_note=? WHERE italian=?`)
    .run(
      'conveniente / económico / adecuado',
      '"Conveniente" puede significar barato/económico, pero también apropiado, ventajoso u oportuno. No equivale únicamente a "barato".',
      'conveniente'
    );

  // ── Seed answer_variants (idempotent) ────────────────────────────────────
  const insVariant = db.prepare(`
    INSERT OR IGNORE INTO answer_variants(vocabulary_id, answer, variant_type, accepted, note, contexts)
    VALUES(?, ?, ?, ?, ?, ?)
  `);
  const getVocabId = db.prepare(`SELECT id FROM vocabulary_items WHERE italian=? LIMIT 1`);

  const variantSeed = [
    ["la camera", "la stanza",   "synonym",      1, '"Stanza" è il termine più comune nel parlato; "camera" è preferito nel registro formale e per il dormitorio.',        '[]'],
    ["veloce",    "rapido",      "synonym",      1, '"Rapido" e "veloce" sono sinonimi intercambiabili. "Rapido" è leggermente più formale.',                              '[]'],
    ["gentile",   "cortese",     "synonym",      1, '"Cortese" è più formale; "gentile" è più affettuoso. Entrambi traducono "amable/cortés".',                           '[]'],
    ["la gioia",  "l'allegria",  "synonym",      1, '"Allegria" = alegría/buen humor; "gioia" = júbilo/alegría profunda. Molto vicini nel significato.',                  '[]'],
    ["la paura",  "il timore",   "register",     1, '"Timore" è più letterario e sfumato; "paura" è il termine comune. Entrambi = miedo.',                               '[]'],
    ["la rabbia", "l'ira",       "register",     1, '"Ira" è il termine letterario e più intenso; "rabbia" è il termine colloquiale. Entrambi = rabia/ira.',             '[]'],
    ["arancione", "arancioni",   "plural_form",  1, '"Arancione" è spesso invariabile (es: fiori arancione), ma "arancioni" è accettato in accordo con nomi plurali.',  '[]'],
    ["bello",     "bellissimo",  "near_miss",    0, '"Bellissimo" è il superlativo assoluto (= bellísimo), non il grado base. La risposta richiesta era "bello".',       '[]'],
    ["stare",     "essere",      "near_miss",    0, '"Stare" e "essere" hanno usi sovrapposti ma non sono sinonimi. "Stare" = estar; "essere" = ser/estar.',             '[]'],
    ["tenere",    "avere",       "near_miss",    0, '"Avere" esprime il possesso; "tenere" = sostener/sujetar. Non sono intercambiabili.',                               '[]'],
  ];

  variantSeed.forEach(([italian, answer, type, accepted, note, contexts]) => {
    const row = getVocabId.get(italian);
    if (row) insVariant.run(row.id, answer, type, accepted, note, contexts);
  });

  // ── Phase 4: Preposition extended tables ─────────────────────────────────────
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name_it TEXT,
    name_es TEXT,
    description TEXT,
    display_order INTEGER,
    cefr_min TEXT
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vocabulary_item_id INTEGER UNIQUE REFERENCES vocabulary_items(id),
    canonical_form TEXT,
    item_type TEXT,
    primary_topic_id INTEGER REFERENCES preposition_topics(id),
    cefr TEXT,
    register TEXT,
    explanation_it TEXT,
    explanation_es TEXT,
    common_errors TEXT DEFAULT '{}',
    review_status TEXT DEFAULT 'ok'
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_item_topics (
    preposition_item_id INTEGER REFERENCES preposition_items(id),
    topic_id INTEGER REFERENCES preposition_topics(id),
    is_primary INTEGER DEFAULT 0,
    PRIMARY KEY (preposition_item_id, topic_id)
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preposition_item_id INTEGER REFERENCES preposition_items(id),
    sentence_it TEXT,
    sentence_es TEXT,
    context TEXT,
    cefr TEXT
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_contrasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_item_id INTEGER REFERENCES preposition_items(id),
    second_item_id INTEGER REFERENCES preposition_items(id),
    explanation TEXT,
    example_first_it TEXT,
    example_first_es TEXT,
    example_second_it TEXT,
    example_second_es TEXT
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_verb_government (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verb TEXT,
    preposition TEXT,
    construction TEXT UNIQUE,
    example_it TEXT,
    example_es TEXT,
    cefr TEXT,
    notes TEXT
  )`); } catch (_) {}

  // ── Seed preposition_topics ───────────────────────────────────────────────────
  const insTopic = db.prepare(`INSERT OR IGNORE INTO preposition_topics(slug,name_it,name_es,display_order,cefr_min) VALUES(?,?,?,?,?)`);
  [
    ['preposizioni_semplici',   'Preposizioni semplici',     'Preposiciones simples',        1, 'A1'],
    ['preposizioni_articolate', 'Preposizioni articolate',   'Preposiciones articuladas',    2, 'A1'],
    ['luogo_e_movimento',       'Luogo e movimento',         'Lugar y movimiento',           3, 'A2'],
    ['tempo',                   'Tempo',                     'Tiempo',                       4, 'A1'],
    ['causa_scopo_mezzo',       'Causa, scopo e mezzo',      'Causa, fin y medio',           5, 'A2'],
    ['confronto_riferimento',   'Confronto e riferimento',   'Comparación y referencia',     6, 'B1'],
    ['contrasto_esclusione',    'Contrasto ed esclusione',   'Contraste y exclusión',        7, 'B1'],
  ].forEach(([slug, name_it, name_es, order, cefr_min]) => insTopic.run(slug, name_it, name_es, order, cefr_min));

  // ── Add missing articulated prepositions (dall', sull') ──────────────────────
  if (prepCatId) {
    const now3 = Math.floor(Date.now()/1000);
    const missingPreps2 = [
      ["dall' (da + l')", 'de la / del',       'A1', "Vengo dall'aeroporto.", 'Vengo del aeropuerto.',               "da + l' (davanti a vocale)"],
      ["sull' (su + l')", 'en el / sobre el',  'A1', "Il gatto è sull'armadio.", 'El gato está encima del armario.', "su + l' (davanti a vocale)"],
    ];
    const insW2 = db.prepare(`INSERT OR IGNORE INTO vocabulary_items(italian,spanish,category_id,word_type,example_it,example_es,cefr_level,notes,collocations) VALUES(?,?,?,?,?,?,?,?,?)`);
    const insF2 = db.prepare(`INSERT OR IGNORE INTO flashcards(vocabulary_id,front,back,direction,category_id,next_review) VALUES(?,?,?,?,?,?)`);
    missingPreps2.forEach(([it, es, lv, ex_it, ex_es, notes]) => {
      const r = insW2.run(it, es, prepCatId, 'other', ex_it, ex_es, lv, notes, '[]');
      if (r.lastInsertRowid) insF2.run(r.lastInsertRowid, it, es, 'it-es', prepCatId, now3);
    });

    // ── Linguistic fixes (Phase 4, idempotent) ───────────────────────────────
    const fixN  = db.prepare(`UPDATE vocabulary_items SET notes=?      WHERE italian=? AND category_id=? AND notes != ?`);
    const fixEs = db.prepare(`UPDATE vocabulary_items SET spanish=?    WHERE italian=? AND category_id=? AND spanish != ?`);
    const fixEX = db.prepare(`UPDATE vocabulary_items SET example_es=? WHERE italian=? AND category_id=? AND example_es != ?`);

    // 1. fra
    const fraNote = '"Fra" e "tra" hanno lo stesso significato e sono generalmente intercambiabili. La scelta dipende spesso dall\'eufonia: "tra fratelli" (preferito), "fra tre giorni" (preferito).';
    fixN.run(fraNote, 'fra', prepCatId, fraNote);

    // 2. col
    const colNote = 'col e coi sono contrazioni accettate di con il e con i, comuni nel parlato. Le altre contrazioni di "con" (colla, collo, cogli, colle) sono rare o letterarie e non si insegnano come forme produttive moderne.';
    fixN.run(colNote, 'col (con + il)', prepCatId, colNote);

    // 3. coi
    const coiNote = 'Contrazione accettata di "con i". Meno frequente di "con i" nel parlato contemporaneo. "Gioco coi bambini" = "Gioco con i bambini".';
    fixN.run(coiNote, 'coi (con + i)', prepCatId, coiNote);

    // 4. in base a — spanish and example_es
    fixEs.run('basándose en / según / con base en', 'in base a', prepCatId, 'basándose en / según / con base en');
    fixEX.run('Decidimos según los resultados.', 'in base a', prepCatId, 'Decidimos según los resultados.');

    // 5. secondo — example_es
    fixEX.run('En mi opinión, estás equivocado.', 'secondo', prepCatId, 'En mi opinión, estás equivocado.');

    // 6. entro — spanish and notes
    fixEs.run('a más tardar / antes de (plazo)', 'entro', prepCatId, 'a más tardar / antes de (plazo)');
    fixN.run('Indica un limite massimo di tempo (scadenza). Entro venerdì = a más tardar el viernes, no después del viernes.', 'entro', prepCatId, 'Indica un limite massimo di tempo (scadenza). Entro venerdì = a más tardar el viernes, no después del viernes.');

    // 7. dentro — notes
    fixN.run('Uso avverbiale: "Il gatto è dentro" (= adentro). Uso preposizionale: "dentro la scatola" o "dentro alla scatola". Entrambe le costruzioni sono corrette.', 'dentro', prepCatId, 'Uso avverbiale: "Il gatto è dentro" (= adentro). Uso preposizionale: "dentro la scatola" o "dentro alla scatola". Entrambe le costruzioni sono corrette.');

    // 8. dietro (a/di) — notes
    fixN.run('Con sostantivi: "dietro la porta" (più comune) o "dietro alla porta". Con pronomi personali si usa "dietro di": "dietro di me", "dietro di te". Il lemma include le varianti costruttive.', 'dietro (a/di)', prepCatId, 'Con sostantivi: "dietro la porta" (più comune) o "dietro alla porta". Con pronomi personali si usa "dietro di": "dietro di me", "dietro di te". Il lemma include le varianti costruttive.');

    // 9. fuori (da) — notes
    fixN.run('Uso avverbiale: "Sono fuori" (= estoy afuera). Uso preposizionale: "fuori dalla porta", "fuori città" (senza preposizione in locuzioni fisse).', 'fuori (da)', prepCatId, 'Uso avverbiale: "Sono fuori" (= estoy afuera). Uso preposizionale: "fuori dalla porta", "fuori città" (senza preposizione in locuzioni fisse).');

    // 10. prima (di) — notes
    fixN.run('Con sostantivo o infinito: "prima di cena", "prima di uscire". Con frase verbale: "prima che arrivi" (+ congiuntivo). Non: *prima che + indicativo nelle frasi standard.', 'prima (di)', prepCatId, 'Con sostantivo o infinito: "prima di cena", "prima di uscire". Con frase verbale: "prima che arrivi" (+ congiuntivo). Non: *prima che + indicativo nelle frasi standard.');

    // 11. dopo — notes
    fixN.run('Con sostantivo: "dopo cena". Con infinito passato: "dopo aver mangiato". Con frase: "dopo che sei partito" (+ indicativo). Non confondere con "prima che" che richiede il congiuntivo.', 'dopo', prepCatId, 'Con sostantivo: "dopo cena". Con infinito passato: "dopo aver mangiato". Con frase: "dopo che sei partito" (+ indicativo). Non confondere con "prima che" che richiede il congiuntivo.');

    // 12. durante — notes
    fixN.run('Introduce normalmente un sostantivo: "durante il film", "durante la notte". Non equivale a "mientras" nel senso di simultaneità con verbo: usare "mentre" per quello.', 'durante', prepCatId, 'Introduce normalmente un sostantivo: "durante il film", "durante la notte". Non equivale a "mientras" nel senso di simultaneità con verbo: usare "mentre" per quello.');
  }

  // ── Seed preposition_items classification ─────────────────────────────────────
  if (prepCatId) {
    const getTopicId4   = db.prepare(`SELECT id FROM preposition_topics WHERE slug=?`);
    const getVocabByIt4 = db.prepare(`SELECT id, cefr_level FROM vocabulary_items WHERE italian=? AND category_id=?`);
    const insPrepItem4  = db.prepare(`INSERT OR IGNORE INTO preposition_items(vocabulary_item_id,canonical_form,item_type,primary_topic_id,cefr) VALUES(?,?,?,?,?)`);
    const insPrepTopic4 = db.prepare(`INSERT OR IGNORE INTO preposition_item_topics(preposition_item_id,topic_id,is_primary) VALUES(?,?,?)`);
    const getPrepItemId4 = db.prepare(`SELECT id FROM preposition_items WHERE vocabulary_item_id=?`);

    const seedPrepItem = (itForm, canonical, item_type, primarySlug, secondarySlugs = []) => {
      const vocab = getVocabByIt4.get(itForm, prepCatId);
      if (!vocab) return;
      const topicRow = getTopicId4.get(primarySlug);
      if (!topicRow) return;
      insPrepItem4.run(vocab.id, canonical, item_type, topicRow.id, vocab.cefr_level);
      const itemRow = getPrepItemId4.get(vocab.id);
      if (!itemRow) return;
      insPrepTopic4.run(itemRow.id, topicRow.id, 1);
      secondarySlugs.forEach(slug => {
        const secRow = getTopicId4.get(slug);
        if (secRow) insPrepTopic4.run(itemRow.id, secRow.id, 0);
      });
    };

    const seedAllPrepItems = db.transaction(() => {
      // Simple prepositions
      seedPrepItem('di',         'di',         'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('a',          'a',           'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('da',         'da',          'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('in',         'in',          'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('con',        'con',         'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('su',         'su',          'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('per',        'per',         'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('tra',        'tra',         'preposizione_semplice',       'preposizioni_semplici', ['tempo']);
      seedPrepItem('fra',        'fra',         'preposizione_semplice',       'preposizioni_semplici', ['tempo']);
      seedPrepItem('senza',      'senza',       'preposizione_semplice',       'preposizioni_semplici');
      seedPrepItem('insieme a',  'insieme a',   'locuzione_preposizionale',    'preposizioni_semplici');
      // di articolate
      seedPrepItem('del (di + il)',    'del',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dello (di + lo)',  'dello',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('della (di + la)',  'della',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem("dell' (di + l')", "dell'",  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dei (di + i)',     'dei',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('degli (di + gli)', 'degli', 'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('delle (di + le)', 'delle',  'preposizione_articolata',    'preposizioni_articolate');
      // a articolate
      seedPrepItem('al (a + il)',      'al',     'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('allo (a + lo)',    'allo',   'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('alla (a + la)',    'alla',   'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem("all' (a + l')",   "all'",   'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('ai (a + i)',       'ai',     'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('agli (a + gli)',   'agli',   'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('alle (a + le)',    'alle',   'preposizione_articolata',    'preposizioni_articolate');
      // da articolate
      seedPrepItem('dal (da + il)',    'dal',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dallo (da + lo)', 'dallo',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dalla (da + la)', 'dalla',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem("dall' (da + l')", "dall'",  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dai (da + i)',     'dai',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dagli (da + gli)', 'dagli', 'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('dalle (da + le)', 'dalle',  'preposizione_articolata',    'preposizioni_articolate');
      // in articolate
      seedPrepItem('nel (in + il)',    'nel',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('nello (in + lo)', 'nello',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('nella (in + la)', 'nella',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem("nell' (in + l')", "nell'",  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('nei (in + i)',     'nei',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('negli (in + gli)', 'negli', 'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('nelle (in + le)', 'nelle',  'preposizione_articolata',    'preposizioni_articolate');
      // su articolate
      seedPrepItem('sul (su + il)',    'sul',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('sullo (su + lo)', 'sullo',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('sulla (su + la)', 'sulla',  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem("sull' (su + l')", "sull'",  'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('sui (su + i)',     'sui',    'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('sugli (su + gli)', 'sugli', 'preposizione_articolata',    'preposizioni_articolate');
      seedPrepItem('sulle (su + le)', 'sulle',  'preposizione_articolata',    'preposizioni_articolate');
      // con contractions
      seedPrepItem('col (con + il)',   'col',    'forma_contratta',            'preposizioni_articolate');
      seedPrepItem('coi (con + i)',    'coi',    'forma_contratta',            'preposizioni_articolate');
      // Spatial
      seedPrepItem('sopra',           'sopra',         'avverbio_o_locuzione_spaziale', 'luogo_e_movimento');
      seedPrepItem('sotto',           'sotto',         'avverbio_o_locuzione_spaziale', 'luogo_e_movimento');
      seedPrepItem('davanti a',       'davanti a',     'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('dietro (a/di)',   'dietro',        'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('vicino a',        'vicino a',      'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('lontano da',      'lontano da',    'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('dentro',          'dentro',        'avverbio_o_locuzione_spaziale', 'luogo_e_movimento');
      seedPrepItem('fuori (da)',      'fuori',         'avverbio_o_locuzione_spaziale', 'luogo_e_movimento');
      seedPrepItem('lungo',           'lungo',         'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('verso',           'verso',         'preposizione_semplice',         'luogo_e_movimento');
      seedPrepItem('contro',          'contro',        'preposizione_semplice',         'luogo_e_movimento');
      seedPrepItem('attraverso',      'attraverso',    'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('oltre',           'oltre',         'locuzione_preposizionale',      'luogo_e_movimento', ['contrasto_esclusione']);
      seedPrepItem('in mezzo a',      'in mezzo a',    'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('di fronte a',     'di fronte a',   'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('accanto a',       'accanto a',     'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('a fianco di',     'a fianco di',   'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('in cima a',       'in cima a',     'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('in fondo a',      'in fondo a',    'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('nei pressi di',   'nei pressi di', 'locuzione_preposizionale',      'luogo_e_movimento');
      seedPrepItem('al di là di',     'al di là di',   'locuzione_preposizionale',      'luogo_e_movimento', ['confronto_riferimento']);
      seedPrepItem('al di sopra di',  'al di sopra di','espressione_di_confronto',      'confronto_riferimento', ['luogo_e_movimento']);
      seedPrepItem('al di sotto di',  'al di sotto di','espressione_di_confronto',      'confronto_riferimento', ['luogo_e_movimento']);
      // Temporal
      seedPrepItem('durante',         'durante',       'espressione_temporale',         'tempo');
      seedPrepItem('dopo',            'dopo',          'espressione_temporale',         'tempo');
      seedPrepItem('prima (di)',      'prima',         'espressione_temporale',         'tempo');
      seedPrepItem('fino a',          'fino a',        'espressione_temporale',         'tempo');
      seedPrepItem('entro',           'entro',         'espressione_temporale',         'tempo');
      seedPrepItem('a partire da',    'a partire da',  'espressione_temporale',         'tempo');
      // Causa, scopo, mezzo
      seedPrepItem('grazie a',        'grazie a',      'espressione_di_causa',          'causa_scopo_mezzo');
      seedPrepItem('a causa di',      'a causa di',    'espressione_di_causa',          'causa_scopo_mezzo');
      seedPrepItem('in seguito a',    'in seguito a',  'espressione_di_causa',          'causa_scopo_mezzo');
      seedPrepItem('per via di',      'per via di',    'espressione_di_causa',          'causa_scopo_mezzo');
      seedPrepItem('a condizione di', 'a condizione di','espressione_di_scopo',         'causa_scopo_mezzo');
      seedPrepItem('allo scopo di',   'allo scopo di', 'espressione_di_scopo',          'causa_scopo_mezzo');
      seedPrepItem('per mezzo di',    'per mezzo di',  'espressione_di_mezzo',          'causa_scopo_mezzo');
      // Confronto, riferimento
      seedPrepItem('rispetto a',      'rispetto a',    'espressione_di_confronto',      'confronto_riferimento');
      seedPrepItem('in base a',       'in base a',     'espressione_di_confronto',      'confronto_riferimento');
      seedPrepItem('a differenza di', 'a differenza di','espressione_di_confronto',     'confronto_riferimento');
      seedPrepItem('a proposito di',  'a proposito di','locuzione_preposizionale',      'confronto_riferimento');
      seedPrepItem('in quanto a',     'in quanto a',   'locuzione_preposizionale',      'confronto_riferimento');
      seedPrepItem('nei confronti di','nei confronti di','espressione_di_confronto',    'confronto_riferimento');
      seedPrepItem('secondo',         'secondo',       'preposizione_semplice',         'confronto_riferimento');
      seedPrepItem('circa',           'circa',         'locuzione_preposizionale',      'confronto_riferimento');
      seedPrepItem('in favore di',    'in favore di',  'locuzione_preposizionale',      'confronto_riferimento');
      // Contrasto, esclusione
      seedPrepItem('nonostante',      'nonostante',    'locuzione_preposizionale',      'contrasto_esclusione');
      seedPrepItem('invece di',       'invece di',     'espressione_di_esclusione',     'contrasto_esclusione');
      seedPrepItem('tranne',          'tranne',        'espressione_di_esclusione',     'contrasto_esclusione');
      seedPrepItem('eccetto',         'eccetto',       'espressione_di_esclusione',     'contrasto_esclusione');
      seedPrepItem('salvo',           'salvo',         'espressione_di_esclusione',     'contrasto_esclusione');
      seedPrepItem('ad eccezione di', 'ad eccezione di','espressione_di_esclusione',   'contrasto_esclusione');
    });
    seedAllPrepItems();
  }

  // ── Seed preposition_verb_government ─────────────────────────────────────────
  const insVerbGov = db.prepare(`INSERT OR IGNORE INTO preposition_verb_government(verb,preposition,construction,example_it,example_es,cefr) VALUES(?,?,?,?,?,?)`);
  [
    ['cominciare',    'a',   'cominciare a + inf',       'Comincio a studiare.',                   'Empiezo a estudiar.',                'A2'],
    ['iniziare',      'a',   'iniziare a + inf',         'Inizio a lavorare.',                     'Empiezo a trabajar.',                'A2'],
    ['riuscire',      'a',   'riuscire a + inf',         'Non riesco a dormire.',                  'No logro dormir.',                   'B1'],
    ['continuare',    'a',   'continuare a + inf',       'Continua a parlare.',                    'Sigue hablando.',                    'A2'],
    ['imparare',      'a',   'imparare a + inf',         'Sto imparando a cucinare.',              'Estoy aprendiendo a cocinar.',       'A2'],
    ['abituarsi',     'a',   'abituarsi a + inf/sost',   'Mi abituo al freddo.',                   'Me acostumbro al frío.',             'B1'],
    ['pensare',       'a',   'pensare a + sost',         'Penso a te.',                            'Pienso en ti.',                      'A2'],
    ['tenere',        'a',   'tenere a + inf/sost',      'Tiene molto alla famiglia.',             'Le importa mucho la familia.',       'B1'],
    ['smettere',      'di',  'smettere di + inf',        'Smetti di fumare.',                      'Deja de fumar.',                     'B1'],
    ['decidere',      'di',  'decidere di + inf',        'Ha deciso di partire.',                  'Ha decidido partir.',                'B1'],
    ['cercare',       'di',  'cercare di + inf',         'Cerco di capire.',                       'Intento entender.',                  'B1'],
    ['finire',        'di',  'finire di + inf',          'Finisco di lavorare alle sei.',          'Termino de trabajar a las seis.',    'A2'],
    ['avere bisogno', 'di',  'avere bisogno di + sost',  'Ho bisogno di aiuto.',                   'Necesito ayuda.',                    'A2'],
    ['dimenticarsi',  'di',  'dimenticarsi di + inf',    'Mi sono dimenticato di chiamare.',       'Me olvidé de llamar.',               'B1'],
    ['dipendere',     'da',  'dipendere da + sost',      'Dipende da te.',                         'Depende de ti.',                     'B1'],
    ['parlare',       'di',  'parlare di + sost',        'Parliamo di calcio.',                    'Hablamos de fútbol.',                'A1'],
    ['parlare',       'con', 'parlare con + sost',       'Parlo con Marco.',                       'Hablo con Marco.',                   'A1'],
    ['chiedere',      'a',   'chiedere a + persona',     'Chiedo al professore.',                  'Le pregunto al profesor.',           'A1'],
    ['credere',       'in',  'credere in + sost',        'Credo in te.',                           'Creo en ti.',                        'B1'],
    ['ringraziare',   'per', 'ringraziare per + sost',   "Ti ringrazio per l'aiuto.",              'Te agradezco la ayuda.',             'A2'],
  ].forEach(([verb, prep, constr, ex_it, ex_es, cefr]) => insVerbGov.run(verb, prep, constr, ex_it, ex_es, cefr));

  // ── Seed preposition_contrasts ────────────────────────────────────────────────
  // Deduplicate preposition_contrasts (prevents duplicates from multiple createSchema() calls)
  try {
    db.exec(`DELETE FROM preposition_contrasts WHERE id NOT IN (SELECT MIN(id) FROM preposition_contrasts GROUP BY first_item_id, second_item_id)`);
  } catch (_) {}
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_prep_contrasts_pair ON preposition_contrasts(first_item_id, second_item_id)`);
  } catch (_) {}

  if (prepCatId) {
    const getItemByCanon4 = db.prepare(`SELECT pi.id FROM preposition_items pi JOIN vocabulary_items vi ON vi.id=pi.vocabulary_item_id WHERE pi.canonical_form=? AND vi.category_id=? LIMIT 1`);
    const insContrast4 = db.prepare(`INSERT OR IGNORE INTO preposition_contrasts(first_item_id,second_item_id,explanation,example_first_it,example_first_es,example_second_it,example_second_es) VALUES(?,?,?,?,?,?,?)`);
    [
      ['a', 'in',
       'Con luoghi: "a" si usa con città e piccole isole, "in" con regioni, paesi, continenti e ambienti.',
       'Vado a Roma.', 'Voy a Roma.',
       'Vivo in Italia.', 'Vivo en Italia.'],
      ['da', 'di',
       '"Da" indica provenienza o punto di partenza, "di" indica appartenenza o materia.',
       'Vengo da Parigi.', 'Vengo de París.',
       'Il libro è di Marco.', 'El libro es de Marco.'],
      ['tra', 'in',
       '"Tra" esprime distanza temporale futura ("tra due ore"), "in" esprime durata ("in un\'ora").',
       'Arrivo tra due ore.', 'Llego dentro de dos horas.',
       "Lo studio in un'ora.", 'Lo estudio en una hora.'],
      ['grazie a', 'a causa di',
       '"Grazie a" introduce una causa positiva, "a causa di" introduce una causa negativa.',
       "Grazie a te ho superato l'esame.", 'Gracias a ti aprobé el examen.',
       'Il volo è cancellato a causa dello sciopero.', 'El vuelo está cancelado a causa de la huelga.'],
      ['vicino a', 'nei pressi di',
       '"Vicino a" è colloquiale e comune, "nei pressi di" è più formale e indica prossimità geografica precisa.',
       'Abito vicino alla stazione.', 'Vivo cerca de la estación.',
       "L'hotel è nei pressi della stazione.", 'El hotel está en las inmediaciones de la estación.'],
    ].forEach(([c1, c2, expl, e1it, e1es, e2it, e2es]) => {
      const item1 = getItemByCanon4.get(c1, prepCatId);
      const item2 = getItemByCanon4.get(c2, prepCatId);
      if (item1 && item2) insContrast4.run(item1.id, item2.id, expl, e1it, e1es, e2it, e2es);
    });
  }

  // ── Phase 4B: exercise tables ─────────────────────────────────────────────────
  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_exercises (
    id TEXT PRIMARY KEY,
    exercise_type TEXT NOT NULL,
    topic_slug TEXT NOT NULL,
    cefr TEXT DEFAULT 'A1',
    sentence_it TEXT NOT NULL,
    sentence_es TEXT,
    correct_answers TEXT NOT NULL DEFAULT '[]',
    accepted_variants TEXT DEFAULT '[]',
    distractors TEXT DEFAULT '[]',
    explanation_it TEXT,
    explanation_es TEXT,
    contrast_slug TEXT,
    reggenza_id INTEGER,
    difficulty INTEGER DEFAULT 1,
    needs_review INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_prep_exercises_topic ON preposition_exercises(topic_slug);
  CREATE INDEX IF NOT EXISTS idx_prep_exercises_cefr ON preposition_exercises(cefr);`); } catch (_) {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_topic_stats (
    topic_slug TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default',
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    almost_correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    last_attempted INTEGER,
    streak INTEGER DEFAULT 0,
    mastery_level TEXT DEFAULT 'nuovo',
    PRIMARY KEY (topic_slug, user_id)
  )`); } catch (_) {}
  // idempotent column addition for duplicate-attempt guard
  try { db.exec(`ALTER TABLE preposition_topic_stats ADD COLUMN last_attempt_id TEXT`); } catch (_) {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS preposition_error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id TEXT REFERENCES preposition_exercises(id),
    topic_slug TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    cefr TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    evaluation_status TEXT,
    error_type TEXT,
    explanation TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`); } catch (_) {}

  // ── Phase 4B: seed exercises (INSERT OR REPLACE so corrections can be applied) ─
  const exercises = [
    // Mode 1: fill_preposition (15)
    ['prep_s_001', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Vivo ___ Roma.', 'Vivo en Roma.', '["a"]', '[]', '["in","da","di"]', 'Con i nomi di città si usa "a": a Roma, a Milano, a Parigi.', 'Con nombres de ciudad se usa "a".', 1],
    ['prep_s_002', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Vivo ___ Italia.', 'Vivo en Italia.', '["in"]', '[]', '["a","da","di"]', 'Con i nomi di paesi e regioni si usa "in": in Italia, in Francia, in Toscana.', 'Con nombres de países se usa "in".', 1],
    ['prep_s_003', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Sono ___ Madrid.', 'Soy de Madrid.', '["di"]', '[]', '["da","a","in"]', '"Di" indica l\'origine o la provenienza stabile: sono di Madrid = soy de Madrid (origen).', 'Para origen se usa "di".', 1],
    ['prep_s_004', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Vengo ___ Madrid.', 'Vengo de Madrid.', '["da"]', '[]', '["di","a","in"]', '"Da" indica provenienza come movimento: vengo da Madrid = vengo de Madrid (movimiento). "Di" indica origine stabile (sono di Madrid).', '"Da" expresa movimiento desde un lugar.', 2],
    ['prep_s_005', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Questo regalo è ___ te.', 'Este regalo es para ti.', '["per"]', '[]', '["a","di","con"]', '"Per" indica il destinatario: questo è per te.', '"Per" indica el destinatario.', 1],
    ['prep_s_006', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Arrivo ___ due ore.', 'Llego en dos horas (desde ahora).', '["tra","fra"]', '[]', '["in","da","per"]', '"Tra/fra + tempo" = dentro de X tiempo (a partir de ahora). "In due ore" = en dos horas (tiempo necesario para completarlo).', '"Tra/fra" = dentro de (tiempo futuro). No confundir con "in".', 2],
    ['prep_s_007', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Studio italiano ___ due ore.', 'Estudio italiano durante dos horas.', '["per"]', '[]', '["da","tra","in"]', '"Per + durata" indica per quanto tempo dura un\'azione: studio per due ore.', '"Per" indica duración.', 1],
    ['prep_s_008', 'fill_preposition', 'preposizioni_semplici', 'A2', 'Studio italiano ___ due anni.', 'Estudio italiano desde hace dos años.', '["da"]', '[]', '["per","tra","in"]', '"Da + tempo" con il presente indica azione iniziata nel passato e ancora in corso: studio da due anni = llevo dos años estudiando.', '"Da" con presente = desde hace X tiempo.', 2],
    ['prep_s_009', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Vado ___ treno.', 'Voy en tren.', '["in"]', '[]', '["con","a","per"]', 'Con i mezzi di trasporto si usa spesso "in": in treno, in macchina, in aereo. Eccezione: a piedi, a cavallo.', 'Con medios de transporte se usa "in".', 1],
    ['prep_s_010', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Il libro è ___ tavolo.', 'El libro está en/sobre la mesa.', '["sul"]', '["su il","su"]', '["nel","del","al"]', 'Con articolo: su + il = sul. "Sul" indica posizione sopra una superficie.', '"Su + il = sul".', 1],
    ['prep_s_011', 'fill_preposition', 'preposizioni_semplici', 'A2', 'Vado ___ medico.', 'Voy al médico.', '["dal"]', '["da il","da"]', '["al","nel","del"]', '"Da + professionista" indica andare presso quella persona: vado dal medico, dal dentista, dal dottore.', '"Da + profesional" = ir a donde está esa persona.', 2],
    ['prep_s_012', 'fill_preposition', 'preposizioni_semplici', 'A1', 'Parlo ___ calcio.', 'Hablo de fútbol.', '["di"]', '[]', '["su","con","per"]', '"Di" introduce l\'argomento di cui si parla.', '"Di" introduce el tema.', 1],
    ['prep_s_013', 'fill_preposition', 'preposizioni_semplici', 'A2', 'Cammino ___ la piazza.', 'Camino hacia la plaza.', '["verso"]', '[]', '["a","per","fino a"]', '"Verso" indica direzione approssimativa: verso = hacia.', '"Verso" = hacia (dirección aproximada).', 1],
    ['prep_s_014', 'fill_preposition', 'preposizioni_semplici', 'A2', 'Lavoro ___ le sei.', 'Trabajo hasta las seis.', '["fino a","fino alle"]', '["fino"]', '["per","tra","entro"]', '"Fino a" indica limite temporale o spaziale: lavoro fino alle sei.', '"Fino a" = hasta.', 1],
    ['prep_s_015', 'fill_preposition', 'preposizioni_semplici', 'B1', 'Riesco ___ capire.', 'Logro entender.', '["a"]', '[]', '["di","in","per"]', '"Riuscire a + infinito" è una reggenza verbale: riuscire a = lograr.', 'Reggenza: riuscire a + infinitivo.', 2],
    // Mode 2: articolate_form (15)
    ['prep_a_001', 'articolate_form', 'preposizioni_articolate', 'A1', 'a + lo = ___', null, '["allo"]', '[]', '["al","alla","agli"]', 'a + lo = allo. "Lo" si usa con parole che iniziano per s+consonante, z, gn, ps, x, y.', 'a + lo = allo', 1],
    ['prep_a_002', 'articolate_form', 'preposizioni_articolate', 'A1', 'di + gli = ___', null, '["degli"]', '[]', '["dei","delle","del"]', 'di + gli = degli. "Gli" si usa al plurale come "lo" al singolare.', 'di + gli = degli', 1],
    ['prep_a_003', 'articolate_form', 'preposizioni_articolate', 'A1', "da + l' = ___", null, '["dall\'"]', '[]', '["dal","dalla","dagli"]', "da + l' = dall'. L'apostrofo indica una vocale iniziale.", "da + l' = dall'", 1],
    ['prep_a_004', 'articolate_form', 'preposizioni_articolate', 'A1', "su + l' = ___", null, '["sull\'"]', '[]', '["sul","sulla","sugli"]', "su + l' = sull'.", "su + l' = sull'", 1],
    ['prep_a_005', 'articolate_form', 'preposizioni_articolate', 'A1', 'in + le = ___', null, '["nelle"]', '[]', '["nello","nella","nei"]', 'in + le = nelle. Femminile plurale.', 'in + le = nelle', 1],
    ['prep_a_006', 'articolate_form', 'preposizioni_articolate', 'A1', 'delle = di + ___', null, '["le"]', '[]', '["gli","la","i"]', 'delle = di + le. Femminile plurale.', 'delle = di + le', 1],
    ['prep_a_007', 'articolate_form', 'preposizioni_articolate', 'A1', 'agli = a + ___', null, '["gli"]', '[]', '["i","lo","le"]', 'agli = a + gli. Maschile plurale (davanti a vocale, s+cons, z…).', 'agli = a + gli', 1],
    ['prep_a_008', 'articolate_form', 'preposizioni_articolate', 'A1', 'nel = ___ + il', null, '["in"]', '[]', '["su","di","a"]', 'nel = in + il. La preposizione base è "in".', 'nel = in + il', 1],
    ['prep_a_009', 'articolate_form', 'preposizioni_articolate', 'A1', 'sulla = su + ___', null, '["la"]', '[]', '["il","lo","le"]', 'sulla = su + la. Femminile singolare.', 'sulla = su + la', 1],
    ['prep_a_010', 'articolate_form', 'preposizioni_articolate', 'A1', 'dai = da + ___', null, '["i"]', '[]', '["gli","il","lo"]', 'dai = da + i. Maschile plurale regolare.', 'dai = da + i', 1],
    ['prep_a_011', 'articolate_form', 'preposizioni_articolate', 'A1', "nell' = ___ + l'", null, '["in"]', '[]', '["su","a","da"]', "nell' = in + l'. Davanti a vocale.", "nell' = in + l'", 1],
    ['prep_a_012', 'articolate_form', 'preposizioni_articolate', 'A1', 'sui = ___ + i', null, '["su"]', '[]', '["di","a","da"]', 'sui = su + i. Maschile plurale.', 'sui = su + i', 1],
    ['prep_a_013', 'articolate_form', 'preposizioni_articolate', 'A2', "dall' si usa con parole che iniziano per ___", null, '["vocale","una vocale"]', '[]', '["consonante","s","z"]', "dall' = da + l'. L'apostrofo sostituisce l'articolo \"lo/la/il\" davanti a vocale.", "dall' se usa antes de vocal.", 2],
    ['prep_a_014', 'articolate_form', 'preposizioni_articolate', 'A2', 'col = con + ___', null, '["il"]', '[]', '["lo","la","i"]', 'col = con + il. Contrazione accettata, comune nel parlato. "Con il" è altrettanto corretto.', 'col = con + il (contracción aceptada).', 2],
    ['prep_a_015', 'articolate_form', 'preposizioni_articolate', 'A2', 'negli = in + ___', null, '["gli"]', '[]', '["i","le","lo"]', 'negli = in + gli. Maschile plurale (davanti a vocale o consonanti speciali).', 'negli = in + gli', 1],
    // Mode 3: contrast (12)
    ['prep_c_001', 'contrast', 'luogo_e_movimento', 'A1', 'Vado ___ Italia.', 'Voy a Italia.', '["in"]', '[]', '["a","da","di"]', 'Con i nomi di paesi si usa "in": in Italia, in Spagna. Con le città si usa "a": a Roma, a Milano.', 'Países: "in". Ciudades: "a".', 1],
    ['prep_c_002', 'contrast', 'luogo_e_movimento', 'A1', 'Vado ___ Roma.', 'Voy a Roma.', '["a"]', '[]', '["in","da","di"]', 'Con le città si usa "a": a Roma, a Parigi. Con i paesi si usa "in": in Italia.', 'Ciudades: "a". Países: "in".', 1],
    ['prep_c_003', 'contrast', 'luogo_e_movimento', 'A2', 'Vado ___ scuola.', 'Voy a la escuela.', '["a"]', '[]', '["in","nella","alla"]', '"A scuola" è un\'espressione fissa (senza articolo). Analogamente: in ufficio, in banca, al cinema.', '"A scuola" es una expresión fija.', 2],
    ['prep_c_004', 'contrast', 'tempo', 'A2', 'Arrivo ___ due ore.', 'Llego dentro de dos horas (a partir de ahora).', '["tra","fra"]', '[]', '["in","per","da"]', '"Tra/fra due ore" = dentro de dos horas (en el futuro). "In due ore" = necesito dos horas para terminarlo.', '"Tra/fra" = dentro de X tiempo. "In" = en X tiempo (duración).', 2],
    ['prep_c_005', 'contrast', 'tempo', 'A2', 'Finisco ___ due ore.', 'Termino en dos horas (me lleva dos horas).', '["in"]', '[]', '["tra","fra","per"]', '"In due ore" = necesito dos horas para completarlo. "Tra due ore" = en dos horas a partir de ahora.', '"In" = tiempo necesario. "Tra/fra" = tiempo futuro.', 2],
    ['prep_c_006', 'contrast', 'preposizioni_semplici', 'A1', 'Sono ___ Madrid (origine stabile).', 'Soy de Madrid (origen).', '["di"]', '[]', '["da","a","in"]', '"Sono di Madrid" = soy de Madrid (origen permanente). "Vengo da Madrid" = vengo de Madrid (movimiento).', '"Di" = origen. "Da" = movimiento desde.', 2],
    ['prep_c_007', 'contrast', 'preposizioni_semplici', 'A1', 'Vengo ___ Madrid (movimento).', 'Vengo de Madrid (movimiento).', '["da"]', '[]', '["di","a","in"]', '"Vengo da Madrid" indica movimento da un luogo. "Sono di Madrid" indica origine stabile.', '"Da" = movimiento. "Di" = origen estable.', 2],
    ['prep_c_008', 'contrast', 'causa_scopo_mezzo', 'A2', 'Ho superato l\'esame ___ Marco.', 'Aprobé el examen gracias a Marco.', '["grazie a"]', '[]', '["a causa di","per via di","con"]', '"Grazie a" si usa per cause positive o favorevoli. "A causa di" si usa spesso per cause negative.', '"Grazie a" = causa favorable. "A causa di" = causa (generalmente negativa).', 2],
    ['prep_c_009', 'contrast', 'causa_scopo_mezzo', 'B1', 'Il volo è cancellato ___ dello sciopero.', 'El vuelo está cancelado a causa de la huelga.', '["a causa"]', '["a causa di"]', '["grazie a","per via","invece"]', '"A causa di" introduce una causa, spesso negativa. "Grazie a" introduce una causa positiva.', '"A causa di" para causas (generalmente) negativas.', 2],
    ['prep_c_010', 'contrast', 'luogo_e_movimento', 'A2', 'L\'hotel è ___ della stazione.', 'El hotel está cerca de la estación.', '["vicino a","vicino alla","nei pressi"]', '["nei pressi di"]', '["lontano da","davanti a","dietro"]', '"Vicino a" è informale. "Nei pressi di" è più formale o preciso.', '"Vicino a" = informal. "Nei pressi di" = formal/preciso.', 2],
    ['prep_c_011', 'contrast', 'preposizioni_semplici', 'B1', 'Ho studiato ___ un\'ora.', 'Estudié durante una hora.', '["per"]', '[]', '["da","tra","in"]', '"Per + durata" con passato prossimo indica per quanto tempo è durata l\'azione. Non "da" (che implica continuazione nel presente).', '"Per" = duración en el pasado. "Da" implica acción que continúa.', 2],
    ['prep_c_012', 'contrast', 'luogo_e_movimento', 'A2', 'Il libro è ___ tavolo.', 'El libro está sobre la mesa.', '["sul"]', '["su il","su"]', '["nel","del","nel"]', 'su + il = sul. Posizione sopra una superficie.', 'su + il = sul (sobre la mesa).', 1],
    // Mode 4: verb_government (10)
    ['prep_r_001', 'verb_government', 'preposizioni_semplici', 'A2', 'Comincio ___ studiare.', 'Empiezo a estudiar.', '["a"]', '[]', '["di","per","in"]', 'Reggenza: cominciare a + infinito.', 'Reggencia: cominciare a + infinitivo.', 1],
    ['prep_r_002', 'verb_government', 'preposizioni_semplici', 'B1', 'Smetto ___ fumare.', 'Dejo de fumar.', '["di"]', '[]', '["a","per","da"]', 'Reggenza: smettere di + infinito.', 'Reggencia: smettere di + infinitivo.', 1],
    ['prep_r_003', 'verb_government', 'preposizioni_semplici', 'B1', 'Ho bisogno ___ aiuto.', 'Necesito ayuda.', '["di"]', '[]', '["a","per","da"]', 'Reggenza: avere bisogno di + sostantivo.', 'Reggencia: avere bisogno di + sustantivo.', 1],
    ['prep_r_004', 'verb_government', 'preposizioni_semplici', 'B1', 'Dipende ___ te.', 'Depende de ti.', '["da"]', '[]', '["di","a","per"]', 'Reggenza: dipendere da + persona/cosa.', 'Reggencia: dipendere da + persona/cosa.', 1],
    ['prep_r_005', 'verb_government', 'preposizioni_semplici', 'B1', 'Non riesco ___ dormire.', 'No logro dormir.', '["a"]', '[]', '["di","per","in"]', 'Reggenza: riuscire a + infinito.', 'Reggencia: riuscire a + infinitivo.', 1],
    ['prep_r_006', 'verb_government', 'preposizioni_semplici', 'A2', 'Continuo ___ lavorare.', 'Sigo trabajando.', '["a"]', '[]', '["di","per","da"]', 'Reggenza: continuare a + infinito.', 'Reggencia: continuare a + infinitivo.', 1],
    ['prep_r_007', 'verb_government', 'preposizioni_semplici', 'B1', 'Mi sono dimenticato ___ chiamarti.', 'Me olvidé de llamarte.', '["di"]', '[]', '["a","da","per"]', 'Reggenza: dimenticarsi di + infinito.', 'Reggencia: dimenticarsi di + infinitivo.', 2],
    ['prep_r_008', 'verb_government', 'preposizioni_semplici', 'A2', 'Parlo ___ calcio.', 'Hablo de fútbol.', '["di"]', '[]', '["su","con","per"]', 'Reggenza: parlare di + argomento. Non "su" come in spagnolo.', 'Reggencia: parlare di. No usar "su".', 1],
    ['prep_r_009', 'verb_government', 'preposizioni_semplici', 'B1', 'Ti ringrazio ___ l\'aiuto.', 'Te agradezco la ayuda.', '["per"]', '[]', '["di","a","con"]', 'Reggenza: ringraziare per + cosa. Non "di".', 'Reggencia: ringraziare per + cosa.', 2],
    ['prep_r_010', 'verb_government', 'preposizioni_semplici', 'B1', 'Ho deciso ___ partire.', 'He decidido partir.', '["di"]', '[]', '["a","per","in"]', 'Reggenza: decidere di + infinito.', 'Reggencia: decidere di + infinitivo.', 1],
    // Mode 5: fill_locuzione (8)
    ['prep_l_001', 'fill_locuzione', 'causa_scopo_mezzo', 'B1', 'Il volo è cancellato ___ dello sciopero.', 'El vuelo está cancelado a causa de la huelga.', '["a causa"]', '["a causa di"]', '["grazie","per via","a seguito"]', 'La locuzione è "a causa di": a causa di + nome. Indica causa, spesso negativa.', '"A causa di" = a causa de.', 2],
    ['prep_l_002', 'fill_locuzione', 'causa_scopo_mezzo', 'A2', '___ a te ho superato l\'esame.', 'Gracias a ti aprobé el examen.', '["grazie"]', '["grazie a"]', '["a causa","in seguito","per via"]', 'La locuzione è "grazie a": grazie a + persona/cosa. Indica causa positiva.', '"Grazie a" = gracias a.', 1],
    ['prep_l_003', 'fill_locuzione', 'confronto_riferimento', 'B1', '___ a ieri fa più caldo.', 'En comparación con ayer hace más calor.', '["rispetto"]', '["rispetto a"]', '["a differenza","in base","in quanto"]', 'La locuzione è "rispetto a": rispetto a + termine di paragone.', '"Rispetto a" = en comparación con / respecto a.', 2],
    ['prep_l_004', 'fill_locuzione', 'contrasto_esclusione', 'B1', '___ la pioggia siamo usciti.', 'A pesar de la lluvia salimos.', '["nonostante"]', '[]', '["invece di","a causa di","grazie a"]', '"Nonostante + nome/pronome" indica concessione. Con verbo: nonostante sia tardi (+ congiuntivo).', '"Nonostante" = a pesar de.', 2],
    ['prep_l_005', 'fill_locuzione', 'contrasto_esclusione', 'B1', 'Vengono tutti ___ lui.', 'Vienen todos excepto él.', '["tranne","eccetto","salvo"]', '[]', '["invece di","grazie a","nonostante"]', '"Tranne", "eccetto" e "salvo" sono sinonimi: indicano esclusione. "Tranne" è il più comune nel parlato.', '"Tranne/eccetto/salvo" = excepto.', 1],
    ['prep_l_006', 'fill_locuzione', 'luogo_e_movimento', 'A2', 'Il bagno è ___ al corridoio.', 'El baño está al fondo del pasillo.', '["in fondo"]', '["in fondo a"]', '["in cima","di fronte","accanto"]', '"In fondo a" indica il punto più lontano o più basso. "In cima a" il punto più alto.', '"In fondo a" = al fondo de.', 2],
    ['prep_l_007', 'fill_locuzione', 'confronto_riferimento', 'B2', 'Decidiamo ___ ai risultati.', 'Decidimos según los resultados.', '["in base"]', '["in base a"]', '["rispetto","a differenza","in quanto"]', '"In base a" = según / basándose en. Preferire "in base a" o "secondo" rispetto al calco "en base a".', '"In base a" = según / basándose en.', 2],
    ['prep_l_008', 'fill_locuzione', 'causa_scopo_mezzo', 'B2', 'Studio ___ migliorare.', 'Estudio con el fin de mejorar.', '["allo scopo di","per"]', '[]', '["a causa di","grazie a","invece di"]', '"Allo scopo di + infinito" esprime finalità formale. "Per + infinito" è più comune e informale: studio per migliorare.', '"Allo scopo di" / "per" = con el fin de.', 2],
    // ── 20 new fill_preposition ────────────────────────────────────────────────
    ['prep_s_016','fill_preposition','preposizioni_semplici','A1','Abito ___ secondo piano.','Vivo en el segundo piso.','["al"]','["a il","a"]','["nel","del","sul"]','Con i piani si usa "al": al primo piano, al secondo piano.','Con los pisos se usa "al".',1],
    ['prep_s_017','fill_preposition','luogo_e_movimento','A1','Vado ___ scuola.','Voy a la escuela.','["a"]','[]','["in","nella","alla"]','"A scuola" è un\'espressione fissa (senza articolo) per indicare il luogo di studio.','\"A scuola\" sin artículo.',1],
    ['prep_s_018','fill_preposition','luogo_e_movimento','A1','Andiamo ___ spiaggia.','Vamos a la playa.','["in"]','["alla"]','["a","da","di"]','"In spiaggia" è l\'espressione più comune, ma "alla spiaggia" è accettata.','\"In spiaggia\" es lo más habitual.',1],
    ['prep_s_019','fill_preposition','preposizioni_semplici','A1','Questo libro è ___ Marco.','Este libro es de Marco.','["di"]','[]','["da","per","a"]','"Di" indica appartenenza: è il libro di Marco.','\"Di\" indica posesión.',1],
    ['prep_s_020','fill_preposition','preposizioni_semplici','A2','Vado ___ mia sorella.','Voy a casa de mi hermana.','["da"]','[]','["a","di","per"]','"Da + persona" indica andare a casa di quella persona o da quella persona.','\"Da + persona\" = ir a casa de.',2],
    ['prep_s_021','fill_preposition','luogo_e_movimento','A1','La farmacia è ___ angolo.','La farmacia está en la esquina.','["all\'","a l\'"]','["all\'angolo"]','["nell\'","sull\'","dall\'"]','"All\'angolo" (a + l\') indica posizione a un punto preciso.','\"All\'angolo\" = en la esquina.',1],
    ['prep_s_022','fill_preposition','preposizioni_semplici','A2','Parto ___ lunedì.','Salgo el lunes.','["lunedì","il lunedì","di lunedì"]','["lunedì","di lunedì"]','["a lunedì","da lunedì","in lunedì"]','Con i giorni della settimana non si usa preposizione: parto lunedì. Oppure: il lunedì (di abitudine).','Con días de la semana: sin preposición.',2],
    ['prep_s_023','fill_preposition','tempo','A1','Sono nato ___ 2001.','Nací en 2001.','["nel"]','["in"]','["al","del","sul"]','Con gli anni si usa "nel" (in + il): nel 2001, nel 1990. In alternativa "in" senza articolo.','Con años: \"nel\" o \"in\".',1],
    ['prep_s_024','fill_preposition','tempo','A1','La riunione è ___ tre.','La reunión es a las tres.','["alle"]','["a le"]','["delle","nell\'","ore"]','"Alle" (a + le) si usa con le ore: alle tre, alle cinque.','\"Alle\" para las horas.',1],
    ['prep_s_025','fill_preposition','tempo','A1','Andiamo in vacanza ___ agosto.','Nos vamos de vacaciones en agosto.','["ad","in"]','["a"]','["nel","di","per"]','Con i mesi si può usare "a" (ad agosto) o "in" (in agosto). Entrambe sono corrette.','Con meses: \"a/ad\" o \"in\".',1],
    ['prep_s_026','fill_preposition','causa_scopo_mezzo','A2','Vengo ___ macchina.','Vengo en coche.','["in"]','[]','["con","a","per"]','"In macchina" è l\'espressione standard per mezzo di trasporto privato. Eccezione: a piedi, a cavallo.','\"In macchina\" para el medio de transporte.',1],
    ['prep_s_027','fill_preposition','causa_scopo_mezzo','A2','Scrivo ___ penna.','Escribo con bolígrafo.','["con la","con"]','[]','["in","a","di"]','"Con + articolo" indica lo strumento: scrivo con la penna. Nel parlato spesso "con" senza articolo.','\"Con\" + artículo para el instrumento.',1],
    ['prep_s_028','fill_preposition','luogo_e_movimento','A2','Abito ___ centro.','Vivo en el centro.','["in"]','["nel"]','["al","a","di"]','"In centro" è l\'espressione più comune, usata senza articolo. "Nel centro" è più formale.','\"In centro\" sin artículo.',1],
    ['prep_s_029','fill_preposition','preposizioni_semplici','B1','Secondo me, dipende ___ te.','Según yo, depende de ti.','["da"]','[]','["di","a","per"]','Reggenza: dipendere da qualcuno/qualcosa.','Reggencia: dipendere da.',1],
    ['prep_s_030','fill_preposition','luogo_e_movimento','A2','Passiamo ___ via Roma.','Pasamos por la calle Roma.','["per"]','[]','["a","da","in"]','"Per" indica il passaggio attraverso un luogo.','\"Per\" = pasar por.',1],
    ['prep_s_031','fill_preposition','preposizioni_semplici','A1','Il caffè è ___ bar.','El café está en el bar.','["al"]','["a il"]','["nel","del","dal"]','"Al bar" (a + il): luogo fisso dove si va/si trova qualcosa.','\"Al bar\" = en el bar.',1],
    ['prep_s_032','fill_preposition','contrasto_esclusione','B1','___ Marco, vengono tutti.','Excepto Marco, vienen todos.','["tranne","eccetto","salvo"]','[]','["invece di","nonostante","grazie a"]','"Tranne/eccetto/salvo + nome" indica esclusione.','Tranne/eccetto/salvo = excepto.',1],
    ['prep_s_033','fill_preposition','tempo','A2','Lavoro qui ___ cinque anni.','Trabajo aquí desde hace cinco años.','["da"]','[]','["per","tra","in"]','"Da + numero + anni" con il presente indica azione iniziata nel passato e ancora in corso.','\"Da\" con presente = desde hace.',1],
    ['prep_s_034','fill_preposition','luogo_e_movimento','A1','Vado ___ banca.','Voy al banco.','["in"]','["alla"]','["al","a","da"]','"In banca" è l\'espressione più comune. "Alla banca" è usata ma meno frequente.','\"In banca\" sin artículo.',1],
    ['prep_s_035','fill_preposition','preposizioni_semplici','A2','Ho comprato un regalo ___ mia madre.','He comprado un regalo para mi madre.','["per"]','[]','["a","di","da"]','"Per" indica il destinatario di qualcosa: un regalo per te.','\"Per\" = para (destinatario).',1],
    // ── 35 new articolate_form ─────────────────────────────────────────────────
    ['prep_a_016','articolate_form','preposizioni_articolate','A1','a + il = ___',null,'["al"]','[]','["dal","nel","sul"]','a + il = al. Maschile singolare davanti a consonante normale.','a + il = al',1],
    ['prep_a_017','articolate_form','preposizioni_articolate','A1','a + la = ___',null,'["alla"]','[]','["dalla","nella","sulla"]','a + la = alla. Femminile singolare.','a + la = alla',1],
    ['prep_a_018','articolate_form','preposizioni_articolate','A1',"a + l' = ___",null,'["all\'"]','[]','["dall\'","nell\'","sull\'"]',"a + l' = all'. Davanti a vocale.","a + l' = all'",1],
    ['prep_a_019','articolate_form','preposizioni_articolate','A1','a + i = ___',null,'["ai"]','[]','["dai","nei","sui"]','a + i = ai. Maschile plurale.','a + i = ai',1],
    ['prep_a_020','articolate_form','preposizioni_articolate','A1','a + le = ___',null,'["alle"]','[]','["dalle","nelle","sulle"]','a + le = alle. Femminile plurale.','a + le = alle',1],
    ['prep_a_021','articolate_form','preposizioni_articolate','A1','di + il = ___',null,'["del"]','[]','["dal","nel","sul"]','di + il = del. Maschile singolare.','di + il = del',1],
    ['prep_a_022','articolate_form','preposizioni_articolate','A1','di + lo = ___',null,'["dello"]','[]','["allo","nello","sullo"]','di + lo = dello. Maschile singolare speciale (s+cons, z...).','di + lo = dello',1],
    ['prep_a_023','articolate_form','preposizioni_articolate','A1','di + la = ___',null,'["della"]','[]','["dalla","nella","sulla"]','di + la = della. Femminile singolare.','di + la = della',1],
    ['prep_a_024','articolate_form','preposizioni_articolate','A1',"di + l' = ___",null,'["dell\'"]','[]','["all\'","dall\'","nell\'"]',"di + l' = dell'. Davanti a vocale.","di + l' = dell'",1],
    ['prep_a_025','articolate_form','preposizioni_articolate','A1','di + i = ___',null,'["dei"]','[]','["dai","nei","sui"]','di + i = dei. Maschile plurale.','di + i = dei',1],
    ['prep_a_026','articolate_form','preposizioni_articolate','A1','da + il = ___',null,'["dal"]','[]','["del","nel","sul"]','da + il = dal. Maschile singolare.','da + il = dal',1],
    ['prep_a_027','articolate_form','preposizioni_articolate','A1','da + lo = ___',null,'["dallo"]','[]','["dello","nello","sullo"]','da + lo = dallo. Maschile singolare speciale.','da + lo = dallo',1],
    ['prep_a_028','articolate_form','preposizioni_articolate','A1','da + la = ___',null,'["dalla"]','[]','["della","nella","sulla"]','da + la = dalla. Femminile singolare.','da + la = dalla',1],
    ['prep_a_029','articolate_form','preposizioni_articolate','A1','da + gli = ___',null,'["dagli"]','[]','["degli","agli","negli"]','da + gli = dagli. Maschile plurale speciale.','da + gli = dagli',1],
    ['prep_a_030','articolate_form','preposizioni_articolate','A1','da + le = ___',null,'["dalle"]','[]','["delle","alle","nelle"]','da + le = dalle. Femminile plurale.','da + le = dalle',1],
    ['prep_a_031','articolate_form','preposizioni_articolate','A1','in + lo = ___',null,'["nello"]','[]','["dello","allo","sullo"]','in + lo = nello. Maschile singolare speciale.','in + lo = nello',1],
    ['prep_a_032','articolate_form','preposizioni_articolate','A1','in + la = ___',null,'["nella"]','[]','["della","dalla","sulla"]','in + la = nella. Femminile singolare.','in + la = nella',1],
    ['prep_a_033','articolate_form','preposizioni_articolate','A1','in + i = ___',null,'["nei"]','[]','["dei","dai","sui"]','in + i = nei. Maschile plurale.','in + i = nei',1],
    ['prep_a_034','articolate_form','preposizioni_articolate','A1','su + il = ___',null,'["sul"]','[]','["del","dal","nel"]','su + il = sul. Maschile singolare.','su + il = sul',1],
    ['prep_a_035','articolate_form','preposizioni_articolate','A1','su + lo = ___',null,'["sullo"]','[]','["dello","allo","nello"]','su + lo = sullo. Maschile singolare speciale.','su + lo = sullo',1],
    ['prep_a_036','articolate_form','preposizioni_articolate','A1','su + gli = ___',null,'["sugli"]','[]','["degli","agli","dagli"]','su + gli = sugli. Maschile plurale speciale.','su + gli = sugli',1],
    ['prep_a_037','articolate_form','preposizioni_articolate','A1','su + le = ___',null,'["sulle"]','[]','["delle","alle","dalle"]','su + le = sulle. Femminile plurale.','su + le = sulle',1],
    ['prep_a_038','articolate_form','preposizioni_articolate','A1','al = a + ___',null,'["il"]','[]','["lo","la","i"]','al = a + il. Articolo maschile singolare regolare.','al = a + il',1],
    ['prep_a_039','articolate_form','preposizioni_articolate','A1','alla = ___ + la',null,'["a"]','[]','["da","in","su"]','alla = a + la. Preposizione base: a.','alla = a + la',1],
    ['prep_a_040','articolate_form','preposizioni_articolate','A1',"dell' = di + ___",null,'["l\'"]','[]','["il","lo","la"]',"dell' = di + l'. Davanti a vocale.","dell' = di + l'",1],
    ['prep_a_041','articolate_form','preposizioni_articolate','A1','dal = ___ + il',null,'["da"]','[]','["a","in","su"]','dal = da + il. Preposizione base: da.','dal = da + il',1],
    ['prep_a_042','articolate_form','preposizioni_articolate','A1','nello = in + ___',null,'["lo"]','[]','["il","la","i"]','nello = in + lo. Maschile singolare speciale.','nello = in + lo',1],
    ['prep_a_043','articolate_form','preposizioni_articolate','A1','sulle = su + ___',null,'["le"]','[]','["i","gli","la"]','sulle = su + le. Femminile plurale.','sulle = su + le',1],
    ['prep_a_044','articolate_form','preposizioni_articolate','A1','dei = ___ + i',null,'["di"]','[]','["a","da","su"]','dei = di + i. Preposizione base: di.','dei = di + i',1],
    ['prep_a_045','articolate_form','preposizioni_articolate','A1','dagli = da + ___',null,'["gli"]','[]','["i","lo","le"]','dagli = da + gli. Maschile plurale speciale.','dagli = da + gli',1],
    ['prep_a_046','articolate_form','preposizioni_articolate','A1','nelle = ___ + le',null,'["in"]','[]','["di","a","su"]','nelle = in + le. Preposizione base: in.','nelle = in + le',1],
    ['prep_a_047','articolate_form','preposizioni_articolate','A1',"all' = a + ___",null,'["l\'"]','[]','["il","lo","la"]',"all' = a + l'. Davanti a vocale.","all' = a + l'",1],
    ['prep_a_048','articolate_form','preposizioni_articolate','A1','nello = ___ + lo',null,'["in"]','[]','["di","da","su"]','nello = in + lo. Preposizione base: in.','nello = in + lo',1],
    ['prep_a_049','articolate_form','preposizioni_articolate','A1','sugli = ___ + gli',null,'["su"]','[]','["di","a","da"]','sugli = su + gli. Preposizione base: su.','sugli = su + gli',1],
    ['prep_a_050','articolate_form','preposizioni_articolate','A1','del = di + ___',null,'["il"]','[]','["lo","la","i"]','del = di + il. Articolo maschile singolare regolare.','del = di + il',1],
    // ── 16 new contrast ────────────────────────────────────────────────────────
    ['prep_c_013','contrast','luogo_e_movimento','A1','Sono ___ casa.','Estoy en casa.','["a"]','[]','["in","nella","da"]','"A casa" è un\'espressione fissa senza articolo. "In casa" si usa anche, ma "a casa" è più comune.','\"A casa\" expresión fija.',1],
    ['prep_c_014','contrast','luogo_e_movimento','A2','Lavora ___ ufficio.','Trabaja en la oficina.','["in"]','[]','["a","all\'","nell\'"]','"In ufficio" è l\'espressione standard senza articolo. Contesto professionale.','\"In ufficio\" sin artículo.',1],
    ['prep_c_015','contrast','luogo_e_movimento','A2','Andiamo ___ teatro stasera.','Vamos al teatro esta noche.','["a"]','["al"]','["in","nel","da"]','"A teatro" o "al teatro" sono entrambe usate. Espressioni fisse: andare a teatro, al cinema, a scuola.','\"A teatro\" / \"al teatro\" para ocio.',1],
    ['prep_c_016','contrast','luogo_e_movimento','A2','Vai ___ piedi o in macchina?','¿Vas a pie o en coche?','["a"]','[]','["in","con","per"]','"A piedi" è l\'espressione fissa per camminare. Eccezione alla regola "in + mezzo di trasporto".','\"A piedi\" excepción: a pie.',1],
    ['prep_c_017','contrast','preposizioni_semplici','A1','Ho ricevuto un messaggio ___ Luca.','He recibido un mensaje de Luca.','["da"]','[]','["di","per","a"]','"Da + persona" indica provenienza di qualcosa (chi l\'ha inviato). "Di + persona" indica appartenenza (il libro di Luca = gli appartiene).','\"Da\" = de (quién lo envió). \"Di\" = de (posesión).',2],
    ['prep_c_018','contrast','preposizioni_semplici','A2','È un romanzo ___ Umberto Eco.','Es una novela de Umberto Eco.','["di"]','[]','["da","per","a"]','"Di + autore" indica autoría: un romanzo di Eco.','\"Di\" para autoría.',1],
    ['prep_c_019','contrast','preposizioni_semplici','A2','Vado ___ dentista.','Voy al dentista.','["dal"]','["da il","da"]','["al","nel","del"]','"Da + professionista" indica andare presso quella persona: dal dentista, dal dottore, dal parrucchiere.','\"Dal + profesional\" = ir a donde trabaja.',2],
    ['prep_c_020','contrast','preposizioni_semplici','A2','Il cellulare è ___ Marco.','El móvil es de Marco.','["di"]','[]','["da","a","per"]','"Di + persona" indica appartenenza stabile: è il cellulare di Marco.','\"Di\" = posesión.',1],
    ['prep_c_021','contrast','tempo','A2','Il treno parte ___ dieci minuti.','El tren sale dentro de diez minutos.','["tra","fra"]','[]','["in","per","da"]','"Tra/fra + tempo" = dentro de X tiempo. Il treno parte tra dieci minuti.','\"Tra/fra\" = dentro de X tiempo.',2],
    ['prep_c_022','contrast','tempo','A2','Ho finito il libro ___ un pomeriggio.','Terminé el libro en una tarde.','["in"]','[]','["tra","fra","per"]','"In + durata" = tiempo necesario para completar algo.','\"In\" = tiempo empleado en completar.',2],
    ['prep_c_023','contrast','tempo','B1','Ci vediamo ___ una settimana.','Nos vemos dentro de una semana.','["tra","fra"]','[]','["in","per","da"]','"Tra/fra una settimana" = dentro de una semana (futuro). "In una settimana" = en una semana (duración).','\"Tra/fra\" = futuro. \"In\" = duración.',2],
    ['prep_c_024','contrast','tempo','B1','Ha imparato tutto ___ tre mesi.','Aprendió todo en tres meses.','["in"]','[]','["tra","fra","per"]','"In tre mesi" = en tres meses (tiempo empleado). "Tra tre mesi" = dentro de tres meses.','\"In\" = duración empleada.',2],
    ['prep_c_025','contrast','causa_scopo_mezzo','B1','___ alla medicina moderna, molte malattie sono curabili.','Gracias a la medicina moderna, muchas enfermedades son curables.','["grazie"]','["grazie a"]','["a causa","per via","in seguito"]','"Grazie a" introduce una causa valutata positivamente.','\"Grazie a\" = causa positiva.',2],
    ['prep_c_026','contrast','causa_scopo_mezzo','B1','Il concerto è rinviato ___ del maltempo.','El concierto se ha pospuesto a causa del mal tiempo.','["a causa"]','["a causa di"]','["grazie","per via","nonostante"]','"A causa di" introduce una causa, spesso sfavorevole o negativa.','\"A causa di\" = causa (negativa).',2],
    ['prep_c_027','contrast','contrasto_esclusione','B1','___ la stanchezza, ha continuato a lavorare.','A pesar del cansancio, siguió trabajando.','["nonostante"]','[]','["a causa di","grazie a","invece di"]','"Nonostante + nome" indica concessione: a pesar de.','\"Nonostante\" = a pesar de.',2],
    ['prep_c_028','contrast','contrasto_esclusione','B1','___ riposarsi, ha continuato a lavorare.','En lugar de descansar, siguió trabajando.','["invece di"]','[]','["nonostante","a causa di","grazie a"]','"Invece di + infinito" indica sostituzione: en lugar de.','\"Invece di\" = en lugar de.',2],
    // ── 30 new verb_government ─────────────────────────────────────────────────
    ['prep_r_011','verb_government','preposizioni_semplici','A2','Ho cominciato ___ lavorare alle otto.','Empecé a trabajar a las ocho.','["a"]','[]','["di","per","da"]','Reggenza: cominciare a + infinito.',null,1],
    ['prep_r_012','verb_government','preposizioni_semplici','B1','Quando cominci ___ studiare?','¿Cuándo empiezas a estudiar?','["a"]','[]','["di","per","da"]','Reggenza: cominciare a + infinito.',null,1],
    ['prep_r_013','verb_government','preposizioni_semplici','B1','Ha smesso ___ piovere.','Ha dejado de llover.','["di"]','[]','["a","per","da"]','Reggenza: smettere di + infinito.',null,1],
    ['prep_r_014','verb_government','preposizioni_semplici','B1','Perché non smetti ___ lamentarti?','¿Por qué no dejas de quejarte?','["di"]','[]','["a","per","da"]','Reggenza: smettere di + infinito.',null,1],
    ['prep_r_015','verb_government','preposizioni_semplici','A2','Ho bisogno ___ una pausa.','Necesito un descanso.','["di"]','[]','["a","per","da"]','Reggenza: avere bisogno di + nome.',null,1],
    ['prep_r_016','verb_government','preposizioni_semplici','B1','Ho bisogno ___ riposarmi.','Necesito descansar.','["di"]','[]','["a","per","da"]','Reggenza: avere bisogno di + infinito.',null,1],
    ['prep_r_017','verb_government','preposizioni_semplici','B1','Non dipende ___ loro.','No depende de ellos.','["da"]','[]','["di","a","per"]','Reggenza: dipendere da + persona/cosa.',null,1],
    ['prep_r_018','verb_government','preposizioni_semplici','B1','Dipende ___ molti fattori.','Depende de muchos factores.','["da"]','[]','["di","a","per"]','Reggenza: dipendere da + nome.',null,1],
    ['prep_r_019','verb_government','preposizioni_semplici','B1','Non riesco ___ concentrarmi.','No logro concentrarme.','["a"]','[]','["di","per","in"]','Reggenza: riuscire a + infinito.',null,1],
    ['prep_r_020','verb_government','preposizioni_semplici','B1','Riesci ___ vedere da qui?','¿Logras ver desde aquí?','["a"]','[]','["di","per","in"]','Reggenza: riuscire a + infinito.',null,1],
    ['prep_r_021','verb_government','preposizioni_semplici','A2','Continua ___ nevicare.','Sigue nevando.','["a"]','[]','["di","per","da"]','Reggenza: continuare a + infinito.',null,1],
    ['prep_r_022','verb_government','preposizioni_semplici','A2','Continuo ___ aspettarti.','Sigo esperándote.','["a"]','[]','["di","per","da"]','Reggenza: continuare a + infinito.',null,1],
    ['prep_r_023','verb_government','preposizioni_semplici','B1','Ti sei dimenticata ___ prenotare?','¿Te olvidaste de reservar?','["di"]','[]','["a","da","per"]','Reggenza: dimenticarsi di + infinito.',null,2],
    ['prep_r_024','verb_government','preposizioni_semplici','B1','Mi sono dimenticato ___ portare il documento.','Me olvidé de traer el documento.','["di"]','[]','["a","da","per"]','Reggenza: dimenticarsi di + infinito.',null,1],
    ['prep_r_025','verb_government','preposizioni_semplici','A2','Parliamo ___ politica troppo spesso.','Hablamos de política demasiado.','["di"]','[]','["su","con","per"]','Reggenza: parlare di + argomento.',null,1],
    ['prep_r_026','verb_government','preposizioni_semplici','A2','Ha parlato ___ suo fratello tutto il giorno.','Habló de su hermano todo el día.','["di"]','[]','["su","con","per"]','Reggenza: parlare di + persona (argomento). "Parlare con" = conversar CON alguien.',null,1],
    ['prep_r_027','verb_government','preposizioni_semplici','B1','La ringraziano ___ la sua disponibilità.','Le agradecen su disponibilidad.','["per"]','[]','["di","a","con"]','Reggenza: ringraziare per + qualcosa.',null,2],
    ['prep_r_028','verb_government','preposizioni_semplici','B1','Ti ringrazio ___ tutto quello che hai fatto.','Te agradezco todo lo que has hecho.','["per"]','[]','["di","a","con"]','Reggenza: ringraziare per + qualcosa.',null,1],
    ['prep_r_029','verb_government','preposizioni_semplici','B1','Hanno deciso ___ partire presto.','Han decidido partir pronto.','["di"]','[]','["a","per","in"]','Reggenza: decidere di + infinito.',null,1],
    ['prep_r_030','verb_government','preposizioni_semplici','B1','Ha deciso ___ restare a casa.','Ha decidido quedarse en casa.','["di"]','[]','["a","per","in"]','Reggenza: decidere di + infinito.',null,1],
    ['prep_r_031','verb_government','preposizioni_semplici','B1','Cerco ___ capire la situazione.','Intento entender la situación.','["di"]','[]','["a","per","in"]','Reggenza: cercare di + infinito.',null,1],
    ['prep_r_032','verb_government','preposizioni_semplici','B1','Prova ___ fare meglio la prossima volta.','Intenta hacerlo mejor la próxima vez.','["a"]','[]','["di","per","in"]','Reggenza: provare a + infinito.',null,1],
    ['prep_r_033','verb_government','preposizioni_semplici','B1','Penso ___ mia nonna ogni giorno.','Pienso en mi abuela cada día.','["a"]','[]','["di","su","per"]','Reggenza: pensare a + persona/cosa (tenere in mente, avere affetto).',null,2],
    ['prep_r_034','verb_government','preposizioni_semplici','B1','Penso ___ partire domani.','Pienso partir mañana.','["di"]','[]','["a","su","per"]','Reggenza: pensare di + infinito (intenzione). DIVERSO da "pensare a" (affetto/attenzione).',null,2],
    ['prep_r_035','verb_government','preposizioni_semplici','B1','Crede molto ___ se stesso.','Cree mucho en sí mismo.','["in"]','[]','["a","di","per"]','Reggenza: credere in + qualcuno/qualcosa (avere fiducia).',null,2],
    ['prep_r_036','verb_government','preposizioni_semplici','B1','Conta sempre ___ di noi.','Siempre cuenta con nosotros.','["su"]','[]','["di","a","per"]','Reggenza: contare su + qualcuno (fare affidamento).',null,2],
    ['prep_r_037','verb_government','preposizioni_semplici','B1','Si è trasferito ___ Milano.','Se trasladó a Milán.','["a"]','[]','["in","da","per"]','Reggenza: trasferirsi a + città.',null,1],
    ['prep_r_038','verb_government','preposizioni_semplici','B1','Si è trasferito ___ Spagna.','Se trasladó a España.','["in"]','[]','["a","da","per"]','Reggenza: trasferirsi in + paese.',null,1],
    ['prep_r_039','verb_government','preposizioni_semplici','B2','Insiste ___ venire con noi.','Insiste en venir con nosotros.','["a","per"]','[]','["di","su","in"]','Reggenza: insistere a/per + infinito (entrambe accettate).',null,2],
    ['prep_r_040','verb_government','preposizioni_semplici','B1','Mi aspetto ___ qualcosa di meglio.','Espero algo mejor.','["di"]','[]','["a","su","per"]','Reggenza: aspettarsi di + infinito.',null,2],
    // ── 10 new fill_locuzione ──────────────────────────────────────────────────
    ['prep_l_009','fill_locuzione','luogo_e_movimento','A2','Il supermercato è ___ alla farmacia.','El supermercado está al lado de la farmacia.','["accanto"]','["accanto a","di fianco"]','["di fronte","in fondo","in cima"]','"Accanto a" indica prossimità laterale: al lado de.','\"Accanto a\" = al lado de.',1],
    ['prep_l_010','fill_locuzione','luogo_e_movimento','A2','La posta è ___ alla banca.','Correos está enfrente del banco.','["di fronte"]','["di fronte a"]','["accanto","in fondo","vicino"]','"Di fronte a" indica posizione opposta: enfrente de.','\"Di fronte a\" = enfrente de.',1],
    ['prep_l_011','fill_locuzione','luogo_e_movimento','B1','Abita ___ alla città.','Vive en las afueras de la ciudad.','["in periferia","nei dintorni","ai margini"]','["fuori"]','["in centro","in fondo","vicino"]','"In periferia" o "nei dintorni" indicano zona esterna alla città.','Periferia/dintorni = afueras.',2],
    ['prep_l_012','fill_locuzione','confronto_riferimento','B1','___ mia sorella, io sono più calma.','A diferencia de mi hermana, soy más calmada.','["a differenza"]','["a differenza di"]','["rispetto","invece di","al contrario"]','"A differenza di" introduce un contrasto: a diferencia de.','\"A differenza di\" = a diferencia de.',2],
    ['prep_l_013','fill_locuzione','confronto_riferimento','B1','Decidiamo ___ ai prezzi.','Decidimos según los precios.','["in base"]','["in base a"]','["rispetto","a seconda","invece"]','"In base a" = según / en función de.','\"In base a\" = según.',2],
    ['prep_l_014','fill_locuzione','confronto_riferimento','B2','___ alle previsioni, domani pioverà.','Según las previsiones, mañana lloverá.','["secondo","in base"]','["secondo le","in base a"]','["grazie a","a causa di","rispetto"]','"Secondo + nome" = según. Sinonimo formale: in base a.','\"Secondo\" = según.',1],
    ['prep_l_015','fill_locuzione','causa_scopo_mezzo','B2','Ha agito ___ legge.','Actuó de acuerdo con la ley.','["in conformità"]','["in conformità con","conformemente a"]','["secondo","in base","grazie a"]','"In conformità con" o "conformemente a" = de acuerdo con.','\"In conformità con\" = de conformidad con.',3],
    ['prep_l_016','fill_locuzione','contrasto_esclusione','B1','Tranne ___ Marco, tutti erano presenti.','Excepto Marco, todos estaban presentes.','["che"]','["tranne che"]','["nonostante","invece di","a causa di"]','"Tranne che" (o solo "tranne") davanti a nomi indica esclusione.','\"Tranne che\" = excepto.',2],
    ['prep_l_017','fill_locuzione','causa_scopo_mezzo','B1','Studio ___ diventare medico.','Estudio para ser médico.','["per","allo scopo di"]','[]','["a causa di","grazie a","invece di"]','"Per + infinito" indica scopo/finalità: para + infinitivo.','\"Per\" o \"allo scopo di\" = para (finalidad).',1],
    ['prep_l_018','fill_locuzione','luogo_e_movimento','B1','Siamo arrivati ___ al rifugio.','Llegamos hasta el refugio.','["fino"]','["fino a","fino al"]','["in cima","verso","vicino"]','"Fino a" indica il limite estremo raggiunto: hasta.','\"Fino a\" = hasta.',1],
  ];

  try {
    const insEx = db.prepare(`INSERT OR REPLACE INTO preposition_exercises(id,exercise_type,topic_slug,cefr,sentence_it,sentence_es,correct_answers,accepted_variants,distractors,explanation_it,explanation_es,difficulty) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    exercises.forEach(e => insEx.run(...e));
  } catch (_) {}

  // ── Phase 5: Conjugation extended model ───────────────────────────────────────

  try { db.exec(`CREATE TABLE IF NOT EXISTS verbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    infinitive TEXT UNIQUE NOT NULL,
    translation TEXT,
    auxiliary TEXT DEFAULT 'avere',
    past_participle TEXT,
    gerund TEXT,
    conjugation_group TEXT,
    is_regular INTEGER DEFAULT 1,
    is_isc INTEGER DEFAULT 0,
    reflexive_form TEXT,
    irregularity_tags TEXT DEFAULT '[]',
    grammar_notes TEXT,
    orthographic_pattern TEXT,
    transitivity TEXT DEFAULT 'transitive',
    review_status TEXT DEFAULT 'ok'
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS verb_conjugations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id INTEGER REFERENCES verbs(id),
    tense TEXT NOT NULL,
    person TEXT NOT NULL,
    form TEXT NOT NULL,
    irregularity_type TEXT,
    accepted_variants TEXT DEFAULT '[]',
    auxiliary TEXT,
    participle TEXT,
    explanation TEXT
  )`); } catch (_) {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_verb_conj_unique ON verb_conjugations(verb_id, tense, person)`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS conjugation_exercises (
    id TEXT PRIMARY KEY,
    exercise_type TEXT NOT NULL,
    verb_id INTEGER REFERENCES verbs(id),
    tense_id TEXT NOT NULL,
    person TEXT,
    prompt_it TEXT NOT NULL,
    prompt_es TEXT,
    correct_answers TEXT NOT NULL DEFAULT '[]',
    accepted_variants TEXT DEFAULT '[]',
    distractors TEXT DEFAULT '[]',
    explanation_it TEXT,
    explanation_es TEXT,
    difficulty INTEGER DEFAULT 1,
    cefr TEXT DEFAULT 'A1',
    context_sentence TEXT,
    target_form TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_conj_ex_verb ON conjugation_exercises(verb_id);
  CREATE INDEX IF NOT EXISTS idx_conj_ex_tense ON conjugation_exercises(tense_id);`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS conjugation_topic_stats (
    verb_id INTEGER NOT NULL,
    tense_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default',
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    almost_correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    last_attempted INTEGER,
    streak INTEGER DEFAULT 0,
    mastery_level TEXT DEFAULT 'nuovo',
    PRIMARY KEY (verb_id, tense_id, user_id)
  )`); } catch (_) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS conjugation_error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id INTEGER REFERENCES verbs(id),
    tense_id TEXT NOT NULL,
    person TEXT,
    prompt TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    evaluation_status TEXT,
    error_type TEXT,
    explanation TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`); } catch (_) {}

  // ── Phase 5B: Seed verbs table ────────────────────────────────────────────────
  const insVerb = db.prepare(`INSERT OR IGNORE INTO verbs(infinitive,translation,auxiliary,past_participle,conjugation_group,is_regular,is_isc) VALUES(?,?,?,?,?,?,?)`);
  [
    // [infinitive, translation, auxiliary, past_participle, group, is_regular, is_isc]
    ['essere','ser / estar','essere','stato','ere',0,0],
    ['avere','tener / haber','avere','avuto','ere',0,0],
    ['fare','hacer','avere','fatto','are',0,0],
    ['andare','ir','essere','andato','are',0,0],
    ['venire','venir','essere','venuto','ire',0,0],
    ['potere','poder','avere','potuto','ere',0,0],
    ['volere','querer','avere','voluto','ere',0,0],
    ['sapere','saber','avere','saputo','ere',0,0],
    ['dovere','deber','avere','dovuto','ere',0,0],
    ['stare','estar','essere','stato','are',0,0],
    ['dare','dar','avere','dato','are',0,0],
    ['dire','decir','avere','detto','ere',0,0],
    ['parlare','hablar','avere','parlato','are',1,0],
    ['capire','entender','avere','capito','ire',1,1],
    ['finire','terminar','avere','finito','ire_isc',1,1],
    ['preferire','preferir','avere','preferito','ire_isc',1,1],
    ['pulire','limpiar','avere','pulito','ire_isc',1,1],
    ['spedire','enviar','avere','spedito','ire_isc',1,1],
    ['partire','salir / partir','essere','partito','ire',1,0],
    ['dormire','dormir','avere','dormito','ire',1,0],
    ['sentire','sentir','avere','sentito','ire',1,0],
    ['seguire','seguir','avere','seguito','ire',1,0],
    ['uscire','salir','essere','uscito','ire',0,0],
    ['salire','subir','essere','salito','ire',0,0],
    ['morire','morir','essere','morto','ire',0,0],
    ['nascere','nacer','essere','nato','ere',0,0],
    ['crescere','crecer','essere','cresciuto','ere',1,0],
    ['leggere','leer','avere','letto','ere',0,0],
    ['scrivere','escribir','avere','scritto','ere',0,0],
    ['vedere','ver','avere','visto','ere',0,0],
    ['prendere','tomar','avere','preso','ere',0,0],
    ['mettere','poner','avere','messo','ere',0,0],
    ['chiedere','preguntar','avere','chiesto','ere',0,0],
    ['rispondere','responder','avere','risposto','ere',0,0],
    ['decidere','decidir','avere','deciso','ere',1,0],
    ['conoscere','conocer','avere','conosciuto','ere',1,0],
    ['correre','correr','avere','corso','ere',0,0],
    ['perdere','perder','avere','perso','ere',0,0],
    ['spendere','gastar','avere','speso','ere',0,0],
    ['vincere','ganar','avere','vinto','ere',0,0],
    ['rimanere','quedarse','essere','rimasto','ere',0,0],
    ['piacere','gustar','essere','piaciuto','ere',0,0],
    ['mancare','faltar','essere','mancato','are',0,0],
    ['scegliere','elegir','avere','scelto','ere',0,0],
    ['tenere','tener','avere','tenuto','ere',0,0],
    ['bere','beber','avere','bevuto','ere',0,0],
    ['mangiare','comer','avere','mangiato','are',1,0],
    ['lavorare','trabajar','avere','lavorato','are',1,0],
    ['abitare','vivir','avere','abitato','are',1,0],
    ['trovare','encontrar','avere','trovato','are',1,0],
    ['tornare','volver','essere','tornato','are',1,0],
    ['arrivare','llegar','essere','arrivato','are',1,0],
    ['entrare','entrar','essere','entrato','are',1,0],
    ['diventare','convertirse','essere','diventato','are',1,0],
    ['restare','quedarse','essere','restato','are',1,0],
    ['sembrare','parecer','essere','sembrato','are',1,0],
    ['aspettare','esperar','avere','aspettato','are',1,0],
    ['chiamare','llamar','avere','chiamato','are',1,0],
    ['comprare','comprar','avere','comprato','are',1,0],
    ['portare','llevar','avere','portato','are',1,0],
    ['pensare','pensar','avere','pensato','are',1,0],
    ['guardare','mirar','avere','guardato','are',1,0],
    ['giocare','jugar','avere','giocato','are',1,0],
    ['cercare','buscar','avere','cercato','are',1,0],
    ['pagare','pagar','avere','pagato','are',1,0],
    ['studiare','estudiar','avere','studiato','are',1,0],
    ['lasciare','dejar','avere','lasciato','are',1,0],
    ['credere','creer','avere','creduto','ere',1,0],
    ['ricevere','recibir','avere','ricevuto','ere',1,0],
    ['ridere','reír','avere','riso','ere',0,0],
    ['aprire','abrir','avere','aperto','ire',0,0],
    ['offrire','ofrecer','avere','offerto','ire',0,0],
    ['togliere','quitar','avere','tolto','ere',0,0],
    ['vivere','vivir','avere','vissuto','ere',0,0],
  ].forEach(row => { try { insVerb.run(...row); } catch (_) {} });

  // ── Phase 5C: Tense ID migration ─────────────────────────────────────────────
  try {
    db.exec(`UPDATE verb_conjugations SET tense='present_indicative' WHERE tense IN ('presente','present','indicativo_presente')`);
    db.exec(`UPDATE verb_conjugations SET tense='passato_prossimo' WHERE tense IN ('passato','past','passato prossimo')`);
    db.exec(`UPDATE verb_conjugations SET tense='imperfect_indicative' WHERE tense IN ('imperfetto','imperfect','indicativo_imperfetto')`);
    db.exec(`UPDATE verb_conjugations SET tense='future_simple' WHERE tense IN ('futuro','future','futuro_semplice')`);
    db.exec(`UPDATE verb_conjugations SET tense='conditional_present' WHERE tense IN ('condizionale','conditional','condizionale_presente')`);
    db.exec(`UPDATE verb_conjugations SET tense='subjunctive_present' WHERE tense IN ('congiuntivo','subjunctive','congiuntivo_presente')`);
  } catch (_) {}

  // ── Phase 5D: Apply auxiliary/participle/group corrections ────────────────────
  try {
    const setAux = db.prepare(`UPDATE verbs SET auxiliary=? WHERE infinitive=?`);
    ['andare','venire','partire','arrivare','tornare','uscire','entrare','nascere','morire','essere',
     'stare','restare','rimanere','diventare','crescere','piacere','mancare','salire','sedere'].forEach(inf => {
      try { setAux.run('essere', inf); } catch (_) {}
    });
    const setPP = db.prepare(`UPDATE verbs SET past_participle=? WHERE infinitive=?`);
    [['andare','andato'],['venire','venuto'],['essere','stato'],['avere','avuto'],['fare','fatto'],
     ['dire','detto'],['stare','stato'],['dare','dato'],['sapere','saputo'],['potere','potuto'],
     ['volere','voluto'],['dovere','dovuto'],['piacere','piaciuto'],['nascere','nato'],['morire','morto'],
     ['rimanere','rimasto'],['scegliere','scelto'],['togliere','tolto'],['bere','bevuto'],['tenere','tenuto'],
     ['leggere','letto'],['scrivere','scritto'],['aprire','aperto'],['offrire','offerto'],['perdere','perso'],
     ['vedere','visto'],['rispondere','risposto'],['mettere','messo'],['chiedere','chiesto'],['prendere','preso'],
     ['correre','corso'],['vivere','vissuto'],['decidere','deciso'],['accendere','acceso'],['spendere','speso'],
    ].forEach(([inf,pp]) => { try { setPP.run(pp, inf); } catch (_) {} });
    const setIsc = db.prepare(`UPDATE verbs SET is_isc=1 WHERE infinitive=?`);
    ['capire','finire','preferire','pulire','spedire'].forEach(inf => { try { setIsc.run(inf); } catch (_) {} });
  } catch (_) {}

  // ── Phase 5E: Seed critical verb_conjugations ─────────────────────────────────
  const getVerbId = db.prepare(`SELECT id FROM verbs WHERE infinitive=?`);
  const insConj = db.prepare(`INSERT OR IGNORE INTO verb_conjugations(verb_id,tense,person,form) VALUES(?,?,?,?)`);
  const seedForms = (infinitive, tense, forms) => {
    const v = getVerbId.get(infinitive);
    if (!v) return;
    Object.entries(forms).forEach(([person, form]) => {
      try { insConj.run(v.id, tense, person, form); } catch (_) {}
    });
  };
  // essere — present_indicative
  seedForms('essere','present_indicative',{io:'sono',tu:'sei','lui/lei':'è',noi:'siamo',voi:'siete',loro:'sono'});
  // avere — present_indicative
  seedForms('avere','present_indicative',{io:'ho',tu:'hai','lui/lei':'ha',noi:'abbiamo',voi:'avete',loro:'hanno'});
  // andare — present_indicative
  seedForms('andare','present_indicative',{io:'vado',tu:'vai','lui/lei':'va',noi:'andiamo',voi:'andate',loro:'vanno'});
  // fare — present_indicative
  seedForms('fare','present_indicative',{io:'faccio',tu:'fai','lui/lei':'fa',noi:'facciamo',voi:'fate',loro:'fanno'});
  // parlare — present_indicative
  seedForms('parlare','present_indicative',{io:'parlo',tu:'parli','lui/lei':'parla',noi:'parliamo',voi:'parlate',loro:'parlano'});
  // capire — present_indicative
  seedForms('capire','present_indicative',{io:'capisco',tu:'capisci','lui/lei':'capisce',noi:'capiamo',voi:'capite',loro:'capiscono'});
  // finire — present_indicative
  seedForms('finire','present_indicative',{io:'finisco',tu:'finisci','lui/lei':'finisce',noi:'finiamo',voi:'finite',loro:'finiscono'});
  // venire — present_indicative
  seedForms('venire','present_indicative',{io:'vengo',tu:'vieni','lui/lei':'viene',noi:'veniamo',voi:'venite',loro:'vengono'});
  // sapere — present_indicative
  seedForms('sapere','present_indicative',{io:'so',tu:'sai','lui/lei':'sa',noi:'sappiamo',voi:'sapete',loro:'sanno'});
  // potere — present_indicative
  seedForms('potere','present_indicative',{io:'posso',tu:'puoi','lui/lei':'può',noi:'possiamo',voi:'potete',loro:'possono'});
  // dovere — present_indicative
  seedForms('dovere','present_indicative',{io:'devo',tu:'devi','lui/lei':'deve',noi:'dobbiamo',voi:'dovete',loro:'devono'});
  // volere — present_indicative
  seedForms('volere','present_indicative',{io:'voglio',tu:'vuoi','lui/lei':'vuole',noi:'vogliamo',voi:'volete',loro:'vogliono'});
  // parlare — imperfect_indicative
  seedForms('parlare','imperfect_indicative',{io:'parlavo',tu:'parlavi','lui/lei':'parlava',noi:'parlavamo',voi:'parlavate',loro:'parlavano'});
  // andare — future_simple
  seedForms('andare','future_simple',{io:'andrò',tu:'andrai','lui/lei':'andrà',noi:'andremo',voi:'andrete',loro:'andranno'});
  // andare — passato_prossimo
  seedForms('andare','passato_prossimo',{io:'sono andato',tu:'sei andato','lui/lei':'è andato',noi:'siamo andati',voi:'siete andati',loro:'sono andati'});
  // piacere — present_indicative
  seedForms('piacere','present_indicative',{io:'piaccio',tu:'piaci','lui/lei':'piace',noi:'piacciamo',voi:'piacete',loro:'piacciono'});
  // mancare — present_indicative
  seedForms('mancare','present_indicative',{io:'manco',tu:'manchi','lui/lei':'manca',noi:'manchiamo',voi:'mancate',loro:'mancano'});

  // ── Phase 5F: Seed conjugation_exercises ─────────────────────────────────────
  try {
    const insConjEx = db.prepare(`INSERT OR REPLACE INTO conjugation_exercises(id,exercise_type,verb_id,tense_id,person,prompt_it,prompt_es,correct_answers,accepted_variants,distractors,explanation_it,explanation_es,difficulty,cefr) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const getVId = (inf) => { const r = getVerbId.get(inf); return r ? r.id : null; };
    const conjExercises = [
      // ── single_form (30) ──────────────────────────────────────────────────────
      ['cex_sf_001','single_form',getVId('essere'),'present_indicative','io','essere — presente indicativo — io',null,'["sono"]','[]','["ero","sarò","sia"]','"Essere" al presente: io sono.','Ser/Estar presente: io sono.',1,'A1'],
      ['cex_sf_002','single_form',getVId('essere'),'present_indicative','tu','essere — presente indicativo — tu',null,'["sei"]','[]','["eri","sarai","sia"]','"Essere" al presente: tu sei.','Ser/Estar presente: tu sei.',1,'A1'],
      ['cex_sf_003','single_form',getVId('essere'),'present_indicative','lui/lei','essere — presente indicativo — lui/lei',null,'["è"]','[]','["era","sarà","sia"]','"Essere" al presente: lui/lei è. Attenzione all\'accento!','Ser/Estar presente: lui/lei è.',1,'A1'],
      ['cex_sf_004','single_form',getVId('essere'),'present_indicative','noi','essere — presente indicativo — noi',null,'["siamo"]','[]','["eravamo","saremo","siamo stati"]','"Essere" al presente: noi siamo.','Ser/Estar presente: noi siamo.',1,'A1'],
      ['cex_sf_005','single_form',getVId('essere'),'present_indicative','voi','essere — presente indicativo — voi',null,'["siete"]','[]','["eravate","sarete","siate"]','"Essere" al presente: voi siete.','Ser/Estar presente: voi siete.',1,'A1'],
      ['cex_sf_006','single_form',getVId('essere'),'present_indicative','loro','essere — presente indicativo — loro',null,'["sono"]','[]','["erano","saranno","siano"]','"Essere" al presente: loro sono. Uguale a "io sono".',null,1,'A1'],
      ['cex_sf_007','single_form',getVId('avere'),'present_indicative','io','avere — presente indicativo — io',null,'["ho"]','[]','["avevo","avrò","abbia"]','"Avere" al presente: io ho. Niente "h" pronunciata!',null,1,'A1'],
      ['cex_sf_008','single_form',getVId('avere'),'present_indicative','tu','avere — presente indicativo — tu',null,'["hai"]','[]','["avevi","avrai","abbia"]','"Avere" al presente: tu hai.',null,1,'A1'],
      ['cex_sf_009','single_form',getVId('avere'),'present_indicative','lui/lei','avere — presente indicativo — lui/lei',null,'["ha"]','[]','["aveva","avrà","abbia"]','"Avere" al presente: lui/lei ha.',null,1,'A1'],
      ['cex_sf_010','single_form',getVId('andare'),'present_indicative','io','andare — presente indicativo — io',null,'["vado"]','[]','["andavo","andrò","vada"]','"Andare" è irregolare: io vado (non "ando").',null,1,'A1'],
      ['cex_sf_011','single_form',getVId('andare'),'present_indicative','tu','andare — presente indicativo — tu',null,'["vai"]','[]','["andavi","andrai","vada"]','"Andare" al presente: tu vai.',null,1,'A1'],
      ['cex_sf_012','single_form',getVId('andare'),'present_indicative','lui/lei','andare — presente indicativo — lui/lei',null,'["va"]','[]','["andava","andrà","vada"]','"Andare" al presente: lui/lei va.',null,1,'A1'],
      ['cex_sf_013','single_form',getVId('andare'),'present_indicative','loro','andare — presente indicativo — loro',null,'["vanno"]','[]','["andavano","andranno","vadano"]','"Andare" al presente: loro vanno (irregolare!).','Andare presente: loro vanno.',1,'A1'],
      ['cex_sf_014','single_form',getVId('fare'),'present_indicative','io','fare — presente indicativo — io',null,'["faccio"]','[]','["facevo","farò","faccia"]','"Fare" al presente: io faccio (derivato da "facere").','Fare presente: faccio.',1,'A1'],
      ['cex_sf_015','single_form',getVId('fare'),'present_indicative','lui/lei','fare — presente indicativo — lui/lei',null,'["fa"]','[]','["faceva","farà","faccia"]','"Fare" al presente: lui/lei fa.','Fare presente: fa.',1,'A1'],
      ['cex_sf_016','single_form',getVId('venire'),'present_indicative','io','venire — presente indicativo — io',null,'["vengo"]','[]','["venivo","verrò","venga"]','"Venire" al presente: io vengo.',null,1,'A2'],
      ['cex_sf_017','single_form',getVId('venire'),'present_indicative','loro','venire — presente indicativo — loro',null,'["vengono"]','[]','["venivano","verranno","vengano"]','"Venire" al presente: loro vengono.',null,1,'A2'],
      ['cex_sf_018','single_form',getVId('sapere'),'present_indicative','io','sapere — presente indicativo — io',null,'["so"]','[]','["sapevo","saprò","sappia"]','"Sapere" al presente: io so (molto breve!).','Sapere presente: io so.',1,'A2'],
      ['cex_sf_019','single_form',getVId('potere'),'present_indicative','io','potere — presente indicativo — io',null,'["posso"]','[]','["potevo","potrò","possa"]','"Potere" al presente: io posso.',null,1,'A2'],
      ['cex_sf_020','single_form',getVId('potere'),'present_indicative','lui/lei','potere — presente indicativo — lui/lei',null,'["può"]','[]','["poteva","potrà","possa"]','"Potere" al presente: lui/lei può. Attenzione all\'accento!',null,1,'A2'],
      ['cex_sf_021','single_form',getVId('dovere'),'present_indicative','io','dovere — presente indicativo — io',null,'["devo"]','["debbo"]','["dovevo","dovrò","debba"]','"Dovere" al presente: devo (o debbo, più formale).',null,1,'A2'],
      ['cex_sf_022','single_form',getVId('parlare'),'imperfect_indicative','io','parlare — imperfetto indicativo — io',null,'["parlavo"]','[]','["parlo","parlerò","parli"]','Imperfetto regolare -ARE: io parlavo.',null,1,'A2'],
      ['cex_sf_023','single_form',getVId('parlare'),'imperfect_indicative','lui/lei','parlare — imperfetto indicativo — lui/lei',null,'["parlava"]','[]','["parla","parlerà","parli"]','Imperfetto regolare -ARE: lui/lei parlava.',null,1,'A2'],
      ['cex_sf_024','single_form',getVId('andare'),'future_simple','io','andare — futuro semplice — io',null,'["andrò"]','[]','["vado","andavo","vada"]','Futuro di "andare": andrò (radice irregolare "andr-").',null,2,'A2'],
      ['cex_sf_025','single_form',getVId('andare'),'passato_prossimo','io','andare — passato prossimo — io (maschile)',null,'["sono andato"]','["andato"]','["ho andato","ero andato","sono andato/a"]','Andare usa "essere" come ausiliare. Participio concorda: andato (m), andata (f).',null,2,'A2'],
      ['cex_sf_026','single_form',getVId('capire'),'present_indicative','io','capire — presente indicativo — io',null,'["capisco"]','[]','["capivo","capirò","capisca"]','Capire è un verbo -ISC: io capisco, tu capisci, lui capisce.',null,1,'A2'],
      ['cex_sf_027','single_form',getVId('finire'),'present_indicative','noi','finire — presente indicativo — noi',null,'["finiamo"]','[]','["finisco","finiremo","finiamo"]','Verbi -ISC: la forma noi NON usa -isc: noi finiamo (non "finisciamo").',null,2,'A2'],
      ['cex_sf_028','single_form',getVId('volere'),'present_indicative','io','volere — presente indicativo — io',null,'["voglio"]','[]','["voler","vorrò","voglia"]','"Volere" al presente: io voglio.',null,1,'A2'],
      ['cex_sf_029','single_form',getVId('essere'),'passato_prossimo','io','essere — passato prossimo — io (stato/a)',null,'["sono stato","sono stata"]','["stato","stata"]','["ero stato","ho stato","fui stato"]','"Essere" al passato prossimo: sono stato/stata (si usa "essere" come ausiliare).',null,2,'A2'],
      ['cex_sf_030','single_form',getVId('avere'),'passato_prossimo','lui/lei','avere — passato prossimo — lui/lei',null,'["ha avuto"]','[]','["è avuto","aveva avuto","abbia avuto"]','"Avere" al passato prossimo: ha avuto (ausiliare: avere).',null,1,'A2'],
      // ── full_paradigm (5) ──────────────────────────────────────────────────────
      ['cex_fp_001','full_paradigm',getVId('parlare'),'present_indicative',null,'parlare — presente indicativo — completa tutte le persone',null,'["parlo","parli","parla","parliamo","parlate","parlano"]','[]','[]','Parlare è un verbo regolare -ARE. Terminazioni: -o, -i, -a, -iamo, -ate, -ano.',null,1,'A1'],
      ['cex_fp_002','full_paradigm',getVId('andare'),'present_indicative',null,'andare — presente indicativo — completa tutte le persone',null,'["vado","vai","va","andiamo","andate","vanno"]','[]','[]','Andare è irregolare: vado, vai, va, andiamo, andate, vanno.',null,2,'A1'],
      ['cex_fp_003','full_paradigm',getVId('essere'),'present_indicative',null,'essere — presente indicativo — completa tutte le persone',null,'["sono","sei","è","siamo","siete","sono"]','[]','[]','Essere è molto irregolare: sono, sei, è, siamo, siete, sono.',null,2,'A1'],
      ['cex_fp_004','full_paradigm',getVId('avere'),'present_indicative',null,'avere — presente indicativo — completa tutte le persone',null,'["ho","hai","ha","abbiamo","avete","hanno"]','[]','[]','Avere è irregolare: ho, hai, ha, abbiamo, avete, hanno.',null,2,'A1'],
      ['cex_fp_005','full_paradigm',getVId('fare'),'present_indicative',null,'fare — presente indicativo — completa tutte le persone',null,'["faccio","fai","fa","facciamo","fate","fanno"]','[]','[]','Fare è irregolare: faccio, fai, fa, facciamo, fate, fanno.',null,2,'A1'],
      // ── auxiliary_participle (10) ──────────────────────────────────────────────
      ['cex_ap_001','auxiliary_participle',getVId('andare'),'passato_prossimo',null,"andare — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Andare usa "essere": sono andato.',null,1,'A2'],
      ['cex_ap_002','auxiliary_participle',getVId('mangiare'),'passato_prossimo',null,"mangiare — passato prossimo — qual è l'ausiliare?",null,'["avere"]','[]','["essere"]','Mangiare usa "avere": ho mangiato.',null,1,'A2'],
      ['cex_ap_003','auxiliary_participle',getVId('nascere'),'passato_prossimo',null,"nascere — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Nascere usa "essere": sono nato/a.',null,1,'A2'],
      ['cex_ap_004','auxiliary_participle',getVId('prendere'),'passato_prossimo',null,"prendere — passato prossimo — qual è l'ausiliare?",null,'["avere"]','[]','["essere"]','Prendere usa "avere": ho preso.',null,1,'A2'],
      ['cex_ap_005','auxiliary_participle',getVId('uscire'),'passato_prossimo',null,"uscire — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Uscire usa "essere": sono uscito.',null,1,'A2'],
      ['cex_ap_006','auxiliary_participle',getVId('venire'),'passato_prossimo',null,"venire — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Venire usa "essere": sono venuto.',null,1,'A2'],
      ['cex_ap_007','auxiliary_participle',getVId('fare'),'passato_prossimo',null,"fare — passato prossimo — qual è l'ausiliare?",null,'["avere"]','[]','["essere"]','Fare usa "avere": ho fatto.',null,1,'A2'],
      ['cex_ap_008','auxiliary_participle',getVId('leggere'),'passato_prossimo',null,"leggere — passato prossimo — qual è l'ausiliare?",null,'["avere"]','[]','["essere"]','Leggere usa "avere": ho letto.',null,1,'A2'],
      ['cex_ap_009','auxiliary_participle',getVId('morire'),'passato_prossimo',null,"morire — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Morire usa "essere": è morto.',null,1,'A2'],
      ['cex_ap_010','auxiliary_participle',getVId('tornare'),'passato_prossimo',null,"tornare — passato prossimo — qual è l'ausiliare?",null,'["essere"]','[]','["avere"]','Tornare usa "essere": sono tornato.',null,1,'A2'],
      // ── choose_tense (10) ──────────────────────────────────────────────────────
      ['cex_ct_001','choose_tense',getVId('andare'),'imperfect_indicative',null,'Da bambino ___ sempre al parco. (andare)','De niño siempre iba al parque.','["andavo"]','[]','["sono andato","andrò","vado"]','L\'imperfetto indica un\'abitudine nel passato.',null,2,'B1'],
      ['cex_ct_002','choose_tense',getVId('mangiare'),'passato_prossimo',null,'Ieri ___ la pizza. (mangiare)','Ayer comí pizza.','["ho mangiato"]','[]','["mangiavo","mangerò","mangio"]','Il passato prossimo indica un\'azione puntuale nel passato recente.',null,1,'A2'],
      ['cex_ct_003','choose_tense',getVId('studiare'),'future_simple',null,'Domani ___ tutto il giorno. (studiare)','Mañana estudiaré todo el día.','["studierò"]','[]','["studiavo","ho studiato","studio"]','Il futuro semplice si usa per azioni future.',null,1,'A2'],
      ['cex_ct_004','choose_tense',getVId('essere'),'imperfect_indicative',null,'Quando ___ piccola, sognavo di diventare medico. (essere)','Cuando era pequeña, soñaba con ser médica.','["ero"]','[]','["sono","sarò","sia"]','L\'imperfetto descrive stati ed abitudini nel passato.',null,2,'B1'],
      ['cex_ct_005','choose_tense',getVId('partire'),'passato_prossimo',null,'Luca ___ ieri mattina. (partire)','Luca partió ayer por la mañana.','["è partito"]','[]','["partiva","partirà","parta"]','Il passato prossimo con "essere" per i verbi di movimento.',null,2,'A2'],
      ['cex_ct_006','choose_tense',getVId('lavorare'),'imperfect_indicative',null,'Prima ___ in banca. (lavorare)','Antes trabajaba en un banco.','["lavoravo"]','[]','["ho lavorato","lavorerò","lavoro"]','L\'imperfetto per azioni abituali o stati nel passato.',null,1,'B1'],
      ['cex_ct_007','choose_tense',getVId('fare'),'future_simple',null,'Se piove, ___ una torta. (fare)','Si llueve, haré un pastel.','["farò"]','[]','["faccio","facevo","ho fatto"]','Il futuro nella frase ipotetica con "se + presente indicativo".',null,2,'B1'],
      ['cex_ct_008','choose_tense',getVId('vedere'),'passato_prossimo',null,'Non ___ quel film. (vedere)','No he visto esa película.','["ho visto"]','[]','["vedevo","vedrò","veda"]','Il passato prossimo per esperienze fino al presente.',null,1,'A2'],
      ['cex_ct_009','choose_tense',getVId('parlare'),'imperfect_indicative',null,'Mentre ___ con Marco, è arrivata Sara. (parlare)','Mientras hablaba con Marco, llegó Sara.','["parlavo"]','[]','["ho parlato","parlerò","parli"]','L\'imperfetto per azione in corso interrotta da un\'altra.',null,2,'B1'],
      ['cex_ct_010','choose_tense',getVId('arrivare'),'future_simple',null,'Il treno ___ alle tre. (arrivare)','El tren llegará a las tres.','["arriverà"]','[]','["arrivava","è arrivato","arrivi"]','Il futuro per previsioni/programmi futuri.',null,1,'A2'],
      // ── prossimo_vs_imperfetto (10) ────────────────────────────────────────────
      ['cex_pi_001','prossimo_vs_imperfetto',getVId('studiare'),'imperfect_indicative',null,'Mentre ___ (studiare), il telefono ha squillato.','Mientras estudiaba, sonó el teléfono.','["studiavo"]','[]','["ho studiato","studierò","studio"]','L\'imperfetto descrive un\'azione in corso interrotta.',null,2,'B1'],
      ['cex_pi_002','prossimo_vs_imperfetto',getVId('leggere'),'passato_prossimo',null,'Ieri sera ___ (leggere) un articolo interessante.','Ayer por la noche leí un artículo interesante.','["ho letto"]','[]','["leggevo","leggerò","leggo"]','Il passato prossimo per azione completata nel passato.',null,1,'A2'],
      ['cex_pi_003','prossimo_vs_imperfetto',getVId('dormire'),'imperfect_indicative',null,'Ogni sera ___ (dormire) presto quando ero giovane.','Cada noche dormía temprano cuando era joven.','["dormivo"]','[]','["ho dormito","dormirò","dormo"]','L\'imperfetto per abitudine nel passato.',null,2,'B1'],
      ['cex_pi_004','prossimo_vs_imperfetto',getVId('mangiare'),'passato_prossimo',null,'Stanotte non ___ (mangiare) niente.','Esta noche no comí nada.','["ho mangiato"]','[]','["mangiavo","mangerò","mangio"]','Il passato prossimo per azione puntuale nel passato recente.',null,1,'A2'],
      ['cex_pi_005','prossimo_vs_imperfetto',getVId('lavorare'),'imperfect_indicative',null,'Da bambino mio padre ___ (lavorare) in campagna.','De niño, mi padre trabajaba en el campo.','["lavorava"]','[]','["ha lavorato","lavorerà","lavora"]','L\'imperfetto per descrizione o stato nel passato.',null,1,'B1'],
      ['cex_pi_006','prossimo_vs_imperfetto',getVId('uscire'),'passato_prossimo',null,'Ieri sera ___ (uscire) con gli amici.','Ayer por la noche salí con los amigos.','["sono uscito","sono uscita"]','[]','["uscivo","uscirò","esca"]','Il passato prossimo per azione completata ieri sera.',null,2,'A2'],
      ['cex_pi_007','prossimo_vs_imperfetto',getVId('guardare'),'imperfect_indicative',null,'___ (guardare) la TV quando ha telefonato.','Estaba viendo la tele cuando llamó.','["guardavo"]','[]','["ho guardato","guarderò","guardo"]','L\'imperfetto per azione in corso al passato.',null,2,'B1'],
      ['cex_pi_008','prossimo_vs_imperfetto',getVId('arrivare'),'passato_prossimo',null,'Il treno ___ (arrivare) con tre ore di ritardo.','El tren llegó con tres horas de retraso.','["è arrivato"]','[]','["arrivava","arriverà","arrivi"]','Il passato prossimo per evento puntuale.',null,1,'A2'],
      ['cex_pi_009','prossimo_vs_imperfetto',getVId('pensare'),'imperfect_indicative',null,'___ (pensare) a te tutto il giorno.','Pensaba en ti todo el día.','["pensavo"]','[]','["ho pensato","penserò","penso"]','L\'imperfetto per stato mentale prolungato nel passato.',null,2,'B1'],
      ['cex_pi_010','prossimo_vs_imperfetto',getVId('tornare'),'passato_prossimo',null,'Ieri ___ (tornare) a casa tardi.','Ayer volví a casa tarde.','["sono tornato","sono tornata"]','[]','["tornavo","tornerò","torni"]','Il passato prossimo per azione puntuale compiuta.',null,2,'A2'],
      // ── verbi_speciali (10) ────────────────────────────────────────────────────
      ['cex_vs_001','verbi_speciali',getVId('piacere'),'present_indicative',null,'Mi ___ (piacere) il libro.','Me gusta el libro.','["piace"]','[]','["piaccio","piacete","piacevano"]','"Piacere" si coniuga con il soggetto grammaticale (il libro). "Mi" è il complemento indiretto.',null,2,'A2'],
      ['cex_vs_002','verbi_speciali',getVId('piacere'),'present_indicative',null,'Mi ___ (piacere) i libri.','Me gustan los libros.','["piacciono"]','[]','["piace","piacevo","piaccia"]','"Piacere" al plurale: mi piacciono i libri (soggetto: i libri).',null,2,'A2'],
      ['cex_vs_003','verbi_speciali',getVId('mancare'),'present_indicative',null,'Mi ___ (mancare) la famiglia.','Echo de menos a mi familia.','["manca"]','[]','["manco","mancate","mancherebbe"]','"Mancare" funziona come "piacere": mi manca la famiglia (soggetto: la famiglia).',null,2,'B1'],
      ['cex_vs_004','verbi_speciali',getVId('piacere'),'imperfect_indicative',null,'Da bambino mi ___ (piacere) il cioccolato.','De niño me gustaba el chocolate.','["piaceva"]','[]','["piacevo","piacesse","piace"]','"Piacere" all\'imperfetto: mi piaceva.',null,2,'B1'],
      ['cex_vs_005','verbi_speciali',getVId('piacere'),'passato_prossimo',null,'Ti ___ (piacere) il film?','¿Te ha gustado la película?','["è piaciuto"]','["piaciuto"]','["hai piaciuto","ha piaciuto","è piaciuta"]','"Piacere" al passato prossimo usa "essere". Il participio concorda con il soggetto.',null,3,'B1'],
      ['cex_vs_006','verbi_speciali',getVId('mancare'),'present_indicative',null,'Mi ___ (mancare) i tuoi abbracci.','Echo de menos tus abrazos.','["mancano"]','[]','["manca","mancavo","mancherei"]','"Mancare" al plurale: mi mancano i tuoi abbracci.',null,2,'B1'],
      ['cex_vs_007','verbi_speciali',getVId('piacere'),'present_indicative',null,'Gli ___ (piacere) correre.','Le gusta correr.','["piace"]','[]','["piacciono","piaccia","piaceva"]','"Piacere" + infinito → sempre singolare: gli piace correre.',null,2,'A2'],
      ['cex_vs_008','verbi_speciali',getVId('piacere'),'present_indicative',null,'Ci ___ (piacere) viaggiare.','Nos gusta viajar.','["piace"]','[]','["piacciono","piaccia","piacevano"]','"Piacere" + infinito → sempre singolare: ci piace viaggiare.',null,2,'A2'],
      ['cex_vs_009','verbi_speciali',getVId('mancare'),'imperfect_indicative',null,'Mi ___ (mancare) molto la casa.','Echaba mucho de menos casa.','["mancava"]','[]','["mancavo","mancherebbe","mancano"]','"Mancare" all\'imperfetto: mi mancava la casa.',null,2,'B1'],
      ['cex_vs_010','verbi_speciali',getVId('piacere'),'present_indicative',null,'Non mi ___ (piacere) le verdure.','No me gustan las verduras.','["piacciono"]','[]','["piace","piacevo","piaccia"]','"Piacere" al plurale in negativo: non mi piacciono le verdure.',null,2,'A2'],
      // ── 5 extra single_form ───────────────────────────────────────────────────
      ['cex_sf_031','single_form',getVId('essere'),'imperfect_indicative','io','essere — imperfetto — io',null,'["ero"]','[]','["sono","sarò","fossi"]','Imperfetto di essere: io ero.',null,1,'A2'],
      ['cex_sf_032','single_form',getVId('avere'),'imperfect_indicative','lui/lei','avere — imperfetto — lui/lei',null,'["aveva"]','[]','["ha","avrà","avesse"]','Imperfetto di avere: lui/lei aveva.',null,1,'A2'],
      ['cex_sf_033','single_form',getVId('fare'),'imperfect_indicative','noi','fare — imperfetto — noi',null,'["facevamo"]','[]','["facciamo","faremo","facessimo"]','Imperfetto di fare: noi facevamo.',null,1,'A2'],
      ['cex_sf_034','single_form',getVId('andare'),'conditional_present','io','andare — condizionale presente — io',null,'["andrei"]','[]','["andrò","andavo","vada"]','Condizionale di andare: io andrei.',null,2,'B1'],
      ['cex_sf_035','single_form',getVId('essere'),'future_simple','lui/lei','essere — futuro semplice — lui/lei',null,'["sarà"]','[]','["è","era","sia"]','Futuro di essere: lui/lei sarà.',null,1,'A2'],
    ];
    conjExercises.forEach(e => { try { insConjEx.run(...e); } catch (_) {} });
  } catch (_) {}
}

module.exports = { createSchema };
