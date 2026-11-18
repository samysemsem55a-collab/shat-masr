import React, { useState, useEffect } from 'react';
import {
  X,
  Music,
  Radio,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Search,
  Disc3,
  Signal,
  Shuffle,
  Repeat,
  Repeat1,
  Ban,
  RefreshCw
} from 'lucide-react';
import { ARABIC_100_SONGS, ArabicSong, formatAudioDuration } from '../data/arabicSongsData';
import { ARABIC_RADIO_STATIONS, ArabicRadioStation } from '../data/arabicRadioData';
import { globalRadioPlayer, RadioPlayerSnapshot } from '../services/radioPlayer';
import { sounds } from '../utils/soundEffects';

export interface MusicRadioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost?: boolean;
  roomTitle?: string;
  activeStation?: unknown;
  isPlaying?: boolean;
  onToggleStation?: (station: unknown) => void;
}

export const MusicRadioModal: React.FC<MusicRadioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [snap, setSnap] = useState<RadioPlayerSnapshot>(() => globalRadioPlayer.getSnapshot());
  const [timeState, setTimeState] = useState<{ currentTime: number; duration: number }>(() => {
    const initial = globalRadioPlayer.getSnapshot();
    return { currentTime: initial.currentTime, duration: initial.duration };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongCategory, setSelectedSongCategory] = useState<string>('all');
  const [selectedRadioCategory, setSelectedRadioCategory] = useState<string>('all');
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const unsubCore = globalRadioPlayer.subscribe(setSnap);
    const unsubTime = globalRadioPlayer.subscribeTime(setTimeState);
    globalRadioPlayer.verifyAllStations(false);
    return () => {
      unsubCore();
      unsubTime();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const {
    activeTab,
    activeSong,
    activeStation,
    isPlaying,
    isLoading,
    volume,
    isMuted,
    playMode,
    errorMessage,
    unavailableStationIds,
    unavailableSongIds,
    songDurations,
    checkingStations
  } = snap;
  const { currentTime, duration } = timeState;

  const unavailableStationsSet = new Set(unavailableStationIds);
  const unavailableSongsSet = new Set(unavailableSongIds);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSongs = ARABIC_100_SONGS.filter((song) => {
    const matchesSearch =
      !normalizedQuery ||
      song.title.toLowerCase().includes(normalizedQuery) ||
      song.artist.toLowerCase().includes(normalizedQuery);
    if (!matchesSearch) return false;
    if (selectedSongCategory === 'all') return true;
    return song.category === selectedSongCategory;
  });

  const filteredStations = ARABIC_RADIO_STATIONS.filter((st) => {
    const matchesSearch =
      !normalizedQuery ||
      st.name.toLowerCase().includes(normalizedQuery) ||
      st.description.toLowerCase().includes(normalizedQuery);
    if (!matchesSearch) return false;
    if (selectedRadioCategory === 'all') return true;
    return st.category === selectedRadioCategory;
  });

  const songCategories = [
    { id: 'all', label: `الكل (${ARABIC_100_SONGS.length})` },
    { id: 'tarab', label: 'طرب أصيل' },
    { id: 'classic', label: 'كلاسيك مصري' },
    { id: 'levantine', label: 'فيروز وشامي' },
    { id: 'modern', label: 'معاصر وهضبة' },
    { id: 'khaleeji', label: 'روائع الخليج' },
    { id: 'maghreb', label: 'مغربي وراي' },
  ];

  const radioCategories = [
    { id: 'all', label: `جميع المحطات (${ARABIC_RADIO_STATIONS.length})` },
    { id: 'quran', label: 'القرآن الكريم' },
    { id: 'tarab', label: 'طرب زمان' },
    { id: 'egypt', label: 'إذاعات مصرية' },
    { id: 'fairuz', label: 'فيروزيات' },
    { id: 'hits', label: 'أغاني ومنوعات' },
    { id: 'classic', label: 'تقاسيم وعود' },
  ];

  const handleSelectSong = (song: ArabicSong) => {
    if (unavailableSongsSet.has(song.id)) return;
    sounds.playCoinsReward();
    globalRadioPlayer.selectSong(song);
  };

  const handleSelectStation = (station: ArabicRadioStation) => {
    if (unavailableStationsSet.has(station.id)) return;
    sounds.playCoinsReward();
    globalRadioPlayer.selectStation(station);
  };

  const currentSongUnavailable = activeTab === 'songs' && unavailableSongsSet.has(activeSong.id);
  const currentStationUnavailable = activeTab === 'radio' && unavailableStationsSet.has(activeStation.id);
  const isCurrentPlayDisabled = isLoading || currentSongUnavailable || currentStationUnavailable;

  const activeSongTotalSeconds =
    duration > 0
      ? duration
      : songDurations[activeSong.id] || activeSong.durationSeconds || 0;

  const nowPlayingTitle = activeTab === 'songs' ? activeSong.title : activeStation.name;
  const nowPlayingSubtitle =
    activeTab === 'songs'
      ? `${activeSong.artist} • ${activeSong.categoryLabel}`
      : `${activeStation.categoryLabel} • ${activeStation.description}`;

  const showSongCoverImg =
    activeTab === 'songs' &&
    Boolean(activeSong.coverImage) &&
    !failedCovers[activeSong.id];

  return (
    <div
      dir="rtl"
      lang="ar"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/55 backdrop-blur-sm text-right overflow-x-hidden"
    >
      <div
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-slate-100 text-right"
      >
        {/* Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-l from-indigo-600 via-purple-600 to-amber-500 text-white flex items-center justify-between gap-2 shrink-0 overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
              <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden text-right">
              <h3 className="text-sm sm:text-base font-black text-white whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">
                مشغل المكتبة الموسيقية وراديو FM
              </h3>
              <p className="text-xs text-white/90 font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">
                يستمر التشغيل في الشريط السفلي عند التنقل داخل التطبيق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            title="تصغير إلى الشريط السفلي"
            aria-label="تصغير إلى الشريط السفلي"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two Primary Tabs */}
        <div className="grid grid-cols-2 p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              globalRadioPlayer.setTab('radio');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer overflow-hidden ${
              activeTab === 'radio'
                ? 'bg-gradient-to-l from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Radio className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              محطات الراديو المباشرة (FM)
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              globalRadioPlayer.setTab('songs');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer overflow-hidden ${
              activeTab === 'songs'
                ? 'bg-gradient-to-l from-indigo-600 to-purple-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              مكتبة الأغاني 100
            </span>
          </button>
        </div>

        {/* Now Playing Card — Strict CSS Grid (80px 1fr 60px) */}
        <div className="p-3 bg-gradient-to-l from-indigo-50 via-white to-amber-50 dark:from-slate-800/90 dark:via-slate-900 dark:to-slate-800/90 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="grid grid-cols-[80px_1fr_60px] gap-3 items-center p-3 min-h-[100px] overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            {/* Col 1: Cover 80x80 */}
            <div
              className={`w-20 h-20 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-3xl border border-slate-200 dark:border-slate-600 ${
                activeTab === 'radio'
                  ? `bg-gradient-to-br ${activeStation.color} text-white`
                  : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
              }`}
            >
              {showSongCoverImg ? (
                <img
                  src={activeSong.coverImage}
                  alt={activeSong.title}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedCovers((prev) => ({ ...prev, [activeSong.id]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{activeTab === 'radio' ? activeStation.icon : '🎵'}</span>
              )}
            </div>

            {/* Col 2: Text Container (min-w-0 overflow-hidden, zero overlap, zero clipping) */}
            <div className="min-w-0 overflow-hidden text-right">
              <div className="whitespace-nowrap overflow-hidden text-ellipsis text-[16px] leading-[1.4] font-black text-slate-900 dark:text-white">
                {nowPlayingTitle}
              </div>
              <div className="whitespace-nowrap overflow-hidden text-ellipsis text-[13px] leading-[1.4] font-semibold text-[#666] dark:text-slate-300 mt-1">
                {nowPlayingSubtitle}
              </div>
              {isPlaying && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span>{activeTab === 'songs' ? 'يعمل الآن' : 'بث مباشر الآن'}</span>
                </div>
              )}
              {errorMessage && (
                <div className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Col 3: Play Button 56x56 inside 60px column */}
            <div className="w-[60px] flex items-center justify-center shrink-0">
              <button
                type="button"
                onClick={() => globalRadioPlayer.togglePlay()}
                disabled={isCurrentPlayDisabled}
                className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPlaying
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isLoading ? (
                  <Disc3 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white" />
                )}
              </button>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex justify-center items-center gap-4 mt-3 flex-nowrap overflow-hidden">
            <button
              type="button"
              onClick={() => globalRadioPlayer.prev()}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
              title="السابق"
              aria-label="السابق"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => globalRadioPlayer.next()}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
              title="التالي"
              aria-label="التالي"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {activeTab === 'songs' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    globalRadioPlayer.setPlayMode(playMode === 'shuffle' ? 'sequential' : 'shuffle');
                    sounds.playCoinsReward();
                  }}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer ${
                    playMode === 'shuffle'
                      ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title="تشغيل عشوائي"
                  aria-label="تشغيل عشوائي"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    globalRadioPlayer.setPlayMode(playMode === 'repeat_one' ? 'sequential' : 'repeat_one');
                    sounds.playCoinsReward();
                  }}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer ${
                    playMode === 'repeat_one'
                      ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title="تكرار الأغنية"
                  aria-label="تكرار الأغنية"
                >
                  {playMode === 'repeat_one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => globalRadioPlayer.toggleMute()}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
              title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              )}
            </button>
          </div>

          {/* Progress Bar (Songs) & Volume Slider */}
          <div className="mt-3 space-y-2">
            {activeTab === 'songs' && (
              <div dir="ltr" className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-mono">
                <span className="w-12 text-left shrink-0">{formatAudioDuration(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, activeSongTotalSeconds)}
                  value={Math.min(currentTime, Math.max(1, activeSongTotalSeconds))}
                  onChange={(e) => globalRadioPlayer.seek(parseFloat(e.target.value))}
                  className="flex-1 min-w-0 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  aria-label="شريط تقدم الأغنية"
                />
                <span className="w-14 text-right shrink-0">{formatAudioDuration(activeSongTotalSeconds)}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <input
                  dir="ltr"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => globalRadioPlayer.setVolume(parseFloat(e.target.value))}
                  className="flex-1 min-w-0 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  aria-label="مستوى الصوت"
                />
              </div>

              {activeTab === 'radio' && (
                <button
                  type="button"
                  onClick={() => globalRadioPlayer.verifyAllStations(true)}
                  disabled={checkingStations}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingStations ? 'animate-spin' : ''}`} />
                  <span>{checkingStations ? 'جارٍ فحص القنوات...' : 'فحص القنوات'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search & Categories (No position: absolute anywhere) */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2 shrink-0">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'songs'
                  ? 'ابحث عن أغنية أو فنان (أم كلثوم، فيروز، حليم، عمرو دياب...)'
                  : 'ابحث عن محطة راديو (قرآن، طرب، مصر، فيروز...)'
              }
              className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-right"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs font-bold">
            {(activeTab === 'songs' ? songCategories : radioCategories).map((c) => {
              const isSelected =
                activeTab === 'songs' ? selectedSongCategory === c.id : selectedRadioCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (activeTab === 'songs') setSelectedSongCategory(c.id);
                    else setSelectedRadioCategory(c.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-black shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Vertical List (Single column for 360px safety) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
          {activeTab === 'radio' && (
            <div className="space-y-2">
              {filteredStations.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                  لا توجد محطات مطابقة للبحث
                </div>
              ) : (
                filteredStations.map((station) => {
                  const isCurrentStation = activeStation.id === station.id;
                  const isCurrentPlaying = isCurrentStation && isPlaying;
                  const isUnavailable = unavailableStationsSet.has(station.id);

                  return (
                    <div
                      key={station.id}
                      onClick={() => !isUnavailable && handleSelectStation(station)}
                      className={`flex items-center gap-2.5 p-3 min-h-[64px] w-full rounded-2xl border overflow-hidden transition-colors ${
                        isUnavailable
                          ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                          : isCurrentStation
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 cursor-pointer shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-lg border ${
                          isUnavailable
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                            : isCurrentPlaying
                            ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white border-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {station.icon}
                      </div>

                      <div className="flex-1 min-w-0 overflow-hidden text-right">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <span className="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">
                            {station.name}
                          </span>
                          <span className="text-xs shrink-0">{station.countryFlag}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden mt-0.5">
                          {isUnavailable ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black shrink-0">
                              غير متاحة
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5 shrink-0">
                              <Signal className="w-3 h-3" /> {station.categoryLabel}
                            </span>
                          )}
                          <span className="text-xs text-[#666] dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                            {station.description}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isUnavailable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isUnavailable) return;
                          if (isCurrentStation) globalRadioPlayer.togglePlay();
                          else handleSelectStation(station);
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isUnavailable
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : isCurrentPlaying
                            ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                            : 'bg-amber-500 hover:bg-amber-400 text-white cursor-pointer'
                        }`}
                        title={
                          isUnavailable
                            ? 'غير متاحة'
                            : isCurrentPlaying
                            ? 'إيقاف مؤقت'
                            : 'تشغيل القناة'
                        }
                        aria-label={isUnavailable ? 'غير متاحة' : 'تشغيل القناة'}
                      >
                        {isUnavailable ? (
                          <Ban className="w-4 h-4" />
                        ) : isCurrentPlaying ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'songs' && (
            <div className="space-y-2">
              {filteredSongs.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                  لا توجد أغاني مطابقة للبحث
                </div>
              ) : (
                filteredSongs.map((song, idx) => {
                  const isThisSelected = activeSong.id === song.id;
                  const isThisPlaying = isThisSelected && isPlaying;
                  const isUnavailable = unavailableSongsSet.has(song.id);
                  const realDur = songDurations[song.id] || song.durationSeconds;
                  const formattedDur = formatAudioDuration(realDur);
                  const showRowCover = Boolean(song.coverImage) && !failedCovers[song.id];

                  return (
                    <div
                      key={song.id}
                      onClick={() => !isUnavailable && handleSelectSong(song)}
                      className={`flex items-center gap-2.5 p-3 min-h-[64px] w-full rounded-2xl border overflow-hidden transition-colors ${
                        isUnavailable
                          ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                          : isThisSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 cursor-pointer shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                        {showRowCover ? (
                          <img
                            src={song.coverImage}
                            alt={song.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedCovers((prev) => ({ ...prev, [song.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 overflow-hidden text-right">
                        <div className="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">
                          {song.title}
                        </div>
                        <div className="text-xs text-[#666] dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4] mt-0.5">
                          {song.artist} •{' '}
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {song.categoryLabel}
                          </span>
                        </div>
                      </div>

                      {isUnavailable ? (
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black shrink-0">
                          غير متاحة
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          {formattedDur}
                        </span>
                      )}

                      <button
                        type="button"
                        disabled={isUnavailable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isUnavailable) return;
                          if (isThisSelected) globalRadioPlayer.togglePlay();
                          else handleSelectSong(song);
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isUnavailable
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : isThisPlaying
                            ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 cursor-pointer'
                        }`}
                        title={
                          isUnavailable
                            ? 'غير متاحة'
                            : isThisPlaying
                            ? 'إيقاف مؤقت'
                            : 'تشغيل الأغنية'
                        }
                        aria-label={isUnavailable ? 'غير متاحة' : 'تشغيل الأغنية'}
                      >
                        {isUnavailable ? (
                          <Ban className="w-4 h-4" />
                        ) : isThisPlaying ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ArabicMusicPlayerModal = MusicRadioModal;
