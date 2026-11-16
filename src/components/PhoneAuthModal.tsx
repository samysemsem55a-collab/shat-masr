import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Info,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { 
  setupPhoneRecaptcha, 
  sendFirebasePhoneOtp, 
  verifyFirebasePhoneOtp,
  signInWithGoogle
} from '../services/firebase';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserVerified: (updatedUser: User) => void;
}

const COUNTRY_CODES = [
  { name: 'مصر', code: '+20', flag: '🇪🇬', sample: '01012345678' },
  { name: 'السعودية', code: '+966', flag: '🇸🇦', sample: '0501234567' },
  { name: 'الإمارات', code: '+971', flag: '🇦🇪', sample: '0501234567' },
  { name: 'الكويت', code: '+965', flag: '🇰🇼', sample: '50123456' },
  { name: 'المغرب', code: '+212', flag: '🇲🇦', sample: '0612345678' },
  { name: 'الجزائر', code: '+213', flag: '🇩🇿', sample: '0512345678' },
  { name: 'العراق', code: '+964', flag: '🇮🇶', sample: '07701234567' },
  { name: 'الأردن', code: '+962', flag: '🇯🇴', sample: '0791234567' },
  { name: 'قطر', code: '+974', flag: '🇶🇦', sample: '55123456' },
  { name: 'عمان', code: '+968', flag: '🇴🇲', sample: '91234567' },
  { name: 'تونس', code: '+216', flag: '🇹🇳', sample: '20123456' },
];

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserVerified
}) => {
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Format phone number to E.164 (e.g. +201012345678)
  const cleanPhone = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
  const fullFormattedPhone = `${selectedCountry.code}${cleanPhone}`;

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setStep(currentUser.isPhoneVerified ? 'success' : 'phone');
      setErrorMessage(null);
      setOtpCode('');
      setIsLoading(false);
      // Pre-initialize recaptcha
      setTimeout(() => {
        setupPhoneRecaptcha('phone-auth-recaptcha');
      }, 300);
    }
  }, [isOpen, currentUser.isPhoneVerified]);

  if (!isOpen) return null;

  // Step 1: Send OTP via Firebase
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanPhone || cleanPhone.length < 6) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await sendFirebasePhoneOtp(fullFormattedPhone, 'phone-auth-recaptcha');
    setIsLoading(false);

    if (result.success) {
      sounds.playMessageSent();
      setStep('otp');
      setResendCooldown(60);
    } else {
      setErrorMessage(result.error || 'حدث خطأ أثناء إرسال رمز التحقق');
    }
  };

  // Step 2: Confirm OTP
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setErrorMessage('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await verifyFirebasePhoneOtp(otpCode.trim(), currentUser);
    setIsLoading(false);

    if (result.success && result.user) {
      sounds.playCoinsReward();
      setStep('success');
      onUserVerified(result.user);
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      setErrorMessage(result.error || 'رمز التحقق غير صحيح، يرجى المحاولة ثانية');
    }
  };

  // Step 0: Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const result = await signInWithGoogle(currentUser);
    setIsLoading(false);

    if (result.success && result.user) {
      sounds.playCoinsReward();
      setStep('success');
      onUserVerified(result.user);
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setErrorMessage(result.error || 'تعذر تسجيل الدخول باستخدام حساب Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div 
        className="w-full max-w-md bg-gradient-to-b from-slate-900 via-[#0d1527] to-[#070b14] border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow header flare */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-black text-white">تسجيل وتأكيد الدخول</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                Firebase Auth
              </span>
            </div>
            <p className="text-xs text-slate-400">توثيق الحساب عبر Google أو رقم الهاتف برمز OTP</p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: Enter Phone Number & Google Auth Option */}
        {step === 'phone' && (
          <div className="space-y-4">
            {/* Google Fast Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>تسجيل الدخول السريع بحساب Google</span>
            </button>

            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold">
              <div className="flex-1 h-px bg-slate-800" />
              <span>أو برقم الهاتف ورمز التحقق (OTP)</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اختر الدولة ورقم الهاتف
                </label>
              
              <div className="grid grid-cols-3 gap-2 mb-2">
                <select
                  value={selectedCountry.code}
                  onChange={(e) => {
                    const found = COUNTRY_CODES.find(c => c.code === e.target.value);
                    if (found) setSelectedCountry(found);
                  }}
                  className="col-span-1 bg-slate-800/90 border border-slate-700 text-white rounded-2xl px-2.5 py-3 text-xs font-bold focus:border-cyan-400 outline-none"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                      {c.flag} {c.code} ({c.name})
                    </option>
                  ))}
                </select>

                <div className="col-span-2 relative">
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder={`مثال: ${selectedCountry.sample}`}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-2xl px-3 py-3 text-sm font-mono placeholder:text-slate-500 focus:border-cyan-400 outline-none transition-colors text-right"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {cleanPhone && (
                <div className="text-[11px] text-cyan-300 flex items-center justify-between px-1">
                  <span>الصيغة الدولية المعتمدة:</span>
                  <span className="font-mono font-bold" dir="ltr">{fullFormattedPhone}</span>
                </div>
              )}
            </div>

            {/* Test Numbers Tip for Firebase */}
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-200/90 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                <Info className="w-3.5 h-3.5" />
                <span>طريقة الاختبار المباشر (Phone Testing):</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                في لوحة تحكم Firebase Console (Authentication &gt; Sign-in method &gt; Phone)، يمكنك إضافة أرقام اختبار مثل <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono" dir="ltr">+201000000000</code> مع كود ثابت <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono">123456</code> للاختبار الفوري دون تكلفة SMS.
              </p>
            </div>

            {/* Invisible Recaptcha Element */}
            <div id="phone-auth-recaptcha" className="flex justify-center my-1" />

            <button
              type="submit"
              disabled={isLoading || !cleanPhone}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black text-sm shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الاتصال بـ Firebase وإرسال الرمز...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>إرسال رمز التحقق (OTP) 📩</span>
                </>
              )}
            </button>
          </form>
          </div>
        )}

        {/* STEP 2: Enter 6-digit OTP */}
        {step === 'otp' && (
          <form onSubmit={handleConfirmOtp} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs text-slate-400">تم إرسال رمز التحقق المكون من 6 أرقام إلى:</span>
              <div className="font-mono text-cyan-300 font-bold text-sm" dir="ltr">
                {fullFormattedPhone}
              </div>
            </div>

            <div>
              <label className="block text-center text-xs font-bold text-slate-300 mb-2">
                أدخل رمز التحقق (OTP)
              </label>
              <input
                type="text"
                dir="ltr"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[0.5em] font-mono text-2xl font-black bg-slate-800/90 border border-slate-700 text-cyan-300 rounded-2xl py-3.5 focus:border-cyan-400 outline-none shadow-inner"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>تغيير رقم الهاتف</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={handleSendOtp}
                className="text-cyan-400 hover:text-cyan-300 disabled:text-slate-500 font-bold transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `إعادة الإرسال بعد (${resendCooldown} ث)` : 'إعادة إرسال الرمز'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق من الرمز وتأكيد الدخول...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد الرمز وتوثيق الحساب 📱</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">تم توثيق الحساب برقم الهاتف بنجاح!</h4>
              <p className="text-xs text-slate-300">
                حسابك الآن مؤمّن وموثق رسمياً عبر Firebase Auth برقم:
              </p>
              <div className="font-mono text-emerald-400 font-bold text-sm" dir="ltr">
                {currentUser.phoneNumber || fullFormattedPhone}
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تمت إضافة شارة "حساب موثق 📱" لملفك الشخصي</span>
            </div>

            <p className="text-[11px] text-slate-500">سيتم حفظ الجلسة والمتابعة تلقائياً...</p>
          </div>
        )}

      </div>
    </div>
  );
};
