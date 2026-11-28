import React, { useState, useRef, useEffect } from 'react';
import {
  Crown,
  Save,
  Palette,
  Camera,
  MessageSquare,
  MessageSquareOff,
  LogOut,
  X,
  Lock,
  Activity,
  Music,
  Play,
  Square,
  Image as ImageIcon,
  Upload,
  ZoomIn,
  MoveHorizontal,
  MoveVertical,
  Eye,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Users,
  Clock,
} from 'lucide-react';
import { User } from '../types/chat';
import {
  isUserAdminOrOwner,
  BOYS_AVATAR_PRESETS,
  GIRLS_AVATAR_PRESETS,
} from '../data/seedData';
import {
  getRankDisplayMeta,
  hasPrivilegedRank,
  PROFILE_BANNER_PRESETS,
  resolveBannerStyle,
} from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import {
  updateUserActivityStatus,
  subscribeToProfileVisitors,
  subscribeToProfileVisitsCount,
  ProfileVisitorItem,
} from '../services/firebase';
import { compressImageFile, cropBannerToDataUrl } from '../utils/imageCompression';
import { checkImpersonationAttempt, VerifiedBadge } from '../utils/verifiedBadge';
import { formatArabicDate, formatRelativeArabicTime, getVipDurationInfo } from '../utils/dateFormat';
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
  'الحوت ♓',
];

const FAVORITE_MUSIC_PRESETS = [
  { id: 'none', label: 'بدون موسيقى مفضلة', url: '' },
  {
    id: 'umm_kulthum',
    label: 'أم كلثوم — أنت الحب 🎙️',
    url: 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/01%20Inta%20Al%20Hob.mp3',
  },
  {
    id: 'abdel_halim',
    label: 'عبد الحليم — على حسب وداد 🎻',
    url: 'https://archive.org/download/y-2mate.com-ala-hesb-wedad-abdel-halim-hafez_202305/y2mate.com%20-%20Ala%20Hesb%20Wedad%20%20Abdel%20Halim%20Hafez%20%20%D8%B9%D9%84%D9%89%20%D8%AD%D8%B3%D8%A8%20%D9%88%D8%AF%D8%A7%D8%AF%20%D9%82%D9%84%D8%A8%D9%89%20%20%D8%B9%D8%A8%D8%AF%20%D8%A7%D9%84%D8%AD%D9%84%D9%8A%D9%85%20%D8%AD%D8%A7%D9%81%D8%B8.mp3',
  },
  {
    id: 'amr_diab',
    label: 'عمرو دياب — راجعين 🎵',
    url: 'https://archive.org/download/ragein/01%20Ragein.mp3',
  },
  {
    id: 'khaleeji',
    label: 'طرب خليجي — يا ابن الأوادم ✨',
    url: 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%AC%D9%8A%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87%20-%20%D9%8a%D8%A7%20%D8%A3%D8%A8%D9%86%20%D8%A7%D9%84%D8%A7%D9%88%D8%A7%D8%AF%D9%85%20%28%D8%A3%D9%84%D8%A8%D9%88%D9%85%20%D8%B9%D8%A7%D9%84%D9%85%20%D9%85%D9%88%D8%A7%D8%B2%D9%8a%29%20_%202021%20%28128%20kbps%29.mp3',
  },
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
    badgeClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
  },
  {
    value: 'busy',
    label: 'مشغول',
    emoji: '🟡',
    dotClass: 'bg-amber-500',
    badgeClass: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
  },
  {
    value: 'dnd',
    label: 'لا تزعجني',
    emoji: '🔴',
    dotClass: 'bg-rose-500',
    badgeClass: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
  },
  {
    value: 'in_mic',
    label: 'متواجد في مجلس صوتي',
    emoji: '🎙️',
    dotClass: 'bg-purple-500',
    badgeClass: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
  },
];

function formatVisitorRelativeTime(ts: number): string {
  return formatRelativeArabicTime(ts);
}

