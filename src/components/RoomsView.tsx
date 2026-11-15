import React, { useState, useEffect } from 'react';
import {
  Users,
  Eye,
  ArrowLeft,
  Heart,
  MessageCircle,
  Send,
  Mail,
  Sparkles,
  Target,
  Crown,
  Coins,
  Trash2,
  CheckCircle2,
  Gift,
  Flame,
  MessageSquare,
  Lock
} from 'lucide-react';
import { Room, User, ForumPost, ForumComment, SharedRoomMission } from '../types/chat';
import {
  subscribeToForumPosts,
  createForumPost,
  toggleForumPostLike,
  subscribeToForumComments,
  addForumComment,
  deleteForumPost,
  subscribeToSharedRoomMissions,
  contributeToSharedRoomMission,
  claimSharedMissionReward
} from '../services/firebase';
import { isUserAdminOrOwner } from '../data/seedData';
import { sounds } from '../utils/soundEffects';
import { toast } from 'sonner';

interface RoomsViewProps {
  rooms: Room[];
  currentUser: User;
  onlineUsers: User[];
  onSelectRoom: (room: Room) => void;
  onOpenPrivateChatWith: (user: User) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenMissions?: () => void;
  onClaimSharedRewardCoins?: (coins: number, label?: string) => void;
  totalActiveUsersCount?: number;
  cumulativeVisitorsCount?: number;
  onOpenOnlineUsers?: () => void;
}

function formatRelativeArabicTime(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  const diffDay = Math.floor(diffHr / 24);
  return `منذ ${diffDay} يوم`;
}

