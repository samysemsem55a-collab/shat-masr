import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Radio, Music, Volume2, VolumeX, X } from 'lucide-react';
import { globalRadioPlayer, RadioPlayerSnapshot } from '../services/radioPlayer';
import { ARABIC_RADIO_STATIONS } from '../data/arabicRadioData';
import { ARABIC_100_SONGS } from '../data/arabicSongsData';

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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const prevPlayingRef = useRef<boolean>(radioSnap.isPlaying);

  useEffect(() => {
    return globalRadioPlayer.subscribe((snap) => {
      setRadioSnap(snap);
      if (snap.isPlaying && !prevPlayingRef.current) {
        setDismissed(false);
      }
      prevPlayingRef.current = snap.isPlaying;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const checkKeyboard = () => {
      const ratio = vv.height / Math.max(1, window.innerHeight);
      setIsKeyboardOpen(ratio < 0.72);
    };
    checkKeyboard();
    vv.addEventListener('resize', checkKeyboard);
    return () => vv.removeEventListener('resize', checkKeyboard);
  }, []);

  if (dismissed || isRadioModalOpen || isKeyboardOpen) {
    return null;
  }

  const isSongs = radioSnap.activeTab === 'songs';
  const quranStation =
    ARABIC_RADIO_STATIONS.find((s) => s.id === 'radio_quran_cairo') || ARABIC_RADIO_STATIONS[0];

  const activeTitle = isSongs
    ? radioSnap.activeSong?.title || 'مكتبة الأغاني العربية'
    : radioSnap.activeStation?.name || 'إذاعة القرآن الكريم من القاهرة';

  const handlePlayQuran = () => {
    setDismissed(false);
    globalRadioPlayer.selectStation(quranStation);
  };

  const handlePlaySongs = () => {
    setDismissed(false);
    globalRadioPlayer.selectSong(radioSnap.activeSong || ARABIC_100_SONGS[0]);
  };

  return (
    <div
      dir="rtl"
      lang="ar"
      className={`fixed z-[49] left-2 right-2 sm:left-4 sm:right-auto sm:w-[400px] max-w-full ${
        isInsideRoom ? 'bottom-[68px]' : 'bottom-[60px]'
      } bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl px-2.5 py-2 shadow-lg flex flex-col gap-1.5 text-right overflow-hidden transition-colors`}
    >
      {/* Top Line: Full Title + Volume + Close X */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenRadioModal}
          className="flex-1 min-w-0 text-right cursor-pointer overflow-hidden"
          title="فتح مشغل الراديو والمكتبة الموسيقية"
        >
          <p className="text-[11.5px] font-black text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis leading-[1.35]">
            📻 راديو شات مصر - قرآن كريم | أغاني
          </p>
          <p
            className={`text-[10.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-[1.35] ${
              radioSnap.errorMessage
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            {radioSnap.errorMessage
              ? radioSnap.errorMessage
              : radioSnap.isPlaying
              ? `يعمل الآن: ${activeTitle}`
              : `جاهز للتشغيل • ${activeTitle}`}
          </p>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => globalRadioPlayer.toggleMute()}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
            title={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
            aria-label={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
          >
            {radioSnap.isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              globalRadioPlayer.pause();
              setDismissed(true);
            }}
            className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0 cursor-pointer"
            title="إغلاق شريط الراديو"
            aria-label="إغلاق شريط الراديو"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Action Strip: [ قرآن كريم ] [ أغاني ] [ تشغيل / إيقاف ] */}
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          onClick={handlePlayQuran}
          className={`flex-1 basis-0 min-w-0 h-[30px] rounded-xl px-2 text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 border cursor-pointer transition ${
            !isSongs && radioSnap.isPlaying
              ? 'bg-[#E6F4EA] text-[#1A6B3C] border-[#B7DFC5]'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
        >
          <Radio className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">قرآن كريم</span>
        </button>

        <button
          type="button"
          onClick={handlePlaySongs}
          className={`flex-1 basis-0 min-w-0 h-[30px] rounded-xl px-2 text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 border cursor-pointer transition ${
            isSongs && radioSnap.isPlaying
              ? 'bg-[#F0EBFF] text-[#4C2A9E] border-[#DDD0FF]'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
        >
          <Music className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">أغاني</span>
        </button>

        <button
          type="button"
          onClick={() => globalRadioPlayer.togglePlay()}
          className={`flex-1 basis-0 min-w-0 h-[30px] rounded-xl px-2 text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer transition ${
            radioSnap.isPlaying
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-[#0066FF] hover:bg-blue-600 text-white'
          }`}
        >
          {radioSnap.isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 shrink-0" />
              <span>إيقاف</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span>تشغيل</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
