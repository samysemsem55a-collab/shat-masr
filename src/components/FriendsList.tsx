import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageCircle, 
  UserMinus, 
  Search, 
  Sparkles,
  Heart,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { User, Friend } from '../types/chat';
import { subscribeToFriendsList, removeFriendInDB } from '../services/firebase';
import { sounds } from '../utils/soundEffects';

interface FriendsListProps {
  currentUser: User;
  onStartPrivateChat: (friend: Friend) => void;
  onOpenProfile?: (user: Partial<User>) => void;
}

export const FriendsList: React.FC<FriendsListProps> = ({
  currentUser,
  onStartPrivateChat,
  onOpenProfile
}) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    setLoading(true);

    const unsub = subscribeToFriendsList(currentUser.id, (loadedFriends) => {
      setFriends(loadedFriends || []);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser?.id]);

  const handleRemoveFriend = async (friend: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    const fId = friend.friendId || friend.id;
    if (confirmRemoveId !== fId) {
      setConfirmRemoveId(fId);
      setTimeout(() => {
        setConfirmRemoveId(prev => (prev === fId ? null : prev));
      }, 4000);
      return;
    }
    sounds.playMessageSent();
    setConfirmRemoveId(null);
    await removeFriendInDB(currentUser.id, fId);
  };

  const handleStartChat = (friend: Friend) => {
    sounds.playMessageSent();
    onStartPrivateChat(friend);
  };

  const filteredFriends = [...friends]
    .filter(f => 
      !searchQuery.trim() ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.bio && f.bio.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

  const onlineFriendsCount = friends.filter(f => f.isOnline).length;

  return (
    <div className="space-y-3 animate-in fade-in">
      {/* Header Stats */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-purple-50 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              قائمة أصدقائي
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                {friends.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              متصلون الآن: <span className="text-emerald-600 font-bold">{onlineFriendsCount}</span> من أصل {friends.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
          <UserCheck className="w-3.5 h-3.5" />
          <span>مزامنة لحظية</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم في قائمة أصدقائك..."
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm transition"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* Friends List Container */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold">جاري تحميل قائمة الأصدقاء...</p>
        </div>
      ) : filteredFriends.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-2xl">
            🤝
          </div>
          <h4 className="text-sm font-black text-slate-900">
            {searchQuery ? 'لا توجد نتائج بحث مطابقة' : 'لا يوجد أصدقاء مضافون بعد'}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? 'جرّب البحث باسم آخر أو تأكد من صحة الحروف.'
              : 'يمكنك إرسال طلبات صداقة للأعضاء داخل الغرف أو قائمة المتصلين بالضغط على ملفهم الشخصي ثم "إضافة صديق".'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFriends.map((friend) => {
            const fId = friend.friendId || friend.id;
            const isConfirming = confirmRemoveId === fId;
            return (
              <div
                key={fId}
                onClick={() => handleStartChat(friend)}
                className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-sm flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-50/70 group"
              >
                {/* Actions: Start Chat & Remove */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleStartChat(friend)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    title="بدء محادثة خاصة"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>محادثة</span>
                  </button>

                  <button
                    onClick={(e) => handleRemoveFriend(friend, e)}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1 ${
                      isConfirming
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                    }`}
                    title={isConfirming ? 'اضغط مجدداً لتأكيد الحذف' : 'حذف من الأصدقاء'}
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    {isConfirming && <span>تأكيد؟</span>}
                  </button>
                </div>

                {/* Friend Info & Live Status (RTL alignment) */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-right min-w-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition">
                        {friend.name}
                      </span>
                      <span className="text-sm shrink-0">{friend.countryFlag || '🇪🇬'}</span>
                    </div>

                    <div className="flex items-center gap-2 justify-end text-[11px] mt-0.5">
                      {friend.vipBadge && (
                        <span className="text-amber-700 font-bold">
                          {friend.vipBadge}
                        </span>
                      )}

                      {/* Online/Activity Status Indicator */}
                      {(() => {
                        const st = friend.isOnline ? (friend.status || 'online') : 'offline';
                        const statusMap: Record<string, { dot: string; text: string; label: string }> = {
                          online: { dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600', label: 'متاح الآن' },
                          busy: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'مشغول' },
                          dnd: { dot: 'bg-rose-500', text: 'text-rose-600', label: 'لا تزعجني' },
                          in_mic: { dot: 'bg-purple-500 animate-pulse', text: 'text-purple-600', label: 'متواجد في مجلس صوتي' },
                          away: { dot: 'bg-amber-400', text: 'text-amber-600', label: 'بعيد' },
                          offline: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'غير متصل' }
                        };
                        const meta = statusMap[st] || statusMap.offline;
                        return (
                          <span className="flex items-center gap-1 font-bold">
                            <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                            <span className={meta.text}>{meta.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Avatar with Live Indicator Dot */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 shadow-sm">
                      {friend.avatar ? (
                        <img 
                          src={friend.avatar} 
                          alt={friend.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{friend.name.charAt(0)}</span>
                      )}
                    </div>
                    {(() => {
                      const st = friend.isOnline ? (friend.status || 'online') : 'offline';
                      const dotColor =
                        st === 'online'
                          ? 'bg-emerald-500'
                          : st === 'busy'
                          ? 'bg-amber-500'
                          : st === 'dnd'
                          ? 'bg-rose-500'
                          : st === 'in_mic'
                          ? 'bg-purple-500'
                          : 'bg-slate-400';
                      const titleMap: Record<string, string> = {
                        online: 'متاح',
                        busy: 'مشغول',
                        dnd: 'لا تزعجني',
                        in_mic: 'متواجد في مجلس صوتي',
                        offline: 'غير متصل'
                      };
                      return (
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 ${dotColor} border-2 border-white rounded-full`}
                          title={titleMap[st] || 'متصل'}
                        ></span>
                      );
                    })()}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
