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

  // ── Phase 5B: New columns on verbs ──────────────────────────────────────────
  try { db.exec(`ALTER TABLE verbs ADD COLUMN auxiliary_variants TEXT DEFAULT '[]'`); } catch(_) {}
  try { db.exec(`ALTER TABLE verbs ADD COLUMN auxiliary_note TEXT`); } catch(_) {}

  // ── Phase 5B: New columns on conjugation_error_log ───────────────────────────
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN exercise_id TEXT`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN subject TEXT`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN exercise_mode TEXT`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN secondary_issues TEXT DEFAULT '[]'`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN auxiliary TEXT`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN participle TEXT`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN last_reviewed_at INTEGER`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN review_count INTEGER DEFAULT 0`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN correct_streak INTEGER DEFAULT 0`); } catch(_) {}
  try { db.exec(`ALTER TABLE conjugation_error_log ADD COLUMN mastery_status TEXT DEFAULT 'nuovo'`); } catch(_) {}

  // ── Phase 5B: Insert missing verbs ───────────────────────────────────────────
  const insVerbB = db.prepare(`INSERT OR IGNORE INTO verbs(infinitive,translation,auxiliary,past_participle,conjugation_group,is_regular,is_isc) VALUES(?,?,?,?,?,?,?)`);
  [
    ['dimenticare','olvidar','avere','dimenticato','are',1,0],
    ['cominciare','empezar / comenzar','avere','cominciato','are',1,0],
    ['camminare','caminar','avere','camminato','are',1,0],
    ['usare','usar / utilizar','avere','usato','are',1,0],
    ['amare','amar / querer','avere','amato','are',1,0],
    ['suonare','tocar (instrumento)','avere','suonato','are',1,0],
    ['chiudere','cerrar','avere','chiuso','ere',0,0],
    ['vendere','vender','avere','venduto','ere',1,0],
    ['passare','pasar','essere','passato','are',1,0],
    ['sedere','sentarse','essere','seduto','ere',0,0],
    ['scoprire','descubrir','avere','scoperto','ire',0,0],
    ['costruire','construir','avere','costruito','ire_isc',1,1],
    ['obbedire','obedecer','avere','obbedito','ire_isc',1,1],
    ['garantire','garantizar','avere','garantito','ire_isc',1,1],
    ['interessare','interesar','essere','interessato','are',1,0],
    ['imparare','aprender','avere','imparato','are',1,0],
  ].forEach(row => { try { insVerbB.run(...row); } catch(_) {} });

  // ── Phase 5B: Update verb metadata (idempotent) ───────────────────────────────
  try {
    db.prepare(`UPDATE verbs SET conjugation_group='ire_isc' WHERE infinitive='capire' AND conjugation_group='ire'`).run();
    db.prepare(`UPDATE verbs SET auxiliary='essere' WHERE infinitive='correre'`).run();
    db.prepare(`UPDATE verbs SET auxiliary='essere' WHERE infinitive='vivere'`).run();
    [
      ['camminare','intransitive'],['andare','intransitive'],['stare','intransitive'],
      ['arrivare','intransitive'],['entrare','intransitive'],['tornare','intransitive'],
      ['partire','intransitive'],['dormire','intransitive'],['uscire','intransitive'],
      ['nascere','intransitive'],['morire','intransitive'],['crescere','intransitive'],
      ['rimanere','intransitive'],['restare','intransitive'],['essere','intransitive'],
      ['piacere','intransitive'],['mancare','intransitive'],['sedere','intransitive'],
      ['salire','intransitive'],['correre','intransitive'],['vivere','intransitive'],
      ['interessare','intransitive'],
    ].forEach(([inf,tr]) => {
      try { db.prepare(`UPDATE verbs SET transitivity=? WHERE infinitive=?`).run(tr,inf); } catch(_) {}
    });
  } catch(_) {}

  // ── Phase 5B: auxiliary_variants for variable-auxiliary verbs ─────────────────
  try {
    const setVar = db.prepare(`UPDATE verbs SET auxiliary=?,auxiliary_variants=?,auxiliary_note=? WHERE infinitive=?`);
    [
      ['passare','essere','[{"aux":"avere","ctx":"uso transitivo: ho passato una bella giornata"},{"aux":"essere","ctx":"movimento: sono passato da casa"}]','Transitivo→avere; intransitivo→essere'],
      ['salire','essere','[{"aux":"avere","ctx":"uso transitivo: ho salito le scale"},{"aux":"essere","ctx":"intransitivo: sono salito al terzo piano"}]','Transitivo→avere; intransitivo→essere'],
      ['correre','essere','[{"aux":"avere","ctx":"sport generico: ho corso"},{"aux":"essere","ctx":"con destinazione: sono corso in ospedale"}]','Variazione nell\'uso contemporaneo'],
      ['vivere','essere','[{"aux":"avere","ctx":"ho vissuto esperienze bellissime"},{"aux":"essere","ctx":"sono vissuto a Roma per anni"}]','Variazione: avere con oggetto, essere senza'],
      ['finire','essere','[{"aux":"essere","ctx":"azione giunta a termine: il film è finito"},{"aux":"avere","ctx":"uso transitivo: ho finito il lavoro"}]','Intransitivo→essere; transitivo→avere'],
    ].forEach(([inf,aux,variants,note]) => {
      try { setVar.run(aux,variants,note,inf); } catch(_) {}
    });
  } catch(_) {}

  // ── Phase 5B: Critical conjugation forms (INSERT OR REPLACE) ─────────────────
  try {
    const insFormR = db.prepare(`INSERT OR REPLACE INTO verb_conjugations(verb_id,tense,person,form) SELECT v.id,?,?,? FROM verbs v WHERE v.infinitive=?`);
    const critForms = [
      ['essere','present_indicative','io','sono'],['essere','present_indicative','tu','sei'],
      ['essere','present_indicative','lui/lei','è'],['essere','present_indicative','noi','siamo'],
      ['essere','present_indicative','voi','siete'],['essere','present_indicative','loro','sono'],
      ['avere','present_indicative','io','ho'],['avere','present_indicative','tu','hai'],
      ['avere','present_indicative','lui/lei','ha'],['avere','present_indicative','noi','abbiamo'],
      ['avere','present_indicative','voi','avete'],['avere','present_indicative','loro','hanno'],
      ['andare','present_indicative','io','vado'],['andare','present_indicative','tu','vai'],
      ['andare','present_indicative','lui/lei','va'],['andare','present_indicative','noi','andiamo'],
      ['andare','present_indicative','voi','andate'],['andare','present_indicative','loro','vanno'],
      ['fare','present_indicative','io','faccio'],['fare','present_indicative','tu','fai'],
      ['fare','present_indicative','lui/lei','fa'],['fare','present_indicative','noi','facciamo'],
      ['fare','present_indicative','voi','fate'],['fare','present_indicative','loro','fanno'],
      ['venire','present_indicative','io','vengo'],['venire','present_indicative','tu','vieni'],
      ['venire','present_indicative','lui/lei','viene'],['venire','present_indicative','noi','veniamo'],
      ['venire','present_indicative','voi','venite'],['venire','present_indicative','loro','vengono'],
      ['andare','future_simple','io','andrò'],['andare','future_simple','tu','andrai'],
      ['andare','future_simple','lui/lei','andrà'],['andare','future_simple','noi','andremo'],
      ['andare','future_simple','voi','andrete'],['andare','future_simple','loro','andranno'],
      ['essere','future_simple','io','sarò'],['essere','future_simple','tu','sarai'],
      ['essere','future_simple','lui/lei','sarà'],['essere','future_simple','noi','saremo'],
      ['essere','future_simple','voi','sarete'],['essere','future_simple','loro','saranno'],
      ['avere','future_simple','io','avrò'],['avere','future_simple','tu','avrai'],
      ['avere','future_simple','lui/lei','avrà'],['avere','future_simple','noi','avremo'],
      ['avere','future_simple','voi','avrete'],['avere','future_simple','loro','avranno'],
      ['fare','future_simple','io','farò'],['fare','future_simple','tu','farai'],
      ['fare','future_simple','lui/lei','farà'],['fare','future_simple','noi','faremo'],
      ['fare','future_simple','voi','farete'],['fare','future_simple','loro','faranno'],
      ['essere','subjunctive_present','io','sia'],['essere','subjunctive_present','tu','sia'],
      ['essere','subjunctive_present','lui/lei','sia'],['essere','subjunctive_present','noi','siamo'],
      ['essere','subjunctive_present','voi','siate'],['essere','subjunctive_present','loro','siano'],
      ['avere','subjunctive_present','io','abbia'],['avere','subjunctive_present','tu','abbia'],
      ['avere','subjunctive_present','lui/lei','abbia'],['avere','subjunctive_present','noi','abbiamo'],
      ['avere','subjunctive_present','voi','abbiate'],['avere','subjunctive_present','loro','abbiano'],
      ['piacere','present_indicative','lui/lei','piace'],['piacere','present_indicative','loro','piacciono'],
      ['capire','present_indicative','io','capisco'],['capire','present_indicative','tu','capisci'],
      ['capire','present_indicative','lui/lei','capisce'],['capire','present_indicative','noi','capiamo'],
      ['capire','present_indicative','voi','capite'],['capire','present_indicative','loro','capiscono'],
      ['finire','present_indicative','io','finisco'],['finire','present_indicative','tu','finisci'],
      ['finire','present_indicative','lui/lei','finisce'],['finire','present_indicative','noi','finiamo'],
      ['finire','present_indicative','voi','finite'],['finire','present_indicative','loro','finiscono'],
      ['uscire','present_indicative','io','esco'],['uscire','present_indicative','tu','esci'],
      ['uscire','present_indicative','lui/lei','esce'],['uscire','present_indicative','noi','usciamo'],
      ['uscire','present_indicative','voi','uscite'],['uscire','present_indicative','loro','escono'],
      ['sapere','present_indicative','io','so'],['sapere','present_indicative','tu','sai'],
      ['sapere','present_indicative','lui/lei','sa'],['sapere','present_indicative','noi','sappiamo'],
      ['sapere','present_indicative','voi','sapete'],['sapere','present_indicative','loro','sanno'],
      ['dare','present_indicative','io','do'],['dare','present_indicative','tu','dai'],
      ['dare','present_indicative','lui/lei','dà'],['dare','present_indicative','noi','diamo'],
      ['dare','present_indicative','voi','date'],['dare','present_indicative','loro','danno'],
      ['stare','present_indicative','io','sto'],['stare','present_indicative','tu','stai'],
      ['stare','present_indicative','lui/lei','sta'],['stare','present_indicative','noi','stiamo'],
      ['stare','present_indicative','voi','state'],['stare','present_indicative','loro','stanno'],
      ['bere','present_indicative','io','bevo'],['bere','present_indicative','tu','bevi'],
      ['bere','present_indicative','lui/lei','beve'],['bere','present_indicative','noi','beviamo'],
      ['bere','present_indicative','voi','bevete'],['bere','present_indicative','loro','bevono'],
      ['dire','present_indicative','io','dico'],['dire','present_indicative','tu','dici'],
      ['dire','present_indicative','lui/lei','dice'],['dire','present_indicative','noi','diciamo'],
      ['dire','present_indicative','voi','dite'],['dire','present_indicative','loro','dicono'],
      ['rimanere','present_indicative','io','rimango'],['rimanere','present_indicative','tu','rimani'],
      ['rimanere','present_indicative','lui/lei','rimane'],['rimanere','present_indicative','noi','rimaniamo'],
      ['rimanere','present_indicative','voi','rimanete'],['rimanere','present_indicative','loro','rimangono'],
      ['scegliere','present_indicative','io','scelgo'],['scegliere','present_indicative','tu','scegli'],
      ['scegliere','present_indicative','lui/lei','sceglie'],['scegliere','present_indicative','noi','scegliamo'],
      ['scegliere','present_indicative','voi','scegliete'],['scegliere','present_indicative','loro','scelgono'],
      ['tenere','present_indicative','io','tengo'],['tenere','present_indicative','tu','tieni'],
      ['tenere','present_indicative','lui/lei','tiene'],['tenere','present_indicative','noi','teniamo'],
      ['tenere','present_indicative','voi','tenete'],['tenere','present_indicative','loro','tengono'],
      ['morire','present_indicative','io','muoio'],['morire','present_indicative','tu','muori'],
      ['morire','present_indicative','lui/lei','muore'],['morire','present_indicative','noi','moriamo'],
      ['morire','present_indicative','voi','morite'],['morire','present_indicative','loro','muoiono'],
      ['salire','present_indicative','io','salgo'],['salire','present_indicative','tu','sali'],
      ['salire','present_indicative','lui/lei','sale'],['salire','present_indicative','noi','saliamo'],
      ['salire','present_indicative','voi','salite'],['salire','present_indicative','loro','salgono'],
      ['sedere','present_indicative','io','siedo'],['sedere','present_indicative','tu','siedi'],
      ['sedere','present_indicative','lui/lei','siede'],['sedere','present_indicative','noi','sediamo'],
      ['sedere','present_indicative','voi','sedete'],['sedere','present_indicative','loro','siedono'],
      ['potere','present_indicative','io','posso'],['potere','present_indicative','tu','puoi'],
      ['potere','present_indicative','lui/lei','può'],['potere','present_indicative','noi','possiamo'],
      ['potere','present_indicative','voi','potete'],['potere','present_indicative','loro','possono'],
      ['volere','present_indicative','io','voglio'],['volere','present_indicative','tu','vuoi'],
      ['volere','present_indicative','lui/lei','vuole'],['volere','present_indicative','noi','vogliamo'],
      ['volere','present_indicative','voi','volete'],['volere','present_indicative','loro','vogliono'],
      ['dovere','present_indicative','io','devo'],['dovere','present_indicative','tu','devi'],
      ['dovere','present_indicative','lui/lei','deve'],['dovere','present_indicative','noi','dobbiamo'],
      ['dovere','present_indicative','voi','dovete'],['dovere','present_indicative','loro','devono'],
      ['venire','future_simple','io','verrò'],['venire','future_simple','tu','verrai'],
      ['venire','future_simple','lui/lei','verrà'],['venire','future_simple','noi','verremo'],
      ['venire','future_simple','voi','verrete'],['venire','future_simple','loro','verranno'],
    ];
    critForms.forEach(([inf,tense,person,form]) => {
      try { insFormR.run(tense,person,form,inf); } catch(_) {}
    });
  } catch(_) {}

  // ── Phase 5B: Additional conjugation exercises ────────────────────────────────
  try {
    const insExB = db.prepare(`INSERT OR REPLACE INTO conjugation_exercises(id,exercise_type,verb_id,tense_id,person,prompt_it,prompt_es,correct_answers,accepted_variants,distractors,explanation_it,explanation_es,difficulty,cefr,context_sentence,target_form) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const gV = (inf) => { const r = db.prepare('SELECT id FROM verbs WHERE infinitive=?').get(inf); return r ? r.id : null; };
    const exB = [
      // single_form — passato prossimo with subjects
      ['conj_s_036','single_form',gV('andare'),'passato_prossimo','Marco (m)','Marco ___ a casa. (andare)','Marco went home.','["è andato"]','[]','["ha andato","è andata","ha andato"]','Con "andare" si usa "essere". Soggetto maschile singolare: è andato.',null,2,'A2','Marco è andato a casa.','è andato'],
      ['conj_s_037','single_form',gV('andare'),'passato_prossimo','Giulia (f)','Giulia ___ a casa. (andare)','Giulia went home.','["è andata"]','[]','["ha andato","è andato","ha andata"]','Con "andare" si usa "essere". Soggetto femminile singolare: è andata.',null,2,'A2','Giulia è andata a casa.','è andata'],
      ['conj_s_038','single_form',gV('uscire'),'passato_prossimo','io (m)','Ieri io ___ tardi. (uscire)','Yesterday I left late.','["sono uscito"]','["uscito"]','["ho uscito","sono uscita","è uscito"]','Con "uscire" si usa "essere". Maschile: uscito.',null,2,'A2','Ieri sono uscito tardi.','sono uscito'],
      ['conj_s_039','single_form',gV('uscire'),'passato_prossimo','io (f)','Ieri io ___ tardi. (uscire — femminile)','Yesterday I (f) left late.','["sono uscita"]','["uscita"]','["ho uscito","sono uscito","è uscita"]','Con "uscire" si usa "essere". Femminile: uscita.',null,2,'A2','Ieri sono uscita tardi.','sono uscita'],
      ['conj_s_040','single_form',gV('arrivare'),'passato_prossimo','Marco e Luca (m pl)','Marco e Luca ___ in ritardo. (arrivare)','Marco and Luca arrived late.','["sono arrivati"]','[]','["hanno arrivato","è arrivati","sono arrivato"]','Con "arrivare" si usa "essere". Maschile plurale: arrivati.',null,2,'A2','Marco e Luca sono arrivati in ritardo.','sono arrivati'],
      // single_form — irregular presents
      ['conj_s_041','single_form',gV('venire'),'present_indicative','io','io ___ (venire)','I come.','["vengo"]','[]','["veno","viene","vengo"]','Venire è irregolare al presente: vengo.',null,1,'A2','Vengo anche io.',null],
      ['conj_s_042','single_form',gV('venire'),'present_indicative','loro','loro ___ (venire)','They come.','["vengono"]','[]','["venono","vanno","vengano"]','Venire: loro vengono.',null,1,'A2','Vengono domani.',null],
      ['conj_s_043','single_form',gV('sapere'),'present_indicative','io','io ___ (sapere)','I know.','["so"]','[]','["sao","sappo","sapisco"]','Sapere è irregolare: io so.',null,2,'A2','So parlare italiano.',null],
      ['conj_s_044','single_form',gV('sapere'),'present_indicative','loro','loro ___ (sapere)','They know.','["sanno"]','[]','["sapono","sapono","sannono"]','Sapere: loro sanno.',null,2,'A2','Sanno cucinare bene.',null],
      ['conj_s_045','single_form',gV('potere'),'present_indicative','io','io ___ (potere)','I can.','["posso"]','[]','["poto","potisco","puopo"]','Potere: io posso.',null,1,'A2','Non posso venire stasera.',null],
      ['conj_s_046','single_form',gV('potere'),'present_indicative','loro','loro ___ (potere)','They can.','["possono"]','[]','["potono","possonno","potonno"]','Potere: loro possono.',null,1,'A2','Non possono dormire.',null],
      ['conj_s_047','single_form',gV('dovere'),'present_indicative','io','io ___ (dovere)','I must.','["devo"]','["debbo"]','["devo","debo","dovisco"]','Dovere: io devo (o debbo, più formale).',null,1,'A2','Devo studiare.',null],
      ['conj_s_048','single_form',gV('volere'),'present_indicative','io','io ___ (volere)','I want.','["voglio"]','[]','["volo","vuolo","voglo"]','Volere: io voglio.',null,1,'A2',"Voglio imparare l'italiano.",null],
      ['conj_s_049','single_form',gV('volere'),'present_indicative','tu','tu ___ (volere)','You want.','["vuoi"]','[]','["voli","vuole","voglio"]','Volere: tu vuoi.',null,1,'A2','Vuoi un caffè?',null],
      ['conj_s_050','single_form',gV('dire'),'present_indicative','io','io ___ (dire)','I say.','["dico"]','[]','["dio","dico","disce"]','Dire è irregolare: io dico.',null,2,'B1','Dico sempre la verità.',null],
      ['conj_s_051','single_form',gV('dire'),'present_indicative','voi','voi ___ (dire)','You say (plural).','["dite"]','[]','["dicete","dite","dicono"]','Dire: voi dite.',null,2,'B1','Dite sempre bugie.',null],
      ['conj_s_052','single_form',gV('bere'),'present_indicative','io','io ___ (bere)','I drink.','["bevo"]','[]','["bero","berisco","bevisco"]','Bere: io bevo.',null,1,'A2','Bevo un caffè ogni mattina.',null],
      ['conj_s_053','single_form',gV('bere'),'present_indicative','loro','loro ___ (bere)','They drink.','["bevono"]','[]','["berono","bevano","bevonno"]','Bere: loro bevono.',null,1,'A2','Non bevono alcolici.',null],
      ['conj_s_054','single_form',gV('rimanere'),'present_indicative','io','io ___ (rimanere)','I stay/remain.','["rimango"]','[]','["rimano","rimango","rimanisco"]','Rimanere: io rimango.',null,2,'B1','Rimango a casa stasera.',null],
      ['conj_s_055','single_form',gV('scegliere'),'present_indicative','io','io ___ (scegliere)','I choose.','["scelgo"]','[]','["scelgio","scelisco","scelgo"]','Scegliere: io scelgo.',null,2,'B1','Scelgo sempre il più difficile.',null],
      // imperfetto
      ['conj_s_056','single_form',gV('giocare'),'imperfect_indicative','io','Da bambino io ___ (giocare)','As a child I used to play.','["giocavo"]','[]','["giocai","giocherò","gioco"]','Imperfetto: io giocavo. Descrive abitudine nel passato.',null,1,'A2','Da bambino giocavo sempre a calcio.',null],
      ['conj_s_057','single_form',gV('dormire'),'imperfect_indicative','lui/lei','Quando era piccola, lei ___ (dormire)','When she was little, she slept.','["dormiva"]','[]','["dormì","dormirà","dorme"]','Imperfetto: lei dormiva. Descrive uno stato o azione abituale nel passato.',null,1,'A2','Quando era piccola dormiva molto.',null],
      ['conj_s_058','single_form',gV('essere'),'imperfect_indicative','io','Da studente io ___ (essere)','As a student I was.','["ero"]','[]','["sono stato","sarò","sono"]','Essere - imperfetto: io ero.',null,2,'A2','Da studente ero molto stressato.',null],
      // futuro
      ['conj_s_059','single_form',gV('venire'),'future_simple','tu','domani tu ___ (venire)','Tomorrow you will come.','["verrai"]','[]','["vieni","verresti","venivi"]','Venire - futuro irregolare: verrai.',null,2,'A2','Domani verrai con noi?',null],
      ['conj_s_060','single_form',gV('fare'),'future_simple','noi','noi ___ (fare)','We will do.','["faremo"]','[]','["fareremo","faceremo","faremo"]','Fare - futuro: faremo. Radice far-.',null,2,'A2','Domani faremo una passeggiata.',null],
      // condizionale
      ['conj_s_061','single_form',gV('venire'),'conditional_present','io','se potessi ___ (venire)','If I could I would come.','["verrei"]','[]','["venivo","verrò","venivo"]','Condizionale presente: verrei.',null,2,'B1','Se potessi verrei subito.',null],
      ['conj_s_062','single_form',gV('volere'),'conditional_present','io','mi ___ un caffè. (volere)','I would like a coffee.','["vorrei"]','[]','["voglio","volevo","voglio"]','Condizionale: vorrei. Forma di cortesia molto frequente.',null,1,'A2','Vorrei un caffè, grazie.',null],
      // congiuntivo
      ['conj_s_063','single_form',gV('andare'),'subjunctive_present','lui/lei','Penso che lui ___ a casa. (andare)','I think he goes home.','["vada"]','[]','["va","andrà","vadano"]','Congiuntivo presente: lui vada.',null,3,'B1','Penso che vada a casa.',null],
      ['conj_s_064','single_form',gV('capire'),'subjunctive_present','loro','Bisogna che loro ___ (capire)','They need to understand.','["capiscano"]','[]','["capono","capiscono","capino"]','Capire - congiuntivo presente: capiscano (-isc al congiuntivo).',null,3,'B1','Bisogna che capiscano la regola.',null],
      ['conj_s_065','single_form',gV('potere'),'subjunctive_present','io','Spero che io ___ (potere)','I hope I can.','["possa"]','[]','["posso","potrò","potessi"]','Potere - congiuntivo: io possa.',null,3,'B1','Spero che possa venire.',null],
      // choose_tense
      ['conj_ct_011','choose_tense',gV('giocare'),'imperfect_indicative',null,'Quando ero piccolo, ___ spesso con i miei amici. (giocare)','Cuando era pequeño, jugaba con mis amigos.','["giocavo"]','[]','["ho giocato","giocherò","gioco"]','Imperfetto per abitudine nel passato.',null,2,'A2',null,'giocavo'],
      ['conj_ct_012','choose_tense',gV('lavorare'),'passato_prossimo',null,'Ieri Marco ___ tutto il giorno. (lavorare)','Ayer Marco trabajó todo el día.','["ha lavorato"]','[]','["lavorava","lavorerà","lavora"]','Passato prossimo per evento completato in un momento specifico.',null,2,'A2',null,'ha lavorato'],
      ['conj_ct_013','choose_tense',gV('studiare'),'imperfect_indicative',null,'Mentre lei ___, è arrivato lui. (studiare)','Mientras ella estudiaba, llegó él.','["studiava"]','[]','["ha studiato","studierà","studia"]','Imperfetto per azione in corso interrotta.',null,2,'A2',null,'studiava'],
      ['conj_ct_014','choose_tense',gV('abitare'),'future_simple',null,'L\'anno prossimo ___ a Milano. (abitare)','El año que viene viviré en Milán.','["abiterò"]','[]','["abito","abitavo","ho abitato"]','Futuro per intenzione futura.',null,1,'A2',null,'abiterò'],
      ['conj_ct_015','choose_tense',gV('leggere'),'conditional_present',null,'Con più tempo, ___ di più. (leggere)','Con más tiempo, leería más.','["leggerei"]','[]','["leggo","leggevo","leggerò"]','Condizionale per situazione ipotetica.',null,2,'B1',null,'leggerei'],
      ['conj_ct_016','choose_tense',gV('andare'),'passato_prossimo',null,'La settimana scorsa noi ___ al ristorante. (andare)','La semana pasada fuimos al restaurante.','["siamo andati"]','[]','["andavamo","andremo","andiamo"]','Passato prossimo con evento specifico nel passato.',null,2,'A2',null,'siamo andati'],
      ['conj_ct_017','choose_tense',null,'imperfect_indicative',null,'Da giovane mia nonna ___ bene. (cucinare)','De joven, mi abuela cocinaba bien.','["cucinava"]','[]','["ha cucinato","cucinerà","cucina"]','Imperfetto per abilità o abitudine nel passato.',null,1,'A2',null,'cucinava'],
      ['conj_ct_018','choose_tense',gV('avere'),'subjunctive_present',null,'Non credo che lui ___ ragione. (avere)','No creo que tenga razón.','["abbia"]','[]','["ha","aveva","avrà"]','Congiuntivo dopo "non credo che".',null,3,'B1',null,'abbia'],
      ['conj_ct_019','choose_tense',null,'passato_prossimo',null,'Stamattina io ___ alle sei. (svegliarsi — m)','Esta mañana me desperté a las seis.','["mi sono svegliato"]','[]','["mi svegliavo","mi sveglierò","mi sveglio"]','Riflessivo al passato prossimo con essere: mi sono svegliato.',null,2,'A2',null,'mi sono svegliato'],
      ['conj_ct_020','choose_tense',gV('partire'),'future_simple',null,'Domani ___ in vacanza. (partire — loro)','Mañana se van de vacaciones.','["partiranno"]','[]','["partono","partivano","sono partiti"]','Futuro semplice per evento futuro pianificato.',null,1,'A2',null,'partiranno'],
      // prossimo_vs_imperfetto
      ['conj_pi_011','prossimo_vs_imperfetto',gV('leggere'),'imperfect_indicative',null,'Mentre Maria ___ (leggere), il telefono ha squillato.','Mientras María leía, sonó el teléfono.','["leggeva"]','[]','["ha letto","leggerà","legge"]','Azione in corso (imperfetto) interrotta da evento (passato prossimo).',null,2,'A2',null,'leggeva'],
      ['conj_pi_012','prossimo_vs_imperfetto',gV('bere'),'imperfect_indicative',null,'Ogni mattina io ___ (bere) un caffè al bar.','Cada mañana me tomaba un café en el bar.','["bevevo"]','[]','["ho bevuto","berrò","bevo"]','Abitudine nel passato: imperfetto.',null,1,'A2',null,'bevevo'],
      ['conj_pi_013','prossimo_vs_imperfetto',gV('andare'),'passato_prossimo',null,"L'anno scorso noi ___ in Sardegna. (andare)",'El año pasado fuimos a Cerdeña.','["siamo andati"]','[]','["andavamo","andremo","andiamo"]','Evento specifico nel passato: passato prossimo.',null,2,'A2',null,'siamo andati'],
      ['conj_pi_014','prossimo_vs_imperfetto',gV('avere'),'imperfect_indicative',null,"Quando ___ (avere) vent'anni, lei viveva a Londra.",'Cuando tenía veinte años, vivía en Londres.','["aveva"]','[]','["ha avuto","avrà","ha"]','Condizione/stato nel passato: imperfetto.',null,2,'A2',null,'aveva'],
      ['conj_pi_015','prossimo_vs_imperfetto',gV('dormire'),'imperfect_indicative',null,'Da bambina lei ___ (dormire) molto.','De niña ella dormía mucho.','["dormiva"]','[]','["ha dormito","dormirà","dorme"]','Abitudine nel passato: imperfetto.',null,1,'A2',null,'dormiva'],
      // verbi_speciali
      ['conj_vs_011','verbi_speciali',gV('piacere'),'present_indicative',null,'___ le lingue straniere. (a me)','Me gustan los idiomas extranjeros.','["mi piacciono"]','[]','["mi piace","mi piacono","mi piacono"]','"Lingue" è plurale: mi piacciono. Il soggetto grammaticale è "le lingue".',null,2,'A2','Mi piacciono le lingue straniere.','mi piacciono'],
      ['conj_vs_012','verbi_speciali',gV('piacere'),'present_indicative',null,'A Marco ___ il calcio.','A Marco le gusta el fútbol.','["piace"]','[]','["piacciono","piacono","piaccia"]','Il soggetto è "il calcio" (singolare): piace.',null,1,'A1','A Marco piace il calcio.','piace'],
      ['conj_vs_013','verbi_speciali',gV('mancare'),'present_indicative',null,'Mi ___ i miei amici.','Echo de menos a mis amigos.','["mancano"]','[]','["manca","mi manco","mancano"]','"Gli amici" è plurale: mancano.',null,2,'A2','Mi mancano i miei amici.','mancano'],
      ['conj_vs_014','verbi_speciali',gV('mancare'),'present_indicative',null,'Ti ___ Roma?','¿Echas de menos Roma?','["manca"]','[]','["mancano","ti manco","manchi"]','"Roma" è singolare: manca.',null,1,'A2','Ti manca Roma?','manca'],
      ['conj_vs_015','verbi_speciali',gV('interessare'),'present_indicative',null,'Le ___ i film italiani? (a Lei, formale)','¿Le interesan las películas italianas?','["interessano"]','[]','["interessa","le interessa","interessino"]','"I film" è plurale: interessano. Forma di cortesia: Le.',null,2,'B1','Le interessano i film italiani?','interessano'],
      ['conj_vs_016','verbi_speciali',gV('interessare'),'present_indicative',null,'A Giulia ___ la musica jazz.','A Giulia le interesa el jazz.','["interessa"]','[]','["interessano","interessi","interessa"]','"La musica" è singolare: interessa.',null,1,'A2','A Giulia interessa la musica jazz.','interessa'],
      ['conj_vs_017','verbi_speciali',gV('piacere'),'present_indicative',null,'A loro ___ i film di Fellini.','Les gustan las películas de Fellini.','["piacciono"]','[]','["piace","piacciono","piacono"]','"I film" è plurale: piacciono.',null,2,'A2','A loro piacciono i film di Fellini.','piacciono'],
      ['conj_vs_018','verbi_speciali',gV('mancare'),'present_indicative',null,'Mi ___ dormire.','Echo de menos dormir.','["manca"]','[]','["mancano","mi manchi","mancasse"]','"Dormire" è un infinito (singolare): manca.',null,2,'B1','Mi manca dormire di più.','manca'],
      // irregolarita
      ['conj_irr_001','irregolarita',gV('andare'),'future_simple','io','Qual è il futuro di "andare" per io?',null,'["andrò"]','[]','["anderò","vado","andevo"]','Futuro irregolare di andare: and- → andr-. Io andrò.',null,2,'A2',null,'andrò'],
      ['conj_irr_002','irregolarita',gV('essere'),'future_simple','io','Qual è il futuro di "essere" per io?',null,'["sarò"]','[]','["esserò","sono","ero"]','Futuro irregolare di essere: sar-. Io sarò.',null,2,'A2',null,'sarò'],
      ['conj_irr_003','irregolarita',gV('fare'),'future_simple','io','Qual è il futuro di "fare" per io?',null,'["farò"]','[]','["farerò","facerò","farisco"]','Futuro irregolare di fare: far-. Io farò.',null,2,'A2',null,'farò'],
      ['conj_irr_004','irregolarita',gV('capire'),'present_indicative','io','Qual è la forma di "capire" per io (verbo in -isc)?',null,'["capisco"]','[]','["capo","cappo","capgo"]','I verbi in -isc aggiungono -isc tra la radice e la terminazione: capisco.',null,1,'A2',null,'capisco'],
      ['conj_irr_005','irregolarita',gV('capire'),'present_indicative','noi','Qual è la forma di "capire" per noi (verbo in -isc)?',null,'["capiamo"]','[]','["capisciamo","capiscamo","capiamo"]','Per noi e voi i verbi in -isc NON aggiungono -isc: capiamo.',null,2,'A2',null,'capiamo'],
      ['conj_irr_006','irregolarita',gV('vedere'),'passato_prossimo','io','Qual è il participio passato di "vedere"?',null,'["visto"]','["veduto"]','["vedato","vedere","veduto"]','Vedere ha un participio irregolare: visto (o veduto, meno comune).',null,1,'A2',null,'visto'],
      ['conj_irr_007','irregolarita',gV('prendere'),'passato_prossimo','io','Qual è il participio passato di "prendere"?',null,'["preso"]','[]','["prenduto","prendito","prendato"]','Prendere ha un participio irregolare: preso.',null,1,'A2',null,'preso'],
      // riflessivi
      ['conj_rif_001','riflessivi',null,'present_indicative','io','io ___ (chiamarsi)','My name is... (I am called...)','["mi chiamo"]','[]','["chiamo","si chiama","mi chiamisco"]','Riflessivo: mi chiamo. Pronome riflessivo mi + forma verbale.',null,1,'A1','Mi chiamo Marco.','mi chiamo'],
      ['conj_rif_002','riflessivi',null,'passato_prossimo','Giulia (f)','Stamattina Giulia ___ (svegliarsi)','This morning Giulia woke up.','["si è svegliata"]','["si è svegliata"]','["ha svegliato","si ha svegliata","si è svegliato"]','Riflessivo al passato prossimo: si è svegliata. Essere + participio concorde (femminile).',null,2,'A2','Stamattina Giulia si è svegliata presto.','si è svegliata'],
      ['conj_rif_003','riflessivi',null,'passato_prossimo','io (m)','Ieri io ___ (lavarsi)','Yesterday I washed myself.','["mi sono lavato"]','["lavato"]','["ho lavato","si sono lavato","mi sono lavata"]','Riflessivo con essere: mi sono lavato (m).',null,2,'A2','Ieri mi sono lavato i capelli.','mi sono lavato'],
      ['conj_rif_004','riflessivi',null,'present_indicative','io','io ___ (fermarsi)','I stop.','["mi fermo"]','[]','["fermo","si ferma","mi fermisco"]','Fermarsi: mi fermo.',null,1,'A1','Mi fermo qui per un momento.','mi fermo'],
      ['conj_rif_005','riflessivi',null,'present_indicative','lui/lei','lui/lei ___ (vestirsi)','He/she gets dressed.','["si veste"]','[]','["veste","si vestisce","si vesta"]','Vestirsi: lui si veste. Non usa -isc.',null,1,'A2','Si veste sempre elegante.','si veste'],
      // additional riflessivi — 2 per verb, all 8 priority verbs
      ['conj_rif_006','riflessivi',null,'present_indicative','io','io ___ il suo nome. (ricordarsi)','I remember his name.','["mi ricordo"]','[]','["ricordo","si ricorda","mi ricordisco"]','Ricordarsi: mi ricordo. Non usa -isc.',null,1,'A2','Mi ricordo il suo nome.','mi ricordo'],
      ['conj_rif_007','riflessivi',null,'passato_prossimo','Giulia (f)','Giulia ___ di chiamare. (ricordarsi)','Giulia remembered to call.','["si è ricordata"]','[]','["ha ricordato","si è ricordato","si ha ricordata"]','Ricordarsi al passato prossimo con essere. Femminile: ricordata.',null,2,'A2','Giulia si è ricordata di chiamare.','si è ricordata'],
      ['conj_rif_008','riflessivi',null,'present_indicative','io','Come ___ oggi? (sentirsi)','How do I feel today?','["mi sento"]','[]','["sento","si sente","mi sentisco"]','Sentirsi: mi sento.',null,1,'A2','Come mi sento oggi?','mi sento'],
      ['conj_rif_009','riflessivi',null,'passato_prossimo','noi (m pl)','Ieri noi non ___ bene. (sentirsi)','Yesterday we did not feel well.','["ci siamo sentiti"]','[]','["abbiamo sentito","ci siamo sentite","siamo sentiti"]','Sentirsi al passato prossimo: ci siamo sentiti (maschile/misto plurale).',null,2,'A2','Ieri non ci siamo sentiti bene.','ci siamo sentiti'],
      ['conj_rif_010','riflessivi',null,'present_indicative','lui/lei','Ogni mattina lui ___ in fretta. (vestirsi)','Every morning he gets dressed quickly.','["si veste"]','[]','["veste","si vestisce","si veste"]','Vestirsi: lui si veste.',null,1,'A2','Ogni mattina si veste in fretta.','si veste'],
      ['conj_rif_011','riflessivi',null,'passato_prossimo','le ragazze (f pl)','Le ragazze ___ in fretta. (vestirsi)','The girls got dressed quickly.','["si sono vestite"]','[]','["si sono vestiti","hanno vestito","si hanno vestite"]','Vestirsi al passato prossimo: si sono vestite. Femminile plurale.',null,2,'A2','Le ragazze si sono vestite in fretta.','si sono vestite'],
      ['conj_rif_012','riflessivi',null,'present_indicative','io','A che ora ___ di solito? (alzarsi)','What time do you usually get up?','["mi alzo"]','[]','["alzo","si alza","mi alzisco"]','Alzarsi: mi alzo.',null,1,'A1','Di solito mi alzo alle sette.','mi alzo'],
      ['conj_rif_013','riflessivi',null,'passato_prossimo','Marco (m)','Stamattina Marco ___ molto presto. (alzarsi)','This morning Marco got up very early.','["si è alzato"]','[]','["ha alzato","si è alzata","si ha alzato"]','Alzarsi al passato prossimo con essere. Maschile: alzato.',null,1,'A2','Stamattina Marco si è alzato molto presto.','si è alzato'],
      ['conj_rif_014','riflessivi',null,'present_indicative','loro','Per favore, ___ ! (sedersi)','Please, sit down!','["si siedono"]','[]','["si sedono","siedono","si sedano"]','Sedersi: loro si siedono.',null,2,'A2','Per favore si siedono tutti.','si siedono'],
      ['conj_rif_015','riflessivi',null,'passato_prossimo','io (f)','Mi ___ vicino alla finestra. (sedersi)','I sat down near the window.','["mi sono seduta"]','["seduta"]','["ho seduto","mi sono seduto","mi sono sieda"]','Sedersi al passato prossimo con essere. Femminile: seduta.',null,2,'A2','Mi sono seduta vicino alla finestra.','mi sono seduta'],
      ['conj_rif_016','riflessivi',null,'passato_prossimo','i bambini (m pl)','I bambini ___ le mani. (lavarsi)','The children washed their hands.','["si sono lavati"]','[]','["hanno lavato","si sono lavate","si ha lavato"]','Lavarsi al passato prossimo: si sono lavati (maschile plurale).',null,2,'A2','I bambini si sono lavati le mani.','si sono lavati'],
      ['conj_rif_017','riflessivi',null,'present_indicative','lui/lei','Come ___ tua sorella? (chiamarsi)','What is your sister\'s name?','["si chiama"]','[]','["chiama","si chiamisce","chiamasi"]','Chiamarsi: lei si chiama.',null,1,'A1','Come si chiama tua sorella?','si chiama'],
      ['conj_rif_018','riflessivi',null,'passato_prossimo','il treno (m)','Il treno ___ alla stazione. (fermarsi)','The train stopped at the station.','["si è fermato"]','[]','["ha fermato","si è fermata","si ha fermato"]','Fermarsi al passato prossimo con essere: si è fermato.',null,1,'A2','Il treno si è fermato alla stazione.','si è fermato'],
      ['conj_rif_019','riflessivi',null,'present_indicative','voi','A che ora ___ domani? (svegliarsi)','What time are you (pl) waking up tomorrow?','["vi svegliate"]','[]','["vi sveglite","si svegliate","vi svegliete"]','Svegliarsi: voi vi svegliate.',null,2,'A2','A che ora vi svegliate domani?','vi svegliate'],
      ['conj_rif_020','riflessivi',null,'passato_prossimo','Marco e Giulia','Marco e Giulia ___ tardi. (svegliarsi)','Marco and Giulia woke up late.','["si sono svegliati"]','[]','["si sono svegliate","hanno svegliato","si è svegliati"]','Gruppo misto (m+f): si sono svegliati. Il gruppo misto usa il maschile plurale.',null,3,'A2','Marco e Giulia si sono svegliati tardi.','si sono svegliati'],
    ];
    exB.forEach(e => { try { insExB.run(...e); } catch(_) {} });
  } catch(_) {}

  // ── 10 MISSING REFLEXIVE VERBS ──────────────────────────────────────────
  try {
    const insV2 = db.prepare(`INSERT OR IGNORE INTO verbs(infinitive,translation,conjugation_group,is_regular,is_isc,auxiliary,past_participle,gerund,transitivity,irregularity_tags,review_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    [
      ['aiutare','to help','are',1,0,'avere','aiutato','aiutando','transitive','[]','ok'],
      ['alzarsi','to get up','are',1,0,'essere','alzato','alzandosi','intransitive','[]','ok'],
      ['chiamarsi','to be called','are',1,0,'essere','chiamato','chiamandosi','intransitive','[]','ok'],
      ['fermarsi','to stop','are',1,0,'essere','fermato','fermandosi','intransitive','[]','ok'],
      ['lavarsi','to wash oneself','are',1,0,'essere','lavato','lavandosi','intransitive','[]','ok'],
      ['ricordarsi','to remember','are',1,0,'essere','ricordato','ricordandosi','intransitive','[]','ok'],
      ['sedersi','to sit down','ere',0,0,'essere','seduto','sedendosi','intransitive','["presente_irregolare"]','ok'],
      ['sentirsi','to feel','ire',1,0,'essere','sentito','sentendosi','intransitive','[]','ok'],
      ['vestirsi','to get dressed','ire',1,0,'essere','vestito','vestendosi','intransitive','[]','ok'],
      ['svegliarsi','to wake up','are',1,0,'essere','svegliato','svegliandosi','intransitive','[]','ok'],
    ].forEach(r => insV2.run(...r));
  } catch(_) {}

  // ── FULL CONJUGATION FILL (programmatic, INSERT OR IGNORE) ──────────────
  // Wrapped in a single transaction: 3600 INSERTs take ~ms instead of ~minutes
  // without it (each auto-commit = separate fsync on cloud filesystems).
  // INSERT OR IGNORE preserves irregular forms already in the DB.
  try {
    const insF = db.prepare(`INSERT OR IGNORE INTO verb_conjugations(verb_id,tense,person,form) VALUES(?,?,?,?)`);
    db.exec('BEGIN');
    const persons = ['io','tu','lui/lei','noi','voi','loro'];
    const tenses = ['present_indicative','passato_prossimo','imperfect_indicative','future_simple','conditional_present','subjunctive_present'];

    // Reflexive pronoun map
    const rfPron = {io:'mi',tu:'ti','lui/lei':'si',noi:'ci',voi:'vi',loro:'si'};

    // Essere present forms (for passato prossimo construction)
    const essereAux = {io:'sono',tu:'sei','lui/lei':'è',noi:'siamo',voi:'siete',loro:'sono'};
    const avereAux  = {io:'ho',  tu:'hai','lui/lei':'ha',noi:'abbiamo',voi:'avete',loro:'hanno'};

    function ppForms(aux, pp) {
      if (aux === 'essere') {
        return {io:`sono ${pp}`,tu:`sei ${pp}`,'lui/lei':`è ${pp}`,noi:`siamo ${pp}i`,voi:`siete ${pp}i`,loro:`sono ${pp}i`};
      }
      return {io:`ho ${pp}`,tu:`hai ${pp}`,'lui/lei':`ha ${pp}`,noi:`abbiamo ${pp}`,voi:`avete ${pp}`,loro:`hanno ${pp}`};
    }

    function ppFormsRefl(pp, rfPron) {
      // reflexive pp: aux is always essere, add pronoun
      return {
        io:`mi sono ${pp}`,tu:`ti sei ${pp}`,'lui/lei':`si è ${pp}`,
        noi:`ci siamo ${pp}i`,voi:`vi siete ${pp}i`,loro:`si sono ${pp}i`
      };
    }

    // Pattern generators for non-reflexive verbs
    function areConj(stem) {
      // Handle -care/-gare: add h before e/i
      const isCareGare = /[cg]$/.test(stem);
      const hs = isCareGare ? stem + 'h' : stem;
      // Handle -ciare/-giare/-iare: stem already ends in i, drop one i before i
      const stemI = stem.endsWith('i') ? stem.slice(0,-1) : stem; // for tu present
      return {
        present_indicative: {io:stem+'o',tu:stemI+'i','lui/lei':stem+'a',noi:stem+'iamo',voi:stem+'ate',loro:stem+'ano'},
        imperfect_indicative: {io:stem+'avo',tu:stem+'avi','lui/lei':stem+'ava',noi:stem+'avamo',voi:stem+'avate',loro:stem+'avano'},
        future_simple: {io:hs+'erò',tu:hs+'erai','lui/lei':hs+'erà',noi:hs+'eremo',voi:hs+'erete',loro:hs+'eranno'},
        conditional_present: {io:hs+'erei',tu:hs+'eresti','lui/lei':hs+'erebbe',noi:hs+'eremmo',voi:hs+'ereste',loro:hs+'erebbero'},
        subjunctive_present: {io:stemI+'i',tu:stemI+'i','lui/lei':stemI+'i',noi:stem+'iamo',voi:stem+'iate',loro:stemI+'ino'},
      };
    }

    function ereConj(stem) {
      return {
        present_indicative: {io:stem+'o',tu:stem+'i','lui/lei':stem+'e',noi:stem+'iamo',voi:stem+'ete',loro:stem+'ono'},
        imperfect_indicative: {io:stem+'evo',tu:stem+'evi','lui/lei':stem+'eva',noi:stem+'evamo',voi:stem+'evate',loro:stem+'evano'},
        future_simple: {io:stem+'erò',tu:stem+'erai','lui/lei':stem+'erà',noi:stem+'eremo',voi:stem+'erete',loro:stem+'eranno'},
        conditional_present: {io:stem+'erei',tu:stem+'eresti','lui/lei':stem+'erebbe',noi:stem+'eremmo',voi:stem+'ereste',loro:stem+'erebbero'},
        subjunctive_present: {io:stem+'a',tu:stem+'a','lui/lei':stem+'a',noi:stem+'iamo',voi:stem+'iate',loro:stem+'ano'},
      };
    }

    function ireConj(stem) {
      return {
        present_indicative: {io:stem+'o',tu:stem+'i','lui/lei':stem+'e',noi:stem+'iamo',voi:stem+'ite',loro:stem+'ono'},
        imperfect_indicative: {io:stem+'ivo',tu:stem+'ivi','lui/lei':stem+'iva',noi:stem+'ivamo',voi:stem+'ivate',loro:stem+'ivano'},
        future_simple: {io:stem+'irò',tu:stem+'irai','lui/lei':stem+'irà',noi:stem+'iremo',voi:stem+'irete',loro:stem+'iranno'},
        conditional_present: {io:stem+'irei',tu:stem+'iresti','lui/lei':stem+'irebbe',noi:stem+'iremmo',voi:stem+'ireste',loro:stem+'irebbero'},
        subjunctive_present: {io:stem+'a',tu:stem+'a','lui/lei':stem+'a',noi:stem+'iamo',voi:stem+'iate',loro:stem+'ano'},
      };
    }

    function ireIscConj(stem) {
      return {
        present_indicative: {io:stem+'isco',tu:stem+'isci','lui/lei':stem+'isce',noi:stem+'iamo',voi:stem+'ite',loro:stem+'iscono'},
        imperfect_indicative: {io:stem+'ivo',tu:stem+'ivi','lui/lei':stem+'iva',noi:stem+'ivamo',voi:stem+'ivate',loro:stem+'ivano'},
        future_simple: {io:stem+'irò',tu:stem+'irai','lui/lei':stem+'irà',noi:stem+'iremo',voi:stem+'irete',loro:stem+'iranno'},
        conditional_present: {io:stem+'irei',tu:stem+'iresti','lui/lei':stem+'irebbe',noi:stem+'iremmo',voi:stem+'ireste',loro:stem+'irebbero'},
        subjunctive_present: {io:stem+'isca',tu:stem+'isca','lui/lei':stem+'isca',noi:stem+'iamo',voi:stem+'iate',loro:stem+'iscano'},
      };
    }

    // Reflexive conjugation: prefix pronoun to each form
    function reflConj(baseForms, inf) {
      const pron = rfPron;
      const out = {};
      for (const [tense, forms] of Object.entries(baseForms)) {
        out[tense] = {};
        for (const p of persons) {
          out[tense][p] = pron[p] + ' ' + forms[p];
        }
      }
      return out;
    }

    // Reflexive pp: mi sono lavato etc.
    function reflPP(pp) {
      return {io:`mi sono ${pp}`,tu:`ti sei ${pp}`,'lui/lei':`si è ${pp}`,
              noi:`ci siamo ${pp}i`,voi:`vi siete ${pp}i`,loro:`si sono ${pp}i`};
    }

    const allVerbs = db.prepare('SELECT id, infinitive, conjugation_group, is_isc, auxiliary, past_participle FROM verbs').all();

    const reflexiveInfinitives = new Set(['alzarsi','chiamarsi','fermarsi','lavarsi','ricordarsi','sedersi','sentirsi','vestirsi','svegliarsi']);

    for (const verb of allVerbs) {
      const { id, infinitive, conjugation_group: grp, is_isc, auxiliary, past_participle: pp } = verb;
      if (!grp || !pp) continue;

      const isRefl = reflexiveInfinitives.has(infinitive);

      // Get base infinitive stem
      let stem, baseForms;

      if (isRefl) {
        // Reflexive: strip 'si' suffix and conjugation ending
        const baseInf = infinitive.slice(0,-2); // e.g. 'alzarsi' -> 'alzar'
        const grpSuffix = grp === 'are' ? 'are' : grp === 'ere' ? 'ere' : 'ire';
        const baseStem = baseInf.slice(0, -(grpSuffix.length - 2)); // 'alzar' -> 'alz'
        // For sedersi (irregular), we'll rely on INSERT OR IGNORE to not overwrite the critical forms
        // For regular reflexives:
        if (infinitive === 'sedersi') {
          // Irregular - critical forms already inserted; use sedere forms with pronouns for missing tenses
          const sedStem = 'sed';
          const sedBase = ereConj(sedStem);
          const refl = reflConj(sedBase, infinitive);
          refl.passato_prossimo = reflPP('seduto');
          for (const tense of tenses) {
            if (!refl[tense]) continue;
            for (const p of persons) {
              if (refl[tense][p]) insF.run(id, tense, p, refl[tense][p]);
            }
          }
          continue;
        }
        // Regular reflexive
        const actualStem = infinitive.endsWith('arsi') ? infinitive.slice(0,-4) :
                           infinitive.endsWith('ersi') ? infinitive.slice(0,-4) :
                           infinitive.slice(0,-4); // irsi
        let baseConj;
        if (grp === 'are') baseConj = areConj(actualStem);
        else if (grp === 'ire' && is_isc) baseConj = ireIscConj(actualStem);
        else if (grp === 'ire') baseConj = ireConj(actualStem);
        else baseConj = ereConj(actualStem);
        const refl = reflConj(baseConj, infinitive);
        refl.passato_prossimo = reflPP(pp);
        for (const tense of tenses) {
          if (!refl[tense]) continue;
          for (const p of persons) {
            if (refl[tense][p]) insF.run(id, tense, p, refl[tense][p]);
          }
        }
        continue;
      }

      // Non-reflexive
      if (grp === 'are') stem = infinitive.slice(0, -3); // e.g. 'parlare' -> 'parl'
      else if (grp === 'ere') stem = infinitive.slice(0, -3); // 'leggere' -> 'legger', but we use stem = 'legg'
      else stem = infinitive.slice(0, -3); // ire

      // For -ere verbs: stem is infinitive minus last 3 chars (ere)
      // 'leggere' -> 'legg', 'vendere' -> 'vend', 'mettere' -> 'mett'
      // But regular -ere future: vendere -> vender + endings = venderò
      // However 'ere' stem for futuro needs 'er': vend+erò

      if (grp === 'are') baseForms = areConj(stem);
      else if (grp === 'ere') {
        // For -ere: stem = infinitive - 'ere' but keep the e for future/conditional
        // 'vendere': root='vend', future base='vender'
        const ereStem = infinitive.slice(0, -3);
        baseForms = ereConj(ereStem);
        // Override future/conditional to use correct stem (root + er)
        const futBase = infinitive.slice(0, -1); // 'vendere' -> 'vender' -> 'venderò'
        baseForms.future_simple = {io:futBase+'ò',tu:futBase+'ai','lui/lei':futBase+'à',noi:futBase+'emo',voi:futBase+'ete',loro:futBase+'anno'};
        baseForms.conditional_present = {io:futBase+'ei',tu:futBase+'esti','lui/lei':futBase+'ebbe',noi:futBase+'emmo',voi:futBase+'este',loro:futBase+'ebbero'};
      }
      else if (grp === 'ire' && is_isc) {
        const ireStem = infinitive.slice(0, -3);
        baseForms = ireIscConj(ireStem);
        const futBase = infinitive.slice(0, -1);
        baseForms.future_simple = {io:futBase+'ò',tu:futBase+'ai','lui/lei':futBase+'à',noi:futBase+'emo',voi:futBase+'ete',loro:futBase+'anno'};
        baseForms.conditional_present = {io:futBase+'ei',tu:futBase+'esti','lui/lei':futBase+'ebbe',noi:futBase+'emmo',voi:futBase+'este',loro:futBase+'ebbero'};
      }
      else { // ire non-isc
        const ireStem = infinitive.slice(0, -3);
        baseForms = ireConj(ireStem);
        const futBase = infinitive.slice(0, -1);
        baseForms.future_simple = {io:futBase+'ò',tu:futBase+'ai','lui/lei':futBase+'à',noi:futBase+'emo',voi:futBase+'ete',loro:futBase+'anno'};
        baseForms.conditional_present = {io:futBase+'ei',tu:futBase+'esti','lui/lei':futBase+'ebbe',noi:futBase+'emmo',voi:futBase+'este',loro:futBase+'ebbero'};
      }

      // Passato prossimo
      baseForms.passato_prossimo = ppForms(auxiliary || 'avere', pp);

      // Insert all tense/person combinations (INSERT OR IGNORE preserves irregular forms)
      for (const tense of tenses) {
        if (!baseForms[tense]) continue;
        for (const p of persons) {
          if (baseForms[tense][p]) insF.run(id, tense, p, baseForms[tense][p]);
        }
      }
    }
    db.exec('COMMIT');
  } catch(e) {
    try { db.exec('ROLLBACK'); } catch(_) {}
    /* conjugation fill errors are non-fatal */
  }

  // ── Verbi Avanzati (truly idempotent via SELECT-before-INSERT) ─────────────
  if (!db.prepare(`SELECT id FROM vocabulary_categories WHERE name='Verbi Avanzati'`).get()) {
    db.prepare(`INSERT INTO vocabulary_categories(name,name_it,icon,color,sort_order) VALUES(?,?,?,?,?)`)
      .run('Verbi Avanzati', 'Verbi Avanzati', '🔥', '#7c3aed', 23);
  }

  const _avCatId = db.prepare(`SELECT id FROM vocabulary_categories WHERE name='Verbi Avanzati'`).get()?.id;
  if (_avCatId) {
    const _insAV = db.prepare(`
      INSERT INTO vocabulary_items
        (italian,spanish,category_id,word_type,example_it,example_es,cefr_level,notes,collocations)
      VALUES(?,?,?,?,?,?,?,?,?)
    `);
    const _chkAV = db.prepare(`SELECT id FROM vocabulary_items WHERE italian=? AND category_id=?`);
    const _chkAF = db.prepare(`SELECT id FROM flashcards WHERE vocabulary_id=?`);
    const _insAF = db.prepare(`INSERT INTO flashcards(vocabulary_id,front,back,direction,category_id,next_review) VALUES(?,?,?,?,?,?)`);
    const _now = Math.floor(Date.now()/1000);

    const _av = [
      { it:'accorgersi (di)',   es:'darse cuenta (de)',        lv:'B2', ex_it:'Mi sono accorto di aver sbagliato.',       ex_es:'Me di cuenta de que me había equivocado.', notes:'Riflessivo; aux: essere. Reggisce "di" + infinito o "che" + indicativo/congiuntivo.', col:'["non accorgersi","appena me ne sono accorto"]' },
      { it:'permettersi (di)', es:'permitirse / poder permitirse', lv:'B2', ex_it:'Non mi posso permettere questo viaggio.', ex_es:'No me puedo permitir este viaje.', notes:'Spesso usato in frasi negative o interrogative. Reggisce "di" + infinito.', col:'["non posso permettermi","permettiti di..."]' },
      { it:'trattarsi di',     es:'tratarse de',              lv:'B1', ex_it:'Non si tratta di soldi, si tratta di rispetto.', ex_es:'No se trata de dinero, se trata de respeto.', notes:'Forma impersonale: si tratta di + nome/infinito. Non usare con soggetto esplicito.', col:'["di cosa si tratta?","si tratta di"]' },
      { it:'rendersi conto (di)', es:'darse cuenta (de)',     lv:'B2', ex_it:'Mi sono resa conto del problema troppo tardi.', ex_es:'Me di cuenta del problema demasiado tarde.', notes:'Aux: essere. Simile a "accorgersi" ma più formale. Reggisce "di" + nome o "che" + frase.', col:'["rendersi conto che","mi sono reso conto"]' },
      { it:'abituarsi (a)',    es:'acostumbrarse (a)',         lv:'B1', ex_it:'Mi sono abituato al freddo del nord.', ex_es:'Me he acostumbrado al frío del norte.', notes:'Aux: essere. Reggisce "a" + infinito o nome. "Ero abituato a farlo" = estaba acostumbrado a hacerlo.', col:'["abituarsi a fare","ci si abitua"]' },
      { it:'vergognarsi (di)', es:'avergonzarse (de)',         lv:'B1', ex_it:'Si vergogna di non saper cucinare.', ex_es:'Se avergüenza de no saber cocinar.', notes:'Aux: essere. Reggisce "di" + infinito o "di" + nome. "Dovresti vergognarti!" = ¡Deberías avergonzarte!', col:'["vergognarsi di","non si vergogna di nulla"]' },
      { it:'sorprendere',      es:'sorprender',               lv:'B1', ex_it:'La sua risposta mi ha sorpreso moltissimo.', ex_es:'Su respuesta me sorprendió muchísimo.', notes:'Anche riflessivo "sorprendersi di" (= sorprenderse de). PP: sorpreso.', col:'["rimanere sorpreso","essere sorpreso da","sorprendersi di"]' },
      { it:'ricordarsi (di)',  es:'acordarse (de)',            lv:'A2', ex_it:'Non mi ricordo dove ho messo le chiavi.', ex_es:'No me acuerdo de dónde puse las llaves.', notes:'"Ricordare" = recordar (trans.); "ricordarsi di" = acordarse de (riflessivo). Aux: essere per il riflessivo.', col:'["ti ricordi?","ricordati di fare","non mi ricordo"]' },
      { it:'dimenticarsi (di)', es:'olvidarse (de)',          lv:'A2', ex_it:'Mi sono dimenticata di comprare il pane.', ex_es:'Se me olvidó comprar el pan.', notes:'"Dimenticare" è trans. ("ho dimenticato l\'ombrello"); "dimenticarsi di" è riflessivo + aux essere.', col:'["dimenticarsi di fare","non dimenticarti!","l\'ho dimenticato"]' },
      { it:'lamentarsi (di/per)', es:'quejarse (de/por)',     lv:'B1', ex_it:'Si lamenta sempre del troppo lavoro.', ex_es:'Siempre se queja del exceso de trabajo.', notes:'Aux: essere. Reggisce "di" o "per" + nome, o "che" + congiuntivo.', col:'["lamentarsi di","smettila di lamentarti"]' },
      { it:'preoccuparsi (di/per)', es:'preocuparse (por)',   lv:'A2', ex_it:'Non ti preoccupare, andrà tutto bene.', ex_es:'No te preocupes, todo irá bien.', notes:'Aux: essere. Reggisce "per" + nome o "di" + infinito. "Mi preoccupa" (mi preoccupa qualcosa) = me preocupa.', col:'["non preoccuparti","mi preoccupa che","preoccuparsi per"]' },
      { it:'aspettarsi (di)',  es:'esperar / anticipar',      lv:'B2', ex_it:'Non me lo aspettavo per niente.', ex_es:'No me lo esperaba para nada.', notes:'"Aspettare" = esperar (qualcuno/qualcosa); "aspettarsi" = esperar/anticipar (aspettativa). Aux: essere.', col:'["non me lo aspettavo","come ci si aspetta","aspettarsi che"]' },
      { it:'fingere (di)',     es:'fingir / simular',         lv:'B1', ex_it:'Ha finto di non capire per non rispondere.', ex_es:'Fingió no entender para no responder.', notes:'FALSE FRIEND: "pretendere" in italiano = exigir, NON fingere. PP: finto.', col:'["fingere di niente","far finta di","fingere di essere"]' },
      { it:'raggiungere',      es:'alcanzar / llegar a',      lv:'B1', ex_it:'Ho raggiunto il mio obiettivo dopo anni di lavoro.', ex_es:'Alcancé mi objetivo después de años de trabajo.', notes:'PP: raggiunto. "Raggiungi la cima" = llegas a la cima. Anche = reunirse con alguien.', col:'["raggiungere un obiettivo","raggiungere un accordo","raggiungere qualcuno"]' },
      { it:'scegliere',        es:'elegir / escoger',         lv:'B1', ex_it:'Hai già scelto cosa mangiare?', ex_es:'¿Ya has elegido qué comer?', notes:'Verbo irregolare: scelgo, scegli, sceglie, scegliamo, scegliete, scelgono. PP: scelto.', col:'["scegliere tra","fare una scelta","ben scelto"]' },
      { it:'tradire',          es:'traicionar',               lv:'B1', ex_it:'Mi ha tradito un amico di vecchia data.', ex_es:'Me traicionó un amigo de toda la vida.', notes:'FALSE FRIEND: "traducir" (es.) = "tradurre" (it.). "Tradire" ≠ "traducir". PP: tradito.', col:'["tradire la fiducia","sentirsi tradito","tradire un segreto"]' },
      { it:'affrontare',       es:'afrontar / enfrentarse a', lv:'B1', ex_it:'Devo affrontare questo problema una volta per tutte.', ex_es:'Tengo que afrontar este problema de una vez por todas.', notes:'Transitivo. "Affrontare una situazione difficile" = hacer frente a. PP: affrontato.', col:'["affrontare un problema","affrontare una sfida","affrontare le conseguenze"]' },
      { it:'rischiare (di)',   es:'arriesgarse / correr el riesgo de', lv:'B1', ex_it:'Rischi di perdere tutto se non stai attento.', ex_es:'Corres el riesgo de perderlo todo si no tienes cuidado.', notes:'Reggisce "di" + infinito: "rischio di sbagliare". PP: rischiato.', col:'["rischiare di fare","a rischio","rischiare tutto"]' },
      { it:'litigare (con)',   es:'discutir / pelearse (con)', lv:'B1', ex_it:'Ho litigato con mia sorella per una sciocchezza.', ex_es:'Me peleé con mi hermana por una tontería.', notes:'Uso colloquiale comune. "Fare a litigio" o "litigare furiosamente". PP: litigato.', col:'["litigare con","litigare per","fare a litigio"]' },
      { it:'piangere',         es:'llorar',                   lv:'A2', ex_it:'Ha pianto tutta la notte dopo la brutta notizia.', ex_es:'Lloró toda la noche después de la mala noticia.', notes:'PP irregolare: pianto. Aux: avere. "Scoppiare a piangere" = romper a llorar.', col:'["scoppiare a piangere","piangere di gioia","far piangere"]' },
      { it:'ridere (di)',      es:'reírse (de)',               lv:'A2', ex_it:'Rideva di tutto e non prendeva niente sul serio.', ex_es:'Se reía de todo y no se tomaba nada en serio.', notes:'PP: riso. Aux: avere. "Ridere di" = reírse de (algo). "Scoppiare a ridere" = romper a reír.', col:'["ridere di","scoppiare a ridere","far ridere","morire dal ridere"]' },
      { it:'urlare',           es:'gritar',                   lv:'A2', ex_it:'Non urlare, ti sentono tutti.', ex_es:'No grites, te oye todo el mundo.', notes:'Sinonimo: gridare. "Urlare a squarciagola" = gritar a pleno pulmón. PP: urlato.', col:'["urlare di gioia","urlare contro","smettila di urlare"]' },
      { it:'osare (di)',       es:'atreverse (a) / osar',     lv:'B2', ex_it:'Non oserei mai contraddirlo in pubblico.', ex_es:'Nunca me atrevería a contradecirle en público.', notes:'Spesso al condizionale: "non oserei". Reggisce "di" + inf o direttamente l\'infinito. PP: osato.', col:'["non osare","come osi?","osare fare"]' },
      { it:'meritare',         es:'merecer',                  lv:'B1', ex_it:'Hai lavorato benissimo, lo meriti davvero.', ex_es:'Has trabajado muy bien, te lo mereces de verdad.', notes:'Anche riflessivo "meritarsi": "te lo sei meritato" = te lo has ganado. PP: meritato.', col:'["meritarsi qualcosa","non lo meriti","lo merita"]' },
      { it:'dubitare (di/che)', es:'dudar (de)',              lv:'B2', ex_it:'Dubito che arrivi in tempo.', ex_es:'Dudo que llegue a tiempo.', notes:'"Dubitare che" regge il congiuntivo. "Dubitare di" + nome = dudar de algo/alguien. PP: dubitato.', col:'["non ne dubito","dubitare di qualcuno","mettere in dubbio"]' },
      { it:'temere (di/che)',  es:'temer',                    lv:'B2', ex_it:'Temo che sia troppo tardi per rimediare.', ex_es:'Temo que sea demasiado tarde para remediarlo.', notes:'"Temere che" regge il congiuntivo. "Temere di" + inf. PP: temuto. Più formale di "avere paura".', col:'["temere il peggio","temere che","non temo nessuno"]' },
      { it:'nascondere',       es:'esconder / ocultar',       lv:'B1', ex_it:'Dove hai nascosto le chiavi di riserva?', ex_es:'¿Dónde has escondido las llaves de repuesto?', notes:'PP irregolare: nascosto. "Nascondersi" = esconderse. Aux: avere (trans.) / essere (riflessivo).', col:'["nascondere la verità","nascondersi da","non nascondere"]' },
      { it:'scoprire',         es:'descubrir',                lv:'B1', ex_it:'Hanno scoperto una cura per quella malattia.', ex_es:'Han descubierto una cura para esa enfermedad.', notes:'PP: scoperto. "Scoprirsi" = darse cuenta de / descubrirse. "Ho scoperto che…" = He descubierto que…', col:'["scoprire la verità","fare una scoperta","rimasto scoperto"]' },
      { it:'rinunciare (a)',   es:'renunciar (a)',             lv:'B2', ex_it:'Ha rinunciato al lavoro per seguire la sua passione.', ex_es:'Renunció al trabajo para seguir su pasión.', notes:'Reggisce sempre "a" + nome/infinito. Non omettere la preposizione. PP: rinunciato.', col:'["rinunciare a fare","non rinunciare","ci rinuncio"]' },
      { it:'risolvere',        es:'resolver',                 lv:'B1', ex_it:'Come pensi di risolvere questo problema?', ex_es:'¿Cómo piensas resolver este problema?', notes:'PP irregolare: risolto. "Risolversi" = resolverse. "È tutto risolto" = está todo resuelto.', col:'["risolvere un problema","trovare una soluzione","si risolverà"]' },
      { it:'smettere (di)',    es:'dejar de (+ infinitivo)',  lv:'B1', ex_it:'Smetti di fare così, mi stai innervosendo.', ex_es:'Deja de comportarte así, me estás poniendo nervioso.', notes:'Reggisce "di" + infinito. PP: smesso. "Ho smesso di fumare" = He dejado de fumar.', col:'["smettere di fare","smettila!","non smette mai"]' },
      { it:'continuare (a)',   es:'seguir / continuar (+ gerundio)', lv:'A2', ex_it:'Continua a studiare anche quando è difficile.', ex_es:'Sigue estudiando incluso cuando es difícil.', notes:'Reggisce "a" + infinito (it.) vs gerundio (es.). "Continuare a fare" = seguir haciendo. PP: continuato.', col:'["continuare a fare","non si ferma","va avanti"]' },
      { it:'dipendere (da)',   es:'depender (de)',             lv:'B1', ex_it:'Dipende da te: puoi farcela se vuoi.', ex_es:'Depende de ti: puedes lograrlo si quieres.', notes:'PP: dipeso. Aux: essere. "Dipende!" = ¡Depende! Reggisce "da" + persona/cosa.', col:'["dipende da","non dipende da me","dipendere da qualcuno"]' },
      { it:'approfittare (di)', es:'aprovechar',              lv:'B2', ex_it:'Ho approfittato del bel tempo per fare una passeggiata.', ex_es:'Aproveché el buen tiempo para dar un paseo.', notes:'Reggisce "di" + nome. "Approfittarsi di qualcuno" = aprovecharse de alguien (negativo). PP: approfittato.', col:'["approfittare dell\'occasione","approfittarsi di","non ne approfittare"]' },
      { it:'insistere (su/per)', es:'insistir (en)',          lv:'B1', ex_it:'Insiste a voler pagare lui per tutti.', ex_es:'Insiste en pagar él por todos.', notes:'PP: insistito. Reggisce "a" + infinito o "su" + nome o "per" + nome. Simile allo spagnolo.', col:'["insistere su","insistere per","non insistere"]' },
      { it:'soffrire (di)',    es:'sufrir (de)',               lv:'B1', ex_it:'Soffre di insonnia da anni.', ex_es:'Sufre de insomnio desde hace años.', notes:'PP irregolare: sofferto. Aux: avere. "Soffrire di" + malattia = sufrir de. Anche "soffrire molto" = sufrir mucho.', col:'["soffrire di","far soffrire","sofferto","soffrire in silenzio"]' },
      { it:'sopportare',       es:'soportar / aguantar',      lv:'B1', ex_it:'Non lo sopporto più, è davvero insopportabile.', ex_es:'Ya no lo soporto, es verdaderamente insoportable.', notes:'Non confondere con "supportare" (= apoyar/financiar). "Sopportare" = aguantar. PP: sopportato.', col:'["non lo sopporto","sopportare il dolore","insopportabile"]' },
      { it:'sostenere',        es:'sostener / apoyar',        lv:'B2', ex_it:'Sostiene una tesi molto interessante nella sua ricerca.', ex_es:'Sostiene una tesis muy interesante en su investigación.', notes:'Come "tenere". PP: sostenuto. Significati: 1) sostenere fisicamente; 2) sostenere una tesi/opinione; 3) sostenere qualcuno = apoyar.', col:'["sostenere una tesi","sostenere qualcuno","sostegno"]' },
      { it:'convincere',       es:'convencer',                lv:'B1', ex_it:'Alla fine mi hai convinto, vengo anch\'io.', ex_es:'Al final me has convencido, voy también.', notes:'PP: convinto. "Convincersi di" = convencerse de. "Sono convinto che" + indicativo.', col:'["convincere qualcuno a fare","rimanere convinto","convincersi"]' },
      { it:'ammettere',        es:'admitir',                  lv:'B1', ex_it:'Ha ammesso di aver sbagliato davanti a tutti.', ex_es:'Admitió haber cometido un error delante de todos.', notes:'Come "mettere". PP: ammesso. Reggisce "di" + infinito. "Bisogna ammettere che" = hay que admitir que.', col:'["ammettere di","bisogna ammettere","ammissione"]' },
      { it:'sbagliare(si)',    es:'equivocarse / cometer un error', lv:'B1', ex_it:'Mi sono sbagliato di persona, mi scusi.', ex_es:'Me he equivocado de persona, disculpe.', notes:'"Sbagliare" (trans.) = cometer un error; "sbagliarsi" (riflessivo, aux essere) = equivocarse. "Hai sbagliato!" = ¡Te has equivocado!', col:'["sbagliare strada","sbagliarsi di persona","ho sbagliato"]' },
      { it:'promettere',       es:'prometer',                 lv:'A2', ex_it:'Ho promesso di aiutarla con il trasloco.', ex_es:'He prometido ayudarla con la mudanza.', notes:'PP: promesso. Reggisce "di" + infinito (stesso soggetto) o "che" + frase (soggetti diversi). "Lo prometto!" = ¡Lo prometo!', col:'["promettere di fare","mantenere la promessa","parola d\'onore"]' },
      { it:'deludere',         es:'decepcionar',              lv:'B2', ex_it:'Hai deluso le aspettative di tutti con quel risultato.', ex_es:'Has decepcionado las expectativas de todos con ese resultado.', notes:'PP: deluso. "Rimanere deluso" = quedarse decepcionado. "Che delusione!" = ¡Qué decepción!', col:'["rimanere deluso","deludere le aspettative","grande delusione"]' },
      { it:'rifiutare (di)',   es:'rechazar / rehusar',       lv:'B2', ex_it:'Ha rifiutato l\'offerta di lavoro senza esitare.', ex_es:'Rechazó la oferta de trabajo sin dudar.', notes:'Reggisce "di" + infinito: "rifiuto di farlo". PP: rifiutato. "Rifiutarsi di" = negarse a (riflessivo).', col:'["rifiutare un\'offerta","rifiutarsi di","non rifiutare"]' },
      { it:'mancare (a)',      es:'faltar / echar de menos',  lv:'B1', ex_it:'Mi manchi tantissimo quando sei lontano.', ex_es:'Te echo muchísimo de menos cuando estás lejos.', notes:'Sintassi inversa come "gustar": "mi manchi" (tu mi manchi) = te echo de menos. "Manca poco" = falta poco.', col:'["mi manchi","ci manca poco","mancanza","mancare di rispetto"]' },
      { it:'succedere',        es:'pasar / ocurrir / suceder', lv:'A2', ex_it:'Cosa è successo? Non ti vedo da settimane!', ex_es:'¿Qué ha pasado? ¡No te veo desde hace semanas!', notes:'PP: successo. Aux: essere. Impersonale comune: "succede" = pasa/ocurre. "Come è successo?" = ¿Cómo ocurrió?', col:'["cosa è successo?","come può succedere","mi è successo"]' },
      { it:'costruire',        es:'construir',                lv:'B1', ex_it:'Stanno costruendo un nuovo ponte sul fiume.', ex_es:'Están construyendo un nuevo puente sobre el río.', notes:'Verbo in -ire con infisso -isc-: costruisco, costruisci, costruisce, costruiamo… PP: costruito.', col:'["costruire da zero","costruire un rapporto","in costruzione"]' },
      { it:'crescere',         es:'crecer / criar(se)',       lv:'B1', ex_it:'Sono cresciuto in Spagna e mi sono trasferito in Italia.', ex_es:'Crecí en España y me mudé a Italia.', notes:'PP: cresciuto. Aux: essere. "Far crescere" = hacer crecer. Anche figurato: "crescere professionalmente".', col:'["crescere in fretta","far crescere","crescita","crescere insieme"]' },
      { it:'trattenersi',      es:'contenerse / quedarse',    lv:'B2', ex_it:'Non riuscivo a trattenermi dal ridere.', ex_es:'No podía contenerme la risa.', notes:'Aux: essere. Doppio uso: 1) trattenersi = contenerse (emozioni); 2) trattenersi = quedarse (in un luogo). PP: trattenuto.', col:'["trattenersi dal fare","trattenersi a cena","non riuscire a trattenersi"]' },
      { it:'fraintendere',     es:'malentender / entender mal', lv:'B2', ex_it:'Credo che tu abbia frainteso le mie parole.', ex_es:'Creo que has malentendido mis palabras.', notes:'PP: frainteso. Come "intendere". "C\'è stato un fraintendimento" = ha habido un malentendido.', col:'["fraintendere le parole","evitare fraintendimenti","ho frainteso"]' },
    ];

    _av.forEach(({ it, es, lv, ex_it, ex_es, notes, col }) => {
      if (_chkAV.get(it, _avCatId)) return;
      const r = _insAV.run(it, es, _avCatId, 'verb', ex_it, ex_es, lv, notes || null, col || '[]');
      if (r.lastInsertRowid) {
        if (!_chkAF.get(r.lastInsertRowid)) _insAF.run(r.lastInsertRowid, it, es, 'it-es', _avCatId, _now);
      }
    });
  }

  // ── Vocabulary top-up: all categories to 30 words (truly idempotent) ────────
  {
    const _now2 = Math.floor(Date.now() / 1000);
    const _insVI2 = db.prepare(`
      INSERT INTO vocabulary_items
        (italian,spanish,category_id,word_type,example_it,example_es,cefr_level,notes,collocations)
      VALUES(?,?,?,?,?,?,?,?,?)
    `);
    const _insFC2 = db.prepare("INSERT INTO flashcards(vocabulary_id,front,back,direction,category_id,next_review) VALUES(?,?,?,?,?,?)");
    const _chkVI = db.prepare("SELECT id FROM vocabulary_items WHERE italian=? AND category_id=?");
    const _chkFC2 = db.prepare("SELECT id FROM flashcards WHERE vocabulary_id=?");
    // Ensure a category exists; creates it only if absent
    const _ensureCat = (name, nameIt, icon, color, sortOrder) => {
      let row = db.prepare("SELECT id FROM vocabulary_categories WHERE name=?").get(name);
      if (!row) {
        db.prepare("INSERT INTO vocabulary_categories(name,name_it,icon,color,sort_order) VALUES(?,?,?,?,?)").run(name, nameIt, icon, color, sortOrder);
        row = db.prepare("SELECT id FROM vocabulary_categories WHERE name=?").get(name);
      }
      return row?.id;
    };
    const _topup = (catName, words) => {
      const cid = db.prepare("SELECT id FROM vocabulary_categories WHERE name=?").get(catName)?.id;
      if (!cid) return;
      words.forEach(({ it, es, lv, ex_it, ex_es, tp, notes, col }) => {
        if (_chkVI.get(it, cid)) return;
        const r = _insVI2.run(it, es, cid, tp || "noun", ex_it, ex_es, lv, notes || null, col || "[]");
        if (r.lastInsertRowid && !_chkFC2.get(r.lastInsertRowid)) {
          _insFC2.run(r.lastInsertRowid, it, es, "it-es", cid, _now2);
        }
      });
    };

    // Create the 6 categories that may not exist in older databases
    _ensureCat("Il Tempo",             "Il Tempo e il Clima",       "🌤️", "#0284c7", 16);
    _ensureCat("La Città",             "La Città e i Luoghi",       "🏙️", "#374151", 17);
    _ensureCat("Sport e Tempo Libero", "Sport e Tempo Libero",      "⚽", "#16a34a", 18);
    _ensureCat("La Salute",            "La Salute e la Medicina",   "🏥", "#e11d48", 19);
    _ensureCat("Tecnologia e Media",   "Tecnologia e Media",        "💻", "#0e7490", 20);
    _ensureCat("Il Viaggio",           "Il Viaggio e il Turismo",   "✈️", "#7c3aed", 21);

    _topup("Il Corpo", [
      { it:"il polso",    es:"la muñeca",  lv:"A2", ex_it:"Mi fa male il polso.",             ex_es:"Me duele la muñeca." },
      { it:"il gomito",   es:"el codo",    lv:"A2", ex_it:"Ho battuto il gomito.",             ex_es:"Me golpeé el codo." },
      { it:"la caviglia", es:"el tobillo", lv:"A2", ex_it:"Mi sono slogata la caviglia.",     ex_es:"Me torcí el tobillo." },
      { it:"la coscia",   es:"el muslo",   lv:"B1", ex_it:"Ho un dolore alla coscia.",        ex_es:"Tengo dolor en el muslo." },
      { it:"la pelle",    es:"la piel",    lv:"A2", ex_it:"Ha la pelle molto chiara.",        ex_es:"Tiene la piel muy clara." },
      { it:"il labbro",   es:"el labio",   lv:"A2", ex_it:"Ha le labbra rosse.",              ex_es:"Tiene los labios rojos.", notes:"Pl. irregolare: le labbra (f.)" },
      { it:"la guancia",  es:"la mejilla", lv:"B1", ex_it:"Le lacrime le scorrevano sulla guancia.", ex_es:"Las lágrimas le caían por la mejilla." },
      { it:"la fronte",   es:"la frente",  lv:"B1", ex_it:"Ha la fronte sudata.",             ex_es:"Tiene la frente sudada." },
      { it:"la lingua",   es:"la lengua",  lv:"A2", ex_it:"Ti sei morso la lingua?",          ex_es:"¿Te mordiste la lengua?", col:'["avere la lingua sciolta","tenere la lingua"]' },
      { it:"il tallone",  es:"el talón",   lv:"B1", ex_it:"Mi fa male il tallone quando corro.", ex_es:"Me duele el talón cuando corro." },
    ]);

    _topup("Paesi e Nazionalità", [
      { it:"l'Italia",         es:"Italia",                    lv:"A1", ex_it:"L'Italia è famosa per la cucina e l'arte.",             ex_es:"Italia es famosa por la cocina y el arte.",        notes:"nazionalità: italiano/a — in Italia" },
      { it:"il Canada",        es:"Canadá",                    lv:"A2", ex_it:"Il Canada è il secondo paese più grande del mondo.",    ex_es:"Canadá es el segundo país más grande del mundo.", notes:"nazionalità: canadese — in Canada" },
      { it:"l'Australia",      es:"Australia",                 lv:"A2", ex_it:"L'Australia ha una fauna unica.",                       ex_es:"Australia tiene una fauna única.",                 notes:"nazionalità: australiano/a — in Australia" },
      { it:"la Turchia",       es:"Turquía",                   lv:"B1", ex_it:"Istanbul è la città più grande della Turchia.",          ex_es:"Estambul es la ciudad más grande de Turquía.",    notes:"nazionalità: turco/a — in Turchia" },
      { it:"l'Egitto",         es:"Egipto",                    lv:"B1", ex_it:"L'Egitto è famoso per le piramidi.",                    ex_es:"Egipto es famoso por las pirámides.",              notes:"nazionalità: egiziano/a — in Egitto" },
      { it:"l'India",          es:"India",                     lv:"A2", ex_it:"L'India ha la seconda popolazione più grande del mondo.", ex_es:"India tiene la segunda población más grande del mundo.", notes:"nazionalità: indiano/a — in India" },
      { it:"la Corea del Sud", es:"Corea del Sur",             lv:"B1", ex_it:"La Corea del Sud è famosa per il K-pop.",              ex_es:"Corea del Sur es famosa por el K-pop.",            notes:"nazionalità: sudcoreano/a — in Corea del Sud" },
      { it:"la Svezia",        es:"Suecia",                    lv:"B1", ex_it:"La Svezia è famosa per il design e l'innovazione.",     ex_es:"Suecia es famosa por el diseño y la innovación.", notes:"nazionalità: svedese — in Svezia" },
      { it:"la Norvegia",      es:"Noruega",                   lv:"B1", ex_it:"La Norvegia ha i fiordi più belli del mondo.",          ex_es:"Noruega tiene los fiordos más bellos del mundo.", notes:"nazionalità: norvegese — in Norvegia" },
      { it:"la Polonia",       es:"Polonia",                   lv:"B1", ex_it:"La Polonia confina con la Germania e la Russia.",       ex_es:"Polonia limita con Alemania y Rusia.",            notes:"nazionalità: polacco/a — in Polonia" },
      { it:"l'Olanda",         es:"Holanda / los Países Bajos",lv:"B1", ex_it:"L'Olanda è famosa per i tulipani e i mulini.",         ex_es:"Holanda es famosa por los tulipanes y los molinos.", notes:"nazionalità: olandese — in Olanda" },
      { it:"il Belgio",        es:"Bélgica",                   lv:"B1", ex_it:"Il Belgio è famoso per il cioccolato.",                 ex_es:"Bélgica es famosa por el chocolate.",             notes:"nazionalità: belga — in Belgio" },
      { it:"l'Austria",        es:"Austria",                   lv:"B1", ex_it:"L'Austria è famosa per la musica classica e le Alpi.", ex_es:"Austria es famosa por la música clásica y los Alpes.", notes:"nazionalità: austriaco/a — in Austria" },
      { it:"la Colombia",      es:"Colombia",                  lv:"A2", ex_it:"La Colombia produce il miglior caffè del mondo.",       ex_es:"Colombia produce el mejor café del mundo.",       notes:"nazionalità: colombiano/a — in Colombia" },
      { it:"il Perù",          es:"Perú",                      lv:"B1", ex_it:"Il Perù è famoso per Machu Picchu.",                   ex_es:"Perú es famoso por Machu Picchu.",                notes:"nazionalità: peruviano/a — in Perù" },
    ]);

    _topup("Animali", [
      { it:"il serpente",   es:"la serpiente",       lv:"A2", ex_it:"Il serpente striscia sul terreno.",        ex_es:"La serpiente se arrastra por el suelo." },
      { it:"la scimmia",    es:"el mono",            lv:"A2", ex_it:"La scimmia si arrampica sugli alberi.",    ex_es:"El mono trepa por los árboles." },
      { it:"il delfino",    es:"el delfín",          lv:"A2", ex_it:"I delfini sono molto intelligenti.",       ex_es:"Los delfines son muy inteligentes." },
      { it:"il coccodrillo",es:"el cocodrilo",       lv:"B1", ex_it:"Il coccodrillo vive vicino ai fiumi.",    ex_es:"El cocodrilo vive cerca de los ríos." },
      { it:"il pinguino",   es:"el pingüino",        lv:"A2", ex_it:"Il pinguino vive in Antartide.",          ex_es:"El pingüino vive en la Antártida." },
      { it:"la giraffa",    es:"la jirafa",          lv:"A2", ex_it:"La giraffa ha il collo lunghissimo.",     ex_es:"La jirafa tiene el cuello larguísimo." },
      { it:"l'ape",         es:"la abeja",           lv:"A2", ex_it:"L'ape produce il miele.",                 ex_es:"La abeja produce miel." },
      { it:"la farfalla",   es:"la mariposa",        lv:"A2", ex_it:"La farfalla vola tra i fiori.",           ex_es:"La mariposa vuela entre las flores." },
      { it:"il topo",       es:"el ratón",           lv:"A2", ex_it:"Il topo ha mangiato il formaggio.",       ex_es:"El ratón se comió el queso." },
      { it:"il cervo",      es:"el ciervo",          lv:"B1", ex_it:"Il cervo vive nel bosco.",                ex_es:"El ciervo vive en el bosque." },
      { it:"la capra",      es:"la cabra",           lv:"A2", ex_it:"La capra sale sulle rocce.",              ex_es:"La cabra sube por las rocas." },
      { it:"l'asino",       es:"el burro / el asno", lv:"A2", ex_it:"L'asino porta il carico.",               ex_es:"El burro lleva la carga.", notes:"In spagnolo 'burro' = asino (non la mantequilla!)" },
      { it:"il gufo",       es:"el búho",            lv:"B1", ex_it:"Il gufo esce di notte.",                  ex_es:"El búho sale de noche." },
      { it:"il cinghiale",  es:"el jabalí",          lv:"B1", ex_it:"Il cinghiale vive nella foresta.",        ex_es:"El jabalí vive en el bosque." },
      { it:"il gabbiano",   es:"la gaviota",         lv:"B1", ex_it:"I gabbiani volano vicino al mare.",       ex_es:"Las gaviotas vuelan cerca del mar." },
    ]);

    _topup("La Famiglia", [
      { it:"la suocera",   es:"la suegra",         lv:"B1", ex_it:"La mia suocera cucina benissimo.",            ex_es:"Mi suegra cocina muy bien." },
      { it:"il cognato",   es:"el cuñado",         lv:"B1", ex_it:"Mio cognato lavora come ingegnere.",          ex_es:"Mi cuñado trabaja como ingeniero." },
      { it:"la cognata",   es:"la cuñada",         lv:"B1", ex_it:"Mia cognata abita a Milano.",                 ex_es:"Mi cuñada vive en Milán." },
      { it:"il genero",    es:"el yerno",          lv:"B1", ex_it:"Il genero aiuta in giardino.",                ex_es:"El yerno ayuda en el jardín." },
      { it:"la nuora",     es:"la nuera",          lv:"B1", ex_it:"La nuora è venuta a cena.",                   ex_es:"La nuera vino a cenar." },
      { it:"il bisnonno",  es:"el bisabuelo",      lv:"B1", ex_it:"Mio bisnonno aveva cento anni.",              ex_es:"Mi bisabuelo tenía cien años." },
      { it:"il fidanzato", es:"el novio",          lv:"A2", ex_it:"Il mio fidanzato si chiama Marco.",           ex_es:"Mi novio se llama Marco." },
      { it:"la fidanzata", es:"la novia",          lv:"A2", ex_it:"Ha presentato la fidanzata ai genitori.",     ex_es:"Presentó la novia a sus padres." },
      { it:"il gemello",   es:"el gemelo",         lv:"B1", ex_it:"Ho un fratello gemello.",                     ex_es:"Tengo un hermano gemelo." },
      { it:"il padrino",   es:"el padrino",        lv:"B1", ex_it:"Il padrino porta i regali al battesimo.",    ex_es:"El padrino lleva los regalos al bautizo." },
      { it:"il patrigno",  es:"el padrastro",      lv:"B1", ex_it:"Il patrigno è molto gentile.",               ex_es:"El padrastro es muy amable." },
      { it:"la matrigna",  es:"la madrastra",      lv:"B1", ex_it:"La matrigna si prende cura dei bambini.",    ex_es:"La madrastra cuida a los niños." },
      { it:"il bambino",   es:"el niño",           lv:"A1", ex_it:"Il bambino gioca in giardino.",              ex_es:"El niño juega en el jardín." },
      { it:"il coniuge",   es:"el/la cónyuge",     lv:"B1", ex_it:"Il coniuge ha diritto alla pensione.",       ex_es:"El cónyuge tiene derecho a la pensión.", notes:"Termine formale/legale" },
      { it:"il vedovo",    es:"el viudo",          lv:"B1", ex_it:"Il vedovo vive da solo da anni.",             ex_es:"El viudo vive solo desde hace años." },
    ]);

    _topup("Cibo e Bevande", [
      { it:"il prosciutto", es:"el jamón",      lv:"A2", ex_it:"Vorrei un panino con il prosciutto.", ex_es:"Quisiera un bocadillo con jamón." },
      { it:"la mozzarella", es:"la mozzarella", lv:"A2", ex_it:"La pizza con mozzarella fresca è buonissima.", ex_es:"La pizza con mozzarella fresca está riquísima." },
      { it:"il cioccolato", es:"el chocolate",  lv:"A2", ex_it:"Mi piace molto il cioccolato fondente.", ex_es:"Me gusta mucho el chocolate negro." },
      { it:"il tè",         es:"el té",         lv:"A2", ex_it:"Bevo il tè con il latte.",            ex_es:"Bebo el té con leche." },
      { it:"la cipolla",    es:"la cebolla",    lv:"A2", ex_it:"La cipolla fa lacrimare gli occhi.",  ex_es:"La cebolla hace llorar los ojos." },
      { it:"il peperone",   es:"el pimiento",   lv:"A2", ex_it:"Ho messo i peperoni nella pasta.",   ex_es:"Puse los pimientos en la pasta." },
      { it:"l'aglio",       es:"el ajo",        lv:"A2", ex_it:"L'aglio dà sapore al sugo.",         ex_es:"El ajo da sabor a la salsa." },
      { it:"il pomodoro",   es:"el tomate",     lv:"A2", ex_it:"Il pomodoro è rosso e succoso.",     ex_es:"El tomate es rojo y jugoso." },
      { it:"la fragola",    es:"la fresa",      lv:"A2", ex_it:"Le fragole con panna sono deliziose.", ex_es:"Las fresas con nata son deliciosas." },
      { it:"il limone",     es:"el limón",      lv:"A2", ex_it:"Metto il limone nel tè.",            ex_es:"Pongo limón en el té." },
    ]);

    _topup("Falsi Amici", [
      { it:"guardare",       es:"mirar (≠ guardar = conservar)",            tp:"verb",      lv:"A1", ex_it:"Guarda che bello!",                          ex_es:"¡Mira qué bonito!",                       notes:"'Guardare' = mirar. 'Guardar' en español = conservar/custodiar = 'custodire/conservare' en italiano." },
      { it:"mancare (a)",    es:"faltar / echar de menos",                  tp:"verb",      lv:"B1", ex_it:"Mi manchi molto.",                           ex_es:"Te echo mucho de menos.",                  notes:"Sintassi inversa: 'mi manchi' = te echo de menos. 'Mancar' en español = fallar." },
      { it:"largo (agg.)",   es:"ancho (≠ largo en español = long)",        tp:"adjective", lv:"A2", ex_it:"La strada è molto larga.",                  ex_es:"La calle es muy ancha.",                   notes:"'Largo' en italiano = ancho. 'Largo' en español = lungo en italiano." },
      { it:"lungo",          es:"largo (≠ luego en español = después)",     tp:"adjective", lv:"A2", ex_it:"Il Po è il fiume più lungo d'Italia.",       ex_es:"El Po es el río más largo de Italia.",    notes:"'Lungo' en italiano = largo. Parece 'luego' (después) pero son distintos." },
      { it:"bravo",          es:"bueno / hábil (≠ valiente)",               tp:"adjective", lv:"A1", ex_it:"Sei molto bravo in matematica.",             ex_es:"Eres muy bueno en matemáticas.",           notes:"'Bravo' en italiano = bueno/hábil. 'Bravo' en español = valiente = 'coraggioso' en italiano." },
      { it:"restare",        es:"quedarse (≠ restar = sustraer)",           tp:"verb",      lv:"A2", ex_it:"Resto a casa stasera.",                      ex_es:"Me quedo en casa esta noche.",             notes:"'Restare' = quedarse. 'Restar' en español = sustraer = 'sottrarre' en italiano." },
      { it:"l'argomento",    es:"el tema (≠ el argumento = trama)",         tp:"noun",      lv:"B1", ex_it:"Di che argomento tratta il libro?",          ex_es:"¿De qué tema trata el libro?",            notes:"'Argomento' = tema/asunto. 'El argumento' (es.) = trama = 'la trama' en italiano." },
      { it:"la libreria",    es:"la librería / la estantería (≠ biblioteca)",tp:"noun",     lv:"A2", ex_it:"Compro i libri in libreria.",                ex_es:"Compro los libros en la librería.",        notes:"'Libreria' = librería (tienda) o estantería (mueble). Biblioteca = 'la biblioteca' en italiano." },
      { it:"la delusione",   es:"la decepción (≠ la delusión = delirio)",   tp:"noun",      lv:"B1", ex_it:"Che delusione, non ha superato l'esame.",    ex_es:"¡Qué decepción, no aprobó el examen!",    notes:"'Delusione' = decepción. 'Delusión' en español = delirio = 'il delirio' en italiano." },
      { it:"il successo",    es:"el éxito (≠ el suceso = acontecimiento)",  tp:"noun",      lv:"B1", ex_it:"Il film ha avuto molto successo.",            ex_es:"La película tuvo mucho éxito.",            notes:"'Successo' = éxito. 'El suceso' (es.) = acontecimiento = 'l'avvenimento' en italiano." },
      { it:"la mancia",      es:"la propina (≠ la mancha = mancha)",        tp:"noun",      lv:"B1", ex_it:"Ho lasciato una mancia al cameriere.",        ex_es:"Dejé una propina al camarero.",            notes:"'Mancia' = propina. 'La mancha' (es.) = stain = 'la macchia' en italiano." },
      { it:"affrontare",     es:"afrontar / enfrentar (≠ afrentar = insultar)",tp:"verb",  lv:"B1", ex_it:"Devi affrontare i tuoi problemi.",            ex_es:"Tienes que afrontar tus problemas.",       notes:"'Affrontare' = afrontar/enfrentarse a. 'Afrentar' (es.) = insultar = 'insultare' en italiano." },
      { it:"il tappeto",     es:"la alfombra (≠ el tapete = mantelito)",    tp:"noun",      lv:"B1", ex_it:"Ho un bel tappeto persiano in salotto.",     ex_es:"Tengo una bonita alfombra persa en el salón.", notes:"'Tappeto' = alfombra. 'El tapete' (es.) puede significar mantelito = 'la tovaglietta' en italiano." },
      { it:"ancora (avv.)",  es:"todavía / aún",                            tp:"connector", lv:"A2", ex_it:"Stai ancora studiando?",                     ex_es:"¿Todavía estás estudiando?",               notes:"'Ancora' (avverbio) = todavía/aún. Non confondere con 'l'ancora' = el ancla." },
      { it:"stare",          es:"estar (con restricciones) / quedarse",     tp:"verb",      lv:"A2", ex_it:"Come stai? — Sto bene.",                     ex_es:"¿Cómo estás? — Estoy bien.",               notes:"'Stare' ≠ 'estar' totalmente. 'Stare fermo' = quedarse quieto. Per il significato permanente = 'essere'." },
      { it:"attento",        es:"cuidadoso / atento",                       tp:"adjective", lv:"A2", ex_it:"Stai attento quando attraversi la strada.",  ex_es:"Ten cuidado cuando cruces la calle.",      notes:"'Attento' en italiano = cuidadoso/vigilante. En español 'atento' puede significar cortés/considerado." },
      { it:"disturbare",     es:"molestar (≠ disturbar = perturbar)",       tp:"verb",      lv:"B1", ex_it:"Scusa, ti disturbo?",                        ex_es:"Perdona, ¿te molesto?",                    notes:"'Disturbare' = molestar. Similar al español 'molestar'." },
      { it:"il tasto",       es:"la tecla (≠ el gusto = sabor)",            tp:"noun",      lv:"B1", ex_it:"Premi il tasto Invio.",                      ex_es:"Pulsa la tecla Intro.",                    notes:"'Tasto' = tecla (de teclado). 'El gusto' (es.) = sabor = 'il gusto' en italiano." },
    ]);

    _topup("Emozioni", [
      { it:"la gelosia",       es:"los celos",                       tp:"noun", lv:"B1", ex_it:"La gelosia può distruggere una relazione.", ex_es:"Los celos pueden destruir una relación." },
      { it:"la solitudine",    es:"la soledad",                      tp:"noun", lv:"B1", ex_it:"Soffre di molta solitudine.",               ex_es:"Sufre de mucha soledad." },
      { it:"l'invidia",        es:"la envidia",                      tp:"noun", lv:"B1", ex_it:"L'invidia è un sentimento negativo.",       ex_es:"La envidia es un sentimiento negativo." },
      { it:"la tranquillità",  es:"la tranquilidad",                 tp:"noun", lv:"B1", ex_it:"Cerco tranquillità nella natura.",          ex_es:"Busco tranquilidad en la naturaleza." },
      { it:"la felicità",      es:"la felicidad",                    tp:"noun", lv:"A2", ex_it:"La felicità non si compra.",               ex_es:"La felicidad no se compra." },
      { it:"la speranza",      es:"la esperanza",                    tp:"noun", lv:"B1", ex_it:"Non perdere mai la speranza.",             ex_es:"Nunca pierdas la esperanza." },
      { it:"l'amore",          es:"el amor",                         tp:"noun", lv:"A1", ex_it:"L'amore è la cosa più importante.",        ex_es:"El amor es lo más importante." },
      { it:"l'odio",           es:"el odio",                         tp:"noun", lv:"B1", ex_it:"L'odio porta solo sofferenza.",            ex_es:"El odio solo trae sufrimiento." },
      { it:"la gratitudine",   es:"la gratitud",                     tp:"noun", lv:"B1", ex_it:"Sento molta gratitudine verso di te.",     ex_es:"Siento mucha gratitud hacia ti." },
      { it:"il rimpianto",     es:"el arrepentimiento / el remordimiento", tp:"noun", lv:"B1", ex_it:"Non voglio vivere con il rimpianto.", ex_es:"No quiero vivir con remordimientos." },
      { it:"la noia",          es:"el aburrimiento",                 tp:"noun", lv:"B1", ex_it:"Sto morendo di noia.",                    ex_es:"Me estoy muriendo de aburrimiento." },
      { it:"il coraggio",      es:"el coraje / la valentía",         tp:"noun", lv:"B1", ex_it:"Hai avuto molto coraggio.",               ex_es:"Has tenido mucho coraje." },
      { it:"la timidezza",     es:"la timidez",                      tp:"noun", lv:"B1", ex_it:"La timidezza lo blocca in pubblico.",     ex_es:"La timidez lo bloquea en público." },
      { it:"il disagio",       es:"la incomodidad",                  tp:"noun", lv:"B1", ex_it:"Provo disagio in queste situazioni.",     ex_es:"Siento incomodidad en estas situaciones." },
      { it:"la meraviglia",    es:"la maravilla / el asombro",       tp:"noun", lv:"B1", ex_it:"Che meraviglia questo paesaggio!",        ex_es:"¡Qué maravilla este paisaje!" },
      { it:"la serenità",      es:"la serenidad",                    tp:"noun", lv:"B1", ex_it:"Ho bisogno di serenità nella mia vita.",  ex_es:"Necesito serenidad en mi vida." },
      { it:"l'imbarazzo",      es:"el apuro / la turbación",         tp:"noun", lv:"B1", ex_it:"Che imbarazzo, ho detto una cosa stupida!", ex_es:"¡Qué apuro, dije una tontería!", notes:"Diverso da 'vergogna' (shame). Imbarazzo = embarrassment/awkwardness." },
      { it:"la rassegnazione", es:"la resignación",                  tp:"noun", lv:"B1", ex_it:"Si è arresa alla rassegnazione.",         ex_es:"Se rindió a la resignación." },
    ]);

    _topup("Aggettivi", [
      { it:"caro",         es:"caro / querido",      tp:"adjective", lv:"A2", ex_it:"Questo ristorante è troppo caro.",        ex_es:"Este restaurante es demasiado caro.",   notes:"'Caro' = caro/costoso o querido (affetto)." },
      { it:"economico",    es:"económico / barato",  tp:"adjective", lv:"A2", ex_it:"Ho trovato un hotel economico.",          ex_es:"Encontré un hotel económico." },
      { it:"pulito",       es:"limpio",              tp:"adjective", lv:"A2", ex_it:"La camera è pulita e ordinata.",         ex_es:"La habitación está limpia y ordenada." },
      { it:"sporco",       es:"sucio",               tp:"adjective", lv:"A2", ex_it:"Ho le mani sporche.",                    ex_es:"Tengo las manos sucias." },
      { it:"libero",       es:"libre",               tp:"adjective", lv:"A2", ex_it:"Sei libero stasera?",                   ex_es:"¿Estás libre esta noche?" },
      { it:"occupato",     es:"ocupado",             tp:"adjective", lv:"A2", ex_it:"Sono molto occupato questa settimana.",  ex_es:"Estoy muy ocupado esta semana." },
      { it:"rumoroso",     es:"ruidoso",             tp:"adjective", lv:"B1", ex_it:"Il quartiere è molto rumoroso.",        ex_es:"El barrio es muy ruidoso." },
      { it:"silenzioso",   es:"silencioso",          tp:"adjective", lv:"B1", ex_it:"La biblioteca deve essere silenziosa.", ex_es:"La biblioteca debe ser silenciosa." },
      { it:"intelligente", es:"inteligente",         tp:"adjective", lv:"A2", ex_it:"È una ragazza molto intelligente.",     ex_es:"Es una chica muy inteligente." },
      { it:"divertente",   es:"divertido",           tp:"adjective", lv:"A2", ex_it:"È un film molto divertente.",           ex_es:"Es una película muy divertida." },
    ]);

    _topup("Casa e Arredamento", [
      { it:"il divano",     es:"el sofá",                lv:"A2", ex_it:"Mi siedo sul divano.",                      ex_es:"Me siento en el sofá." },
      { it:"la sedia",      es:"la silla",               lv:"A1", ex_it:"Siediti su questa sedia.",                 ex_es:"Siéntate en esta silla." },
      { it:"il tavolo",     es:"la mesa",                lv:"A1", ex_it:"Mangiamo al tavolo.",                      ex_es:"Comemos en la mesa." },
      { it:"il letto",      es:"la cama",                lv:"A1", ex_it:"Vado a letto tardi.",                      ex_es:"Me voy a la cama tarde." },
      { it:"l'armadio",     es:"el armario",             lv:"A2", ex_it:"Metti i vestiti nell'armadio.",             ex_es:"Pon la ropa en el armario." },
      { it:"la cucina",     es:"la cocina",              lv:"A1", ex_it:"Cucino sempre in cucina.",                  ex_es:"Siempre cocino en la cocina." },
      { it:"il bagno",      es:"el baño",                lv:"A1", ex_it:"Dov'è il bagno?",                          ex_es:"¿Dónde está el baño?" },
      { it:"la finestra",   es:"la ventana",             lv:"A1", ex_it:"Apri la finestra, per favore.",             ex_es:"Abre la ventana, por favor." },
      { it:"la porta",      es:"la puerta",              lv:"A1", ex_it:"Chiudi la porta.",                          ex_es:"Cierra la puerta." },
      { it:"lo specchio",   es:"el espejo",              lv:"A2", ex_it:"Mi guardo allo specchio.",                  ex_es:"Me miro en el espejo." },
      { it:"la lampada",    es:"la lámpara",             lv:"A2", ex_it:"Accendi la lampada.",                       ex_es:"Enciende la lámpara." },
      { it:"il frigorifero",es:"la nevera",              lv:"A2", ex_it:"Metti il latte in frigo.",                  ex_es:"Pon la leche en la nevera." },
      { it:"il balcone",    es:"el balcón",              lv:"A2", ex_it:"Ho i fiori sul balcone.",                   ex_es:"Tengo flores en el balcón." },
      { it:"il soffitto",   es:"el techo",               lv:"B1", ex_it:"Il soffitto è molto alto.",                 ex_es:"El techo es muy alto." },
      { it:"il salotto",    es:"el salón",               lv:"A2", ex_it:"Guardiamo la TV in salotto.",               ex_es:"Vemos la tele en el salón." },
      { it:"il tappeto",    es:"la alfombra",            lv:"A2", ex_it:"Ho un bel tappeto persiano in salotto.",     ex_es:"Tengo una bonita alfombra persa en el salón." },
      { it:"la tenda",      es:"la cortina",             lv:"A2", ex_it:"Chiudi le tende, c'è troppa luce.",          ex_es:"Cierra las cortinas, hay demasiada luz." },
      { it:"il cuscino",    es:"el cojín",               lv:"A2", ex_it:"Metto i cuscini sul divano.",                ex_es:"Pongo los cojines en el sofá." },
      { it:"il lavandino",  es:"el lavabo / el fregadero",lv:"A2", ex_it:"Il lavandino è intasato.",                  ex_es:"El lavabo está atascado." },
      { it:"la doccia",     es:"la ducha",               lv:"A2", ex_it:"Faccio la doccia ogni mattina.",             ex_es:"Me ducho cada mañana.", col:'["fare la doccia"]' },
      { it:"il forno",      es:"el horno",               lv:"A2", ex_it:"Ho messo la pizza nel forno.",               ex_es:"Puse la pizza en el horno." },
      { it:"la lavatrice",  es:"la lavadora",            lv:"A2", ex_it:"Devo mettere il bucato in lavatrice.",        ex_es:"Tengo que poner la ropa en la lavadora." },
      { it:"la libreria",   es:"la estantería",          lv:"A2", ex_it:"Ho molti libri sulla libreria.",             ex_es:"Tengo muchos libros en la estantería.", notes:"Qui 'libreria' = estantería (mueble). Come negozio = 'la libreria'. Biblioteca = 'la biblioteca'." },
      { it:"il cassetto",   es:"el cajón",               lv:"A2", ex_it:"Le forchette sono nel cassetto.",            ex_es:"Los tenedores están en el cajón." },
      { it:"il corridoio",  es:"el pasillo",             lv:"A2", ex_it:"Il bagno è in fondo al corridoio.",          ex_es:"El baño está al fondo del pasillo." },
      { it:"le scale",      es:"las escaleras",          lv:"A2", ex_it:"Prendo le scale invece dell'ascensore.",     ex_es:"Subo las escaleras en lugar del ascensor." },
      { it:"il garage",     es:"el garaje",              lv:"A2", ex_it:"Parcheggio la macchina in garage.",           ex_es:"Aparco el coche en el garaje." },
      { it:"il giardino",   es:"el jardín",              lv:"A2", ex_it:"I bambini giocano in giardino.",             ex_es:"Los niños juegan en el jardín." },
      { it:"il camino",     es:"la chimenea",            lv:"B1", ex_it:"Accendiamo il camino d'inverno.",            ex_es:"Encendemos la chimenea en invierno." },
      { it:"la cantina",    es:"el sótano / la bodega",  lv:"B1", ex_it:"Il vino è conservato in cantina.",           ex_es:"El vino se guarda en la bodega." },
    ]);

    _topup("Abbigliamento", [
      { it:"la camicia",              es:"la camisa",                lv:"A2", ex_it:"Porta una camicia bianca.",                      ex_es:"Lleva una camisa blanca." },
      { it:"i pantaloni",             es:"los pantalones",           lv:"A1", ex_it:"Questi pantaloni sono troppo stretti.",           ex_es:"Estos pantalones son demasiado estrechos." },
      { it:"la gonna",                es:"la falda",                 lv:"A2", ex_it:"Indossa una gonna lunga.",                        ex_es:"Lleva una falda larga." },
      { it:"il vestito",              es:"el vestido",               lv:"A1", ex_it:"Ha un bel vestito rosso.",                        ex_es:"Tiene un bonito vestido rojo." },
      { it:"le scarpe",               es:"los zapatos",              lv:"A1", ex_it:"Queste scarpe mi fanno male.",                    ex_es:"Estos zapatos me duelen." },
      { it:"il maglione",             es:"el jersey / el suéter",    lv:"A2", ex_it:"Metti un maglione, fa freddo.",                   ex_es:"Ponte un jersey, hace frío." },
      { it:"la giacca",               es:"la chaqueta",              lv:"A2", ex_it:"Ho dimenticato la giacca.",                       ex_es:"Olvidé la chaqueta." },
      { it:"il cappotto",             es:"el abrigo",                lv:"A2", ex_it:"D'inverno metto il cappotto.",                    ex_es:"En invierno me pongo el abrigo." },
      { it:"i calzini",               es:"los calcetines",           lv:"A2", ex_it:"Ho perso un calzino.",                            ex_es:"Perdí un calcetín." },
      { it:"la borsa",                es:"el bolso",                 lv:"A2", ex_it:"Ho tutto nella mia borsa.",                       ex_es:"Tengo todo en mi bolso." },
      { it:"il cappello",             es:"el sombrero",              lv:"A2", ex_it:"Porta sempre un cappello.",                        ex_es:"Siempre lleva sombrero." },
      { it:"la sciarpa",              es:"la bufanda",               lv:"A2", ex_it:"Metti la sciarpa, c'è vento.",                    ex_es:"Ponte la bufanda, hay viento." },
      { it:"i jeans",                 es:"los vaqueros",             lv:"A1", ex_it:"Preferisco i jeans ai pantaloni formali.",        ex_es:"Prefiero los vaqueros a los pantalones formales." },
      { it:"le scarpe da ginnastica", es:"las zapatillas deportivas",lv:"A2", ex_it:"Vado in palestra con le scarpe da ginnastica.",   ex_es:"Voy al gimnasio con las zapatillas." },
      { it:"la taglia",               es:"la talla",                 lv:"A2", ex_it:"Che taglia porti?",                               ex_es:"¿Qué talla usas?" },
      { it:"la cravatta",          es:"la corbata",             lv:"A2", ex_it:"Devo mettere la cravatta per il colloquio.",    ex_es:"Tengo que ponerme la corbata para la entrevista." },
      { it:"l'impermeabile",       es:"el impermeable",         lv:"A2", ex_it:"Ho preso l'impermeabile perché piove.",         ex_es:"Cogí el impermeable porque llueve." },
      { it:"i guanti",             es:"los guantes",            lv:"A2", ex_it:"Metti i guanti, fa freddo.",                    ex_es:"Ponte los guantes, hace frío." },
      { it:"il pigiama",           es:"el pijama",              lv:"A2", ex_it:"Vado a letto con il pigiama.",                  ex_es:"Me voy a dormir con el pijama." },
      { it:"il costume da bagno",  es:"el bañador",             lv:"A2", ex_it:"Ho dimenticato il costume da bagno.",           ex_es:"Olvidé el bañador." },
      { it:"l'ombrello",           es:"el paraguas",            lv:"A2", ex_it:"Ho dimenticato l'ombrello e mi sono bagnato.", ex_es:"Olvidé el paraguas y me mojé." },
      { it:"la cintura",           es:"el cinturón",            lv:"A2", ex_it:"Ho bisogno di una cintura nuova.",              ex_es:"Necesito un cinturón nuevo." },
      { it:"gli occhiali",         es:"las gafas",              lv:"A2", ex_it:"Ho dimenticato gli occhiali a casa.",           ex_es:"Olvidé las gafas en casa." },
      { it:"la collana",           es:"el collar",              lv:"B1", ex_it:"Ha una bella collana d'oro.",                  ex_es:"Tiene un bonito collar de oro." },
      { it:"l'orologio",           es:"el reloj",               lv:"A2", ex_it:"L'orologio da polso è rotto.",                 ex_es:"El reloj de pulsera está roto." },
      { it:"gli stivali",          es:"las botas",              lv:"A2", ex_it:"Gli stivali di pelle sono eleganti.",           ex_es:"Las botas de cuero son elegantes." },
      { it:"i sandali",            es:"las sandalias",          lv:"A2", ex_it:"D'estate metto i sandali.",                    ex_es:"En verano me pongo las sandalias." },
      { it:"la felpa",             es:"la sudadera",            lv:"A2", ex_it:"Metto la felpa quando fa fresco.",              ex_es:"Me pongo la sudadera cuando refresca." },
      { it:"lo zaino",             es:"la mochila",             lv:"A2", ex_it:"Metto i libri nello zaino.",                   ex_es:"Meto los libros en la mochila." },
      { it:"il foulard",           es:"el pañuelo de cuello",  lv:"B1", ex_it:"Porta sempre un foulard colorato.",             ex_es:"Siempre lleva un pañuelo de colores." },
    ]);

    _topup("Trasporti", [
      { it:"l'autobus",        es:"el autobús",           lv:"A1", ex_it:"Prendo l'autobus per andare al lavoro.",      ex_es:"Tomo el autobús para ir al trabajo." },
      { it:"il treno",         es:"el tren",              lv:"A1", ex_it:"Il treno parte alle otto.",                   ex_es:"El tren sale a las ocho." },
      { it:"la metropolitana", es:"el metro",             lv:"A2", ex_it:"Prendo la metro ogni giorno.",               ex_es:"Cojo el metro todos los días.", notes:"Abbreviazione: metro" },
      { it:"l'aereo",          es:"el avión",             lv:"A1", ex_it:"Ho paura di viaggiare in aereo.",            ex_es:"Tengo miedo de viajar en avión." },
      { it:"la macchina",      es:"el coche",             lv:"A1", ex_it:"Vado in macchina al lavoro.",                ex_es:"Voy al trabajo en coche." },
      { it:"la bicicletta",    es:"la bicicleta",         lv:"A1", ex_it:"Vado in bici al parco.",                     ex_es:"Voy al parque en bici.", notes:"Abbreviazione: la bici" },
      { it:"il taxi",          es:"el taxi",              lv:"A1", ex_it:"Chiamo un taxi.",                             ex_es:"Llamo un taxi." },
      { it:"la nave",          es:"el barco",             lv:"A2", ex_it:"Siamo andati in Sardegna in nave.",           ex_es:"Fuimos a Cerdeña en barco." },
      { it:"il biglietto",     es:"el billete",           lv:"A2", ex_it:"Ho comprato il biglietto online.",            ex_es:"Compré el billete por internet." },
      { it:"la fermata",       es:"la parada",            lv:"A2", ex_it:"Scendo alla prossima fermata.",               ex_es:"Me bajo en la próxima parada." },
      { it:"il traffico",      es:"el tráfico",           lv:"A2", ex_it:"C'è molto traffico in centro.",              ex_es:"Hay mucho tráfico en el centro." },
      { it:"il parcheggio",    es:"el aparcamiento",      lv:"B1", ex_it:"Non trovo parcheggio.",                       ex_es:"No encuentro aparcamiento." },
      { it:"la moto",          es:"la moto",                    lv:"A2", ex_it:"Vado al lavoro in moto.",                          ex_es:"Voy al trabajo en moto." },
      { it:"il camion",        es:"el camión",                  lv:"A2", ex_it:"Il camion trasporta le merci.",                    ex_es:"El camión transporta las mercancías." },
      { it:"l'elicottero",     es:"el helicóptero",             lv:"B1", ex_it:"L'elicottero atterra sul tetto.",                  ex_es:"El helicóptero aterriza en el tejado." },
      { it:"la crociera",      es:"el crucero",                 lv:"B1", ex_it:"Abbiamo fatto una crociera nel Mediterraneo.",     ex_es:"Hicimos un crucero por el Mediterráneo." },
      { it:"il traghetto",     es:"el ferry / el transbordador",lv:"B1", ex_it:"Prendiamo il traghetto per la Sardegna.",          ex_es:"Tomamos el ferry hacia Cerdeña." },
      { it:"il porto",         es:"el puerto",                  lv:"A2", ex_it:"La nave è arrivata al porto.",                     ex_es:"El barco llegó al puerto." },
      { it:"l'aeroporto",      es:"el aeropuerto",              lv:"A2", ex_it:"L'aeroporto è lontano dal centro.",                ex_es:"El aeropuerto está lejos del centro." },
      { it:"la stazione",      es:"la estación",                lv:"A2", ex_it:"Ti aspetto alla stazione.",                        ex_es:"Te espero en la estación." },
      { it:"l'autostrada",     es:"la autopista",               lv:"A2", ex_it:"Prendiamo l'autostrada per risparmiare tempo.",    ex_es:"Tomamos la autopista para ahorrar tiempo." },
      { it:"il binario",       es:"el andén / la vía",          lv:"A2", ex_it:"Il treno parte dal binario tre.",                  ex_es:"El tren sale del andén tres." },
      { it:"la coincidenza",   es:"el enlace / la correspondencia",lv:"B1",ex_it:"Ho perso la coincidenza a Milano.",              ex_es:"Perdí el enlace en Milán.", notes:"In contesto ferroviario/aereo = il transbordo." },
      { it:"il ritardo",       es:"el retraso",                 lv:"A2", ex_it:"Il treno ha un ritardo di venti minuti.",          ex_es:"El tren tiene un retraso de veinte minutos." },
      { it:"il pedone",        es:"el peatón",                  lv:"B1", ex_it:"I pedoni hanno la precedenza sulle strisce.",      ex_es:"Los peatones tienen preferencia en los pasos de cebra." },
      { it:"la patente",       es:"el carné de conducir",       lv:"B1", ex_it:"Ho preso la patente a diciotto anni.",             ex_es:"Me saqué el carné de conducir a los dieciocho años." },
      { it:"il carburante",    es:"el combustible",             lv:"B1", ex_it:"Il serbatoio è quasi vuoto di carburante.",        ex_es:"El depósito está casi vacío de combustible." },
      { it:"il motore",        es:"el motor",                   lv:"B1", ex_it:"Il motore della macchina fa un rumore strano.",    ex_es:"El motor del coche hace un ruido extraño." },
      { it:"la rotatoria",     es:"la rotonda / la glorieta",   lv:"B1", ex_it:"Gira a destra alla rotatoria.",                   ex_es:"Gira a la derecha en la rotonda." },
      { it:"la corsia",        es:"el carril",                  lv:"B1", ex_it:"Mantieni la corsia di destra in autostrada.",      ex_es:"Mantén el carril derecho en la autopista." },
    ]);

    _topup("Lavoro e Professioni", [
      { it:"il medico",         es:"el médico",               lv:"A2", ex_it:"Devo andare dal medico.",                      ex_es:"Tengo que ir al médico." },
      { it:"l'avvocato",        es:"el abogado",              lv:"A2", ex_it:"Ho bisogno di un avvocato.",                   ex_es:"Necesito un abogado." },
      { it:"l'insegnante",      es:"el profesor / la profesora",lv:"A1",ex_it:"L'insegnante spiega bene.",                  ex_es:"El profesor explica bien." },
      { it:"l'ingegnere",       es:"el/la ingeniero/a",       lv:"A2", ex_it:"Lavoro come ingegnere informatico.",            ex_es:"Trabajo como ingeniero informático." },
      { it:"il cuoco",          es:"el cocinero / el chef",   lv:"A2", ex_it:"Il cuoco prepara piatti deliziosi.",           ex_es:"El cocinero prepara platos deliciosos." },
      { it:"il giornalista",    es:"el/la periodista",        lv:"A2", ex_it:"Il giornalista scrive per un quotidiano.",     ex_es:"El periodista escribe para un diario." },
      { it:"l'architetto",      es:"el/la arquitecto/a",      lv:"B1", ex_it:"L'architetto ha progettato la casa.",          ex_es:"El arquitecto diseñó la casa." },
      { it:"il cameriere",      es:"el camarero",             lv:"A2", ex_it:"Il cameriere porta il conto.",                 ex_es:"El camarero trae la cuenta." },
      { it:"l'ufficio",         es:"la oficina",              lv:"A2", ex_it:"Lavoro in un ufficio in centro.",              ex_es:"Trabajo en una oficina en el centro." },
      { it:"la riunione",       es:"la reunión",              lv:"B1", ex_it:"Ho una riunione alle dieci.",                  ex_es:"Tengo una reunión a las diez." },
      { it:"il contratto",      es:"el contrato",             lv:"B1", ex_it:"Ho firmato il contratto.",                     ex_es:"Firmé el contrato." },
      { it:"lo stipendio",      es:"el sueldo",               lv:"B1", ex_it:"Il mio stipendio è aumentato.",               ex_es:"Mi sueldo ha aumentado." },
      { it:"la carriera",       es:"la carrera profesional",  lv:"B1", ex_it:"Vuole fare carriera in banca.",               ex_es:"Quiere hacer carrera en un banco." },
      { it:"il collega",        es:"el compañero de trabajo", lv:"B1", ex_it:"I miei colleghi sono simpatici.",              ex_es:"Mis compañeros de trabajo son simpáticos." },
      { it:"il curriculum",     es:"el currículum",           lv:"B1", ex_it:"Ho mandato il curriculum vitae.",              ex_es:"Envié el currículum vitae." },
      { it:"il pompiere",      es:"el bombero",              lv:"A2", ex_it:"Il pompiere ha spento l'incendio.",               ex_es:"El bombero apagó el incendio." },
      { it:"il poliziotto",    es:"el policía",              lv:"A2", ex_it:"Il poliziotto dirige il traffico.",               ex_es:"El policía dirige el tráfico." },
      { it:"l'infermiere",     es:"el/la enfermero/a",       lv:"A2", ex_it:"L'infermiere mi ha fatto un'iniezione.",          ex_es:"El enfermero me puso una inyección." },
      { it:"il farmacista",    es:"el farmacéutico",         lv:"A2", ex_it:"Il farmacista mi ha consigliato questa medicina.", ex_es:"El farmacéutico me recomendó este medicamento." },
      { it:"il traduttore",    es:"el traductor",            lv:"B1", ex_it:"Lavoro come traduttore freelance.",               ex_es:"Trabajo como traductor autónomo." },
      { it:"il programmatore", es:"el programador",          lv:"B1", ex_it:"Il programmatore ha risolto il bug.",             ex_es:"El programador resolvió el error." },
      { it:"il contabile",     es:"el contable / el contador",lv:"B1",ex_it:"Il contabile gestisce le finanze dell'azienda.",  ex_es:"El contable gestiona las finanzas de la empresa." },
      { it:"il musicista",     es:"el músico",               lv:"A2", ex_it:"È un musicista molto talentuoso.",               ex_es:"Es un músico muy talentoso." },
      { it:"l'autista",        es:"el conductor / el chófer",lv:"A2", ex_it:"L'autista dell'autobus è molto gentile.",        ex_es:"El conductor del autobús es muy amable." },
      { it:"il cassiere",      es:"el cajero",               lv:"A2", ex_it:"Il cassiere ha fatto uno sbaglio con il resto.",  ex_es:"El cajero cometió un error con el cambio." },
      { it:"il postino",       es:"el cartero",              lv:"A2", ex_it:"Il postino ha lasciato un pacco.",                ex_es:"El cartero dejó un paquete." },
      { it:"il portiere",      es:"el portero",              lv:"A2", ex_it:"Il portiere dell'hotel mi ha dato la chiave.",    ex_es:"El portero del hotel me dio la llave." },
      { it:"il tirocinante",   es:"el becario / el aprendiz",lv:"B1", ex_it:"Ho lavorato come tirocinante per tre mesi.",     ex_es:"Trabajé como becario durante tres meses." },
      { it:"l'imprenditore",   es:"el empresario",           lv:"B1", ex_it:"L'imprenditore ha fondato tre aziende.",         ex_es:"El empresario ha fundado tres empresas." },
      { it:"il commerciante",  es:"el comerciante",          lv:"B1", ex_it:"Il commerciante vende prodotti artigianali.",     ex_es:"El comerciante vende productos artesanales." },
    ]);

    _topup("Il Tempo", [
      { it:"la pioggia",    es:"la lluvia",          lv:"A2", ex_it:"Mi piace la pioggia.",                        ex_es:"Me gusta la lluvia." },
      { it:"il sole",       es:"el sol",             lv:"A1", ex_it:"C'è il sole oggi.",                           ex_es:"Hoy hace sol." },
      { it:"la neve",       es:"la nieve",           lv:"A2", ex_it:"È caduta tanta neve.",                        ex_es:"Ha caído mucha nieve." },
      { it:"il vento",      es:"el viento",          lv:"A2", ex_it:"C'è molto vento oggi.",                      ex_es:"Hoy hace mucho viento." },
      { it:"il temporale",  es:"la tormenta",        lv:"B1", ex_it:"Sta arrivando un temporale.",                 ex_es:"Se acerca una tormenta." },
      { it:"la nuvola",     es:"la nube",            lv:"A2", ex_it:"Il cielo è pieno di nuvole.",                ex_es:"El cielo está lleno de nubes." },
      { it:"la nebbia",     es:"la niebla",          lv:"B1", ex_it:"C'è molta nebbia a Milano.",                 ex_es:"Hay mucha niebla en Milán." },
      { it:"la temperatura",es:"la temperatura",     lv:"B1", ex_it:"La temperatura è scesa sotto zero.",          ex_es:"La temperatura bajó bajo cero." },
      { it:"l'estate",      es:"el verano",          lv:"A1", ex_it:"D'estate fa molto caldo.",                   ex_es:"En verano hace mucho calor." },
      { it:"l'inverno",     es:"el invierno",        lv:"A1", ex_it:"D'inverno nevica spesso.",                   ex_es:"En invierno nieva a menudo." },
      { it:"la primavera",  es:"la primavera",       lv:"A1", ex_it:"In primavera fioriscono i fiori.",           ex_es:"En primavera florecen las flores." },
      { it:"l'autunno",     es:"el otoño",           lv:"A1", ex_it:"L'autunno è la mia stagione preferita.",     ex_es:"El otoño es mi estación favorita." },
      { it:"il freddo",     es:"el frío",                  lv:"A2", ex_it:"Che freddo oggi! Metti il cappotto.",             ex_es:"¡Qué frío hace hoy! Ponte el abrigo." },
      { it:"il ghiaccio",   es:"el hielo",                 lv:"A2", ex_it:"Attenzione al ghiaccio sul marciapiede.",        ex_es:"Cuidado con el hielo en la acera." },
      { it:"la grandine",   es:"el granizo",               lv:"B1", ex_it:"La grandine ha danneggiato le auto.",            ex_es:"El granizo dañó los coches." },
      { it:"l'arcobaleno",  es:"el arcoíris",              lv:"A2", ex_it:"Dopo la pioggia è apparso un arcobaleno.",       ex_es:"Después de la lluvia apareció un arcoíris." },
      { it:"il fulmine",    es:"el rayo / el relámpago",   lv:"B1", ex_it:"Un fulmine ha colpito l'albero.",               ex_es:"Un rayo golpeó el árbol." },
      { it:"il tuono",      es:"el trueno",                lv:"B1", ex_it:"Ho sentito un forte tuono.",                    ex_es:"Oí un fuerte trueno." },
      { it:"il cielo",      es:"el cielo",                 lv:"A1", ex_it:"Il cielo è completamente blu oggi.",            ex_es:"El cielo está completamente azul hoy." },
      { it:"la brina",      es:"la escarcha",              lv:"B1", ex_it:"C'è la brina sul parabrezza stamattina.",       ex_es:"Hay escarcha en el parabrisas esta mañana." },
      { it:"il sereno",     es:"el tiempo despejado",      lv:"B1", ex_it:"Domani è previsto il sereno.",                  ex_es:"Mañana se prevé tiempo despejado." },
      { it:"l'uragano",     es:"el huracán",               lv:"B1", ex_it:"L'uragano ha devastato la costa.",              ex_es:"El huracán devastó la costa." },
      { it:"l'alluvione",   es:"la inundación",            lv:"B1", ex_it:"L'alluvione ha allagato le strade.",            ex_es:"La inundación inundó las calles." },
      { it:"la siccità",    es:"la sequía",                lv:"B1", ex_it:"La siccità ha distrutto il raccolto.",          ex_es:"La sequía destruyó la cosecha." },
      { it:"il clima",      es:"el clima",                 lv:"B1", ex_it:"Il clima sta cambiando rapidamente.",            ex_es:"El clima está cambiando rápidamente." },
      { it:"il meteo",      es:"el tiempo (meteorológico)",lv:"A2", ex_it:"Ho controllato il meteo per domani.",           ex_es:"He consultado el tiempo para mañana." },
      { it:"l'umidità",     es:"la humedad",               lv:"B1", ex_it:"L'umidità rende il caldo insopportabile.",      ex_es:"La humedad hace el calor insoportable." },
      { it:"la brezza",     es:"la brisa",                 lv:"B1", ex_it:"Una leggera brezza rende la giornata piacevole.", ex_es:"Una suave brisa hace el día agradable." },
      { it:"il tramonto",   es:"el atardecer",             lv:"A2", ex_it:"Il tramonto sul mare è bellissimo.",            ex_es:"El atardecer sobre el mar es precioso." },
      { it:"l'alba",        es:"el amanecer / el alba",    lv:"A2", ex_it:"Mi sono svegliato all'alba.",                   ex_es:"Me desperté al amanecer." },
    ]);

    _topup("La Città", [
      { it:"la piazza",          es:"la plaza",              lv:"A2", ex_it:"Ci incontriamo in piazza.",                   ex_es:"Nos vemos en la plaza." },
      { it:"la chiesa",          es:"la iglesia",            lv:"A2", ex_it:"La chiesa è bellissima.",                     ex_es:"La iglesia es preciosa." },
      { it:"il museo",           es:"el museo",              lv:"A2", ex_it:"Ho visitato il museo degli Uffizi.",           ex_es:"Visité el museo de los Uffizi." },
      { it:"il supermercato",    es:"el supermercado",       lv:"A1", ex_it:"Vado al supermercato.",                       ex_es:"Voy al supermercado." },
      { it:"la farmacia",        es:"la farmacia",           lv:"A2", ex_it:"Compra le medicine in farmacia.",             ex_es:"Compra los medicamentos en la farmacia." },
      { it:"l'ospedale",         es:"el hospital",           lv:"A2", ex_it:"L'ospedale è vicino a casa mia.",             ex_es:"El hospital está cerca de mi casa." },
      { it:"il ristorante",      es:"el restaurante",        lv:"A1", ex_it:"Prenoto un tavolo al ristorante.",            ex_es:"Reservo una mesa en el restaurante." },
      { it:"il marciapiede",     es:"la acera",              lv:"B1", ex_it:"Cammina sul marciapiede.",                    ex_es:"Camina por la acera." },
      { it:"il semaforo",        es:"el semáforo",           lv:"A2", ex_it:"Aspetta il verde al semaforo.",               ex_es:"Espera el verde en el semáforo." },
      { it:"il ponte",           es:"el puente",             lv:"A2", ex_it:"Il Ponte Vecchio è famoso a Firenze.",        ex_es:"El Puente Vecchio es famoso en Florencia." },
      { it:"il quartiere",       es:"el barrio",             lv:"B1", ex_it:"Abito in un bel quartiere.",                  ex_es:"Vivo en un buen barrio." },
      { it:"la banca",           es:"el banco",              lv:"A2", ex_it:"Devo andare in banca.",                       ex_es:"Tengo que ir al banco." },
      { it:"il parco",           es:"el parque",             lv:"A1", ex_it:"I bambini giocano al parco.",                 ex_es:"Los niños juegan en el parque." },
      { it:"il centro storico",  es:"el casco histórico",    lv:"B1", ex_it:"Il centro storico di Roma è magnifico.",      ex_es:"El casco histórico de Roma es magnífico." },
      { it:"la periferia",       es:"las afueras",           lv:"B1", ex_it:"La casa è in periferia.",                     ex_es:"La casa está en las afueras." },
      { it:"il teatro",              es:"el teatro",             lv:"A2", ex_it:"Andiamo a teatro stasera.",                    ex_es:"Vamos al teatro esta noche." },
      { it:"la biblioteca",          es:"la biblioteca",         lv:"A2", ex_it:"Studio in biblioteca ogni pomeriggio.",        ex_es:"Estudio en la biblioteca cada tarde." },
      { it:"la scuola",              es:"la escuela",            lv:"A1", ex_it:"I bambini vanno a scuola.",                   ex_es:"Los niños van a la escuela." },
      { it:"l'università",           es:"la universidad",        lv:"A2", ex_it:"Studio all'università di Bologna.",           ex_es:"Estudio en la universidad de Bolonia." },
      { it:"la stazione di polizia", es:"la comisaría",          lv:"B1", ex_it:"Ho denunciato il furto alla stazione di polizia.", ex_es:"Denuncié el robo en la comisaría." },
      { it:"l'ufficio postale",      es:"la oficina de correos", lv:"B1", ex_it:"Ho spedito il pacco all'ufficio postale.",    ex_es:"Envié el paquete en la oficina de correos." },
      { it:"il mercato",             es:"el mercado",            lv:"A2", ex_it:"Compro la frutta al mercato.",                ex_es:"Compro la fruta en el mercado." },
      { it:"il negozio",             es:"la tienda",             lv:"A1", ex_it:"Il negozio è aperto fino alle otto.",          ex_es:"La tienda está abierta hasta las ocho." },
      { it:"il bar",                 es:"el bar / la cafetería", lv:"A1", ex_it:"Faccio colazione al bar.",                   ex_es:"Desayuno en el bar.", notes:"Il bar italiano = luogo per caffè, cappuccino, cornetto." },
      { it:"il cinema",              es:"el cine",               lv:"A1", ex_it:"Andiamo al cinema questo weekend.",           ex_es:"Vamos al cine este fin de semana." },
      { it:"lo stadio",              es:"el estadio",            lv:"A2", ex_it:"Lo stadio è pieno di tifosi.",               ex_es:"El estadio está lleno de aficionados." },
      { it:"l'hotel",                es:"el hotel",              lv:"A1", ex_it:"Ho prenotato un hotel in centro.",            ex_es:"Reservé un hotel en el centro." },
      { it:"il grattacielo",         es:"el rascacielos",        lv:"B1", ex_it:"Milano ha molti grattacieli moderni.",        ex_es:"Milán tiene muchos rascacielos modernos." },
      { it:"il vicolo",              es:"el callejón",           lv:"B1", ex_it:"Il vicolo è stretto e buio.",                ex_es:"El callejón es estrecho y oscuro." },
      { it:"la fontana",             es:"la fuente",             lv:"A2", ex_it:"Ci siamo seduti vicino alla fontana.",        ex_es:"Nos sentamos cerca de la fuente." },
    ]);

    _topup("Sport e Tempo Libero", [
      { it:"il calcio",        es:"el fútbol",           lv:"A1", ex_it:"Il calcio è lo sport più popolare in Italia.",    ex_es:"El fútbol es el deporte más popular en Italia." },
      { it:"il nuoto",         es:"la natación",         lv:"A2", ex_it:"Vado a nuotare tre volte a settimana.",           ex_es:"Voy a nadar tres veces por semana." },
      { it:"la palestra",      es:"el gimnasio",         lv:"A2", ex_it:"Mi sono iscritto in palestra.",                   ex_es:"Me inscribí en el gimnasio." },
      { it:"la squadra",       es:"el equipo",           lv:"A2", ex_it:"Tifo per la squadra di Roma.",                   ex_es:"Soy hincha del equipo de Roma." },
      { it:"il campionato",    es:"el campeonato",       lv:"B1", ex_it:"La Juventus ha vinto il campionato.",             ex_es:"La Juventus ganó el campeonato." },
      { it:"il tifoso",        es:"el aficionado / el hincha",lv:"B1",ex_it:"I tifosi italiani sono molto appassionati.", ex_es:"Los aficionados italianos son muy apasionados." },
      { it:"il tennis",        es:"el tenis",            lv:"A2", ex_it:"Gioco a tennis il sabato.",                      ex_es:"Juego al tenis los sábados." },
      { it:"la corsa",         es:"el footing / la carrera",lv:"A2",ex_it:"Faccio la corsa ogni mattina.",                ex_es:"Hago footing cada mañana." },
      { it:"il tempo libero",  es:"el tiempo libre",     lv:"A2", ex_it:"Nel tempo libero leggo e suono la chitarra.",    ex_es:"En mi tiempo libre leo y toco la guitarra." },
      { it:"lo sci",           es:"el esquí",            lv:"A2", ex_it:"D'inverno vado a sciare.",                       ex_es:"En invierno voy a esquiar." },
      { it:"la piscina",       es:"la piscina",          lv:"A2", ex_it:"Andiamo in piscina questo weekend.",              ex_es:"Vamos a la piscina este fin de semana." },
      { it:"il gol",           es:"el gol",              lv:"A2", ex_it:"Ha segnato un gol al novantesimo minuto.",        ex_es:"Marcó un gol en el minuto noventa." },
      { it:"la pallavolo",    es:"el voleibol",          lv:"A2", ex_it:"Giochiamo a pallavolo in spiaggia.",             ex_es:"Jugamos al voleibol en la playa." },
      { it:"il basket",       es:"el baloncesto",        lv:"A2", ex_it:"Mio figlio gioca a basket.",                    ex_es:"Mi hijo juega al baloncesto." },
      { it:"il ciclismo",     es:"el ciclismo",          lv:"A2", ex_it:"Il ciclismo è popolare in Italia.",             ex_es:"El ciclismo es popular en Italia." },
      { it:"il rugby",        es:"el rugby",             lv:"A2", ex_it:"La nazionale italiana di rugby gioca bene.",    ex_es:"La selección italiana de rugby juega bien." },
      { it:"la boxe",         es:"el boxeo",             lv:"B1", ex_it:"Si allena alla boxe tre volte a settimana.",    ex_es:"Se entrena en boxeo tres veces por semana." },
      { it:"la maratona",     es:"la maratón",           lv:"B1", ex_it:"Ha corso la maratona di Roma.",                ex_es:"Corrió la maratón de Roma." },
      { it:"l'allenatore",    es:"el entrenador",        lv:"B1", ex_it:"L'allenatore ha motivato la squadra.",          ex_es:"El entrenador motivó al equipo." },
      { it:"il campione",     es:"el campeón",           lv:"B1", ex_it:"È diventato campione del mondo.",              ex_es:"Se convirtió en campeón del mundo." },
      { it:"la gara",         es:"la competición / la carrera",lv:"B1",ex_it:"Ha vinto la gara di nuoto.",              ex_es:"Ganó la competición de natación." },
      { it:"l'arbitro",       es:"el árbitro",           lv:"B1", ex_it:"L'arbitro ha fischiato un fallo.",              ex_es:"El árbitro pitó una falta." },
      { it:"la lettura",      es:"la lectura",           lv:"A2", ex_it:"La lettura è il mio hobby preferito.",         ex_es:"La lectura es mi hobby favorito." },
      { it:"la pittura",      es:"la pintura",           lv:"A2", ex_it:"La pittura mi rilassa moltissimo.",            ex_es:"La pintura me relaja muchísimo." },
      { it:"la fotografia",   es:"la fotografía",        lv:"A2", ex_it:"Faccio fotografie nel tempo libero.",          ex_es:"Hago fotografías en mi tiempo libre." },
      { it:"il giardinaggio", es:"la jardinería",        lv:"B1", ex_it:"Il giardinaggio è una passione di mia madre.", ex_es:"La jardinería es la pasión de mi madre." },
      { it:"i videogiochi",   es:"los videojuegos",      lv:"A2", ex_it:"I videogiochi mi fanno rilassare.",            ex_es:"Los videojuegos me hacen relajar." },
      { it:"il ballo",        es:"el baile",             lv:"A2", ex_it:"Il ballo flamenco è molto appassionante.",     ex_es:"El baile flamenco es muy apasionante.", col:'["andare a ballare","lezione di ballo"]' },
      { it:"la vela",         es:"la vela (deporte)",    lv:"B1", ex_it:"Faccio vela d'estate sul lago.",              ex_es:"Practico vela en verano en el lago." },
      { it:"il fischio",      es:"il silbato / el pitido",lv:"B1",ex_it:"L'arbitro ha fischiato la fine della partita.", ex_es:"El árbitro pitó el final del partido." },
    ]);

    _topup("La Salute", [
      { it:"il dolore",         es:"el dolor",              lv:"A2", ex_it:"Ho un forte dolore alla schiena.",              ex_es:"Tengo un fuerte dolor de espalda." },
      { it:"la febbre",         es:"la fiebre",             lv:"A2", ex_it:"Ho la febbre a trentotto.",                     ex_es:"Tengo fiebre de treinta y ocho." },
      { it:"l'influenza",       es:"la gripe",              lv:"A2", ex_it:"Ho preso l'influenza.",                         ex_es:"Cogí la gripe.", notes:"'Influenza' = la gripe. 'Influencia' (poder) = il potere." },
      { it:"il raffreddore",    es:"el resfriado",          lv:"A2", ex_it:"Ho il raffreddore e non riesco a respirare.",   ex_es:"Tengo el resfriado y no puedo respirar." },
      { it:"la medicina",       es:"el medicamento",        lv:"A2", ex_it:"Prendi la medicina dopo i pasti.",              ex_es:"Toma el medicamento después de las comidas." },
      { it:"la ricetta medica", es:"la receta médica",      lv:"B1", ex_it:"Ho bisogno di una ricetta medica.",             ex_es:"Necesito una receta médica." },
      { it:"l'allergia",        es:"la alergia",            lv:"B1", ex_it:"Sono allergico ai frutti di mare.",             ex_es:"Soy alérgico a los mariscos." },
      { it:"il pronto soccorso",es:"urgencias",             lv:"B1", ex_it:"Lo hanno portato al pronto soccorso.",          ex_es:"Lo llevaron a urgencias." },
      { it:"la tosse",          es:"la tos",                lv:"A2", ex_it:"Ho una tosse terribile.",                       ex_es:"Tengo una tos terrible." },
      { it:"la dieta",          es:"la dieta",              lv:"B1", ex_it:"Sono a dieta da un mese.",                      ex_es:"Llevo un mes a dieta." },
      { it:"l'ambulanza",       es:"la ambulancia",         lv:"A2", ex_it:"Chiamate un'ambulanza!",                        ex_es:"¡Llamen una ambulancia!" },
      { it:"la visita medica",  es:"la consulta médica",    lv:"B1", ex_it:"Ho una visita medica domani.",                  ex_es:"Tengo una consulta médica mañana." },
      { it:"il chirurgo",      es:"el cirujano",                  lv:"B1", ex_it:"Il chirurgo ha operato per ore.",                  ex_es:"El cirujano operó durante horas." },
      { it:"lo psicologo",     es:"el psicólogo",                 lv:"B1", ex_it:"Vado dallo psicologo ogni settimana.",             ex_es:"Voy al psicólogo cada semana." },
      { it:"l'osso",           es:"el hueso",                     lv:"A2", ex_it:"Si è rotto un osso cadendo.",                     ex_es:"Se rompió un hueso al caer." },
      { it:"il muscolo",       es:"el músculo",                   lv:"A2", ex_it:"Ho un dolore ai muscoli dopo l'allenamento.",      ex_es:"Me duelen los músculos después del entrenamiento." },
      { it:"la pressione",     es:"la presión (arterial)",        lv:"B1", ex_it:"Ho la pressione alta.",                           ex_es:"Tengo la presión alta." },
      { it:"il vaccino",       es:"la vacuna",                    lv:"B1", ex_it:"Ho fatto il vaccino contro l'influenza.",          ex_es:"Me puse la vacuna contra la gripe." },
      { it:"l'operazione",     es:"la operación",                 lv:"B1", ex_it:"L'operazione è durata tre ore.",                  ex_es:"La operación duró tres horas." },
      { it:"la guarigione",    es:"la curación / la recuperación",lv:"B1", ex_it:"La guarigione richiederà alcune settimane.",       ex_es:"La recuperación llevará algunas semanas." },
      { it:"la gravidanza",    es:"el embarazo",                  lv:"B1", ex_it:"La gravidanza dura nove mesi.",                   ex_es:"El embarazo dura nueve meses." },
      { it:"il mal di testa",  es:"el dolor de cabeza",           lv:"A2", ex_it:"Ho un terribile mal di testa.",                   ex_es:"Tengo un terrible dolor de cabeza.", col:'["avere mal di testa"]' },
      { it:"la nausea",        es:"las náuseas",                  lv:"A2", ex_it:"Sento nausea dopo aver mangiato.",                ex_es:"Siento náuseas después de comer." },
      { it:"il diabete",       es:"la diabetes",                  lv:"B1", ex_it:"Il diabete richiede attenzione alla dieta.",       ex_es:"La diabetes requiere atención a la dieta." },
      { it:"la ferita",        es:"la herida",                    lv:"A2", ex_it:"La ferita è profonda e sanguina.",                ex_es:"La herida es profunda y sangra." },
      { it:"il cerotto",       es:"la tirita / la curita",        lv:"A2", ex_it:"Metti un cerotto sulla ferita.",                  ex_es:"Pon una tirita en la herida." },
      { it:"il termometro",    es:"el termómetro",                lv:"A2", ex_it:"Ho misurato la febbre con il termometro.",        ex_es:"Medí la fiebre con el termómetro." },
      { it:"il riposo",        es:"el descanso",                  lv:"A2", ex_it:"Il medico mi ha consigliato riposo assoluto.",    ex_es:"El médico me recomendó descanso absoluto." },
      { it:"la fasciatura",    es:"el vendaje / la venda",        lv:"B1", ex_it:"L'infermiere ha fatto una fasciatura al polso.", ex_es:"El enfermero le puso un vendaje en la muñeca." },
      { it:"il colesterolo",   es:"el colesterol",                lv:"B1", ex_it:"Ho il colesterolo alto.",                         ex_es:"Tengo el colesterol alto." },
    ]);

    _topup("Tecnologia e Media", [
      { it:"lo smartphone",         es:"el smartphone / el móvil", lv:"A2", ex_it:"Ho dimenticato lo smartphone a casa.",              ex_es:"Olvidé el móvil en casa." },
      { it:"il computer",           es:"el ordenador",             lv:"A1", ex_it:"Lavoro tutto il giorno al computer.",               ex_es:"Trabajo todo el día en el ordenador." },
      { it:"internet",              es:"internet",                  lv:"A1", ex_it:"Ho bisogno di internet per lavorare.",              ex_es:"Necesito internet para trabajar.", notes:"Spesso senza articolo" },
      { it:"l'applicazione",        es:"la aplicación / la app",   lv:"A2", ex_it:"Scarica l'applicazione sul telefono.",              ex_es:"Descarga la app en el teléfono." },
      { it:"il sito web",           es:"el sitio web",             lv:"A2", ex_it:"Ho cercato sul sito web ufficiale.",                ex_es:"Busqué en el sitio web oficial." },
      { it:"i social media",        es:"las redes sociales",        lv:"A2", ex_it:"Passo troppo tempo sui social media.",              ex_es:"Paso demasiado tiempo en las redes sociales." },
      { it:"la password",           es:"la contraseña",            lv:"A2", ex_it:"Ho dimenticato la password.",                       ex_es:"Olvidé la contraseña." },
      { it:"il messaggio",          es:"el mensaje",               lv:"A1", ex_it:"Ti mando un messaggio stasera.",                    ex_es:"Te mando un mensaje esta noche." },
      { it:"lo schermo",            es:"la pantalla",              lv:"B1", ex_it:"Lo schermo del telefono si è rotto.",               ex_es:"La pantalla del teléfono se rompió." },
      { it:"il caricatore",         es:"el cargador",              lv:"B1", ex_it:"Il telefono è scarico, dov'è il caricatore?",      ex_es:"El móvil está sin batería, ¿dónde está el cargador?" },
      { it:"l'email",               es:"el correo electrónico",    lv:"A2", ex_it:"Ti mando un'email con i dettagli.",                 ex_es:"Te mando un email con los detalles." },
      { it:"la rete wifi",          es:"la red wifi",              lv:"B1", ex_it:"La rete wifi non funziona.",                        ex_es:"La red wifi no funciona." },
      { it:"il tablet",                   es:"la tableta / el tablet",    lv:"A2", ex_it:"Leggo le notizie sul tablet.",                          ex_es:"Leo las noticias en la tableta." },
      { it:"il laptop",                   es:"el portátil",               lv:"A2", ex_it:"Porto il laptop al lavoro.",                            ex_es:"Llevo el portátil al trabajo." },
      { it:"la stampante",                es:"la impresora",              lv:"A2", ex_it:"La stampante non funziona.",                            ex_es:"La impresora no funciona." },
      { it:"la tastiera",                 es:"el teclado",                lv:"A2", ex_it:"Ho versato il caffè sulla tastiera.",                    ex_es:"Derramé el café en el teclado." },
      { it:"il mouse",                    es:"el ratón",                  lv:"A2", ex_it:"Ho bisogno di un mouse wireless.",                      ex_es:"Necesito un ratón inalámbrico." },
      { it:"il microfono",                es:"el micrófono",              lv:"A2", ex_it:"Il microfono non funziona nella videochiamata.",         ex_es:"El micrófono no funciona en la videollamada." },
      { it:"il podcast",                  es:"el podcast",                lv:"B1", ex_it:"Ascolto un podcast di italiano.",                       ex_es:"Escucho un podcast de italiano." },
      { it:"lo streaming",                es:"el streaming",              lv:"B1", ex_it:"Guardo i film in streaming.",                           ex_es:"Veo las películas en streaming." },
      { it:"la notifica",                 es:"la notificación",           lv:"A2", ex_it:"Ho spento le notifiche del telefono.",                  ex_es:"Apagué las notificaciones del teléfono." },
      { it:"il profilo",                  es:"el perfil",                 lv:"A2", ex_it:"Ho aggiornato il mio profilo sui social.",              ex_es:"Actualicé mi perfil en las redes sociales." },
      { it:"il video",                    es:"el vídeo",                  lv:"A2", ex_it:"Ho caricato un video su YouTube.",                      ex_es:"Subí un vídeo a YouTube." },
      { it:"il blog",                     es:"el blog",                   lv:"B1", ex_it:"Scrivo un blog di cucina italiana.",                    ex_es:"Escribo un blog de cocina italiana." },
      { it:"il cloud",                    es:"la nube (informática)",     lv:"B1", ex_it:"Ho salvato i file nel cloud.",                          ex_es:"Guardé los archivos en la nube." },
      { it:"il backup",                   es:"la copia de seguridad",     lv:"B1", ex_it:"Fai sempre il backup dei tuoi dati.",                   ex_es:"Haz siempre una copia de seguridad de tus datos." },
      { it:"il virus informatico",        es:"el virus (informático)",    lv:"B1", ex_it:"Il computer ha preso un virus.",                        ex_es:"El ordenador ha cogido un virus." },
      { it:"la batteria",                 es:"la batería",                lv:"A2", ex_it:"La batteria del telefono è scarica.",                   ex_es:"La batería del teléfono está descargada.", col:'["caricare la batteria","batteria scarica"]' },
      { it:"la telecamera",               es:"la cámara web / la cámara", lv:"B1", ex_it:"La telecamera del laptop è rotta.",                    ex_es:"La cámara del portátil está rota." },
      { it:"l'intelligenza artificiale",  es:"la inteligencia artificial",lv:"B1", ex_it:"L'intelligenza artificiale sta cambiando il mondo.",    ex_es:"La inteligencia artificial está cambiando el mundo." },
    ]);

    _topup("Il Viaggio", [
      { it:"la valigia",        es:"la maleta",            lv:"A2", ex_it:"Ho fatto la valigia stanotte.",                  ex_es:"Hice la maleta anoche." },
      { it:"il passaporto",     es:"el pasaporte",         lv:"A2", ex_it:"Non dimenticare il passaporto.",                ex_es:"No olvides el pasaporte." },
      { it:"l'albergo",         es:"el hotel",             lv:"A2", ex_it:"Abbiamo prenotato un albergo in centro.",       ex_es:"Reservamos un hotel en el centro." },
      { it:"la prenotazione",   es:"la reserva",           lv:"B1", ex_it:"Ho fatto la prenotazione online.",              ex_es:"Hice la reserva por internet." },
      { it:"il volo",           es:"el vuelo",             lv:"A2", ex_it:"Il mio volo è in ritardo.",                    ex_es:"Mi vuelo tiene retraso." },
      { it:"il check-in",       es:"el check-in",          lv:"B1", ex_it:"Devo fare il check-in online.",                ex_es:"Tengo que hacer el check-in online." },
      { it:"la guida turistica",es:"la guía turística",    lv:"A2", ex_it:"Ho comprato una guida turistica di Roma.",     ex_es:"Compré una guía turística de Roma." },
      { it:"il souvenir",       es:"el recuerdo",          lv:"A2", ex_it:"Ho comprato un souvenir per la famiglia.",     ex_es:"Compré un recuerdo para la familia." },
      { it:"il turista",        es:"el/la turista",        lv:"A2", ex_it:"Roma è piena di turisti d'estate.",            ex_es:"Roma está llena de turistas en verano." },
      { it:"la dogana",         es:"la aduana",            lv:"B1", ex_it:"Ho aspettato un'ora in dogana.",               ex_es:"Esperé una hora en la aduana." },
      { it:"l'itinerario",      es:"el itinerario",        lv:"B1", ex_it:"Ho pianificato l'itinerario del viaggio.",     ex_es:"Planifiqué el itinerario del viaje." },
      { it:"lo scalo",          es:"la escala",            lv:"B1", ex_it:"Ho uno scalo di tre ore a Parigi.",            ex_es:"Tengo una escala de tres horas en París." },
      { it:"la cartina",                      es:"el mapa",                    lv:"A2", ex_it:"Ho comprato una cartina della città.",                     ex_es:"Compré un mapa de la ciudad." },
      { it:"il campeggio",                    es:"el camping",                 lv:"A2", ex_it:"D'estate andiamo in campeggio.",                           ex_es:"En verano vamos de camping." },
      { it:"l'escursione",                    es:"la excursión",               lv:"B1", ex_it:"Abbiamo fatto un'escursione in montagna.",                 ex_es:"Hicimos una excursión a la montaña." },
      { it:"il fuso orario",                  es:"la zona horaria",            lv:"B1", ex_it:"C'è un fuso orario di sei ore tra Roma e New York.",       ex_es:"Hay una diferencia horaria de seis horas entre Roma y Nueva York." },
      { it:"il biglietto di andata e ritorno",es:"el billete de ida y vuelta", lv:"B1", ex_it:"Ho comprato un biglietto di andata e ritorno.",            ex_es:"Compré un billete de ida y vuelta." },
      { it:"l'assicurazione di viaggio",      es:"el seguro de viaje",         lv:"B1", ex_it:"Ho fatto un'assicurazione di viaggio.",                    ex_es:"Hice un seguro de viaje." },
      { it:"la meta",                         es:"el destino",                 lv:"B1", ex_it:"La meta del viaggio è Tokyo.",                             ex_es:"El destino del viaje es Tokio." },
      { it:"l'ostello",                       es:"el albergue / el hostel",    lv:"A2", ex_it:"Ho dormito in un ostello della gioventù.",                 ex_es:"Dormí en un albergue juvenil." },
      { it:"il noleggio auto",                es:"el alquiler de coches",      lv:"B1", ex_it:"Ho prenotato un noleggio auto per una settimana.",          ex_es:"Reservé un alquiler de coche por una semana." },
      { it:"la spiaggia",                     es:"la playa",                   lv:"A2", ex_it:"Passiamo le vacanze in spiaggia.",                         ex_es:"Pasamos las vacaciones en la playa." },
      { it:"la montagna",                     es:"la montaña",                 lv:"A2", ex_it:"Andiamo in montagna d'inverno.",                           ex_es:"Vamos a la montaña en invierno." },
      { it:"il mare",                         es:"el mar",                     lv:"A1", ex_it:"Ho voglia di stare al mare.",                              ex_es:"Tengo ganas de estar en el mar.", col:'["andare al mare","stare al mare"]' },
      { it:"il lago",                         es:"el lago",                    lv:"A2", ex_it:"Il lago di Garda è bellissimo.",                           ex_es:"El lago de Garda es precioso." },
      { it:"la cascata",                      es:"la cascada",                 lv:"B1", ex_it:"Le cascate del Niagara sono spettacolari.",                ex_es:"Las cataratas del Niágara son espectaculares." },
      { it:"la frontiera",                    es:"la frontera",                lv:"B1", ex_it:"Abbiamo attraversato la frontiera in macchina.",            ex_es:"Cruzamos la frontera en coche." },
      { it:"la valuta",                       es:"la moneda / la divisa",      lv:"B1", ex_it:"Devo cambiare valuta prima del viaggio.",                  ex_es:"Tengo que cambiar moneda antes del viaje." },
      { it:"il jet lag",                      es:"el jet lag",                 lv:"B1", ex_it:"Ho il jet lag dopo il volo lungo.",                        ex_es:"Tengo jet lag después del vuelo largo." },
      { it:"l'agenzia di viaggi",             es:"la agencia de viajes",       lv:"B1", ex_it:"Ho prenotato il viaggio in un'agenzia di viaggi.",          ex_es:"Reservé el viaje en una agencia de viajes." },
    ]);

    // ── Avverbi (6 categorie) ────────────────────────────────────────────────
    _ensureCat("Avverbi di Modo",        "Avverbi di Modo",                     "🎯", "#0f766e", 24);
    _ensureCat("Avverbi di Tempo",       "Avverbi di Tempo",                    "⏰", "#b45309", 25);
    _ensureCat("Avverbi di Luogo",       "Avverbi di Luogo",                    "📍", "#1d4ed8", 26);
    _ensureCat("Avverbi di Quantità",    "Avverbi di Quantità",                 "📊", "#7c3aed", 27);
    _ensureCat("Avverbi di Valutazione", "Avverbi di Valutazione",              "✅", "#dc2626", 28);
    _ensureCat("Avverbi Interrogativi",  "Avverbi Interrogativi ed Esclamativi","❓", "#0891b2", 29);

    _topup("Avverbi di Modo", [
      { it:"bene",             es:"bien",                              tp:"adverb", lv:"A1", ex_it:"Parla italiano molto bene.",                 ex_es:"Habla italiano muy bien." },
      { it:"male",             es:"mal",                               tp:"adverb", lv:"A1", ex_it:"Ha dormito male stanotte.",                  ex_es:"Durmió mal anoche." },
      { it:"velocemente",      es:"rápidamente",                       tp:"adverb", lv:"A2", ex_it:"Corre velocemente.",                        ex_es:"Corre rápidamente." },
      { it:"lentamente",       es:"lentamente / despacio",             tp:"adverb", lv:"A2", ex_it:"Parla lentamente, per favore.",              ex_es:"Habla despacio, por favor." },
      { it:"facilmente",       es:"fácilmente",                        tp:"adverb", lv:"B1", ex_it:"Si stanca facilmente.",                     ex_es:"Se cansa fácilmente." },
      { it:"difficilmente",    es:"difícilmente",                      tp:"adverb", lv:"B1", ex_it:"Difficilmente cambierà idea.",              ex_es:"Difícilmente cambiará de opinión." },
      { it:"gentilmente",      es:"amablemente",                       tp:"adverb", lv:"A2", ex_it:"Mi ha risposto gentilmente.",               ex_es:"Me respondió amablemente." },
      { it:"volentieri",       es:"con gusto / de buena gana",         tp:"adverb", lv:"A2", ex_it:"Vengo volentieri alla festa.",              ex_es:"Voy a la fiesta con mucho gusto." },
      { it:"purtroppo",        es:"desgraciadamente / por desgracia",  tp:"adverb", lv:"A2", ex_it:"Purtroppo non posso venire.",               ex_es:"Desgraciadamente no puedo ir." },
      { it:"fortunatamente",   es:"afortunadamente",                   tp:"adverb", lv:"B1", ex_it:"Fortunatamente non è successo niente.",     ex_es:"Afortunadamente no pasó nada." },
      { it:"apposta",          es:"a propósito / adrede",              tp:"adverb", lv:"B1", ex_it:"L'ha fatto apposta per farmi arrabbiare.",  ex_es:"Lo hizo adrede para hacerme enojar." },
      { it:"piano",            es:"despacio / suavemente",             tp:"adverb", lv:"A1", ex_it:"Parla piano, il bambino dorme.",            ex_es:"Habla despacio, el niño duerme." },
      { it:"forte",            es:"fuerte / en voz alta",              tp:"adverb", lv:"A1", ex_it:"Non urlare così forte!",                    ex_es:"¡No grites tan fuerte!" },
      { it:"insieme",          es:"juntos",                            tp:"adverb", lv:"A1", ex_it:"Andiamo insieme al cinema.",               ex_es:"Vamos juntos al cine." },
      { it:"così",             es:"así / de esta manera",              tp:"adverb", lv:"A1", ex_it:"Perché mi guardi così?",                   ex_es:"¿Por qué me miras así?" },
      { it:"altrimenti",       es:"de lo contrario / si no",           tp:"adverb", lv:"B1", ex_it:"Studia di più, altrimenti non passi l'esame.", ex_es:"Estudia más, de lo contrario no aprobarás el examen." },
      { it:"soprattutto",      es:"sobre todo / especialmente",        tp:"adverb", lv:"B1", ex_it:"Mi piace l'Italia, soprattutto la cucina.", ex_es:"Me gusta Italia, sobre todo la cocina." },
      { it:"comunque",         es:"de todas formas / de todos modos",  tp:"adverb", lv:"B1", ex_it:"Comunque vada, sarò con te.",              ex_es:"De todas formas, estaré contigo." },
      { it:"perfino",          es:"incluso / hasta",                   tp:"adverb", lv:"B2", ex_it:"Perfino lui ha ammesso di sbagliare.",     ex_es:"Incluso él admitió haberse equivocado." },
      { it:"esattamente",      es:"exactamente",                       tp:"adverb", lv:"A2", ex_it:"Hai detto esattamente quello che pensavo.", ex_es:"Dijiste exactamente lo que pensaba." },
      { it:"principalmente",   es:"principalmente",                    tp:"adverb", lv:"B1", ex_it:"Lavoro principalmente da casa.",           ex_es:"Trabajo principalmente desde casa." },
      { it:"malvolentieri",    es:"de mala gana",                      tp:"adverb", lv:"B2", ex_it:"Ha accettato malvolentieri la proposta.",  ex_es:"Aceptó la propuesta de mala gana." },
      { it:"improvvisamente",  es:"de repente / de pronto",            tp:"adverb", lv:"B1", ex_it:"Improvvisamente ha smesso di piovere.",    ex_es:"De repente dejó de llover." },
      { it:"precisamente",     es:"precisamente",                      tp:"adverb", lv:"B2", ex_it:"Non è precisamente quello che intendevo.", ex_es:"No es precisamente lo que quería decir." },
      { it:"sinceramente",     es:"sinceramente",                      tp:"adverb", lv:"B1", ex_it:"Sinceramente non so cosa fare.",           ex_es:"Sinceramente no sé qué hacer." },
    ]);

    _topup("Avverbi di Tempo", [
      { it:"adesso",           es:"ahora",                             tp:"adverb", lv:"A1", ex_it:"Adesso non posso, sono impegnato.",        ex_es:"Ahora no puedo, estoy ocupado." },
      { it:"ancora",           es:"todavía / aún",                     tp:"adverb", lv:"A1", ex_it:"Sei ancora qui? Pensavo fossi uscito.",    ex_es:"¿Todavía estás aquí? Pensaba que habías salido." },
      { it:"mai",              es:"nunca / jamás",                      tp:"adverb", lv:"A1", ex_it:"Non ho mai mangiato sushi.",              ex_es:"Nunca he comido sushi." },
      { it:"sempre",           es:"siempre",                           tp:"adverb", lv:"A1", ex_it:"È sempre in ritardo.",                    ex_es:"Siempre llega tarde." },
      { it:"spesso",           es:"a menudo / con frecuencia",         tp:"adverb", lv:"A1", ex_it:"Vai spesso al cinema?",                   ex_es:"¿Vas al cine a menudo?" },
      { it:"raramente",        es:"raramente / pocas veces",           tp:"adverb", lv:"B1", ex_it:"Raramente bevo caffè di sera.",           ex_es:"Raramente bebo café por la noche." },
      { it:"già",              es:"ya",                                 tp:"adverb", lv:"A1", ex_it:"Hai già fatto colazione?",                ex_es:"¿Ya has desayunado?" },
      { it:"subito",           es:"enseguida / inmediatamente",        tp:"adverb", lv:"A1", ex_it:"Vieni qui subito!",                       ex_es:"¡Ven aquí enseguida!" },
      { it:"presto",           es:"pronto / temprano",                 tp:"adverb", lv:"A1", ex_it:"Alzati presto domani mattina.",           ex_es:"Levántate temprano mañana por la mañana." },
      { it:"tardi",            es:"tarde",                             tp:"adverb", lv:"A1", ex_it:"È tornato a casa molto tardi.",           ex_es:"Volvió a casa muy tarde." },
      { it:"prima",            es:"antes / primero",                   tp:"adverb", lv:"A1", ex_it:"Prima mangia, poi parla.",                ex_es:"Primero come, luego habla." },
      { it:"dopo",             es:"después / luego",                   tp:"adverb", lv:"A1", ex_it:"Ci vediamo dopo.",                       ex_es:"Nos vemos después." },
      { it:"poi",              es:"luego / después / y entonces",      tp:"adverb", lv:"A1", ex_it:"Prima lavoro, poi mi riposo.",            ex_es:"Primero trabajo, luego descanso." },
      { it:"ieri",             es:"ayer",                              tp:"adverb", lv:"A1", ex_it:"Ieri ho visto un bel film.",              ex_es:"Ayer vi una buena película." },
      { it:"oggi",             es:"hoy",                               tp:"adverb", lv:"A1", ex_it:"Oggi è il tuo compleanno!",              ex_es:"¡Hoy es tu cumpleaños!" },
      { it:"domani",           es:"mañana",                            tp:"adverb", lv:"A1", ex_it:"A domani!",                              ex_es:"¡Hasta mañana!" },
      { it:"recentemente",     es:"recientemente",                     tp:"adverb", lv:"B1", ex_it:"L'ha detto recentemente in un'intervista.", ex_es:"Lo dijo recientemente en una entrevista." },
      { it:"finalmente",       es:"finalmente / por fin",              tp:"adverb", lv:"A2", ex_it:"Finalmente sei arrivato!",               ex_es:"¡Por fin has llegado!" },
      { it:"intanto",          es:"mientras tanto / entretanto",       tp:"adverb", lv:"B1", ex_it:"Intanto aspettami qui.",                 ex_es:"Mientras tanto espérame aquí." },
      { it:"ormai",            es:"ya / a estas alturas",              tp:"adverb", lv:"B1", ex_it:"Ormai è troppo tardi per cambiare idea.", ex_es:"A estas alturas es demasiado tarde para cambiar de opinión." },
      { it:"a volte",          es:"a veces",                           tp:"adverb", lv:"A2", ex_it:"A volte mi dimentico le chiavi.",        ex_es:"A veces me olvido las llaves." },
      { it:"di tanto in tanto", es:"de vez en cuando",                 tp:"adverb", lv:"B1", ex_it:"Di tanto in tanto vado a trovare i nonni.", ex_es:"De vez en cuando voy a visitar a los abuelos." },
      { it:"prossimamente",    es:"próximamente / en breve",           tp:"adverb", lv:"B1", ex_it:"Il film uscirà prossimamente.",          ex_es:"La película saldrá próximamente." },
      { it:"tuttora",          es:"todavía / hasta ahora",             tp:"adverb", lv:"B2", ex_it:"È tuttora irrisolto il problema.",       ex_es:"El problema todavía no está resuelto." },
      { it:"nel frattempo",    es:"mientras tanto",                    tp:"adverb", lv:"B1", ex_it:"Nel frattempo, leggiti questo articolo.", ex_es:"Mientras tanto, lee este artículo." },
    ]);

    _topup("Avverbi di Luogo", [
      { it:"qui",              es:"aquí",                              tp:"adverb", lv:"A1", ex_it:"Siediti qui accanto a me.",              ex_es:"Siéntate aquí a mi lado." },
      { it:"lì",               es:"allí",                              tp:"adverb", lv:"A1", ex_it:"Il libro è lì sul tavolo.",              ex_es:"El libro está allí sobre la mesa." },
      { it:"là",               es:"allá (más lejos)",                  tp:"adverb", lv:"A1", ex_it:"Vai là e aspettami.",                    ex_es:"Ve allá y espérame." },
      { it:"su",               es:"arriba / encima",                   tp:"adverb", lv:"A1", ex_it:"Vieni su, siamo al terzo piano.",        ex_es:"Sube, estamos en el tercer piso." },
      { it:"giù",              es:"abajo",                             tp:"adverb", lv:"A1", ex_it:"Scendi giù, è pronta la cena.",         ex_es:"Baja, la cena está lista." },
      { it:"davanti",          es:"delante / enfrente",                tp:"adverb", lv:"A1", ex_it:"Siediti davanti, hai più spazio.",      ex_es:"Siéntate delante, tienes más espacio." },
      { it:"dietro",           es:"detrás / atrás",                    tp:"adverb", lv:"A1", ex_it:"C'è qualcuno dietro di te.",            ex_es:"Hay alguien detrás de ti." },
      { it:"sopra",            es:"encima / arriba",                   tp:"adverb", lv:"A1", ex_it:"Il gatto è sopra il divano.",           ex_es:"El gato está encima del sofá." },
      { it:"sotto",            es:"debajo / abajo",                    tp:"adverb", lv:"A1", ex_it:"Il cane si è nascosto sotto il letto.", ex_es:"El perro se escondió debajo de la cama." },
      { it:"dentro",           es:"dentro / adentro",                  tp:"adverb", lv:"A1", ex_it:"Rimani dentro, fa freddo.",             ex_es:"Quédate dentro, hace frío." },
      { it:"fuori",            es:"fuera / afuera",                    tp:"adverb", lv:"A1", ex_it:"I bambini giocano fuori.",              ex_es:"Los niños juegan afuera." },
      { it:"vicino",           es:"cerca",                             tp:"adverb", lv:"A1", ex_it:"La fermata è molto vicino.",            ex_es:"La parada está muy cerca." },
      { it:"lontano",          es:"lejos",                             tp:"adverb", lv:"A1", ex_it:"Abita lontano dal centro.",             ex_es:"Vive lejos del centro." },
      { it:"dappertutto",      es:"por todas partes / en todos lados", tp:"adverb", lv:"B1", ex_it:"Ho cercato dappertutto le chiavi.",    ex_es:"Busqué las llaves por todas partes." },
      { it:"altrove",          es:"en otro lugar / en otra parte",     tp:"adverb", lv:"B2", ex_it:"Se non ti piace, puoi andare altrove.", ex_es:"Si no te gusta, puedes ir a otro lugar." },
      { it:"intorno",          es:"alrededor",                         tp:"adverb", lv:"B1", ex_it:"Guardatevi intorno, siamo circondati.", ex_es:"Mirad alrededor, estamos rodeados." },
      { it:"laggiù",           es:"allá abajo / allá en el fondo",     tp:"adverb", lv:"B1", ex_it:"Vedi quell'isola laggiù?",             ex_es:"¿Ves aquella isla allá en el fondo?" },
      { it:"lassù",            es:"allá arriba",                       tp:"adverb", lv:"B1", ex_it:"Lassù in montagna fa molto freddo.",   ex_es:"Allá arriba en la montaña hace mucho frío." },
      { it:"ovunque",          es:"en cualquier lugar / dondequiera",  tp:"adverb", lv:"B1", ex_it:"Lo cerco ovunque e non lo trovo.",     ex_es:"Lo busco en todas partes y no lo encuentro." },
      { it:"in fondo",         es:"al fondo / en el fondo",            tp:"adverb", lv:"B1", ex_it:"In fondo al corridoio c'è il bagno.",  ex_es:"Al fondo del pasillo está el baño." },
    ]);

    _topup("Avverbi di Quantità", [
      { it:"molto",            es:"mucho / muy",                       tp:"adverb", lv:"A1", ex_it:"Ho mangiato molto stasera.",             ex_es:"He comido mucho esta noche." },
      { it:"poco",             es:"poco / un poco",                    tp:"adverb", lv:"A1", ex_it:"Mangia poco, è sempre a dieta.",        ex_es:"Come poco, siempre está a dieta." },
      { it:"tanto",            es:"tanto / mucho",                     tp:"adverb", lv:"A1", ex_it:"Ti voglio tanto bene.",                  ex_es:"Te quiero tanto." },
      { it:"troppo",           es:"demasiado",                         tp:"adverb", lv:"A1", ex_it:"Hai bevuto troppo stanotte.",            ex_es:"Has bebido demasiado esta noche." },
      { it:"abbastanza",       es:"bastante / suficiente",             tp:"adverb", lv:"A2", ex_it:"Hai dormito abbastanza?",               ex_es:"¿Has dormido suficiente?" },
      { it:"quasi",            es:"casi",                              tp:"adverb", lv:"A2", ex_it:"Ho quasi finito.",                      ex_es:"Casi he terminado." },
      { it:"appena",           es:"apenas / a duras penas",            tp:"adverb", lv:"B1", ex_it:"L'ho appena sentito da lontano.",       ex_es:"Apenas lo oí desde lejos." },
      { it:"più",              es:"más",                               tp:"adverb", lv:"A1", ex_it:"Voglio più tempo per pensare.",         ex_es:"Quiero más tiempo para pensar." },
      { it:"meno",             es:"menos",                             tp:"adverb", lv:"A1", ex_it:"Lavora meno degli altri.",              ex_es:"Trabaja menos que los demás." },
      { it:"parecchio",        es:"bastante / mucho",                  tp:"adverb", lv:"B1", ex_it:"Ha piovuto parecchio ieri.",            ex_es:"Llovió bastante ayer." },
      { it:"assai",            es:"mucho / bastante (letterario)",     tp:"adverb", lv:"B2", ex_it:"Era assai difficile da comprendere.",   ex_es:"Era bastante difícil de comprender." },
      { it:"piuttosto",        es:"bastante / más bien",               tp:"adverb", lv:"B1", ex_it:"È piuttosto stanco dopo la gara.",     ex_es:"Está bastante cansado después de la carrera." },
      { it:"circa",            es:"aproximadamente / alrededor de",    tp:"adverb", lv:"A2", ex_it:"Ci vorranno circa due ore.",            ex_es:"Harán falta aproximadamente dos horas." },
      { it:"per lo più",       es:"en su mayor parte / principalmente", tp:"adverb", lv:"B2", ex_it:"Per lo più la gente è buona.",        ex_es:"En su mayor parte la gente es buena." },
      { it:"affatto",          es:"en absoluto / para nada",           tp:"adverb", lv:"B2", ex_it:"Non mi dispiace affatto.",             ex_es:"No me molesta en absoluto." },
      { it:"altrettanto",      es:"igualmente / lo mismo",             tp:"adverb", lv:"B2", ex_it:"Grazie! — Altrettanto!",               ex_es:"¡Gracias! — ¡Igualmente!" },
      { it:"almeno",           es:"al menos / por lo menos",           tp:"adverb", lv:"A2", ex_it:"Almeno chiamami se arrivi tardi.",     ex_es:"Al menos llámame si llegas tarde." },
      { it:"alquanto",         es:"bastante / algo (formal)",          tp:"adverb", lv:"C1", ex_it:"La situazione è alquanto preoccupante.", ex_es:"La situación es bastante preocupante." },
      { it:"niente",           es:"nada",                              tp:"adverb", lv:"A1", ex_it:"Non capisce niente.",                  ex_es:"No entiende nada." },
      { it:"davvero",          es:"de verdad / realmente",             tp:"adverb", lv:"A2", ex_it:"Sei davvero sicuro di questo?",        ex_es:"¿Estás de verdad seguro de esto?" },
    ]);

    _topup("Avverbi di Valutazione", [
      { it:"sì",               es:"sí",                                tp:"adverb", lv:"A1", ex_it:"Sì, certo, vieni pure.",               ex_es:"Sí, claro, pasa." },
      { it:"certo",            es:"claro / por supuesto",              tp:"adverb", lv:"A1", ex_it:"Certo che lo so!",                     ex_es:"¡Claro que lo sé!" },
      { it:"certamente",       es:"ciertamente / por supuesto",        tp:"adverb", lv:"B1", ex_it:"Certamente, sarò lì alle otto.",       ex_es:"Por supuesto, estaré allí a las ocho." },
      { it:"sicuramente",      es:"seguramente / sin duda",            tp:"adverb", lv:"A2", ex_it:"Sicuramente ha già sentito la notizia.", ex_es:"Seguramente ya ha oído la noticia." },
      { it:"ovviamente",       es:"obviamente",                        tp:"adverb", lv:"A2", ex_it:"Ovviamente non sono d'accordo.",       ex_es:"Obviamente no estoy de acuerdo." },
      { it:"naturalmente",     es:"naturalmente / claro",              tp:"adverb", lv:"A2", ex_it:"Naturalmente puoi venire alla festa.", ex_es:"Naturalmente puedes venir a la fiesta." },
      { it:"esatto",           es:"exacto / correcto",                 tp:"adverb", lv:"A2", ex_it:"Esatto, hai capito bene.",             ex_es:"Exacto, lo has entendido bien." },
      { it:"assolutamente",    es:"absolutamente",                     tp:"adverb", lv:"B1", ex_it:"Assolutamente sì, è una buona idea.", ex_es:"Absolutamente sí, es una buena idea." },
      { it:"appunto",          es:"exactamente / precisamente",        tp:"adverb", lv:"B1", ex_it:"Appunto! Questo è il problema.",      ex_es:"¡Exactamente! Ese es el problema." },
      { it:"no",               es:"no",                                tp:"adverb", lv:"A1", ex_it:"No, grazie, non ne ho bisogno.",      ex_es:"No, gracias, no lo necesito." },
      { it:"non",              es:"no (partícula negativa)",            tp:"adverb", lv:"A1", ex_it:"Non ho capito niente.",               ex_es:"No he entendido nada." },
      { it:"nemmeno",          es:"ni siquiera / tampoco",             tp:"adverb", lv:"B1", ex_it:"Non mi ha nemmeno salutato.",         ex_es:"Ni siquiera me saludó." },
      { it:"mica",             es:"para nada / en absoluto (coloquial)", tp:"adverb", lv:"B2", ex_it:"Non è mica stupido, eh!",          ex_es:"¡Para nada es tonto, eh!" },
      { it:"forse",            es:"quizás / tal vez",                  tp:"adverb", lv:"A2", ex_it:"Forse domani pioverà.",              ex_es:"Quizás mañana lloverá." },
      { it:"probabilmente",    es:"probablemente",                     tp:"adverb", lv:"B1", ex_it:"Probabilmente arriverà in ritardo.", ex_es:"Probablemente llegará tarde." },
      { it:"possibilmente",    es:"posiblemente / si es posible",      tp:"adverb", lv:"B2", ex_it:"Rispondimi possibilmente entro oggi.", ex_es:"Respóndeme posiblemente antes de hoy." },
      { it:"eventualmente",    es:"en su caso / llegado el momento",   tp:"adverb", lv:"B2", ex_it:"Eventualmente potremmo rimandare.",  ex_es:"En su caso podríamos aplazarlo.", notes:"FALSO AMICO: 'eventualmente' ≠ 'eventually' (inglese). Significa 'llegado el caso', NON 'alla fine'." },
      { it:"magari",           es:"ojalá / quizás / si acaso",         tp:"adverb", lv:"B1", ex_it:"Magari potessi venire con te!",      ex_es:"¡Ojalá pudiera ir contigo!", notes:"'Magari' esprime desiderio (ojalá) o possibilità incerta (quizás). Al congiuntivo per il desiderio." },
    ]);

    _topup("Avverbi Interrogativi", [
      { it:"come",             es:"cómo",                              tp:"adverb", lv:"A1", ex_it:"Come stai?",                          ex_es:"¿Cómo estás?" },
      { it:"dove",             es:"dónde",                             tp:"adverb", lv:"A1", ex_it:"Dove sei stato?",                     ex_es:"¿Dónde has estado?" },
      { it:"quando",           es:"cuándo",                            tp:"adverb", lv:"A1", ex_it:"Quando arrivi?",                      ex_es:"¿Cuándo llegas?" },
      { it:"quanto",           es:"cuánto",                            tp:"adverb", lv:"A1", ex_it:"Quanto costa questo?",                ex_es:"¿Cuánto cuesta esto?" },
      { it:"perché",           es:"por qué / porque",                  tp:"adverb", lv:"A1", ex_it:"Perché sei arrivato tardi?",          ex_es:"¿Por qué has llegado tarde?", notes:"'Perché' serve sia per la domanda (por qué) che per la risposta (porque). Diversamente dallo spagnolo." },
      { it:"come mai",         es:"¿cómo es que? / ¿por qué es que?", tp:"adverb", lv:"B1", ex_it:"Come mai non sei venuto ieri?",       ex_es:"¿Cómo es que no viniste ayer?" },
      { it:"da dove",          es:"de dónde",                          tp:"adverb", lv:"A2", ex_it:"Da dove vieni?",                     ex_es:"¿De dónde vienes?" },
      { it:"fino a quando",    es:"hasta cuándo",                      tp:"adverb", lv:"B1", ex_it:"Fino a quando resterai qui?",        ex_es:"¿Hasta cuándo te quedarás aquí?" },
      { it:"da quando",        es:"desde cuándo",                      tp:"adverb", lv:"B1", ex_it:"Da quando hai questo dolore?",       ex_es:"¿Desde cuándo tienes este dolor?" },
      { it:"quanto tempo",     es:"cuánto tiempo",                     tp:"adverb", lv:"A2", ex_it:"Quanto tempo ci vuole?",             ex_es:"¿Cuánto tiempo se necesita?" },
      { it:"ecco",             es:"aquí está / mira / ya está",        tp:"adverb", lv:"A1", ex_it:"Ecco la soluzione!",                 ex_es:"¡Aquí está la solución!" },
      { it:"per quanto",       es:"por cuánto (tiempo) / aunque",      tp:"adverb", lv:"B2", ex_it:"Per quanto tempo rimarrai via?",    ex_es:"¿Por cuánto tiempo te quedarás fuera?" },
    ]);
  }

  // ── Correzioni di dati (idempotenti) — audit 2026-08-27 ──────────────────
  {
    const upd = (sql, ...p) => db.prepare(sql).run(...p);
    const syncFC = (vid) => {
      const v = db.prepare('SELECT italian, spanish FROM vocabulary_items WHERE id=?').get(vid);
      if (!v) return;
      db.prepare('UPDATE flashcards SET front=?,back=? WHERE vocabulary_id=? AND (front!=? OR back!=?)').run(v.italian, v.spanish, vid, v.italian, v.spanish);
    };

    // P0: flashcard desyncs
    [144, 153, 346, 390, 402].forEach(syncFC);

    // P0: il fischio (2851) — articolo italiano nel campo spagnolo
    upd("UPDATE vocabulary_items SET spanish=?,updated_at=unixepoch() WHERE id=2851 AND spanish=?",
      'el silbido / el pitido', 'il silbato / el pitido');

    // P0: possibilmente (3209) — falso amico con "posiblemente"
    upd("UPDATE vocabulary_items SET spanish=?,example_es=?,updated_at=unixepoch() WHERE id=3209 AND spanish=?",
      'si es posible / a ser posible', 'Si es posible, respóndeme hoy.', 'posiblemente / si es posible');

    // P0: appena (3180) — esempio temporale con traduzione quantitativa
    upd("UPDATE vocabulary_items SET spanish=?,example_it=?,example_es=?,notes=?,updated_at=unixepoch() WHERE id=3180 AND example_it=?",
      'apenas / casi no', 'Si sentiva appena da lontano.', 'Apenas se oía desde lejos.',
      "Senso quantitativo: appena = apenas/casi no. Senso temporale (Avverbi di Tempo): «L'ho appena sentito» = Acabo de oírlo.",
      "L'ho appena sentito da lontano.");

    // P0: per quanto (3223) — mescola uso interrogativo e concessivo
    upd("UPDATE vocabulary_items SET spanish=?,notes=?,updated_at=unixepoch() WHERE id=3223 AND spanish=?",
      '¿por cuánto tiempo? / aunque + congiuntivo',
      'Due usi distinti: (1) interrogativo: «Per quanto tempo rimarrai?» = ¿Por cuánto tiempo te quedarás?; (2) concessivo + congiuntivo: «Per quanto studi, non riesce» = Aunque estudie, no lo consigue.',
      'por cuánto (tiempo) / aunque');

    // P1
    upd("UPDATE vocabulary_items SET example_es=?,updated_at=unixepoch() WHERE id=22 AND example_es=?",
      'Mañana salgo para Francia.', 'Parto hacia Francia mañana.');
    upd("UPDATE vocabulary_items SET example_it=?,updated_at=unixepoch() WHERE id=128 AND example_it=?",
      'Tieni a mente questa regola.', 'Tieni in mente questa regola.');
    upd("UPDATE vocabulary_items SET spanish=?,updated_at=unixepoch() WHERE id=147 AND spanish=?",
      'caliente / calor', 'caliente (NO el caldo)');
    upd("UPDATE vocabulary_items SET false_friend_note=NULL,updated_at=unixepoch() WHERE id=148 AND false_friend_note IS NOT NULL");
    upd("UPDATE vocabulary_items SET false_friend_note=?,updated_at=unixepoch() WHERE id=152",
      '«Pretendere» (it.) = exigir/reclamar/esperar. «Pretender» (es.) = intentar/aspirar (NON fingir). «Fingir» = «fingere».');
    upd("UPDATE vocabulary_items SET false_friend_note=?,updated_at=unixepoch() WHERE id=154",
      '«La firma» (it.) = la firma/rúbrica. En español «firma» también puede significar empresa/razón social; el contraste no es absoluto.');
    upd("UPDATE vocabulary_items SET false_friend_note=NULL,updated_at=unixepoch() WHERE id=156 AND false_friend_note IS NOT NULL");
    upd("UPDATE vocabulary_items SET false_friend_note=?,updated_at=unixepoch() WHERE id=157",
      '«Il pavimento» (it.) = el suelo / el piso / el pavimento según el contexto. La RAE define «pavimento» como suelo artificial; no hay falso amigo absoluto.');
    upd("UPDATE vocabulary_items SET italian=?,article=?,gender=?,plural=?,updated_at=unixepoch() WHERE id=168 AND italian=?",
      "l'entusiasmo", "l'", 'm', 'gli entusiasmi', 'entusiasmo');
    syncFC(168);
    upd("UPDATE vocabulary_items SET example_es=?,updated_at=unixepoch() WHERE id=209 AND example_es=?",
      'Estos zapatos me hacen daño.', 'Estos zapatos me duelen.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=261 AND example_it=?",
      'Ho visitato gli Uffizi.', 'Visité la Galería de los Uffizi.', 'Ho visitato il museo degli Uffizi.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=277 AND example_it=?",
      'Tifo per la Roma.', 'Soy hincha de la Roma.', 'Tifo per la squadra di Roma.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=281 AND example_it=?",
      'Ogni mattina faccio una corsa di cinque chilometri.', 'Cada mañana corro cinco kilómetros.', 'Faccio la corsa ogni mattina.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=357 AND example_it=?",
      'Nelle grandi città il traffico è intenso.', 'En las grandes ciudades el tráfico es intenso.', 'In vacanza viaggio spesso.');
    upd("UPDATE vocabulary_items SET example_it=?,updated_at=unixepoch() WHERE id=376 AND example_it=?",
      'È andato a sbattere contro il muro.', 'È caduto contro il muro.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=416 AND example_it=?",
      'Accetto a condizione di poter scegliere.', 'Acepto con la condición de poder elegir.', 'Ti aiuto a condizione di ricevere il tuo aiuto.');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2491 AND notes LIKE ?",
      'PP: raggiunto. «Raggiungere un obiettivo» = alcanzar una meta. «Raggiungere qualcuno» = alcanzar/juntarse con alguien en el lugar donde ya está; no equivale en general a «reunirse».',
      '%reunirse con alguien%');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2505 AND notes LIKE ?",
      'PP: scoperto. «Scoprire che» = descubrir/darse cuenta de que. «Scoprirsi» = destaparse o quedar al descubierto (no equivale en general a «darse cuenta de»). «Ho scoperto che…» = He descubierto que…',
      '%darse cuenta de / descubrirse%');
    upd("UPDATE vocabulary_items SET italian=?,updated_at=unixepoch() WHERE id=2512 AND italian=?",
      'insistere (a/su/per)', 'insistere (su/per)');
    syncFC(2512);
    upd("UPDATE vocabulary_items SET example_es=?,updated_at=unixepoch() WHERE id=2526 AND example_es=?",
      'No podía contener la risa.', 'No podía contenerme la risa.');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2700 AND notes LIKE ?",
      '«Delusione» = decepción. «La delusión» (es., poco usual) = ilusión sin base real; NON significa «delirio» = «il delirio» en italiano.',
      '%delirio%');
    upd("UPDATE vocabulary_items SET spanish=?,notes=?,updated_at=unixepoch() WHERE id=2704 AND spanish=?",
      'la alfombra / el tapete (varía según región)',
      '«Tappeto» = alfombra. «El tapete» puede significar mantelito en España, pero en México y otras variedades designa también una alfombra pequeña.',
      'la alfombra (≠ el tapete = mantelito)');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2709 AND notes LIKE ?",
      '«Il tasto» = la tecla/el botón. FALSO AMICO: «el tacto» (es.) = «il tatto» (it.). «El gusto» (es.) = «il gusto» (it.). Il vero falso amico è tasto/tacto, non tasto/gusto.',
      '%gusto%');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=2727 AND example_it=?",
      'Ha accettato la situazione con rassegnazione.', 'Aceptó la situación con resignación.', 'Si è arresa alla rassegnazione.');
    upd("UPDATE vocabulary_items SET example_it=?,updated_at=unixepoch() WHERE id=2745 AND example_it=?",
      'Ho molti libri nella libreria.', 'Ho molti libri sulla libreria.');
    upd("UPDATE vocabulary_items SET spanish=?,updated_at=unixepoch() WHERE id=2777 AND spanish=?",
      'la vía (férrea) / el andén (contextual)', 'el andén / la vía');
    upd("UPDATE vocabulary_items SET example_es=?,updated_at=unixepoch() WHERE id=2848 AND example_es=?",
      'Los videojuegos me relajan.', 'Los videojuegos me hacen relajar.');
    upd("UPDATE vocabulary_items SET spanish=?,example_it=?,example_es=?,updated_at=unixepoch() WHERE id=2886 AND example_it=?",
      'la cámara de vídeo / la cámara de seguridad',
      'La telecamera di sicurezza ha registrato tutto.',
      'La cámara de seguridad lo ha grabado todo.',
      'La telecamera del laptop è rotta.');
    upd("UPDATE vocabulary_items SET example_it=?,updated_at=unixepoch() WHERE id=3122 AND example_it=?",
      'Perfino lui ha ammesso di aver sbagliato.', 'Perfino lui ha ammesso di sbagliare.');
    upd("UPDATE vocabulary_items SET example_it=?,updated_at=unixepoch() WHERE id=3149 AND example_it=?",
      'A volte dimentico le chiavi.', 'A volte mi dimentico le chiavi.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=3165 AND example_it=?",
      'Abito molto vicino.', 'Vivo muy cerca.', 'La fermata è molto vicino.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=3189 AND example_it=?",
      'Buon fine settimana! — Altrettanto!', '¡Buen fin de semana! — ¡Igualmente!', 'Grazie! — Altrettanto!');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=3222",
      'Particella presentativa, non avverbio interrogativo. «Ecco il treno!» = ¡Aquí está el tren! Serve anche per sottolineare: «Ecco perché!» = ¡Por eso! Forme tipiche: eccomi, eccolo, eccoci.');

    // P2
    upd("UPDATE vocabulary_items SET notes=TRIM(REPLACE(REPLACE(notes,'Come «tenere». ',''),'Come tenere. ','')),updated_at=unixepoch() WHERE id=2515 AND notes LIKE ?",
      '%tenere%');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2647 AND notes=?",
      'Nazionalità: olandese — in Olanda/nei Paesi Bassi. Nota: «Olanda» si riferisce tecnicamente solo ad alcune province; il nome ufficiale è «i Paesi Bassi». Entrambe le forme sono accettate nel parlato.',
      'nazionalità: olandese — in Olanda');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=2698 AND notes LIKE ?",
      '«Argomento» = tema/asunto/argomento. FALSO AMICO PARZIALE: español «argumento» también puede significar razonamiento y tema; el contraste solo vale en contextos narrativos (trama).',
      '%trama%');
    upd("UPDATE vocabulary_items SET spanish=?,updated_at=unixepoch() WHERE id=2891 AND spanish=?",
      'el huso horario / la zona horaria', 'la zona horaria');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=2896 AND example_it=?",
      "Ho prenotato un'auto a noleggio per una settimana.",
      'Reservé un coche de alquiler por una semana.',
      'Ho prenotato un noleggio auto per una settimana.');
    upd("UPDATE vocabulary_items SET example_it=?,example_es=?,updated_at=unixepoch() WHERE id=3158 AND example_it=?",
      'Vai giù, la cena è pronta.', 'Ve abajo, la cena está lista.', 'Scendi giù, è pronta la cena.');
    upd("UPDATE vocabulary_items SET notes=?,updated_at=unixepoch() WHERE id=3210 AND notes LIKE ?",
      'FALSO AMICO (italiano–spagnolo): italiano «eventualmente» = si necesario / llegado el caso; español «eventualmente» = de manera casual o accidental. Non usare per tradurre «eventually» inglese (= «alla fine / prima o poi»).',
      '%eventually%');
  }
}

module.exports = { createSchema };
