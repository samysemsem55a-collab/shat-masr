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
  const [hasDelayElapsed, setHasDelayElapsed] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const prevPlayingRef = useRef<boolean>(radioSnap.isPlaying);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasDelayElapsed(true);
    }, 60000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return globalRadioPlayer.subscribe((snap) => {
      setRadioSnap(snap);
      if (snap.isPlaying && !prevPlayingRef.current) {
        setDismissed(false);
      }
      prevPlayingRef.current = snap.isPlaying;
    });
  }, []);

  // Keep the radio bar safely above the bottom navigation bar AND above the virtual keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updatePosition = () => {
      const obscuredHeight = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      setKeyboardOffset(obscuredHeight > 40 ? obscuredHeight : 0);
    };
    updatePosition();
    vv.addEventListener('resize', updatePosition);
    vv.addEventListener('scroll', updatePosition);
    return () => {
      vv.removeEventListener('resize', updatePosition);
      vv.removeEventListener('scroll', updatePosition);
    };
  }, []);

  if (dismissed || isRadioModalOpen || (!hasDelayElapsed && !radioSnap.isPlaying)) {
    return null;
  }

  const isSongs = radioSnap.activeTab === 'songs';
  const quranStation =
    ARABIC_RADIO_STATIONS.find((s) => s.id === 'radio_quran_cairo') || ARABIC_RADIO_STATIONS[0];

  const isQuranActive =
    !isSongs &&
    (radioSnap.activeStation?.id === 'radio_quran_cairo' ||
      radioSnap.activeStation?.name?.includes('القرآن'));

  const playingIndicatorText = radioSnap.errorMessage
    ? radioSnap.errorMessage
    : radioSnap.isPlaying
    ? isSongs
      ? `الآن يلعب: أغاني • ${radioSnap.activeSong?.title || 'أغاني عربية'}`
      : isQuranActive
      ? 'الآن يلعب: إذاعة القرآن الكريم'
      : `الآن يلعب: ${radioSnap.activeStation?.name || 'إذاعة القرآن الكريم'}`
    : 'جاهز للتشغيل • اختر قرآن كريم أو أغاني';

  const handlePlayQuran = () => {
    setDismissed(false);
    globalRadioPlayer.selectStation(quranStation);
  };

  const handlePlaySongs = () => {
    setDismissed(false);
    globalRadioPlayer.selectSong(radioSnap.activeSong || ARABIC_100_SONGS[0]);
  };

  const baseBottomPx = isInsideRoom ? 76 : 68;
  const computedBottomExpr =
    keyboardOffset > 0
      ? `${keyboardOffset + 8}px`
      : `calc(${baseBottomPx}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      dir="rtl"
      lang="ar"
      style={{ bottom: computedBottomExpr }}
      className="radio-gentle-bob fixed z-[49] left-2 right-2 sm:left-4 sm:right-auto sm:w-[440px] max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl px-2.5 py-2 shadow-lg flex flex-col gap-1.5 text-right transition-colors"
    >
      {/* Top Line: Full Unclipped Title + Close X */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenRadioModal}
          className="flex-1 min-w-0 text-right cursor-pointer"
          title="فتح مشغل الراديو والمكتبة الموسيقية"
        >
          <p className="text-[11.5px] sm:text-xs font-black text-slate-900 dark:text-white leading-snug break-words flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>راديو شات مصر - قرآن كريم | أغاني</span>
          </p>
          <p
            className={`text-[10.5px] font-semibold leading-snug truncate ${
              radioSnap.errorMessage
                ? 'text-rose-600 dark:text-rose-400'
                : radioSnap.isPlaying
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            {playingIndicatorText}
          </p>
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

      {/* Expandable Inline Volume Slider */}
      {showVolumeSlider && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => globalRadioPlayer.toggleMute()}
            className="text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer"
            title={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
          >
            {radioSnap.isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={radioSnap.isMuted ? 0 : radioSnap.volume}
            onChange={(e) => globalRadioPlayer.setVolume(parseFloat(e.target.value))}
            aria-label="مستوى صوت الراديو"
            className="w-full h-1.5 accent-[#0066FF] cursor-pointer"
          />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums w-8 text-left shrink-0">
            {Math.round((radioSnap.isMuted ? 0 : radioSnap.volume) * 100)}%
          </span>
        </div>
      )}

      {/* Bottom Action Strip: [ قرآن كريم ] [ أغاني ] [ تشغيل / إيقاف ] + [ 🔊 ] */}
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          onClick={handlePlayQuran}
          className={`flex-1 basis-0 min-w-0 h-[32px] rounded-xl px-1.5 text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 border cursor-pointer transition ${
            !isSongs && radioSnap.isPlaying
              ? 'bg-[#E6F4EA] text-[#1A6B3C] border-[#B7DFC5]'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
        >
          <Radio className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">قرآن كريم</span>
        </button>

        <button
          type="button"
          onClick={handlePlaySongs}
          className={`flex-1 basis-0 min-w-0 h-[32px] rounded-xl px-1.5 text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 border cursor-pointer transition ${
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
          className={`flex-[1.2] basis-0 min-w-0 h-[32px] rounded-xl px-2 text-[11.5px] font-black whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer transition shadow-xs ${
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

        <button
          type="button"
          onClick={() => setShowVolumeSlider((prev) => !prev)}
          onDoubleClick={() => globalRadioPlayer.toggleMute()}
          className={`w-8 h-[32px] rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition ${
            showVolumeSlider
              ? 'bg-[#E6F0FF] text-[#0066FF] border-[#B8D4FF]'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
          title="التحكم في مستوى الصوت"
          aria-label="التحكم في مستوى الصوت"
        >
          {radioSnap.isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-500" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
});
