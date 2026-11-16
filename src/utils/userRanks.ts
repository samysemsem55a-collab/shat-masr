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
        nameColorClass: 'text-amber-700 font-black drop-shadow-2xs',
        nameColorDarkClass: 'text-amber-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-amber-50/90 via-yellow-50/75 to-transparent border-r-2 border-amber-400',
        msgBgDarkClass: 'bg-amber-500/15 border-r-2 border-amber-400',
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
        nameColorClass: 'text-rose-600 font-black',
        nameColorDarkClass: 'text-rose-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-rose-50/85 to-transparent border-r-2 border-rose-400',
        msgBgDarkClass: 'bg-rose-500/15 border-r-2 border-rose-400',
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
        nameColorClass: 'text-indigo-700 font-black',
        nameColorDarkClass: 'text-sky-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-indigo-50/80 to-transparent border-r-2 border-indigo-400',
        msgBgDarkClass: 'bg-indigo-500/15 border-r-2 border-indigo-400',
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
        nameColorClass: 'text-cyan-700 font-black',
        nameColorDarkClass: 'text-cyan-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-cyan-50/85 via-purple-50/60 to-transparent border-r-2 border-cyan-400',
        msgBgDarkClass: 'bg-cyan-500/15 border-r-2 border-cyan-400',
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
        nameColorClass: 'text-amber-700 font-black',
        nameColorDarkClass: 'text-amber-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-amber-50/80 to-transparent border-r-2 border-amber-400',
        msgBgDarkClass: 'bg-amber-500/15 border-r-2 border-amber-400',
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
        nameColorClass: 'text-slate-700 font-black',
        nameColorDarkClass: 'text-slate-200 font-black',
        msgBgClass: 'bg-gradient-to-l from-slate-100/80 to-transparent border-r-2 border-slate-400',
        msgBgDarkClass: 'bg-slate-400/15 border-r-2 border-slate-300',
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
        nameColorClass: 'text-orange-700 font-black',
        nameColorDarkClass: 'text-orange-300 font-black',
        msgBgClass: 'bg-gradient-to-l from-orange-50/75 to-transparent border-r-2 border-orange-400',
        msgBgDarkClass: 'bg-orange-500/15 border-r-2 border-orange-400',
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
        nameColorClass: 'text-slate-800 font-bold',
        nameColorDarkClass: 'text-slate-100 font-bold',
        msgBgClass: '',
        msgBgDarkClass: '',
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
