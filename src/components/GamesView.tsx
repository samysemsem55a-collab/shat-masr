import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  ChevronRight,
  Flame,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, TriviaQuestion, LeaderboardEntry } from '../types/chat';
import { TRIVIA_QUESTIONS, LEADERBOARD_USERS } from '../data/seedData';
import { sounds } from '../utils/soundEffects';

interface GamesViewProps {
  currentUser: User;
  onUpdateCoins: (newCoins: number) => void;
  onOpenWallet: () => void;
}

export const GamesView: React.FC<GamesViewProps> = ({
  currentUser,
  onUpdateCoins,
  onOpenWallet,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'trivia' | 'leaderboard'>('trivia');

  // Trivia State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [scoreStreak, setScoreStreak] = useState(0);
  const [totalTriviaPoints, setTotalTriviaPoints] = useState(0);

  const question = TRIVIA_QUESTIONS[currentQuestionIndex];

  // Question Timer
  useEffect(() => {
    if (activeSubTab !== 'trivia' || hasAnswered) return;

    if (timerSeconds <= 0) {
      setHasAnswered(true);
      setScoreStreak(0);
      return;
    }

    const timer = setInterval(() => {
      setTimerSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerSeconds, activeSubTab, hasAnswered]);

  const handleSelectAnswer = (optionIdx: number) => {
    if (hasAnswered) return;
    setSelectedOption(optionIdx);
    setHasAnswered(true);

    const isCorrect = optionIdx === question.correctIndex;
    if (isCorrect) {
      sounds.playCoinsReward();
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
      // Strictly 10 coins reward for contest participation/correct answer
      const reward = 10;
      onUpdateCoins(currentUser.coins + reward);
      setScoreStreak(prev => prev + 1);
      setTotalTriviaPoints(prev => prev + reward);
    } else {
      sounds.playMessageSent();
      setScoreStreak(0);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setHasAnswered(false);
    setTimerSeconds(15);
    setCurrentQuestionIndex((prev) => (prev + 1) % TRIVIA_QUESTIONS.length);
  };

  return (
    <div className="pb-24 pt-3 px-3 sm:px-4 max-w-4xl mx-auto space-y-3.5">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            المسابقات الثقافية ولوحة الصدارة
            <Gamepad2 className="w-5 h-5 text-purple-600" />
          </h1>
          <p className="text-xs text-slate-500">
            تحديات، أسئلة ذكاء وسرعة، وجوائز كوينز كاش مباشرة
          </p>
        </div>

        <button
          onClick={onOpenWallet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-black transition"
        >
          <Coins className="w-3.5 h-3.5 text-amber-600" />
          <span>{currentUser.coins.toLocaleString()} 🪙</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('trivia')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'trivia'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>المسابقة الثقافية والجوائز</span>
        </button>

        <button
          onClick={() => setActiveSubTab('leaderboard')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>لوحة الصدارة العالمية</span>
        </button>
      </div>

      {/* 1. Cultural Trivia Quiz Engine */}
      {activeSubTab === 'trivia' && (
        <div className="space-y-3.5">
          
          {/* Top Status Card */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">سلسلة الفوز 🔥</span>
              <span className="font-black text-amber-600 text-sm sm:text-base">{scoreStreak} متتالية</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">الوقت المتبقي ⏳</span>
              <span className={`font-black text-sm sm:text-base ${timerSeconds <= 5 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                0:{timerSeconds < 10 ? '0' : ''}{timerSeconds}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">جائزة السؤال 🪙</span>
              <span className="font-black text-purple-600 text-sm sm:text-base">+{question.coinsReward} كوينز</span>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
            
            <div className="flex items-center justify-between text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                {question.category}
              </span>
              <span className="text-slate-500 text-[11px]">
                سؤال رقم {currentQuestionIndex + 1} من {TRIVIA_QUESTIONS.length}
              </span>
            </div>

            <h2 className="text-sm sm:text-base font-black text-slate-900 leading-relaxed">
              {question.question}
            </h2>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {question.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === question.correctIndex;
                let btnStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/40';

                if (hasAnswered) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm font-black';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-50 border-rose-400 text-rose-800 font-black';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={hasAnswered}
                    onClick={() => handleSelectAnswer(idx)}
                    className={`p-3 rounded-2xl border text-right text-xs sm:text-sm font-bold flex items-center justify-between transition-all ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {hasAnswered && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {hasAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Answer feedback & Explanation */}
            {hasAnswered && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-black">
                  {selectedOption === question.correctIndex ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> أحسنت! إجابة صحيحة (+{question.coinsReward} كوينز)
                    </span>
                  ) : (
                    <span className="text-rose-700 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> للأسف إجابة خاطئة! حظ أوفر في السؤال القادم
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700">
                  💡 {question.explanation}
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                  >
                    <span>السؤال التالي</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* 2. Global Leaderboard */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs shadow-sm">
            <span className="font-bold text-slate-800">لوحة الشرف وتصنيف المتصدرين في شات مصر والعرب</span>
            <span className="text-amber-700 font-black">تحديث مباشر</span>
          </div>

          <div className="space-y-1.5">
            {LEADERBOARD_USERS.map((user) => (
              <div
                key={user.id}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all shadow-sm ${
                  user.rank === 1
                    ? 'bg-gradient-to-r from-amber-50 to-white border-amber-300'
                    : user.rank === 2
                    ? 'bg-gradient-to-r from-slate-50 to-white border-slate-300'
                    : user.rank === 3
                    ? 'bg-gradient-to-r from-orange-50 to-white border-orange-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-slate-700">
                    {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                  </div>

                  <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1">
                      {user.name}
                    </h4>
                    <span className="text-[9.5px] text-amber-700 font-bold">
                      {user.badge}
                    </span>
                  </div>
                </div>

                <div className="text-left text-xs">
                  <span className="text-emerald-600 font-black block text-xs">
                    {user.points.toLocaleString()} نقطة
                  </span>
                  <span className="text-[9.5px] text-slate-500">
                    {user.giftsCount} هدية مرسلة 🎁
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
