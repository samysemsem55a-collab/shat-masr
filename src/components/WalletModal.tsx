import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  Wallet, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Gift, 
  Share2, 
  Check, 
  AlertCircle,
  Clock,
  QrCode,
  FileText,
  Hourglass
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { submitPaymentRequest, PendingPaymentOrder } from '../services/firebase';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUserBalance: (newCoins: number, newEarningsEgp: number) => void;
  currency: 'EGP' | 'USD' | 'SAR' | 'AED';
}

interface RechargePackage {
  coins: number;
  priceEgp: number;
  price: string;
  usd: string;
  badge: string;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'recharge' | 'my_orders' | 'free_coins'>('recharge');
  
  // Recharge Form State
  const [selectedPackage, setSelectedPackage] = useState<RechargePackage | null>(null);
  const paymentMethod = 'instapay' as const;
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderReference, setSenderReference] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Pending orders history
  const [myOrders, setMyOrders] = useState<PendingPaymentOrder[]>(() => {
    try {
      const saved = localStorage.getItem('arab_chat_payment_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<PendingPaymentOrder | null>(null);
  const [copiedInstapay, setCopiedInstapay] = useState<boolean>(false);
  const [copiedReferral, setCopiedReferral] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('arab_chat_payment_orders');
      if (saved) setMyOrders(JSON.parse(saved));
    } catch {}
  }, [activeTab]);

  if (!isOpen) return null;

  const INSTAPAY_ADDRESS = 'samyelsayed9@instapay';

  const rechargePackages: RechargePackage[] = [
    { coins: 1000, price: '50 ج.م', priceEgp: 50, usd: '$1.05', badge: 'باقة المبتدئ 💫' },
    { coins: 5000, price: '200 ج.م', priceEgp: 200, usd: '$4.20', badge: 'الأكثر طلباً 🔥' },
    { coins: 10000, price: '350 ج.م', priceEgp: 350, usd: '$7.35', badge: 'باقة التوفير الملكية 👑' },
    { coins: 25000, price: '800 ج.م', priceEgp: 800, usd: '$16.80', badge: 'باقة كبار الشخصيات VIP 💎' },
  ];

  const handleCopyInstaPay = () => {
    navigator.clipboard.writeText(INSTAPAY_ADDRESS);
    setCopiedInstapay(true);
    sounds.playMessageReceived();
    setTimeout(() => setCopiedInstapay(false), 2500);
  };

  const handleCopyReferral = () => {
    const link = `${window.location.origin}/?ref=${currentUser.id}`;
    navigator.clipboard.writeText(link);
    setCopiedReferral(true);
    sounds.playCoinsReward();
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  // Open Recharge Form for Selected Package
  const handleSelectPackage = (pkg: RechargePackage) => {
    sounds.playMessageReceived();
    setSelectedPackage(pkg);
    setFormError(null);
    setLastSubmittedOrder(null);
  };

  // Submit Payment Request (Strict Pending status - NO instant coin grant!)
  const handleSubmitPaymentRequest = async () => {
    if (!selectedPackage) return;
    setFormError(null);

    const cleanPhone = senderPhone.trim();
    const cleanName = senderName.trim();

    if (!cleanPhone) {
      setFormError('يرجى إدخال رقم الهاتف أو رقم المحفظة المحول منها.');
      return;
    }
    if (!cleanName) {
      setFormError('يرجى إدخال اسم صاحب الحساب أو المحفظة على إنستاباي / كاش.');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const orderData = {
        userId: currentUser.id,
        userName: currentUser.name,
        type: 'coins' as const,
        itemName: `${selectedPackage.coins.toLocaleString()} كوينز`,
        amountEgp: selectedPackage.priceEgp,
        coinsAmount: selectedPackage.coins,
        paymentMethod: paymentMethod,
        senderAccountOrPhone: cleanPhone,
        transactionRef: senderReference.trim() || undefined,
        note: `شحن كوينز: ${selectedPackage.coins.toLocaleString()} كوينز (${selectedPackage.priceEgp} ج.م) - المحول: ${cleanName} (${cleanPhone}) - وسيلة التحويل: InstaPay ${senderReference ? `- مرجع: ${senderReference}` : ''} ${transferNote ? `- ملاحظة: ${transferNote}` : ''}`
      };

      const result = await submitPaymentRequest(orderData);

      const submittedOrder: PendingPaymentOrder = {
        id: result.orderId,
        userId: currentUser.id,
        userName: currentUser.name,
        amount: selectedPackage.priceEgp,
        amountEgp: selectedPackage.priceEgp,
        coins: selectedPackage.coins,
        type: 'coins',
        itemName: `${selectedPackage.coins.toLocaleString()} كوينز`,
        paymentMethod: paymentMethod,
        senderAccountOrPhone: cleanPhone,
        transactionRef: senderReference.trim(),
        note: orderData.note,
        status: 'pending',
        timestamp: Date.now()
      };

      sounds.playCoinsReward();
      setLastSubmittedOrder(submittedOrder);
      setMyOrders(prev => [submittedOrder, ...prev]);
      setSelectedPackage(null);
      setSenderPhone('');
      setSenderName('');
      setSenderReference('');
      setTransferNote('');
    } catch (e) {
      console.warn("Payment request submission notice:", e);
      setFormError('حدث خطأ أثناء تسجيل الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0a0f1d] border border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Header Bar */}
        <div className="p-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <span>شحن الكوينز والمحفظة الرسمية</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-[11px] text-slate-300">
                التحويل المعتمد عبر InstaPay (مراجعة وتأكيد إداري) ⚡
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/80">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Current Coins Banner */}
        <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-purple-500/10 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <div>
              <span className="text-[11px] text-slate-400 block">رصيدك الحالي المعتمد:</span>
              <span className="text-base sm:text-lg font-black text-amber-400">
                {currentUser.coins.toLocaleString()} كوينز
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-amber-400 bg-amber-950/80 border border-amber-600/40 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>دفع يدوي آمن وموثق</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-900/90 border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => { setActiveTab('recharge'); setLastSubmittedOrder(null); }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recharge'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>طلب شحن</span>
          </button>

          <button
            onClick={() => setActiveTab('my_orders')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'my_orders'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>طلباتي ({myOrders.filter(o => o.status === 'pending').length} معلقة)</span>
          </button>

          <button
            onClick={() => { setActiveTab('free_coins'); setLastSubmittedOrder(null); }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'free_coins'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>كوينز مجاناً</span>
          </button>
        </div>

        {/* Tab 1: Recharge Form (Strict Pending Approval) */}
        {activeTab === 'recharge' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Success Notification If Just Submitted */}
            {lastSubmittedOrder && (
              <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/60 space-y-2 animate-in zoom-in-95">
                <div className="flex items-center gap-2 text-amber-300 font-black text-xs">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
                  <span>تم تسجيل طلب الشحن بنجاح وهو الآن (قيد المراجعة والمعاينة) ⏳</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  تم إرسال تفاصيل تحويل مبلغ <span className="text-white font-bold">{lastSubmittedOrder.amount} ج.م</span> لشحن <span className="text-amber-400 font-bold">{lastSubmittedOrder.coins?.toLocaleString()} كوينز</span> إلى إدارة المنصة.
                </p>
                <div className="p-2 rounded-xl bg-black/40 border border-amber-500/20 text-[10.5px] text-amber-200 space-y-1">
                  <div>📌 <strong>رقم الطلب:</strong> <span className="font-mono">{lastSubmittedOrder.id}</span></div>
                  <div>📱 <strong>الحساب المحول منه:</strong> {lastSubmittedOrder.senderAccountOrPhone}</div>
                  <div>⚡ <strong>الحالة:</strong> معلق قيد المراجعة (لن يتم إضافة الرصيد إلا بعد تأكيد استلام التحويل)</div>
                </div>
              </div>
            )}

            {/* Official Payment Account Card (InstaPay Only) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>عنوان التحويل الرسمي المعتمد للإدارة:</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  معتمد 100%
                </span>
              </div>

              {/* InstaPay Account */}
              <div className="space-y-1">
                <span className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                  <QrCode className="w-3 h-3" /> إنستاباي (InstaPay Egypt):
                </span>
                <div className="flex items-center justify-between bg-slate-950/90 border border-purple-500/50 rounded-xl overflow-hidden">
                  <div className="px-3 py-1.5 text-left" dir="ltr">
                    <span className="font-mono text-xs sm:text-sm font-black text-amber-400 select-all tracking-wide">
                      {INSTAPAY_ADDRESS}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyInstaPay}
                    className="m-1.5 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] flex items-center gap-1 shadow transition-all shrink-0"
                  >
                    {copiedInstapay ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedInstapay ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-slate-300 flex items-center gap-1.5 bg-black/40 p-2 rounded-lg border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>تم إلغاء رقم شحن المحفظة؛ يرجى التحويل عبر عنوان InstaPay أعلاه ثم اختيار باقتك وتسجيل تفاصيل التحويل.</span>
              </div>
            </div>

            {/* Packages Grid */}
            <div className="space-y-2">
              <label className="text-xs font-black text-white flex items-center justify-between">
                <span>اختر باقة الكوينز المطلوبة:</span>
                <span className="text-[10px] text-amber-400 font-normal">اضغط لتعبئة نموذج التحويل</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rechargePackages.map((pkg, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPackage(pkg)}
                    className={`cursor-pointer p-3 rounded-2xl border transition-all relative overflow-hidden group ${
                      selectedPackage?.coins === pkg.coins
                        ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/50'
                        : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        {pkg.badge}
                      </span>
                      <span className="text-[10px] text-slate-400">{pkg.usd}</span>
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xl">🪙</span>
                        <span className="text-base font-black text-white">
                          {pkg.coins.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400">كوينز</span>
                      </div>
                      <span className="text-sm font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                        {pkg.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Form Modal / Drawer if Package is Selected */}
            {selectedPackage && (
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-3 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>تسجيل طلب شحن: {selectedPackage.coins.toLocaleString()} كوينز ({selectedPackage.price})</span>
                  </div>
                  <button onClick={() => setSelectedPackage(null)} className="text-slate-400 hover:text-white p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Payment Method Badge */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-xs font-bold text-purple-200">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-purple-400" />
                    <span>وسيلة التحويل المعتمدة: InstaPay (إنستاباي)</span>
                  </span>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>

                {/* Form Inputs */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      رقم الهاتف أو رقم المحفظة المحول منها <span className="text-rose-400">*</span>:
                    </label>
                    <input
                      type="text"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="مثال: 010xxxxxxxx أو 011xxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      اسم صاحب الحساب أو المعرف على إنستاباي / المحفظة <span className="text-rose-400">*</span>:
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="اسمك المسجل في تطبيق البنك أو المحفظة"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      رقم العملية المرجعي أو كود التحويل (اختياري / مفضل):
                    </label>
                    <input
                      type="text"
                      value={senderReference}
                      onChange={(e) => setSenderReference(e.target.value)}
                      placeholder="كود العملية أو الرقم المرجعي للإيصال"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <div className="text-xs">
                    <span className="text-slate-400 block text-[10px]">المبلغ المطلوب تحويله:</span>
                    <span className="font-black text-amber-400 text-sm">{selectedPackage.price}</span>
                  </div>

                  <button
                    onClick={handleSubmitPaymentRequest}
                    disabled={isSubmittingOrder}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingOrder ? (
                      <span>جاري إرسال الطلب...</span>
                    ) : (
                      <>
                        <Hourglass className="w-3.5 h-3.5" />
                        <span>إرسال طلب الدفع للمراجعة (معلق)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Platform Financial Policy Notice */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>إشعار الأمان والتحقق المالي:</span>
              </div>
              <p>
                لا يتم شحن أي رصيد بشكل فوري أو تلقائي. تخضع جميع التحويلات لمراجعة وتأكيد يدوي من قبل إدارة شات مصر والعرب لضمان الأمان ومطابقة المبالغ المحولة مع سجلات البنك والمحافظ.
              </p>
            </div>

          </div>
        )}

        {/* Tab 2: User's Pending Orders */}
        {activeTab === 'my_orders' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Hourglass className="w-4 h-4 text-cyan-400" />
                <span>سجل طلبات الشحن الخاصة بك:</span>
              </h4>
              <span className="text-[10px] text-slate-400">تحديث لحظي</span>
            </div>

            {myOrders.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-bold">لا توجد طلبات شحن مسجلة حتى الآن</p>
                <p className="text-[11px] text-slate-500">عند إرسال أي طلب شحن ستتمكن من متابعة حالة اعتماده هنا</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      ord.status === 'pending'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : ord.status === 'approved'
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-red-950/20 border-red-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        {ord.amount} ج.م EGP
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ord.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          : ord.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {ord.status === 'pending' ? '⏳ قيد المراجعة المعلقة' : ord.status === 'approved' ? '✅ تم الاعتماد والإيداع' : '❌ تم الرفض'}
                      </span>
                    </div>

                    <div className="text-xs text-white font-bold">
                      {ord.itemName || `${ord.coins?.toLocaleString()} كوينز`}
                    </div>

                    <div className="text-[10.5px] text-slate-400 mt-1 flex flex-wrap gap-2">
                      <span>الوسيلة: {ord.paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'}</span>
                      {ord.senderAccountOrPhone && <span>• المحول: {ord.senderAccountOrPhone}</span>}
                      {ord.transactionRef && <span>• المرجع: {ord.transactionRef}</span>}
                    </div>

                    <div className="text-[9.5px] text-slate-500 font-mono mt-1">
                      {new Date(ord.timestamp).toLocaleString('ar-EG')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Free Coins via Interactions & Referrals */}
        {activeTab === 'free_coins' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Invite Friends Section */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/60 border border-indigo-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>دعوة الأصدقاء (+250 كوينز مجاناً)</span>
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  مكافأة فورية
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                شارك رابط دعوتك الخاص مع أصدقائك في واتساب ومواقع التواصل. عند انضمام أي صديق عبر رابطك، ستحصل تلقائياً على 250 كوينز مجانية تشجيعية!
              </p>

              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 p-2 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?ref=${currentUser.id}` : ''}
                </span>

                <button
                  onClick={handleCopyReferral}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow"
                >
                  {copiedReferral ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Daily Missions & Engagement Rewards */}
            <div className="space-y-2">
              <label className="text-xs font-black text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>مكافآت التفاعل اليومية المجانية:</span>
              </label>

              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <div>
                      <span className="text-xs font-bold text-white block">إرسال 5 رسائل في الغرف</span>
                      <span className="text-[10px] text-slate-400">مهمة يومية متجددة</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20">
                    +50 كوينز 🪙
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏱️</span>
                    <div>
                      <span className="text-xs font-bold text-white block">التواجد 10 دقائق في الشات</span>
                      <span className="text-[10px] text-slate-400">مكافأة الحضور والتفاعل</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20">
                    +100 كوينز 🪙
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎁</span>
                    <div>
                      <span className="text-xs font-bold text-white block">إهداء صديق في أي غرفة</span>
                      <span className="text-[10px] text-slate-400">مكافأة الكرم والود</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20">
                    +150 كوينز 🪙
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
