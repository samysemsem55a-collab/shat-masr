import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  Moon,
  Sun,
  Type,
  Palette,
  Bell,
  Lock,
  ShieldCheck,
  VolumeX,
  Wifi,
  LifeBuoy,
  Send,
  ExternalLink,
  LogOut,
  Image as ImageIcon,
} from 'lucide-react';
import { User } from '../types/chat';
import {
  saveUserThemeSettings,
  updateNotificationPreferences,
  submitUserReport,
} from '../services/firebase';
import {
  readSavedNotificationBgPresetId,
  hasSavedCustomNotificationBgPreset,
} from '../data/wallpapers';
import { NotificationBgSelector } from './NotificationBgSelector';
import { sounds } from '../utils/soundEffects';
import { maskEmail, maskPhone } from '../utils/maskData';
import { isDataSaverEnabled, setDataSaverEnabled } from '../utils/assetCache';
import { toast } from '../utils/appToast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updated: Partial<User>) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenWallpapers?: () => void;
  onLogout?: () => void;
  initialSection?: 'general' | 'support';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  isDarkMode,
  onToggleDarkMode,
  onOpenWallpapers,
  onLogout,
  initialSection = 'general',
}) => {
  const [fontPreference, setFontPreference] = useState<'cairo' | 'tajawal' | 'amiri'>(
    (currentUser.fontPreference as 'cairo' | 'tajawal' | 'amiri') || 'cairo'
  );
  const [muteJoinNotices, setMuteJoinNotices] = useState<boolean>(
    Boolean(currentUser.muteJoinNotices)
  );
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(
    typeof currentUser.dataSaverMode === 'boolean'
      ? currentUser.dataSaverMode
      : isDataSaverEnabled()
  );
  const [muteSendSound, setMuteSendSound] = useState<boolean>(() => sounds.isSendSoundMuted());
  const [notifyDMs, setNotifyDMs] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
      if (raw) return JSON.parse(raw).directMessages !== false;
    } catch {}
    return (currentUser as any).notificationPrefs?.directMessages !== false;
  });
  const [notifyGifts, setNotifyGifts] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
      if (raw) return JSON.parse(raw).gifts !== false;
    } catch {}
    return (currentUser as any).notificationPrefs?.gifts !== false;
  });

  const [supportReason, setSupportReason] = useState<string>('مشكلة تقنية في التطبيق');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [isSendingSupport, setIsSendingSupport] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setFontPreference((currentUser.fontPreference as 'cairo' | 'tajawal' | 'amiri') || 'cairo');
    setMuteJoinNotices(Boolean(currentUser.muteJoinNotices));
    setDataSaverMode(
      typeof currentUser.dataSaverMode === 'boolean'
        ? currentUser.dataSaverMode
        : isDataSaverEnabled()
    );
    setMuteSendSound(sounds.isSendSoundMuted());
    if (initialSection === 'support') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById('settings-support-card')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 120);
      });
    }
  }, [isOpen, initialSection, currentUser.fontPreference, currentUser.muteJoinNotices, currentUser.dataSaverMode]);

  if (!isOpen) return null;

  const persistThemeState = (overrides: {
    dark?: boolean;
    font?: 'cairo' | 'tajawal' | 'amiri';
    muteJoin?: boolean;
    dataSaver?: boolean;
  }) => {
    const nextFont = overrides.font ?? fontPreference;
    const nextMuteJoin = overrides.muteJoin ?? muteJoinNotices;
    const nextDataSaver = overrides.dataSaver ?? dataSaverMode;
    const nextDark = overrides.dark ?? isDarkMode;

    saveUserThemeSettings(currentUser.id, {
      isDarkMode: nextDark,
      chatWallpaper: currentUser.chatWallpaper,
      fontPreference: nextFont,
      muteJoinNotices: nextMuteJoin,
      dataSaverMode: nextDataSaver,
      ...(hasSavedCustomNotificationBgPreset(currentUser)
        ? { notificationBgPreset: readSavedNotificationBgPresetId(currentUser) }
        : {}),
    }).catch(() => {});
  };

  const handleSelectFont = (nextFont: 'cairo' | 'tajawal' | 'amiri') => {
    setFontPreference(nextFont);
    onUpdateUser({ fontPreference: nextFont });
    persistThemeState({ font: nextFont });
    toast.success('تم تغيير نوع خط الدردشة وحفظه ✨');
  };

  const handleToggleDark = () => {
    const nextDark = !isDarkMode;
    onToggleDarkMode();
    persistThemeState({ dark: nextDark });
  };

  const handleToggleMuteJoin = () => {
    const next = !muteJoinNotices;
    setMuteJoinNotices(next);
    onUpdateUser({ muteJoinNotices: next });
    persistThemeState({ muteJoin: next });
    toast.info(next ? 'تم كتم تنبيهات دخول الأعضاء للغرف 🔕' : 'تم تفعيل تنبيهات دخول الأعضاء 🔔');
  };

  const handleToggleDataSaver = () => {
    const next = !dataSaverMode;
    setDataSaverMode(next);
    setDataSaverEnabled(next);
    onUpdateUser({ dataSaverMode: next });
    persistThemeState({ dataSaver: next });
    toast.info(next ? 'تم تفعيل وضع توفير البيانات 📶' : 'تم إيقاف وضع توفير البيانات');
  };

  const handleToggleSendSound = () => {
    const next = !muteSendSound;
    setMuteSendSound(next);
    sounds.setSendSoundMuted(next);
    toast.info(next ? 'تم كتم صوت إرسال الرسائل 🔇' : 'تم تفعيل صوت إرسال الرسائل 🔔');
  };

  const maskedAccountEmail = (() => {
    const rawEmail =
      (currentUser as any).email ||
      (typeof window !== 'undefined' ? localStorage.getItem('arab_chat_auth_email') || '' : '');
    return rawEmail ? maskEmail(rawEmail) : 'غير مرتبط';
  })();

  const maskedAccountPhone = (() => {
    const rawPhone = (currentUser as any).phoneNumber || (currentUser as any).phone || '';
    return rawPhone ? maskPhone(rawPhone) : 'غير مرتبط';
  })();

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh] text-right"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                إعدادات التطبيق والخصوصية
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                المظهر، الخطوط، الإشعارات، الأمان والدعم الفني
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
            aria-label="إغلاق الإعدادات"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 bg-slate-50/70 dark:bg-slate-950/70 space-y-3.5">
          {/* Dark Mode Toggle */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isDarkMode
                    ? 'bg-indigo-500/20 border-indigo-400/40 text-amber-300'
                    : 'bg-indigo-100 border-indigo-200 text-indigo-600'
                }`}
              >
                {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  الوضع الليلي (Dark Mode)
                </h4>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                  {isDarkMode
                    ? 'مفعل — ألوان داكنة مريحة للعين ونصوص واضحة'
                    : 'معطل — التبديل إلى الثيم الداكن المريح للعين'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={handleToggleDark}
              className={`w-12 h-6.5 rounded-full transition-colors flex items-center p-1 shrink-0 cursor-pointer ${
                isDarkMode ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4.5 h-4.5 rounded-full bg-white shadow-md block" />
            </button>
          </div>

          {/* Font Selector + Wallpapers Shortcut */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <label className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>نوع الخط في الدردشة:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cairo', name: 'خط كايرو', font: 'font-["Cairo"]' },
                  { id: 'tajawal', name: 'خط تجوال', font: 'font-["Tajawal"]' },
                  { id: 'amiri', name: 'خط أميري', font: 'font-["Amiri"]' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFont(f.id as 'cairo' | 'tajawal' | 'amiri')}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      fontPreference === f.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className={`text-[11px] block ${f.font}`}>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {onOpenWallpapers && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWallpapers();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/50 dark:to-sky-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-between cursor-pointer hover:brightness-95 transition"
              >
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>خلفيات وألوان المحادثات الشخصية</span>
                </span>
                <span className="text-[11px]">فتح ❯</span>
              </button>
            )}
          </div>

          {/* Notification Bubble Backgrounds */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                خلفية فقاعات الانضمام والإشعارات
              </h4>
            </div>
            <NotificationBgSelector
              currentUser={currentUser}
              onUpdateUser={(u) => onUpdateUser(u)}
              compact
            />
          </div>

          {/* Notification & Sound Preferences */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                تفضيلات الإشعارات والأصوات والبيانات
              </h4>
            </div>

            <div className="space-y-3">
              {/* DM Notifications */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    إشعارات الرسائل الخاصة 💬
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    تنبيهات فورية عند وصول رسالة خاصة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !notifyDMs;
                    setNotifyDMs(next);
                    updateNotificationPreferences(currentUser.id, {
                      directMessages: next,
                      gifts: notifyGifts,
                    });
                    onUpdateUser({
                      notificationPrefs: { directMessages: next, gifts: notifyGifts },
                    } as any);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                    notifyDMs ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Gift Notifications */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    إشعارات الهدايا الفاخرة 🎁
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    تنبيه واحتفال فور إرسال هدية إلى حسابك
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !notifyGifts;
                    setNotifyGifts(next);
                    updateNotificationPreferences(currentUser.id, {
                      directMessages: notifyDMs,
                      gifts: next,
                    });
                    onUpdateUser({
                      notificationPrefs: { directMessages: notifyDMs, gifts: next },
                    } as any);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                    notifyGifts ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Mute Room Join Notices */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <VolumeX className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      كتم تنبيهات دخول الأعضاء للغرف 🔕
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      إخفاء تنبيه دخول الأعضاء داخل الغرف العامة
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMuteJoin}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                    muteJoinNotices ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Data Saver Mode */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <Wifi className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      وضع توفير البيانات 📶
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      تقليل التحميل المسبق للخلفيات والوسائط
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDataSaver}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                    dataSaverMode ? 'bg-sky-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Mute Send Sound */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <VolumeX className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      كتم صوت إرسال الرسائل 🔇
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      إيقاف نغمة النقر عند إرسال رسائلك
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSendSound}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer shrink-0 ${
                    muteSendSound ? 'bg-rose-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>
          </div>

          {/* Masked Account & Security Card */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>بيانات الحساب المحمية</span>
              </h4>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-bold">البريد:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100 dir-ltr">
                  {maskedAccountEmail}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-bold">الهاتف:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100 dir-ltr">
                  {maskedAccountPhone}
                </span>
              </div>
            </div>
          </div>

          {/* Support & Contact Card */}
          <div
            id="settings-support-card"
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">الدعم والتواصل</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  تواصل معنا فوراً أو أرسل أي مشكلة تقنية
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-2 rounded-xl bg-[#E6F4EA] dark:bg-emerald-950/50 hover:bg-[#d5ebd9] border border-[#C8E6D2] dark:border-emerald-800 text-[#1A6B3C] dark:text-emerald-300 text-[11px] font-black flex items-center justify-center gap-1 transition"
              >
                <span>واتساب</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://t.me/shatmasr_support"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-black flex items-center justify-center gap-1 transition"
              >
                <span>تيليجرام</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="mailto:support@shatmasr.com?subject=دعم فني - شات مصر"
                className="py-2 px-2 rounded-xl bg-[#F0EBFF] dark:bg-purple-950/50 hover:bg-[#e5dcff] border border-[#DDD0FF] dark:border-purple-800 text-[#4C2A9E] dark:text-purple-300 text-[11px] font-black flex items-center justify-center gap-1 transition"
              >
                <span>إيميل</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <select
                value={supportReason}
                onChange={(e) => setSupportReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-400"
              >
                <option value="مشكلة تقنية في التطبيق">مشكلة تقنية في التطبيق</option>
                <option value="مشكلة في الاتصال أو الصوت">مشكلة في الاتصال أو الصوت</option>
                <option value="استفسار عن الشحن أو VIP">استفسار عن الشحن أو VIP</option>
                <option value="بلاغ أو شكوى عامة">بلاغ أو شكوى عامة</option>
              </select>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                rows={2}
                placeholder="اكتب تفاصيل المشكلة وسنقوم بالرد عليك وحلها فوراً..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-none"
              />
              <button
                type="button"
                disabled={isSendingSupport || !supportMessage.trim()}
                onClick={async () => {
                  if (!supportMessage.trim() || isSendingSupport) return;
                  setIsSendingSupport(true);
                  try {
                    await submitUserReport({
                      reporterId: currentUser.id,
                      reporterName: currentUser.name,
                      reportedUserId: 'platform_support',
                      reportedUserName: 'الدعم الفني لشات مصر',
                      reason: supportReason,
                      details: supportMessage.trim(),
                      timestamp: Date.now(),
                    });
                    setSupportMessage('');
                    toast.success('تم إرسال رسالتك إلى فريق الدعم الفني بنجاح ✅');
                  } catch {
                    toast.error('تعذر إرسال الرسالة حالياً، يرجى المحاولة مرة أخرى');
                  } finally {
                    setIsSendingSupport(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingSupport ? 'جاري الإرسال...' : 'إرسال المشكلة للدعم'}</span>
              </button>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
