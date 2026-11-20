import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  sendDirectMessage
} from '../services/firebase';
import { isUserAdminOrOwner } from '../data/seedData';
import { getRankDisplayMeta } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import { StoriesBar } from './StoriesBar';
import { compressImageFile } from '../utils/imageCompression';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { sounds } from '../utils/soundEffects';
import { realtimeSocket } from '../services/realtimeSocket';
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
      await addForumComment(post.id, currentUser, commentText);
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
        className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1E293B]"
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1E293B]">التعليقات على منشور {post.authorName}</h3>
              <p className="text-[11px] text-slate-500">{comments.length} تعليق</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Original Post Snippet */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-slate-200 shrink-0">
          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">{post.text}</p>
        </div>

        {/* Comments List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 bg-[#F8FAFC]">
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
                <div key={c.id} className="flex items-start gap-2.5 bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenUserProfile) {
                        onClose();
                        onOpenUserProfile(commentAuthorUser);
                      }
                    }}
                    className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition"
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
                        className="text-xs font-black text-[#1E293B] hover:text-indigo-700 hover:underline truncate cursor-pointer text-right"
                      >
                        {c.authorName}
                      </button>
                      <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeArabicTime(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed mt-1 break-words">{c.text}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 space-y-1.5">
              <div className="text-2xl">💬</div>
              <p className="text-xs font-bold text-slate-600">لا توجد تعليقات حتى الآن</p>
              <p className="text-[11px] text-slate-400">كن أول من يضيف تعليقاً راقياً على هذا المنشور!</p>
            </div>
          )}
        </div>

        {/* Add Comment Input */}
        <form onSubmit={handleAddComment} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="اكتب تعليقك هنا..."
            autoFocus
            className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || isSending}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
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
        className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#1E293B]"
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1E293B]">المعجبون بالمنشور</h3>
              <p className="text-[11px] text-slate-500">{Math.max(likedIds.length, post.likesCount || 0)} إعجاب</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Likers List */}
        <div className="p-3 overflow-y-auto flex-1 space-y-2 bg-[#F8FAFC]">
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
                  className="p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
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
                        <span className="text-[10px] text-slate-400 font-medium">
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
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[11px] font-black transition cursor-pointer shrink-0"
                    >
                      مراسلة ✉️
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                      أنت
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 space-y-2">
              <div className="text-2xl">❤️</div>
              <p className="text-xs font-bold text-slate-600">لا توجد إعجابات على هذا المنشور بعد</p>
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
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleLike(post)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isLikedByMe
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
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
        className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#1E293B]"
      >
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1E293B]">المشاهدون للمنشور</h3>
              <p className="text-[11px] text-slate-500">شافه {totalViews} عضو</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-[#F8FAFC]">
          {viewersList.length === 0 ? (
            <div className="text-center py-8 space-y-1.5">
              <div className="text-2xl">👁️</div>
              <p className="text-xs font-bold text-slate-600">لا توجد مشاهدات مسجلة حتى الآن</p>
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
                  className="w-full flex items-center justify-between gap-2.5 bg-white hover:bg-indigo-50/70 rounded-2xl p-2.5 border border-slate-200 shadow-2xs text-right cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {viewer.avatar ? (
                      <img
                        src={viewer.avatar}
                        alt={viewer.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                        {(viewer.name || 'ع').charAt(0)}
                      </span>
                    )}
                    <span className="text-xs font-black text-[#1E293B] truncate">{viewer.name}</span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">
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
}) => {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumLimit, setForumLimit] = useState<number>(20);
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'all' | 'general' | 'live_audio'>('all');
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

  // Include غرفة مصر 1, غرفة مصر 2, and any active Live Audio rooms
  const visibleRooms = useMemo(() => {
    const core = rooms.filter(
      (r) =>
        r.id === 'room_egypt' ||
        r.id === 'room_egypt2' ||
        r.roomType === 'live_audio' ||
        r.category === 'live_audio'
    );
    if (roomCategoryFilter === 'general') {
      return core.filter((r) => r.roomType !== 'live_audio' && r.category !== 'live_audio');
    }
    if (roomCategoryFilter === 'live_audio') {
      return core.filter((r) => r.roomType === 'live_audio' || r.category === 'live_audio');
    }
    return core;
  }, [rooms, roomCategoryFilter]);

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

  // Live Pulse Indicator for rooms receiving new messages (guides users to most active rooms)
  const [pulsingRoomsMap, setPulsingRoomsMap] = useState<Record<string, number>>({});
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
        const isChangedContent = Boolean(lm.content && prev && lm.content !== prev.content);
        if (isNewerTs || isChangedContent || (!prev && lm.content)) {
          newlyActiveIds.push(room.id);
        }
      }

      prevRoomLastMsgRef.current[room.id] = {
        timestamp: lm?.timestamp,
        content: lm?.content,
      };
    }

    hasSeededRoomPulseRef.current = true;

    if (newlyActiveIds.length > 0) {
      setPulsingRoomsMap((prev) => {
        const next = { ...prev };
        for (const id of newlyActiveIds) {
          next[id] = now;
        }
        return next;
      });
    }
  }, [rooms]);

  useEffect(() => {
    const unsubLastMsgs = realtimeSocket.subscribeToAllRoomLastMessages((lastMessages) => {
      const now = Date.now();
      const newlyActiveIds: string[] = [];
      for (const [roomId, lm] of Object.entries(lastMessages || {})) {
        const prev = prevRoomLastMsgRef.current[roomId];
        const isNewer = Boolean(lm?.timestamp && (!prev?.timestamp || lm.timestamp > prev.timestamp));
        if (isNewer && now - lm.timestamp < 20000) {
          newlyActiveIds.push(roomId);
          prevRoomLastMsgRef.current[roomId] = { timestamp: lm.timestamp, content: lm.content };
        }
      }
      if (newlyActiveIds.length > 0) {
        setPulsingRoomsMap((prev) => {
          const next = { ...prev };
          for (const id of newlyActiveIds) {
            next[id] = now;
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
        const next: Record<string, number> = {};
        for (const [id, startedAt] of Object.entries(prev)) {
          if (now - startedAt < 12000) {
            next[id] = startedAt;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [pulsingRoomsMap]);

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
    await toggleForumPostLike(post.id, currentUser.id, liked, currentUser);
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
      const aPinned = Boolean(a.isPinned);
      const bPinned = Boolean(b.isPinned);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return (b.pinnedAt || b.createdAt) - (a.pinnedAt || a.createdAt);
      }
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
    <div className="pb-24 pt-2 px-2.5 sm:px-4 max-w-6xl mx-auto space-y-2" dir="rtl">
      {/* 1. Compact Live Stats Strip */}
      <div className="grid grid-cols-2 gap-2">
        {/* Live Online Users Count Only */}
        <div
          onClick={onOpenOnlineUsers}
          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-100 border border-teal-300/90 text-teal-950 shadow-xs flex items-center justify-between cursor-pointer hover:brightness-[0.98] active:scale-[0.98] transition-all"
        >
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-black text-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
              <span className="truncate">المتصلون الآن</span>
              {typeof navigator !== 'undefined' && navigator.onLine === false && socketState !== 'connected' && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold shrink-0">
                  جاري التحديث...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 leading-tight">
              <span className="text-sm font-black text-teal-950 tabular-nums">
                {Math.max(1, totalActiveUsersCount).toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 whitespace-nowrap">
                متصل الآن
              </span>
            </div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Users strokeWidth={2} className="w-3.5 h-3.5 opacity-100 saturate-110 brightness-105" />
          </div>
        </div>

        {/* Real-time Cumulative Visitors (Firestore totalVisitors) */}
        <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-100 via-rose-100 to-orange-100 border border-amber-300/90 text-amber-950 shadow-xs flex items-center justify-between">
          <div className="text-right min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-black text-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="truncate">إجمالي الزوار</span>
            </div>
            <div className="text-sm font-black text-amber-950 tabular-nums leading-tight">
              {(cumulativeVisitorsCount || 15480).toLocaleString()} <span className="text-[9.5px] font-bold text-rose-800">زائر</span>
            </div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Top Horizontal Quick Pills Row — 4 calm pastel flat pills in one row, zero scroll, zero neon/shadow */}
      <div
        dir="rtl"
        className="flex flex-nowrap gap-2 w-full px-[10px] overflow-hidden"
      >
        {!isStrictOwner && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="flex-1 basis-0 min-w-0 h-[38px] rounded-[20px] px-1 bg-[#FFF1E0] text-[#9A4A00] border border-[#FFE0B8] text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">🪙</span>
            <span className="truncate">شحن الكوينز</span>
          </button>
        )}

        {onOpenLeaderboard && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex-1 basis-0 min-w-0 h-[38px] rounded-[20px] px-1 bg-[#F0EBFF] text-[#4C2A9E] border border-[#DDD0FF] text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-[5px] active:scale-95 transition-transform cursor-pointer"
            title="قائمة الكبار - التوب 10"
          >
            <span className="text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">🏆</span>
            <span className="truncate">الكبار</span>
          </button>
        )}

        {!isStrictOwner && (
          <button
            type="button"
            onClick={onOpenVip}
            className="flex-1 basis-0 min-w-0 h-[38px] rounded-[20px] px-1 bg-[#FFF8D6] text-[#7A5A00] border border-[#F0E3A0] text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">👑</span>
            <span className="truncate">VIP</span>
          </button>
        )}

        {onOpenMissions && (
          <button
            type="button"
            onClick={onOpenMissions}
            className="flex-1 basis-0 min-w-0 h-[38px] rounded-[20px] px-1 bg-[#E6F4EA] text-[#1A6B3C] border border-[#C8E6D2] text-[12.5px] font-semibold whitespace-nowrap overflow-hidden flex items-center justify-center gap-[5px] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-[15px] leading-none shrink-0 opacity-100 saturate-110 brightness-105" aria-hidden="true">✅</span>
            <span className="truncate">مهامي</span>
          </button>
        )}
      </div>

      {/* 1.5 Interactive 24h Stories Carousel */}
      <StoriesBar currentUser={currentUser} onOpenUserProfile={onOpenUserProfile} />

      {/* 2. Top Compact Horizontal Strip: غرف شات مصر العامة + Live Audio Rooms */}
      <div id="home-rooms-section" className="bg-white/95 border border-slate-200 rounded-2xl mt-2 p-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 px-0.5 mb-2">
          <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
            <span>🇪🇬 غرف شات مصر</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              مفتوحة 24/7
            </span>
          </h2>
        </div>

        {/* Filter Row with Inline Room Missions — Fits cleanly on ONE single row without wrapping */}
        <div
          dir="rtl"
          className="w-full flex flex-nowrap items-center gap-1 sm:gap-1.5 justify-between mb-2"
        >
          {[
            { id: 'all', label: 'الكل' },
            { id: 'general', label: 'غرف عامة' },
            { id: 'live_audio', label: 'صوتية مباشرة' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setRoomCategoryFilter(pill.id as any)}
              className={`flex-1 min-w-0 justify-center text-[11px] sm:text-xs px-1.5 sm:px-3 py-1.5 rounded-[18px] whitespace-nowrap font-bold flex items-center transition cursor-pointer ${
                roomCategoryFilter === pill.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowMobileMissions(prev => !prev)}
            className="lg:hidden flex-1 min-w-0 justify-center text-[11px] px-1.5 py-1.5 rounded-[18px] whitespace-nowrap font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 flex items-center gap-1 cursor-pointer"
          >
            <Target className="w-3 h-3 text-amber-600 shrink-0" />
            <span>مهام الغرف</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
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

            const isRoomPulsing = Boolean(pulsingRoomsMap[room.id]);

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
                className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${gradientTheme} border p-3 min-h-[96px] sm:min-h-[108px] text-white shadow-sm hover:shadow-lg hover:brightness-105 active:scale-[0.99] transition-all flex flex-col justify-between gap-1.5 ${
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

                {/* Top Cover Header: Icon (with Live Pulse on new messages) + Title + Live Counter */}
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
                          <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-200' : 'text-white'}`} />
                        ) : isEgypt1 ? (
                          <MessageSquare className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-200' : 'text-white'}`} />
                        ) : (
                          <Flame className={`w-4 h-4 sm:w-5 sm:h-5 ${isRoomPulsing ? 'text-amber-200' : 'text-white'}`} />
                        )}
                      </div>
                      {isRoomPulsing && (
                        <span
                          aria-label="رسالة جديدة نشطة"
                          className="absolute -top-1 -left-1 flex h-3 w-3 pointer-events-none"
                        >
                          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-85" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border border-white shadow-xs" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs sm:text-sm font-black truncate drop-shadow-xs">{room.title}</h3>
                        {isRoomPulsing && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black shrink-0 shadow-xs motion-safe:animate-pulse">
                            <span>نشط الآن 🔥</span>
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
                      <p className="text-[10.5px] text-white/90 font-medium truncate">
                        {room.isLocked ? '🔒 مقفلة مؤقتاً من الإدارة' : room.description}
                      </p>
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

                {/* Bottom Cover Footer & Compact Enter Button */}
                <div className="relative z-10 flex items-center justify-between gap-2 pt-1 border-t border-white/15">
                  <span className="text-[10px] font-bold text-white/85 truncate">
                    {room.isLocked ? 'دخول المديرين فقط' : isEgypt1 ? '🇪🇬 تجمع المصريين الرئيسي' : '✨ سهر وتعارف على مدار الساعة'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom(room);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 shrink-0 shadow-sm transition-transform group-hover:scale-[1.02] cursor-pointer ${
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
          {/* Forum Header & Composer with Compact Matching Cover */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Compact Matching Forum Cover Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#312e81]/95 via-[#7c2d12]/90 to-[#b45309]/95 px-3.5 py-2.5 text-white border-b border-amber-300/30">
              <div
                aria-hidden="true"
                style={{
                  backgroundImage: "url('/assets/wallpapers/nature_nile_sunset.jpg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                className="absolute inset-0 opacity-20 pointer-events-none"
              />
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xs sm:text-sm font-black flex items-center gap-1.5 drop-shadow-xs">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>منتدى التعارف والتواصل الاجتماعي الراقي</span>
                  </h1>
                  <p className="text-[10.5px] text-white/90 mt-0.5">
                    شارك خاطرة تعارف، صورة لطيفة، أو ابدأ محادثة خاصة فورية 🌸
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-black/25 border border-white/25 text-white text-[10px] font-black">
                  {filteredPosts.length} مشاركة
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 space-y-2.5">
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
                    className="flex-1 text-right bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-500 font-bold transition cursor-text"
                  >
                    اكتب حاجة حلوة... شارك خاطرة أو تحية مع الأعضاء ✍️
                  </button>
                  <button
                    type="button"
                    onClick={() => forumImageInputRef.current?.click()}
                    className="px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                  />

                  {/* @username Autocomplete Dropdown */}
                  {mentionSuggestions.length > 0 && (
                    <div className="bg-white border border-indigo-200 rounded-xl shadow-lg p-1.5 space-y-1 z-30">
                      <span className="text-[10px] font-black text-indigo-600 px-2 block">إشارة إلى عضو متصل:</span>
                      {mentionSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleInsertMention(u.name)}
                          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-2 text-right text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="truncate">{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {postImageUrl && (
                    <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-xs">
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
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-black flex items-center gap-1 cursor-pointer transition"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>إضافة صورة</span>
                      </button>
                      {!postText.trim() && !postImageUrl && (
                        <button
                          type="button"
                          onClick={() => setIsComposerExpanded(false)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                        >
                          طيّ
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={(!postText.trim() && !postImageUrl) || isPublishing}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isPublishing ? 'جاري النشر...' : 'نشر في المنتدى'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* RTL Forum Filter Tabs: الكل (Default) | التريند | الشباب | البنات | المتواجدون الآن */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1.5 border-t border-slate-100 text-xs font-bold">
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
                          ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xs'
                          : 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
                        ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300'
                        : post.isPinned
                        ? 'bg-gradient-to-br from-amber-50/75 via-white to-rose-50/40 border-amber-300 ring-1 ring-amber-200'
                        : 'bg-white border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    {post.isPinned && (
                      <div className="mb-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px] font-black">
                        <Pin className="w-3 h-3 text-amber-700" />
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
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black">
                                متصل
                              </span>
                            )}
                            {authorRankMeta.isPrivileged && (
                              <span className={`text-[9.5px] px-1.5 py-0.5 rounded border font-black ${authorRankMeta.badgeClass}`}>
                                {authorRankMeta.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
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
                                    className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    title="عرض قائمة من شاهدوا المنشور"
                                  >
                                    <span>👁️ شافه {viewersCountVal}</span>
                                  </button>
                                );
                              }
                              return (
                                <span className="font-bold text-slate-600 inline-flex items-center gap-1">
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
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
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
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="خيارات المنشور"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openPostMenuId === post.id && (
                          <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[100] text-right">
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
                              className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer"
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
                                className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
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
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 text-xs">
                        <span className="font-black text-rose-900">هل تريد حذف المنشور؟</span>
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
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
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
                        <div className="mt-2 bg-slate-50/70 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                            {parts.map((part, idx) =>
                              part.startsWith('@') ? (
                                <span key={idx} className="font-black text-indigo-600">
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
                              className="mt-1 text-[11px] font-black text-indigo-600 hover:underline cursor-pointer"
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
                        className="mt-2 rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100/75 flex items-center justify-center max-h-[230px] cursor-zoom-in group relative"
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

                    {/* Flush Post Action Bar directly below image/body (Zero Empty Gaps) */}
                    <div className="mt-1 pt-0.5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`inline-flex items-center rounded-xl text-[11px] font-black border overflow-hidden ${
                            isLikedByMe
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleLike(post)}
                            title={isLikedByMe ? 'إلغاء الإعجاب' : 'أعجبني'}
                            className="px-2 py-1 hover:bg-rose-200/50 active:scale-95 transition flex items-center cursor-pointer"
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLikesModalPostId(post.id)}
                            title="عرض قائمة المعجبين"
                            className="pr-1 pl-2 py-1 border-r border-slate-200/80 hover:bg-rose-200/40 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>إعجاب</span>
                            <span className="tabular-nums">({post.likesCount || 0})</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCommentsModalPostId(post.id)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
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
                          className="px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200"
                          title="مشاركة المنشور في المحادثة الخاصة"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>مشاركة</span>
                        </button>
                      </div>

                      {post.authorId !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => onOpenPrivateChatWith(peerForDm)}
                          className="px-2 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10.5px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                        >
                          <Mail className="w-3 h-3" />
                          <span>مراسلة ✉️</span>
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
                  className="w-full py-2.5 rounded-2xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black shadow-xs active:scale-98 transition cursor-pointer"
                >
                  تحميل المزيد ({forumPosts.length}) ↓
                </button>
              )}
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
            className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-4 shadow-2xl space-y-3 text-right"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">مشاركة المنشور مع صديق</h3>
              </div>
              <button
                type="button"
                onClick={() => setSharePostModal(null)}
                className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {friendsList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">لا يوجد أصدقاء في قائمتك حالياً للمشاركة معهم.</p>
              ) : (
                friendsList.map((f) => (
                  <button
                    key={f.friendId || f.id}
                    type="button"
                    onClick={() => handleSharePostToFriend(f, sharePostModal)}
                    className="w-full p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 flex items-center justify-between gap-2 text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-slate-900 truncate">{f.name}</span>
                      <span className="text-xs">{f.countryFlag || '🇪🇬'}</span>
                    </div>
                    <span className="text-[11px] font-black text-indigo-600 shrink-0">إرسال ✉️</span>
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
    </div>
  );
});
