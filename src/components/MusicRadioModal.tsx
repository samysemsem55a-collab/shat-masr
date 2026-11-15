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
  Sparkles,
  Disc3,
  Signal,
  Shuffle,
  Repeat,
  Repeat1
} from 'lucide-react';
import { ARABIC_100_SONGS, ArabicSong } from '../data/arabicSongsData';
import { ARABIC_RADIO_STATIONS, ArabicRadioStation } from '../data/arabicRadioData';
import { globalRadioPlayer, RadioPlayerSnapshot } from '../services/radioPlayer';
import { sounds } from '../utils/soundEffects';

export interface MusicRadioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost?: boolean;
  roomTitle?: string;
  activeStation?: any;
  isPlaying?: boolean;
  onToggleStation?: (station: any) => void;
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

  useEffect(() => {
    if (!isOpen) return;
    const unsubCore = globalRadioPlayer.subscribe(setSnap);
    const unsubTime = globalRadioPlayer.subscribeTime(setTimeState);
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
    playMode
  } = snap;
  const { currentTime, duration } = timeState;

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredSongs = ARABIC_100_SONGS.filter(song => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedSongCategory === 'all') return true;
    return song.category === selectedSongCategory;
  });

  const filteredStations = ARABIC_RADIO_STATIONS.filter(st => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedRadioCategory === 'all') return true;
    return st.category === selectedRadioCategory;
  });

  const songCategories = [
    { id: 'all', label: 'الكل (100 أغنية)' },
    { id: 'tarab', label: 'طرب أصيل' },
    { id: 'classic', label: 'كلاسيك مصري' },
    { id: 'modern', label: 'معاصر وهضبة' },
    { id: 'khaleeji', label: 'روائع الخليج' },
    { id: 'levantine', label: 'فيروزيات وشامي' },
    { id: 'maghreb', label: 'مغربي وراي' },
    { id: 'shaabi', label: 'شعبي مصري' },
  ];

  const radioCategories = [
    { id: 'all', label: 'جميع المحطات (12 محطة)' },
    { id: 'tarab', label: 'طرب زمان' },
    { id: 'egypt', label: 'تسعينات ومصر' },
    { id: 'fairuz', label: 'فيروز والصباح' },
    { id: 'hits', label: 'روتانا ومنوعات' },
    { id: 'classic', label: 'شرقيات وعود' },
    { id: 'quran', label: 'القرآن الكريم' },
  ];

  const handleSelectSong = (song: ArabicSong) => {
    sounds.playCoinsReward();
    globalRadioPlayer.selectSong(song);
  };

  const handleSelectStation = (station: ArabicRadioStation) => {
    sounds.playCoinsReward();
    globalRadioPlayer.selectStation(station);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900 animate-in fade-in zoom-in-95"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-l from-indigo-600 via-purple-600 to-amber-500 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-sm">
              <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <span>مشغل ومكتبة الموسيقى وراديو FM</span>
                <Sparkles className="w-4 h-4 text-amber-200" />
              </h3>
              <p className="text-[11px] text-white/90 font-medium">
                يستمر التشغيل في الخلفية تلقائياً أثناء الدردشة والتصفح 🎶
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="تصغير واستمرار التشغيل"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { globalRadioPlayer.setTab('radio'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'radio'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>محطات الراديو المباشرة (FM)</span>
            {isPlaying && activeTab === 'radio' && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>}
          </button>

          <button
            type="button"
            onClick={() => { globalRadioPlayer.setTab('songs'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'songs'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>مكتبة الأغاني الـ 100</span>
          </button>
        </div>

        {/* Active Player Deck */}
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-white to-amber-50 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0 shadow-sm ${
                isPlaying
                  ? 'bg-gradient-to-tr from-indigo-100 to-amber-100 border-indigo-300 text-indigo-700'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                {activeTab === 'songs' ? '🎵' : activeStation.icon}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    {activeTab === 'songs' ? activeSong.title : activeStation.name}
                  </h4>
                  {isPlaying && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-black flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{activeTab === 'songs' ? 'يعمل الآن' : 'بث FM حي'}</span>
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-indigo-600 truncate mt-0.5 font-semibold">
                  {activeTab === 'songs'
                    ? `${activeSong.artist} • ${activeSong.categoryLabel}`
                    : activeStation.description}
                </p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => globalRadioPlayer.prev()}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer"
                title="السابق"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => globalRadioPlayer.next()}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer"
                title="التالي"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              {activeTab === 'songs' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      globalRadioPlayer.setPlayMode(playMode === 'shuffle' ? 'sequential' : 'shuffle');
                      sounds.playCoinsReward();
                    }}
                    className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                      playMode === 'shuffle'
                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                    title="عشوائي"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      globalRadioPlayer.setPlayMode(playMode === 'repeat_one' ? 'sequential' : 'repeat_one');
                      sounds.playCoinsReward();
                    }}
                    className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                      playMode === 'repeat_one'
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                    title="تكرار"
                  >
                    {playMode === 'repeat_one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => globalRadioPlayer.togglePlay()}
                disabled={isLoading}
                className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isLoading ? (
                  <Disc3 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>{isLoading ? 'تحميل...' : isPlaying ? 'إيقاف' : 'تشغيل'}</span>
              </button>

              <button
                type="button"
                onClick={() => globalRadioPlayer.toggleMute()}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer"
                title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
              </button>
            </div>
          </div>

          {/* Volume + Timeline Seek Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-500 font-mono">
            {activeTab === 'songs' && (
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <span>{formatSeconds(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || activeSong.durationSeconds || 240}
                  value={currentTime}
                  onChange={(e) => globalRadioPlayer.seek(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span>{activeSong.duration || formatSeconds(duration)}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 mr-auto">
              <Volume2 className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => globalRadioPlayer.setVolume(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Search & Categories */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'songs'
                  ? 'ابحث عن أغنية أو فنان (أم كلثوم، فيروز، حليم، عمرو دياب...)'
                  : 'ابحث عن محطة راديو (طرب، تسعينات، فيروز، قرآن، روتانا...)'
              }
              className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-bold scrollbar-none">
            {(activeTab === 'songs' ? songCategories : radioCategories).map((c) => {
              const isSelected = activeTab === 'songs' ? selectedSongCategory === c.id : selectedRadioCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (activeTab === 'songs') setSelectedSongCategory(c.id);
                    else setSelectedRadioCategory(c.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-black shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-slate-50/40">
          {activeTab === 'songs' && (
            <div className="space-y-1.5">
              {filteredSongs.map((song, idx) => {
                const isThisSelected = activeSong.id === song.id;
                const isThisPlaying = isThisSelected && isPlaying;

                return (
                  <div
                    key={song.id}
                    onClick={() => handleSelectSong(song)}
                    className={`p-2.5 rounded-2xl border transition-all duration-150 flex items-center justify-between cursor-pointer group ${
                      isThisSelected
                        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-105 ${
                        isThisPlaying
                          ? 'bg-indigo-600 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="truncate">
                        <h4 className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                          <span>{song.title}</span>
                          {isThisSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                          {song.artist} • <span className="text-indigo-600 font-bold">{song.categoryLabel}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">{song.duration}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isThisSelected) globalRadioPlayer.togglePlay();
                          else handleSelectSong(song);
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer ${
                          isThisPlaying
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200'
                        }`}
                      >
                        {isThisPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'radio' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredStations.map((station) => {
                const isCurrentStation = activeStation.id === station.id;
                const isCurrentPlaying = isCurrentStation && isPlaying;

                return (
                  <div
                    key={station.id}
                    onClick={() => handleSelectStation(station)}
                    className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between cursor-pointer group ${
                      isCurrentStation
                        ? 'bg-amber-50 border-amber-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                        isCurrentPlaying
                          ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {station.icon}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-slate-900 truncate">{station.name}</h4>
                          <span className="text-xs">{station.countryFlag}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {station.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold border border-slate-200">
                            {station.categoryLabel}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Signal className="w-2.5 h-2.5" /> {station.bitrate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrentStation) globalRadioPlayer.togglePlay();
                        else handleSelectStation(station);
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 transition-all shadow-sm active:scale-95 cursor-pointer ${
                        isCurrentPlaying
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-white font-bold'
                      }`}
                    >
                      {isCurrentPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white mr-0.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ArabicMusicPlayerModal = MusicRadioModal;
