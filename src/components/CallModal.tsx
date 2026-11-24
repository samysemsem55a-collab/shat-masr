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
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
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
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
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
  const hasRemoteDescRef = useRef<boolean>(false);
  const isSpeakerOnRef = useRef<boolean>(isSpeakerOn);
  isSpeakerOnRef.current = isSpeakerOn;
  const callIdRef = useRef<string>('');
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const hasEndedRef = useRef<boolean>(false);
  const isUnmountedOrClosedRef = useRef<boolean>(false);
  const connectFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartCountRef = useRef<number>(0);

  const unlockAndPlayRemoteMedia = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOnRef.current;
      remoteAudioRef.current.volume = 1;
      if (remoteAudioRef.current.srcObject) {
        remoteAudioRef.current
          .play()
          .then(() => setAutoplayBlocked(false))
          .catch((err) => {
            if (err?.name === 'NotAllowedError') {
              setAutoplayBlocked(true);
            }
          });
      }
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.play().catch((err) => {
        if (err?.name === 'NotAllowedError') {
          setAutoplayBlocked(true);
        }
      });
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.play().catch(() => {});
    }
  }, []);

  const cleanupMediaAndPeer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (connectFallbackTimerRef.current) {
      clearTimeout(connectFallbackTimerRef.current);
      connectFallbackTimerRef.current = null;
    }
    if (iceDisconnectTimerRef.current) {
      clearTimeout(iceDisconnectTimerRef.current);
      iceDisconnectTimerRef.current = null;
    }
    iceRestartCountRef.current = 0;
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
    pendingIceRef.current = [];
    hasRemoteDescRef.current = false;
    setHasRemoteStream(false);
    setHasRemoteVideo(false);
    setAutoplayBlocked(false);
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

  const attachStreamTracksToPeer = useCallback(async (pc: RTCPeerConnection, stream: MediaStream) => {
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      const alreadyBound = senders.some((s) => s.track && s.track.id === track.id);
      if (alreadyBound) continue;

      const sameKindSender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (sameKindSender) {
        try {
          await sameKindSender.replaceTrack(track);
          continue;
        } catch {}
      }

      try {
        pc.addTrack(track, stream);
      } catch {}
    }
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream | null, isAnswerer: boolean = false) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      hasRemoteDescRef.current = false;

      if (!isAnswerer) {
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
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && !hasEndedRef.current) {
          emitCallSignal({
            type: 'ice_candidate',
            fromUserId: currentUser.id,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? null,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
            },
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = remoteStreamRef.current || new MediaStream();
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!remoteStream.getTracks().some((existing) => existing.id === t.id)) {
              remoteStream.addTrack(t);
            }
          });
        } else if (event.track && !remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        remoteStreamRef.current = remoteStream;
        setHasRemoteStream(true);
        if (remoteStream.getVideoTracks().some((vt) => vt.readyState === 'live')) {
          setHasRemoteVideo(true);
        }

        const bindAndPlayRemote = () => {
          if (remoteAudioRef.current) {
            if (remoteAudioRef.current.srcObject !== remoteStream) {
              remoteAudioRef.current.srcObject = remoteStream;
            }
            remoteAudioRef.current.muted = !isSpeakerOnRef.current;
            remoteAudioRef.current.volume = 1;
            remoteAudioRef.current
              .play()
              .then(() => setAutoplayBlocked(false))
              .catch((err) => {
                if (err?.name === 'NotAllowedError') {
                  setAutoplayBlocked(true);
                }
              });
          }
          if (remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject !== remoteStream) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            remoteVideoRef.current.play().catch(() => {});
          }
        };

        bindAndPlayRemote();

        if (event.track) {
          event.track.onunmute = () => {
            if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
            setHasRemoteStream(true);
            if (event.track.kind === 'video') {
              setHasRemoteVideo(true);
            }
            bindAndPlayRemote();
            setCallState((prev) => (prev === 'connecting' || prev === 'ringing' ? 'connected' : prev));
          };
          event.track.onended = () => {
            if (event.track.kind === 'video' && remoteStreamRef.current) {
              setHasRemoteVideo(
                remoteStreamRef.current.getVideoTracks().some((vt) => vt.readyState === 'live')
              );
            }
          };
        }
      };

      const triggerIceRestart = () => {
        if (
          hasEndedRef.current ||
          isUnmountedOrClosedRef.current ||
          iceRestartCountRef.current >= 2 ||
          pc.signalingState !== 'stable'
        ) {
          if (iceRestartCountRef.current >= 2) {
            setMicWarning('تعذر استقرار اتصال الشبكة المباشر — يرجى التحقق من الإنترنت.');
          }
          return;
        }
        iceRestartCountRef.current += 1;
        try {
          pc.restartIce?.();
        } catch {}
        pc.createOffer({ iceRestart: true })
          .then(async (reOffer) => {
            if (hasEndedRef.current || isUnmountedOrClosedRef.current) return;
            await pc.setLocalDescription(reOffer);
            emitCallSignal({
              type: 'call_renegotiate',
              fromUserId: currentUser.id,
              sdp: { type: reOffer.type, sdp: reOffer.sdp },
            });
          })
          .catch(() => {
            setMicWarning('تعذر استقرار اتصال الشبكة المباشر — يرجى التحقق من الإنترنت.');
          });
      };

      const syncConnectionState = () => {
        const conn = pc.connectionState;
        const ice = pc.iceConnectionState;
        if ((conn === 'connected' || ice === 'connected' || ice === 'completed') && !hasEndedRef.current) {
          if (connectFallbackTimerRef.current) {
            clearTimeout(connectFallbackTimerRef.current);
            connectFallbackTimerRef.current = null;
          }
          if (iceDisconnectTimerRef.current) {
            clearTimeout(iceDisconnectTimerRef.current);
            iceDisconnectTimerRef.current = null;
          }
          iceRestartCountRef.current = 0;
          setMicWarning(null);
          setCallState('connected');
          unlockAndPlayRemoteMedia();
        } else if ((conn === 'failed' || ice === 'failed') && !hasEndedRef.current) {
          if (iceDisconnectTimerRef.current) {
            clearTimeout(iceDisconnectTimerRef.current);
            iceDisconnectTimerRef.current = null;
          }
          triggerIceRestart();
        } else if (ice === 'disconnected' && !hasEndedRef.current) {
          if (!iceDisconnectTimerRef.current) {
            iceDisconnectTimerRef.current = setTimeout(() => {
              iceDisconnectTimerRef.current = null;
              if (
                !hasEndedRef.current &&
                (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')
              ) {
                triggerIceRestart();
              }
            }, 3500);
          }
        }
      };

      pc.onconnectionstatechange = syncConnectionState;
      pc.oniceconnectionstatechange = syncConnectionState;

      pcRef.current = pc;
      return pc;
    },
    [callType, currentUser.id, emitCallSignal, unlockAndPlayRemoteMedia]
  );

  const acquireUserMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicWarning('المتصفح لا يدعم الوصول للمايكروفون مباشرة — وضع المكالمة الآمن مفعل.');
      return null;
    }

    const bindLocalStream = (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
    };

    try {
      let stream: MediaStream;
      if (callType === 'video') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
        } catch (constraintErr: any) {
          if (
            constraintErr?.name === 'OverconstrainedError' ||
            constraintErr?.name === 'ConstraintNotSatisfiedError'
          ) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          } else {
            throw constraintErr;
          }
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      if (isUnmountedOrClosedRef.current || hasEndedRef.current) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
        return null;
      }
      bindLocalStream(stream);
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
          bindLocalStream(audioOnlyStream);
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
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.muted = !isSpeakerOnRef.current;
      remoteAudioRef.current.volume = 1;
      remoteAudioRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => {
          if (err?.name === 'NotAllowedError') {
            setAutoplayBlocked(true);
          }
        });
    }
  }, [isVideoEnabled, hasRemoteStream, hasRemoteVideo, callState]);

  // Unlock autoplay on any user tap/click/keydown while call modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleUserGesture = () => {
      unlockAndPlayRemoteMedia();
    };
    window.addEventListener('pointerdown', handleUserGesture, true);
    window.addEventListener('touchstart', handleUserGesture, true);
    window.addEventListener('keydown', handleUserGesture, true);
    return () => {
      window.removeEventListener('pointerdown', handleUserGesture, true);
      window.removeEventListener('touchstart', handleUserGesture, true);
      window.removeEventListener('keydown', handleUserGesture, true);
    };
  }, [isOpen, unlockAndPlayRemoteMedia]);

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
    setHasRemoteVideo(false);
    setAutoplayBlocked(false);
    setCallState(incomingMode ? 'incoming' : 'ringing');
    const initialIncoming = incomingSignalRef.current;
    pendingIceRef.current = Array.isArray(initialIncoming?._earlyIce) ? [...initialIncoming._earlyIce] : [];
    const processedSignals = new Set<string>();

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

      if (signal.type === 'call_offer' && signal.sdp && incomingMode && pcRef.current && callStateRef.current !== 'incoming') {
        try {
          if (pcRef.current.signalingState === 'stable') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            hasRemoteDescRef.current = true;
            if (localStreamRef.current) {
              await attachStreamTracksToPeer(pcRef.current, localStreamRef.current);
            }
            for (const candidate of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            pendingIceRef.current = [];
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            emitCallSignal({
              type: 'call_answer',
              fromUserId: currentUser.id,
              sdp: { type: answer.type, sdp: answer.sdp },
            });
          }
        } catch {}
        return;
      }

      if (signal.type === 'call_renegotiate' && signal.sdp && pcRef.current) {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setLocalDescription({ type: 'rollback' });
          }
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          hasRemoteDescRef.current = true;
          if (localStreamRef.current) {
            await attachStreamTracksToPeer(pcRef.current, localStreamRef.current);
          }
          for (const candidate of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
          pendingIceRef.current = [];
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          emitCallSignal({
            type: 'call_renegotiate_answer',
            fromUserId: currentUser.id,
            sdp: { type: answer.type, sdp: answer.sdp },
          });
          unlockAndPlayRemoteMedia();
        } catch {}
        return;
      }

      if (signal.type === 'call_renegotiate_answer' && signal.sdp && pcRef.current) {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            hasRemoteDescRef.current = true;
            for (const candidate of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            pendingIceRef.current = [];
            unlockAndPlayRemoteMedia();
          }
        } catch {}
        return;
      }

      if (signal.type === 'call_answer' && signal.sdp && pcRef.current) {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            hasRemoteDescRef.current = true;
            for (const candidate of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            pendingIceRef.current = [];
          }
          sounds.stopCallRing();
          sounds.playMessageReceived();
          setCallState((prev) => (prev === 'connected' || prev === 'ended' ? prev : 'connecting'));
          unlockAndPlayRemoteMedia();
        } catch {
          // ignore duplicate answer
        }
        return;
      }

      if (signal.type === 'ice_candidate' && signal.candidate) {
        if (pcRef.current && (hasRemoteDescRef.current || pcRef.current.remoteDescription)) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          pendingIceRef.current.push(signal.candidate);
        }
      }
    };

    const handleEarlyIceEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ callId?: string; candidate?: any; signalId?: string }>).detail;
      if (!detail?.candidate || !detail?.callId || detail.callId !== callIdRef.current) return;
      if (detail.signalId) {
        if (processedSignals.has(detail.signalId)) return;
        processedSignals.add(detail.signalId);
        deleteFirestoreCallSignal(currentUser.id, detail.signalId);
      }
      if (pcRef.current && (hasRemoteDescRef.current || pcRef.current.remoteDescription)) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(detail.candidate)).catch(() => {});
      } else {
        pendingIceRef.current.push(detail.candidate);
      }
    };
    window.addEventListener('shatmasr:call_early_ice', handleEarlyIceEvent);

    const unsubSignals = realtimeSocket.subscribeToCallSignals(handleIncomingSignal);
    const unsubFirestoreSignals = subscribeToFirestoreCallSignals(currentUser.id, handleIncomingSignal);

    let ringTimer: ReturnType<typeof setTimeout> | null = null;

    if (!incomingMode) {
      (async () => {
        const stream = await acquireUserMedia();
        if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
        const pc = createPeerConnection(stream, false);
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
            createdAtMs: Date.now(),
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
            createdAtMs: Date.now(),
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
      window.removeEventListener('shatmasr:call_early_ice', handleEarlyIceEvent);
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

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && navigator.mediaDevices?.getUserMedia) {
      const existingAudio = localStreamRef.current?.getAudioTracks() || [];
      if (existingAudio.length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const targetStream = localStreamRef.current || new MediaStream();
          audioStream.getAudioTracks().forEach((t) => targetStream.addTrack(t));
          localStreamRef.current = targetStream;
          if (pcRef.current) {
            await attachStreamTracksToPeer(pcRef.current, targetStream);
            if (pcRef.current.signalingState === 'stable') {
              const offer = await pcRef.current.createOffer();
              await pcRef.current.setLocalDescription(offer);
              emitCallSignal({
                type: 'call_renegotiate',
                fromUserId: currentUser.id,
                sdp: { type: offer.type, sdp: offer.sdp },
              });
            }
          }
          setMicWarning(null);
        } catch {
          setMicWarning('تم رفض صلاحية المايكروفون — يرجى السماح من إعدادات المتصفح.');
        }
      }
    }
  };

  const handleToggleVideo = async () => {
    const nextVideo = !isVideoEnabled;
    setIsVideoEnabled(nextVideo);
    if (nextVideo && callType === 'video' && navigator.mediaDevices?.getUserMedia) {
      const existingVideo = localStreamRef.current?.getVideoTracks() || [];
      if (existingVideo.length === 0) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
          const targetStream = localStreamRef.current || new MediaStream();
          camStream.getVideoTracks().forEach((t) => targetStream.addTrack(t));
          localStreamRef.current = targetStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = targetStream;
            localVideoRef.current.play().catch(() => {});
          }
          if (pcRef.current) {
            await attachStreamTracksToPeer(pcRef.current, targetStream);
            if (pcRef.current.signalingState === 'stable') {
              const offer = await pcRef.current.createOffer();
              await pcRef.current.setLocalDescription(offer);
              emitCallSignal({
                type: 'call_renegotiate',
                fromUserId: currentUser.id,
                sdp: { type: offer.type, sdp: offer.sdp },
              });
            }
          }
          setMicWarning(null);
        } catch {
          setIsVideoEnabled(false);
          setMicWarning('تعذر تشغيل الكاميرا — يرجى السماح بصلاحية الكاميرا.');
        }
      }
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (hasEndedRef.current) return;
    sounds.stopCallRing();
    sounds.playMessageReceived();
    unlockAndPlayRemoteMedia();
    setCallState('connecting');
    const stream = await acquireUserMedia();
    if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;

    const offerSignal = incomingSignalRef.current;

    if (offerSignal?.sdp) {
      const pc = createPeerConnection(null, true);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSignal.sdp));
        hasRemoteDescRef.current = true;
        if (stream) {
          await attachStreamTracksToPeer(pc, stream);
        }
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
      } catch (err) {
        console.warn('Call answer negotiation notice:', err);
        setMicWarning('جاري إعادة محاولة ربط الصوت والصورة...');
      }
    } else {
      const pc = createPeerConnection(stream, false);
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video',
        });
        await pc.setLocalDescription(offer);
        emitCallSignal({
          type: 'call_renegotiate',
          fromUserId: currentUser.id,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch {
        emitCallSignal({
          type: 'call_accept',
          fromUserId: currentUser.id,
        });
      }
    }
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
    <div
      onClick={unlockAndPlayRemoteMedia}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-md animate-in fade-in select-none sm:p-4"
      dir="rtl"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />
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
          {(micWarning || (autoplayBlocked ? 'اضغط في أي مكان على الشاشة لتشغيل صوت المكالمة 🔊' : null)) && (
            <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold text-center max-w-xs">
              {micWarning || 'اضغط في أي مكان على الشاشة لتشغيل صوت المكالمة 🔊'}
            </div>
          )}

          {callType === 'video' && (isVideoEnabled || hasRemoteVideo) ? (
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
                onClick={handleToggleMute}
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
                  onClick={handleToggleVideo}
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
