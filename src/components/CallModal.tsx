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
import {
  sendFirestoreCallSignal,
  subscribeToFirestoreCallSignals,
  deleteFirestoreCallSignal,
  getLocalActiveCall,
  registerLocalActiveCall,
  unregisterLocalActiveCall,
  checkTargetUserInCall,
  cleanupCallSignalsForCall,
} from '../services/firebase';
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
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
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
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  // Latched props & session refs so parent/user state updates never re-create or drop an active call
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const incomingSignalRef = useRef(incomingSignal);
  incomingSignalRef.current = incomingSignal;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const peerUserRef = useRef(peerUser);
  peerUserRef.current = peerUser;
  const propCallTypeRef = useRef<'audio' | 'video'>(callType);
  propCallTypeRef.current = callType;
  const propIncomingModeRef = useRef<boolean>(incomingMode);
  propIncomingModeRef.current = incomingMode;

  const sessionUserIdRef = useRef<string>(currentUser.id);
  const sessionPeerIdRef = useRef<string>(peerUser.id);
  const sessionCallTypeRef = useRef<'audio' | 'video'>(callType);
  const sessionIncomingModeRef = useRef<boolean>(incomingMode);
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
  const unsubSignalsRef = useRef<(() => void) | null>(null);
  const unsubFirestoreSignalsRef = useRef<(() => void) | null>(null);

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

  const clearSessionTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (connectFallbackTimerRef.current) {
      clearTimeout(connectFallbackTimerRef.current);
      connectFallbackTimerRef.current = null;
    }
    if (iceDisconnectTimerRef.current) {
      clearTimeout(iceDisconnectTimerRef.current);
      iceDisconnectTimerRef.current = null;
    }
  }, []);

  const cleanupMediaAndPeer = useCallback(() => {
    clearSessionTimers();
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
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      remoteStreamRef.current = null;
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
    pendingIceRef.current = [];
    hasRemoteDescRef.current = false;
    setHasRemoteStream(false);
    setHasRemoteVideo(false);
    setAutoplayBlocked(false);
    setIsPermissionDenied(false);
  }, [clearSessionTimers]);

  const detachSignalListenersAndCleanDb = useCallback(
    (activeCallId: string, myId: string, peerId: string, preserveTerminalPeerSignal: boolean) => {
      if (unsubSignalsRef.current) {
        try {
          unsubSignalsRef.current();
        } catch {}
        unsubSignalsRef.current = null;
      }
      if (unsubFirestoreSignalsRef.current) {
        try {
          unsubFirestoreSignalsRef.current();
        } catch {}
        unsubFirestoreSignalsRef.current = null;
      }
      if (myId && activeCallId) {
        unregisterLocalActiveCall(activeCallId, myId).catch(() => {});
        cleanupCallSignalsForCall(myId, activeCallId).catch(() => {});
      }
      if (peerId && activeCallId) {
        if (preserveTerminalPeerSignal) {
          cleanupCallSignalsForCall(peerId, activeCallId, [
            'call_offer',
            'call_answer',
            'ice_candidate',
            'call_renegotiate',
            'call_renegotiate_answer',
            'call_accept',
          ]).catch(() => {});
          setTimeout(() => {
            cleanupCallSignalsForCall(peerId, activeCallId).catch(() => {});
          }, 4000);
        } else {
          cleanupCallSignalsForCall(peerId, activeCallId).catch(() => {});
        }
      }
    },
    []
  );

  const emitCallSignal = useCallback((signalBody: Record<string, any>) => {
    const targetId = signalBody.targetUserId || sessionPeerIdRef.current;
    if (!targetId) return;
    const enriched = {
      ...signalBody,
      targetUserId: targetId,
      callId: signalBody.callId || callIdRef.current,
      signalId: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    realtimeSocket.sendCallSignal(targetId, enriched);
    sendFirestoreCallSignal(targetId, enriched).catch(() => {});
  }, []);

  const attachStreamTracksToPeer = useCallback(async (pc: RTCPeerConnection, stream: MediaStream) => {
    const activeType = sessionCallTypeRef.current;
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      // Strictly keep audio calls audio-only
      if (activeType === 'audio' && track.kind === 'video') continue;
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
      const activeType = sessionCallTypeRef.current;
      const myId = sessionUserIdRef.current;
      const peerId = sessionPeerIdRef.current;
      hasRemoteDescRef.current = false;

      if (!isAnswerer) {
        if (stream) {
          stream.getTracks().forEach((track) => {
            if (activeType === 'audio' && track.kind === 'video') return;
            pc.addTrack(track, stream);
          });
        }
        if (!stream || stream.getAudioTracks().length === 0) {
          try {
            pc.addTransceiver('audio', { direction: 'recvonly' });
          } catch {}
        }
        if (activeType === 'video' && (!stream || stream.getVideoTracks().length === 0)) {
          try {
            pc.addTransceiver('video', { direction: 'recvonly' });
          } catch {}
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && !hasEndedRef.current && !isUnmountedOrClosedRef.current) {
          console.log('[Call] ICE candidate sent', { callId: callIdRef.current, to: peerId });
          emitCallSignal({
            type: 'ice_candidate',
            fromUserId: myId,
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
        if (activeType === 'video' && remoteStream.getVideoTracks().some((vt) => vt.readyState === 'live')) {
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
          if (activeType === 'video' && remoteVideoRef.current) {
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
            if (activeType === 'video' && event.track.kind === 'video') {
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
            setMicWarning('فشل الاتصال بالمكالمة — تعذر استقرار الاتصال بالشبكة.');
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
              fromUserId: myId,
              sdp: { type: reOffer.type, sdp: reOffer.sdp },
            });
          })
          .catch(() => {
            setMicWarning('فشل الاتصال بالمكالمة — يرجى التحقق من الإنترنت.');
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
    [emitCallSignal, unlockAndPlayRemoteMedia]
  );

  const acquireUserMedia = useCallback(async (requestedType?: 'audio' | 'video'): Promise<MediaStream | null> => {
    const activeType = requestedType || sessionCallTypeRef.current;
    const isSecureContextReady =
      typeof window === 'undefined'
        ? true
        : window.isSecureContext ||
          window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';

    if (!isSecureContextReady || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsPermissionDenied(true);
      setMicWarning('اسمح بالميكروفون والكاميرا عشان المكالمة تشتغل');
      return null;
    }

    const bindLocalStream = (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (activeType === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
    };

    try {
      let stream: MediaStream;
      if (activeType === 'video') {
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
        // Audio call flow strictly acquires audio only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      if (isUnmountedOrClosedRef.current || hasEndedRef.current) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
        return null;
      }
      bindLocalStream(stream);
      setIsPermissionDenied(false);
      setMicWarning(null);
      return stream;
    } catch (err: any) {
      // Fallback to audio-only if camera failed/denied on a video call
      if (activeType === 'video') {
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
          setIsPermissionDenied(false);
          setMicWarning('تم تشغيل الصوت فقط لعدم توفر صلاحية الكاميرا.');
          return audioOnlyStream;
        } catch {
          // Fall through to full warning below
        }
      }
      console.error('[Call] Media access failed:', err?.name || err?.message || err);
      setIsPermissionDenied(true);
      setMicWarning('اسمح بالميكروفون والكاميرا عشان المكالمة تشتغل');
      return null;
    }
  }, []);

  const handleRetryMediaPermission = useCallback(async () => {
    const activeType = sessionCallTypeRef.current;
    const myId = sessionUserIdRef.current;
    const stream = await acquireUserMedia(activeType);
    if (!stream || isUnmountedOrClosedRef.current || hasEndedRef.current) return;
    if (activeType === 'video' && stream.getVideoTracks().length > 0) {
      setIsVideoEnabled(true);
    }
    if (pcRef.current) {
      await attachStreamTracksToPeer(pcRef.current, stream);
      if (pcRef.current.signalingState === 'stable') {
        try {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          emitCallSignal({
            type: 'call_renegotiate',
            fromUserId: myId,
            sdp: { type: offer.type, sdp: offer.sdp },
          });
        } catch {}
      }
    }
  }, [acquireUserMedia, attachStreamTracksToPeer, emitCallSignal]);

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

  // Stable call session lifecycle — strictly keyed on [isOpen] using refs so parent/user updates never drop active calls
  useEffect(() => {
    if (!isOpen) return;
    globalRadioPlayer.pauseForCall();

    const myId = currentUserRef.current.id;
    const activePeer = peerUserRef.current;
    const activeType = propCallTypeRef.current;
    const isIncoming = propIncomingModeRef.current;
    const initialIncoming = incomingSignalRef.current;

    sessionUserIdRef.current = myId;
    sessionPeerIdRef.current = activePeer.id;
    sessionCallTypeRef.current = activeType;
    sessionIncomingModeRef.current = isIncoming;

    const sessionCallId = isIncoming
      ? String(initialIncoming?.callId || `call_in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
      : `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Prevent overlapping local calls if another call session is already active
    const existingLocal = getLocalActiveCall();
    if (existingLocal && existingLocal.callId !== sessionCallId) {
      isUnmountedOrClosedRef.current = false;
      hasEndedRef.current = true;
      setEndReason('أنت بالفعل في مكالمة نشطة حالياً');
      setCallState('ended');
      const t = setTimeout(() => {
        if (!isUnmountedOrClosedRef.current) onCloseRef.current();
      }, 1200);
      return () => {
        isUnmountedOrClosedRef.current = true;
        clearTimeout(t);
      };
    }

    callIdRef.current = sessionCallId;
    isUnmountedOrClosedRef.current = false;
    hasEndedRef.current = false;
    setDuration(0);
    setIsMuted(false);
    setEndReason(null);
    setMicWarning(null);
    setIsPermissionDenied(false);
    setIsVideoEnabled(activeType === 'video');
    setHasRemoteStream(false);
    setHasRemoteVideo(false);
    setAutoplayBlocked(false);
    setCallState(isIncoming ? 'incoming' : 'ringing');
    pendingIceRef.current = Array.isArray(initialIncoming?._earlyIce) ? [...initialIncoming._earlyIce] : [];
    const processedSignals = new Set<string>();

    registerLocalActiveCall(sessionCallId, myId, activePeer.id, activeType).catch(() => {});

    const closeGracefully = (reason?: string, preserveTerminalPeerSignal: boolean = false) => {
      if (hasEndedRef.current) return;
      hasEndedRef.current = true;
      sounds.stopCallRing();
      detachSignalListenersAndCleanDb(sessionCallId, myId, activePeer.id, preserveTerminalPeerSignal);
      cleanupMediaAndPeer();
      if (reason) setEndReason(reason);
      setCallState('ended');
      setTimeout(() => {
        if (!isUnmountedOrClosedRef.current) {
          onCloseRef.current();
        }
      }, reason ? 1200 : 650);
    };

    const handleIncomingSignal = async (signal: any) => {
      if (isUnmountedOrClosedRef.current || !signal) return;
      if (signal.targetUserId && signal.targetUserId !== myId) return;
      if (signal.fromUserId && signal.fromUserId !== activePeer.id) return;
      if (signal.callId && callIdRef.current && signal.callId !== callIdRef.current) {
        return;
      }
      if (signal.signalId) {
        if (processedSignals.has(signal.signalId)) return;
        processedSignals.add(signal.signalId);
        deleteFirestoreCallSignal(myId, signal.signalId);
      }

      if (signal.type === 'call_end' || signal.type === 'call_reject' || signal.type === 'call_busy') {
        if (signal.type === 'call_reject') {
          console.log('[Call] Call declined', { callId: sessionCallId, by: activePeer.id });
        } else if (signal.type === 'call_busy') {
          console.log('[Call] Target user is busy', { callId: sessionCallId, by: activePeer.id });
        } else {
          console.log('[Call] Call hangup', { callId: sessionCallId, by: activePeer.id });
        }
        const msg =
          signal.type === 'call_busy'
            ? 'الطرف الآخر مشغول في مكالمة أخرى'
            : signal.type === 'call_reject'
            ? 'تم رفض المكالمة'
            : 'تم إنهاء المكالمة';
        closeGracefully(msg, false);
        return;
      }

      if (signal.type === 'call_accept') {
        if (ringTimerRef.current) {
          clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        console.log('[Call] Call accepted', { callId: sessionCallId, by: activePeer.id });
        sounds.stopCallRing();
        sounds.playMessageReceived();
        setCallState((prev) => (prev === 'connected' || prev === 'ended' ? prev : 'connected'));
        return;
      }

      if (signal.type === 'call_offer' && signal.sdp && isIncoming && pcRef.current && callStateRef.current !== 'incoming') {
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
              fromUserId: myId,
              sdp: { type: answer.type, sdp: answer.sdp },
            });
          }
        } catch (err) {
          console.error('[Call] Failed handling delayed offer:', err);
          setMicWarning('تعذر إتمام ربط المكالمة — يرجى المحاولة مرة أخرى.');
        }
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
            fromUserId: myId,
            sdp: { type: answer.type, sdp: answer.sdp },
          });
          unlockAndPlayRemoteMedia();
        } catch (err) {
          console.error('[Call] Renegotiation error:', err);
        }
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
        if (ringTimerRef.current) {
          clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        console.log('[Call] Answer received', { callId: sessionCallId, from: activePeer.id });
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

          if (!connectFallbackTimerRef.current) {
            connectFallbackTimerRef.current = setTimeout(() => {
              connectFallbackTimerRef.current = null;
              if (!hasEndedRef.current && !isUnmountedOrClosedRef.current && callStateRef.current === 'connecting') {
                setMicWarning('جاري محاولة تقوية اتصال الشبكة بالمكالمة...');
              }
            }, 15000);
          }
        } catch (err) {
          console.error('[Call] Error applying Answer:', err);
          setMicWarning('تعذر تطبيق الرد على المكالمة — يرجى التحقق من الشبكة.');
        }
        return;
      }

      if (signal.type === 'ice_candidate' && signal.candidate) {
        console.log('[Call] ICE candidate received', { callId: sessionCallId, from: signal.fromUserId });
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
      console.log('[Call] ICE candidate received', { callId: sessionCallId, buffered: true });
      if (detail.signalId) {
        if (processedSignals.has(detail.signalId)) return;
        processedSignals.add(detail.signalId);
        deleteFirestoreCallSignal(myId, detail.signalId);
      }
      if (pcRef.current && (hasRemoteDescRef.current || pcRef.current.remoteDescription)) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(detail.candidate)).catch(() => {});
      } else {
        pendingIceRef.current.push(detail.candidate);
      }
    };
    window.addEventListener('shatmasr:call_early_ice', handleEarlyIceEvent);

    unsubSignalsRef.current = realtimeSocket.subscribeToCallSignals(handleIncomingSignal);
    unsubFirestoreSignalsRef.current = subscribeToFirestoreCallSignals(myId, handleIncomingSignal);

    if (!isIncoming) {
      (async () => {
        // Check if target user is already in an active call before placing offer
        const targetBusy = await checkTargetUserInCall(activePeer.id);
        if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
        if (targetBusy) {
          console.log('[Call] Target user is busy', { callId: sessionCallId, targetUserId: activePeer.id });
          closeGracefully('الطرف الآخر مشغول في مكالمة أخرى', false);
          return;
        }

        const stream = await acquireUserMedia(activeType);
        if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
        const pc = createPeerConnection(stream, false);
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: activeType === 'video',
          });
          await pc.setLocalDescription(offer);
          if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
          emitCallSignal({
            type: 'call_offer',
            fromUserId: myId,
            callerName: userMetaRef.current.name,
            callerAvatar: userMetaRef.current.avatar,
            callerFlag: userMetaRef.current.countryFlag,
            callType: activeType,
            createdAtMs: Date.now(),
            sdp: { type: offer.type, sdp: offer.sdp },
          });
          console.log('[Call] Offer sent', { callId: sessionCallId, callType: activeType, to: activePeer.id });
        } catch (err) {
          console.error('[Call] Offer creation failed:', err);
          if (isUnmountedOrClosedRef.current || hasEndedRef.current) return;
          setMicWarning('تعذر بدء الاتصال بالمكالمة — يرجى التحقق من صلاحيات الصوت أو الشبكة.');
          emitCallSignal({
            type: 'call_offer',
            fromUserId: myId,
            callerName: userMetaRef.current.name,
            callerAvatar: userMetaRef.current.avatar,
            callerFlag: userMetaRef.current.countryFlag,
            callType: activeType,
            createdAtMs: Date.now(),
          });
          console.log('[Call] Offer sent', { callId: sessionCallId, callType: activeType, to: activePeer.id });
        }

        // End unanswered outgoing call cleanly after 45s, notify peer, and clean call_signals
        ringTimerRef.current = setTimeout(() => {
          if (!isUnmountedOrClosedRef.current && !hasEndedRef.current && callStateRef.current === 'ringing') {
            console.log('[Call] Call hangup', { callId: sessionCallId, reason: '45s_unanswered_timeout' });
            emitCallSignal({
              type: 'call_end',
              fromUserId: myId,
            });
            closeGracefully('لم يرد الطرف الآخر', true);
          }
        }, 45000);
      })();
    } else {
      // Auto-dismiss & cleanup unanswered incoming ring after 45s
      ringTimerRef.current = setTimeout(() => {
        if (!isUnmountedOrClosedRef.current && !hasEndedRef.current && callStateRef.current === 'incoming') {
          console.log('[Call] Call hangup', { callId: sessionCallId, reason: '45s_incoming_unanswered_timeout' });
          emitCallSignal({
            type: 'call_end',
            fromUserId: myId,
          });
          closeGracefully('لم يتم الرد على المكالمة', true);
        }
      }, 45000);
    }

    return () => {
      isUnmountedOrClosedRef.current = true;
      sounds.stopCallRing();
      window.removeEventListener('shatmasr:call_early_ice', handleEarlyIceEvent);
      let sentTerminal = false;
      if (!hasEndedRef.current && callStateRef.current !== 'ended') {
        hasEndedRef.current = true;
        sentTerminal = true;
        const termType = callStateRef.current === 'incoming' ? 'call_reject' : 'call_end';
        if (termType === 'call_reject') {
          console.log('[Call] Call declined', { callId: sessionCallId, by: myId });
        } else {
          console.log('[Call] Call hangup', { callId: sessionCallId, by: myId });
        }
        emitCallSignal({
          type: termType,
          fromUserId: myId,
        });
      }
      detachSignalListenersAndCleanDb(sessionCallId, myId, activePeer.id, sentTerminal);
      cleanupMediaAndPeer();
    };
  }, [isOpen]); // Strictly keyed on [isOpen] so parent/user state updates never drop active calls

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
                fromUserId: sessionUserIdRef.current,
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
    if (sessionCallTypeRef.current !== 'video') return;
    const nextVideo = !isVideoEnabled;
    setIsVideoEnabled(nextVideo);
    if (nextVideo && navigator.mediaDevices?.getUserMedia) {
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
                fromUserId: sessionUserIdRef.current,
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
    const myId = sessionUserIdRef.current;
    const activeType = sessionCallTypeRef.current;
    const sessionCallId = callIdRef.current;

    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }

    console.log('[Call] Call accepted', { callId: sessionCallId, callType: activeType, by: myId });
    sounds.stopCallRing();
    sounds.playMessageReceived();
    unlockAndPlayRemoteMedia();
    setCallState('connecting');

    const stream = await acquireUserMedia(activeType);
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
          fromUserId: myId,
          sdp: { type: answer.type, sdp: answer.sdp },
        });
      } catch (err) {
        console.error('[Call] Call answer negotiation error:', err);
        setMicWarning('تعذر ربط المكالمة — يرجى التحقق من الشبكة والمحاولة مرة أخرى.');
      }
    } else {
      const pc = createPeerConnection(stream, false);
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: activeType === 'video',
        });
        await pc.setLocalDescription(offer);
        emitCallSignal({
          type: 'call_renegotiate',
          fromUserId: myId,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch {
        emitCallSignal({
          type: 'call_accept',
          fromUserId: myId,
        });
      }
    }
  };

  const handleEndCall = () => {
    const myId = sessionUserIdRef.current;
    const peerId = sessionPeerIdRef.current;
    const sessionCallId = callIdRef.current;

    if (hasEndedRef.current) {
      onCloseRef.current();
      return;
    }
    hasEndedRef.current = true;
    sounds.stopCallRing();

    const isDecline = callStateRef.current === 'incoming';
    if (isDecline) {
      console.log('[Call] Call declined', { callId: sessionCallId, by: myId });
    } else {
      console.log('[Call] Call hangup', { callId: sessionCallId, by: myId });
    }

    emitCallSignal({
      type: isDecline ? 'call_reject' : 'call_end',
      fromUserId: myId,
    });
    detachSignalListenersAndCleanDb(sessionCallId, myId, peerId, true);
    cleanupMediaAndPeer();
    setEndReason(isDecline ? 'تم رفض المكالمة' : 'تم إنهاء المكالمة');
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
            <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold text-center max-w-xs flex flex-col items-center gap-1.5">
              <span>{micWarning || 'اضغط في أي مكان على الشاشة لتشغيل صوت المكالمة 🔊'}</span>
              {isPermissionDenied && micWarning && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetryMediaPermission();
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black cursor-pointer transition active:scale-95"
                >
                  حاول تاني
                </button>
              )}
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
