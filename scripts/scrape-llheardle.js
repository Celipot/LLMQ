// One-off scraper: pulls the song pool metadata + audio from llheardle.suyo.be
// (an open-source Love Live! Heardle clone) to replace the placeholder song.
// Not part of the app runtime — run manually with `node scripts/scrape-llheardle.js`.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://llheardle.suyo.be';
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');
const SONGS_JSON_PATH = path.join(__dirname, '..', 'data', 'songs.json');
const CONCURRENCY = 5;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP_${res.status}_FOR_${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP_${res.status}_FOR_${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Extracts the `SONGPOOL=[...]` array literal from info.min.js by bracket-matching
// (tracking string state so brackets inside URLs don't confuse it), then evaluates
// only that value expression in an empty vm context - never the whole untrusted bundle.
function extractSongPool(scriptText) {
  const marker = 'SONGPOOL=';
  const startIdx = scriptText.indexOf(marker);
  if (startIdx === -1) throw new Error('SONGPOOL_NOT_FOUND');
  const arrayStart = startIdx + marker.length;
  if (scriptText[arrayStart] !== '[') throw new Error('SONGPOOL_NOT_AN_ARRAY');

  let depth = 0;
  let inString = null;
  let escaped = false;
  let endIdx = -1;
  for (let i = arrayStart; i < scriptText.length; i++) {
    const ch = scriptText[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error('SONGPOOL_UNTERMINATED');

  const arrayText = scriptText.slice(arrayStart, endIdx);
  const sandbox = {};
  vm.createContext(sandbox);
  return vm.runInContext(`(${arrayText})`, sandbox, { timeout: 5000 });
}

function slugFromSongUrl(songUrl) {
  // e.g. "songs/0_bokuranolivekimitonolife.mp3" -> "0_bokuranolivekimitonolife"
  return path.basename(songUrl, path.extname(songUrl));
}

function mapToSchema(songPool) {
  return songPool.map((entry, id) => ({
    id,
    title: entry.titleEn,
    artist: entry.artistEn,
    audioFile: `${slugFromSongUrl(entry.songUrl)}.wav`,
    titleJa: entry.titleJa,
    artistJa: entry.artistJa,
    coverUrl: entry.coverUrl,
    listenOn: entry.listenOn,
    _songUrl: entry.songUrl,
  }));
}

async function downloadAndConvert(song, index, total) {
  const wavPath = path.join(AUDIO_DIR, song.audioFile);
  if (fs.existsSync(wavPath)) {
    console.log(`[${index + 1}/${total}] skip (exists): ${song.audioFile}`);
    return;
  }

  const mp3Path = path.join(AUDIO_DIR, `${slugFromSongUrl(song._songUrl)}.tmp.mp3`);
  try {
    const buffer = await fetchBuffer(`${BASE_URL}/${song._songUrl}`);
    fs.writeFileSync(mp3Path, buffer);
    await execFileAsync('ffmpeg', ['-y', '-i', mp3Path, '-c:a', 'pcm_s16le', wavPath]);
    console.log(`[${index + 1}/${total}] ok: ${song.audioFile}`);
  } catch (err) {
    console.error(`[${index + 1}/${total}] FAILED: ${song.audioFile} (${err.message})`);
  } finally {
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
  }
}

async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i, items.length);
    }
  }
  await Promise.all(Array.from({ length: limit }, next));
}

async function main() {
  console.log('Fetching song pool metadata...');
  const scriptText = await fetchText(`${BASE_URL}/js/info.min.js`);
  const songPool = extractSongPool(scriptText);
  console.log(`Found ${songPool.length} songs.`);

  const songs = mapToSchema(songPool);

  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  console.log('Downloading and converting audio (this will take a while)...');
  await runWithConcurrency(songs, CONCURRENCY, (song, i, total) =>
    downloadAndConvert(song, i, total)
  );

  const output = songs.map(({ _songUrl, ...rest }) => rest);
  fs.writeFileSync(SONGS_JSON_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} songs to ${SONGS_JSON_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
