import React, { useState } from 'react';
import { Download, Smartphone, X, Share2, PlusSquare, Monitor, CheckCircle } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { sounds } from '../utils/soundEffects';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  const handleInstallClick = async () => {
    sounds.playCoinsReward();
    if (isInstallable) {
      const res = await install();
      if (!res) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={
          variant === 'full'
            ? "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-98 transition-all cursor-pointer"
            : "h-9 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap cursor-pointer"
        }
        title="تثبيت التطبيق على الشاشة الرئيسية للهاتف"
      >
        <Download className={variant === 'full' ? "w-4 h-4 shrink-0" : "w-3.5 h-3.5 shrink-0"} />
        {isInstalled ? (
          <span>مثبت ✅</span>
        ) : variant === 'full' ? (
          <span>تثبيت التطبيق على جهازك 📲</span>
        ) : (
          <>
            <span className="hidden sm:inline">تثبيت التطبيق</span>
            <span className="sm:hidden">تثبيت 📲</span>
          </>
        )}
      </button>

      {/* Universal Installation Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" dir="rtl">
          <div className="w-full max-w-sm rounded-3xl bg-[#09121d] border border-emerald-500/40 p-5 shadow-2xl text-right space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-emerald-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-sm font-black text-white">تثبيت شات مصر وكل العرب</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstalled ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">التطبيق مثبت بالفعل على جهازك!</p>
                <p className="text-xs text-slate-400">يمكنك فتحه مباشرة من الشاشة الرئيسية لهاتفك أو سطح المكتب.</p>
              </div>
            ) : isIOS ? (
              <div className="space-y-2.5 text-xs text-slate-300">
                <p className="text-amber-300 font-semibold text-[11px]">خطوات التثبيت السريع على متصفح Safari في الآيفون:</p>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>
                    اضغط على زر <strong className="text-cyan-300">المشاركة (Share <Share2 className="w-3.5 h-3.5 inline text-cyan-300" />)</strong> في أسفل متصفح Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>
                    مرر القائمة للأسفل واضغط على <strong className="text-amber-300">إضافة إلى الصفحة الرئيسية (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-amber-300" />)</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>
                    اضغط <strong className="text-emerald-400">إضافة (Add)</strong>، وسيظهر تطبيق شات العرب كأيقونة مستقلة فوراً.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-300">
                <p className="text-emerald-300 font-semibold text-[11px]">لتثبيت التطبيق على متصفح Chrome أو الأندرويد أو الحاسوب:</p>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>
                    اضغط على زر القائمة <strong className="text-cyan-300">(ثلاث نقاط ⋮ في أعلى أو أسفل المتصفح)</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>
                    اختر <strong className="text-amber-300">"تثبيت التطبيق" (Install app)</strong> أو <strong className="text-amber-300">"إضافة إلى الشاشة الرئيسية"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>
                    أكّد التثبيت، وسيعمل التطبيق بشاشة كاملة وسرعة فائقة بدون الحاجة لمتصفح!
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs active:scale-95 transition-all shadow"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
