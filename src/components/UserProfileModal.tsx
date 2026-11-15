import React, { useState, useRef } from 'react';
import { 
  X, 
  Crown, 
  MessageCircle, 
  Gift, 
  Heart, 
  Star,
  UserPlus,
  Check,
  Camera,
  Pencil,
  Award,
  Sparkles,
  Flag,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { User } from '../types/chat';
import { BADGES_CATALOG } from '../data/seedData';
import { sendFriendRequest, submitUserRating, submitUserReport } from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { sounds } from '../utils/soundEffects';
import { toast } from 'sonner';

interface UserProfileModalProps {
  user: User | null;
  currentUser: User;
  onClose: () => void;
  onOpenPrivateChatWith: (user: User) => void;
  onSendGiftToUser: (user: User) => void;
  onAvatarChanged?: (url: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  onClose,
  onOpenPrivateChatWith,
  onSendGiftToUser,
  onAvatarChanged,
}) => {
  if (!user) return null;

  const isMe = user.id === currentUser.id;
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [userRating, setUserRating] = useState(user.ratingPoints || 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report User State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('ألفاظ مسيئة أو سب وقذف');
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSentSuccess, setReportSentSuccess] = useState(false);

  const handleSendFriendReq = async () => {
    if (isMe || friendRequestSent) return;
    sounds.playMessageSent();
    await sendFriendRequest(currentUser, user.id);
    realtimeSocket.sendFriendRequest({
      id: `req_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      receiverId: user.id,
      createdAt: Date.now(),
      status: 'pending'
    });
    setFriendRequestSent(true);
    toast.success(`تم إرسال طلب صداقة إلى ${user.name} بنجاح 🤝`);
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

      sounds.playMessageReceived();
      setReportSentSuccess(true);
      setReportNotes('');
      toast.info('تم إرسال البلاغ للإدارة للمراجعة الفورية 🛡️');
      setTimeout(() => {
        setReportSentSuccess(false);
        setIsReportOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to submit report:', err);
      toast.error('تعذر إرسال البلاغ حالياً، حاول مرة أخرى.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleGiveRating = async () => {
    if (isMe || hasRated) return;
    sounds.playCoinsReward();
    const updated = await submitUserRating(currentUser.id, user.id, 10);
    setUserRating(updated);
    setHasRated(true);
    toast.success(`تم منح ${user.name} +10 نقاط تقييم ⭐`);
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

  // Badges list
  const userBadges = user.badges && user.badges.length > 0 ? user.badges : ['عضو نشط'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl relative text-slate-900">
        
        {/* Hidden Avatar Uploader */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange} 
        />

        {/* Cover Header */}
        <div className="h-24 bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#0f766e] relative">
          <button 
            onClick={onClose}
            className="absolute top-2.5 left-2.5 p-1.5 rounded-full bg-white/90 text-slate-700 hover:bg-white shadow active:scale-90 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 pt-0 -mt-12 text-center space-y-3">
          
          {/* Avatar with Live Indicator & Direct Edit for Owner */}
          <div className="relative inline-block">
            <div className={`w-22 h-22 rounded-full overflow-hidden border-4 bg-white shadow-xl mx-auto ${user.frameStyle || 'border-amber-400'}`}>
              <img 
                src={user.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(user.name || user.id)}`} 
                alt={user.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Live Indicator Dot */}
            <span 
              className={`absolute bottom-1 right-2 w-4 h-4 rounded-full border-2 border-white ${
                user.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              title={user.isOnline ? 'متصل الآن' : 'غير متصل'}
            />

            {/* If Current User, Show Quick Photo Change Button (Pencil Icon) */}
            {isMe && (
              <button
                onClick={() => fileInputRef.current?.click()}
                title="تغيير الصورة الشخصية وتحديثها فوراً"
                className="absolute top-0 right-0 p-1.5 rounded-full bg-gradient-to-tr from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg border-2 border-white active:scale-90 transition-transform flex items-center justify-center"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Name & Country */}
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-base font-black text-slate-900">{user.name}</h3>
              <span className="text-lg">{user.countryFlag || '🇪🇬'}</span>
            </div>

            {/* VIP Tier Badge */}
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                {user.vipBadge || 'عضو مميز'}
              </span>
              <span className="text-xs text-slate-500 font-normal">(@{user.username || 'user'})</span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-1">
              <span className={user.isOnline ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                {user.isOnline ? '● متصل الآن' : '○ غير متصل'}
              </span>
              <span>•</span>
              <span>{user.country || 'مصر'}</span>
            </div>
          </div>

          {/* Earned Badges Section */}
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-right space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1 text-slate-700">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>شارات الإنجاز المكتسبة</span>
              </span>
              <span className="text-[10px] text-indigo-600 font-black">{userBadges.length} شارات</span>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-end">
              {userBadges.map((badgeName, idx) => {
                const catalogItem = BADGES_CATALOG.find(b => b.name === badgeName);
                return (
                  <div 
                    key={idx}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs text-amber-700 shadow-sm"
                    title={catalogItem?.description || badgeName}
                  >
                    <span>{catalogItem?.icon || '🏅'}</span>
                    <span className="font-bold">{badgeName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Bio */}
          {user.bio && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              {user.bio}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-[10px] text-slate-500 block">نقاط التقييم ⭐</span>
              <span className="font-black text-amber-700">{userRating}</span>
            </div>
            <div className="p-2 rounded-xl bg-pink-50/70 border border-pink-200">
              <span className="text-[10px] text-slate-500 block">الهدايا 🎁</span>
              <span className="font-black text-pink-700">{user.giftsReceivedCount || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-[10px] text-slate-500 block">الإعجابات ❤️</span>
              <span className="font-black text-rose-700">{user.likesReceived || 0}</span>
            </div>
          </div>

          {/* Social Interactions */}
          {!isMe && (
            <div className="space-y-2 pt-1">
              
              {/* Primary Row: Friend Request & Direct Message */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSendFriendReq}
                  disabled={friendRequestSent}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all ${
                    friendRequestSent
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {friendRequestSent ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم إرسال الطلب ✓</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>طلب صداقة</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenPrivateChatWith(user);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>إرسال رسالة</span>
                </button>
              </div>

              {/* Secondary Row: Gift & Member Rating */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onSendGiftToUser(user);
                  }}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>إهداء هدية</span>
                </button>

                <button
                  onClick={handleGiveRating}
                  disabled={hasRated}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                    hasRated
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-700'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>{hasRated ? 'تم التقييم (+10)' : 'تقييم العضو'}</span>
                </button>
              </div>

              {/* Report User Button */}
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Flag className="w-3.5 h-3.5 text-rose-600" />
                <span>إبلاغ عن هذا المستخدم للإدارة ⚠️</span>
              </button>

            </div>
          )}

        </div>

        {/* Report User Modal Overlay */}
        {isReportOpen && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-30 p-4 flex flex-col justify-between text-right animate-in fade-in">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h4 className="font-black text-sm text-slate-900">إبلاغ عن مخالفة</h4>
                </div>
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
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
                    المستخدم المشتكى منه: <span className="font-bold text-amber-700">{user.name}</span>
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
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isSubmittingReport ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جارٍ إرسال البلاغ...</span>
                        </>
                      ) : (
                        <>
                          <Flag className="w-3.5 h-3.5" />
                          <span>إرسال البلاغ للإدارة فوراً 🛡️</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsReportOpen(false)}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
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
    </div>
  );
};
