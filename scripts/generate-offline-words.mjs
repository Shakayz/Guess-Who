#!/usr/bin/env node
/**
 * Generates packages/shared/src/offlineWords/ from rich, diverse 40-item pools.
 *
 * Each (category, locale) pool has 40 items mixing sub-types (dishes,
 * ingredients, spices, drinks, methods for food; characters, techniques,
 * places, transformations, power systems for mangas; etc.) so that pairs
 * stay semantically meaningful within the category — an imposter can blend
 * in because every pair shares the category umbrella.
 *
 * Emits all C(40,2) = 780 unordered pairs per (locale, category).
 *
 * Output layout (per-locale split for bundle code-splitting):
 *   packages/shared/src/offlineWords/index.ts  — async loader + picker API
 *   packages/shared/src/offlineWords/en.ts     — English data (eager)
 *   packages/shared/src/offlineWords/fr.ts     — French data (lazy)
 *   ... (one file per locale, ~600 KB each, dynamically imported)
 *
 * Total: 10 locales x 12 categories x 780 pairs = 93,600 pairs.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../packages/shared/src/offlineWords')
mkdirSync(OUT_DIR, { recursive: true })

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh', 'ru', 'hi']
const POOL_SIZE = 40

const CATEGORY_ORDER = [
  'food', 'animals', 'music', 'places', 'jobs',
  'sports', 'movies', 'tech', 'history', 'mangas', 'celebrities', 'variety',
]

// ============================================================================
// INVARIANT POOLS — proper nouns / globally-recognized terms.
// Same 30-item array used for every locale.
// ============================================================================

// MANGAS: characters (16) + techniques (7) + places (6) + transformations (6)
// + power systems (5) = 40. Mixing sub-types means pairs like Naruto/Rasengan
// or Goku/Super Saiyan share a series, while Chakra/Nen share "power system".
const MANGAS = [
  'Naruto', 'Sasuke', 'Goku', 'Vegeta', 'Luffy', 'Zoro',
  'Ichigo', 'Tanjiro', 'Eren', 'Saitama', 'Hisoka', 'Levi',
  'Killua', 'Light', 'Bakugo', 'Asta',
  'Rasengan', 'Chidori', 'Kamehameha', 'Gum-Gum', 'Shadow Clone',
  'Domain Expansion', 'Hollow Purple',
  'Konoha', 'Wano', 'Soul Society', 'Marineford',
  'Hueco Mundo', 'Hidden Sand',
  'Super Saiyan', 'Bankai', 'Sage Mode', 'Gear Five',
  'Awakening', 'True Form',
  'Chakra', 'Ki', 'Haki', 'Nen', 'Curse Energy',
]

// CELEBRITIES: actors (10) + athletes (10) + musicians (11) + influencers (9) = 40.
const CELEBRITIES = [
  'Brad Pitt', 'Leonardo DiCaprio', 'Tom Cruise', 'Will Smith',
  'Robert Downey Jr', 'Scarlett Johansson', 'Margot Robbie', 'Emma Watson',
  'Tom Hanks', 'Denzel Washington',
  'Messi', 'Ronaldo', 'LeBron James', 'Michael Jordan',
  'Serena Williams', 'Federer', 'Tom Brady', 'Tiger Woods',
  'Naomi Osaka', 'Mbappé',
  'Beyoncé', 'Rihanna', 'Drake', 'Kanye West',
  'Taylor Swift', 'Adele', 'Ed Sheeran', 'Elvis',
  'Bruno Mars', 'Billie Eilish', 'The Weeknd',
  'MrBeast', 'PewDiePie', 'Kim Kardashian', 'Kylie Jenner',
  'Elon Musk', 'Logan Paul',
  'Dwayne Johnson', 'Mark Zuckerberg', 'Bill Gates',
]

// MOVIES: titles (11) + directors (7) + characters (6) + genres (8) + franchises (8) = 40.
const MOVIES = [
  'Titanic', 'Inception', 'Avatar', 'Gladiator',
  'Shrek', 'Frozen', 'Interstellar', 'Joker',
  'Parasite', 'Oppenheimer', 'Dune',
  'Spielberg', 'Tarantino', 'Nolan', 'Scorsese', 'Hitchcock',
  'Cameron', 'Kubrick',
  'Batman', 'Yoda', 'Indiana Jones', 'Forrest Gump',
  'Vader', 'Hermione',
  'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance',
  'Mystery',
  'Marvel', 'Star Wars', 'Harry Potter', 'James Bond', 'Disney', 'Pixar',
  'Lord of the Rings', 'Fast and Furious',
]

// MUSIC: artists (10) + genres (10) + instruments (10) + concepts (10) = 40.
const MUSIC = [
  'Mozart', 'Beethoven', 'Beatles', 'Madonna',
  'Eminem', 'Beyoncé', 'Drake', 'Adele',
  'Bowie', 'Queen',
  'Rock', 'Pop', 'Jazz', 'Blues', 'Reggae', 'Hip Hop', 'Classical', 'Country',
  'Metal', 'Folk',
  'Piano', 'Guitar', 'Violin', 'Drums', 'Trumpet', 'Saxophone', 'Flute',
  'Bass', 'Cello', 'Harp',
  'Chorus', 'Bridge', 'Riff', 'Melody', 'Harmony', 'Rhythm', 'Tempo',
  'Verse', 'Chord', 'Scale',
]

// HISTORY: figures (12) + events (7) + eras (6) + empires (7) + treaties (8) = 40.
const HISTORY = [
  'Napoleon', 'Caesar', 'Cleopatra', 'Einstein',
  'Newton', 'Gandhi', 'Lincoln', 'Churchill',
  'Mandela', 'Da Vinci', 'Genghis Khan', 'Tesla',
  'World War 1', 'World War 2', 'French Revolution', 'Cold War', 'Industrial Revolution',
  'Moon Landing', 'Berlin Wall',
  'Renaissance', 'Middle Ages', 'Bronze Age', 'Enlightenment', 'Antiquity',
  'Stone Age',
  'Roman Empire', 'British Empire', 'Ottoman Empire',
  'Mongol Empire', 'Persian Empire', 'Egyptian Empire',
  'Aztec Empire',
  'Versailles Treaty', 'Magna Carta', 'Geneva Convention',
  'Yalta Conference', 'NATO', 'UN',
  'NAFTA', 'Treaty of Paris',
]

// TECH: hardware (7) + software (8) + languages (7) + protocols (6) + concepts (12) = 40.
const TECH = [
  'CPU', 'RAM', 'SSD', 'Router', 'Keyboard',
  'GPU', 'Monitor',
  'Linux', 'Windows', 'iOS', 'Chrome', 'Photoshop',
  'Office', 'Slack', 'Spotify',
  'Python', 'Java', 'JavaScript', 'C++', 'Rust',
  'TypeScript', 'Go',
  'HTTP', 'TCP', 'SSL', 'DNS', 'Bluetooth',
  'FTP',
  'Algorithm', 'Encryption', 'Database', 'Cloud', 'AI',
  'Blockchain', 'Firewall', 'Cache', 'Compiler', 'API',
  'Server', 'VPN',
]

// ============================================================================
// TRANSLATABLE POOLS — one 40-item array per locale.
// FOOD: dishes (13) + ingredients (7) + spices (7) + drinks (7) + methods (6)
// ============================================================================

const FOOD = {
  en: [
    'Pizza', 'Sushi', 'Burger', 'Pasta', 'Salad', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagna',
    'Pancake', 'Donut', 'Cheesecake',
    'Cheese', 'Tomato', 'Onion', 'Garlic', 'Mushroom',
    'Butter', 'Egg',
    'Cinnamon', 'Paprika', 'Pepper', 'Cumin', 'Vanilla',
    'Ginger', 'Saffron',
    'Coffee', 'Tea', 'Wine', 'Beer', 'Smoothie',
    'Milk', 'Juice',
    'Grilling', 'Frying', 'Baking', 'Roasting', 'Boiling',
    'Steaming',
  ],
  fr: [
    'Pizza', 'Sushi', 'Burger', 'Pâtes', 'Salade', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagne',
    'Crêpe', 'Donut', 'Cheesecake',
    'Fromage', 'Tomate', 'Oignon', 'Ail', 'Champignon',
    'Beurre', 'Œuf',
    'Cannelle', 'Paprika', 'Poivre', 'Cumin', 'Vanille',
    'Gingembre', 'Safran',
    'Café', 'Thé', 'Vin', 'Bière', 'Smoothie',
    'Lait', 'Jus',
    'Grillade', 'Friture', 'Cuisson', 'Rôtissage', 'Ébullition',
    'Vapeur',
  ],
  es: [
    'Pizza', 'Sushi', 'Hamburguesa', 'Pasta', 'Ensalada', 'Bistec', 'Taco', 'Ramen', 'Curri', 'Lasaña',
    'Panqueque', 'Dona', 'Tarta de queso',
    'Queso', 'Tomate', 'Cebolla', 'Ajo', 'Champiñón',
    'Mantequilla', 'Huevo',
    'Canela', 'Pimentón', 'Pimienta', 'Comino', 'Vainilla',
    'Jengibre', 'Azafrán',
    'Café', 'Té', 'Vino', 'Cerveza', 'Batido',
    'Leche', 'Jugo',
    'Asado', 'Frito', 'Horneado', 'Tostado', 'Hervido',
    'Vapor',
  ],
  de: [
    'Pizza', 'Sushi', 'Burger', 'Nudeln', 'Salat', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagne',
    'Pfannkuchen', 'Donut', 'Käsekuchen',
    'Käse', 'Tomate', 'Zwiebel', 'Knoblauch', 'Pilz',
    'Butter', 'Ei',
    'Zimt', 'Paprika', 'Pfeffer', 'Kreuzkümmel', 'Vanille',
    'Ingwer', 'Safran',
    'Kaffee', 'Tee', 'Wein', 'Bier', 'Smoothie',
    'Milch', 'Saft',
    'Grillen', 'Braten', 'Backen', 'Rösten', 'Kochen',
    'Dämpfen',
  ],
  ar: [
    'بيتزا', 'سوشي', 'برغر', 'مكرونة', 'سلطة', 'ستيك', 'تاكو', 'رامن', 'كاري', 'لازانيا',
    'فطيرة', 'دونات', 'كعكة الجبن',
    'جبن', 'طماطم', 'بصل', 'ثوم', 'فطر',
    'زبدة', 'بيض',
    'قرفة', 'بابريكا', 'فلفل', 'كمون', 'فانيلا',
    'زنجبيل', 'زعفران',
    'قهوة', 'شاي', 'نبيذ', 'جعة', 'عصير',
    'حليب', 'عصير فواكه',
    'شواء', 'قلي', 'خبز', 'تحميص', 'سلق',
    'بخار',
  ],
  it: [
    'Pizza', 'Sushi', 'Hamburger', 'Pasta', 'Insalata', 'Bistecca', 'Taco', 'Ramen', 'Curry', 'Lasagna',
    'Pancake', 'Ciambella', 'Cheesecake',
    'Formaggio', 'Pomodoro', 'Cipolla', 'Aglio', 'Fungo',
    'Burro', 'Uovo',
    'Cannella', 'Paprika', 'Pepe', 'Cumino', 'Vaniglia',
    'Zenzero', 'Zafferano',
    'Caffè', 'Tè', 'Vino', 'Birra', 'Frullato',
    'Latte', 'Succo',
    'Grigliata', 'Frittura', 'Cottura', 'Arrosto', 'Bollitura',
    'Vapore',
  ],
  pt: [
    'Pizza', 'Sushi', 'Hambúrguer', 'Macarrão', 'Salada', 'Bife', 'Taco', 'Ramen', 'Curry', 'Lasanha',
    'Panqueca', 'Rosquinha', 'Cheesecake',
    'Queijo', 'Tomate', 'Cebola', 'Alho', 'Cogumelo',
    'Manteiga', 'Ovo',
    'Canela', 'Páprica', 'Pimenta', 'Cominho', 'Baunilha',
    'Gengibre', 'Açafrão',
    'Café', 'Chá', 'Vinho', 'Cerveja', 'Vitamina',
    'Leite', 'Suco',
    'Grelhar', 'Fritar', 'Assar', 'Tostar', 'Cozinhar',
    'Vapor',
  ],
  zh: [
    '披萨', '寿司', '汉堡', '意大利面', '沙拉', '牛排', '塔可', '拉面', '咖喱', '千层面',
    '煎饼', '甜甜圈', '芝士蛋糕',
    '奶酪', '番茄', '洋葱', '大蒜', '蘑菇',
    '黄油', '鸡蛋',
    '肉桂', '红椒粉', '胡椒', '孜然', '香草',
    '姜', '藏红花',
    '咖啡', '茶', '葡萄酒', '啤酒', '冰沙',
    '牛奶', '果汁',
    '烧烤', '油炸', '烘焙', '烤制', '煮沸',
    '蒸',
  ],
  ru: [
    'Пицца', 'Суши', 'Бургер', 'Паста', 'Салат', 'Стейк', 'Тако', 'Рамен', 'Карри', 'Лазанья',
    'Блин', 'Пончик', 'Чизкейк',
    'Сыр', 'Помидор', 'Лук', 'Чеснок', 'Гриб',
    'Масло', 'Яйцо',
    'Корица', 'Паприка', 'Перец', 'Тмин', 'Ваниль',
    'Имбирь', 'Шафран',
    'Кофе', 'Чай', 'Вино', 'Пиво', 'Смузи',
    'Молоко', 'Сок',
    'Гриль', 'Жарка', 'Выпечка', 'Запекание', 'Варка',
    'На пару',
  ],
  hi: [
    'पिज्जा', 'सुशी', 'बर्गर', 'पास्ता', 'सलाद', 'स्टेक', 'टैको', 'रामेन', 'करी', 'लसान्या',
    'पैनकेक', 'डोनट', 'चीज़केक',
    'पनीर', 'टमाटर', 'प्याज', 'लहसुन', 'मशरूम',
    'मक्खन', 'अंडा',
    'दालचीनी', 'पपरिका', 'काली मिर्च', 'जीरा', 'वैनिला',
    'अदरक', 'केसर',
    'कॉफी', 'चाय', 'शराब', 'बीयर', 'स्मूदी',
    'दूध', 'जूस',
    'ग्रिल', 'तलना', 'बेकिंग', 'भूनना', 'उबालना',
    'भाप',
  ],
}

// ANIMALS: species (17) + habitats (7) + groups (6) + behaviors (10) = 40.
const ANIMALS = {
  en: [
    'Lion', 'Tiger', 'Elephant', 'Wolf', 'Eagle', 'Dolphin', 'Shark',
    'Owl', 'Penguin', 'Snake', 'Bee', 'Octopus', 'Spider',
    'Bear', 'Fox', 'Whale', 'Hippo',
    'Forest', 'Ocean', 'Desert', 'Savanna', 'Jungle',
    'Tundra', 'Reef',
    'Pack', 'Herd', 'Swarm', 'Flock', 'Pride',
    'Colony',
    'Hunting', 'Migration', 'Hibernation', 'Camouflage', 'Roaring', 'Mating', 'Nesting',
    'Burrowing', 'Stalking', 'Howling',
  ],
  fr: [
    'Lion', 'Tigre', 'Éléphant', 'Loup', 'Aigle', 'Dauphin', 'Requin',
    'Hibou', 'Manchot', 'Serpent', 'Abeille', 'Poulpe', 'Araignée',
    'Ours', 'Renard', 'Baleine', 'Hippopotame',
    'Forêt', 'Océan', 'Désert', 'Savane', 'Jungle',
    'Toundra', 'Récif',
    'Meute', 'Troupeau', 'Essaim', 'Volée', 'Bande',
    'Colonie',
    'Chasse', 'Migration', 'Hibernation', 'Camouflage', 'Rugissement', 'Accouplement', 'Nidification',
    'Terrier', 'Traque', 'Hurlement',
  ],
  es: [
    'León', 'Tigre', 'Elefante', 'Lobo', 'Águila', 'Delfín', 'Tiburón',
    'Búho', 'Pingüino', 'Serpiente', 'Abeja', 'Pulpo', 'Araña',
    'Oso', 'Zorro', 'Ballena', 'Hipopótamo',
    'Bosque', 'Océano', 'Desierto', 'Sabana', 'Selva',
    'Tundra', 'Arrecife',
    'Manada', 'Rebaño', 'Enjambre', 'Bandada', 'Familia',
    'Colonia',
    'Caza', 'Migración', 'Hibernación', 'Camuflaje', 'Rugido', 'Apareamiento', 'Anidación',
    'Madriguera', 'Acecho', 'Aullido',
  ],
  de: [
    'Löwe', 'Tiger', 'Elefant', 'Wolf', 'Adler', 'Delfin', 'Hai',
    'Eule', 'Pinguin', 'Schlange', 'Biene', 'Tintenfisch', 'Spinne',
    'Bär', 'Fuchs', 'Wal', 'Nilpferd',
    'Wald', 'Ozean', 'Wüste', 'Savanne', 'Dschungel',
    'Tundra', 'Riff',
    'Rudel', 'Herde', 'Schwarm', 'Schar', 'Familie',
    'Kolonie',
    'Jagd', 'Wanderung', 'Winterschlaf', 'Tarnung', 'Brüllen', 'Paarung', 'Nisten',
    'Graben', 'Anschleichen', 'Heulen',
  ],
  ar: [
    'أسد', 'نمر', 'فيل', 'ذئب', 'نسر', 'دلفين', 'قرش',
    'بومة', 'بطريق', 'ثعبان', 'نحلة', 'أخطبوط', 'عنكبوت',
    'دب', 'ثعلب', 'حوت', 'فرس النهر',
    'غابة', 'محيط', 'صحراء', 'سافانا', 'أدغال',
    'تندرا', 'شعاب مرجانية',
    'قطيع', 'سرب', 'مستعمرة', 'عائلة', 'جماعة',
    'مستوطنة',
    'صيد', 'هجرة', 'سبات', 'تمويه', 'زئير', 'تزاوج', 'تعشيش',
    'حفر الجحور', 'تربص', 'عواء',
  ],
  it: [
    'Leone', 'Tigre', 'Elefante', 'Lupo', 'Aquila', 'Delfino', 'Squalo',
    'Gufo', 'Pinguino', 'Serpente', 'Ape', 'Polpo', 'Ragno',
    'Orso', 'Volpe', 'Balena', 'Ippopotamo',
    'Foresta', 'Oceano', 'Deserto', 'Savana', 'Giungla',
    'Tundra', 'Barriera corallina',
    'Branco', 'Mandria', 'Sciame', 'Stormo', 'Famiglia',
    'Colonia',
    'Caccia', 'Migrazione', 'Letargo', 'Mimetismo', 'Ruggito', 'Accoppiamento', 'Nidificazione',
    'Tana', 'Agguato', 'Ululato',
  ],
  pt: [
    'Leão', 'Tigre', 'Elefante', 'Lobo', 'Águia', 'Golfinho', 'Tubarão',
    'Coruja', 'Pinguim', 'Cobra', 'Abelha', 'Polvo', 'Aranha',
    'Urso', 'Raposa', 'Baleia', 'Hipopótamo',
    'Floresta', 'Oceano', 'Deserto', 'Savana', 'Selva',
    'Tundra', 'Recife',
    'Matilha', 'Rebanho', 'Enxame', 'Bando', 'Família',
    'Colônia',
    'Caça', 'Migração', 'Hibernação', 'Camuflagem', 'Rugido', 'Acasalamento', 'Nidificação',
    'Toca', 'Espreita', 'Uivo',
  ],
  zh: [
    '狮子', '老虎', '大象', '狼', '老鹰', '海豚', '鲨鱼',
    '猫头鹰', '企鹅', '蛇', '蜜蜂', '章鱼', '蜘蛛',
    '熊', '狐狸', '鲸鱼', '河马',
    '森林', '海洋', '沙漠', '草原', '丛林',
    '苔原', '珊瑚礁',
    '狼群', '畜群', '蜂群', '鸟群', '家族',
    '殖民地',
    '狩猎', '迁徙', '冬眠', '伪装', '咆哮', '交配', '筑巢',
    '挖洞', '潜行', '嚎叫',
  ],
  ru: [
    'Лев', 'Тигр', 'Слон', 'Волк', 'Орёл', 'Дельфин', 'Акула',
    'Сова', 'Пингвин', 'Змея', 'Пчела', 'Осьминог', 'Паук',
    'Медведь', 'Лиса', 'Кит', 'Бегемот',
    'Лес', 'Океан', 'Пустыня', 'Саванна', 'Джунгли',
    'Тундра', 'Риф',
    'Стая', 'Стадо', 'Рой', 'Косяк', 'Семья',
    'Колония',
    'Охота', 'Миграция', 'Спячка', 'Камуфляж', 'Рык', 'Спаривание', 'Гнездование',
    'Нора', 'Подкрадывание', 'Вой',
  ],
  hi: [
    'शेर', 'बाघ', 'हाथी', 'भेड़िया', 'चील', 'डॉल्फिन', 'शार्क',
    'उल्लू', 'पेंगुइन', 'साँप', 'मधुमक्खी', 'ऑक्टोपस', 'मकड़ी',
    'भालू', 'लोमड़ी', 'व्हेल', 'दरियाई घोड़ा',
    'जंगल', 'समुद्र', 'रेगिस्तान', 'सवाना', 'वर्षावन',
    'टुंड्रा', 'प्रवाल भित्ति',
    'झुंड', 'समूह', 'जत्था', 'दल', 'परिवार',
    'कॉलोनी',
    'शिकार', 'प्रवास', 'शीतनिद्रा', 'छलावरण', 'दहाड़', 'संभोग', 'घोंसला',
    'बिल खोदना', 'घात लगाना', 'चीखना',
  ],
}

// PLACES: cities (10) + landmarks (8) + natural sites (8) + regions (6) + fictional (8) = 40.
const PLACES = {
  en: [
    'Paris', 'Tokyo', 'New York', 'London', 'Rome', 'Cairo', 'Sydney',
    'Berlin', 'Madrid', 'Bangkok',
    'Eiffel Tower', 'Pyramids', 'Colosseum', 'Statue of Liberty', 'Big Ben', 'Great Wall',
    'Taj Mahal', 'Stonehenge',
    'Mount Everest', 'Sahara', 'Amazon', 'Grand Canyon', 'Niagara Falls', 'Alps',
    'Galapagos', 'Mariana Trench',
    'Asia', 'Europe', 'Africa', 'Caribbean', 'Antarctica',
    'Oceania',
    'Hogwarts', 'Narnia', 'Atlantis', 'Wakanda', 'Middle Earth', 'Westeros',
    'Mordor', 'Gotham',
  ],
  fr: [
    'Paris', 'Tokyo', 'New York', 'Londres', 'Rome', 'Le Caire', 'Sydney',
    'Berlin', 'Madrid', 'Bangkok',
    'Tour Eiffel', 'Pyramides', 'Colisée', 'Statue de la Liberté', 'Big Ben', 'Grande Muraille',
    'Taj Mahal', 'Stonehenge',
    'Mont Everest', 'Sahara', 'Amazone', 'Grand Canyon', 'Chutes du Niagara', 'Alpes',
    'Galápagos', 'Fosse des Mariannes',
    'Asie', 'Europe', 'Afrique', 'Caraïbes', 'Antarctique',
    'Océanie',
    'Poudlard', 'Narnia', 'Atlantide', 'Wakanda', 'Terre du Milieu', 'Westeros',
    'Mordor', 'Gotham',
  ],
  es: [
    'París', 'Tokio', 'Nueva York', 'Londres', 'Roma', 'El Cairo', 'Sídney',
    'Berlín', 'Madrid', 'Bangkok',
    'Torre Eiffel', 'Pirámides', 'Coliseo', 'Estatua de la Libertad', 'Big Ben', 'Gran Muralla',
    'Taj Mahal', 'Stonehenge',
    'Monte Everest', 'Sahara', 'Amazonas', 'Gran Cañón', 'Cataratas del Niágara', 'Alpes',
    'Galápagos', 'Fosa de las Marianas',
    'Asia', 'Europa', 'África', 'Caribe', 'Antártida',
    'Oceanía',
    'Hogwarts', 'Narnia', 'Atlántida', 'Wakanda', 'Tierra Media', 'Poniente',
    'Mordor', 'Gotham',
  ],
  de: [
    'Paris', 'Tokio', 'New York', 'London', 'Rom', 'Kairo', 'Sydney',
    'Berlin', 'Madrid', 'Bangkok',
    'Eiffelturm', 'Pyramiden', 'Kolosseum', 'Freiheitsstatue', 'Big Ben', 'Chinesische Mauer',
    'Taj Mahal', 'Stonehenge',
    'Mount Everest', 'Sahara', 'Amazonas', 'Grand Canyon', 'Niagarafälle', 'Alpen',
    'Galapagos', 'Marianengraben',
    'Asien', 'Europa', 'Afrika', 'Karibik', 'Antarktis',
    'Ozeanien',
    'Hogwarts', 'Narnia', 'Atlantis', 'Wakanda', 'Mittelerde', 'Westeros',
    'Mordor', 'Gotham',
  ],
  ar: [
    'باريس', 'طوكيو', 'نيويورك', 'لندن', 'روما', 'القاهرة', 'سيدني',
    'برلين', 'مدريد', 'بانكوك',
    'برج إيفل', 'الأهرامات', 'الكولوسيوم', 'تمثال الحرية', 'بيغ بن', 'سور الصين',
    'تاج محل', 'ستونهنج',
    'إيفرست', 'الصحراء', 'الأمازون', 'جراند كانيون', 'شلالات نياجرا', 'جبال الألب',
    'جزر غالاباغوس', 'خندق ماريانا',
    'آسيا', 'أوروبا', 'أفريقيا', 'الكاريبي', 'القطب الجنوبي',
    'أوقيانوسيا',
    'هوغوورتس', 'نارنيا', 'أتلانتس', 'واكاندا', 'الأرض الوسطى', 'ويستروس',
    'موردور', 'غوثام',
  ],
  it: [
    'Parigi', 'Tokyo', 'New York', 'Londra', 'Roma', 'Il Cairo', 'Sydney',
    'Berlino', 'Madrid', 'Bangkok',
    'Torre Eiffel', 'Piramidi', 'Colosseo', 'Statua della Libertà', 'Big Ben', 'Grande Muraglia',
    'Taj Mahal', 'Stonehenge',
    'Monte Everest', 'Sahara', 'Rio delle Amazzoni', 'Grand Canyon', 'Cascate del Niagara', 'Alpi',
    'Galapagos', 'Fossa delle Marianne',
    'Asia', 'Europa', 'Africa', 'Caraibi', 'Antartide',
    'Oceania',
    'Hogwarts', 'Narnia', 'Atlantide', 'Wakanda', 'Terra di Mezzo', 'Westeros',
    'Mordor', 'Gotham',
  ],
  pt: [
    'Paris', 'Tóquio', 'Nova York', 'Londres', 'Roma', 'Cairo', 'Sydney',
    'Berlim', 'Madri', 'Bangkok',
    'Torre Eiffel', 'Pirâmides', 'Coliseu', 'Estátua da Liberdade', 'Big Ben', 'Grande Muralha',
    'Taj Mahal', 'Stonehenge',
    'Monte Everest', 'Saara', 'Amazonas', 'Grand Canyon', 'Cataratas do Niágara', 'Alpes',
    'Galápagos', 'Fossa das Marianas',
    'Ásia', 'Europa', 'África', 'Caribe', 'Antártida',
    'Oceania',
    'Hogwarts', 'Nárnia', 'Atlântida', 'Wakanda', 'Terra Média', 'Westeros',
    'Mordor', 'Gotham',
  ],
  zh: [
    '巴黎', '东京', '纽约', '伦敦', '罗马', '开罗', '悉尼',
    '柏林', '马德里', '曼谷',
    '埃菲尔铁塔', '金字塔', '罗马斗兽场', '自由女神像', '大本钟', '长城',
    '泰姬陵', '巨石阵',
    '珠穆朗玛峰', '撒哈拉', '亚马逊', '大峡谷', '尼亚加拉瀑布', '阿尔卑斯',
    '加拉帕戈斯', '马里亚纳海沟',
    '亚洲', '欧洲', '非洲', '加勒比', '南极洲',
    '大洋洲',
    '霍格沃茨', '纳尼亚', '亚特兰蒂斯', '瓦坎达', '中土世界', '维斯特洛',
    '魔多', '哥谭',
  ],
  ru: [
    'Париж', 'Токио', 'Нью-Йорк', 'Лондон', 'Рим', 'Каир', 'Сидней',
    'Берлин', 'Мадрид', 'Бангкок',
    'Эйфелева башня', 'Пирамиды', 'Колизей', 'Статуя Свободы', 'Биг-Бен', 'Великая стена',
    'Тадж-Махал', 'Стоунхендж',
    'Эверест', 'Сахара', 'Амазонка', 'Гранд-Каньон', 'Ниагарский водопад', 'Альпы',
    'Галапагосы', 'Марианская впадина',
    'Азия', 'Европа', 'Африка', 'Карибы', 'Антарктида',
    'Океания',
    'Хогвартс', 'Нарния', 'Атлантида', 'Ваканда', 'Средиземье', 'Вестерос',
    'Мордор', 'Готэм',
  ],
  hi: [
    'पेरिस', 'टोक्यो', 'न्यूयॉर्क', 'लंदन', 'रोम', 'काहिरा', 'सिडनी',
    'बर्लिन', 'मैड्रिड', 'बैंकॉक',
    'एफिल टॉवर', 'पिरामिड', 'कोलोसियम', 'स्टैच्यू ऑफ लिबर्टी', 'बिग बेन', 'चीन की दीवार',
    'ताज महल', 'स्टोनहेंज',
    'एवरेस्ट', 'सहारा', 'अमेज़न', 'ग्रांड कैन्यन', 'नायग्रा फॉल्स', 'आल्प्स',
    'गालापागोस', 'मारियाना ट्रेंच',
    'एशिया', 'यूरोप', 'अफ्रीका', 'कैरेबियन', 'अंटार्कटिका',
    'ओशिनिया',
    'हॉगवर्ट्स', 'नार्निया', 'अटलांटिस', 'वकांडा', 'मध्य पृथ्वी', 'वेस्टरोस',
    'मोर्डोर', 'गोथम',
  ],
}

// JOBS: professions (9) + roles (7) + modern trades (8) + creative (8) + historical (8) = 40.
const JOBS = {
  en: [
    'Doctor', 'Teacher', 'Engineer', 'Lawyer', 'Chef', 'Pilot', 'Nurse',
    'Dentist', 'Veterinarian',
    'Police', 'Firefighter', 'Soldier', 'Detective', 'Astronaut', 'Manager',
    'Spy',
    'Plumber', 'Electrician', 'Carpenter', 'Mechanic', 'Baker', 'Programmer',
    'Designer', 'Developer',
    'Artist', 'Musician', 'Writer', 'Photographer', 'Architect', 'Journalist',
    'Director', 'Sculptor',
    'Blacksmith', 'Knight', 'Sailor', 'Farmer', 'Hunter',
    'Pirate', 'Samurai', 'Cowboy',
  ],
  fr: [
    'Médecin', 'Professeur', 'Ingénieur', 'Avocat', 'Cuisinier', 'Pilote', 'Infirmier',
    'Dentiste', 'Vétérinaire',
    'Policier', 'Pompier', 'Soldat', 'Détective', 'Astronaute', 'Manager',
    'Espion',
    'Plombier', 'Électricien', 'Charpentier', 'Mécanicien', 'Boulanger', 'Programmeur',
    'Designer', 'Développeur',
    'Artiste', 'Musicien', 'Écrivain', 'Photographe', 'Architecte', 'Journaliste',
    'Réalisateur', 'Sculpteur',
    'Forgeron', 'Chevalier', 'Marin', 'Agriculteur', 'Chasseur',
    'Pirate', 'Samouraï', 'Cowboy',
  ],
  es: [
    'Médico', 'Profesor', 'Ingeniero', 'Abogado', 'Chef', 'Piloto', 'Enfermero',
    'Dentista', 'Veterinario',
    'Policía', 'Bombero', 'Soldado', 'Detective', 'Astronauta', 'Gerente',
    'Espía',
    'Fontanero', 'Electricista', 'Carpintero', 'Mecánico', 'Panadero', 'Programador',
    'Diseñador', 'Desarrollador',
    'Artista', 'Músico', 'Escritor', 'Fotógrafo', 'Arquitecto', 'Periodista',
    'Director', 'Escultor',
    'Herrero', 'Caballero', 'Marinero', 'Granjero', 'Cazador',
    'Pirata', 'Samurái', 'Vaquero',
  ],
  de: [
    'Arzt', 'Lehrer', 'Ingenieur', 'Anwalt', 'Koch', 'Pilot', 'Krankenschwester',
    'Zahnarzt', 'Tierarzt',
    'Polizist', 'Feuerwehrmann', 'Soldat', 'Detektiv', 'Astronaut', 'Manager',
    'Spion',
    'Klempner', 'Elektriker', 'Tischler', 'Mechaniker', 'Bäcker', 'Programmierer',
    'Designer', 'Entwickler',
    'Künstler', 'Musiker', 'Schriftsteller', 'Fotograf', 'Architekt', 'Journalist',
    'Regisseur', 'Bildhauer',
    'Schmied', 'Ritter', 'Seemann', 'Bauer', 'Jäger',
    'Pirat', 'Samurai', 'Cowboy',
  ],
  ar: [
    'طبيب', 'معلم', 'مهندس', 'محامي', 'طاهي', 'طيار', 'ممرض',
    'طبيب أسنان', 'طبيب بيطري',
    'شرطي', 'إطفائي', 'جندي', 'محقق', 'رائد فضاء', 'مدير',
    'جاسوس',
    'سباك', 'كهربائي', 'نجار', 'ميكانيكي', 'خباز', 'مبرمج',
    'مصمم', 'مطور',
    'فنان', 'موسيقي', 'كاتب', 'مصور', 'معماري', 'صحفي',
    'مخرج', 'نحات',
    'حداد', 'فارس', 'بحار', 'مزارع', 'صياد',
    'قرصان', 'ساموراي', 'راعي بقر',
  ],
  it: [
    'Medico', 'Insegnante', 'Ingegnere', 'Avvocato', 'Cuoco', 'Pilota', 'Infermiere',
    'Dentista', 'Veterinario',
    'Poliziotto', 'Pompiere', 'Soldato', 'Detective', 'Astronauta', 'Manager',
    'Spia',
    'Idraulico', 'Elettricista', 'Falegname', 'Meccanico', 'Fornaio', 'Programmatore',
    'Designer', 'Sviluppatore',
    'Artista', 'Musicista', 'Scrittore', 'Fotografo', 'Architetto', 'Giornalista',
    'Regista', 'Scultore',
    'Fabbro', 'Cavaliere', 'Marinaio', 'Contadino', 'Cacciatore',
    'Pirata', 'Samurai', 'Cowboy',
  ],
  pt: [
    'Médico', 'Professor', 'Engenheiro', 'Advogado', 'Chef', 'Piloto', 'Enfermeiro',
    'Dentista', 'Veterinário',
    'Policial', 'Bombeiro', 'Soldado', 'Detetive', 'Astronauta', 'Gerente',
    'Espião',
    'Encanador', 'Eletricista', 'Carpinteiro', 'Mecânico', 'Padeiro', 'Programador',
    'Designer', 'Desenvolvedor',
    'Artista', 'Músico', 'Escritor', 'Fotógrafo', 'Arquiteto', 'Jornalista',
    'Diretor', 'Escultor',
    'Ferreiro', 'Cavaleiro', 'Marinheiro', 'Fazendeiro', 'Caçador',
    'Pirata', 'Samurai', 'Cowboy',
  ],
  zh: [
    '医生', '老师', '工程师', '律师', '厨师', '飞行员', '护士',
    '牙医', '兽医',
    '警察', '消防员', '士兵', '侦探', '宇航员', '经理',
    '间谍',
    '水管工', '电工', '木匠', '机械师', '面包师', '程序员',
    '设计师', '开发者',
    '艺术家', '音乐家', '作家', '摄影师', '建筑师', '记者',
    '导演', '雕塑家',
    '铁匠', '骑士', '水手', '农民', '猎人',
    '海盗', '武士', '牛仔',
  ],
  ru: [
    'Врач', 'Учитель', 'Инженер', 'Юрист', 'Повар', 'Пилот', 'Медсестра',
    'Стоматолог', 'Ветеринар',
    'Полицейский', 'Пожарный', 'Солдат', 'Детектив', 'Космонавт', 'Менеджер',
    'Шпион',
    'Сантехник', 'Электрик', 'Плотник', 'Механик', 'Пекарь', 'Программист',
    'Дизайнер', 'Разработчик',
    'Художник', 'Музыкант', 'Писатель', 'Фотограф', 'Архитектор', 'Журналист',
    'Режиссёр', 'Скульптор',
    'Кузнец', 'Рыцарь', 'Моряк', 'Фермер', 'Охотник',
    'Пират', 'Самурай', 'Ковбой',
  ],
  hi: [
    'डॉक्टर', 'शिक्षक', 'इंजीनियर', 'वकील', 'शेफ', 'पायलट', 'नर्स',
    'दंत चिकित्सक', 'पशु चिकित्सक',
    'पुलिस', 'अग्निशामक', 'सैनिक', 'जासूस', 'अंतरिक्ष यात्री', 'प्रबंधक',
    'गुप्तचर',
    'प्लंबर', 'इलेक्ट्रीशियन', 'बढ़ई', 'मैकेनिक', 'बेकर', 'प्रोग्रामर',
    'डिज़ाइनर', 'डेवलपर',
    'कलाकार', 'संगीतकार', 'लेखक', 'फोटोग्राफर', 'वास्तुकार', 'पत्रकार',
    'निर्देशक', 'मूर्तिकार',
    'लोहार', 'योद्धा', 'नाविक', 'किसान', 'शिकारी',
    'समुद्री डाकू', 'सामुराई', 'काउबॉय',
  ],
}

// SPORTS: sports (11) + positions (6) + equipment (7) + events (7) + venues (9) = 40.
const SPORTS = {
  en: [
    'Soccer', 'Basketball', 'Tennis', 'Baseball', 'Boxing', 'Golf', 'Hockey', 'Rugby',
    'Volleyball', 'Cricket', 'Skiing',
    'Goalkeeper', 'Striker', 'Defender', 'Quarterback',
    'Goalie', 'Pitcher',
    'Ball', 'Racket', 'Bat', 'Helmet', 'Gloves', 'Skates',
    'Net',
    'Olympics', 'World Cup', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Champions League', 'NBA Finals',
    'Stadium', 'Arena', 'Court', 'Field', 'Track', 'Pitch', 'Pool',
    'Gym', 'Rink',
  ],
  fr: [
    'Football', 'Basketball', 'Tennis', 'Baseball', 'Boxe', 'Golf', 'Hockey', 'Rugby',
    'Volley', 'Cricket', 'Ski',
    'Gardien', 'Attaquant', 'Défenseur', 'Quarterback',
    'Goal', 'Lanceur',
    'Ballon', 'Raquette', 'Batte', 'Casque', 'Gants', 'Patins',
    'Filet',
    'Jeux Olympiques', 'Coupe du Monde', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Ligue des Champions', 'Finales NBA',
    'Stade', 'Aréna', 'Court', 'Terrain', 'Piste', 'Pelouse', 'Piscine',
    'Salle', 'Patinoire',
  ],
  es: [
    'Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Boxeo', 'Golf', 'Hockey', 'Rugby',
    'Voleibol', 'Críquet', 'Esquí',
    'Portero', 'Delantero', 'Defensa', 'Mariscal',
    'Arquero', 'Lanzador',
    'Pelota', 'Raqueta', 'Bate', 'Casco', 'Guantes', 'Patines',
    'Red',
    'Olimpiadas', 'Copa Mundial', 'Maratón', 'Super Bowl', 'Wimbledon',
    'Champions League', 'Finales NBA',
    'Estadio', 'Arena', 'Cancha', 'Campo', 'Pista', 'Césped', 'Piscina',
    'Gimnasio', 'Pista de hielo',
  ],
  de: [
    'Fußball', 'Basketball', 'Tennis', 'Baseball', 'Boxen', 'Golf', 'Hockey', 'Rugby',
    'Volleyball', 'Cricket', 'Skifahren',
    'Torwart', 'Stürmer', 'Verteidiger', 'Quarterback',
    'Torhüter', 'Werfer',
    'Ball', 'Schläger', 'Schlagholz', 'Helm', 'Handschuhe', 'Schlittschuhe',
    'Netz',
    'Olympia', 'Weltmeisterschaft', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Champions League', 'NBA-Finale',
    'Stadion', 'Arena', 'Platz', 'Feld', 'Bahn', 'Rasen', 'Pool',
    'Halle', 'Eisbahn',
  ],
  ar: [
    'كرة القدم', 'كرة السلة', 'تنس', 'بيسبول', 'ملاكمة', 'غولف', 'هوكي', 'رغبي',
    'كرة الطائرة', 'كريكيت', 'تزلج',
    'حارس مرمى', 'مهاجم', 'مدافع', 'لاعب وسط',
    'حارس', 'رامي',
    'كرة', 'مضرب', 'عصا', 'خوذة', 'قفازات', 'زلاجات',
    'شبكة',
    'الأولمبياد', 'كأس العالم', 'ماراثون', 'سوبر بول', 'ويمبلدون',
    'دوري الأبطال', 'نهائي إن بي إيه',
    'ملعب', 'حلبة', 'محكمة', 'حقل', 'مضمار', 'عشب', 'مسبح',
    'صالة', 'حلبة جليد',
  ],
  it: [
    'Calcio', 'Pallacanestro', 'Tennis', 'Baseball', 'Pugilato', 'Golf', 'Hockey', 'Rugby',
    'Pallavolo', 'Cricket', 'Sci',
    'Portiere', 'Attaccante', 'Difensore', 'Quarterback',
    'Portiere riserva', 'Lanciatore',
    'Palla', 'Racchetta', 'Mazza', 'Casco', 'Guanti', 'Pattini',
    'Rete',
    'Olimpiadi', 'Coppa del Mondo', 'Maratona', 'Super Bowl', 'Wimbledon',
    'Champions League', 'Finali NBA',
    'Stadio', 'Arena', 'Campo', 'Terreno', 'Pista', 'Prato', 'Piscina',
    'Palestra', 'Pista ghiaccio',
  ],
  pt: [
    'Futebol', 'Basquete', 'Tênis', 'Beisebol', 'Boxe', 'Golfe', 'Hóquei', 'Rúgbi',
    'Vôlei', 'Críquete', 'Esqui',
    'Goleiro', 'Atacante', 'Zagueiro', 'Quarterback',
    'Goleiro reserva', 'Arremessador',
    'Bola', 'Raquete', 'Taco', 'Capacete', 'Luvas', 'Patins',
    'Rede',
    'Olimpíadas', 'Copa do Mundo', 'Maratona', 'Super Bowl', 'Wimbledon',
    'Champions League', 'Finais NBA',
    'Estádio', 'Arena', 'Quadra', 'Campo', 'Pista', 'Gramado', 'Piscina',
    'Academia', 'Rinque',
  ],
  zh: [
    '足球', '篮球', '网球', '棒球', '拳击', '高尔夫', '曲棍球', '橄榄球',
    '排球', '板球', '滑雪',
    '守门员', '前锋', '后卫', '四分卫',
    '门将', '投手',
    '球', '球拍', '球棒', '头盔', '手套', '溜冰鞋',
    '球网',
    '奥运会', '世界杯', '马拉松', '超级碗', '温布尔登',
    '欧冠', 'NBA总决赛',
    '体育场', '竞技场', '球场', '场地', '跑道', '草坪', '游泳池',
    '健身房', '冰场',
  ],
  ru: [
    'Футбол', 'Баскетбол', 'Теннис', 'Бейсбол', 'Бокс', 'Гольф', 'Хоккей', 'Регби',
    'Волейбол', 'Крикет', 'Лыжи',
    'Вратарь', 'Нападающий', 'Защитник', 'Квотербек',
    'Голкипер', 'Питчер',
    'Мяч', 'Ракетка', 'Бита', 'Шлем', 'Перчатки', 'Коньки',
    'Сетка',
    'Олимпиада', 'Чемпионат мира', 'Марафон', 'Супербоул', 'Уимблдон',
    'Лига чемпионов', 'Финал НБА',
    'Стадион', 'Арена', 'Корт', 'Поле', 'Дорожка', 'Газон', 'Бассейн',
    'Спортзал', 'Каток',
  ],
  hi: [
    'फुटबॉल', 'बास्केटबॉल', 'टेनिस', 'बेसबॉल', 'मुक्केबाज़ी', 'गोल्फ', 'हॉकी', 'रग्बी',
    'वॉलीबॉल', 'क्रिकेट', 'स्कीइंग',
    'गोलकीपर', 'स्ट्राइकर', 'डिफेंडर', 'क्वार्टरबैक',
    'गोली', 'पिचर',
    'गेंद', 'रैकेट', 'बैट', 'हेलमेट', 'दस्ताने', 'स्केट्स',
    'जाल',
    'ओलंपिक', 'विश्व कप', 'मैराथन', 'सुपर बाउल', 'विंबलडन',
    'चैंपियंस लीग', 'एनबीए फाइनल',
    'स्टेडियम', 'अखाड़ा', 'कोर्ट', 'मैदान', 'ट्रैक', 'घास का मैदान', 'पूल',
    'जिम', 'रिंक',
  ],
}

// VARIETY: brands and pop-culture concepts (mostly invariant proper nouns).
const VARIETY = {
  en: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Christmas', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Monopoly', 'New Year',
  ],
  fr: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Noël', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Monopoly', 'Nouvel An',
  ],
  es: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Navidad', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Monopoly', 'Año Nuevo',
  ],
  de: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WLAN', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Weihnachten', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Monopoly', 'Silvester',
  ],
  ar: [
    'آيفون', 'أندرويد', 'جوجل', 'آبل', 'نتفليكس', 'ديزني+',
    'تيك توك', 'إنستغرام', 'تسلا', 'فيراري', 'بيتكوين', 'إيثيريوم',
    'واي فاي', 'بلوتوث', 'ماريو', 'سونيك', 'بوكيمون', 'ماين كرافت',
    'روبلوكس', 'إكس بوكس', 'بلايستيشن', 'عيد الميلاد', 'هالوين', 'يوغا',
    'بيلاتس', 'كوكا كولا', 'بيبسي', 'نايكي', 'أديداس', 'أوبر',
    'سبوتيفاي', 'أمازون', 'مايكروسوفت', 'سناب شات', 'تويتر', 'يوتيوب',
    'ليغو', 'باربي', 'مونوبولي', 'رأس السنة',
  ],
  it: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Natale', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Monopoly', 'Capodanno',
  ],
  pt: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Natal', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
    'Spotify', 'Amazon', 'Microsoft', 'Snapchat', 'Twitter', 'YouTube',
    'Lego', 'Barbie', 'Banco Imobiliário', 'Ano Novo',
  ],
  zh: [
    'iPhone', '安卓', '谷歌', '苹果', '网飞', '迪士尼+',
    '抖音', '照片墙', '特斯拉', '法拉利', '比特币', '以太坊',
    'WiFi', '蓝牙', '马里奥', '索尼克', '宝可梦', '我的世界',
    'Roblox', 'Xbox', 'PlayStation', '圣诞节', '万圣节', '瑜伽',
    '普拉提', '可口可乐', '百事可乐', '耐克', '阿迪达斯', '优步',
    'Spotify', '亚马逊', '微软', 'Snapchat', '推特', 'YouTube',
    '乐高', '芭比', '大富翁', '新年',
  ],
  ru: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Марио', 'Соник', 'Покемон', 'Майнкрафт',
    'Roblox', 'Xbox', 'PlayStation', 'Рождество', 'Хэллоуин', 'Йога',
    'Пилатес', 'Кока-Кола', 'Пепси', 'Найк', 'Адидас', 'Убер',
    'Spotify', 'Амазон', 'Майкрософт', 'Snapchat', 'Твиттер', 'YouTube',
    'Лего', 'Барби', 'Монополия', 'Новый год',
  ],
  hi: [
    'आईफोन', 'एंड्रॉयड', 'गूगल', 'एप्पल', 'नेटफ्लिक्स', 'डिज्नी+',
    'टिकटॉक', 'इंस्टाग्राम', 'टेस्ला', 'फेरारी', 'बिटकॉइन', 'एथेरियम',
    'वाईफाई', 'ब्लूटूथ', 'मारियो', 'सोनिक', 'पोकेमोन', 'माइनक्राफ्ट',
    'रोब्लॉक्स', 'एक्सबॉक्स', 'प्लेस्टेशन', 'क्रिसमस', 'हैलोवीन', 'योग',
    'पिलाटे', 'कोका कोला', 'पेप्सी', 'नाइकी', 'एडिडास', 'उबर',
    'स्पॉटिफाई', 'अमेज़न', 'माइक्रोसॉफ्ट', 'स्नैपचैट', 'ट्विटर', 'यूट्यूब',
    'लेगो', 'बार्बी', 'मोनोपॉली', 'नया साल',
  ],
}

// ============================================================================
// Bundle pools by category.
// INVARIANT: same array used for every locale.
// TRANSLATABLE: per-locale arrays.
// ============================================================================

const INVARIANT = {
  music: MUSIC,
  movies: MOVIES,
  history: HISTORY,
  mangas: MANGAS,
  celebrities: CELEBRITIES,
  tech: TECH,
}

const TRANSLATABLE = {
  food: FOOD,
  animals: ANIMALS,
  places: PLACES,
  jobs: JOBS,
  sports: SPORTS,
  variety: VARIETY,
}

// ============================================================================
// Pair generation: all C(40,2) = 780 unordered pairs in stable index order.
// ============================================================================

function allPairs(items) {
  const out = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]])
    }
  }
  return out
}

function poolFor(category, locale) {
  if (INVARIANT[category]) return INVARIANT[category]
  const byLocale = TRANSLATABLE[category]
  if (!byLocale) throw new Error(`Unknown category: ${category}`)
  return byLocale[locale] ?? byLocale.en
}

function pairsForLocaleCategory(category, locale) {
  const items = poolFor(category, locale)
  if (items.length !== POOL_SIZE) {
    throw new Error(`[${category}/${locale}] expected ${POOL_SIZE} items, got ${items.length}`)
  }
  return allPairs(items)
}

// ============================================================================
// Render output TS.
// ============================================================================

function escapeLit(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function renderPair([a, b]) {
  return `    { villagerWord: '${escapeLit(a)}', redHandedWord: '${escapeLit(b)}' },`
}

function renderRecord(locale) {
  const lines = ['{']
  for (const cat of CATEGORY_ORDER) {
    lines.push(`  ${cat}: [`)
    for (const p of pairsForLocaleCategory(cat, locale)) lines.push(renderPair(p))
    lines.push('  ],')
  }
  lines.push('}')
  return lines.join('\n')
}

// ============================================================================
// Per-locale data file template.
// Default export so dynamic `import('./fr')` resolves to the data directly.
// ============================================================================

function renderLocaleFile(locale) {
  return `import type { WordCategory } from '../types'
import type { OfflineWordPair } from './index'

/**
 * Offline word pairs for ${locale}. Auto-generated — do not edit by hand.
 * Run \`node scripts/generate-offline-words.mjs\` to regenerate.
 */
