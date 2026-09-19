// One-off tagger: fills `generation` on every entry of data/songs.json from the artist string.
// A song spanning several series is tagged `CrossGen`.
// Not part of the app runtime — run manually with `node scripts/tag-generations.js`.
// Only unambiguous groups/members are resolved by rule; anything else must be answered in
// OVERRIDES (artist string -> generations), and the script refuses to write while any remain.
const fs = require('fs');
const path = require('path');

const SONGS_JSON_PATH = path.join(__dirname, '..', 'data', 'songs.json');

const NAMES_BY_GENERATION = {
  "µ's": [
    "µ's", 'Printemps', 'BiBi', 'lily white', 'NicoRinPana', 'A-RISE',
    'Honoka Kosaka', 'Eli Ayase', 'Kotori Minami', 'Umi Sonoda', 'Rin Hoshizora',
    'Maki Nishikino', 'Nozomi Tojo', 'Hanayo Koizumi', 'Nico Yazawa',
  ],
  Aqours: [
    'Aqours', 'CYaRon!', 'AZALEA', 'Guilty Kiss', 'Saint Snow', 'Saint Aqours Snow',
    'Chika Takami', 'Riko Sakurauchi', 'Kanan Matsuura', 'Dia Kurosawa', 'You Watanabe',
    'Yoshiko Tsushima', 'Hanamaru Kunikida', 'Mari Ohara', 'Ruby Kurosawa',
    'Yohane', 'Dia', 'Ruby', 'Chika', 'Hanamaru', 'You', 'Kanan', 'Riko', 'Mari', 'YYY',
  ],
  Nijigasaki: [
    'Nijigasaki High School Idol Club', 'A・ZU・NA', 'DiverDiva', 'QU4RTZ', 'R3BIRTH',
    'Ayumu Uehara', 'Kasumi Nakasu', 'Shizuku Osaka', 'Karin Asaka', 'Ai Miyashita',
    'Kanata Konoe', 'Setsuna Yuki', 'Emma Verde', 'Rina Tennoji', 'Shioriko Mifune',
    'Mia Taylor', 'Lanzhu Zhong',
  ],
  Liella: [
    'Liella!', 'CatChu!', 'KALEIDOSCORE', '5yncri5e!', 'Sunny Passion',
    'Kanon Shibuya', 'Keke Tang', 'Chisato Arashi', 'Sumire Heanna', 'Ren Hazuki',
    'Kinako Sakurakoji', 'Mei Yoneme', 'Shiki Wakana', 'Natsumi Onitsuka',
    'Wien Margarete', 'Tomari Onitsuka',
  ],
  Hasunosora: [
    'Hasunosora High School Idol Club', "Hasunosora Girls' High School Idol Club",
    'Cerise Bouquet', 'DOLLCHESTRA', 'Mira-Cra Park!',
    'Kaho Hinoshita', 'Sayaka Murano', 'Kozue Otomune', 'Tsuzuri Yugiri', 'Megumi Fujishima',
    'Rurino Osawa', 'Ruri&To', 'PRINCEε>ε>',
  ],
  CrossGen: ['Love Live!', 'Love Live! ⨯ iDOLM@STER', 'AiScReam'],
  Ikizulive: [
    'Ikizurai-Bu!', 'Edel Note',
    'Polka Takahashi', 'Mai Azabu', 'Akira Goto', 'Hanabi Komagata', 'Miracle Kanazawa',
    'Noriko Chofu', 'Yukuri Harumiya', 'Aurora Konohana', 'Midori Yamada', 'Shion Sasaki',
  ],
  Musical: ['School Idol Musical'],
};

// Answers given by the maintainer for artists the rules above cannot decide.
const OVERRIDES = {
  'Aqours ft. Hatsune Miku': ['Aqours'],
  'GKSS (Guilty Kiss × Saint Snow)': ['Aqours'],
};

const GENERATION_BY_NAME = new Map();
for (const [generation, names] of Object.entries(NAMES_BY_GENERATION)) {
  for (const name of names) GENERATION_BY_NAME.set(name, generation);
}

function resolveArtist(artist) {
  if (artist in OVERRIDES) return OVERRIDES[artist];
  const parts = artist
    .split(/\s*(?:\/|,|\bft\.)\s*/)
    .map((part) => part.replace(/\s*\(CV:[^)]*\)\s*$/, '').trim());
  const generations = [];
  for (const part of parts) {
    const generation = GENERATION_BY_NAME.get(part);
    if (!generation) return null;
    if (!generations.includes(generation)) generations.push(generation);
  }
  return generations;
}

function withGeneration(song, generation) {
  const { generation: _previous, generations: _legacy, ...rest } = song;
  const entries = Object.entries(rest);
  const at = entries.findIndex(([key]) => key === 'artistJa') + 1;
  entries.splice(at, 0, ['generation', generation]);
  return Object.fromEntries(entries);
}

const songs = JSON.parse(fs.readFileSync(SONGS_JSON_PATH, 'utf8'));
const unresolved = new Map();
const tagged = songs.map((song) => {
  const generations = resolveArtist(song.artist);
  if (!generations) {
    const ids = unresolved.get(song.artist) || [];
    ids.push(song.id);
    unresolved.set(song.artist, ids);
    return song;
  }
  return withGeneration(song, generations.length > 1 ? 'CrossGen' : generations[0]);
});

if (unresolved.size > 0) {
  console.log(`${unresolved.size} artist(s) unresolved, nothing written:`);
  for (const [artist, ids] of unresolved) {
    console.log(`  ${JSON.stringify(artist)}  (${ids.length} song(s), e.g. id ${ids[0]})`);
  }
  process.exit(1);
}

fs.writeFileSync(SONGS_JSON_PATH, JSON.stringify(tagged, null, 2) + '\n');
const counts = {};
for (const song of tagged) counts[song.generation] = (counts[song.generation] || 0) + 1;
console.log('written', counts);
