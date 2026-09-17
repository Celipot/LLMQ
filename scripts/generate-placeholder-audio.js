// Generates a simple sine-wave WAV placeholder track (no real audio provided yet).
// PCM/WAV is used deliberately: it lets the server truncate by byte offset
// (sampleRate * bytesPerSample * channels * seconds) without any decoding/re-encoding step.
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const DURATION_SECONDS = 30;
const FREQUENCY_HZ = 440; // A4, just so the placeholder is audible

const bytesPerSample = BITS_PER_SAMPLE / 8;
const blockAlign = CHANNELS * bytesPerSample;
const byteRate = SAMPLE_RATE * blockAlign;
const numSamples = SAMPLE_RATE * DURATION_SECONDS;
const dataSize = numSamples * blockAlign;

const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // fmt chunk size
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / SAMPLE_RATE;
  // Gentle fade in/out envelope so the placeholder isn't a harsh click at loop points.
  const envelope = Math.min(1, t * 8, (DURATION_SECONDS - t) * 8);
  const sample = Math.sin(2 * Math.PI * FREQUENCY_HZ * t) * envelope * 0.2;
  buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * blockAlign);
}

const outDir = path.join(__dirname, '..', 'data', 'audio');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'placeholder.wav');
fs.writeFileSync(outPath, buffer);
console.log(`Placeholder WAV written to ${outPath} (${DURATION_SECONDS}s, ${SAMPLE_RATE}Hz mono 16-bit)`);
