import React, { useState } from 'react';
import { Image as ImageIcon, RefreshCw, Eye, Download, Loader2 } from 'lucide-react';
import { downloadImageToDevice } from '../utils/downloadImage';
import { toast } from '../utils/appToast';

interface BlurredChatImageProps {
  src: string;
  alt?: string;
  className?: string;
  autoReveal?: boolean;
  uploadProgress?: number;
  downloadFilename?: string;
  onOpenFull?: (src: string) => void;
}

export const BlurredChatImage: React.FC<BlurredChatImageProps> = React.memo(({
  src,
  alt = 'صورة مرسلة',
  className = 'max-h-56 w-auto max-w-full rounded-xl object-cover border border-white/20',
  autoReveal = false,
  uploadProgress,
  downloadFilename,
  onOpenFull,
}) => {
  const isActivelyUploading = typeof uploadProgress === 'number' && uploadProgress < 100;
  const shouldInitialReveal = autoReveal || isActivelyUploading || src.startsWith('blob:');
  const [revealed, setRevealed] = useState(shouldInitialReveal);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const isRevealed = revealed || isActivelyUploading || src.startsWith('blob:');

  const handleRevealClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActivelyUploading) return;
    if (!isRevealed) {
      setHasError(false);
      setLoading(true);
      setRevealed(true);
    } else if (!hasError && onOpenFull) {
      onOpenFull(src);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setLoading(true);
    setRetrySeed((prev) => prev + 1);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src || isDownloading || isActivelyUploading) return;
    setIsDownloading(true);
    try {
      await downloadImageToDevice(src, downloadFilename);
      toast.success('تم حفظ الصورة على جهازك 📥');
    } catch {
      toast.error('تعذر تحميل الصورة');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isRevealed) {
    return (
      <button
        type="button"
        onClick={handleRevealClick}
        className={`relative overflow-hidden group flex flex-col items-center justify-center min-w-[180px] min-h-[120px] rounded-xl border border-slate-300/60 dark:border-slate-600/60 bg-gradient-to-br from-slate-200 via-sky-100/80 to-slate-300 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 cursor-pointer focus:outline-none ${className}`}
        title="اضغط لتحميل وعرض الصورة"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.45),transparent_60%),radial-gradient(circle_at_75%_70%,rgba(99,102,241,0.35),transparent_55%)] blur-xl scale-125 pointer-events-none"
        />
        <div className="relative z-10 flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/55 backdrop-blur-md text-white shadow-sm group-hover:bg-slate-900/70 transition-colors">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Eye className="w-3.5 h-3.5 text-sky-300" />
            <span>اضغط لعرض الصورة</span>
          </div>
          <span className="text-[10px] text-slate-200/90 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            معاينة موفرة للبيانات
          </span>
        </div>
      </button>
    );
  }

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 min-w-[180px] min-h-[110px] px-4 py-3 rounded-xl border border-rose-300/60 bg-rose-50/90 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 ${className}`}
      >
        <span className="text-xs font-bold">تعذر تحميل الصورة</span>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>إعادة المحاولة</span>
        </button>
      </div>
    );
  }

  const imageSrcWithRetry =
    retrySeed > 0 && !src.startsWith('data:') && !src.startsWith('blob:')
      ? `${src}${src.includes('?') ? '&' : '?'}r=${retrySeed}`
      : src;

  return (
    <div className="relative inline-block max-w-full group">
      {loading && !isActivelyUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/35 backdrop-blur-md z-10 pointer-events-none">
          <RefreshCw className="w-5 h-5 text-white animate-spin" />
        </div>
      )}

      {isActivelyUploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-950/45 backdrop-blur-[2px] z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-black shadow-md tabular-nums">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300" />
            <span>{Math.max(1, Math.min(99, Math.round(uploadProgress || 0)))}%</span>
          </div>
          <div className="w-24 h-1.5 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-150"
              style={{ width: `${Math.max(6, Math.min(100, uploadProgress || 0))}%` }}
            />
          </div>
        </div>
      )}

      {!isActivelyUploading && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          title="حفظ الصورة على الجهاز"
          aria-label="حفظ الصورة على الجهاز"
          className="absolute bottom-2 left-2 z-10 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-md active:scale-90 transition cursor-pointer disabled:opacity-60"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      )}

      <img
        src={imageSrcWithRetry}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          if (!isActivelyUploading) {
            setHasError(true);
          }
        }}
        onClick={handleRevealClick}
        className={`cursor-pointer transition-all duration-300 ${loading && !isActivelyUploading ? 'blur-md' : 'blur-0'} ${className}`}
      />
    </div>
  );
});

BlurredChatImage.displayName = 'BlurredChatImage';
