import React, { useState } from 'react';
import { 
  Coins, 
  ArrowLeftRight, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles,
  ShieldCheck,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types/chat';
import { transferCoinsInDB } from '../services/firebase';
import { sounds } from '../utils/soundEffects';

interface CoinsTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  recipientUser: {
    id: string;
    name: string;
    avatar?: string;
    countryFlag?: string;
    role?: string;
    vipBadge?: string;
  };
  onSuccess: (amount: number, newBalance: number) => void;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export const CoinsTransferModal: React.FC<CoinsTransferModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  recipientUser,
  onSuccess
}) => {
  const [amount, setAmount] = useState<string>('100');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCoins = currentUser.coins || 0;
  const numAmount = parseInt(amount, 10) || 0;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (numAmount <= 0) {
      setErrorMessage('يرجى تحديد مبلغ كوينز صحيح لتحويله.');
      return;
    }

    if (currentCoins < numAmount) {
      setErrorMessage(`عفواً، رصيدك الحالي (${currentCoins.toLocaleString()} كوينز) غير كافٍ لتحويل (${numAmount.toLocaleString()} كوينز).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transferCoinsInDB(
        currentUser.id,
        recipientUser.id,
        numAmount,
        currentUser.name,
        recipientUser.name
      );

      if (!res.success) {
        setErrorMessage(res.error || 'فشلت عملية التحويل، يرجى المحاولة لاحقاً.');
        setIsSubmitting(false);
        return;
      }

      sounds.playCoinsReward();
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });

      setSuccessMessage(`تم تحويل ${numAmount.toLocaleString()} كوينز إلى ${recipientUser.name} بنجاح! 🪙`);
      const newBalance = res.newSenderBalance ?? (currentCoins - numAmount);
      
      setTimeout(() => {
        onSuccess(numAmount, newBalance);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in select-none" dir="rtl">
      <div className="relative w-full max-w-sm bg-white border-2 border-amber-300 rounded-3xl p-5 shadow-2xl text-right space-y-4">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-amber-600">
            <Coins className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black text-slate-900">تحويل كوينز فوري 🪙</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipient Profile Info */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400 bg-white flex items-center justify-center font-bold text-slate-700 text-xs">
              {recipientUser.avatar ? (
                <img src={recipientUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{recipientUser.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                <span>{recipientUser.name}</span>
                <span>{recipientUser.countryFlag || '🇪🇬'}</span>
              </div>
              <span className="text-[10px] text-indigo-600 font-bold">المستلم المعتمد للكوينز</span>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-amber-700 text-[10px] font-black shadow-sm">
            فوري وآمن ⚡
          </div>
        </div>

        {/* Current Balance Bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="text-slate-600">رصيدك المتاح حالياً:</span>
          <span className="font-black text-amber-700 flex items-center gap-1">
            <span>{currentCoins.toLocaleString()}</span>
            <span>🪙 كوينز</span>
          </span>
        </div>

        {/* Amount Input Form */}
        <form onSubmit={handleTransfer} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              حدد عدد الكوينز المراد تحويلها:
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={currentCoins}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل عدد الكوينز..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 rounded-2xl px-4 py-2.5 text-slate-900 font-black text-sm text-center focus:outline-none transition"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-amber-500 font-bold">
                🪙
              </span>
            </div>
          </div>

          {/* Quick Select Preset Buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {PRESET_AMOUNTS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset.toString())}
                className={`py-1.5 rounded-xl border text-[11px] font-bold transition active:scale-95 ${
                  numAmount === preset
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                }`}
              >
                +{preset.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Error & Success Messages */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Transfer Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || numAmount <= 0 || numAmount > currentCoins}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer mt-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري التحويل الآمن...' : `تأكيد تحويل ${numAmount.toLocaleString()} كوينز الآن 🚀`}</span>
          </button>
        </form>

      </div>
    </div>
  );
};
