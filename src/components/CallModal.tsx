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
  PhoneIncoming,
} from 'lucide-react';
import { User } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { realtimeSocket } from '../services/realtimeSocket';
import { sendFirestoreCallSignal, subscribeToFirestoreCallSignals, deleteFirestoreCallSignal } from '../services/firebase';
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
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  peerUser,
  callType,
  incomingMode = false,
  incomingSignal,
}) => {
  const [callState, setCallState] = useState<'incoming' | 'ringing' | 'connecting' | 'connected' | 'ended'>(
    incomingMode ? 'incoming' : 'ringing'
  );
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [endReason, setEndReason] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  // Refs to keep WebRTC lifecycle immune to parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const incomingSignalRef = useRef(incomingSignal);
  incomingSignalRef.current = incomingSignal;
  const userMetaRef = useRef({
    name: currentUser.name,
    avatar: currentUser.avatar,
    countryFlag: currentUser.countryFlag,
  });
  userMetaRef.current = {
    name: currentUser.name,
    avatar: currentUser.avatar,
    countryFlag: currentUser.countryFlag,
  };
  const callIdRef = useRef<string>('');
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const hasEndedRef = useRef<boolean>(false);
  const isUnmountedOrClosedRef = useRef<boolean>(false);
  const connectFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupMediaAndPeer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (connectFallbackTimerRef.current) {
      clearTimeout(connectFallbackTimerRef.current);
      connectFallbackTimerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore close errors
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
    setHasRemoteStream(false);
  }, []);

  const emitCallSignal = useCallback(
    (signalBody: Record<string, any>) => {
      const enriched = {
        ...signalBody,
        targetUserId: peerUser.id,
        callId: signalBody.callId || callIdRef.current,
        signalId: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      realtimeSocket.sendCallSignal(peerUser.id, enriched);
      sendFirestoreCallSignal(peerUser.id, enriched).catch(() => {});
    },
    [peerUser.id]
  );

  const createPeerConnection = useCallback(
    (stream: MediaStream | null) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }
      if (!stream || stream.getAudioTracks().length === 0) {
        try {
          pc.addTransceiver('audio', { direction: 'recvonly' });
        } catch {}
      }
      if (callType === 'video' && (!stream || stream.getVideoTracks().length === 0)) {
        try {
          pc.addTransceiver('video', { direction: 'recvonly' });
        } catch {}
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && !hasEndedRef.current) {
          emitCallSignal({
            type: 'ice_candidate',
            fromUserId: currentUser.id,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let remoteStream = event.streams?.[0] || remoteStreamRef.current;
        if (!remoteStream) {
          remoteStream = new MediaStream();
        }
        if (event.track && !remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        remoteStreamRef.current = remoteStream;
        setHasRemoteStream(true);

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (!hasEndedRef.current) {
          setCallState('connected');
        }
      };

      const syncConnectionState = () => {
        const conn = pc.connectionState;
        const ice = pc.iceConnectionState;
        if ((conn === 'connected' || ice === 'connected' || ice === 'completed') && !hasEndedRef.current) {
          if (connectFallbackTimerRef.current) {
            clearTimeout(connectFallbackTimerRef.current);
            connectFallbackTimerRef.current = null;
          }
          setCallState('connected');
        } else if (conn === 'disconnected' || ice === 'disconnected') {
          try {
            pc.restartIce?.();
          } catch {}
        } else if (conn === 'failed' || ice === 'failed') {
          setMicWarning('تعذر استقرار اتصال الشبكة المباشر — يرجى التحقق من الإنترنت.');
        }
      };

      pc.onconnectionstatechange = syncConnectionState;
      pc.oniceconnectionstatechange = syncConnectionState;

      pcRef.current = pc;
      return pc;
    },
    [currentUser.id, emitCallSignal]
  );

  const acquireUserMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicWarning('المتصفح لا يدعم الوصول للمايكروفون مباشرة — وضع المكالمة الآمن مفعل.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      if (isUnmountedOrClosedRef.current || hasEndedRef.current) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
        return null;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMicWarning(null);
      return stream;
    } catch (err: any) {
      // Fallback to audio-only if camera failed/denied on a video call
      if (callType === 'video') {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (isUnmountedOrClosedRef.current || hasEndedRef.current) {
            audioOnlyStream.getTracks().forEach((t) => {
              try { t.stop(); } catch {}
            });
            return null;
          }
          localStreamRef.current = audioOnlyStream;
          setIsVideoEnabled(false);
          setMicWarning('تم تشغيل الصوت فقط لعدم توفر صلاحية الكاميرا.');
          return audioOnlyStream;
        } catch {
          // Fall through to full warning below
        }
      }
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setMicWarning('تم رفض صلاحية المايكروفون/الكاميرا — يرجى السماح من إعدادات المتصفح.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setMicWarning('لم يتم العثور على مايكروفون أو كاميرا متصلة بالجهاز.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setMicWarning('المايكروفون أو الكاميرا مستخدم حالياً في تطبيق آخر.');
      } else {
        setMicWarning('تم تشغيل المكالمة بدون صلاحية مايكروفون/كاميرا (يمكنك السماح من إعدادات المتصفح).');
      }
      return null;
    }
  }, [callType]);

  // Keep <video> and <audio> elements bound to streams whenever video toggles or UI updates
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStreamRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [isVideoEnabled, hasRemoteStream, callState]);

  // Ringtone management for incoming calls
  useEffect(() => {
    if (!isOpen) {
      sounds.stopCallRing();
      return;
    }
    if (callState === 'incoming') {
      sounds.startCallRing();
    } else {
      sounds.stopCallRing();
    }
    return () => {
      sounds.stopCallRing();
    };
  }, [isOpen, callState]);

  // Outgoing call setup + WebRTC signaling subscription (Socket + Firestore relay)
  useEffect(() => {
    if (!isOpen) return;
    globalRadioPlayer.pauseForCall();

    isUnmountedOrClosedRef.current = false;
    hasEndedRef.current = false;
    setDuration(0);
    setIsMuted(false);
    setEndReason(null);
    setIsVideoEnabled(callType === 'video');
    setHasRemoteStream(false);
    setCallState(incomingMode ? 'incoming' : 'ringing');
    pendingIceRef.current = [];
    const processedSignals = new Set<string>();

    const initialIncoming = incomingSignalRef.current;
    callIdRef.current = incomingMode
      ? String(initialIncoming?.callId || `call_in_${Date.now()}`)
      : `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const closeGracefully = (reason?: string) => {
      if (hasEndedRef.current) return;
      hasEndedRef.current = true;
      sounds.stopCallRing();
      cleanupMediaAndPeer();
      if (reason) setEndReason(reason);
      setCallState('ended');
      setTimeout(() => {
        if (!isUnmountedOrClosedRef.current) {
          onCloseRef.current();
        }
      }, 650);
    };

    const handleIncomingSignal = async (signal: any) => {
      if (isUnmountedOrClosedRef.current || !signal) return;
      if (signal.targetUserId && signal.targetUserId !== currentUser.id) return;
      if (signal.fromUserId && signal.fromUserId !== peerUser.id) return;
      if (signal.callId && callIdRef.current && signal.callId !== callIdRef.current) {
        return;
      }
      if (signal.signalId) {
        if (processedSignals.has(signal.signalId)) return;
        processedSignals.add(signal.signalId);
        deleteFirestoreCallSignal(currentUser.id, signal.signalId);
      }

      if (signal.type === 'call_end' || signal.type === 'call_reject' || signal.type === 'call_busy') {
        const msg =
          signal.type === 'call_busy'
            ? 'الطرف الآخر مشغول بمكالمة أخرى'
            : signal.type === 'call_reject'
            ? 'تم رفض المكالمة'
            : 'تم إنهاء المكالمة';
        closeGracefully(msg);
        return;
      }

      if (signal.type === 'call_accept') {
        sounds.stopCallRing();
        sounds.playMessageReceived();
        setCallState((prev) => (prev === 'connected' || prev === 'ended' ? prev : 'connected'));
        return;
      }

      if (signal.type === 'call_answer' && signal.sdp && pcRef.current) {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            for (const candidate of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            pendingIceRef.current = [];
          }
          sounds.stopCallRing();
          sounds.playMessageReceived();
          setCallState((prev) => (prev === 'connected' || prev === 'ended' ? prev : 'connecting'));
          // Fallback if peer has no mic/camera tracks or ICE finishes via audio-less safe mode
          if (connectFallbackTimerRef.current) clearTimeout(connectFallbackTimerRef.current);
          connectFallbackTimerRef.current = setTimeout(() => {
            if (!isUnmountedOrClosedRef.current && !hasEndedRef.current) {
              setCallState((prev) => (prev === 'connecting' ? 'connected' : prev));
            }
          }, 2200);
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
    };

    const unsubSignals = realtimeSocket.subscribeToCallSignals(handleIncomingSignal);
    const unsubFirestoreSignals = subscribeToFirestoreCallSignals(currentUser.id, handleIncomingSignal);

    let ringTimer: ReturnType<typeof setTimeout> | null = null;

    if (!incomingMode) {
      (async () => {
        const stream = await acquireUserMedia();
        if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
        const pc = createPeerConnection(stream);
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video',
          });
          await pc.setLocalDescription(offer);
          if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
          emitCallSignal({
            type: 'call_offer',
            fromUserId: currentUser.id,
            callerName: userMetaRef.current.name,
            callerAvatar: userMetaRef.current.avatar,
            callerFlag: userMetaRef.current.countryFlag,
            callType,
            sdp: { type: offer.type, sdp: offer.sdp },
          });
        } catch {
          if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
          emitCallSignal({
            type: 'call_offer',
            fromUserId: currentUser.id,
            callerName: userMetaRef.current.name,
            callerAvatar: userMetaRef.current.avatar,
            callerFlag: userMetaRef.current.countryFlag,
            callType,
          });
        }

        // End unanswered outgoing call cleanly after 45s and notify peer
        ringTimer = setTimeout(() => {
          if (!isUnmountedOrClosedRef.current && !hasEndedRef.current && callStateRef.current === 'ringing') {
            emitCallSignal({
              type: 'call_end',
              fromUserId: currentUser.id,
            });
            closeGracefully('لم يرد الطرف الآخر');
          }
        }, 45000);
      })();
    }

    return () => {
      isUnmountedOrClosedRef.current = true;
      sounds.stopCallRing();
      if (ringTimer) clearTimeout(ringTimer);
      if (!hasEndedRef.current && callStateRef.current !== 'ended') {
        hasEndedRef.current = true;
        emitCallSignal({
          type: callStateRef.current === 'incoming' ? 'call_reject' : 'call_end',
          fromUserId: currentUser.id,
        });
      }
      unsubSignals();
      unsubFirestoreSignals();
      cleanupMediaAndPeer();
    };
  }, [
    isOpen,
    incomingMode,
    callType,
    currentUser.id,
    peerUser.id,
    acquireUserMedia,
    createPeerConnection,
    cleanupMediaAndPeer,
    emitCallSignal,
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
    if (hasEndedRef.current) return;
    sounds.stopCallRing();
    sounds.playMessageReceived();
    setCallState('connecting');
    const stream = await acquireUserMedia();
    if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;

    const pc = createPeerConnection(stream);
    const offerSignal = incomingSignalRef.current;

    if (offerSignal?.sdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSignal.sdp));
        for (const candidate of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
        emitCallSignal({
          type: 'call_answer',
          fromUserId: currentUser.id,
          sdp: { type: answer.type, sdp: answer.sdp },
        });
      } catch {
        emitCallSignal({
          type: 'call_accept',
          fromUserId: currentUser.id,
        });
      }
    } else {
      emitCallSignal({
        type: 'call_accept',
        fromUserId: currentUser.id,
      });
    }

    if (connectFallbackTimerRef.current) clearTimeout(connectFallbackTimerRef.current);
    connectFallbackTimerRef.current = setTimeout(() => {
      if (!isUnmountedOrClosedRef.current && !hasEndedRef.current) {
        setCallState((prev) => (prev === 'connecting' ? 'connected' : prev));
      }
    }, 2200);
  };

  const handleEndCall = () => {
    if (hasEndedRef.current) {
      onCloseRef.current();
      return;
    }
    hasEndedRef.current = true;
    sounds.stopCallRing();
    emitCallSignal({
      type: callStateRef.current === 'incoming' ? 'call_reject' : 'call_end',
      fromUserId: currentUser.id,
    });
    cleanupMediaAndPeer();
    setCallState('ended');
    setTimeout(() => {
      if (!isUnmountedOrClosedRef.current) {
        onCloseRef.current();
      }
    }, 550);
  };

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
                muted
                className="w-full h-full object-cover"
              />
              {!hasRemoteStream && (
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
                    {callState === 'ringing'
                      ? 'جاري الاتصال بالفيديو...'
                      : callState === 'connecting'
                      ? 'جاري تأمين بث الفيديو...'
                      : callState === 'ended'
                      ? (endReason || 'تم إنهاء المكالمة')
                      : 'بث مرئي مباشر 📹'}
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
                {(callState === 'ringing' || callState === 'incoming' || callState === 'connecting') && (
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
                    : callState === 'connecting'
                    ? 'جاري تأمين الاتصال... 🔐'
                    : callState === 'connected'
                    ? `متصل الآن (${formatDuration(duration)})`
                    : (endReason || 'تم إنهاء المكالمة')}
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
