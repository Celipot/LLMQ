// Validation of the profile picture a player sends when joining a room.
// Only PNG, JPEG and WebP are accepted, and the bytes must match the declared
// type: the image is later served back to every player of the room, so SVG
// (scripts) and anything that merely claims to be an image are refused.
const MAX_AVATAR_BYTES = 64 * 1024;

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SIGNATURES = {
  'image/png': (b) => b.length > PNG_SIGNATURE.length && b.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
};

// Returns { mime, buffer }, or null when the value is not an acceptable avatar.
function parseAvatar(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = DATA_URL.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) return null;
  if (!SIGNATURES[mime](buffer)) return null;
  return { mime, buffer };
}

module.exports = { parseAvatar, MAX_AVATAR_BYTES };
