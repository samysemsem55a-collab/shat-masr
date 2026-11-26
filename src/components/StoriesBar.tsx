import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  X,
  Eye,
  Image as ImageIcon,
  Type,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Heart,
  Share2,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { StoryItem, StoryComment, User } from '../types/chat';
import {
  subscribeToActiveStories,
  createStory,
  markStoryViewed,
  toggleStoryLike,
  subscribeToStoryComments,
  addStoryComment,
  deleteStory,
} from '../services/firebase';
import { compressImageFile } from '../utils/imageCompression';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { realtimeSocket } from '../services/realtimeSocket';
import { toast } from '../utils/appToast';

interface StoriesBarProps {
  currentUser: User;
  onOpenUserProfile?: (user: User) => void;
  unreadStoryNotifsCount?: number;
  onOpenNotifications?: () => void;
}

const STORY_GRADIENTS = [
  'from-indigo-600 via-purple-600 to-fuchsia-600',
  'from-amber-500 via-orange-600 to-rose-600',
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-sky-500 via-blue-600 to-indigo-700',
  'from-rose-500 via-pink-600 to-purple-700',
  'from-slate-800 via-slate-900 to-indigo-950',
];

function formatRelativeArabicTime(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return 'منذ دقيقة';
  if (diffMin === 2) return 'منذ دقيقتين';
  if (diffMin <= 10) return `منذ ${diffMin} دقائق`;
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return 'منذ ساعة';
  if (diffHr === 2) return 'منذ ساعتين';
  if (diffHr <= 10) return `منذ ${diffHr} ساعات`;
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  const diffDay = Math.floor(diffHr / 24);
  return diffDay === 1 ? 'منذ يوم' : `منذ ${diffDay} أيام`;
}

