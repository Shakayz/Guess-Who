#!/usr/bin/env node
/**
 * Generates packages/shared/src/offlineWords.ts
 *
 * Strategy:
 *  - 25 items per category per locale.
 *  - All C(25, 2) = 300 unordered pairs are emitted -> exactly 300 pairs
 *    per (category, locale). No randomness, fully deterministic.
 *  - "Invariant" categories (mangas, celebrities, movies, music, history)
 *    use proper nouns that are kept identical across all locales
 *    (e.g. Naruto/Minato is Naruto/Minato in every language).
 *  - "Translatable" categories (food, animals, places, jobs, sports, variety)
 *    have one array of 25 items per locale, index-aligned so that
 *    EN[i] <-> FR[i] <-> ... describe the same concept.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../packages/shared/src/offlineWords.ts')

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh']

// ---------------------------------------------------------------------------
// Invariant pools (proper nouns, same in every locale).
// ---------------------------------------------------------------------------

const MANGAS = [
  'Naruto', 'Sasuke', 'Sakura', 'Minato', 'Kakashi',
  'Itachi', 'Goku', 'Vegeta', 'Piccolo', 'Frieza',
  'Luffy', 'Zoro', 'Sanji', 'Nami', 'Ace',
  'Ichigo', 'Rukia', 'Light', 'L', 'Eren',
  'Mikasa', 'Levi', 'Tanjiro', 'Nezuko', 'Saitama',
]

const CELEBRITIES = [
  'Messi', 'Ronaldo', 'Neymar', 'Mbappé', 'Zidane',
  'Pelé', 'Maradona', 'Ronaldinho', 'Beckham', 'LeBron',
  'Jordan', 'Kobe', 'Federer', 'Nadal', 'Djokovic',
  'Serena', 'Bolt', 'Phelps', 'Ali', 'Tyson',
  'Hamilton', 'Senna', 'Schumacher', 'Woods', 'Brady',
]

const MOVIES = [
  'Titanic', 'Avatar', 'Inception', 'Matrix', 'Gladiator',
  'Joker', 'Frozen', 'Shrek', 'Coco', 'Up',
  'Jaws', 'Alien', 'Rocky', 'Terminator', 'Avengers',
  'Batman', 'Superman', 'Spiderman', 'Goodfellas', 'Scarface',
  'Braveheart', 'Twilight', 'Interstellar', 'Dune', 'Oppenheimer',
]

const MUSIC = [
  'Mozart', 'Beethoven', 'Bach', 'Chopin', 'Vivaldi',
  'Elvis', 'Beatles', 'Madonna', 'Queen', 'ABBA',
  'Eminem', 'Rihanna', 'Beyoncé', 'Adele', 'Drake',
  'Shakira', 'Bowie', 'Dylan', 'Hendrix', 'Sinatra',
  'Nirvana', 'Coldplay', 'Metallica', 'BTS', 'Gaga',
]

const HISTORY = [
  'Napoleon', 'Caesar', 'Cleopatra', 'Einstein', 'Newton',
  'Darwin', 'Gandhi', 'Lincoln', 'Mandela', 'Churchill',
  'Edison', 'Tesla', 'Curie', 'Galileo', 'Columbus',
  'Magellan', 'Da Vinci', 'Shakespeare', 'Aristotle', 'Plato',
  'Socrates', 'Confucius', 'Genghis', 'Alexander', 'Charlemagne',
]

// ---------------------------------------------------------------------------
// Translatable pools.
// Each category is an object { locale: [25 items] } with index-aligned rows.
// Row i of every locale refers to the SAME concept translated.
// ---------------------------------------------------------------------------

const FOOD = {
  en: ['Pizza','Sushi','Burger','Pasta','Salad','Soup','Steak','Taco','Pancake','Croissant','Ramen','Chocolate','Coffee','Donut','Muffin','Cheese','Bread','Rice','Curry','Omelette','Popcorn','Pie','Cake','Cookie','Sandwich'],
  fr: ['Pizza','Sushi','Burger','Pâtes','Salade','Soupe','Steak','Taco','Crêpe','Croissant','Ramen','Chocolat','Café','Beignet','Muffin','Fromage','Pain','Riz','Curry','Omelette','Popcorn','Tarte','Gâteau','Biscuit','Sandwich'],
  es: ['Pizza','Sushi','Hamburguesa','Pasta','Ensalada','Sopa','Bistec','Taco','Panqueque','Cruasán','Ramen','Chocolate','Café','Dona','Magdalena','Queso','Pan','Arroz','Curri','Tortilla','Palomitas','Pastel','Tarta','Galleta','Sándwich'],
  de: ['Pizza','Sushi','Burger','Nudeln','Salat','Suppe','Steak','Taco','Pfannkuchen','Croissant','Ramen','Schokolade','Kaffee','Donut','Muffin','Käse','Brot','Reis','Curry','Omelett','Popcorn','Kuchen','Torte','Keks','Sandwich'],
  ar: ['بيتزا','سوشي','برغر','مكرونة','سلطة','شوربة','ستيك','تاكو','فطيرة محلاة','كرواسون','رامن','شوكولاتة','قهوة','دوناتس','مافن','جبن','خبز','أرز','كاري','عجة','فشار','فطيرة','كعكة','بسكويت','شطيرة'],
  it: ['Pizza','Sushi','Hamburger','Pasta','Insalata','Zuppa','Bistecca','Taco','Frittella','Cornetto','Ramen','Cioccolato','Caffè','Ciambella','Muffin','Formaggio','Pane','Riso','Curry','Frittata','Popcorn','Torta','Dolce','Biscotto','Panino'],
  pt: ['Pizza','Sushi','Hambúrguer','Macarrão','Salada','Sopa','Bife','Taco','Panqueca','Croissant','Lámen','Chocolate','Café','Rosquinha','Muffin','Queijo','Pão','Arroz','Curry','Omelete','Pipoca','Torta','Bolo','Biscoito','Sanduíche'],
  zh: ['披萨','寿司','汉堡','意大利面','沙拉','汤','牛排','塔可','煎饼','牛角包','拉面','巧克力','咖啡','甜甜圈','麦芬','奶酪','面包','米饭','咖喱','煎蛋卷','爆米花','派','蛋糕','饼干','三明治'],
}

const ANIMALS = {
  en: ['Lion','Tiger','Dolphin','Eagle','Wolf','Elephant','Crocodile','Penguin','Gorilla','Snake','Parrot','Cheetah','Seal','Rabbit','Monkey','Turtle','Frog','Bee','Llama','Crow','Shark','Fox','Octopus','Otter','Horse'],
  fr: ['Lion','Tigre','Dauphin','Aigle','Loup','Éléphant','Crocodile','Manchot','Gorille','Serpent','Perroquet','Guépard','Phoque','Lapin','Singe','Tortue','Grenouille','Abeille','Lama','Corbeau','Requin','Renard','Poulpe','Loutre','Cheval'],
  es: ['León','Tigre','Delfín','Águila','Lobo','Elefante','Cocodrilo','Pingüino','Gorila','Serpiente','Loro','Guepardo','Foca','Conejo','Mono','Tortuga','Rana','Abeja','Llama','Cuervo','Tiburón','Zorro','Pulpo','Nutria','Caballo'],
  de: ['Löwe','Tiger','Delfin','Adler','Wolf','Elefant','Krokodil','Pinguin','Gorilla','Schlange','Papagei','Gepard','Robbe','Kaninchen','Affe','Schildkröte','Frosch','Biene','Lama','Krähe','Hai','Fuchs','Tintenfisch','Otter','Pferd'],
  ar: ['أسد','نمر','دلفين','نسر','ذئب','فيل','تمساح','بطريق','غوريلا','ثعبان','ببغاء','فهد','فقمة','أرنب','قرد','سلحفاة','ضفدع','نحلة','لاما','غراب','قرش','ثعلب','أخطبوط','ثعلب الماء','حصان'],
  it: ['Leone','Tigre','Delfino','Aquila','Lupo','Elefante','Coccodrillo','Pinguino','Gorilla','Serpente','Pappagallo','Ghepardo','Foca','Coniglio','Scimmia','Tartaruga','Rana','Ape','Lama','Corvo','Squalo','Volpe','Polpo','Lontra','Cavallo'],
  pt: ['Leão','Tigre','Golfinho','Águia','Lobo','Elefante','Crocodilo','Pinguim','Gorila','Cobra','Papagaio','Guepardo','Foca','Coelho','Macaco','Tartaruga','Sapo','Abelha','Lhama','Corvo','Tubarão','Raposa','Polvo','Lontra','Cavalo'],
  zh: ['狮子','老虎','海豚','老鹰','狼','大象','鳄鱼','企鹅','大猩猩','蛇','鹦鹉','猎豹','海豹','兔子','猴子','乌龟','青蛙','蜜蜂','羊驼','乌鸦','鲨鱼','狐狸','章鱼','水獭','马'],
}

const PLACES = {
  en: ['Beach','Mountain','Forest','Desert','River','Lake','Island','Cave','Volcano','Castle','Museum','Library','Stadium','Airport','Hospital','School','Park','Market','Bridge','Harbor','Village','Garden','Temple','Tower','Square'],
  fr: ['Plage','Montagne','Forêt','Désert','Rivière','Lac','Île','Grotte','Volcan','Château','Musée','Bibliothèque','Stade','Aéroport','Hôpital','École','Parc','Marché','Pont','Port','Village','Jardin','Temple','Tour','Place'],
  es: ['Playa','Montaña','Bosque','Desierto','Río','Lago','Isla','Cueva','Volcán','Castillo','Museo','Biblioteca','Estadio','Aeropuerto','Hospital','Escuela','Parque','Mercado','Puente','Puerto','Pueblo','Jardín','Templo','Torre','Plaza'],
  de: ['Strand','Berg','Wald','Wüste','Fluss','See','Insel','Höhle','Vulkan','Schloss','Museum','Bibliothek','Stadion','Flughafen','Krankenhaus','Schule','Park','Markt','Brücke','Hafen','Dorf','Garten','Tempel','Turm','Platz'],
  ar: ['شاطئ','جبل','غابة','صحراء','نهر','بحيرة','جزيرة','كهف','بركان','قلعة','متحف','مكتبة','ملعب','مطار','مستشفى','مدرسة','حديقة','سوق','جسر','ميناء','قرية','بستان','معبد','برج','ساحة'],
  it: ['Spiaggia','Montagna','Foresta','Deserto','Fiume','Lago','Isola','Grotta','Vulcano','Castello','Museo','Biblioteca','Stadio','Aeroporto','Ospedale','Scuola','Parco','Mercato','Ponte','Porto','Villaggio','Giardino','Tempio','Torre','Piazza'],
  pt: ['Praia','Montanha','Floresta','Deserto','Rio','Lago','Ilha','Caverna','Vulcão','Castelo','Museu','Biblioteca','Estádio','Aeroporto','Hospital','Escola','Parque','Mercado','Ponte','Porto','Vila','Jardim','Templo','Torre','Praça'],
  zh: ['海滩','山','森林','沙漠','河','湖','岛','洞穴','火山','城堡','博物馆','图书馆','体育场','机场','医院','学校','公园','市场','桥','港口','村庄','花园','寺庙','塔','广场'],
}

const JOBS = {
  en: ['Doctor','Teacher','Engineer','Lawyer','Chef','Pilot','Nurse','Farmer','Police','Firefighter','Artist','Musician','Writer','Actor','Dentist','Architect','Plumber','Electrician','Carpenter','Mechanic','Baker','Barber','Photographer','Journalist','Scientist'],
  fr: ['Médecin','Professeur','Ingénieur','Avocat','Cuisinier','Pilote','Infirmier','Agriculteur','Policier','Pompier','Artiste','Musicien','Écrivain','Acteur','Dentiste','Architecte','Plombier','Électricien','Charpentier','Mécanicien','Boulanger','Coiffeur','Photographe','Journaliste','Scientifique'],
  es: ['Médico','Profesor','Ingeniero','Abogado','Chef','Piloto','Enfermero','Granjero','Policía','Bombero','Artista','Músico','Escritor','Actor','Dentista','Arquitecto','Fontanero','Electricista','Carpintero','Mecánico','Panadero','Barbero','Fotógrafo','Periodista','Científico'],
  de: ['Arzt','Lehrer','Ingenieur','Anwalt','Koch','Pilot','Krankenschwester','Bauer','Polizist','Feuerwehrmann','Künstler','Musiker','Schriftsteller','Schauspieler','Zahnarzt','Architekt','Klempner','Elektriker','Tischler','Mechaniker','Bäcker','Friseur','Fotograf','Journalist','Wissenschaftler'],
  ar: ['طبيب','معلم','مهندس','محامي','طاهي','طيار','ممرض','مزارع','شرطي','رجل إطفاء','فنان','موسيقي','كاتب','ممثل','طبيب أسنان','مهندس معماري','سباك','كهربائي','نجار','ميكانيكي','خباز','حلاق','مصور','صحفي','عالم'],
  it: ['Medico','Insegnante','Ingegnere','Avvocato','Cuoco','Pilota','Infermiere','Contadino','Poliziotto','Pompiere','Artista','Musicista','Scrittore','Attore','Dentista','Architetto','Idraulico','Elettricista','Falegname','Meccanico','Fornaio','Barbiere','Fotografo','Giornalista','Scienziato'],
  pt: ['Médico','Professor','Engenheiro','Advogado','Chef','Piloto','Enfermeiro','Fazendeiro','Policial','Bombeiro','Artista','Músico','Escritor','Ator','Dentista','Arquiteto','Encanador','Eletricista','Carpinteiro','Mecânico','Padeiro','Barbeiro','Fotógrafo','Jornalista','Cientista'],
  zh: ['医生','老师','工程师','律师','厨师','飞行员','护士','农民','警察','消防员','艺术家','音乐家','作家','演员','牙医','建筑师','水管工','电工','木匠','机械师','面包师','理发师','摄影师','记者','科学家'],
}

const SPORTS = {
  en: ['Soccer','Basketball','Tennis','Baseball','Golf','Boxing','Swimming','Cycling','Skiing','Surfing','Volleyball','Hockey','Rugby','Cricket','Karate','Judo','Fencing','Archery','Climbing','Sailing','Rowing','Diving','Gymnastics','Wrestling','Skating'],
  fr: ['Football','Basketball','Tennis','Baseball','Golf','Boxe','Natation','Cyclisme','Ski','Surf','Volleyball','Hockey','Rugby','Cricket','Karaté','Judo','Escrime','Tir à l\'arc','Escalade','Voile','Aviron','Plongée','Gymnastique','Lutte','Patinage'],
  es: ['Fútbol','Baloncesto','Tenis','Béisbol','Golf','Boxeo','Natación','Ciclismo','Esquí','Surf','Voleibol','Hockey','Rugby','Críquet','Kárate','Judo','Esgrima','Tiro con arco','Escalada','Vela','Remo','Buceo','Gimnasia','Lucha','Patinaje'],
  de: ['Fußball','Basketball','Tennis','Baseball','Golf','Boxen','Schwimmen','Radfahren','Skifahren','Surfen','Volleyball','Hockey','Rugby','Cricket','Karate','Judo','Fechten','Bogenschießen','Klettern','Segeln','Rudern','Tauchen','Turnen','Ringen','Eislaufen'],
  ar: ['كرة القدم','كرة السلة','تنس','بيسبول','غولف','ملاكمة','سباحة','ركوب الدراجات','تزلج','ركوب الأمواج','كرة الطائرة','هوكي','رغبي','كريكيت','كاراتيه','جودو','مبارزة','رماية','تسلق','إبحار','تجديف','غوص','جمباز','مصارعة','تزحلق'],
  it: ['Calcio','Pallacanestro','Tennis','Baseball','Golf','Pugilato','Nuoto','Ciclismo','Sci','Surf','Pallavolo','Hockey','Rugby','Cricket','Karate','Judo','Scherma','Tiro con l\'arco','Arrampicata','Vela','Canottaggio','Tuffi','Ginnastica','Lotta','Pattinaggio'],
  pt: ['Futebol','Basquete','Tênis','Beisebol','Golfe','Boxe','Natação','Ciclismo','Esqui','Surfe','Vôlei','Hóquei','Rúgbi','Críquete','Karatê','Judô','Esgrima','Arco e flecha','Escalada','Vela','Remo','Mergulho','Ginástica','Luta','Patinação'],
  zh: ['足球','篮球','网球','棒球','高尔夫','拳击','游泳','骑行','滑雪','冲浪','排球','曲棍球','橄榄球','板球','空手道','柔道','击剑','射箭','攀岩','帆船','赛艇','跳水','体操','摔跤','滑冰'],
}

const VARIETY = {
  en: ['Mirror','Clock','Lamp','Chair','Table','Book','Pen','Phone','Computer','Camera','Umbrella','Key','Bag','Hat','Shoe','Watch','Ring','Glasses','Wallet','Bottle','Cup','Plate','Knife','Pillow','Towel'],
  fr: ['Miroir','Horloge','Lampe','Chaise','Table','Livre','Stylo','Téléphone','Ordinateur','Appareil photo','Parapluie','Clé','Sac','Chapeau','Chaussure','Montre','Bague','Lunettes','Portefeuille','Bouteille','Tasse','Assiette','Couteau','Oreiller','Serviette'],
  es: ['Espejo','Reloj de pared','Lámpara','Silla','Mesa','Libro','Bolígrafo','Teléfono','Computadora','Cámara','Paraguas','Llave','Bolso','Sombrero','Zapato','Reloj','Anillo','Gafas','Cartera','Botella','Taza','Plato','Cuchillo','Almohada','Toalla'],
  de: ['Spiegel','Uhr','Lampe','Stuhl','Tisch','Buch','Stift','Telefon','Computer','Kamera','Regenschirm','Schlüssel','Tasche','Hut','Schuh','Armbanduhr','Ring','Brille','Geldbörse','Flasche','Tasse','Teller','Messer','Kissen','Handtuch'],
  ar: ['مرآة','ساعة','مصباح','كرسي','طاولة','كتاب','قلم','هاتف','حاسوب','كاميرا','مظلة','مفتاح','حقيبة','قبعة','حذاء','ساعة يد','خاتم','نظارة','محفظة','زجاجة','كوب','طبق','سكين','وسادة','منشفة'],
  it: ['Specchio','Orologio','Lampada','Sedia','Tavolo','Libro','Penna','Telefono','Computer','Macchina fotografica','Ombrello','Chiave','Borsa','Cappello','Scarpa','Orologio da polso','Anello','Occhiali','Portafoglio','Bottiglia','Tazza','Piatto','Coltello','Cuscino','Asciugamano'],
  pt: ['Espelho','Relógio','Luminária','Cadeira','Mesa','Livro','Caneta','Telefone','Computador','Câmera','Guarda-chuva','Chave','Bolsa','Chapéu','Sapato','Relógio de pulso','Anel','Óculos','Carteira','Garrafa','Copo','Prato','Faca','Travesseiro','Toalha'],
  zh: ['镜子','钟','灯','椅子','桌子','书','笔','手机','电脑','相机','雨伞','钥匙','包','帽子','鞋','手表','戒指','眼镜','钱包','瓶子','杯子','盘子','刀','枕头','毛巾'],
}

const TRANSLATABLE = {
  food: FOOD,
  animals: ANIMALS,
  places: PLACES,
  jobs: JOBS,
  sports: SPORTS,
  variety: VARIETY,
}

const INVARIANT = {
  music: MUSIC,
  movies: MOVIES,
  history: HISTORY,
  mangas: MANGAS,
  celebrities: CELEBRITIES,
}

const CATEGORY_ORDER = [
  'food','animals','music','places','jobs',
  'sports','movies','history','mangas','celebrities','variety',
]

// ---------------------------------------------------------------------------
// Pair generation: all C(n,2) unordered pairs, in stable index order.
// With n = 25 that produces exactly 300 pairs.
// ---------------------------------------------------------------------------

function allPairs(items) {
  const out = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]])
    }
  }
  return out
}

function pairsForLocaleCategory(category, locale) {
  if (INVARIANT[category]) return allPairs(INVARIANT[category])
  const t = TRANSLATABLE[category]
  const items = t[locale] ?? t.en
  if (items.length !== 25) {
    throw new Error(`[${category}/${locale}] expected 25 items, got ${items.length}`)
  }
  return allPairs(items)
}

// ---------------------------------------------------------------------------
// Render TS.
// ---------------------------------------------------------------------------

function renderPair([a, b]) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `    { villagerWord: '${esc(a)}', imposterWord: '${esc(b)}' },`
}

function renderRecord(locale) {
  const lines = []
  lines.push(`{`)
  for (const cat of CATEGORY_ORDER) {
    const pairs = pairsForLocaleCategory(cat, locale)
    lines.push(`  ${cat}: [`)
    for (const p of pairs) lines.push(renderPair(p))
    lines.push(`  ],`)
  }
  lines.push(`}`)
  return lines.join('\n')
}

const HEADER = `import type { WordCategory } from './types'

/**
 * Word pairs for offline / pass-and-play mode.
 * Each pair has a villagerWord and an imposterWord -- similar but distinct.
 *
 * Generated by scripts/generate-offline-words.mjs
 * 25 items per category -> C(25, 2) = 300 pairs per (category, locale).
 */
