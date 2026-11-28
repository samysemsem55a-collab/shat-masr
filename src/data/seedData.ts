import { Room, GiftItem, VipTier, TriviaQuestion, LeaderboardEntry, User } from '../types/chat';
import avatarBoy1 from '../assets/images/avatar_boy_1_1795871978476.jpg';
import avatarBoy2 from '../assets/images/avatar_boy_2_1795871979006.jpg';
import avatarBoy3 from '../assets/images/avatar_boy_3_1795871979173.jpg';
import avatarGirl1 from '../assets/images/avatar_girl_1_1795871979141.jpg';
import avatarGirl2 from '../assets/images/avatar_girl_2_1795871979622.jpg';
import avatarGirl3 from '../assets/images/avatar_girl_3_1795871980581.jpg';

export const BOYS_AVATAR_PRESETS = [
  { id: 'boy_1', url: avatarBoy1 },
  { id: 'boy_2', url: avatarBoy2 },
  { id: 'boy_3', url: avatarBoy3 },
];

export const GIRLS_AVATAR_PRESETS = [
  { id: 'girl_1', url: avatarGirl1 },
  { id: 'girl_2', url: avatarGirl2 },
  { id: 'girl_3', url: avatarGirl3 },
];

export function getDefaultAvatarForGender(gender: 'male' | 'female' = 'male', seed: string = 'default'): string {
  const pool = gender === 'female' ? GIRLS_AVATAR_PRESETS : BOYS_AVATAR_PRESETS;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length].url;
}

export function isLegacyDicebearAvatar(url?: string): boolean {
  return Boolean(url && url.includes('api.dicebear.com'));
}

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const BADGES_CATALOG: BadgeDefinition[] = [
  { id: 'most_active', name: 'أكثر الأعضاء نشاطاً', icon: '🔥', description: 'وسام التفاعل الأسبوعي الأكثر تميزاً', color: 'from-amber-500 to-orange-600' },
  { id: 'best_host', name: 'أفضل مذيع', icon: '🎙️', description: 'وسام الإلقاء الصوتي وإدارة البثوث', color: 'from-purple-500 to-indigo-600' },
  { id: 'pro_member', name: 'المحترف', icon: '🏆', description: 'وسام العضو المحترف Pro في شات العرب', color: 'from-cyan-400 to-blue-600' },
  { id: 'top_gifter', name: 'أكثر الهدايا', icon: '🎁', description: 'أرسل هدايا فاخرة للمتحدثين والمجالس', color: 'from-pink-500 to-rose-600' },
  { id: 'active_member', name: 'عضو نشط', icon: '⚡', description: 'عضو دائم التواجد والتفاعل والمشاركة', color: 'from-amber-400 to-orange-500' },
  { id: 'diamond_voice', name: 'صوت ماسي', icon: '💎', description: 'مشارك مميز على منصات المايك والبث', color: 'from-cyan-400 to-blue-600' },
  { id: 'distinguished_host', name: 'مضيف متميز', icon: '👑', description: 'مضيف مجلس عربي راقي وناجح', color: 'from-purple-500 to-indigo-600' },
];

export const CURRENT_USER: User = {
  id: 'usr_me',
  name: '',
  username: '',
  avatar: avatarBoy1,
  bio: 'عضو في شات مصر والعرب 🇪🇬',
  country: 'مصر',
  countryFlag: '🇪🇬',
  role: 'member',
  coins: 100,
  earningsEgp: 0,
  earningsUsd: 0,
  vipBadge: '',
  badges: [],
  ratingPoints: 0,
  frameStyle: 'border-slate-700',
  profileWallpaper: '',
  fontPreference: 'cairo',
  isOnline: true,
  status: 'online',
  joinedAt: new Date().toISOString().split('T')[0],
  gender: 'male',
  age: undefined,
  level: 1,
  likesReceived: 0,
  giftsReceivedCount: 0
};

export const PRIMARY_OWNER_EMAIL = 'samielsayed555@gmail.com';
export const PRIMARY_OWNER_USERNAME = 'samielsayed555';

export function isUserAdminOrOwner(user?: (User & { email?: string }) | null): boolean {
  if (!user) return false;

  if (user.email && user.email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const savedEmail = localStorage.getItem('arab_chat_auth_email') || '';
    if (savedEmail.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()) {
      return true;
    }
  }

  return false;
}

