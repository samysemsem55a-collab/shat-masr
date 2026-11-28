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
  namePillClass: string;
  namePillDarkClass: string;
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
        badgeClass: 'bg-gradient-to-r from-amber-500/90 via-yellow-400/90 to-rose-500/90 text-slate-950 border-amber-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-owner font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-owner font-black',
        namePillClass: 'bg-amber-100/70 border border-amber-300/70 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-amber-500/15 border border-amber-400/40 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #f59e0b, #fde047, #ec4899, #a855f7, #f59e0b)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-owner-glow',
      };
    case 'super_admin':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'إدارة عليا ⚡',
        shortIcon: '⚡',
        badgeClass: 'bg-gradient-to-r from-rose-600/90 to-amber-500/90 text-white border-rose-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-super font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-super font-black',
        namePillClass: 'bg-rose-100/65 border border-rose-300/60 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-rose-500/15 border border-rose-400/40 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #e11d48, #f59e0b, #fb7185, #e11d48)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-owner-glow',
      };
    case 'admin':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'مشرف عام 🛡️',
        shortIcon: '🛡️',
        badgeClass: 'bg-gradient-to-r from-sky-600/90 to-indigo-500/90 text-white border-sky-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-admin font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-admin font-black',
        namePillClass: 'bg-sky-100/70 border border-sky-300/60 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-sky-500/15 border border-sky-400/40 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #0284c7, #38bdf8, #818cf8, #0284c7)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-diamond-glow',
      };
    case 'vip_diamond':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP ماسي 💎',
        shortIcon: '💎',
        badgeClass: 'bg-gradient-to-r from-cyan-500/90 via-sky-500/90 to-indigo-500/90 text-white border-cyan-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-diamond font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-diamond font-black',
        namePillClass: 'bg-cyan-100/70 border border-cyan-300/60 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-cyan-500/15 border border-cyan-400/40 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #06b6d4, #38bdf8, #a855f7, #e879f9, #06b6d4)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-diamond-glow',
      };
    case 'vip_gold':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP ذهبي 👑',
        shortIcon: '🌟',
        badgeClass: 'bg-gradient-to-r from-amber-400/90 to-yellow-500/90 text-slate-950 border-amber-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-gold font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-gold font-black',
        namePillClass: 'bg-amber-100/65 border border-amber-300/60 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-amber-500/15 border border-amber-400/35 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #d97706, #facc15, #fef08a, #d97706)',
        frameAnimationClass: 'vip-frame-spin',
        ringGlowClass: 'vip-gold-glow',
      };
    case 'vip_silver':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP فضي 🥈',
        shortIcon: '🥈',
        badgeClass: 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-slate-300 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-silver font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-silver font-black',
        namePillClass: 'bg-slate-200/70 border border-slate-300/80 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-slate-600/25 border border-slate-400/40 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #94a3b8, #e2e8f0, #64748b, #94a3b8)',
        frameAnimationClass: 'vip-frame-spin-slow',
        ringGlowClass: '',
      };
    case 'vip_bronze':
      return {
        isPrivileged: true,
        label: vipBadge && !vipBadge.includes('زائر') ? vipBadge : 'VIP برونزي 🥉',
        shortIcon: '🥉',
        badgeClass: 'bg-gradient-to-r from-orange-600/90 to-amber-700/90 text-white border-orange-300/80 shadow-2xs',
        nameColorClass: 'featured-name-shimmer featured-shimmer-bronze font-black',
        nameColorDarkClass: 'featured-name-shimmer featured-shimmer-bronze font-black',
        namePillClass: 'bg-orange-100/65 border border-orange-300/60 px-1.5 py-0.5 rounded-md',
        namePillDarkClass: 'bg-orange-500/15 border border-orange-400/35 px-1.5 py-0.5 rounded-md',
        msgBgClass: '',
        msgBgDarkClass: '',
        msgBorderClass: '',
        frameGradient: 'conic-gradient(from 0deg, #c2410c, #fb923c, #ea580c, #c2410c)',
        frameAnimationClass: 'vip-frame-spin-slow',
        ringGlowClass: '',
      };
    default:
      // Strictly NO VIP badges, NO background pill, NO shimmer for regular members or guests
      return {
        isPrivileged: false,
        label: role === 'guest' ? 'زائر' : 'عضو',
        shortIcon: '',
        badgeClass: '',
        nameColorClass: 'text-slate-900 font-bold',
        nameColorDarkClass: 'text-slate-100 font-bold',
        namePillClass: '',
        namePillDarkClass: '',
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
