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
}

module.exports = { createSchema };
