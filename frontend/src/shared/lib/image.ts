/**
 * Сжатие фото на телефоне перед загрузкой: оригинал с камеры 3–8 МБ,
 * после — ~300 КБ (1600px) и превью ~30 КБ (400px). Ориентация по EXIF учитывается.
 */

const FULL_SIDE = 1600;
const THUMB_SIDE = 400;

export type CompressedPhoto = { full: Blob; thumb: Blob; takenAt: string };

async function draw(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось сжать фото'))),
      'image/jpeg',
      quality,
    ),
  );
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const [full, thumb] = await Promise.all([
      draw(bitmap, FULL_SIDE, 0.82),
      draw(bitmap, THUMB_SIDE, 0.72),
    ]);
    return { full, thumb, takenAt: new Date(file.lastModified || Date.now()).toISOString() };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}