export function hasCompletedMandatoryProfile(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (isUserAdminOrOwner(user as User)) return true;
  if (user.email || user.isEmailVerified || user.isPhoneVerified) return true;

  const trimmedName = (user.name || '').trim();
  const hasRealName = Boolean(trimmedName) && trimmedName.length >= 2 && !trimmedName.startsWith('زائر_') && trimmedName !== 'ضيف عربي';
  const hasValidAge = typeof user.age === 'number' && !isNaN(user.age) && user.age >= 13 && user.age <= 99;
  const hasValidGender = user.gender === 'male' || user.gender === 'female';

  if (typeof window !== 'undefined') {
    const hasEntered = Boolean(
      localStorage.getItem('shat_masr_has_entered') || localStorage.getItem('arab_chat_has_entered')
    );
    if (hasEntered && Boolean(user.id) && hasRealName) return true;
  }

  return hasRealName && hasValidAge && hasValidGender;
}

/**
 * Determines whether a user is NOT verified via Google / Phone / Owner account
 * (used to gate exclusive member features like Audio/Video Calls while allowing public chat).
 */
export function isGuestUser(user?: Partial<User> | null): boolean {
  if (!user) return true;
  if (isUserAdminOrOwner(user as User)) return false;
  if (user.email || user.isEmailVerified || user.isPhoneVerified) return false;
  return true;
}

export function getOrCreateUser(): User {
  if (typeof window === 'undefined') return CURRENT_USER;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryUser = urlParams.get('user') || urlParams.get('u');
    const queryName = urlParams.get('name');

    const idKey = queryUser ? `arab_chat_userId_${queryUser}` : 'arab_chat_userId';
    const userKey = queryUser ? `arab_chat_user_${queryUser}` : 'arab_chat_user';

    const saved = localStorage.getItem(userKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.id !== 'usr_me') {
          if (typeof parsed.name === 'string' && parsed.name.trim().startsWith('زائر_')) {
            parsed.name = '';
          }
          if (parsed.role === 'guest') {
            parsed.role = isUserAdminOrOwner(parsed) ? 'owner' : 'member';
          }
          parsed.isGuest = false;
          if (typeof parsed.vipBadge === 'string' && parsed.vipBadge.includes('زائر')) {
            parsed.vipBadge = parsed.role === 'owner' ? 'المالك 👑' : '';
          }
          if (Array.isArray(parsed.badges)) {
            parsed.badges = parsed.badges.filter((b: string) => !String(b).includes('زائر'));
          }
          localStorage.setItem(idKey, parsed.id);
          if (queryName && parsed.name !== queryName) {
            parsed.name = queryName;
            localStorage.setItem(userKey, JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch {}
    }

    let savedId = localStorage.getItem(idKey);
    if (!savedId || savedId.startsWith('guest_')) {
      savedId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem(idKey, savedId);
    }

    return {
      ...CURRENT_USER,
      id: savedId,
      name: queryName || '',
      username: `member_${savedId.slice(-4)}`,
      role: 'member',
      isGuest: false,
      vipBadge: '',
      badges: [],
      avatar: getDefaultAvatarForGender('male', savedId),
      coins: 100,
    };
  } catch {
    return { ...CURRENT_USER, role: 'member', isGuest: false };
  }
}

// Rooms definitions: Start with 0 active users and 0 visitors (dynamically calculated)
export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room_egypt',
    title: 'غرفة مصر 1 🇪🇬',
    description: 'ملتقى شباب وبنات مصر - إسكندرية، القاهرة، الصعيد والقناة',
    subtext: 'دردشة كتابية، ضحك وفرفشة، ونقاشات ممتعة مع ولاد البلد وأحلى صحبة',
    category: 'egypt',
    type: 'text',
    roomType: 'text_only',
    icon: '🇪🇬',
    iconBg: 'from-rose-500 via-pink-500 to-amber-500',
    activeUsers: 0,
    visitorsCount: '0',
    isLive: false,
    isVoiceActive: false,
    accentGradient: 'from-rose-500 via-pink-500 to-amber-500',
    moderators: [],
    ownerId: '',
    hostId: '',
    speakers: [],
    cameraAllowedUserIds: []
  },
  {
    id: 'room_egypt2',
    title: 'غرفة مصر 2 🇪🇬',
    description: 'ملتقى الأصدقاء والصحبة الحلوة - دردشة حية لشباب وبنات مصر',
    subtext: 'سوالف وضحك وفرفشة مع ولاد البلد في الغرفة الثانية',
    category: 'egypt',
    type: 'text',
    roomType: 'text_only',
    icon: '🇪🇬',
    iconBg: 'from-sky-500 via-blue-600 to-indigo-600',
    activeUsers: 0,
    visitorsCount: '0',
    isLive: false,
    isVoiceActive: false,
    accentGradient: 'from-sky-500 via-blue-600 to-indigo-600',
    moderators: [],
    ownerId: '',
    hostId: '',
    speakers: [],
    cameraAllowedUserIds: []
  }
];

