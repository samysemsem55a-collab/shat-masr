import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Sparkles, 
  Coins, 
  CheckCircle2, 
  Palette,
  Eye,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { User, ChatWallpaper } from '../types/chat';
import {
  CHAT_WALLPAPERS,
  ROOM_BACKGROUND_THEMES,
  DEFAULT_CHAT_WALLPAPER_ID,
  getRoomBackgroundThemeById,
  hasSavedCustomNotificationBgPreset,
  readSavedNotificationBgPresetId,
} from '../data/wallpapers';
import { sounds } from '../utils/soundEffects';
import { syncUserProfileToFirebase, saveUserThemeSettings } from '../services/firebase';
import { isUserAdminOrOwner } from '../data/seedData';
import { NotificationBgSelector } from './NotificationBgSelector';
import { toast } from '../utils/appToast';

interface ChatWallpapersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser?: (updatedUser: User) => void;
  onOpenWallet?: () => void;
  isModerator?: boolean;
  roomTitle?: string;
  activeRoomBackground?: string;
  onSelectRoomBackground?: (themeId: string) => void;
  initialMode?: 'personal' | 'room' | 'notifications';
}

const DEFAULT_ROOM_PREVIEW_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to bottom, rgba(255,255,255,0.82), rgba(241,245,249,0.90)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

const DARK_WALLPAPER_IDS = new Set([
  'wp_nature_nile_sunset',
  'wp_nature_starry_oasis',
  'wp_doodle_custom',
  'wp_egypt_gold',
  'wp_egypt_sunset',
  'wp_doodle_arab',
  'wp_cairo_night',
  'wp_royal_palace',
  'wp_alex_turquoise',
  'wp_desert_stars',
  'wp_fatimid_heritage',
  'wp_minimal_dark',
]);

