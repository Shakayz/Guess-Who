import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type PairData = {
  wordA: string
  wordB: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  locale: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH
// ─────────────────────────────────────────────────────────────────────────────
const EN: PairData[] = [
  // mangas
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'en' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'en' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'en' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'en' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'en' },
  // celebrities
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'en' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'en' },
  { wordA: 'Michael Jackson',wordB: 'Prince',            difficulty: 'medium', category: 'celebrities', locale: 'en' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'en' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'en' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'en' },
  { wordA: 'Drake',          wordB: 'Kanye West',        difficulty: 'easy',   category: 'celebrities', locale: 'en' },
  { wordA: 'Brad Pitt',      wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities', locale: 'en' },
  { wordA: 'Serena Williams',wordB: 'Venus Williams',    difficulty: 'easy',   category: 'celebrities', locale: 'en' },
  { wordA: 'Roger Federer',  wordB: 'Rafael Nadal',      difficulty: 'medium', category: 'celebrities', locale: 'en' },
  // movies
  { wordA: 'Comedy',         wordB: 'Drama',             difficulty: 'easy',   category: 'movies',      locale: 'en' },
  { wordA: 'Thriller',       wordB: 'Horror',            difficulty: 'easy',   category: 'movies',      locale: 'en' },
  { wordA: 'Action',         wordB: 'Adventure',         difficulty: 'easy',   category: 'movies',      locale: 'en' },
  { wordA: 'Sci-Fi',         wordB: 'Fantasy',           difficulty: 'medium', category: 'movies',      locale: 'en' },
  { wordA: 'Animation',      wordB: 'Cartoon',           difficulty: 'easy',   category: 'movies',      locale: 'en' },
  { wordA: 'Documentary',    wordB: 'Biopic',            difficulty: 'hard',   category: 'movies',      locale: 'en' },
  { wordA: 'Western',        wordB: 'Epic',              difficulty: 'hard',   category: 'movies',      locale: 'en' },
  { wordA: 'Romance',        wordB: 'Musical',           difficulty: 'medium', category: 'movies',      locale: 'en' },
  { wordA: 'Superhero',      wordB: 'Spy',               difficulty: 'medium', category: 'movies',      locale: 'en' },
  { wordA: 'Mystery',        wordB: 'Noir',              difficulty: 'hard',   category: 'movies',      locale: 'en' },
  // animals
  { wordA: 'Lion',           wordB: 'Tiger',             difficulty: 'easy',   category: 'animals',     locale: 'en' },
  { wordA: 'Dog',            wordB: 'Wolf',              difficulty: 'easy',   category: 'animals',     locale: 'en' },
  { wordA: 'Eagle',          wordB: 'Falcon',            difficulty: 'medium', category: 'animals',     locale: 'en' },
  { wordA: 'Dolphin',        wordB: 'Porpoise',          difficulty: 'hard',   category: 'animals',     locale: 'en' },
  { wordA: 'Crocodile',      wordB: 'Alligator',         difficulty: 'hard',   category: 'animals',     locale: 'en' },
  { wordA: 'Gorilla',        wordB: 'Chimpanzee',        difficulty: 'medium', category: 'animals',     locale: 'en' },
  { wordA: 'Penguin',        wordB: 'Puffin',            difficulty: 'hard',   category: 'animals',     locale: 'en' },
  { wordA: 'Cobra',          wordB: 'Viper',             difficulty: 'hard',   category: 'animals',     locale: 'en' },
  { wordA: 'Shark',          wordB: 'Barracuda',         difficulty: 'medium', category: 'animals',     locale: 'en' },
  { wordA: 'Camel',          wordB: 'Llama',             difficulty: 'medium', category: 'animals',     locale: 'en' },
  // sports
  { wordA: 'Football',       wordB: 'Rugby',             difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Tennis',         wordB: 'Badminton',         difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Swimming',       wordB: 'Diving',            difficulty: 'easy',   category: 'sports',      locale: 'en' },
  { wordA: 'Basketball',     wordB: 'Volleyball',        difficulty: 'easy',   category: 'sports',      locale: 'en' },
  { wordA: 'Boxing',         wordB: 'Wrestling',         difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Skiing',         wordB: 'Snowboarding',      difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Golf',           wordB: 'Cricket',           difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Cycling',        wordB: 'Triathlon',         difficulty: 'hard',   category: 'sports',      locale: 'en' },
  { wordA: 'Judo',           wordB: 'Karate',            difficulty: 'medium', category: 'sports',      locale: 'en' },
  { wordA: 'Baseball',       wordB: 'Softball',          difficulty: 'medium', category: 'sports',      locale: 'en' },
  // food
  { wordA: 'Pizza',          wordB: 'Flatbread',         difficulty: 'easy',   category: 'food',        locale: 'en' },
  { wordA: 'Sushi',          wordB: 'Sashimi',           difficulty: 'hard',   category: 'food',        locale: 'en' },
  { wordA: 'Burger',         wordB: 'Sandwich',          difficulty: 'easy',   category: 'food',        locale: 'en' },
  { wordA: 'Taco',           wordB: 'Burrito',           difficulty: 'easy',   category: 'food',        locale: 'en' },
  { wordA: 'Ramen',          wordB: 'Pho',               difficulty: 'medium', category: 'food',        locale: 'en' },
  { wordA: 'Curry',          wordB: 'Stew',              difficulty: 'medium', category: 'food',        locale: 'en' },
  { wordA: 'Cheesecake',     wordB: 'Tiramisu',          difficulty: 'medium', category: 'food',        locale: 'en' },
  { wordA: 'Croissant',      wordB: 'Muffin',            difficulty: 'medium', category: 'food',        locale: 'en' },
  { wordA: 'Pasta',          wordB: 'Noodles',           difficulty: 'easy',   category: 'food',        locale: 'en' },
  { wordA: 'Kebab',          wordB: 'Shawarma',          difficulty: 'medium', category: 'food',        locale: 'en' },
  // music
  { wordA: 'Guitar',         wordB: 'Violin',            difficulty: 'medium', category: 'music',       locale: 'en' },
  { wordA: 'Piano',          wordB: 'Organ',             difficulty: 'medium', category: 'music',       locale: 'en' },
  { wordA: 'Jazz',           wordB: 'Blues',             difficulty: 'medium', category: 'music',       locale: 'en' },
  { wordA: 'Rock',           wordB: 'Metal',             difficulty: 'medium', category: 'music',       locale: 'en' },
  { wordA: 'Hip-Hop',        wordB: 'Rap',               difficulty: 'easy',   category: 'music',       locale: 'en' },
  { wordA: 'Pop',            wordB: 'R&B',               difficulty: 'easy',   category: 'music',       locale: 'en' },
  { wordA: 'Classical',      wordB: 'Baroque',           difficulty: 'hard',   category: 'music',       locale: 'en' },
  { wordA: 'Reggae',         wordB: 'Ska',               difficulty: 'hard',   category: 'music',       locale: 'en' },
  { wordA: 'Electronic',     wordB: 'Techno',            difficulty: 'medium', category: 'music',       locale: 'en' },
  { wordA: 'Trumpet',        wordB: 'Trombone',          difficulty: 'hard',   category: 'music',       locale: 'en' },
  // jobs
  { wordA: 'Doctor',         wordB: 'Nurse',             difficulty: 'easy',   category: 'jobs',        locale: 'en' },
  { wordA: 'Teacher',        wordB: 'Professor',         difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Lawyer',         wordB: 'Solicitor',         difficulty: 'hard',   category: 'jobs',        locale: 'en' },
  { wordA: 'Chef',           wordB: 'Cook',              difficulty: 'easy',   category: 'jobs',        locale: 'en' },
  { wordA: 'Architect',      wordB: 'Engineer',          difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Pilot',          wordB: 'Co-Pilot',          difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Detective',      wordB: 'Inspector',         difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Journalist',     wordB: 'Reporter',          difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Photographer',   wordB: 'Videographer',      difficulty: 'medium', category: 'jobs',        locale: 'en' },
  { wordA: 'Firefighter',    wordB: 'Paramedic',         difficulty: 'medium', category: 'jobs',        locale: 'en' },
  // places
  { wordA: 'Castle',         wordB: 'Fort',              difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Library',        wordB: 'Bookstore',         difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Museum',         wordB: 'Gallery',           difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Hospital',       wordB: 'Clinic',            difficulty: 'easy',   category: 'places',      locale: 'en' },
  { wordA: 'Stadium',        wordB: 'Arena',             difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Temple',         wordB: 'Church',            difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'School',         wordB: 'University',        difficulty: 'easy',   category: 'places',      locale: 'en' },
  { wordA: 'Harbor',         wordB: 'Dock',              difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Market',         wordB: 'Bazaar',            difficulty: 'medium', category: 'places',      locale: 'en' },
  { wordA: 'Theater',        wordB: 'Cinema',            difficulty: 'easy',   category: 'places',      locale: 'en' },
  // history
  { wordA: 'Kingdom',        wordB: 'Empire',            difficulty: 'medium', category: 'history',     locale: 'en' },
  { wordA: 'Revolution',     wordB: 'Rebellion',         difficulty: 'hard',   category: 'history',     locale: 'en' },
  { wordA: 'Pharaoh',        wordB: 'Emperor',           difficulty: 'medium', category: 'history',     locale: 'en' },
  { wordA: 'Viking',         wordB: 'Pirate',            difficulty: 'medium', category: 'history',     locale: 'en' },
  { wordA: 'Pyramid',        wordB: 'Colosseum',         difficulty: 'medium', category: 'history',     locale: 'en' },
  { wordA: 'Samurai',        wordB: 'Knight',            difficulty: 'medium', category: 'history',     locale: 'en' },
  { wordA: 'Democracy',      wordB: 'Monarchy',          difficulty: 'hard',   category: 'history',     locale: 'en' },
  { wordA: 'Crusade',        wordB: 'Conquest',          difficulty: 'hard',   category: 'history',     locale: 'en' },
  { wordA: 'Colony',         wordB: 'Republic',          difficulty: 'hard',   category: 'history',     locale: 'en' },
  { wordA: 'Renaissance',    wordB: 'Enlightenment',     difficulty: 'hard',   category: 'history',     locale: 'en' },
  // variety
  { wordA: 'Day',            wordB: 'Night',             difficulty: 'easy',   category: 'variety',     locale: 'en' },
  { wordA: 'Hot',            wordB: 'Cold',              difficulty: 'easy',   category: 'variety',     locale: 'en' },
  { wordA: 'Fire',           wordB: 'Ice',               difficulty: 'easy',   category: 'variety',     locale: 'en' },
  { wordA: 'Hero',           wordB: 'Villain',           difficulty: 'easy',   category: 'variety',     locale: 'en' },
  { wordA: 'Past',           wordB: 'Future',            difficulty: 'medium', category: 'variety',     locale: 'en' },
  { wordA: 'Heaven',         wordB: 'Hell',              difficulty: 'medium', category: 'variety',     locale: 'en' },
  { wordA: 'Love',           wordB: 'Hate',              difficulty: 'easy',   category: 'variety',     locale: 'en' },
  { wordA: 'Chaos',          wordB: 'Order',             difficulty: 'hard',   category: 'variety',     locale: 'en' },
  { wordA: 'Dream',          wordB: 'Reality',           difficulty: 'medium', category: 'variety',     locale: 'en' },
  { wordA: 'Left',           wordB: 'Right',             difficulty: 'easy',   category: 'variety',     locale: 'en' },
]

// ─────────────────────────────────────────────────────────────────────────────
// FRENCH
// ─────────────────────────────────────────────────────────────────────────────
const FR: PairData[] = [
  // mangas (proper nouns — same across all locales)
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'fr' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'fr' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'fr' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'fr' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'fr' },
  // celebrities (proper nouns — same across all locales)
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'fr' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'fr' },
  { wordA: 'Michael Jackson',wordB: 'Prince',            difficulty: 'medium', category: 'celebrities', locale: 'fr' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'fr' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'fr' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'fr' },
  { wordA: 'Drake',          wordB: 'Kanye West',        difficulty: 'easy',   category: 'celebrities', locale: 'fr' },
  { wordA: 'Brad Pitt',      wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities', locale: 'fr' },
  { wordA: 'Serena Williams',wordB: 'Venus Williams',    difficulty: 'easy',   category: 'celebrities', locale: 'fr' },
  { wordA: 'Roger Federer',  wordB: 'Rafael Nadal',      difficulty: 'medium', category: 'celebrities', locale: 'fr' },
  // movies
  { wordA: 'Comédie',        wordB: 'Drame',             difficulty: 'easy',   category: 'movies',      locale: 'fr' },
  { wordA: 'Thriller',       wordB: 'Horreur',           difficulty: 'easy',   category: 'movies',      locale: 'fr' },
  { wordA: 'Action',         wordB: 'Aventure',          difficulty: 'easy',   category: 'movies',      locale: 'fr' },
  { wordA: 'Science-Fiction',wordB: 'Fantaisie',         difficulty: 'medium', category: 'movies',      locale: 'fr' },
  { wordA: 'Animation',      wordB: 'Dessin Animé',      difficulty: 'easy',   category: 'movies',      locale: 'fr' },
  { wordA: 'Documentaire',   wordB: 'Biopic',            difficulty: 'hard',   category: 'movies',      locale: 'fr' },
  { wordA: 'Western',        wordB: 'Épopée',            difficulty: 'hard',   category: 'movies',      locale: 'fr' },
  { wordA: 'Romance',        wordB: 'Comédie Musicale',  difficulty: 'medium', category: 'movies',      locale: 'fr' },
  { wordA: 'Super-Héros',    wordB: 'Espionnage',        difficulty: 'medium', category: 'movies',      locale: 'fr' },
  { wordA: 'Mystère',        wordB: 'Policier',          difficulty: 'hard',   category: 'movies',      locale: 'fr' },
  // animals
  { wordA: 'Lion',           wordB: 'Tigre',             difficulty: 'easy',   category: 'animals',     locale: 'fr' },
  { wordA: 'Chien',          wordB: 'Loup',              difficulty: 'easy',   category: 'animals',     locale: 'fr' },
  { wordA: 'Aigle',          wordB: 'Faucon',            difficulty: 'medium', category: 'animals',     locale: 'fr' },
  { wordA: 'Dauphin',        wordB: 'Marsouin',          difficulty: 'hard',   category: 'animals',     locale: 'fr' },
  { wordA: 'Crocodile',      wordB: 'Alligator',         difficulty: 'hard',   category: 'animals',     locale: 'fr' },
  { wordA: 'Gorille',        wordB: 'Chimpanzé',         difficulty: 'medium', category: 'animals',     locale: 'fr' },
  { wordA: 'Manchot',        wordB: 'Macareux',          difficulty: 'hard',   category: 'animals',     locale: 'fr' },
  { wordA: 'Cobra',          wordB: 'Vipère',            difficulty: 'hard',   category: 'animals',     locale: 'fr' },
  { wordA: 'Requin',         wordB: 'Barracuda',         difficulty: 'medium', category: 'animals',     locale: 'fr' },
  { wordA: 'Chameau',        wordB: 'Lama',              difficulty: 'medium', category: 'animals',     locale: 'fr' },
  // sports
  { wordA: 'Football',       wordB: 'Rugby',             difficulty: 'easy',   category: 'sports',      locale: 'fr' },
  { wordA: 'Tennis',         wordB: 'Badminton',         difficulty: 'medium', category: 'sports',      locale: 'fr' },
  { wordA: 'Natation',       wordB: 'Plongeon',          difficulty: 'easy',   category: 'sports',      locale: 'fr' },
  { wordA: 'Basketball',     wordB: 'Volleyball',        difficulty: 'easy',   category: 'sports',      locale: 'fr' },
  { wordA: 'Boxe',           wordB: 'Lutte',             difficulty: 'medium', category: 'sports',      locale: 'fr' },
  { wordA: 'Ski',            wordB: 'Snowboard',         difficulty: 'medium', category: 'sports',      locale: 'fr' },
  { wordA: 'Golf',           wordB: 'Cricket',           difficulty: 'medium', category: 'sports',      locale: 'fr' },
  { wordA: 'Cyclisme',       wordB: 'Triathlon',         difficulty: 'hard',   category: 'sports',      locale: 'fr' },
  { wordA: 'Judo',           wordB: 'Karaté',            difficulty: 'medium', category: 'sports',      locale: 'fr' },
  { wordA: 'Baseball',       wordB: 'Softball',          difficulty: 'medium', category: 'sports',      locale: 'fr' },
  // food
  { wordA: 'Pizza',          wordB: 'Tarte Flambée',     difficulty: 'hard',   category: 'food',        locale: 'fr' },
  { wordA: 'Sushi',          wordB: 'Sashimi',           difficulty: 'hard',   category: 'food',        locale: 'fr' },
  { wordA: 'Burger',         wordB: 'Sandwich',          difficulty: 'easy',   category: 'food',        locale: 'fr' },
  { wordA: 'Taco',           wordB: 'Burrito',           difficulty: 'easy',   category: 'food',        locale: 'fr' },
  { wordA: 'Ramen',          wordB: 'Pho',               difficulty: 'medium', category: 'food',        locale: 'fr' },
  { wordA: 'Curry',          wordB: 'Ragoût',            difficulty: 'medium', category: 'food',        locale: 'fr' },
  { wordA: 'Cheesecake',     wordB: 'Tiramisu',          difficulty: 'medium', category: 'food',        locale: 'fr' },
  { wordA: 'Croissant',      wordB: 'Pain au Chocolat',  difficulty: 'hard',   category: 'food',        locale: 'fr' },
  { wordA: 'Pâtes',          wordB: 'Nouilles',          difficulty: 'easy',   category: 'food',        locale: 'fr' },
  { wordA: 'Kébab',          wordB: 'Shawarma',          difficulty: 'medium', category: 'food',        locale: 'fr' },
  // music
  { wordA: 'Guitare',        wordB: 'Violon',            difficulty: 'medium', category: 'music',       locale: 'fr' },
  { wordA: 'Piano',          wordB: 'Orgue',             difficulty: 'medium', category: 'music',       locale: 'fr' },
  { wordA: 'Jazz',           wordB: 'Blues',             difficulty: 'medium', category: 'music',       locale: 'fr' },
  { wordA: 'Rock',           wordB: 'Métal',             difficulty: 'medium', category: 'music',       locale: 'fr' },
  { wordA: 'Hip-Hop',        wordB: 'Rap',               difficulty: 'easy',   category: 'music',       locale: 'fr' },
  { wordA: 'Pop',            wordB: 'R&B',               difficulty: 'easy',   category: 'music',       locale: 'fr' },
  { wordA: 'Classique',      wordB: 'Baroque',           difficulty: 'hard',   category: 'music',       locale: 'fr' },
  { wordA: 'Reggae',         wordB: 'Ska',               difficulty: 'hard',   category: 'music',       locale: 'fr' },
  { wordA: 'Électronique',   wordB: 'Techno',            difficulty: 'medium', category: 'music',       locale: 'fr' },
  { wordA: 'Trompette',      wordB: 'Trombone',          difficulty: 'hard',   category: 'music',       locale: 'fr' },
  // jobs
  { wordA: 'Médecin',        wordB: 'Infirmier',         difficulty: 'easy',   category: 'jobs',        locale: 'fr' },
  { wordA: 'Enseignant',     wordB: 'Professeur',        difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Avocat',         wordB: 'Notaire',           difficulty: 'hard',   category: 'jobs',        locale: 'fr' },
  { wordA: 'Chef',           wordB: 'Cuisinier',         difficulty: 'easy',   category: 'jobs',        locale: 'fr' },
  { wordA: 'Architecte',     wordB: 'Ingénieur',         difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Pilote',         wordB: 'Copilote',          difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Détective',      wordB: 'Inspecteur',        difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Journaliste',    wordB: 'Reporter',          difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Photographe',    wordB: 'Vidéaste',          difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  { wordA: 'Pompier',        wordB: 'Secouriste',        difficulty: 'medium', category: 'jobs',        locale: 'fr' },
  // places
  { wordA: 'Château',        wordB: 'Fort',              difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Bibliothèque',   wordB: 'Librairie',         difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Musée',          wordB: 'Galerie',           difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Hôpital',        wordB: 'Clinique',          difficulty: 'easy',   category: 'places',      locale: 'fr' },
  { wordA: 'Stade',          wordB: 'Arène',             difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Temple',         wordB: 'Église',            difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'École',          wordB: 'Université',        difficulty: 'easy',   category: 'places',      locale: 'fr' },
  { wordA: 'Port',           wordB: 'Quai',              difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Marché',         wordB: 'Bazar',             difficulty: 'medium', category: 'places',      locale: 'fr' },
  { wordA: 'Théâtre',        wordB: 'Cinéma',            difficulty: 'easy',   category: 'places',      locale: 'fr' },
  // history
  { wordA: 'Royaume',        wordB: 'Empire',            difficulty: 'medium', category: 'history',     locale: 'fr' },
  { wordA: 'Révolution',     wordB: 'Rébellion',         difficulty: 'hard',   category: 'history',     locale: 'fr' },
  { wordA: 'Pharaon',        wordB: 'Empereur',          difficulty: 'medium', category: 'history',     locale: 'fr' },
  { wordA: 'Viking',         wordB: 'Pirate',            difficulty: 'medium', category: 'history',     locale: 'fr' },
  { wordA: 'Pyramide',       wordB: 'Colisée',           difficulty: 'medium', category: 'history',     locale: 'fr' },
  { wordA: 'Samouraï',       wordB: 'Chevalier',         difficulty: 'medium', category: 'history',     locale: 'fr' },
  { wordA: 'Démocratie',     wordB: 'Monarchie',         difficulty: 'hard',   category: 'history',     locale: 'fr' },
  { wordA: 'Croisade',       wordB: 'Conquête',          difficulty: 'hard',   category: 'history',     locale: 'fr' },
  { wordA: 'Colonie',        wordB: 'République',        difficulty: 'hard',   category: 'history',     locale: 'fr' },
  { wordA: 'Renaissance',    wordB: 'Lumières',          difficulty: 'hard',   category: 'history',     locale: 'fr' },
  // variety
  { wordA: 'Jour',           wordB: 'Nuit',              difficulty: 'easy',   category: 'variety',     locale: 'fr' },
  { wordA: 'Chaud',          wordB: 'Froid',             difficulty: 'easy',   category: 'variety',     locale: 'fr' },
  { wordA: 'Feu',            wordB: 'Glace',             difficulty: 'easy',   category: 'variety',     locale: 'fr' },
  { wordA: 'Héros',          wordB: 'Méchant',           difficulty: 'easy',   category: 'variety',     locale: 'fr' },
  { wordA: 'Passé',          wordB: 'Futur',             difficulty: 'medium', category: 'variety',     locale: 'fr' },
  { wordA: 'Paradis',        wordB: 'Enfer',             difficulty: 'medium', category: 'variety',     locale: 'fr' },
  { wordA: 'Amour',          wordB: 'Haine',             difficulty: 'easy',   category: 'variety',     locale: 'fr' },
  { wordA: 'Chaos',          wordB: 'Ordre',             difficulty: 'hard',   category: 'variety',     locale: 'fr' },
  { wordA: 'Rêve',           wordB: 'Réalité',           difficulty: 'medium', category: 'variety',     locale: 'fr' },
  { wordA: 'Gauche',         wordB: 'Droite',            difficulty: 'easy',   category: 'variety',     locale: 'fr' },
]

// ─────────────────────────────────────────────────────────────────────────────
// SPANISH
// ─────────────────────────────────────────────────────────────────────────────
const ES: PairData[] = [
  // mangas
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'es' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'es' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'es' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'es' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'es' },
  // celebrities
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'es' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'es' },
  { wordA: 'Michael Jackson',wordB: 'Prince',            difficulty: 'medium', category: 'celebrities', locale: 'es' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'es' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'es' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'es' },
  { wordA: 'Drake',          wordB: 'Kanye West',        difficulty: 'easy',   category: 'celebrities', locale: 'es' },
  { wordA: 'Brad Pitt',      wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities', locale: 'es' },
  { wordA: 'Serena Williams',wordB: 'Venus Williams',    difficulty: 'easy',   category: 'celebrities', locale: 'es' },
  { wordA: 'Roger Federer',  wordB: 'Rafael Nadal',      difficulty: 'medium', category: 'celebrities', locale: 'es' },
  // movies
  { wordA: 'Comedia',        wordB: 'Drama',             difficulty: 'easy',   category: 'movies',      locale: 'es' },
  { wordA: 'Thriller',       wordB: 'Terror',            difficulty: 'easy',   category: 'movies',      locale: 'es' },
  { wordA: 'Acción',         wordB: 'Aventura',          difficulty: 'easy',   category: 'movies',      locale: 'es' },
  { wordA: 'Ciencia Ficción',wordB: 'Fantasía',          difficulty: 'medium', category: 'movies',      locale: 'es' },
  { wordA: 'Animación',      wordB: 'Dibujos Animados',  difficulty: 'easy',   category: 'movies',      locale: 'es' },
  { wordA: 'Documental',     wordB: 'Biopic',            difficulty: 'hard',   category: 'movies',      locale: 'es' },
  { wordA: 'Western',        wordB: 'Épico',             difficulty: 'hard',   category: 'movies',      locale: 'es' },
  { wordA: 'Romance',        wordB: 'Musical',           difficulty: 'medium', category: 'movies',      locale: 'es' },
  { wordA: 'Superhéroe',     wordB: 'Espía',             difficulty: 'medium', category: 'movies',      locale: 'es' },
  { wordA: 'Misterio',       wordB: 'Noir',              difficulty: 'hard',   category: 'movies',      locale: 'es' },
  // animals
  { wordA: 'León',           wordB: 'Tigre',             difficulty: 'easy',   category: 'animals',     locale: 'es' },
  { wordA: 'Perro',          wordB: 'Lobo',              difficulty: 'easy',   category: 'animals',     locale: 'es' },
  { wordA: 'Águila',         wordB: 'Halcón',            difficulty: 'medium', category: 'animals',     locale: 'es' },
  { wordA: 'Delfín',         wordB: 'Marsopa',           difficulty: 'hard',   category: 'animals',     locale: 'es' },
  { wordA: 'Cocodrilo',      wordB: 'Caimán',            difficulty: 'hard',   category: 'animals',     locale: 'es' },
  { wordA: 'Gorila',         wordB: 'Chimpancé',         difficulty: 'medium', category: 'animals',     locale: 'es' },
  { wordA: 'Pingüino',       wordB: 'Frailecillo',       difficulty: 'hard',   category: 'animals',     locale: 'es' },
  { wordA: 'Cobra',          wordB: 'Víbora',            difficulty: 'hard',   category: 'animals',     locale: 'es' },
  { wordA: 'Tiburón',        wordB: 'Barracuda',         difficulty: 'medium', category: 'animals',     locale: 'es' },
  { wordA: 'Camello',        wordB: 'Llama',             difficulty: 'medium', category: 'animals',     locale: 'es' },
  // sports
  { wordA: 'Fútbol',         wordB: 'Rugby',             difficulty: 'easy',   category: 'sports',      locale: 'es' },
  { wordA: 'Tenis',          wordB: 'Bádminton',         difficulty: 'medium', category: 'sports',      locale: 'es' },
  { wordA: 'Natación',       wordB: 'Buceo',             difficulty: 'easy',   category: 'sports',      locale: 'es' },
  { wordA: 'Baloncesto',     wordB: 'Voleibol',          difficulty: 'easy',   category: 'sports',      locale: 'es' },
  { wordA: 'Boxeo',          wordB: 'Lucha',             difficulty: 'medium', category: 'sports',      locale: 'es' },
  { wordA: 'Esquí',          wordB: 'Snowboard',         difficulty: 'medium', category: 'sports',      locale: 'es' },
  { wordA: 'Golf',           wordB: 'Críquet',           difficulty: 'medium', category: 'sports',      locale: 'es' },
  { wordA: 'Ciclismo',       wordB: 'Triatlón',          difficulty: 'hard',   category: 'sports',      locale: 'es' },
  { wordA: 'Judo',           wordB: 'Kárate',            difficulty: 'medium', category: 'sports',      locale: 'es' },
  { wordA: 'Béisbol',        wordB: 'Sóftbol',           difficulty: 'medium', category: 'sports',      locale: 'es' },
  // food
  { wordA: 'Pizza',          wordB: 'Pan Plano',         difficulty: 'medium', category: 'food',        locale: 'es' },
  { wordA: 'Sushi',          wordB: 'Sashimi',           difficulty: 'hard',   category: 'food',        locale: 'es' },
  { wordA: 'Hamburguesa',    wordB: 'Sándwich',          difficulty: 'easy',   category: 'food',        locale: 'es' },
  { wordA: 'Taco',           wordB: 'Burrito',           difficulty: 'easy',   category: 'food',        locale: 'es' },
  { wordA: 'Ramen',          wordB: 'Pho',               difficulty: 'medium', category: 'food',        locale: 'es' },
  { wordA: 'Curry',          wordB: 'Estofado',          difficulty: 'medium', category: 'food',        locale: 'es' },
  { wordA: 'Tarta de Queso', wordB: 'Tiramisú',          difficulty: 'medium', category: 'food',        locale: 'es' },
  { wordA: 'Croissant',      wordB: 'Magdalena',         difficulty: 'medium', category: 'food',        locale: 'es' },
  { wordA: 'Pasta',          wordB: 'Fideos',            difficulty: 'easy',   category: 'food',        locale: 'es' },
  { wordA: 'Kebab',          wordB: 'Shawarma',          difficulty: 'medium', category: 'food',        locale: 'es' },
  // music
  { wordA: 'Guitarra',       wordB: 'Violín',            difficulty: 'medium', category: 'music',       locale: 'es' },
  { wordA: 'Piano',          wordB: 'Órgano',            difficulty: 'medium', category: 'music',       locale: 'es' },
  { wordA: 'Jazz',           wordB: 'Blues',             difficulty: 'medium', category: 'music',       locale: 'es' },
  { wordA: 'Rock',           wordB: 'Metal',             difficulty: 'medium', category: 'music',       locale: 'es' },
  { wordA: 'Hip-Hop',        wordB: 'Rap',               difficulty: 'easy',   category: 'music',       locale: 'es' },
  { wordA: 'Pop',            wordB: 'R&B',               difficulty: 'easy',   category: 'music',       locale: 'es' },
  { wordA: 'Clásica',        wordB: 'Barroco',           difficulty: 'hard',   category: 'music',       locale: 'es' },
  { wordA: 'Reggae',         wordB: 'Ska',               difficulty: 'hard',   category: 'music',       locale: 'es' },
  { wordA: 'Electrónica',    wordB: 'Techno',            difficulty: 'medium', category: 'music',       locale: 'es' },
  { wordA: 'Trompeta',       wordB: 'Trombón',           difficulty: 'hard',   category: 'music',       locale: 'es' },
  // jobs
  { wordA: 'Médico',         wordB: 'Enfermero',         difficulty: 'easy',   category: 'jobs',        locale: 'es' },
  { wordA: 'Maestro',        wordB: 'Profesor',          difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Abogado',        wordB: 'Notario',           difficulty: 'hard',   category: 'jobs',        locale: 'es' },
  { wordA: 'Chef',           wordB: 'Cocinero',          difficulty: 'easy',   category: 'jobs',        locale: 'es' },
  { wordA: 'Arquitecto',     wordB: 'Ingeniero',         difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Piloto',         wordB: 'Copiloto',          difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Detective',      wordB: 'Inspector',         difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Periodista',     wordB: 'Reportero',         difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Fotógrafo',      wordB: 'Videógrafo',        difficulty: 'medium', category: 'jobs',        locale: 'es' },
  { wordA: 'Bombero',        wordB: 'Paramédico',        difficulty: 'medium', category: 'jobs',        locale: 'es' },
  // places
  { wordA: 'Castillo',       wordB: 'Fortaleza',         difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Biblioteca',     wordB: 'Librería',          difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Museo',          wordB: 'Galería',           difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Hospital',       wordB: 'Clínica',           difficulty: 'easy',   category: 'places',      locale: 'es' },
  { wordA: 'Estadio',        wordB: 'Arena',             difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Templo',         wordB: 'Iglesia',           difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Escuela',        wordB: 'Universidad',       difficulty: 'easy',   category: 'places',      locale: 'es' },
  { wordA: 'Puerto',         wordB: 'Muelle',            difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Mercado',        wordB: 'Bazar',             difficulty: 'medium', category: 'places',      locale: 'es' },
  { wordA: 'Teatro',         wordB: 'Cine',              difficulty: 'easy',   category: 'places',      locale: 'es' },
  // history
  { wordA: 'Reino',          wordB: 'Imperio',           difficulty: 'medium', category: 'history',     locale: 'es' },
  { wordA: 'Revolución',     wordB: 'Rebelión',          difficulty: 'hard',   category: 'history',     locale: 'es' },
  { wordA: 'Faraón',         wordB: 'Emperador',         difficulty: 'medium', category: 'history',     locale: 'es' },
  { wordA: 'Vikingo',        wordB: 'Pirata',            difficulty: 'medium', category: 'history',     locale: 'es' },
  { wordA: 'Pirámide',       wordB: 'Coliseo',           difficulty: 'medium', category: 'history',     locale: 'es' },
  { wordA: 'Samurái',        wordB: 'Caballero',         difficulty: 'medium', category: 'history',     locale: 'es' },
  { wordA: 'Democracia',     wordB: 'Monarquía',         difficulty: 'hard',   category: 'history',     locale: 'es' },
  { wordA: 'Cruzada',        wordB: 'Conquista',         difficulty: 'hard',   category: 'history',     locale: 'es' },
  { wordA: 'Colonia',        wordB: 'República',         difficulty: 'hard',   category: 'history',     locale: 'es' },
  { wordA: 'Renacimiento',   wordB: 'Ilustración',       difficulty: 'hard',   category: 'history',     locale: 'es' },
  // variety
  { wordA: 'Día',            wordB: 'Noche',             difficulty: 'easy',   category: 'variety',     locale: 'es' },
  { wordA: 'Caliente',       wordB: 'Frío',              difficulty: 'easy',   category: 'variety',     locale: 'es' },
  { wordA: 'Fuego',          wordB: 'Hielo',             difficulty: 'easy',   category: 'variety',     locale: 'es' },
  { wordA: 'Héroe',          wordB: 'Villano',           difficulty: 'easy',   category: 'variety',     locale: 'es' },
  { wordA: 'Pasado',         wordB: 'Futuro',            difficulty: 'medium', category: 'variety',     locale: 'es' },
  { wordA: 'Cielo',          wordB: 'Infierno',          difficulty: 'medium', category: 'variety',     locale: 'es' },
  { wordA: 'Amor',           wordB: 'Odio',              difficulty: 'easy',   category: 'variety',     locale: 'es' },
  { wordA: 'Caos',           wordB: 'Orden',             difficulty: 'hard',   category: 'variety',     locale: 'es' },
  { wordA: 'Sueño',          wordB: 'Realidad',          difficulty: 'medium', category: 'variety',     locale: 'es' },
  { wordA: 'Izquierda',      wordB: 'Derecha',           difficulty: 'easy',   category: 'variety',     locale: 'es' },
]

// ─────────────────────────────────────────────────────────────────────────────
// GERMAN
// ─────────────────────────────────────────────────────────────────────────────
const DE: PairData[] = [
  // mangas
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'de' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'de' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'de' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'de' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'de' },
  // celebrities
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'de' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'de' },
  { wordA: 'Michael Jackson',wordB: 'Prince',            difficulty: 'medium', category: 'celebrities', locale: 'de' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'de' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'de' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'de' },
  { wordA: 'Drake',          wordB: 'Kanye West',        difficulty: 'easy',   category: 'celebrities', locale: 'de' },
  { wordA: 'Brad Pitt',      wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities', locale: 'de' },
  { wordA: 'Serena Williams',wordB: 'Venus Williams',    difficulty: 'easy',   category: 'celebrities', locale: 'de' },
  { wordA: 'Roger Federer',  wordB: 'Rafael Nadal',      difficulty: 'medium', category: 'celebrities', locale: 'de' },
  // movies
  { wordA: 'Komödie',        wordB: 'Drama',             difficulty: 'easy',   category: 'movies',      locale: 'de' },
  { wordA: 'Thriller',       wordB: 'Horror',            difficulty: 'easy',   category: 'movies',      locale: 'de' },
  { wordA: 'Action',         wordB: 'Abenteuer',         difficulty: 'easy',   category: 'movies',      locale: 'de' },
  { wordA: 'Science-Fiction',wordB: 'Fantasy',           difficulty: 'medium', category: 'movies',      locale: 'de' },
  { wordA: 'Animation',      wordB: 'Zeichentrick',      difficulty: 'easy',   category: 'movies',      locale: 'de' },
  { wordA: 'Dokumentarfilm', wordB: 'Biopic',            difficulty: 'hard',   category: 'movies',      locale: 'de' },
  { wordA: 'Western',        wordB: 'Epos',              difficulty: 'hard',   category: 'movies',      locale: 'de' },
  { wordA: 'Romantik',       wordB: 'Musical',           difficulty: 'medium', category: 'movies',      locale: 'de' },
  { wordA: 'Superheld',      wordB: 'Spionage',          difficulty: 'medium', category: 'movies',      locale: 'de' },
  { wordA: 'Krimi',          wordB: 'Noir',              difficulty: 'hard',   category: 'movies',      locale: 'de' },
  // animals
  { wordA: 'Löwe',           wordB: 'Tiger',             difficulty: 'easy',   category: 'animals',     locale: 'de' },
  { wordA: 'Hund',           wordB: 'Wolf',              difficulty: 'easy',   category: 'animals',     locale: 'de' },
  { wordA: 'Adler',          wordB: 'Falke',             difficulty: 'medium', category: 'animals',     locale: 'de' },
  { wordA: 'Delfin',         wordB: 'Tümmler',           difficulty: 'hard',   category: 'animals',     locale: 'de' },
  { wordA: 'Krokodil',       wordB: 'Alligator',         difficulty: 'hard',   category: 'animals',     locale: 'de' },
  { wordA: 'Gorilla',        wordB: 'Schimpanse',        difficulty: 'medium', category: 'animals',     locale: 'de' },
  { wordA: 'Pinguin',        wordB: 'Papageientaucher',  difficulty: 'hard',   category: 'animals',     locale: 'de' },
  { wordA: 'Kobra',          wordB: 'Viper',             difficulty: 'hard',   category: 'animals',     locale: 'de' },
  { wordA: 'Hai',            wordB: 'Barrakuda',         difficulty: 'medium', category: 'animals',     locale: 'de' },
  { wordA: 'Kamel',          wordB: 'Lama',              difficulty: 'medium', category: 'animals',     locale: 'de' },
  // sports
  { wordA: 'Fußball',        wordB: 'Rugby',             difficulty: 'easy',   category: 'sports',      locale: 'de' },
  { wordA: 'Tennis',         wordB: 'Badminton',         difficulty: 'medium', category: 'sports',      locale: 'de' },
  { wordA: 'Schwimmen',      wordB: 'Tauchen',           difficulty: 'easy',   category: 'sports',      locale: 'de' },
  { wordA: 'Basketball',     wordB: 'Volleyball',        difficulty: 'easy',   category: 'sports',      locale: 'de' },
  { wordA: 'Boxen',          wordB: 'Ringen',            difficulty: 'medium', category: 'sports',      locale: 'de' },
  { wordA: 'Skifahren',      wordB: 'Snowboarden',       difficulty: 'medium', category: 'sports',      locale: 'de' },
  { wordA: 'Golf',           wordB: 'Kricket',           difficulty: 'medium', category: 'sports',      locale: 'de' },
  { wordA: 'Radfahren',      wordB: 'Triathlon',         difficulty: 'hard',   category: 'sports',      locale: 'de' },
  { wordA: 'Judo',           wordB: 'Karate',            difficulty: 'medium', category: 'sports',      locale: 'de' },
  { wordA: 'Baseball',       wordB: 'Softball',          difficulty: 'medium', category: 'sports',      locale: 'de' },
  // food
  { wordA: 'Pizza',          wordB: 'Flammkuchen',       difficulty: 'hard',   category: 'food',        locale: 'de' },
  { wordA: 'Sushi',          wordB: 'Sashimi',           difficulty: 'hard',   category: 'food',        locale: 'de' },
  { wordA: 'Burger',         wordB: 'Sandwich',          difficulty: 'easy',   category: 'food',        locale: 'de' },
  { wordA: 'Taco',           wordB: 'Burrito',           difficulty: 'easy',   category: 'food',        locale: 'de' },
  { wordA: 'Ramen',          wordB: 'Pho',               difficulty: 'medium', category: 'food',        locale: 'de' },
  { wordA: 'Curry',          wordB: 'Eintopf',           difficulty: 'medium', category: 'food',        locale: 'de' },
  { wordA: 'Käsekuchen',     wordB: 'Tiramisu',          difficulty: 'medium', category: 'food',        locale: 'de' },
  { wordA: 'Croissant',      wordB: 'Muffin',            difficulty: 'medium', category: 'food',        locale: 'de' },
  { wordA: 'Pasta',          wordB: 'Nudeln',            difficulty: 'easy',   category: 'food',        locale: 'de' },
  { wordA: 'Kebab',          wordB: 'Döner',             difficulty: 'medium', category: 'food',        locale: 'de' },
  // music
  { wordA: 'Gitarre',        wordB: 'Geige',             difficulty: 'medium', category: 'music',       locale: 'de' },
  { wordA: 'Klavier',        wordB: 'Orgel',             difficulty: 'medium', category: 'music',       locale: 'de' },
  { wordA: 'Jazz',           wordB: 'Blues',             difficulty: 'medium', category: 'music',       locale: 'de' },
  { wordA: 'Rock',           wordB: 'Metal',             difficulty: 'medium', category: 'music',       locale: 'de' },
  { wordA: 'Hip-Hop',        wordB: 'Rap',               difficulty: 'easy',   category: 'music',       locale: 'de' },
  { wordA: 'Pop',            wordB: 'R&B',               difficulty: 'easy',   category: 'music',       locale: 'de' },
  { wordA: 'Klassik',        wordB: 'Barock',            difficulty: 'hard',   category: 'music',       locale: 'de' },
  { wordA: 'Reggae',         wordB: 'Ska',               difficulty: 'hard',   category: 'music',       locale: 'de' },
  { wordA: 'Elektronik',     wordB: 'Techno',            difficulty: 'medium', category: 'music',       locale: 'de' },
  { wordA: 'Trompete',       wordB: 'Posaune',           difficulty: 'hard',   category: 'music',       locale: 'de' },
  // jobs
  { wordA: 'Arzt',           wordB: 'Krankenpfleger',    difficulty: 'easy',   category: 'jobs',        locale: 'de' },
  { wordA: 'Lehrer',         wordB: 'Professor',         difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Anwalt',         wordB: 'Notar',             difficulty: 'hard',   category: 'jobs',        locale: 'de' },
  { wordA: 'Koch',           wordB: 'Chefkoch',          difficulty: 'easy',   category: 'jobs',        locale: 'de' },
  { wordA: 'Architekt',      wordB: 'Ingenieur',         difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Pilot',          wordB: 'Copilot',           difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Detektiv',       wordB: 'Inspektor',         difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Journalist',     wordB: 'Reporter',          difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Fotograf',       wordB: 'Videograf',         difficulty: 'medium', category: 'jobs',        locale: 'de' },
  { wordA: 'Feuerwehrmann',  wordB: 'Sanitäter',         difficulty: 'medium', category: 'jobs',        locale: 'de' },
  // places
  { wordA: 'Burg',           wordB: 'Festung',           difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Bibliothek',     wordB: 'Buchhandlung',      difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Museum',         wordB: 'Galerie',           difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Krankenhaus',    wordB: 'Klinik',            difficulty: 'easy',   category: 'places',      locale: 'de' },
  { wordA: 'Stadion',        wordB: 'Arena',             difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Tempel',         wordB: 'Kirche',            difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Schule',         wordB: 'Universität',       difficulty: 'easy',   category: 'places',      locale: 'de' },
  { wordA: 'Hafen',          wordB: 'Kai',               difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Markt',          wordB: 'Basar',             difficulty: 'medium', category: 'places',      locale: 'de' },
  { wordA: 'Theater',        wordB: 'Kino',              difficulty: 'easy',   category: 'places',      locale: 'de' },
  // history
  { wordA: 'Königreich',     wordB: 'Kaiserreich',       difficulty: 'medium', category: 'history',     locale: 'de' },
  { wordA: 'Revolution',     wordB: 'Rebellion',         difficulty: 'hard',   category: 'history',     locale: 'de' },
  { wordA: 'Pharao',         wordB: 'Kaiser',            difficulty: 'medium', category: 'history',     locale: 'de' },
  { wordA: 'Wikinger',       wordB: 'Pirat',             difficulty: 'medium', category: 'history',     locale: 'de' },
  { wordA: 'Pyramide',       wordB: 'Kolosseum',         difficulty: 'medium', category: 'history',     locale: 'de' },
  { wordA: 'Samurai',        wordB: 'Ritter',            difficulty: 'medium', category: 'history',     locale: 'de' },
  { wordA: 'Demokratie',     wordB: 'Monarchie',         difficulty: 'hard',   category: 'history',     locale: 'de' },
  { wordA: 'Kreuzzug',       wordB: 'Eroberung',         difficulty: 'hard',   category: 'history',     locale: 'de' },
  { wordA: 'Kolonie',        wordB: 'Republik',          difficulty: 'hard',   category: 'history',     locale: 'de' },
  { wordA: 'Renaissance',    wordB: 'Aufklärung',        difficulty: 'hard',   category: 'history',     locale: 'de' },
  // variety
  { wordA: 'Tag',            wordB: 'Nacht',             difficulty: 'easy',   category: 'variety',     locale: 'de' },
  { wordA: 'Heiß',           wordB: 'Kalt',              difficulty: 'easy',   category: 'variety',     locale: 'de' },
  { wordA: 'Feuer',          wordB: 'Eis',               difficulty: 'easy',   category: 'variety',     locale: 'de' },
  { wordA: 'Held',           wordB: 'Bösewicht',         difficulty: 'easy',   category: 'variety',     locale: 'de' },
  { wordA: 'Vergangenheit',  wordB: 'Zukunft',           difficulty: 'medium', category: 'variety',     locale: 'de' },
  { wordA: 'Himmel',         wordB: 'Hölle',             difficulty: 'medium', category: 'variety',     locale: 'de' },
  { wordA: 'Liebe',          wordB: 'Hass',              difficulty: 'easy',   category: 'variety',     locale: 'de' },
  { wordA: 'Chaos',          wordB: 'Ordnung',           difficulty: 'hard',   category: 'variety',     locale: 'de' },
  { wordA: 'Traum',          wordB: 'Realität',          difficulty: 'medium', category: 'variety',     locale: 'de' },
  { wordA: 'Links',          wordB: 'Rechts',            difficulty: 'easy',   category: 'variety',     locale: 'de' },
]

// ─────────────────────────────────────────────────────────────────────────────
// ARABIC
// ─────────────────────────────────────────────────────────────────────────────
const AR: PairData[] = [
  // mangas
  { wordA: 'ناروتو',         wordB: 'ساسوكي',            difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'غوكو',           wordB: 'فيجيتا',            difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'لوفي',           wordB: 'زورو',              difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'إيتشيغو',        wordB: 'روكيا',             difficulty: 'medium', category: 'mangas',      locale: 'ar' },
  { wordA: 'إيرن',           wordB: 'ليفي',              difficulty: 'medium', category: 'mangas',      locale: 'ar' },
  { wordA: 'ديكو',           wordB: 'باكوغو',            difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'غوجو',           wordB: 'سوكونا',            difficulty: 'medium', category: 'mangas',      locale: 'ar' },
  { wordA: 'تانجيرو',        wordB: 'نيزوكو',            difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'كيلوا',          wordB: 'غون',               difficulty: 'easy',   category: 'mangas',      locale: 'ar' },
  { wordA: 'إدوارد إيلريك',  wordB: 'روي موستانغ',       difficulty: 'medium', category: 'mangas',      locale: 'ar' },
  // celebrities
  { wordA: 'رونالدو',        wordB: 'ميسي',              difficulty: 'easy',   category: 'celebrities', locale: 'ar' },
  { wordA: 'بيونسيه',        wordB: 'ريهانا',            difficulty: 'easy',   category: 'celebrities', locale: 'ar' },
  { wordA: 'مايكل جاكسون',   wordB: 'برينس',             difficulty: 'medium', category: 'celebrities', locale: 'ar' },
  { wordA: 'تايلور سويفت',   wordB: 'أريانا غراندي',     difficulty: 'easy',   category: 'celebrities', locale: 'ar' },
  { wordA: 'ليبرون جيمس',    wordB: 'كوبي برايانت',      difficulty: 'medium', category: 'celebrities', locale: 'ar' },
  { wordA: 'إيلون ماسك',     wordB: 'جيف بيزوس',         difficulty: 'medium', category: 'celebrities', locale: 'ar' },
  { wordA: 'درايك',          wordB: 'كانييه ويست',        difficulty: 'easy',   category: 'celebrities', locale: 'ar' },
  { wordA: 'براد بيت',       wordB: 'ليوناردو ديكابريو',  difficulty: 'medium', category: 'celebrities', locale: 'ar' },
  { wordA: 'سيرينا ويليامز', wordB: 'فينوس ويليامز',     difficulty: 'easy',   category: 'celebrities', locale: 'ar' },
  { wordA: 'روجر فيدرر',     wordB: 'رافاييل نادال',      difficulty: 'medium', category: 'celebrities', locale: 'ar' },
  // movies
  { wordA: 'كوميديا',        wordB: 'دراما',             difficulty: 'easy',   category: 'movies',      locale: 'ar' },
  { wordA: 'إثارة',          wordB: 'رعب',               difficulty: 'easy',   category: 'movies',      locale: 'ar' },
  { wordA: 'أكشن',           wordB: 'مغامرة',            difficulty: 'easy',   category: 'movies',      locale: 'ar' },
  { wordA: 'خيال علمي',      wordB: 'فانتازيا',          difficulty: 'medium', category: 'movies',      locale: 'ar' },
  { wordA: 'رسوم متحركة',    wordB: 'أنيميشن',           difficulty: 'easy',   category: 'movies',      locale: 'ar' },
  { wordA: 'وثائقي',         wordB: 'سيرة ذاتية',        difficulty: 'hard',   category: 'movies',      locale: 'ar' },
  { wordA: 'وسترن',          wordB: 'ملحمة',             difficulty: 'hard',   category: 'movies',      locale: 'ar' },
  { wordA: 'رومانسي',        wordB: 'موسيقال',           difficulty: 'medium', category: 'movies',      locale: 'ar' },
  { wordA: 'بطل خارق',       wordB: 'تجسس',              difficulty: 'medium', category: 'movies',      locale: 'ar' },
  { wordA: 'غموض',           wordB: 'نوار',              difficulty: 'hard',   category: 'movies',      locale: 'ar' },
  // animals
  { wordA: 'أسد',            wordB: 'نمر',               difficulty: 'easy',   category: 'animals',     locale: 'ar' },
  { wordA: 'كلب',            wordB: 'ذئب',               difficulty: 'easy',   category: 'animals',     locale: 'ar' },
  { wordA: 'نسر',            wordB: 'صقر',               difficulty: 'medium', category: 'animals',     locale: 'ar' },
  { wordA: 'دولفين',         wordB: 'خنزير البحر',       difficulty: 'hard',   category: 'animals',     locale: 'ar' },
  { wordA: 'تمساح',          wordB: 'أليغاتور',          difficulty: 'hard',   category: 'animals',     locale: 'ar' },
  { wordA: 'غوريلا',         wordB: 'شمبانزي',           difficulty: 'medium', category: 'animals',     locale: 'ar' },
  { wordA: 'بطريق',          wordB: 'بافن',              difficulty: 'hard',   category: 'animals',     locale: 'ar' },
  { wordA: 'كوبرا',          wordB: 'أفعى',              difficulty: 'hard',   category: 'animals',     locale: 'ar' },
  { wordA: 'قرش',            wordB: 'باراكودا',          difficulty: 'medium', category: 'animals',     locale: 'ar' },
  { wordA: 'جمل',            wordB: 'لاما',              difficulty: 'medium', category: 'animals',     locale: 'ar' },
  // sports
  { wordA: 'كرة القدم',      wordB: 'الراغبي',           difficulty: 'easy',   category: 'sports',      locale: 'ar' },
  { wordA: 'التنس',          wordB: 'البادمنتون',         difficulty: 'medium', category: 'sports',      locale: 'ar' },
  { wordA: 'السباحة',        wordB: 'الغوص',             difficulty: 'easy',   category: 'sports',      locale: 'ar' },
  { wordA: 'كرة السلة',      wordB: 'الكرة الطائرة',     difficulty: 'easy',   category: 'sports',      locale: 'ar' },
  { wordA: 'الملاكمة',       wordB: 'المصارعة',          difficulty: 'medium', category: 'sports',      locale: 'ar' },
  { wordA: 'التزلج',         wordB: 'السنوبورد',         difficulty: 'medium', category: 'sports',      locale: 'ar' },
  { wordA: 'الغولف',         wordB: 'الكريكيت',          difficulty: 'medium', category: 'sports',      locale: 'ar' },
  { wordA: 'ركوب الدراجات',  wordB: 'الترياتلون',        difficulty: 'hard',   category: 'sports',      locale: 'ar' },
  { wordA: 'الجودو',         wordB: 'الكاراتيه',         difficulty: 'medium', category: 'sports',      locale: 'ar' },
  { wordA: 'البيسبول',       wordB: 'السوفتبول',         difficulty: 'medium', category: 'sports',      locale: 'ar' },
  // food
  { wordA: 'بيتزا',          wordB: 'خبز مسطح',          difficulty: 'easy',   category: 'food',        locale: 'ar' },
  { wordA: 'سوشي',           wordB: 'ساشيمي',            difficulty: 'hard',   category: 'food',        locale: 'ar' },
  { wordA: 'برغر',           wordB: 'ساندويتش',          difficulty: 'easy',   category: 'food',        locale: 'ar' },
  { wordA: 'تاكو',           wordB: 'بوريتو',            difficulty: 'easy',   category: 'food',        locale: 'ar' },
  { wordA: 'رامن',           wordB: 'فو',                difficulty: 'medium', category: 'food',        locale: 'ar' },
  { wordA: 'كاري',           wordB: 'يخنة',              difficulty: 'medium', category: 'food',        locale: 'ar' },
  { wordA: 'تشيزكيك',        wordB: 'تيراميسو',          difficulty: 'medium', category: 'food',        locale: 'ar' },
  { wordA: 'كرواسان',        wordB: 'كعكة',              difficulty: 'medium', category: 'food',        locale: 'ar' },
  { wordA: 'معكرونة',        wordB: 'نودلز',             difficulty: 'easy',   category: 'food',        locale: 'ar' },
  { wordA: 'كباب',           wordB: 'شاورما',            difficulty: 'easy',   category: 'food',        locale: 'ar' },
  // music
  { wordA: 'غيتار',          wordB: 'كمان',              difficulty: 'medium', category: 'music',       locale: 'ar' },
  { wordA: 'بيانو',          wordB: 'أورغ',              difficulty: 'medium', category: 'music',       locale: 'ar' },
  { wordA: 'جاز',            wordB: 'بلوز',              difficulty: 'medium', category: 'music',       locale: 'ar' },
  { wordA: 'روك',            wordB: 'ميتال',             difficulty: 'medium', category: 'music',       locale: 'ar' },
  { wordA: 'هيب هوب',        wordB: 'راب',               difficulty: 'easy',   category: 'music',       locale: 'ar' },
  { wordA: 'بوب',            wordB: 'آر أند بي',         difficulty: 'easy',   category: 'music',       locale: 'ar' },
  { wordA: 'كلاسيكية',       wordB: 'باروك',             difficulty: 'hard',   category: 'music',       locale: 'ar' },
  { wordA: 'ريغي',           wordB: 'سكا',               difficulty: 'hard',   category: 'music',       locale: 'ar' },
  { wordA: 'إلكترونية',      wordB: 'تيكنو',             difficulty: 'medium', category: 'music',       locale: 'ar' },
  { wordA: 'ترمبيت',         wordB: 'ترومبون',           difficulty: 'hard',   category: 'music',       locale: 'ar' },
  // jobs
  { wordA: 'طبيب',           wordB: 'ممرض',              difficulty: 'easy',   category: 'jobs',        locale: 'ar' },
  { wordA: 'معلم',           wordB: 'أستاذ',             difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'محامٍ',          wordB: 'مستشار قانوني',     difficulty: 'hard',   category: 'jobs',        locale: 'ar' },
  { wordA: 'طاهٍ',           wordB: 'طباخ',              difficulty: 'easy',   category: 'jobs',        locale: 'ar' },
  { wordA: 'مهندس معماري',   wordB: 'مهندس',             difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'طيار',           wordB: 'مساعد طيار',        difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'محقق',           wordB: 'مفتش',              difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'صحفي',           wordB: 'مراسل',             difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'مصور',           wordB: 'مصور فيديو',        difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  { wordA: 'رجل إطفاء',      wordB: 'مسعف',              difficulty: 'medium', category: 'jobs',        locale: 'ar' },
  // places
  { wordA: 'قلعة',           wordB: 'حصن',               difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'مكتبة عامة',     wordB: 'مكتبة كتب',         difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'متحف',           wordB: 'معرض',              difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'مستشفى',         wordB: 'عيادة',             difficulty: 'easy',   category: 'places',      locale: 'ar' },
  { wordA: 'ملعب',           wordB: 'أرينا',             difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'معبد',           wordB: 'كنيسة',             difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'مدرسة',          wordB: 'جامعة',             difficulty: 'easy',   category: 'places',      locale: 'ar' },
  { wordA: 'ميناء',          wordB: 'رصيف',              difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'سوق',            wordB: 'بازار',             difficulty: 'medium', category: 'places',      locale: 'ar' },
  { wordA: 'مسرح',           wordB: 'سينما',             difficulty: 'easy',   category: 'places',      locale: 'ar' },
  // history
  { wordA: 'مملكة',          wordB: 'إمبراطورية',        difficulty: 'medium', category: 'history',     locale: 'ar' },
  { wordA: 'ثورة',           wordB: 'تمرد',              difficulty: 'hard',   category: 'history',     locale: 'ar' },
  { wordA: 'فرعون',          wordB: 'إمبراطور',          difficulty: 'medium', category: 'history',     locale: 'ar' },
  { wordA: 'فايكنج',         wordB: 'قرصان',             difficulty: 'medium', category: 'history',     locale: 'ar' },
  { wordA: 'هرم',            wordB: 'كولوسيوم',          difficulty: 'medium', category: 'history',     locale: 'ar' },
  { wordA: 'ساموراي',        wordB: 'فارس',              difficulty: 'medium', category: 'history',     locale: 'ar' },
  { wordA: 'ديمقراطية',      wordB: 'ملكية',             difficulty: 'hard',   category: 'history',     locale: 'ar' },
  { wordA: 'حملة صليبية',    wordB: 'فتح',               difficulty: 'hard',   category: 'history',     locale: 'ar' },
  { wordA: 'مستعمرة',        wordB: 'جمهورية',           difficulty: 'hard',   category: 'history',     locale: 'ar' },
  { wordA: 'عصر النهضة',     wordB: 'عصر التنوير',       difficulty: 'hard',   category: 'history',     locale: 'ar' },
  // variety
  { wordA: 'نهار',           wordB: 'ليل',               difficulty: 'easy',   category: 'variety',     locale: 'ar' },
  { wordA: 'حار',            wordB: 'بارد',              difficulty: 'easy',   category: 'variety',     locale: 'ar' },
  { wordA: 'نار',            wordB: 'جليد',              difficulty: 'easy',   category: 'variety',     locale: 'ar' },
  { wordA: 'بطل',            wordB: 'شرير',              difficulty: 'easy',   category: 'variety',     locale: 'ar' },
  { wordA: 'الماضي',         wordB: 'المستقبل',          difficulty: 'medium', category: 'variety',     locale: 'ar' },
  { wordA: 'جنة',            wordB: 'جهنم',              difficulty: 'medium', category: 'variety',     locale: 'ar' },
  { wordA: 'حب',             wordB: 'كراهية',            difficulty: 'easy',   category: 'variety',     locale: 'ar' },
  { wordA: 'فوضى',           wordB: 'نظام',              difficulty: 'hard',   category: 'variety',     locale: 'ar' },
  { wordA: 'حلم',            wordB: 'واقع',              difficulty: 'medium', category: 'variety',     locale: 'ar' },
  { wordA: 'يسار',           wordB: 'يمين',              difficulty: 'easy',   category: 'variety',     locale: 'ar' },
]

// ─── Italian ──────────────────────────────────────────────────────────────────
const IT: PairData[] = [
  // mangas (universal names)
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'it' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'it' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'it' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'it' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'it' },
  // celebrities (universal)
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'it' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'it' },
  { wordA: 'Michael Jackson',wordB: 'Prince',            difficulty: 'medium', category: 'celebrities', locale: 'it' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'it' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'it' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'it' },
  { wordA: 'Drake',          wordB: 'Kanye West',        difficulty: 'easy',   category: 'celebrities', locale: 'it' },
  { wordA: 'Brad Pitt',      wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities', locale: 'it' },
  { wordA: 'Serena Williams',wordB: 'Venus Williams',    difficulty: 'easy',   category: 'celebrities', locale: 'it' },
  { wordA: 'Roger Federer',  wordB: 'Rafael Nadal',      difficulty: 'medium', category: 'celebrities', locale: 'it' },
  // movies
  { wordA: 'Commedia',       wordB: 'Dramma',            difficulty: 'easy',   category: 'movies',      locale: 'it' },
  { wordA: 'Thriller',       wordB: 'Horror',            difficulty: 'easy',   category: 'movies',      locale: 'it' },
  { wordA: 'Azione',         wordB: 'Avventura',         difficulty: 'easy',   category: 'movies',      locale: 'it' },
  { wordA: 'Fantascienza',   wordB: 'Fantasy',           difficulty: 'medium', category: 'movies',      locale: 'it' },
  { wordA: 'Animazione',     wordB: 'Cartone',           difficulty: 'easy',   category: 'movies',      locale: 'it' },
  // animals
  { wordA: 'Gatto',          wordB: 'Cane',              difficulty: 'easy',   category: 'animals',     locale: 'it' },
  { wordA: 'Leone',          wordB: 'Tigre',             difficulty: 'easy',   category: 'animals',     locale: 'it' },
  { wordA: 'Aquila',         wordB: 'Falco',             difficulty: 'medium', category: 'animals',     locale: 'it' },
  { wordA: 'Delfino',        wordB: 'Squalo',            difficulty: 'easy',   category: 'animals',     locale: 'it' },
  { wordA: 'Cavallo',        wordB: 'Zebra',             difficulty: 'easy',   category: 'animals',     locale: 'it' },
  // sports
  { wordA: 'Calcio',         wordB: 'Basket',            difficulty: 'easy',   category: 'sports',      locale: 'it' },
  { wordA: 'Tennis',         wordB: 'Pallavolo',         difficulty: 'easy',   category: 'sports',      locale: 'it' },
  { wordA: 'Nuoto',          wordB: 'Atletica',          difficulty: 'medium', category: 'sports',      locale: 'it' },
  { wordA: 'Ciclismo',       wordB: 'Maratona',          difficulty: 'medium', category: 'sports',      locale: 'it' },
  { wordA: 'Boxe',           wordB: 'Karate',            difficulty: 'easy',   category: 'sports',      locale: 'it' },
  // food
  { wordA: 'Pizza',          wordB: 'Pasta',             difficulty: 'easy',   category: 'food',        locale: 'it' },
  { wordA: 'Gelato',         wordB: 'Torta',             difficulty: 'easy',   category: 'food',        locale: 'it' },
  { wordA: 'Risotto',        wordB: 'Lasagna',           difficulty: 'easy',   category: 'food',        locale: 'it' },
  { wordA: 'Caffè',          wordB: 'Tè',               difficulty: 'easy',   category: 'food',        locale: 'it' },
  { wordA: 'Pane',           wordB: 'Formaggio',         difficulty: 'easy',   category: 'food',        locale: 'it' },
  // music
  { wordA: 'Chitarra',       wordB: 'Pianoforte',        difficulty: 'easy',   category: 'music',       locale: 'it' },
  { wordA: 'Rock',           wordB: 'Pop',               difficulty: 'easy',   category: 'music',       locale: 'it' },
  { wordA: 'Opera',          wordB: 'Jazz',              difficulty: 'medium', category: 'music',       locale: 'it' },
  { wordA: 'Violino',        wordB: 'Flauto',            difficulty: 'medium', category: 'music',       locale: 'it' },
  { wordA: 'Batteria',       wordB: 'Basso',             difficulty: 'medium', category: 'music',       locale: 'it' },
  // jobs
  { wordA: 'Medico',         wordB: 'Infermiere',        difficulty: 'easy',   category: 'jobs',        locale: 'it' },
  { wordA: 'Avvocato',       wordB: 'Giudice',           difficulty: 'easy',   category: 'jobs',        locale: 'it' },
  { wordA: 'Insegnante',     wordB: 'Professore',        difficulty: 'easy',   category: 'jobs',        locale: 'it' },
  { wordA: 'Cuoco',          wordB: 'Cameriere',         difficulty: 'easy',   category: 'jobs',        locale: 'it' },
  { wordA: 'Pompiere',       wordB: 'Poliziotto',        difficulty: 'easy',   category: 'jobs',        locale: 'it' },
  // places
  { wordA: 'Roma',           wordB: 'Milano',            difficulty: 'easy',   category: 'places',      locale: 'it' },
  { wordA: 'Montagna',       wordB: 'Mare',              difficulty: 'easy',   category: 'places',      locale: 'it' },
  { wordA: 'Museo',          wordB: 'Teatro',            difficulty: 'medium', category: 'places',      locale: 'it' },
  { wordA: 'Aeroporto',      wordB: 'Stazione',          difficulty: 'easy',   category: 'places',      locale: 'it' },
  { wordA: 'Parco',          wordB: 'Giardino',          difficulty: 'easy',   category: 'places',      locale: 'it' },
  // history
  { wordA: 'Giulio Cesare',  wordB: 'Augusto',           difficulty: 'medium', category: 'history',     locale: 'it' },
  { wordA: 'Leonardo da Vinci', wordB: 'Michelangelo',   difficulty: 'easy',   category: 'history',     locale: 'it' },
  { wordA: 'Napoleone',      wordB: 'Garibaldi',         difficulty: 'medium', category: 'history',     locale: 'it' },
  { wordA: 'Colosseo',       wordB: 'Pantheon',          difficulty: 'easy',   category: 'history',     locale: 'it' },
  { wordA: 'Rinascimento',   wordB: 'Medioevo',          difficulty: 'hard',   category: 'history',     locale: 'it' },
  // variety
  { wordA: 'Sole',           wordB: 'Luna',              difficulty: 'easy',   category: 'variety',     locale: 'it' },
  { wordA: 'Estate',         wordB: 'Inverno',           difficulty: 'easy',   category: 'variety',     locale: 'it' },
  { wordA: 'Giorno',         wordB: 'Notte',             difficulty: 'easy',   category: 'variety',     locale: 'it' },
  { wordA: 'Fuoco',          wordB: 'Acqua',             difficulty: 'easy',   category: 'variety',     locale: 'it' },
  { wordA: 'Grande',         wordB: 'Piccolo',           difficulty: 'easy',   category: 'variety',     locale: 'it' },
]

// ─── Portuguese ───────────────────────────────────────────────────────────────
const PT: PairData[] = [
  // mangas (universal)
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'pt' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'pt' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'pt' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'pt' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'pt' },
  // celebrities (universal)
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'pt' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'pt' },
  { wordA: 'Neymar',         wordB: 'Mbappé',            difficulty: 'easy',   category: 'celebrities', locale: 'pt' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'pt' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'pt' },
  // movies
  { wordA: 'Comédia',        wordB: 'Drama',             difficulty: 'easy',   category: 'movies',      locale: 'pt' },
  { wordA: 'Ação',           wordB: 'Aventura',          difficulty: 'easy',   category: 'movies',      locale: 'pt' },
  { wordA: 'Terror',         wordB: 'Suspense',          difficulty: 'easy',   category: 'movies',      locale: 'pt' },
  { wordA: 'Animação',       wordB: 'Desenho',           difficulty: 'easy',   category: 'movies',      locale: 'pt' },
  { wordA: 'Ficção',         wordB: 'Fantasia',          difficulty: 'medium', category: 'movies',      locale: 'pt' },
  // animals
  { wordA: 'Gato',           wordB: 'Cachorro',          difficulty: 'easy',   category: 'animals',     locale: 'pt' },
  { wordA: 'Leão',           wordB: 'Tigre',             difficulty: 'easy',   category: 'animals',     locale: 'pt' },
  { wordA: 'Águia',          wordB: 'Falcão',            difficulty: 'medium', category: 'animals',     locale: 'pt' },
  { wordA: 'Golfinho',       wordB: 'Tubarão',           difficulty: 'easy',   category: 'animals',     locale: 'pt' },
  { wordA: 'Cavalo',         wordB: 'Zebra',             difficulty: 'easy',   category: 'animals',     locale: 'pt' },
  // sports
  { wordA: 'Futebol',        wordB: 'Basquete',          difficulty: 'easy',   category: 'sports',      locale: 'pt' },
  { wordA: 'Tênis',          wordB: 'Vôlei',             difficulty: 'easy',   category: 'sports',      locale: 'pt' },
  { wordA: 'Natação',        wordB: 'Atletismo',         difficulty: 'medium', category: 'sports',      locale: 'pt' },
  { wordA: 'Surfe',          wordB: 'Skate',             difficulty: 'easy',   category: 'sports',      locale: 'pt' },
  { wordA: 'Boxe',           wordB: 'Judô',              difficulty: 'easy',   category: 'sports',      locale: 'pt' },
  // food
  { wordA: 'Arroz',          wordB: 'Feijão',            difficulty: 'easy',   category: 'food',        locale: 'pt' },
  { wordA: 'Café',           wordB: 'Chá',               difficulty: 'easy',   category: 'food',        locale: 'pt' },
  { wordA: 'Pão',            wordB: 'Queijo',            difficulty: 'easy',   category: 'food',        locale: 'pt' },
  { wordA: 'Bolo',           wordB: 'Sorvete',           difficulty: 'easy',   category: 'food',        locale: 'pt' },
  { wordA: 'Churrasco',      wordB: 'Feijoada',          difficulty: 'easy',   category: 'food',        locale: 'pt' },
  // music
  { wordA: 'Guitarra',       wordB: 'Piano',             difficulty: 'easy',   category: 'music',       locale: 'pt' },
  { wordA: 'Samba',          wordB: 'Forró',             difficulty: 'easy',   category: 'music',       locale: 'pt' },
  { wordA: 'Rock',           wordB: 'Pop',               difficulty: 'easy',   category: 'music',       locale: 'pt' },
  { wordA: 'Violão',         wordB: 'Cavaquinho',        difficulty: 'medium', category: 'music',       locale: 'pt' },
  { wordA: 'Bateria',        wordB: 'Baixo',             difficulty: 'medium', category: 'music',       locale: 'pt' },
  // jobs
  { wordA: 'Médico',         wordB: 'Enfermeiro',        difficulty: 'easy',   category: 'jobs',        locale: 'pt' },
  { wordA: 'Advogado',       wordB: 'Juiz',              difficulty: 'easy',   category: 'jobs',        locale: 'pt' },
  { wordA: 'Professor',      wordB: 'Diretor',           difficulty: 'easy',   category: 'jobs',        locale: 'pt' },
  { wordA: 'Cozinheiro',     wordB: 'Garçom',            difficulty: 'easy',   category: 'jobs',        locale: 'pt' },
  { wordA: 'Bombeiro',       wordB: 'Policial',          difficulty: 'easy',   category: 'jobs',        locale: 'pt' },
  // places
  { wordA: 'Praia',          wordB: 'Montanha',          difficulty: 'easy',   category: 'places',      locale: 'pt' },
  { wordA: 'São Paulo',      wordB: 'Rio de Janeiro',    difficulty: 'easy',   category: 'places',      locale: 'pt' },
  { wordA: 'Museu',          wordB: 'Teatro',            difficulty: 'medium', category: 'places',      locale: 'pt' },
  { wordA: 'Aeroporto',      wordB: 'Rodoviária',        difficulty: 'easy',   category: 'places',      locale: 'pt' },
  { wordA: 'Parque',         wordB: 'Jardim',            difficulty: 'easy',   category: 'places',      locale: 'pt' },
  // history
  { wordA: 'Pedro I',        wordB: 'Pedro II',          difficulty: 'medium', category: 'history',     locale: 'pt' },
  { wordA: 'Tiradentes',     wordB: 'Zumbi',             difficulty: 'hard',   category: 'history',     locale: 'pt' },
  { wordA: 'Descobrimento',  wordB: 'Independência',     difficulty: 'medium', category: 'history',     locale: 'pt' },
  { wordA: 'Império',        wordB: 'República',         difficulty: 'medium', category: 'history',     locale: 'pt' },
  { wordA: 'Caravela',       wordB: 'Navio',             difficulty: 'easy',   category: 'history',     locale: 'pt' },
  // variety
  { wordA: 'Sol',            wordB: 'Lua',               difficulty: 'easy',   category: 'variety',     locale: 'pt' },
  { wordA: 'Verão',          wordB: 'Inverno',           difficulty: 'easy',   category: 'variety',     locale: 'pt' },
  { wordA: 'Dia',            wordB: 'Noite',             difficulty: 'easy',   category: 'variety',     locale: 'pt' },
  { wordA: 'Fogo',           wordB: 'Água',              difficulty: 'easy',   category: 'variety',     locale: 'pt' },
  { wordA: 'Grande',         wordB: 'Pequeno',           difficulty: 'easy',   category: 'variety',     locale: 'pt' },
]

// ─── Chinese ──────────────────────────────────────────────────────────────────
const ZH: PairData[] = [
  // mangas (universal names)
  { wordA: 'Naruto',         wordB: 'Sasuke',            difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Goku',           wordB: 'Vegeta',            difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Luffy',          wordB: 'Zoro',              difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Ichigo',         wordB: 'Rukia',             difficulty: 'medium', category: 'mangas',      locale: 'zh' },
  { wordA: 'Eren',           wordB: 'Levi',              difficulty: 'medium', category: 'mangas',      locale: 'zh' },
  { wordA: 'Deku',           wordB: 'Bakugo',            difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Gojo',           wordB: 'Sukuna',            difficulty: 'medium', category: 'mangas',      locale: 'zh' },
  { wordA: 'Tanjiro',        wordB: 'Nezuko',            difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Killua',         wordB: 'Gon',               difficulty: 'easy',   category: 'mangas',      locale: 'zh' },
  { wordA: 'Edward Elric',   wordB: 'Roy Mustang',       difficulty: 'medium', category: 'mangas',      locale: 'zh' },
  // celebrities (universal)
  { wordA: 'Ronaldo',        wordB: 'Messi',             difficulty: 'easy',   category: 'celebrities', locale: 'zh' },
  { wordA: 'Beyoncé',        wordB: 'Rihanna',           difficulty: 'easy',   category: 'celebrities', locale: 'zh' },
  { wordA: 'Taylor Swift',   wordB: 'Ariana Grande',     difficulty: 'easy',   category: 'celebrities', locale: 'zh' },
  { wordA: 'LeBron James',   wordB: 'Kobe Bryant',       difficulty: 'medium', category: 'celebrities', locale: 'zh' },
  { wordA: 'Elon Musk',      wordB: 'Jeff Bezos',        difficulty: 'medium', category: 'celebrities', locale: 'zh' },
  // movies
  { wordA: '喜剧',           wordB: '悲剧',              difficulty: 'easy',   category: 'movies',      locale: 'zh' },
  { wordA: '动作片',         wordB: '冒险片',            difficulty: 'easy',   category: 'movies',      locale: 'zh' },
  { wordA: '恐怖片',         wordB: '悬疑片',            difficulty: 'easy',   category: 'movies',      locale: 'zh' },
  { wordA: '科幻',           wordB: '奇幻',              difficulty: 'medium', category: 'movies',      locale: 'zh' },
  { wordA: '动画',           wordB: '纪录片',            difficulty: 'medium', category: 'movies',      locale: 'zh' },
  // animals
  { wordA: '猫',             wordB: '狗',                difficulty: 'easy',   category: 'animals',     locale: 'zh' },
  { wordA: '狮子',           wordB: '老虎',              difficulty: 'easy',   category: 'animals',     locale: 'zh' },
  { wordA: '鹰',             wordB: '隼',                difficulty: 'medium', category: 'animals',     locale: 'zh' },
  { wordA: '海豚',           wordB: '鲨鱼',              difficulty: 'easy',   category: 'animals',     locale: 'zh' },
  { wordA: '马',             wordB: '驴',                difficulty: 'easy',   category: 'animals',     locale: 'zh' },
  // sports
  { wordA: '足球',           wordB: '篮球',              difficulty: 'easy',   category: 'sports',      locale: 'zh' },
  { wordA: '网球',           wordB: '排球',              difficulty: 'easy',   category: 'sports',      locale: 'zh' },
  { wordA: '游泳',           wordB: '跑步',              difficulty: 'easy',   category: 'sports',      locale: 'zh' },
  { wordA: '乒乓球',         wordB: '羽毛球',            difficulty: 'easy',   category: 'sports',      locale: 'zh' },
  { wordA: '武术',           wordB: '柔道',              difficulty: 'medium', category: 'sports',      locale: 'zh' },
  // food
  { wordA: '米饭',           wordB: '面条',              difficulty: 'easy',   category: 'food',        locale: 'zh' },
  { wordA: '茶',             wordB: '咖啡',              difficulty: 'easy',   category: 'food',        locale: 'zh' },
  { wordA: '饺子',           wordB: '包子',              difficulty: 'easy',   category: 'food',        locale: 'zh' },
  { wordA: '火锅',           wordB: '烧烤',              difficulty: 'easy',   category: 'food',        locale: 'zh' },
  { wordA: '豆腐',           wordB: '鸡蛋',              difficulty: 'easy',   category: 'food',        locale: 'zh' },
  // music
  { wordA: '钢琴',           wordB: '吉他',              difficulty: 'easy',   category: 'music',       locale: 'zh' },
  { wordA: '摇滚',           wordB: '流行',              difficulty: 'easy',   category: 'music',       locale: 'zh' },
  { wordA: '二胡',           wordB: '古筝',              difficulty: 'medium', category: 'music',       locale: 'zh' },
  { wordA: '交响乐',         wordB: '爵士乐',            difficulty: 'hard',   category: 'music',       locale: 'zh' },
  { wordA: '鼓',             wordB: '笛子',              difficulty: 'medium', category: 'music',       locale: 'zh' },
  // jobs
  { wordA: '医生',           wordB: '护士',              difficulty: 'easy',   category: 'jobs',        locale: 'zh' },
  { wordA: '律师',           wordB: '法官',              difficulty: 'easy',   category: 'jobs',        locale: 'zh' },
  { wordA: '老师',           wordB: '教授',              difficulty: 'easy',   category: 'jobs',        locale: 'zh' },
  { wordA: '厨师',           wordB: '服务员',            difficulty: 'easy',   category: 'jobs',        locale: 'zh' },
  { wordA: '消防员',         wordB: '警察',              difficulty: 'easy',   category: 'jobs',        locale: 'zh' },
  // places
  { wordA: '北京',           wordB: '上海',              difficulty: 'easy',   category: 'places',      locale: 'zh' },
  { wordA: '长城',           wordB: '故宫',              difficulty: 'easy',   category: 'places',      locale: 'zh' },
  { wordA: '山',             wordB: '海',                difficulty: 'easy',   category: 'places',      locale: 'zh' },
  { wordA: '机场',           wordB: '火车站',            difficulty: 'easy',   category: 'places',      locale: 'zh' },
  { wordA: '公园',           wordB: '花园',              difficulty: 'easy',   category: 'places',      locale: 'zh' },
  // history
  { wordA: '秦始皇',         wordB: '汉武帝',            difficulty: 'medium', category: 'history',     locale: 'zh' },
  { wordA: '孔子',           wordB: '老子',              difficulty: 'medium', category: 'history',     locale: 'zh' },
  { wordA: '唐朝',           wordB: '宋朝',              difficulty: 'medium', category: 'history',     locale: 'zh' },
  { wordA: '长征',           wordB: '革命',              difficulty: 'hard',   category: 'history',     locale: 'zh' },
  { wordA: '丝绸之路',       wordB: '大运河',            difficulty: 'hard',   category: 'history',     locale: 'zh' },
  // variety
  { wordA: '太阳',           wordB: '月亮',              difficulty: 'easy',   category: 'variety',     locale: 'zh' },
  { wordA: '夏天',           wordB: '冬天',              difficulty: 'easy',   category: 'variety',     locale: 'zh' },
  { wordA: '白天',           wordB: '黑夜',              difficulty: 'easy',   category: 'variety',     locale: 'zh' },
  { wordA: '火',             wordB: '水',                difficulty: 'easy',   category: 'variety',     locale: 'zh' },
  { wordA: '大',             wordB: '小',                difficulty: 'easy',   category: 'variety',     locale: 'zh' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Pack definitions — one per locale
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGE_PACKS = [
  { locale: 'en', name: 'General',   description: 'General word pack (English) — 10 pairs per category',                           pairs: EN },
  { locale: 'fr', name: 'Général',   description: 'Pack de mots général (Français) — 10 paires par catégorie',                     pairs: FR },
  { locale: 'es', name: 'General',   description: 'Pack de palabras general (Español) — 10 pares por categoría',                   pairs: ES },
  { locale: 'de', name: 'Allgemein', description: 'Allgemeines Wortpaket (Deutsch) — 10 Paare pro Kategorie',                      pairs: DE },
  { locale: 'ar', name: 'عام',       description: 'حزمة الكلمات العامة (العربية) — 10 أزواج لكل فئة',                             pairs: AR },
  { locale: 'it', name: 'Generale',  description: 'Pacchetto di parole generale (Italiano)',                                       pairs: IT },
  { locale: 'pt', name: 'Geral',     description: 'Pacote de palavras geral (Português)',                                          pairs: PT },
  { locale: 'zh', name: '通用',      description: '通用词包 (中文)',                                                                 pairs: ZH },
]

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding database...')

  // ── Word Packs (one per locale) ───────────────────────────────────────────
  let totalPairs = 0
  for (const pack of LANGUAGE_PACKS) {
    const existing = await prisma.wordPack.findFirst({
      where: { locale: pack.locale, isPremium: false, authorId: null },
    })

    if (existing) {
      await prisma.wordPair.deleteMany({ where: { packId: existing.id } })
      await prisma.wordPair.createMany({
        data: pack.pairs.map((p) => ({ ...p, packId: existing.id })),
      })
      // Refresh pack metadata too
      await prisma.wordPack.update({
        where: { id: existing.id },
        data: { name: pack.name, description: pack.description, isApproved: true },
      })
      console.log(`  Updated  "${pack.name}" (${pack.locale}) — ${pack.pairs.length} pairs`)
    } else {
      await prisma.wordPack.create({
        data: {
          name:        pack.name,
          description: pack.description,
          isPremium:   false,
          isPublic:    false,
          isApproved:  true,
          locale:      pack.locale,
          pairs: { create: pack.pairs },
        },
      })
      console.log(`  Created  "${pack.name}" (${pack.locale}) — ${pack.pairs.length} pairs`)
    }
    totalPairs += pack.pairs.length
  }
  console.log(`Word packs seeded. Total pairs: ${totalPairs}`)

  // ── Achievements ──────────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { key: 'first_win',        name: 'First Win',           description: 'Win your very first game',                     icon: '🏆' },
    { key: 'first_imposter',   name: 'First Imposter',      description: 'Win a game as the imposter',                   icon: '🎭' },
    { key: 'perfect_imposter', name: 'Perfect Imposter',    description: 'Win as imposter without being voted out once', icon: '🌟' },
    { key: 'ten_wins',         name: 'Veteran',             description: 'Win 10 games total',                          icon: '🎖️' },
    { key: 'imposter_x10',     name: 'Master of Deception', description: 'Win 10 games as the imposter',                icon: '🕵️' },
    { key: 'honor_giver_5',    name: 'Generous',            description: 'Give honor to 5 different players',           icon: '🤝' },
    { key: 'honor_receiver_5', name: 'Beloved',             description: 'Receive 5 honors from other players',         icon: '💖' },
    { key: 'survivor',         name: 'Survivor',            description: 'Survive all rounds without being eliminated', icon: '💪' },
    { key: 'correct_voter',    name: 'Good Eye',            description: 'Vote correctly to eliminate the imposter',    icon: '👁️' },
    { key: 'social_butterfly', name: 'Social Butterfly',    description: 'Make 5 friends',                              icon: '🦋' },
  ]
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: ach.key }, create: ach, update: {} })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)

  // ── Cosmetics ─────────────────────────────────────────────────────────────
  const COSMETICS = [
    { type: 'avatar',          name: 'Shadow Fox',      description: 'A sleek dark fox',        imageUrl: '/cosmetics/avatar_fox.png',        price: 200, currency: 'star' },
    { type: 'avatar',          name: 'Neon Wolf',       description: 'Glowing cyber wolf',      imageUrl: '/cosmetics/avatar_wolf.png',       price: 350, currency: 'star' },
    { type: 'avatar',          name: 'Crystal Bird',    description: 'Icy blue bird',           imageUrl: '/cosmetics/avatar_bird.png',       price: 300, currency: 'star' },
    { type: 'avatar',          name: 'Gold Dragon',     description: 'Legendary dragon',        imageUrl: '/cosmetics/avatar_dragon.png',     price: 500, currency: 'gold' },
    { type: 'avatar',          name: 'Phantom Cat',     description: 'Mystery cat',             imageUrl: '/cosmetics/avatar_cat.png',        price: 150, currency: 'star' },
    { type: 'card_background', name: 'Midnight',        description: 'Dark starry night',       imageUrl: '/cosmetics/bg_midnight.png',       price: 100, currency: 'star' },
    { type: 'card_background', name: 'Sunset',          description: 'Orange sunset glow',      imageUrl: '/cosmetics/bg_sunset.png',         price: 100, currency: 'star' },
    { type: 'card_background', name: 'Aurora',          description: 'Northern lights',         imageUrl: '/cosmetics/bg_aurora.png',         price: 250, currency: 'star' },
    { type: 'card_background', name: 'Royal Gold',      description: 'Gilded luxury theme',     imageUrl: '/cosmetics/bg_gold.png',           price: 300, currency: 'gold' },
    { type: 'badge',           name: 'Detective Badge', description: 'I found the imposter!',   imageUrl: '/cosmetics/badge_detective.png',   price: 200, currency: 'star' },
    { type: 'badge',           name: 'Imposter Badge',  description: 'Master of deception',     imageUrl: '/cosmetics/badge_imposter.png',   price: 200, currency: 'star' },
    { type: 'badge',           name: 'Crown Badge',     description: 'Top player',              imageUrl: '/cosmetics/badge_crown.png',       price: 500, currency: 'gold' },
    { type: 'title',           name: 'The Imposter',    description: 'You look sus',            imageUrl: '/cosmetics/title_imposter.png',    price: 150, currency: 'star' },
    { type: 'title',           name: 'The Detective',   description: 'Eyes everywhere',         imageUrl: '/cosmetics/title_detective.png',   price: 150, currency: 'star' },
    { type: 'title',           name: 'The Legendary',   description: 'Beyond compare',          imageUrl: '/cosmetics/title_legend.png',      price: 400, currency: 'gold' },
    { type: 'word_effect',     name: 'Fire Words',      description: 'Flaming text on reveal',  imageUrl: '/cosmetics/fx_fire.png',           price: 200, currency: 'star' },
    { type: 'word_effect',     name: 'Glitch Words',    description: 'Glitchy digital effect',  imageUrl: '/cosmetics/fx_glitch.png',         price: 250, currency: 'star' },
    { type: 'word_effect',     name: 'Galaxy Words',    description: 'Space particle effect',   imageUrl: '/cosmetics/fx_galaxy.png',         price: 350, currency: 'gold' },
  ]
  for (const c of COSMETICS) {
    await prisma.cosmetic.upsert({
      where: { id: c.name.replace(/\s+/g, '_').toLowerCase() },
      create: { ...c, id: c.name.replace(/\s+/g, '_').toLowerCase() },
      update: {},
    }).catch(async () => {
      const existing = await prisma.cosmetic.findFirst({ where: { name: c.name } })
      if (!existing) await prisma.cosmetic.create({ data: c })
    })
  }
  console.log(`Seeded ${COSMETICS.length} cosmetics`)

  // ── Season Pass ───────────────────────────────────────────────────────────
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
          endDate:   seasonEnd,
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

  console.log(`Seed complete. Total pairs across all languages: ${totalPairs}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
