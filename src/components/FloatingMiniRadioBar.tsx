import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Radio, Volume2, VolumeX, X } from 'lucide-react';
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

  useEffect(() => {
    return globalRadioPlayer.subscribe((snap) => {
      setRadioSnap(snap);
    });
  }, []);

  if (dismissed || isRadioModalOpen || (!radioSnap.isPlaying && !radioSnap.autoplayBlocked)) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className={`fixed z-40 left-3 sm:left-5 ${
        isInsideRoom ? 'bottom-20' : 'bottom-16 sm:bottom-20'
      } max-w-[92vw] sm:max-w-xs bg-white/95 backdrop-blur-md border border-indigo-200 rounded-2xl px-3 py-1.5 shadow-xl flex items-center gap-2`}
    >
      <button
        type="button"
        onClick={onOpenRadioModal}
        className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
        title="فتح مكتبة الأغاني وراديو FM"
      >
        <Radio className={`w-3.5 h-3.5 ${radioSnap.isPlaying ? 'animate-pulse' : ''}`} />
      </button>

      <button
        type="button"
        onClick={onOpenRadioModal}
        className="flex-1 min-w-0 text-right cursor-pointer"
      >
        <p className="text-[11px] font-black text-slate-900 truncate">
          {radioSnap.activeTab === 'radio'
            ? radioSnap.activeStation?.name || 'إذاعة القرآن الكريم من القاهرة'
            : radioSnap.activeSong?.title || 'مكتبة الأغاني'}
        </p>
        <p className="text-[9.5px] font-bold text-indigo-600 truncate">
          {radioSnap.isPlaying
            ? 'يبث الآن • يمكنك تغيير المحطة أو القناة أو تشغيل أغنية'
            : 'يمكنك تغيير المحطة أو القناة أو تشغيل أغنية'}
        </p>
      </button>

      <button
        type="button"
        onClick={() => globalRadioPlayer.togglePlay()}
        className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shrink-0 cursor-pointer"
        title={radioSnap.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
      >
        {radioSnap.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        onClick={() => globalRadioPlayer.next()}
        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 shrink-0 cursor-pointer"
        title="التالي"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => globalRadioPlayer.toggleMute()}
        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 shrink-0 cursor-pointer"
        title={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم'}
      >
        {radioSnap.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="animate-radio-close-glow p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300/90 active:scale-95 shrink-0 cursor-pointer transition-colors"
        title="إغلاق وإخفاء شريط الراديو"
        aria-label="إغلاق وإخفاء شريط الراديو"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
