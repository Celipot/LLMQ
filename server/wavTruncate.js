// Truncates a PCM WAV file to a given duration by reading only the header
// and the needed slice of the data chunk - never the whole file - then
// rewriting RIFF/data sizes. This is what makes the duration limit a
// server-side guarantee rather than a front-end-only restriction: the bytes
// for anything beyond `seconds` never leave the server, and (just as
// important with multi-minute source files) never get read off disk either -
// a full synchronous read of a large file would block the event loop and
// stall every other in-flight request.
const fs = require('fs/promises');

// Generous margin over any real fmt/LIST/data chunk layout (observed ~120
// bytes for ffmpeg-produced files); cheap to over-read since it's still
// tiny next to a multi-MB source file.
const HEADER_SCAN_BYTES = 65536;

function parseWavHeader(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('NOT_A_WAV_FILE');
  }

  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ') {
      fmt = {
        channels: buffer.readUInt16LE(chunkDataStart + 2),
        sampleRate: buffer.readUInt32LE(chunkDataStart + 4),
        byteRate: buffer.readUInt32LE(chunkDataStart + 8),
        blockAlign: buffer.readUInt16LE(chunkDataStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkDataStart + 14),
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkDataStart;
      dataSize = chunkSize;
      break; // nothing past the data chunk matters for playback
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!fmt || dataOffset === null) {
    throw new Error('MALFORMED_WAV_FILE');
  }

  return { fmt, dataOffset, dataSize };
}

function buildHeader(fmt, dataSize) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(fmt.byteRate, 28);
  header.writeUInt16LE(fmt.blockAlign, 32);
  header.writeUInt16LE(fmt.bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return header;
}

async function truncateWavFile(filePath, seconds) {
  const handle = await fs.open(filePath, 'r');
  try {
    const scanBuffer = Buffer.alloc(HEADER_SCAN_BYTES);
    const { bytesRead } = await handle.read(scanBuffer, 0, HEADER_SCAN_BYTES, 0);
    const { fmt, dataOffset, dataSize } = parseWavHeader(scanBuffer.subarray(0, bytesRead));

    const maxBytes = Math.floor(fmt.byteRate * seconds);
    const truncatedDataSize = Math.min(dataSize, maxBytes - (maxBytes % fmt.blockAlign));

    const dataBuffer = Buffer.alloc(truncatedDataSize);
    await handle.read(dataBuffer, 0, truncatedDataSize, dataOffset);

    return Buffer.concat([buildHeader(fmt, truncatedDataSize), dataBuffer]);
  } finally {
    await handle.close();
  }
}

module.exports = { truncateWavFile };
