require('dotenv').config();
const db = require('./db');
const { createSchema } = require('./schema');

createSchema();

// ── Categories ─────────────────────────────────────────────────────────────
const categories = [
  { name: 'Il Corpo',             name_it: 'Il Corpo Umano',          icon: '🫀', color: '#dc2626', sort_order: 1 },
  { name: 'Paesi e Nazionalità',  name_it: 'Paesi e Nazionalità',     icon: '🌍', color: '#2563eb', sort_order: 2 },
  { name: 'Colori',               name_it: 'I Colori',                 icon: '🎨', color: '#7c3aed', sort_order: 3 },
  { name: 'Animali',              name_it: 'Gli Animali',              icon: '🐾', color: '#92400e', sort_order: 4 },
  { name: 'La Famiglia',          name_it: 'La Famiglia',              icon: '👨‍👩‍👧', color: '#db2777', sort_order: 5 },
  { name: 'Casa e Arredamento',   name_it: 'Casa e Arredamento',       icon: '🏠', color: '#0891b2', sort_order: 6 },
  { name: 'Cibo e Bevande',       name_it: 'Cibo e Bevande',           icon: '🍝', color: '#ea580c', sort_order: 7 },
  { name: 'Abbigliamento',        name_it: 'Abbigliamento',            icon: '👕', color: '#6d28d9', sort_order: 8 },
  { name: 'Trasporti',            name_it: 'I Trasporti',              icon: '🚌', color: '#1d4ed8', sort_order: 9 },
  { name: 'Lavoro e Professioni', name_it: 'Lavoro e Professioni',     icon: '💼', color: '#0f766e', sort_order: 10 },
  { name: 'Emozioni',             name_it: 'Emozioni e Sentimenti',    icon: '💭', color: '#be185d', sort_order: 11 },
  { name: 'Verbi Frequenti',      name_it: 'Verbi Frequenti',          icon: '⚡', color: '#1e6b45', sort_order: 12 },
  { name: 'Aggettivi',            name_it: 'Aggettivi Frequenti',      icon: '✨', color: '#4338ca', sort_order: 13 },
  { name: 'Connettori',           name_it: 'Connettori Discorsivi',    icon: '🔗', color: '#0369a1', sort_order: 14 },
  { name: 'Falsi Amici',          name_it: 'Falsi Amici',              icon: '⚠️', color: '#b45309', sort_order: 15 },
];

const insertCat = db.prepare(`INSERT OR IGNORE INTO vocabulary_categories(name,name_it,icon,color,sort_order) VALUES(?,?,?,?,?)`);
categories.forEach(c => insertCat.run(c.name, c.name_it, c.icon, c.color, c.sort_order));

const getCatId = (name) => db.prepare(`SELECT id FROM vocabulary_categories WHERE name=?`).get(name)?.id;

