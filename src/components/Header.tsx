import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Share2, 
  Users, 
  Crown, 
  Radio,
  MessageCircle,
  UserPlus,
  Camera,
  CheckCheck,
  Clock,
  ShieldCheck,
  LogOut,
  MoreVertical
} from 'lucide-react';
import { User, UnreadSenderSummary } from '../types/chat';
import { isUserAdminOrOwner } from '../data/seedData';
import { realtimeSocket } from '../services/realtimeSocket';
import { PWAInstallButton } from './PWAInstallButton';
import { toast } from 'sonner';
import appBrandIcon from '../assets/images/shat_masr_icon_1794650535035.jpg';

interface HeaderProps {
  currentUser: User;
  onOpenWallet: () => void;
  onOpenVip: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenOnlineUsers: () => void;
  onOpenFriendRequests: () => void;
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
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenWallet,
  onOpenVip,
  onOpenProfile,
  onOpenNotifications,
  onOpenOnlineUsers,
  onOpenFriendRequests,
  pendingFriendRequestsCount,
  onlineUsersCount,
  onOpenRadio,
  isRadioPlaying,
  onAvatarChanged,
  onOpenAdmin,
  onLogout,
  unreadMessagesBySender = [],
  totalUnreadMessagesCount = 0,
  onOpenSenderChat,
  onClearAllUnreadMessages,
  onOpenMessagesTab
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMessagesMenuOpen, setIsMessagesMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const messagesMenuRef = useRef<HTMLDivElement>(null);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(() => realtimeSocket.isConnected());