interface UserStoryGroup {
  userId: string;
  userName: string;
  userAvatar: string;
  userRole?: User['role'];
  userVerified?: boolean;
  latestCreatedAt: number;
  stories: StoryItem[];
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  currentUser,
  onOpenUserProfile,
  unreadStoryNotifsCount = 0,
  onOpenNotifications,
}) => {
  const [stories, setStories] = useState<StoryItem[]>([]);
  // Isolated single-user story viewer state (NEVER advances across different users)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [storyComments, setStoryComments] = useState<StoryComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isCommentInputFocused, setIsCommentInputFocused] = useState(false);
  const [confirmDeleteStoryId, setConfirmDeleteStoryId] = useState<string | null>(null);

  // Story creator modal
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorType, setCreatorType] = useState<'text' | 'image'>('text');
  const [caption, setCaption] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(STORY_GRADIENTS[0]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socketState, setSocketState] = useState<'connected' | 'reconnecting' | 'disconnected'>(() =>
    realtimeSocket.getConnectionState()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubConn = realtimeSocket.subscribeToConnectionState(setSocketState);
    const unsubStories = subscribeToActiveStories((list) => {
      setStories(list);
    });
    return () => {
      unsubConn();
      unsubStories();
    };
  }, [currentUser.id]);

  // Group stories strictly by userId so each person gets their own separate circle
  const storyGroups = useMemo<UserStoryGroup[]>(() => {
    const map = new Map<string, UserStoryGroup>();
    for (const story of stories) {
      if (!story?.userId) continue;
      const existing = map.get(story.userId);
      if (!existing) {
        map.set(story.userId, {
          userId: story.userId,
          userName: story.userName,
          userAvatar: story.userAvatar,
          userRole: story.userRole,
          userVerified: story.userVerified,
          latestCreatedAt: story.createdAt || 0,
          stories: [story],
        });
      } else {
        existing.stories.push(story);
        if ((story.createdAt || 0) > existing.latestCreatedAt) {
          existing.latestCreatedAt = story.createdAt || 0;
          existing.userName = story.userName;
          existing.userAvatar = story.userAvatar;
        }
      }
    }

    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      // Chronological within the SAME user's story sequence (part 1 -> part 2)
      stories: [...g.stories].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    }));

    return groups.sort((a, b) => {
      if (a.userId === currentUser.id && b.userId !== currentUser.id) return -1;
      if (b.userId === currentUser.id && a.userId !== currentUser.id) return 1;
      return b.latestCreatedAt - a.latestCreatedAt;
    });
  }, [stories, currentUser.id]);

  // Stories belonging strictly to the currently opened user ONLY
  const selectedUserStories = useMemo<StoryItem[]>(() => {
    if (!selectedUserId) return [];
    return storyGroups.find((g) => g.userId === selectedUserId)?.stories || [];
  }, [storyGroups, selectedUserId]);

  const activeStory =
    selectedUserId && selectedUserStories[activeItemIndex]
      ? selectedUserStories[activeItemIndex]
      : null;

  // Close viewer automatically if the selected user has no remaining stories (e.g. after deletion)
  useEffect(() => {
    if (!selectedUserId) return;
    if (selectedUserStories.length === 0) {
      setSelectedUserId(null);
      setActiveItemIndex(0);
      setShowViewersModal(false);
    } else if (activeItemIndex >= selectedUserStories.length) {
      setActiveItemIndex(selectedUserStories.length - 1);
    }
  }, [selectedUserId, selectedUserStories.length, activeItemIndex]);

  // Mark individual story viewed once per unique viewer
  useEffect(() => {
    if (!activeStory) return;
    if (activeStory.userId !== currentUser.id) {
      markStoryViewed(activeStory.id, currentUser).catch(() => {});
    }
  }, [activeStory?.id, activeStory?.userId, currentUser]);

  // Subscribe to real-time comments for the currently open story
  useEffect(() => {
    if (!activeStory?.id) {
      setStoryComments([]);
      return;
    }
    setStoryComments([]);
    return subscribeToStoryComments(activeStory.id, setStoryComments);
  }, [activeStory?.id]);

  // 6-second auto-advance timer STRICTLY inside the same user's stories; closes when done
  useEffect(() => {
    if (
      !selectedUserId ||
      !activeStory ||
      isPaused ||
      showViewersModal ||
      showCommentsSheet ||
      isCommentInputFocused ||
      confirmDeleteStoryId
    ) {
      return;
    }
    setProgress(0);
    const start = Date.now();
    const duration = 6000;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
        setActiveItemIndex((prev) => {
          if (prev + 1 < selectedUserStories.length) {
            return prev + 1;
          }
          // End of this user's stories: close viewer & return to Home (never spill into another user)
          setSelectedUserId(null);
          setShowViewersModal(false);
          setShowCommentsSheet(false);
          return 0;
        });
      }
    }, 60);
    return () => window.clearInterval(interval);
  }, [
    selectedUserId,
    activeStory?.id,
    isPaused,
    showViewersModal,
    showCommentsSheet,
    isCommentInputFocused,
    confirmDeleteStoryId,
    selectedUserStories.length,
  ]);

  const closeViewer = () => {
    setSelectedUserId(null);
    setActiveItemIndex(0);
    setShowViewersModal(false);
    setShowCommentsSheet(false);
    setCommentText('');
    setConfirmDeleteStoryId(null);
  };

  const goToNextStoryOfSameUser = () => {
    if (activeItemIndex + 1 < selectedUserStories.length) {
      setActiveItemIndex((prev) => prev + 1);
      setShowViewersModal(false);
      setShowCommentsSheet(false);
    } else {
      closeViewer();
    }
  };

  const goToPrevStoryOfSameUser = () => {
    if (activeItemIndex > 0) {
      setActiveItemIndex((prev) => prev - 1);
      setShowViewersModal(false);
      setShowCommentsSheet(false);
    } else {
      setProgress(0);
    }
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, { maxWidth: 800, maxBytes: 195 * 1024 });
      setImagePreview(compressed);
      setCreatorType('image');
    } catch {
      toast.error('تعذر معالجة الصورة المختارة');
    } finally {
      e.target.value = '';
    }
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatorType === 'text' && !caption.trim()) {
      toast.error('اكتب نص القصة أولاً');
      return;
    }
    if (creatorType === 'image' && !imagePreview) {
      toast.error('اختر صورة للقصة أولاً');
      return;
    }
    const finalCaption = caption.trim() || 'لحظة جديدة على شات مصر ✨';
    const finalImage = creatorType === 'image' ? imagePreview || undefined : undefined;
    const optimisticId = `opt_story_${Date.now()}`;
    const now = Date.now();

    const optimisticStory: StoryItem = {
      id: optimisticId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRole: currentUser.role,
      userVerified: currentUser.verified,
      mediaType: creatorType,
      imageUrl: finalImage,
      caption: finalCaption,
      bgGradient: selectedGradient,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      viewsCount: 0,
      likesCount: 0,
      likedBy: [],
      viewers: {},
    };

    // Immediate Optimistic UI update while syncing in background
    setStories((prev) => [optimisticStory, ...prev]);
    setCaption('');
    setImagePreview(null);
    setIsCreatorOpen(false);
    toast.success('تم نشر قصتك بنجاح لمدة 24 ساعة ✨');

    setIsSubmitting(true);
    try {
      const saved = await createStory(currentUser, {
        mediaType: creatorType,
        imageUrl: finalImage,
        caption: finalCaption,
        bgGradient: selectedGradient,
      });
      setStories((prev) =>
        prev.map((s) => (s.id === optimisticId ? saved : s))
      );
    } catch {
      setStories((prev) => prev.filter((s) => s.id !== optimisticId));
      toast.error('تعذر نشر القصة حالياً');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeActiveStory = async () => {
    if (!activeStory) return;
    const targetId = activeStory.id;
    const targetOwnerId = activeStory.userId || (activeStory as any).ownerId || '';
    const wasLiked = Boolean(activeStory.likedBy?.includes(currentUser.id));
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        const likedSet = new Set(s.likedBy || []);
        if (likedSet.has(currentUser.id)) {
          likedSet.delete(currentUser.id);
        } else {
          likedSet.add(currentUser.id);
        }
        const likedBy = Array.from(likedSet);
        return { ...s, likedBy, likesCount: likedBy.length };
      })
    );
    try {
      await toggleStoryLike(targetId, currentUser, targetOwnerId, wasLiked);
    } catch {}
  };

  const handleSendStoryComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStory || !commentText.trim() || isSendingComment) return;
    const trimmed = commentText.trim();
    const targetOwnerId = activeStory.userId || (activeStory as any).ownerId || '';
    setIsSendingComment(true);
    try {
      const saved = await addStoryComment(activeStory.id, currentUser, trimmed, targetOwnerId);
      setCommentText('');
      if (saved) {
        setStoryComments((prev) => (prev.some((c) => c.id === saved.id) ? prev : [...prev, saved]));
        setStories((prev) =>
          prev.map((s) =>
            s.id === activeStory.id
              ? { ...s, commentsCount: Math.max((s.commentsCount || 0) + 1, storyComments.length + 1) }
              : s
          )
        );
      }
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleShareActiveStory = async () => {
    if (!activeStory) return;
    const shareText = `قصة ${activeStory.userName} على شات مصر: ${activeStory.caption || 'شاهد القصة الآن ✨'}`;
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `قصة ${activeStory.userName} - شات مصر`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('تم نسخ القصة للمشاركة 🔗');
    } catch {
      toast.success('جاهز لمشاركة القصة 🔗');
    }
  };

  const handleConfirmDeleteStory = async (storyId: string) => {
    await deleteStory(storyId);
    setConfirmDeleteStoryId(null);
    toast.success('تم حذف القصة وسجل المشاهدات 🗑️');
  };

  const isStoryOwner = Boolean(activeStory && activeStory.userId === currentUser.id);
  const viewersList = activeStory?.viewers
    ? Object.values(activeStory.viewers).sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
    : [];
  const realViewsCount = activeStory
    ? Math.max(activeStory.viewsCount || 0, viewersList.length)
    : 0;
  const isStoryLikedByMe = Boolean(activeStory?.likedBy?.includes(currentUser.id));
  const realLikesCount = activeStory
    ? Math.max(activeStory.likesCount || 0, activeStory.likedBy?.length || 0)
    : 0;
  const realCommentsCount = activeStory
    ? Math.max(activeStory.commentsCount || 0, storyComments.length)
    : 0;

  return (
    <div dir="rtl" className="mb-1">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-xs">
        <div className="flex items-center justify-between mb-1 px-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10.5px] sm:text-[11.5px] font-black text-slate-900 dark:text-white truncate">قصص الأعضاء (24 ساعة)</span>
            {unreadStoryNotifsCount > 0 && (
              <button
                type="button"
                onClick={() => onOpenNotifications?.()}
                className="px-1.5 py-0.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[9.5px] font-black flex items-center gap-0.5 shadow-2xs tabular-nums cursor-pointer transition shrink-0"
                title="عرض إشعارات القصص غير المقروءة"
              >
                <span>🔔</span>
                <span>{unreadStoryNotifsCount > 99 ? '99+' : unreadStoryNotifsCount}</span>
              </button>
            )}
            {typeof navigator !== 'undefined' && navigator.onLine === false && socketState !== 'connected' && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[9.5px] font-bold shrink-0 animate-pulse">
                جاري التحديث...
              </span>
            )}
          </div>
          <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
            {storyGroups.length > 0 ? `${storyGroups.length} عضو نشط` : 'شارك يومك الآن'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {/* Add Story Circular Button */}
          <button
            type="button"
            onClick={() => setIsCreatorOpen(true)}
            className="flex flex-col items-center gap-0.5 shrink-0 w-11 sm:w-12 group cursor-pointer"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-500 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative border-2 border-white dark:border-slate-900">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">
                    {currentUser.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                <Plus className="w-2.5 h-2.5" />
              </span>
            </div>
            <span className="text-[9.5px] font-black text-slate-700 dark:text-slate-200 truncate w-full text-center">
              قصتك
            </span>
          </button>

          {/* Individual Separated Circular User Story Circles */}
          {storyGroups.map((group) => {
            const allViewed = group.stories.every(
              (s) => s.userId === currentUser.id || Boolean(s.viewers && s.viewers[currentUser.id])
            );
            const coverStory = group.stories[group.stories.length - 1];
            const circlePhoto =
              group.userAvatar ||
              (coverStory?.mediaType === 'image' ? coverStory.imageUrl : '') ||
              '';

            return (
              <button
                key={group.userId}
                type="button"
                onClick={() => {
                  setShowViewersModal(false);
                  setConfirmDeleteStoryId(null);
                  setSelectedUserId(group.userId);
                  setActiveItemIndex(0);
                }}
                className="flex flex-col items-center gap-0.5 shrink-0 w-11 sm:w-12 group cursor-pointer"
              >
                <div
                  className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                    allViewed
                      ? 'bg-slate-300 dark:bg-slate-600'
                      : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-sm'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 p-[1.5px]">
                    {circlePhoto ? (
                      <img
                        src={circlePhoto}
                        alt={group.userName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div
                        className={`w-full h-full rounded-full bg-gradient-to-br ${
                          coverStory?.bgGradient || STORY_GRADIENTS[0]
                        } text-white flex items-center justify-center text-sm font-black`}
                      >
                        {group.userName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  {group.stories.length > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 shadow-xs">
                      {group.stories.length}
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 truncate w-full text-center inline-flex items-center justify-center gap-0.5">
                  <span className="truncate">{group.userName}</span>
                  {(group.userVerified || group.userRole === 'owner') && (
                    <VerifiedBadge verified={group.userVerified} role={group.userRole} size="xs" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickImage}
      />

      {/* Story Creator Modal */}
      {isCreatorOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setIsCreatorOpen(false)}
        >
          <form
            onSubmit={handlePublishStory}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>إضافة قصة جديدة (تختفي خلال 24 ساعة)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatorOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setCreatorType('text')}
                className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  creatorType === 'text'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>قصة نصية ملونة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatorType('image');
                  if (!imagePreview) fileInputRef.current?.click();
                }}
                className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  creatorType === 'image'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>صورة من الاستوديو</span>
              </button>
            </div>

            {/* Preview Box */}
            {creatorType === 'image' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center space-y-2">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Story preview"
                    className="max-h-52 mx-auto rounded-xl object-contain"
                  />
                ) : (
                  <div className="py-8 text-xs text-slate-500">لم يتم اختيار صورة بعد</div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black cursor-pointer"
                >
                  {imagePreview ? 'تغيير الصورة' : 'اختيار صورة من الجهاز'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  data-preserve-light="true"
                  className={`h-36 rounded-2xl bg-gradient-to-br ${selectedGradient} text-white flex items-center justify-center p-4 text-center shadow-inner`}
                >
                  <p className="text-sm font-black leading-relaxed break-words max-w-full">
                    {caption.trim() || 'اكتب كلمتك الجميلة هنا لتظهر لجميع أصدقائك...'}
                  </p>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  {STORY_GRADIENTS.map((grad) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => setSelectedGradient(grad)}
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} border-2 transition-transform cursor-pointer ${
                        selectedGradient === grad
                          ? 'border-indigo-600 scale-115 shadow'
                          : 'border-white'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <textarea
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={180}
              placeholder={creatorType === 'image' ? 'تعليق اختياري على الصورة...' : 'اكتب نص القصة هنا...'}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'جاري النشر...' : 'نشر القصة الآن ✨'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Full-Screen Single-User Isolated Story Viewer */}
      {activeStory && selectedUserId && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div
            data-preserve-light="true"
            className={`relative w-full h-full sm:h-[85vh] sm:max-w-md sm:rounded-3xl overflow-hidden flex flex-col justify-between bg-gradient-to-br ${
              activeStory.mediaType === 'text'
                ? activeStory.bgGradient || STORY_GRADIENTS[0]
                : 'from-slate-900 to-black'
            } text-white shadow-2xl`}
          >
            {/* Top Progress Bars (Strictly ONE bar per story of THIS user ONLY) + User Header */}
            <div className="p-3 pt-4 bg-gradient-to-b from-black/75 to-transparent z-20 space-y-2.5">
              <div className="flex items-center gap-1">
                {selectedUserStories.map((st, idx) => (
                  <div
                    key={st.id}
                    className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                  >
                    <div
                      className="h-full bg-white transition-[width] duration-75"
                      style={{
                        width:
                          idx < activeItemIndex
                            ? '100%'
                            : idx === activeItemIndex
                            ? `${progress}%`
                            : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenUserProfile) {
                      closeViewer();
                      onOpenUserProfile({
                        id: activeStory.userId,
                        name: activeStory.userName,
                        username: activeStory.userName,
                        avatar: activeStory.userAvatar,
                        bio: '',
                        country: 'مصر',
                        countryFlag: '🇪🇬',
                        role: activeStory.userRole || 'member',
                        coins: 0,
                        earningsEgp: 0,
                        earningsUsd: 0,
                        vipBadge: '',
                        frameStyle: 'default',
                        profileWallpaper: 'default',
                        fontPreference: 'cairo',
                        isOnline: true,
                        status: 'online',
                        joinedAt: '',
                        gender: 'male',
                        level: 1,
                        likesReceived: 0,
                        giftsReceivedCount: 0,
                        verified: activeStory.userVerified,
                      });
                    }
                  }}
                  className="flex items-center gap-2 text-right cursor-pointer min-w-0"
                >
                  {activeStory.userAvatar ? (
                    <img
                      src={activeStory.userAvatar}
                      alt={activeStory.userName}
                      className="w-9 h-9 rounded-full object-cover border-2 border-white/75 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-black shrink-0">
                      {activeStory.userName.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-black text-white">
                      <span className="truncate">{activeStory.userName}</span>
                      <VerifiedBadge
                        verified={activeStory.userVerified}
                        role={activeStory.userRole}
                        size="xs"
                      />
                    </div>
                    <span className="text-[10px] text-white/75 block">
                      {formatRelativeArabicTime(activeStory.createdAt)}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isStoryOwner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteStoryId(activeStory.id);
                      }}
                      title="حذف القصة"
                      aria-label="حذف القصة"
                      className="p-2 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeViewer}
                    aria-label="إغلاق القصة"
                    className="p-2 rounded-full bg-black/45 hover:bg-black/65 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Delete Confirmation (Story Owner) */}
            {confirmDeleteStoryId === activeStory.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mx-4 z-30 p-3 rounded-2xl bg-slate-900/95 border border-rose-400/50 text-white flex items-center justify-between gap-2 text-xs shadow-xl"
              >
                <span className="font-bold">حذف هذه القصة وسجل مشاهداتها نهائياً؟</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleConfirmDeleteStory(activeStory.id)}
                    className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                  >
                    حذف
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteStoryId(null)}
                    className="px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* Story Body + Tap Left/Right Navigation strictly within SAME user's stories */}
            <div className="relative flex-1 flex items-center justify-center px-5 text-center overflow-hidden">
              {activeStory.mediaType === 'image' && activeStory.imageUrl ? (
                <img
                  src={activeStory.imageUrl}
                  alt={activeStory.caption}
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              ) : (
                <p className="text-lg sm:text-xl font-black leading-relaxed drop-shadow">
                  {activeStory.caption}
                </p>
              )}

              {/* Tap Right = Previous Story of SAME user */}
              <button
                type="button"
                aria-label="القصة السابقة"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevStoryOfSameUser();
                }}
                className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-start pr-2 opacity-0 hover:opacity-100 transition cursor-pointer"
              >
                <span className="p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </button>

              {/* Tap Left = Next Story of SAME user (closes at end) */}
              <button
                type="button"
                aria-label="القصة التالية"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextStoryOfSameUser();
                }}
                className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-end pl-2 opacity-0 hover:opacity-100 transition cursor-pointer"
              >
                <span className="p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronLeft className="w-5 h-5" />
                </span>
              </button>
            </div>

            {/* Bottom Caption + Working Action Buttons (Like, Share, View Counter) */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-20 space-y-2.5"
            >
              {activeStory.mediaType === 'image' && activeStory.caption && (
                <p className="text-xs font-bold text-white/95 text-center">
                  {activeStory.caption}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                {/* Left/Start Group: Real View Counter (Clickable ONLY for Story Owner) */}
                {isStoryOwner ? (
                  <button
                    type="button"
                    onClick={() => setShowViewersModal((p) => !p)}
                    className="px-3.5 py-2 rounded-full bg-white/18 hover:bg-white/28 border border-white/30 text-white text-xs font-black flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition"
                    title="عرض قائمة المشاهدين"
                  >
                    <Eye className="w-4 h-4" />
                    <span>شافها {realViewsCount}</span>
                  </button>
                ) : (
                  <div className="px-3.5 py-2 rounded-full bg-white/12 border border-white/20 text-white/90 text-xs font-black flex items-center gap-1.5 backdrop-blur-md">
                    <Eye className="w-4 h-4" />
                    <span className="tabular-nums">{realViewsCount}</span>
                  </div>
                )}

                {/* Right/End Group: Working Like (Heart), Comment & Share Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleLikeActiveStory}
                    className={`px-3 py-2 rounded-full border text-xs font-black flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition active:scale-95 ${
                      isStoryLikedByMe
                        ? 'bg-rose-500/90 border-rose-300 text-white shadow'
                        : 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
                    }`}
                    title={isStoryLikedByMe ? 'إلغاء الإعجاب' : 'أعجبني'}
                  >
                    <Heart className={`w-4 h-4 ${isStoryLikedByMe ? 'fill-white text-white' : ''}`} />
                    <span className="tabular-nums">{realLikesCount > 0 ? realLikesCount : 'إعجاب'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowViewersModal(false);
                      setShowCommentsSheet((p) => !p);
                    }}
                    className={`px-3 py-2 rounded-full border text-xs font-black flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition active:scale-95 ${
                      showCommentsSheet
                        ? 'bg-indigo-600/90 border-indigo-300 text-white shadow'
                        : 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
                    }`}
                    title="التعليقات على القصة"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="tabular-nums">{realCommentsCount > 0 ? realCommentsCount : 'تعليق'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareActiveStory}
                    className="px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-black flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition active:scale-95"
                    title="مشاركة القصة"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">مشاركة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Story Comments Sheet */}
            {showCommentsSheet && (
              <div
                className="absolute inset-x-0 bottom-0 z-30 bg-white text-slate-900 rounded-t-3xl p-4 max-h-[65%] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5 shrink-0">
                  <h4 className="text-xs font-black flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-indigo-600" />
                    <span>التعليقات ({realCommentsCount})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowCommentsSheet(false)}
                    className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                    aria-label="إغلاق التعليقات"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                  {storyComments.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6">
                      لا توجد تعليقات حتى الآن. كن أول من يعلّق!
                    </p>
                  ) : (
                    storyComments.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenUserProfile) {
                              closeViewer();
                              onOpenUserProfile({
                                id: c.authorId,
                                name: c.authorName,
                                username: c.authorName,
                                avatar: c.authorAvatar || '',
                                bio: '',
                                country: 'مصر',
                                countryFlag: '🇪🇬',
                                role: 'member',
                                coins: 0,
                                earningsEgp: 0,
                                earningsUsd: 0,
                                vipBadge: '',
                                frameStyle: 'default',
                                profileWallpaper: 'default',
                                fontPreference: 'cairo',
                                isOnline: true,
                                status: 'online',
                                joinedAt: '',
                                gender: 'male',
                                level: 1,
                                likesReceived: 0,
                                giftsReceivedCount: 0,
                                verified: c.authorVerified,
                              });
                            }
                          }}
                          className="shrink-0 cursor-pointer"
                        >
                          {c.authorAvatar ? (
                            <img
                              src={c.authorAvatar}
                              alt={c.authorName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">
                              {c.authorName.slice(0, 1)}
                            </span>
                          )}
                        </button>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-slate-900 truncate inline-flex items-center gap-1">
                              <span>{c.authorName}</span>
                              {c.authorVerified && <VerifiedBadge verified size="xs" />}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelativeArabicTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed mt-0.5 break-words">{c.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendStoryComment} className="flex items-center gap-2 shrink-0 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onFocus={() => setIsCommentInputFocused(true)}
                    onBlur={() => setIsCommentInputFocused(false)}
                    maxLength={200}
                    placeholder="اكتب تعليقاً جميلاً..."
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || isSendingComment}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1 cursor-pointer transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال</span>
                  </button>
                </form>
              </div>
            )}

            {/* Owner-Only Viewers List Sheet */}
            {showViewersModal && isStoryOwner && (
              <div
                className="absolute inset-x-0 bottom-0 z-30 bg-white text-slate-900 rounded-t-3xl p-4 max-h-[58%] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                  <h4 className="text-xs font-black flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>المشاهدون ({realViewsCount})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowViewersModal(false)}
                    className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {viewersList.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6">
                      لا توجد مشاهدات مسجلة حتى الآن
                    </p>
                  ) : (
                    viewersList.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (onOpenUserProfile) {
                            closeViewer();
                            onOpenUserProfile({
                              id: v.userId || v.id,
                              name: v.name,
                              username: v.name,
                              avatar: v.avatar || '',
                              bio: '',
                              country: 'مصر',
                              countryFlag: '🇪🇬',
                              role: 'member',
                              coins: 0,
                              earningsEgp: 0,
                              earningsUsd: 0,
                              vipBadge: '',
                              frameStyle: 'default',
                              profileWallpaper: 'default',
                              fontPreference: 'cairo',
                              isOnline: true,
                              status: 'online',
                              joinedAt: '',
                              gender: 'male',
                              level: 1,
                              likesReceived: 0,
                              giftsReceivedCount: 0,
                            });
                          }
                        }}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-xs cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {v.avatar ? (
                            <img
                              src={v.avatar}
                              alt={v.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0">
                              {v.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="font-bold text-slate-900 truncate">{v.name}</span>
                        </div>
                        <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">
                          {formatRelativeArabicTime(v.viewedAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
