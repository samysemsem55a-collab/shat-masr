import { User } from '../types/chat';

export const DEFAULT_VIP_DURATION_DAYS = 30;

export function safeParseTimestamp(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val <= 0) return null;
    // Normalize seconds-scale unix timestamps (< 1e11) to ms
    return val < 1e11 ? val * 1000 : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n > 0) {
        return n < 1e11 ? n * 1000 : n;
      }
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
  }
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') {
      try {
        const ms = val.toMillis();
        return Number.isFinite(ms) && ms > 0 ? ms : null;
      } catch {
        return null;
      }
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
    if (typeof val._seconds === 'number') {
      return val._seconds * 1000;
    }
  }
  return null;
}

export function formatArabicDateTime(val: any, fallback = 'الآن'): string {
  const ms = safeParseTimestamp(val);
  if (!ms) return fallback;
  try {
    return new Date(ms).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

export function formatArabicDate(val: any, fallback = 'غير محدد'): string {
  const ms = safeParseTimestamp(val);
  if (!ms) return fallback;
  try {
    return new Date(ms).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return fallback;
  }
}

export function formatArabicTime(val: any, fallback = '--:--'): string {
  const ms = safeParseTimestamp(val);
  if (!ms) return fallback;
  try {
    return new Date(ms).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

export function formatRelativeArabicTime(val: any): string {
  const ms = safeParseTimestamp(val);
  if (!ms) return 'الآن';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'الآن';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} ي`;
  return formatArabicDate(ms, 'الآن');
}

export interface VipDurationInfo {
  isVipTier: boolean;
  isPermanent: boolean;
  isActive: boolean;
  isExpired: boolean;
  startedAt: number | null;
  expiresAt: number | null;
  durationDays: number;
  remainingDays: number;
  remainingHours: number;
  remainingLabel: string;
}

export function getVipDurationInfo(user?: Partial<User> | null, nowMs: number = Date.now()): VipDurationInfo {
  const role = user?.role;
  const isPermanent = role === 'owner' || role === 'super_admin' || role === 'admin';
  const isVipTier =
    role === 'vip_bronze' || role === 'vip_silver' || role === 'vip_gold' || role === 'vip_diamond';

  if (isPermanent) {
    return {
      isVipTier: false,
      isPermanent: true,
      isActive: true,
      isExpired: false,
      startedAt: safeParseTimestamp(user?.vipStartedAt),
      expiresAt: null,
      durationDays: 0,
      remainingDays: 9999,
      remainingHours: 0,
      remainingLabel: 'صلاحية دائمة',
    };
  }

  if (!isVipTier) {
    return {
      isVipTier: false,
      isPermanent: false,
      isActive: false,
      isExpired: false,
      startedAt: null,
      expiresAt: null,
      durationDays: DEFAULT_VIP_DURATION_DAYS,
      remainingDays: 0,
      remainingHours: 0,
      remainingLabel: 'عضوية عادية',
    };
  }

  const durationDays = Number(user?.vipDurationDays) > 0 ? Number(user?.vipDurationDays) : DEFAULT_VIP_DURATION_DAYS;
  const startedAt = safeParseTimestamp(user?.vipStartedAt);
  const explicitExpires = safeParseTimestamp(user?.vipExpiresAt);
  const expiresAt = explicitExpires || (startedAt ? startedAt + durationDays * 86400000 : null);

  if (!expiresAt) {
    return {
      isVipTier: true,
      isPermanent: false,
      isActive: true,
      isExpired: false,
      startedAt,
      expiresAt: null,
      durationDays,
      remainingDays: durationDays,
      remainingHours: 0,
      remainingLabel: `نشطة (${durationDays} يوماً)`,
    };
  }

  const diffMs = expiresAt - nowMs;
  if (diffMs <= 0) {
    return {
      isVipTier: true,
      isPermanent: false,
      isActive: false,
      isExpired: true,
      startedAt,
      expiresAt,
      durationDays,
      remainingDays: 0,
      remainingHours: 0,
      remainingLabel: 'منتهية الصلاحية',
    };
  }

  const remainingDays = Math.floor(diffMs / 86400000);
  const remainingHours = Math.max(1, Math.ceil((diffMs % 86400000) / 3600000));
  const remainingLabel =
    remainingDays >= 1
      ? `متبقي ${remainingDays} ${remainingDays === 1 ? 'يوم' : remainingDays <= 10 ? 'أيام' : 'يوماً'}`
      : `متبقي ${remainingHours} ساعة`;

  return {
    isVipTier: true,
    isPermanent: false,
    isActive: true,
    isExpired: false,
    startedAt,
    expiresAt,
    durationDays,
    remainingDays,
    remainingHours,
    remainingLabel,
  };
}
