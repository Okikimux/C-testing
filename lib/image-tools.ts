/* Helpers shared by the photo cropper and the CARTOMUX watermark.
   Everything here runs in the browser (canvas based, no dependencies). */

/** Largest side of a square listing photo that we upload. */
export const SQUARE_MAX = 1200;
/** Smallest side we ever render, so tiny photos are not shrunk further. */
export const SQUARE_MIN = 512;

/* Files that already went through crop + watermark. The sell page uses this so a
   photo is never watermarked twice, and so the original can be re-cropped later. */
const processedFiles = new WeakSet<File>();
const originalFiles = new WeakMap<File, File>();

export function markProcessed(processed: File, original?: File) {
  processedFiles.add(processed);
  if (original) originalFiles.set(processed, original);
}
export const isProcessed = (file: File) => processedFiles.has(file);
export const originalOf = (file: File) => originalFiles.get(file);

/** Encodes a canvas using the first format the browser really supports (WebP, then JPEG). */
export async function canvasToFile(canvas: HTMLCanvasElement, baseName: string, quality = 0.9): Promise<File> {
  const attempts: [string, string][] = [['image/webp', 'webp'], ['image/jpeg', 'jpg']];
  for (const [type, extension] of attempts) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    // Some browsers silently fall back to PNG; only accept the format we asked for.
    if (blob && blob.type === type) {
      return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
    }
  }
  throw new Error('The photo could not be prepared. Please try another image.');
}

export const baseNameOf = (file: File, fallback = 'cartomux-photo') => file.name.replace(/\.[^.]+$/, '') || fallback;

export type CropGeometry = {
  /** Side of the visible square, in CSS pixels. */
  viewport: number;
  /** CSS pixels per image pixel. */
  scale: number;
  /** Image-pixel coordinates that sit in the middle of the square. */
  centerX: number;
  centerY: number;
};

/** The zoom range for an image inside a square viewport: "fit whole photo" up to 4x "fill". */
export function zoomRange(naturalWidth: number, naturalHeight: number, viewport: number) {
  const fill = Math.max(viewport / naturalWidth, viewport / naturalHeight);
  const fit = Math.min(viewport / naturalWidth, viewport / naturalHeight);
  return { fit, fill, max: Math.max(fill * 4, fit) };
}

/** Keeps the photo from being dragged away from the square (or centred when it is smaller). */
export function clampCenter(naturalWidth: number, naturalHeight: number, geometry: CropGeometry) {
  const half = geometry.viewport / 2 / geometry.scale;
  const clampAxis = (value: number, size: number) => (half * 2 >= size ? size / 2 : Math.min(size - half, Math.max(half, value)));
  return { centerX: clampAxis(geometry.centerX, naturalWidth), centerY: clampAxis(geometry.centerY, naturalHeight) };
}

/** Draws the chosen crop into a square canvas. Empty edges (fit mode) get a soft blurred backdrop. */
export function renderSquare(image: HTMLImageElement, geometry: CropGeometry): HTMLCanvasElement {
  const { naturalWidth: width, naturalHeight: height } = image;
  const sourceSide = geometry.viewport / geometry.scale;
  const side = Math.round(Math.min(SQUARE_MAX, Math.max(SQUARE_MIN, sourceSide)));
  const ratio = side / geometry.viewport;

  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the photo.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#eef2f6';
  context.fillRect(0, 0, side, side);

  const drawnWidth = width * geometry.scale * ratio;
  const drawnHeight = height * geometry.scale * ratio;
  const left = (geometry.viewport / 2 - geometry.centerX * geometry.scale) * ratio;
  const top = (geometry.viewport / 2 - geometry.centerY * geometry.scale) * ratio;
  const coversSquare = left <= 0.5 && top <= 0.5 && left + drawnWidth >= side - 0.5 && top + drawnHeight >= side - 0.5;

  if (!coversSquare) {
    // Cheap, universal blur: shrink the photo to a few pixels, then stretch it back up.
    const tiny = document.createElement('canvas');
    tiny.width = 48;
    tiny.height = 48;
    const tinyContext = tiny.getContext('2d');
    if (tinyContext) {
      const fill = Math.max(48 / width, 48 / height);
      tinyContext.imageSmoothingQuality = 'high';
      tinyContext.drawImage(image, 24 - (width * fill) / 2, 24 - (height * fill) / 2, width * fill, height * fill);
      context.drawImage(tiny, 0, 0, side, side);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(0, 0, side, side);
    }
  }
  context.drawImage(image, left, top, drawnWidth, drawnHeight);
  return canvas;
}
