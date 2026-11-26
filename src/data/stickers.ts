export interface StickerItem {
  id: string;
  emoji: string;
  label: string;
  category: 'animated' | 'static';
  gifUrl: string;
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

export const ANIMATED_GIF_STICKERS: StickerItem[] = [
  {
    id: 'gif_heart',
    emoji: '❤️',
    label: 'قلب نابض',
    category: 'animated',
    gifUrl: '/animated-emojis/heart.gif',
    bgGradient: 'from-rose-50 to-pink-100 border-rose-200 text-rose-700'
  },
  {
    id: 'gif_fire',
    emoji: '🔥',
    label: 'نار مشتعلة',
    category: 'animated',
    gifUrl: '/animated-emojis/fire.gif',
    bgGradient: 'from-orange-50 to-red-100 border-orange-200 text-orange-700'
  },
  {
    id: 'gif_laugh',
    emoji: '🤣',
    label: 'ضحكة من القلب',
    category: 'animated',
    gifUrl: '/animated-emojis/laugh.gif',
    bgGradient: 'from-amber-50 to-yellow-100 border-amber-200 text-amber-700'
  },
  {
    id: 'gif_heart_eyes',
    emoji: '😍',
    label: 'عيون القلوب',
    category: 'animated',
    gifUrl: '/animated-emojis/heart_eyes.gif',
    bgGradient: 'from-pink-50 to-rose-100 border-pink-200 text-rose-700'
  },
  {
    id: 'gif_crown',
    emoji: '👑',
    label: 'تاج الملوك',
    category: 'animated',
    gifUrl: '/animated-emojis/crown.gif',
    bgGradient: 'from-amber-50 to-yellow-100 border-amber-200 text-amber-700'
  },
  {
    id: 'gif_rose',
    emoji: '🌹',
    label: 'وردة متفتحة',
    category: 'animated',
    gifUrl: '/animated-emojis/rose.gif',
    bgGradient: 'from-rose-50 to-emerald-50 border-rose-200 text-rose-700'
  },
  {
    id: 'gif_sparkle',
    emoji: '✨',
    label: 'بريق ولمعان',
    category: 'animated',
    gifUrl: '/animated-emojis/sparkle.gif',
    bgGradient: 'from-yellow-50 to-amber-100 border-yellow-200 text-amber-700'
  },
  {
    id: 'gif_clap',
    emoji: '👏',
    label: 'تصفيق حار',
    category: 'animated',
    gifUrl: '/animated-emojis/clap.gif',
    bgGradient: 'from-sky-50 to-blue-100 border-sky-200 text-sky-700'
  },
  {
    id: 'gif_party',
    emoji: '🎉',
    label: 'احتفال وبهجة',
    category: 'animated',
    gifUrl: '/animated-emojis/party.gif',
    bgGradient: 'from-indigo-50 to-purple-100 border-indigo-200 text-indigo-700'
  },
  {
    id: 'gif_diamond',
    emoji: '💎',
    label: 'ألماس لامع',
    category: 'animated',
    gifUrl: '/animated-emojis/diamond.gif',
    bgGradient: 'from-cyan-50 to-sky-100 border-cyan-200 text-cyan-700'
  },
  {
    id: 'gif_kiss',
    emoji: '😘',
    label: 'قبلة طائرة',
    category: 'animated',
    gifUrl: '/animated-emojis/kiss.gif',
    bgGradient: 'from-rose-50 to-fuchsia-100 border-rose-200 text-rose-700'
  },
  {
    id: 'gif_star',
    emoji: '🤩',
    label: 'انبهار النجوم',
    category: 'animated',
    gifUrl: '/animated-emojis/star.gif',
    bgGradient: 'from-amber-50 to-orange-100 border-amber-200 text-amber-700'
  },
  {
    id: 'gif_hundred',
    emoji: '💯',
    label: 'مية بالمية',
    category: 'animated',
    gifUrl: '/animated-emojis/hundred.gif',
    bgGradient: 'from-red-50 to-rose-100 border-red-200 text-red-700'
  },
  {
    id: 'gif_hug',
    emoji: '🫶',
    label: 'محبة ومودة',
    category: 'animated',
    gifUrl: '/animated-emojis/hug.gif',
    bgGradient: 'from-purple-50 to-pink-100 border-purple-200 text-purple-700'
  },
  {
    id: 'gif_cool',
    emoji: '😎',
    label: 'رايق وواثق',
    category: 'animated',
    gifUrl: '/animated-emojis/cool.gif',
    bgGradient: 'from-sky-50 to-indigo-100 border-sky-200 text-indigo-700'
  },
  {
    id: 'gif_thumbs',
    emoji: '👍',
    label: 'تمام التمام',
    category: 'animated',
    gifUrl: '/animated-emojis/thumbs.gif',
    bgGradient: 'from-emerald-50 to-sky-100 border-emerald-200 text-emerald-700'
  }
];

export const STICKERS_CATALOG: StickerItem[] = ANIMATED_GIF_STICKERS;
