export interface StickerItem {
  id: string;
  emoji: string;
  label: string;
  category: 'animated' | 'static';
  animationClass?: string;
  bgGradient: string;
}

export const CURATED_EMOJIS: { label: string; emojis: string[] }[] = [
  {
    label: 'مشاعر وتفاعل',
    emojis: ['😀', '😂', '🤣', '🥹', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😊', '😉', '🤗', '🤔', '😴', '🥺']
  },
  {
    label: 'قلوب ومحبة',
    emojis: ['❤️', '🩷', '🧡', '💛', '💚', '💙', '💜', '🤍', '💖', '💝', '💘', '🫶', '🌹', '💐', '🌸', '✨']
  },
  {
    label: 'تحيات واحتفال',
    emojis: ['👋', '🤝', '👏', '🙌', '🙏', '🔥', '👑', '💎', '🎉', '🎊', '🎶', '☕', '🇪🇬', '🌙', '⭐', '💯']
  }
];

export const STICKERS_CATALOG: StickerItem[] = [
  // Animated stickers
  {
    id: 'stk_anim_heart',
    emoji: '❤️‍🔥',
    label: 'قلب نابض',
    category: 'animated',
    animationClass: 'animate-bounce',
    bgGradient: 'from-rose-50 to-pink-100 border-rose-200 text-rose-700'
  },
  {
    id: 'stk_anim_crown',
    emoji: '👑',
    label: 'تاج الملوك',
    category: 'animated',
    animationClass: 'animate-pulse',
    bgGradient: 'from-amber-50 to-yellow-100 border-amber-200 text-amber-700'
  },
  {
    id: 'stk_anim_party',
    emoji: '🥳',
    label: 'نورت المجلس!',
    category: 'animated',
    animationClass: 'animate-bounce',
    bgGradient: 'from-indigo-50 to-purple-100 border-indigo-200 text-indigo-700'
  },
  {
    id: 'stk_anim_laugh',
    emoji: '🤣',
    label: 'ضحكة من القلب',
    category: 'animated',
    animationClass: 'animate-bounce',
    bgGradient: 'from-emerald-50 to-teal-100 border-emerald-200 text-emerald-700'
  },
  {
    id: 'stk_anim_fire',
    emoji: '🔥',
    label: 'مولّع الشات',
    category: 'animated',
    animationClass: 'animate-pulse',
    bgGradient: 'from-orange-50 to-red-100 border-orange-200 text-orange-700'
  },
  {
    id: 'stk_anim_clap',
    emoji: '👏',
    label: 'أحلى تحية',
    category: 'animated',
    animationClass: 'animate-bounce',
    bgGradient: 'from-sky-50 to-blue-100 border-sky-200 text-sky-700'
  },
  // Static stickers
  {
    id: 'stk_static_egypt',
    emoji: '🇪🇬',
    label: 'تحيا مصر',
    category: 'static',
    bgGradient: 'from-red-50 to-amber-50 border-red-200 text-red-700'
  },
  {
    id: 'stk_static_coffee',
    emoji: '☕',
    label: 'أحلى قهوة',
    category: 'static',
    bgGradient: 'from-amber-50 to-orange-50 border-amber-200 text-amber-800'
  },
  {
    id: 'stk_static_rose',
    emoji: '🌹',
    label: 'بكل الود',
    category: 'static',
    bgGradient: 'from-pink-50 to-rose-50 border-pink-200 text-rose-700'
  },
  {
    id: 'stk_static_diamond',
    emoji: '💎',
    label: 'أصل الذوق',
    category: 'static',
    bgGradient: 'from-cyan-50 to-sky-50 border-cyan-200 text-cyan-700'
  },
  {
    id: 'stk_static_star',
    emoji: '🌟',
    label: 'نجم المجلس',
    category: 'static',
    bgGradient: 'from-yellow-50 to-amber-50 border-yellow-200 text-amber-700'
  },
  {
    id: 'stk_static_hug',
    emoji: '🫶',
    label: 'أهلاً وسهلاً',
    category: 'static',
    bgGradient: 'from-purple-50 to-fuchsia-50 border-purple-200 text-purple-700'
  }
];
