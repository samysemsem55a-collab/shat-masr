import React, { useState, useRef, useEffect } from 'react';
import { 
  User as UserIcon, 
  Crown, 
  Sparkles, 
  Save, 
  Share2, 
  Type, 
  Palette, 
  Check, 
  Camera,
  Upload,
  MessageSquare,
  MessageSquareOff,
  LogOut,
  X,
  Lock,
  Flame,
  Mic,
  Trophy,
  Bell,
  BellOff,
  Activity
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { PWAInstallButton } from './PWAInstallButton';
import { updateNotificationPreferences, updateUserActivityStatus } from '../services/firebase';
import { toast } from 'sonner';

interface ProfileViewProps {
  currentUser: User;
  onUpdateUser: (updatedUser: Partial<User>) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onLogout?: () => void;
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
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'appearance' | 'security'>('info');
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [country, setCountry] = useState(currentUser.country || 'مصر');
  const [countryFlag, setCountryFlag] = useState(currentUser.countryFlag || '🇪🇬');
  const [activityStatus, setActivityStatus] = useState<User['status']>(currentUser.status || 'online');
  const [fontPreference, setFontPreference] = useState(currentUser.fontPreference || 'cairo');
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentUser.profileWallpaper || '/assets/wallpapers/nature_nile_sunset.jpg');
  const [selectedFrame, setSelectedFrame] = useState(currentUser.frameStyle || 'border-slate-600');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const [allowPrivateMessages, setAllowPrivateMessages] = useState<boolean>(currentUser.allowPrivateMessages !== false);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser.status && currentUser.status !== activityStatus) {
      setActivityStatus(currentUser.status);
    }
  }, [currentUser.status]);

  const currentStatusMeta =
    ACTIVITY_STATUS_OPTIONS.find(opt => opt.value === activityStatus) || ACTIVITY_STATUS_OPTIONS[0];

  const handleStatusChange = async (nextStatus: User['status']) => {
    setActivityStatus(nextStatus);
    sounds.playMessageSent();
    onUpdateUser({ status: nextStatus });
    await updateUserActivityStatus(currentUser.id, nextStatus);
    const meta = ACTIVITY_STATUS_OPTIONS.find(opt => opt.value === nextStatus) || ACTIVITY_STATUS_OPTIONS[0];
    toast.success(`تم تحديث حالة النشاط إلى "${meta.label}" ${meta.emoji}`, {
      description: 'تظهر حالتك الآن للأصدقاء بشكل لحظي'
    });
  };

  const isVipUser = currentUser.role === 'vip_diamond' || 
                    currentUser.role === 'vip_gold' || 
                    currentUser.role === 'vip_silver' || 
                    currentUser.role === 'vip_bronze' || 
                    currentUser.role === 'owner' || 
                    currentUser.role === 'super_admin';

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
    { name: 'المروج الخضراء 🌿', url: '/assets/wallpapers/nature_green_meadow.jpg', isVipOnly: true },
    { name: 'ليالي الواحة والنجوم 🌌', url: '/assets/wallpapers/nature_starry_oasis.jpg', isVipOnly: true },
  ];

  const frames = [
    { name: 'بسيط كلاسيكي', class: 'border-slate-600', isVipOnly: false },
    { name: 'ألماسي نيون مشع', class: 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]', isVipOnly: true },
    { name: 'ذهبي ملكي متوهج', class: 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]', isVipOnly: true },
    { name: 'إمبراطوري بنفسجي', class: 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]', isVipOnly: true }
  ];

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newUrl = event.target.result as string;
          setAvatarUrl(newUrl);
          onUpdateUser({ avatar: newUrl });
          setShowAvatarModal(false);
          sounds.playMessageSent();
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
    sounds.playMessageSent();
    toast.success('تم اختيار صورة الأفتار بنجاح ✨');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playMessageSent();
    updateNotificationPreferences(currentUser.id, { directMessages: notifyDMs, gifts: notifyGifts });
    updateUserActivityStatus(currentUser.id, activityStatus);
    onUpdateUser({
      name,
      bio,
      country,
      countryFlag,
      status: activityStatus,
      fontPreference,
      profileWallpaper: selectedWallpaper,
      frameStyle: selectedFrame,
      avatar: avatarUrl,
      allowPrivateMessages,
      notificationPrefs: { directMessages: notifyDMs, gifts: notifyGifts } as any
    });
    toast.success('تم حفظ التغييرات وتحديث ملفك الشخصي فوراً ✅');
  };

  return (
    <div className="pb-24 pt-3 px-3 sm:px-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      
      {/* Hidden File Input for Device Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleCustomFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Header Profile Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-md bg-white">
        {/* Cover Wallpaper */}
        <div className="h-28 sm:h-32 w-full overflow-hidden relative">
          <img 
            src={selectedWallpaper} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-black/10" />
        </div>

        {/* Profile Info Row */}
        <div className="px-4 pb-4 pt-0 relative -mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            {/* Avatar with Click to Change */}
            <div className="relative group cursor-pointer" onClick={() => { setShowAvatarModal(true); setAvatarModalMode('choose'); }}>
              <div className={`w-20 h-20 rounded-full overflow-hidden border-4 bg-white shrink-0 relative ${selectedFrame} transition-transform group-hover:scale-105 shadow-lg`}>
                <img 
                  src={avatarUrl} 
                  alt={name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                تغيير 📷
              </div>
              <span className={`absolute bottom-0 right-1 w-3.5 h-3.5 ${currentStatusMeta.dotClass} border-2 border-white rounded-full shadow-sm`} />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900">{name}</h2>
                <span className="text-base">{countryFlag}</span>
                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full flex items-center gap-1 ${currentStatusMeta.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dotClass}`} />
                  <span>{currentStatusMeta.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-amber-700 font-black flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  {currentUser.vipBadge || 'عضو نشط 🌟'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 text-[11px]">@{currentUser.username}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenVip}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              ترقية VIP 👑
            </button>
            <button
              onClick={onOpenWallet}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
            >
              المحفظة 🪙
            </button>
          </div>
        </div>
      </div>

      {/* Badges / Honors Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900">الأوسمة والتكريمات الملكية</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
            تفاعل مستمر
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col items-center">
            <Flame className="w-6 h-6 text-amber-500 mb-1" />
            <span className="text-[11px] font-bold text-slate-900">أكثر الأعضاء نشاطاً</span>
            <span className="text-[9px] text-amber-700 font-semibold mt-0.5">وسام التفاعل 🔥</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-50/60 border border-purple-200 flex flex-col items-center">
            <Mic className="w-6 h-6 text-purple-600 mb-1" />
            <span className="text-[11px] font-bold text-slate-900">أفضل مذيع صوتي</span>
            <span className="text-[9px] text-purple-700 font-semibold mt-0.5">وسام المايك 🎙️</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-cyan-50/60 border border-cyan-200 flex flex-col items-center">
            <Sparkles className="w-6 h-6 text-cyan-600 mb-1" />
            <span className="text-[11px] font-bold text-slate-900">عضو محترف Pro</span>
            <span className="text-[9px] text-cyan-700 font-semibold mt-0.5">وسام النخبة 🏆</span>
          </div>
        </div>
      </div>

      {/* Simplified Tabs Navigation */}
      <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'info'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          المعلومات الأساسية 📝
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'appearance'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          المظهر والتخصيص 🎨
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          الحساب والأمان 📱
        </button>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="space-y-4">

        {/* TAB 1: Basic Info */}
        {activeTab === 'info' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm">
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

            {/* Activity Status Dropdown (Synced in real-time with Firebase) */}
            <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-activity-status"
                  className="text-xs font-black text-slate-800 flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>حالة النشاط:</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${currentStatusMeta.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dotClass}`} />
                  <span>{currentStatusMeta.label}</span>
                </span>
              </div>

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

              <p className="text-[10px] text-slate-500">
                يتم تحديث حالتك في Firebase فوراً ليتمكن أصدقاؤك من رؤيتها بشكل لحظي.
              </p>
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

        {/* TAB 2: Appearance & Customization (Rank Gated) */}
        {activeTab === 'appearance' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
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

            {/* Wallpapers with VIP Lock */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  خلفية البروفايل:
                </label>
                {!isVipUser && (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> الخلفيات الملكية مخصصة لرتب VIP
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {wallpapers.map((w, idx) => {
                  const locked = w.isVipOnly && !isVipUser;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (locked) {
                          onOpenVip();
                        } else {
                          setSelectedWallpaper(w.url);
                        }
                      }}
                      className={`relative rounded-xl overflow-hidden cursor-pointer h-14 border-2 transition-all ${
                        selectedWallpaper === w.url ? 'border-amber-500 scale-[1.02]' : 'border-slate-200'
                      }`}
                    >
                      <img src={w.url} alt="" className={`w-full h-full object-cover ${locked ? 'filter blur-[1px] brightness-50' : ''}`} />
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-[10px] text-white font-bold text-center px-1">
                        {locked ? (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Lock className="w-3 h-3" /> VIP
                          </span>
                        ) : (
                          w.name
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
          </div>
        )}

        {/* TAB 3: Security, Notifications & PWA */}
        {activeTab === 'security' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
            {/* Notification Preferences Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-black text-slate-900">تفضيلات الإشعارات والتنبيهات</h4>
              </div>

              <div className="space-y-3">
                {/* DM Notifications */}
                <div className="flex items-center justify-between">
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
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                      notifyDMs ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Gift Notifications */}
                <div className="flex items-center justify-between">
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
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                      notifyGifts ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>
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
                className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>تسجيل الخروج من الحساب 🚪</span>
              </button>
            )}
          </div>
        )}

        {/* Global Fast Save Button */}
        <button
          type="submit"
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>حفظ كافة التغييرات الآن 💾</span>
        </button>

      </form>

      {/* Interactive Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" dir="rtl">
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