// ZERO FAKE MESSAGES: Start empty!
export const INITIAL_MESSAGES: Record<string, import('../types/chat').Message[]> = {};

export const RADIO_STATIONS: import('../types/chat').RadioStation[] = [
  {
    id: 'rad_om_kalthoum',
    name: 'إذاعة كوكب الشرق أم كلثوم',
    artist: 'سيدة الغناء العربي',
    category: 'طرب كلاسيكي',
    icon: '🎙️',
    description: 'أروع روائع الست: إنت عمري، الأطلال، سيرة الحب، ألف ليلة وليلة',
    streamUrl: 'https://stream.zeno.fm/4wv912y0zrhvv'
  },
  {
    id: 'rad_fairouz',
    name: 'إذاعة فيروزيات الصباح',
    artist: 'جارة القمر فيروز',
    category: 'طرب شامي',
    icon: '☕',
    description: 'نسمات الصباح: سهر الليالي، حبيتك بالصيف، كيفك إنت، نسم علينا الهوى',
    streamUrl: 'https://stream.zeno.fm/f3wvbbq0zrhvv'
  },
  {
    id: 'rad_quran_cairo',
    name: 'إذاعة القرآن الكريم من القاهرة',
    artist: 'كبار قراء مصر والعالم الإسلامي',
    category: 'تلاوات خاشعة',
    icon: '🕌',
    description: 'تلاوات خاشعة للشيخ عبد الباسط، المنشاوي، الحصري، ومصطفى إسماعيل',
    streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv'
  },
  {
    id: 'rad_oud_tarab',
    name: 'إذاعة العود والطرب الأصيل',
    artist: 'فريد الأطرش ومحمد عبد الوهاب',
    category: 'تقاسيم وعود',
    icon: '🪕',
    description: 'تقاسيم عود هادئة وموشحات أندلسية وألحان الخلود',
    streamUrl: 'https://stream.zeno.fm/tarab'
  }
];

