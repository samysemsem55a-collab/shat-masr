import React, { useState } from 'react';
import { 
  Compass, 
  Crown, 
  Coins, 
  Search, 
  Mic, 
  Users, 
  Sparkles, 
  MessageSquare,
  Lock,
  Eye,
  Target,
  ArrowLeft,
  Flame,
  Radio,
  Volume2
} from 'lucide-react';
import { Room } from '../types/chat';

export interface SuggestedVoiceRoom {
  id: string;
  title: string;
  description: string;
  interestCategory: 'sports' | 'art' | 'culture' | 'tech' | 'gaming';
  interestLabel: string;
  interestIcon: string;
  matchScore: string;
  icon: string;
  accentGradient: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  activeSpeakers: number;
  activeListeners: number;
  topics: string[];
}

export const SUGGESTED_VOICE_ROOMS: SuggestedVoiceRoom[] = [
  {
    id: 'voice_room_sports',
    title: 'مجلس عشاق الرياضة والكرة العربية ⚽',
    description: 'تحليل مباشر لمباريات اليوم، الدوري المصري، الدوري السعودي، وديربيات العالم',
    interestCategory: 'sports',
    interestLabel: 'الرياضة وكرة القدم',
    interestIcon: '⚽',
    matchScore: '98% تطابق مع اهتمامك بالرياضة',
    icon: '⚽',
    accentGradient: 'from-emerald-500 via-teal-600 to-indigo-600',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    badgeText: 'text-emerald-700',
    activeSpeakers: 4,
    activeListeners: 42,
    topics: ['مباريات اليوم', 'الدوري المصري', 'كلاسيكو', 'تحليل تكتيكي']
  },
  {
    id: 'voice_room_art',
    title: 'صالون الطرب الأصيل وروائع النغم 🎨',
    description: 'أمسية طربية، عزف عود حي، ومواهب غنائية واستماع لأعذب روائع الست وحليم وفيروز',
    interestCategory: 'art',
    interestLabel: 'الفن والموسيقى والطرب',
    interestIcon: '🎨',
    matchScore: '99% تطابق مع اهتمامك بالفن والطرب',
    icon: '🎨',
    accentGradient: 'from-purple-500 via-pink-500 to-indigo-600',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-purple-700',
    activeSpeakers: 5,
    activeListeners: 58,
    topics: ['طربيات زمان', 'عزف عود', 'مواهب غنائية', 'فيروزيات']
  },
  {
    id: 'voice_room_culture',
    title: 'ديوان الأدب والثقافة والشعر العربي 📚',
    description: 'أمسيات شعرية نبطية وفصحى، نقاش كتب التراث والروايات، وحوارات فكرية راقية',
    interestCategory: 'culture',
    interestLabel: 'الثقافة والأدب والشعر',
    interestIcon: '📚',
    matchScore: '96% تطابق مع اهتمامك بالثقافة',
    icon: '📚',
    accentGradient: 'from-amber-500 via-orange-500 to-amber-600',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    badgeText: 'text-amber-700',
    activeSpeakers: 3,
    activeListeners: 35,
    topics: ['شعر فصيح', 'شعر نبطي', 'نقاش كتب', 'حوار فكري']
  },
  {
    id: 'voice_room_tech',
    title: 'ملتقى التقنية والذكاء الاصطناعي ورواد الأعمال 💡',
    description: 'حوارات تقنية في البرمجة، مشاريع الذكاء الاصطناعي، التجارة الرقمية وبناء الشركات',
    interestCategory: 'tech',
    interestLabel: 'التقنية وريادة الأعمال',
    interestIcon: '💡',
    matchScore: '94% تطابق مع اهتمامك بالتقنية',
    icon: '💡',
    accentGradient: 'from-cyan-500 via-blue-500 to-indigo-600',
    badgeBg: 'bg-cyan-50',
    badgeBorder: 'border-cyan-200',
    badgeText: 'text-cyan-700',
    activeSpeakers: 3,
    activeListeners: 29,
    topics: ['ذكاء اصطناعي', 'برمجة', 'ريادة أعمال', 'تسويق']
  },
  {
    id: 'voice_room_gaming',
    title: 'مجلس بطولات الجيمنج وتحديات الألغاز 🎮',
    description: 'تحديات ألعاب جماعية، بطولات حية، أسئلة ذكاء وفوازير مع جوائز كوينز فورية',
    interestCategory: 'gaming',
    interestLabel: 'الألعاب والجيمنج',
    interestIcon: '🎮',
    matchScore: '92% تطابق مع اهتمامك بالألعاب',
    icon: '🎮',
    accentGradient: 'from-rose-500 via-pink-500 to-purple-600',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    badgeText: 'text-rose-700',
    activeSpeakers: 4,
    activeListeners: 46,
    topics: ['بطولات حية', 'ألغاز وفوازير', 'تحديات مايك', 'جوائز كوينز']
  }
];

