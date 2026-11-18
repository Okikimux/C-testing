import { baseNameOf, canvasToFile } from './image-tools';

/* CARTOMUX listing-photo watermark.

   Design: a small, translucent white lockup (logo + wordmark) in the bottom-right
   corner, sitting on a very soft halo. There is no solid badge, so the photo
   stays the hero, and the shade plus a faint shadow keep the mark readable on both
   bright and dark pictures. It is sized from the shorter side, so it fits square
   photos (the format of every CARTOMUX listing) without ever touching the edge. */

const LOGO_URL = '/campusdrop-logo.png';
/* The logo file is 1024px square with transparent padding; this is the artwork area. */
const LOGO_TRIM = { x: 56, y: 33, width: 937, height: 991, source: 1024 };

export const WATERMARK_STYLE = {
  /** Opacity of the white logo and wordmark. */
  markOpacity: 0.8,
  /** Opacity of the darkest part of the soft halo behind the mark. */
  shadeOpacity: 0.26,
  /** Wordmark size as a share of the photo's shorter side. */
  sizeRatio: 0.034,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Draws the watermark onto an existing canvas context. Exported so previews can reuse it. */
export async function drawCartomuxMark(context: CanvasRenderingContext2D, width: number, height: number) {
  const shortSide = Math.min(width, height);
  const fontSize = clamp(Math.round(shortSide * WATERMARK_STYLE.sizeRatio), 13, 40);
  const iconHeight = Math.round(fontSize * 1.5);
  const iconWidth = Math.round((iconHeight * LOGO_TRIM.width) / LOGO_TRIM.height);
  const gap = Math.round(fontSize * 0.36);
  const margin = Math.max(10, Math.round(shortSide * 0.035));

  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'Arial, sans-serif';
  const font = `800 ${fontSize}px ${fontFamily}`;
  await document.fonts.load(font);

  const logoResponse = await fetch(LOGO_URL, { cache: 'force-cache' });
  if (!logoResponse.ok) throw new Error('The CARTOMUX logo could not be loaded.');
  const logo = await createImageBitmap(await logoResponse.blob());

  try {
    context.save();
    context.font = font;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    if ('letterSpacing' in context) (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(fontSize * 0.08).toFixed(2)}px`;
    const wordWidth = context.measureText('CARTOMUX').width;
    const lockupWidth = iconWidth + gap + wordWidth;
    const x = width - margin - lockupWidth;
    const y = height - margin - iconHeight;

    // 1 · A soft, local halo behind the lockup so white stays readable on light photos.
    const centerX = x + lockupWidth / 2;
    const centerY = y + iconHeight / 2;
    context.save();
    context.translate(centerX, centerY);
    context.scale(lockupWidth * 0.8, iconHeight * 2);
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    halo.addColorStop(0, `rgba(6, 26, 46, ${WATERMARK_STYLE.shadeOpacity})`);
    halo.addColorStop(0.5, `rgba(6, 26, 46, ${WATERMARK_STYLE.shadeOpacity * 0.55})`);
    halo.addColorStop(1, 'rgba(6, 26, 46, 0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // 2 · The logo as a single-colour white silhouette.
    const silhouette = document.createElement('canvas');
    silhouette.width = iconWidth * 2;
    silhouette.height = iconHeight * 2;
    const silhouetteContext = silhouette.getContext('2d');
    if (!silhouetteContext) throw new Error('Your browser could not prepare the photo watermark.');
    const unit = logo.width / LOGO_TRIM.source;
    silhouetteContext.drawImage(logo, LOGO_TRIM.x * unit, LOGO_TRIM.y * unit, LOGO_TRIM.width * unit, LOGO_TRIM.height * unit, 0, 0, silhouette.width, silhouette.height);
    silhouetteContext.globalCompositeOperation = 'source-in';
    silhouetteContext.fillStyle = '#ffffff';
    silhouetteContext.fillRect(0, 0, silhouette.width, silhouette.height);

    context.globalAlpha = WATERMARK_STYLE.markOpacity;
    context.shadowColor = 'rgba(0, 0, 0, 0.45)';
    context.shadowBlur = fontSize * 0.4;
    context.shadowOffsetY = Math.max(1, fontSize * 0.04);
    context.drawImage(silhouette, x, y, iconWidth, iconHeight);

    // 3 · The wordmark.
    context.fillStyle = '#ffffff';
    context.fillText('CARTOMUX', x + iconWidth + gap, y + iconHeight / 2 + fontSize * 0.04);
    context.restore();
  } finally {
    logo.close();
  }
}

/** Adds the CARTOMUX watermark to a photo and returns the finished file. */
export async function addCartomuxWatermark(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a valid image file.');
  // Preserve animated GIFs rather than silently flattening their animation.
  if (file.type === 'image/gif') return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the photo watermark.');
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    await drawCartomuxMark(context, bitmap.width, bitmap.height);
    return await canvasToFile(canvas, `${baseNameOf(file)}-cartomux`, 0.9);
  } catch (error) {
    if (error instanceof Error && /watermark|CARTOMUX logo|browser could not|could not be prepared/i.test(error.message)) throw error;
    throw new Error('This photo could not be watermarked in your browser. Please use a JPG, PNG or WebP image.');
  } finally {
    bitmap?.close();
  }
}
