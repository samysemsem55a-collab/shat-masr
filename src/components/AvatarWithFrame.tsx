import React from 'react';
import { User } from '../types/chat';
import { getRankDisplayMeta, hasPrivilegedRank } from '../utils/userRanks';
import { isUserTrulyOnline } from '../utils/presenceStatus';

interface AvatarWithFrameProps {
  user?: Partial<User> | null;
  name?: string;
  avatar?: string;
  role?: User['role'] | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnlineDot?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarWithFrameProps['size']>, { outer: string; padding: string; text: string; dot: string; crown: string }> = {
  xs: { outer: 'w-7 h-7', padding: 'p-[2px]', text: 'text-[10px]', dot: 'w-2 h-2 border', crown: 'text-[9px] -top-1.5 -right-1' },
  sm: { outer: 'w-9 h-9', padding: 'p-[2px]', text: 'text-xs', dot: 'w-2.5 h-2.5 border-[1.5px]', crown: 'text-[10px] -top-1.5 -right-1' },
  md: { outer: 'w-11 h-11', padding: 'p-[2.5px]', text: 'text-sm', dot: 'w-3 h-3 border-2', crown: 'text-xs -top-1.5 -right-1' },
  lg: { outer: 'w-16 h-16', padding: 'p-[3px]', text: 'text-lg', dot: 'w-3.5 h-3.5 border-2', crown: 'text-sm -top-2 -right-1' },
  xl: { outer: 'w-24 h-24', padding: 'p-[3.5px]', text: 'text-2xl', dot: 'w-4 h-4 border-2', crown: 'text-base -top-2 -right-1' },
};

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  user,
  name,
  avatar,
  role,
  size = 'sm',
  showOnlineDot = false,
  onClick,
  className = '',
  title,
}) => {
  const effectiveName = name || user?.name || 'عضو';
  const effectiveAvatar = avatar ?? user?.avatar;
  const effectiveRole = role ?? user?.role;
  const isPrivileged = hasPrivilegedRank(effectiveRole);
  const rankMeta = getRankDisplayMeta(effectiveRole, user?.vipBadge);
  const dims = SIZE_CLASSES[size];

  const renderInnerImage = () => (
    <div className={`w-full h-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center font-black text-slate-700 ${dims.text}`}>
      {effectiveAvatar ? (
        <img
          src={effectiveAvatar}
          alt={effectiveName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{effectiveName.charAt(0)}</span>
      )}
    </div>
  );

  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative inline-flex items-center justify-center shrink-0 ${dims.outer} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {isPrivileged ? (
        <>
          {/* Rotating GPU-accelerated conic gradient ring strictly for VIP/Admin/Owner */}
          <span
            aria-hidden="true"
            style={{ background: rankMeta.frameGradient }}
            className={`absolute inset-0 rounded-full ${rankMeta.frameAnimationClass} ${rankMeta.ringGlowClass}`}
          />
          <div className={`relative w-full h-full rounded-full ${dims.padding}`}>
            <div className="w-full h-full rounded-full bg-white p-[1px]">
              {renderInnerImage()}
            </div>
          </div>
          {rankMeta.shortIcon && (size === 'md' || size === 'lg' || size === 'xl') && (
            <span
              className={`absolute ${dims.crown} z-10 select-none drop-shadow-sm pointer-events-none`}
              aria-hidden="true"
            >
              {rankMeta.shortIcon}
            </span>
          )}
        </>
      ) : (
        /* Clean plain circular avatar for regular members and guests */
        <div className="w-full h-full rounded-full border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
          {renderInnerImage()}
        </div>
      )}

      {showOnlineDot && isUserTrulyOnline(user) && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white shadow-xs z-10 ${dims.dot} ${
            user?.status === 'busy'
              ? 'bg-amber-500'
              : user?.status === 'dnd'
              ? 'bg-rose-500'
              : 'bg-emerald-500'
          }`}
        />
      )}
    </div>
  );
};
