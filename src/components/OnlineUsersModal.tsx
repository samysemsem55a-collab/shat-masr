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
import { getRankDisplayMeta } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
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
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-start bg-slate-900/45 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-[100dvh] w-1/2 w-[50vw] max-w-[420px] min-w-[200px] bg-white border-l border-slate-200 shadow-2xl flex flex-col text-slate-900 animate-drawer-in-right overflow-hidden"
      >
        
        {/* Side Drawer Header */}
        <div className="p-2.5 sm:p-3 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] bg-gradient-to-l from-teal-600 via-emerald-600 to-cyan-700 text-white border-b border-emerald-500/40 flex items-center justify-between gap-1 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/20 border border-white/30 text-white flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[11px] sm:text-xs font-black text-white flex items-center gap-1 truncate">
                <span className="truncate">{roomTitle ? `متصلو الغرفة` : 'المتصلون الآن'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0"></span>
              </h3>
              <p className="text-[9.5px] text-emerald-100 truncate">
                {filteredUsers.length} عضو متصل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/90 hover:text-white bg-white/15 hover:bg-white/25 transition shrink-0 cursor-pointer"
            title="إغلاق القائمة الجانبية"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {roomTitle && (
          <div className="grid grid-cols-2 p-1 bg-slate-50 border-b border-slate-200 text-[10px] font-bold gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('room')}
              className={`py-1 rounded-lg transition-all truncate px-1 ${
                activeTab === 'room'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الغرفة ({roomUsers.length || 1})
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`py-1 rounded-lg transition-all truncate px-1 ${
                activeTab === 'general'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({allActiveUsers.length || 1})
            </button>
          </div>
        )}

        {/* Search Bar & Role Filter */}
        <div className="p-2 border-b border-slate-200 bg-slate-50/70 space-y-1.5 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 pr-7 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto text-[9.5px] font-bold no-scrollbar">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2 py-0.5 rounded-md transition shrink-0 ${
                roleFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setRoleFilter('diamond')}
              className={`px-2 py-0.5 rounded-md transition shrink-0 ${
                roleFilter === 'diamond'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white border border-slate-200 text-cyan-700'
              }`}
            >
              💎 ألماسي
            </button>
            <button
              onClick={() => setRoleFilter('gold')}
              className={`px-2 py-0.5 rounded-md transition shrink-0 ${
                roleFilter === 'gold'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-slate-200 text-amber-700'
              }`}
            >
              👑 ذهبي
            </button>
            <button
              onClick={() => setRoleFilter('members')}
              className={`px-2 py-0.5 rounded-md transition shrink-0 ${
                roleFilter === 'members'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              أعضاء
            </button>
          </div>
        </div>

        {/* Compact Users List Fitted Cleanly for 50% Drawer Width */}
        <div className="p-1.5 sm:p-2 space-y-1 overflow-y-auto flex-1">
          {filteredUsers.map((user, idx) => {
            const isMe = user.id === currentUser.id;
            const hasInvited = invitedUserIds.has(user.id);
            const rankMeta = getRankDisplayMeta(user.role, user.vipBadge);

            return (
              <div
                key={user.id || idx}
                onClick={() => onSelectUserForProfile(user)}
                className={`p-1.5 sm:p-2 rounded-xl border flex items-center justify-between gap-1.5 cursor-pointer transition-all hover:bg-slate-50 shadow-2xs ${
                  rankMeta.isPrivileged
                    ? 'bg-gradient-to-l from-amber-50/40 via-white to-white border-amber-200/80 hover:border-amber-300'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* Right Side (in RTL): Rank + Compact Avatar + Name */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[9.5px] font-black text-slate-400 w-4 text-center shrink-0">
                    #{idx + 1}
                  </span>

                  <AvatarWithFrame user={user} size="xs" showOnlineDot />

                  <div className="text-right min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[11px] truncate ${rankMeta.nameColorClass}`}>
                        {user.name}
                      </span>
                      <span className="text-[10px] shrink-0">{user.countryFlag || '🇪🇬'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500 truncate">
                      <span className="text-amber-600 font-bold flex items-center gap-0.5 shrink-0">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                        {user.ratingPoints || 0}
                      </span>
                      {rankMeta.isPrivileged && (
                        <span className={`px-1 py-0.2 rounded border text-[8.5px] font-black truncate ${rankMeta.badgeClass}`}>
                          {rankMeta.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left Side: Compact Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!isMe ? (
                    <>
                      {roomTitle && (
                        <button
                          onClick={() => handleInvite(user)}
                          disabled={hasInvited}
                          className={`p-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            hasInvited
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 text-indigo-700 hover:text-white'
                          }`}
                          title="دعوة للمايك"
                        >
                          {hasInvited ? <Check className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onOpenPrivateChatWith(user);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white transition-colors cursor-pointer"
                        title="محادثة خاصة"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      أنت
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
