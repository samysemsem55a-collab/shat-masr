import React from 'react';
import { 
  MessageCircle, 
  Compass, 
  Gamepad2, 
  User as UserIcon,
  Sparkles
} from 'lucide-react';

export type NavTab = 'rooms' | 'chat' | 'games' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadChatsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  unreadChatsCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-1.5 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
      <div className="max-w-md mx-auto flex items-center justify-around">
        
        {/* Rooms / المجلس */}
        <button
          onClick={() => onTabChange('rooms')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            currentTab === 'rooms'
              ? 'text-indigo-600 font-black bg-indigo-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
            {currentTab === 'rooms' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600"></span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-0.5 leading-tight">معاينة الغرف</span>
        </button>

        {/* Private Chat / محادثة */}
        <button
          onClick={() => onTabChange('chat')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            currentTab === 'chat'
              ? 'text-indigo-600 font-black bg-indigo-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.1 rounded-full min-w-[14px] text-center shadow-sm">
                {unreadChatsCount}
              </span>
            )}
            {currentTab === 'chat' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600"></span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-0.5 leading-tight">محادثة خاصة</span>
        </button>

        {/* Games & Cultural Quizzes / القطع الأثرية والمسابقات */}
        <button
          onClick={() => onTabChange('games')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            currentTab === 'games'
              ? 'text-purple-600 font-black bg-purple-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <Sparkles className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-1 animate-pulse" />
            {currentTab === 'games' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-600"></span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-0.5 leading-tight">القطع والألعاب</span>
        </button>

      </div>
    </nav>
  );
};
