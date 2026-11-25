import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  X, 
  Bell, 
  Gift, 
  Coins, 
  Sparkles, 
  Crown, 
  MessageCircle,
  TrendingUp
} from 'lucide-react';

import { RealtimeUserNotification } from '../services/firebase';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
  realtimeNotifications?: RealtimeUserNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
}

function formatNotifTime(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  return `منذ ${Math.floor(diffHr / 24)} يوم`;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  realtimeNotifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const allowedKinds = new Set(['forum_like', 'forum_comment', 'story_like', 'story_comment', 'app_update', 'info']);
  const notifications = realtimeNotifications
    .filter((n) => allowedKinds.has(n.kind))
    .map((n) => ({
      id: n.id,
      icon:
        n.kind === 'forum_like' || n.kind === 'story_like'
          ? '❤️'
          : n.kind === 'forum_comment' || n.kind === 'story_comment'
          ? '💬'
          : n.kind === 'app_update'
          ? '🚀'
          : '🔔',
      title:
        n.kind === 'app_update'
          ? 'تحديث جديد للتطبيق'
          : n.kind === 'story_like' || n.kind === 'story_comment'
          ? 'تفاعل على قصتك'
          : n.kind === 'forum_like' || n.kind === 'forum_comment'
          ? 'تفاعل على منشورك'
          : n.actorName || 'إشعار',
      desc: n.message,
      time: formatNotifTime(n.createdAt || Date.now()),
      isNew: !n.isRead,
    }));
  const hasUnread = notifications.some((n) => n.isNew);

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
            className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 truncate">مركز الإشعارات الفورية</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasUnread && onMarkAllAsRead && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="px-2.5 py-1 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] font-bold transition cursor-pointer"
              >
                قراءة الكل
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-3 space-y-2 overflow-y-auto bg-slate-50/70">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-slate-500">
              لا توجد إشعارات جديدة للقصص أو المنتدى أو التحديثات حالياً.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.isNew && onMarkAsRead) onMarkAsRead(n.id);
                }}
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors shadow-sm ${
                  n.isNew
                    ? 'bg-indigo-50/80 border-indigo-200 cursor-pointer hover:bg-indigo-100/70'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-2xl shrink-0 mt-0.5">{n.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>{n.title}</span>
                      {n.isNew && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-500 shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.desc}</p>
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
