import { User, UserRole } from '../types/chat';

export const PRIVILEGED_ROLES: UserRole[] = [
  'owner',
  'super_admin',
  'admin',
  'vip_diamond',
  'vip_gold',
  'vip_silver',
  'vip_bronze',
];

export function hasPrivilegedRank(role?: string | UserRole): boolean {
  if (!role) return false;
  return PRIVILEGED_ROLES.includes(role as UserRole);
}

export interface RankDisplayMeta {
  isPrivileged: boolean;
  label: string;
  shortIcon: string;
  badgeClass: string;
  nameColorClass: string;
  nameColorDarkClass: string;
  msgBgClass: string;
  msgBgDarkClass: string;
  msgBorderClass: string;
  frameGradient: string;
  frameAnimationClass: string;
  ringGlowClass: string;
}

export function getRankDisplayMeta(role?: UserRole | string, vipBadge?: string): RankDisplayMeta {
  switch (role) {
    case 'owner':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'المالك 👑',
        shortIcon: '👑',
        badgeClass: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-rose-500 text-slate-950 border-amber-300 shadow-sm',
        nameColorClass: 'text-amber-800 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-amber-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-owner shadow-[0_2px_10px_rgba(245,158,11,0.18)]',
        frameGradient: 'conic-gradient(from 0deg, #f59e0b, #fde047, #ec4899, #a855f7, #f59e0b)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-owner-glow',
      };
    case 'super_admin':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'إدارة عليا ⚡',
        shortIcon: '⚡',
        badgeClass: 'bg-gradient-to-r from-rose-600 to-amber-500 text-white border-rose-300 shadow-sm',
        nameColorClass: 'text-rose-700 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-rose-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-super-admin shadow-[0_2px_10px_rgba(225,29,72,0.16)]',
        frameGradient: 'conic-gradient(from 0deg, #e11d48, #f59e0b, #fb7185, #e11d48)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-owner-glow',
      };
    case 'admin':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'مشرف عام 🛡️',
        shortIcon: '🛡️',
        badgeClass: 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-indigo-300 shadow-2xs',
        nameColorClass: 'text-indigo-800 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-sky-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-admin shadow-[0_2px_10px_rgba(79,70,229,0.16)]',
        frameGradient: 'conic-gradient(from 0deg, #4f46e5, #0ea5e9, #818cf8, #4f46e5)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-diamond-glow',
      };
    case 'vip_diamond':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP ماسي 💎',
        shortIcon: '💎',
        badgeClass: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 text-white border-cyan-300 shadow-sm',
        nameColorClass: 'text-cyan-800 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-cyan-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-diamond shadow-[0_2px_10px_rgba(6,182,212,0.2)]',
        frameGradient: 'conic-gradient(from 0deg, #06b6d4, #38bdf8, #a855f7, #e879f9, #06b6d4)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-diamond-glow',
      };
    case 'vip_gold':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP ذهبي 👑',
        shortIcon: '🌟',
        badgeClass: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-300 shadow-2xs',
        nameColorClass: 'text-amber-800 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-amber-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-gold shadow-[0_2px_10px_rgba(217,119,6,0.18)]',
        frameGradient: 'conic-gradient(from 0deg, #d97706, #facc15, #fef08a, #d97706)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-gold-glow',
      };
    case 'vip_silver':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP فضي 🥈',
        shortIcon: '🥈',
        badgeClass: 'bg-gradient-to-r from-slate-400 to-slate-600 text-white border-slate-300 shadow-2xs',
        nameColorClass: 'text-slate-900 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-slate-200 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-silver shadow-[0_2px_8px_rgba(100,116,139,0.14)]',
        frameGradient: 'conic-gradient(from 0deg, #94a3b8, #e2e8f0, #64748b, #94a3b8)',
        frameAnimationClass: 'vip-frame-spin-slow',
        ringGlowClass: '',
      };
    case 'vip_bronze':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP برونزي 🥉',
        shortIcon: '🥉',
        badgeClass: 'bg-gradient-to-r from-orange-600 to-amber-700 text-white border-orange-300 shadow-2xs',
        nameColorClass: 'text-orange-800 font-black chat-text-outline-strong',
        nameColorDarkClass: 'text-orange-300 font-black chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: 'vip-msg-border vip-msg-border-bronze shadow-[0_2px_8px_rgba(234,88,12,0.15)]',
        frameGradient: 'conic-gradient(from 0deg, #c2410c, #fb923c, #ea580c, #c2410c)',
        frameAnimationClass: 'vip-frame-spin-slow',
        ringGlowClass: '',
      };
    default:
      // Strictly NO VIP badges or animated frames for regular members or guests
      return {
        isPrivileged: false,
        label: role === 'guest' ? 'زائر' : 'عضو',
        shortIcon: '',
        badgeClass: '',
        nameColorClass: 'text-slate-900 font-bold chat-text-outline-strong',
        nameColorDarkClass: 'text-slate-100 font-bold chat-text-outline-strong-dark',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: '',
        frameAnimationClass: '',
        ringGlowClass: '',
      };
  }
}

export interface ProfileBannerPreset {
  id: string;
  label: string;
  preview: string;
  style: string;
}

export const PROFILE_BANNER_PRESETS: ProfileBannerPreset[] = [
  {
    id: 'royal_gold',
    label: 'فخامة ذهبية ملكية 👑',
    preview: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #b45309 100%)',
    style: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #b45309 100%)',
  },
  {
    id: 'nile_night',
    label: 'ليل القاهرة الساحر 🌙',
    preview: 'linear-gradient(135deg, #090d16 0%, #1d4ed8 55%, #06b6d4 100%)',
    style: 'linear-gradient(135deg, #090d16 0%, #1d4ed8 55%, #06b6d4 100%)',
  },
  {
    id: 'crimson_velvet',
    label: 'مخمل قرمزي فاخر 🌹',
    preview: 'linear-gradient(135deg, #3b0764 0%, #9f1239 55%, #f59e0b 100%)',
    style: 'linear-gradient(135deg, #3b0764 0%, #9f1239 55%, #f59e0b 100%)',
  },
  {
    id: 'diamond_aurora',
    label: 'شفق الألماس 💎',
    preview: 'linear-gradient(135deg, #0f172a 0%, #0e7490 50%, #7c3aed 100%)',
    style: 'linear-gradient(135deg, #0f172a 0%, #0e7490 50%, #7c3aed 100%)',
  },
  {
    id: 'emerald_oasis',
    label: 'واحة الزمرد 🌿',
    preview: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #eab308 100%)',
    style: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #eab308 100%)',
  },
];

export function resolveBannerStyle(bannerValue?: string): React.CSSProperties | undefined {
  if (!bannerValue) return undefined;
  const trimmed = bannerValue.trim();
  if (!trimmed) return undefined;
  const preset = PROFILE_BANNER_PRESETS.find((p) => p.id === trimmed);
  if (preset) {
    return { backgroundImage: preset.style, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
    return { backgroundImage: `url("${trimmed}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (trimmed.startsWith('linear-gradient') || trimmed.startsWith('radial-gradient') || trimmed.startsWith('#')) {
    return { background: trimmed };
  }
  return undefined;
}

export function getLeaderboardScore(u: User): number {
  return (Number(u.ratingPoints) || 0) + Math.floor((Number(u.coins) || 0) / 25) + (Number(u.giftsReceivedCount) || 0) * 15;
}
