import React from 'react';

export type NavTab = 'home' | 'rooms' | 'chat' | 'games' | 'profile';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadChatsCount: number;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: string }> = [
  { id: 'home', label: 'الرئيسية', icon: '🏠' },
  { id: 'rooms', label: 'الغرف', icon: '💬' },
  { id: 'chat', label: 'محادثة خاصة', icon: '✉️' },
  { id: 'games', label: 'القطع والألعاب', icon: '🎮' },
  { id: 'profile', label: 'حسابي', icon: '👤' },
];

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  currentTab,
  onTabChange,
  unreadChatsCount,
}) => {
  return (
    <nav
      dir="rtl"
      lang="ar"
      className="fixed bottom-0 left-0 right-0 z-[50] w-full h-[60px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-1 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] dark:shadow-[0_-4px_24px_rgba(2,6,23,0.55)] flex items-center justify-between overflow-hidden transition-colors duration-300"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`relative flex-1 basis-0 min-w-0 h-full flex flex-col items-center justify-center gap-[2px] rounded-[12px] px-0.5 overflow-hidden cursor-pointer transition-colors ${
              isActive
                ? 'text-[#0066FF] bg-[#E6F0FF] dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-[#888888] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <span className="text-[20px] leading-none" aria-hidden="true">
                {item.icon}
              </span>
              {item.id === 'chat' && unreadChatsCount > 0 && (
                <span className="absolute -top-1 -left-2.5 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-sm tabular-nums leading-none">
                  {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
                </span>
              )}
            </div>
            <span className="text-[10.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-full leading-tight">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