const PAIRS: Record<WordCategory, OfflineWordPair[]> = ${renderRecord(locale)}

export default PAIRS
`
}

// ============================================================================
// Index file: types + lazy loader + async picker.
// English is statically imported (eager fallback); other locales are lazy.
// ============================================================================

const INDEX_CONTENT = `import type { WordCategory } from '../types'
import EN_PAIRS from './en'

/**
 * Word pairs for offline / pass-and-play mode and online default rooms.
 * Each pair has a villagerWord and a redHandedWord — same category, different items.
 *
 * Locales are split into separate chunks; bundlers code-split them so a user
 * only downloads the data for their active locale (~600 KB) instead of the
 * full 5.8 MB. English is eagerly bundled as the always-available fallback.
 */
export interface OfflineWordPair {
  villagerWord: string
  redHandedWord: string
}

type LocaleData = Record<WordCategory, OfflineWordPair[]>

/** Eagerly-bundled English pairs — also used as the fallback for unknown locales. */
export const OFFLINE_WORD_PAIRS: LocaleData = EN_PAIRS

const LOADERS: Record<string, () => Promise<{ default: LocaleData }>> = {
  en: () => Promise.resolve({ default: EN_PAIRS }),
  fr: () => import('./fr'),
  es: () => import('./es'),
  de: () => import('./de'),
  ar: () => import('./ar'),
  it: () => import('./it'),
  pt: () => import('./pt'),
  zh: () => import('./zh'),
  ru: () => import('./ru'),
  hi: () => import('./hi'),
}

