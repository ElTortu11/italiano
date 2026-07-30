require('dotenv').config();
const db = require('./db');

// Idempotent — safe to run multiple times
db.prepare(`INSERT OR IGNORE INTO vocabulary_categories(name,name_it,icon,color,sort_order) VALUES(?,?,?,?,?)`)
  .run('Preposizioni', 'Preposizioni', '📍', '#b45309', 22);

const catId = db.prepare(`SELECT id FROM vocabulary_categories WHERE name='Preposizioni'`).get()?.id;
if (!catId) { console.error('Category not found'); process.exit(1); }

const insertWord = db.prepare(`
  INSERT OR IGNORE INTO vocabulary_items(italian,spanish,category_id,word_type,gender,article,plural,example_it,example_es,cefr_level,notes,false_friend_note,collocations)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const preps = [
  // ── Preposizioni semplici ──────────────────────────────────────────────────
  { it:'di', es:'de / del',             lv:'A1', ex_it:'Sono di Madrid.',                   ex_es:'Soy de Madrid.',                      notes:'Provenienza, possesso, argomento' },
  { it:'a',  es:'a / en',               lv:'A1', ex_it:'Vado a Roma.',                       ex_es:'Voy a Roma.',                         notes:'Luogo, moto a luogo, ora' },
  { it:'da', es:'de / desde / por',     lv:'A1', ex_it:'Vengo da Parigi.',                   ex_es:'Vengo de París.',                     notes:'Provenienza, causa, durata, agente' },
  { it:'in', es:'en',                   lv:'A1', ex_it:'Vivo in Italia.',                    ex_es:'Vivo en Italia.',                     notes:'Luogo, mezzo di trasporto, mese/stagione' },
  { it:'con', es:'con',                 lv:'A1', ex_it:'Vengo con te.',                      ex_es:'Vengo contigo.',                      notes:'Compagnia, mezzo, modo' },
  { it:'su', es:'en / sobre',           lv:'A1', ex_it:'Il libro è sul tavolo.',             ex_es:'El libro está sobre la mesa.',        notes:'Luogo sopra, argomento' },
  { it:'per', es:'por / para',          lv:'A1', ex_it:'Questo è per te.',                   ex_es:'Esto es para ti.',                    notes:'Destinatario, scopo, causa, durata' },
  { it:'tra', es:'entre / en (tiempo)', lv:'A1', ex_it:'Arrivo tra due ore.',               ex_es:'Llego en dos horas.',                 notes:'Distanza spaziale/temporale, relazione' },
  { it:'fra', es:'entre (variante di tra)', lv:'A1', ex_it:'Fra amici tutto è più facile.', ex_es:'Entre amigos todo es más fácil.',     notes:'Equivalente di "tra", uso interchangeable' },

  // ── Preposizioni articolate — di + articolo ────────────────────────────────
  { it:'del (di + il)',    es:'del',         lv:'A1', ex_it:'il sapore del caffè',        ex_es:'el sabor del café',         notes:'di + il (maschile singolare)' },
  { it:'dello (di + lo)', es:'del',         lv:'A1', ex_it:'il profumo dello zucchero',  ex_es:'el aroma del azúcar',       notes:'di + lo (maschile, davanti a s+cons, z, gn…)' },
  { it:'della (di + la)', es:'de la',       lv:'A1', ex_it:'la porta della chiesa',      ex_es:'la puerta de la iglesia',   notes:'di + la (femminile singolare)' },
  { it:"dell' (di + l')", es:'del / de la', lv:'A1', ex_it:"il colore dell'arancia",    ex_es:'el color de la naranja',    notes:'di + l\' (davanti a vocale)' },
  { it:'dei (di + i)',    es:'de los',       lv:'A1', ex_it:'la lista dei compiti',       ex_es:'la lista de los deberes',   notes:'di + i (maschile plurale)' },
  { it:'degli (di + gli)',es:'de los',       lv:'A1', ex_it:'il nome degli studenti',     ex_es:'el nombre de los estudiantes', notes:'di + gli (maschile plurale, vocale/s+c…)' },
  { it:'delle (di + le)', es:'de las',      lv:'A1', ex_it:'il colore delle foglie',     ex_es:'el color de las hojas',     notes:'di + le (femminile plurale)' },

  // ── Preposizioni articolate — a + articolo ─────────────────────────────────
  { it:'al (a + il)',    es:'al',          lv:'A1', ex_it:'Vado al mercato.',         ex_es:'Voy al mercado.',          notes:'a + il (maschile singolare)' },
  { it:'allo (a + lo)', es:'al',          lv:'A1', ex_it:'Vado allo stadio.',        ex_es:'Voy al estadio.',          notes:'a + lo' },
  { it:'alla (a + la)', es:'a la',        lv:'A1', ex_it:'Vado alla stazione.',      ex_es:'Voy a la estación.',       notes:'a + la (femminile singolare)' },
  { it:"all' (a + l')", es:'al / a la',   lv:'A1', ex_it:"Vado all'aeroporto.",      ex_es:'Voy al aeropuerto.',       notes:'a + l\' (davanti a vocale)' },
  { it:'ai (a + i)',    es:'a los',        lv:'A1', ex_it:'Parla ai ragazzi.',        ex_es:'Habla a los chicos.',      notes:'a + i (maschile plurale)' },
  { it:'agli (a + gli)',es:'a los',        lv:'A1', ex_it:'Agli studenti piace.',     ex_es:'A los estudiantes les gusta.', notes:'a + gli' },
  { it:'alle (a + le)', es:'a las',       lv:'A1', ex_it:'Arrivo alle tre.',         ex_es:'Llego a las tres.',        notes:'a + le (femminile plurale) — usato per l\'ora' },

  // ── Preposizioni articolate — da + articolo ────────────────────────────────
  { it:'dal (da + il)',    es:'del / desde el', lv:'A1', ex_it:'Vengo dal dentista.',   ex_es:'Vengo del dentista.',       notes:'da + il' },
  { it:'dallo (da + lo)', es:'desde el',        lv:'A1', ex_it:'Esco dallo stadio.',    ex_es:'Salgo del estadio.',        notes:'da + lo' },
  { it:'dalla (da + la)', es:'de la / desde la',lv:'A1', ex_it:'Vengo dalla stazione.',ex_es:'Vengo de la estación.',     notes:'da + la (femminile singolare)' },
  { it:'dai (da + i)',    es:'de los',           lv:'A1', ex_it:'Torno dai nonni.',      ex_es:'Vuelvo de los abuelos.',    notes:'da + i' },
  { it:'dagli (da + gli)',es:'de los',           lv:'A2', ex_it:'Dagli amici si impara.',ex_es:'De los amigos se aprende.', notes:'da + gli' },
  { it:'dalle (da + le)', es:'de las',           lv:'A2', ex_it:'Arriva dalle montagne.',ex_es:'Viene de las montañas.',    notes:'da + le (femminile plurale)' },

  // ── Preposizioni articolate — in + articolo ────────────────────────────────
  { it:'nel (in + il)',    es:'en el',  lv:'A1', ex_it:'Il gatto è nel giardino.',   ex_es:'El gato está en el jardín.', notes:'in + il' },
  { it:'nello (in + lo)', es:'en el',  lv:'A1', ex_it:'Cammino nello stesso posto.', ex_es:'Camino en el mismo lugar.',  notes:'in + lo' },
  { it:'nella (in + la)', es:'en la',  lv:'A1', ex_it:'Vivo nella città.',           ex_es:'Vivo en la ciudad.',         notes:'in + la (femminile singolare)' },
  { it:"nell' (in + l')", es:'en el/la',lv:'A1', ex_it:"Nuoto nell'acqua.",          ex_es:'Nado en el agua.',           notes:'in + l\' (davanti a vocale)' },
  { it:'nei (in + i)',    es:'en los',  lv:'A1', ex_it:'Nei weekend riposo.',         ex_es:'Los fines de semana descanso.', notes:'in + i' },
  { it:'negli (in + gli)',es:'en los',  lv:'A2', ex_it:"Negli anni '90 era diverso.", ex_es:'En los años 90 era diferente.', notes:'in + gli' },
  { it:'nelle (in + le)', es:'en las', lv:'A1', ex_it:'Nelle vacanze viaggio.',      ex_es:'En las vacaciones viajo.',   notes:'in + le (femminile plurale)' },

  // ── Preposizioni articolate — su + articolo ────────────────────────────────
  { it:'sul (su + il)',    es:'en el / sobre el', lv:'A1', ex_it:'Il libro è sul tavolo.',   ex_es:'El libro está sobre la mesa.',  notes:'su + il' },
  { it:'sullo (su + lo)', es:'en el / sobre el', lv:'A2', ex_it:'Scrive sullo stesso tema.', ex_es:'Escribe sobre el mismo tema.',  notes:'su + lo' },
  { it:'sulla (su + la)', es:'en la / sobre la', lv:'A1', ex_it:'Siediti sulla sedia.',      ex_es:'Siéntate en la silla.',         notes:'su + la (femminile singolare)' },
  { it:'sui (su + i)',    es:'en los / sobre los',lv:'A2', ex_it:'Sui giornali si legge.',    ex_es:'En los periódicos se lee.',     notes:'su + i' },
  { it:'sugli (su + gli)',es:'en los',            lv:'A2', ex_it:'Sugli alberi cantano uccelli.', ex_es:'En los árboles cantan pájaros.', notes:'su + gli' },
  { it:'sulle (su + le)', es:'en las / sobre las',lv:'A2', ex_it:'Sulle montagne c\'è neve.', ex_es:'En las montañas hay nieve.',   notes:'su + le (femminile plurale)' },

  // ── Preposizione articolata — con + articolo ───────────────────────────────
  { it:'col (con + il)', es:'con el', lv:'A2', ex_it:'Mangio col cucchiaio.',    ex_es:'Como con la cuchara.',       notes:'Forma contratta di con + il (colloquiale)' },
  { it:'coi (con + i)',  es:'con los',lv:'B1', ex_it:'Gioca coi bambini.',       ex_es:'Juega con los niños.',       notes:'Forma contratta di con + i (colloquiale/letterario)' },

  // ── Preposizioni improprie ─────────────────────────────────────────────────
  { it:'sopra',         es:'encima de / sobre',   lv:'A2', ex_it:'Il quadro è sopra il divano.', ex_es:'El cuadro está encima del sofá.', notes:'Indica posizione superiore' },
  { it:'sotto',         es:'debajo de / bajo',    lv:'A2', ex_it:'Il gatto è sotto il letto.',  ex_es:'El gato está debajo de la cama.', notes:'Indica posizione inferiore' },
  { it:'davanti a',     es:'delante de / ante',   lv:'A2', ex_it:'Aspettami davanti al cinema.', ex_es:'Espérame delante del cine.',     notes:'Posizione anteriore' },
  { it:'dietro (a/di)', es:'detrás de',           lv:'A2', ex_it:'La chiave è dietro la porta.', ex_es:'La llave está detrás de la puerta.', notes:'Posizione posteriore' },
  { it:'vicino a',      es:'cerca de',            lv:'A2', ex_it:'Abito vicino alla stazione.',  ex_es:'Vivo cerca de la estación.',     notes:'Prossimità spaziale' },
  { it:'lontano da',    es:'lejos de',            lv:'A2', ex_it:'Sono lontano da casa.',        ex_es:'Estoy lejos de casa.',           notes:'Distanza spaziale' },
  { it:'dentro',        es:'dentro de',           lv:'A2', ex_it:'Il gatto è dentro la scatola.',ex_es:'El gato está dentro de la caja.',notes:'Interno di qualcosa' },
  { it:'fuori (da)',    es:'fuera (de)',           lv:'A2', ex_it:'Aspetta fuori dalla porta.',   ex_es:'Espera fuera de la puerta.',     notes:'Esterno di qualcosa' },
  { it:'lungo',         es:'a lo largo de',       lv:'B1', ex_it:'Cammino lungo il fiume.',      ex_es:'Camino a lo largo del río.',     notes:'Parallelo a qualcosa (strada, costa…)' },
  { it:'verso',         es:'hacia',               lv:'A2', ex_it:'Cammino verso la piazza.',     ex_es:'Camino hacia la plaza.',         notes:'Direzione approssimativa' },
  { it:'contro',        es:'contra',              lv:'A2', ex_it:'È caduto contro il muro.',     ex_es:'Chocó contra la pared.',         notes:'Opposizione, contatto violento' },
  { it:'durante',       es:'durante',             lv:'A1', ex_it:'Ho dormito durante il film.',  ex_es:'Me dormí durante la película.',  notes:'Simultaneità temporale' },
  { it:'dopo',          es:'después de',          lv:'A1', ex_it:'Ci vediamo dopo cena.',        ex_es:'Nos vemos después de cenar.',    notes:'Posteriorità temporale' },
  { it:'prima (di)',    es:'antes (de)',           lv:'A1', ex_it:'Arrivo prima delle otto.',     ex_es:'Llego antes de las ocho.',       notes:'Anteriorità temporale' },
  { it:'invece di',     es:'en vez de / en lugar de', lv:'B1', ex_it:'Invece di urlare, parla.', ex_es:'En vez de gritar, habla.',      notes:'Sostituzione' },
  { it:'attraverso',    es:'a través de',         lv:'B1', ex_it:'Passiamo attraverso il parco.',ex_es:'Pasamos a través del parque.',   notes:'Attraversamento di uno spazio' },
  { it:'oltre',         es:'más allá de / además de', lv:'B1', ex_it:'Oltre il ponte c\'è un bar.', ex_es:'Más allá del puente hay un bar.', notes:'Superamento di limite spaziale o aggiunta' },
  { it:'secondo',       es:'según',               lv:'B1', ex_it:'Secondo me hai torto.',        ex_es:'Según yo tienes razón.',         notes:'Fonte, punto di vista' },
  { it:'circa',         es:'aproximadamente / alrededor de', lv:'A2', ex_it:'Costa circa venti euro.', ex_es:'Cuesta aproximadamente veinte euros.', notes:'Approssimazione' },
  { it:'tranne',        es:'excepto / salvo',     lv:'B1', ex_it:'Vengono tutti tranne lui.',    ex_es:'Vienen todos excepto él.',       notes:'Esclusione. Sinonimi: eccetto, salvo' },
  { it:'eccetto',       es:'excepto',             lv:'B1', ex_it:'Tutti eccetto me.',            ex_es:'Todos excepto yo.',              notes:'Esclusione. Sinonimo di tranne' },
  { it:'salvo',         es:'salvo / excepto',     lv:'B1', ex_it:'Tutto è andato bene, salvo un piccolo problema.', ex_es:'Todo fue bien, salvo un pequeño problema.', notes:'Esclusione, riserva' },
  { it:'senza',         es:'sin',                 lv:'A1', ex_it:'Non posso vivere senza caffè.',ex_es:'No puedo vivir sin café.',       notes:'Mancanza' },
  { it:'fino a',        es:'hasta',               lv:'A2', ex_it:'Lavoro fino alle sei.',        ex_es:'Trabajo hasta las seis.',        notes:'Limite temporale o spaziale' },
  { it:'entro',         es:'antes de (plazo) / para',lv:'B1', ex_it:'Consegna entro venerdì.',  ex_es:'Entrega para el viernes.',       notes:'Limite massimo di tempo (scadenza)' },
  { it:'insieme a',     es:'junto a / junto con', lv:'A2', ex_it:'Vengo insieme a te.',          ex_es:'Vengo junto a ti.',              notes:'Compagnia' },

  // ── Locuzioni prepositive ──────────────────────────────────────────────────
  { it:'nonostante',     es:'a pesar de',         lv:'B1', ex_it:'Nonostante la pioggia siamo usciti.', ex_es:'A pesar de la lluvia salimos.',  notes:'Concessione, contrasto' },
  { it:'grazie a',       es:'gracias a',          lv:'A2', ex_it:'Grazie a te ho superato l\'esame.', ex_es:'Gracias a ti aprobé el examen.', notes:'Causa positiva' },
  { it:'a causa di',     es:'a causa de',         lv:'B1', ex_it:'Il volo è cancellato a causa dello sciopero.', ex_es:'El vuelo está cancelado a causa de la huelga.', notes:'Causa negativa' },
  { it:'in mezzo a',     es:'en medio de',        lv:'A2', ex_it:'In mezzo alla confusione non capivo nulla.', ex_es:'En medio del caos no entendía nada.', notes:'Posizione centrale' },
  { it:'di fronte a',    es:'frente a / enfrente de', lv:'A2', ex_it:'Il bar è di fronte alla chiesa.', ex_es:'El bar está frente a la iglesia.', notes:'Posizione anteriore' },
  { it:'accanto a',      es:'al lado de',         lv:'A2', ex_it:'Siediti accanto a me.',        ex_es:'Siéntate a mi lado.',            notes:'Prossimità laterale. Sin: a fianco di' },
  { it:'a fianco di',    es:'al lado de',         lv:'B1', ex_it:'Cammino a fianco di mia sorella.', ex_es:'Camino al lado de mi hermana.', notes:'Sinonimo di accanto a (più formale)' },
  { it:'in seguito a',   es:'tras / a raíz de / como consecuencia de', lv:'B2', ex_it:'In seguito all\'incidente ha cambiato vita.', ex_es:'Tras el accidente cambió de vida.', notes:'Causa o conseguenza (formale)' },
  { it:'rispetto a',     es:'respecto a / en comparación con', lv:'B1', ex_it:'Rispetto a ieri fa più caldo.', ex_es:'En comparación con ayer hace más calor.', notes:'Confronto, paragone' },
  { it:'a partire da',   es:'a partir de',        lv:'B1', ex_it:'A partire da domani tutto cambia.', ex_es:'A partir de mañana todo cambia.', notes:'Punto di inizio temporale' },
  { it:'in base a',      es:'en base a / basándose en', lv:'B2', ex_it:'Decidiamo in base ai risultati.', ex_es:'Decidimos en base a los resultados.', notes:'Criterio, riferimento' },
  { it:'a differenza di',es:'a diferencia de',    lv:'B2', ex_it:'A differenza di suo fratello, studia molto.', ex_es:'A diferencia de su hermano, estudia mucho.', notes:'Contrasto/distinzione' },
  { it:'ad eccezione di',es:'a excepción de',     lv:'B2', ex_it:'Tutti, ad eccezione di Marco, erano d\'accordo.', ex_es:'Todos, a excepción de Marco, estaban de acuerdo.', notes:'Esclusione formale' },
  { it:'per mezzo di',   es:'por medio de / mediante', lv:'B2', ex_it:'Comunicava per mezzo di lettere.', ex_es:'Se comunicaba por medio de cartas.', notes:'Strumento, canale' },
  { it:'a proposito di', es:'a propósito de / hablando de', lv:'B1', ex_it:'A proposito di Marco, lo hai visto?', ex_es:'A propósito de Marco, ¿lo has visto?', notes:'Introduce un argomento' },
  { it:'in quanto a',    es:'en cuanto a',        lv:'B2', ex_it:'In quanto a coraggio, non gli manca nulla.', ex_es:'En cuanto a valor, no le falta nada.', notes:'Riguardo a, per quanto riguarda' },
  { it:'nei confronti di', es:'respecto a / hacia (actitud)', lv:'B2', ex_it:'Ha un atteggiamento ostile nei confronti di tutti.', ex_es:'Tiene una actitud hostil hacia todos.', notes:'Relazione di comportamento/atteggiamento' },
  { it:'nei pressi di',  es:'cerca de / en las inmediaciones de', lv:'B1', ex_it:'L\'hotel è nei pressi della stazione.', ex_es:'El hotel está cerca de la estación.', notes:'Vicinanza spaziale (più formale di vicino a)' },
  { it:'al di là di',    es:'más allá de',        lv:'B1', ex_it:'Al di là delle aspettative.',  ex_es:'Más allá de las expectativas.',  notes:'Superamento di un limite (fisico o figurato)' },
  { it:'al di sopra di', es:'por encima de',      lv:'B2', ex_it:'È al di sopra delle possibilità.',ex_es:'Está por encima de las posibilidades.', notes:'Superiore a un livello (fisico o figurato)' },
  { it:'al di sotto di', es:'por debajo de',      lv:'B2', ex_it:'È al di sotto della media.',   ex_es:'Está por debajo de la media.',   notes:'Inferiore a un livello' },
  { it:'in cima a',      es:'en lo alto de / en la cima de', lv:'B1', ex_it:'In cima alla montagna c\'è un rifugio.', ex_es:'En la cima de la montaña hay un refugio.', notes:'Punto più alto' },
  { it:'in fondo a',     es:'al fondo de / al final de', lv:'A2', ex_it:'Il bagno è in fondo al corridoio.', ex_es:'El baño está al fondo del pasillo.', notes:'Punto più lontano/basso' },
  { it:'per via di',     es:'por culpa de / debido a', lv:'B1', ex_it:'Ho perso il treno per via del traffico.', ex_es:'Perdí el tren debido al tráfico.', notes:'Causa (spesso negativa, colloquiale)' },
  { it:'a condizione di', es:'a condición de',   lv:'B2', ex_it:'Ti aiuto a condizione di ricevere il tuo aiuto.', ex_es:'Te ayudo a condición de recibir tu ayuda.', notes:'Condizionalità' },
  { it:'allo scopo di',  es:'con el fin de / con el objetivo de', lv:'B2', ex_it:'Studio allo scopo di migliorare.', ex_es:'Estudio con el fin de mejorar.', notes:'Finalità (formale)' },
  { it:'in favore di',   es:'a favor de',         lv:'B2', ex_it:'Voto in favore della proposta.', ex_es:'Voto a favor de la propuesta.',  notes:'Sostegno, vantaggio' },
];

preps.forEach(p => {
  insertWord.run(
    p.it, p.es, catId, 'other',
    null, null, null,
    p.ex_it || null, p.ex_es || null,
    p.lv || 'B1', p.notes || null, null, '[]'
  );
});

// Create flashcards for new preposition items
const newWords = db.prepare(`SELECT id, italian, spanish, category_id FROM vocabulary_items WHERE category_id=?`).all(catId);
const now = Math.floor(Date.now() / 1000);
const insertFC = db.prepare(`INSERT OR IGNORE INTO flashcards(vocabulary_id,front,back,direction,category_id,next_review) VALUES(?,?,?,?,?,?)`);
newWords.forEach(w => insertFC.run(w.id, w.italian, w.spanish, 'it-es', catId, now));

const wCount = db.prepare(`SELECT COUNT(*) as n FROM vocabulary_items WHERE category_id=?`).get(catId).n;
const fCount = db.prepare(`SELECT COUNT(*) as n FROM flashcards WHERE category_id=?`).get(catId).n;
console.log(`✅ Preposizioni: ${wCount} voci, ${fCount} flashcard`);
