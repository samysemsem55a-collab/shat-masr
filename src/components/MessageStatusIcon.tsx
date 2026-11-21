import React from 'react';
import { Check, CheckCheck, Eye } from 'lucide-react';
import { Message } from '../types/chat';

interface MessageStatusIconProps {
  status?: Message['status'];
  variant?: 'room-light' | 'room-dark' | 'dm-sent' | 'dm-sticker';
}

export const MessageStatusIcon: React.FC<MessageStatusIconProps> = React.memo(({
  status = 'sent',
  variant = 'room-light',
}) => {
  if (status === 'pending_offline') {
    const strokeColor = variant === 'dm-sent' ? 'text-slate-100/85' : 'text-slate-400';
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${strokeColor}`}
        title="لا يوجد اتصال بالإنترنت"
        aria-label="بانتظار الاتصال"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="w-3.5 h-3.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="7" cy="8" r="5" />
          <path d="M2.2 8h9.6" />
          <path d="M7 3c1.5 1.4 2.2 3.1 2.2 5S8.5 11.6 7 13" />
          <path d="M7 3C5.5 4.4 4.8 6.1 4.8 8S5.5 11.6 7 13" />
          <circle cx="12.5" cy="12" r="2.8" fill="currentColor" stroke="none" opacity="0.2" />
          <path d="M11 10.5l3 3M14 10.5l-3 3" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  if (status === 'read') {
    const eyeClass =
      variant === 'dm-sent'
        ? 'text-white'
        : variant === 'room-dark'
        ? 'text-sky-300'
        : 'text-sky-600';
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${eyeClass}`} title="تمت القراءة">
        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
      </span>
    );
  }

  if (status === 'delivered') {
    const checkClass =
      variant === 'dm-sent'
        ? 'text-white/95'
        : variant === 'room-dark'
        ? 'text-sky-200'
        : 'text-sky-600';
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${checkClass}`} title="تم الاستلام">
        <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.8} />
      </span>
    );
  }

  // 'sent'
  const sentClass =
    variant === 'dm-sent'
      ? 'text-white/85'
      : variant === 'room-dark'
      ? 'text-slate-300'
      : 'text-slate-500';
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${sentClass}`} title="تم الإرسال">
      <Check className="w-3 h-3" strokeWidth={2} />
    </span>
  );
});

MessageStatusIcon.displayName = 'MessageStatusIcon';
