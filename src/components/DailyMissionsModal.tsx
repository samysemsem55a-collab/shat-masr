import React, { useState } from 'react';
import { 
  X, 
  Target, 
  Sparkles, 
  Gift, 
  CheckCircle2, 
  Coins, 
  Flame,
  Calendar,
  BarChart3,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyMission, User } from '../types/chat';
import { sounds } from '../utils/soundEffects';

interface DailyMissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: DailyMission[];
  onClaimReward: (missionId: string) => void;
  currentUser: User;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  isOpen,
  onClose,
  missions,
  onClaimReward,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');

  if (!isOpen) return null;

  // Reduce statistics for daily and weekly missions
  const completedCount = missions.reduce((acc, m) => acc + (m.isCompleted ? 1 : 0), 0);
  const claimedCoins = missions.reduce((acc, m) => acc + (m.isClaimed ? m.rewardCoins : 0), 0);
  const totalPotentialCoins = missions.reduce((acc, m) => acc + m.rewardCoins, 0);

  // Weekly stats mock list aggregated using reduce
  const weeklyDays = [
    { day: 'السبت', completed: 4, coins: 250 },
    { day: 'الأحد', completed: 3, coins: 180 },
    { day: 'الإثنين', completed: 5, coins: 320 },
    { day: 'الثلاثاء', completed: 4, coins: 260 },
    { day: 'الأربعاء', completed: 5, coins: 310 },
    { day: 'الخميس', completed: 4, coins: 270 },
    { day: 'الجمعة (اليوم)', completed: completedCount, coins: claimedCoins }
  ];

  const totalWeeklyCompleted = weeklyDays.reduce((acc, d) => acc + d.completed, 0);
  const totalWeeklyCoins = weeklyDays.reduce((acc, d) => acc + d.coins, 0);
  const weeklyAverage = Math.round(totalWeeklyCoins / weeklyDays.length);

  const handleClaim = (mission: DailyMission) => {
    sounds.playCoinsReward();
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });
    onClaimReward(mission.id);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--app-surface)',
          color: 'var(--app-text)',
          borderColor: 'var(--app-border)',
        }}
        className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-50 via-indigo-50 to-purple-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                المهام والمكافآت
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-600">أكمل مهامك واحصل على كوينز مجانية 🪙</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>المهام اليومية ({completedCount}/{missions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'weekly'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>الإحصائيات الأسبوعية 📊</span>
          </button>
        </div>

        {activeTab === 'daily' ? (
          <>
            {/* Progress Overview Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-700 font-bold flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  إنجاز اليوم:
                </span>
                <span className="text-amber-600 font-black">
                  {completedCount} من {missions.length} مكتملة
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${(completedCount / Math.max(1, missions.length)) * 100}%` }}
                />
              </div>
            </div>

            {/* Missions List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {missions.map((mission) => {
                const isReadyToClaim = mission.isCompleted && !mission.isClaimed;
                const progressPercent = Math.min(100, Math.round((mission.currentProgress / mission.targetProgress) * 100));

                return (
                  <div 
                    key={mission.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      mission.isClaimed
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : isReadyToClaim
                        ? 'bg-amber-50 border-amber-300 shadow-md'
                        : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0">
                        {mission.icon}
                      </div>

                      <div className="flex-1 text-right">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900">{mission.title}</h4>
                          <span className="text-[11px] font-black text-amber-600 flex items-center gap-0.5">
                            <Coins className="w-3 h-3" />
                            +{mission.rewardCoins}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 mt-0.5">{mission.description}</p>

                        {/* Progress Bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {mission.currentProgress}/{mission.targetProgress}
                          </span>
                        </div>
                      </div>

                      {/* Claim Button / Status */}
                      <div className="shrink-0">
                        {mission.isClaimed ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            تم الاستلام
                          </span>
                        ) : isReadyToClaim ? (
                          <button
                            onClick={() => handleClaim(mission)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1 animate-pulse cursor-pointer"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            استلام
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                            قيد الإنجاز
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* TAB 2: Weekly Completed Missions Statistics */
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* Aggregate Stats Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[10px] text-slate-600 block font-bold">مجموع كوينز الأسبوع</span>
                <span className="text-lg font-black text-amber-600 flex items-center justify-center gap-1 mt-0.5">
                  <Coins className="w-4 h-4" />
                  {totalWeeklyCoins.toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-500 mt-0.5 block">إحصائيات أسبوعية حية</span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
                <span className="text-[10px] text-slate-600 block font-bold">المهام المنجزة أسبوعياً</span>
                <span className="text-lg font-black text-indigo-700 flex items-center justify-center gap-1 mt-0.5">
                  <Trophy className="w-4 h-4 text-indigo-600" />
                  {totalWeeklyCompleted} مهمة
                </span>
                <span className="text-[9px] text-slate-500 mt-0.5 block">معدل {weeklyAverage} كوينز/يوم</span>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                سجل أيام الأسبوع الحالي:
              </h4>

              <div className="space-y-1.5">
                {weeklyDays.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <span className="font-bold text-slate-800">{d.day}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px]">{d.completed} مهام</span>
                      <span className="text-amber-600 font-bold text-[11px]">+{d.coins} 🪙</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-600">
          تتجدد المهام يومياً في تمام الساعة 12:00 منتصف الليل بتوقيت القاهرة 🇪🇬
        </div>

      </div>
    </div>
  );
};
