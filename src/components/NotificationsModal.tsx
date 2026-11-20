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

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onOpenWallet,
}) => {

  const notifications = [
    {
      id: 'n1',
      icon: '🎁',
      title: 'استلام هدية برج القاهرة!',
      desc: 'أرسل لك أبو فهد الكويتي هدية برج القاهرة المضيء في الغرفة العامة (+1000 كوينز أرباح).',
      time: 'منذ 5 دقائق',
      action: 'عرض الأرباح',
      isNew: true
    },
    {
      id: 'n2',
      icon: '👑',
      title: 'ترقية رتبتك إلى VIP ذهبي!',
      desc: 'تم تفعيل صلاحيات الإشراف، المايك المفتوح، وتوهج الاسم الذهبي.',
      time: 'منذ ساعتين',
      action: null,
      isNew: true
    },
    {
      id: 'n3',
      icon: '✨',
      title: 'بدء المسابقة الثقافية الكبرى!',
      desc: 'غرفة الألعاب والمسابقات تشهد الآن منافسة حية بجوائز 5,000 كوينز كاش.',
      time: 'منذ 3 ساعات',
      action: null,
      isNew: false
    }
  ];

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
        <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900">مركز الإشعارات الفورية</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-3 space-y-2 overflow-y-auto bg-slate-50/70">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors shadow-sm ${
                n.isNew
                  ? 'bg-indigo-50/80 border-indigo-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="text-2xl shrink-0 mt-0.5">{n.icon}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900">{n.title}</h4>
                  <span className="text-[10px] text-slate-500">{n.time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.desc}</p>
                {n.action && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenWallet();
                    }}
                    className="text-[11px] font-bold text-amber-600 hover:underline mt-1 block"
                  >
                    {n.action} ←
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
