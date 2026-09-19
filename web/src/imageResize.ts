// Turns a picked image file into the small square JPEG stored in the profile
// and sent to the server: decoded and re-encoded through a canvas, so what
// leaves the browser is always a plain, small JPEG whatever the source was.
export const AVATAR_SIZE = 128;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const JPEG_QUALITY = 0.85;

export async function resizeImageToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('UNSUPPORTED_IMAGE_TYPE');

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');

  // JPEG has no transparency: without a background a transparent PNG turns black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
