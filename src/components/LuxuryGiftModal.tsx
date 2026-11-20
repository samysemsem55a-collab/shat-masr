import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Send, 
  Crown, 
  Check, 
  AlertCircle,
  ArrowUpDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GiftItem, User, SpeakerSeat } from '../types/chat';
import { LUXURY_GIFTS, isUserAdminOrOwner } from '../data/seedData';
import { sounds } from '../utils/soundEffects';

interface LuxuryGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  speakers: SpeakerSeat[];
  roomUsers?: User[];
  onSendGift: (gift: GiftItem, recipientName: string, recipientId?: string) => void;
  onOpenWallet: () => void;
  preselectedRecipient?: User | null;
}

type GiftCategoryTab = 'all' | 'economy' | 'romantic' | 'royal' | 'interactive';
type GiftCostFilter = 'all' | 'budget' | 'mid' | 'vip';

const CATEGORY_TABS: { id: GiftCategoryTab; label: string; icon: string; activeClass: string }[] = [
  { id: 'all', label: 'الكل', icon: '✨', activeClass: 'bg-indigo-600 text-white shadow-sm' },
  { id: 'economy', label: 'اقتصادية', icon: '☕', activeClass: 'bg-emerald-600 text-white shadow-sm' },
  { id: 'romantic', label: 'رومانسية', icon: '💖', activeClass: 'bg-rose-500 text-white shadow-sm' },
  { id: 'royal', label: 'ملكية', icon: '👑', activeClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm' },
  { id: 'interactive', label: 'تفاعلية', icon: '🎆', activeClass: 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-sm' },
];

const COST_FILTERS: { id: GiftCostFilter; label: string }[] = [
  { id: 'all', label: 'كل الأسعار' },
  { id: 'budget', label: '≤ 300 🪙' },
  { id: 'mid', label: '350 - 1,200 🪙' },
  { id: 'vip', label: '2,500+ 🪙' },
];

export const LuxuryGiftModal: React.FC<LuxuryGiftModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  speakers,
  roomUsers = [],
  onSendGift,
  onOpenWallet,
  preselectedRecipient = null,
}) => {
  const [activeCategory, setActiveCategory] = useState<GiftCategoryTab>('all');
  const [costFilter, setCostFilter] = useState<GiftCostFilter>('all');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedGift, setSelectedGift] = useState<GiftItem>(LUXURY_GIFTS[0]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>(
    preselectedRecipient?.name ||
      speakers.find(s => s.user && s.user.id !== currentUser.id)?.user?.name ||
      'مضيف المجلس 👑'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmingSend, setConfirmingSend] = useState(false);

  const visibleGifts = useMemo(() => {
    const filtered = LUXURY_GIFTS.filter((g) => {
      if (activeCategory !== 'all') {
        if (activeCategory === 'interactive') {
          if (g.category !== 'interactive' && g.giftTag !== 'interactive') return false;
        } else if (g.giftTag !== activeCategory) {
          return false;
        }
      }

      if (costFilter === 'budget' && g.cost > 300) return false;
      if (costFilter === 'mid' && (g.cost < 350 || g.cost > 1200)) return false;
      if (costFilter === 'vip' && g.cost < 2500) return false;

      return true;
    });

    return [...filtered].sort((a, b) => (sortAsc ? a.cost - b.cost : b.cost - a.cost));
  }, [activeCategory, costFilter, sortAsc]);

  useEffect(() => {
    if (visibleGifts.length > 0 && !visibleGifts.some((g) => g.id === selectedGift.id)) {
      setSelectedGift(visibleGifts[0]);
    }
  }, [visibleGifts, selectedGift.id]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setConfirmingSend(false);
    if (preselectedRecipient?.name && preselectedRecipient.id !== currentUser.id) {
      setSelectedRecipient(preselectedRecipient.name);
    } else {
      setSelectedRecipient(
        speakers.find(s => s.user && s.user.id !== currentUser.id)?.user?.name || 'مضيف المجلس 👑'
      );
    }
  }, [isOpen, preselectedRecipient?.id, preselectedRecipient?.name, currentUser.id, speakers]);

  const isOwner = isUserAdminOrOwner(currentUser);
  const otherRoomUsers = roomUsers.filter(
    (u) => u && u.id !== currentUser.id && u.id !== 'system_bot'
  );
  const isPreselectedListed = Boolean(
    preselectedRecipient?.name &&
      (speakers.some(s => s.user && s.user.id !== currentUser.id && s.user.name === preselectedRecipient.name) ||
        otherRoomUsers.some(u => u.name === preselectedRecipient.name))
  );

  const handleRequestSend = () => {
    if (!isOwner && currentUser.coins < selectedGift.cost) {
      if (currentUser.coins < selectedGift.cost / 2) {
        window.dispatchEvent(
          new CustomEvent('shatmasr:gift_attempt', {
            detail: { cost: selectedGift.cost, name: selectedGift.name }
          })
        );
      }
      setErrorMsg(`رصيدك غير كافٍ! تحتاج إلى ${selectedGift.cost - currentUser.coins} كوينز إضافية.`);
      return;
    }
    setConfirmingSend(true);
  };

  const handleConfirmSend = () => {
    sounds.playGiftFanfare();

    // Trigger explosive celebratory confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const targetRecipientId =
      (preselectedRecipient?.name === selectedRecipient ? preselectedRecipient.id : undefined) ||
      otherRoomUsers.find((u) => u.name === selectedRecipient)?.id ||
      speakers.find((s) => s.user?.name === selectedRecipient)?.user?.id;

    setConfirmingSend(false);
    onSendGift(selectedGift, selectedRecipient, targetRecipientId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--app-surface)',
              color: 'var(--app-text)',
              borderColor: 'var(--app-border)',
            }}
            className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-pink-100 border border-pink-200 flex items-center justify-center text-xl">
                  🎁
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                    متجر الهدايا الفاخرة
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </h3>
                  <p className="text-xs text-slate-600">اختر الهدية المناسبة حسب النوع أو التكلفة</p>
                </div>
              </div>

              <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3.5 flex-1 overflow-y-auto min-h-0">
              {/* User Balance Strip */}
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 font-bold">رصيدك الحالي:</span>
                  <span className="text-amber-600 font-black text-sm flex items-center gap-1">
                    🪙 {currentUser.coins.toLocaleString()} كوينز
                  </span>
                </div>

                {isOwner ? (
                  <span className="px-3 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    <span>حساب المالك: هدايا مجانية</span>
                  </span>
                ) : (
                  <button
                    onClick={onOpenWallet}
                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    + شحن سريع
                  </button>
                )}
              </div>

              {/* Recipient Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  إهداء إلى:
                </label>
                <select
                  value={selectedRecipient}
                  onChange={(e) => {
                    setSelectedRecipient(e.target.value);
                    setConfirmingSend(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {preselectedRecipient?.name &&
                    preselectedRecipient.id !== currentUser.id &&
                    !isPreselectedListed && (
                      <option value={preselectedRecipient.name}>
                        🎁 {preselectedRecipient.name} ({preselectedRecipient.countryFlag || '🇪🇬'})
                      </option>
                    )}
                  <option value="مضيف المجلس 👑">مضيف المجلس 👑</option>
                  {otherRoomUsers.map((u) => (
                    <option key={`room_user_${u.id}`} value={u.name}>
                      👤 {u.name} ({u.countryFlag || '🇪🇬'})
                    </option>
                  ))}
                  {speakers
                    .filter(s => s.user && s.user.id !== currentUser.id && !otherRoomUsers.some(ru => ru.id === s.user!.id))
                    .map(s => (
                      <option key={s.seatId} value={s.user!.name}>
                        المقعد #{s.seatId}: {s.user!.name} ({s.user!.countryFlag})
                      </option>
                    ))}
                  <option value="كل المتحدثين على المنصة 🌟">كل المتحدثين على المنصة 🌟</option>
                </select>
              </div>

              {/* Type Category Tabs (5 Clear Categories) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none p-1 rounded-2xl bg-slate-100 border border-slate-200">
                  {CATEGORY_TABS.map((tab) => {
                    const isActive = activeCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveCategory(tab.id);
                          setErrorMsg(null);
                          setConfirmingSend(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11.5px] font-black flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                          isActive ? tab.activeClass : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cost Tier Filter & Sort Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {COST_FILTERS.map((cf) => {
                      const isActive = costFilter === cf.id;
                      return (
                        <button
                          key={cf.id}
                          type="button"
                          onClick={() => {
                            setCostFilter(cf.id);
                            setErrorMsg(null);
                            setConfirmingSend(false);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap border transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-100 border-amber-400 text-amber-900'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {cf.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSortAsc((prev) => !prev)}
                    className="px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10.5px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    title="تبديل ترتيب السعر"
                  >
                    <ArrowUpDown className="w-3 h-3 text-indigo-600" />
                    <span>{sortAsc ? 'الأرخص أولاً' : 'الأغلى أولاً'}</span>
                  </button>
                </div>
              </div>

              {/* Gifts Grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {activeCategory === 'interactive'
                      ? 'هدايا تفاعلية تملأ شاشة الغرفة للجميع:'
                      : 'اختر هديتك:'}
                  </label>
                  <span className="text-[10.5px] font-bold text-slate-500">
                    {visibleGifts.length} هدية
                  </span>
                </div>

                {visibleGifts.length === 0 ? (
                  <div className="py-6 px-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-600">
                      لا توجد هدايا تطابق هذا الفلتر حالياً.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('all');
                        setCostFilter('all');
                      }}
                      className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-[11px] font-black cursor-pointer"
                    >
                      عرض كل الهدايا
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {visibleGifts.map((gift) => {
                      const isSelected = selectedGift.id === gift.id;
                      return (
                        <button
                          key={gift.id}
                          type="button"
                          onClick={() => {
                            setSelectedGift(gift);
                            setErrorMsg(null);
                            setConfirmingSend(false);
                          }}
                          className={`relative p-3 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-2 border-amber-500 shadow-md scale-[1.03]'
                              : 'bg-slate-50 border border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {/* Top Cost Tag */}
                          <span className="absolute top-1.5 right-2 text-[10px] font-black text-amber-600 flex items-center gap-0.5 tabular-nums">
                            🪙 {gift.cost.toLocaleString()}
                          </span>

                          {gift.category === 'interactive' && (
                            <span className="absolute top-1.5 left-1.5 text-[8.5px] px-1.5 py-0.5 rounded-full bg-pink-100 border border-pink-200 text-pink-700 font-black">
                              ملء الشاشة
                            </span>
                          )}

                          {/* Gift Icon */}
                          <div className="text-3xl my-2">
                            {gift.icon}
                          </div>

                          {/* Gift Name */}
                          <span className="text-[11px] font-bold text-slate-900 text-center truncate w-full">
                            {gift.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Gift Banner Info */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-center space-y-1">
                <p className="text-xs font-black text-indigo-800">
                  « {selectedGift.bannerText} »
                </p>
                <p className="text-[11px] text-slate-600">
                  {selectedGift.category === 'interactive'
                    ? 'تُطلق رسوماً متحركة احتفالية تملأ شاشة الغرفة بالكامل أمام جميع المتواجدين!'
                    : 'سيظهر إشعار فخم على كامل شاشة الغرفة مع أنيميشن وتأثير صوتي ملكي'}
                </p>
              </div>

              {/* Error Message if not enough coins */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-rose-700">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    onClick={onOpenWallet}
                    className="underline font-bold text-amber-600 ml-2 cursor-pointer"
                  >
                    شحن الآن
                  </button>
                </div>
              )}
            </div>

            {/* Sticky Bottom Footer with 2-Step Confirmation */}
            <div className="sticky bottom-0 z-10 p-3.5 bg-white border-t border-slate-200 shrink-0">
              {confirmingSend ? (
                <div className="space-y-2 animate-in fade-in">
                  <p className="text-xs font-black text-center text-slate-800">
                    تأكيد إرسال {selectedGift.icon} <span className="text-indigo-600">{selectedGift.name}</span> إلى <span className="text-amber-600">{selectedRecipient}</span> مقابل {isOwner ? '0 (مجاني للمالك)' : `${selectedGift.cost.toLocaleString()} كوينز`}؟
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmSend}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>تأكيد الإرسال الآن</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingSend(false)}
                      className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                      تراجع
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestSend}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال هدية - {isOwner ? 'مجاني للمالك' : `${selectedGift.cost.toLocaleString()} كوينز`}</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

