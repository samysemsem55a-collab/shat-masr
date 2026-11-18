import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Radio, Music, Volume2, VolumeX, X } from 'lucide-react';
import { globalRadioPlayer, RadioPlayerSnapshot } from '../services/radioPlayer';

interface FloatingMiniRadioBarProps {
  isInsideRoom: boolean;
  isRadioModalOpen: boolean;
  onOpenRadioModal: () => void;
}

export const FloatingMiniRadioBar: React.FC<FloatingMiniRadioBarProps> = React.memo(({
  isInsideRoom,
  isRadioModalOpen,
  onOpenRadioModal,
}) => {
  const [radioSnap, setRadioSnap] = useState<RadioPlayerSnapshot>(() => globalRadioPlayer.getSnapshot());
  const [dismissed, setDismissed] = useState(false);
  const prevTrackKeyRef = useRef<string>('');

  useEffect(() => {
    return globalRadioPlayer.subscribe((snap) => {
      setRadioSnap(snap);
      const trackKey = `${snap.activeTab}:${snap.activeTab === 'radio' ? snap.activeStation?.id : snap.activeSong?.id}:${snap.isPlaying}`;
      if (snap.isPlaying && trackKey !== prevTrackKeyRef.current) {
        setDismissed(false);
      }
      prevTrackKeyRef.current = trackKey;
    });
  }, []);

  if (dismissed || isRadioModalOpen || (!radioSnap.isPlaying && !radioSnap.autoplayBlocked)) {
    return null;
  }

  const isSongs = radioSnap.activeTab === 'songs';
  const primaryLabel = isSongs
    ? radioSnap.activeSong?.title || 'مكتبة الأغاني'
    : radioSnap.activeStation?.name || 'إذاعة القرآن الكريم من القاهرة';
  const secondaryLabel = radioSnap.errorMessage
    ? radioSnap.errorMessage
    : isSongs
    ? `${radioSnap.activeSong?.artist || ''} • ${radioSnap.isPlaying ? 'يعمل الآن' : 'متوقف مؤقتاً'}`
    : radioSnap.isPlaying
    ? 'بث مباشر الآن • اضغط للعودة للمشغل'
    : 'بث FM جاهز للتشغيل';

  return (
    <div
      dir="rtl"
      lang="ar"
      className={`fixed z-[50] left-3 right-3 sm:right-auto sm:left-5 ${
        isInsideRoom ? 'bottom-20' : 'bottom-16 sm:bottom-20'
      } sm:w-80 max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-200 dark:border-slate-700 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-2 text-right overflow-hidden`}
    >
      <button
        type="button"
        onClick={onOpenRadioModal}
        className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
        title="فتح مشغل المكتبة الموسيقية وراديو FM"
      >
        {isSongs ? (
          <Music className={`w-4 h-4 ${radioSnap.isPlaying ? 'animate-pulse' : ''}`} />
        ) : (
          <Radio className={`w-4 h-4 ${radioSnap.isPlaying ? 'animate-pulse' : ''}`} />
        )}
      </button>

      <button
        type="button"
        onClick={onOpenRadioModal}
        className="flex-1 min-w-0 overflow-hidden text-right cursor-pointer"
      >
        <p className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">
          {primaryLabel}
        </p>
        <p
          className={`text-[11px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4] ${
            radioSnap.errorMessage
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-[#666] dark:text-slate-300'
          }`}
        >
          {secondaryLabel}
        </p>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => globalRadioPlayer.togglePlay()}
          className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 cursor-pointer"
          title={radioSnap.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {radioSnap.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => globalRadioPlayer.next()}
          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
          title="التالي"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => globalRadioPlayer.toggleMute()}
          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
          title={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم'}
        >
          {radioSnap.isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            globalRadioPlayer.pause();
            setDismissed(true);
          }}
          className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          title="إغلاق وإيقاف المشغل"
          aria-label="إغلاق وإيقاف المشغل"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
