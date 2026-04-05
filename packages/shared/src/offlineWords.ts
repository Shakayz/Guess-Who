import type { WordCategory } from './types'

/**
 * Word pairs for offline / pass-and-play mode.
 * Each pair has a villagerWord and an imposterWord — similar but distinct.
 */
export interface OfflineWordPair {
  villagerWord: string
  imposterWord: string
}

export const OFFLINE_WORD_PAIRS: Record<WordCategory, OfflineWordPair[]> = {
  food: [
    { villagerWord: 'Pizza', imposterWord: 'Calzone' },
    { villagerWord: 'Sushi', imposterWord: 'Sashimi' },
    { villagerWord: 'Burger', imposterWord: 'Sandwich' },
    { villagerWord: 'Ice Cream', imposterWord: 'Gelato' },
    { villagerWord: 'Pasta', imposterWord: 'Noodles' },
    { villagerWord: 'Steak', imposterWord: 'Ribs' },
    { villagerWord: 'Tacos', imposterWord: 'Burritos' },
    { villagerWord: 'Pancakes', imposterWord: 'Waffles' },
    { villagerWord: 'Croissant', imposterWord: 'Bagel' },
    { villagerWord: 'Ramen', imposterWord: 'Pho' },
    { villagerWord: 'Chocolate', imposterWord: 'Brownie' },
    { villagerWord: 'Coffee', imposterWord: 'Espresso' },
  ],
  animals: [
    { villagerWord: 'Lion', imposterWord: 'Tiger' },
    { villagerWord: 'Dolphin', imposterWord: 'Shark' },
    { villagerWord: 'Eagle', imposterWord: 'Hawk' },
    { villagerWord: 'Wolf', imposterWord: 'Fox' },
    { villagerWord: 'Elephant', imposterWord: 'Rhino' },
    { villagerWord: 'Crocodile', imposterWord: 'Alligator' },
    { villagerWord: 'Penguin', imposterWord: 'Puffin' },
    { villagerWord: 'Gorilla', imposterWord: 'Chimpanzee' },
    { villagerWord: 'Cobra', imposterWord: 'Python' },
    { villagerWord: 'Parrot', imposterWord: 'Toucan' },
    { villagerWord: 'Bison', imposterWord: 'Buffalo' },
    { villagerWord: 'Cheetah', imposterWord: 'Leopard' },
  ],
  music: [
    { villagerWord: 'Guitar', imposterWord: 'Ukulele' },
    { villagerWord: 'Drums', imposterWord: 'Bongos' },
    { villagerWord: 'Piano', imposterWord: 'Keyboard' },
    { villagerWord: 'Violin', imposterWord: 'Viola' },
    { villagerWord: 'Trumpet', imposterWord: 'Trombone' },
    { villagerWord: 'Jazz', imposterWord: 'Blues' },
    { villagerWord: 'Hip-Hop', imposterWord: 'Rap' },
    { villagerWord: 'Opera', imposterWord: 'Musical' },
    { villagerWord: 'Album', imposterWord: 'Mixtape' },
    { villagerWord: 'Concert', imposterWord: 'Festival' },
    { villagerWord: 'Microphone', imposterWord: 'Speaker' },
    { villagerWord: 'Flute', imposterWord: 'Clarinet' },
  ],
  places: [
    { villagerWord: 'Beach', imposterWord: 'Lake' },
    { villagerWord: 'Museum', imposterWord: 'Gallery' },
    { villagerWord: 'Airport', imposterWord: 'Train Station' },
    { villagerWord: 'Hospital', imposterWord: 'Clinic' },
    { villagerWord: 'Library', imposterWord: 'Bookstore' },
    { villagerWord: 'Stadium', imposterWord: 'Arena' },
    { villagerWord: 'Casino', imposterWord: 'Arcade' },
    { villagerWord: 'Prison', imposterWord: 'Courthouse' },
    { villagerWord: 'Jungle', imposterWord: 'Forest' },
    { villagerWord: 'Volcano', imposterWord: 'Mountain' },
    { villagerWord: 'Cathedral', imposterWord: 'Temple' },
    { villagerWord: 'Submarine', imposterWord: 'Shipwreck' },
  ],
  jobs: [
    { villagerWord: 'Doctor', imposterWord: 'Nurse' },
    { villagerWord: 'Pilot', imposterWord: 'Air Traffic Controller' },
    { villagerWord: 'Chef', imposterWord: 'Baker' },
    { villagerWord: 'Lawyer', imposterWord: 'Judge' },
    { villagerWord: 'Astronaut', imposterWord: 'Cosmonaut' },
    { villagerWord: 'Firefighter', imposterWord: 'Paramedic' },
    { villagerWord: 'Architect', imposterWord: 'Engineer' },
    { villagerWord: 'Journalist', imposterWord: 'Reporter' },
    { villagerWord: 'Magician', imposterWord: 'Illusionist' },
    { villagerWord: 'Sculptor', imposterWord: 'Painter' },
    { villagerWord: 'Spy', imposterWord: 'Detective' },
    { villagerWord: 'Farmer', imposterWord: 'Rancher' },
  ],
  sports: [
    { villagerWord: 'Basketball', imposterWord: 'Volleyball' },
    { villagerWord: 'Tennis', imposterWord: 'Badminton' },
    { villagerWord: 'Swimming', imposterWord: 'Diving' },
    { villagerWord: 'Boxing', imposterWord: 'Kickboxing' },
    { villagerWord: 'Cycling', imposterWord: 'Skateboarding' },
    { villagerWord: 'Archery', imposterWord: 'Darts' },
    { villagerWord: 'Skiing', imposterWord: 'Snowboarding' },
    { villagerWord: 'Fencing', imposterWord: 'Karate' },
    { villagerWord: 'Wrestling', imposterWord: 'Judo' },
    { villagerWord: 'Golf', imposterWord: 'Cricket' },
    { villagerWord: 'Rugby', imposterWord: 'American Football' },
    { villagerWord: 'Surfing', imposterWord: 'Windsurfing' },
  ],
  movies: [
    { villagerWord: 'Inception', imposterWord: 'Interstellar' },
    { villagerWord: 'The Matrix', imposterWord: 'The Terminator' },
    { villagerWord: 'Titanic', imposterWord: 'The Poseidon Adventure' },
    { villagerWord: 'Batman', imposterWord: 'Spider-Man' },
    { villagerWord: 'Harry Potter', imposterWord: 'Lord of the Rings' },
    { villagerWord: 'Star Wars', imposterWord: 'Star Trek' },
    { villagerWord: 'Avengers', imposterWord: 'Justice League' },
    { villagerWord: 'The Lion King', imposterWord: 'The Jungle Book' },
    { villagerWord: 'Jurassic Park', imposterWord: 'King Kong' },
    { villagerWord: 'Frozen', imposterWord: 'Tangled' },
    { villagerWord: 'Fight Club', imposterWord: 'Pulp Fiction' },
    { villagerWord: 'Forrest Gump', imposterWord: 'Cast Away' },
  ],
  history: [
    { villagerWord: 'Cleopatra', imposterWord: 'Nefertiti' },
    { villagerWord: 'Napoleon', imposterWord: 'Julius Caesar' },
    { villagerWord: 'World War II', imposterWord: 'World War I' },
    { villagerWord: 'The Cold War', imposterWord: 'The Space Race' },
    { villagerWord: 'The Renaissance', imposterWord: 'The Enlightenment' },
    { villagerWord: 'Gladiator', imposterWord: 'Spartan Warrior' },
    { villagerWord: 'The Titanic', imposterWord: 'The Hindenburg' },
    { villagerWord: 'Stonehenge', imposterWord: 'The Pyramids' },
    { villagerWord: 'Viking', imposterWord: 'Pirate' },
    { villagerWord: 'Moon Landing', imposterWord: 'Space Shuttle' },
    { villagerWord: 'Samurai', imposterWord: 'Ninja' },
    { villagerWord: 'The Roman Empire', imposterWord: 'The Greek Empire' },
  ],
  mangas: [
    { villagerWord: 'Naruto', imposterWord: 'Bleach' },
    { villagerWord: 'One Piece', imposterWord: 'Fairy Tail' },
    { villagerWord: 'Dragon Ball', imposterWord: 'Dragon Ball Z' },
    { villagerWord: 'Attack on Titan', imposterWord: 'Tokyo Ghoul' },
    { villagerWord: 'Death Note', imposterWord: 'Code Geass' },
    { villagerWord: 'My Hero Academia', imposterWord: 'Black Clover' },
    { villagerWord: 'Demon Slayer', imposterWord: 'Jujutsu Kaisen' },
    { villagerWord: 'Fullmetal Alchemist', imposterWord: 'Soul Eater' },
    { villagerWord: 'Hunter x Hunter', imposterWord: 'Yu Yu Hakusho' },
    { villagerWord: 'Sword Art Online', imposterWord: 'Overlord' },
    { villagerWord: 'One Punch Man', imposterWord: 'Mob Psycho 100' },
    { villagerWord: 'Evangelion', imposterWord: 'Gurren Lagann' },
  ],
  celebrities: [
    { villagerWord: 'Elon Musk', imposterWord: 'Jeff Bezos' },
    { villagerWord: 'Taylor Swift', imposterWord: 'Beyoncé' },
    { villagerWord: 'LeBron James', imposterWord: 'Michael Jordan' },
    { villagerWord: 'Cristiano Ronaldo', imposterWord: 'Lionel Messi' },
    { villagerWord: 'Leonardo DiCaprio', imposterWord: 'Brad Pitt' },
    { villagerWord: 'Oprah Winfrey', imposterWord: 'Ellen DeGeneres' },
    { villagerWord: 'Eminem', imposterWord: 'Jay-Z' },
    { villagerWord: 'Rihanna', imposterWord: 'Nicki Minaj' },
    { villagerWord: 'Tom Hanks', imposterWord: 'Tom Cruise' },
    { villagerWord: 'Serena Williams', imposterWord: 'Venus Williams' },
    { villagerWord: 'Kanye West', imposterWord: 'Drake' },
    { villagerWord: 'Barack Obama', imposterWord: 'Bill Clinton' },
  ],
  variety: [
    { villagerWord: 'Treasure Map', imposterWord: 'Compass' },
    { villagerWord: 'Time Machine', imposterWord: 'Teleporter' },
    { villagerWord: 'Magic Carpet', imposterWord: 'Flying Broomstick' },
    { villagerWord: 'Haunted House', imposterWord: 'Abandoned Mansion' },
    { villagerWord: 'Superpowers', imposterWord: 'Magic Spells' },
    { villagerWord: 'Space Station', imposterWord: 'Satellite' },
    { villagerWord: 'Zombie', imposterWord: 'Vampire' },
    { villagerWord: 'Alien', imposterWord: 'Robot' },
    { villagerWord: 'Unicorn', imposterWord: 'Pegasus' },
    { villagerWord: 'Black Hole', imposterWord: 'Wormhole' },
    { villagerWord: 'Secret Society', imposterWord: 'Cult' },
    { villagerWord: 'Dream World', imposterWord: 'Virtual Reality' },
  ],
}

/**
 * Pick a random word pair from the given categories.
 * If no categories are provided, pick from all.
 */
export function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
): OfflineWordPair {
  const keys =
    categories.length > 0
      ? categories
      : (Object.keys(OFFLINE_WORD_PAIRS) as WordCategory[])

  const shuffledKeys = shuffleFn(keys)
  const category = shuffledKeys[0]
  const pairs = OFFLINE_WORD_PAIRS[category]
  const shuffledPairs = shuffleFn(pairs)
  return shuffledPairs[0]
}
