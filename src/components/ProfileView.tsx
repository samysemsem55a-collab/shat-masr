import React, { useState, useRef, useEffect } from 'react';
import { 
  Crown, 
  Save, 
  Type, 
  Palette, 
  Camera,
  MessageSquare,
  MessageSquareOff,
  LogOut,
  X,
  Lock,
  Bell,
  Activity,
  Music,
  Play,
  Square,
  Image as ImageIcon,
  Moon,
  Sun,
  Upload,
  ZoomIn,
  MoveHorizontal,
  MoveVertical,
  Eye,
  ShieldCheck,
  Wifi,
  VolumeX,
  Sparkles,
  LifeBuoy,
  Send,
  ExternalLink
} from 'lucide-react';
import { User } from '../types/chat';
import { isUserAdminOrOwner } from '../data/seedData';
import { sounds } from '../utils/soundEffects';
import {
  getRankDisplayMeta,
  hasPrivilegedRank,
  PROFILE_BANNER_PRESETS,
  resolveBannerStyle
} from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationBgSelector } from './NotificationBgSelector';
import { readSavedNotificationBgPresetId } from '../data/wallpapers';
import {
  saveUserThemeSettings,
  updateNotificationPreferences,
  updateUserActivityStatus,
  submitUserReport
} from '../services/firebase';
import { compressImageFile, cropBannerToDataUrl } from '../utils/imageCompression';
import { maskEmail, maskPhone } from '../utils/maskData';
import { isDataSaverEnabled, setDataSaverEnabled } from '../utils/assetCache';
import { checkImpersonationAttempt, VerifiedBadge } from '../utils/verifiedBadge';
import { toast } from '../utils/appToast';

const ZODIAC_SIGNS = [
  'الحمل ♈',
  'الثور ♉',
  'الجوزاء ♊',
  'السرطان ♋',
  'الأسد ♌',
  'العذراء ♍',
  'الميزان ♎',
  'العقرب ♏',
  'القوس ♐',
  'الجدي ♑',
  'الدلو ♒',
  'الحوت ♓'
];

const FAVORITE_MUSIC_PRESETS = [
  {
    id: 'none',
    label: 'بدون موسيقى مفضلة',
    url: ''
  },
  {
    id: 'umm_kulthum',
    label: 'أم كلثوم — أنت الحب 🎙️',
    url: 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/01%20Inta%20Al%20Hob.mp3'
  },
  {
    id: 'abdel_halim',
    label: 'عبد الحليم — على حسب وداد 🎻',
    url: 'https://archive.org/download/y-2mate.com-ala-hesb-wedad-abdel-halim-hafez_202305/y2mate.com%20-%20Ala%20Hesb%20Wedad%20%20Abdel%20Halim%20Hafez%20%20%D8%B9%D9%84%D9%89%20%D8%AD%D8%B3%D8%A8%20%D9%88%D8%AF%D8%A7%D8%AF%20%D9%82%D9%84%D8%A8%D9%89%20%20%D8%B9%D8%A8%D8%AF%20%D8%A7%D9%84%D8%AD%D9%84%D9%8A%D9%85%20%D8%AD%D8%A7%D9%81%D8%B8.mp3'
  },
  {
    id: 'amr_diab',
    label: 'عمرو دياب — راجعين 🎵',
    url: 'https://archive.org/download/ragein/01%20Ragein.mp3'
  },
  {
    id: 'khaleeji',
    label: 'طرب خليجي — يا ابن الأوادم ✨',
    url: 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%AC%D9%8A%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87%20-%20%D9%8a%D8%A7%20%D8%A3%D8%A8%D9%86%20%D8%A7%D9%84%D8%A7%D9%88%D8%A7%D8%AF%D9%85%20%28%D8%A3%D9%84%D8%A8%D9%88%D9%85%20%D8%B9%D8%A7%D9%84%D9%85%20%D9%85%D9%88%D8%A7%D8%B2%D9%8a%29%20_%202021%20%28128%20kbps%29.mp3'
  }
];

interface ProfileViewProps {
  currentUser: User;
  onUpdateUser: (updatedUser: Partial<User>) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  openToSupport?: boolean;
  onConsumeSupportScroll?: () => void;
}