export const LUXURY_GIFTS: GiftItem[] = [
  // هدايا اقتصادية وسريعة (Economy)
  { id: 'gift_rose', name: 'وردة المحبة', icon: '🌹', cost: 50, animation: 'rose', category: 'luxury', giftTag: 'economy', bannerText: 'أهدى باقة ورد أنيقة تعبيراً عن الود!' },
  { id: 'gift_coffee', name: 'فنجان قهوة عربي', icon: '☕', cost: 100, animation: 'coffee', category: 'luxury', giftTag: 'economy', bannerText: 'حيّاك الله بفنجان قهوة وكرم ضيافة!' },
  { id: 'gift_chocolate', name: 'شوكولاتة فاخرة', icon: '🍫', cost: 150, animation: 'coffee', category: 'luxury', giftTag: 'economy', bannerText: 'تحلية سريعة ولفتة لطيفة تُسعد القلوب!' },
  { id: 'gift_lotus', name: 'زهرة اللوتس الفرعونية', icon: '🪷', cost: 200, animation: 'rose', category: 'luxury', giftTag: 'economy', bannerText: 'أهدى زهرة اللوتس المصرية رمز الجمال والرقي!' },
  { id: 'gift_horus', name: 'عين حورس الذهبية', icon: '🧿', cost: 250, animation: 'diamond', category: 'luxury', giftTag: 'economy', bannerText: 'أرسل تميمة المحبة والحماية المصرية!' },

  // هدايا رومانسية ومودة (Romantic)
  { id: 'gift_interactive_roses', name: 'مطر الورود التفاعلي', icon: '🌸', cost: 350, animation: 'rose', category: 'interactive', giftTag: 'romantic', effectType: 'roses', bannerText: 'أمطر سماء الغرفة بوابل من الورود المتساقطة!' },
  { id: 'gift_interactive_hearts', name: 'وابل القلوب الرومانسية', icon: '💖', cost: 450, animation: 'diamond', category: 'interactive', giftTag: 'romantic', effectType: 'hearts', bannerText: 'ملأ شاشة الغرفة بقلوب المحبة المتطايرة!' },
  { id: 'gift_ring', name: 'خاتم الألماس الساحر', icon: '💍', cost: 600, animation: 'diamond', category: 'luxury', giftTag: 'romantic', bannerText: 'قدّم خاتم الألماس البراق تعبيراً عن التقدير الخاص!' },
  { id: 'gift_bouquet', name: 'باقة حب ملكية', icon: '💐', cost: 800, animation: 'rose', category: 'luxury', giftTag: 'romantic', bannerText: 'أهدى باقة زهور ملكية تفوح بالعطر والأناقة!' },

  // هدايا ملكية وفاخرة (Royal / VIP Luxury)
  { id: 'gift_crown', name: 'التاج الملكي الفاخر', icon: '👑', cost: 500, animation: 'crown', category: 'luxury', giftTag: 'royal', bannerText: 'توّج المضيف بتاج العز والملوك!' },
  { id: 'gift_tower', name: 'برج القاهرة المضيء', icon: '🗼', cost: 1000, animation: 'cairo_tower', category: 'luxury', giftTag: 'royal', bannerText: 'أضاء سماء الروم ببرج القاهرة الشامخ!' },
  { id: 'gift_ferrari', name: 'فيراري حمراء سبيد', icon: '🏎️', cost: 2500, animation: 'car', category: 'luxury', giftTag: 'royal', bannerText: 'انطلق بأقوى سرعة وفخامة الفيراري!' },
  { id: 'gift_lion', name: 'الأسد المصري الملكي', icon: '🦁', cost: 5000, animation: 'lion', category: 'luxury', giftTag: 'royal', bannerText: 'زأر الأسد الملكي لتهتز أركان المجلس بالهيبة!' },
  { id: 'gift_palace', name: 'قصر النيل الملكي', icon: '🏰', cost: 7500, animation: 'cairo_tower', category: 'luxury', giftTag: 'royal', bannerText: 'أهدى قصر النيل المهيب بفخامة أسطورية!' },
  { id: 'gift_rocket', name: 'الصاروخ الذهبي العملاق', icon: '🚀', cost: 10000, animation: 'rocket', category: 'luxury', giftTag: 'royal', bannerText: 'أطلق الصاروخ الذهبي إلى الفضاء مع عاصفة ذهبية!' },

  // الهدايا التفاعلية الاحتفالية (Interactive Fullscreen)
  { id: 'gift_interactive_fireworks', name: 'ألعاب نارية احتفالية', icon: '🎆', cost: 750, animation: 'rocket', category: 'interactive', giftTag: 'interactive', effectType: 'fireworks', bannerText: 'أشعل سماء الغرفة بالألعاب النارية المبهرة!' },
  { id: 'gift_interactive_gold', name: 'عاصفة الكوينز الذهبية', icon: '✨', cost: 1200, animation: 'crown', category: 'interactive', giftTag: 'interactive', effectType: 'gold_rain', bannerText: 'أطلق عاصفة من النجوم والذهب في كامل الشاشة!' }
];

export const QUICK_PHRASES = [
  'السلام عليكم ورحمة الله وبركاته 🌹',
  'مساء الخير والورد والياسمين ✨',
  'منورين المجلس جميعاً يا هلا وغلا 👋',
  'أهلاً وسهلاً بك نورت الغرفة 👑',
  'اللهم صل وسلم وبارك على نبينا محمد 🤍',
  'صوتكم واضح وما شاء الله تبارك الله 🎙️',
  'تحياتي لكل الحضور المحترمين 🌟',
  'تسلم يا ذوق على الكلام الراقي 💫'
];

export const AVATAR_PRESETS = [
  { id: 'av_boy_1', url: avatarBoy1, label: '' },
  { id: 'av_girl_1', url: avatarGirl1, label: '' },
  { id: 'av_boy_2', url: avatarBoy2, label: '' },
  { id: 'av_girl_2', url: avatarGirl2, label: '' },
  { id: 'av_boy_3', url: avatarBoy3, label: '' },
  { id: 'av_girl_3', url: avatarGirl3, label: '' },
];

