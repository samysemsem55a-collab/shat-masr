import { User } from '../types/chat';

export const PRESENCE_HEARTBEAT_MS = 30000; // 30 seconds heartbeat while active
export const PRESENCE_OFFLINE_TIMEOUT_MS = 60000; // 60 seconds freshness window (with RTDB onDisconnect)

let serverTimeOffsetMs = 0;

export function setServerTimeOffsetMs(offsetMs: number): void {
  if (typeof offsetMs === 'number' && Number.isFinite(offsetMs)) {
    serverTimeOffsetMs = offsetMs;
  }
}

export function getServerNowMs(): number {
  return Date.now() + serverTimeOffsetMs;
}

export function resolveTimestampMs(value: any): number | undefined {
  if (typeof value === 'number' && !isNaN(value) && value > 0) {
    return value;
  }
  if (value && typeof value.toMillis === 'function') {
    try {
      const ms = value.toMillis();
      return typeof ms === 'number' && ms > 0 ? ms : undefined;
    } catch {
      return undefined;
    }
  }
  if (value && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return undefined;
}

export function isUserTrulyOnline(user?: Partial<User> | null, nowMs: number = getServerNowMs()): boolean {
  if (!user) return false;
  if (user.status === 'offline') return false;
  if (user.isOnline !== true && (user as any).online !== true) return false;

  const lastSeen = resolveTimestampMs((user as any).lastSeenMs ?? user.lastSeen ?? (user as any).updatedAt);
  if (typeof lastSeen !== 'number' || lastSeen <= 0) {
    return false;
  }
  if (nowMs - lastSeen > PRESENCE_OFFLINE_TIMEOUT_MS) {
    return false;
  }

  return true;
}

export function formatLastSeenArabic(lastSeenInput?: any): string {
  const ts = resolveTimestampMs(lastSeenInput);
  if (!ts) return 'غير متصل';

  const diffMs = Math.max(0, getServerNowMs() - ts);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'آخر ظهور منذ أقل من دقيقة';
  }
  if (diffMinutes === 1) {
    return 'آخر ظهور منذ دقيقة';
  }
  if (diffMinutes === 2) {
    return 'آخر ظهور منذ دقيقتين';
  }
  if (diffMinutes <= 10) {
    return `آخر ظهور منذ ${diffMinutes} دقائق`;
  }
  if (diffMinutes < 60) {
    return `آخر ظهور منذ ${diffMinutes} دقيقة`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) {
    return 'آخر ظهور منذ ساعة';
  }
  if (diffHours === 2) {
    return 'آخر ظهور منذ ساعتين';
  }
  if (diffHours <= 10) {
    return `آخر ظهور منذ ${diffHours} ساعات`;
  }
  if (diffHours < 24) {
    return `آخر ظهور منذ ${diffHours} ساعة`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'آخر ظهور منذ يوم';
  }
  if (diffDays === 2) {
    return 'آخر ظهور منذ يومين';
  }
  if (diffDays <= 10) {
    return `آخر ظهور منذ ${diffDays} أيام`;
  }
  return `آخر ظهور منذ ${diffDays} يوم`;
}
