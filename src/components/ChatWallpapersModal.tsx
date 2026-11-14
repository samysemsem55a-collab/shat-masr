import React, { useState } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Check, 
  Sparkles, 
  Lock, 
  Coins, 
  CheckCircle2, 
  Palette,
  Eye
} from 'lucide-react';
import { User, ChatWallpaper } from '../types/chat';
import { CHAT_WALLPAPERS } from '../data/wallpapers';
import { sounds } from '../utils/soundEffects';
import { syncUserProfileToFirebase } from '../services/firebase';
import { isUserAdminOrOwner } from '../data/seedData';

interface ChatWallpapersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser?: (updatedUser: User) => void;
  onOpenWallet?: () => void;
}

export const ChatWallpapersModal: React.FC<ChatWallpapersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onOpenWallet
}) => {
  const [filter, setFilter] = useState<'all' | 'free' | 'premium' | 'unlocked'>('all');
  const [previewWallpaper, setPreviewWallpaper] = useState<ChatWallpaper | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOwner = isUserAdminOrOwner(currentUser);
  const activeWallpaperId = currentUser.chatWallpaper || 'wp_egypt_gold';
  const unlockedIds = new Set<string>([
    'wp_egypt_gold',
    'wp_egypt_sunset',
    'wp_doodle_arab',
    'wp_minimal_dark',
    ...(currentUser.unlockedWallpapers || [])
  ]);

  const handleApplyWallpaper = (wallpaper: ChatWallpaper) => {
    sounds.playMessageSent();
    const updatedUser: User = {
      ...currentUser,
      chatWallpaper: wallpaper.id
    };
    if (onUpdateUser) onUpdateUser(updatedUser);
    syncUserProfileToFirebase(updatedUser);
    localStorage.setItem('arab_chat_active_wallpaper', wallpaper.id);
  };

  const handlePurchaseAndApply = async (wallpaper: ChatWallpaper) => {
    if (!isOwner && currentUser.coins < wallpaper.priceCoins) {
      setNotice(`عفواً، رصيدك غير كافٍ! تحتاج إلى ${wallpaper.priceCoins - currentUser.coins} كوينز إضافية لشراء هذه الخلفية.`);
      return;
    }
    setNotice(null);

    setPurchasingId(wallpaper.id);
    sounds.playCoinsReward();

    const newCoins = isOwner ? currentUser.coins : Math.max(0, currentUser.coins - wallpaper.priceCoins);
    const updatedUnlocked = Array.from(new Set([...(currentUser.unlockedWallpapers || []), wallpaper.id]));
    
    const updatedUser: User = {
      ...currentUser,
      coins: newCoins,
      chatWallpaper: wallpaper.id,
      unlockedWallpapers: updatedUnlocked
    };

    if (onUpdateUser) onUpdateUser(updatedUser);
    await syncUserProfileToFirebase(updatedUser);
    localStorage.setItem('arab_chat_active_wallpaper', wallpaper.id);
    setPurchasingId(null);
  };

  const filteredWallpapers = CHAT_WALLPAPERS.filter((wp) => {
    const isUnlocked = isOwner || unlockedIds.has(wp.id);
    if (filter === 'free') return wp.priceCoins === 0;
    if (filter === 'premium') return wp.priceCoins > 0;
    if (filter === 'unlocked') return isUnlocked;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-2xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                متجر وخلفيات المحادثات المخصصة
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                اختر أو اشترِ أجمل الخلفيات العربية والمصرية لغرف الشات العامة
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Balance & Category Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
          
          {/* Filter Segmented Control */}
          <div className="flex items-center gap-1 text-[11px] font-bold overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({CHAT_WALLPAPERS.length})
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'free'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              المجانية 🎁
            </button>
            <button
              onClick={() => setFilter('premium')}
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'premium'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-amber-600 hover:text-amber-700'
              }`}
            >
              المميزة VIP 👑
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'unlocked'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-emerald-600 hover:text-emerald-700'
              }`}
            >
              المتاحة لدي ✅
            </button>
          </div>

          {/* User Coins Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">
              <span>🪙</span>
              <span>{currentUser.coins.toLocaleString()} كوينز</span>
            </div>
            <button
              onClick={() => {
                onClose();
                if (onOpenWallet) onOpenWallet();
              }}
              className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black shadow-sm transition active:scale-95"
            >
              شحن +
            </button>
          </div>

        </div>

        {/* Inline Notice */}
        {notice && (
          <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
            <span>{notice}</span>
            {onOpenWallet && (
              <button
                onClick={() => {
                  setNotice(null);
                  onClose();
                  onOpenWallet();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-black shrink-0"
              >
                شحن رصيد
              </button>
            )}
          </div>
        )}

        {/* Live Preview Banner if Selected */}
        {previewWallpaper && (
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                style={previewWallpaper.style} 
                className="w-14 h-12 rounded-xl border-2 border-indigo-400 shrink-0 shadow overflow-hidden relative"
              />
              <div className="min-w-0 text-right">
                <span className="text-[10px] text-indigo-600 font-bold block">معاينة مباشرة:</span>
                <h4 className="text-xs font-black text-slate-900 truncate">{previewWallpaper.name}</h4>
              </div>
            </div>

            <button
              onClick={() => setPreviewWallpaper(null)}
              className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 bg-white border border-slate-200 text-[10px] font-bold"
            >
              إغلاق المعاينة
            </button>
          </div>
        )}

        {/* Wallpapers Grid View */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredWallpapers.map((wallpaper) => {
            const isUnlocked = isOwner || unlockedIds.has(wallpaper.id);
            const isActive = activeWallpaperId === wallpaper.id;
            const isPurchasing = purchasingId === wallpaper.id;

            return (
              <div
                key={wallpaper.id}
                className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50/30 shadow-md'
                    : 'border-slate-200 bg-white hover:border-indigo-300 shadow-sm'
                }`}
              >
                {/* Visual Preview Box */}
                <div 
                  style={wallpaper.style} 
                  className="h-28 sm:h-32 w-full relative p-3 flex flex-col justify-between overflow-hidden"
                >
                  {/* Glass Mock Chat Bubbles Inside Preview Box */}
                  <div className="space-y-1.5 pointer-events-none opacity-90 select-none">
                    <div className="bg-white/90 backdrop-blur-xs border border-slate-200 text-[9.5px] text-slate-800 px-2.5 py-1 rounded-xl rounded-tl-none max-w-[70%] ml-auto shadow-sm">
                      أهلاً بكم في شات مصر والعرب ☕✨
                    </div>
                    <div className="bg-indigo-600/90 backdrop-blur-xs text-[9.5px] text-white px-2.5 py-1 rounded-xl rounded-tr-none max-w-[65%] mr-auto shadow-sm">
                      خلفية مميزة وتصميم راقٍ جداً 🌟
                    </div>
                  </div>

                  {/* Top Badges */}
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900/70 backdrop-blur-md text-amber-300 border border-white/20 flex items-center gap-1">
                      {wallpaper.thumbnail} {wallpaper.tag}
                    </span>

                    {isActive && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500 text-white shadow flex items-center gap-1">
                        <Check className="w-3 h-3" /> النشطة حالياً
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Action Controls */}
                <div className="p-3 space-y-2.5 bg-white text-right">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center justify-end gap-1.5">
                      <span>{wallpaper.name}</span>
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      {wallpaper.description}
                    </p>
                  </div>

                  {/* Buttons Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    
                    {/* Price Tag */}
                    <div className="text-right">
                      {wallpaper.priceCoins === 0 ? (
                        <span className="text-[11px] font-bold text-emerald-600">مجاناً 🎁</span>
                      ) : isUnlocked ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> متاح لديك
                        </span>
                      ) : (
                        <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                          🪙 {wallpaper.priceCoins} كوينز
                        </span>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-1.5">
                      {/* Live Preview Button */}
                      <button
                        onClick={() => setPreviewWallpaper(wallpaper)}
                        title="معاينة"
                        className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {isActive ? (
                        <button
                          disabled
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-default"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>مُفعلة</span>
                        </button>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleApplyWallpaper(wallpaper)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <span>تطبيق كخلفية</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchaseAndApply(wallpaper)}
                          disabled={isPurchasing}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <Coins className="w-3.5 h-3.5 fill-slate-950" />
                          <span>{isPurchasing ? 'جاري الشراء...' : `شراء وتفعيل (${wallpaper.priceCoins})`}</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
