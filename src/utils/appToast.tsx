import React from 'react';
import { toast as sonnerToast, type ExternalToast, type ToasterProps } from 'sonner';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Loader2,
  Gift,
  Coins,
  Crown,
  BellRing,
  ShieldAlert,
} from 'lucide-react';

export const TOAST_DURATIONS = {
  success: 3200,
  info: 4200,
  warning: 5200,
  error: 6000,
  gift: 8500,
  coins: 7000,
  vip: 7500,
  social: 5500,
  security: 6500,
} as const;

export const TOASTER_ICONS: NonNullable<ToasterProps['icons']> = {
  success: (
    <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
      <CheckCircle2 className="w-4 h-4" />
    </span>
  ),
  info: (
    <span className="w-7 h-7 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
      <Info className="w-4 h-4" />
    </span>
  ),
  warning: (
    <span className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
      <AlertTriangle className="w-4 h-4" />
    </span>
  ),
  error: (
    <span className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
      <XCircle className="w-4 h-4" />
    </span>
  ),
  loading: (
    <span className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
      <Loader2 className="w-4 h-4 animate-spin" />
    </span>
  ),
};

const GIFT_ICON = (
  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400/25 to-rose-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-xs">
    <Gift className="w-4 h-4 animate-bounce" />
  </span>
);

const COINS_ICON = (
  <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/45 flex items-center justify-center shrink-0">
    <Coins className="w-4 h-4" />
  </span>
);

const VIP_ICON = (
  <span className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-400/45 flex items-center justify-center shrink-0">
    <Crown className="w-4 h-4" />
  </span>
);

const SOCIAL_ICON = (
  <span className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-400/35 flex items-center justify-center shrink-0">
    <BellRing className="w-4 h-4" />
  </span>
);

const SECURITY_ICON = (
  <span className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/35 flex items-center justify-center shrink-0">
    <ShieldAlert className="w-4 h-4" />
  </span>
);

export function getToasterOptions(isDarkMode: boolean): NonNullable<ToasterProps['toastOptions']> {
  return {
    duration: TOAST_DURATIONS.info,
    className: 'shat-toast-fade transition-all duration-300 ease-out',
    style: {
      fontFamily: 'Cairo, Tajawal, sans-serif',
      borderRadius: '1rem',
      boxShadow: isDarkMode
        ? '0 14px 32px -8px rgba(2, 6, 23, 0.55)'
        : '0 12px 30px -8px rgba(15, 23, 42, 0.18)',
      transition: 'opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      transitionDuration: '300ms',
    },
    classNames: {
      toast: 'gap-2.5 px-3.5 py-3',
      title: 'text-[12.5px] font-black leading-snug',
      description: 'text-[11px] font-medium opacity-90 leading-relaxed mt-0.5',
      actionButton: '!rounded-xl !font-black !text-[11px] !px-2.5 !py-1.5',
      closeButton: '!border-slate-200/80 dark:!border-slate-700/80',
      success: '!border-emerald-300/85 dark:!border-emerald-700/60',
      info: '!border-sky-300/85 dark:!border-sky-700/60',
      warning: '!border-amber-300/85 dark:!border-amber-700/60',
      error: '!border-rose-300/85 dark:!border-rose-700/60',
    },
  };
}

type TitleNode = React.ReactNode | (() => React.ReactNode);

function baseToast(message: TitleNode, data?: ExternalToast) {
  return sonnerToast(message, {
    duration: TOAST_DURATIONS.info,
    ...data,
  });
}

export const toast = Object.assign(baseToast, {
  success: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATIONS.success,
      ...data,
    }),

  info: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.info(message, {
      duration: TOAST_DURATIONS.info,
      ...data,
    }),

  warning: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.warning(message, {
      duration: TOAST_DURATIONS.warning,
      ...data,
    }),

  error: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.error(message, {
      duration: TOAST_DURATIONS.error,
      ...data,
    }),

  gift: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATIONS.gift,
      icon: GIFT_ICON,
      className: 'shat-toast-fade shat-toast-gift',
      ...data,
    }),

  coins: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATIONS.coins,
      icon: COINS_ICON,
      ...data,
    }),

  vip: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATIONS.vip,
      icon: VIP_ICON,
      ...data,
    }),

  social: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.info(message, {
      duration: TOAST_DURATIONS.social,
      icon: SOCIAL_ICON,
      ...data,
    }),

  security: (message: TitleNode, data?: ExternalToast) =>
    sonnerToast.error(message, {
      duration: TOAST_DURATIONS.security,
      icon: SECURITY_ICON,
      ...data,
    }),

  loading: sonnerToast.loading,
  message: sonnerToast.message,
  custom: sonnerToast.custom,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  getHistory: sonnerToast.getHistory,
  getToasts: sonnerToast.getToasts,
});
