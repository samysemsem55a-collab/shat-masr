import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  Lock,
  Pin,
  Image as ImageIcon,
  X,
  Trophy,
  MoreVertical,
  Share2,
  Radio,
  Mic
} from 'lucide-react';
import { Room, User, ForumPost, ForumComment, SharedRoomMission, Friend } from '../types/chat';
import {
  subscribeToForumPosts,
  createForumPost,
  toggleForumPostLike,
  toggleForumPostPin,
  subscribeToForumComments,
  addForumComment,
  deleteForumPost,
  subscribeToSharedRoomMissions,
  contributeToSharedRoomMission,
  claimSharedMissionReward,
  recordForumPostView,
  subscribeToFriendsList,
  sendDirectMessage,
  subscribeToAllRoomsTypingFromRTDB,
  subscribeToAllRoomLastMessages
} from '../services/firebase';
import { isUserAdminOrOwner } from '../data/seedData';
import { getRankDisplayMeta } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import { StoriesBar } from './StoriesBar';
import { compressImageFile } from '../utils/imageCompression';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { sounds } from '../utils/soundEffects';
import { realtimeSocket, AllRoomsTypingMap } from '../services/realtimeSocket';
import { formatRelativeArabicTime } from '../utils/dateFormat';
import { toast } from '../utils/appToast';

interface RoomsViewProps {
  rooms: Room[];
  currentUser: User;
  onlineUsers: User[];
  onSelectRoom: (room: Room) => void;
  onOpenPrivateChatWith: (user: User) => void;
  onShareForumPost?: (post: ForumPost) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenLeaderboard?: () => void;
  onOpenMissions?: () => void;
  onClaimSharedRewardCoins?: (coins: number, label?: string) => void;
  totalActiveUsersCount?: number;
  registeredUsersCount?: number;
  cumulativeVisitorsCount?: number;
  onOpenOnlineUsers?: () => void;
  onOpenUserProfile?: (user: User) => void;
  unreadForumNotifsCount?: number;
  unreadStoryNotifsCount?: number;
  onOpenNotifications?: () => void;
  onOpenCreateTextRoom?: () => void;
  onOpenCreateVoiceRoom?: () => void;
  onRequestJoinRoom?: (room: Room) => void;
  onCloseRoom?: (roomId: string) => void;
  onOpenRadio?: () => void;
  isRadioPlaying?: boolean;
}


const ForumCommentsModal: React.FC<{
  post: ForumPost | null;
  currentUser: User;
  onlineUsers: User[];
  onClose: () => void;
  onOpenUserProfile?: (user: User) => void;
}> = ({ post, currentUser, onlineUsers, onClose, onOpenUserProfile }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!post?.id) return;
    setComments([]);
    return subscribeToForumComments(post.id, setComments);
  }, [post?.id]);

  if (!post) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSending) return;
    setIsSending(true);
    try {
      await addForumComment(post.id, currentUser, commentText, post.authorId);
      setCommentText('');
      contributeToSharedRoomMission('forum', currentUser.id, 1);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1E293B] dark:text-slate-100"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-l from-[#9d174d] via-[#be185d] to-[#db2777] text-white border-b border-rose-400/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">التعليقات على منشور {post.authorName}</h3>
              <p className="text-[11px] text-rose-100">{comments.length} تعليق</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Original Post Snippet */}
        <div className="px-4 py-2.5 bg-rose-50/70 dark:bg-rose-950/30 border-b border-rose-200/70 dark:border-rose-900/50 shrink-0">
          <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">{post.text}</p>
        </div>

        {/* Comments List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 bg-slate-50/80 dark:bg-slate-950/80">
          {comments.length > 0 ? (
            comments.map((c) => {
              const matchedOnline = onlineUsers.find((u) => u.id === c.authorId);
              const commentAuthorUser: User = matchedOnline || {
                id: c.authorId || `comment_${c.id}`,
                name: c.authorName || 'عضو شات مصر',
                username: (c.authorName || 'member').toLowerCase().replace(/\s+/g, '_'),
                avatar: c.authorAvatar || '',
                bio: 'عضو في منتدى شات مصر',
                country: 'مصر',
                countryFlag: '🇪🇬',
                role: 'member',
                coins: 0,
                earningsEgp: 0,
                earningsUsd: 0,
                vipBadge: '',
                frameStyle: 'border-slate-300',
                profileWallpaper: '',
                fontPreference: 'cairo',
                isOnline: Boolean(matchedOnline),
                status: matchedOnline ? 'online' : 'offline',
                joinedAt: '',
                gender: 'male',
                level: 1,
                likesReceived: 0,
                giftsReceivedCount: 0,
              };
              return (
                <div key={c.id} className="flex items-start gap-2.5 bg-white dark:bg-slate-900 rounded-2xl p-2.5 border border-rose-100 dark:border-rose-900/40 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenUserProfile) {
                        onClose();
                        onOpenUserProfile(commentAuthorUser);
                      }
                    }}
                    className="w-8 h-8 rounded-full overflow-hidden bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800 cursor-pointer hover:ring-2 hover:ring-rose-400 transition"
                    title="عرض الملف الشخصي"
                  >
                    {c.authorAvatar ? (
                      <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{(c.authorName || 'ع').charAt(0)}</span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenUserProfile) {
                            onClose();
                            onOpenUserProfile(commentAuthorUser);
                          }
                        }}
                        className="text-xs font-black text-slate-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 hover:underline truncate cursor-pointer text-right"
                      >
                        {c.authorName}
                      </button>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{formatRelativeArabicTime(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-1 break-words">{c.text}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 space-y-1.5">
              <div className="text-2xl">💬</div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد تعليقات حتى الآن</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">كن أول من يضيف تعليقاً راقياً على هذا المنشور!</p>
            </div>
          )}
        </div>

        {/* Add Comment Input */}
        <form onSubmit={handleAddComment} className="p-3 bg-white dark:bg-slate-900 border-t border-rose-100 dark:border-rose-900/50 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="اكتب تعليقك هنا..."
            autoFocus
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || isSending}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#be185d] to-[#db2777] hover:from-[#9d174d] hover:to-[#be185d] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'جاري الإرسال...' : 'إرسال'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