const cache = new Map<string, LocaleData>([['en', EN_PAIRS]])

/**
 * Load a locale's offline word pairs. Cached after first call.
 * Falls back to English data if the locale code is unknown.
 */
export async function loadOfflineWords(locale: string): Promise<LocaleData> {
  const key = locale.substring(0, 2)
  const cached = cache.get(key)
  if (cached) return cached
  const loader = LOADERS[key]
  if (!loader) {
    cache.set(key, EN_PAIRS)
    return EN_PAIRS
  }
  const mod = await loader()
  cache.set(key, mod.default)
  return mod.default
}

/**
 * Pick a random word pair from the given categories and locale.
 * Lazy-loads the locale chunk on first use, then resolves from cache.
 *
 * If \`categories\` is empty, picks across all categories.
 */
export async function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
  locale?: string,
): Promise<OfflineWordPair & { category: WordCategory }> {
  const pairsMap = await loadOfflineWords(locale ?? 'en')
  const keys =
    categories.length > 0
      ? categories
      : (Object.keys(pairsMap) as WordCategory[])
  const shuffledKeys = shuffleFn(keys)
  const category = shuffledKeys[0]
  const pairs = pairsMap[category]
  const shuffledPairs = shuffleFn(pairs)
  return { ...shuffledPairs[0], category }
}
`

let totalPairs = 0
for (const locale of LOCALES) {
  const path = resolve(OUT_DIR, `${locale}.ts`)
  writeFileSync(path, renderLocaleFile(locale), 'utf8')
  for (const cat of CATEGORY_ORDER) {
    totalPairs += pairsForLocaleCategory(cat, locale).length
  }
}

writeFileSync(resolve(OUT_DIR, 'index.ts'), INDEX_CONTENT, 'utf8')

console.log(`Wrote ${LOCALES.length} per-locale files + index.ts to ${OUT_DIR}`)
console.log(`${LOCALES.length} locales x ${CATEGORY_ORDER.length} categories x 780 pairs = ${totalPairs} total`)
