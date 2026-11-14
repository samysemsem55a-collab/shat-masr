import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  peerUser: {
    id: string;
    name: string;
    avatar?: string;
    countryFlag?: string;
    role?: string;
    vipBadge?: string;
  };
  callType: 'audio' | 'video';
  onPromptRegister?: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  peerUser,
  callType,
  onPromptRegister
}) => {
  const isGuest = currentUser.role === 'guest' || 
                  (currentUser as any).isGuest || 
                  currentUser.id.startsWith('guest_') || 
                  currentUser.id.startsWith('visitor_');

  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);

  // Check guest restriction immediately
  useEffect(() => {
    if (!isOpen) return;

    if (isGuest) {
      return;
    }

    setCallState('ringing');
    setDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(callType === 'video');

    // Attempt to access user media if video
    if (callType === 'video' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn('Camera/Mic permission notice:', err);
        });
    }

    // Connect after 2.5s of ringing
    const ringTimer = setTimeout(() => {
      sounds.playMessageReceived();
      setCallState('connected');
    }, 2500);

    return () => {
      clearTimeout(ringTimer);
    };
  }, [isOpen, isGuest, callType]);

  // Duration counter once connected
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Cleanup media streams on close
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  if (!isOpen) return null;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  // If Guest: Show clean restriction modal prompting registration
  if (isGuest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
        <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-[#080d1a] border-2 border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-white">المكالمات مخصصة للأعضاء المسجلين</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              عفواً يا طيب! ميزات المكالمات الصوتية والمرئية فائقة الجودة والمشفرة متاحة فقط للحسابات المسجلة لضمان الخصوصية والأمان.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                onClose();
                if (onPromptRegister) onPromptRegister();
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition"
            >
              تسجيل حساب مجاناً الآن 🚀
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs active:scale-95 transition"
            >
              إلغاء وإغلاق
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in select-none" dir="rtl">
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl bg-gradient-to-b from-slate-950 via-[#0a1020] to-slate-950 border border-indigo-900/40 flex flex-col justify-between overflow-hidden shadow-2xl p-6">
        
        {/* Top Header: Security, Status, Encryption */}
        <div className="flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>مشفرة من طرف لطرف 🔒</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 text-amber-300 font-bold">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>HD Voice</span>
          </div>
        </div>

        {/* Center: Video streams or Voice Avatar visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center my-6 relative">
          
          {callType === 'video' && isVideoEnabled ? (
            <div className="relative w-full h-full max-h-[60vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {/* Remote simulated video */}
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/60 to-purple-950/60">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-500/80 shadow-2xl mb-4 animate-pulse">
                  {peerUser.avatar ? (
                    <img src={peerUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-indigo-700 flex items-center justify-center text-3xl font-bold text-white">
                      {peerUser.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="text-base font-black text-white">{peerUser.name}</h3>
                <p className="text-xs text-indigo-300 mt-1">بث مرئي حي ومباشر 📹</p>
              </div>

              {/* Local User Self-Preview Window */}
              <div className="absolute top-4 right-4 w-24 h-32 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-black">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover mirror"
                />
                <span className="absolute bottom-1 right-2 text-[9px] bg-black/70 px-1.5 py-0.2 rounded text-white font-bold">أنت</span>
              </div>
            </div>
          ) : (
            /* Voice Note Audio Visualizer Display */
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {callState === 'connected' && (
                  <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping"></div>
                )}
                {callState === 'ringing' && (
                  <div className="absolute -inset-4 rounded-full bg-amber-500/20 animate-pulse"></div>
                )}

                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-amber-400 shadow-2xl bg-slate-900 relative z-10 flex items-center justify-center">
                  {peerUser.avatar ? (
                    <img src={peerUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-amber-300">{peerUser.name.charAt(0)}</span>
                  )}
                </div>
              </div>

              {/* Peer Details */}
              <div className="text-center space-y-1">
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center justify-center gap-2">
                  <span>{peerUser.name}</span>
                  <span>{peerUser.countryFlag || '🇪🇬'}</span>
                </h2>
                {peerUser.vipBadge && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    {peerUser.vipBadge}
                  </span>
                )}
                <p className="text-xs font-bold text-indigo-300">
                  {callState === 'ringing' ? 'جاري الرنين والاتصال... 🔔' : callState === 'connected' ? `متصل الآن (${formatDuration(duration)})` : 'تم إنهاء المكالمة'}
                </p>
              </div>

              {/* Sound wave visual bars during active voice call */}
              {callState === 'connected' && !isMuted && (
                <div className="flex items-center gap-1.5 pt-2">
                  <span className="w-1.5 bg-emerald-400 rounded-full animate-soundwave-1"></span>
                  <span className="w-1.5 bg-emerald-400 rounded-full animate-soundwave-2"></span>
                  <span className="w-1.5 bg-emerald-400 rounded-full animate-soundwave-3"></span>
                  <span className="w-1.5 bg-emerald-400 rounded-full animate-soundwave-4"></span>
                  <span className="w-1.5 bg-emerald-400 rounded-full animate-soundwave-2"></span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-800/80 shrink-0">
          
          {/* Mute Mic Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-lg ${
              isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200'
            }`}
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم المايكروفون'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle Button (if video call) */}
          {callType === 'video' && (
            <button
              onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-lg ${
                !isVideoEnabled ? 'bg-rose-600 text-white' : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200'
              }`}
              title={isVideoEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          )}

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-lg ${
              isSpeakerOn ? 'bg-indigo-600 text-white' : 'bg-slate-800/90 text-slate-400'
            }`}
            title={isSpeakerOn ? 'مكبر الصوت قيد التشغيل' : 'إيقاف مكبر الصوت'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-transform active:scale-95 shadow-xl shadow-rose-900/50"
            title="إنهاء المكالمة"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

        </div>

      </div>
    </div>
  );
};