interface ProfileViewProps {
  currentUser: User;
  onUpdateUser: (updatedUser: Partial<User>) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  openToSupport?: boolean;
  onConsumeSupportScroll?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateUser,
  onOpenWallet,
  onOpenVip,
  onOpenSettings,
  onLogout,
  openToSupport = false,
  onConsumeSupportScroll,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [country, setCountry] = useState(currentUser.country || 'مصر');
  const [countryFlag, setCountryFlag] = useState(currentUser.countryFlag || '🇪🇬');
  const [zodiacSign, setZodiacSign] = useState(currentUser.zodiacSign || '');
  const [activityStatus, setActivityStatus] = useState<User['status']>(currentUser.status || 'online');
  const [selectedWallpaper, setSelectedWallpaper] = useState(
    currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg'
  );
  const [selectedFrame, setSelectedFrame] = useState(currentUser.frameStyle || 'border-slate-600');
  const [profileBanner, setProfileBanner] = useState(
    currentUser.profileBanner || currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg'
  );
  const [coverFilter, setCoverFilter] = useState<'all' | 'wallpapers' | 'banners'>('all');
  const [favoriteMusicUrl, setFavoriteMusicUrl] = useState(currentUser.favoriteMusicUrl || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const [allowPrivateMessages, setAllowPrivateMessages] = useState<boolean>(
    currentUser.allowPrivateMessages !== false
  );
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarModalMode, setAvatarModalMode] = useState<'choose' | 'anime'>('choose');

  // Real-time Profile Visitors list & live visits count state
  const [profileVisitors, setProfileVisitors] = useState<ProfileVisitorItem[]>([]);
  const [liveVisitsCount, setLiveVisitsCount] = useState<number>(currentUser.profileVisitsCount || 0);
  const [isVisitorsModalOpen, setIsVisitorsModalOpen] = useState(false);

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

