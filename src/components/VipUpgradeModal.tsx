import React, { useState } from 'react';
import {
  X,
  Crown,
  Sparkles,
  Check,
  QrCode,
  Wallet,
  Copy,
  ShieldCheck,
  AlertCircle,
  Clock,
  Hourglass,
  ArrowRight
} from 'lucide-react';
import { User, VipTier } from '../types/chat';
import { VIP_TIERS, isUserAdminOrOwner } from '../data/seedData';
import { sounds } from '../utils/soundEffects';
import { submitPaymentRequest } from '../services/firebase';
import { maskPhone } from '../utils/maskData';
import { formatArabicDate, getVipDurationInfo } from '../utils/dateFormat';

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
  const [selectedTier, setSelectedTier] = useState<VipTier>(VIP_TIERS[2]);
  const [step, setStep] = useState<'select' | 'payment_form' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'instapay' | 'vodafone_cash'>('instapay');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [copiedInstapay, setCopiedInstapay] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  if (!isOpen || isUserAdminOrOwner(currentUser)) return null;

  const INSTAPAY_ADDRESS = 'samyelsayed9@instapay';
  const WALLET_NUMBER = '01098750740';
  const vipInfo = getVipDurationInfo(currentUser);

  const handleStartPayment = (tier: VipTier) => {
    setSelectedTier(tier);
    setFormError(null);
    setStep('payment_form');
  };

  const handleSubmitVipRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanedAccount = senderPhone.trim();
    const cleanedName = senderName.trim();
    if (!cleanedAccount) {
      setFormError('يرجى إدخال رقم المحفظة أو الحساب المُحَوّل منه');
      return;
    }

    setIsSubmitting(true);
    try {
      const methodLabel = paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية';
      const res = await submitPaymentRequest({
        userId: currentUser.id,
        userName: currentUser.name || 'عضو شات مصر',
        type: 'vip',
        itemName: selectedTier.name,
        vipTierId: selectedTier.id,
        amountEgp: selectedTier.priceEgp,
        paymentMethod,
        senderAccountOrPhone: cleanedAccount,
        ...(cleanedName ? { senderName: cleanedName } : {}),
        note: `طلب ترقية عضوية (${selectedTier.durationDays || 30} يوم) إلى ${selectedTier.name} عبر ${methodLabel} من ${cleanedAccount}${cleanedName ? ` (${cleanedName})` : ''}`
      });

      if (res.duplicate) {
        setFormError('تم تسجيل هذا الطلب للتو، يرجى الانتظار قليلاً.');
        return;
      }

      sounds.playCoinsReward();
      setSubmittedOrderId(res.orderId);
      setStep('success');
    } catch (err) {
      console.error('VIP request submission error:', err);
      setFormError('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مجدداً أو التحقق من الاتصال.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-[#1E293B]"
      >
        {/* Modal Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0 shadow-2xs">
              <Crown className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#1E293B] flex items-center gap-1.5">
                <span>ترقية الرتب وعضويات VIP</span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </h3>
              <p className="text-xs text-slate-500 font-medium">دفع فوري عبر InstaPay أو المحفظة الإلكترونية 🛡️</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full text-slate-500 hover:text-[#1E293B] bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-[#F8FAFC]">
          {/* User's current rank & active VIP duration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 text-xs shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-bold">رتبتك الحالية:</span>
              <span className="font-black text-purple-700 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200">
                <Crown className="w-3.5 h-3.5 text-purple-600" />
                <span>{currentUser.vipBadge || 'عضو نشط'}</span>
              </span>
            </div>
            {vipInfo.isVipTier && !vipInfo.isPermanent && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                <span className="text-emerald-700 font-black">{vipInfo.remainingLabel}</span>
                {vipInfo.expiresAt && (
                  <span className="text-slate-500 font-bold">تنتهي في: {formatArabicDate(vipInfo.expiresAt)}</span>
                )}
              </div>
            )}
          </div>

          {/* STEP 1: SELECT TIER */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-black text-[#1E293B]">نظام الترقية السريع والآمن (لمدة 30 يوماً)</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    اختر الباقة المناسبة ثم حوّل عبر InstaPay أو المحفظة الإلكترونية ({WALLET_NUMBER}) وأدخل رقم حسابك ليتم تفعيل الترقية فوراً بعد المراجعة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {VIP_TIERS.map((tier) => {
                  const isSelected = selectedTier.id === tier.id;
                  const isDiamond = tier.id === 'vip_diamond';
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition-all bg-white ${
                        isSelected
                          ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                          : 'border-slate-200 hover:border-emerald-400 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-black bg-purple-50 border border-purple-200 text-purple-700">
                          {tier.badge}
                        </span>
                        <span className="text-xs font-black text-emerald-700">
                          {tier.priceEgp} ج.م <span className="text-[10px] text-slate-400 font-bold">({tier.priceUsd}$)</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-[#1E293B]">{tier.name}</h4>
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          مدة العضوية: {tier.durationDays || 30} يوماً
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3 mt-0.5">{tier.tagline}</p>

                      <ul className="space-y-1.5 mb-4">
                        {tier.perks.map((perk, pIdx) => (
                          <li key={pIdx} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
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
                        className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all text-white cursor-pointer ${
                          isDiamond
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>ترقية إلى {tier.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: SIMPLIFIED PAYMENT FORM (InstaPay + Wallet 01098750740) */}
          {step === 'payment_form' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1E293B] transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>الرجوع لاختيار الباقة</span>
              </button>

              {/* Selected Tier Summary */}
              <div className="p-3.5 rounded-2xl bg-white border border-purple-200 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10.5px] text-purple-600 font-bold block">الباقة المختارة:</span>
                  <span className="text-sm font-black text-[#1E293B]">{selectedTier.name} ({selectedTier.badge})</span>
                  <span className="text-[10.5px] text-indigo-700 font-bold block mt-0.5">
                    المدة: {selectedTier.durationDays || 30} يوماً من التفعيل
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-base font-black text-emerald-700">{selectedTier.priceEgp} ج.م</span>
                  <span className="text-[10px] text-slate-400 block">({selectedTier.priceUsd}$)</span>
                </div>
              </div>

              {/* Official Transfer Accounts (InstaPay & Wallet) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#1E293B]">
                  <QrCode className="w-4 h-4 text-purple-600" />
                  <span>حسابات التحويل الرسمية (اختر أي وسيلة)</span>
                </div>

                {/* InstaPay */}
                <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <span className="text-[10px] text-purple-700 block font-bold">إنستاباي (InstaPay):</span>
                    <span className="text-xs sm:text-sm font-mono font-black text-purple-700 select-all break-all" dir="ltr">
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
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1 shrink-0 shadow-xs active:scale-95 transition cursor-pointer"
                  >
                    {copiedInstapay ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInstapay ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>

                {/* Wallet Number */}
                <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-rose-200">
                  <div className="min-w-0">
                    <span className="text-[10px] text-rose-700 font-bold flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> محفظة إلكترونية (فودافون / اتصالات / أورنج كاش):
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-black text-rose-700 select-all break-all" dir="ltr">
                      {WALLET_NUMBER}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(WALLET_NUMBER);
                      setCopiedWallet(true);
                      setTimeout(() => setCopiedWallet(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1 shrink-0 shadow-xs active:scale-95 transition cursor-pointer"
                  >
                    {copiedWallet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWallet ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>

              {/* Payment Confirmation Form */}
              <form onSubmit={handleSubmitVipRequest} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('instapay')}
                    className={`py-2 px-2 rounded-xl border transition cursor-pointer ${
                      paymentMethod === 'instapay'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50 text-purple-900 border-purple-200'
                    }`}
                  >
                    InstaPay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('vodafone_cash')}
                    className={`py-2 px-2 rounded-xl border transition cursor-pointer ${
                      paymentMethod === 'vodafone_cash'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    محفظة إلكترونية
                  </button>
                </div>

                <div>
                  <label className="text-xs font-black text-[#1E293B] block mb-1.5">
                    رقم الهاتف / الحساب المُحَوّل منه <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 01012345678 أو معرف InstaPay"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#1E293B] text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    اسم المحوّل (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="اكتب اسمك إذا رغبت (اختياري)"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#1E293B] text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !senderPhone.trim()}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال طلب الترقية...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>تأكيد وإرسال طلب الترقية</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: SUCCESS / PENDING STATUS */}
          {step === 'success' && (
            <div className="p-6 text-center space-y-4 bg-white border border-slate-200 rounded-2xl shadow-2xs animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-600">
                <Hourglass className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h4 className="text-base font-black text-[#1E293B]">
                  تم تسجيل طلب ترقية {selectedTier.name} بنجاح!
                </h4>
                <p className="text-xs text-emerald-700 font-bold mt-1">
                  حالة الطلب: قيد المراجعة والتدقيق ⏳
                </p>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
                  رقم الطلب <span className="text-[#1E293B] font-mono font-bold">#{submittedOrderId}</span>. سيتم تفعيل رتبتك لمدة {selectedTier.durationDays || 30} يوماً فور التحقق من التحويل.
                </p>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl max-w-sm mx-auto text-right text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>المبلغ المطلوب:</span>
                  <span className="text-[#1E293B] font-black">{selectedTier.priceEgp} ج.م</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>وسيلة الدفع:</span>
                  <span className="text-purple-700 font-black">
                    {paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>الحساب المحوّل منه:</span>
                  <span className="text-[#1E293B] font-mono font-bold">{maskPhone(senderPhone)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer"
              >
                حسناً، إغلاق
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