  // Subscribe to real-time socket connection state
  useEffect(() => {
    const unsub = realtimeSocket.subscribeToConnectionStatus((connected) => {
      setIsSocketConnected(connected);
    });
    return () => unsub();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isMoreMenuOpen && !isMessagesMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (isMoreMenuOpen && moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (isMessagesMenuOpen && messagesMenuRef.current && !messagesMenuRef.current.contains(event.target as Node)) {
        setIsMessagesMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMoreMenuOpen, isMessagesMenuOpen]);

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

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-2.5 sm:px-5 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        
        {/* Hidden File Input for Direct Avatar Upload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleAvatarFileChange} 
        />

        {/* Primary Header Row: Profile + Desktop Brand/Pills + Symmetrical Icon Toolbar */}
        <div className="flex items-center justify-between gap-2 min-w-0 md:flex-1">
          
          {/* Right Side (in RTL): Integrated Profile Card + Brand + Desktop Economy Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 md:flex-initial">
            
            {/* Integrated User Profile Card */}
            <div className="flex items-center gap-2 p-1 pl-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition min-w-0 max-w-full sm:max-w-[240px] md:max-w-none shrink">
              {/* Avatar Wrapper with Self-Contained Status Dot & Quick Camera Trigger */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  title={`عرض الملف الشخصي: ${currentUser.name}`}
                  className={`w-9 h-9 rounded-full overflow-hidden border-2 bg-gradient-to-tr from-indigo-500 to-amber-500 flex items-center justify-center font-bold text-white text-xs shadow-sm cursor-pointer ${currentUser.frameStyle || 'border-indigo-300'}`}
                >
                  {currentUser.avatar ? (
                    <img 
                      src={currentUser.avatar} 
                      alt={currentUser.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{currentUser.name.charAt(0)}</span>
                  )}
                </button>
                <span 
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full pointer-events-none transition-colors ${
                    !isSocketConnected
                      ? 'bg-rose-500'
                      : currentUser.status === 'busy'
                      ? 'bg-amber-500'
                      : currentUser.status === 'dnd'
                      ? 'bg-rose-500'
                      : currentUser.status === 'in_mic'
                      ? 'bg-purple-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="تغيير الصورة الشخصية مباشرة"
                  className="absolute -bottom-0.5 -left-1 w-[18px] h-[18px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-xs border-[1.5px] border-white transition-transform active:scale-90 cursor-pointer"
                >
                  <Camera className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Username right beside avatar, and live connection/activity status underneath */}
              <button
                type="button"
                onClick={onOpenProfile}
                title={`عرض الملف الشخصي: ${currentUser.name} (${isSocketConnected ? 'متصل' : 'غير متصل'})`}
                className="flex flex-col justify-center leading-tight min-w-0 flex-1 text-right cursor-pointer"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-black text-slate-900 truncate hover:text-indigo-600 transition">
                    {currentUser.name}
                  </span>
                  {currentUser.vipBadge && (
                    <span className="text-[8.5px] px-1 py-0.5 leading-none rounded bg-amber-100 text-amber-700 border border-amber-200 font-bold shrink-0">
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9.5px] font-bold mt-0.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    !isSocketConnected
                      ? 'bg-rose-500'
                      : currentUser.status === 'busy'
                      ? 'bg-amber-500'
                      : currentUser.status === 'dnd'
                      ? 'bg-rose-500'
                      : currentUser.status === 'in_mic'
                      ? 'bg-purple-500 animate-pulse'
                      : 'bg-emerald-500 animate-pulse'
                  }`} />
                  <span className={`truncate ${
                    !isSocketConnected
                      ? 'text-rose-600'
                      : currentUser.status === 'busy'
                      ? 'text-amber-600'
                      : currentUser.status === 'dnd'
                      ? 'text-rose-600'
                      : currentUser.status === 'in_mic'
                      ? 'text-purple-600'
                      : 'text-emerald-600'
                  }`}>
                    {!isSocketConnected
                      ? 'غير متصل'
                      : currentUser.status === 'busy'
                      ? 'متصل • مشغول'
                      : currentUser.status === 'dnd'
                      ? 'متصل • لا تزعجني'
                      : currentUser.status === 'in_mic'
                      ? 'في مجلس صوتي'
                      : 'متصل'}
                  </span>
                </div>
              </button>
            </div>

            {/* Brand Logo & Name (Desktop lg+) */}
            <div className="hidden lg:flex items-center gap-2 shrink-0 bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 h-9">
              <img
                src={appBrandIcon}
                alt="شات مصر"
                className="w-6 h-6 rounded-lg object-cover shadow-sm shrink-0 border border-indigo-200"
              />
              <span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                شات مصر
              </span>
            </div>

            {/* Desktop Economy & Rank Strip (md+) */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <button 
                type="button"
                onClick={onOpenVip}
                title="ترقية الرتبة VIP"
                className="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                <span className="text-xs font-black">VIP</span>
              </button>

              {isUserAdminOrOwner(currentUser) && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  title="لوحة تحكم المدير والإشراف العام"
                  className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="text-[11px] font-black">الإدارة</span>
                </button>
              )}

              <button 
                type="button"
                onClick={onOpenWallet}
                title="المحفظة وشحن الكوينز"
                className="h-9 px-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-black flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap tabular-nums cursor-pointer"
              >
                <span>🪙</span>
                <span>{currentUser.coins.toLocaleString()}</span>
              </button>

              <PWAInstallButton />
            </div>

          </div>

          {/* Left Side (in RTL): Symmetrical Action Icons Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Incoming Messages Notification Icon + Per-Sender Counter Dropdown */}
            <div className="relative shrink-0" ref={messagesMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsMessagesMenuOpen((prev) => !prev);
                }}
                title="إشعارات الرسائل الواردة"
                className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer ${
                  totalUnreadMessagesCount > 0
                    ? 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                {totalUnreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center shadow border border-white tabular-nums">
                    {totalUnreadMessagesCount > 99 ? '99+' : totalUnreadMessagesCount}
                  </span>
                )}
              </button>

              {isMessagesMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-1rem)] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-50 text-right animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2.5 bg-gradient-to-l from-indigo-50 via-sky-50 to-white border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MessageCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-black text-slate-900 truncate">إشعارات الرسائل الواردة</span>
                      {totalUnreadMessagesCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums shrink-0">
                          {totalUnreadMessagesCount}
                        </span>
                      )}
                    </div>
                    {totalUnreadMessagesCount > 0 && onClearAllUnreadMessages && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearAllUnreadMessages();
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>قراءة الكل</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {unreadMessagesBySender.length === 0 ? (
                      <div className="p-6 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-600">لا توجد رسائل واردة جديدة حالياً</p>
                      </div>
                    ) : (
                      unreadMessagesBySender.map((sender) => (
                        <button
                          key={sender.senderId}
                          type="button"
                          onClick={() => {
                            setIsMessagesMenuOpen(false);
                            onOpenSenderChat?.(sender);
                          }}
                          className="w-full px-3 py-2.5 hover:bg-indigo-50/70 transition flex items-center justify-between gap-2.5 text-right cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-indigo-200 bg-indigo-50 flex items-center justify-center font-black text-xs text-indigo-700 shrink-0">
                              {sender.senderAvatar ? (
                                <img
                                  src={sender.senderAvatar}
                                  alt={sender.senderName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span>{sender.senderName.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-black text-slate-900 truncate">{sender.senderName}</span>
                                <span className="text-[9.5px] text-slate-400 flex items-center gap-0.5 shrink-0">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(sender.lastTimestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate mt-0.5">{sender.lastMessage}</p>
                            </div>
                          </div>

                          <span
                            title={`عدد الرسائل من ${sender.senderName}`}
                            className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs shrink-0 tabular-nums"
                          >
                            {sender.count}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {onOpenMessagesTab && (
                    <div className="p-2 bg-slate-50 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMessagesMenuOpen(false);
                          onOpenMessagesTab();
                        }}
                        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer"
                      >
                        فتح كل المحادثات الخاصة
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Friend Requests Button */}
            <button 
              type="button"
              onClick={onOpenFriendRequests}
              title="طلبات الصداقة"
              className="relative w-9 h-9 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {pendingFriendRequestsCount > 0 && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center shadow border border-white tabular-nums">
                  {pendingFriendRequestsCount}
                </span>
              )}
            </button>

            {/* Real Connected Users Counter */}
            <button 
              type="button"
              onClick={onOpenOnlineUsers}
              className="h-9 flex items-center gap-1 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-black active:scale-95 transition-all shrink-0 whitespace-nowrap tabular-nums cursor-pointer"
              title="المتواجدون حالياً"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
              <Bell className="w-4 h-4" />
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
              <Radio className="w-4 h-4 text-purple-600" />
            </button>

            {/* Share Button (Desktop/Tablet sm+, inside More menu on small mobile) */}
            <button 
              type="button"
              onClick={handleShare}
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors shrink-0 active:scale-95 cursor-pointer"
              title="مشاركة رابط المنصة"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Compact More Options Menu Toggle Button */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMessagesMenuOpen(false);
                  setIsMoreMenuOpen((prev) => !prev);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="خيارات إضافية"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Floating Dropdown Menu */}
              {isMoreMenuOpen && (
                <div 
                  className="absolute left-0 mt-1.5 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 space-y-1 z-50 text-right animate-in fade-in zoom-in-95"
                  onClick={() => setIsMoreMenuOpen(false)}
                >
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

        {/* Mobile Compact Economy & Install Row (<md): Prevents edge clipping and icon overlap on small screens */}
        <div className="flex md:hidden items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none">
            <button 
              type="button"
              onClick={onOpenWallet}
              title="المحفظة وشحن الكوينز"
              className="h-9 px-2.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-black flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap tabular-nums"
            >
              <span>🪙</span>
              <span>{currentUser.coins.toLocaleString()}</span>
            </button>

            <button 
              type="button"
              onClick={onOpenVip}
              title="ترقية الرتبة VIP"
              className="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
              <span className="text-[11px] font-black">VIP</span>
            </button>

            {isUserAdminOrOwner(currentUser) && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                title="لوحة تحكم المدير والإشراف العام"
                className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-[11px] font-black">الإدارة</span>
              </button>
            )}
          </div>

          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>

      </div>
    </header>
  );
};
