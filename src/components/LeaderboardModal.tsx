import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, X, Sparkles, Flame, MessageCircle } from 'lucide-react';
import { User } from '../types/chat';
import { subscribeToLeaderboardUsers } from '../services/firebase';
import { AvatarWithFrame } from './AvatarWithFrame';
import { getLeaderboardScore, getRankDisplayMeta } from '../utils/userRanks';
import { VerifiedBadge } from '../utils/verifiedBadge';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectUser: (user: User) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  const [leaders, setLeaders] = useState<User[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToLeaderboardUsers((users) => {
      setLeaders(users.slice(0, 10));
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#090d16] border border-amber-400/35 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[88vh]"
      >
        {/* Luxury Top Banner */}
        <div className="bg-gradient-to-l from-amber-500 via-yellow-500 to-purple-700 px-4 py-3.5 flex items-center justify-between text-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-950/20 flex items-center justify-center shadow-inner">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <span>قائمة الكبار — Top 10</span>
                <Crown className="w-4 h-4 text-yellow-200" />
              </h2>
              <p className="text-[10.5px] font-bold text-amber-50">
                ترتيب النخبة والـ VIP والأكثر تفاعلاً في شات مصر لحظياً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-black/25 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top 3 Podium Cards */}
        {leaders.length > 0 && (
          <div className="grid grid-cols-3 gap-2 px-3 pt-3 pb-2 bg-white/[0.03] border-b border-white/10">
            {[1, 0, 2].map((podiumIdx) => {
              const user = leaders[podiumIdx];
              if (!user) return <div key={podiumIdx} />;
              const rankNum = podiumIdx + 1;
              const isFirst = rankNum === 1;
              const score = getLeaderboardScore(user);
              const meta = getRankDisplayMeta(user.role, user.vipBadge);

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className={`flex flex-col items-center text-center p-2.5 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer ${
                    isFirst
                      ? 'bg-gradient-to-b from-amber-500/25 to-purple-900/25 border-amber-400/60 -mt-1 shadow-lg shadow-amber-500/10'
                      : rankNum === 2
                      ? 'bg-slate-800/70 border-slate-400/40'
                      : 'bg-orange-950/35 border-orange-400/40'
                  }`}
                >
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full mb-1.5 ${
                      isFirst
                        ? 'bg-amber-400 text-slate-950'
                        : rankNum === 2
                        ? 'bg-slate-300 text-slate-900'
                        : 'bg-orange-400 text-slate-950'
                    }`}
                  >
                    {isFirst ? '🥇 المركز #1' : rankNum === 2 ? '🥈 #2' : '🥉 #3'}
                  </span>
                  <AvatarWithFrame user={user} size={isFirst ? 'md' : 'sm'} showOnlineDot />
                  <span className="mt-1.5 text-xs font-black truncate max-w-full text-white">
                    {user.name}
                  </span>
                  {meta.isPrivileged && (
                    <span className={`mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full border font-black truncate max-w-full ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                  )}
                  <span className="mt-1 text-[10px] font-black text-amber-300 tabular-nums">
                    ⚡ {score.toLocaleString()} نقطة
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Ranks 1 - 10 Full List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
          {leaders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-bold">
              جاري تحميل قائمة المتصدرين مباشرة...
            </div>
          ) : (
            leaders.map((user, idx) => {
              const rank = idx + 1;
              const score = getLeaderboardScore(user);
              const meta = getRankDisplayMeta(user.role, user.vipBadge);
              const isMe = user.id === currentUser.id;

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    rank === 1
                      ? 'bg-gradient-to-l from-amber-500/20 via-amber-500/5 to-transparent border-amber-400/50'
                      : rank === 2
                      ? 'bg-slate-800/60 border-slate-400/35'
                      : rank === 3
                      ? 'bg-orange-950/30 border-orange-500/35'
                      : isMe
                      ? 'bg-indigo-900/35 border-indigo-400/50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        rank === 1
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : rank === 3
                          ? 'bg-orange-500 text-white'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {rank === 1 ? '👑' : `#${rank}`}
                    </div>

                    <AvatarWithFrame user={user} size="sm" showOnlineDot />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-white truncate max-w-[140px]">
                          {user.name}
                        </span>
                        <VerifiedBadge verified={user.verified} size="xs" />
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-bold">
                            أنت
                          </span>
                        )}
                        {meta.isPrivileged && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-black ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{user.countryFlag || '🇪🇬'}</span>
                        <span>المستوى {user.level || 1}</span>
                        <span>•</span>
                        <span className="text-amber-300 font-bold">
                          🪙 {(user.coins || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left">
                      <div className="text-xs font-black text-amber-300 tabular-nums flex items-center gap-0.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>{score.toLocaleString()}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 block text-center">نقطة</span>
                    </div>
                    <MessageCircle className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-white/[0.03] border-t border-white/10 flex items-center justify-between text-[10.5px] text-slate-300">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            تزيد النقاط بالتفاعل والهدايا والترقية لـ VIP
          </span>
          <span className="font-black text-amber-400">محدث لحظياً ⚡</span>
        </div>
      </motion.div>
    </div>
  );
};