export const ChatWallpapersModal: React.FC<ChatWallpapersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onOpenWallet,
  isModerator = false,
  roomTitle,
  activeRoomBackground = 'default',
  onSelectRoomBackground,
  initialMode = 'personal',
}) => {
  const canEditRoomBg = Boolean(isModerator && onSelectRoomBackground);
  const activeWallpaperId = currentUser.chatWallpaper || DEFAULT_CHAT_WALLPAPER_ID;

  const [modalMode, setModalMode] = useState<'personal' | 'room' | 'notifications'>(
    initialMode === 'room' && !canEditRoomBg ? 'personal' : initialMode
  );
  const [filter, setFilter] = useState<'all' | 'nature' | 'free' | 'premium' | 'unlocked'>('all');
  const [roomFilter, setRoomFilter] = useState<'all' | 'nature' | 'gradient' | 'solid'>('all');
  const [selectedPersonalId, setSelectedPersonalId] = useState<string>(activeWallpaperId);
  const [selectedRoomThemeId, setSelectedRoomThemeId] = useState<string>(activeRoomBackground || 'default');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setModalMode(initialMode === 'room' && !canEditRoomBg ? 'personal' : initialMode);
    setSelectedPersonalId(currentUser.chatWallpaper || DEFAULT_CHAT_WALLPAPER_ID);
    setSelectedRoomThemeId(activeRoomBackground || 'default');
    setNotice(null);
  }, [isOpen, initialMode, canEditRoomBg, currentUser.chatWallpaper, activeRoomBackground]);

  if (!isOpen) return null;

  const isOwner = isUserAdminOrOwner(currentUser);
  const unlockedIds = new Set<string>([
    DEFAULT_CHAT_WALLPAPER_ID,
    'wp_egypt_gold',
    'wp_egypt_sunset',
    'wp_doodle_arab',
    'wp_minimal_dark',
    ...(currentUser.unlockedWallpapers || [])
  ]);

  const persistPersonalWallpaper = (updatedUser: User, wallpaperId: string) => {
    if (onUpdateUser) onUpdateUser(updatedUser);
    syncUserProfileToFirebase(updatedUser);
    saveUserThemeSettings(currentUser.id, {
      isDarkMode: document.documentElement.classList.contains('dark'),
      chatWallpaper: wallpaperId,
      fontPreference: currentUser.fontPreference,
      muteJoinNotices: currentUser.muteJoinNotices,
      dataSaverMode: currentUser.dataSaverMode,
      ...(hasSavedCustomNotificationBgPreset(currentUser)
        ? { notificationBgPreset: readSavedNotificationBgPresetId(currentUser) }
        : {}),
    }).catch(() => {});
    try {
      localStorage.setItem('arab_chat_active_wallpaper', wallpaperId);
    } catch {}
  };

  const handleApplyWallpaper = (wallpaper: ChatWallpaper) => {
    sounds.playMessageSent();
    const updatedUser: User = {
      ...currentUser,
      chatWallpaper: wallpaper.id
    };
    persistPersonalWallpaper(updatedUser, wallpaper.id);
    toast.success(`تم تطبيق وحفظ خلفية «${wallpaper.name}» بنجاح ✨`);
    onClose();
  };

  const handlePurchaseAndApply = async (wallpaper: ChatWallpaper) => {
    if (!isOwner && currentUser.coins < wallpaper.priceCoins) {
      setNotice(`عفواً، رصيدك غير كافٍ! تحتاج إلى ${wallpaper.priceCoins - currentUser.coins} كوينز إضافية لشراء هذه الخلفية.`);
      return;
    }
    setNotice(null);
    setPurchasingId(wallpaper.id);

    const newCoins = isOwner ? currentUser.coins : Math.max(0, currentUser.coins - wallpaper.priceCoins);
    const updatedUnlocked = Array.from(new Set([...(currentUser.unlockedWallpapers || []), wallpaper.id]));

    const updatedUser: User = {
      ...currentUser,
      coins: newCoins,
      chatWallpaper: wallpaper.id,
      unlockedWallpapers: updatedUnlocked
    };

    try {
      persistPersonalWallpaper(updatedUser, wallpaper.id);
      await syncUserProfileToFirebase(updatedUser);
      sounds.playMessageSent();
      toast.success(`تم تفعيل وحفظ خلفية «${wallpaper.name}» بنجاح ✨`);
      onClose();
    } finally {
      setPurchasingId(null);
    }
  };

  const handleApplyRoomBackground = (themeId: string) => {
    if (!onSelectRoomBackground) return;
    sounds.playMessageSent();
    onSelectRoomBackground(themeId);
    const chosen = ROOM_BACKGROUND_THEMES.find((t) => t.id === themeId);
    toast.success(`تم تطبيق وحفظ خلفية الغرفة (${chosen?.name || 'الافتراضية'}) للجميع ✅`);
    onClose();
  };

  const filteredWallpapers = CHAT_WALLPAPERS.filter((wp) => {
    const isUnlocked = isOwner || wp.priceCoins === 0 || unlockedIds.has(wp.id);
    if (filter === 'nature') return wp.id.startsWith('wp_nature_') || wp.tag?.includes('طبيعية');
    if (filter === 'free') return wp.priceCoins === 0;
    if (filter === 'premium') return wp.priceCoins > 0;
    if (filter === 'unlocked') return isUnlocked;
    return true;
  });

  const filteredRoomThemes = ROOM_BACKGROUND_THEMES.filter((t) =>
    roomFilter === 'all' ? true : t.category === roomFilter
  );

  const previewedPersonalWallpaper =
    CHAT_WALLPAPERS.find((w) => w.id === selectedPersonalId) || CHAT_WALLPAPERS[0];
  const isPreviewedPersonalUnlocked =
    isOwner ||
    previewedPersonalWallpaper.priceCoins === 0 ||
    unlockedIds.has(previewedPersonalWallpaper.id);
  const isPreviewedPersonalActive = activeWallpaperId === previewedPersonalWallpaper.id;
  const isPreviewedPersonalDark = DARK_WALLPAPER_IDS.has(previewedPersonalWallpaper.id);

  const previewedRoomTheme =
    ROOM_BACKGROUND_THEMES.find((t) => t.id === selectedRoomThemeId) ||
    getRoomBackgroundThemeById(selectedRoomThemeId) ||
    ROOM_BACKGROUND_THEMES[0];
  const previewedRoomStyle: React.CSSProperties =
    previewedRoomTheme.id === 'default'
      ? DEFAULT_ROOM_PREVIEW_STYLE
      : previewedRoomTheme.style;
  const isPreviewedRoomActive = (activeRoomBackground || 'default') === previewedRoomTheme.id;

  return (
    <div
      onClick={onClose}
      dir="rtl"
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 truncate">
                <span>خلفيات وألوان الشات</span>
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {modalMode === 'room' && roomTitle
                  ? `عاين واختر خلفية تظهر لجميع المتواجدين في ${roomTitle}`
                  : modalMode === 'notifications'
                  ? 'عاين واختر من بين 10 خلفيات لامعة لإشعارات الانضمام والتنبيهات'
                  : 'عاين الخلفية مباشرة على المحادثة قبل تطبيقها وحفظها'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unified Mode Switch */}
        <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setModalMode('personal')}
            className={`flex-1 min-w-fit py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              modalMode === 'personal'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            خلفيتك الخاصة 🎨
          </button>
          <button
            type="button"
            onClick={() => setModalMode('notifications')}
            className={`flex-1 min-w-fit py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              modalMode === 'notifications'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            خلفيات الإشعارات ✨
          </button>
          {canEditRoomBg && (
            <button
              type="button"
              onClick={() => setModalMode('room')}
              className={`flex-1 min-w-fit py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                modalMode === 'room'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              خلفية الغرفة للجميع 🌟
            </button>
          )}
        </div>

        {modalMode === 'notifications' ? (
          <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 min-h-0">
            <NotificationBgSelector
              currentUser={currentUser}
              onUpdateUser={onUpdateUser}
              onApplied={() => onClose()}
            />
          </div>
        ) : modalMode === 'room' && canEditRoomBg ? (
          <>
            {/* Interactive Live Preview Panel for Room Background */}
            <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-slate-800 truncate">
                    معاينة مباشرة للغرفة: {previewedRoomTheme.name}
                  </span>
                </div>
                {isPreviewedRoomActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black shrink-0">
                    المطبقة حالياً ✓
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black shrink-0">
                    قيد المعاينة
                  </span>
                )}
              </div>

              <div
                style={previewedRoomStyle}
                className="rounded-2xl border border-slate-200/90 shadow-inner overflow-hidden"
              >
                {/* Mini Room Header Preview */}
                <div className={`px-3 py-1.5 flex items-center justify-between border-b ${
                  previewedRoomTheme.isDark
                    ? 'bg-slate-900/55 border-white/10 text-white'
                    : 'bg-white/80 border-slate-200/80 text-slate-800'
                } backdrop-blur-xs`}>
                  <span className="text-[11px] font-black truncate">{roomTitle || 'الغرفة العامة'}</span>
                  <span className="text-[10px] font-bold opacity-80">{previewedRoomTheme.previewLabel}</span>
                </div>

                {/* Mini Room Chat Messages Preview */}
                <div className="p-3 space-y-2">
                  <div className="flex justify-start">
                    <div className={`px-3 py-1.5 rounded-2xl rounded-tr-sm text-[11px] font-bold shadow-xs max-w-[82%] ${
                      previewedRoomTheme.isDark
                        ? 'bg-slate-900/80 text-white border border-white/15'
                        : 'bg-white/95 text-slate-800 border border-slate-200/90'
                    }`}>
                      أهلاً بكل الحبايب في الغرفة، منورين الدنيا ✨☕
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="px-3 py-1.5 rounded-2xl rounded-tl-sm bg-emerald-600/95 text-white text-[11px] font-bold shadow-xs max-w-[78%]">
                      ما شاء الله خلفية مريحة جداً وواضحة 🌟
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                {selectedRoomThemeId !== 'default' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedRoomThemeId('default')}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>الافتراضية</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 font-bold">
                    اختر أي بطاقة بالأسفل لمعاينتها أولاً
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleApplyRoomBackground(selectedRoomThemeId)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>{isPreviewedRoomActive ? 'حفظ وتأكيد الخلفية' : 'تطبيق وحفظ خلفية الغرفة للجميع'}</span>
                </button>
              </div>
            </div>

            {/* Room Filter Bar */}
            <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {[
                { id: 'all', label: `الكل (${ROOM_BACKGROUND_THEMES.length})` },
                { id: 'nature', label: 'مناظر طبيعية 🌿' },
                { id: 'gradient', label: 'تدرجات لونية ✨' },
                { id: 'solid', label: 'ألوان هادئة 🎨' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoomFilter(tab.id as 'all' | 'nature' | 'gradient' | 'solid')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    roomFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Room Themes Cards Grid (Click = Live Preview) */}
            <div className="p-3.5 overflow-y-auto flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredRoomThemes.map((theme) => {
                const isActiveRoom = (activeRoomBackground || 'default') === theme.id;
                const isPreviewSelected = selectedRoomThemeId === theme.id;
                const cardStyle: React.CSSProperties =
                  theme.id === 'default' ? DEFAULT_ROOM_PREVIEW_STYLE : theme.style;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedRoomThemeId(theme.id)}
                    className={`group rounded-2xl border-2 overflow-hidden text-right transition-all flex flex-col bg-white cursor-pointer ${
                      isPreviewSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-200 shadow-md'
                        : isActiveRoom
                        ? 'border-emerald-400 shadow-sm'
                        : 'border-slate-200 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    <div
                      style={cardStyle}
                      className="h-20 w-full relative p-2 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md truncate ${
                          theme.isDark
                            ? 'bg-white/15 text-white border border-white/20'
                            : 'bg-white/90 text-slate-700 border border-slate-200/80'
                        }`}>
                          {theme.previewLabel}
                        </span>
                        {isActiveRoom ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow shrink-0" title="المطبقة حالياً">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : isPreviewSelected ? (
                          <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow shrink-0" title="قيد المعاينة">
                            <Eye className="w-3 h-3" />
                          </span>
                        ) : null}
                      </div>
                      <span className={`text-[10px] font-bold truncate ${
                        theme.isDark ? 'text-white/95' : 'text-slate-900'
                      }`}>
                        مرحباً بكم ✨
                      </span>
                    </div>
                    <div className="px-2.5 py-2 bg-white border-t border-slate-100 w-full flex items-center justify-between gap-1">
                      <p className="text-[11px] font-black text-slate-900 truncate">
                        {theme.name}
                      </p>
                      {isPreviewSelected && (
                        <span className="text-[9px] font-black text-emerald-700 shrink-0">معاينة</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Interactive Live Preview Panel for Personal & Private Chat Background */}
            <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-black text-slate-800 truncate">
                    معاينة مباشرة للشات: {previewedPersonalWallpaper.name}
                  </span>
                </div>
                {isPreviewedPersonalActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black shrink-0">
                    النشطة حالياً ✓
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black shrink-0">
                    قيد المعاينة
                  </span>
                )}
              </div>

              <div
                style={previewedPersonalWallpaper.style}
                className="rounded-2xl border border-slate-200/90 shadow-inner overflow-hidden"
              >
                {/* Mini Chat Header Preview */}
                <div className={`px-3 py-1.5 flex items-center justify-between border-b ${
                  isPreviewedPersonalDark
                    ? 'bg-slate-900/60 border-white/10 text-white'
                    : 'bg-white/85 border-slate-200/80 text-slate-800'
                } backdrop-blur-xs`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[11px] font-black truncate">محادثة خاصة • متصل الآن</span>
                  </div>
                  <span className="text-[10px] font-bold opacity-85 shrink-0">
                    {previewedPersonalWallpaper.thumbnail} {previewedPersonalWallpaper.tag}
                  </span>
                </div>

                {/* Mini Chat Stream Preview */}
                <div className="p-3 space-y-2">
                  <div className="flex justify-start">
                    <div className="bg-white/95 backdrop-blur-xs border border-slate-200 text-[11px] font-bold text-slate-800 px-3 py-1.5 rounded-2xl rounded-tr-sm max-w-[78%] shadow-xs">
                      أهلاً بكم في شات مصر والعرب ☕✨
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-indigo-600/95 backdrop-blur-xs text-[11px] font-bold text-white px-3 py-1.5 rounded-2xl rounded-tl-sm max-w-[75%] shadow-xs">
                      خلفية واضحة وأنيقة جداً 🌟
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply / Purchase Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {previewedPersonalWallpaper.priceCoins === 0 ? (
                    <span className="text-[11px] font-black text-emerald-600">مجاناً 🎁</span>
                  ) : isPreviewedPersonalUnlocked ? (
                    <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> متاح لديك
                    </span>
                  ) : (
                    <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                      🪙 {previewedPersonalWallpaper.priceCoins} كوينز
                    </span>
                  )}
                  {selectedPersonalId !== DEFAULT_CHAT_WALLPAPER_ID && (
                    <button
                      type="button"
                      onClick={() => setSelectedPersonalId(DEFAULT_CHAT_WALLPAPER_ID)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>الافتراضية</span>
                    </button>
                  )}
                </div>

                {isPreviewedPersonalUnlocked ? (
                  <button
                    type="button"
                    onClick={() => handleApplyWallpaper(previewedPersonalWallpaper)}
                    className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                      isPreviewedPersonalActive
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{isPreviewedPersonalActive ? 'حفظ وتأكيد الخلفية الحالية' : 'تطبيق وحفظ الخلفية'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePurchaseAndApply(previewedPersonalWallpaper)}
                    disabled={purchasingId === previewedPersonalWallpaper.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {purchasingId === previewedPersonalWallpaper.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Coins className="w-3.5 h-3.5 fill-slate-950" />
                    )}
                    <span>
                      {purchasingId === previewedPersonalWallpaper.id
                        ? 'جاري الشراء...'
                        : `شراء وتطبيق (${previewedPersonalWallpaper.priceCoins} كوينز)`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* User Balance & Category Filter Bar */}
            <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
              {/* Filter Segmented Control */}
              <div className="flex items-center gap-1 text-[11px] font-bold overflow-x-auto no-scrollbar py-0.5">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                    filter === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({CHAT_WALLPAPERS.length})
                </button>
                <button
                  onClick={() => setFilter('nature')}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                    filter === 'nature'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  مناظر طبيعية 🌿
                </button>
                <button
                  onClick={() => setFilter('free')}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                    filter === 'free'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  المجانية 🎁
                </button>
                <button
                  onClick={() => setFilter('premium')}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                    filter === 'premium'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-amber-600 hover:text-amber-700'
                  }`}
                >
                  المميزة VIP 👑
                </button>
                <button
                  onClick={() => setFilter('unlocked')}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                    filter === 'unlocked'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  المتاحة لدي ✅
                </button>
              </div>

              {/* User Coins Badge (Hidden for Owner) */}
              {!isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">
                    <span>🪙</span>
                    <span>{currentUser.coins.toLocaleString()} كوينز</span>
                  </div>
                  {onOpenWallet && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenWallet();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      شحن +
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inline Notice */}
            {notice && (
              <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
                <span>{notice}</span>
                {!isOwner && onOpenWallet && (
                  <button
                    onClick={() => {
                      setNotice(null);
                      onClose();
                      onOpenWallet();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-black shrink-0 cursor-pointer"
                  >
                    شحن رصيد
                  </button>
                )}
              </div>
            )}

            {/* Wallpapers Grid View (Click card = Live Preview before applying) */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWallpapers.map((wallpaper) => {
                const isUnlocked = isOwner || wallpaper.priceCoins === 0 || unlockedIds.has(wallpaper.id);
                const isActive = activeWallpaperId === wallpaper.id;
                const isPreviewSelected = selectedPersonalId === wallpaper.id;

                return (
                  <div
                    key={wallpaper.id}
                    onClick={() => {
                      setNotice(null);
                      setSelectedPersonalId(wallpaper.id);
                    }}
                    className={`rounded-2xl border-2 transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
                      isPreviewSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-md ring-2 ring-indigo-300/40'
                        : isActive
                        ? 'border-emerald-500 bg-emerald-50/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    {/* Visual Thumbnail Box */}
                    <div
                      style={wallpaper.style}
                      className="h-24 w-full relative p-2.5 flex flex-col justify-between overflow-hidden"
                    >
                      <div className="flex items-center justify-between relative z-10 gap-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900/70 backdrop-blur-md text-amber-300 border border-white/20 flex items-center gap-1 truncate">
                          {wallpaper.thumbnail} {wallpaper.tag}
                        </span>

                        {isActive ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500 text-white shadow flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" /> النشطة
                          </span>
                        ) : isPreviewSelected ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-600 text-white shadow flex items-center gap-1 shrink-0">
                            <Eye className="w-3 h-3" /> معاينة
                          </span>
                        ) : null}
                      </div>

                      <div className="bg-white/90 backdrop-blur-xs border border-slate-200 text-[9.5px] font-bold text-slate-800 px-2.5 py-1 rounded-xl rounded-tl-none max-w-[75%] mr-auto shadow-xs pointer-events-none select-none truncate">
                        أهلاً بكم في شات مصر ✨
                      </div>
                    </div>

                    {/* Info & Selection Footer */}
                    <div className="p-2.5 bg-white text-right flex items-center justify-between gap-2 border-t border-slate-100">
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {wallpaper.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {wallpaper.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-left">
                        {wallpaper.priceCoins === 0 ? (
                          <span className="text-[10px] font-black text-emerald-600 block">مجاناً 🎁</span>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-black text-emerald-600 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> متاح
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-amber-600 block">
                            🪙 {wallpaper.priceCoins}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
};