const ANIME_AVATARS = [
  { id: 'anime_1', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ShadowWarrior&backgroundColor=e0e7ff', label: 'محارب الظلال ⚔️' },
  { id: 'anime_2', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=SakuraPrincess&backgroundColor=fce7f3', label: 'أميرة الساكورا 🌸' },
  { id: 'anime_3', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=NeonMage&backgroundColor=cffafe', label: 'ساحر النيون ⚡' },
  { id: 'anime_4', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=GalaxyKnight&backgroundColor=ede9fe', label: 'فارس المجرة 🌌' },
  { id: 'anime_5', url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=GoldenLegend&backgroundColor=fef3c7', label: 'الأسطورة الذهبية 👑' },
  { id: 'anime_6', url: 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=KiEnergy&backgroundColor=ffedd5', label: 'طاقة الكي 💥' },
  { id: 'anime_7', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=MoonGirl&backgroundColor=e0f2fe', label: 'فتاة القمر 🌙' },
  { id: 'anime_8', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=NinjaShinobi&backgroundColor=dcfce7', label: 'شينوبي النينجا 🥷' }
];

const ACTIVITY_STATUS_OPTIONS: {
  value: User['status'];
  label: string;
  emoji: string;
  dotClass: string;
  badgeClass: string;
}[] = [
  {
    value: 'online',
    label: 'متاح',
    emoji: '🟢',
    dotClass: 'bg-emerald-500',
    badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
  },
  {
    value: 'busy',
    label: 'مشغول',
    emoji: '🟡',
    dotClass: 'bg-amber-500',
    badgeClass: 'text-amber-700 bg-amber-50 border-amber-200'
  },
  {
    value: 'dnd',
    label: 'لا تزعجني',
    emoji: '🔴',
    dotClass: 'bg-rose-500',
    badgeClass: 'text-rose-700 bg-rose-50 border-rose-200'
  },
  {
    value: 'in_mic',
    label: 'متواجد في مجلس صوتي',
    emoji: '🎙️',
    dotClass: 'bg-purple-500',
    badgeClass: 'text-purple-700 bg-purple-50 border-purple-200'
  }
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateUser,
  onOpenWallet,
  onOpenVip,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
  openToSupport = false,
  onConsumeSupportScroll,
}) => {
  const effectiveDarkMode = isDarkMode ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const [activeTab, setActiveTab] = useState<'info' | 'appearance' | 'security'>(openToSupport ? 'security' : 'info');
  const [muteSendSound, setMuteSendSound] = useState<boolean>(() => sounds.isSendSoundMuted());
  const [supportReason, setSupportReason] = useState<string>('مشكلة تقنية في التطبيق');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [isSendingSupport, setIsSendingSupport] = useState<boolean>(false);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [country, setCountry] = useState(currentUser.country || 'مصر');
  const [countryFlag, setCountryFlag] = useState(currentUser.countryFlag || '🇪🇬');
  const [zodiacSign, setZodiacSign] = useState(currentUser.zodiacSign || '');
  const [activityStatus, setActivityStatus] = useState<User['status']>(currentUser.status || 'online');
  const [fontPreference, setFontPreference] = useState(currentUser.fontPreference || 'cairo');
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg');
  const [selectedFrame, setSelectedFrame] = useState(currentUser.frameStyle || 'border-slate-600');
  const [profileBanner, setProfileBanner] = useState(
    currentUser.profileBanner || currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg'
  );
  const [coverFilter, setCoverFilter] = useState<'all' | 'wallpapers' | 'banners'>('all');
  const [favoriteMusicUrl, setFavoriteMusicUrl] = useState(currentUser.favoriteMusicUrl || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const [allowPrivateMessages, setAllowPrivateMessages] = useState<boolean>(currentUser.allowPrivateMessages !== false);
  const [muteJoinNotices, setMuteJoinNotices] = useState<boolean>(Boolean(currentUser.muteJoinNotices));
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(
    typeof currentUser.dataSaverMode === 'boolean' ? currentUser.dataSaverMode : isDataSaverEnabled()
  );
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [notifyDMs, setNotifyDMs] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
      if (raw) return JSON.parse(raw).directMessages !== false;
    } catch {}
    return (currentUser as any).notificationPrefs?.directMessages !== false;
  });
  const [notifyGifts, setNotifyGifts] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
      if (raw) return JSON.parse(raw).gifts !== false;
    } catch {}
    return (currentUser as any).notificationPrefs?.gifts !== false;
  });
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarModalMode, setAvatarModalMode] = useState<'choose' | 'anime'>('choose');

  // Custom Banner / Phone Cover Live Preview & Crop Modal State
  const [bannerCropModal, setBannerCropModal] = useState<{
    open: boolean;
    imageSrc: string;
    rawFile: File | null;
    zoom: number;
    offsetX: number;
    offsetY: number;
    isApplying: boolean;
  }>({
    open: false,
    imageSrc: '',
    rawFile: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isApplying: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleDarkMode = () => {
    const nextDark = !effectiveDarkMode;
    if (onToggleDarkMode) {
      onToggleDarkMode();
    }
    saveUserThemeSettings(currentUser.id, {
      isDarkMode: nextDark,
      chatWallpaper: currentUser.chatWallpaper,
      fontPreference,
      muteJoinNotices,
      dataSaverMode,
    }).catch(() => {});
  };

  useEffect(() => {
    if (currentUser.status && currentUser.status !== activityStatus) {
      setActivityStatus(currentUser.status);
    }
  }, [currentUser.status]);

  useEffect(() => {
    if (openToSupport) {
      setActiveTab('security');
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById('support-contact-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          onConsumeSupportScroll?.();
        }, 120);
      });
    }
  }, [openToSupport, onConsumeSupportScroll]);

  const currentStatusMeta =
    ACTIVITY_STATUS_OPTIONS.find(opt => opt.value === activityStatus) || ACTIVITY_STATUS_OPTIONS[0];

  const handleStatusChange = async (nextStatus: User['status']) => {
    setActivityStatus(nextStatus);
    onUpdateUser({ status: nextStatus });
    await updateUserActivityStatus(currentUser.id, nextStatus);
    const meta = ACTIVITY_STATUS_OPTIONS.find(opt => opt.value === nextStatus) || ACTIVITY_STATUS_OPTIONS[0];
    toast.success(`تم تحديث حالة النشاط إلى "${meta.label}" ${meta.emoji}`, {
      description: 'تظهر حالتك الآن للأصدقاء بشكل لحظي'
    });
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const toggleMusicPreview = () => {
    if (!favoriteMusicUrl.trim()) return;
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(favoriteMusicUrl.trim());
    audio.volume = 0.65;
    audio.onended = () => setIsPreviewPlaying(false);
    audio.onerror = () => {
      setIsPreviewPlaying(false);
      toast.error('تعذر تشغيل هذا الرابط الصوتي حالياً');
    };
    previewAudioRef.current = audio;
    audio.play().then(() => setIsPreviewPlaying(true)).catch(() => {
      setIsPreviewPlaying(false);
    });
  };

  const isStrictOwner = isUserAdminOrOwner(currentUser);
  const isVipUser = hasPrivilegedRank(currentUser.role) || isStrictOwner;
  const rankMeta = getRankDisplayMeta(currentUser.role, currentUser.vipBadge);

  const countries = [
    { name: 'مصر', flag: '🇪🇬' },
    { name: 'السعودية', flag: '🇸🇦' },
    { name: 'الإمارات', flag: '🇦🇪' },
    { name: 'المغرب', flag: '🇲🇦' },
    { name: 'الجزائر', flag: '🇩🇿' },
    { name: 'العراق', flag: '🇮🇶' },
    { name: 'الكويت', flag: '🇰🇼' },
    { name: 'سوريا', flag: '🇸🇾' },
    { name: 'الأردن', flag: '🇯🇴' },
    { name: 'فلسطين', flag: '🇵🇸' },
    { name: 'لبنان', flag: '🇱🇧' },
    { name: 'تونس', flag: '🇹🇳' },
    { name: 'اليمن', flag: '🇾🇪' },
    { name: 'السودان', flag: '🇸🇩' },
    { name: 'ليبيا', flag: '🇱🇾' },
    { name: 'عمان', flag: '🇴🇲' },
  ];

  const wallpapers = [
    { name: 'غروب نيل القاهرة 🌅', url: '/assets/wallpapers/nature_nile_sunset.jpg', isVipOnly: false },
    { name: 'سماء الأهرامات 🏺', url: '/assets/wallpapers/egypt_chat_bg.jpg', isVipOnly: false },
    { name: 'السماء الصافية ☁️', url: '/assets/wallpapers/nature_clear_sky.jpg', isVipOnly: false },
    { name: 'المروج الخضراء 🌿', url: '/assets/wallpapers/nature_green_meadow.jpg', isVipOnly: true },
    { name: 'ليالي الواحة والنجوم 🌌', url: '/assets/wallpapers/nature_starry_oasis.jpg', isVipOnly: true },
    { name: 'زخارف شرقية أصيلة 🕌', url: '/assets/wallpapers/doodle_chat_bg.jpg', isVipOnly: true },
  ];

  const frames = [
    { name: 'بسيط كلاسيكي', class: 'border-slate-600', isVipOnly: false },
    { name: 'ألماسي نيون مشع', class: 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]', isVipOnly: true },
    { name: 'ذهبي ملكي متوهج', class: 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]', isVipOnly: true },
    { name: 'إمبراطوري بنفسجي', class: 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]', isVipOnly: true }
  ];

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 420,
        maxHeight: 420,
        maxBytes: 140 * 1024,
      });
      setAvatarUrl(compressed);
      onUpdateUser({ avatar: compressed });
      setShowAvatarModal(false);
      toast.success('تم تحديث صورتك الشخصية من الهاتف بنجاح 📸');
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newUrl = event.target.result as string;
          setAvatarUrl(newUrl);
          onUpdateUser({ avatar: newUrl });
          setShowAvatarModal(false);
          toast.success('تم تحديث صورتك الشخصية بنجاح 📸');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectAnime = (url: string) => {
    setAvatarUrl(url);
    onUpdateUser({ avatar: url });
    setShowAvatarModal(false);
    toast.success('تم اختيار صورة الأفتار بنجاح ✨');
  };

  const handleBannerFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح من الهاتف');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBannerCropModal({
          open: true,
          imageSrc: reader.result,
          rawFile: file,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
          isApplying: false,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmBannerCrop = async () => {
    if (!bannerCropModal.imageSrc || bannerCropModal.isApplying) return;
    setBannerCropModal((prev) => ({ ...prev, isApplying: true }));
    try {
      const { dataUrl: croppedDataUrl } = await cropBannerToDataUrl(
        bannerCropModal.imageSrc,
        bannerCropModal.zoom,
        bannerCropModal.offsetX,
        bannerCropModal.offsetY,
        960,
        300
      );
      setProfileBanner(croppedDataUrl);
      setSelectedWallpaper(croppedDataUrl);
      onUpdateUser({ profileBanner: croppedDataUrl, profileWallpaper: croppedDataUrl });
      toast.success('تم قص وتطبيق صورة الغلاف والبانر من الهاتف بنجاح 🖼️');
      setBannerCropModal({
        open: false,
        imageSrc: '',
        rawFile: null,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        isApplying: false,
      });
    } catch {
      toast.error('تعذر معالجة الصورة المختارة — يرجى اختيار صورة أخرى');
      setBannerCropModal((prev) => ({ ...prev, isApplying: false }));
    }
  };

  const handleApplyFullPhoneCover = async () => {
    if (!bannerCropModal.imageSrc || bannerCropModal.isApplying) return;
    setBannerCropModal((prev) => ({ ...prev, isApplying: true }));
    try {
      const finalUrl = bannerCropModal.rawFile
        ? await compressImageFile(bannerCropModal.rawFile, {
            maxWidth: 960,
            maxHeight: 540,
            maxBytes: 185 * 1024,
          })
        : bannerCropModal.imageSrc;
      setProfileBanner(finalUrl);
      setSelectedWallpaper(finalUrl);
      onUpdateUser({ profileBanner: finalUrl, profileWallpaper: finalUrl });
      toast.success('تم تطبيق الصورة من الهاتف كخلفية وبانر للبروفايل بنجاح 📱');
      setBannerCropModal({
        open: false,
        imageSrc: '',
        rawFile: null,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        isApplying: false,
      });
    } catch {
      toast.error('تعذر تطبيق الصورة — يرجى اختيار صورة أخرى');
      setBannerCropModal((prev) => ({ ...prev, isApplying: false }));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const guard = checkImpersonationAttempt(name, currentUser.username, currentUser.role, currentUser.id);
    if (guard.isImpersonation) {
      toast.error(guard.reason || 'هذا الاسم غير متاح حالياً');
      return;
    }
    setDataSaverEnabled(dataSaverMode);
    updateNotificationPreferences(currentUser.id, { directMessages: notifyDMs, gifts: notifyGifts });
    updateUserActivityStatus(currentUser.id, activityStatus);
    saveUserThemeSettings(currentUser.id, {
      isDarkMode: effectiveDarkMode,
      chatWallpaper: currentUser.chatWallpaper,
      fontPreference,
      muteJoinNotices,
      dataSaverMode,
      notificationBgPreset: readSavedNotificationBgPresetId(currentUser),
    }).catch(() => {});

    const allowCustomBannerSave =
      isVipUser ||
      profileBanner.startsWith('data:image/') ||
      profileBanner.startsWith('http') ||
      profileBanner.startsWith('/');

    onUpdateUser({
      name: name.trim() || currentUser.name,
      bio,
      country,
      countryFlag,
      zodiacSign,
      status: activityStatus,
      fontPreference,
      profileWallpaper: selectedWallpaper,
      frameStyle: selectedFrame,
      ...(allowCustomBannerSave ? { profileBanner } : {}),
      ...(isVipUser ? { favoriteMusicUrl: favoriteMusicUrl.trim() } : {}),
      avatar: avatarUrl,
      allowPrivateMessages,
      muteJoinNotices,
      dataSaverMode,
      notificationPrefs: { directMessages: notifyDMs, gifts: notifyGifts } as any
    });
    toast.success('تم حفظ كافة التغييرات وتحديث ملفك الشخصي فوراً ✅');
  };

  const hasCustomBannerActive =
    isVipUser ||
    profileBanner.startsWith('data:image/') ||
    profileBanner.startsWith('http') ||
    profileBanner.startsWith('/');
  const effectiveHeroCover = hasCustomBannerActive ? profileBanner : selectedWallpaper;

  const maskedAccountEmail = (() => {
    const rawEmail =
      (currentUser as any).email ||
      (typeof window !== 'undefined' ? localStorage.getItem('arab_chat_auth_email') || '' : '');
    return rawEmail ? maskEmail(rawEmail) : 'غير مرتبط';
  })();

  const maskedAccountPhone = (() => {
    const rawPhone = (currentUser as any).phoneNumber || (currentUser as any).phone || '';
    return rawPhone ? maskPhone(rawPhone) : 'غير مرتبط';
  })();

  return (
    <div className="pb-28 pt-3 px-3 sm:px-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      
      {/* Hidden File Inputs for Avatar & Custom Banner Device Gallery Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleCustomFileUpload} 
        accept="image/*" 
        className="hidden" 
      />
      <input
        type="file"
        ref={bannerFileInputRef}
        onChange={handleBannerFileSelected}
        accept="image/*"
        className="hidden"
      />

      {/* Header Profile Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-md bg-white">
        {/* Larger Top Cover Wallpaper / Unified Custom Banner */}
        <div
          className="h-40 sm:h-52 w-full overflow-hidden relative"
          style={resolveBannerStyle(effectiveHeroCover)}
        >
          {!resolveBannerStyle(effectiveHeroCover) && (
            <img
              src={selectedWallpaper}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-white/25 dark:via-slate-900/35 to-black/15" />
          <button
            type="button"
            onClick={() => bannerFileInputRef.current?.click()}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900/65 hover:bg-slate-900/85 backdrop-blur-sm text-white text-[10.5px] font-black border border-white/25 shadow-sm active:scale-95 transition cursor-pointer"
            title="اختيار بانر أو خلفية من الهاتف"
          >
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span>تغيير الغلاف من الهاتف</span>
          </button>
          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/65 backdrop-blur-sm text-white text-[10.5px] font-black border border-white/20">
            <Eye className="w-3 h-3 text-amber-300" />
            <span>زيارات البروفايل: {(currentUser.profileVisitsCount || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="px-4 sm:px-5 pb-4 pt-0 relative -mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex items-end gap-3.5 min-w-0">
            {/* Avatar with Click to Change */}
            <div className="relative group cursor-pointer shrink-0" onClick={() => { setShowAvatarModal(true); setAvatarModalMode('choose'); }}>
              <AvatarWithFrame
                user={{ ...currentUser, avatar: avatarUrl, frameStyle: selectedFrame, status: activityStatus }}
                size="lg"
                showOnlineDot
              />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold z-20">
                تغيير 📷
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className={`text-base sm:text-lg ${rankMeta.nameColorClass}`}>{name}</h2>
                <VerifiedBadge verified={Boolean(currentUser.verified || currentUser.role === 'owner')} size="md" />
                <span className="text-base">{countryFlag}</span>
                {zodiacSign && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {zodiacSign}
                  </span>
                )}
                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full flex items-center gap-1 ${currentStatusMeta.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dotClass}`} />
                  <span>{currentStatusMeta.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {rankMeta.isPrivileged ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-black border flex items-center gap-1 ${rankMeta.badgeClass}`}>
                    <span>{rankMeta.label}</span>
                  </span>
                ) : (
                  <span className="text-slate-600 font-bold text-[11px]">{rankMeta.label}</span>
                )}
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 text-[11px]">@{currentUser.username}</span>
              </div>
            </div>
          </div>

          {!isStrictOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenVip}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-xs active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                ترقية VIP 👑
              </button>
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                المحفظة 🪙
              </button>
            </div>
          )}
        </div>

        {/* Clean Integrated Bio Display directly beneath avatar/name */}
        {bio.trim() && (
          <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-slate-100/80">
            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
              {bio}
            </p>
          </div>
        )}
      </div>

      {/* Horizontally Scrollable 3 Tabs Navigation (Full-Width Pills, Zero Clipping) */}
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 min-w-max sm:min-w-0 w-full">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المعلومات الأساسية 📝
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المظهر والتخصيص 🎨
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الحساب والأمان 📱
          </button>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="space-y-4">

        {/* TAB 1: Basic Info */}
        {activeTab === 'info' && (
          <div key="tab-info" className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900">المعلومات الأساسية والهوية</h3>
              <span className="text-[10.5px] font-bold text-indigo-600 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{(currentUser.profileVisitsCount || 0).toLocaleString()} زيارة</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الاسم المستعار:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الدولة والعلم:</label>
                <select
                  value={country}
                  onChange={(e) => {
                    const found = countries.find(c => c.name === e.target.value);
                    setCountry(e.target.value);
                    if (found) setCountryFlag(found.flag);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {countries.map(c => (
                    <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Activity Status Dropdown (Synced in real-time with Firebase) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <label
                  htmlFor="profile-activity-status"
                  className="text-xs font-black text-slate-800 flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>حالة النشاط:</span>
                </label>

                <select
                  id="profile-activity-status"
                  value={activityStatus}
                  onChange={(e) => handleStatusChange(e.target.value as User['status'])}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
                >
                  {ACTIVITY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zodiac Sign Selector */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <label
                  htmlFor="profile-zodiac-sign"
                  className="text-xs font-black text-slate-800 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>البرج الفلكي:</span>
                </label>

                <select
                  id="profile-zodiac-sign"
                  value={zodiacSign}
                  onChange={(e) => setZodiacSign(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500 shadow-xs cursor-pointer"
                >
                  <option value="">غير محدد</option>
                  {ZODIAC_SIGNS.map((sign) => (
                    <option key={sign} value={sign}>
                      {sign}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">النبذة التعريفية (Bio):</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="اكتب عبارة تعبر عنك وعن طيب أخلاقك..."
              />
            </div>

            {/* Private Messages Toggle */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  allowPrivateMessages ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {allowPrivateMessages ? <MessageSquare className="w-4 h-4" /> : <MessageSquareOff className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">استقبال الرسائل الخاصة</h4>
                  <p className="text-[10px] text-slate-500">
                    {allowPrivateMessages ? 'مسموح للجميع بمراسلتك' : 'معطل لحماية الخصوصية'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAllowPrivateMessages(!allowPrivateMessages)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 flex items-center shrink-0 ${
                  allowPrivateMessages ? 'bg-emerald-500 justify-start' : 'bg-slate-300 justify-end'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Appearance & Customization */}
        {activeTab === 'appearance' && (
          <div key="tab-appearance" className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900">المظهر والتخصيص</h3>
              <span className="text-[10.5px] font-bold text-purple-600">تأثير فوري على التطبيق</span>
            </div>
            {/* Dark Mode Toggle Setting Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  effectiveDarkMode
                    ? 'bg-indigo-500/20 border-indigo-400/40 text-amber-300'
                    : 'bg-indigo-100 border-indigo-200 text-indigo-600'
                }`}>
                  {effectiveDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900">الوضع الليلي (Dark Mode)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-snug">
                    {effectiveDarkMode
                      ? 'مفعل — ألوان داكنة مريحة للعين ونصوص فاتحة واضحة'
                      : 'معطل — التبديل إلى الثيم الداكن المريح للعين'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={effectiveDarkMode}
                aria-label="تبديل الوضع الليلي"
                onClick={handleToggleDarkMode}
                className={`w-12 h-6.5 rounded-full transition-colors flex items-center p-1 shrink-0 cursor-pointer ${
                  effectiveDarkMode ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <span className="w-4.5 h-4.5 rounded-full bg-white shadow-md block" />
              </button>
            </div>

            {/* Fonts */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-600" />
                نوع الخط في الدردشة:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cairo', name: 'خط كايرو', font: 'font-["Cairo"]' },
                  { id: 'tajawal', name: 'خط تجوال الأنيق', font: 'font-["Tajawal"]' },
                  { id: 'amiri', name: 'خط أميري الملكي', font: 'font-["Amiri"]' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontPreference(f.id as any)}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      fontPreference === f.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className={`text-[11px] block ${f.font}`}>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Merged Profile Banners & Wallpapers + Phone Gallery Picker */}
            <div className="p-3.5 rounded-2xl bg-slate-50/85 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-purple-600" />
                  <span>البانرات وخلفيات البروفايل الموحدة</span>
                </label>
                {!isVipUser && (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> التدرجات الملكية لـ VIP
                  </span>
                )}
              </div>

              {/* Phone Selection Card + Active Cover Preview */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="flex-1 min-w-[200px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>اختيار بانر أو خلفية من الهاتف 📱</span>
                  </button>
                  {effectiveHeroCover !== '/assets/wallpapers/nature_nile_sunset.jpg' && (
                    <button
                      type="button"
                      onClick={() => {
                        const defUrl = '/assets/wallpapers/nature_nile_sunset.jpg';
                        setProfileBanner(defUrl);
                        setSelectedWallpaper(defUrl);
                        onUpdateUser({ profileBanner: defUrl, profileWallpaper: defUrl });
                        toast.info('تمت استعادة الخلفية الافتراضية');
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black cursor-pointer"
                    >
                      استعادة الافتراضي
                    </button>
                  )}
                </div>

                {/* Live Active Cover Preview (16:5) */}
                <div
                  className="relative rounded-xl overflow-hidden border border-indigo-200 aspect-[16/5] bg-slate-200 shadow-inner"
                  style={resolveBannerStyle(effectiveHeroCover)}
                >
                  {!resolveBannerStyle(effectiveHeroCover) && (
                    <img
                      src={selectedWallpaper}
                      alt="معاينة غلاف البروفايل"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded-md bg-slate-900/75 text-white text-[9.5px] font-black">
                    الغلاف والبانر النشط حالياً
                  </span>
                </div>
              </div>

              {/* Filter Tabs inside Merged Section */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-black">
                {[
                  { id: 'all', label: 'الكل ✨' },
                  { id: 'wallpapers', label: 'خلفيات طبيعية 🌿' },
                  { id: 'banners', label: 'بانرات ملكية 👑' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCoverFilter(tab.id as 'all' | 'wallpapers' | 'banners')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer ${
                      coverFilter === tab.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Natural & Heritage Wallpapers */}
              {(coverFilter === 'all' || coverFilter === 'wallpapers') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {wallpapers.map((w, idx) => {
                    const locked = w.isVipOnly && !isVipUser;
                    const isSelected = effectiveHeroCover === w.url;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            onOpenVip();
                          } else {
                            setSelectedWallpaper(w.url);
                            setProfileBanner(w.url);
                            onUpdateUser({ profileWallpaper: w.url, profileBanner: w.url });
                            toast.success(`تم تطبيق "${w.name}" كخلفية وبانر للبروفايل 🎨`);
                          }
                        }}
                        className={`relative rounded-xl overflow-hidden cursor-pointer h-16 border-2 transition-all text-right ${
                          isSelected ? 'border-amber-500 ring-2 ring-amber-300/60 scale-[1.02]' : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <img src={w.url} alt={w.name} className={`w-full h-full object-cover ${locked ? 'filter blur-[1px] brightness-50' : ''}`} />
                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-[10.5px] text-white font-black text-center px-1.5">
                          {locked ? (
                            <span className="flex items-center gap-1 text-amber-300">
                              <Lock className="w-3 h-3" /> {w.name}
                            </span>
                          ) : (
                            w.name
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Royal Gradient Banners */}
              {(coverFilter === 'all' || coverFilter === 'banners') && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROFILE_BANNER_PRESETS.map((preset) => {
                      const isSelected = isVipUser && effectiveHeroCover === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (!isVipUser) {
                              onOpenVip();
                              return;
                            }
                            setProfileBanner(preset.id);
                            onUpdateUser({ profileBanner: preset.id });
                            toast.success(`تم تفعيل بانر "${preset.label}" بنجاح 👑`);
                          }}
                          style={{ background: preset.preview }}
                          className={`relative p-2.5 h-14 rounded-xl text-white text-[10.5px] font-black flex items-center justify-center gap-1 text-center border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-400 ring-2 ring-amber-300 scale-[1.02]'
                              : 'border-white/40 opacity-90 hover:opacity-100'
                          }`}
                        >
                          {!isVipUser && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="url"
                    value={profileBanner.startsWith('http') ? profileBanner : ''}
                    onChange={(e) => setProfileBanner(e.target.value)}
                    placeholder="أو الصق رابط صورة بانر / خلفية مباشر (https://...)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Frames with VIP Lock */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  إطار الصورة الرمزية:
                </label>
                {!isVipUser && (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> الإطارات المضيئة حصرية لـ VIP
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {frames.map((fr, idx) => {
                  const locked = fr.isVipOnly && !isVipUser;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          onOpenVip();
                        } else {
                          setSelectedFrame(fr.class);
                        }
                      }}
                      className={`p-2 rounded-xl border text-center font-bold transition-all text-[11px] flex items-center justify-center gap-1 ${
                        selectedFrame === fr.class
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                      <span>{fr.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Favorite Music */}
            <div className="pt-3 border-t border-slate-100 space-y-4">

              {/* Custom Favorite Profile Music */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-600" />
                    <span>موسيقى البروفايل المفضلة 🎵</span>
                  </label>
                  {!isVipUser && (
                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> حصري لـ VIP والإدارة
                    </span>
                  )}
                </div>

                {isVipUser ? (
                  <div className="space-y-2">
                    <select
                      value={
                        FAVORITE_MUSIC_PRESETS.some((p) => p.url === favoriteMusicUrl)
                          ? favoriteMusicUrl
                          : '__custom__'
                      }
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          setFavoriteMusicUrl(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    >
                      {FAVORITE_MUSIC_PRESETS.map((p) => (
                        <option key={p.id} value={p.url}>
                          {p.label}
                        </option>
                      ))}
                      {favoriteMusicUrl &&
                        !FAVORITE_MUSIC_PRESETS.some((p) => p.url === favoriteMusicUrl) && (
                          <option value="__custom__">رابط مخصص 🎶</option>
                        )}
                    </select>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={favoriteMusicUrl}
                        onChange={(e) => setFavoriteMusicUrl(e.target.value)}
                        placeholder="أو الصق رابط ملف MP3 مباشر..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      />
                      {favoriteMusicUrl.trim() && (
                        <button
                          type="button"
                          onClick={toggleMusicPreview}
                          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isPreviewPlaying ? (
                            <>
                              <Square className="w-3.5 h-3.5" />
                              <span>إيقاف</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>تجربة</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenVip}
                    className="w-full p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Music className="w-3.5 h-3.5 text-purple-600" />
                    <span>ميزة إضافة نغمة موسيقية في البروفايل متاحة لكبار الشخصيات VIP</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Security, Notifications & App Settings */}
        {activeTab === 'security' && (
          <div key="tab-security" className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900">الحساب والأمان وإعدادات التنبيه</h3>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>

            {/* Masked Sensitive Account Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>بيانات الحساب المحمية (عرض مقنع للخصوصية)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">البريد الإلكتروني:</span>
                  <span className="font-mono font-black text-slate-800 dir-ltr">{maskedAccountEmail}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                  <span className="font-mono font-black text-slate-800 dir-ltr">{maskedAccountPhone}</span>
                </div>
              </div>
            </div>

            {/* Notification Preferences Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-black text-slate-900">تفضيلات الإشعارات والتنبيهات</h4>
              </div>

              <div className="space-y-3">
                {/* DM Notifications */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">إشعارات الرسائل الخاصة 💬</span>
                    <span className="text-[10px] text-slate-500">تلقي إشعارات فورية عند وصول رسالة خاصة من الأصدقاء</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifyDMs;
                      setNotifyDMs(next);
                      updateNotificationPreferences(currentUser.id, { directMessages: next, gifts: notifyGifts });
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notifyDMs ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Gift Notifications */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">إشعارات الهدايا الفاخرة 🎁</span>
                    <span className="text-[10px] text-slate-500">تلقي تنبيه واحتفال فور إرسال هدية إلى حسابك</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifyGifts;
                      setNotifyGifts(next);
                      updateNotificationPreferences(currentUser.id, { directMessages: notifyDMs, gifts: next });
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      notifyGifts ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Mute Room Join Notices Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <div className="text-right flex items-start gap-2">
                    <VolumeX className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">كتم تنبيهات دخول الأعضاء للغرف 🔕</span>
                      <span className="text-[10px] text-slate-500">إخفاء سطر دخول الأعضاء داخل غرف الدردشة العامة</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuteJoinNotices((prev) => !prev)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      muteJoinNotices ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Data Saver Mode Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <div className="text-right flex items-start gap-2">
                    <Wifi className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">وضع توفير البيانات 📶</span>
                      <span className="text-[10px] text-slate-500">تقليل التحميل المسبق للخلفيات والوسائط على باقات الهاتف</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !dataSaverMode;
                      setDataSaverMode(next);
                      setDataSaverEnabled(next);
                      toast.info(next ? 'تم تفعيل وضع توفير البيانات 📶' : 'تم إيقاف وضع توفير البيانات');
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      dataSaverMode ? 'bg-sky-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Mute Message Send Sound Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <div className="text-right flex items-start gap-2">
                    <VolumeX className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">كتم صوت إرسال الرسائل 🔇</span>
                      <span className="text-[10px] text-slate-500">إيقاف نغمة النقر عند إرسال رسائلك في الغرف أو الخاص</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !muteSendSound;
                      setMuteSendSound(next);
                      sounds.setSendSoundMuted(next);
                      toast.info(next ? 'تم كتم صوت إرسال الرسائل 🔇' : 'تم تفعيل صوت إرسال الرسائل 🔔');
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                      muteSendSound ? 'bg-rose-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Bubble Background Presets (10 Curated Presets with Live Preview) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-900">خلفية فقاعات الانضمام والإشعارات ✨</h4>
              </div>
              <NotificationBgSelector
                currentUser={currentUser}
                onUpdateUser={onUpdateUser}
                compact
              />
            </div>

            {/* Support & Contact Card */}
            <div id="support-contact-card" className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-right">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">الدعم والتواصل 🛠️</h4>
                  <p className="text-[10px] text-slate-500">تواصل معنا فوراً أو أرسل أي مشكلة تقنية تواجهك</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href="https://wa.me/201000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 rounded-xl bg-[#E6F4EA] hover:bg-[#d5ebd9] border border-[#C8E6D2] text-[#1A6B3C] text-[11px] font-black flex items-center justify-center gap-1 transition"
                >
                  <span>واتساب</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://t.me/shatmasr_support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-black flex items-center justify-center gap-1 transition"
                >
                  <span>تيليجرام</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="mailto:support@shatmasr.com?subject=دعم فني - شات مصر"
                  className="py-2 px-2 rounded-xl bg-[#F0EBFF] hover:bg-[#e5dcff] border border-[#DDD0FF] text-[#4C2A9E] text-[11px] font-black flex items-center justify-center gap-1 transition"
                >
                  <span>إيميل</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <p className="text-[11px] font-black text-slate-800">ابعت مشكلتك مباشرة للإدارة:</p>
                <select
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-400"
                >
                  <option value="مشكلة تقنية في التطبيق">مشكلة تقنية في التطبيق</option>
                  <option value="مشكلة في الاتصال أو الصوت">مشكلة في الاتصال أو الصوت</option>
                  <option value="استفسار عن الشحن أو VIP">استفسار عن الشحن أو VIP</option>
                  <option value="بلاغ أو شكوى عامة">بلاغ أو شكوى عامة</option>
                </select>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  rows={2}
                  placeholder="اكتب تفاصيل المشكلة وسنقوم بالرد عليك وحلها فوراً..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-none"
                />
                <button
                  type="button"
                  disabled={isSendingSupport || !supportMessage.trim()}
                  onClick={async () => {
                    if (!supportMessage.trim() || isSendingSupport) return;
                    setIsSendingSupport(true);
                    try {
                      await submitUserReport({
                        reporterId: currentUser.id,
                        reporterName: currentUser.name,
                        reportedUserId: 'platform_support',
                        reportedUserName: 'الدعم الفني لشات مصر',
                        reason: supportReason,
                        details: supportMessage.trim(),
                        timestamp: Date.now(),
                      });
                      setSupportMessage('');
                      toast.success('تم إرسال رسالتك إلى فريق الدعم الفني بنجاح ✅');
                    } catch {
                      toast.error('تعذر إرسال الرسالة حالياً، يرجى المحاولة مرة أخرى');
                    } finally {
                      setIsSendingSupport(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingSupport ? 'جاري الإرسال...' : 'إرسال المشكلة للدعم'}</span>
                </button>
              </div>
            </div>

            {/* PWA Direct Installation in Profile */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-right">
                <h4 className="text-xs font-bold text-slate-900">تثبيت التطبيق على الشاشة الرئيسية (PWA)</h4>
                <p className="text-[10px] text-slate-500">
                  تصفح فائق السرعة، ودخول فوري بدون متصفح وإشعارات مباشرة
                </p>
              </div>
              <PWAInstallButton variant="full" />
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>تسجيل الخروج من الحساب 🚪</span>
              </button>
            )}
          </div>
        )}

        {/* Unified Sticky Bottom Save Button */}
        <div className="sticky bottom-16 sm:bottom-3 z-40 pt-1">
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-98 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ كافة التغييرات الآن 💾</span>
          </button>
        </div>

      </form>

      {/* Custom Banner & Wallpaper Live Preview + Interactive Crop Modal (z-[200]) */}
      {bannerCropModal.open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in"
          dir="rtl"
          onClick={() =>
            !bannerCropModal.isApplying &&
            setBannerCropModal((prev) => ({ ...prev, open: false, imageSrc: '', rawFile: null }))
          }
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-2xl space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">معاينة وضبط الخلفية والبانر</h3>
                  <p className="text-[10.5px] text-slate-500">حرّك الصورة وكبّرها أو طبقها كاملة مباشرة</p>
                </div>
              </div>
              <button
                type="button"
                disabled={bannerCropModal.isApplying}
                onClick={() => setBannerCropModal((prev) => ({ ...prev, open: false, imageSrc: '', rawFile: null }))}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live 16:5 Cropping Preview Viewport */}
            <div className="relative w-full aspect-[16/5] rounded-2xl overflow-hidden border-2 border-indigo-400 bg-slate-900 shadow-inner">
              <img
                src={bannerCropModal.imageSrc}
                alt="معاينة البانر"
                className="w-full h-full object-cover transition-transform duration-75 select-none pointer-events-none"
                style={{
                  transform: `scale(${bannerCropModal.zoom}) translate(${bannerCropModal.offsetX * 0.4}%, ${bannerCropModal.offsetY * 0.4}%)`,
                  transformOrigin: 'center center',
                }}
              />
              <div className="pointer-events-none absolute inset-0 border border-white/30 rounded-2xl" />
            </div>

            {/* Zoom, X, Y Controls */}
            <div className="space-y-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-indigo-600" />
                    <span>التكبير (Zoom)</span>
                  </span>
                  <span className="font-mono">{bannerCropModal.zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={bannerCropModal.zoom}
                  onChange={(e) =>
                    setBannerCropModal((prev) => ({ ...prev, zoom: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الإزاحة الأفقية</span>
                  </span>
                  <span className="font-mono">{bannerCropModal.offsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={bannerCropModal.offsetX}
                  onChange={(e) =>
                    setBannerCropModal((prev) => ({ ...prev, offsetX: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <MoveVertical className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الإزاحة الرأسية</span>
                  </span>
                  <span className="font-mono">{bannerCropModal.offsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={bannerCropModal.offsetY}
                  onChange={(e) =>
                    setBannerCropModal((prev) => ({ ...prev, offsetY: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bannerCropModal.isApplying}
                  onClick={handleConfirmBannerCrop}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs shadow-sm active:scale-95 transition cursor-pointer"
                >
                  {bannerCropModal.isApplying ? 'جاري القص والحفظ...' : 'قص واعتماد الغلاف ✅'}
                </button>
                <button
                  type="button"
                  disabled={bannerCropModal.isApplying}
                  onClick={handleApplyFullPhoneCover}
                  className="px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 text-emerald-700 font-black text-xs active:scale-95 transition cursor-pointer"
                >
                  تطبيق كاملة
                </button>
              </div>
              <button
                type="button"
                disabled={bannerCropModal.isApplying}
                onClick={() =>
                  setBannerCropModal({
                    open: false,
                    imageSrc: '',
                    rawFile: null,
                    zoom: 1,
                    offsetX: 0,
                    offsetY: 0,
                    isApplying: false,
                  })
                }
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Avatar Selection Modal (z-[200]) */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-5 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-indigo-600">
                <Camera className="w-5 h-5" />
                <h3 className="text-sm font-black text-slate-900">تغيير الصورة الشخصية</h3>
              </div>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {avatarModalMode === 'choose' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  اختر الطريقة التي تفضلها لتحديث صورتك الرمزية:
                </p>

                {/* Option 1: Anime Avatars */}
                <button
                  type="button"
                  onClick={() => setAvatarModalMode('anime')}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 hover:border-purple-400 text-right flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎨</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 group-hover:text-purple-700">
                        اختر صورة أنمي جاهزة
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        مجموعة حصرية من أرقى شخصيات الأنمي العربية والملكية
                      </p>
                    </div>
                  </div>
                  <span className="text-purple-600 font-bold text-xs">عرض ❯</span>
                </button>

                {/* Option 2: Upload from Device */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 hover:border-teal-400 text-right flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 group-hover:text-teal-700">
                        تحميل صورة من جهازي
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        فتح الاستوديو لاختيار صورة خاصة من هاتفك أو حاسوبك
                      </p>
                    </div>
                  </div>
                  <span className="text-teal-600 font-bold text-xs">رفع ❯</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">اختر صورتك المفضلة:</span>
                  <button
                    type="button"
                    onClick={() => setAvatarModalMode('choose')}
                    className="text-[11px] text-indigo-600 hover:underline font-bold"
                  >
                    ❮ رجوع
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {ANIME_AVATARS.map((anime) => (
                    <div
                      key={anime.id}
                      onClick={() => handleSelectAnime(anime.url)}
                      className="cursor-pointer group relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 hover:border-purple-500 transition-all hover:scale-105 shadow-sm"
                    >
                      <img src={anime.url} alt={anime.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] text-white font-bold text-center p-0.5">
                        {anime.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
