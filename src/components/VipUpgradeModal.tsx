import React, { useState } from 'react';
import { 
  X, 
  Crown, 
  Sparkles, 
  Check, 
  QrCode,
  Copy,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Hourglass,
  ArrowRight
} from 'lucide-react';
import { User, VipTier } from '../types/chat';
import { VIP_TIERS } from '../data/seedData';
import { sounds } from '../utils/soundEffects';
import { submitPaymentRequest, PendingPaymentOrder } from '../services/firebase';

interface VipUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpgradeTier?: (tier: VipTier) => void;
  onOpenWallet?: () => void;
}

export const VipUpgradeModal: React.FC<VipUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [selectedTier, setSelectedTier] = useState<VipTier>(VIP_TIERS[2]); // Default VIP Gold
  const [step, setStep] = useState<'select' | 'payment_form' | 'success'>('select');
  const paymentMethod = 'instapay' as const;
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderReference, setSenderReference] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);

  const [copiedInstapay, setCopiedInstapay] = useState(false);

  if (!isOpen) return null;

  const INSTAPAY_ADDRESS = 'samyelsayed9@instapay';

  const handleStartPayment = (tier: VipTier) => {
    setSelectedTier(tier);
    setFormError(null);
    setStep('payment_form');
  };

  const handleSubmitVipRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!senderPhone.trim()) {
      setFormError('يرجى إدخال رقم المحفظة أو الحساب المحوّل منه');
      return;
    }
    if (!senderName.trim()) {
      setFormError('يرجى إدخال اسم صاحب الحساب أو المحفظة');
      return;
    }
    if (!senderReference.trim()) {
      setFormError('يرجى إدخال كود العملية أو الرقم المرجعي للتحويل');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPaymentRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        type: 'vip',
        itemName: selectedTier.name,
        vipTierId: selectedTier.id,
        amountEgp: selectedTier.priceEgp,
        paymentMethod: paymentMethod,
        senderAccountOrPhone: senderPhone.trim(),
        transactionRef: senderReference.trim(),
        note: transferNote.trim() || `طلب ترقية عضوية إلى ${selectedTier.name} (${selectedTier.badge})`
      });

      sounds.playCoinsReward();
      setSubmittedOrderId(res.orderId);
      setStep('success');
    } catch (err: any) {
      console.error("VIP request submission error:", err);
      setFormError('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مجدداً أو التحقق من الاتصال.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-2xl bg-[#0e1626] border border-amber-500/50 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-amber-950/70 via-purple-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Crown className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                ترقية الرتب وعضويات VIP الملكية
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-300">مراجعة وتدقيق معتمد عبر InstaPay 🛡️</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* User's current rank */}
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-xs">
            <span className="text-slate-400">رتبتك الحالية:</span>
            <span className="font-black text-amber-400 flex items-center gap-1">
              <Crown className="w-4 h-4" /> {currentUser.vipBadge || 'عضو مميز'}
            </span>
          </div>

          {/* STEP 1: SELECT TIER */}
          {step === 'select' && (
            <div className="space-y-4">
              {/* Payment Info Banner */}
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 text-indigo-200 text-xs flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-white">نظام الترقية اليدوي الآمن (قيد المراجعة والتدقيق)</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    اختر الباقة المطلوبة ثم قم بإرسال طلب التحويل عبر إنستاباي أو المحافظ الإلكترونية. سيتم تفعيل الترقية ومميزاتها فور تأكيد عملية الدفع من قبل الإدارة.
                  </p>
                </div>
              </div>

              {/* Tiers Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {VIP_TIERS.map((tier) => {
                  const isSelected = selectedTier.id === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-900/90 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.01]'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border ${tier.badgeBg}`}>
                          {tier.badge}
                        </span>
                        <span className="text-xs font-black text-white">
                          {tier.priceEgp} ج.م <span className="text-[10px] text-slate-400">({tier.priceUsd}$)</span>
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-white">{tier.name}</h4>
                      <p className="text-[11px] text-slate-400 mb-3">{tier.tagline}</p>

                      {/* Perks List */}
                      <ul className="space-y-1.5 mb-4">
                        {tier.perks.map((perk, pIdx) => (
                          <li key={pIdx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartPayment(tier);
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all ${
                          tier.id === 'vip_diamond'
                            ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white'
                            : tier.id === 'vip_gold'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>طلب ترقية إلى {tier.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: PAYMENT FORM (InstaPay & E-Wallets) */}
          {step === 'payment_form' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                <span>الرجوع لاختيار الباقة</span>
              </button>

              {/* Selected Tier Summary */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold block">الباقة المختارة:</span>
                  <span className="text-sm font-black text-white">{selectedTier.name} ({selectedTier.badge})</span>
                </div>
                <div className="text-left">
                  <span className="text-base font-black text-amber-400">{selectedTier.priceEgp} ج.م</span>
                  <span className="text-[10px] text-slate-400 block">({selectedTier.priceUsd}$)</span>
                </div>
              </div>

              {/* Payment Method (InstaPay Only) */}
              <div className="p-3 rounded-2xl bg-purple-950/50 border border-purple-500/60 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-purple-400" />
                    إنستاباي (InstaPay)
                  </span>
                  <span className="text-[10px] text-purple-300">تحويل فوري بدون رسوم — الوسيلة المعتمدة حالياً</span>
                </div>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>

              {/* Transfer Details Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                <span className="text-xs font-bold text-amber-300 block">
                  بيانات حساب التحويل الرسمي للإدارة:
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-purple-500/40">
                    <div>
                      <span className="text-[10px] text-slate-400 block">عنوان الدفع اللحظي (IPA):</span>
                      <span className="text-xs sm:text-sm font-mono font-black text-purple-300 select-all">
                        {INSTAPAY_ADDRESS}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(INSTAPAY_ADDRESS);
                        setCopiedInstapay(true);
                        setTimeout(() => setCopiedInstapay(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedInstapay ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Input fields */}
              <form onSubmit={handleSubmitVipRequest} className="space-y-3">
                {formError && (
                  <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      رقم المحفظة / الحساب المحوّل منه <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 01012345678 أو IPA"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      اسم صاحب الحساب أو المحفظة <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="الاسم المسجل في التحويل"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    كود العملية أو الرقم المرجعي للتحويل (Reference No) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="رقم العملية من تطبيق InstaPay أو رسالة تأكيد المحفظة"
                    value={senderReference}
                    onChange={(e) => setSenderReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    ملاحظات إضافية أو تفاصيل الإيصال (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: تم التحويل الساعة 5:30 م"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>جاري تسجيل طلب الترقية وإرساله للمراجعة...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-slate-950" />
                        <span>تأكيد وإرسال طلب الترقية للمراجعة (معلق - Pending)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-2">
                    🔒 لا يتم الخصم أو التفعيل الفوري. تتم مراجعة التحويل واعتماد الترقية يدوياً لضمان الأمان.
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: SUCCESS / PENDING STATUS */}
          {step === 'success' && (
            <div className="p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-400">
                <Hourglass className="w-8 h-8 animate-pulse text-amber-400" />
              </div>

              <div>
                <h4 className="text-base font-black text-white">
                  تم تسجيل طلب ترقية {selectedTier.name} بنجاح!
                </h4>
                <p className="text-xs text-amber-300 font-bold mt-1">
                  حالة الطلب: قيد المراجعة والتدقيق (Pending) ⏳
                </p>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-md mx-auto">
                  تم إرسال تفاصيل التحويل لإدارة المنصة برقم مرجعي <span className="text-white font-mono font-bold">#{senderReference}</span> (طلب {submittedOrderId}). 
                  سيتم تفعيل رتبتك الملكية وإضافة شارة الـ VIP فور مراجعة العملية.
                </p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl max-w-sm mx-auto text-right text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>المبلغ المطلوب:</span>
                  <span className="text-white font-bold">{selectedTier.priceEgp} ج.م</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>وسيلة الدفع:</span>
                  <span className="text-purple-300 font-bold">InstaPay</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>الحساب المحول منه:</span>
                  <span className="text-slate-200 font-mono">{senderPhone}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                حسناً، فهمت
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
