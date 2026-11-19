import React from 'react';
import { Home, MessageSquare, Gamepad2 } from 'lucide-react';

export type NavTab = 'home' | 'chat' | 'games' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: 'home' | 'chat' | 'games') => void;
  unreadChatsCount: number;
}

const NAV_ITEMS: Array<{
  id: 'home' | 'chat' | 'games';
  label: string;
  Icon: React.FC<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'home', label: 'الرئيسية', Icon: Home },
  { id: 'chat', label: 'محادثة خاصة', Icon: MessageSquare },
  { id: 'games', label: 'القطع والألعاب', Icon: Gamepad2 },
];

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  currentTab,
  onTabChange,
  unreadChatsCount,
}) => {
  const effectiveTab = currentTab === 'profile' ? 'home' : currentTab;

  return (
    <nav
      dir="rtl"
      lang="ar"
      className="fixed bottom-0 left-0 right-0 z-[50] w-full h-[56px] bg-white dark:bg-slate-900 border-t border-[#EEEEEE] dark:border-slate-800 pt-[6px] pb-[4px] px-2 flex items-center justify-around overflow-hidden transition-colors duration-300"
    >
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = effectiveTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`relative flex-1 basis-0 min-w-0 h-full flex flex-col items-center justify-center gap-[2px] rounded-[12px] px-1 overflow-hidden cursor-pointer transition-colors ${
              isActive
                ? 'text-[#0066FF] bg-[#E6F0FF] dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-[#888888] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
              {id === 'chat' && unreadChatsCount > 0 && (
                <span className="absolute -top-1 -left-2.5 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-sm tabular-nums leading-none">
                  {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold whitespace-nowrap leading-tight">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
