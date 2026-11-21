import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Share2, 
  Users, 
  Crown, 
  Radio,
  MessageCircle,
  UserPlus,
  ShieldCheck,
  LogOut,
  MoreVertical,
  ShoppingBag,
  Trophy,
  Moon,
  Sun,
  LifeBuoy
} from 'lucide-react';
import { User, UnreadSenderSummary } from '../types/chat';
import { isUserAdminOrOwner } from '../data/seedData';
import { getRankDisplayMeta, hasPrivilegedRank } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import { PWAInstallButton } from './PWAInstallButton';
import { toast } from '../utils/appToast';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { realtimeSocket } from '../services/realtimeSocket';
import appBrandIcon from '../assets/images/shat_masr_official_icon.png';

interface HeaderProps {
  currentUser: User;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenOnlineUsers: () => void;
  onOpenFriendRequests: () => void;
  onOpenLeaderboard?: () => void;
  onOpenAdmin?: () => void;
  pendingFriendRequestsCount: number;
  onlineUsersCount: number;
  onOpenRadio: () => void;
  isRadioPlaying: boolean;
  onAvatarChanged?: (newAvatarUrl: string) => void;
  onLogout?: () => void;
  unreadMessagesBySender?: UnreadSenderSummary[];
  totalUnreadMessagesCount?: number;
  onOpenSenderChat?: (sender: { senderId: string; senderName: string; senderAvatar: string }) => void;
  onClearAllUnreadMessages?: () => void;
  onOpenMessagesTab?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenSupport?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  currentUser,
  onOpenWallet,
  onOpenVip,
  onOpenProfile,
  onOpenNotifications,
  onOpenOnlineUsers,
  onOpenFriendRequests,
  onOpenLeaderboard,
  pendingFriendRequestsCount,
  onlineUsersCount,
  onOpenRadio,
  isRadioPlaying,
  onOpenAdmin,
  onLogout,
  unreadMessagesBySender = [],
  totalUnreadMessagesCount = 0,
  onOpenSenderChat,
  onClearAllUnreadMessages,
  onOpenMessagesTab,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenSupport
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [socketState, setSocketState] = useState<'connected' | 'reconnecting' | 'disconnected'>(() =>
    realtimeSocket.getConnectionState()
  );