  useEffect(() => {
    setName(currentUser.name);
    setBio(currentUser.bio || '');
    setCountry(currentUser.country || 'مصر');
    setCountryFlag(currentUser.countryFlag || '🇪🇬');
    setZodiacSign(currentUser.zodiacSign || '');
    setAvatarUrl(currentUser.avatar);
    setAllowPrivateMessages(currentUser.allowPrivateMessages !== false);
    if (currentUser.status) setActivityStatus(currentUser.status);
    if (currentUser.profileWallpaper) setSelectedWallpaper(currentUser.profileWallpaper);
    if (currentUser.frameStyle) setSelectedFrame(currentUser.frameStyle);
    if (currentUser.profileBanner || currentUser.profileWallpaper) {
      setProfileBanner(currentUser.profileBanner || currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg');
    }
    if (typeof currentUser.favoriteMusicUrl === 'string') {
      setFavoriteMusicUrl(currentUser.favoriteMusicUrl);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser.id) return;
    const unsub = subscribeToProfileVisitors(currentUser.id, setProfileVisitors);
    const unsubCount = subscribeToProfileVisitsCount(currentUser.id, setLiveVisitsCount);
    return () => {
      unsub();
      unsubCount();
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (openToSupport) {
      onOpenSettings?.();
      onConsumeSupportScroll?.();
    }
  }, [openToSupport, onOpenSettings, onConsumeSupportScroll]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const currentStatusMeta =
    ACTIVITY_STATUS_OPTIONS.find((opt) => opt.value === activityStatus) || ACTIVITY_STATUS_OPTIONS[0];

  const handleStatusChange = async (nextStatus: User['status']) => {
    setActivityStatus(nextStatus);
    onUpdateUser({ status: nextStatus });
    await updateUserActivityStatus(currentUser.id, nextStatus);
    const meta =
      ACTIVITY_STATUS_OPTIONS.find((opt) => opt.value === nextStatus) || ACTIVITY_STATUS_OPTIONS[0];
    toast.success(`تم تحديث حالة النشاط إلى "${meta.label}" ${meta.emoji}`, {
      description: 'تظهر حالتك الآن للأصدقاء بشكل لحظي',
    });
  };

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
    audio
      .play()
      .then(() => setIsPreviewPlaying(true))
      .catch(() => setIsPreviewPlaying(false));
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
    { name: 'إمبراطوري بنفسجي', class: 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]', isVipOnly: true },
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

  const handleSelectAvatarPreset = (url: string) => {
    setAvatarUrl(url);
    onUpdateUser({ avatar: url });
    setShowAvatarModal(false);
    toast.success('تم اختيار الصورة الرمزية بنجاح ✨');
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
    const guard = checkImpersonationAttempt(
      name,
      currentUser.username,
      currentUser.role,
      currentUser.id
    );
    if (guard.isImpersonation) {
      toast.error(guard.reason || 'هذا الاسم غير متاح حالياً');
      return;
    }

    updateUserActivityStatus(currentUser.id, activityStatus);

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
      profileWallpaper: selectedWallpaper,
      frameStyle: selectedFrame,
      ...(allowCustomBannerSave ? { profileBanner } : {}),
      ...(isVipUser ? { favoriteMusicUrl: favoriteMusicUrl.trim() } : {}),
      avatar: avatarUrl,
      allowPrivateMessages,
    });
    toast.success('تم حفظ كافة التغييرات وتحديث ملفك الشخصي فوراً ✅');
  };

  const hasCustomBannerActive =
    isVipUser ||
    profileBanner.startsWith('data:image/') ||
    profileBanner.startsWith('http') ||
    profileBanner.startsWith('/');
  const effectiveHeroCover = hasCustomBannerActive ? profileBanner : selectedWallpaper;
  const totalVisitsDisplay = Math.max(
    currentUser.profileVisitsCount || 0,
    liveVisitsCount || 0,
    profileVisitors.length
  );

  return (
    <div className="pb-28 pt-3 px-3 sm:px-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      {/* Hidden File Inputs for Avatar & Custom Banner Upload */}
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

      {/* Profile Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900">
        {/* Top Cover Wallpaper / Banner */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-white/25 dark:via-slate-900/40 to-black/15" />

          <button
            type="button"
            onClick={() => bannerFileInputRef.current?.click()}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900/65 hover:bg-slate-900/85 backdrop-blur-sm text-white text-[10.5px] font-black border border-white/25 shadow-sm transition cursor-pointer"
            title="اختيار بانر أو خلفية من الهاتف"
          >
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span>تغيير الغلاف من الهاتف</span>
          </button>

          {/* Compact Eye + Count Visits Badge (Clickable to open Visitors Modal) */}
          <button
            type="button"
            onClick={() => setIsVisitorsModalOpen(true)}
            title="عرض زوار البروفايل"
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-sm text-white text-[11px] font-black border border-white/25 shadow-sm transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            <span className="tabular-nums">{totalVisitsDisplay.toLocaleString()}</span>
          </button>
        </div>

        {/* Profile Info Row: Avatar stacked cleanly above full-width display name & details */}
        <div className="px-4 sm:px-5 pb-3 pt-0 relative -mt-12 flex flex-col gap-3">
          <div className="flex flex-col items-start gap-2.5 w-full min-w-0">
            <div
              className="relative group cursor-pointer shrink-0 w-fit"
              onClick={() => {
                setShowAvatarModal(true);
                setAvatarModalMode('choose');
              }}
            >
              <AvatarWithFrame
                user={{
                  ...currentUser,
                  avatar: avatarUrl,
                  frameStyle: selectedFrame,
                  status: activityStatus,
                }}
                size="lg"
                showOnlineDot
              />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold z-20">
                تغيير 📷
              </div>
            </div>

            <div className="w-full space-y-1.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap w-full min-w-0">
                <h2 className={`text-lg sm:text-xl font-black leading-snug break-words ${rankMeta.nameColorClass}`}>
                  {name}
                </h2>
                <VerifiedBadge
                  verified={Boolean(currentUser.verified || currentUser.role === 'owner')}
                  size="md"
                />
                <span className="text-base shrink-0">{countryFlag}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs flex-wrap w-full">
                {rankMeta.isPrivileged ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-black border flex items-center gap-1 ${rankMeta.badgeClass}`}
                  >
                    <span>{rankMeta.label}</span>
                  </span>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                    {rankMeta.label}
                  </span>
                )}
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  @{currentUser.username}
                </span>
                <span
                  className={`text-[10px] font-bold border px-2 py-0.5 rounded-full flex items-center gap-1 ${currentStatusMeta.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dotClass}`} />
                  <span>{currentStatusMeta.label}</span>
                </span>
                {zodiacSign && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {zodiacSign}
                  </span>
                )}
                {(() => {
                  const vipInfo = getVipDurationInfo(currentUser);
                  if (!vipInfo.isVipTier || vipInfo.isExpired) return null;
                  return (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      ⏳ VIP: {vipInfo.remainingLabel}
                      {vipInfo.expiresAt ? ` (حتى ${formatArabicDate(vipInfo.expiresAt)})` : ''}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Action Pills Directly Above Bio: المحفظة + ترقية VIP + المظهر والتخصيص */}
          <div className="flex flex-wrap items-center gap-2">
            {!isStrictOwner && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                المحفظة 🪙
              </button>
            )}
            {!isStrictOwner && (
              <button
                type="button"
                onClick={onOpenVip}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-xs shadow-sm transition-colors cursor-pointer"
              >
                ترقية VIP 👑
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>المظهر والتخصيص</span>
              </button>
            )}
          </div>
        </div>

        {/* Bio Display directly beneath pills */}
        {bio.trim() && (
          <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {bio}
            </p>
          </div>
        )}
      </div>

      {/* Unified Compact Stacked Profile Form with divide-y */}
      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
          {/* Row 1: Identity Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
              المعلومات الأساسية والهوية
            </h3>
            <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
              ملفك الشخصي
            </span>
          </div>

          {/* Row 2: Name & Country */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                الاسم المستعار:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                الدولة والعلم:
              </label>
              <select
                value={country}
                onChange={(e) => {
                  const found = countries.find((c) => c.name === e.target.value);
                  setCountry(e.target.value);
                  if (found) setCountryFlag(found.flag);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                {countries.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Activity Status & Zodiac Sign */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="profile-activity-status"
                className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>حالة النشاط:</span>
              </label>
              <select
                id="profile-activity-status"
                value={activityStatus}
                onChange={(e) => handleStatusChange(e.target.value as User['status'])}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {ACTIVITY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-zodiac-sign"
                className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>البرج الفلكي:</span>
              </label>
              <select
                id="profile-zodiac-sign"
                value={zodiacSign}
                onChange={(e) => setZodiacSign(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
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

          {/* Row 4: Bio */}
          <div className="p-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              النبذة التعريفية (Bio):
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="اكتب عبارة تعبر عنك وعن طيب أخلاقك..."
            />
          </div>

          {/* Row 5: Allow Private Messages Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  allowPrivateMessages
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}
              >
                {allowPrivateMessages ? (
                  <MessageSquare className="w-4 h-4" />
                ) : (
                  <MessageSquareOff className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  استقبال الرسائل الخاصة
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {allowPrivateMessages ? 'مسموح للجميع بمراسلتك' : 'معطل لحماية الخصوصية'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAllowPrivateMessages(!allowPrivateMessages)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 flex items-center shrink-0 cursor-pointer ${
                allowPrivateMessages
                  ? 'bg-emerald-500 justify-start'
                  : 'bg-slate-300 dark:bg-slate-700 justify-end'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
            </button>
          </div>

          {/* Row 6: Compact Collapsible Cover, Frame & Favorite Music */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <button
              type="button"
              onClick={() => setIsCustomizationOpen((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  تخصيص الغلاف، الإطار والموسيقى
                </span>
              </div>
              {isCustomizationOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
            </button>

            {isCustomizationOpen && (
              <div className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
                {/* Banners & Wallpapers */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>بانر وخلفية البروفايل</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>من الهاتف</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black">
                    {[
                      { id: 'all', label: 'الكل' },
                      { id: 'wallpapers', label: 'خلفيات طبيعية' },
                      { id: 'banners', label: 'بانرات ملكية' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCoverFilter(tab.id as 'all' | 'wallpapers' | 'banners')}
                        className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer ${
                          coverFilter === tab.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

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
                                toast.success(`تم تطبيق "${w.name}" بنجاح 🎨`);
                              }
                            }}
                            className={`relative rounded-xl overflow-hidden cursor-pointer h-14 border-2 transition text-right ${
                              isSelected
                                ? 'border-amber-500 ring-2 ring-amber-300/60'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <img
                              src={w.url}
                              alt={w.name}
                              className={`w-full h-full object-cover ${locked ? 'blur-[1px] brightness-50' : ''}`}
                            />
                            <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-[10px] text-white font-black text-center px-1">
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

                  {(coverFilter === 'all' || coverFilter === 'banners') && (
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
                            className={`relative p-2 h-12 rounded-xl text-white text-[10px] font-black flex items-center justify-center gap-1 text-center border-2 transition cursor-pointer ${
                              isSelected
                                ? 'border-amber-400 ring-2 ring-amber-300'
                                : 'border-white/40 opacity-90 hover:opacity-100'
                            }`}
                          >
                            {!isVipUser && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                            <span>{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Avatar Frames */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>إطار الصورة الرمزية:</span>
                    </label>
                    {!isVipUser && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> لـ VIP
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
                          className={`p-2 rounded-xl border text-center font-bold transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                            selectedFrame === fr.class
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>موسيقى البروفايل المفضلة 🎵</span>
                    </label>
                    {!isVipUser && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> VIP والإدارة
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
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
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
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
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
                      className="w-full p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Music className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>متاحة لكبار الشخصيات VIP</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 7: Optional Logout Action */}
          {onLogout && (
            <div className="p-3.5">
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>تسجيل الخروج من الحساب</span>
              </button>
            </div>
          )}
        </div>

        {/* Calm Save Button (No Bounce / Float) */}
        <div className="pt-1">
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات</span>
          </button>
        </div>
      </form>

      {/* Profile Visitors Modal (z-[200]) */}
      {isVisitorsModalOpen && (
        <div
          dir="rtl"
          onClick={() => setIsVisitorsModalOpen(false)}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[82vh] text-right"
          >
            <div className="p-4 bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    زوار البروفايل ({totalVisitsDisplay.toLocaleString()})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    الأعضاء الذين زاروا ملفك الشخصي مؤخراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVisitorsModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-2 bg-slate-50/60 dark:bg-slate-950/60">
              {profileVisitors.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                    لا توجد زيارات مسجلة بعد
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    عند دخول أي عضو لملفك الشخصي سيظهر اسمه ووقت الزيارة هنا
                  </p>
                </div>
              ) : (
                profileVisitors.map((visitor) => {
                  const vMeta = getRankDisplayMeta(visitor.visitorRole);
                  return (
                    <div
                      key={visitor.id || visitor.visitorId}
                      className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                          {visitor.visitorAvatar ? (
                            <img
                              src={visitor.visitorAvatar}
                              alt={visitor.visitorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                              {visitor.visitorName?.charAt(0) || '؟'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-xs font-black truncate ${vMeta.nameColorClass}`}>
                              {visitor.visitorName}
                            </span>
                            {vMeta.isPrivileged && (
                              <span
                                className={`px-1.5 py-0.2 rounded border text-[9px] font-black shrink-0 ${vMeta.badgeClass}`}
                              >
                                {vMeta.label}
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{formatVisitorRelativeTime(visitor.visitedAt)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Banner & Wallpaper Live Preview + Interactive Crop Modal (z-[200]) */}
      {bannerCropModal.open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm"
          dir="rtl"
          onClick={() =>
            !bannerCropModal.isApplying &&
            setBannerCropModal((prev) => ({
              ...prev,
              open: false,
              imageSrc: '',
              rawFile: null,
            }))
          }
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-2xl space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    معاينة وضبط الخلفية والبانر
                  </h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    حرّك الصورة وكبّرها أو طبقها كاملة مباشرة
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={bannerCropModal.isApplying}
                onClick={() =>
                  setBannerCropModal((prev) => ({
                    ...prev,
                    open: false,
                    imageSrc: '',
                    rawFile: null,
                  }))
                }
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

            <div className="space-y-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    <MoveVertical className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs shadow-sm transition cursor-pointer"
                >
                  {bannerCropModal.isApplying ? 'جاري القص والحفظ...' : 'قص واعتماد الغلاف ✅'}
                </button>
                <button
                  type="button"
                  disabled={bannerCropModal.isApplying}
                  onClick={handleApplyFullPhoneCover}
                  className="px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 disabled:opacity-50 text-emerald-700 dark:text-emerald-300 font-black text-xs transition cursor-pointer"
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
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Avatar Selection Modal with Balanced Boys & Girls Presets (z-[200]) */}
      {showAvatarModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm"
          dir="rtl"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-2xl text-right space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Camera className="w-5 h-5" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  تغيير الصورة الشخصية
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {avatarModalMode === 'choose' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  اختر الطريقة التي تفضلها لتحديث صورتك الرمزية:
                </p>

                <button
                  type="button"
                  onClick={() => setAvatarModalMode('anime')}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 border border-purple-200 dark:border-purple-800 hover:border-purple-400 text-right flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎨</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300">
                        اختر صورة رمزية جاهزة
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        مجموعة متوازنة للشباب والبنات بجودة عالية
                      </p>
                    </div>
                  </div>
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">
                    عرض ❯
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/50 dark:to-emerald-950/50 border border-teal-200 dark:border-teal-800 hover:border-teal-400 text-right flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        تحميل صورة من جهازي
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        فتح الاستوديو لاختيار صورة من هاتفك أو حاسوبك
                      </p>
                    </div>
                  </div>
                  <span className="text-teal-600 dark:text-teal-400 font-bold text-xs">
                    رفع ❯
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    اختر صورتك المفضلة:
                  </span>
                  <button
                    type="button"
                    onClick={() => setAvatarModalMode('choose')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                  >
                    ❮ رجوع
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-3 pr-0.5">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-sky-700 dark:text-sky-300">
                      أولاد / شباب 👨
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {BOYS_AVATAR_PRESETS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => handleSelectAvatarPreset(av.url)}
                          className="cursor-pointer group relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-sky-500 transition shadow-sm"
                        >
                          <img src={av.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] font-black text-pink-700 dark:text-pink-300">
                      بنات 👩
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {GIRLS_AVATAR_PRESETS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => handleSelectAvatarPreset(av.url)}
                          className="cursor-pointer group relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-pink-500 transition shadow-sm"
                        >
                          <img src={av.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