export interface OfflineWordPair {
  villagerWord: string
  imposterWord: string
}
`

const FOOTER = `
export const OFFLINE_WORD_PAIRS_BY_LOCALE: Record<string, Record<WordCategory, OfflineWordPair[]>> = {
  en: OFFLINE_WORD_PAIRS,
  fr: FR_PAIRS,
  es: ES_PAIRS,
  de: DE_PAIRS,
  ar: AR_PAIRS,
  it: IT_PAIRS,
  pt: PT_PAIRS,
  zh: ZH_PAIRS,
}

/**
 * Pick a random word pair from the given categories and locale.
 * Falls back to English if locale data is not available.
 */
export function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
  locale?: string,
): OfflineWordPair {
  const localeKey = locale?.substring(0, 2) ?? 'en'
  const pairsMap = OFFLINE_WORD_PAIRS_BY_LOCALE[localeKey] ?? OFFLINE_WORD_PAIRS
  const keys =
    categories.length > 0
      ? categories
      : (Object.keys(pairsMap) as WordCategory[])
  const shuffledKeys = shuffleFn(keys)
  const category = shuffledKeys[0]
  const pairs = pairsMap[category]
  const shuffledPairs = shuffleFn(pairs)
  return shuffledPairs[0]
}
`

function main() {
  const chunks = [HEADER]
  const LOCALE_CONST = {
    en: 'OFFLINE_WORD_PAIRS',
    fr: 'FR_PAIRS',
    es: 'ES_PAIRS',
    de: 'DE_PAIRS',
    ar: 'AR_PAIRS',
    it: 'IT_PAIRS',
    pt: 'PT_PAIRS',
    zh: 'ZH_PAIRS',
  }
  for (const locale of LOCALES) {
    const name = LOCALE_CONST[locale]
    const keyword = locale === 'en' ? 'export const' : 'const'
    chunks.push(
      `\n${keyword} ${name}: Record<WordCategory, OfflineWordPair[]> = ${renderRecord(locale)}\n`,
    )
  }
  chunks.push(FOOTER)
  writeFileSync(OUT, chunks.join(''), 'utf8')
  // sanity
  for (const locale of LOCALES) {
    for (const cat of CATEGORY_ORDER) {
      const n = pairsForLocaleCategory(cat, locale).length
      if (n !== 300) throw new Error(`${locale}/${cat} = ${n}`)
    }
  }
  console.log(`Wrote ${OUT}`)
  console.log(`${LOCALES.length} locales x ${CATEGORY_ORDER.length} categories x 300 pairs = ${LOCALES.length * CATEGORY_ORDER.length * 300} total`)
}

main()