const ForumLikesModal: React.FC<{
  post: ForumPost | null;
  currentUser: User;
  onlineUsers: User[];
  onClose: () => void;
  onToggleLike: (post: ForumPost) => void;
  onOpenPrivateChatWith: (user: User) => void;
  onOpenUserProfile?: (user: User) => void;
}> = ({ post, currentUser, onlineUsers, onClose, onToggleLike, onOpenPrivateChatWith, onOpenUserProfile }) => {
  if (!post) return null;

  const likedIds = Array.from(new Set(post.likedBy || []));
  const isLikedByMe = likedIds.includes(currentUser.id);

  const resolvedLikers = likedIds.map((uid) => {
    const stored = post.likedUsers?.[uid];
    const online = onlineUsers.find((u) => u.id === uid);
    const selfMatch = uid === currentUser.id ? currentUser : null;
    const base = stored || online || selfMatch;

    return {
      id: uid,
      name: base?.name || 'عضو شات مصر',
      avatar: base?.avatar || '',
      countryFlag: (base as any)?.countryFlag || '🇪🇬',
      role: (base?.role || 'member') as User['role'],
      vipBadge: base?.vipBadge || '',
      gender: (base?.gender || 'male') as 'male' | 'female',
      fullUser: online || selfMatch || null,
    };
  });

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#1E293B] dark:text-slate-100"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-l from-[#9d174d] via-[#be185d] to-[#db2777] text-white border-b border-rose-400/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center">
              <Heart className="w-4 h-4 fill-white text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">المعجبون بالمنشور</h3>
              <p className="text-[11px] text-rose-100">{Math.max(likedIds.length, post.likesCount || 0)} إعجاب</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Likers List */}
        <div className="p-3 overflow-y-auto flex-1 space-y-2 bg-slate-50/80 dark:bg-slate-950/80">
          {resolvedLikers.length > 0 ? (
            resolvedLikers.map((liker) => {
              const rankMeta = getRankDisplayMeta(liker.role, liker.vipBadge);
              const isMe = liker.id === currentUser.id;
              const likerUserObj: User = liker.fullUser || {
                id: liker.id,
                name: liker.name,
                username: liker.name.toLowerCase().replace(/\s+/g, '_'),
                avatar: liker.avatar,
                bio: 'عضو في منتدى شات مصر',
                country: 'مصر',
                countryFlag: liker.countryFlag || '🇪🇬',
                role: liker.role,
                coins: 0,
                earningsEgp: 0,
                earningsUsd: 0,
                vipBadge: liker.vipBadge || '',
                frameStyle: 'border-slate-300',
                profileWallpaper: '',
                fontPreference: 'cairo',
                isOnline: true,
                status: 'online',
                joinedAt: '',
                gender: liker.gender,
                level: 1,
                likesReceived: 0,
                giftsReceivedCount: 0,
              };
              return (
                <div
                  key={liker.id}
                  className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between gap-2 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenUserProfile) {
                        onClose();
                        onOpenUserProfile(likerUserObj);
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 text-right cursor-pointer group"
                  >
                    <AvatarWithFrame
                      user={{
                        id: liker.id,
                        name: liker.name,
                        avatar: liker.avatar,
                        role: liker.role,
                        vipBadge: liker.vipBadge,
                      }}
                      size="sm"
                    />
                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-black truncate group-hover:underline ${rankMeta.nameColorClass}`}>
                          {liker.name}
                        </span>
                        <span className="text-xs">{liker.countryFlag}</span>
                      </div>
                      {rankMeta.isPrivileged ? (
                        <span className={`inline-block mt-0.5 text-[9.5px] px-1.5 py-0.2 rounded border font-black ${rankMeta.badgeClass}`}>
                          {rankMeta.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {liker.gender === 'female' ? 'عضوة 👩' : 'عضو 👨'}
                        </span>
                      )}
                    </div>
                  </button>

                  {!isMe ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPrivateChatWith(
                          liker.fullUser || {
                            id: liker.id,
                            name: liker.name,
                            username: liker.name.toLowerCase().replace(/\s+/g, '_'),
                            avatar: liker.avatar,
                            bio: 'عضو في منتدى شات مصر',
                            country: 'مصر',
                            countryFlag: liker.countryFlag || '🇪🇬',
                            role: liker.role,
                            coins: 0,
                            earningsEgp: 0,
                            earningsUsd: 0,
                            vipBadge: liker.vipBadge || '',
                            frameStyle: 'border-slate-300',
                            profileWallpaper: '',
                            fontPreference: 'cairo',
                            isOnline: true,
                            status: 'online',
                            joinedAt: '',
                            gender: liker.gender,
                            level: 1,
                            likesReceived: 0,
                            giftsReceivedCount: 0,
                          }
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-800 text-[11px] font-black transition cursor-pointer shrink-0"
                    >
                      مراسلة ✉️
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                      أنت
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 space-y-2">
              <div className="text-2xl">❤️</div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد إعجابات على هذا المنشور بعد</p>
              <button
                type="button"
                onClick={() => onToggleLike(post)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer"
              >
                كن أول المعجبين ❤️
              </button>
            </div>
          )}
        </div>

        {/* Footer quick toggle like */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-rose-100 dark:border-rose-900/50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleLike(post)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isLikedByMe
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-gradient-to-r from-[#be185d] to-[#db2777] hover:from-[#9d174d] hover:to-[#be185d] text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            <span>{isLikedByMe ? 'إلغاء إعجابي' : 'إعجاب بالمنشور'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ForumViewersModal: React.FC<{
  post: ForumPost | null;
  currentUser: User;
  onlineUsers: User[];
  onClose: () => void;
  onOpenUserProfile?: (user: User) => void;
}> = ({ post, currentUser, onlineUsers, onClose, onOpenUserProfile }) => {
  if (!post || post.authorId !== currentUser.id) return null;

  const rawViewers = post.viewers ? Object.values(post.viewers) : [];
  const viewersMap = new Map<string, { id: string; userId?: string; name: string; avatar?: string; viewedAt: number }>();
  rawViewers.forEach((v) => {
    if (v?.id) viewersMap.set(v.id, v);
  });
  (post.viewedBy || []).forEach((uid) => {
    if (!uid || uid === post.authorId || viewersMap.has(uid)) return;
    const online = onlineUsers.find((u) => u.id === uid);
    viewersMap.set(uid, {
      id: uid,
      userId: uid,
      name: online?.name || 'عضو شات مصر',
      avatar: online?.avatar || '',
      viewedAt: post.createdAt || Date.now(),
    });
  });

  const viewersList = Array.from(viewersMap.values()).sort(
    (a, b) => (b.viewedAt || 0) - (a.viewedAt || 0)
  );
  const totalViews = Math.max(post.viewsCount || 0, viewersList.length, post.viewedBy?.length || 0);

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#1E293B] dark:text-slate-100"
      >
        <div className="p-4 bg-gradient-to-l from-[#9d174d] via-[#be185d] to-[#db2777] text-white border-b border-rose-400/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">المشاهدون للمنشور</h3>
              <p className="text-[11px] text-rose-100">شافه {totalViews} عضو</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50/80 dark:bg-slate-950/80">
          {viewersList.length === 0 ? (
            <div className="text-center py-8 space-y-1.5">
              <div className="text-2xl">👁️</div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد مشاهدات مسجلة حتى الآن</p>
            </div>
          ) : (
            viewersList.map((viewer) => {
              const matchedOnline = onlineUsers.find((u) => u.id === (viewer.userId || viewer.id));
              const profileTarget: User = matchedOnline || {
                id: viewer.userId || viewer.id,
                name: viewer.name || 'عضو شات مصر',
                username: (viewer.name || 'member').toLowerCase().replace(/\s+/g, '_'),
                avatar: viewer.avatar || '',
                bio: 'عضو في منتدى شات مصر',
                country: 'مصر',
                countryFlag: '🇪🇬',
                role: 'member',
                coins: 0,
                earningsEgp: 0,
                earningsUsd: 0,
                vipBadge: '',
                frameStyle: 'border-slate-300',
                profileWallpaper: '',
                fontPreference: 'cairo',
                isOnline: Boolean(matchedOnline),
                status: matchedOnline ? 'online' : 'offline',
                joinedAt: '',
                gender: 'male',
                level: 1,
                likesReceived: 0,
                giftsReceivedCount: 0,
              };

              return (
                <button
                  key={viewer.id}
                  type="button"
                  onClick={() => {
                    if (onOpenUserProfile) {
                      onClose();
                      onOpenUserProfile(profileTarget);
                    }
                  }}
                  className="w-full flex items-center justify-between gap-2.5 bg-white dark:bg-slate-900 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 rounded-2xl p-2.5 border border-rose-100 dark:border-rose-900/40 shadow-2xs text-right cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {viewer.avatar ? (
                      <img
                        src={viewer.avatar}
                        alt={viewer.name}
                        className="w-9 h-9 rounded-full object-cover border border-rose-200 dark:border-rose-800 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-black text-xs flex items-center justify-center shrink-0">
                        {(viewer.name || 'ع').charAt(0)}
                      </span>
                    )}
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">{viewer.name}</span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {formatRelativeArabicTime(viewer.viewedAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

function areForumPostsEqual(a: ForumPost[], b: ForumPost[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i];
    const p2 = b[i];
    if (
      p1.id !== p2.id ||
      p1.text !== p2.text ||
      p1.likesCount !== p2.likesCount ||
      p1.commentsCount !== p2.commentsCount ||
      (p1.viewsCount || 0) !== (p2.viewsCount || 0) ||
      (p1.viewedBy || []).length !== (p2.viewedBy || []).length ||
      Object.keys(p1.viewers || {}).length !== Object.keys(p2.viewers || {}).length ||
      (p1.likedBy || []).length !== (p2.likedBy || []).length ||
      Object.keys(p1.likedUsers || {}).length !== Object.keys(p2.likedUsers || {}).length ||
      p1.authorName !== p2.authorName ||
      p1.authorAvatar !== p2.authorAvatar ||
      Boolean(p1.isPinned) !== Boolean(p2.isPinned) ||
      p1.imageUrl !== p2.imageUrl
    ) {
      return false;
    }
  }
  return true;
}

function areSharedMissionsEqual(a: SharedRoomMission[], b: SharedRoomMission[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const m1 = a[i];
    const m2 = b[i];
    if (
      m1.id !== m2.id ||
      m1.currentProgress !== m2.currentProgress ||
      m1.targetProgress !== m2.targetProgress ||
      (m1.contributors || []).length !== (m2.contributors || []).length ||
      (m1.claimedBy || []).length !== (m2.claimedBy || []).length
    ) {
      return false;
    }
  }
  return true;
}

export const RoomsView: React.FC<RoomsViewProps> = React.memo(({
  rooms,
  currentUser,
  onlineUsers,
  onSelectRoom,
  onOpenPrivateChatWith,
  onShareForumPost,
  onOpenWallet,
  onOpenVip,
  onOpenLeaderboard,
  onOpenMissions,
  onClaimSharedRewardCoins,
  totalActiveUsersCount = 1,
  registeredUsersCount = 1,
  cumulativeVisitorsCount = 15480,
  onOpenOnlineUsers,
  onOpenUserProfile,
  unreadForumNotifsCount = 0,
  unreadStoryNotifsCount = 0,
  onOpenNotifications,
  onOpenCreateTextRoom,
  onOpenCreateVoiceRoom,
  onRequestJoinRoom,
  onCloseRoom,
  onOpenRadio,
  isRadioPlaying = false,
}) => {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumLimit, setForumLimit] = useState<number>(20);
  const [claimingMissionIds, setClaimingMissionIds] = useState<Record<string, boolean>>({});
  const [localClaimedMissionIds, setLocalClaimedMissionIds] = useState<Record<string, boolean>>({});
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImageUrl, setPostImageUrl] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [forumFilter, setForumFilter] = useState<'all' | 'trend' | 'male' | 'female' | 'online'>('all');
  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null);
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);
  const [viewersModalPostId, setViewersModalPostId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [sharedMissions, setSharedMissions] = useState<SharedRoomMission[]>([]);
  const [showMobileMissions, setShowMobileMissions] = useState(false);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState<Room | null>(null);
  const [sharePostModal, setSharePostModal] = useState<ForumPost | null>(null);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('post');
      return p || null;
    } catch {
      return null;
    }
  });
  const [socketState, setSocketState] = useState<'connected' | 'reconnecting' | 'disconnected'>(() =>
    realtimeSocket.getConnectionState()
  );
  const forumImageInputRef = React.useRef<HTMLInputElement>(null);
  const isStrictOwner = isUserAdminOrOwner(currentUser);

  const activeCommentsPost = useMemo(
    () => forumPosts.find((p) => p.id === commentsModalPostId) || null,
    [forumPosts, commentsModalPostId]
  );
  const activeLikesPost = useMemo(
    () => forumPosts.find((p) => p.id === likesModalPostId) || null,
    [forumPosts, likesModalPostId]
  );
  const activeViewersPost = useMemo(
    () => forumPosts.find((p) => p.id === viewersModalPostId) || null,
    [forumPosts, viewersModalPostId]
  );

  // Public rooms (Egypt 1 & 2) first, followed compactly by member-created text/voice rooms directly above the Forum
  const visibleRooms = useMemo(() => {
    const publicPrimary = rooms.filter(
      (r) => r.id === 'room_egypt' || r.id === 'room_egypt2'
    );
    const createdOrLive = rooms.filter(
      (r) =>
        r.id !== 'room_egypt' &&
        r.id !== 'room_egypt2' &&
        (!r.isPrivate ||
          isUserAdminOrOwner(currentUser) ||
          r.ownerId === currentUser.id ||
          r.hostId === currentUser.id)
    );
    return [...publicPrimary, ...createdOrLive];
  }, [rooms, currentUser]);

  const onlineUserIds = useMemo(() => new Set(onlineUsers.map(u => u.id)), [onlineUsers]);
  const isOwner = isUserAdminOrOwner(currentUser) || currentUser.role === 'admin' || currentUser.role === 'super_admin';

  useEffect(() => {
    const unsubForum = subscribeToForumPosts((nextPosts) => {
      setForumPosts(prev => (areForumPostsEqual(prev, nextPosts) ? prev : nextPosts));
    }, forumLimit);
    return () => unsubForum();
  }, [forumLimit]);

  useEffect(() => {
    const unsubMissions = subscribeToSharedRoomMissions((nextMissions) => {
      setSharedMissions(prev => (areSharedMissionsEqual(prev, nextMissions) ? prev : nextMissions));
    });
    return () => unsubMissions();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    return subscribeToFriendsList(currentUser.id, setFriendsList);
  }, [currentUser?.id]);

  useEffect(() => {
    return realtimeSocket.subscribeToConnectionState(setSocketState);
  }, []);

  // Live Pulse Indicator & Numeric Counter for rooms receiving new messages (guides users to most active rooms)
  const [pulsingRoomsMap, setPulsingRoomsMap] = useState<Record<string, { count: number; updatedAt: number }>>({});
  const prevRoomLastMsgRef = useRef<Record<string, { timestamp?: number; content?: string }>>({});
  const hasSeededRoomPulseRef = useRef<boolean>(false);

  useEffect(() => {
    const now = Date.now();
    const newlyActiveIds: string[] = [];

    for (const room of rooms) {
      const lm = room.lastMessage;
      const prev = prevRoomLastMsgRef.current[room.id];

      if (!hasSeededRoomPulseRef.current) {
        if (lm?.timestamp && now - lm.timestamp < 15000) {
          newlyActiveIds.push(room.id);
        }
      } else if (lm?.timestamp || lm?.content) {
        const isNewerTs = Boolean(lm.timestamp && (!prev?.timestamp || lm.timestamp > prev.timestamp));
        const isSameTsChangedContent = Boolean(
          lm.content &&
            prev &&
            lm.content !== prev.content &&
            (!lm.timestamp || !prev.timestamp || lm.timestamp >= prev.timestamp)
        );
        if (isNewerTs || isSameTsChangedContent || (!prev && lm.content)) {
          newlyActiveIds.push(room.id);
        }
      }

      if (lm?.timestamp || lm?.content) {
        prevRoomLastMsgRef.current[room.id] = {
          timestamp: lm?.timestamp ?? prev?.timestamp,
          content: lm?.content ?? prev?.content,
        };
      }
    }

    hasSeededRoomPulseRef.current = true;

    if (newlyActiveIds.length > 0) {
      setPulsingRoomsMap((prev) => {
        const next = { ...prev };
        for (const id of newlyActiveIds) {
          const existing = next[id];
          next[id] = {
            count: existing ? existing.count + 1 : 1,
            updatedAt: now,
          };
        }
        return next;
      });
    }
  }, [rooms]);

  useEffect(() => {
    const unsubLastMsgs = subscribeToAllRoomLastMessages((lastMessages) => {
      const now = Date.now();
      const newlyActiveIds: string[] = [];
      for (const [roomId, lm] of Object.entries(lastMessages || {})) {
        const prev = prevRoomLastMsgRef.current[roomId];
        const isNewerTs = Boolean(lm?.timestamp && (!prev?.timestamp || lm.timestamp > prev.timestamp));
        const isSameTsChangedContent = Boolean(
          lm?.content &&
            prev &&
            lm.content !== prev.content &&
            lm.timestamp === prev.timestamp
        );
        if ((isNewerTs || isSameTsChangedContent) && (!lm?.timestamp || now - lm.timestamp < 20000)) {
          newlyActiveIds.push(roomId);
          prevRoomLastMsgRef.current[roomId] = {
            timestamp: lm?.timestamp ?? prev?.timestamp,
            content: lm?.content ?? prev?.content,
          };
        }
      }
      if (newlyActiveIds.length > 0) {
        setPulsingRoomsMap((prev) => {
          const next = { ...prev };
          for (const id of newlyActiveIds) {
            const existing = next[id];
            next[id] = {
              count: existing ? existing.count + 1 : 1,
              updatedAt: now,
            };
          }
          return next;
        });
      }
    });
    return () => unsubLastMsgs();
  }, []);

  useEffect(() => {
    if (Object.keys(pulsingRoomsMap).length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setPulsingRoomsMap((prev) => {
        let changed = false;
        const next: Record<string, { count: number; updatedAt: number }> = {};
        for (const [id, entry] of Object.entries(prev)) {
          if (now - entry.updatedAt < 15000) {
            next[id] = entry;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [pulsingRoomsMap]);

  // Real-time WebSocket + Firebase RTDB typing indicator across all public rooms
  const [typingByRoom, setTypingByRoom] = useState<AllRoomsTypingMap>({});
  useEffect(() => {
    let wsMap: AllRoomsTypingMap = {};
    let rtdbMap: AllRoomsTypingMap = {};

    const emitMerged = () => {
      const next: AllRoomsTypingMap = {};
      const allRoomIds = new Set([...Object.keys(wsMap), ...Object.keys(rtdbMap)]);
      allRoomIds.forEach((roomId) => {
        const dedup = new Map<string, { id: string; name: string }>();
        (wsMap[roomId] || []).forEach((u) => {
          if (u?.id) dedup.set(u.id, u);
        });
        (rtdbMap[roomId] || []).forEach((u) => {
          if (u?.id) dedup.set(u.id, u);
        });
        if (dedup.size > 0) {
          next[roomId] = Array.from(dedup.values());
        }
      });
      setTypingByRoom(next);
    };

    const unsubTyping = realtimeSocket.subscribeToAllRoomsTyping((nextMap) => {
      wsMap = nextMap || {};
      emitMerged();
    });
    const unsubRtdbTyping = subscribeToAllRoomsTypingFromRTDB((nextMap) => {
      rtdbMap = nextMap || {};
      emitMerged();
    });
    return () => {
      unsubTyping();
      unsubRtdbTyping();
    };
  }, []);

  useEffect(() => {
    if (!highlightedPostId || forumPosts.length === 0) return;
    const el = document.getElementById(`forum-post-${highlightedPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedPostId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightedPostId, forumPosts]);

  // Record real unique views ONLY when a post actually enters the user's viewport (strictly once per viewer)
  useEffect(() => {
    if (!currentUser?.id || forumPosts.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      forumPosts.forEach((post) => {
        if (post.id && post.authorId !== currentUser.id) {
          recordForumPostView(post.id, currentUser).catch(() => {});
        }
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id');
            if (postId) {
              recordForumPostView(postId, currentUser).catch(() => {});
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.4 }
    );

    forumPosts.forEach((post) => {
      if (!post.id || post.authorId === currentUser.id) return;
      const alreadyViewed = Boolean(
        post.viewers?.[currentUser.id] || (post.viewedBy || []).includes(currentUser.id)
      );
      if (alreadyViewed) return;
      const el = document.getElementById(`forum-post-${post.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [forumPosts, currentUser]);

  // @username mention autocomplete match in composer
  const mentionSuggestions = useMemo(() => {
    const match = postText.match(/@([^\s@]*)$/);
    if (!match) return [];
    const term = match[1].toLowerCase();
    return onlineUsers
      .filter((u) => u.id !== currentUser.id && (!term || u.name.toLowerCase().includes(term) || (u.username || '').toLowerCase().includes(term)))
      .slice(0, 5);
  }, [postText, onlineUsers, currentUser.id]);

  const handleInsertMention = (mentionName: string) => {
    const safeTag = mentionName.replace(/\s+/g, '_');
    setPostText((prev) => prev.replace(/@([^\s@]*)$/, `@${safeTag} `));
  };

  const handleSelectForumImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    try {
      const compressed = await compressImageFile(file, { maxWidth: 800, maxBytes: 195 * 1024 });
      setPostImageUrl(compressed);
      setIsComposerExpanded(true);
    } catch {
      toast.error('تعذر ضغط ومعالجة الصورة المختارة');
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!postText.trim() && !postImageUrl) || isPublishing) return;
    if (currentUser.isBanned || currentUser.isMuted) {
      toast.error('حسابك مقيد حالياً من النشر');
      return;
    }
    setIsPublishing(true);
    try {
      await createForumPost(currentUser, postText.trim() || '📸 مشاركة صورة', postImageUrl || undefined);
      setPostText('');
      setPostImageUrl('');
      setIsComposerExpanded(false);
      contributeToSharedRoomMission('forum', currentUser.id, 1);
      toast.success('تم نشر مشاركتك في منتدى التعارف بنجاح ✨');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleTogglePin = async (post: ForumPost) => {
    if (!isOwner) return;
    const nextPinned = !post.isPinned;
    await toggleForumPostPin(post.id, nextPinned, currentUser.name);
    toast.success(nextPinned ? 'تم تثبيت المنشور في أعلى المنتدى 📌' : 'تم إلغاء تثبيت المنشور');
  };

  const handleToggleLike = async (post: ForumPost) => {
    const liked = (post.likedBy || []).includes(currentUser.id);
    await toggleForumPostLike(post.id, currentUser.id, liked, currentUser, post.authorId);
    if (!liked) {
      contributeToSharedRoomMission('likes', currentUser.id, 1);
    }
  };

  const handleClaimShared = async (mission: SharedRoomMission) => {
    if (mission.currentProgress < mission.targetProgress) return;
    if (
      (mission.claimedBy || []).includes(currentUser.id) ||
      localClaimedMissionIds[mission.id] ||
      claimingMissionIds[mission.id]
    ) {
      return;
    }
    setClaimingMissionIds((prev) => ({ ...prev, [mission.id]: true }));
    setLocalClaimedMissionIds((prev) => ({ ...prev, [mission.id]: true }));
    try {
      await claimSharedMissionReward(mission.id, currentUser.id);
      sounds.playGiftFanfare();
      if (onClaimSharedRewardCoins) {
        onClaimSharedRewardCoins(mission.rewardCoins, mission.rewardVipLabel);
      }
      toast.success(`مبروك! تم استلام جائزة المهمة الجماعية (+${mission.rewardCoins} كوينز) 🎉`);
    } finally {
      setClaimingMissionIds((prev) => {
        const next = { ...prev };
        delete next[mission.id];
        return next;
      });
    }
  };

  const handleSharePostToFriend = async (friend: Friend, post: ForumPost) => {
    const targetId = friend.friendId || friend.id;
    const snippet = (post.text || '').slice(0, 120);
    await sendDirectMessage(currentUser.id, targetId, {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientId: targetId,
      recipientName: friend.name,
      recipientAvatar: friend.avatar,
      type: 'private',
      content: `📌 مشاركة منشور من "${post.authorName}":\n${snippet}${post.text.length > 120 ? '...' : ''}`,
      timestamp: Date.now(),
      status: 'sent',
    });
    setSharePostModal(null);
    toast.success(`تمت مشاركة المنشور مع ${friend.name} في الخاص ✉️`);
  };

  const filteredPosts = useMemo(() => {
    const now = Date.now();
    const base = forumPosts.filter((post) => {
      if (forumFilter === 'male') return post.authorGender === 'male';
      if (forumFilter === 'female') return post.authorGender === 'female';
      if (forumFilter === 'online') return onlineUserIds.has(post.authorId) || post.authorId === currentUser.id;
      return true;
    });

    return [...base].sort((a, b) => {
      if (forumFilter === 'trend') {
        const aIs24h = now - (a.createdAt || 0) <= 86400000 ? 1 : 0;
        const bIs24h = now - (b.createdAt || 0) <= 86400000 ? 1 : 0;
        if (bIs24h !== aIs24h) return bIs24h - aIs24h;
        const aScore = (a.likesCount || 0) * 2 + (a.commentsCount || 0) * 3 + (a.viewsCount || 0);
        const bScore = (b.likesCount || 0) * 2 + (b.commentsCount || 0) * 3 + (b.viewsCount || 0);
        if (bScore !== aScore) return bScore - aScore;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [forumPosts, forumFilter, onlineUserIds, currentUser.id]);

  return (
    <div className="pb-24 pt-1.5 sm:pt-2 px-2 sm:px-4 max-w-6xl mx-auto space-y-1.5 sm:space-y-2" dir="rtl">
      {/* 1. Compact Live Stats Strip */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {/* Live Online Users Count Only */}
        <div
          onClick={onOpenOnlineUsers}
          className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-100 border border-teal-300/90 text-teal-950 shadow-xs flex items-center justify-between cursor-pointer hover:brightness-[0.98] active:scale-[0.98] transition-all"
        >
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-black text-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
              <span className="truncate">المتصلون الآن</span>
              {typeof navigator !== 'undefined' && navigator.onLine === false && socketState !== 'connected' && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold shrink-0">
                  جاري التحديث...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 leading-tight">
              <span className="text-xs sm:text-sm font-black text-teal-950 tabular-nums">
                {Math.max(1, totalActiveUsersCount).toLocaleString()}
              </span>
              <span className="text-[9.5px] sm:text-[10px] font-bold text-emerald-800 whitespace-nowrap">
                متصل الآن
              </span>
            </div>
          </div>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Users strokeWidth={2} className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-100 saturate-110 brightness-105" />
          </div>
        </div>

        {/* Live Members Counter (299+ baseline preserved; visitors readout removed) */}
        <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-br from-amber-100 via-rose-100 to-orange-100 border border-amber-300/90 text-amber-950 shadow-xs flex items-center justify-between gap-1.5">
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-black text-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span className="truncate">الأعضاء</span>
            </div>
            <div className="flex items-baseline gap-1 leading-tight mt-0.5">
              <span className="text-xs sm:text-sm font-black text-amber-950 tabular-nums">
                {Math.max(0, registeredUsersCount || 0).toLocaleString()}
                <span className="text-[9px] sm:text-[9.5px] font-bold text-rose-800 mr-0.5">عضو</span>
              </span>
            </div>
          </div>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shrink-0">
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
      </div>

      {/* Top Horizontal Quick Pills Row — 4 calm pastel flat pills in one row, zero scroll, zero neon/shadow */}
      <div
        dir="rtl"
        className="flex flex-nowrap gap-1.5 sm:gap-2 w-full px-1 sm:px-[10px] overflow-hidden"
      >
        {!isStrictOwner && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="flex-1 basis-0 min-w-0 h-[33px] sm:h-[38px] rounded-[18px] sm:rounded-[20px] px-1 bg-[#FFF1E0] text-[#9A4A00] border border-[#FFE0B8] text-[11.5px] sm:text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-1 sm:gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[13.5px] sm:text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">🪙</span>
            <span className="truncate">شحن الكوينز</span>
          </button>
        )}

        {onOpenLeaderboard && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex-1 basis-0 min-w-0 h-[33px] sm:h-[38px] rounded-[18px] sm:rounded-[20px] px-1 bg-[#F0EBFF] text-[#4C2A9E] border border-[#DDD0FF] text-[11.5px] sm:text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-1 sm:gap-[5px] active:scale-95 transition-transform cursor-pointer"
            title="قائمة الكبار - التوب 10"
          >
            <span className="text-[13.5px] sm:text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">🏆</span>
            <span className="truncate">الكبار</span>
          </button>
        )}

        {!isStrictOwner && (
          <button
            type="button"
            onClick={onOpenVip}
            className="flex-1 basis-0 min-w-0 h-[33px] sm:h-[38px] rounded-[18px] sm:rounded-[20px] px-1 bg-[#FFF8D6] text-[#7A5A00] border border-[#F0E3A0] text-[11.5px] sm:text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-1 sm:gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[13.5px] sm:text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">👑</span>
            <span className="truncate">VIP</span>
          </button>
        )}

        {onOpenMissions && (
          <button
            type="button"
            onClick={onOpenMissions}
            className="flex-1 basis-0 min-w-0 h-[33px] sm:h-[38px] rounded-[18px] sm:rounded-[20px] px-1 bg-[#E6F4EA] text-[#1A6B3C] border border-[#C8E6D2] text-[11.5px] sm:text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-1 sm:gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[13.5px] sm:text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">✅</span>
            <span className="truncate">مهامي</span>
          </button>
        )}
      </div>

      {/* Main Screen Vivid Animated Radio Launcher (continuous vivid color shift + brisk vertical bounce, zero clipping) */}
      {onOpenRadio && (
        <div className="pt-3 pb-1 px-1 sm:px-[10px] overflow-visible">
          <button
            type="button"
            onClick={onOpenRadio}
            className="w-full rounded-2xl px-3 py-2.5 bg-gradient-to-l from-orange-500/15 via-rose-500/15 to-fuchsia-600/15 dark:from-orange-500/20 dark:via-rose-500/20 dark:to-fuchsia-600/20 border border-rose-300/80 dark:border-rose-500/40 flex items-center justify-between gap-2.5 shadow-xs hover:brightness-[0.98] active:scale-[0.99] transition-all cursor-pointer overflow-visible"
          >
            <div className="flex items-center gap-2.5 min-w-0 overflow-visible">
              <span
                className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg shrink-0 radio-vivid-bounce ${
                  isRadioPlaying ? 'ring-2 ring-amber-300' : 'ring-1 ring-white/50'
                }`}
              >
                <Radio strokeWidth={2.4} className="w-5 h-5 text-white drop-shadow-xs" />
              </span>
              <div className="text-right min-w-0">
                <div className="text-xs sm:text-[13px] font-black text-rose-900 dark:text-rose-100 flex items-center gap-1.5 truncate">
                  <span>راديو شات مصر FM</span>
                  {isRadioPlaying && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                      مباشر
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] font-bold text-rose-700/90 dark:text-rose-200/80 truncate">
                  {isRadioPlaying
                    ? 'البث يعمل الآن • اضغط للتحكم في المحطات والأغاني'
                    : 'استمع لأشهر إذاعات القرآن والطرب والأغاني العربية مجاناً'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-gradient-to-l from-orange-500 via-rose-500 to-fuchsia-600 text-white text-[10.5px] font-black shrink-0 shadow-xs">
              {isRadioPlaying ? 'تحكم' : 'تشغيل'}
            </span>
          </button>
        </div>
      )}

      {/* 1.5 Interactive 24h Stories Carousel */}
      <StoriesBar
        currentUser={currentUser}
        onOpenUserProfile={onOpenUserProfile}
        unreadStoryNotifsCount={unreadStoryNotifsCount}
        onOpenNotifications={onOpenNotifications}
      />

      {/* 2. Top Compact Rooms Strip: Dual Create Buttons + Egypt 1 & 2 + Newly Created Member/Voice Rooms */}
      <div id="home-rooms-section" className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl mt-1 p-2 sm:p-2.5 shadow-sm">
        {/* Dual Equal Full-Width Create Room Action Buttons */}
        <div dir="rtl" className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => onOpenCreateTextRoom?.()}
            className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-[11.5px] sm:text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">إنشاء غرفة دردشة</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenCreateVoiceRoom?.()}
            className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-l from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-[11.5px] sm:text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">إنشاء غرفة صوتية</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleRooms.map((room) => {
            const isEgypt1 = room.id === 'room_egypt';
            const isLiveAudio = room.roomType === 'live_audio' || room.category === 'live_audio';
            const gradientTheme = isLiveAudio
              ? 'from-[#4c1d95]/95 via-[#6d28d9]/90 to-[#be185d]/95 border-purple-300/50'
              : isEgypt1
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

            const roomPulseEntry = pulsingRoomsMap[room.id];
            const newMsgCount = roomPulseEntry?.count || 0;
            const isRoomPulsing = newMsgCount > 0;
            const formattedNewMsgCount = newMsgCount > 99 ? '99+' : String(newMsgCount);

            const roomTypingUsers = (typingByRoom[room.id] || []).filter(
              (u) => u.id && u.id !== currentUser.id
            );
            const roomTypingText =
              roomTypingUsers.length === 1
                ? `${roomTypingUsers[0].name} يكتب الآن...`
                : roomTypingUsers.length === 2
                ? `${roomTypingUsers[0].name} و ${roomTypingUsers[1].name} يكتبان الآن...`
                : roomTypingUsers.length > 2
                ? `${roomTypingUsers[0].name} و ${roomTypingUsers[1].name} و+${roomTypingUsers.length - 2} يكتبون...`
                : '';

            return (
              <div
                key={room.id}
                onClick={() => {
                  if (isRoomPulsing) {
                    setPulsingRoomsMap((prev) => {
                      if (!(room.id in prev)) return prev;
                      const next = { ...prev };
                      delete next[room.id];
                      return next;
                    });
                  }
                  onSelectRoom(room);
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${gradientTheme} border p-2.5 min-h-[78px] sm:min-h-[86px] text-white shadow-sm hover:shadow-lg hover:brightness-105 active:scale-[0.99] transition-all flex flex-col justify-between gap-1 ${
                  isRoomPulsing ? 'ring-2 ring-amber-300/75 shadow-[0_6px_22px_rgba(251,191,36,0.28)]' : ''
                }`}
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

                {/* Top Cover Header: Icon (with Live Pulse + Numeric Counter on new messages) + Title + Live Counter */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {isRoomPulsing && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-amber-300/75 motion-safe:animate-ping pointer-events-none"
                        />
                      )}
                      <div
                        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center shadow-sm transition-all ${
                          isRoomPulsing
                            ? 'bg-amber-400/35 border-amber-200 ring-2 ring-amber-300/80 shadow-[0_0_16px_rgba(251,191,36,0.65)] motion-safe:animate-pulse'
                            : 'bg-white/20 border-white/40'
                        }`}
                      >
                        {isLiveAudio ? (
                          <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-100' : 'text-white'}`} />
                        ) : isEgypt1 ? (
                          <MessageSquare className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-100' : 'text-white'}`} />
                        ) : (
                          <Flame className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-100' : 'text-white'}`} />
                        )}
                      </div>
                      {isRoomPulsing && (
                        <span
                          key={newMsgCount}
                          aria-label={`${newMsgCount} رسالة جديدة نشطة`}
                          title={`${newMsgCount} رسالة جديدة`}
                          className="absolute -top-1.5 -left-1.5 z-20 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-400 text-white text-[10px] leading-none font-black tabular-nums border-[1.5px] border-white shadow-[0_2px_8px_rgba(245,158,11,0.85)] pointer-events-none"
                        >
                          <span
                            aria-hidden="true"
                            className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-65"
                          />
                          <span className="relative drop-shadow-xs">{formattedNewMsgCount}</span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs sm:text-sm font-black truncate drop-shadow-xs">{room.title}</h3>
                        {isRoomPulsing && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black shrink-0 shadow-xs motion-safe:animate-pulse tabular-nums">
                            <span>{newMsgCount > 1 ? `نشط +${formattedNewMsgCount} 🔥` : 'نشط الآن 🔥'}</span>
                          </span>
                        )}
                        {isLiveAudio && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black shrink-0 animate-pulse">
                            <Radio className="w-2.5 h-2.5" />
                            <span>LIVE 🎙️</span>
                          </span>
                        )}
                        {room.isLocked && (
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-rose-500/40 border border-rose-200/80 text-amber-100 shrink-0"
                            title="الغرفة مقفلة حالياً"
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        {roomTypingUsers.length > 0 ? (
                          <motion.div
                            key={`typing-${room.id}-${roomTypingUsers.map((u) => u.id).join(',')}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            aria-live="polite"
                            className="mt-0.5 inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-200/55 text-emerald-50 text-[10px] font-black shadow-2xs"
                          >
                            <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
                              <span className="w-1 h-1 rounded-full bg-emerald-200 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1 h-1 rounded-full bg-emerald-100 animate-bounce [animation-delay:150ms]" />
                              <span className="w-1 h-1 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                            </span>
                            <span className="truncate">{roomTypingText}</span>
                          </motion.div>
                        ) : (
                          <motion.p
                            key={`desc-${room.id}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-[10.5px] text-white/90 font-medium truncate"
                          >
                            {room.isLocked ? '🔒 مقفلة مؤقتاً من الإدارة' : room.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-xs border border-white/20 text-[10px] font-black shrink-0 tabular-nums">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        (room.activeUsers || 0) > 0 ? 'bg-emerald-300 animate-pulse' : 'bg-slate-300/70'
                      }`}
                    ></span>
                    <span>{Math.max(0, room.activeUsers || 0)} متصل</span>
                  </span>
                </div>

                {/* Live Room Last Message Preview */}
                {room.lastMessage?.content ? (
                  <div className="relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/30 backdrop-blur-xs border border-white/20 text-[10.5px] text-white/95 truncate shadow-2xs">
                    <span className="font-black text-amber-300 shrink-0">{room.lastMessage.senderName}:</span>
                    <span className="truncate opacity-95">{room.lastMessage.content}</span>
                  </div>
                ) : (
                  <div className="relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/20 backdrop-blur-xs border border-white/10 text-[10px] text-white/80 truncate">
                    <span>💬 لا توجد رسائل بعد — كن أول من يبدأ الدردشة</span>
                  </div>
                )}

                {/* Bottom Cover Footer & Centered Enter / Request Join / Close Room Buttons */}
                <div className="relative z-10 flex flex-col gap-1.5 pt-1.5 border-t border-white/15">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-white/85">
                    <span className="truncate">
                      {room.isLocked
                        ? 'دخول المديرين فقط'
                        : isEgypt1
                        ? '🇪🇬 تجمع المصريين الرئيسي'
                        : room.isPrivate
                        ? '🔒 غرفة خاصة'
                        : '✨ سهر وتعارف على مدار الساعة'}
                    </span>

                    {onCloseRoom &&
                      room.id !== 'room_egypt' &&
                      room.id !== 'room_egypt2' &&
                      (isOwner || room.ownerId === currentUser.id || room.hostId === currentUser.id) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmCloseRoom(room);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-700 border border-rose-200/50 text-white font-black text-[10px] flex items-center gap-1 shrink-0 transition cursor-pointer shadow-xs"
                          title="إغلاق الغرفة نهائياً"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>إغلاق الغرفة</span>
                        </button>
                      )}
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {onRequestJoinRoom &&
                      Boolean(room.isPrivate) &&
                      !isOwner &&
                      room.ownerId !== currentUser.id &&
                      room.hostId !== currentUser.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestJoinRoom(room);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-black/35 hover:bg-black/50 border border-white/30 text-white font-black text-[10.5px] shrink-0 transition cursor-pointer"
                          title="إرسال طلب انضمام لمالك الغرفة"
                        >
                          طلب انضمام
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoom(room);
                      }}
                      className={`px-4 py-1.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shrink-0 shadow-sm transition-transform group-hover:scale-[1.02] cursor-pointer ${
                        room.isLocked && !canManageThisRoom
                          ? 'bg-white/95 text-rose-700'
                          : `bg-white ${ctaColor}`
                      }`}
                    >
                      {room.isLocked && !canManageThisRoom ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>مقفلة</span>
                        </>
                      ) : (
                        <>
                          <span>دخول الغرفة</span>
                          {room.isLocked ? <Lock className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                        </>
                      )}
                    </button>
                  </div>
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
              const isClaimed = Boolean((m.claimedBy || []).includes(currentUser.id) || localClaimedMissionIds[m.id]);
              const isClaiming = Boolean(claimingMissionIds[m.id]);
              return (
                <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{m.title}</span>
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">+{m.rewardCoins} 🪙</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-300">{m.description}</p>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">{m.currentProgress} / {m.targetProgress} ({pct}%)</span>
                    {isCompleted && !isClaimed ? (
                      <button disabled={isClaiming} onClick={() => handleClaimShared(m)} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black cursor-pointer">
                        {isClaiming ? 'جاري الاستلام...' : 'استلام الجائزة 🎁'}
                      </button>
                    ) : isClaimed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> تم الاستلام</span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{m.rewardVipLabel}</span>
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
          {/* Forum Header Banner Strip Only (Pink/Rose) + Clean Neutral Body/Composer/Feed */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Rich Pink/Rose Forum Header Banner Strip Only */}
            <div
              style={{
                background: 'linear-gradient(135deg, #831843 0%, #be185d 45%, #db2777 80%, #ec4899 100%)',
              }}
              className="relative overflow-hidden bg-gradient-to-br from-[#831843] via-[#be185d] to-[#ec4899] px-3.5 py-3 text-white border-b border-rose-400/30"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)] pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10 pointer-events-none"
              />
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 drop-shadow-xs">
                      <span>منتدى التعارف والتواصل الاجتماعي الراقي</span>
                    </h1>
                    <p className="text-[10.5px] text-rose-50/95 mt-0.5 font-medium">
                      شارك خاطرة تعارف، صورة لطيفة، أو ابدأ محادثة خاصة فورية 🌸
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadForumNotifsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenNotifications?.()}
                      className="px-2.5 py-1 rounded-full bg-white text-[#be185d] hover:bg-rose-50 text-[10px] font-black flex items-center gap-1 shadow-xs tabular-nums cursor-pointer transition"
                      title="عرض إشعارات المنتدى غير المقروءة"
                    >
                      <span>🔔</span>
                      <span>{unreadForumNotifsCount > 99 ? '99+' : unreadForumNotifsCount}</span>
                    </button>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-xs border border-white/30 text-white text-[10px] font-black">
                    {filteredPosts.length} مشاركة
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 space-y-2.5 bg-white dark:bg-slate-900">
              {/* Hidden image input for forum posts */}
              <input
                ref={forumImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectForumImage}
                className="hidden"
              />

              {/* Compact 1-Line Trigger Expanding to Full Post Composer */}
              {!isComposerExpanded && !postText && !postImageUrl ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerExpanded(true)}
                    className="flex-1 text-right bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold transition cursor-text"
                  >
                    اكتب حاجة حلوة... شارك خاطرة أو تحية مع الأعضاء ✍️
                  </button>
                  <button
                    type="button"
                    onClick={() => forumImageInputRef.current?.click()}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 transition"
                    title="إرفاق صورة"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">صورة</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePublishPost} className="space-y-2 relative">
                  <textarea
                    rows={2}
                    autoFocus
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="اكتب منشور تعارف، تحية، أو اذكر صديق بـ @..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#db2777] resize-none"
                  />

                  {/* @username Autocomplete Dropdown */}
                  {mentionSuggestions.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 space-y-1 z-30">
                      <span className="text-[10px] font-black text-[#be185d] dark:text-rose-300 px-2 block">إشارة إلى عضو متصل:</span>
                      {mentionSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleInsertMention(u.name)}
                          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-right text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="truncate">{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {postImageUrl && (
                    <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-xs">
                      <img src={postImageUrl} alt="معاينة الصورة" className="max-h-36 w-auto object-contain" />
                      <button
                        type="button"
                        onClick={() => setPostImageUrl('')}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-slate-900/75 text-white flex items-center justify-center hover:bg-rose-600 cursor-pointer"
                        title="إزالة الصورة"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => forumImageInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-300 text-[11px] font-black flex items-center gap-1 cursor-pointer transition"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>إضافة صورة</span>
                      </button>
                      {!postText.trim() && !postImageUrl && (
                        <button
                          type="button"
                          onClick={() => setIsComposerExpanded(false)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                        >
                          طيّ
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={(!postText.trim() && !postImageUrl) || isPublishing}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#be185d] to-[#db2777] hover:from-[#9d174d] hover:to-[#be185d] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isPublishing ? 'جاري النشر...' : 'نشر في المنتدى'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* RTL Forum Filter Tabs: الكل (Default) | التريند | الشباب | البنات | المتواجدون الآن */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
                {[
                  { id: 'all', label: '🌟 الكل' },
                  { id: 'trend', label: '🔥 التريند' },
                  { id: 'male', label: '👦 الشباب' },
                  { id: 'female', label: '👧 البنات' },
                  { id: 'online', label: '🟢 المتواجدون الآن' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setForumFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                      forumFilter === tab.id
                        ? tab.id === 'trend'
                          ? 'bg-gradient-to-r from-amber-500 to-[#db2777] text-white shadow-xs'
                          : 'bg-gradient-to-r from-[#be185d] to-[#db2777] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Forum Posts Feed */}
          {filteredPosts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2 shadow-sm">
              <div className="text-3xl">🌸</div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">لا توجد منشورات في هذا التصنيف بعد</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">كن أول من يبدأ التعارف وينشر تحية جميلة في المنتدى!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPosts.map((post) => {
                const isPostAuthorOnline = onlineUserIds.has(post.authorId) || post.authorId === currentUser.id;
                const isLikedByMe = (post.likedBy || []).includes(currentUser.id);
                const canDelete = isOwner || post.authorId === currentUser.id;
                const authorRankMeta = getRankDisplayMeta(post.authorRole, post.authorVipBadge);

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
                    id={`forum-post-${post.id}`}
                    data-post-id={post.id}
                    className={`rounded-2xl p-2.5 sm:p-3 shadow-sm transition-all border ${
                      highlightedPostId === post.id
                        ? 'bg-white dark:bg-slate-900 border-rose-400 ring-2 ring-rose-300 dark:ring-rose-700'
                        : post.isPinned
                        ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-200/60 dark:ring-amber-800/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {post.isPinned && (
                      <div className="mb-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-[#9d174d] dark:text-rose-200 text-[10.5px] font-black">
                        <Pin className="w-3 h-3 text-[#be185d] dark:text-rose-300" />
                        <span>منشور مثبت من الإدارة 📌</span>
                      </div>
                    )}

                    {/* Post Author Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarWithFrame
                          user={{
                            id: post.authorId,
                            name: post.authorName,
                            avatar: post.authorAvatar,
                            role: post.authorRole || 'member',
                            vipBadge: post.authorVipBadge,
                            status: isPostAuthorOnline ? 'online' : 'offline'
                          }}
                          size="sm"
                          showOnlineDot={isPostAuthorOnline}
                          onClick={() => onOpenUserProfile?.(peerForDm)}
                          title="عرض الملف الشخصي"
                        />

                        <div className="min-w-0 text-right">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onOpenUserProfile?.(peerForDm)}
                              className={`text-xs sm:text-sm truncate cursor-pointer hover:underline ${authorRankMeta.nameColorClass}`}
                            >
                              {post.authorName}
                            </button>
                            <VerifiedBadge verified={Boolean(post.authorVerified || post.authorRole === 'owner')} size="sm" />
                            <span className="text-xs">{post.authorCountryFlag || '🇪🇬'}</span>
                            {isPostAuthorOnline && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                                متصل
                              </span>
                            )}
                            {authorRankMeta.isPrivileged && (
                              <span className={`text-[9.5px] px-1.5 py-0.5 rounded border font-black ${authorRankMeta.badgeClass}`}>
                                {authorRankMeta.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                            <span>{formatRelativeArabicTime(post.createdAt)}</span>
                            <span>•</span>
                            {(() => {
                              const viewersCountVal = Math.max(
                                post.viewsCount || 0,
                                post.viewers ? Object.keys(post.viewers).length : 0,
                                post.viewedBy?.length || 0
                              );
                              if (post.authorId === currentUser.id) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setViewersModalPostId(post.id)}
                                    className="font-bold text-[#be185d] dark:text-rose-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    title="عرض قائمة من شاهدوا المنشور"
                                  >
                                    <span>👁️ شافه {viewersCountVal}</span>
                                  </button>
                                );
                              }
                              return (
                                <span className="font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                                  <span>👁️ {viewersCountVal}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 relative">
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(post)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition cursor-pointer ${
                              post.isPinned
                                ? 'bg-[#be185d] text-white'
                                : 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-[#be185d] dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}
                            title={post.isPinned ? 'إلغاء التثبيت' : 'تثبيت المنشور'}
                          >
                            <Pin className="w-3 h-3" />
                            <span>{post.isPinned ? 'مثبت' : 'تثبيت'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenPostMenuId((prev) => (prev === post.id ? null : post.id))}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="خيارات المنشور"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openPostMenuId === post.id && (
                          <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 rounded-xl shadow-xl py-1 z-[100] text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPostMenuId(null);
                                if (onShareForumPost) {
                                  onShareForumPost(post);
                                } else {
                                  setSharePostModal(post);
                                }
                              }}
                              className="w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-[#be185d] dark:hover:text-rose-300 flex items-center gap-2 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>مشاركة في الخاص</span>
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPostMenuId(null);
                                  setConfirmDeletePostId(post.id);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف المنشور 🗑️</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Delete Confirmation Banner */}
                    {confirmDeletePostId === post.id && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs">
                        <span className="font-black text-rose-900 dark:text-rose-200">هل تريد حذف المنشور؟</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteForumPost(post.id);
                              setConfirmDeletePostId(null);
                              toast.success('تم حذف المنشور');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePostId(null)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Post Body with @Mention Highlights & Watch More Toggle (> 180 chars) */}
                    {(() => {
                      const rawText = post.text || '';
                      const isLong = rawText.length > 180;
                      const isExpanded = Boolean(expandedPostIds[post.id]);
                      const displayText = isLong && !isExpanded ? `${rawText.slice(0, 180)}...` : rawText;
                      const parts = displayText.split(/(@[^\s،.!؟]+)/g);
                      return (
                        <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/70">
                          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
                            {parts.map((part, idx) =>
                              part.startsWith('@') ? (
                                <span key={idx} className="font-black text-[#be185d] dark:text-rose-400">
                                  {part}
                                </span>
                              ) : (
                                <React.Fragment key={idx}>{part}</React.Fragment>
                              )
                            )}
                          </p>
                          {isLong && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPostIds((prev) => ({ ...prev, [post.id]: !isExpanded }))
                              }
                              className="mt-1 text-[11px] font-black text-[#be185d] dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              {isExpanded ? 'عرض أقل' : 'شاهد المزيد'}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {post.imageUrl && (
                      <div
                        onClick={() => setLightboxImageUrl(post.imageUrl || null)}
                        className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/75 flex items-center justify-center max-h-[230px] cursor-zoom-in group relative"
                        title="اضغط لتكبير الصورة"
                      >
                        <img
                          src={post.imageUrl}
                          alt="صورة المنشور"
                          className="w-full h-auto max-h-[230px] object-contain mx-auto group-hover:scale-[1.01] transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-slate-900/65 text-white text-[10px] font-bold backdrop-blur-xs">
                          🔍 تكبير
                        </span>
                      </div>
                    )}

                    {/* Compact Responsive Post Action Bar (Fits 360px+ cleanly without overflow) */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1 min-w-0 flex-wrap">
                        <div
                          className={`inline-flex items-center rounded-lg text-[10px] sm:text-[11px] font-black border overflow-hidden shrink-0 ${
                            isLikedByMe
                              ? 'bg-rose-50 dark:bg-rose-950/70 text-[#be185d] dark:text-rose-300 border-rose-300 dark:border-rose-700'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleLike(post)}
                            title={isLikedByMe ? 'إلغاء الإعجاب' : 'أعجبني'}
                            className="px-1.5 py-1 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 active:scale-95 transition flex items-center cursor-pointer"
                          >
                            <Heart className={`w-3 h-3 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLikesModalPostId(post.id)}
                            title="عرض قائمة المعجبين"
                            className="pr-1 pl-1.5 py-1 border-r border-slate-200 dark:border-slate-700 hover:bg-rose-100/50 dark:hover:bg-rose-900/40 active:scale-95 transition flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
                          >
                            <span>إعجاب</span>
                            <span className="tabular-nums">({post.likesCount || 0})</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCommentsModalPostId(post.id)}
                          className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black flex items-center gap-1 whitespace-nowrap transition active:scale-95 cursor-pointer bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>تعليق</span>
                          <span className="tabular-nums">({post.commentsCount || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onShareForumPost) {
                              onShareForumPost(post);
                            } else {
                              setSharePostModal(post);
                            }
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black flex items-center gap-1 whitespace-nowrap transition active:scale-95 cursor-pointer bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0"
                          title="مشاركة المنشور في المحادثة الخاصة"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>مشاركة</span>
                        </button>
                      </div>

                      {post.authorId !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => onOpenPrivateChatWith(peerForDm)}
                          className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#be185d] to-[#db2777] hover:from-[#9d174d] hover:to-[#be185d] text-white text-[10px] sm:text-[11px] font-black flex items-center gap-1 whitespace-nowrap shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                        >
                          <Mail className="w-3 h-3" />
                          <span>مراسلة</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 20-Item Pagination Load More Button */}
              {forumPosts.length >= forumLimit && (
                <button
                  type="button"
                  onClick={() => setForumLimit((prev) => prev + 20)}
                  className="w-full py-2.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black shadow-xs active:scale-98 transition cursor-pointer"
                >
                  تحميل المزيد ({forumPosts.length}) ↓
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky Sidebar (Desktop lg+): مهام الغرف اليومية المشتركة */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-20 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span>مهام الغرف اليومية المشتركة</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  تعاونوا معاً لتحقيق الأهداف الجماعية وفتح جوائز VIP للجميع 🤝
                </p>
              </div>
              <Gift className="w-5 h-5 text-rose-500 shrink-0" />
            </div>

            <div className="space-y-2.5">
              {sharedMissions.map((m) => {
                const pct = Math.min(100, Math.round(((m.currentProgress || 0) / Math.max(1, m.targetProgress)) * 100));
                const isCompleted = (m.currentProgress || 0) >= m.targetProgress;
                const isClaimed = Boolean((m.claimedBy || []).includes(currentUser.id) || localClaimedMissionIds[m.id]);
                const isClaiming = Boolean(claimingMissionIds[m.id]);

                return (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base shrink-0">{m.icon}</span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{m.title}</h4>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-black shrink-0">
                        +{m.rewardCoins} 🪙
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{m.description}</p>

                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        <span>التقدم الجماعي: {m.currentProgress} / {m.targetProgress}</span>
                        <span>{(m.contributors || []).length} مساهم</span>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      {m.rewardVipLabel && (
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg">
                          🎁 {m.rewardVipLabel}
                        </span>
                      )}
                      {isCompleted && !isClaimed ? (
                        <button
                          type="button"
                          disabled={isClaiming}
                          onClick={() => handleClaimShared(m)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-[11px] font-black shadow-xs transition cursor-pointer"
                        >
                          {isClaiming ? 'جاري الاستلام...' : 'استلام الآن 🎉'}
                        </button>
                      ) : isClaimed ? (
                        <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1">
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

      {/* Forum Likes List Modal */}
      <ForumLikesModal
        post={activeLikesPost}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        onClose={() => setLikesModalPostId(null)}
        onToggleLike={handleToggleLike}
        onOpenPrivateChatWith={onOpenPrivateChatWith}
        onOpenUserProfile={onOpenUserProfile}
      />

      {/* Forum Comments Modal */}
      <ForumCommentsModal
        post={activeCommentsPost}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        onClose={() => setCommentsModalPostId(null)}
        onOpenUserProfile={onOpenUserProfile}
      />

      {/* Owner-Only Forum Viewers Modal */}
      <ForumViewersModal
        post={activeViewersPost}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        onClose={() => setViewersModalPostId(null)}
        onOpenUserProfile={onOpenUserProfile}
      />

      {/* Share Forum Post to Friend DM Modal (z-[200]) */}
      {sharePostModal && (
        <div
          dir="rtl"
          onClick={() => setSharePostModal(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-4 shadow-2xl space-y-3 text-right"
          >
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#be185d] dark:text-rose-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">مشاركة المنشور مع صديق</h3>
              </div>
              <button
                type="button"
                onClick={() => setSharePostModal(null)}
                className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {friendsList.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">لا يوجد أصدقاء في قائمتك حالياً للمشاركة معهم.</p>
              ) : (
                friendsList.map((f) => (
                  <button
                    key={f.friendId || f.id}
                    type="button"
                    onClick={() => handleSharePostToFriend(f, sharePostModal)}
                    className="w-full p-2.5 rounded-2xl bg-rose-50/50 dark:bg-slate-800 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 border border-rose-100 dark:border-slate-700 flex items-center justify-between gap-2 text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">{f.name}</span>
                      <span className="text-xs">{f.countryFlag || '🇪🇬'}</span>
                    </div>
                    <span className="text-[11px] font-black text-[#be185d] dark:text-rose-400 shrink-0">إرسال ✉️</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Forum Image Lightbox (z-[200]) */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            aria-label="إغلاق الصورة"
            className="fixed top-4 left-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImageUrl}
            alt="عرض الصورة بالحجم الكامل"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

      {/* Close Room Confirmation Modal (z-[210]) */}
      {confirmCloseRoom && onCloseRoom && (
        <div
          dir="rtl"
          onClick={() => setConfirmCloseRoom(null)}
          className="fixed inset-0 z-[210] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-5 shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">تأكيد إغلاق الغرفة</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                  {confirmCloseRoom.title}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              هل أنت متأكد من إغلاق هذه الغرفة نهائياً؟ سيتم إخراج جميع المتواجدين وإزالتها من القائمة.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetId = confirmCloseRoom.id;
                  setConfirmCloseRoom(null);
                  onCloseRoom(targetId);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition cursor-pointer"
              >
                نعم، إغلاق الغرفة
              </button>
              <button
                type="button"
                onClick={() => setConfirmCloseRoom(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
