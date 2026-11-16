import { User } from '../types/chat';
import { realtimeSocket } from './realtimeSocket';

export type ConsentRequestType = 'audio_call' | 'video_call' | 'send_image';

export interface ConsentRequestPayload {
  requestId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  requestType: ConsentRequestType;
  previewText?: string;
  createdAt: number;
}

export interface ConsentResponsePayload {
  requestId: string;
  fromUserId: string;
  toUserId: string;
  requestType: ConsentRequestType;
  approved: boolean;
  responderName: string;
  respondedAt: number;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const CONSENT_BUS_NAME = 'arab_egypt_chat_bus';
const consentBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CONSENT_BUS_NAME) : null;

const cooldownStorageKey = (senderId: string, peerId: string, requestType: ConsentRequestType) =>
  `shatmasr_consent_cooldown_${senderId}_${peerId}_${requestType}`;

export function getConsentCooldownRemaining(
  senderId: string,
  peerId: string,
  requestType: ConsentRequestType
): number {
  if (!senderId || !peerId || typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(cooldownStorageKey(senderId, peerId, requestType));
    if (!raw) return 0;
    const expiresAt = Number(raw);
    if (!expiresAt || isNaN(expiresAt)) return 0;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      localStorage.removeItem(cooldownStorageKey(senderId, peerId, requestType));
      return 0;
    }
    return remaining;
  } catch {
    return 0;
  }
}

export function setConsentCooldown(
  senderId: string,
  peerId: string,
  requestType: ConsentRequestType
): void {
  if (!senderId || !peerId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(cooldownStorageKey(senderId, peerId, requestType), String(Date.now() + COOLDOWN_MS));
  } catch {}
}

export function formatCooldownRemaining(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins > 0) {
    return `${mins} دقيقة و ${secs} ثانية`;
  }
  return `${secs} ثانية`;
}

export function getConsentActionLabel(requestType: ConsentRequestType): string {
  switch (requestType) {
    case 'audio_call':
      return 'إجراء مكالمة صوتية معك';
    case 'video_call':
      return 'إجراء مكالمة فيديو معك';
    case 'send_image':
      return 'إرسال صور / وسائط إليك';
  }
}

export function requestUserConsent(
  fromUser: User,
  peerId: string,
  _peerName: string,
  requestType: ConsentRequestType,
  previewText?: string,
  timeoutMs: number = 45000
): Promise<{ approved: boolean; reason?: 'rejected' | 'timeout' | 'cooldown'; remainingMs?: number }> {
  const cooldownMs = getConsentCooldownRemaining(fromUser.id, peerId, requestType);
  if (cooldownMs > 0) {
    return Promise.resolve({ approved: false, reason: 'cooldown', remainingMs: cooldownMs });
  }

  const requestId = `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload: ConsentRequestPayload = {
    requestId,
    fromUserId: fromUser.id,
    fromUserName: fromUser.name,
    fromUserAvatar: fromUser.avatar,
    toUserId: peerId,
    requestType,
    previewText,
    createdAt: Date.now(),
  };

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubSocket: (() => void) | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (unsubSocket) unsubSocket();
      consentBus?.removeEventListener('message', handleBusMessage);
    };

    const handleResponse = (res: ConsentResponsePayload) => {
      if (settled || !res || res.requestId !== requestId) return;
      settled = true;
      cleanup();
      if (res.approved) {
        resolve({ approved: true });
      } else {
        setConsentCooldown(fromUser.id, peerId, requestType);
        resolve({ approved: false, reason: 'rejected', remainingMs: COOLDOWN_MS });
      }
    };

    const handleBusMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'CONSENT_RESPONSE' && ev.data?.payload) {
        handleResponse(ev.data.payload);
      }
    };

    consentBus?.addEventListener('message', handleBusMessage);
    unsubSocket = realtimeSocket.subscribeToConsentSignals((signal) => {
      if (signal.kind === 'response' && signal.payload) {
        handleResponse(signal.payload as ConsentResponsePayload);
      }
    });

    // Dispatch over WebSocket & local BroadcastChannel
    realtimeSocket.sendConsentSignal({
      kind: 'request',
      targetUserId: peerId,
      payload,
    });
    consentBus?.postMessage({ type: 'CONSENT_REQUEST', payload });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ approved: false, reason: 'timeout' });
    }, timeoutMs);
  });
}

export function subscribeToIncomingConsentRequests(
  currentUserId: string,
  onRequest: (req: ConsentRequestPayload) => void
): () => void {
  const seenIds = new Set<string>();

  const acceptIncoming = (req: ConsentRequestPayload) => {
    if (!req || req.toUserId !== currentUserId || req.fromUserId === currentUserId) return;
    if (seenIds.has(req.requestId)) return;
    seenIds.add(req.requestId);
    onRequest(req);
  };

  const handleBus = (ev: MessageEvent) => {
    if (ev.data?.type === 'CONSENT_REQUEST' && ev.data?.payload) {
      acceptIncoming(ev.data.payload);
    }
  };

  consentBus?.addEventListener('message', handleBus);
  const unsubSocket = realtimeSocket.subscribeToConsentSignals((signal) => {
    if (signal.kind === 'request' && signal.payload) {
      acceptIncoming(signal.payload as ConsentRequestPayload);
    }
  });

  return () => {
    consentBus?.removeEventListener('message', handleBus);
    unsubSocket();
  };
}

export function respondToConsentRequest(
  request: ConsentRequestPayload,
  responderName: string,
  approved: boolean
): void {
  const response: ConsentResponsePayload = {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    toUserId: request.toUserId,
    requestType: request.requestType,
    approved,
    responderName,
    respondedAt: Date.now(),
  };

  realtimeSocket.sendConsentSignal({
    kind: 'response',
    targetUserId: request.fromUserId,
    payload: response,
  });
  consentBus?.postMessage({ type: 'CONSENT_RESPONSE', payload: response });
}
