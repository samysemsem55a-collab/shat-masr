import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

interface HumanVerificationWidgetProps {
  verified: boolean;
  onVerifyChange: (verified: boolean, token?: string) => void;
  variant?: 'dark' | 'light';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          language?: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || '';

export const HumanVerificationWidget: React.FC<HumanVerificationWidgetProps> = ({
  verified,
  onVerifyChange,
  variant = 'light',
}) => {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified'>(
    verified ? 'verified' : 'idle'
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (verified && status !== 'verified') {
      setStatus('verified');
    } else if (!verified && status === 'verified') {
      setStatus('idle');
    }
  }, [verified]);

  // Mount Cloudflare Turnstile when site key is configured
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;
      setStatus('verifying');
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: variant === 'dark' ? 'dark' : 'light',
          language: 'ar',
          callback: (token: string) => {
            if (cancelled) return;
            setStatus('verified');
            onVerifyChange(true, token);
          },
          'expired-callback': () => {
            if (cancelled) return;
            setStatus('idle');
            onVerifyChange(false);
          },
          'error-callback': () => {
            if (cancelled) return;
            setStatus('idle');
            onVerifyChange(false);
          },
        });
      } catch {
        setStatus('idle');
      }
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      const existingScript = document.getElementById('cf-turnstile-script');
      if (!existingScript) {
        const s = document.createElement('script');
        s.id = 'cf-turnstile-script';
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        s.onload = mountWidget;
        document.head.appendChild(s);
      } else {
        existingScript.addEventListener('load', mountWidget);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [variant, onVerifyChange]);

  const handleLightweightVerify = () => {
    if (TURNSTILE_SITE_KEY || status === 'verified' || status === 'verifying') return;
    setStatus('verifying');
    window.setTimeout(() => {
      const token = `human_ok_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      setStatus('verified');
      onVerifyChange(true, token);
    }, 350);
  };

  if (TURNSTILE_SITE_KEY) {
    return (
      <div
        dir="rtl"
        className={`rounded-2xl border px-3 py-2 flex flex-col items-center justify-center gap-1.5 ${
          variant === 'dark'
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-sky-50/70 border-sky-200 text-slate-800'
        }`}
      >
        <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
        <div className="text-[11px] font-bold flex items-center gap-1.5">
          {status === 'verified' ? (
            <span className="text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم التحقق بنجاح</span>
            </span>
          ) : (
            <span className="opacity-85 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>جاري التحقق البشري...</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={handleLightweightVerify}
      className={`w-full rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-right transition-all cursor-pointer select-none ${
        status === 'verified'
          ? isDark
            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
            : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          : isDark
          ? 'bg-white/12 hover:bg-white/18 border-white/25 text-white'
          : 'bg-sky-50/80 hover:bg-sky-100/70 border-sky-200 text-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
            status === 'verified'
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : status === 'verifying'
              ? 'bg-sky-500/20 border-sky-400 text-sky-500'
              : isDark
              ? 'bg-white/10 border-white/35 text-white/80'
              : 'bg-white border-sky-300 text-sky-600'
          }`}
        >
          {status === 'verified' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : status === 'verifying' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black truncate">
            {status === 'verified'
              ? 'تم التحقق البشري بنجاح'
              : status === 'verifying'
              ? 'جاري التحقق...'
              : 'تحقق أنك لست روبوت (اضغط للتأكيد)'}
          </p>
          <p className={`text-[10px] truncate ${isDark ? 'text-white/75' : 'text-slate-500'}`}>
            {status === 'verified'
              ? 'حماية سريعة للدخول الآمن إلى شات مصر'
              : 'تحقق أمني خفيف لمرة واحدة قبل دخول الغرف'}
          </p>
        </div>
      </div>

      <span
        className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
          status === 'verified'
            ? 'bg-emerald-600 text-white'
            : status === 'verifying'
            ? 'bg-sky-600 text-white'
            : isDark
            ? 'bg-white/20 text-white'
            : 'bg-sky-600 text-white'
        }`}
      >
        {status === 'verified' ? 'تم بنجاح ✓' : status === 'verifying' ? 'جاري التحقق' : 'تأكيد'}
      </span>
    </button>
  );
};
