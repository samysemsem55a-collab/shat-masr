import React from 'react';
import { Check, CheckCheck, Eye } from 'lucide-react';
import { Message } from '../types/chat';

interface MessageStatusIconProps {
  status?: Message['status'];
  variant?: 'room-light' | 'room-dark' | 'dm-sent' | 'dm-sticker';
  onRetry?: () => void;
}

export const MessageStatusIcon: React.FC<MessageStatusIconProps> = React.memo(({
  status = 'sent',
  variant = 'room-light',
  onRetry,
}) => {
  if (status === 'pending_offline' || status === 'failed') {
    const strokeColor = status === 'failed'
      ? (variant === 'dm-sent' ? 'text-rose-100' : 'text-rose-500')
      : (variant === 'dm-sent' ? 'text-slate-100/90' : 'text-slate-400');
    const titleText = status === 'failed'
      ? 'فشل الإرسال — اضغط لإعادة المحاولة'
      : 'لا يوجد اتصال بالإنترنت — بانتظار الاتصال';

    const content = (
      <span
        className={`inline-flex items-center gap-0.5 justify-center shrink-0 text-[11px] leading-none ${strokeColor} ${onRetry ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
        title={titleText}
        aria-label={titleText}
      >
        <span aria-hidden="true">🌍❌</span>
      </span>
    );

    if (onRetry) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="inline-flex items-center justify-center bg-transparent border-0 p-0 focus:outline-none"
          title={titleText}
        >
          {content}
        </button>
      );
    }
    return content;
  }

  if (status === 'seen' || status === 'read') {
    const eyeClass =
      variant === 'dm-sent'
        ? 'text-white'
        : variant === 'room-dark'
        ? 'text-sky-300'
        : 'text-sky-600';
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${eyeClass}`} title="تمت القراءة">
        <Eye className="w-3.5 h-3.5" strokeWidth={1.6} />
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
    <span className={`inline-flex items-center justify-center shrink-0 ${sentClass}`} title="تم الإرسال للسيرفر">
      <Check className="w-3 h-3" strokeWidth={2} />
    </span>
  );
});

MessageStatusIcon.displayName = 'MessageStatusIcon';