interface RoomsViewProps {
  rooms: Room[];
  onSelectRoom: (room: Room) => void;
  onOpenCreateVoiceRoom: () => void;
  onOpenCreateTextRoom: () => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenMissions?: () => void;
  totalActiveUsersCount?: number;
  cumulativeVisitorsCount?: number;
  onOpenOnlineUsers?: () => void;
}

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  onSelectRoom,
  onOpenCreateVoiceRoom,
  onOpenCreateTextRoom,
  onOpenWallet,
  onOpenVip,
  onOpenMissions,
  totalActiveUsersCount = 1,
  cumulativeVisitorsCount = 15480,
  onOpenOnlineUsers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  
  // Active Interest Filter: 'all' or specific interest
  const [selectedInterest, setSelectedInterest] = useState<string>('all');

  // Filter available rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = 
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.subtext.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCountryFilter === 'all') return true;
    if (selectedCountryFilter === 'room_egypt') return room.id === 'room_egypt';
    if (selectedCountryFilter === 'room_egypt2') return room.id === 'room_egypt2';

    return true;
  });

  // Filter suggested voice rooms by selected interest
  const filteredSuggestedRooms = SUGGESTED_VOICE_ROOMS.filter(s => {
    const matchesInterest = selectedInterest === 'all' || s.interestCategory === selectedInterest;
    const matchesSearch = 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesInterest && matchesSearch;
  });

  // Launch a suggested voice room
  const handleJoinSuggestedVoiceRoom = (suggested: SuggestedVoiceRoom) => {
    const voiceRoomPayload: Room = {
      id: suggested.id,
      title: suggested.title,
      description: suggested.description,
      subtext: `مجلس صوتي حي مخصص لـ ${suggested.interestLabel}`,
      category: 'music',
      type: 'voice',
      roomType: 'voice',
      icon: suggested.icon,
      iconBg: suggested.accentGradient,
      activeUsers: suggested.activeListeners + suggested.activeSpeakers,
      visitorsCount: `${(suggested.activeListeners + suggested.activeSpeakers) * 2}`,
      isLive: true,
      isVoiceActive: true,
      accentGradient: suggested.accentGradient,
      speakers: Array.from({ length: 8 }, (_, i) => ({
        seatId: i + 1,
        user: i < suggested.activeSpeakers ? {
          id: `speaker_${suggested.id}_${i}`,
          name: i === 0 ? 'مضيف المجلس' : `متحدث ${i + 1}`,
          username: `user_${suggested.interestCategory}_${i}`,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=speaker_${suggested.id}_${i}`,
          bio: `شغوف بـ ${suggested.interestLabel}`,
          country: 'مصر',
          countryFlag: '🇪🇬',
          role: i === 0 ? 'owner' : 'vip_gold',
          coins: 1000,
          earningsEgp: 0,
          earningsUsd: 0,
          vipBadge: i === 0 ? 'مضيف المجلس 👑' : 'متحدث ذهبي 🎙️',
          badges: ['متحدث صوتي', 'صوت ماسي'],
          ratingPoints: 85,
          frameStyle: 'border-amber-400',
          profileWallpaper: '',
          fontPreference: 'cairo',
          isOnline: true,
          status: 'in_mic',
          joinedAt: '2024-01-01',
          gender: 'male',
          level: 7,
          likesReceived: 45,
          giftsReceivedCount: 15
        } : null,
        isMuted: false,
        isTalking: i === 0,
        isVideo: false
      })),
      moderators: [`speaker_${suggested.id}_0`]
    };

    onSelectRoom(voiceRoomPayload);
  };

  return (
    <div className="pb-24 pt-3 px-2.5 sm:px-4 max-w-4xl mx-auto space-y-3.5">
      
      {/* 1. Real-time Live Counters (Radiant, Light & Attractive Covers) */}
      <div className="grid grid-cols-2 gap-2">
        
        {/* Box 1: Online Connected Users (Luminous Mint-Turquoise Cover) */}
        <div 
          onClick={onOpenOnlineUsers}
          className="relative overflow-hidden px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-200 border border-teal-300/90 text-teal-950 shadow-sm shadow-teal-500/15 flex items-center justify-between cursor-pointer hover:brightness-[0.98] active:scale-[0.98] transition-all group"
          title="اضغط لعرض قائمة المتصلين الآن"
        >
          <div className="pointer-events-none absolute -top-6 -left-6 w-16 h-16 rounded-full bg-teal-300/40 blur-xl" />
          <div className="relative z-10 space-y-0 text-right min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] font-black text-teal-800">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
              </span>
              <span className="truncate">المتصلين الآن</span>
            </div>
            <div className="text-sm sm:text-base font-black text-teal-950 tracking-tight flex items-baseline gap-1 tabular-nums leading-snug">
              <span>{totalActiveUsersCount}</span>
              <span className="text-[9px] font-bold text-teal-800/85">عضو</span>
            </div>
          </div>

          <div className="relative z-10 w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 border border-white/60 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Users className="w-3 h-3" />
          </div>
        </div>

        {/* Box 2: Total Cumulative Visitors (Warm Sunset Peach-Coral-Gold Cover) */}
        <div 
          className="relative overflow-hidden px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-100 via-rose-100 to-orange-100 border border-amber-300/90 text-amber-950 shadow-sm shadow-rose-500/15 flex items-center justify-between transition-all group"
          title="عداد الزوار التراكمي في الوقت الفعلي"
        >
          <div className="pointer-events-none absolute -top-6 -left-6 w-16 h-16 rounded-full bg-rose-300/35 blur-xl" />
          <div className="relative z-10 space-y-0 text-right min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] font-black text-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span className="truncate">إجمالي الزوار</span>
            </div>
            <div className="text-sm sm:text-base font-black text-amber-950 tracking-tight flex items-baseline gap-1 tabular-nums leading-snug">
              <span>{(cumulativeVisitorsCount || 15480).toLocaleString()}</span>
              <span className="text-[9px] font-bold text-rose-800/85">زائر</span>
            </div>
          </div>

          <div className="relative z-10 w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 border border-white/60 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Eye className="w-3 h-3" />
          </div>
        </div>

      </div>

      {/* 2. Header with Primary Action Buttons (Light Luminous Pearl-Aqua-Gold Cover) */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-l from-amber-50/90 via-white to-teal-50/95 border border-amber-200/80 p-2.5 sm:p-3 rounded-xl shadow-sm shadow-amber-500/10 text-slate-900">
        <div className="pointer-events-none absolute -top-10 -left-10 w-32 h-32 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="relative z-10 space-y-0.5">
          <h1 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
            <span>غرف الدردشة والمجالس العربية</span>
            <Compass className="w-3.5 h-3.5 text-amber-500" />
          </h1>
          <p className="text-[10.5px] sm:text-[11px] text-slate-600 font-medium">
            شات كل العرب • غرف كتابية ومجالس صوتية مقترحة حسب اهتماماتك
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenCreateVoiceRoom}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm shadow-orange-500/20 active:scale-95 transition-all"
            title="إنشاء مجلس صوتي جديد"
          >
            <Mic className="w-3 h-3 text-amber-50" />
            <span>إنشاء مجلس صوتي 🎙️</span>
          </button>

          <button
            onClick={onOpenCreateTextRoom}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/20 active:scale-95 transition-all"
            title="إنشاء غرفة دردشة كتابية"
          >
            <MessageSquare className="w-3 h-3 text-emerald-50" />
            <span>إنشاء غرفة دردشة 💬</span>
          </button>
        </div>
      </div>

      {/* 3. Quick Utility Navigation: Missions & Wallet & VIP */}
      <div className="grid grid-cols-3 gap-2">
        {onOpenMissions && (
          <button
            onClick={onOpenMissions}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 transition-all text-xs font-black shadow-sm active:scale-95"
          >
            <Target className="w-3.5 h-3.5 text-purple-600" />
            <span className="truncate">المهام اليومية 🎯</span>
          </button>
        )}

        <button
          onClick={onOpenWallet}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition-all text-xs font-black shadow-sm active:scale-95"
        >
          <Coins className="w-3.5 h-3.5 text-amber-600" />
          <span className="truncate text-[11px]">شحن الكوينز 🪙</span>
        </button>

        <button
          onClick={onOpenVip}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition-all text-xs font-black shadow-sm active:scale-95"
        >
          <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
          <span className="truncate">عضويات VIP 👑</span>
        </button>
      </div>

      {/* 4. Search Filter */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن دولة، مجلس صوتي، اهتمام، أو اسم الغرفة..."
          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 pr-9 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm transition-colors"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* 5. Main Rooms List */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
            <span>الغرف والمجالس العامة</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
              {filteredRooms.length}
            </span>
          </h3>

          {/* Country Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-bold">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'room_egypt', label: 'غرفة مصر 1 🇪🇬' },
              { id: 'room_egypt2', label: 'غرفة مصر 2 🇪🇬' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCountryFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                  selectedCountryFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredRooms.map((room, roomIdx) => {
            const isEgypt1 = room.id === 'room_egypt';
            const isEgypt2 = room.id === 'room_egypt2';
            const altPaletteIdx = roomIdx % 2 === 0;
            const iconGradient = isEgypt1
              ? 'from-amber-400 via-orange-500 to-rose-600 ring-white/40 shadow-rose-950/30'
              : isEgypt2
              ? 'from-sky-400 via-blue-500 to-teal-500 ring-white/40 shadow-blue-950/30'
              : room.isPrivate
              ? 'from-amber-400 via-amber-500 to-yellow-600 ring-white/40 shadow-zinc-950/40'
              : altPaletteIdx
              ? 'from-emerald-400 via-teal-500 to-emerald-700 ring-white/40 shadow-emerald-950/30'
              : 'from-rose-400 via-rose-500 to-amber-600 ring-white/40 shadow-rose-950/30';

            const coverTheme = isEgypt1
              ? 'bg-gradient-to-br from-[#7c2d12] via-[#991b1b] to-[#b45309] border border-amber-300/35 shadow-sm shadow-rose-950/20'
              : isEgypt2
              ? 'bg-gradient-to-br from-[#0c4a6e] via-[#1d4ed8] to-[#0f766e] border border-sky-300/35 shadow-sm shadow-blue-950/20'
              : room.isPrivate
              ? 'bg-gradient-to-br from-[#18181b] via-[#27272a] to-[#3f3f46] border border-amber-400/40 shadow-sm shadow-zinc-950/25'
              : altPaletteIdx
              ? 'bg-gradient-to-br from-[#14532d] via-[#15803d] to-[#0f766e] border border-emerald-300/35 shadow-sm shadow-emerald-950/20'
              : 'bg-gradient-to-br from-[#4c0519] via-[#881337] to-[#9a3412] border border-rose-300/35 shadow-sm shadow-rose-950/20';

            const ctaBtnTheme = isEgypt1
              ? 'bg-white text-[#991b1b] hover:bg-amber-50'
              : isEgypt2
              ? 'bg-white text-[#1e40af] hover:bg-sky-50'
              : room.isPrivate
              ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
              : altPaletteIdx
              ? 'bg-white text-[#166534] hover:bg-emerald-50'
              : 'bg-white text-[#881337] hover:bg-rose-50';

            return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl ${coverTheme} p-2.5 sm:p-3 text-white transition-all duration-150 hover:shadow-lg hover:brightness-[1.03] active:scale-[0.99]`}
            >
              {/* Subtle Decorative Cover Sheen */}
              <div className="pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-black/10 blur-2xl" />

              <div className="relative z-10 flex items-center justify-between gap-2.5">
                {/* Left Action & Compact Real-Time Presence Counter */}
                <div className="flex flex-col items-start gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur-xs border border-white/30 text-white text-[9.5px] font-black shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                    <Users className="w-2.5 h-2.5 text-white/95" />
                    <span className="tabular-nums">{Math.max(1, room.activeUsers || 1)} متصل</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom(room);
                    }}
                    className={`px-2.5 py-1 rounded-lg ${ctaBtnTheme} font-black text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95`}
                  >
                    <span>دخول</span>
                    <ArrowLeft className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Center Content: Room Info */}
                <div className="flex-1 text-right space-y-0.5 overflow-hidden">
                  {room.isPrivate && (
                    <div className="flex items-center justify-end">
                      <span className="px-1.5 py-0.5 rounded-md bg-black/20 border border-white/25 text-amber-200 font-bold text-[9px] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>غرفة خاصة مغلقة</span>
                      </span>
                    </div>
                  )}

                  <h2 className="text-xs sm:text-sm font-black text-white drop-shadow-2xs truncate">
                    {room.title}
                  </h2>

                  <p className="text-[11px] text-white/90 truncate font-semibold">
                    {room.description}
                  </p>

                  <p className="text-[10px] text-white/75 truncate">
                    {room.subtext}
                  </p>
                </div>

                {/* Right Side: Vibrant Compact Colored Room Icon Emblem */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${iconGradient} border border-white/90 ring-1 shadow-md flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform`}>
                    {room.isPrivate ? (
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs" />
                    ) : room.type === 'voice' || room.roomType === 'voice' || room.isVoiceActive ? (
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs" />
                    ) : isEgypt1 ? (
                      <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs" />
                    ) : isEgypt2 ? (
                      <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs" />
                    ) : (
                      <span className="text-lg sm:text-xl">{room.icon}</span>
                    )}
                  </div>
                  {(isEgypt1 || isEgypt2) && (
                    <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-white border border-white shadow-xs flex items-center justify-center text-[9.5px] leading-none">
                      {room.icon}
                    </span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* 6. SUGGESTED VOICE ROOMS SECTION (Compact & Colored Majalis) */}
      <div className="rounded-xl bg-gradient-to-br from-slate-50 via-indigo-50/50 to-teal-50/50 border border-indigo-200/80 p-2.5 sm:p-3 space-y-2.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-indigo-100 pb-2">
          <div className="space-y-0.5">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-600">
                <Mic className="w-3.5 h-3.5 animate-pulse text-pink-600" />
              </span>
              <span>مجالس صوتية مقترحة بناءً على اهتماماتك المشتركة</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </h2>
            <p className="text-[10px] text-slate-600">
              انضم وتحدث على المايك مباشرة مع أصدقاء يشاركونك نفس الشغف والهوايات 🎙️
            </p>
          </div>
        </div>

        {/* Interest Selector Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-bold">
          <span className="text-[10px] font-black text-slate-500 shrink-0 whitespace-nowrap ml-1">
            اختر اهتمامك:
          </span>
          {[
            { id: 'all', label: 'جميع الاهتمامات ⭐' },
            { id: 'sports', label: '⚽ الرياضة والكرة' },
            { id: 'art', label: '🎨 الفن والطرب' },
            { id: 'culture', label: '📚 الثقافة والشعر' },
            { id: 'tech', label: '💡 التقنية وريادة الأعمال' },
            { id: 'gaming', label: '🎮 الألعاب والتحديات' },
          ].map((interest) => (
            <button
              key={interest.id}
              onClick={() => setSelectedInterest(interest.id)}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all duration-150 text-[11px] font-bold shrink-0 ${
                selectedInterest === interest.id
                  ? 'bg-gradient-to-r from-[#0f3b3e] to-[#0f766e] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {interest.label}
            </button>
          ))}
        </div>

        {/* Suggested Voice Rooms Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredSuggestedRooms.map((suggested) => {
            const voiceCardTheme =
              suggested.interestCategory === 'sports'
                ? 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] border-emerald-400/35'
                : suggested.interestCategory === 'art'
                ? 'bg-gradient-to-br from-[#500724] via-[#881337] to-[#9d174d] border-rose-400/35'
                : suggested.interestCategory === 'culture'
                ? 'bg-gradient-to-br from-[#451a03] via-[#92400e] to-[#b45309] border-amber-400/35'
                : suggested.interestCategory === 'tech'
                ? 'bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#0369a1] border-sky-400/35'
                : 'bg-gradient-to-br from-[#1e1b4b] via-[#3730a3] to-[#0f766e] border-indigo-400/35';

            const voiceCtaClass =
              suggested.interestCategory === 'sports'
                ? 'text-[#065f46] hover:bg-emerald-50'
                : suggested.interestCategory === 'art'
                ? 'text-[#881337] hover:bg-rose-50'
                : suggested.interestCategory === 'culture'
                ? 'text-[#92400e] hover:bg-amber-50'
                : suggested.interestCategory === 'tech'
                ? 'text-[#1e3a8a] hover:bg-sky-50'
                : 'text-[#312e81] hover:bg-indigo-50';

            return (
            <div
              key={suggested.id}
              onClick={() => handleJoinSuggestedVoiceRoom(suggested)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl ${voiceCardTheme} border p-2.5 text-white transition-all duration-150 shadow-sm hover:shadow-md hover:brightness-[1.03] active:scale-[0.99] flex flex-col justify-between`}
            >
              <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />

              <div className="relative z-10 space-y-1.5">
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 border border-white/30 text-white text-[9px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                    <Mic className="w-2.5 h-2.5 text-white" />
                    <span>صوت حي 🎙️</span>
                  </div>

                  <span className="px-1.5 py-0.5 rounded-md bg-black/20 border border-white/20 text-white/95 text-[9px] font-black flex items-center gap-1 truncate max-w-[165px]">
                    <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                    <span className="truncate">{suggested.matchScore}</span>
                  </span>
                </div>

                {/* Room Info */}
                <div className="flex items-start gap-2 text-right">
                  <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                    {suggested.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black text-white truncate">
                      {suggested.title}
                    </h3>
                    <p className="text-[10.5px] text-white/85 line-clamp-2 mt-0.5 leading-snug">
                      {suggested.description}
                    </p>
                  </div>
                </div>

                {/* Topics / Tags */}
                <div className="flex items-center gap-1 flex-wrap">
                  {suggested.topics.slice(0, 3).map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-white/15 border border-white/20 text-white/90 text-[9px] font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="relative z-10 flex items-center justify-between pt-2 mt-2 border-t border-white/20">
                <div className="flex items-center gap-1.5 text-[9.5px] text-white/90 font-bold">
                  <span className="flex items-center gap-0.5 text-emerald-200">
                    <Users className="w-2.5 h-2.5" />
                    <span>{suggested.activeSpeakers} على المايك</span>
                  </span>
                  <span>•</span>
                  <span>{suggested.activeListeners} مستمع</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinSuggestedVoiceRoom(suggested);
                  }}
                  className={`px-2.5 py-1 rounded-lg bg-white ${voiceCtaClass} font-black text-[10.5px] flex items-center gap-1 shadow-sm transition-all active:scale-95`}
                >
                  <span>انضمام 🎙️</span>
                  <ArrowLeft className="w-2.5 h-2.5" />
                </button>
              </div>

            </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