const ForumPostCommentsSection: React.FC<{
  postId: string;
  currentUser: User;
}> = ({ postId, currentUser }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    return subscribeToForumComments(postId, setComments);
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSending) return;
    setIsSending(true);
    try {
      await addForumComment(postId, currentUser, commentText);
      setCommentText('');
      sounds.playMessageSent();
      contributeToSharedRoomMission('forum', currentUser.id, 1);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2 animate-in fade-in">
      {comments.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 bg-slate-50 rounded-xl p-2 border border-slate-100">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                {c.authorAvatar ? (
                  <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{c.authorName.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-900 truncate">{c.authorName}</span>
                  <span className="text-[9.5px] text-slate-400 shrink-0">{formatRelativeArabicTime(c.createdAt)}</span>
                </div>
                <p className="text-[11.5px] text-slate-700 leading-snug mt-0.5 break-words">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 text-center py-1">كن أول من يعلق على هذا المنشور 💬</p>
      )}

      <form onSubmit={handleAddComment} className="flex items-center gap-1.5">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="أضف تعليقاً راقياً..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || isSending}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer"
        >
          <Send className="w-3 h-3" />
          <span>إرسال</span>
        </button>
      </form>
    </div>
  );
};

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  currentUser,
  onlineUsers,
  onSelectRoom,
  onOpenPrivateChatWith,
  onOpenWallet,
  onOpenVip,
  onOpenMissions,
  onClaimSharedRewardCoins,
  totalActiveUsersCount = 1,
  cumulativeVisitorsCount = 15480,
  onOpenOnlineUsers,
}) => {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [postText, setPostText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [forumFilter, setForumFilter] = useState<'all' | 'male' | 'female' | 'online'>('all');
  const [expandedCommentPostId, setExpandedCommentPostId] = useState<string | null>(null);
  const [sharedMissions, setSharedMissions] = useState<SharedRoomMission[]>([]);
  const [showMobileMissions, setShowMobileMissions] = useState(false);

  // Strict requirement: Keep ONLY غرفة مصر 1 (room_egypt) and غرفة مصر 2 (room_egypt2)
  const coreEgyptRooms = rooms.filter(r => r.id === 'room_egypt' || r.id === 'room_egypt2');
  const onlineUserIds = new Set(onlineUsers.map(u => u.id));
  const isOwner = isUserAdminOrOwner(currentUser);

  useEffect(() => {
    const unsubForum = subscribeToForumPosts(setForumPosts);
    const unsubMissions = subscribeToSharedRoomMissions(setSharedMissions);
    return () => {
      unsubForum();
      unsubMissions();
    };
  }, []);

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() || isPublishing) return;
    if (currentUser.isBanned || currentUser.isMuted) {
      toast.error('حسابك مقيد حالياً من النشر');
      return;
    }
    setIsPublishing(true);
    try {
      await createForumPost(currentUser, postText);
      setPostText('');
      sounds.playMessageSent();
      contributeToSharedRoomMission('forum', currentUser.id, 1);
      toast.success('تم نشر مشاركتك في منتدى التعارف بنجاح ✨');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleLike = async (post: ForumPost) => {
    const liked = (post.likedBy || []).includes(currentUser.id);
    sounds.playCoinsReward();
    await toggleForumPostLike(post.id, currentUser.id, liked);
    if (!liked) {
      contributeToSharedRoomMission('likes', currentUser.id, 1);
    }
  };

  const handleClaimShared = async (mission: SharedRoomMission) => {
    if (mission.currentProgress < mission.targetProgress) return;
    if ((mission.claimedBy || []).includes(currentUser.id)) return;
    await claimSharedMissionReward(mission.id, currentUser.id);
    sounds.playGiftFanfare();
    if (onClaimSharedRewardCoins) {
      onClaimSharedRewardCoins(mission.rewardCoins, mission.rewardVipLabel);
    }
    toast.success(`مبروك! تم استلام جائزة المهمة الجماعية (+${mission.rewardCoins} كوينز) 🎉`);
  };

  const filteredPosts = forumPosts.filter((post) => {
    if (forumFilter === 'male') return post.authorGender === 'male';
    if (forumFilter === 'female') return post.authorGender === 'female';
    if (forumFilter === 'online') return onlineUserIds.has(post.authorId) || post.authorId === currentUser.id;
    return true;
  });

  return (
    <div className="pb-24 pt-2.5 px-2.5 sm:px-4 max-w-6xl mx-auto space-y-3" dir="rtl">
      {/* 1. Compact Live Stats & Quick Controls Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Online Users */}
        <div
          onClick={onOpenOnlineUsers}
          className="relative overflow-hidden px-3 py-2 rounded-xl bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-100 border border-teal-300/90 text-teal-950 shadow-xs flex items-center justify-between cursor-pointer hover:brightness-[0.98] active:scale-[0.98] transition-all"
        >
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-black text-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="truncate">المتصلون الآن</span>
            </div>
            <div className="text-sm sm:text-base font-black text-teal-950 tabular-nums leading-tight">
              {totalActiveUsersCount} <span className="text-[9.5px] font-bold text-teal-800">عضو</span>
            </div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Real-time Cumulative Visitors (Firestore totalVisitors) */}
        <div className="relative overflow-hidden px-3 py-2 rounded-xl bg-gradient-to-br from-amber-100 via-rose-100 to-orange-100 border border-amber-300/90 text-amber-950 shadow-xs flex items-center justify-between">
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-black text-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="truncate">إجمالي الزوار</span>
            </div>
            <div className="text-sm sm:text-base font-black text-amber-950 tabular-nums leading-tight">
              {(cumulativeVisitorsCount || 15480).toLocaleString()} <span className="text-[9.5px] font-bold text-rose-800">زائر</span>
            </div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Quick Wallet */}
        <button
          type="button"
          onClick={onOpenWallet}
          className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-black text-xs flex items-center justify-between transition active:scale-95 cursor-pointer"
        >
          <span>شحن الكوينز 🪙</span>
          <Coins className="w-4 h-4 text-amber-600" />
        </button>

        {/* Quick VIP & Missions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenVip}
            className="flex-1 h-full px-2.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>VIP</span>
          </button>
          {onOpenMissions && (
            <button
              type="button"
              onClick={onOpenMissions}
              className="flex-1 h-full px-2.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-purple-600" />
              <span>مهامي</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Compact Horizontal Strip: ONLY غرفة مصر 1 & غرفة مصر 2 */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl p-2.5 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
            <span>🇪🇬 غرف شات مصر العامة</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              مفتوحة 24/7
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setShowMobileMissions(prev => !prev)}
            className="lg:hidden px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
          >
            <Target className="w-3 h-3 text-amber-600" />
            <span>مهام الغرف اليومية</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coreEgyptRooms.map((room) => {
            const isEgypt1 = room.id === 'room_egypt';
            const gradientTheme = isEgypt1
              ? 'from-[#7c2d12]/95 via-[#991b1b]/90 to-[#b45309]/95 border-amber-300/50'
              : 'from-[#0c4a6e]/95 via-[#1d4ed8]/90 to-[#0f766e]/95 border-sky-300/50';
            const coverBgImage = isEgypt1
              ? "url('/assets/wallpapers/nature_nile_sunset.jpg')"
              : "url('/assets/wallpapers/nature_starry_oasis.jpg')";
            const ctaColor = isEgypt1 ? 'text-[#991b1b]' : 'text-[#1e40af]';
            const canManageThisRoom =
              isOwner ||
              room.ownerId === currentUser.id ||
              room.hostId === currentUser.id ||
              (room.moderators || []).includes(currentUser.id);

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${gradientTheme} border p-4 sm:p-5 min-h-[152px] sm:min-h-[172px] text-white shadow-md hover:shadow-xl hover:brightness-105 active:scale-[0.99] transition-all flex flex-col justify-between gap-3`}
              >
                {/* Atmospheric Cover Image Layer */}
                <div
                  aria-hidden="true"
                  style={{
                    backgroundImage: coverBgImage,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                  className="absolute inset-0 opacity-25 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent pointer-events-none"
                />

                {/* Top Cover Header: Icon + Title + Live Counter */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center shrink-0 shadow-sm">
                      {isEgypt1 ? <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-white" /> : <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-white" />}
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-sm sm:text-base font-black truncate drop-shadow-xs">{room.title}</h3>
                        {room.isLocked && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-rose-500/40 border border-rose-200/80 text-amber-100 shrink-0 shadow-2xs"
                            title="الغرفة مقفلة حالياً"
                            aria-label="الغرفة مقفلة"
                          >
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-xs border border-white/20 text-[10px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                        <span>{Math.max(1, room.activeUsers || 1)} عضو متصل الآن</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle Cover Description */}
                <p className="relative z-10 text-xs sm:text-[13px] text-white/95 font-medium leading-relaxed line-clamp-2 text-right">
                  {room.isLocked ? '🔒 هذه الغرفة مقفلة مؤقتاً من قِبل الإدارة.' : room.description}
                </p>

                {/* Bottom Cover Footer & Prominent Enter Button */}
                <div className="relative z-10 flex items-center justify-between gap-2 pt-1 border-t border-white/15">
                  <span className="text-[10.5px] font-bold text-white/85 truncate">
                    {room.isLocked ? 'دخول المديرين فقط' : isEgypt1 ? '🇪🇬 تجمع المصريين الرئيسي' : '✨ سهر وتعارف على مدار الساعة'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom(room);
                    }}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shrink-0 shadow-md transition-transform group-hover:scale-[1.02] cursor-pointer ${
                      room.isLocked && !canManageThisRoom
                        ? 'bg-white/95 text-rose-700'
                        : `bg-white ${ctaColor}`
                    }`}
                  >
                    {room.isLocked && !canManageThisRoom ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>مقفلة</span>
                      </>
                    ) : (
                      <>
                        <span>دخول الغرفة</span>
                        {room.isLocked ? <Lock className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Mobile Shared Daily Missions Panel */}
      {showMobileMissions && (
        <div className="lg:hidden bg-white border border-amber-200 rounded-2xl p-3 space-y-2.5 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-500" />
              <span>مهام الغرف اليومية المشتركة 🤝</span>
            </h3>
            <span className="text-[10px] text-amber-700 font-bold">هدف جماعي</span>
          </div>
          <div className="space-y-2">
            {sharedMissions.map((m) => {
              const pct = Math.min(100, Math.round(((m.currentProgress || 0) / Math.max(1, m.targetProgress)) * 100));
              const isCompleted = (m.currentProgress || 0) >= m.targetProgress;
              const isClaimed = (m.claimedBy || []).includes(currentUser.id);
              return (
                <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900">{m.title}</span>
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">+{m.rewardCoins} 🪙</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600">{m.description}</p>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-600">{m.currentProgress} / {m.targetProgress} ({pct}%)</span>
                    {isCompleted && !isClaimed ? (
                      <button onClick={() => handleClaimShared(m)} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black">استلام الجائزة 🎁</button>
                    ) : isClaimed ? (
                      <span className="text-emerald-600 font-black flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> تم الاستلام</span>
                    ) : (
                      <span className="text-indigo-600 font-bold">{m.rewardVipLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Main Grid: Social Dating Forum + Shared Daily Room Missions Sidebar (Desktop lg+) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Main Column: منتدى التعارف والتواصل الاجتماعي */}
        <div className="lg:col-span-8 space-y-3">
          {/* Forum Header & Composer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  <span>منتدى التعارف والتواصل الاجتماعي الراقى</span>
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  شارك خاطرة تعارف، رحّب بالأعضاء، أو ابدأ محادثة خاصة فورية مع المتواجدين 🌸
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] font-black">
                {filteredPosts.length} مشاركة
              </span>
            </div>

            {/* Post Composer */}
            <form onSubmit={handlePublishPost} className="space-y-2">
              <textarea
                rows={2}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="اكتب منشور تعارف، تحية، أو خاطرة جميلة ليراها الجميع..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>ينشر باسم: <strong className="text-slate-800">{currentUser.name}</strong></span>
                </div>
                <button
                  type="submit"
                  disabled={!postText.trim() || isPublishing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPublishing ? 'جاري النشر...' : 'نشر في المنتدى'}</span>
                </button>
              </div>
            </form>

            {/* Simple Filter Buttons: الكل | الشباب | البنات | المتواجدون الآن */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100 text-xs font-bold">
              {[
                { id: 'all', label: 'الكل 🌟' },
                { id: 'male', label: 'الشباب 👨' },
                { id: 'female', label: 'البنات 👩' },
                { id: 'online', label: 'المتواجدون الآن 🟢' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setForumFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    forumFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Forum Posts Feed */}
          {filteredPosts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2 shadow-sm">
              <div className="text-3xl">🌸</div>
              <h3 className="text-sm font-black text-slate-900">لا توجد منشورات في هذا التصنيف بعد</h3>
              <p className="text-xs text-slate-500">كن أول من يبدأ التعارف وينشر تحية جميلة في المنتدى!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPosts.map((post) => {
                const isPostAuthorOnline = onlineUserIds.has(post.authorId) || post.authorId === currentUser.id;
                const isLikedByMe = (post.likedBy || []).includes(currentUser.id);
                const isCommentsOpen = expandedCommentPostId === post.id;
                const canDelete = isOwner || post.authorId === currentUser.id;

                const peerForDm: User = onlineUsers.find(u => u.id === post.authorId) || {
                  id: post.authorId,
                  name: post.authorName,
                  username: post.authorName.toLowerCase().replace(/\s+/g, '_'),
                  avatar: post.authorAvatar,
                  bio: 'عضو في منتدى شات مصر',
                  country: 'مصر',
                  countryFlag: post.authorCountryFlag || '🇪🇬',
                  role: post.authorRole || 'member',
                  coins: 0,
                  earningsEgp: 0,
                  earningsUsd: 0,
                  vipBadge: post.authorVipBadge || '',
                  frameStyle: 'border-slate-300',
                  profileWallpaper: '',
                  fontPreference: 'cairo',
                  isOnline: isPostAuthorOnline,
                  status: isPostAuthorOnline ? 'online' : 'offline',
                  joinedAt: '',
                  gender: post.authorGender || 'male',
                  level: 1,
                  likesReceived: 0,
                  giftsReceivedCount: 0
                };

                return (
                  <div
                    key={post.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-indigo-200 transition-all"
                  >
                    {/* Post Author Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-100 bg-slate-100 flex items-center justify-center font-black text-indigo-700 text-sm">
                            {post.authorAvatar ? (
                              <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span>{post.authorName.charAt(0)}</span>
                            )}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              isPostAuthorOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={isPostAuthorOnline ? 'متصل الآن' : 'غير متصل'}
                          />
                        </div>

                        <div className="min-w-0 text-right">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900 truncate">{post.authorName}</span>
                            <span className="text-xs">{post.authorCountryFlag || '🇪🇬'}</span>
                            {post.authorVipBadge && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-black">
                                {post.authorVipBadge}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className={isPostAuthorOnline ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                              {isPostAuthorOnline ? '● متصل الآن' : '○ غير متصل'}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeArabicTime(post.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteForumPost(post.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="حذف المنشور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Post Body */}
                    <p className="mt-2.5 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                      {post.text}
                    </p>

                    {/* Post Action Buttons: إعجاب ❤️ | تعليق 💬 | مراسلة خاصة ✉️ */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(post)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            isLikedByMe
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span>إعجاب</span>
                          <span className="tabular-nums">({post.likesCount || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedCommentPostId(isCommentsOpen ? null : post.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            isCommentsOpen
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                          }`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>تعليق</span>
                          <span className="tabular-nums">({post.commentsCount || 0})</span>
                        </button>
                      </div>

                      {post.authorId !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => onOpenPrivateChatWith(peerForDm)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>مراسلة خاصة ✉️</span>
                        </button>
                      )}
                    </div>

                    {isCommentsOpen && <ForumPostCommentsSection postId={post.id} currentUser={currentUser} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Sidebar (Desktop lg+): مهام الغرف اليومية المشتركة */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-20 space-y-3">
          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span>مهام الغرف اليومية المشتركة</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  تعاونوا معاً لتحقيق الأهداف الجماعية وفتح جوائز VIP للجميع 🤝
                </p>
              </div>
              <Gift className="w-5 h-5 text-rose-500 shrink-0" />
            </div>

            <div className="space-y-2.5">
              {sharedMissions.map((m) => {
                const pct = Math.min(100, Math.round(((m.currentProgress || 0) / Math.max(1, m.targetProgress)) * 100));
                const isCompleted = (m.currentProgress || 0) >= m.targetProgress;
                const isClaimed = (m.claimedBy || []).includes(currentUser.id);

                return (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base shrink-0">{m.icon}</span>
                        <h4 className="text-xs font-black text-slate-900 truncate">{m.title}</h4>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black shrink-0">
                        +{m.rewardCoins} 🪙
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">{m.description}</p>

                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                        <span>التقدم الجماعي: {m.currentProgress} / {m.targetProgress}</span>
                        <span>{(m.contributors || []).length} مساهم</span>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      {m.rewardVipLabel && (
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                          🎁 {m.rewardVipLabel}
                        </span>
                      )}
                      {isCompleted && !isClaimed ? (
                        <button
                          type="button"
                          onClick={() => handleClaimShared(m)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shadow-xs transition cursor-pointer"
                        >
                          استلام الآن 🎉
                        </button>
                      ) : isClaimed ? (
                        <span className="text-[10.5px] text-emerald-600 font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> تم الاستلام
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">مستمرة</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
