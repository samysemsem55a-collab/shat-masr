import React, { useState } from 'react';
import { User } from '../types/chat';
import { signInWithGoogle, syncUserProfileToFirebase } from '../services/firebase';
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

  const handleInstantEnter = async () => {
    if (entering || googleLoading) return;
    setEntering(true);
    setErrorMsg(null);

    try {
      let memberId =
        currentUser.id && currentUser.id !== 'usr_me'
          ? currentUser.id
          : localStorage.getItem('arab_chat_userId') || '';

      if (!memberId) {
        memberId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      const suffix = memberId.slice(-4).toUpperCase();
      const existingName = (currentUser.name || '').trim();
      const displayName =
        existingName && existingName !== 'ضيف عربي' ? existingName : `مصري_${suffix}`;

      const nextUser: User = {
        ...currentUser,
        id: memberId,
        name: displayName,
        username: currentUser.username || `egy_${suffix.toLowerCase()}`,
        avatar:
          currentUser.avatar ||
          `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(memberId)}`,
        bio: currentUser.bio || 'عضو في مجتمع شات مصر 🇪🇬',
        country: currentUser.country || 'مصر',
        countryFlag: currentUser.countryFlag || '🇪🇬',
        role: currentUser.role === 'guest' ? 'member' : currentUser.role || 'member',
        isGuest: currentUser.email || currentUser.isEmailVerified || currentUser.isPhoneVerified ? false : true,
        isOnline: true,
        status: 'online',
      };

      localStorage.setItem('arab_chat_userId', memberId);
      localStorage.setItem('shat_masr_has_entered', 'true');
      localStorage.setItem('arab_chat_user', JSON.stringify(nextUser));

      // Non-blocking sync so entry into the main chat screen happens immediately
      syncUserProfileToFirebase(nextUser).catch(() => {});
      onEnterApp(nextUser);
    } finally {
      setEntering(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (entering || googleLoading) return;
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
        {/* Great Pyramid & Khafre & Menkaure Silhouettes */}
        <polygon points="105,310 290,115 475,310" fill="url(#pyramidGrad)" />
        <polygon points="290,115 475,310 355,310" fill="#180d2c" opacity="0.55" />
        <polygon points="365,310 515,155 665,310" fill="url(#pyramidGrad)" />
        <polygon points="515,155 665,310 570,310" fill="#180d2c" opacity="0.5" />
        <polygon points="620,310 705,220 790,310" fill="url(#pyramidGrad)" />
        {/* Nile Reflection Horizon */}
        <rect x="0" y="308" width="1200" height="112" fill="#0d0719" opacity="0.6" />
      </svg>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-between px-6 pt-10 pb-8 sm:py-12 text-center">
        {/* Upper Section: Official Logo + Golden Title + Description */}
        <div className="flex flex-col items-center space-y-3 mt-2">
          <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center drop-shadow-[0_14px_30px_rgba(0,0,0,0.55)]">
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
        <div className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3 my-5">
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

        {/* Bottom Section: Prominent Large Golden CTA Button + Optional Google Sign-In */}
        <div className="w-full space-y-3 mb-2">
          {errorMsg && (
            <div className="p-2.5 rounded-2xl bg-rose-950/85 border border-rose-400/50 text-rose-100 text-xs font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleInstantEnter}
            disabled={entering || googleLoading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#F9D678] via-[#EAB338] to-[#C98515] hover:from-[#FDE08D] hover:to-[#D8931E] text-[#2A1700] font-black text-lg sm:text-xl shadow-[0_10px_28px_rgba(234,179,56,0.45)] border border-[#FFF2BE]/70 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            {entering ? 'جاري الدخول...' : 'دخول فوري بدون تسجيل'}
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
    </div>
  );
};
