import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Gift,
  Star,
  UserPlus,
  Check,
  Pencil,
  Flag,
  AlertTriangle,
  Loader2,
  Music,
  Play,
  Pause,
  Users,
  Calendar,
  MapPin,
  Info,
  ArrowRight,
} from 'lucide-react';
import { User, Friend } from '../types/chat';
import { getRankDisplayMeta, hasPrivilegedRank, resolveBannerStyle } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import {
  sendFriendRequest,
  submitUserRating,
  submitUserReport,
  recordProfileVisit,
  subscribeToFriendsList,
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { formatLastSeenArabic, isUserTrulyOnline } from '../utils/presenceStatus';
import { toast } from '../utils/appToast';

interface UserProfileModalProps {
  user: User | null;
  currentUser: User;
  onlineUsers?: User[];
  allRegisteredUsers?: User[];
  onClose: () => void;
  onOpenPrivateChatWith: (user: User) => void;
  onSendGiftToUser: (user: User) => void;
  onAvatarChanged?: (url: string) => void;
}

const ROOM_NAME_MAP: Record<string, string> = {
  room_egypt: 'غرفة شات مصر 1',
  room_egypt2: 'غرفة شات مصر 2',
  room_alex: 'إسكندرية عروس البحر',
  room_saudi: 'غرفة السعودية والخليج',
  room_religious: 'الركن الديني والتآخي',
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  onlineUsers = [],
  allRegisteredUsers = [],
  onClose,
  onOpenPrivateChatWith,
  onSendGiftToUser,
  onAvatarChanged,
}) => {
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false);
  const [showFriendsSection, setShowFriendsSection] = useState(false);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [hasRated, setHasRated] = useState(false);
  const [userRating, setUserRating] = useState(user?.ratingPoints || 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report User State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('ألفاظ مسيئة أو سب وقذف');
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSentSuccess, setReportSentSuccess] = useState(false);

  // Favorite music mini-player for privileged profiles
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFriendRequestSent(false);
    setHasRated(false);
    setUserRating(user.ratingPoints || 0);
    setShowFriendsSection(false);
    setIsReportOpen(false);
    setReportSentSuccess(false);

    const targetUid = user.id;
    const unsubFriends = subscribeToFriendsList(targetUid, (loaded) => {
      setFriendsList(loaded || []);
    });

    try {
      const friendsRaw = localStorage.getItem(`user_friends_${currentUser.id}`);
      if (friendsRaw) {
        const list = JSON.parse(friendsRaw);
        const found =
          Array.isArray(list) &&
          list.some((f: any) => f?.friendId === user.id || f?.id === user.id);
        setIsAlreadyFriend(Boolean(found));
      } else {
        setIsAlreadyFriend(false);
      }
    } catch {
      setIsAlreadyFriend(false);
    }

    if (user.id && currentUser?.id && user.id !== currentUser.id) {
      recordProfileVisit(user.id, currentUser.id).catch(() => {});
    }

    return () => {
      unsubFriends();
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      setIsMusicPlaying(false);
    };
  }, [user?.id, user?.ratingPoints, currentUser.id]);

  if (!user) return null;

  const isMe = user.id === currentUser.id;
  const rankMeta = getRankDisplayMeta(user.role, user.vipBadge);
  const isPrivileged = hasPrivilegedRank(user.role);
  const effectiveCover =
    user.profileBanner &&
    (user.profileBanner.startsWith('data:image/') ||
      user.profileBanner.startsWith('http') ||
      user.profileBanner.startsWith('/') ||
      isPrivileged)
      ? user.profileBanner
      : user.profileWallpaper;
  const bannerStyle = resolveBannerStyle(effectiveCover);

  const liveOnlineRecord = onlineUsers.find((u) => u.id === user.id);
  const regRecord = allRegisteredUsers.find((u) => u.id === user.id);
  const mergedUser: User = {
    ...regRecord,
    ...user,
    ...liveOnlineRecord,
  };

  const isAvailable = isMe
    ? currentUser.status !== 'offline'
    : Boolean(liveOnlineRecord && isUserTrulyOnline(liveOnlineRecord)) || isUserTrulyOnline(user);

  const effectiveStatus = isMe
    ? currentUser.status
    : isAvailable
    ? liveOnlineRecord?.status || user.status || 'online'
    : 'offline';

  const effectiveLastSeen = regRecord?.lastSeen ?? liveOnlineRecord?.lastSeen ?? user.lastSeen;
  const currentRoomId = isMe ? currentUser.currentRoom : liveOnlineRecord?.currentRoom ?? user.currentRoom;
  const currentRoomLabel = currentRoomId
    ? ROOM_NAME_MAP[currentRoomId] || 'متواجد في غرفة عامة'
    : isAvailable
    ? 'في الصفحة الرئيسية'
    : 'غير متواجد في غرفة';

  const statusLabel = !isAvailable
    ? formatLastSeenArabic(effectiveLastSeen)
    : effectiveStatus === 'busy'
    ? 'مشغول'
    : effectiveStatus === 'dnd'
    ? 'لا تزعجني'
    : effectiveStatus === 'in_mic'
    ? 'في مجلس صوتي'
    : 'متصل الآن';

  const joinedLabel = mergedUser.joinedAt
    ? (() => {
        const d = new Date(mergedUser.joinedAt);
        return isNaN(d.getTime()) ? 'عضو حديث' : d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
      })()
    : 'عضو في شات مصر';

  const handleToggleFavoriteMusic = () => {
    if (!user.favoriteMusicUrl) return;
    if (isMusicPlaying && musicAudioRef.current) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
      return;
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
    }
    const audio = new Audio(user.favoriteMusicUrl);
    audio.volume = 0.65;
    audio.onended = () => setIsMusicPlaying(false);
    audio.onerror = () => {
      setIsMusicPlaying(false);
      toast.error('تعذر تشغيل الموسيقى حالياً');
    };
    musicAudioRef.current = audio;
    audio.play().then(() => setIsMusicPlaying(true)).catch(() => setIsMusicPlaying(false));
  };

  const handleSendFriendReq = async () => {
    if (isMe || friendRequestSent || isAlreadyFriend) return;
    // Optimistic UI update
    setFriendRequestSent(true);
    toast.social(`تم إرسال طلب صداقة إلى ${user.name} بنجاح 🤝`);
    try {
      await sendFriendRequest(currentUser, user.id);
    } catch {
      setFriendRequestSent(false);
      toast.error('تعذر إرسال طلب الصداقة حالياً');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      await submitUserReport({
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reportedUserId: user.id,
        reportedUserName: user.name,
        reason: reportReason,
        details: reportNotes.trim(),
        timestamp: Date.now(),
      });

      setReportSentSuccess(true);
      setReportNotes('');
      toast.security('تم إرسال البلاغ للإدارة للمراجعة الفورية 🛡️');
      setTimeout(() => {
        setReportSentSuccess(false);
        setIsReportOpen(false);
      }, 1800);
    } catch {
      toast.error('تعذر إرسال البلاغ حالياً، حاول مرة أخرى.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleGiveRating = async () => {
    if (isMe || hasRated) return;
    setHasRated(true);
    setUserRating((prev) => prev + 10);
    toast.success(`تم منح ${user.name} +10 نقاط تقييم ⭐`);
    try {
      const updated = await submitUserRating(currentUser.id, user.id, 10);
      if (typeof updated === 'number') setUserRating(updated);
    } catch {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAvatarChanged) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAvatarChanged(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[220] w-full h-[100dvh] bg-[#F2F8FD] dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in"
    >
      {/* Hidden Avatar Uploader */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Pinned Top Sky-Blue Header */}
      <header className="w-full px-3 sm:px-5 py-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] bg-[#EAF5FD]/95 dark:bg-slate-900/95 border-b border-sky-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3 rounded-xl bg-white/80 hover:bg-white border border-sky-200 text-slate-700 text-xs font-black flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-[#1E96E8]" />
          <span>رجوع</span>
        </button>

        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
          الملف الشخصي
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white border border-sky-200 text-slate-600 hover:text-slate-900 flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-xl mx-auto pb-8">
          {/* Top Banner */}
          <div
            className="h-28 sm:h-36 bg-gradient-to-l from-[#1E96E8] via-[#38BDF8] to-[#0284C7] relative"
            style={bannerStyle}
          />

          {/* Main Profile Card Content */}
          <div className="px-4 -mt-12 space-y-4 text-center">
            {/* Circular Avatar */}
            <div className="relative inline-block">
              <div className="rounded-full p-1 bg-white dark:bg-slate-900 shadow-md">
                <AvatarWithFrame
                  user={{ ...mergedUser, isOnline: isAvailable, status: effectiveStatus }}
                  size="lg"
                  showOnlineDot={isAvailable}
                />
              </div>
              {isMe && onAvatarChanged && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="تغيير الصورة الشخصية"
                  className="absolute top-0 right-0 p-1.5 rounded-full bg-[#1E96E8] hover:bg-[#1982CC] text-white shadow border-2 border-white active:scale-90 transition cursor-pointer z-20"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Name + Privileged-only shimmer/badge + Status */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h3
                  className={`text-lg font-black inline-flex items-center gap-1 ${
                    rankMeta.isPrivileged ? rankMeta.namePillClass : 'text-slate-900 dark:text-white'
                  }`}
                >
                  <span>{mergedUser.name}</span>
                </h3>
                <VerifiedBadge verified={mergedUser.verified} role={mergedUser.role} size="sm" />
                <span className="text-lg">{mergedUser.countryFlag || '🇪🇬'}</span>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                {rankMeta.isPrivileged ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${rankMeta.badgeClass}`}>
                    {rankMeta.label}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 border border-sky-200 text-sky-800">
                    {rankMeta.label}
                  </span>
                )}

                <span
                  className={`text-xs font-bold inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border ${
                    isAvailable
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {isAvailable && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                  <span>{statusLabel}</span>
                </span>
              </div>
            </div>

            {/* Favorite Profile Music Mini-Player (Privileged users with song) */}
            {isPrivileged && mergedUser.favoriteMusicUrl && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 flex items-center justify-between gap-2 text-right shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#1E96E8] text-white flex items-center justify-center shrink-0">
                    <Music className={`w-4 h-4 ${isMusicPlaying ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">النغمة المفضلة</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {isMusicPlaying ? 'جاري التشغيل الآن...' : 'اضغط للاستماع'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFavoriteMusic}
                  className="px-3 py-1.5 rounded-xl bg-[#1E96E8] hover:bg-[#1982CC] text-white text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {isMusicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isMusicPlaying ? 'إيقاف' : 'تشغيل'}</span>
                </button>
              </div>
            )}

            {/* Primary Call-To-Action Buttons (Instant Response) */}
            <div className="flex flex-wrap items-center gap-2">
              {!isMe && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPrivateChatWith(mergedUser);
                  }}
                  className="flex-1 min-w-[140px] py-3 px-4 rounded-2xl bg-[#1E96E8] hover:bg-[#1982CC] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>فتح الخاص</span>
                </button>
              )}

              {!isMe && (
                <button
                  type="button"
                  onClick={handleSendFriendReq}
                  disabled={friendRequestSent || isAlreadyFriend}
                  className={`py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 cursor-pointer ${
                    isAlreadyFriend || friendRequestSent
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white hover:bg-sky-50 border-sky-200 text-sky-800'
                  }`}
                >
                  {isAlreadyFriend ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>أصدقاء</span>
                    </>
                  ) : friendRequestSent ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>تم الطلب</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 text-[#1E96E8]" />
                      <span>إضافة صديق</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs active:scale-95 transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            {/* Structured Organized Info Rows */}
            <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl divide-y divide-sky-100/80 dark:divide-slate-800 text-right shadow-2xs overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#1E96E8]" />
                  <span>النوع / الجنس</span>
                </span>
                <span className="font-black text-slate-900 dark:text-white">
                  {mergedUser.gender === 'female' ? 'أنثى 👩' : 'ذكر 👨'}
                  {typeof mergedUser.age === 'number' ? ` • ${mergedUser.age} سنة` : ''}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1E96E8]" />
                  <span>تاريخ الانضمام</span>
                </span>
                <span className="font-black text-slate-900 dark:text-white">{joinedLabel}</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#1E96E8]" />
                  <span>الحالة / الغرفة الحالية</span>
                </span>
                <span className="font-black text-slate-900 dark:text-white truncate max-w-[60%]">
                  {statusLabel} • {currentRoomLabel}
                </span>
              </div>

              <div className="px-4 py-3 space-y-1 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#1E96E8]" />
                  <span>معلوماتي</span>
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                  {mergedUser.bio?.trim() || 'عضو في مجتمع شات مصر'}
                </p>
              </div>
            </div>

            {/* Quick Friends List Toggle (If Friends Exist) */}
            {friendsList.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl overflow-hidden text-right shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowFriendsSection((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 text-xs font-black text-slate-900 dark:text-white hover:bg-sky-50/70 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1E96E8]" />
                    <span>قائمة الأصدقاء ({friendsList.length})</span>
                  </span>
                  <span className="text-[11px] text-[#1E96E8]">
                    {showFriendsSection ? 'إخفاء ▲' : 'عرض سريع ▼'}
                  </span>
                </button>

                {showFriendsSection && (
                  <div className="px-3 pb-3 pt-1 max-h-52 overflow-y-auto space-y-1.5 border-t border-sky-100">
                    {friendsList.map((f) => {
                      const fId = f.friendId || f.id;
                      return (
                        <div
                          key={fId}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-sky-50/60 border border-sky-100 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarWithFrame
                              user={{ id: fId, name: f.name, avatar: f.avatar, isOnline: f.isOnline }}
                              size="xs"
                              showOnlineDot={Boolean(f.isOnline)}
                            />
                            <span className="font-bold text-slate-900 truncate">{f.name}</span>
                          </div>
                          {fId !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenPrivateChatWith({
                                  id: fId,
                                  name: f.name,
                                  username: f.name.toLowerCase().replace(/\s+/g, '_'),
                                  avatar: f.avatar || '',
                                  bio: f.bio || '',
                                  country: 'مصر',
                                  countryFlag: f.countryFlag || '🇪🇬',
                                  role: (f.role as any) || 'member',
                                  coins: 0,
                                  earningsEgp: 0,
                                  earningsUsd: 0,
                                  vipBadge: f.vipBadge || '',
                                  frameStyle: 'border-slate-300',
                                  profileWallpaper: '',
                                  fontPreference: 'cairo',
                                  isOnline: Boolean(f.isOnline),
                                  status: f.status || (f.isOnline ? 'online' : 'offline'),
                                  joinedAt: '',
                                  gender: 'male',
                                  level: 1,
                                  likesReceived: 0,
                                  giftsReceivedCount: 0,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#1E96E8] text-white text-[10.5px] font-black shrink-0 cursor-pointer"
                            >
                              خاص
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats + Secondary Actions */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white border border-sky-100">
                <span className="text-[10px] text-slate-500 block">التقييم ⭐</span>
                <span className="font-black text-amber-600 tabular-nums">{userRating}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-sky-100">
                <span className="text-[10px] text-slate-500 block">الهدايا 🎁</span>
                <span className="font-black text-pink-600 tabular-nums">{mergedUser.giftsReceivedCount || 0}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-sky-100">
                <span className="text-[10px] text-slate-500 block">الإعجابات ❤️</span>
                <span className="font-black text-rose-600 tabular-nums">{mergedUser.likesReceived || 0}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-sky-100">
                <span className="text-[10px] text-slate-500 block">الزيارات 👁️</span>
                <span className="font-black text-[#1E96E8] tabular-nums">{mergedUser.profileVisitsCount || 0}</span>
              </div>
            </div>

            {!isMe && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSendGiftToUser(mergedUser);
                  }}
                  className="py-2.5 px-2 rounded-xl bg-white hover:bg-pink-50 border border-pink-200 text-pink-700 font-black text-xs flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>هدية</span>
                </button>

                <button
                  type="button"
                  onClick={handleGiveRating}
                  disabled={hasRated}
                  className={`py-2.5 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border active:scale-95 transition cursor-pointer ${
                    hasRated
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-white hover:bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>{hasRated ? 'تم (+10)' : 'تقييم'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="py-2.5 px-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>إبلاغ</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report User Modal Overlay */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[230] p-4 flex items-center justify-center animate-in fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-4 shadow-2xl text-right space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h4 className="font-black text-sm text-slate-900">إبلاغ عن مخالفة</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSentSuccess ? (
              <div className="py-8 text-center space-y-2 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h5 className="text-sm font-black text-slate-900">تم استلام بلاغك بنجاح!</h5>
                <p className="text-xs text-slate-600">
                  تم إرسال إشعار فوري إلى لوحة تحكم الإدارة لاتخاذ الإجراء المناسب.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3">
                <div className="text-xs text-slate-600">
                  المستخدم: <span className="font-bold text-slate-900">{user.name}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    سبب البلاغ:
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-rose-400"
                  >
                    <option value="ألفاظ مسيئة أو سب وقذف">ألفاظ مسيئة أو سب وقذف 🚫</option>
                    <option value="إزعاج ومضايقات متكررة (Spam)">إزعاج ومضايقات متكررة (Spam) 📩</option>
                    <option value="انتحال شخصية أو حساب وهمي">انتحال شخصية أو حساب وهمي 👤</option>
                    <option value="محتوى غير لائق ومخالف للآداب">محتوى غير لائق ومخالف للآداب ⚠️</option>
                    <option value="طلب بيانات شخصية أو احتيال">طلب بيانات شخصية أو احتيال 💳</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تفاصيل إضافية (اختياري):
                  </label>
                  <textarea
                    rows={2}
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="اذكر تفاصيل ما حدث باختصار..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 outline-none focus:border-rose-400 placeholder:text-slate-400 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReport ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جارٍ إرسال البلاغ...</span>
                      </>
                    ) : (
                      <>
                        <Flag className="w-3.5 h-3.5" />
                        <span>إرسال البلاغ للإدارة</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReportOpen(false)}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
