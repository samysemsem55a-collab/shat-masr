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
