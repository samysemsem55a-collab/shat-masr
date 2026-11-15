import React from 'react';
import { X, Users, Check, UserX, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface JoinRequestItem {
  userId: string;
  userName: string;
  userAvatar?: string;
  requestedAt: number;
}

interface JoinRequestsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: JoinRequestItem[];
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
  roomTitle: string;
}

export const JoinRequestsManagerModal: React.FC<JoinRequestsManagerModalProps> = ({
  isOpen,
  onClose,
  requests,
  onAccept,
  onReject,
  roomTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white border border-amber-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-50 via-white to-indigo-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">طلبات الانضمام للمجلس الخاص</h3>
              <p className="text-[11px] text-slate-500">{roomTitle}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/70">
          {requests.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              لا توجد طلبات انضمام معلقة حالياً في هذا المجلس.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.userId}
                className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={req.userAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(req.userId)}`}
                    alt={req.userName}
                    className="w-9 h-9 rounded-xl object-cover bg-slate-100 border border-slate-200"
                  />
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{req.userName}</h4>
                    <span className="text-[10px] text-slate-500">
                      طلب قبل {Math.max(1, Math.round((Date.now() - req.requestedAt) / 60000))} دقيقة
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      sounds.playCoinsReward();
                      onAccept(req.userId);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-sm active:scale-95 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>قبول</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playMicToggle(false);
                      onReject(req.userId);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs border border-slate-200 transition flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
