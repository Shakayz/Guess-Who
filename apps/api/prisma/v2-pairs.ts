/**
 * V2 expansion — 20 additional tricky word pairs per category per locale.
 *
 * Invariant pools (MANGAS, CELEBRITIES, MOVIES, MUSIC, HISTORY, TECH) share
 * the same pairs across all 10 locales (same proper nouns).
 * Translatable pools (FOOD, ANIMALS, PLACES, JOBS, SPORTS) have per-locale
 * arrays with naturally localized content.
 *
 * Difficulty mix per pool: ~4 easy, ~12 medium, ~4 hard.
 * 'tech' is introduced here as a new category.
 *
 * Imported by both seed.ts (for database seeding) and
 * scripts/generate-offline-words.mjs (for offline/pass-and-play generation).
 */

type Diff = 'easy' | 'medium' | 'hard'
type V2Triple = [string, string, Diff]

export type V2PairData = {
  wordA: string
  wordB: string
  difficulty: Diff
  category: string
  locale: string
}

const V2_LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh', 'ru', 'hi'] as const

const v2p = (cat: string, loc: string, ts: V2Triple[]): V2PairData[] =>
  ts.map(([a, b, d]) => ({ wordA: a, wordB: b, difficulty: d, category: cat, locale: loc }))

// ── INVARIANT POOLS (same pairs across all 10 locales) ──────────────────────
const V2_MANGAS: V2Triple[] = [
  ['Gaara', 'Temari', 'easy'],
  ['Franky', 'Usopp', 'easy'],
  ['Himmel', 'Frieren', 'easy'],
  ['Tanjiro', 'Zenitsu', 'easy'],
  ['Nagato', 'Konan', 'medium'],
  ['Escanor', 'Elizabeth', 'medium'],
  ['Rengoku', 'Tomioka', 'medium'],
  ['Shinobu', 'Mitsuri', 'medium'],
  ['Makima', 'Kobeni', 'medium'],
  ['Aki', 'Himeno', 'medium'],
  ['Chrome', 'Gen', 'medium'],
  ['Simon', 'Kamina', 'medium'],
  ['Saber', 'Archer', 'medium'],
  ['Yami Yugi', 'Seto Kaiba', 'medium'],
  ['Roy Mustang', 'Riza Hawkeye', 'medium'],
  ['Ace', 'Sabo', 'medium'],
  ['Canute', 'Thorkell', 'hard'],
  ['Revy', 'Rock', 'hard'],
  ['Golgo 13', 'Lupin III', 'hard'],
  ['Kenshiro', 'Raoh', 'hard'],
]

const V2_CELEBRITIES: V2Triple[] = [
  ['Snoop Dogg', 'Dr Dre', 'easy'],
  ['Eminem', 'Lil Wayne', 'easy'],
  ['Mariah Carey', 'Whitney Houston', 'easy'],
  ['Shaquille ONeal', 'Charles Barkley', 'easy'],
  ['Vladimir Putin', 'Xi Jinping', 'medium'],
  ['Kobe Bryant', 'Dwyane Wade', 'medium'],
  ['Zlatan Ibrahimovic', 'Karim Benzema', 'medium'],
  ['Shawn Mendes', 'Lewis Capaldi', 'medium'],
  ['Meryl Streep', 'Helen Mirren', 'medium'],
  ['Denzel Washington', 'Samuel L Jackson', 'medium'],
  ['Jake Gyllenhaal', 'Joaquin Phoenix', 'medium'],
  ['Michael Phelps', 'Ryan Lochte', 'medium'],
  ['Paul McCartney', 'John Lennon', 'medium'],
  ['Shakira', 'Jennifer Lopez', 'medium'],
  ['Andrew Garfield', 'Tobey Maguire', 'medium'],
  ['Naomi Osaka', 'Coco Gauff', 'medium'],
  ['Billie Holiday', 'Ella Fitzgerald', 'hard'],
  ['Penelope Cruz', 'Salma Hayek', 'hard'],
  ['Thom Yorke', 'Jonny Greenwood', 'hard'],
  ['Shohei Ohtani', 'Ichiro Suzuki', 'hard'],
]

const V2_MOVIES: V2Triple[] = [
  ['Shawshank Redemption', 'The Green Mile', 'easy'],
  ['Cast Away', 'The Martian', 'easy'],
  ['Saving Private Ryan', 'Dunkirk', 'easy'],
  ['Black Panther', 'Wakanda Forever', 'easy'],
  ['Oppenheimer', 'The Imitation Game', 'medium'],
  ['Barbie', 'Poor Things', 'medium'],
  ['La La Land', 'Moulin Rouge', 'medium'],
  ['A Quiet Place', 'Bird Box', 'medium'],
  ['Logan', 'The Wolverine', 'medium'],
  ['Sicario', 'Prisoners', 'medium'],
  ['Casino', 'Goodfellas', 'medium'],
  ['Heat', 'The Town', 'medium'],
  ['The Social Network', 'The Founder', 'medium'],
  ['Chicago', 'Cabaret', 'medium'],
  ['The Shining', 'The Exorcist', 'medium'],
  ['12 Angry Men', 'The Verdict', 'medium'],
  ['Tinker Tailor Soldier Spy', 'Bridge of Spies', 'hard'],
  ['Stalker', 'Solaris', 'hard'],
  ['Seven Samurai', 'Yojimbo', 'hard'],
  ['Nosferatu', 'Dracula', 'hard'],
]

const V2_MUSIC: V2Triple[] = [
  ['Harp', 'Lyre', 'easy'],
  ['Saxophone', 'Clarinet', 'easy'],
  ['Folk', 'Country', 'easy'],
  ['Ballad', 'Serenade', 'easy'],
  ['Chorus', 'Verse', 'medium'],
  ['Treble Clef', 'Bass Clef', 'medium'],
  ['Rhythm', 'Tempo', 'medium'],
  ['Coachella', 'Tomorrowland', 'medium'],
  ['Grammy', 'Brit Awards', 'medium'],
  ['Bruno Mars', 'The Weeknd', 'medium'],
  ['Arctic Monkeys', 'The Strokes', 'medium'],
  ['Florence and the Machine', 'Lana Del Rey', 'medium'],
  ['Metallica', 'Iron Maiden', 'medium'],
  ['2Pac', 'Biggie', 'medium'],
  ['Sum 41', 'Green Day', 'medium'],
  ['Opera', 'Musical', 'medium'],
  ['Sonata', 'Concerto', 'hard'],
  ['Ritardando', 'Accelerando', 'hard'],
  ['Miles Davis', 'John Coltrane', 'hard'],
  ['Nina Simone', 'Aretha Franklin', 'hard'],
]