  // Unified browser network status + live WebSocket connection state
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubSocket = realtimeSocket.subscribeToConnectionState((state) => {
      setSocketState(state);
    });
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSocket();
    };
  }, []);

  const isEffectiveOnline = isBrowserOnline && currentUser.status !== 'offline';
  const isOwner = isUserAdminOrOwner(currentUser);
  const rankMeta = getRankDisplayMeta(currentUser.role, currentUser.vipBadge);
  const isPrivileged = hasPrivilegedRank(currentUser.role);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (isMoreMenuOpen && moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMoreMenuOpen]);

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'شات مصر',
          text: 'انضم الآن إلى شات مصر - أرقى وأجمل شات عربي ومصري مجاني بدون تسجيل!',
          url: window.location.href,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط شات مصر بنجاح 🔗', {
        description: 'شاركه الآن مع أصدقائك للانضمام إليك'
      });
    } catch {}
  };

  return (
    <header dir="rtl" className="relative shrink-0 z-[50] bg-[#EAF5FD]/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-sky-200/80 dark:border-slate-800 px-2 sm:px-5 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-2">

        {/* Primary Header Row: Profile + Desktop Brand/Pills + Symmetrical Icon Toolbar */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-0 w-full flex-1">
          
          {/* Right Side (in RTL): Integrated Profile Card + Brand + Desktop Economy Pills */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 md:flex-initial">
            
            {/* Integrated User Profile Card */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1 pl-2 sm:pl-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition min-w-0 max-w-[148px] sm:max-w-[235px] md:max-w-none shrink">
              {/* Avatar Wrapper with Status Dot (Camera upload lives exclusively in ProfileView) */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  user={currentUser}
                  size="sm"
                  showOnlineDot
                  onClick={onOpenProfile}
                  title={`عرض الملف الشخصي: ${currentUser.name}`}
                />
              </div>

              {/* Username right beside avatar, and unified live availability status underneath */}
              <button
                type="button"
                onClick={onOpenProfile}
                title={`عرض الملف الشخصي: ${currentUser.name} (${isEffectiveOnline ? 'متاح' : 'غير متصل'})`}
                className="flex flex-col justify-center leading-tight min-w-0 flex-1 text-right cursor-pointer"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className={`text-xs truncate hover:text-indigo-600 transition ${rankMeta.nameColorClass}`}>
                    {currentUser.name}
                  </span>
                  <VerifiedBadge verified={currentUser.verified} role={currentUser.role} size="xs" />
                  {isPrivileged && (
                    <span className={`text-[8.5px] px-1 py-0.5 leading-none rounded border font-black shrink-0 ${rankMeta.badgeClass}`}>
                      {rankMeta.shortIcon}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9.5px] font-bold mt-0.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    !isEffectiveOnline
                      ? 'bg-rose-500'
                      : !isBrowserOnline && socketState === 'reconnecting'
                      ? 'bg-amber-500 animate-pulse'
                      : currentUser.status === 'busy'
                      ? 'bg-amber-500'
                      : currentUser.status === 'dnd'
                      ? 'bg-rose-500'
                      : currentUser.status === 'in_mic'
                      ? 'bg-purple-500 animate-pulse'
                      : 'bg-emerald-500 animate-pulse'
                  }`} />
                  <span className={`truncate ${
                    !isEffectiveOnline
                      ? 'text-rose-600'
                      : !isBrowserOnline && socketState === 'reconnecting'
                      ? 'text-amber-600'
                      : currentUser.status === 'busy'
                      ? 'text-amber-600'
                      : currentUser.status === 'dnd'
                      ? 'text-rose-600'
                      : currentUser.status === 'in_mic'
                      ? 'text-purple-600'
                      : 'text-emerald-600'
                  }`}>
                    {!isEffectiveOnline
                      ? 'غير متصل'
                      : !isBrowserOnline && socketState === 'reconnecting'
                      ? 'جاري إعادة الاتصال...'
                      : currentUser.status === 'busy'
                      ? 'مشغول'
                      : currentUser.status === 'dnd'
                      ? 'لا تزعجني'
                      : currentUser.status === 'in_mic'
                      ? 'في مجلس صوتي'
                      : currentUser.status === 'away'
                      ? 'بالخارج'
                      : 'متصل الآن'}
                  </span>
                </div>
              </button>
            </div>

            {/* Brand Logo & Name (Desktop lg+) */}
            <div className="hidden lg:flex items-center gap-2 shrink-0 bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 h-9">
              <img
                src={appBrandIcon}
                alt="شات مصر"
                className="w-7 h-7 object-contain shrink-0"
              />
              <span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                شات مصر
              </span>
            </div>

            {/* Desktop Economy & Rank Strip (md+) */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  title="قائمة الكبار - التوب 10"
                  className="h-9 px-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border border-amber-200 text-amber-800 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Trophy strokeWidth={2} className="w-3.5 h-3.5 text-amber-600 shrink-0 opacity-100 saturate-110 brightness-105" />
                  <span className="text-xs font-black">الكبار</span>
                </button>
              )}

              {!isOwner && (
                <button 
                  type="button"
                  onClick={onOpenVip}
                  title="ترقية الرتبة VIP"
                  className="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Crown strokeWidth={2} className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0 opacity-100 saturate-110 brightness-105" />
                  <span className="text-xs font-black">VIP</span>
                </button>
              )}

              {isOwner && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  title="لوحة تحكم المدير والإشراف العام"
                  className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck strokeWidth={2} className="w-3.5 h-3.5 text-rose-600 shrink-0 opacity-100 saturate-110 brightness-105" />
                  <span className="text-[11px] font-black">الإدارة</span>
                </button>
              )}

              {!isOwner && (
                <button 
                  type="button"
                  onClick={onOpenWallet}
                  title="المحفظة وشحن الكوينز"
                  className="h-9 px-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-black flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap tabular-nums cursor-pointer"
                >
                  <span>🪙</span>
                  <span>{currentUser.coins.toLocaleString()}</span>
                </button>
              )}

              <PWAInstallButton />
            </div>

          </div>

          {/* Left Side (in RTL): Symmetrical Action Icons Toolbar + Store + Far-Left Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

            {/* Incoming Messages & Friends Side Drawer Trigger + Lightweight Unread Badge */}
            {(() => {
              const combinedPrivateBadge = totalUnreadMessagesCount + pendingFriendRequestsCount;
              return (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenMessagesTab?.();
                  }}
                  title="الرسائل الخاصة والأصدقاء"
                  aria-label="الرسائل الخاصة والأصدقاء"
                  className={`relative h-9 px-2 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1 transition-all shrink-0 active:scale-95 cursor-pointer ${
                    combinedPrivateBadge > 0
                      ? 'bg-[#D6ECFC] hover:bg-[#C3E3FA] border-[#1E96E8]/55 text-[#0F5AA8] shadow-xs'
                      : 'bg-[#E1F1FD] hover:bg-[#D0E9FC] border-sky-300/90 text-[#1565C0] shadow-xs'
                  }`}
                >
                  <MessageCircle strokeWidth={2.2} className="w-4 h-4 opacity-100 saturate-110 brightness-105 shrink-0" />
                  <span className="hidden sm:inline text-xs font-black">الخاص</span>
                  {combinedPrivateBadge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#1E96E8] text-white text-[9px] font-black flex items-center justify-center shadow border border-white tabular-nums">
                      {combinedPrivateBadge > 99 ? '99+' : combinedPrivateBadge}
                    </span>
                  )}
                </button>
              );
            })()}
            
            {/* Friend Requests Button */}
            <button 
              type="button"
              onClick={onOpenFriendRequests}
              title="طلبات الصداقة"
              className="relative w-8 h-9 sm:w-9 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
            >
              <UserPlus strokeWidth={2} className="w-4 h-4 opacity-100 saturate-110 brightness-105" />
              {pendingFriendRequestsCount > 0 && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center shadow border border-white tabular-nums">
                  {pendingFriendRequestsCount > 99 ? '99+' : pendingFriendRequestsCount}
                </span>
              )}
            </button>

            {/* Real Connected Users Side Drawer Trigger */}
            <button 
              type="button"
              onClick={onOpenOnlineUsers}
              className="h-9 flex items-center gap-1 px-1.5 sm:px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-black active:scale-95 transition-all shrink-0 whitespace-nowrap tabular-nums cursor-pointer shadow-2xs"
              title="المتصلون الآن"
            >
              <Users strokeWidth={2} className="w-3 h-3 text-emerald-600 shrink-0 opacity-100 saturate-110 brightness-105" />
              <span>{Math.max(1, onlineUsersCount)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            </button>

            {/* Notifications Button (Desktop lg+) */}
            <button 
              type="button"
              onClick={onOpenNotifications}
              className="hidden lg:flex w-9 h-9 items-center justify-center relative rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
              title="الإشعارات"
            >
              <Bell strokeWidth={2} className="w-4 h-4 opacity-100 saturate-110 brightness-105" />
            </button>

            {/* Radio Player Button (Desktop lg+) */}
            <button
              type="button"
              onClick={onOpenRadio}
              className={`hidden lg:flex w-9 h-9 items-center justify-center rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isRadioPlaying
                  ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title="راديو ومكتبة الطرب العربي"
            >
              <Radio strokeWidth={2} className="w-4 h-4 text-purple-600 opacity-100 saturate-110 brightness-105" />
            </button>

            {/* Share Button (Desktop/Tablet sm+, inside More menu on small mobile) */}
            <button 
              type="button"
              onClick={handleShare}
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors shrink-0 active:scale-95 cursor-pointer"
              title="مشاركة رابط المنصة"
            >
              <Share2 strokeWidth={2} className="w-4 h-4 opacity-100 saturate-110 brightness-105" />
            </button>

            {/* Distinctive Store & Coins Recharge Button (Hidden for Owner) */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onOpenWallet();
                }}
                title="المتجر وشحن الكوينز"
                aria-label="المتجر وشحن الكوينز"
                className="relative w-9 h-9 sm:w-auto sm:px-2.5 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border border-amber-400/70 shadow-sm shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
              >
                <ShoppingBag strokeWidth={2} className="w-4 h-4 shrink-0 opacity-100 saturate-110 brightness-105" />
                <span className="hidden sm:inline text-xs font-black">المتجر</span>
                <span
                  className="sm:hidden absolute -top-1 -left-1 text-[9px] leading-none bg-white rounded-full p-0.5 shadow-xs border border-amber-200 pointer-events-none"
                  aria-hidden="true"
                >
                  🪙
                </span>
              </button>
            )}

            {/* Far-Left More Options Menu Toggle Button (...) */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen((prev) => !prev);
                }}
                className="w-8 h-9 sm:w-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="خيارات إضافية"
                aria-label="القائمة والخيارات الإضافية"
              >
                <MoreVertical strokeWidth={2} className="w-4 h-4 opacity-100 saturate-110 brightness-105" />
              </button>

              {/* Floating Dropdown Menu */}
              {isMoreMenuOpen && (
                <div 
                  className="absolute left-0 mt-1.5 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 space-y-1 z-[100] text-right animate-in fade-in zoom-in-95"
                  onClick={() => setIsMoreMenuOpen(false)}
                >
                  {/* Mobile-only quick actions */}
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={onOpenWallet}
                      className="md:hidden w-full px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-800 text-xs font-black flex items-center justify-between transition"
                    >
                      <span className="flex items-center gap-2">
                        <span>🪙</span>
                        <span>المحفظة والكوينز</span>
                      </span>
                      <span className="tabular-nums text-[11px] bg-amber-100 px-1.5 py-0.5 rounded-md">
                        {currentUser.coins.toLocaleString()}
                      </span>
                    </button>
                  )}

                  {onOpenLeaderboard && (
                    <button
                      type="button"
                      onClick={onOpenLeaderboard}
                      className="md:hidden w-full px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-800 text-xs font-black flex items-center gap-2 transition"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      <span>الكبار (التوب 10)</span>
                    </button>
                  )}

                  {!isOwner && (
                    <button
                      type="button"
                      onClick={onOpenVip}
                      className="md:hidden w-full px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-700 text-xs font-black flex items-center gap-2 transition"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>ترقية VIP</span>
                    </button>
                  )}

                  {isOwner && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="md:hidden w-full px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 text-xs font-black flex items-center gap-2 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                      <span>لوحة الإدارة</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onOpenRadio}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-purple-600" />
                      <span>راديو الطرب</span>
                    </span>
                    {isRadioPlaying && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>}
                  </button>

                  <button
                    type="button"
                    onClick={onOpenNotifications}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span>الإشعارات</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>مشاركة الرابط</span>
                  </button>

                  {onOpenSupport && (
                    <button
                      type="button"
                      onClick={onOpenSupport}
                      className="w-full px-3 py-2 rounded-xl hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2 transition"
                    >
                      <LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />
                      <span>الدعم والتواصل</span>
                    </button>
                  )}

                  {onToggleDarkMode && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDarkMode}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDarkMode();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {isDarkMode ? (
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                        <span>{isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                      </span>
                      <span
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                          isDarkMode ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </span>
                    </button>
                  )}

                  <div
                    className="md:hidden pt-1 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PWAInstallButton variant="full" />
                  </div>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2 transition border-t border-slate-100 pt-2"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>تسجيل الخروج</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </header>
  );
});
