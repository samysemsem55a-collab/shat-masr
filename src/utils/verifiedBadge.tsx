import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { PRIMARY_OWNER_USERNAME } from '../data/seedData';

interface VerifiedBadgeProps {
  verified?: boolean;
  role?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  verified,
  role,
  size = 'sm',
  className = '',
}) => {
  const isVerified = Boolean(verified) || role === 'owner';
  if (!isVerified) return null;

  const sizeCls =
    size === 'xs'
      ? 'w-3.5 h-3.5'
      : size === 'md'
      ? 'w-4.5 h-4.5'
      : 'w-4 h-4';

  return (
    <span
      title="حساب موثق رسمياً"
      aria-label="حساب موثق"
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
    >
      <BadgeCheck className={`${sizeCls} text-sky-500 fill-sky-500/15 drop-shadow-[0_1px_2px_rgba(14,165,233,0.3)]`} />
    </span>
  );
};

const RESERVED_IMPERSONATION_TOKENS = [
  'shatmasr',
  'شات مصر',
  'المالك',
  'الادارة',
  'الإدارة',
  'إدارة شات مصر',
  'الدعم الرسمي',
  'official support',
  'system_bot',
];

/**
 * Checks whether a non-owner user is attempting to impersonate the official Owner or reserved support handles.
 */
export function checkImpersonationAttempt(
  displayName?: string,
  username?: string,
  role?: string,
  userId?: string
): { isImpersonation: boolean; reason?: string } {
  if (role === 'owner' || userId === 'usr_owner_1') {
    return { isImpersonation: false };
  }
  const cleanName = (displayName || '').trim().toLowerCase();
  const cleanUsername = (username || '').trim().toLowerCase();
  const ownerHandle = PRIMARY_OWNER_USERNAME.toLowerCase();

  if (cleanUsername === ownerHandle || cleanName === ownerHandle) {
    return {
      isImpersonation: true,
      reason: 'محاولة انتحال اسم أو معرف المالك الرسمي غير مسموح بها.',
    };
  }

  for (const token of RESERVED_IMPERSONATION_TOKENS) {
    if (cleanName.includes(token) || cleanUsername.includes(token)) {
      return {
        isImpersonation: true,
        reason: `الاسم يحتوي على صفة رسمية محجوزة ("${token}") مما يُعد انتحال شخصية.`,
      };
    }
  }

  return { isImpersonation: false };
}
