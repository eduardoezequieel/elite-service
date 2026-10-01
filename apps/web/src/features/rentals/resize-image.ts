import { STORED_FILE_MAX_IMAGE_PX } from '@elite/shared';

/**
 * Reduce una imagen a `STORED_FILE_MAX_IMAGE_PX` de lado mayor antes de
 * subirla (095 RN-7, como el prototipo). Lo usan el logo (095) y las fotos de
 * la inspección (096). Un PNG sigue siendo PNG —el logo puede tener fondo
 * transparente—; lo demás sale como JPEG.
 *
 * Una imagen que ya cabe se sube tal cual: volver a comprimirla solo la empeora.
 */
export async function resizeImage(file: File): Promise<{ blob: Blob; name: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, STORED_FILE_MAX_IMAGE_PX / Math.max(bitmap.width, bitmap.height));

  if (scale === 1) {
    bitmap.close();
    return { blob: file, name: file.name };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));

  if (blob === null) return { blob: file, name: file.name };

  const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';

  return { blob, name: `${base}.${type === 'image/png' ? 'png' : 'jpg'}` };
}
