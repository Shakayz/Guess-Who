#!/usr/bin/env node
/**
 * Generates packages/shared/src/offlineWords.ts from rich, diverse 30-item pools.
 *
 * Each (category, locale) pool has 30 items mixing sub-types (dishes,
 * ingredients, spices, drinks, methods for food; characters, techniques,
 * places, transformations, power systems for mangas; etc.) so that pairs
 * stay semantically meaningful within the category — an imposter can blend
 * in because every pair shares the category umbrella.
 *
 * Emits all C(30,2) = 435 unordered pairs per (locale, category).
 *
 * Output: 10 locales x 12 categories x 435 pairs = 52,200 pairs total.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../packages/shared/src/offlineWords.ts')

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh', 'ru', 'hi']
const POOL_SIZE = 30

const CATEGORY_ORDER = [
  'food', 'animals', 'music', 'places', 'jobs',
  'sports', 'movies', 'tech', 'history', 'mangas', 'celebrities', 'variety',
]

// ============================================================================
// INVARIANT POOLS — proper nouns / globally-recognized terms.
// Same 30-item array used for every locale.
// ============================================================================

// MANGAS: characters (12) + techniques (5) + places (4) + transformations (4)
// + power systems (5) = 30. Mixing sub-types means pairs like Naruto/Rasengan
// or Goku/Super Saiyan share a series, while Chakra/Nen share "power system".
const MANGAS = [
  'Naruto', 'Sasuke', 'Goku', 'Vegeta', 'Luffy', 'Zoro',
  'Ichigo', 'Tanjiro', 'Eren', 'Saitama', 'Hisoka', 'Levi',
  'Rasengan', 'Chidori', 'Kamehameha', 'Gum-Gum', 'Shadow Clone',
  'Konoha', 'Wano', 'Soul Society', 'Marineford',
  'Super Saiyan', 'Bankai', 'Sage Mode', 'Gear Five',
  'Chakra', 'Ki', 'Haki', 'Nen', 'Curse Energy',
]

// CELEBRITIES: actors (8) + athletes (8) + musicians (8) + influencers (6) = 30.
const CELEBRITIES = [
  'Brad Pitt', 'Leonardo DiCaprio', 'Tom Cruise', 'Will Smith',
  'Robert Downey Jr', 'Scarlett Johansson', 'Margot Robbie', 'Emma Watson',
  'Messi', 'Ronaldo', 'LeBron James', 'Michael Jordan',
  'Serena Williams', 'Federer', 'Tom Brady', 'Tiger Woods',
  'Beyoncé', 'Rihanna', 'Drake', 'Kanye West',
  'Taylor Swift', 'Adele', 'Ed Sheeran', 'Elvis',
  'MrBeast', 'PewDiePie', 'Kim Kardashian', 'Kylie Jenner',
  'Elon Musk', 'Logan Paul',
]

// MOVIES: titles (8) + directors (5) + characters (4) + genres (7) + franchises (6) = 30.
const MOVIES = [
  'Titanic', 'Inception', 'Avatar', 'Gladiator',
  'Shrek', 'Frozen', 'Interstellar', 'Joker',
  'Spielberg', 'Tarantino', 'Nolan', 'Scorsese', 'Hitchcock',
  'Batman', 'Yoda', 'Indiana Jones', 'Forrest Gump',
  'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance',
  'Marvel', 'Star Wars', 'Harry Potter', 'James Bond', 'Disney', 'Pixar',
]

// MUSIC: artists (8) + genres (8) + instruments (7) + concepts (7) = 30.
const MUSIC = [
  'Mozart', 'Beethoven', 'Beatles', 'Madonna',
  'Eminem', 'Beyoncé', 'Drake', 'Adele',
  'Rock', 'Pop', 'Jazz', 'Blues', 'Reggae', 'Hip Hop', 'Classical', 'Country',
  'Piano', 'Guitar', 'Violin', 'Drums', 'Trumpet', 'Saxophone', 'Flute',
  'Chorus', 'Bridge', 'Riff', 'Melody', 'Harmony', 'Rhythm', 'Tempo',
]

// HISTORY: figures (8) + events (5) + eras (5) + empires (6) + treaties (6) = 30.
const HISTORY = [
  'Napoleon', 'Caesar', 'Cleopatra', 'Einstein',
  'Newton', 'Gandhi', 'Lincoln', 'Churchill',
  'World War 1', 'World War 2', 'French Revolution', 'Cold War', 'Industrial Revolution',
  'Renaissance', 'Middle Ages', 'Bronze Age', 'Enlightenment', 'Antiquity',
  'Roman Empire', 'British Empire', 'Ottoman Empire',
  'Mongol Empire', 'Persian Empire', 'Egyptian Empire',
  'Versailles Treaty', 'Magna Carta', 'Geneva Convention',
  'Yalta Conference', 'NATO', 'UN',
]

// TECH: hardware (5) + software (5) + languages (5) + protocols (5) + concepts (10) = 30.
const TECH = [
  'CPU', 'RAM', 'SSD', 'Router', 'Keyboard',
  'Linux', 'Windows', 'iOS', 'Chrome', 'Photoshop',
  'Python', 'Java', 'JavaScript', 'C++', 'Rust',
  'HTTP', 'TCP', 'SSL', 'DNS', 'Bluetooth',
  'Algorithm', 'Encryption', 'Database', 'Cloud', 'AI',
  'Blockchain', 'Firewall', 'Cache', 'Compiler', 'API',
]

// ============================================================================
// TRANSLATABLE POOLS — one 30-item array per locale.
// FOOD: dishes (10) + ingredients (5) + spices (5) + drinks (5) + methods (5)
// ============================================================================

const FOOD = {
  en: [
    'Pizza', 'Sushi', 'Burger', 'Pasta', 'Salad', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagna',
    'Cheese', 'Tomato', 'Onion', 'Garlic', 'Mushroom',
    'Cinnamon', 'Paprika', 'Pepper', 'Cumin', 'Vanilla',
    'Coffee', 'Tea', 'Wine', 'Beer', 'Smoothie',
    'Grilling', 'Frying', 'Baking', 'Roasting', 'Boiling',
  ],
  fr: [
    'Pizza', 'Sushi', 'Burger', 'Pâtes', 'Salade', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagne',
    'Fromage', 'Tomate', 'Oignon', 'Ail', 'Champignon',
    'Cannelle', 'Paprika', 'Poivre', 'Cumin', 'Vanille',
    'Café', 'Thé', 'Vin', 'Bière', 'Smoothie',
    'Grillade', 'Friture', 'Cuisson', 'Rôtissage', 'Ébullition',
  ],
  es: [
    'Pizza', 'Sushi', 'Hamburguesa', 'Pasta', 'Ensalada', 'Bistec', 'Taco', 'Ramen', 'Curri', 'Lasaña',
    'Queso', 'Tomate', 'Cebolla', 'Ajo', 'Champiñón',
    'Canela', 'Pimentón', 'Pimienta', 'Comino', 'Vainilla',
    'Café', 'Té', 'Vino', 'Cerveza', 'Batido',
    'Asado', 'Frito', 'Horneado', 'Tostado', 'Hervido',
  ],
  de: [
    'Pizza', 'Sushi', 'Burger', 'Nudeln', 'Salat', 'Steak', 'Taco', 'Ramen', 'Curry', 'Lasagne',
    'Käse', 'Tomate', 'Zwiebel', 'Knoblauch', 'Pilz',
    'Zimt', 'Paprika', 'Pfeffer', 'Kreuzkümmel', 'Vanille',
    'Kaffee', 'Tee', 'Wein', 'Bier', 'Smoothie',
    'Grillen', 'Braten', 'Backen', 'Rösten', 'Kochen',
  ],
  ar: [
    'بيتزا', 'سوشي', 'برغر', 'مكرونة', 'سلطة', 'ستيك', 'تاكو', 'رامن', 'كاري', 'لازانيا',
    'جبن', 'طماطم', 'بصل', 'ثوم', 'فطر',
    'قرفة', 'بابريكا', 'فلفل', 'كمون', 'فانيلا',
    'قهوة', 'شاي', 'نبيذ', 'جعة', 'عصير',
    'شواء', 'قلي', 'خبز', 'تحميص', 'سلق',
  ],
  it: [
    'Pizza', 'Sushi', 'Hamburger', 'Pasta', 'Insalata', 'Bistecca', 'Taco', 'Ramen', 'Curry', 'Lasagna',
    'Formaggio', 'Pomodoro', 'Cipolla', 'Aglio', 'Fungo',
    'Cannella', 'Paprika', 'Pepe', 'Cumino', 'Vaniglia',
    'Caffè', 'Tè', 'Vino', 'Birra', 'Frullato',
    'Grigliata', 'Frittura', 'Cottura', 'Arrosto', 'Bollitura',
  ],
  pt: [
    'Pizza', 'Sushi', 'Hambúrguer', 'Macarrão', 'Salada', 'Bife', 'Taco', 'Ramen', 'Curry', 'Lasanha',
    'Queijo', 'Tomate', 'Cebola', 'Alho', 'Cogumelo',
    'Canela', 'Páprica', 'Pimenta', 'Cominho', 'Baunilha',
    'Café', 'Chá', 'Vinho', 'Cerveja', 'Vitamina',
    'Grelhar', 'Fritar', 'Assar', 'Tostar', 'Cozinhar',
  ],
  zh: [
    '披萨', '寿司', '汉堡', '意大利面', '沙拉', '牛排', '塔可', '拉面', '咖喱', '千层面',
    '奶酪', '番茄', '洋葱', '大蒜', '蘑菇',
    '肉桂', '红椒粉', '胡椒', '孜然', '香草',
    '咖啡', '茶', '葡萄酒', '啤酒', '冰沙',
    '烧烤', '油炸', '烘焙', '烤制', '煮沸',
  ],
  ru: [
    'Пицца', 'Суши', 'Бургер', 'Паста', 'Салат', 'Стейк', 'Тако', 'Рамен', 'Карри', 'Лазанья',
    'Сыр', 'Помидор', 'Лук', 'Чеснок', 'Гриб',
    'Корица', 'Паприка', 'Перец', 'Тмин', 'Ваниль',
    'Кофе', 'Чай', 'Вино', 'Пиво', 'Смузи',
    'Гриль', 'Жарка', 'Выпечка', 'Запекание', 'Варка',
  ],
  hi: [
    'पिज्जा', 'सुशी', 'बर्गर', 'पास्ता', 'सलाद', 'स्टेक', 'टैको', 'रामेन', 'करी', 'लसान्या',
    'पनीर', 'टमाटर', 'प्याज', 'लहसुन', 'मशरूम',
    'दालचीनी', 'पपरिका', 'काली मिर्च', 'जीरा', 'वैनिला',
    'कॉफी', 'चाय', 'शराब', 'बीयर', 'स्मूदी',
    'ग्रिल', 'तलना', 'बेकिंग', 'भूनना', 'उबालना',
  ],
}

// ANIMALS: species (13) + habitats (5) + groups (5) + behaviors (7) = 30.
const ANIMALS = {
  en: [
    'Lion', 'Tiger', 'Elephant', 'Wolf', 'Eagle', 'Dolphin', 'Shark',
    'Owl', 'Penguin', 'Snake', 'Bee', 'Octopus', 'Spider',
    'Forest', 'Ocean', 'Desert', 'Savanna', 'Jungle',
    'Pack', 'Herd', 'Swarm', 'Flock', 'Pride',
    'Hunting', 'Migration', 'Hibernation', 'Camouflage', 'Roaring', 'Mating', 'Nesting',
  ],
  fr: [
    'Lion', 'Tigre', 'Éléphant', 'Loup', 'Aigle', 'Dauphin', 'Requin',
    'Hibou', 'Manchot', 'Serpent', 'Abeille', 'Poulpe', 'Araignée',
    'Forêt', 'Océan', 'Désert', 'Savane', 'Jungle',
    'Meute', 'Troupeau', 'Essaim', 'Volée', 'Bande',
    'Chasse', 'Migration', 'Hibernation', 'Camouflage', 'Rugissement', 'Accouplement', 'Nidification',
  ],
  es: [
    'León', 'Tigre', 'Elefante', 'Lobo', 'Águila', 'Delfín', 'Tiburón',
    'Búho', 'Pingüino', 'Serpiente', 'Abeja', 'Pulpo', 'Araña',
    'Bosque', 'Océano', 'Desierto', 'Sabana', 'Selva',
    'Manada', 'Rebaño', 'Enjambre', 'Bandada', 'Familia',
    'Caza', 'Migración', 'Hibernación', 'Camuflaje', 'Rugido', 'Apareamiento', 'Anidación',
  ],
  de: [
    'Löwe', 'Tiger', 'Elefant', 'Wolf', 'Adler', 'Delfin', 'Hai',
    'Eule', 'Pinguin', 'Schlange', 'Biene', 'Tintenfisch', 'Spinne',
    'Wald', 'Ozean', 'Wüste', 'Savanne', 'Dschungel',
    'Rudel', 'Herde', 'Schwarm', 'Schar', 'Familie',
    'Jagd', 'Wanderung', 'Winterschlaf', 'Tarnung', 'Brüllen', 'Paarung', 'Nisten',
  ],
  ar: [
    'أسد', 'نمر', 'فيل', 'ذئب', 'نسر', 'دلفين', 'قرش',
    'بومة', 'بطريق', 'ثعبان', 'نحلة', 'أخطبوط', 'عنكبوت',
    'غابة', 'محيط', 'صحراء', 'سافانا', 'أدغال',
    'قطيع', 'سرب', 'مستعمرة', 'عائلة', 'جماعة',
    'صيد', 'هجرة', 'سبات', 'تمويه', 'زئير', 'تزاوج', 'تعشيش',
  ],
  it: [
    'Leone', 'Tigre', 'Elefante', 'Lupo', 'Aquila', 'Delfino', 'Squalo',
    'Gufo', 'Pinguino', 'Serpente', 'Ape', 'Polpo', 'Ragno',
    'Foresta', 'Oceano', 'Deserto', 'Savana', 'Giungla',
    'Branco', 'Mandria', 'Sciame', 'Stormo', 'Famiglia',
    'Caccia', 'Migrazione', 'Letargo', 'Mimetismo', 'Ruggito', 'Accoppiamento', 'Nidificazione',
  ],
  pt: [
    'Leão', 'Tigre', 'Elefante', 'Lobo', 'Águia', 'Golfinho', 'Tubarão',
    'Coruja', 'Pinguim', 'Cobra', 'Abelha', 'Polvo', 'Aranha',
    'Floresta', 'Oceano', 'Deserto', 'Savana', 'Selva',
    'Matilha', 'Rebanho', 'Enxame', 'Bando', 'Família',
    'Caça', 'Migração', 'Hibernação', 'Camuflagem', 'Rugido', 'Acasalamento', 'Nidificação',
  ],
  zh: [
    '狮子', '老虎', '大象', '狼', '老鹰', '海豚', '鲨鱼',
    '猫头鹰', '企鹅', '蛇', '蜜蜂', '章鱼', '蜘蛛',
    '森林', '海洋', '沙漠', '草原', '丛林',
    '狼群', '畜群', '蜂群', '鸟群', '家族',
    '狩猎', '迁徙', '冬眠', '伪装', '咆哮', '交配', '筑巢',
  ],
  ru: [
    'Лев', 'Тигр', 'Слон', 'Волк', 'Орёл', 'Дельфин', 'Акула',
    'Сова', 'Пингвин', 'Змея', 'Пчела', 'Осьминог', 'Паук',
    'Лес', 'Океан', 'Пустыня', 'Саванна', 'Джунгли',
    'Стая', 'Стадо', 'Рой', 'Косяк', 'Семья',
    'Охота', 'Миграция', 'Спячка', 'Камуфляж', 'Рык', 'Спаривание', 'Гнездование',
  ],
  hi: [
    'शेर', 'बाघ', 'हाथी', 'भेड़िया', 'चील', 'डॉल्फिन', 'शार्क',
    'उल्लू', 'पेंगुइन', 'साँप', 'मधुमक्खी', 'ऑक्टोपस', 'मकड़ी',
    'जंगल', 'समुद्र', 'रेगिस्तान', 'सवाना', 'वर्षावन',
    'झुंड', 'समूह', 'जत्था', 'दल', 'परिवार',
    'शिकार', 'प्रवास', 'शीतनिद्रा', 'छलावरण', 'दहाड़', 'संभोग', 'घोंसला',
  ],
}

// PLACES: cities (7) + landmarks (6) + natural sites (6) + regions (5) + fictional (6) = 30.
const PLACES = {
  en: [
    'Paris', 'Tokyo', 'New York', 'London', 'Rome', 'Cairo', 'Sydney',
    'Eiffel Tower', 'Pyramids', 'Colosseum', 'Statue of Liberty', 'Big Ben', 'Great Wall',
    'Mount Everest', 'Sahara', 'Amazon', 'Grand Canyon', 'Niagara Falls', 'Alps',
    'Asia', 'Europe', 'Africa', 'Caribbean', 'Antarctica',
    'Hogwarts', 'Narnia', 'Atlantis', 'Wakanda', 'Middle Earth', 'Westeros',
  ],
  fr: [
    'Paris', 'Tokyo', 'New York', 'Londres', 'Rome', 'Le Caire', 'Sydney',
    'Tour Eiffel', 'Pyramides', 'Colisée', 'Statue de la Liberté', 'Big Ben', 'Grande Muraille',
    'Mont Everest', 'Sahara', 'Amazone', 'Grand Canyon', 'Chutes du Niagara', 'Alpes',
    'Asie', 'Europe', 'Afrique', 'Caraïbes', 'Antarctique',
    'Poudlard', 'Narnia', 'Atlantide', 'Wakanda', 'Terre du Milieu', 'Westeros',
  ],
  es: [
    'París', 'Tokio', 'Nueva York', 'Londres', 'Roma', 'El Cairo', 'Sídney',
    'Torre Eiffel', 'Pirámides', 'Coliseo', 'Estatua de la Libertad', 'Big Ben', 'Gran Muralla',
    'Monte Everest', 'Sahara', 'Amazonas', 'Gran Cañón', 'Cataratas del Niágara', 'Alpes',
    'Asia', 'Europa', 'África', 'Caribe', 'Antártida',
    'Hogwarts', 'Narnia', 'Atlántida', 'Wakanda', 'Tierra Media', 'Poniente',
  ],
  de: [
    'Paris', 'Tokio', 'New York', 'London', 'Rom', 'Kairo', 'Sydney',
    'Eiffelturm', 'Pyramiden', 'Kolosseum', 'Freiheitsstatue', 'Big Ben', 'Chinesische Mauer',
    'Mount Everest', 'Sahara', 'Amazonas', 'Grand Canyon', 'Niagarafälle', 'Alpen',
    'Asien', 'Europa', 'Afrika', 'Karibik', 'Antarktis',
    'Hogwarts', 'Narnia', 'Atlantis', 'Wakanda', 'Mittelerde', 'Westeros',
  ],
  ar: [
    'باريس', 'طوكيو', 'نيويورك', 'لندن', 'روما', 'القاهرة', 'سيدني',
    'برج إيفل', 'الأهرامات', 'الكولوسيوم', 'تمثال الحرية', 'بيغ بن', 'سور الصين',
    'إيفرست', 'الصحراء', 'الأمازون', 'جراند كانيون', 'شلالات نياجرا', 'جبال الألب',
    'آسيا', 'أوروبا', 'أفريقيا', 'الكاريبي', 'القطب الجنوبي',
    'هوغوورتس', 'نارنيا', 'أتلانتس', 'واكاندا', 'الأرض الوسطى', 'ويستروس',
  ],
  it: [
    'Parigi', 'Tokyo', 'New York', 'Londra', 'Roma', 'Il Cairo', 'Sydney',
    'Torre Eiffel', 'Piramidi', 'Colosseo', 'Statua della Libertà', 'Big Ben', 'Grande Muraglia',
    'Monte Everest', 'Sahara', 'Rio delle Amazzoni', 'Grand Canyon', 'Cascate del Niagara', 'Alpi',
    'Asia', 'Europa', 'Africa', 'Caraibi', 'Antartide',
    'Hogwarts', 'Narnia', 'Atlantide', 'Wakanda', 'Terra di Mezzo', 'Westeros',
  ],
  pt: [
    'Paris', 'Tóquio', 'Nova York', 'Londres', 'Roma', 'Cairo', 'Sydney',
    'Torre Eiffel', 'Pirâmides', 'Coliseu', 'Estátua da Liberdade', 'Big Ben', 'Grande Muralha',
    'Monte Everest', 'Saara', 'Amazonas', 'Grand Canyon', 'Cataratas do Niágara', 'Alpes',
    'Ásia', 'Europa', 'África', 'Caribe', 'Antártida',
    'Hogwarts', 'Nárnia', 'Atlântida', 'Wakanda', 'Terra Média', 'Westeros',
  ],
  zh: [
    '巴黎', '东京', '纽约', '伦敦', '罗马', '开罗', '悉尼',
    '埃菲尔铁塔', '金字塔', '罗马斗兽场', '自由女神像', '大本钟', '长城',
    '珠穆朗玛峰', '撒哈拉', '亚马逊', '大峡谷', '尼亚加拉瀑布', '阿尔卑斯',
    '亚洲', '欧洲', '非洲', '加勒比', '南极洲',
    '霍格沃茨', '纳尼亚', '亚特兰蒂斯', '瓦坎达', '中土世界', '维斯特洛',
  ],
  ru: [
    'Париж', 'Токио', 'Нью-Йорк', 'Лондон', 'Рим', 'Каир', 'Сидней',
    'Эйфелева башня', 'Пирамиды', 'Колизей', 'Статуя Свободы', 'Биг-Бен', 'Великая стена',
    'Эверест', 'Сахара', 'Амазонка', 'Гранд-Каньон', 'Ниагарский водопад', 'Альпы',
    'Азия', 'Европа', 'Африка', 'Карибы', 'Антарктида',
    'Хогвартс', 'Нарния', 'Атлантида', 'Ваканда', 'Средиземье', 'Вестерос',
  ],
  hi: [
    'पेरिस', 'टोक्यो', 'न्यूयॉर्क', 'लंदन', 'रोम', 'काहिरा', 'सिडनी',
    'एफिल टॉवर', 'पिरामिड', 'कोलोसियम', 'स्टैच्यू ऑफ लिबर्टी', 'बिग बेन', 'चीन की दीवार',
    'एवरेस्ट', 'सहारा', 'अमेज़न', 'ग्रांड कैन्यन', 'नायग्रा फॉल्स', 'आल्प्स',
    'एशिया', 'यूरोप', 'अफ्रीका', 'कैरेबियन', 'अंटार्कटिका',
    'हॉगवर्ट्स', 'नार्निया', 'अटलांटिस', 'वकांडा', 'मध्य पृथ्वी', 'वेस्टरोस',
  ],
}

// JOBS: professions (7) + roles (6) + modern trades (6) + creative (6) + historical (5) = 30.
const JOBS = {
  en: [
    'Doctor', 'Teacher', 'Engineer', 'Lawyer', 'Chef', 'Pilot', 'Nurse',
    'Police', 'Firefighter', 'Soldier', 'Detective', 'Astronaut', 'Manager',
    'Plumber', 'Electrician', 'Carpenter', 'Mechanic', 'Baker', 'Programmer',
    'Artist', 'Musician', 'Writer', 'Photographer', 'Architect', 'Journalist',
    'Blacksmith', 'Knight', 'Sailor', 'Farmer', 'Hunter',
  ],
  fr: [
    'Médecin', 'Professeur', 'Ingénieur', 'Avocat', 'Cuisinier', 'Pilote', 'Infirmier',
    'Policier', 'Pompier', 'Soldat', 'Détective', 'Astronaute', 'Manager',
    'Plombier', 'Électricien', 'Charpentier', 'Mécanicien', 'Boulanger', 'Programmeur',
    'Artiste', 'Musicien', 'Écrivain', 'Photographe', 'Architecte', 'Journaliste',
    'Forgeron', 'Chevalier', 'Marin', 'Agriculteur', 'Chasseur',
  ],
  es: [
    'Médico', 'Profesor', 'Ingeniero', 'Abogado', 'Chef', 'Piloto', 'Enfermero',
    'Policía', 'Bombero', 'Soldado', 'Detective', 'Astronauta', 'Gerente',
    'Fontanero', 'Electricista', 'Carpintero', 'Mecánico', 'Panadero', 'Programador',
    'Artista', 'Músico', 'Escritor', 'Fotógrafo', 'Arquitecto', 'Periodista',
    'Herrero', 'Caballero', 'Marinero', 'Granjero', 'Cazador',
  ],
  de: [
    'Arzt', 'Lehrer', 'Ingenieur', 'Anwalt', 'Koch', 'Pilot', 'Krankenschwester',
    'Polizist', 'Feuerwehrmann', 'Soldat', 'Detektiv', 'Astronaut', 'Manager',
    'Klempner', 'Elektriker', 'Tischler', 'Mechaniker', 'Bäcker', 'Programmierer',
    'Künstler', 'Musiker', 'Schriftsteller', 'Fotograf', 'Architekt', 'Journalist',
    'Schmied', 'Ritter', 'Seemann', 'Bauer', 'Jäger',
  ],
  ar: [
    'طبيب', 'معلم', 'مهندس', 'محامي', 'طاهي', 'طيار', 'ممرض',
    'شرطي', 'إطفائي', 'جندي', 'محقق', 'رائد فضاء', 'مدير',
    'سباك', 'كهربائي', 'نجار', 'ميكانيكي', 'خباز', 'مبرمج',
    'فنان', 'موسيقي', 'كاتب', 'مصور', 'معماري', 'صحفي',
    'حداد', 'فارس', 'بحار', 'مزارع', 'صياد',
  ],
  it: [
    'Medico', 'Insegnante', 'Ingegnere', 'Avvocato', 'Cuoco', 'Pilota', 'Infermiere',
    'Poliziotto', 'Pompiere', 'Soldato', 'Detective', 'Astronauta', 'Manager',
    'Idraulico', 'Elettricista', 'Falegname', 'Meccanico', 'Fornaio', 'Programmatore',
    'Artista', 'Musicista', 'Scrittore', 'Fotografo', 'Architetto', 'Giornalista',
    'Fabbro', 'Cavaliere', 'Marinaio', 'Contadino', 'Cacciatore',
  ],
  pt: [
    'Médico', 'Professor', 'Engenheiro', 'Advogado', 'Chef', 'Piloto', 'Enfermeiro',
    'Policial', 'Bombeiro', 'Soldado', 'Detetive', 'Astronauta', 'Gerente',
    'Encanador', 'Eletricista', 'Carpinteiro', 'Mecânico', 'Padeiro', 'Programador',
    'Artista', 'Músico', 'Escritor', 'Fotógrafo', 'Arquiteto', 'Jornalista',
    'Ferreiro', 'Cavaleiro', 'Marinheiro', 'Fazendeiro', 'Caçador',
  ],
  zh: [
    '医生', '老师', '工程师', '律师', '厨师', '飞行员', '护士',
    '警察', '消防员', '士兵', '侦探', '宇航员', '经理',
    '水管工', '电工', '木匠', '机械师', '面包师', '程序员',
    '艺术家', '音乐家', '作家', '摄影师', '建筑师', '记者',
    '铁匠', '骑士', '水手', '农民', '猎人',
  ],
  ru: [
    'Врач', 'Учитель', 'Инженер', 'Юрист', 'Повар', 'Пилот', 'Медсестра',
    'Полицейский', 'Пожарный', 'Солдат', 'Детектив', 'Космонавт', 'Менеджер',
    'Сантехник', 'Электрик', 'Плотник', 'Механик', 'Пекарь', 'Программист',
    'Художник', 'Музыкант', 'Писатель', 'Фотограф', 'Архитектор', 'Журналист',
    'Кузнец', 'Рыцарь', 'Моряк', 'Фермер', 'Охотник',
  ],
  hi: [
    'डॉक्टर', 'शिक्षक', 'इंजीनियर', 'वकील', 'शेफ', 'पायलट', 'नर्स',
    'पुलिस', 'अग्निशामक', 'सैनिक', 'जासूस', 'अंतरिक्ष यात्री', 'प्रबंधक',
    'प्लंबर', 'इलेक्ट्रीशियन', 'बढ़ई', 'मैकेनिक', 'बेकर', 'प्रोग्रामर',
    'कलाकार', 'संगीतकार', 'लेखक', 'फोटोग्राफर', 'वास्तुकार', 'पत्रकार',
    'लोहार', 'योद्धा', 'नाविक', 'किसान', 'शिकारी',
  ],
}

// SPORTS: sports (8) + positions (4) + equipment (6) + events (5) + venues (7) = 30.
const SPORTS = {
  en: [
    'Soccer', 'Basketball', 'Tennis', 'Baseball', 'Boxing', 'Golf', 'Hockey', 'Rugby',
    'Goalkeeper', 'Striker', 'Defender', 'Quarterback',
    'Ball', 'Racket', 'Bat', 'Helmet', 'Gloves', 'Skates',
    'Olympics', 'World Cup', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Stadium', 'Arena', 'Court', 'Field', 'Track', 'Pitch', 'Pool',
  ],
  fr: [
    'Football', 'Basketball', 'Tennis', 'Baseball', 'Boxe', 'Golf', 'Hockey', 'Rugby',
    'Gardien', 'Attaquant', 'Défenseur', 'Quarterback',
    'Ballon', 'Raquette', 'Batte', 'Casque', 'Gants', 'Patins',
    'Jeux Olympiques', 'Coupe du Monde', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Stade', 'Aréna', 'Court', 'Terrain', 'Piste', 'Pelouse', 'Piscine',
  ],
  es: [
    'Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Boxeo', 'Golf', 'Hockey', 'Rugby',
    'Portero', 'Delantero', 'Defensa', 'Mariscal',
    'Pelota', 'Raqueta', 'Bate', 'Casco', 'Guantes', 'Patines',
    'Olimpiadas', 'Copa Mundial', 'Maratón', 'Super Bowl', 'Wimbledon',
    'Estadio', 'Arena', 'Cancha', 'Campo', 'Pista', 'Césped', 'Piscina',
  ],
  de: [
    'Fußball', 'Basketball', 'Tennis', 'Baseball', 'Boxen', 'Golf', 'Hockey', 'Rugby',
    'Torwart', 'Stürmer', 'Verteidiger', 'Quarterback',
    'Ball', 'Schläger', 'Schlagholz', 'Helm', 'Handschuhe', 'Schlittschuhe',
    'Olympia', 'Weltmeisterschaft', 'Marathon', 'Super Bowl', 'Wimbledon',
    'Stadion', 'Arena', 'Platz', 'Feld', 'Bahn', 'Rasen', 'Pool',
  ],
  ar: [
    'كرة القدم', 'كرة السلة', 'تنس', 'بيسبول', 'ملاكمة', 'غولف', 'هوكي', 'رغبي',
    'حارس مرمى', 'مهاجم', 'مدافع', 'لاعب وسط',
    'كرة', 'مضرب', 'عصا', 'خوذة', 'قفازات', 'زلاجات',
    'الأولمبياد', 'كأس العالم', 'ماراثون', 'سوبر بول', 'ويمبلدون',
    'ملعب', 'حلبة', 'محكمة', 'حقل', 'مضمار', 'عشب', 'مسبح',
  ],
  it: [
    'Calcio', 'Pallacanestro', 'Tennis', 'Baseball', 'Pugilato', 'Golf', 'Hockey', 'Rugby',
    'Portiere', 'Attaccante', 'Difensore', 'Quarterback',
    'Palla', 'Racchetta', 'Mazza', 'Casco', 'Guanti', 'Pattini',
    'Olimpiadi', 'Coppa del Mondo', 'Maratona', 'Super Bowl', 'Wimbledon',
    'Stadio', 'Arena', 'Campo', 'Terreno', 'Pista', 'Prato', 'Piscina',
  ],
  pt: [
    'Futebol', 'Basquete', 'Tênis', 'Beisebol', 'Boxe', 'Golfe', 'Hóquei', 'Rúgbi',
    'Goleiro', 'Atacante', 'Zagueiro', 'Quarterback',
    'Bola', 'Raquete', 'Taco', 'Capacete', 'Luvas', 'Patins',
    'Olimpíadas', 'Copa do Mundo', 'Maratona', 'Super Bowl', 'Wimbledon',
    'Estádio', 'Arena', 'Quadra', 'Campo', 'Pista', 'Gramado', 'Piscina',
  ],
  zh: [
    '足球', '篮球', '网球', '棒球', '拳击', '高尔夫', '曲棍球', '橄榄球',
    '守门员', '前锋', '后卫', '四分卫',
    '球', '球拍', '球棒', '头盔', '手套', '溜冰鞋',
    '奥运会', '世界杯', '马拉松', '超级碗', '温布尔登',
    '体育场', '竞技场', '球场', '场地', '跑道', '草坪', '游泳池',
  ],
  ru: [
    'Футбол', 'Баскетбол', 'Теннис', 'Бейсбол', 'Бокс', 'Гольф', 'Хоккей', 'Регби',
    'Вратарь', 'Нападающий', 'Защитник', 'Квотербек',
    'Мяч', 'Ракетка', 'Бита', 'Шлем', 'Перчатки', 'Коньки',
    'Олимпиада', 'Чемпионат мира', 'Марафон', 'Супербоул', 'Уимблдон',
    'Стадион', 'Арена', 'Корт', 'Поле', 'Дорожка', 'Газон', 'Бассейн',
  ],
  hi: [
    'फुटबॉल', 'बास्केटबॉल', 'टेनिस', 'बेसबॉल', 'मुक्केबाज़ी', 'गोल्फ', 'हॉकी', 'रग्बी',
    'गोलकीपर', 'स्ट्राइकर', 'डिफेंडर', 'क्वार्टरबैक',
    'गेंद', 'रैकेट', 'बैट', 'हेलमेट', 'दस्ताने', 'स्केट्स',
    'ओलंपिक', 'विश्व कप', 'मैराथन', 'सुपर बाउल', 'विंबलडन',
    'स्टेडियम', 'अखाड़ा', 'कोर्ट', 'मैदान', 'ट्रैक', 'घास का मैदान', 'पूल',
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
  ],
  fr: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Noël', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
  ],
  es: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Navidad', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
  ],
  de: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WLAN', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Weihnachten', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
  ],
  ar: [
    'آيفون', 'أندرويد', 'جوجل', 'آبل', 'نتفليكس', 'ديزني+',
    'تيك توك', 'إنستغرام', 'تسلا', 'فيراري', 'بيتكوين', 'إيثيريوم',
    'واي فاي', 'بلوتوث', 'ماريو', 'سونيك', 'بوكيمون', 'ماين كرافت',
    'روبلوكس', 'إكس بوكس', 'بلايستيشن', 'عيد الميلاد', 'هالوين', 'يوغا',
    'بيلاتس', 'كوكا كولا', 'بيبسي', 'نايكي', 'أديداس', 'أوبر',
  ],
  it: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Natale', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
  ],
  pt: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Mario', 'Sonic', 'Pokémon', 'Minecraft',
    'Roblox', 'Xbox', 'PlayStation', 'Natal', 'Halloween', 'Yoga',
    'Pilates', 'Coca Cola', 'Pepsi', 'Nike', 'Adidas', 'Uber',
  ],
  zh: [
    'iPhone', '安卓', '谷歌', '苹果', '网飞', '迪士尼+',
    '抖音', '照片墙', '特斯拉', '法拉利', '比特币', '以太坊',
    'WiFi', '蓝牙', '马里奥', '索尼克', '宝可梦', '我的世界',
    'Roblox', 'Xbox', 'PlayStation', '圣诞节', '万圣节', '瑜伽',
    '普拉提', '可口可乐', '百事可乐', '耐克', '阿迪达斯', '优步',
  ],
  ru: [
    'iPhone', 'Android', 'Google', 'Apple', 'Netflix', 'Disney+',
    'TikTok', 'Instagram', 'Tesla', 'Ferrari', 'Bitcoin', 'Ethereum',
    'WiFi', 'Bluetooth', 'Марио', 'Соник', 'Покемон', 'Майнкрафт',
    'Roblox', 'Xbox', 'PlayStation', 'Рождество', 'Хэллоуин', 'Йога',
    'Пилатес', 'Кока-Кола', 'Пепси', 'Найк', 'Адидас', 'Убер',
  ],
  hi: [
    'आईफोन', 'एंड्रॉयड', 'गूगल', 'एप्पल', 'नेटफ्लिक्स', 'डिज्नी+',
    'टिकटॉक', 'इंस्टाग्राम', 'टेस्ला', 'फेरारी', 'बिटकॉइन', 'एथेरियम',
    'वाईफाई', 'ब्लूटूथ', 'मारियो', 'सोनिक', 'पोकेमोन', 'माइनक्राफ्ट',
    'रोब्लॉक्स', 'एक्सबॉक्स', 'प्लेस्टेशन', 'क्रिसमस', 'हैलोवीन', 'योग',
    'पिलाटे', 'कोका कोला', 'पेप्सी', 'नाइकी', 'एडिडास', 'उबर',
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
// Pair generation: all C(30,2) = 435 unordered pairs in stable index order.
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

const HEADER = `import type { WordCategory } from './types'

/**
 * Word pairs for offline / pass-and-play mode.
 * Each pair has a villagerWord and an redHandedWord -- similar but distinct.
 *
 * Generated by scripts/generate-offline-words.mjs from rich, diverse 30-item
 * pools per (locale, category). Each pool mixes sub-types so any pair shares
 * the category umbrella. Emits all C(30,2) = 435 pairs.
 *
 * 10 locales x 12 categories x 435 pairs = 52,200 pairs total.
 */