const V2_HISTORY: V2Triple[] = [
  ['Napoleon', 'Wellington', 'easy'],
  ['Lincoln', 'JFK', 'easy'],
  ['Churchill', 'Roosevelt', 'easy'],
  ['Mandela', 'Gandhi', 'easy'],
  ['Charlemagne', 'Barbarossa', 'medium'],
  ['Elizabeth I', 'Victoria', 'medium'],
  ['Catherine the Great', 'Peter the Great', 'medium'],
  ['Robespierre', 'Marat', 'medium'],
  ['Lenin', 'Trotsky', 'medium'],
  ['Franco', 'Mussolini', 'medium'],
  ['Marco Polo', 'Ibn Battuta', 'medium'],
  ['Confucius', 'Laozi', 'medium'],
  ['Alexander the Great', 'Darius III', 'medium'],
  ['Cyrus the Great', 'Xerxes', 'medium'],
  ['Saladin', 'Richard the Lionheart', 'medium'],
  ['Suleiman', 'Mehmed II', 'medium'],
  ['Treaty of Tordesillas', 'Treaty of Westphalia', 'hard'],
  ['Battle of Thermopylae', 'Battle of Salamis', 'hard'],
  ['Meiji Restoration', 'French Revolution', 'hard'],
  ['Edict of Nantes', 'Peace of Augsburg', 'hard'],
]

const V2_TECH: V2Triple[] = [
  ['iPhone', 'Android', 'easy'],
  ['Windows', 'macOS', 'easy'],
  ['Chrome', 'Firefox', 'easy'],
  ['WhatsApp', 'Signal', 'easy'],
  ['Python', 'Ruby', 'medium'],
  ['React', 'Vue', 'medium'],
  ['AWS', 'Azure', 'medium'],
  ['Docker', 'Kubernetes', 'medium'],
  ['GraphQL', 'REST', 'medium'],
  ['MongoDB', 'PostgreSQL', 'medium'],
  ['VPN', 'Proxy', 'medium'],
  ['WiFi', 'Bluetooth', 'medium'],
  ['Zoom', 'Google Meet', 'medium'],
  ['Spotify', 'Apple Music', 'medium'],
  ['Tesla', 'Rivian', 'medium'],
  ['ChatGPT', 'Claude', 'medium'],
  ['WebSocket', 'SSE', 'hard'],
  ['Redis', 'Memcached', 'hard'],
  ['Kafka', 'RabbitMQ', 'hard'],
  ['TCP', 'UDP', 'hard'],
]

