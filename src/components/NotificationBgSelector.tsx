import React, { useState, useEffect } from 'react';
import { Check, Sparkles, Eye, Bell, RotateCcw } from 'lucide-react';
import { User } from '../types/chat';
import {
  NOTIFICATION_BG_PRESETS,
  getNotificationBgPresetById,
  readSavedNotificationBgPresetId,
  saveNotificationBgPresetId,
  hasSavedCustomNotificationBgPreset,
  clearSavedNotificationBgPreset,
  getDefaultNotificationBgPresetIdForTime,
} from '../data/wallpapers';
import { syncUserProfileToFirebase, saveUserThemeSettings } from '../services/firebase';
import { sounds } from '../utils/soundEffects';
import { toast } from '../utils/appToast';

interface NotificationBgSelectorProps {
  currentUser: User;
  onUpdateUser?: (updatedUser: User) => void;
  onApplied?: (presetId: string) => void;
  compact?: boolean;
}

export const NotificationBgSelector: React.FC<NotificationBgSelectorProps> = ({
  currentUser,
  onUpdateUser,
  onApplied,
  compact = false,
}) => {
  const [hasCustomSaved, setHasCustomSaved] = useState<boolean>(() =>
    hasSavedCustomNotificationBgPreset(currentUser)
  );
  const [appliedPresetId, setAppliedPresetId] = useState<string>(() =>
    readSavedNotificationBgPresetId(currentUser)
  );
  const [previewPresetId, setPreviewPresetId] = useState<string>(() =>
    readSavedNotificationBgPresetId(currentUser)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const custom = hasSavedCustomNotificationBgPreset(currentUser);
    const saved = readSavedNotificationBgPresetId(currentUser);
    setHasCustomSaved(custom);
    setAppliedPresetId(saved);
    setPreviewPresetId((prev) => prev || saved);
  }, [currentUser.id, currentUser.notificationBgPreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdated = (e: Event) => {
      const nextId = (e as CustomEvent<{ presetId?: string }>).detail?.presetId;
      setHasCustomSaved(hasSavedCustomNotificationBgPreset(currentUser));
      if (nextId) {
        setAppliedPresetId(nextId);
      } else {
        setAppliedPresetId(readSavedNotificationBgPresetId(currentUser));
      }
    };
    window.addEventListener('shatmasr:notif_bg_updated', onUpdated);
    return () => window.removeEventListener('shatmasr:notif_bg_updated', onUpdated);
  }, [currentUser]);

  const previewPreset = getNotificationBgPresetById(previewPresetId);
  const hasPendingChange = previewPreset.id !== appliedPresetId || !hasCustomSaved;

  const handleApplyPreset = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const targetId = previewPreset.id;
      sounds.playMessageSent();
      saveNotificationBgPresetId(currentUser.id, targetId);
      setHasCustomSaved(true);
      setAppliedPresetId(targetId);

      const updatedUser: User = {
        ...currentUser,
        notificationBgPreset: targetId,
      };
      onUpdateUser?.(updatedUser);
      await syncUserProfileToFirebase(updatedUser).catch(() => {});
      await saveUserThemeSettings(currentUser.id, {
        isDarkMode:
          typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
        chatWallpaper: currentUser.chatWallpaper,
        fontPreference: currentUser.fontPreference,
        muteJoinNotices: currentUser.muteJoinNotices,
        dataSaverMode: currentUser.dataSaverMode,
        notificationBgPreset: targetId,
      }).catch(() => {});

      toast.success(`تم تطبيق خلفية "${previewPreset.name}" للإشعارات بنجاح ✨`);
      onApplied?.(targetId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToAutoDayNight = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      clearSavedNotificationBgPreset(currentUser.id);
      const autoId = getDefaultNotificationBgPresetIdForTime();
      setHasCustomSaved(false);
      setAppliedPresetId(autoId);
      setPreviewPresetId(autoId);

      const updatedUser: User = {
        ...currentUser,
        notificationBgPreset: '',
      };
      onUpdateUser?.(updatedUser);
      await syncUserProfileToFirebase(updatedUser).catch(() => {});
      await saveUserThemeSettings(currentUser.id, {
        isDarkMode:
          typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
        chatWallpaper: currentUser.chatWallpaper,
        fontPreference: currentUser.fontPreference,
        muteJoinNotices: currentUser.muteJoinNotices,
        dataSaverMode: currentUser.dataSaverMode,
        notificationBgPreset: '',
      }).catch(() => {});

      toast.info('تم التفعيل التلقائي لخلفيات الإشعارات حسب وقت النهار والليل ☀️🌙');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-3 text-right">
      {/* Interactive Live Preview Box (with shimmer & high contrast BEFORE applying) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-black text-slate-900">
              معاينة مباشرة قبل التطبيق: {previewPreset.name}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
              !hasCustomSaved && previewPreset.id === appliedPresetId
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : previewPreset.id !== appliedPresetId
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {!hasCustomSaved && previewPreset.id === appliedPresetId
              ? 'تلقائي (نهاري/ليلي)'
              : previewPreset.id !== appliedPresetId
              ? 'معاينة غير محفوظة'
              : 'مفعّل حالياً ✓'}
          </span>
        </div>

        {/* Simulated Room Backdrop with Top Personal Pill + Center Public Bubble + Notification Card */}
        <div
          className={`rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-100/90 via-white to-slate-100/80 ${
            compact ? 'p-2.5 space-y-2' : 'p-3.5 space-y-2.5'
          }`}
        >
          {/* 1. Top Personal Notice Pill Preview */}
          <div className="flex justify-center">
            <div
              data-preserve-light={!previewPreset.isDark ? 'true' : undefined}
              style={
                {
                  background: previewPreset.background,
                  borderColor: previewPreset.borderColor,
                  color: previewPreset.textColor,
                  '--notif-shimmer-color': previewPreset.shimmerColor,
                } as React.CSSProperties
              }
              className="notif-bubble-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-sm max-w-full"
            >
              <span aria-hidden="true" className="notif-bubble-shimmer-glaze" />
              <span
                className="relative z-10 w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: previewPreset.dotColor }}
              />
              <span className="relative z-10 text-[11px] font-black truncate">
                أهلاً بك في غرفة مصر الرئيسية
              </span>
            </div>
          </div>

          {/* 2. Centered Public Join Bubble Preview */}
          <div className="flex justify-center">
            <div
              data-preserve-light={!previewPreset.isDark ? 'true' : undefined}
              style={
                {
                  background: previewPreset.background,
                  borderColor: previewPreset.borderColor,
                  color: previewPreset.textColor,
                  '--notif-shimmer-color': previewPreset.shimmerColor,
                } as React.CSSProperties
              }
              className="notif-bubble-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm max-w-full"
            >
              <span aria-hidden="true" className="notif-bubble-shimmer-glaze" />
              <span
                className="relative z-10 w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: previewPreset.dotColor }}
              />
              <span className="relative z-10 text-xs font-black truncate">
                انضم {currentUser.name || 'أحمد المصري'} إلى الشات
              </span>
            </div>
          </div>

          {/* 3. Notification Card Preview */}
          <div
            data-preserve-light={!previewPreset.isDark ? 'true' : undefined}
            style={
              {
                background: previewPreset.background,
                borderColor: previewPreset.borderColor,
                color: previewPreset.textColor,
                '--notif-shimmer-color': previewPreset.shimmerColor,
              } as React.CSSProperties
            }
            className="notif-bubble-shimmer rounded-2xl border px-3 py-2 flex items-center gap-2.5 shadow-xs"
          >
            <span aria-hidden="true" className="notif-bubble-shimmer-glaze" />
            <div className="relative z-10 w-7 h-7 rounded-xl bg-white/80 border border-black/5 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5" style={{ color: previewPreset.dotColor }} />
            </div>
            <div className="relative z-10 min-w-0 flex-1">
              <p className="text-[11px] font-black truncate">
                أعجب عضو بمنشورك في المنتدى ❤️
              </p>
            </div>
          </div>
        </div>

        {/* Apply & Save Button + Optional Reset to Auto Day/Night */}
        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] text-slate-500 font-bold">
              الافتراضي يتبدل تلقائياً بين النهار (ذهبي كريمي) والليل (ليلي)
            </span>
            {hasCustomSaved && (
              <button
                type="button"
                onClick={handleResetToAutoDayNight}
                disabled={isSaving}
                className="px-2 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>العودة للتلقائي</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleApplyPreset}
            disabled={isSaving || !hasPendingChange}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer ${
              hasPendingChange
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {isSaving
                ? 'جاري الحفظ...'
                : hasPendingChange
                ? 'تطبيق وحفظ الخلفية'
                : 'مفعّلة الآن'}
            </span>
          </button>
        </div>
      </div>

      {/* Exact 10 Curated Background Presets Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>اختر من بين 10 خلفيات جاهزة للإشعارات</span>
          </span>
          <span className="text-[10.5px] font-bold text-slate-500 tabular-nums">
            {NOTIFICATION_BG_PRESETS.length} / 10
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {NOTIFICATION_BG_PRESETS.slice(0, 10).map((preset) => {
            const isPreviewed = preset.id === previewPreset.id;
            const isApplied = preset.id === appliedPresetId;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPreviewPresetId(preset.id)}
                data-preserve-light={!preset.isDark ? 'true' : undefined}
                style={{
                  background: preset.background,
                  borderColor: isPreviewed ? '#4f46e5' : preset.borderColor,
                  color: preset.textColor,
                }}
                className={`relative p-2.5 rounded-2xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 min-h-[68px] ${
                  isPreviewed
                    ? 'ring-2 ring-indigo-300 shadow-md scale-[1.02]'
                    : 'hover:scale-[1.01] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                    style={{ background: preset.previewSwatch }}
                  />
                  {isApplied ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black leading-none">
                      {hasCustomSaved ? 'مفعّل' : 'تلقائي'}
                    </span>
                  ) : isPreviewed ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black leading-none">
                      معاينة
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold opacity-75">{preset.badge}</span>
                  )}
                </div>

                <span className="text-[11px] font-black leading-tight truncate">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
