const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAvatar, MAX_AVATAR_BYTES } = require('./avatars');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);

function dataUrl(mime, buffer) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

test('accepts a PNG, a JPEG and a WebP whose bytes match their declared type', () => {
  for (const [mime, buffer] of [
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['image/webp', WEBP],
  ]) {
    const avatar = parseAvatar(dataUrl(mime, buffer));
    assert.equal(avatar.mime, mime);
    assert.deepEqual(avatar.buffer, buffer);
  }
});

test('rejects an image whose bytes do not match the declared type', () => {
  assert.equal(parseAvatar(dataUrl('image/png', JPEG)), null);
  assert.equal(parseAvatar(dataUrl('image/jpeg', WEBP)), null);
});

test('rejects types outside the allow-list, SVG and GIF included', () => {
  assert.equal(parseAvatar(dataUrl('image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))), null);
  assert.equal(parseAvatar(dataUrl('image/gif', Buffer.from('GIF89a'))), null);
  assert.equal(parseAvatar(dataUrl('text/html', Buffer.from('<script>alert(1)</script>'))), null);
});

test('rejects an image larger than the limit', () => {
  const big = Buffer.concat([PNG, Buffer.alloc(MAX_AVATAR_BYTES)]);
  assert.equal(parseAvatar(dataUrl('image/png', big)), null);
});

test('rejects anything that is not a base64 data URL', () => {
  for (const value of [undefined, null, 42, {}, '', 'https://example.com/a.png', 'data:image/png;base64,***', 'data:image/png,abc']) {
    assert.equal(parseAvatar(value), null);
  }
});
