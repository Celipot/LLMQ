// Truncates a PCM WAV file to a given duration by slicing the data chunk
// and rewriting RIFF/data sizes. This is what makes the duration limit a
// server-side guarantee rather than a front-end-only restriction: the bytes
// for anything beyond `seconds` never leave the server.
const fs = require('fs');

function readWavHeader(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('NOT_A_WAV_FILE');
  }

  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  let dataSize = null;

  while (offset < buffer.length) {
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
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!fmt || dataOffset === null) {
    throw new Error('MALFORMED_WAV_FILE');
  }

  return { fmt, dataOffset, dataSize };
}

function truncateWavFile(filePath, seconds) {
  const fullBuffer = fs.readFileSync(filePath);
  const { fmt, dataOffset, dataSize } = readWavHeader(fullBuffer);

  const maxBytes = Math.floor(fmt.byteRate * seconds);
  const truncatedDataSize = Math.min(dataSize, maxBytes - (maxBytes % fmt.blockAlign));

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + truncatedDataSize, 4);
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
  header.writeUInt32LE(truncatedDataSize, 40);

  const dataSlice = fullBuffer.subarray(dataOffset, dataOffset + truncatedDataSize);
  return Buffer.concat([header, dataSlice]);
}

module.exports = { truncateWavFile };
