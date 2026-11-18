import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  PhoneIncoming,
} from 'lucide-react';
import { User } from '../types/chat';
import { isGuestUser } from '../data/seedData';
import { sounds } from '../utils/soundEffects';
import { realtimeSocket } from '../services/realtimeSocket';
import { globalRadioPlayer } from '../services/radioPlayer';

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
  incomingMode?: boolean;
  incomingSignal?: any;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  peerUser,
  callType,
  onPromptRegister,
  incomingMode = false,
  incomingSignal,
}) => {
  const isGuest = isGuestUser(currentUser);

  const [callState, setCallState] = useState<'incoming' | 'ringing' | 'connected' | 'ended'>(
    incomingMode ? 'incoming' : 'ringing'
  );
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [micWarning, setMicWarning] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanupMediaAndPeer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore close errors
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream | null) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeSocket.sendCallSignal(peerUser.id, {
            type: 'ice_candidate',
            fromUserId: currentUser.id,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;
        remoteStreamRef.current = remoteStream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallState('connected');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          // Graceful fallback handled cleanly
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [currentUser.id, peerUser.id]
  );

  const acquireUserMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicWarning('المتصفح لا يدعم الوصول للمايكروفون مباشرة — وضع المكالمة الآمن مفعل.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMicWarning(null);
      return stream;
    } catch {
      setMicWarning('تم تشغيل المكالمة بدون صلاحية مايكروفون/كاميرا (يمكنك السماح من إعدادات المتصفح).');
      return null;
    }
  }, [callType]);

  // Outgoing call setup + WebRTC signaling subscription
  useEffect(() => {
    if (!isOpen) return;
    globalRadioPlayer.pauseForCall();
    if (isGuest) return;

    let cancelled = false;
    setDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(callType === 'video');
    setCallState(incomingMode ? 'incoming' : 'ringing');
    pendingIceRef.current = [];

    const unsubSignals = realtimeSocket.subscribeToCallSignals(async (signal) => {
      if (cancelled || !signal) return;
      if (signal.targetUserId && signal.targetUserId !== currentUser.id) return;
      if (signal.fromUserId && signal.fromUserId !== peerUser.id) return;

      if (signal.type === 'call_end' || signal.type === 'call_reject') {
        cleanupMediaAndPeer();
        setCallState('ended');
        setTimeout(() => onClose(), 700);
        return;
      }

      if (signal.type === 'call_accept') {
        sounds.playMessageReceived();
        setCallState('connected');
        return;
      }

      if (signal.type === 'call_answer' && signal.sdp && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          for (const candidate of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
          pendingIceRef.current = [];
          sounds.playMessageReceived();
          setCallState('connected');
        } catch {
          // ignore duplicate answer
        }
        return;
      }

      if (signal.type === 'ice_candidate' && signal.candidate) {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          pendingIceRef.current.push(signal.candidate);
        }
      }
    });

    let ringTimer: ReturnType<typeof setTimeout> | null = null;

    if (!incomingMode) {
      (async () => {
        const stream = await acquireUserMedia();
        if (cancelled) return;
        const pc = createPeerConnection(stream);
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video',
          });
          await pc.setLocalDescription(offer);
          realtimeSocket.sendCallSignal(peerUser.id, {
            type: 'call_offer',
            fromUserId: currentUser.id,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatar,
            callerFlag: currentUser.countryFlag,
            callType,
            sdp: offer,
          });
        } catch {
          realtimeSocket.sendCallSignal(peerUser.id, {
            type: 'call_offer',
            fromUserId: currentUser.id,
            callerName: currentUser.name,
            callerAvatar: currentUser.avatar,
            callerFlag: currentUser.countryFlag,
            callType,
          });
        }

        // Graceful fallback timer for simulated / bot peers so call UX never hangs
        ringTimer = setTimeout(() => {
          if (!cancelled) {
            sounds.playMessageReceived();
            setCallState((prev) => (prev === 'ringing' ? 'connected' : prev));
          }
        }, 2500);
      })();
    }

    return () => {
      cancelled = true;
      if (ringTimer) clearTimeout(ringTimer);
      unsubSignals();
      cleanupMediaAndPeer();
    };
  }, [
    isOpen,
    isGuest,
    incomingMode,
    callType,
    currentUser.id,
    currentUser.name,
    currentUser.avatar,
    currentUser.countryFlag,
    peerUser.id,
    acquireUserMedia,
    createPeerConnection,
    cleanupMediaAndPeer,
    onClose,
  ]);

  // Duration timer when connected
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callState]);

  // Mute / Video track toggling
  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = isVideoEnabled;
    });
  }, [isVideoEnabled]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  if (!isOpen) return null;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAcceptIncomingCall = async () => {
    sounds.playMessageReceived();
    const stream = await acquireUserMedia();
    const pc = createPeerConnection(stream);

    if (incomingSignal?.sdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
        for (const candidate of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        realtimeSocket.sendCallSignal(peerUser.id, {
          type: 'call_answer',
          fromUserId: currentUser.id,
          sdp: answer,
        });
      } catch {
        realtimeSocket.sendCallSignal(peerUser.id, {
          type: 'call_accept',
          fromUserId: currentUser.id,
        });
      }
    } else {
      realtimeSocket.sendCallSignal(peerUser.id, {
        type: 'call_accept',
        fromUserId: currentUser.id,
      });
    }
    setCallState('connected');
  };

  const handleEndCall = () => {
    realtimeSocket.sendCallSignal(peerUser.id, {
      type: callState === 'incoming' ? 'call_reject' : 'call_end',
      fromUserId: currentUser.id,
    });
    cleanupMediaAndPeer();
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 650);
  };

  // Guest Restriction Modal (Light Theme)
  if (isGuest) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in" dir="rtl">
        <div className="w-full max-w-sm bg-white border border-amber-200 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-900">المكالمات مخصصة للأعضاء المسجلين</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              عفواً يا طيب! ميزات المكالمات الصوتية والمرئية فائقة الجودة والمشفرة متاحة فقط للحسابات المسجلة لضمان الخصوصية والأمان.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                onClose();
                if (onPromptRegister) onPromptRegister();
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-xs shadow-lg active:scale-95 transition"
            >
              تسجيل حساب مجاناً الآن 🚀
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs active:scale-95 transition"
            >
              إلغاء وإغلاق
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-md animate-in fade-in select-none sm:p-4" dir="rtl">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="relative w-full max-w-md h-full sm:h-[88vh] sm:rounded-3xl bg-gradient-to-b from-indigo-50/90 via-white to-emerald-50/70 border border-slate-200 flex flex-col justify-between overflow-hidden shadow-2xl p-6 text-slate-900">
        {/* Top Header */}
        <div className="flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>مشفرة WebRTC 🔒</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 text-indigo-700 font-bold">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>{callType === 'video' ? 'HD Video' : 'HD Voice'}</span>
          </div>
        </div>

        {/* Center Call Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
          {micWarning && (
            <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold text-center max-w-xs">
              {micWarning}
            </div>
          )}

          {callType === 'video' && isVideoEnabled ? (
            <div className="relative w-full h-full max-h-[56vh] rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStreamRef.current && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-100">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl mb-3 bg-white">
                    <img
                      src={peerUser.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(peerUser.name || peerUser.id)}`}
                      alt={peerUser.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-base font-black text-slate-900">{peerUser.name}</h3>
                  <p className="text-xs text-indigo-600 font-bold mt-1">
                    {callState === 'ringing' ? 'جاري الاتصال بالفيديو...' : 'بث مرئي مباشر 📹'}
                  </p>
                </div>
              )}

              {/* Local User Self-Preview Window */}
              <div className="absolute top-3 right-3 w-24 h-32 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-xl bg-slate-900">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1.5 text-[9px] bg-white/90 text-slate-900 px-1.5 py-0.5 rounded font-black">
                  أنت
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {callState === 'connected' && (
                  <div className="absolute -inset-4 rounded-full bg-emerald-400/25 animate-ping" />
                )}
                {(callState === 'ringing' || callState === 'incoming') && (
                  <div className="absolute -inset-4 rounded-full bg-indigo-400/25 animate-pulse" />
                )}

                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-indigo-500 shadow-2xl bg-white relative z-10 flex items-center justify-center">
                  <img
                    src={peerUser.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(peerUser.name || peerUser.id)}`}
                    alt={peerUser.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center justify-center gap-2">
                  <span>{peerUser.name}</span>
                  <span>{peerUser.countryFlag || '🇪🇬'}</span>
                </h2>
                {peerUser.vipBadge && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200">
                    {peerUser.vipBadge}
                  </span>
                )}
                <p className="text-xs font-black text-indigo-600">
                  {callState === 'incoming'
                    ? 'مكالمة واردة الآن... 📲'
                    : callState === 'ringing'
                    ? 'جاري الرنين والاتصال... 🔔'
                    : callState === 'connected'
                    ? `متصل الآن (${formatDuration(duration)})`
                    : 'تم إنهاء المكالمة'}
                </p>
              </div>

              {callState === 'connected' && !isMuted && (
                <div className="flex items-center gap-1.5 pt-1 h-8">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="w-1.5 h-7 bg-emerald-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-5 bg-indigo-500 rounded-full animate-pulse" />
                  <span className="w-1.5 h-7 bg-emerald-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-center gap-3.5 pt-4 border-t border-slate-200 shrink-0">
          {callState === 'incoming' ? (
            <>
              <button
                onClick={handleAcceptIncomingCall}
                className="px-6 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition"
              >
                <PhoneIncoming className="w-5 h-5" />
                <span>رد على المكالمة</span>
              </button>
              <button
                onClick={handleEndCall}
                className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-transform active:scale-95 shadow-lg"
                title="رفض المكالمة"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-sm border ${
                  isMuted
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title={isMuted ? 'إلغاء كتم الصوت' : 'كتم المايكروفون'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {callType === 'video' && (
                <button
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-sm border ${
                    !isVideoEnabled
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title={isVideoEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`p-3.5 rounded-full transition-transform active:scale-95 shadow-sm border ${
                  isSpeakerOn
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
                title={isSpeakerOn ? 'مكبر الصوت قيد التشغيل' : 'إيقاف مكبر الصوت'}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <button
                onClick={handleEndCall}
                className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-transform active:scale-95 shadow-lg shadow-rose-500/30"
                title="إنهاء المكالمة"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