// VIP Tiers with exact pricing requested (30 days monthly cycle):
// Bronze (50 EGP/mo), Silver (150 EGP/mo), Super VIP (300 EGP/mo)
export const VIP_TIERS: VipTier[] = [
  {
    id: 'vip_bronze',
    name: 'VIP برونزي',
    badge: '🥉 VIP برونزي',
    tagline: 'بداية التميز والظهور المميز',
    priceEgp: 50,
    priceUsd: 1.5,
    coinsBonus: 1000,
    durationDays: 30,
    gradient: 'from-amber-700 to-amber-900',
    badgeBg: 'bg-amber-800 text-amber-200 border-amber-600',
    perks: [
      'شارة برونزية بجوار اسمك في كل الغرف',
      'إطار برونزي يحيط بصورتك الشخصية',
      'رصيد إضافي +1,000 كوينز فورية',
      'أولوية إرسال الرسائل وتثبيتها'
    ]
  },
  {
    id: 'vip_silver',
    name: 'VIP فضي',
    badge: '🥈 VIP فضي',
    tagline: 'حضور لامع وتأثير أكبر في المحادثات',
    priceEgp: 150,
    priceUsd: 3.5,
    coinsBonus: 3500,
    gradient: 'from-slate-400 to-slate-600',
    badgeBg: 'bg-slate-700 text-slate-100 border-slate-400',
    perks: [
      'شارة فضية براقة مع توهج عند الكتابة',
      'خط ديواني مميز مخصص لك في الشات',
      'رصيد إضافي +3,500 كوينز فورية',
      'دخول الغرف بتنبيه ترحيب خاص',
      'إمكانية فتح مايك إضافي دون انتظار'
    ]
  },
  {
    id: 'vip_diamond',
    name: 'Super VIP سوبر ملكي',
    badge: '👑 Super VIP',
    tagline: 'أعلى رتبة في شات العرب - فخامة مطلقة',
    priceEgp: 300,
    priceUsd: 7.0,
    coinsBonus: 10000,
    gradient: 'from-cyan-500 via-indigo-600 to-purple-700',
    badgeBg: 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 text-white font-extrabold border-cyan-200',
    perks: [
      'شارة سوبر VIP إمبراطورية مشعة نادرة',
      'إشعار شاشة كاملة عند دخول أي غرفة',
      'رصيد ضخم +10,000 كوينز فورية',
      'حصانة تامة من الطرد والكتم التلقائي',
      'أولوية مقعد المايك الأول وتحكم كامل بالكاميرا',
      'سحب أرباح فوري بدون أي عمولات'
    ]
  }
];

// Trivia Contest Questions - strictly 10 coins reward each!
export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    question: 'ما هي عاصمة جمهورية مصر العربية وأكبر مدنها سكاناً؟',
    category: 'جغرافيا وتاريخ',
    options: ['الإسكندرية', 'القاهرة', 'الجيزة', 'أسوان'],
    correctIndex: 1,
    explanation: 'القاهرة هي العاصمة وأكبر مدن مصر، وتُعرف بمدينة الألف مئذنة.',
    coinsReward: 10
  },
  {
    id: 'q2',
    question: 'أي من المعالم الأثرية التالية يعد من عجائب الدنيا السبع القديمة التي ما زالت قائمة؟',
    category: 'آثار وتراث',
    options: ['حدائق بابل المعلقة', 'منارة الإسكندرية', 'الهرم الأكبر (خوفو)', 'تمثال رودس'],
    correctIndex: 2,
    explanation: 'هرم خوفو بالجيزة هو الأعجوبة الوحيدة الباقية من عجائب الدنيا السبع القديمة.',
    coinsReward: 10
  },
  {
    id: 'q3',
    question: 'من هو الشاعر العربي الملقب بـ "أمير الشعراء"؟',
    category: 'أدب وشعر',
    options: ['حافظ إبراهيم', 'أحمد شوقي', 'المتنبي', 'إيليا أبو ماضي'],
    correctIndex: 1,
    explanation: 'أحمد شوقي هو الشاعر المصري الذي بويع بإمارة الشعر عام 1927.',
    coinsReward: 10
  },
  {
    id: 'q4',
    question: 'ما هو أطول أنهار العالم والذي يمر بعدة دول أفريقية منها مصر والسودان؟',
    category: 'جغرافيا طبيعية',
    options: ['نهر الأمازون', 'نهر الدانوب', 'نهر النيل', 'نهر الفرات'],
    correctIndex: 2,
    explanation: 'نهر النيل هو شريان الحياة وأطول نهر في العالم بطول يقارب 6,650 كم.',
    coinsReward: 10
  },
  {
    id: 'q5',
    question: 'كم عدد سور القرآن الكريم؟',
    category: 'إسلاميات',
    options: ['110 سورة', '114 سورة', '120 سورة', '112 سورة'],
    correctIndex: 1,
    explanation: 'يتكون القرآن الكريم من 114 سورة، تبدأ بسورة الفاتحة وتنتهي بسورة الناس.',
    coinsReward: 10
  }
];

export const LEADERBOARD_USERS: LeaderboardEntry[] = [];