// ── Vocabulary ──────────────────────────────────────────────────────────────
const insertWord = db.prepare(`
  INSERT OR IGNORE INTO vocabulary_items
  (italian,spanish,category_id,word_type,gender,article,plural,example_it,example_es,cefr_level,notes,false_friend_note,collocations)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const words = {
  'Il Corpo': [
    { it:'il braccio', es:'el brazo', type:'noun', g:'m', art:'il', pl:'le braccia', ex_it:'Mi fa male il braccio.', ex_es:'Me duele el brazo.', lv:'A2' },
    { it:'la gamba', es:'la pierna', type:'noun', g:'f', art:'la', pl:'le gambe', ex_it:'Ha le gambe lunghe.', ex_es:'Tiene las piernas largas.', lv:'A2' },
    { it:'il piede', es:'el pie', type:'noun', g:'m', art:'il', pl:'i piedi', ex_it:'Ho freddo ai piedi.', ex_es:'Tengo los pies fríos.', lv:'A2' },
    { it:'la mano', es:'la mano', type:'noun', g:'f', art:'la', pl:'le mani', ex_it:'Dammi la mano.', ex_es:'Dame la mano.', lv:'A2', col:'["dare la mano","stringere la mano"]' },
    { it:'la testa', es:'la cabeza', type:'noun', g:'f', art:'la', pl:'le teste', ex_it:'Mi fa male la testa.', ex_es:'Me duele la cabeza.', lv:'A2', col:'["avere mal di testa","perdere la testa"]' },
    { it:'il cuore', es:'el corazón', type:'noun', g:'m', art:'il', pl:'i cuori', ex_it:'Il suo cuore batte forte.', ex_es:'Su corazón late fuerte.', lv:'A2', col:'["di tutto cuore","avere il cuore aperto"]' },
    { it:"l'occhio", es:'el ojo', type:'noun', g:'m', art:"l'", pl:'gli occhi', ex_it:'Ha gli occhi azzurri.', ex_es:'Tiene los ojos azules.', lv:'A2', col:'["dare un occhio","tenere d\'occhio"]' },
    { it:"l'orecchio", es:'el oído / la oreja', type:'noun', g:'m', art:"l'", pl:'le orecchie', ex_it:'Non sento bene con quest\'orecchio.', ex_es:'No oigo bien con este oído.', lv:'A2' },
    { it:'il naso', es:'la nariz', type:'noun', g:'m', art:'il', pl:'i nasi', ex_it:'Ha un naso molto lungo.', ex_es:'Tiene una nariz muy larga.', lv:'A2' },
    { it:'la bocca', es:'la boca', type:'noun', g:'f', art:'la', pl:'le bocche', ex_it:'Apri la bocca.', ex_es:'Abre la boca.', lv:'A2' },
    { it:'il dente', es:'el diente', type:'noun', g:'m', art:'il', pl:'i denti', ex_it:'Mi fa male un dente.', ex_es:'Me duele un diente.', lv:'A2', col:'["lavarsi i denti"]' },
    { it:'la spalla', es:'el hombro', type:'noun', g:'f', art:'la', pl:'le spalle', ex_it:'Ha la spalla slogata.', ex_es:'Tiene el hombro dislocado.', lv:'A2' },
    { it:'il ginocchio', es:'la rodilla', type:'noun', g:'m', art:'il', pl:'le ginocchia', ex_it:'Mi sono fatto male al ginocchio.', ex_es:'Me he lastimado la rodilla.', lv:'A2' },
    { it:'la schiena', es:'la espalda', type:'noun', g:'f', art:'la', pl:'le schiene', ex_it:'Ho mal di schiena.', ex_es:'Tengo dolor de espalda.', lv:'A2', col:'["mal di schiena","fare male alla schiena"]' },
    { it:'il dito', es:'el dedo', type:'noun', g:'m', art:'il', pl:'le dita', ex_it:'Si è tagliato un dito.', ex_es:'Se ha cortado un dedo.', lv:'A2' },
    { it:'il petto', es:'el pecho', type:'noun', g:'m', art:'il', pl:'i petti', ex_it:'Sente un dolore al petto.', ex_es:'Siente dolor en el pecho.', lv:'B1' },
    { it:'il collo', es:'el cuello', type:'noun', g:'m', art:'il', pl:'i colli', ex_it:'Porta una sciarpa al collo.', ex_es:'Lleva una bufanda al cuello.', lv:'A2' },
    { it:'il pollice', es:'el pulgar', type:'noun', g:'m', art:'il', pl:'i pollici', ex_it:'Ha alzato il pollice in su.', ex_es:'Levantó el pulgar.', lv:'B1' },
    { it:'il sangue', es:'la sangre', type:'noun', g:'m', art:'il', pl:'i sangui', ex_it:'C\'è molto sangue.', ex_es:'Hay mucha sangre.', lv:'A2' },
    { it:'il cervello', es:'el cerebro', type:'noun', g:'m', art:'il', pl:'i cervelli', ex_it:'Usa il cervello!', ex_es:'¡Usa el cerebro!', lv:'B1' },
  ],

  'Paesi e Nazionalità': [
    { it:'la Germania', es:'Alemania', type:'noun', g:'f', art:'la', ex_it:'Vivo in Germania da tre anni.', ex_es:'Vivo en Alemania desde hace tres años.', lv:'A2', notes:'nazionalità: tedesco/a — in Germania' },
    { it:'la Francia', es:'Francia', type:'noun', g:'f', art:'la', ex_it:'Parto per la Francia domani.', ex_es:'Parto hacia Francia mañana.', lv:'A2', notes:'nazionalità: francese — in Francia' },
    { it:'la Spagna', es:'España', type:'noun', g:'f', art:'la', ex_it:'La Spagna è vicina all\'Italia.', ex_es:'España está cerca de Italia.', lv:'A2', notes:'nazionalità: spagnolo/a — in Spagna' },
    { it:'il Portogallo', es:'Portugal', type:'noun', g:'m', art:'il', ex_it:'Il Portogallo ha ottime spiagge.', ex_es:'Portugal tiene excelentes playas.', lv:'A2', notes:'nazionalità: portoghese — in Portogallo' },
    { it:"l'Inghilterra", es:'Inglaterra', type:'noun', g:'f', art:"l'", ex_it:'Ha studiato a Londra, in Inghilterra.', ex_es:'Estudió en Londres, en Inglaterra.', lv:'A2', notes:'nazionalità: inglese — in Inghilterra' },
    { it:'gli Stati Uniti', es:'Estados Unidos', type:'noun', g:'m', art:'gli', pl:'—', ex_it:'Vuole trasferirsi negli Stati Uniti.', ex_es:'Quiere mudarse a Estados Unidos.', lv:'A2', notes:'nazionalità: americano/a — negli Stati Uniti' },
    { it:'il Messico', es:'México', type:'noun', g:'m', art:'il', ex_it:'Il Messico ha una cultura ricca.', ex_es:'México tiene una cultura rica.', lv:'A2', notes:'nazionalità: messicano/a — in Messico' },
    { it:'il Brasile', es:'Brasil', type:'noun', g:'m', art:'il', ex_it:'Il Brasile è il paese più grande del Sudamerica.', ex_es:'Brasil es el país más grande de Sudamérica.', lv:'A2', notes:'nazionalità: brasiliano/a — in Brasile' },
    { it:"l'Argentina", es:'Argentina', type:'noun', g:'f', art:"l'", ex_it:'Buenos Aires è la capitale dell\'Argentina.', ex_es:'Buenos Aires es la capital de Argentina.', lv:'A2', notes:'nazionalità: argentino/a — in Argentina' },
    { it:'il Giappone', es:'Japón', type:'noun', g:'m', art:'il', ex_it:'Il Giappone è famoso per la tecnologia.', ex_es:'Japón es famoso por su tecnología.', lv:'A2', notes:'nazionalità: giapponese — in Giappone' },
    { it:'la Cina', es:'China', type:'noun', g:'f', art:'la', ex_it:'La Cina ha oltre un miliardo di abitanti.', ex_es:'China tiene más de mil millones de habitantes.', lv:'A2', notes:'nazionalità: cinese — in Cina' },
    { it:'la Russia', es:'Rusia', type:'noun', g:'f', art:'la', ex_it:'La Russia è il paese più vasto del mondo.', ex_es:'Rusia es el país más vasto del mundo.', lv:'A2', notes:'nazionalità: russo/a — in Russia' },
    { it:'la Svizzera', es:'Suiza', type:'noun', g:'f', art:'la', ex_it:'La Svizzera ha quattro lingue ufficiali.', ex_es:'Suiza tiene cuatro idiomas oficiales.', lv:'B1', notes:'nazionalità: svizzero/a — in Svizzera' },
    { it:'la Grecia', es:'Grecia', type:'noun', g:'f', art:'la', ex_it:'La Grecia è la culla della civiltà occidentale.', ex_es:'Grecia es la cuna de la civilización occidental.', lv:'B1', notes:'nazionalità: greco/a — in Grecia' },
    { it:'il Marocco', es:'Marruecos', type:'noun', g:'m', art:'il', ex_it:'Il Marocco è in Africa del Nord.', ex_es:'Marruecos está en el norte de África.', lv:'B1', notes:'nazionalità: marocchino/a — in Marocco' },
  ],

  'Colori': [
    { it:'rosso', es:'rojo', type:'adjective', ex_it:'Indossa una camicia rossa.', ex_es:'Lleva una camisa roja.', lv:'A1' },
    { it:'blu', es:'azul', type:'adjective', ex_it:'Il cielo è blu.', ex_es:'El cielo es azul.', lv:'A1', notes:'Invariabile: un fiore blu, dei fiori blu' },
    { it:'verde', es:'verde', type:'adjective', ex_it:'L\'erba è verde.', ex_es:'La hierba es verde.', lv:'A1' },
    { it:'giallo', es:'amarillo', type:'adjective', ex_it:'Il sole è giallo.', ex_es:'El sol es amarillo.', lv:'A1' },
    { it:'bianco', es:'blanco', type:'adjective', ex_it:'Preferisce le pareti bianche.', ex_es:'Prefiere las paredes blancas.', lv:'A1' },
    { it:'nero', es:'negro', type:'adjective', ex_it:'Porta sempre vestiti neri.', ex_es:'Siempre lleva ropa negra.', lv:'A1' },
    { it:'grigio', es:'gris', type:'adjective', ex_it:'Il cielo è grigio oggi.', ex_es:'El cielo está gris hoy.', lv:'A1' },
    { it:'arancione', es:'naranja', type:'adjective', ex_it:'Il tramonto è arancione.', ex_es:'El atardecer es naranja.', lv:'A1', notes:'Invariabile: fiori arancione' },
    { it:'viola', es:'violeta / morado', type:'adjective', ex_it:'Le lavande sono viola.', ex_es:'Las lavandas son violetas.', lv:'A2', notes:'Invariabile: fiori viola' },
    { it:'rosa', es:'rosa', type:'adjective', ex_it:'Ha comprato una borsa rosa.', ex_es:'Compró un bolso rosa.', lv:'A1', notes:'Invariabile' },
    { it:'marrone', es:'marrón', type:'adjective', ex_it:'Ha gli occhi marroni.', ex_es:'Tiene los ojos marrones.', lv:'A2' },
    { it:'azzurro', es:'azul claro / celeste', type:'adjective', ex_it:'Il cielo è azzurro stamattina.', ex_es:'El cielo está celeste esta mañana.', lv:'A2' },
    { it:'beige', es:'beige', type:'adjective', ex_it:'Il suo cappotto è beige.', ex_es:'Su abrigo es beige.', lv:'A2', notes:'Invariabile, pronuncia: béige' },
    { it:'dorato', es:'dorado', type:'adjective', ex_it:'Ha i capelli dorati.', ex_es:'Tiene el pelo dorado.', lv:'B1' },
    { it:'argentato', es:'plateado', type:'adjective', ex_it:'Una cornice argentata.', ex_es:'Un marco plateado.', lv:'B1' },
  ],

  'Animali': [
    { it:'il cane', es:'el perro', type:'noun', g:'m', art:'il', pl:'i cani', ex_it:'Il mio cane si chiama Fido.', ex_es:'Mi perro se llama Fido.', lv:'A1' },
    { it:'il gatto', es:'el gato', type:'noun', g:'m', art:'il', pl:'i gatti', ex_it:'Il gatto dorme sul divano.', ex_es:'El gato duerme en el sofá.', lv:'A1' },
    { it:'il cavallo', es:'el caballo', type:'noun', g:'m', art:'il', pl:'i cavalli', ex_it:'Sai andare a cavallo?', ex_es:'¿Sabes montar a caballo?', lv:'A2', col:'["andare a cavallo"]' },
    { it:'la mucca', es:'la vaca', type:'noun', g:'f', art:'la', pl:'le mucche', ex_it:'Le mucche mangiano l\'erba.', ex_es:'Las vacas comen hierba.', lv:'A2' },
    { it:'il maiale', es:'el cerdo', type:'noun', g:'m', art:'il', pl:'i maiali', ex_it:'L\'allevamento di maiali è diffuso.', ex_es:'La cría de cerdos está extendida.', lv:'A2' },
    { it:"l'uccello", es:'el pájaro', type:'noun', g:'m', art:"l'", pl:'gli uccelli', ex_it:'Un uccello canta sul tetto.', ex_es:'Un pájaro canta en el tejado.', lv:'A2' },
    { it:'il pesce', es:'el pez / el pescado', type:'noun', g:'m', art:'il', pl:'i pesci', ex_it:'Nel lago ci sono molti pesci.', ex_es:'En el lago hay muchos peces.', lv:'A1' },
    { it:"l'elefante", es:'el elefante', type:'noun', g:'m', art:"l'", pl:'gli elefanti', ex_it:'Gli elefanti vivono in Africa e in Asia.', ex_es:'Los elefantes viven en África y Asia.', lv:'A2' },
    { it:'il leone', es:'el león', type:'noun', g:'m', art:'il', pl:'i leoni', ex_it:'Il leone è il re della savana.', ex_es:'El león es el rey de la sabana.', lv:'A2' },
    { it:'la tigre', es:'el tigre', type:'noun', g:'f', art:'la', pl:'le tigri', ex_it:'Le tigri sono in via di estinzione.', ex_es:'Los tigres están en peligro de extinción.', lv:'A2' },
    { it:'il lupo', es:'el lobo', type:'noun', g:'m', art:'il', pl:'i lupi', ex_it:'I lupi vivono in branco.', ex_es:'Los lobos viven en manadas.', lv:'A2' },
    { it:"l'orso", es:'el oso', type:'noun', g:'m', art:"l'", pl:'gli orsi', ex_it:'L\'orso va in letargo d\'inverno.', ex_es:'El oso hiberna en invierno.', lv:'A2' },
    { it:'la volpe', es:'el zorro', type:'noun', g:'f', art:'la', pl:'le volpi', ex_it:'La volpe è un animale furbo.', ex_es:'El zorro es un animal astuto.', lv:'B1' },
    { it:'il coniglio', es:'el conejo', type:'noun', g:'m', art:'il', pl:'i conigli', ex_it:'Il coniglio mangia le carote.', ex_es:'El conejo come zanahorias.', lv:'A2' },
    { it:"l'aquila", es:'el águila', type:'noun', g:'f', art:"l'", pl:'le aquile', ex_it:"L'aquila è il simbolo nazionale di molti paesi.", ex_es:'El águila es el símbolo nacional de muchos países.', lv:'B1' },
  ],

  'La Famiglia': [
    { it:'il padre', es:'el padre', type:'noun', g:'m', art:'il', pl:'i padri', ex_it:'Mio padre lavora in banca.', ex_es:'Mi padre trabaja en un banco.', lv:'A1', col:'["fare il padre","diventare padre"]' },
    { it:'la madre', es:'la madre', type:'noun', g:'f', art:'la', pl:'le madri', ex_it:'Mia madre è medica.', ex_es:'Mi madre es médica.', lv:'A1' },
    { it:'il fratello', es:'el hermano', type:'noun', g:'m', art:'il', pl:'i fratelli', ex_it:'Ho un fratello maggiore.', ex_es:'Tengo un hermano mayor.', lv:'A1' },
    { it:'la sorella', es:'la hermana', type:'noun', g:'f', art:'la', pl:'le sorelle', ex_it:'Mia sorella studia medicina.', ex_es:'Mi hermana estudia medicina.', lv:'A1' },
    { it:'il nonno', es:'el abuelo', type:'noun', g:'m', art:'il', pl:'i nonni', ex_it:'Mio nonno ha novant\'anni.', ex_es:'Mi abuelo tiene noventa años.', lv:'A1' },
    { it:'la nonna', es:'la abuela', type:'noun', g:'f', art:'la', pl:'le nonne', ex_it:'La nonna cucina benissimo.', ex_es:'La abuela cocina muy bien.', lv:'A1' },
    { it:'il figlio', es:'el hijo', type:'noun', g:'m', art:'il', pl:'i figli', ex_it:'Ho due figli.', ex_es:'Tengo dos hijos.', lv:'A1' },
    { it:'la figlia', es:'la hija', type:'noun', g:'f', art:'la', pl:'le figlie', ex_it:'Mia figlia ha cinque anni.', ex_es:'Mi hija tiene cinco años.', lv:'A1' },
    { it:'lo zio', es:'el tío', type:'noun', g:'m', art:'lo', pl:'gli zii', ex_it:'Mio zio vive a Roma.', ex_es:'Mi tío vive en Roma.', lv:'A2' },
    { it:'la zia', es:'la tía', type:'noun', g:'f', art:'la', pl:'le zie', ex_it:'La zia mi ha portato un regalo.', ex_es:'La tía me trajo un regalo.', lv:'A2' },
    { it:'il cugino', es:'el primo', type:'noun', g:'m', art:'il', pl:'i cugini', ex_it:'I miei cugini abitano a Milano.', ex_es:'Mis primos viven en Milán.', lv:'A2' },
    { it:'il nipote', es:'el nieto / el sobrino', type:'noun', g:'m', art:'il', pl:'i nipoti', ex_it:'Il nipote è venuto a trovarci.', ex_es:'El nieto vino a visitarnos.', lv:'A2', notes:'Può significare sia nipote (di nonni) che nipote (di zii)' },
    { it:'il marito', es:'el marido / el esposo', type:'noun', g:'m', art:'il', pl:'i mariti', ex_it:'Suo marito è molto gentile.', ex_es:'Su marido es muy amable.', lv:'A2' },
    { it:'la moglie', es:'la esposa', type:'noun', g:'f', art:'la', pl:'le mogli', ex_it:'Mia moglie lavora come ingegnera.', ex_es:'Mi esposa trabaja como ingeniera.', lv:'A2' },
    { it:'il suocero', es:'el suegro', type:'noun', g:'m', art:'il', pl:'i suoceri', ex_it:'I suoceri vengono a cena stasera.', ex_es:'Los suegros vienen a cenar esta noche.', lv:'B1' },
  ],

  'Cibo e Bevande': [
    { it:'la pasta', es:'la pasta', type:'noun', g:'f', art:'la', ex_it:'In Italia si mangia la pasta tutti i giorni.', ex_es:'En Italia se come pasta todos los días.', lv:'A1' },
    { it:'il pane', es:'el pan', type:'noun', g:'m', art:'il', ex_it:'Vado a comprare il pane.', ex_es:'Voy a comprar el pan.', lv:'A1', col:'["comprare il pane","fare il pane","guadagnarsi il pane"]' },
    { it:'il formaggio', es:'el queso', type:'noun', g:'m', art:'il', ex_it:'Il parmigiano è un formaggio famoso.', ex_es:'El parmesano es un queso famoso.', lv:'A1' },
    { it:"l'acqua", es:'el agua', type:'noun', g:'f', art:"l'", ex_it:'Bevo due litri di acqua al giorno.', ex_es:'Bebo dos litros de agua al día.', lv:'A1' },
    { it:'il vino', es:'el vino', type:'noun', g:'m', art:'il', ex_it:'L\'Italia produce vini eccellenti.', ex_es:'Italia produce vinos excelentes.', lv:'A1' },
    { it:'il caffè', es:'el café', type:'noun', g:'m', art:'il', ex_it:'Bevo un caffè ogni mattina.', ex_es:'Tomo un café cada mañana.', lv:'A1', col:'["prendere un caffè","fare il caffè"]' },
    { it:'la carne', es:'la carne', type:'noun', g:'f', art:'la', ex_it:'Mangio poca carne rossa.', ex_es:'Como poca carne roja.', lv:'A2' },
    { it:'il pesce', es:'el pescado', type:'noun', g:'m', art:'il', ex_it:'Il venerdì si mangia il pesce.', ex_es:'Los viernes se come pescado.', lv:'A1' },
    { it:"l'uovo", es:'el huevo', type:'noun', g:'m', art:"l'", pl:'le uova', ex_it:'Mi piacciono le uova strapazzate.', ex_es:'Me gustan los huevos revueltos.', lv:'A1', notes:'Plurale irregolare: le uova (femminile)' },
    { it:'il pollo', es:'el pollo', type:'noun', g:'m', art:'il', ex_it:'Preparo il pollo arrosto.', ex_es:'Preparo pollo asado.', lv:'A2' },
    { it:'il riso', es:'el arroz', type:'noun', g:'m', art:'il', ex_it:'Il risotto è fatto con il riso.', ex_es:'El risotto está hecho con arroz.', lv:'A2' },
    { it:"l'olio", es:'el aceite', type:'noun', g:'m', art:"l'", ex_it:"L'olio d'oliva è fondamentale in cucina.", ex_es:'El aceite de oliva es fundamental en la cocina.', lv:'A2', col:'["olio d\'oliva","olio extra vergine"]' },
    { it:'il burro', es:'la mantequilla', type:'noun', g:'m', art:'il', ex_it:'Metto il burro sul pane.', ex_es:'Pongo mantequilla en el pan.', lv:'A2', false_f:'NO significa "burro" (asno en español)' },
    { it:'lo zucchero', es:'el azúcar', type:'noun', g:'m', art:'lo', ex_it:'Metti lo zucchero nel caffè?', ex_es:'¿Le pones azúcar al café?', lv:'A2' },
    { it:'la frutta', es:'la fruta', type:'noun', g:'f', art:'la', ex_it:'La frutta fresca è ricca di vitamine.', ex_es:'La fruta fresca es rica en vitaminas.', lv:'A1', notes:'Collettivo — si usa al singolare per indicare la frutta in generale' },
    { it:'la verdura', es:'la verdura / los vegetales', type:'noun', g:'f', art:'la', ex_it:'Mangia più verdura!', ex_es:'¡Come más verdura!', lv:'A1', notes:'Collettivo' },
    { it:'il gelato', es:'el helado', type:'noun', g:'m', art:'il', ex_it:'Un gelato al pistacchio, per favore.', ex_es:'Un helado de pistacho, por favor.', lv:'A1' },
    { it:'la pizza', es:'la pizza', type:'noun', g:'f', art:'la', ex_it:'La pizza napoletana è la più famosa.', ex_es:'La pizza napolitana es la más famosa.', lv:'A1' },
    { it:'la birra', es:'la cerveza', type:'noun', g:'f', art:'la', ex_it:'Preferisco la birra al vino.', ex_es:'Prefiero la cerveza al vino.', lv:'A2' },
    { it:'il succo', es:'el jugo / el zumo', type:'noun', g:'m', art:'il', ex_it:'Bevo un succo di arancia.', ex_es:'Bebo un zumo de naranja.', lv:'A2' },
  ],

  'Verbi Frequenti': [
    { it:'essere', es:'ser / estar', type:'verb', ex_it:'Sono italiano. Sono a Roma.', ex_es:'Soy italiano. Estoy en Roma.', lv:'A1', notes:'Ausiliare principale. Attenzione: usato dove spagnolo usa "ser" e "estar"', col:'["essere stanco","essere a casa","essere di Roma"]' },
    { it:'avere', es:'tener / haber', type:'verb', ex_it:'Ho tre sorelle. Ho mangiato.', ex_es:'Tengo tres hermanas. He comido.', lv:'A1', notes:'Ausiliare per i verbi transitivi', col:'["avere fame","avere voglia","avere bisogno"]' },
    { it:'fare', es:'hacer', type:'verb', ex_it:'Cosa fai stasera? Faccio sport.', ex_es:'¿Qué haces esta noche? Hago deporte.', lv:'A1', col:'["fare colazione","fare sport","fare una domanda","fare attenzione"]' },
    { it:'andare', es:'ir', type:'verb', ex_it:'Vado a scuola in bicicletta.', ex_es:'Voy a la escuela en bicicleta.', lv:'A1', notes:'Ausiliare: essere', col:'["andare a piedi","andare in macchina","come va?"]' },
    { it:'venire', es:'venir', type:'verb', ex_it:'Vieni alla festa stasera?', ex_es:'¿Vienes a la fiesta esta noche?', lv:'A1', notes:'Ausiliare: essere', col:'["venire da","venire a trovare"]' },
    { it:'potere', es:'poder', type:'verb', ex_it:'Puoi aiutarmi?', ex_es:'¿Puedes ayudarme?', lv:'A1', notes:'Verbo modale — segue sempre un infinito' },
    { it:'volere', es:'querer', type:'verb', ex_it:'Voglio imparare l\'italiano.', ex_es:'Quiero aprender italiano.', lv:'A1', notes:'Verbo modale', col:'["voler dire","volere bene","ne voglio"]' },
    { it:'dovere', es:'deber / tener que', type:'verb', ex_it:'Devo studiare di più.', ex_es:'Debo estudiar más.', lv:'A1', notes:'Verbo modale — obbligo' },
    { it:'sapere', es:'saber', type:'verb', ex_it:'Sai dove si trova il ristorante?', ex_es:'¿Sabes dónde está el restaurante?', lv:'A2', notes:'Sapere = saber (conocimiento). Attenzione: non "conoscere"', col:'["non lo so","sai che...","saper fare"]' },
    { it:'conoscere', es:'conocer', type:'verb', ex_it:'Conosci Roma?', ex_es:'¿Conoces Roma?', lv:'A2', notes:'Conoscere = conocer (personas, lugares). Diverso da sapere', col:'["conoscere una persona","far conoscere","conoscersi"]' },
    { it:'parlare', es:'hablar', type:'verb', ex_it:'Parli italiano molto bene.', ex_es:'Hablas italiano muy bien.', lv:'A1', col:'["parlare di","parlare con","parlare bene/male"]' },
    { it:'capire', es:'entender / comprender', type:'verb', ex_it:'Non capisco questa grammatica.', ex_es:'No entiendo esta gramática.', lv:'A1', col:'["far capire","capire male","capirsi"]' },
    { it:'vedere', es:'ver', type:'verb', ex_it:'Ho visto un film fantastico.', ex_es:'Vi una película fantástica.', lv:'A1', col:'["si vedrà","vediamoci","fare vedere"]' },
    { it:'sentire', es:'sentir / escuchar / oír', type:'verb', ex_it:'Sento la musica. Non mi sento bene.', ex_es:'Escucho la música. No me siento bien.', lv:'A1', notes:'Sentire = oír, escuchar, sentir — contexto determina il significato' },
    { it:'mettere', es:'poner', type:'verb', ex_it:'Metti i libri sul tavolo.', ex_es:'Pon los libros sobre la mesa.', lv:'A2', col:'["mettersi","mettere da parte","mettere in ordine"]' },
    { it:'prendere', es:'tomar / coger', type:'verb', ex_it:'Prendo l\'autobus ogni mattina.', ex_es:'Tomo el autobús cada mañana.', lv:'A1', col:'["prendere un caffè","prendere una decisione","prendere in giro"]' },
    { it:'dare', es:'dar', type:'verb', ex_it:'Ti do il mio numero di telefono.', ex_es:'Te doy mi número de teléfono.', lv:'A1', col:'["dare un\'occhiata","darsi da fare","dare per scontato"]' },
    { it:'trovare', es:'encontrar', type:'verb', ex_it:'Ho trovato un ottimo ristorante.', ex_es:'Encontré un excelente restaurante.', lv:'A2', col:'["trovare lavoro","trovarsi bene","si trova"]' },
    { it:'pensare', es:'pensar', type:'verb', ex_it:'Penso che sia una buona idea.', ex_es:'Pienso que es una buena idea.', lv:'A2', notes:'Pensare + congiuntivo nella subordinata', col:'["pensare a","pensarci","che ne pensi?"]' },
    { it:'credere', es:'creer', type:'verb', ex_it:'Non credo che sia vero.', ex_es:'No creo que sea verdad.', lv:'A2', notes:'Credere + congiuntivo nella subordinata', col:'["crederci","non ci credo"]' },
    { it:'sperare', es:'esperar', type:'verb', ex_it:'Spero che tu stia bene.', ex_es:'Espero que estés bien.', lv:'B1', notes:'Sperare + congiuntivo nella subordinata', col:'["sperare in","speriamo!"]' },
    { it:'chiedere', es:'pedir / preguntar', type:'verb', ex_it:'Posso chiederti un favore?', ex_es:'¿Puedo pedirte un favor?', lv:'A2', col:'["chiedere scusa","chiedere informazioni","chiedere aiuto"]' },
    { it:'rispondere', es:'responder / contestar', type:'verb', ex_it:'Non ha risposto alla mia email.', ex_es:'No respondió a mi correo.', lv:'A2', col:'["rispondere a","rispondere di sì/no"]' },
    { it:'riuscire', es:'lograr / conseguir / poder', type:'verb', ex_it:'Non riesco a capire.', ex_es:'No logro entender.', lv:'B1', notes:'Riuscire a + infinito = poder/lograr hacer algo. Ausiliare: essere', col:'["riuscire a fare","non ci riesco"]' },
    { it:'lasciare', es:'dejar', type:'verb', ex_it:'Lasciami stare.', ex_es:'Déjame en paz.', lv:'B1', col:'["lasciare perdere","lasciare andare","lasciare stare"]' },
    { it:'portare', es:'llevar / traer', type:'verb', ex_it:'Porta i bambini a scuola.', ex_es:'Lleva a los niños a la escuela.', lv:'A2', col:'["portare a termine","portare avanti","portare via"]' },
    { it:'passare', es:'pasar', type:'verb', ex_it:'Passiamo una bella serata insieme.', ex_es:'Pasamos una bonita noche juntos.', lv:'A2', col:'["passare del tempo","passare per","come stai? — Passo"]' },
    { it:'tenere', es:'tener / mantener / sostener', type:'verb', ex_it:'Tieni in mente questa regola.', ex_es:'Ten en mente esta regla.', lv:'B1', col:'["tenerci","tenere in mente","tener duro"]' },
    { it:'diventare', es:'convertirse en / volverse', type:'verb', ex_it:'È diventato famoso.', ex_es:'Se ha vuelto famoso.', lv:'B1', notes:'Ausiliare: essere' },
    { it:'nascere', es:'nacer', type:'verb', ex_it:'Sono nato a Milano nel 1995.', ex_es:'Nací en Milán en 1995.', lv:'A2', notes:'Ausiliare: essere' },
  ],

  'Connettori': [
    { it:'però', es:'pero / sin embargo', type:'connector', ex_it:'Mi piace l\'italiano, però è difficile.', ex_es:'Me gusta el italiano, pero es difícil.', lv:'A2' },
    { it:'quindi', es:'entonces / por tanto', type:'connector', ex_it:'Non ho studiato, quindi non ho superato l\'esame.', ex_es:'No estudié, así que no aprobé el examen.', lv:'A2' },
    { it:'inoltre', es:'además', type:'connector', ex_it:'Il libro è interessante. Inoltre, è molto utile.', ex_es:'El libro es interesante. Además, es muy útil.', lv:'B1' },
    { it:'tuttavia', es:'sin embargo / no obstante', type:'connector', ex_it:'Era stanco. Tuttavia, ha continuato a lavorare.', ex_es:'Estaba cansado. Sin embargo, siguió trabajando.', lv:'B2' },
    { it:'pertanto', es:'por lo tanto', type:'connector', ex_it:'Non si sentiva bene, pertanto è rimasto a casa.', ex_es:'No se encontraba bien, por lo tanto se quedó en casa.', lv:'B2', notes:'Registro formale' },
    { it:'sebbene', es:'aunque / a pesar de que', type:'connector', ex_it:'Sebbene fosse stanco, ha continuato a lavorare.', ex_es:'Aunque estaba cansado, siguió trabajando.', lv:'B2', notes:'Segue il congiuntivo' },
    { it:'nonostante', es:'a pesar de / aunque', type:'connector', ex_it:'Nonostante la pioggia, siamo usciti.', ex_es:'A pesar de la lluvia, salimos.', lv:'B2', notes:'Segue il congiuntivo quando introduce una frase' },
    { it:'affinché', es:'para que / a fin de que', type:'connector', ex_it:'Te lo spiego affinché tu capisca.', ex_es:'Te lo explico para que lo entiendas.', lv:'C1', notes:'Segue sempre il congiuntivo' },
    { it:'benché', es:'aunque', type:'connector', ex_it:'Benché sia tardi, continuo a studiare.', ex_es:'Aunque sea tarde, sigo estudiando.', lv:'B2', notes:'Segue il congiuntivo' },
    { it:'dunque', es:'entonces / pues / por tanto', type:'connector', ex_it:'Penso, dunque sono.', ex_es:'Pienso, luego existo.', lv:'B1' },
    { it:'ovvero', es:'es decir / o sea', type:'connector', ex_it:'Il B2, ovvero il livello intermedio-alto.', ex_es:'El B2, es decir el nivel intermedio-alto.', lv:'B2' },
    { it:'anzi', es:'es más / al contrario', type:'connector', ex_it:'Non è difficile, anzi è facile!', ex_es:'No es difícil, ¡es más, es fácil!', lv:'B1', notes:'Corregge o contraddice quanto detto prima' },
    { it:'eppure', es:'y sin embargo / y aun así', type:'connector', ex_it:'Sa che fa male, eppure continua a fumare.', ex_es:'Sabe que es dañino, y aun así sigue fumando.', lv:'B2' },
    { it:'pur', es:'aunque / a pesar de', type:'connector', ex_it:'Pur essendo stanco, ha finito il lavoro.', ex_es:'A pesar de estar cansado, terminó el trabajo.', lv:'B2', notes:'Pur + gerundio — concessivo' },
    { it:'qualora', es:'en caso de que / si acaso', type:'connector', ex_it:'Qualora avessi bisogno, chiamami.', ex_es:'En caso de que necesites algo, llámame.', lv:'C1', notes:'Segue il congiuntivo — registro formale' },
  ],

  'Falsi Amici': [
    { it:'il burro', es:'la mantequilla (NO el burro)', type:'noun', g:'m', art:'il', ex_it:'Aggiungi il burro alla ricetta.', ex_es:'Añade la mantequilla a la receta.', lv:'A2', false_f:'¡Cuidado! En español "burro" = asno/tonto. En italiano "il burro" = la mantequilla.' },
    { it:'caldo', es:'caliente (NO el caldo)', type:'adjective', ex_it:'Fa molto caldo oggi.', ex_es:'Hace mucho calor hoy.', lv:'A1', false_f:'"Caldo" en italiano = caliente/calor. El caldo de sopa en italiano = "il brodo".' },
    { it:'sensibile', es:'sensible (emocionalmente) (NO sensato)', type:'adjective', ex_it:'È una persona molto sensibile.', ex_es:'Es una persona muy sensible.', lv:'B1', false_f:'"Sensible" en italiano = emotivamente sensibile. "Sensato" (inglés sensible) en italiano = sensato/ragionevole.' },
    { it:'il parente', es:'el familiar / el pariente (NO el padre/madre)', type:'noun', g:'m', art:'il', pl:'i parenti', ex_it:'Ho molti parenti in Sicilia.', ex_es:'Tengo muchos familiares en Sicilia.', lv:'A2', false_f:'"Parente" = familiar/pariente. El padre en italiano = "il padre", la madre = "la madre". "I genitori" = los padres.' },
    { it:'la camera', es:'la habitación (NO la cámara)', type:'noun', g:'f', art:'la', pl:'le camere', ex_it:'La camera da letto è al primo piano.', ex_es:'La habitación está en el primer piso.', lv:'A2', false_f:'"Camera" en italiano = habitación. La cámara fotográfica = "la macchina fotografica" o "la fotocamera".' },
    { it:'annoiare', es:'aburrir (NO molestar)', type:'verb', ex_it:'Questo film mi annoia.', ex_es:'Esta película me aburre.', lv:'B1', false_f:'"Annoiare" = aburrir. Molestar/irritar en italiano = "irritare" o "infastidire".' },
    { it:'pretendere', es:'exigir / reclamar (NO pretender)', type:'verb', ex_it:'Pretende troppo dai suoi studenti.', ex_es:'Exige demasiado a sus alumnos.', lv:'B1', false_f:'"Pretendere" = exigir/reclamar/alegar. Pretender (fingir) en italiano = "fingere".' },
    { it:'conveniente', es:'barato / conveniente (precio) (NO apropiado)', type:'adjective', ex_it:'Ho trovato un hotel molto conveniente.', ex_es:'Encontré un hotel muy barato.', lv:'B1', false_f:'"Conveniente" en italiano suele significar barato/económico. "Adeguato" = apropiado.' },
    { it:'la firma', es:'la firma / la rúbrica (NO la empresa)', type:'noun', g:'f', art:'la', ex_it:'Metti la firma qui.', ex_es:'Pon tu firma aquí.', lv:'A2', false_f:'"Firma" en italiano = firma/rúbrica. La empresa en italiano = "l\'azienda", "la ditta", "la società".' },
    { it:'morbido', es:'suave / blando (NO mórbido)', type:'adjective', ex_it:'Questo cuscino è molto morbido.', ex_es:'Este cojín es muy suave.', lv:'B1', false_f:'"Morbido" en italiano = suave/blando. Mórbido (enfermizo) en italiano = "morboso".' },
    { it:'attuale', es:'actual / de hoy en día (similar a actual pero...)', type:'adjective', ex_it:'Il governo attuale ha molti problemi.', ex_es:'El gobierno actual tiene muchos problemas.', lv:'B1', false_f:'Aquí no es falso amigo total, pero nota: "attuale" = actual/de ahora. "Reale" o "vero" = real.' },
    { it:'il pavimento', es:'el suelo / el piso (NO el pavimento)', type:'noun', g:'m', art:'il', ex_it:'Il pavimento è scivoloso.', ex_es:'El suelo está resbaladizo.', lv:'A2', false_f:'"Pavimento" en italiano = suelo/piso interior. El pavimento de la calle = "il selciato" o "l\'asfalto".' },
  ],

  'Emozioni': [
    { it:'la gioia', es:'la alegría', type:'noun', g:'f', art:'la', ex_it:'Sento una grande gioia.', ex_es:'Siento una gran alegría.', lv:'B1', col:'["essere in gioia","salti di gioia"]' },
    { it:'la tristezza', es:'la tristeza', type:'noun', g:'f', art:'la', ex_it:'La tristezza si vede nei suoi occhi.', ex_es:'La tristeza se ve en sus ojos.', lv:'B1' },
    { it:'la rabbia', es:'la rabia / el enfado', type:'noun', g:'f', art:'la', ex_it:'Mi ha fatto venire la rabbia.', ex_es:'Me dio rabia.', lv:'B1', col:'["sfogare la rabbia","fare venire la rabbia"]' },
    { it:'la paura', es:'el miedo', type:'noun', g:'f', art:'la', ex_it:'Ho paura del buio.', ex_es:'Tengo miedo a la oscuridad.', lv:'A2', col:'["avere paura di","fare paura","morire di paura"]' },
    { it:'la sorpresa', es:'la sorpresa', type:'noun', g:'f', art:'la', ex_it:'Che bella sorpresa!', ex_es:'¡Qué bonita sorpresa!', lv:'A2' },
    { it:"l'orgoglio", es:'el orgullo', type:'noun', g:'m', art:"l'", ex_it:'Sono pieno d\'orgoglio per te.', ex_es:'Estoy lleno de orgullo por ti.', lv:'B1', col:'["essere orgoglioso di","con orgoglio"]' },
    { it:'la vergogna', es:'la vergüenza', type:'noun', g:'f', art:'la', ex_it:'Mi vergogno di aver sbagliato.', ex_es:'Me avergüenzo de haber cometido el error.', lv:'B1', col:'["avere vergogna","fare vergogna","senza vergogna"]' },
    { it:"l'ansia", es:'la ansiedad', type:'noun', g:'f', art:"l'", ex_it:'Sento molta ansia prima degli esami.', ex_es:'Siento mucha ansiedad antes de los exámenes.', lv:'B1', col:'["avere ansia","fare ansia"]' },
    { it:'la nostalgia', es:'la nostalgia', type:'noun', g:'f', art:'la', ex_it:'Ho nostalgia del mio paese.', ex_es:'Tengo nostalgia de mi país.', lv:'B1' },
    { it:'la fiducia', es:'la confianza', type:'noun', g:'f', art:'la', ex_it:'Ho molta fiducia in te.', ex_es:'Tengo mucha confianza en ti.', lv:'B2', col:'["avere fiducia in","dare fiducia","perdere la fiducia"]' },
    { it:'entusiasmo', es:'el entusiasmo', type:'noun', g:'m', art:"l'", ex_it:'Studia con molto entusiasmo.', ex_es:'Estudia con mucho entusiasmo.', lv:'B1' },
    { it:'la delusione', es:'la decepción', type:'noun', g:'f', art:'la', ex_it:'Che delusione! Non ho superato l\'esame.', ex_es:'¡Qué decepción! No aprobé el examen.', lv:'B1' },
  ],

  'Aggettivi': [
    { it:'bello', es:'bonito / hermoso / bueno', type:'adjective', ex_it:'È una bella giornata.', ex_es:'Es un hermoso día.', lv:'A1', notes:'Bello si tronca davanti a sostantivi maschili: bel ragazzo, bell\'uomo, bello specchio, bei ragazzi, begli specchi', col:'["bel tempo","bella figura","che bello!"]' },
    { it:'brutto', es:'feo / malo', type:'adjective', ex_it:'Ha avuto una brutta giornata.', ex_es:'Tuvo un mal día.', lv:'A1', col:'["brutto tempo","brutta figura"]' },
    { it:'grande', es:'grande / mayor', type:'adjective', ex_it:'Roma è una grande città.', ex_es:'Roma es una gran ciudad.', lv:'A1', notes:'Gran davanti a consonante: gran caffè, grande amore' },
    { it:'piccolo', es:'pequeño', type:'adjective', ex_it:'Abito in un piccolo appartamento.', ex_es:'Vivo en un pequeño apartamento.', lv:'A1' },
    { it:'nuovo', es:'nuevo', type:'adjective', ex_it:'Ho comprato un nuovo telefono.', ex_es:'Compré un nuevo teléfono.', lv:'A1' },
    { it:'vecchio', es:'viejo', type:'adjective', ex_it:'È un vecchio amico.', ex_es:'Es un viejo amigo.', lv:'A1' },
    { it:'buono', es:'bueno', type:'adjective', ex_it:'Questo risotto è buonissimo!', ex_es:'¡Este risotto está buenísimo!', lv:'A1', notes:'Buon davanti a consonante: buon giorno, buon amico', col:'["di buon umore","buona fortuna!"]' },
    { it:'cattivo', es:'malo / malvado', type:'adjective', ex_it:'Ha un carattere cattivo.', ex_es:'Tiene mal carácter.', lv:'A1' },
    { it:'facile', es:'fácil', type:'adjective', ex_it:'L\'italiano è più facile dello spagnolo.', ex_es:'El italiano es más fácil que el español.', lv:'A1' },
    { it:'difficile', es:'difícil', type:'adjective', ex_it:'Il congiuntivo è difficile.', ex_es:'El subjuntivo es difícil.', lv:'A1' },
    { it:'veloce', es:'rápido', type:'adjective', ex_it:'È un corridore molto veloce.', ex_es:'Es un corredor muy rápido.', lv:'A2' },
    { it:'lento', es:'lento', type:'adjective', ex_it:'Parla lentamente, per favore.', ex_es:'Habla despacio, por favor.', lv:'A2' },
    { it:'forte', es:'fuerte', type:'adjective', ex_it:'È un uomo forte.', ex_es:'Es un hombre fuerte.', lv:'A2', col:'["ad alta voce / forte","essere forte in","di forte carattere"]' },
    { it:'leggero', es:'ligero', type:'adjective', ex_it:'Ho mangiato qualcosa di leggero.', ex_es:'Comí algo ligero.', lv:'B1' },
    { it:'pesante', es:'pesado', type:'adjective', ex_it:'Questa valigia è troppo pesante.', ex_es:'Esta maleta es demasiado pesada.', lv:'B1', col:'["un pranzo pesante","una persona pesante"]' },
    { it:'stanco', es:'cansado', type:'adjective', ex_it:'Sono stanco morto.', ex_es:'Estoy muerto de cansancio.', lv:'A2' },
    { it:'pigro', es:'perezoso', type:'adjective', ex_it:'Non essere pigro, studia!', ex_es:'No seas perezoso, ¡estudia!', lv:'A2' },
    { it:'gentile', es:'amable / gentil', type:'adjective', ex_it:'Sei molto gentile.', ex_es:'Eres muy amable.', lv:'A2' },
    { it:'simpatico', es:'simpático', type:'adjective', ex_it:'È una ragazza molto simpatica.', ex_es:'Es una chica muy simpática.', lv:'A2' },
    { it:'tranquillo', es:'tranquilo', type:'adjective', ex_it:'Stai tranquillo, non è niente.', ex_es:'Estate tranquilo, no es nada.', lv:'A2' },
  ],
};

// Insert all vocabulary items
const now = Math.floor(Date.now() / 1000);
Object.entries(words).forEach(([catName, items]) => {
  const catId = getCatId(catName);
  if (!catId) return;
  items.forEach(w => {
    insertWord.run(
      w.it, w.es, catId, w.type || 'noun',
      w.g || null, w.art || null, w.pl || null,
      w.ex_it || null, w.ex_es || null,
      w.lv || 'B1', w.notes || null, w.false_f || null,
      w.col || '[]'
    );
  });
});

// Create flashcards for all vocabulary items
const allWords = db.prepare(`SELECT id, italian, spanish, category_id FROM vocabulary_items`).all();
const insertFC = db.prepare(`
  INSERT OR IGNORE INTO flashcards(vocabulary_id, front, back, direction, category_id, next_review)
  VALUES(?,?,?,?,?,?)
`);

allWords.forEach(w => {
  insertFC.run(w.id, w.italian, w.spanish, 'it-es', w.category_id, now);
});

// ── Initial milestones ──────────────────────────────────────────────────────
const milestones = [
  { id:'first_session', title:'Primera sesión', description:'Completaste tu primera sesión de estudio.', category:'consistency' },
  { id:'streak_7', title:'Una semana seguida', description:'Estudiaste 7 días consecutivos.', category:'consistency' },
  { id:'streak_30', title:'Un mes sin parar', description:'Estudiaste 30 días consecutivos.', category:'consistency' },
  { id:'words_50', title:'50 palabras', description:'Aprendiste 50 palabras en italiano.', category:'vocabulary' },
  { id:'words_200', title:'200 palabras', description:'Aprendiste 200 palabras en italiano.', category:'vocabulary' },
  { id:'words_500', title:'500 palabras', description:'Aprendiste 500 palabras en italiano.', category:'vocabulary' },
  { id:'conjugation_10', title:'Conjugaciones básicas', description:'Practicaste conjugaciones 10 veces.', category:'grammar' },
  { id:'error_corrected', title:'Error corregido', description:'Corregiste un error recurrente.', category:'accuracy' },
  { id:'writing_first', title:'Primera redacción', description:'Escribiste tu primer texto en italiano.', category:'writing' },
  { id:'accuracy_80', title:'80% de precisión', description:'Alcanzaste un 80% de precisión en flashcards.', category:'accuracy' },
];
const insertM = db.prepare(`INSERT OR IGNORE INTO milestones(id,title,description,category) VALUES(?,?,?,?)`);
milestones.forEach(m => insertM.run(m.id, m.title, m.description, m.category));

// ── Sample writing prompts ──────────────────────────────────────────────────
const prompts = [
  { prompt: 'Descríbete: ¿quién eres, de dónde eres y qué haces en tu vida cotidiana? Escribe al menos 80 palabras.', type: 'description' },
  { prompt: 'Escribe sobre tus planes para el próximo verano usando el futuro simple.', type: 'guided' },
  { prompt: 'Narra la última vez que viajaste: ¿adónde fuiste, con quién, qué hiciste?', type: 'narrative' },
  { prompt: 'Da tu opinión sobre el aprendizaje de idiomas: ¿por qué es importante?', type: 'opinion' },
  { prompt: 'Escribe un correo formal a un hotel para hacer una reserva para dos noches.', type: 'formal' },
];
const insertPrompt = db.prepare(`INSERT OR IGNORE INTO writing_exercises(prompt,type) VALUES(?,?)`);
prompts.forEach(p => insertPrompt.run(p.prompt, p.type));


console.log('✅ Base de datos inicializada con datos de ejemplo.');
console.log(`   Categorías: ${db.prepare('SELECT COUNT(*) as n FROM vocabulary_categories').get().n}`);
console.log(`   Palabras: ${db.prepare('SELECT COUNT(*) as n FROM vocabulary_items').get().n}`);
console.log(`   Flashcards: ${db.prepare('SELECT COUNT(*) as n FROM flashcards').get().n}`);
