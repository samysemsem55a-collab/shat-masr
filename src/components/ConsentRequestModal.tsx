import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, Image as ImageIcon, Check, X, ShieldCheck } from 'lucide-react';
import {
  ConsentRequestPayload,
  getConsentActionLabel,
} from '../services/consentService';

interface ConsentRequestModalProps {
  request: ConsentRequestPayload | null;
  onRespond: (approved: boolean) => void;
}

export const ConsentRequestModal: React.FC<ConsentRequestModalProps> = ({
  request,
  onRespond,
}) => {
  useEffect(() => {
    if (!request) return;
    const timer = setTimeout(() => {
      onRespond(false);
    }, 45000);
    return () => clearTimeout(timer);
  }, [request, onRespond]);

  return (
    <AnimatePresence>
      {request && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            className="w-full max-w-sm rounded-3xl bg-[#0f172a] border border-amber-400/40 shadow-2xl overflow-hidden text-white"
          >
            <div className="bg-gradient-to-l from-indigo-700 via-purple-700 to-amber-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-200" />
                <span className="text-xs font-black tracking-wide">طلب موافقة مسبقة 🔒</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full text-amber-100">
                  شات مصر الآمن
                </span>
                <button
                  type="button"
                  onClick={() => onRespond(false)}
                  aria-label="إغلاق الطلب"
                  className="p-1 rounded-full bg-black/25 hover:bg-black/45 text-white transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 shadow-lg bg-slate-800 flex items-center justify-center text-xl font-black text-amber-300">
                  {request.fromUserAvatar ? (
                    <img
                      src={request.fromUserAvatar}
                      alt={request.fromUserName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{request.fromUserName.charAt(0)}</span>
                  )}
                </div>
                <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-[#0f172a] flex items-center justify-center absolute -bottom-1 -left-1 shadow-md">
                  {request.requestType === 'video_call' ? (
                    <Video className="w-3.5 h-3.5 text-white" />
                  ) : request.requestType === 'audio_call' ? (
                    <Phone className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-black text-white leading-relaxed">
                  يريد <span className="text-amber-400">{request.fromUserName}</span>{' '}
                  {getConsentActionLabel(request.requestType)}
                </p>
                {request.previewText && (
                  <p className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                    {request.previewText}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  إذا اخترت الرفض سيتم حظر إعادة الطلب لنفس الغرض لمدة 5 دقائق.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-1">
                <button
                  type="button"
                  onClick={() => onRespond(true)}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>قبول ✅</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(false)}
                  className="py-2.5 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>رفض ❌</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
