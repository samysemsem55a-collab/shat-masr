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
      
      {/* 1. Real-time Live Counters */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        
        {/* Box 1: Online Connected Users */}
        <div 
          onClick={onOpenOnlineUsers}
          className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 border border-emerald-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-400 hover:shadow-md active:scale-[0.98] transition-all group"
          title="اضغط لعرض قائمة المتصلين الآن"
        >
          <div className="space-y-0.5 text-right">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>المتصلين الآن</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span className="text-emerald-600">
                {totalActiveUsersCount}
              </span>
              <span className="text-[10px] font-bold text-slate-500">عضو نشط</span>
            </div>
          </div>

          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Box 2: Total Active Visitors */}
        <div 
          className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-orange-50/70 border border-amber-200 shadow-sm flex items-center justify-between transition-all group"
          title="إجمالي زوار المنصة النشطين حالياً"
        >
          <div className="space-y-0.5 text-right">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>إجمالي الزوار</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span className="text-amber-600">
                {(cumulativeVisitorsCount || 15480).toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-500">زائر</span>
            </div>
          </div>

          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform shrink-0">
            <Eye className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* 2. Header with Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3.5 rounded-2xl shadow-sm">
        <div className="space-y-0.5">
          <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
            <span>غرف الدردشة والمجالس العربية</span>
            <Compass className="w-4 h-4 text-indigo-600" />
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">
            شات كل العرب • غرف كتابية ومجالس صوتية مقترحة حسب اهتماماتك
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenCreateVoiceRoom}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            title="إنشاء مجلس صوتي جديد"
          >
            <Mic className="w-3.5 h-3.5 text-purple-100" />
            <span>إنشاء مجلس صوتي 🎙️</span>
          </button>

          <button
            onClick={onOpenCreateTextRoom}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            title="إنشاء غرفة دردشة كتابية"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-100" />
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

        <div className="space-y-2.5">
          {filteredRooms.map((room) => {
            const isEgypt1 = room.id === 'room_egypt';
            const isEgypt2 = room.id === 'room_egypt2';
            const iconGradient = isEgypt1
              ? 'from-rose-500 via-amber-500 to-orange-500 ring-rose-200 shadow-rose-200/70'
              : isEgypt2
              ? 'from-cyan-500 via-blue-600 to-indigo-600 ring-cyan-200 shadow-cyan-200/70'
              : `${room.iconBg || 'from-emerald-500 via-teal-500 to-cyan-600'} ring-teal-200 shadow-teal-200/70`;
            const topAccent = isEgypt1
              ? 'from-rose-500 via-amber-500 to-orange-500'
              : isEgypt2
              ? 'from-cyan-500 via-blue-600 to-indigo-600'
              : room.accentGradient || 'from-emerald-500 to-cyan-600';
            const btnGradient = isEgypt1
              ? 'from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600'
              : isEgypt2
              ? 'from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500'
              : 'from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500';

            return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 p-3.5 transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.99]"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${topAccent}`} />

              <div className="flex items-center justify-between gap-3">
                {/* Left Action & Real-Time Presence Counter */}
                <div className="flex flex-col items-start gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Users className="w-3.5 h-3.5" />
                    <span>{Math.max(1, room.activeUsers || 1)} متواجد الآن</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom(room);
                    }}
                    className={`px-4 py-1.5 rounded-xl bg-gradient-to-r ${btnGradient} text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all`}
                  >
                    <span>دخول</span>
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                </div>

                {/* Center Content: Room Info */}
                <div className="flex-1 text-right space-y-1 overflow-hidden">
                  {room.isPrivate && (
                    <div className="flex items-center justify-end">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>غرفة خاصة مغلقة</span>
                      </span>
                    </div>
                  )}

                  <h2 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                    {room.title}
                  </h2>

                  <p className="text-xs text-slate-600 truncate">
                    {room.description}
                  </p>

                  <p className="text-[11px] text-slate-400 truncate">
                    {room.subtext}
                  </p>
                </div>

                {/* Right Side: Vibrant Gradient Circular Room Icon */}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${iconGradient} border-2 border-white ring-2 shadow-md flex items-center justify-center text-2xl sm:text-3xl shrink-0 group-hover:scale-110 transition-transform overflow-hidden`}>
                  {room.icon}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* 6. SUGGESTED VOICE ROOMS SECTION */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/70 border border-indigo-200/80 p-3.5 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-600">
                <Mic className="w-4 h-4 animate-pulse text-pink-600" />
              </span>
              <span>مجالس صوتية مقترحة بناءً على اهتماماتك المشتركة</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h2>
            <p className="text-[11px] text-slate-600">
              انضم وتحدث على المايك مباشرة مع أصدقاء يشاركونك نفس الشغف والهوايات 🎙️
            </p>
          </div>
        </div>

        {/* Interest Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
          <span className="text-[11px] font-black text-slate-500 shrink-0 whitespace-nowrap ml-1">
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
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all duration-150 text-xs font-bold shrink-0 ${
                selectedInterest === interest.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm scale-[1.02]'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {interest.label}
            </button>
          ))}
        </div>

        {/* Suggested Voice Rooms Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredSuggestedRooms.map((suggested) => (
            <div
              key={suggested.id}
              onClick={() => handleJoinSuggestedVoiceRoom(suggested)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 p-3.5 transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.99] flex flex-col justify-between"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${suggested.accentGradient}`} />

              <div className="space-y-2">
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                    <Mic className="w-3 h-3 text-pink-600" />
                    <span>صوت حي 🎙️</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg ${suggested.badgeBg} border ${suggested.badgeBorder} ${suggested.badgeText} text-[10px] font-black flex items-center gap-1`}>
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{suggested.matchScore}</span>
                  </span>
                </div>

                {/* Room Info */}
                <div className="flex items-start gap-2.5 text-right">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${suggested.accentGradient} border-2 border-white flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform shadow-md`}>
                    {suggested.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                      {suggested.title}
                    </h3>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                      {suggested.description}
                    </p>
                  </div>
                </div>

                {/* Topics / Tags */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {suggested.topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[9.5px] font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Users className="w-3 h-3" />
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
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                >
                  <span>انضمام للمجلس 🎙️</span>
                  <ArrowLeft className="w-3 h-3" />
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>

    </div>
  );
};
