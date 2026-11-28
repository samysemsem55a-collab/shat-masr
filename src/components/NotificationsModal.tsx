import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  X, 
  Bell, 
  Trash2
} from 'lucide-react';

import { RealtimeUserNotification } from '../services/firebase';
import { getNotificationBgPresetById } from '../data/wallpapers';
import { formatRelativeArabicTime } from '../utils/dateFormat';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
  realtimeNotifications?: RealtimeUserNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteNotification?: (notificationId: string) => void;
  onClearAllNotifications?: () => void;
  unreadCount?: number;
  highlightedUnreadIds?: string[];
  notificationBgPresetId?: string;
}

function getCategoryMeta(kind: RealtimeUserNotification['kind']) {
  if (kind === 'forum_like' || kind === 'forum_comment') {
    return {
      icon: kind === 'forum_like' ? '🌸' : '💬',
      catLabel: 'المنتدى',
      title: kind === 'forum_like' ? 'إعجاب في المنتدى' : 'تعليق في المنتدى',
      badgeClass: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/70 dark:text-pink-200 dark:border-pink-800',
      accentBorderClass: 'border-r-4 border-r-pink-500',
      iconBgClass: 'bg-pink-100/90 dark:bg-pink-950/60 border-pink-200 dark:border-pink-800',
    };
  }
  if (kind === 'story_like' || kind === 'story_comment') {
    return {
      icon: kind === 'story_like' ? '📸' : '💜',
      catLabel: 'القصص',
      title: kind === 'story_like' ? 'إعجاب بقصتك' : 'تعليق على قصتك',
      badgeClass: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-800',
      accentBorderClass: 'border-r-4 border-r-violet-500',
      iconBgClass: 'bg-violet-100/90 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800',
    };
  }
  if (kind === 'app_update') {
    return {
      icon: '🚀',
      catLabel: 'تحديث',
      title: 'تحديث جديد للتطبيق',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800',
      accentBorderClass: 'border-r-4 border-r-sky-500',
      iconBgClass: 'bg-sky-100/90 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
    };
  }
  return {
    icon: '🔔',
    catLabel: 'النظام',
    title: 'إشعار عام',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800',
    accentBorderClass: 'border-r-4 border-r-amber-500',
    iconBgClass: 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
  };
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  realtimeNotifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  unreadCount = 0,
  highlightedUnreadIds = [],
  notificationBgPresetId,
}) => {
  const allowedKinds = new Set(['forum_like', 'forum_comment', 'story_like', 'story_comment', 'app_update', 'info']);
  const highlightedSet = new Set(highlightedUnreadIds);
  const activePreset = getNotificationBgPresetById(notificationBgPresetId);

  const notifications = realtimeNotifications
    .filter((n) => allowedKinds.has(n.kind))
    .map((n) => {
      const meta = getCategoryMeta(n.kind);
      return {
        id: n.id,
        icon: meta.icon,
        catLabel: meta.catLabel,
        badgeClass: meta.badgeClass,
        accentBorderClass: meta.accentBorderClass,
        iconBgClass: meta.iconBgClass,
        title: n.kind === 'info' && n.actorName ? n.actorName : meta.title,
        desc: n.message,
        time: formatRelativeArabicTime(n.createdAt),
        isNew: !n.isRead || highlightedSet.has(n.id),
        isDbUnread: !n.isRead,
      };
    });
  const hasUnread = notifications.some((n) => n.isDbUnread);
  const badgeCount = Math.max(
    unreadCount,
    notifications.filter((n) => n.isNew).length
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">مركز الإشعارات الفورية</h3>
            {badgeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums shrink-0">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasUnread && onMarkAllAsRead && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 hover:bg-indigo-200 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition cursor-pointer"
              >
                قراءة الكل
              </button>
            )}
            {notifications.length > 0 && onClearAllNotifications && (
              <button
                type="button"
                onClick={onClearAllNotifications}
                className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold transition cursor-pointer"
              >
                مسح الكل
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-3 space-y-2 overflow-y-auto bg-slate-50/70 dark:bg-slate-950/70">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
              لا توجد إشعارات جديدة للقصص أو المنتدى أو التحديثات حالياً.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.isDbUnread && onMarkAsRead) onMarkAsRead(n.id);
                }}
                data-preserve-light={n.isNew && !activePreset.isDark ? 'true' : undefined}
                style={
                  n.isNew
                    ? ({
                        background: activePreset.background,
                        borderColor: activePreset.borderColor,
                        color: activePreset.textColor,
                        '--notif-shimmer-color': activePreset.shimmerColor,
                      } as React.CSSProperties)
                    : undefined
                }
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors shadow-sm ${n.accentBorderClass} ${
                  n.isNew
                    ? 'notif-bubble-shimmer cursor-pointer'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                }`}
              >
                {n.isNew && (
                  <span aria-hidden="true" className="notif-bubble-shimmer-glaze" />
                )}
                <div className={`relative z-10 w-9 h-9 rounded-xl border flex items-center justify-center text-lg shrink-0 mt-0.5 ${n.iconBgClass}`}>
                  <span>{n.icon}</span>
                </div>
                <div className="relative z-10 flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs font-black flex items-center gap-1.5 min-w-0 ${
                        n.isNew ? '' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black border shrink-0 ${n.badgeClass}`}>
                        {n.catLabel}
                      </span>
                      <span className="truncate">{n.title}</span>
                      {n.isNew && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: activePreset.dotColor }}
                        />
                      )}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] shrink-0 ${
                          n.isNew ? 'opacity-80 font-bold' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {n.time}
                      </span>
                      {onDeleteNotification && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(n.id);
                          }}
                          title="حذف الإشعار"
                          aria-label="حذف الإشعار"
                          className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      n.isNew ? 'font-bold opacity-95' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {n.desc}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

