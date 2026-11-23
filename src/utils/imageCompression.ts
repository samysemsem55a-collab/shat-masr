/**
 * Image Compression & Banner Cropping Utilities
 * Compresses images client-side via <canvas> before upload to max 800px width and under 300KB.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  initialQuality?: number;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('تعذر ضغط الصورة'));
        },
        'image/jpeg',
        quality
      );
    } else {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      fetch(dataUrl)
        .then((r) => r.blob())
        .then(resolve)
        .catch(reject);
    }
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة المضغوطة'));
    reader.readAsDataURL(blob);
  });
}

async function decodeImageSource(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // Fallback to <img> with ObjectURL below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('صيغة الصورة غير مدعومة'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      },
    };
  } catch (err) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {}
    throw err;
  }
}

export async function compressImageFileToBlob(
  file: File,
  options: CompressImageOptions = {}
): Promise<{ blob: Blob; dataUrl?: string }> {
  const maxWidth = options.maxWidth ?? 1080;
  const maxHeight = options.maxHeight ?? 1080;
  const maxBytes = options.maxBytes ?? 220 * 1024;
  let quality = options.initialQuality ?? 0.8;

  const decoded = await decodeImageSource(file);
  try {
    let width = decoded.width || maxWidth;
    let height = decoded.height || maxHeight;

    const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file };
    }

    if (file.type !== 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToJpegBlob(canvas, quality);
    let attempts = 0;
    while (blob.size > maxBytes && attempts < 5) {
      attempts += 1;
      if (quality > 0.52) {
        quality = Math.max(0.45, quality - 0.14);
      } else {
        canvas.width = Math.max(360, Math.round(canvas.width * 0.78));
        canvas.height = Math.max(240, Math.round(canvas.height * 0.78));
        const resizedCtx = canvas.getContext('2d');
        if (resizedCtx) {
          if (file.type !== 'image/jpeg') {
            resizedCtx.fillStyle = '#ffffff';
            resizedCtx.fillRect(0, 0, canvas.width, canvas.height);
          }
          resizedCtx.imageSmoothingEnabled = true;
          resizedCtx.imageSmoothingQuality = 'high';
          resizedCtx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        }
      }
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (
      file.type === 'image/jpeg' &&
      decoded.width <= maxWidth &&
      decoded.height <= maxHeight &&
      file.size <= maxBytes &&
      blob.size >= file.size
    ) {
      return { blob: file };
    }

    return { blob };
  } finally {
    decoded.cleanup();
  }
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const { blob } = await compressImageFileToBlob(file, options);
  return await blobToDataUrl(blob);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
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
