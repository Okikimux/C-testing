/** Applies the CARTOMUX brand mark to seller listing photos before upload. */
export async function addCartomuxWatermark(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a valid image file.');
  // Preserve animated GIFs rather than silently flattening their animation.
  if (file.type === 'image/gif') return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the photo watermark.');

    context.drawImage(bitmap, 0, 0, width, height);

    const fontFamily = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-display').trim() || 'Arial, sans-serif';
    const fontSize = Math.max(17, Math.min(42, Math.round(Math.min(width, height) * 0.038)));
    const padding = Math.max(9, Math.round(fontSize * 0.34));
    const iconSize = Math.round(fontSize * 1.28);
    const gap = Math.round(fontSize * 0.28);
    await document.fonts.load(`800 ${fontSize}px ${fontFamily}`);
    context.font = `800 ${fontSize}px ${fontFamily}`;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    const wordWidth = context.measureText('CARTOMUX').width;
    const pillWidth = padding * 2 + iconSize + gap + wordWidth;
    const pillHeight = padding * 2 + iconSize;
    const margin = Math.max(12, Math.round(Math.min(width, height) * 0.025));
    const x = width - pillWidth - margin;
    const y = height - pillHeight - margin;
    const radius = Math.round(pillHeight / 2);

    // Soft navy glass capsule keeps the mark legible on both light and dark photos.
    context.save();
    context.globalAlpha = 0.82;
    context.fillStyle = '#082340';
    context.beginPath();
    context.roundRect(x, y, pillWidth, pillHeight, radius);
    context.fill();
    context.restore();

    const logoResponse = await fetch('/campusdrop-logo.png', { cache: 'force-cache' });
    if (!logoResponse.ok) throw new Error('The CARTOMUX logo could not be loaded.');
    const logoBitmap = await createImageBitmap(await logoResponse.blob());
    const iconX = x + padding;
    const iconY = y + padding;

    // A light icon tile preserves the navy/green logo colours against any photograph.
    context.save();
    context.globalAlpha = 0.94;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.roundRect(iconX, iconY, iconSize, iconSize, Math.round(iconSize * 0.24));
    context.fill();
    context.restore();
    const inset = Math.round(iconSize * 0.08);
    context.drawImage(logoBitmap, iconX + inset, iconY + inset, iconSize - inset * 2, iconSize - inset * 2);
    logoBitmap.close();

    context.save();
    context.globalAlpha = 0.98;
    context.fillStyle = '#ffffff';
    context.font = `800 ${fontSize}px ${fontFamily}`;
    context.textBaseline = 'middle';
    context.fillText('CARTOMUX', iconX + iconSize + gap, y + pillHeight / 2);
    context.restore();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob) throw new Error('The watermarked photo could not be generated. Please try another image.');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'cartomux-photo';
    return new File([blob], `${baseName}-cartomux.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error && /watermark|CARTOMUX logo|browser could not/i.test(error.message)) throw error;
    throw new Error('This photo could not be watermarked in your browser. Please use a JPG, PNG or WebP image.');
  } finally {
    bitmap?.close();
  }
}
