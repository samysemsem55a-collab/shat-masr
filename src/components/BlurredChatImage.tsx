import React, { useState } from 'react';
import { Image as ImageIcon, RefreshCw, Eye } from 'lucide-react';

interface BlurredChatImageProps {
  src: string;
  alt?: string;
  className?: string;
  autoReveal?: boolean;
  onOpenFull?: (src: string) => void;
}

export const BlurredChatImage: React.FC<BlurredChatImageProps> = React.memo(({
  src,
  alt = 'صورة مرسلة',
  className = 'max-h-56 w-auto max-w-full rounded-xl object-cover border border-white/20',
  autoReveal = false,
  onOpenFull,
}) => {
  const [revealed, setRevealed] = useState(autoReveal);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const handleRevealClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!revealed) {
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

  if (!revealed) {
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
    <div className="relative inline-block max-w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/35 backdrop-blur-md z-10 pointer-events-none">
          <RefreshCw className="w-5 h-5 text-white animate-spin" />
        </div>
      )}
      <img
        src={imageSrcWithRetry}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        onClick={handleRevealClick}
        className={`cursor-pointer transition-all duration-300 ${loading ? 'blur-md' : 'blur-0'} ${className}`}
      />
    </div>
  );
});

BlurredChatImage.displayName = 'BlurredChatImage';
