const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { truncateWavFile } = require('./wavTruncate');

const WAV_HEADER_SIZE = 44;
const SAMPLE_RATE = 8000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BLOCK_ALIGN = (CHANNELS * BITS_PER_SAMPLE) / 8;
const BYTE_RATE = SAMPLE_RATE * BLOCK_ALIGN;
const DURATION_SECONDS = 5;

let fixturePath;
let fixtureWithListChunkPath;

before(() => {
  const dataSize = SAMPLE_RATE * DURATION_SECONDS * BLOCK_ALIGN;
  const buffer = Buffer.alloc(WAV_HEADER_SIZE + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(BYTE_RATE, 28);
  buffer.writeUInt16LE(BLOCK_ALIGN, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // content doesn't matter for these assertions, silence is fine

  fixturePath = path.join(os.tmpdir(), `llmq-wavtruncate-test-${process.pid}.wav`);
  fs.writeFileSync(fixturePath, buffer);

  // Mirrors real ffmpeg-produced files, which insert a LIST/INFO metadata
  // chunk between fmt and data - the header parser must walk past it
  // instead of assuming data starts at a fixed offset.
  let listChunkBody = Buffer.from('INFOICRDsome comment');
  if (listChunkBody.length % 2 !== 0) {
    listChunkBody = Buffer.concat([listChunkBody, Buffer.from('\0')]);
  }
  const listChunk = Buffer.concat([
    Buffer.from('LIST'),
    (() => {
      const size = Buffer.alloc(4);
      size.writeUInt32LE(listChunkBody.length, 0);
      return size;
    })(),
    listChunkBody,
  ]);
  const withList = Buffer.concat([buffer.subarray(0, 36), listChunk, buffer.subarray(36)]);
  withList.writeUInt32LE(withList.length - 8, 4); // fix up RIFF size for the extra chunk

  fixtureWithListChunkPath = path.join(os.tmpdir(), `llmq-wavtruncate-list-test-${process.pid}.wav`);
  fs.writeFileSync(fixtureWithListChunkPath, withList);
});

test('truncated buffer has exactly header + 1 second of audio data', async () => {
  const result = await truncateWavFile(fixturePath, 1);
  assert.equal(result.length, WAV_HEADER_SIZE + BYTE_RATE);
});

test('data chunk size in the header matches the truncated byte count', async () => {
  const result = await truncateWavFile(fixturePath, 1);
  const declaredDataSize = result.readUInt32LE(40);
  assert.equal(declaredDataSize, BYTE_RATE);
  assert.equal(result.length, WAV_HEADER_SIZE + declaredDataSize);
});

test('RIFF chunk size matches 36 + data size', async () => {
  const result = await truncateWavFile(fixturePath, 2);
  const riffSize = result.readUInt32LE(4);
  const dataSize = result.readUInt32LE(40);
  assert.equal(riffSize, 36 + dataSize);
});

test('requesting more seconds than the file has returns the full file unchanged', async () => {
  const result = await truncateWavFile(fixturePath, DURATION_SECONDS + 100);
  assert.equal(result.length, WAV_HEADER_SIZE + SAMPLE_RATE * DURATION_SECONDS * BLOCK_ALIGN);
});

test('truncated size never exceeds what the requested duration allows', async () => {
  const result = await truncateWavFile(fixturePath, 2.5);
  const maxAllowedBytes = Math.floor(BYTE_RATE * 2.5);
  assert.ok(result.length - WAV_HEADER_SIZE <= maxAllowedBytes);
});

test('a LIST metadata chunk between fmt and data (as ffmpeg produces) is walked past correctly', async () => {
  const result = await truncateWavFile(fixtureWithListChunkPath, 1);
  assert.equal(result.readUInt32LE(40), BYTE_RATE);
  assert.equal(result.length, WAV_HEADER_SIZE + BYTE_RATE);
});
