/**
 * Direct client-side image download utility (no window.open / popup).
 * Supports data: URLs, blob: URLs, and CORS-enabled remote image URLs (Firebase Storage, etc.).
 */
export async function downloadImageToDevice(
  url: string,
  preferredFilename?: string
): Promise<boolean> {
  if (!url || typeof document === 'undefined') return false;

  const cleanName = (() => {
    if (preferredFilename && preferredFilename.trim()) {
      return preferredFilename.trim();
    }
    return `shat_masr_${Date.now()}.jpg`;
  })();

  const triggerAnchorDownload = (href: string, name: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    triggerAnchorDownload(url, cleanName);
    return true;
  }

  // Try fetch -> Blob -> ObjectURL for guaranteed direct device save across origins
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const blob = await response.blob();
    const ext =
      blob.type === 'image/png'
        ? 'png'
        : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/gif'
        ? 'gif'
        : 'jpg';
    const finalName = cleanName.includes('.') ? cleanName : `${cleanName}.${ext}`;
    const objectUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objectUrl, finalName);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 4000);
    return true;
  } catch {
    // Canvas CORS fallback
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        triggerAnchorDownload(objectUrl, cleanName);
        setTimeout(() => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {}
        }, 4000);
        return true;
      }
    } catch {}
  }

  // Final fallback: anchor download attribute
  triggerAnchorDownload(url, cleanName);
  return true;
}
