import { afterEach, describe, expect, test, vi } from 'vitest';
import { AVATAR_SIZE, resizeImageToDataUrl } from './imageResize';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubCanvas() {
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
  return context;
}

function pngFile() {
  return new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' });
}

describe('resizeImageToDataUrl', () => {
  test('crops the centre square of the picture and scales it to the avatar size', async () => {
    const context = stubCanvas();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 200, height: 100, close: vi.fn() }));

    const result = await resizeImageToDataUrl(pngFile());

    expect(result).toBe('data:image/jpeg;base64,AAAA');
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 100, 100, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  });

  test('paints a white background so transparent pictures do not turn black', async () => {
    const context = stubCanvas();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 64, height: 64, close: vi.fn() }));

    await resizeImageToDataUrl(pngFile());

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  });

  test('refuses a file type that is not PNG, JPEG or WebP', async () => {
    const svg = new File(['<svg/>'], 'me.svg', { type: 'image/svg+xml' });

    await expect(resizeImageToDataUrl(svg)).rejects.toThrow('UNSUPPORTED_IMAGE_TYPE');
  });

  test('rejects when the file cannot be decoded as an image', async () => {
    stubCanvas();
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));

    await expect(resizeImageToDataUrl(pngFile())).rejects.toThrow();
  });
});