export interface OfflineWordPair {
  villagerWord: string
  redHandedWord: string
}
`

const LOCALE_CONST = {
  en: 'OFFLINE_WORD_PAIRS',
  fr: 'FR_PAIRS',
  es: 'ES_PAIRS',
  de: 'DE_PAIRS',
  ar: 'AR_PAIRS',
  it: 'IT_PAIRS',
  pt: 'PT_PAIRS',
  zh: 'ZH_PAIRS',
  ru: 'RU_PAIRS',
  hi: 'HI_PAIRS',
}

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
  ru: RU_PAIRS,
  hi: HI_PAIRS,
}

/**
 * Pick a random word pair from the given categories and locale.
 * Falls back to English if locale data is not available.
 */
export function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
  locale?: string,
): OfflineWordPair & { category: WordCategory } {
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
  return { ...shuffledPairs[0], category }
}
`

const chunks = [HEADER]
let totalPairs = 0
for (const locale of LOCALES) {
  const name = LOCALE_CONST[locale]
  const keyword = locale === 'en' ? 'export const' : 'const'
  chunks.push(
    `\n${keyword} ${name}: Record<WordCategory, OfflineWordPair[]> = ${renderRecord(locale)}\n`,
  )
  for (const cat of CATEGORY_ORDER) {
    totalPairs += pairsForLocaleCategory(cat, locale).length
  }
}
chunks.push(FOOTER)

writeFileSync(OUT, chunks.join(''), 'utf8')
console.log(`Wrote ${OUT}`)
console.log(`${LOCALES.length} locales x ${CATEGORY_ORDER.length} categories x 435 pairs = ${totalPairs} total`)
