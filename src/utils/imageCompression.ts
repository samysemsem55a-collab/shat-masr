/**
 * Image Compression & Banner Cropping Utilities
 * Compresses images client-side before upload to max 800px width and under 200KB.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  initialQuality?: number;
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxWidth = options.maxWidth ?? 800;
  const maxHeight = options.maxHeight ?? 800;
  const maxBytes = options.maxBytes ?? 200 * 1024; // 200KB
  let quality = options.initialQuality ?? 0.84;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('صيغة الصورة غير مدعومة'));
    el.src = dataUrl;
  });

  let width = img.naturalWidth || img.width || maxWidth;
  let height = img.naturalHeight || img.height || maxHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Iteratively adjust quality and dimensions until size <= maxBytes
  let output = canvas.toDataURL('image/jpeg', quality);
  let attempts = 0;
  while (estimateDataUrlBytes(output) > maxBytes && attempts < 7) {
    attempts += 1;
    if (quality > 0.45) {
      quality = Math.max(0.4, quality - 0.12);
    } else {
      canvas.width = Math.max(320, Math.round(canvas.width * 0.8));
      canvas.height = Math.max(180, Math.round(canvas.height * 0.8));
      const resizedCtx = canvas.getContext('2d');
      if (resizedCtx) {
        resizedCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }
    output = canvas.toDataURL('image/jpeg', quality);
  }

  return output;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function compressImageFileToBlob(
  file: File,
  options: CompressImageOptions = {}
): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = await compressImageFile(file, options);
  const blob = await dataUrlToBlob(dataUrl);
  return { blob, dataUrl };
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Crops an image inside a rectangular banner frame (16:5 ratio, e.g., 960x300)
 * using zoom (1..2.5) and focal offset percentages (-50..50).
 */
export async function cropBannerToDataUrl(
  imageSrc: string,
  zoom: number = 1,
  offsetXPercent: number = 0,
  offsetYPercent: number = 0,
  targetWidth: number = 960,
  targetHeight: number = 300
): Promise<{ dataUrl: string; blob: Blob }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('تعذر تحميل صورة البانر'));
    el.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const blob = await dataUrlToBlob(imageSrc);
    return { dataUrl: imageSrc, blob };
  }

  const targetRatio = targetWidth / targetHeight;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const imgRatio = imgW / imgH;

  let baseDrawW: number;
  let baseDrawH: number;
  if (imgRatio > targetRatio) {
    baseDrawH = targetHeight;
    baseDrawW = targetHeight * imgRatio;
  } else {
    baseDrawW = targetWidth;
    baseDrawH = targetWidth / imgRatio;
  }

  const safeZoom = Math.max(1, Math.min(3, zoom));
  const drawW = baseDrawW * safeZoom;
  const drawH = baseDrawH * safeZoom;

  const maxOverflowX = Math.max(0, (drawW - targetWidth) / 2);
  const maxOverflowY = Math.max(0, (drawH - targetHeight) / 2);

  const shiftX = (offsetXPercent / 50) * maxOverflowX;
  const shiftY = (offsetYPercent / 50) * maxOverflowY;

  const drawX = (targetWidth - drawW) / 2 + shiftX;
  const drawY = (targetHeight - drawH) / 2 + shiftY;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  let quality = 0.86;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (estimateDataUrlBytes(out) > 200 * 1024 && quality > 0.48) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  const blob = await dataUrlToBlob(out);
  return { dataUrl: out, blob };
}
