import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { StoryItem, User } from '../types/chat';
import {
  subscribeToActiveStories,
  createStory,
  markStoryViewed,
} from '../services/firebase';
import { compressImageFile } from '../utils/imageCompression';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { toast } from 'sonner';

interface StoriesBarProps {
  currentUser: User;
  onOpenUserProfile?: (user: User) => void;
}

const STORY_GRADIENTS = [
  'from-indigo-600 via-purple-600 to-fuchsia-600',
  'from-amber-500 via-orange-600 to-rose-600',
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-sky-500 via-blue-600 to-indigo-700',
  'from-rose-500 via-pink-600 to-purple-700',
  'from-slate-800 via-slate-900 to-indigo-950',
];

export const StoriesBar: React.FC<StoriesBarProps> = ({
  currentUser,
  onOpenUserProfile,
}) => {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);

  // Story creator modal
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorType, setCreatorType] = useState<'text' | 'image'>('text');
  const [caption, setCaption] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(STORY_GRADIENTS[0]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToActiveStories((list) => {
      setStories(list);
    });
    return () => unsub();
  }, []);

  const activeStory =
    activeIndex !== null && stories[activeIndex] ? stories[activeIndex] : null;

  // Mark story viewed when opened
  useEffect(() => {
    if (!activeStory) return;
    if (activeStory.userId !== currentUser.id) {
      markStoryViewed(activeStory.id, currentUser).catch(() => {});
    }
  }, [activeStory?.id, activeStory?.userId, currentUser]);

  // 6-second auto-advance timer
  useEffect(() => {
    if (activeIndex === null || !activeStory || isPaused || showViewersModal) return;
    setProgress(0);
    const start = Date.now();
    const duration = 6000;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
        setActiveIndex((prev) => {
          if (prev === null) return null;
          if (prev + 1 < stories.length) return prev + 1;
          return null;
        });
      }
    }, 60);
    return () => window.clearInterval(interval);
  }, [activeIndex, activeStory?.id, isPaused, showViewersModal, stories.length]);

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
    setIsSubmitting(true);
    try {
      await createStory(currentUser, {
        mediaType: creatorType,
        imageUrl: creatorType === 'image' ? imagePreview || undefined : undefined,
        caption: caption.trim() || 'لحظة جديدة على شات مصر ✨',
        bgGradient: selectedGradient,
      });
      toast.success('تم نشر قصتك بنجاح لمدة 24 ساعة ✨');
      setCaption('');
      setImagePreview(null);
      setIsCreatorOpen(false);
    } catch {
      toast.error('تعذر نشر القصة حالياً');
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewersList = activeStory?.viewers
    ? Object.values(activeStory.viewers).sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
    : [];

  return (
    <div dir="rtl" className="mb-2">
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 shadow-xs">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-black text-slate-900">قصص الأعضاء (24 ساعة)</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            {stories.length > 0 ? `${stories.length} قصة نشطة` : 'شارك يومك الآن'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {/* Add Story Trigger */}
          <button
            type="button"
            onClick={() => setIsCreatorOpen(true)}
            className="flex flex-col items-center gap-0.5 shrink-0 w-14 group cursor-pointer"
          >
            <div className="relative w-12 h-12 rounded-2xl p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-500 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-[13px] overflow-hidden bg-slate-100 relative">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover opacity-85"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base bg-indigo-50 text-indigo-700 font-black">
                    {currentUser.name.slice(0, 1)}
                  </div>
                )}
                <span className="absolute bottom-0.5 left-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center border border-white shadow">
                  <Plus className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black text-slate-700 truncate w-full text-center">
              قصتك
            </span>
          </button>

          {/* Active Stories */}
          {stories.map((story, idx) => {
            const hasViewed = Boolean(story.viewers && story.viewers[currentUser.id]);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => {
                  setShowViewersModal(false);
                  setActiveIndex(idx);
                }}
                className="flex flex-col items-center gap-0.5 shrink-0 w-14 group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-2xl p-[2px] transition-transform group-hover:scale-105 ${
                    hasViewed
                      ? 'bg-slate-300'
                      : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-sm'
                  }`}
                >
                  <div className="w-full h-full rounded-[13px] overflow-hidden bg-white p-[1.5px]">
                    {story.mediaType === 'image' && story.imageUrl ? (
                      <img
                        src={story.imageUrl}
                        alt={story.userName}
                        className="w-full h-full object-cover rounded-[11px]"
                      />
                    ) : story.userAvatar ? (
                      <img
                        src={story.userAvatar}
                        alt={story.userName}
                        className="w-full h-full object-cover rounded-[11px]"
                      />
                    ) : (
                      <div
                        className={`w-full h-full rounded-[11px] bg-gradient-to-br ${
                          story.bgGradient || STORY_GRADIENTS[0]
                        } text-white flex items-center justify-center text-sm font-black`}
                      >
                        {story.userName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center inline-flex items-center justify-center gap-0.5">
                  <span className="truncate">{story.userName}</span>
                  {(story.userVerified || story.userRole === 'owner') && (
                    <VerifiedBadge verified={story.userVerified} role={story.userRole} size="xs" />
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
            className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>إضافة قصة جديدة (تختفي خلال 24 ساعة)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatorOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setCreatorType('text')}
                className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                  creatorType === 'text'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                  creatorType === 'image'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black"
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
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} border-2 transition-transform ${
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'جاري النشر...' : 'نشر القصة الآن ✨'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Full-Screen Story Viewer */}
      {activeStory && activeIndex !== null && (
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
            {/* Top Progress + User Header */}
            <div className="p-3 pt-4 bg-gradient-to-b from-black/70 to-transparent z-20 space-y-2.5">
              <div className="flex items-center gap-1">
                {stories.map((st, idx) => (
                  <div
                    key={st.id}
                    className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                  >
                    <div
                      className="h-full bg-white transition-[width] duration-75"
                      style={{
                        width:
                          idx < activeIndex
                            ? '100%'
                            : idx === activeIndex
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
                      setActiveIndex(null);
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
                  className="flex items-center gap-2 text-right cursor-pointer"
                >
                  {activeStory.userAvatar ? (
                    <img
                      src={activeStory.userAvatar}
                      alt={activeStory.userName}
                      className="w-9 h-9 rounded-full object-cover border-2 border-white/70"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-black">
                      {activeStory.userName.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1 text-xs font-black text-white">
                      <span>{activeStory.userName}</span>
                      <VerifiedBadge
                        verified={activeStory.userVerified}
                        role={activeStory.userRole}
                        size="xs"
                      />
                    </div>
                    <span className="text-[10px] text-white/75 block">
                      {new Date(activeStory.createdAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Story Body */}
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

              {/* Tap Navigation Overlay */}
              <button
                type="button"
                aria-label="القصة السابقة"
                onClick={() =>
                  setActiveIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
                }
                className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-start pr-2 opacity-0 hover:opacity-100 transition"
              >
                <span className="p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </button>
              <button
                type="button"
                aria-label="القصة التالية"
                onClick={() =>
                  setActiveIndex((prev) =>
                    prev !== null && prev + 1 < stories.length ? prev + 1 : null
                  )
                }
                className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-end pl-2 opacity-0 hover:opacity-100 transition"
              >
                <span className="p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronLeft className="w-5 h-5" />
                </span>
              </button>
            </div>

            {/* Bottom Caption + Viewers Counter */}
            <div className="p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 space-y-2.5">
              {activeStory.mediaType === 'image' && activeStory.caption && (
                <p className="text-xs font-bold text-white/95 text-center">
                  {activeStory.caption}
                </p>
              )}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowViewersModal((p) => !p)}
                  className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-black flex items-center gap-1.5 backdrop-blur-md"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>شافها {viewersList.length}</span>
                </button>
              </div>
            </div>

            {/* Viewers List Sheet */}
            {showViewersModal && (
              <div
                className="absolute inset-x-0 bottom-0 z-30 bg-white text-slate-900 rounded-t-3xl p-4 max-h-[55%] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                  <h4 className="text-xs font-black flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>المشاهدون ({viewersList.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowViewersModal(false)}
                    className="p-1 rounded-full bg-slate-100 text-slate-600"
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
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {v.avatar ? (
                            <img
                              src={v.avatar}
                              alt={v.name}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">
                              {v.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="font-bold text-slate-900">{v.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(v.viewedAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
