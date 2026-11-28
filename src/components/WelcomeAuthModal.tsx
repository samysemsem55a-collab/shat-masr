import React, { useState, useEffect } from 'react';
import { User } from '../types/chat';
import { signInWithGoogle, syncUserProfileToFirebase } from '../services/firebase';
import { getDefaultAvatarForGender, isLegacyDicebearAvatar } from '../data/seedData';
import { User as UserIcon, ShieldCheck, X, Smartphone, CheckCircle2, Lock } from 'lucide-react';
import appBrandIcon from '../assets/images/shat_masr_official_icon.png';

interface WelcomeAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserAuthenticated: (user: User) => void;
  onOpenPhoneAuth?: () => void;
  allowClose?: boolean;
}

export const WelcomeAuthModal: React.FC<WelcomeAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserAuthenticated,
  onOpenPhoneAuth,
  allowClose = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mandatory Registration Fields: Name, Age, Gender
  const [memberName, setMemberName] = useState<string>(() => {
    const initial = (currentUser.name || '').trim();
    if (!initial || initial.startsWith('زائر_') || initial === 'ضيف عربي') return '';
    return initial;
  });
  const [memberAge, setMemberAge] = useState<string>(() =>
    typeof currentUser.age === 'number' && currentUser.age >= 13 ? String(currentUser.age) : ''
  );
  const [memberGender, setMemberGender] = useState<'male' | 'female' | ''>(() =>
    allowClose && (currentUser.gender === 'male' || currentUser.gender === 'female')
      ? currentUser.gender
      : ''
  );

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedName = memberName.trim();
  const parsedAge = memberAge === '' ? NaN : parseInt(memberAge, 10);
  const isNameValid = trimmedName.length >= 2 && !trimmedName.startsWith('زائر_');
  const isAgeValid = !isNaN(parsedAge) && parsedAge >= 13 && parsedAge <= 99;
  const isGenderValid = memberGender === 'male' || memberGender === 'female';
  const isMandatoryFormValid = isNameValid && isAgeValid && isGenderValid;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await signInWithGoogle(currentUser);
      if (result.success && result.user) {
        const finalUser: User = {
          ...result.user,
          ...(isAgeValid ? { age: parsedAge } : {}),
          ...(isGenderValid ? { gender: memberGender } : {}),
        };
        localStorage.setItem('shat_masr_has_entered', 'true');
        localStorage.setItem('arab_chat_user', JSON.stringify(finalUser));
        await syncUserProfileToFirebase(finalUser);
        onUserAuthenticated(finalUser);
        onClose();
      } else {
        setErrorMsg(result.error || 'تعذر تسجيل الدخول بواسطة جوجل.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const handleMandatorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMandatoryFormValid) {
      setErrorMsg('يرجى إدخال الاسم الحقيقي أو المفضل، العمر (13–99)، واختيار النوع (ذكر / أنثى).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    let memberId =
      currentUser.id && currentUser.id !== 'usr_me' && !currentUser.id.startsWith('guest_')
        ? currentUser.id
        : localStorage.getItem('arab_chat_userId') || '';

    if (!memberId || memberId.startsWith('guest_')) {
      memberId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    localStorage.setItem('arab_chat_userId', memberId);
    localStorage.setItem('shat_masr_has_entered', 'true');

    const defaultAvatar = getDefaultAvatarForGender(
      memberGender === 'female' ? 'female' : 'male',
      memberId
    );

    const nextUser: User = {
      ...currentUser,
      id: memberId,
      name: trimmedName,
      username: `member_${memberId.slice(-4)}`,
      age: parsedAge,
      gender: memberGender,
      avatar:
        currentUser.avatar && !isLegacyDicebearAvatar(currentUser.avatar)
          ? currentUser.avatar
          : defaultAvatar,
      bio: `عضو في شات مصر • العمر ${parsedAge} سنة 🇪🇬`,
      role: currentUser.role === 'guest' ? 'member' : currentUser.role || 'member',
      isGuest: false,
      vipBadge:
        currentUser.vipBadge && currentUser.vipBadge.includes('زائر') ? '' : currentUser.vipBadge || '',
      badges: (currentUser.badges || []).filter((b) => !b.includes('زائر')),
      isOnline: true,
      status: 'online',
    };

    try {
      localStorage.setItem('arab_chat_user', JSON.stringify(nextUser));
      await syncUserProfileToFirebase(nextUser);
      onUserAuthenticated(nextUser);
      onClose();
    } catch {
      onUserAuthenticated(nextUser);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={allowClose ? onClose : undefined}
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in ${
        allowClose ? 'bg-slate-900/50 backdrop-blur-sm' : 'bg-slate-900/75 backdrop-blur-md'
      }`}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-6 sm:p-7 text-[#1E293B]"
      >
        {/* Top Accent Strip */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-purple-600" />

        {/* Mandatory Top-Corner Circular Close Button (X) when opened for Exclusive Features */}
        {allowClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            title="إغلاق والعودة للشات"
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Branding Header */}
        <div className="text-center mb-5">
          <div className="w-20 h-20 mx-auto mb-3 flex items-center justify-center">
            <img
              src={appBrandIcon}
              alt="أيقونة شات مصر"
              className="w-full h-full object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-xl font-black text-[#1E293B] tracking-tight">
            {allowClose ? 'توثيق الحساب للميزات الحصرية' : 'أهلاً بك في شات مصر'}
          </h2>
          <p className="text-xs text-emerald-700 font-bold mt-1">
            {allowClose
              ? 'سجّل بحسابك لفتح المكالمات الصوتية والفيديو المشفرة 🔒'
              : 'أكمل بياناتك الأساسية للدخول إلى الغرف وقائمة المتصلين 🇪🇬'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {allowClose ? (
          /* DISMISSIBLE EXCLUSIVE FEATURE AUTH VIEW (with clear X close button above) */
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                المكالمات الصوتية والمرئية مخصصة للأعضاء الموثقين فقط. يمكنك توثيق حسابك الآن في ثوانٍ أو إغلاق النافذة ومتابعة الدردشة العامة بحرية.
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-[#1E293B] font-black rounded-2xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>تسجيل الدخول السريع بحساب Google</span>
            </button>

            {onOpenPhoneAuth && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPhoneAuth();
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-sm transition-all active:scale-[0.98] text-xs sm:text-sm cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>توثيق الحساب برقم الهاتف (OTP)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              إغلاق ومتابعة الدردشة العامة
            </button>
          </div>
        ) : (
          /* MANDATORY INITIAL ONBOARDING GATE (Name + Age + Gender Required) */
          <div className="space-y-4">
            <form onSubmit={handleMandatorySubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#1E293B] block mb-1.5">
                  الاسم الحقيقي أو المفضل <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  placeholder="اكتب اسمك الذي سيظهر للأعضاء..."
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#1E293B] text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1E293B] block mb-1.5">
                    العمر (السن) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={13}
                    max={99}
                    required
                    placeholder="مثال: 24"
                    value={memberAge}
                    onChange={(e) => setMemberAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#1E293B] text-xs sm:text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1E293B] block mb-1.5">
                    النوع <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMemberGender('male')}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        memberGender === 'male'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ذكر 👨
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberGender('female')}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        memberGender === 'female'
                          ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      أنثى 👩
                    </button>
                  </div>
                </div>
              </div>

              {/* Validation hint when fields are incomplete */}
              {!isMandatoryFormValid && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>يُرجى إكمال الاسم والعمر (13+) واختيار النوع لتفعيل زر الدخول</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isMandatoryFormValid || loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 disabled:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'جاري حفظ البيانات والدخول...' : 'دخول إلى شات مصر 🚀'}</span>
              </button>
            </form>

            <div className="relative py-1 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative px-3 bg-white text-[11px] text-slate-500 font-bold">
                أو الدخول بحساب مسجل
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-[#1E293B] font-black rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 text-xs cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>تسجيل الدخول السريع بحساب Google</span>
            </button>
          </div>
        )}

        <div className="mt-4 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>بياناتك محفوظة بأمان لتظهر بشكل منسق في قائمة المتصلين</span>
        </div>
      </div>
    </div>
  );
};
