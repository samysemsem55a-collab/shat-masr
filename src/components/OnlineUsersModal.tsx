import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Search, 
  Mic, 
  Crown, 
  MessageCircle, 
  UserPlus, 
  Check, 
  Star,
  Award
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectUserForProfile: (user: User) => void;
  onInviteToMic: (user: User) => void;
  onOpenPrivateChatWith: (user: User) => void;
  roomTitle?: string;
  roomUsers?: User[];
  allActiveUsers?: User[];
}

export const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUserForProfile,
  onInviteToMic,
  onOpenPrivateChatWith,
  roomTitle,
  roomUsers = [],
  allActiveUsers = []
}) => {
  const [activeTab, setActiveTab] = useState<'room' | 'general'>(roomTitle ? 'room' : 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'diamond' | 'gold' | 'members'>('all');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Use provided users, deduplicate by ID, and ensure at least currentUser is present
  const rawList = activeTab === 'room' && roomTitle 
    ? (roomUsers.length > 0 ? roomUsers : [currentUser])
    : (allActiveUsers.length > 0 ? allActiveUsers : [currentUser]);

  const seenIds = new Set<string>();
  const baseUsersList: User[] = [];
  for (const u of rawList) {
    if (u && u.id && !seenIds.has(u.id)) {
      seenIds.add(u.id);
      baseUsersList.push(u);
    }
  }

  // Sort by rating points (descending) as requested: "تؤثر على ترتيبهم في قائمة المتواجدين"
  const sortedUsers = [...baseUsersList].sort((a, b) => {
    const pointsA = a.ratingPoints || 0;
    const pointsB = b.ratingPoints || 0;
    return pointsB - pointsA;
  });

  const filteredUsers = sortedUsers.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.country && u.country.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (roleFilter === 'diamond') return u.role === 'vip_diamond' || u.vipBadge?.includes('ألماسي');
    if (roleFilter === 'gold') return u.role === 'vip_gold' || u.vipBadge?.includes('ذهبي');
    if (roleFilter === 'members') return u.role === 'member' || !u.vipBadge;
    return true;
  });

  const handleInvite = (user: User) => {
    sounds.playMessageSent();
    setInvitedUserIds(prev => new Set(prev).add(user.id));
    onInviteToMic(user);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-900">
        
        {/* Header */}
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                {roomTitle ? `المتصلون (${roomTitle})` : 'المتصلون الآن في شات مصر والعرب'}
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {filteredUsers.length} متصلين • مرتبين حسب نقاط التقييم ⭐
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        {roomTitle && (
          <div className="grid grid-cols-2 p-1.5 bg-slate-50 border-b border-slate-200 text-xs font-bold gap-1">
            <button
              onClick={() => setActiveTab('room')}
              className={`py-1.5 rounded-xl transition-all ${
                activeTab === 'room'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              في هذه الغرفة ({roomUsers.length || 1})
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`py-1.5 rounded-xl transition-all ${
                activeTab === 'general'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع المتصلين ({allActiveUsers.length || 1})
            </button>
          </div>
        )}

        {/* Search Bar & Role Filter */}
        <div className="p-2.5 border-b border-slate-200 bg-slate-50/70 space-y-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الدولة..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Role Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold no-scrollbar py-0.5">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                roleFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setRoleFilter('diamond')}
              className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1 ${
                roleFilter === 'diamond'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white border border-slate-200 text-cyan-700 hover:bg-cyan-50'
              }`}
            >
              <span>💎</span> VIP ألماسي
            </button>
            <button
              onClick={() => setRoleFilter('gold')}
              className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1 ${
                roleFilter === 'gold'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span>👑</span> VIP ذهبي
            </button>
            <button
              onClick={() => setRoleFilter('members')}
              className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                roleFilter === 'members'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              الأعضاء
            </button>
          </div>
        </div>

        {/* Users List Sorted by Rating */}
        <div className="p-2.5 space-y-1.5 overflow-y-auto flex-1">
          {filteredUsers.map((user, idx) => {
            const isMe = user.id === currentUser.id;
            const hasInvited = invitedUserIds.has(user.id);
            const userBadges = user.badges || ['عضو نشط'];

            return (
              <div
                key={user.id || idx}
                onClick={() => onSelectUserForProfile(user)}
                className="p-2 sm:p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 flex items-center justify-between gap-2 cursor-pointer transition-all hover:bg-slate-50 shadow-sm"
              >
                {/* Left Side: Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!isMe && (
                    <>
                      {/* Invite to Mic */}
                      {roomTitle && (
                        <button
                          onClick={() => handleInvite(user)}
                          disabled={hasInvited}
                          className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-0.5 shadow-sm transition-all ${
                            hasInvited
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 text-indigo-700 hover:text-white'
                          }`}
                          title="دعوة للصعود إلى المايك"
                        >
                          {hasInvited ? <Check className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                          <span>{hasInvited ? 'تمت الدعوة' : 'دعوة للمايك'}</span>
                        </button>
                      )}

                      {/* Direct Message */}
                      <button
                        onClick={() => {
                          onClose();
                          onOpenPrivateChatWith(user);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white transition-colors"
                        title="محادثة خاصة"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {isMe && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      أنت
                    </span>
                  )}
                </div>

                {/* Right Side (in RTL): Avatar, Name, VIP, Rating Points, Badges */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-right min-w-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs font-black text-slate-900 truncate hover:underline">
                        {user.name}
                      </span>
                      <span className="text-sm shrink-0">{user.countryFlag || '🇪🇬'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-500 mt-0.5">
                      {/* Rating Points Badge */}
                      <span className="flex items-center gap-0.5 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1 rounded">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                        <span>{user.ratingPoints || 0} تقييم</span>
                      </span>

                      {/* VIP Badge */}
                      {user.vipBadge && (
                        <span className="text-amber-700 font-bold">
                          {user.vipBadge}
                        </span>
                      )}
                    </div>

                    {/* Earned Badges chips */}
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {userBadges.slice(0, 2).map((b, bI) => (
                        <span key={bI} className="text-[9px] px-1.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                  </div>

                  {/* Rank Number */}
                  <span className="text-xs font-black text-slate-400 w-4 text-center">
                    #{idx + 1}
                  </span>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
