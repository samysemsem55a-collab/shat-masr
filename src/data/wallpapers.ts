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
      backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.46), rgba(8, 12, 21, 0.72)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      filter: 'hue-rotate(-8deg) saturate(1.15)'
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

export function getWallpaperStyleById(wallpaperId?: string): React.CSSProperties {
  if (!wallpaperId) return CHAT_WALLPAPERS[0].style;
  const found = CHAT_WALLPAPERS.find(w => w.id === wallpaperId);
  return found ? found.style : CHAT_WALLPAPERS[0].style;
}

export interface RoomBackgroundTheme {
  id: string;
  name: string;
  category: 'default' | 'gradient' | 'solid';
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
