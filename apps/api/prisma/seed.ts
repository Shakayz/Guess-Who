import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORD_PAIRS = [
  // ── Food ────────────────────────────────────────────────────────────────────
  { wordA: 'Apple',        wordB: 'Pear',          difficulty: 'easy',   category: 'food' },
  { wordA: 'Chocolate',    wordB: 'Caramel',        difficulty: 'medium', category: 'food' },
  { wordA: 'Pizza',        wordB: 'Flatbread',      difficulty: 'easy',   category: 'food' },
  { wordA: 'Burger',       wordB: 'Sandwich',       difficulty: 'easy',   category: 'food' },
  { wordA: 'Sushi',        wordB: 'Sashimi',        difficulty: 'hard',   category: 'food' },
  { wordA: 'Croissant',    wordB: 'Muffin',         difficulty: 'medium', category: 'food' },
  { wordA: 'Ice Cream',    wordB: 'Sorbet',         difficulty: 'medium', category: 'food' },
  { wordA: 'Steak',        wordB: 'Ribs',           difficulty: 'medium', category: 'food' },
  { wordA: 'Pasta',        wordB: 'Noodles',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Taco',         wordB: 'Burrito',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Waffle',       wordB: 'Pancake',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Curry',        wordB: 'Stew',           difficulty: 'medium', category: 'food' },
  { wordA: 'Donut',        wordB: 'Bagel',          difficulty: 'easy',   category: 'food' },
  { wordA: 'Ramen',        wordB: 'Pho',            difficulty: 'medium', category: 'food' },
  { wordA: 'Cheesecake',   wordB: 'Tiramisu',       difficulty: 'medium', category: 'food' },
  { wordA: 'Kebab',        wordB: 'Shawarma',       difficulty: 'medium', category: 'food' },
  { wordA: 'Brownie',      wordB: 'Cookie',         difficulty: 'easy',   category: 'food' },
  { wordA: 'Falafel',      wordB: 'Hummus',         difficulty: 'medium', category: 'food' },
  { wordA: 'Salad',        wordB: 'Coleslaw',       difficulty: 'easy',   category: 'food' },
  { wordA: 'Pancake',      wordB: 'Crepe',          difficulty: 'easy',   category: 'food' },

  // ── Animals ─────────────────────────────────────────────────────────────────
  { wordA: 'Dog',          wordB: 'Wolf',           difficulty: 'easy',   category: 'animals' },
  { wordA: 'Lion',         wordB: 'Tiger',          difficulty: 'easy',   category: 'animals' },
  { wordA: 'Dolphin',      wordB: 'Porpoise',       difficulty: 'hard',   category: 'animals' },
  { wordA: 'Rabbit',       wordB: 'Hare',           difficulty: 'medium', category: 'animals' },
  { wordA: 'Crow',         wordB: 'Raven',          difficulty: 'medium', category: 'animals' },
  { wordA: 'Cat',          wordB: 'Lynx',           difficulty: 'medium', category: 'animals' },
  { wordA: 'Horse',        wordB: 'Donkey',         difficulty: 'easy',   category: 'animals' },
  { wordA: 'Elephant',     wordB: 'Mammoth',        difficulty: 'hard',   category: 'animals' },
  { wordA: 'Penguin',      wordB: 'Puffin',         difficulty: 'hard',   category: 'animals' },
  { wordA: 'Shark',        wordB: 'Barracuda',      difficulty: 'hard',   category: 'animals' },
  { wordA: 'Crocodile',    wordB: 'Alligator',      difficulty: 'hard',   category: 'animals' },
  { wordA: 'Cheetah',      wordB: 'Leopard',        difficulty: 'medium', category: 'animals' },
  { wordA: 'Owl',          wordB: 'Hawk',           difficulty: 'medium', category: 'animals' },
  { wordA: 'Gorilla',      wordB: 'Chimpanzee',     difficulty: 'medium', category: 'animals' },
  { wordA: 'Polar Bear',   wordB: 'Grizzly Bear',   difficulty: 'medium', category: 'animals' },
  { wordA: 'Flamingo',     wordB: 'Pelican',        difficulty: 'medium', category: 'animals' },
  { wordA: 'Cobra',        wordB: 'Viper',          difficulty: 'hard',   category: 'animals' },
  { wordA: 'Camel',        wordB: 'Llama',          difficulty: 'medium', category: 'animals' },
  { wordA: 'Seal',         wordB: 'Walrus',         difficulty: 'medium', category: 'animals' },
  { wordA: 'Parrot',       wordB: 'Toucan',         difficulty: 'easy',   category: 'animals' },

  // ── Music ────────────────────────────────────────────────────────────────────
  { wordA: 'Guitar',       wordB: 'Violin',         difficulty: 'medium', category: 'music' },
  { wordA: 'Piano',        wordB: 'Organ',          difficulty: 'medium', category: 'music' },
  { wordA: 'Drums',        wordB: 'Bongos',         difficulty: 'medium', category: 'music' },
  { wordA: 'Trumpet',      wordB: 'Trombone',       difficulty: 'hard',   category: 'music' },
  { wordA: 'Flute',        wordB: 'Recorder',       difficulty: 'medium', category: 'music' },
  { wordA: 'Hip-Hop',      wordB: 'Rap',            difficulty: 'easy',   category: 'music' },
  { wordA: 'Jazz',         wordB: 'Blues',          difficulty: 'medium', category: 'music' },
  { wordA: 'Opera',        wordB: 'Musical',        difficulty: 'hard',   category: 'music' },
  { wordA: 'DJ',           wordB: 'Producer',       difficulty: 'medium', category: 'music' },
  { wordA: 'Rock',         wordB: 'Metal',          difficulty: 'medium', category: 'music' },
  { wordA: 'Saxophone',    wordB: 'Clarinet',       difficulty: 'hard',   category: 'music' },
  { wordA: 'Harp',         wordB: 'Lute',           difficulty: 'hard',   category: 'music' },
  { wordA: 'Classical',    wordB: 'Baroque',        difficulty: 'hard',   category: 'music' },
  { wordA: 'Pop',          wordB: 'R&B',            difficulty: 'easy',   category: 'music' },
  { wordA: 'Country',      wordB: 'Folk',           difficulty: 'medium', category: 'music' },
  { wordA: 'Electronic',   wordB: 'Techno',         difficulty: 'medium', category: 'music' },
  { wordA: 'Reggae',       wordB: 'Ska',            difficulty: 'hard',   category: 'music' },
  { wordA: 'Bass Guitar',  wordB: 'Cello',          difficulty: 'medium', category: 'music' },
  { wordA: 'Banjo',        wordB: 'Mandolin',       difficulty: 'hard',   category: 'music' },
  { wordA: 'Concert',      wordB: 'Gig',            difficulty: 'medium', category: 'music' },

  // ── Places ───────────────────────────────────────────────────────────────────
  { wordA: 'Castle',       wordB: 'Fort',           difficulty: 'medium', category: 'places' },
  { wordA: 'Library',      wordB: 'Bookstore',      difficulty: 'medium', category: 'places' },
  { wordA: 'Museum',       wordB: 'Gallery',        difficulty: 'medium', category: 'places' },
  { wordA: 'Hospital',     wordB: 'Clinic',         difficulty: 'easy',   category: 'places' },
  { wordA: 'Airport',      wordB: 'Train Station',  difficulty: 'easy',   category: 'places' },
  { wordA: 'Park',         wordB: 'Garden',         difficulty: 'easy',   category: 'places' },
  { wordA: 'Temple',       wordB: 'Church',         difficulty: 'medium', category: 'places' },
  { wordA: 'Prison',       wordB: 'Dungeon',        difficulty: 'medium', category: 'places' },
  { wordA: 'Stadium',      wordB: 'Arena',          difficulty: 'medium', category: 'places' },
  { wordA: 'School',       wordB: 'University',     difficulty: 'easy',   category: 'places' },
  { wordA: 'Palace',       wordB: 'Mansion',        difficulty: 'medium', category: 'places' },
  { wordA: 'Lighthouse',   wordB: 'Watchtower',     difficulty: 'hard',   category: 'places' },
  { wordA: 'Harbor',       wordB: 'Dock',           difficulty: 'medium', category: 'places' },
  { wordA: 'Bakery',       wordB: 'Patisserie',     difficulty: 'medium', category: 'places' },
  { wordA: 'Theater',      wordB: 'Cinema',         difficulty: 'easy',   category: 'places' },
  { wordA: 'Zoo',          wordB: 'Aquarium',       difficulty: 'easy',   category: 'places' },
  { wordA: 'Market',       wordB: 'Bazaar',         difficulty: 'medium', category: 'places' },
  { wordA: 'Monastery',    wordB: 'Convent',        difficulty: 'hard',   category: 'places' },
  { wordA: 'Gym',          wordB: 'Spa',            difficulty: 'easy',   category: 'places' },
  { wordA: 'Brewery',      wordB: 'Winery',         difficulty: 'medium', category: 'places' },

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  { wordA: 'Doctor',       wordB: 'Nurse',          difficulty: 'medium', category: 'jobs' },
  { wordA: 'Astronaut',    wordB: 'Cosmonaut',      difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Chef',         wordB: 'Cook',           difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Lawyer',       wordB: 'Solicitor',      difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Teacher',      wordB: 'Professor',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Pilot',        wordB: 'Co-Pilot',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Detective',    wordB: 'Inspector',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Firefighter',  wordB: 'Paramedic',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Architect',    wordB: 'Engineer',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Journalist',   wordB: 'Reporter',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Surgeon',      wordB: 'Dentist',        difficulty: 'medium', category: 'jobs' },
  { wordA: 'Magician',     wordB: 'Illusionist',    difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Actor',        wordB: 'Director',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Artist',       wordB: 'Musician',       difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Athlete',      wordB: 'Coach',          difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Scientist',    wordB: 'Researcher',     difficulty: 'medium', category: 'jobs' },
  { wordA: 'Policeman',    wordB: 'Guard',          difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Farmer',       wordB: 'Shepherd',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Plumber',      wordB: 'Electrician',    difficulty: 'medium', category: 'jobs' },
  { wordA: 'Judge',        wordB: 'Senator',        difficulty: 'hard',   category: 'jobs' },

  // ── Sports ───────────────────────────────────────────────────────────────────
  { wordA: 'Football',     wordB: 'Rugby',          difficulty: 'medium', category: 'sports' },
  { wordA: 'Tennis',       wordB: 'Badminton',      difficulty: 'medium', category: 'sports' },
  { wordA: 'Swimming',     wordB: 'Diving',         difficulty: 'easy',   category: 'sports' },
  { wordA: 'Boxing',       wordB: 'Wrestling',      difficulty: 'medium', category: 'sports' },
  { wordA: 'Basketball',   wordB: 'Volleyball',     difficulty: 'easy',   category: 'sports' },
  { wordA: 'Golf',         wordB: 'Croquet',        difficulty: 'hard',   category: 'sports' },
  { wordA: 'Skiing',       wordB: 'Snowboarding',   difficulty: 'medium', category: 'sports' },
  { wordA: 'Surfing',      wordB: 'Wakeboarding',   difficulty: 'hard',   category: 'sports' },
  { wordA: 'Cycling',      wordB: 'Triathlon',      difficulty: 'hard',   category: 'sports' },
  { wordA: 'Archery',      wordB: 'Darts',          difficulty: 'medium', category: 'sports' },
  { wordA: 'Judo',         wordB: 'Karate',         difficulty: 'medium', category: 'sports' },
  { wordA: 'Baseball',     wordB: 'Cricket',        difficulty: 'medium', category: 'sports' },
  { wordA: 'Marathon',     wordB: 'Sprint',         difficulty: 'medium', category: 'sports' },
  { wordA: 'Ice Hockey',   wordB: 'Field Hockey',   difficulty: 'medium', category: 'sports' },
  { wordA: 'Table Tennis', wordB: 'Squash',         difficulty: 'medium', category: 'sports' },
  { wordA: 'Gymnastics',   wordB: 'Cheerleading',   difficulty: 'medium', category: 'sports' },
  { wordA: 'Rowing',       wordB: 'Kayaking',       difficulty: 'medium', category: 'sports' },
  { wordA: 'Fencing',      wordB: 'Taekwondo',      difficulty: 'hard',   category: 'sports' },
  { wordA: 'Handball',     wordB: 'Lacrosse',       difficulty: 'hard',   category: 'sports' },
  { wordA: 'Weightlifting',wordB: 'CrossFit',       difficulty: 'medium', category: 'sports' },

  // ── Movies ───────────────────────────────────────────────────────────────────
  { wordA: 'Comedy',       wordB: 'Satire',         difficulty: 'hard',   category: 'movies' },
  { wordA: 'Thriller',     wordB: 'Horror',         difficulty: 'medium', category: 'movies' },
  { wordA: 'Animation',    wordB: 'Cartoon',        difficulty: 'easy',   category: 'movies' },
  { wordA: 'Action',       wordB: 'Adventure',      difficulty: 'easy',   category: 'movies' },
  { wordA: 'Sci-Fi',       wordB: 'Fantasy',        difficulty: 'medium', category: 'movies' },
  { wordA: 'Romance',      wordB: 'Drama',          difficulty: 'medium', category: 'movies' },
  { wordA: 'Documentary',  wordB: 'Biopic',         difficulty: 'hard',   category: 'movies' },
  { wordA: 'Western',      wordB: 'Epic',           difficulty: 'hard',   category: 'movies' },
  { wordA: 'Heist',        wordB: 'Spy',            difficulty: 'medium', category: 'movies' },
  { wordA: 'Superhero',    wordB: 'Villain',        difficulty: 'easy',   category: 'movies' },
  { wordA: 'Star Wars',    wordB: 'Star Trek',      difficulty: 'medium', category: 'movies' },
  { wordA: 'Harry Potter', wordB: 'Lord of the Rings', difficulty: 'easy', category: 'movies' },
  { wordA: 'Inception',    wordB: 'Interstellar',   difficulty: 'medium', category: 'movies' },
  { wordA: 'The Godfather',wordB: 'Scarface',       difficulty: 'medium', category: 'movies' },
  { wordA: 'Jurassic Park',wordB: 'King Kong',      difficulty: 'easy',   category: 'movies' },
  { wordA: 'Shrek',        wordB: 'Ice Age',        difficulty: 'easy',   category: 'movies' },
  { wordA: 'The Matrix',   wordB: 'Terminator',     difficulty: 'medium', category: 'movies' },
  { wordA: 'Titanic',      wordB: 'Gladiator',      difficulty: 'medium', category: 'movies' },
  { wordA: 'Batman',       wordB: 'Superman',       difficulty: 'easy',   category: 'movies' },

  // ── Variety ───────────────────────────────────────────────────────────────────
  { wordA: 'Left',         wordB: 'Right',          difficulty: 'easy',   category: 'variety' },
  { wordA: 'Day',          wordB: 'Night',          difficulty: 'easy',   category: 'variety' },
  { wordA: 'Hot',          wordB: 'Cold',           difficulty: 'easy',   category: 'variety' },
  { wordA: 'Summer',       wordB: 'Winter',         difficulty: 'easy',   category: 'variety' },
  { wordA: 'Fire',         wordB: 'Ice',            difficulty: 'easy',   category: 'variety' },
  { wordA: 'King',         wordB: 'Queen',          difficulty: 'easy',   category: 'variety' },
  { wordA: 'Hero',         wordB: 'Villain',        difficulty: 'easy',   category: 'variety' },
  { wordA: 'Angel',        wordB: 'Demon',          difficulty: 'medium', category: 'variety' },
  { wordA: 'Past',         wordB: 'Future',         difficulty: 'medium', category: 'variety' },
  { wordA: 'Heaven',       wordB: 'Hell',           difficulty: 'medium', category: 'variety' },
  { wordA: 'Reality',      wordB: 'Dream',          difficulty: 'medium', category: 'variety' },
  { wordA: 'Truth',        wordB: 'Lie',            difficulty: 'medium', category: 'variety' },
  { wordA: 'Love',         wordB: 'Hate',           difficulty: 'easy',   category: 'variety' },
  { wordA: 'War',          wordB: 'Peace',          difficulty: 'medium', category: 'variety' },
  { wordA: 'Chaos',        wordB: 'Order',          difficulty: 'hard',   category: 'variety' },
  { wordA: 'Life',         wordB: 'Death',          difficulty: 'medium', category: 'variety' },
  { wordA: 'Magic',        wordB: 'Science',        difficulty: 'medium', category: 'variety' },
  { wordA: 'Sea',          wordB: 'Mountain',       difficulty: 'easy',   category: 'variety' },
  { wordA: 'Sun',          wordB: 'Moon',           difficulty: 'easy',   category: 'variety' },
  { wordA: 'East',         wordB: 'West',           difficulty: 'easy',   category: 'variety' },

  // ── History ──────────────────────────────────────────────────────────────────
  { wordA: 'Parliament',   wordB: 'Congress',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Kingdom',      wordB: 'Empire',         difficulty: 'medium', category: 'history' },
  { wordA: 'Treaty',       wordB: 'Accord',         difficulty: 'hard',   category: 'history' },
  { wordA: 'Revolution',   wordB: 'Rebellion',      difficulty: 'hard',   category: 'history' },
  { wordA: 'Pharaoh',      wordB: 'Emperor',        difficulty: 'medium', category: 'history' },
  { wordA: 'Gladiator',    wordB: 'Warrior',        difficulty: 'medium', category: 'history' },
  { wordA: 'Crusade',      wordB: 'Conquest',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Colony',       wordB: 'Republic',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Viking',       wordB: 'Pirate',         difficulty: 'medium', category: 'history' },
  { wordA: 'Pyramid',      wordB: 'Colosseum',      difficulty: 'medium', category: 'history' },
  { wordA: 'Samurai',      wordB: 'Knight',         difficulty: 'medium', category: 'history' },
  { wordA: 'Renaissance',  wordB: 'Enlightenment',  difficulty: 'hard',   category: 'history' },
  { wordA: 'Napoleon',     wordB: 'Caesar',         difficulty: 'medium', category: 'history' },
  { wordA: 'Cleopatra',    wordB: 'Nefertiti',      difficulty: 'hard',   category: 'history' },
  { wordA: 'World War I',  wordB: 'World War II',   difficulty: 'easy',   category: 'history' },
  { wordA: 'Cold War',     wordB: 'Space Race',     difficulty: 'medium', category: 'history' },
  { wordA: 'Aztec',        wordB: 'Inca',           difficulty: 'medium', category: 'history' },
  { wordA: 'Genghis Khan', wordB: 'Attila',         difficulty: 'hard',   category: 'history' },
  { wordA: 'Democracy',    wordB: 'Monarchy',       difficulty: 'medium', category: 'history' },
  { wordA: 'Feudalism',    wordB: 'Capitalism',     difficulty: 'hard',   category: 'history' },

  // ── Mangas ───────────────────────────────────────────────────────────────────
  { wordA: 'Naruto',       wordB: 'Sasuke',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Goku',         wordB: 'Vegeta',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Luffy',        wordB: 'Zoro',           difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Ichigo',       wordB: 'Rukia',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Edward',       wordB: 'Alphonse',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Light',        wordB: 'L',              difficulty: 'medium', category: 'mangas' },
  { wordA: 'Eren',         wordB: 'Levi',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Deku',         wordB: 'Bakugo',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Gojo',         wordB: 'Sukuna',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Tanjiro',      wordB: 'Zenitsu',        difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Kakashi',      wordB: 'Itachi',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Saitama',      wordB: 'Genos',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Natsu',        wordB: 'Gray',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Meliodas',     wordB: 'Ban',            difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Shoto',        wordB: 'Kirishima',      difficulty: 'medium', category: 'mangas' },
  // Extra 100 manga pairs
  { wordA: 'Killua',       wordB: 'Gon',            difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Hisoka',       wordB: 'Illumi',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Kurapika',     wordB: 'Leorio',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Netero',       wordB: 'Meruem',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Kite',         wordB: 'Ging',           difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Spike',        wordB: 'Jet',            difficulty: 'medium', category: 'mangas' },
  { wordA: 'Vash',         wordB: 'Wolfwood',       difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Edward Elric', wordB: 'Roy Mustang',    difficulty: 'medium', category: 'mangas' },
  { wordA: 'Scar',         wordB: 'Greed',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Riza',         wordB: 'Winry',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Aizen',        wordB: 'Yhwach',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Gin',          wordB: 'Tousen',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Byakuya',      wordB: 'Kenpachi',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Urahara',      wordB: 'Yoruichi',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Orihime',      wordB: 'Chad',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Minato',       wordB: 'Kushina',        difficulty: 'medium', category: 'mangas' },
  { wordA: 'Jiraiya',      wordB: 'Tsunade',        difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Orochimaru',   wordB: 'Kabuto',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Gaara',        wordB: 'Temari',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Rock Lee',     wordB: 'Neji',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Pain',         wordB: 'Konan',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Obito',        wordB: 'Rin',            difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Madara',       wordB: 'Hashirama',      difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Shikamaru',    wordB: 'Choji',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Hinata',       wordB: 'Sakura',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Ino',          wordB: 'Tenten',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Luffy',        wordB: 'Ace',            difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Shanks',       wordB: 'Blackbeard',     difficulty: 'medium', category: 'mangas' },
  { wordA: 'Whitebeard',   wordB: 'Kaido',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Nami',         wordB: 'Robin',          difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Sanji',        wordB: 'Franky',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Usopp',        wordB: 'Chopper',        difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Brook',        wordB: 'Jinbe',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Law',          wordB: 'Crocodile',      difficulty: 'medium', category: 'mangas' },
  { wordA: 'Doflamingo',   wordB: 'Hancock',        difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Mihawk',       wordB: 'Fujitora',       difficulty: 'hard',   category: 'mangas' },
  { wordA: 'All Might',    wordB: 'Endeavor',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Hawks',        wordB: 'Best Jeanist',   difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Shigaraki',    wordB: 'Dabi',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Toga',         wordB: 'Twice',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Mirio',        wordB: 'Tamaki',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Aizawa',       wordB: 'Present Mic',    difficulty: 'medium', category: 'mangas' },
  { wordA: 'Overhaul',     wordB: 'Muscular',       difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Tanjiro',      wordB: 'Inosuke',        difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Rengoku',      wordB: 'Tengen',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Muzan',        wordB: 'Doma',           difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Akaza',        wordB: 'Gyomei',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Kanao',        wordB: 'Aoi',            difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Sanemi',       wordB: 'Obanai',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Gojo',         wordB: 'Geto',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Nanami',       wordB: 'Haibara',        difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Megumi',       wordB: 'Nobara',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Mahito',       wordB: 'Jogo',           difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Yuta',         wordB: 'Maki',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Choso',        wordB: 'Kenjaku',        difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Vegeta',       wordB: 'Nappa',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Piccolo',      wordB: 'Gohan',          difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Frieza',       wordB: 'Cell',           difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Beerus',       wordB: 'Whis',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Broly',        wordB: 'Gogeta',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Trunks',       wordB: 'Goten',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Krillin',      wordB: 'Yamcha',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Bulma',        wordB: 'Chi-Chi',        difficulty: 'medium', category: 'mangas' },
  { wordA: 'Reigen',       wordB: 'Mob',            difficulty: 'medium', category: 'mangas' },
  { wordA: 'Dimple',       wordB: 'Ritsu',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Saitama',      wordB: 'Bang',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Tatsumaki',    wordB: 'Fubuki',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Garou',        wordB: 'Boros',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'King',         wordB: 'Atomic Samurai', difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Nana',         wordB: 'Hachi',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Yusuke',       wordB: 'Kuwabara',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Hiei',         wordB: 'Kurama',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Toguro',       wordB: 'Sensui',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Inuyasha',     wordB: 'Sesshomaru',     difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Kagome',       wordB: 'Kikyo',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Naraku',       wordB: 'Miroku',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Giyu',         wordB: 'Shinobu',        difficulty: 'medium', category: 'mangas' },
  { wordA: 'Rimuru',       wordB: 'Milim',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Diablo',       wordB: 'Shion',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Subaru',       wordB: 'Emilia',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Rem',          wordB: 'Ram',            difficulty: 'medium', category: 'mangas' },
  { wordA: 'Beatrice',     wordB: 'Echidna',        difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Kirito',       wordB: 'Asuna',          difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Klein',        wordB: 'Agil',           difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Sinon',        wordB: 'Leafa',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Ainz',         wordB: 'Albedo',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Shalltear',    wordB: 'Cocytus',        difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Demiurge',     wordB: 'Sebas',          difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Bell',         wordB: 'Ais',            difficulty: 'medium', category: 'mangas' },
  { wordA: 'Hestia',       wordB: 'Freya',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Ryuko',        wordB: 'Satsuki',        difficulty: 'medium', category: 'mangas' },
  { wordA: 'Simon',        wordB: 'Kamina',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Yoko',         wordB: 'Nia',            difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Viral',        wordB: 'Lordgenome',     difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Shinji',       wordB: 'Rei',            difficulty: 'medium', category: 'mangas' },
  { wordA: 'Asuka',        wordB: 'Misato',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Gendo',        wordB: 'Kaworu',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Senku',        wordB: 'Tsukasa',        difficulty: 'medium', category: 'mangas' },
  { wordA: 'Chrome',       wordB: 'Kohaku',         difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Gen',          wordB: 'Ryusui',         difficulty: 'hard',   category: 'mangas' },

  // ── Célébrités ───────────────────────────────────────────────────────────────
  { wordA: 'Beyoncé',      wordB: 'Rihanna',        difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Michael Jackson', wordB: 'Prince',      difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Madonna',      wordB: 'Lady Gaga',      difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Brad Pitt',    wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Ronaldo',      wordB: 'Messi',          difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'LeBron',       wordB: 'Kobe',           difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Elon Musk',    wordB: 'Jeff Bezos',     difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Taylor Swift', wordB: 'Ariana Grande',  difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Will Smith',   wordB: 'Denzel Washington', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Drake',        wordB: 'Kanye West',     difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Shakira',      wordB: 'Jennifer Lopez', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Cristiano',    wordB: 'Neymar',         difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Eminem',       wordB: 'Jay-Z',          difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Adele',        wordB: 'Billie Eilish',  difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Justin Bieber',wordB: 'Ed Sheeran',     difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Nicki Minaj',  wordB: 'Cardi B',        difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'The Rock',     wordB: 'Vin Diesel',     difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Zendaya',      wordB: 'Dua Lipa',       difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Kylie Jenner', wordB: 'Kim Kardashian', difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Chris Evans',  wordB: 'Robert Downey Jr.', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Barack Obama', wordB: 'Nelson Mandela', difficulty: 'medium', category: 'celebrities' },

]


async function main() {
  console.log('Seeding database...')

  // Upsert the General word pack with all pairs
  const existing = await prisma.wordPack.findFirst({ where: { name: 'General' } })

  if (existing) {
    // Delete old pairs and recreate to keep data fresh
    await prisma.wordPair.deleteMany({ where: { packId: existing.id } })
    await prisma.wordPair.createMany({
      data: WORD_PAIRS.map((p) => ({ ...p, packId: existing.id })),
    })
    console.log(`Updated General word pack with ${WORD_PAIRS.length} pairs`)
  } else {
    await prisma.wordPack.create({
      data: {
        name: 'General',
        description: 'A diverse set of word pairs across all 11 categories',
        isPremium: false,
        locale: 'en',
        pairs: { create: WORD_PAIRS },
      },
    })
    console.log(`Created General word pack with ${WORD_PAIRS.length} pairs`)
  }

  // ── Achievements ─────────────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { key: 'first_win',        name: 'First Win',          description: 'Win your very first game',                     icon: '🏆' },
    { key: 'first_imposter',   name: 'First Imposter',     description: 'Win a game as the imposter',                   icon: '🎭' },
    { key: 'perfect_imposter', name: 'Perfect Imposter',   description: 'Win as imposter without being voted out once', icon: '🌟' },
    { key: 'ten_wins',         name: 'Veteran',            description: 'Win 10 games total',                          icon: '🎖️' },
    { key: 'imposter_x10',     name: 'Master of Deception',description: 'Win 10 games as the imposter',                icon: '🕵️' },
    { key: 'honor_giver_5',    name: 'Generous',           description: 'Give honor to 5 different players',           icon: '🤝' },
    { key: 'honor_receiver_5', name: 'Beloved',            description: 'Receive 5 honors from other players',         icon: '💖' },
    { key: 'survivor',         name: 'Survivor',           description: 'Survive all rounds without being eliminated', icon: '💪' },
    { key: 'correct_voter',    name: 'Good Eye',           description: 'Vote correctly to eliminate the imposter',    icon: '👁️' },
    { key: 'social_butterfly', name: 'Social Butterfly',   description: 'Make 5 friends',                              icon: '🦋' },
  ]
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: ach.key }, create: ach, update: {} })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)

  // ── Cosmetics ─────────────────────────────────────────────────────────────────
  const COSMETICS = [
    // Avatars (star coins)
    { type: 'avatar', name: 'Shadow Fox',    description: 'A sleek dark fox', imageUrl: '/cosmetics/avatar_fox.png',    price: 200,  currency: 'star' },
    { type: 'avatar', name: 'Neon Wolf',     description: 'Glowing cyber wolf', imageUrl: '/cosmetics/avatar_wolf.png', price: 350,  currency: 'star' },
    { type: 'avatar', name: 'Crystal Bird',  description: 'Icy blue bird',    imageUrl: '/cosmetics/avatar_bird.png',   price: 300,  currency: 'star' },
    { type: 'avatar', name: 'Gold Dragon',   description: 'Legendary dragon', imageUrl: '/cosmetics/avatar_dragon.png', price: 500,  currency: 'gold' },
    { type: 'avatar', name: 'Phantom Cat',   description: 'Mystery cat',      imageUrl: '/cosmetics/avatar_cat.png',    price: 150,  currency: 'star' },
    // Card backgrounds
    { type: 'card_background', name: 'Midnight',     description: 'Dark starry night',   imageUrl: '/cosmetics/bg_midnight.png',   price: 100, currency: 'star' },
    { type: 'card_background', name: 'Sunset',       description: 'Orange sunset glow',  imageUrl: '/cosmetics/bg_sunset.png',     price: 100, currency: 'star' },
    { type: 'card_background', name: 'Aurora',       description: 'Northern lights',     imageUrl: '/cosmetics/bg_aurora.png',     price: 250, currency: 'star' },
    { type: 'card_background', name: 'Royal Gold',   description: 'Gilded luxury theme', imageUrl: '/cosmetics/bg_gold.png',       price: 300, currency: 'gold' },
    // Badges
    { type: 'badge', name: 'Detective Badge',  description: 'I found the imposter!', imageUrl: '/cosmetics/badge_detective.png', price: 200, currency: 'star' },
    { type: 'badge', name: 'Imposter Badge',   description: 'Master of deception',   imageUrl: '/cosmetics/badge_imposter.png',  price: 200, currency: 'star' },
    { type: 'badge', name: 'Crown Badge',      description: 'Top player',            imageUrl: '/cosmetics/badge_crown.png',     price: 500, currency: 'gold' },
    // Titles
    { type: 'title', name: 'The Imposter',   description: 'You look sus',         imageUrl: '/cosmetics/title_imposter.png',  price: 150, currency: 'star' },
    { type: 'title', name: 'The Detective',  description: 'Eyes everywhere',      imageUrl: '/cosmetics/title_detective.png', price: 150, currency: 'star' },
    { type: 'title', name: 'The Legendary',  description: 'Beyond compare',       imageUrl: '/cosmetics/title_legend.png',    price: 400, currency: 'gold' },
    // Word effects
    { type: 'word_effect', name: 'Fire Words',    description: 'Flaming text on reveal', imageUrl: '/cosmetics/fx_fire.png',     price: 200, currency: 'star' },
    { type: 'word_effect', name: 'Glitch Words',  description: 'Glitchy digital effect', imageUrl: '/cosmetics/fx_glitch.png',   price: 250, currency: 'star' },
    { type: 'word_effect', name: 'Galaxy Words',  description: 'Space particle effect',  imageUrl: '/cosmetics/fx_galaxy.png',   price: 350, currency: 'gold' },
  ]
  for (const c of COSMETICS) {
    await prisma.cosmetic.upsert({
      where: { id: c.name.replace(/\s+/g, '_').toLowerCase() },
      create: { ...c, id: c.name.replace(/\s+/g, '_').toLowerCase() },
      update: {},
    }).catch(async () => {
      // If upsert fails (no id match), check by name
      const existing = await prisma.cosmetic.findFirst({ where: { name: c.name } })
      if (!existing) await prisma.cosmetic.create({ data: c })
    })
  }
  console.log(`Seeded ${COSMETICS.length} cosmetics`)

  // ── Season Pass (optional — table may not exist yet) ──────────────────────────
  try {
    const now = new Date()
    const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const seasonEnd   = new Date(now.getFullYear(), now.getMonth() + 3, 0)

    const existingSeason = await (prisma as any).seasonPass.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
    })

    if (!existingSeason) {
      await (prisma as any).seasonPass.create({
        data: {
          name: 'Season 1 — Shadow Realm',
          startDate: seasonStart,
          endDate: seasonEnd,
          isPremium: false,
          tiers: {
            create: [
              { tierNumber: 1,  xpRequired: 0,    rewardType: 'starCoins', rewardValue: '50',  isPremium: false },
              { tierNumber: 2,  xpRequired: 200,  rewardType: 'starCoins', rewardValue: '100', isPremium: false },
              { tierNumber: 3,  xpRequired: 500,  rewardType: 'starCoins', rewardValue: '150', isPremium: false },
              { tierNumber: 4,  xpRequired: 900,  rewardType: 'goldCoins', rewardValue: '10',  isPremium: true  },
              { tierNumber: 5,  xpRequired: 1400, rewardType: 'starCoins', rewardValue: '200', isPremium: false },
              { tierNumber: 6,  xpRequired: 2000, rewardType: 'starCoins', rewardValue: '250', isPremium: false },
              { tierNumber: 7,  xpRequired: 2700, rewardType: 'goldCoins', rewardValue: '25',  isPremium: true  },
              { tierNumber: 8,  xpRequired: 3500, rewardType: 'starCoins', rewardValue: '300', isPremium: false },
              { tierNumber: 9,  xpRequired: 4400, rewardType: 'starCoins', rewardValue: '400', isPremium: false },
              { tierNumber: 10, xpRequired: 5500, rewardType: 'goldCoins', rewardValue: '50',  isPremium: true  },
            ],
          },
        },
      })
      console.log('Created Season 1 — Shadow Realm season pass with 10 tiers')
    } else {
      console.log('Active season pass already exists, skipping')
    }
  } catch {
    console.log('Skipped season pass seeding (table may not exist)')
  }

  console.log(`Seed complete. Total pairs: ${WORD_PAIRS.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
