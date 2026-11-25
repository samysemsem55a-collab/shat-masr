import { ChatWallpaper } from '../types/chat';

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: 'wp_white_gold_doodle',
    name: 'نقوش ذهبية على خلفية بيضاء 👑',
    description: 'خلفية بيضاء راقية برسومات ونقوش ذهبية هادئة مريحة وواضحة للمحادثات الخاصة.',
    thumbnail: '👑',
    style: {
      backgroundColor: '#ffffff',
      backgroundImage: "url('/assets/wallpapers/chat_doodle_gold.svg')",
      backgroundSize: '240px 240px',
      backgroundRepeat: 'repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'الخلفية الرسمية'
  },
  {
    id: 'wp_nature_nile_sunset',
    name: 'غروب النيل الساحر 🌅',
    description: 'منظر طبيعي خلاب لغروب الشمس الذهبي على ضفاف نهر النيل والمراكب الشراعية.',
    thumbnail: '🌅',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.25), rgba(15, 23, 42, 0.45)), url('/assets/wallpapers/nature_nile_sunset.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مناظر طبيعية 🌿'
  },
  {
    id: 'wp_nature_green_meadow',
    name: 'المساحات الخضراء والربيع 🌿',
    description: 'مروج خضراء هادئة تحت ضوء الصباح المريح للعين.',
    thumbnail: '🌿',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.40)), url('/assets/wallpapers/nature_green_meadow.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مناظر طبيعية 🌿'
  },
  {
    id: 'wp_nature_clear_sky',
    name: 'السماء الصافية والغيوم ☁️',
    description: 'سماء زرقاء صافية وغيوم بيضاء ناعمة تضفي هدوءاً وصفاءً على المحادثة.',
    thumbnail: '☁️',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.34)), url('/assets/wallpapers/nature_clear_sky.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مناظر طبيعية 🌿'
  },
  {
    id: 'wp_nature_starry_oasis',
    name: 'سماء الواحة المرصعة بالنجوم 🌌',
    description: 'أجواء ليلية طبيعية هادئة تحت السماء والنجوم وانعكاس القمر على المياه.',
    thumbnail: '🌌',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(8, 12, 21, 0.35), rgba(8, 12, 21, 0.55)), url('/assets/wallpapers/nature_starry_oasis.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مناظر طبيعية 🌿'
  },
  {
    id: 'wp_doodle_custom',
    name: 'نقوش وتطريز الشات الرسمية 💬',
    description: 'الخلفية الكلاسيكية بنقوش ورسومات التطريز الهادئة للمحادثات الخاصة.',
    thumbnail: '💬',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(13, 20, 36, 0.45), rgba(13, 20, 36, 0.60)), url('/assets/wallpapers/chat_doodle_custom.jpg')",
      backgroundColor: '#f1f5f9',
      backgroundSize: '340px',
      backgroundRepeat: 'repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'نقوش كلاسيكية'
  },
  {
    id: 'wp_egypt_gold',
    name: 'أهرامات الجيزة وسحر النيل 🏺',
    description: 'الخلفية الأيقونية المستوحاة من حضارة مصر والأهرامات الذهبية ونهر النيل الخالد.',
    thumbnail: '🏺',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(8, 12, 21, 0.40), rgba(8, 12, 21, 0.68)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مجاني للجميع'
  },
  {
    id: 'wp_egypt_sunset',
    name: 'غروب ولاد البلد الذهبي 🌅',
    description: 'دفء شمس الأصيل على ضفاف النيل مع لمسات دافئة تمنح المحادثات هيبة وألفة.',
    thumbnail: '🌅',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(124, 45, 18, 0.36), rgba(8, 12, 21, 0.68)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مجاني للجميع'
  },
  {
    id: 'wp_doodle_arab',
    name: 'النقوش والزخارف الشرقية 🕌',
    description: 'زخارف إسلامية وشرقية مرسومة بنعومة تعكس روح المجالس العربية التراثية الأصيلة.',
    thumbnail: '🕌',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(8, 12, 21, 0.88), rgba(8, 12, 21, 0.94)), url('/assets/wallpapers/doodle_chat_bg.jpg')",
      backgroundSize: '340px',
      backgroundRepeat: 'repeat'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مجاني للجميع'
  },
  {
    id: 'wp_cairo_night',
    name: 'سحر كورنيش القاهرة وبرج الجزيرة ليلاً 🗼',
    description: 'أضواء القاهرة الساهرة على النيل وبرج القاهرة المتلألئ بتدرجات النيلي والأصفر الذهبي.',
    thumbnail: '🗼',
    style: {
      backgroundImage: "radial-gradient(ellipse at 50% 100%, rgba(217, 119, 6, 0.28), transparent 60%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.25), transparent 45%), linear-gradient(180deg, #070a12 0%, #0d1322 50%, #151b2e 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 150,
    isPremium: true,
    tag: 'أجواء ليلية ساحرة'
  },
  {
    id: 'wp_royal_palace',
    name: 'قصر عابدين والعروبة الملكية 👑',
    description: 'فخامة ملكية مستوحاة من قصور مصر التاريخية بالزمرد الأخضر والذهب الخالص.',
    thumbnail: '👑',
    style: {
      backgroundImage: "radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.25), transparent 50%), radial-gradient(circle at 10% 90%, rgba(16, 185, 129, 0.2), transparent 40%), linear-gradient(180deg, #051614 0%, #08241f 50%, #041210 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 250,
    isPremium: true,
    tag: 'طابع ملكي VIP'
  },
  {
    id: 'wp_alex_turquoise',
    name: 'سحر عروس المتوسط والإسكندرية 🌊',
    description: 'أمواج الإسكندرية الفيروزية وزرقة البحر الأبيض المتوسط بروح صيفية منعشة.',
    thumbnail: '🌊',
    style: {
      backgroundImage: "radial-gradient(circle at 50% 10%, rgba(6, 182, 212, 0.25), transparent 60%), linear-gradient(180deg, #051524 0%, #09253d 50%, #03101c 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 200,
    isPremium: true,
    tag: 'أجواء ساحلية منعشة'
  },
  {
    id: 'wp_desert_stars',
    name: 'ليالي البادية والنجوم والرمال ⛺',
    description: 'هدوء رمال البادية تحت قبة سماوية مرصعة بملايين النجوم اللامعة.',
    thumbnail: '⛺',
    style: {
      backgroundImage: "radial-gradient(ellipse at 50% 80%, rgba(217, 119, 6, 0.2), transparent 50%), radial-gradient(circle at 30% 20%, rgba(168, 85, 247, 0.2), transparent 40%), linear-gradient(180deg, #0b0d19 0%, #171126 50%, #0b0714 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 200,
    isPremium: true,
    tag: 'هدوء وسكون الصحراء'
  },
  {
    id: 'wp_fatimid_heritage',
    name: 'قناديل المعز والقاهرة الفاطمية 🏮',
    description: 'دفء الفوانيس النحاسية العتيقة بين أروقة شارع المعز وخان الخليلي التراثي.',
    thumbnail: '🏮',
    style: {
      backgroundImage: "radial-gradient(circle at 50% 30%, rgba(251, 146, 60, 0.28), transparent 45%), radial-gradient(circle at 80% 80%, rgba(234, 88, 12, 0.15), transparent 40%), linear-gradient(180deg, #180d09 0%, #26140e 50%, #120906 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 300,
    isPremium: true,
    tag: 'تراث أصيل وقناديل'
  },
  {
    id: 'wp_minimal_dark',
    name: 'النمط الكلاسيكي الداكن (Obsidian) 🖤',
    description: 'تصميم فائق النقاء والأناقة باللون الأسود الملكي العميق المريح لعين القارئ.',
    thumbnail: '🖤',
    style: {
      backgroundImage: "linear-gradient(180deg, #060911 0%, #0b101d 100%)",
      backgroundSize: 'cover'
    },
    priceCoins: 0,
    isPremium: false,
    tag: 'مريح للعين'
  }
];

export const DEFAULT_CHAT_WALLPAPER_ID = 'wp_white_gold_doodle';

export function getWallpaperStyleById(wallpaperId?: string): React.CSSProperties {
  if (!wallpaperId) return CHAT_WALLPAPERS[0].style;
  const found = CHAT_WALLPAPERS.find(w => w.id === wallpaperId);
  return found ? found.style : CHAT_WALLPAPERS[0].style;
}

export interface RoomBackgroundTheme {
  id: string;
  name: string;
  category: 'default' | 'nature' | 'gradient' | 'solid';
  previewLabel: string;
  style: React.CSSProperties;
  isDark?: boolean;
}

export const ROOM_BACKGROUND_THEMES: RoomBackgroundTheme[] = [
  {
    id: 'default',
    name: 'الخلفية الرسمية الافتراضية',
    category: 'default',
    previewLabel: 'افتراضي',
    style: {},
    isDark: false
  },
  // Natural Landscape Backgrounds
  {
    id: 'nature_nile_sunset',
    name: 'غروب النيل الطبيعي 🌅',
    category: 'nature',
    previewLabel: 'طبيعة • غروب',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.55)), url('/assets/wallpapers/nature_nile_sunset.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    },
    isDark: true
  },
  {
    id: 'nature_green_meadow',
    name: 'المروج الخضراء 🌿',
    category: 'nature',
    previewLabel: 'طبيعة • أخضر',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.35), rgba(240, 253, 244, 0.5)), url('/assets/wallpapers/nature_green_meadow.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    },
    isDark: false
  },
  {
    id: 'nature_clear_sky',
    name: 'السماء الصافية والغيوم ☁️',
    category: 'nature',
    previewLabel: 'طبيعة • سماء',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.38), rgba(239, 246, 255, 0.55)), url('/assets/wallpapers/nature_clear_sky.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    },
    isDark: false
  },
  {
    id: 'nature_starry_oasis',
    name: 'سماء النجوم والواحة 🌌',
    category: 'nature',
    previewLabel: 'طبيعة • ليل',
    style: {
      backgroundImage: "linear-gradient(to bottom, rgba(8, 12, 21, 0.4), rgba(8, 12, 21, 0.62)), url('/assets/wallpapers/nature_starry_oasis.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    },
    isDark: true
  },
  // Attractive Gradients (Light & Luminous)
  {
    id: 'grad_turquoise_breeze',
    name: 'نسيم الفيروز الساحلي',
    category: 'gradient',
    previewLabel: 'تدرج فيروزي',
    style: {
      background: 'linear-gradient(135deg, #ecfeff 0%, #d1fae5 48%, #e0f2fe 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_peach_sunset',
    name: 'غروب الخوخ والورد',
    category: 'gradient',
    previewLabel: 'تدرج دافئ',
    style: {
      background: 'linear-gradient(135deg, #fff1f2 0%, #ffedd5 50%, #fef3c7 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_alexandria_sky',
    name: 'سماء الإسكندرية الصافية',
    category: 'gradient',
    previewLabel: 'تدرج سماوي',
    style: {
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 50%, #e0f2fe 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_lavender_dream',
    name: 'لافندر حالم',
    category: 'gradient',
    previewLabel: 'تدرج بنفسجي',
    style: {
      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #fce7f3 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_spring_mint',
    name: 'نعناع الربيع المنعش',
    category: 'gradient',
    previewLabel: 'تدرج نعناعي',
    style: {
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #ccfbf1 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_golden_honey',
    name: 'ذهب وعسل دافئ',
    category: 'gradient',
    previewLabel: 'تدرج ذهبي',
    style: {
      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)'
    },
    isDark: false
  },
  {
    id: 'grad_royal_midnight',
    name: 'ليالي القاهرة الملكية',
    category: 'gradient',
    previewLabel: 'تدرج ليلي فاخر',
    style: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 52%, #172554 100%)'
    },
    isDark: true
  },
  {
    id: 'grad_emerald_palace',
    name: 'قصر الزمرد الليلي',
    category: 'gradient',
    previewLabel: 'تدرج زمردي داكن',
    style: {
      background: 'linear-gradient(135deg, #022c22 0%, #064e3b 52%, #0f172a 100%)'
    },
    isDark: true
  },
  {
    id: 'grad_velvet_plum',
    name: 'مخمل الياقوت الداكن',
    category: 'gradient',
    previewLabel: 'تدرج مخملي',
    style: {
      background: 'linear-gradient(135deg, #2e1065 0%, #581c87 50%, #4c0519 100%)'
    },
    isDark: true
  },
  // Attractive Solid Colors
  {
    id: 'solid_pearl_white',
    name: 'أبيض لؤلؤي نقي',
    category: 'solid',
    previewLabel: 'لون نقي',
    style: {
      backgroundColor: '#ffffff'
    },
    isDark: false
  },
  {
    id: 'solid_warm_ivory',
    name: 'عاجي دافئ مريح',
    category: 'solid',
    previewLabel: 'لون دافئ',
    style: {
      backgroundColor: '#fef9ef'
    },
    isDark: false
  },
  {
    id: 'solid_soft_sky',
    name: 'أزرق سماوي هادئ',
    category: 'solid',
    previewLabel: 'لون سماوي',
    style: {
      backgroundColor: '#eef6ff'
    },
    isDark: false
  },
  {
    id: 'solid_soft_mint',
    name: 'أخضر نعناعي رقيق',
    category: 'solid',
    previewLabel: 'لون نعناعي',
    style: {
      backgroundColor: '#ecfdf5'
    },
    isDark: false
  },
  {
    id: 'solid_soft_rose',
    name: 'وردي باستيل ناعم',
    category: 'solid',
    previewLabel: 'لون وردي',
    style: {
      backgroundColor: '#fff1f5'
    },
    isDark: false
  },
  {
    id: 'solid_obsidian_night',
    name: 'كحلي ليلي أنيق',
    category: 'solid',
    previewLabel: 'لون ليلي',
    style: {
      backgroundColor: '#0f172a'
    },
    isDark: true
  }
];

export function getRoomBackgroundThemeById(themeId?: string): RoomBackgroundTheme | undefined {
  if (!themeId || themeId === 'default') return undefined;
  return ROOM_BACKGROUND_THEMES.find(t => t.id === themeId);
}

export interface NotificationBgPreset {
  id: string;
  name: string;
  badge: string;
  background: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  shimmerColor: string;
  previewSwatch: string;
  isDark?: boolean;
}

export const DEFAULT_NOTIFICATION_BG_PRESET_ID = 'notif_amber_cream';
export const NIGHT_DEFAULT_NOTIFICATION_BG_PRESET_ID = 'notif_midnight_sapphire';

export function getDefaultNotificationBgPresetIdForTime(date: Date = new Date()): string {
  const hour = date.getHours();
  // Daytime (06:00 - 17:59): warm sunny light preset ("ذهبي كريمي")
  // Nighttime (18:00 - 05:59): dark night preset from the bottom two presets ("ياقوت ليلي" / ليلي)
  return hour >= 6 && hour < 18
    ? DEFAULT_NOTIFICATION_BG_PRESET_ID
    : NIGHT_DEFAULT_NOTIFICATION_BG_PRESET_ID;
}

// Exactly 10 curated high-contrast notification background presets
export const NOTIFICATION_BG_PRESETS: NotificationBgPreset[] = [
  {
    id: 'notif_sky_pearl',
    name: 'سماوي لؤلؤي',
    badge: 'لؤلؤي',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #eef2ff 52%, #ecfeff 100%)',
    borderColor: '#7dd3fc',
    textColor: '#0c4a6e',
    dotColor: '#10b981',
    shimmerColor: 'rgba(255, 255, 255, 0.72)',
    previewSwatch: 'linear-gradient(135deg, #bae6fd 0%, #c7d2fe 100%)',
    isDark: false,
  },
  {
    id: 'notif_amber_cream',
    name: 'ذهبي كريمي',
    badge: 'دافئ',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 55%, #ffedd5 100%)',
    borderColor: '#fcd34d',
    textColor: '#78350f',
    dotColor: '#d97706',
    shimmerColor: 'rgba(255, 255, 255, 0.75)',
    previewSwatch: 'linear-gradient(135deg, #fde68a 0%, #fed7aa 100%)',
    isDark: false,
  },
  {
    id: 'notif_emerald_mint',
    name: 'نعناع زمردي',
    badge: 'منعش',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 55%, #ccfbf1 100%)',
    borderColor: '#6ee7b7',
    textColor: '#064e3b',
    dotColor: '#059669',
    shimmerColor: 'rgba(255, 255, 255, 0.74)',
    previewSwatch: 'linear-gradient(135deg, #a7f3d0 0%, #99f6e4 100%)',
    isDark: false,
  },
  {
    id: 'notif_rose_blossom',
    name: 'وردي باستيل',
    badge: 'ناعم',
    background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 55%, #fce7f3 100%)',
    borderColor: '#fda4af',
    textColor: '#881337',
    dotColor: '#e11d48',
    shimmerColor: 'rgba(255, 255, 255, 0.72)',
    previewSwatch: 'linear-gradient(135deg, #fecdd3 0%, #fbcfe8 100%)',
    isDark: false,
  },
  {
    id: 'notif_lavender_silk',
    name: 'لافندر حريري',
    badge: 'هادئ',
    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 55%, #fae8ff 100%)',
    borderColor: '#c4b5fd',
    textColor: '#4c1d95',
    dotColor: '#7c3aed',
    shimmerColor: 'rgba(255, 255, 255, 0.72)',
    previewSwatch: 'linear-gradient(135deg, #ddd6fe 0%, #f5d0fe 100%)',
    isDark: false,
  },
  {
    id: 'notif_sunset_coral',
    name: 'شفق مرجاني',
    badge: 'مشرق',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 52%, #ffe4e6 100%)',
    borderColor: '#fdba74',
    textColor: '#7c2d12',
    dotColor: '#ea580c',
    shimmerColor: 'rgba(255, 255, 255, 0.74)',
    previewSwatch: 'linear-gradient(135deg, #fed7aa 0%, #fecdd3 100%)',
    isDark: false,
  },
  {
    id: 'notif_aqua_breeze',
    name: 'نسيم فيروزي',
    badge: 'صافي',
    background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 55%, #e0f2fe 100%)',
    borderColor: '#67e8f9',
    textColor: '#164e63',
    dotColor: '#0891b2',
    shimmerColor: 'rgba(255, 255, 255, 0.74)',
    previewSwatch: 'linear-gradient(135deg, #a5f3fc 0%, #bae6fd 100%)',
    isDark: false,
  },
  {
    id: 'notif_champagne_gold',
    name: 'شامبانيا ملكي',
    badge: 'فخم',
    background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 52%, #fde68a 100%)',
    borderColor: '#eab308',
    textColor: '#713f12',
    dotColor: '#ca8a04',
    shimmerColor: 'rgba(255, 255, 255, 0.78)',
    previewSwatch: 'linear-gradient(135deg, #fef08a 0%, #fcd34d 100%)',
    isDark: false,
  },
  {
    id: 'notif_midnight_sapphire',
    name: 'ياقوت ليلي',
    badge: 'ليلي',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #1d4ed8 100%)',
    borderColor: '#818cf8',
    textColor: '#f8fafc',
    dotColor: '#38bdf8',
    shimmerColor: 'rgba(255, 255, 255, 0.28)',
    previewSwatch: 'linear-gradient(135deg, #1e1b4b 0%, #1d4ed8 100%)',
    isDark: true,
  },
  {
    id: 'notif_obsidian_emerald',
    name: 'زمرد ليلي',
    badge: 'أنيق',
    background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #0f172a 100%)',
    borderColor: '#34d399',
    textColor: '#ecfdf5',
    dotColor: '#34d399',
    shimmerColor: 'rgba(255, 255, 255, 0.26)',
    previewSwatch: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
    isDark: true,
  },
];

export function getNotificationBgPresetById(presetId?: string): NotificationBgPreset {
  if (presetId) {
    const found = NOTIFICATION_BG_PRESETS.find((p) => p.id === presetId);
    if (found) return found;
  }
  return (
    NOTIFICATION_BG_PRESETS.find((p) => p.id === getDefaultNotificationBgPresetIdForTime()) ||
    NOTIFICATION_BG_PRESETS[1]
  );
}

export function hasSavedCustomNotificationBgPreset(
  user?: { id?: string; notificationBgPreset?: string } | null
): boolean {
  if (
    user?.notificationBgPreset &&
    NOTIFICATION_BG_PRESETS.some((p) => p.id === user.notificationBgPreset)
  ) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const userScoped = user?.id ? localStorage.getItem(`shat_masr_notif_bg_preset_${user.id}`) : null;
      const globalVal = localStorage.getItem('shat_masr_notif_bg_preset');
      const candidate = userScoped || globalVal || '';
      if (candidate && NOTIFICATION_BG_PRESETS.some((p) => p.id === candidate)) {
        return true;
      }
    } catch {}
  }
  return false;
}

export function readSavedNotificationBgPresetId(
  user?: { id?: string; notificationBgPreset?: string } | null
): string {
  if (user?.notificationBgPreset && NOTIFICATION_BG_PRESETS.some((p) => p.id === user.notificationBgPreset)) {
    return user.notificationBgPreset;
  }
  if (typeof window !== 'undefined') {
    try {
      const userScoped = user?.id ? localStorage.getItem(`shat_masr_notif_bg_preset_${user.id}`) : null;
      const globalVal = localStorage.getItem('shat_masr_notif_bg_preset');
      const candidate = userScoped || globalVal || '';
      if (candidate && NOTIFICATION_BG_PRESETS.some((p) => p.id === candidate)) {
        return candidate;
      }
    } catch {}
  }
  return getDefaultNotificationBgPresetIdForTime();
}

export function saveNotificationBgPresetId(userId: string | undefined, presetId: string): void {
  const validId = getNotificationBgPresetById(presetId).id;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('shat_masr_notif_bg_preset', validId);
      if (userId) {
        localStorage.setItem(`shat_masr_notif_bg_preset_${userId}`, validId);
      }
      window.dispatchEvent(new CustomEvent('shatmasr:notif_bg_updated', { detail: { presetId: validId } }));
    } catch {}
  }
}

export function clearSavedNotificationBgPreset(userId?: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('shat_masr_notif_bg_preset');
      if (userId) {
        localStorage.removeItem(`shat_masr_notif_bg_preset_${userId}`);
      }
      const fallbackId = getDefaultNotificationBgPresetIdForTime();
      window.dispatchEvent(new CustomEvent('shatmasr:notif_bg_updated', { detail: { presetId: fallbackId } }));
    } catch {}
  }
}
