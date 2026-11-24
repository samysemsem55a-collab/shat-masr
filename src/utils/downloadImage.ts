export async function downloadImageToDevice(
  imageUrl: string,
  filename?: string
): Promise<void> {
  if (!imageUrl || typeof document === 'undefined') {
    throw new Error('Invalid image URL');
  }

  const triggerDownload = (href: string, targetName: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = targetName;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inferExtension = (mime?: string): string => {
    if (!mime) return 'jpg';
    const lower = mime.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('gif')) return 'gif';
    if (lower.includes('svg')) return 'svg';
    return 'jpg';
  };

  const resolveFilename = (mime?: string): string => {
    if (filename && filename.trim()) return filename.trim();
    const ext = inferExtension(mime);
    return `chat_photo_${Date.now()}.${ext}`;
  };

  if (imageUrl.startsWith('data:')) {
    const mimeMatch = imageUrl.match(/^data:([^;]+);/i);
    triggerDownload(imageUrl, resolveFilename(mimeMatch?.[1]));
    return;
  }

  if (imageUrl.startsWith('blob:')) {
    triggerDownload(imageUrl, resolveFilename());
    return;
  }

  // Remote URL (e.g. Firebase Storage): fetch as Blob so mobile & desktop browsers save to device directly
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerDownload(objectUrl, resolveFilename(blob.type));
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
    return;
  } catch {
    // Fallback: draw onto canvas if CORS headers allow image element
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('No canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (result) => {
                if (result) resolve(result);
                else reject(new Error('Canvas toBlob failed'));
              },
              'image/jpeg',
              0.92
            );
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = imageUrl;
      });

      const objectUrl = URL.createObjectURL(blob);
      try {
        triggerDownload(objectUrl, resolveFilename(blob.type));
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      }
      return;
    } catch {
      // Final fallback without window.open
      triggerDownload(imageUrl, resolveFilename());
    }
  }
}
