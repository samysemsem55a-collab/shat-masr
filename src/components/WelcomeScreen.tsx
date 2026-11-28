import React, { useState } from 'react';
import { X, CheckCircle2, User as UserIcon } from 'lucide-react';
import { User } from '../types/chat';
import { signInWithGoogle, syncUserProfileToFirebase } from '../services/firebase';
import { getDefaultAvatarForGender, isLegacyDicebearAvatar } from '../data/seedData';
import { HumanVerificationWidget } from './HumanVerificationWidget';
import { toast } from '../utils/appToast';
import officialBrandIcon from '../assets/images/shat_masr_official_icon.png';

interface WelcomeScreenProps {
  currentUser: User;
  onEnterApp: (user: User) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentUser,
  onEnterApp,
}) => {
  const [entering, setEntering] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHumanVerified, setIsHumanVerified] = useState(false);

  // Guest Form Modal State (Name + Gender + Age required before entering)
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestName, setGuestName] = useState<string>(() => {
    const existing = (currentUser.name || '').trim();
    if (!existing || existing.startsWith('زائر_') || existing === 'ضيف عربي') return '';
    return existing;
  });
  const [guestGender, setGuestGender] = useState<'male' | 'female' | ''>(() =>
    currentUser.gender === 'male' || currentUser.gender === 'female' ? currentUser.gender : ''
  );
  const [guestAge, setGuestAge] = useState<string>(() =>
    typeof currentUser.age === 'number' && currentUser.age >= 13 && currentUser.age <= 99
      ? String(currentUser.age)
      : ''
  );
  const [guestFormError, setGuestFormError] = useState<string | null>(null);

  const trimmedGuestName = guestName.trim();
  const parsedGuestAge = guestAge.trim() === '' ? NaN : parseInt(guestAge.trim(), 10);
  const isGuestNameValid = trimmedGuestName.length >= 2;
  const isGuestGenderValid = guestGender === 'male' || guestGender === 'female';
  const isGuestAgeValid = !isNaN(parsedGuestAge) && parsedGuestAge >= 13 && parsedGuestAge <= 99;
  const isGuestFormValid = isGuestNameValid && isGuestGenderValid && isGuestAgeValid;

  const ensureHumanVerified = (): boolean => {
    if (isHumanVerified) return true;
    const notice = 'يرجى إتمام التحقق البشري البسيط أولاً قبل الدخول إلى الغرف 🛡️';
    setErrorMsg(notice);
    toast.info(notice);
    return false;
  };

  const handleOpenGuestModal = () => {
    if (entering || googleLoading) return;
    if (!ensureHumanVerified()) return;
    setGuestFormError(null);
    setErrorMsg(null);
    setIsGuestModalOpen(true);
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHumanVerified) {
      setGuestFormError('يرجى إتمام التحقق البشري البسيط أولاً للمتابعة.');
      toast.info('يرجى إتمام التحقق البشري البسيط أولاً 🛡️');
      return;
    }
    if (!isGuestFormValid) {
      setGuestFormError('يرجى كتابة الاسم واختيار النوع وتحديد السن (من 13 إلى 99) أولاً.');
      return;
    }
    if (entering || googleLoading) return;
    setEntering(true);
    setGuestFormError(null);

    try {
      let memberId =
        currentUser.id && currentUser.id !== 'usr_me' && !currentUser.id.startsWith('guest_')
          ? currentUser.id
          : localStorage.getItem('arab_chat_userId') || '';

      if (!memberId || memberId.startsWith('guest_')) {
        memberId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      const suffix = memberId.slice(-4).toLowerCase();
      const genderAvatar = getDefaultAvatarForGender(
        guestGender === 'female' ? 'female' : 'male',
        memberId
      );

      const nextUser: User = {
        ...currentUser,
        id: memberId,
        name: trimmedGuestName,
        username: `egy_${suffix}`,
        gender: guestGender as 'male' | 'female',
        age: parsedGuestAge,
        avatar:
          currentUser.avatar && !isLegacyDicebearAvatar(currentUser.avatar)
            ? currentUser.avatar
            : genderAvatar,
        bio: `عضو في مجتمع شات مصر • ${parsedGuestAge} سنة 🇪🇬`,
        country: currentUser.country || 'مصر',
        countryFlag: currentUser.countryFlag || '🇪🇬',
        role: currentUser.role === 'guest' ? 'member' : currentUser.role || 'member',
        isGuest: true,
        isOnline: true,
        status: 'online',
      };

      localStorage.setItem('arab_chat_userId', memberId);
      localStorage.setItem('shat_masr_has_entered', 'true');
      localStorage.setItem('arab_chat_user', JSON.stringify(nextUser));

      syncUserProfileToFirebase(nextUser).catch(() => {});
      setIsGuestModalOpen(false);
      onEnterApp(nextUser);
    } finally {
      setEntering(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (entering || googleLoading) return;
    if (!ensureHumanVerified()) return;
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      const result = await signInWithGoogle(currentUser);
      if (result.success && result.user) {
        localStorage.setItem('shat_masr_has_entered', 'true');
        localStorage.setItem('arab_chat_user', JSON.stringify(result.user));
        syncUserProfileToFirebase(result.user).catch(() => {});
        onEnterApp(result.user);
      } else {
        setErrorMsg(result.error || 'تعذر تسجيل الدخول بحساب Google.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      lang="ar"
      className="relative min-h-[100dvh] w-full overflow-hidden flex flex-col justify-between text-white select-none bg-[#170d2e]"
    >
      {/* Full-bleed Pyramids & Nile at Sunset Background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url('/assets/wallpapers/nature_nile_sunset.jpg')" }}
      />
      {/* Deep Sunset Purple -> Amber Atmospheric Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#1e103b]/90 via-[#381a54]/62 to-[#120922]/92"
      />
      {/* Giza Pyramids Silhouette on Sunset Horizon */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 420"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 w-full h-[54%] pointer-events-none opacity-65"
      >
        <defs>
          <linearGradient id="pyramidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3a2347" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#120922" stopOpacity="0.96" />
          </linearGradient>
        </defs>
        <polygon points="105,310 290,115 475,310" fill="url(#pyramidGrad)" />
        <polygon points="290,115 475,310 355,310" fill="#180d2c" opacity="0.55" />
        <polygon points="365,310 515,155 665,310" fill="url(#pyramidGrad)" />
        <polygon points="515,155 665,310 570,310" fill="#180d2c" opacity="0.5" />
        <polygon points="620,310 705,220 790,310" fill="url(#pyramidGrad)" />
        <rect x="0" y="308" width="1200" height="112" fill="#0d0719" opacity="0.6" />
      </svg>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-between px-6 pt-8 pb-7 sm:py-10 text-center">
        {/* Upper Section: Official Logo + Golden Title + Description */}
        <div className="flex flex-col items-center space-y-2.5 mt-1">
          <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center drop-shadow-[0_14px_30px_rgba(0,0,0,0.55)]">
            <img
              src={officialBrandIcon}
              alt="شعار شات مصر الرسمي"
              className="w-full h-full object-contain"
            />
          </div>

          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)] bg-gradient-to-b from-[#FFF1B8] via-[#F7C95B] to-[#C8861B] bg-clip-text text-transparent"
          >
            شات مصر
          </h1>

          <p className="text-sm sm:text-base font-bold text-white/95 leading-relaxed max-w-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
            شات مصر هو مجتمع دردشة مصري يجمع أصدقاء من كل المحافظات في مكان واحد آمن وسريع
          </p>
        </div>

        {/* Middle Section: Horizontal Features Row */}
        <div className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3 my-4">
          {['دردشة فورية', 'غرف صوتية', 'سريع وآمن'].map((feature, idx) => (
            <React.Fragment key={feature}>
              {idx > 0 && (
                <span className="text-amber-300/60 font-black text-base select-none" aria-hidden="true">
                  |
                </span>
              )}
              <div className="px-3.5 py-2 rounded-2xl bg-black/35 backdrop-blur-xs border border-amber-300/30 text-sm sm:text-base font-black text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                {feature}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Bottom Section: Human Verification + Guest Login + Google Sign-In */}
        <div className="w-full space-y-2.5 mb-1">
          <HumanVerificationWidget
            verified={isHumanVerified}
            onVerifyChange={(ok) => {
              setIsHumanVerified(ok);
              if (ok) setErrorMsg(null);
            }}
            variant="dark"
          />

          {errorMsg && (
            <div className="p-2.5 rounded-2xl bg-amber-950/85 border border-amber-400/50 text-amber-100 text-xs font-bold">
              🛡️ {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenGuestModal}
            disabled={entering || googleLoading}
            className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#F9D678] via-[#EAB338] to-[#C98515] hover:from-[#FDE08D] hover:to-[#D8931E] text-[#2A1700] font-black text-lg sm:text-xl shadow-[0_10px_28px_rgba(234,179,56,0.45)] border border-[#FFF2BE]/70 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            الدخول كزائر
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={entering || googleLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{googleLoading ? 'جاري تسجيل الدخول...' : 'أو تسجيل الدخول بحساب Google'}</span>
          </button>
        </div>
      </div>

      {/* Clear Guest Login Form Modal (Name + Gender + Age Required) */}
      {isGuestModalOpen && (
        <div
          dir="rtl"
          onClick={() => setIsGuestModalOpen(false)}
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-2xl p-5 sm:p-6 text-right space-y-4"
          >
            <button
              type="button"
              onClick={() => setIsGuestModalOpen(false)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <img src={officialBrandIcon} alt="شات مصر" className="w-9 h-9 object-contain" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">الدخول كزائر إلى شات مصر</h2>
                <p className="text-xs text-slate-500 font-semibold">أدخل اسمك ونوعك وسنّك للدخول المباشر</p>
              </div>
            </div>

            {guestFormError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                ⚠️ {guestFormError}
              </div>
            )}

            <form onSubmit={handleGuestSubmit} autoComplete="off" className="space-y-3.5">
              <div>
                <label className="text-xs font-black text-slate-800 block mb-1.5">
                  الاسم <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="shat_guest_nickname"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  maxLength={24}
                  placeholder="اكتب اسمك كما سيظهر في الشات..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    النوع <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGuestGender('male')}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        guestGender === 'male'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ذكر 👨
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestGender('female')}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        guestGender === 'female'
                          ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      أنثى 👩
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5">
                    السن <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="shat_guest_age"
                    autoComplete="off"
                    data-lpignore="true"
                    min={13}
                    max={99}
                    placeholder="مثال: 24"
                    value={guestAge}
                    onChange={(e) => setGuestAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {!isGuestFormValid && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>يُرجى إدخال الاسم واختيار النوع والسن (13–99) لتفعيل زر الدخول</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isGuestFormValid || entering}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#F9D678] via-[#EAB338] to-[#C98515] hover:from-[#FDE08D] hover:to-[#D8931E] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-[#2A1700] font-black text-sm shadow-md disabled:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{entering ? 'جاري الدخول...' : 'دخول إلى شات مصر 🚀'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