// ── TRANSLATABLE POOLS (per-locale, index-aligned) ──────────────────────────
// EN
const V2_FOOD_EN: V2Triple[] = [['Bacon','Ham','easy'],['Mayo','Aioli','easy'],['Corn','Popcorn','easy'],['Yogurt','Kefir','easy'],['Baguette','Ciabatta','medium'],['Bisque','Chowder','medium'],['Fondue','Raclette','medium'],['Mochi','Dango','medium'],['Tamale','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Cilantro','Parsley','medium'],['Shrimp','Prawn','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Eclair','Profiterole','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_EN: V2Triple[] = [['Lamb','Sheep','easy'],['Duck','Goose','easy'],['Fox','Coyote','easy'],['Owl','Raven','easy'],['Jaguar','Panther','medium'],['Swan','Heron','medium'],['Lobster','Crayfish','medium'],['Hummingbird','Sparrow','medium'],['Bison','Yak','medium'],['Otter','Beaver','medium'],['Chameleon','Gecko','medium'],['Stingray','Manta Ray','medium'],['Raccoon','Badger','medium'],['Ferret','Weasel','medium'],['Camel','Llama','medium'],['Elk','Moose','medium'],['Okapi','Giraffe','hard'],['Platypus','Echidna','hard'],['Caiman','Gharial','hard'],['Capybara','Guinea Pig','hard']]
const V2_PLACES_EN: V2Triple[] = [['Miami','Cancun','easy'],['Dublin','Edinburgh','easy'],['Osaka','Kyoto','easy'],['Vancouver','Seattle','easy'],['Mecca','Medina','medium'],['Naples','Palermo','medium'],['Havana','San Juan','medium'],['Mumbai','Kolkata','medium'],['Lagos','Nairobi','medium'],['Cusco','La Paz','medium'],['Reykjavik','Oslo','medium'],['Brussels','Amsterdam','medium'],['Fez','Marrakech','medium'],['Zagreb','Ljubljana','medium'],['Hanoi','Vientiane','medium'],['Wellington','Christchurch','medium'],['Samarkand','Bukhara','hard'],['Timbuktu','Djenne','hard'],['Petra','Palmyra','hard'],['Machu Picchu','Chichen Itza','hard']]
const V2_JOBS_EN: V2Triple[] = [['Baker','Chef','easy'],['Barber','Hairstylist','easy'],['Mailman','Courier','easy'],['Farmer','Rancher','easy'],['Cardiologist','Oncologist','medium'],['Pilot','Copilot','medium'],['Paralegal','Attorney','medium'],['Editor','Copywriter','medium'],['Welder','Ironworker','medium'],['Notary','Clerk','medium'],['Radiologist','Sonographer','medium'],['Hydrologist','Oceanographer','medium'],['Midwife','Nurse','medium'],['Surgeon','Anesthesiologist','medium'],['Auditor','Accountant','medium'],['Bartender','Sommelier','medium'],['Actuary','Underwriter','hard'],['Cartographer','Topographer','hard'],['Epidemiologist','Virologist','hard'],['Numismatist','Philatelist','hard']]
const V2_SPORTS_EN: V2Triple[] = [['Football','Futsal','easy'],['Swimming','Diving','easy'],['Biking','Mountain Biking','easy'],['Running','Jogging','easy'],['Lacrosse','Field Hockey','medium'],['Curling','Bowling','medium'],['Polo','Croquet','medium'],['Sumo','Judo','medium'],['BMX','Motocross','medium'],['Kiteboarding','Windsurfing','medium'],['Pentathlon','Heptathlon','medium'],['Steeplechase','Hurdles','medium'],['Luge','Skeleton','medium'],['Paragliding','Hang Gliding','medium'],['Canoe','Kayak','medium'],['Ice Hockey','Roller Hockey','medium'],['Pickleball','Padel','hard'],['Keirin','Omnium','hard'],['Slalom','Giant Slalom','hard'],['Epee','Saber','hard']]

// FR
const V2_FOOD_FR: V2Triple[] = [['Lard','Jambon','easy'],['Mayonnaise','Aïoli','easy'],['Maïs','Pop-corn','easy'],['Yaourt','Kéfir','easy'],['Baguette','Ciabatta','medium'],['Bisque','Velouté','medium'],['Fondue','Raclette','medium'],['Mochi','Dango','medium'],['Tamale','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Coriandre','Persil','medium'],['Crevette','Gambas','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Éclair','Profiterole','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_FR: V2Triple[] = [['Agneau','Mouton','easy'],['Canard','Oie','easy'],['Renard','Coyote','easy'],['Hibou','Corbeau','easy'],['Jaguar','Panthère','medium'],['Cygne','Héron','medium'],['Homard','Écrevisse','medium'],['Colibri','Moineau','medium'],['Bison','Yak','medium'],['Loutre','Castor','medium'],['Caméléon','Gecko','medium'],['Raie','Raie Manta','medium'],['Raton laveur','Blaireau','medium'],['Furet','Belette','medium'],['Chameau','Lama','medium'],['Wapiti','Orignal','medium'],['Okapi','Girafe','hard'],['Ornithorynque','Échidné','hard'],['Caïman','Gavial','hard'],['Capybara','Cochon dInde','hard']]
const V2_PLACES_FR: V2Triple[] = [['Miami','Cancun','easy'],['Dublin','Édimbourg','easy'],['Osaka','Kyoto','easy'],['Vancouver','Seattle','easy'],['La Mecque','Médine','medium'],['Naples','Palerme','medium'],['La Havane','San Juan','medium'],['Mumbai','Kolkata','medium'],['Lagos','Nairobi','medium'],['Cusco','La Paz','medium'],['Reykjavik','Oslo','medium'],['Bruxelles','Amsterdam','medium'],['Fès','Marrakech','medium'],['Zagreb','Ljubljana','medium'],['Hanoï','Vientiane','medium'],['Wellington','Christchurch','medium'],['Samarcande','Boukhara','hard'],['Tombouctou','Djenné','hard'],['Petra','Palmyre','hard'],['Machu Picchu','Chichén Itzá','hard']]
const V2_JOBS_FR: V2Triple[] = [['Boulanger','Chef','easy'],['Barbier','Coiffeur','easy'],['Facteur','Coursier','easy'],['Fermier','Éleveur','easy'],['Cardiologue','Oncologue','medium'],['Pilote','Copilote','medium'],['Parajuriste','Avocat','medium'],['Éditeur','Rédacteur','medium'],['Soudeur','Ferronnier','medium'],['Notaire','Greffier','medium'],['Radiologue','Échographiste','medium'],['Hydrologue','Océanographe','medium'],['Sage-femme','Infirmière','medium'],['Chirurgien','Anesthésiste','medium'],['Auditeur','Comptable','medium'],['Barman','Sommelier','medium'],['Actuaire','Souscripteur','hard'],['Cartographe','Topographe','hard'],['Épidémiologiste','Virologue','hard'],['Numismate','Philatéliste','hard']]
const V2_SPORTS_FR: V2Triple[] = [['Football','Futsal','easy'],['Natation','Plongeon','easy'],['Vélo','VTT','easy'],['Course','Jogging','easy'],['Crosse','Hockey sur gazon','medium'],['Curling','Bowling','medium'],['Polo','Croquet','medium'],['Sumo','Judo','medium'],['BMX','Motocross','medium'],['Kitesurf','Planche à voile','medium'],['Pentathlon','Heptathlon','medium'],['Steeple','Haies','medium'],['Luge','Skeleton','medium'],['Parapente','Deltaplane','medium'],['Canoë','Kayak','medium'],['Hockey sur glace','Roller hockey','medium'],['Pickleball','Padel','hard'],['Keirin','Omnium','hard'],['Slalom','Slalom géant','hard'],['Épée','Sabre','hard']]

// ES
const V2_FOOD_ES: V2Triple[] = [['Tocino','Jamón','easy'],['Mayonesa','Alioli','easy'],['Maíz','Palomitas','easy'],['Yogur','Kéfir','easy'],['Baguette','Ciabatta','medium'],['Bisque','Crema','medium'],['Fondue','Raclette','medium'],['Mochi','Dango','medium'],['Tamal','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Cilantro','Perejil','medium'],['Camarón','Langostino','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Éclair','Profiterol','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_ES: V2Triple[] = [['Cordero','Oveja','easy'],['Pato','Ganso','easy'],['Zorro','Coyote','easy'],['Búho','Cuervo','easy'],['Jaguar','Pantera','medium'],['Cisne','Garza','medium'],['Langosta','Cangrejo de río','medium'],['Colibrí','Gorrión','medium'],['Bisonte','Yak','medium'],['Nutria','Castor','medium'],['Camaleón','Gecko','medium'],['Raya','Manta Raya','medium'],['Mapache','Tejón','medium'],['Hurón','Comadreja','medium'],['Camello','Llama','medium'],['Alce','Reno','medium'],['Okapi','Jirafa','hard'],['Ornitorrinco','Equidna','hard'],['Caimán','Gavial','hard'],['Capibara','Cobaya','hard']]
const V2_PLACES_ES: V2Triple[] = [['Miami','Cancún','easy'],['Dublín','Edimburgo','easy'],['Osaka','Kioto','easy'],['Vancouver','Seattle','easy'],['La Meca','Medina','medium'],['Nápoles','Palermo','medium'],['La Habana','San Juan','medium'],['Bombay','Calcuta','medium'],['Lagos','Nairobi','medium'],['Cusco','La Paz','medium'],['Reikiavik','Oslo','medium'],['Bruselas','Ámsterdam','medium'],['Fez','Marrakech','medium'],['Zagreb','Liubliana','medium'],['Hanói','Vientián','medium'],['Wellington','Christchurch','medium'],['Samarcanda','Bujará','hard'],['Tombuctú','Djenné','hard'],['Petra','Palmira','hard'],['Machu Picchu','Chichén Itzá','hard']]
const V2_JOBS_ES: V2Triple[] = [['Panadero','Chef','easy'],['Barbero','Peluquero','easy'],['Cartero','Mensajero','easy'],['Granjero','Ganadero','easy'],['Cardiólogo','Oncólogo','medium'],['Piloto','Copiloto','medium'],['Paralegal','Abogado','medium'],['Editor','Redactor','medium'],['Soldador','Herrero','medium'],['Notario','Secretario','medium'],['Radiólogo','Ecografista','medium'],['Hidrólogo','Oceanógrafo','medium'],['Partera','Enfermera','medium'],['Cirujano','Anestesista','medium'],['Auditor','Contable','medium'],['Camarero','Sumiller','medium'],['Actuario','Suscriptor','hard'],['Cartógrafo','Topógrafo','hard'],['Epidemiólogo','Virólogo','hard'],['Numismático','Filatelista','hard']]
const V2_SPORTS_ES: V2Triple[] = [['Fútbol','Fútbol sala','easy'],['Natación','Clavados','easy'],['Ciclismo','Ciclismo de montaña','easy'],['Correr','Trotar','easy'],['Lacrosse','Hockey sobre hierba','medium'],['Curling','Bolos','medium'],['Polo','Croquet','medium'],['Sumo','Judo','medium'],['BMX','Motocross','medium'],['Kitesurf','Windsurf','medium'],['Pentatlón','Heptatlón','medium'],['Carrera de obstáculos','Vallas','medium'],['Luge','Skeleton','medium'],['Parapente','Ala delta','medium'],['Canoa','Kayak','medium'],['Hockey hielo','Hockey línea','medium'],['Pickleball','Pádel','hard'],['Keirin','Ómnium','hard'],['Eslalon','Eslalon gigante','hard'],['Espada','Sable','hard']]

// DE
const V2_FOOD_DE: V2Triple[] = [['Speck','Schinken','easy'],['Mayonnaise','Aioli','easy'],['Mais','Popcorn','easy'],['Joghurt','Kefir','easy'],['Baguette','Ciabatta','medium'],['Bisque','Chowder','medium'],['Fondue','Raclette','medium'],['Mochi','Dango','medium'],['Tamale','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Koriander','Petersilie','medium'],['Garnele','Krabbe','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Éclair','Profiterole','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_DE: V2Triple[] = [['Lamm','Schaf','easy'],['Ente','Gans','easy'],['Fuchs','Kojote','easy'],['Eule','Rabe','easy'],['Jaguar','Panther','medium'],['Schwan','Reiher','medium'],['Hummer','Flusskrebs','medium'],['Kolibri','Spatz','medium'],['Bison','Yak','medium'],['Otter','Biber','medium'],['Chamäleon','Gecko','medium'],['Stechrochen','Mantarochen','medium'],['Waschbär','Dachs','medium'],['Frettchen','Wiesel','medium'],['Kamel','Lama','medium'],['Elch','Wapiti','medium'],['Okapi','Giraffe','hard'],['Schnabeltier','Ameisenigel','hard'],['Kaiman','Gavial','hard'],['Wasserschwein','Meerschweinchen','hard']]
const V2_PLACES_DE: V2Triple[] = [['Miami','Cancún','easy'],['Dublin','Edinburgh','easy'],['Osaka','Kyoto','easy'],['Vancouver','Seattle','easy'],['Mekka','Medina','medium'],['Neapel','Palermo','medium'],['Havanna','San Juan','medium'],['Mumbai','Kalkutta','medium'],['Lagos','Nairobi','medium'],['Cusco','La Paz','medium'],['Reykjavik','Oslo','medium'],['Brüssel','Amsterdam','medium'],['Fès','Marrakesch','medium'],['Zagreb','Ljubljana','medium'],['Hanoi','Vientiane','medium'],['Wellington','Christchurch','medium'],['Samarkand','Buchara','hard'],['Timbuktu','Djenné','hard'],['Petra','Palmyra','hard'],['Machu Picchu','Chichén Itzá','hard']]
const V2_JOBS_DE: V2Triple[] = [['Bäcker','Koch','easy'],['Barbier','Friseur','easy'],['Postbote','Kurier','easy'],['Bauer','Viehzüchter','easy'],['Kardiologe','Onkologe','medium'],['Pilot','Kopilot','medium'],['Rechtsanwaltsgehilfe','Anwalt','medium'],['Redakteur','Texter','medium'],['Schweißer','Schlosser','medium'],['Notar','Sekretär','medium'],['Radiologe','Sonograph','medium'],['Hydrologe','Ozeanograph','medium'],['Hebamme','Krankenschwester','medium'],['Chirurg','Anästhesist','medium'],['Prüfer','Buchhalter','medium'],['Barkeeper','Sommelier','medium'],['Aktuar','Underwriter','hard'],['Kartograph','Topograph','hard'],['Epidemiologe','Virologe','hard'],['Numismatiker','Philatelist','hard']]
const V2_SPORTS_DE: V2Triple[] = [['Fußball','Futsal','easy'],['Schwimmen','Tauchen','easy'],['Radfahren','Mountainbiken','easy'],['Laufen','Joggen','easy'],['Lacrosse','Feldhockey','medium'],['Curling','Bowling','medium'],['Polo','Krocket','medium'],['Sumo','Judo','medium'],['BMX','Motocross','medium'],['Kitesurfen','Windsurfen','medium'],['Fünfkampf','Siebenkampf','medium'],['Hindernislauf','Hürdenlauf','medium'],['Rodeln','Skeleton','medium'],['Gleitschirm','Drachenfliegen','medium'],['Kanu','Kajak','medium'],['Eishockey','Rollhockey','medium'],['Pickleball','Padel','hard'],['Keirin','Omnium','hard'],['Slalom','Riesenslalom','hard'],['Degen','Säbel','hard']]

// AR
const V2_FOOD_AR: V2Triple[] = [['لحم مقدد','لحم خنزير مدخن','easy'],['مايونيز','ثومية','easy'],['ذرة','فشار','easy'],['زبادي','كفير','easy'],['باغيت','شيباتا','medium'],['بيسك','شوربة سمك','medium'],['فوندو','راكليت','medium'],['موتشي','دانغو','medium'],['تامالي','بوبوسا','medium'],['أريبا','جورديتا','medium'],['خبز بيتا','خبز نان','medium'],['كزبرة','بقدونس','medium'],['جمبري','روبيان','medium'],['جبنة فيتا','جبنة حلوم','medium'],['براوني','بلوندي','medium'],['إكلير','بروفيترول','medium'],['كونجي','جوك','hard'],['أنيوليتي','رافيولي','hard'],['كابريزي','بانزانيلا','hard'],['برياني','بيلاف','hard']]
const V2_ANIMALS_AR: V2Triple[] = [['حمل','خروف','easy'],['بطة','إوزة','easy'],['ثعلب','قيوط','easy'],['بومة','غراب','easy'],['جاغوار','فهد أسود','medium'],['بجعة','مالك الحزين','medium'],['كركند','جراد البحر','medium'],['طائر طنان','عصفور','medium'],['بيسون','ياك','medium'],['ثعلب الماء','قندس','medium'],['حرباء','وزغة','medium'],['سمكة سراج','سمكة شيطان البحر','medium'],['راكون','غرير','medium'],['فرط','ابن عرس','medium'],['جمل','لاما','medium'],['أيل','موظ','medium'],['أوكابي','زرافة','hard'],['خلد الماء','قنفذ النمل','hard'],['كيمن','غريال','hard'],['كابيبارا','خنزير غينيا','hard']]
const V2_PLACES_AR: V2Triple[] = [['ميامي','كانكون','easy'],['دبلن','إدنبرة','easy'],['أوساكا','كيوتو','easy'],['فانكوفر','سياتل','easy'],['مكة','المدينة','medium'],['نابولي','باليرمو','medium'],['هافانا','سان خوان','medium'],['مومباي','كولكاتا','medium'],['لاغوس','نيروبي','medium'],['كوسكو','لاباز','medium'],['ريكيافيك','أوسلو','medium'],['بروكسل','أمستردام','medium'],['فاس','مراكش','medium'],['زغرب','ليوبليانا','medium'],['هانوي','فيينتيان','medium'],['ويلينغتون','كرايستشيرش','medium'],['سمرقند','بخارى','hard'],['تمبكتو','جيني','hard'],['البتراء','تدمر','hard'],['ماتشو بيتشو','تشيتشن إيتزا','hard']]
const V2_JOBS_AR: V2Triple[] = [['خباز','طاهٍ','easy'],['حلاق','مصفف شعر','easy'],['ساعي بريد','مرسال','easy'],['مزارع','مربي ماشية','easy'],['طبيب قلب','طبيب أورام','medium'],['طيار','مساعد طيار','medium'],['مساعد قانوني','محامٍ','medium'],['محرر','كاتب إعلاني','medium'],['لحام','حداد','medium'],['موثق','كاتب','medium'],['أخصائي أشعة','أخصائي موجات صوتية','medium'],['عالم هيدرولوجيا','عالم محيطات','medium'],['قابلة','ممرضة','medium'],['جراح','طبيب تخدير','medium'],['مدقق حسابات','محاسب','medium'],['نادل','خبير نبيذ','medium'],['اكتواري','مكتتب','hard'],['رسام خرائط','مساح','hard'],['عالم أوبئة','عالم فيروسات','hard'],['جامع عملات','جامع طوابع','hard']]
const V2_SPORTS_AR: V2Triple[] = [['كرة القدم','كرة الصالات','easy'],['سباحة','غطس','easy'],['ركوب الدراجات','دراجات جبلية','easy'],['جري','هرولة','easy'],['لاكروس','هوكي الميدان','medium'],['كيرلنغ','بولينغ','medium'],['بولو','كروكيه','medium'],['سومو','جودو','medium'],['بي إم إكس','موتوكروس','medium'],['تزلج طائرة ورقية','ركوب الأمواج شراعي','medium'],['خماسي','سباعي','medium'],['سباق الحواجز','حواجز','medium'],['لوج','سكيليتون','medium'],['طيران مظلي','طيران شراعي','medium'],['كانو','كاياك','medium'],['هوكي الجليد','هوكي الزلاجات','medium'],['بيكلبول','بادل','hard'],['كيرين','أومنيوم','hard'],['سلالوم','سلالوم عملاق','hard'],['سيف المبارزة','سابر','hard']]

// IT
const V2_FOOD_IT: V2Triple[] = [['Pancetta','Prosciutto','easy'],['Maionese','Aioli','easy'],['Mais','Popcorn','easy'],['Yogurt','Kefir','easy'],['Baguette','Ciabatta','medium'],['Bisque','Chowder','medium'],['Fonduta','Raclette','medium'],['Mochi','Dango','medium'],['Tamale','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Coriandolo','Prezzemolo','medium'],['Gambero','Scampo','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Éclair','Profiterole','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_IT: V2Triple[] = [['Agnello','Pecora','easy'],['Anatra','Oca','easy'],['Volpe','Coyote','easy'],['Gufo','Corvo','easy'],['Giaguaro','Pantera','medium'],['Cigno','Airone','medium'],['Aragosta','Gambero di fiume','medium'],['Colibrì','Passero','medium'],['Bisonte','Yak','medium'],['Lontra','Castoro','medium'],['Camaleonte','Geco','medium'],['Razza','Manta','medium'],['Procione','Tasso','medium'],['Furetto','Donnola','medium'],['Cammello','Lama','medium'],['Alce','Cervo americano','medium'],['Okapi','Giraffa','hard'],['Ornitorinco','Echidna','hard'],['Caimano','Gaviale','hard'],['Capibara','Porcellino dIndia','hard']]
const V2_PLACES_IT: V2Triple[] = [['Miami','Cancún','easy'],['Dublino','Edimburgo','easy'],['Osaka','Kyoto','easy'],['Vancouver','Seattle','easy'],['La Mecca','Medina','medium'],['Napoli','Palermo','medium'],['LAvana','San Juan','medium'],['Mumbai','Calcutta','medium'],['Lagos','Nairobi','medium'],['Cusco','La Paz','medium'],['Reykjavik','Oslo','medium'],['Bruxelles','Amsterdam','medium'],['Fès','Marrakech','medium'],['Zagabria','Lubiana','medium'],['Hanoi','Vientiane','medium'],['Wellington','Christchurch','medium'],['Samarcanda','Bukhara','hard'],['Timbuctù','Djenné','hard'],['Petra','Palmira','hard'],['Machu Picchu','Chichén Itzá','hard']]
const V2_JOBS_IT: V2Triple[] = [['Panettiere','Chef','easy'],['Barbiere','Parrucchiere','easy'],['Postino','Corriere','easy'],['Contadino','Allevatore','easy'],['Cardiologo','Oncologo','medium'],['Pilota','Copilota','medium'],['Paralegale','Avvocato','medium'],['Redattore','Copywriter','medium'],['Saldatore','Fabbro','medium'],['Notaio','Cancelliere','medium'],['Radiologo','Ecografista','medium'],['Idrologo','Oceanografo','medium'],['Ostetrica','Infermiera','medium'],['Chirurgo','Anestesista','medium'],['Revisore','Commercialista','medium'],['Barista','Sommelier','medium'],['Attuario','Assicuratore','hard'],['Cartografo','Topografo','hard'],['Epidemiologo','Virologo','hard'],['Numismatico','Filatelico','hard']]
const V2_SPORTS_IT: V2Triple[] = [['Calcio','Calcetto','easy'],['Nuoto','Tuffi','easy'],['Ciclismo','Mountain Bike','easy'],['Corsa','Jogging','easy'],['Lacrosse','Hockey su prato','medium'],['Curling','Bowling','medium'],['Polo','Croquet','medium'],['Sumo','Judo','medium'],['BMX','Motocross','medium'],['Kitesurf','Windsurf','medium'],['Pentathlon','Heptathlon','medium'],['Siepi','Ostacoli','medium'],['Slittino','Skeleton','medium'],['Parapendio','Deltaplano','medium'],['Canoa','Kayak','medium'],['Hockey su ghiaccio','Hockey in linea','medium'],['Pickleball','Padel','hard'],['Keirin','Omnium','hard'],['Slalom','Slalom gigante','hard'],['Spada','Sciabola','hard']]

// PT
const V2_FOOD_PT: V2Triple[] = [['Bacon','Presunto','easy'],['Maionese','Aioli','easy'],['Milho','Pipoca','easy'],['Iogurte','Kefir','easy'],['Baguete','Ciabatta','medium'],['Bisque','Chowder','medium'],['Fondue','Raclette','medium'],['Mochi','Dango','medium'],['Tamale','Pupusa','medium'],['Arepa','Gordita','medium'],['Pita','Naan','medium'],['Coentro','Salsa','medium'],['Camarão','Lagostim','medium'],['Feta','Halloumi','medium'],['Brownie','Blondie','medium'],['Éclair','Profiterole','medium'],['Congee','Jook','hard'],['Agnolotti','Ravioli','hard'],['Caprese','Panzanella','hard'],['Biryani','Pilaf','hard']]
const V2_ANIMALS_PT: V2Triple[] = [['Cordeiro','Ovelha','easy'],['Pato','Ganso','easy'],['Raposa','Coiote','easy'],['Coruja','Corvo','easy'],['Onça','Pantera','medium'],['Cisne','Garça','medium'],['Lagosta','Lagostim','medium'],['Beija-flor','Pardal','medium'],['Bisão','Iaque','medium'],['Lontra','Castor','medium'],['Camaleão','Osga','medium'],['Arraia','Jamanta','medium'],['Guaxinim','Texugo','medium'],['Furão','Doninha','medium'],['Camelo','Lhama','medium'],['Alce','Rena','medium'],['Ocapi','Girafa','hard'],['Ornitorrinco','Equidna','hard'],['Jacaré','Gavial','hard'],['Capivara','Cobaia','hard']]
const V2_PLACES_PT: V2Triple[] = [['Miami','Cancún','easy'],['Dublin','Edimburgo','easy'],['Osaka','Quioto','easy'],['Vancouver','Seattle','easy'],['Meca','Medina','medium'],['Nápoles','Palermo','medium'],['Havana','San Juan','medium'],['Mumbai','Calcutá','medium'],['Lagos','Nairóbi','medium'],['Cusco','La Paz','medium'],['Reiquiavique','Oslo','medium'],['Bruxelas','Amsterdã','medium'],['Fez','Marrakech','medium'],['Zagreb','Liubliana','medium'],['Hanói','Vientiane','medium'],['Wellington','Christchurch','medium'],['Samarcanda','Bukhara','hard'],['Timbuctu','Djenné','hard'],['Petra','Palmira','hard'],['Machu Picchu','Chichén Itzá','hard']]
const V2_JOBS_PT: V2Triple[] = [['Padeiro','Chef','easy'],['Barbeiro','Cabeleireiro','easy'],['Carteiro','Entregador','easy'],['Fazendeiro','Pecuarista','easy'],['Cardiologista','Oncologista','medium'],['Piloto','Copiloto','medium'],['Paralegal','Advogado','medium'],['Editor','Redator','medium'],['Soldador','Serralheiro','medium'],['Tabelião','Escrivão','medium'],['Radiologista','Ecografista','medium'],['Hidrólogo','Oceanógrafo','medium'],['Parteira','Enfermeira','medium'],['Cirurgião','Anestesista','medium'],['Auditor','Contador','medium'],['Barman','Sommelier','medium'],['Atuário','Subscritor','hard'],['Cartógrafo','Topógrafo','hard'],['Epidemiologista','Virologista','hard'],['Numismata','Filatelista','hard']]
const V2_SPORTS_PT: V2Triple[] = [['Futebol','Futsal','easy'],['Natação','Mergulho','easy'],['Ciclismo','Mountain Bike','easy'],['Corrida','Jogging','easy'],['Lacrosse','Hóquei em campo','medium'],['Curling','Boliche','medium'],['Polo','Croquet','medium'],['Sumô','Judô','medium'],['BMX','Motocross','medium'],['Kitesurf','Windsurf','medium'],['Pentatlo','Heptatlo','medium'],['Steeplechase','Barreiras','medium'],['Luge','Skeleton','medium'],['Parapente','Asa-delta','medium'],['Canoa','Caiaque','medium'],['Hóquei no gelo','Hóquei em linha','medium'],['Pickleball','Padel','hard'],['Keirin','Omnium','hard'],['Slalom','Slalom gigante','hard'],['Espada','Sabre','hard']]

// ZH
const V2_FOOD_ZH: V2Triple[] = [['培根','火腿','easy'],['蛋黄酱','蒜泥酱','easy'],['玉米','爆米花','easy'],['酸奶','开菲尔','easy'],['法棍','夏巴塔','medium'],['浓汤','海鲜浓汤','medium'],['芝士火锅','瑞士烤奶酪','medium'],['麻糬','团子','medium'],['玉米粽','萨尔瓦多粽','medium'],['玉米饼','戈迪塔','medium'],['皮塔饼','馕','medium'],['香菜','欧芹','medium'],['虾','大虾','medium'],['菲达奶酪','哈罗米奶酪','medium'],['布朗尼','金发蛋糕','medium'],['闪电泡芙','奶油泡芙','medium'],['粥','米粥','hard'],['意式小馄饨','意式方饺','hard'],['卡普里沙拉','意式面包沙拉','hard'],['印度香饭','抓饭','hard']]
const V2_ANIMALS_ZH: V2Triple[] = [['羔羊','绵羊','easy'],['鸭子','鹅','easy'],['狐狸','郊狼','easy'],['猫头鹰','乌鸦','easy'],['美洲豹','黑豹','medium'],['天鹅','苍鹭','medium'],['龙虾','小龙虾','medium'],['蜂鸟','麻雀','medium'],['野牛','牦牛','medium'],['水獭','海狸','medium'],['变色龙','壁虎','medium'],['黄貂鱼','蝠鲼','medium'],['浣熊','獾','medium'],['雪貂','鼬','medium'],['骆驼','羊驼','medium'],['麋鹿','驼鹿','medium'],['霍加狓','长颈鹿','hard'],['鸭嘴兽','针鼹','hard'],['凯门鳄','长吻鳄','hard'],['水豚','豚鼠','hard']]
const V2_PLACES_ZH: V2Triple[] = [['迈阿密','坎昆','easy'],['都柏林','爱丁堡','easy'],['大阪','京都','easy'],['温哥华','西雅图','easy'],['麦加','麦地那','medium'],['那不勒斯','巴勒莫','medium'],['哈瓦那','圣胡安','medium'],['孟买','加尔各答','medium'],['拉各斯','内罗毕','medium'],['库斯科','拉巴斯','medium'],['雷克雅未克','奥斯陆','medium'],['布鲁塞尔','阿姆斯特丹','medium'],['非斯','马拉喀什','medium'],['萨格勒布','卢布尔雅那','medium'],['河内','万象','medium'],['惠灵顿','基督城','medium'],['撒马尔罕','布哈拉','hard'],['廷巴克图','杰内','hard'],['佩特拉','帕尔米拉','hard'],['马丘比丘','奇琴伊察','hard']]
const V2_JOBS_ZH: V2Triple[] = [['面包师','厨师','easy'],['理发师','发型师','easy'],['邮递员','快递员','easy'],['农民','牧场主','easy'],['心脏病医生','肿瘤科医生','medium'],['飞行员','副驾驶','medium'],['律师助理','律师','medium'],['编辑','文案','medium'],['焊工','铁匠','medium'],['公证员','书记员','medium'],['放射科医生','超声技师','medium'],['水文学家','海洋学家','medium'],['助产士','护士','medium'],['外科医生','麻醉师','medium'],['审计师','会计师','medium'],['调酒师','侍酒师','medium'],['精算师','核保员','hard'],['制图师','测量师','hard'],['流行病学家','病毒学家','hard'],['钱币学家','集邮家','hard']]
const V2_SPORTS_ZH: V2Triple[] = [['足球','室内五人制','easy'],['游泳','跳水','easy'],['自行车','山地车','easy'],['跑步','慢跑','easy'],['长曲棍球','曲棍球','medium'],['冰壶','保龄球','medium'],['马球','门球','medium'],['相扑','柔道','medium'],['小轮车','摩托越野','medium'],['风筝冲浪','帆板','medium'],['五项全能','七项全能','medium'],['障碍赛','跨栏','medium'],['雪橇','俯式雪橇','medium'],['滑翔伞','悬挂式滑翔','medium'],['独木舟','皮艇','medium'],['冰球','轮滑球','medium'],['匹克球','板式网球','hard'],['竞轮','全能赛','hard'],['回转','大回转','hard'],['重剑','佩剑','hard']]

// RU
const V2_FOOD_RU: V2Triple[] = [['Бекон','Ветчина','easy'],['Майонез','Айоли','easy'],['Кукуруза','Попкорн','easy'],['Йогурт','Кефир','easy'],['Багет','Чиабатта','medium'],['Биск','Чаудер','medium'],['Фондю','Раклет','medium'],['Моти','Данго','medium'],['Тамале','Пупуса','medium'],['Арепа','Гордита','medium'],['Пита','Наан','medium'],['Кинза','Петрушка','medium'],['Креветка','Лангустин','medium'],['Фета','Халуми','medium'],['Брауни','Блонди','medium'],['Эклер','Профитроль','medium'],['Конджи','Джук','hard'],['Аньолотти','Равиоли','hard'],['Капрезе','Панцанелла','hard'],['Бирьяни','Плов','hard']]
const V2_ANIMALS_RU: V2Triple[] = [['Ягнёнок','Овца','easy'],['Утка','Гусь','easy'],['Лиса','Койот','easy'],['Сова','Ворон','easy'],['Ягуар','Пантера','medium'],['Лебедь','Цапля','medium'],['Омар','Рак','medium'],['Колибри','Воробей','medium'],['Бизон','Як','medium'],['Выдра','Бобр','medium'],['Хамелеон','Геккон','medium'],['Скат','Манта','medium'],['Енот','Барсук','medium'],['Хорёк','Ласка','medium'],['Верблюд','Лама','medium'],['Олень','Лось','medium'],['Окапи','Жираф','hard'],['Утконос','Ехидна','hard'],['Кайман','Гавиал','hard'],['Капибара','Морская свинка','hard']]
const V2_PLACES_RU: V2Triple[] = [['Майами','Канкун','easy'],['Дублин','Эдинбург','easy'],['Осака','Киото','easy'],['Ванкувер','Сиэтл','easy'],['Мекка','Медина','medium'],['Неаполь','Палермо','medium'],['Гавана','Сан-Хуан','medium'],['Мумбаи','Калькутта','medium'],['Лагос','Найроби','medium'],['Куско','Ла-Пас','medium'],['Рейкьявик','Осло','medium'],['Брюссель','Амстердам','medium'],['Фес','Марракеш','medium'],['Загреб','Любляна','medium'],['Ханой','Вьентьян','medium'],['Веллингтон','Крайстчерч','medium'],['Самарканд','Бухара','hard'],['Тимбукту','Дженне','hard'],['Петра','Пальмира','hard'],['Мачу-Пикчу','Чичен-Ица','hard']]
const V2_JOBS_RU: V2Triple[] = [['Пекарь','Повар','easy'],['Цирюльник','Парикмахер','easy'],['Почтальон','Курьер','easy'],['Фермер','Скотовод','easy'],['Кардиолог','Онколог','medium'],['Пилот','Второй пилот','medium'],['Помощник юриста','Адвокат','medium'],['Редактор','Копирайтер','medium'],['Сварщик','Кузнец','medium'],['Нотариус','Секретарь','medium'],['Рентгенолог','УЗИ-специалист','medium'],['Гидролог','Океанограф','medium'],['Акушерка','Медсестра','medium'],['Хирург','Анестезиолог','medium'],['Аудитор','Бухгалтер','medium'],['Бармен','Сомелье','medium'],['Актуарий','Андеррайтер','hard'],['Картограф','Топограф','hard'],['Эпидемиолог','Вирусолог','hard'],['Нумизмат','Филателист','hard']]
const V2_SPORTS_RU: V2Triple[] = [['Футбол','Футзал','easy'],['Плавание','Прыжки в воду','easy'],['Велоспорт','Маунтинбайк','easy'],['Бег','Трусца','easy'],['Лакросс','Хоккей на траве','medium'],['Кёрлинг','Боулинг','medium'],['Поло','Крокет','medium'],['Сумо','Дзюдо','medium'],['BMX','Мотокросс','medium'],['Кайтбординг','Виндсёрфинг','medium'],['Пятиборье','Семиборье','medium'],['Стипль-чез','Барьеры','medium'],['Санный спорт','Скелетон','medium'],['Парапланеризм','Дельтапланеризм','medium'],['Каноэ','Каяк','medium'],['Хоккей','Роллер-хоккей','medium'],['Пиклбол','Падел','hard'],['Кейрин','Омниум','hard'],['Слалом','Гигантский слалом','hard'],['Шпага','Сабля','hard']]

// HI
const V2_FOOD_HI: V2Triple[] = [['बेकन','हैम','easy'],['मेयोनीज़','आयोली','easy'],['मक्का','पॉपकॉर्न','easy'],['दही','केफिर','easy'],['बगेट','चियाबाता','medium'],['बिस्क','चाउडर','medium'],['फोंड्यू','राक्लेट','medium'],['मोची','डांगो','medium'],['तमाले','पुपुसा','medium'],['अरेपा','गॉर्डिता','medium'],['पीटा','नान','medium'],['धनिया','अजमोद','medium'],['झींगा','प्रॉन','medium'],['फेटा','हैलूमी','medium'],['ब्राउनी','ब्लॉन्डी','medium'],['एक्लेयर','प्रोफिटरोल','medium'],['कोंजी','जूक','hard'],['आग्नोलॉटी','रविओली','hard'],['कैप्रेज़े','पंज़ानेला','hard'],['बिरयानी','पुलाव','hard']]
const V2_ANIMALS_HI: V2Triple[] = [['मेमना','भेड़','easy'],['बत्तख','हंस','easy'],['लोमड़ी','कोयोट','easy'],['उल्लू','कौआ','easy'],['जगुआर','तेंदुआ','medium'],['हंस','बगुला','medium'],['झींगा मछली','क्रेफ़िश','medium'],['गुंजन पक्षी','गौरैया','medium'],['बाइसन','याक','medium'],['ऊदबिलाव','बीवर','medium'],['गिरगिट','छिपकली','medium'],['स्टिंगरे','मांता रे','medium'],['रैकून','बिज्जू','medium'],['फेरेट','नेवला','medium'],['ऊँट','लामा','medium'],['एल्क','मूस','medium'],['ओकापी','जिराफ़','hard'],['प्लैटिपस','एकिडना','hard'],['केमैन','घड़ियाल','hard'],['कैपीबारा','गिनी पिग','hard']]
const V2_PLACES_HI: V2Triple[] = [['मियामी','कैनकन','easy'],['डबलिन','एडिनबर्ग','easy'],['ओसाका','क्योटो','easy'],['वैंकूवर','सिएटल','easy'],['मक्का','मदीना','medium'],['नेपल्स','पलेर्मो','medium'],['हवाना','सैन जुआन','medium'],['मुंबई','कोलकाता','medium'],['लागोस','नैरोबी','medium'],['कुस्को','ला पास','medium'],['रेकजाविक','ओस्लो','medium'],['ब्रसेल्स','एम्स्टर्डम','medium'],['फेज़','मराकेश','medium'],['ज़ाग्रेब','ल्युब्लियाना','medium'],['हनोई','वियनतियाने','medium'],['वेलिंगटन','क्राइस्टचर्च','medium'],['समरकंद','बुखारा','hard'],['टिम्बकटू','जेने','hard'],['पेट्रा','पाल्मीरा','hard'],['माचू पिचू','चिचेन इत्ज़ा','hard']]
const V2_JOBS_HI: V2Triple[] = [['बेकर','शेफ','easy'],['नाई','हेयरस्टाइलिस्ट','easy'],['डाकिया','कूरियर','easy'],['किसान','पशुपालक','easy'],['हृदय रोग विशेषज्ञ','कैंसर विशेषज्ञ','medium'],['पायलट','सह-पायलट','medium'],['पैरालीगल','वकील','medium'],['संपादक','लेखक','medium'],['वेल्डर','लोहार','medium'],['नोटरी','क्लर्क','medium'],['रेडियोलॉजिस्ट','सोनोग्राफर','medium'],['जलविज्ञानी','समुद्रविज्ञानी','medium'],['दाई','नर्स','medium'],['सर्जन','एनेस्थीसियोलॉजिस्ट','medium'],['लेखा परीक्षक','लेखाकार','medium'],['बारटेंडर','सोमेलियर','medium'],['बीमांकिक','अंडरराइटर','hard'],['मानचित्रकार','स्थलरूप वैज्ञानिक','hard'],['महामारी विज्ञानी','विषाणु विज्ञानी','hard'],['मुद्राशास्त्री','डाकटिकट संग्राहक','hard']]
const V2_SPORTS_HI: V2Triple[] = [['फुटबॉल','फुटसल','easy'],['तैराकी','गोताखोरी','easy'],['साइकिलिंग','माउंटेन बाइकिंग','easy'],['दौड़','जॉगिंग','easy'],['लैक्रोस','फील्ड हॉकी','medium'],['कर्लिंग','बॉलिंग','medium'],['पोलो','क्रोक्वेट','medium'],['सूमो','जूडो','medium'],['बीएमएक्स','मोटोक्रॉस','medium'],['काइटबोर्डिंग','विंडसर्फिंग','medium'],['पेंटाथलॉन','हेप्टाथलॉन','medium'],['स्टीपलचेज़','हर्डल्स','medium'],['लूज','स्केलेटन','medium'],['पैराग्लाइडिंग','हैंग ग्लाइडिंग','medium'],['कैनो','कयाक','medium'],['आइस हॉकी','रोलर हॉकी','medium'],['पिकलबॉल','पैडल','hard'],['केरिन','ओम्नियम','hard'],['स्लैलम','जायंट स्लैलम','hard'],['एपी','सेबर','hard']]

// ── Per-locale translatable pair tables ─────────────────────────────────────
const TR: Record<string, { food: V2Triple[]; animals: V2Triple[]; places: V2Triple[]; jobs: V2Triple[]; sports: V2Triple[] }> = {
  en: { food: V2_FOOD_EN, animals: V2_ANIMALS_EN, places: V2_PLACES_EN, jobs: V2_JOBS_EN, sports: V2_SPORTS_EN },
  fr: { food: V2_FOOD_FR, animals: V2_ANIMALS_FR, places: V2_PLACES_FR, jobs: V2_JOBS_FR, sports: V2_SPORTS_FR },
  es: { food: V2_FOOD_ES, animals: V2_ANIMALS_ES, places: V2_PLACES_ES, jobs: V2_JOBS_ES, sports: V2_SPORTS_ES },
  de: { food: V2_FOOD_DE, animals: V2_ANIMALS_DE, places: V2_PLACES_DE, jobs: V2_JOBS_DE, sports: V2_SPORTS_DE },
  ar: { food: V2_FOOD_AR, animals: V2_ANIMALS_AR, places: V2_PLACES_AR, jobs: V2_JOBS_AR, sports: V2_SPORTS_AR },
  it: { food: V2_FOOD_IT, animals: V2_ANIMALS_IT, places: V2_PLACES_IT, jobs: V2_JOBS_IT, sports: V2_SPORTS_IT },
  pt: { food: V2_FOOD_PT, animals: V2_ANIMALS_PT, places: V2_PLACES_PT, jobs: V2_JOBS_PT, sports: V2_SPORTS_PT },
  zh: { food: V2_FOOD_ZH, animals: V2_ANIMALS_ZH, places: V2_PLACES_ZH, jobs: V2_JOBS_ZH, sports: V2_SPORTS_ZH },
  ru: { food: V2_FOOD_RU, animals: V2_ANIMALS_RU, places: V2_PLACES_RU, jobs: V2_JOBS_RU, sports: V2_SPORTS_RU },
  hi: { food: V2_FOOD_HI, animals: V2_ANIMALS_HI, places: V2_PLACES_HI, jobs: V2_JOBS_HI, sports: V2_SPORTS_HI },
}

// ── Build per-locale V2 packs ───────────────────────────────────────────────
function buildV2ForLocale(loc: string): V2PairData[] {
  const tr = TR[loc]
  if (!tr) return []
  return [
    ...v2p('food',        loc, tr.food),
    ...v2p('animals',     loc, tr.animals),
    ...v2p('places',      loc, tr.places),
    ...v2p('jobs',         loc, tr.jobs),
    ...v2p('sports',      loc, tr.sports),
    ...v2p('mangas',      loc, V2_MANGAS),
    ...v2p('celebrities', loc, V2_CELEBRITIES),
    ...v2p('movies',      loc, V2_MOVIES),
    ...v2p('music',       loc, V2_MUSIC),
    ...v2p('history',     loc, V2_HISTORY),
    ...v2p('tech',        loc, V2_TECH),
  ]
}

export const ENGLISH_PAIRS:    V2PairData[] = buildV2ForLocale('en')
export const FRENCH_PAIRS:     V2PairData[] = buildV2ForLocale('fr')
export const SPANISH_PAIRS:    V2PairData[] = buildV2ForLocale('es')
export const GERMAN_PAIRS:     V2PairData[] = buildV2ForLocale('de')
export const ARABIC_PAIRS:     V2PairData[] = buildV2ForLocale('ar')
export const ITALIAN_PAIRS:    V2PairData[] = buildV2ForLocale('it')
export const PORTUGUESE_PAIRS: V2PairData[] = buildV2ForLocale('pt')
export const CHINESE_PAIRS:    V2PairData[] = buildV2ForLocale('zh')
export const RUSSIAN_PAIRS:    V2PairData[] = buildV2ForLocale('ru')
export const INDIAN_PAIRS:     V2PairData[] = buildV2ForLocale('hi')

export const V2_PAIRS_BY_LOCALE: Record<string, V2PairData[]> = {
  en: ENGLISH_PAIRS,
  fr: FRENCH_PAIRS,
  es: SPANISH_PAIRS,
  de: GERMAN_PAIRS,
  ar: ARABIC_PAIRS,
  it: ITALIAN_PAIRS,
  pt: PORTUGUESE_PAIRS,
  zh: CHINESE_PAIRS,
  ru: RUSSIAN_PAIRS,
  hi: INDIAN_PAIRS,
}

export const V2_PAIRS: V2PairData[] = V2_LOCALES.flatMap((loc) => buildV2ForLocale(loc))
