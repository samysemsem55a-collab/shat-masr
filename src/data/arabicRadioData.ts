// Verified Real HTTPS Arabic & Egyptian Live Radio Stations (Radio Browser API)
export interface ArabicRadioStation {
  id: string;
  name: string;
  category: 'quran' | 'tarab' | 'egypt' | 'fairuz' | 'hits' | 'classic';
  categoryLabel: string;
  streamUrl: string;
  fallbackUrl?: string;
  description: string;
  country: string;
  countryFlag: string;
  bitrate: string;
  color: string;
  icon: string;
}

export const ARABIC_RADIO_STATIONS: ArabicRadioStation[] = [
  // --- القرآن الكريم (قرآن فقط - بدون أي موسيقى) ---
  {
    id: 'radio_quran_cairo',
    name: 'إذاعة القرآن الكريم من القاهرة',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://radio.xecod.com/station/quran-cairo',
    fallbackUrl: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
    description: 'البث المباشر لإذاعة القرآن الكريم من جمهورية مصر العربية بأصوات عمالقة التلاوة',
    country: 'مصر - القاهرة',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-emerald-700 to-teal-800',
    icon: '🕌'
  },
  {
    id: 'radio_tarateel_khashia',
    name: 'إذاعة التراتيل الخاشعة',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/tarateel',
    fallbackUrl: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
    description: 'تلاوات قرآنية خاشعة ومؤثرة لكبار قراء العالم الإسلامي على مدار اليوم',
    country: 'العالم الإسلامي',
    countryFlag: '✨',
    bitrate: '128 kbps',
    color: 'from-cyan-700 to-blue-800',
    icon: '📖'
  },
  {
    id: 'radio_abdulbasit',
    name: 'إذاعة الشيخ عبد الباسط عبد الصمد',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/abdulbasit_abdulsamad_mojawwad',
    fallbackUrl: 'https://radio.mp3islam.com/listen/abdulbasit/radio.mp3',
    description: 'تلاوات نادرة ومجودة لصوت مكة الحبيب الشيخ عبد الباسط عبد الصمد رحمه الله',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-amber-700 to-yellow-800',
    icon: '🎙️'
  },
  {
    id: 'radio_minshawi',
    name: 'إذاعة الشيخ محمد صديق المنشاوي',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad',
    fallbackUrl: 'https://radio.mp3islam.com/listen/minshawi/radio.mp3',
    description: 'الصوت الخاشع فضيلة الشيخ محمد صديق المنشاوي المصحف المجود',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-green-700 to-emerald-800',
    icon: '🕊️'
  },
  {
    id: 'radio_hussary',
    name: 'إذاعة الشيخ محمود خليل الحصري',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/mahmoud_khalil_alhussary',
    fallbackUrl: 'https://radio.mp3islam.com/listen/hussary/radio.mp3',
    description: 'شيخ عموم المقارئ المصرية وأستاذ التجويد الشيخ محمود خليل الحصري',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-blue-700 to-slate-800',
    icon: '📿'
  },
  {
    id: 'radio_mustafa_ismail',
    name: 'إذاعة الشيخ مصطفى إسماعيل',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/mustafa_ismail',
    fallbackUrl: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
    description: 'أسطورة المقامات القرآنية والتلاوة المصرية الشيخ مصطفى إسماعيل',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-indigo-700 to-purple-800',
    icon: '🌙'
  },
  {
    id: 'radio_alafasi',
    name: 'إذاعة الشيخ مشاري راشد العفاسي',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/mishary_alafasi',
    fallbackUrl: 'https://radio.mp3islam.com/listen/mishary/radio.mp3',
    description: 'المصحف المرتل والأدعية والأذكار بصوت القارئ الشيخ مشاري بن راشد العفاسي',
    country: 'الكويت',
    countryFlag: '🇰🇼',
    bitrate: '128 kbps',
    color: 'from-teal-700 to-cyan-800',
    icon: '🌿'
  },
  {
    id: 'radio_sudais',
    name: 'إذاعة الشيخ عبد الرحمن السديس',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://radio.mp3islam.com/listen/sudais/radio.mp3',
    fallbackUrl: 'https://qurango.net/radio/abdulrahman_alsudaes',
    description: 'تلاوات الحرم المكي الشريف بصوت فضيلة الشيخ عبد الرحمن السديس',
    country: 'السعودية',
    countryFlag: '🇸🇦',
    bitrate: '128 kbps',
    color: 'from-emerald-800 to-green-900',
    icon: '🕋'
  },
  {
    id: 'radio_yasser_dosari',
    name: 'إذاعة الشيخ ياسر الدوسري',
    category: 'quran',
    categoryLabel: 'قرآن كريم',
    streamUrl: 'https://qurango.net/radio/yasser_aldosari',
    fallbackUrl: 'https://radio.mp3islam.com/listen/yaser/radio.mp3',
    description: 'تلاوات خاشعة بصوت إمام الحرم المكي الشيخ ياسر الدوسري على مدار الساعة',
    country: 'السعودية',
    countryFlag: '🇸🇦',
    bitrate: '128 kbps',
    color: 'from-sky-700 to-indigo-800',
    icon: '🕌'
  },

  // --- الطرب الأصيل (موسيقى طرب فقط) ---
  {
    id: 'radio_tarab_zaman',
    name: 'راديو طرب زمان الأصيل',
    category: 'tarab',
    categoryLabel: 'طرب أصيل',
    streamUrl: 'https://medinatarab.ice.infomaniak.ch/medinatarab-128.mp3',
    fallbackUrl: 'https://stream.zeno.fm/zsgrfxg71s8uv',
    description: 'روائع أم كلثوم، عبد الحليم حافظ، فريد الأطرش، وردة الجزائرية، ومحمد عبد الوهاب',
    country: 'مصر والعالم العربي',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-amber-600 to-yellow-600',
    icon: '🎻'
  },
  {
    id: 'radio_umm_kulthum_kawkab',
    name: 'إذاعة أم كلثوم (كوكب الشرق)',
    category: 'tarab',
    categoryLabel: 'طرب أصيل',
    streamUrl: 'https://stream.zeno.fm/zsgrfxg71s8uv',
    fallbackUrl: 'https://medinatarab.ice.infomaniak.ch/medinatarab-128.mp3',
    description: 'بث متواصل على مدار 24 ساعة لأجمل حفلات وروائع كوكب الشرق السيدة أم كلثوم',
    country: 'مصر - القاهرة',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-amber-600 to-rose-700',
    icon: '👑'
  },
  {
    id: 'radio_fairuz',
    name: 'إذاعة فيروزيات الصباح',
    category: 'fairuz',
    categoryLabel: 'فيروز وشامي',
    streamUrl: 'https://stream.zeno.fm/9vrahqqfuuhvv',
    fallbackUrl: 'https://stream.zeno.fm/xkhnk4vee18uv',
    description: 'أغاني السيدة فيروز والأخوين رحباني وصوت جارة القمر فيروز على مدار 24 ساعة',
    country: 'لبنان وبلاد الشام',
    countryFlag: '🇱🇧',
    bitrate: '128 kbps',
    color: 'from-teal-600 to-emerald-600',
    icon: '☕'
  },

  // --- إذاعات مصر والتسعينات (أغاني مصرية فقط) ---
  {
    id: 'radio_90s_egypt',
    name: 'تسعينات إف إم (90s FM مصر)',
    category: 'egypt',
    categoryLabel: 'إذاعات مصرية',
    streamUrl: 'https://eu1.fastcast4u.com/proxy/prontofm?mp=/1',
    fallbackUrl: 'https://stream.zeno.fm/na3vpvn10qruv',
    description: 'أجمل ذكريات التسعينات المصرية: عمرو دياب، محمد فؤاد، إيهاب توفيق، وحميد الشاعري',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-blue-600 to-indigo-600',
    icon: '📼'
  },
  {
    id: 'radio_hits_882',
    name: 'راديو هيتس 88.2 (Radio Hits Egypt)',
    category: 'egypt',
    categoryLabel: 'إذاعات مصرية',
    streamUrl: 'https://radiohits882.radioca.st/;',
    fallbackUrl: 'https://9090streaming.mobtada.com/9090FMEGYPT',
    description: 'أقوى الأغاني المصرية الشبابية وبرامج المنوعات المباشرة من قلب القاهرة',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-rose-500 to-indigo-600',
    icon: '📻'
  },
  {
    id: 'radio_9090_egypt',
    name: 'راديو 9090 مصر (El 9090 FM)',
    category: 'egypt',
    categoryLabel: 'إذاعات مصرية',
    streamUrl: 'https://9090streaming.mobtada.com/9090FMEGYPT',
    fallbackUrl: 'https://nrjstreaming.ahmed-melege.com/nrjegypt',
    description: 'البث الحي المباشر لإذاعة 9090 FM من القاهرة بأشهر الأغاني والبرامج المصرية',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-orange-500 to-red-600',
    icon: '⭐'
  },
  {
    id: 'radio_sha3by_fm',
    name: 'شعبي إف إم 95 (Sha3by FM)',
    category: 'egypt',
    categoryLabel: 'إذاعات مصرية',
    streamUrl: 'https://radio95.radioca.st/;',
    fallbackUrl: 'https://9090streaming.mobtada.com/9090FMEGYPT',
    description: 'إذاعة الأغاني الشعبية المصرية والمهرجانات والسهرات الحية من القاهرة',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-amber-500 to-orange-600',
    icon: '🥁'
  },

  // --- أغاني ومنوعات عربية ---
  {
    id: 'radio_arab_mix_fm',
    name: 'عرب ميكس إف إم (Arab Mix FM)',
    category: 'hits',
    categoryLabel: 'أغاني ومنوعات',
    streamUrl: 'https://stream.zeno.fm/na3vpvn10qruv',
    fallbackUrl: 'https://broadcast.ice.infomaniak.ch/aswat-high.mp3',
    description: 'ميكس مستمر لأحدث وأقوى الأغاني المصرية والعربية الشبابية بجودة عالية',
    country: 'العالم العربي',
    countryFlag: '🎧',
    bitrate: '128 kbps',
    color: 'from-purple-600 to-pink-600',
    icon: '🌟'
  },
  {
    id: 'radio_amr_diab_fm',
    name: 'إذاعة عمرو دياب (Amr Diab FM)',
    category: 'hits',
    categoryLabel: 'أغاني ومنوعات',
    streamUrl: 'https://stream-40.zeno.fm/xa4yhh4k838uv',
    fallbackUrl: 'https://stream.zeno.fm/na3vpvn10qruv',
    description: 'أجمل أغاني وألبومات الهضبة عمرو دياب القديمة والحديثة على مدار الساعة',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-fuchsia-600 to-purple-700',
    icon: '🎤'
  },
  {
    id: 'radio_fenn_fm',
    name: 'راديو فن إف إم (Fenn Radio)',
    category: 'hits',
    categoryLabel: 'أغاني ومنوعات',
    streamUrl: 'https://stream.zeno.fm/76e9f1gsduhvv',
    fallbackUrl: 'https://broadcast.ice.infomaniak.ch/aswat-high.mp3',
    description: 'تشكيلة متنوعة من أحدث الأغاني العربية والخليجية والمصرية المختارة',
    country: 'العالم العربي',
    countryFlag: '🎵',
    bitrate: '128 kbps',
    color: 'from-pink-600 to-rose-600',
    icon: '🎶'
  },
  {
    id: 'radio_nrj_nile_pop',
    name: 'إنيرجي مصر (NRJ Egypt)',
    category: 'hits',
    categoryLabel: 'أغاني ومنوعات',
    streamUrl: 'https://nrjstreaming.ahmed-melege.com/nrjegypt',
    fallbackUrl: 'https://broadcast.ice.infomaniak.ch/aswat-high.mp3',
    description: 'إيقاعات البوب المصرية والعالمية وبرامج الشباب والسهرات الحية من مصر',
    country: 'مصر',
    countryFlag: '🇪🇬',
    bitrate: '128 kbps',
    color: 'from-red-600 to-amber-500',
    icon: '⚡'
  },
  {
    id: 'radio_aswat_fm',
    name: 'إذاعة أصوات المغربية (Aswat FM)',
    category: 'hits',
    categoryLabel: 'أغاني ومنوعات',
    streamUrl: 'https://broadcast.ice.infomaniak.ch/aswat-high.mp3',
    fallbackUrl: 'https://medinatarab.ice.infomaniak.ch/medinatarab-128.mp3',
    description: 'أغاني مغربية وعربية متنوعة وبرامج تفاعلية حية على مدار اليوم',
    country: 'المغرب',
    countryFlag: '🇲🇦',
    bitrate: '128 kbps',
    color: 'from-red-700 to-emerald-700',
    icon: '📡'
  },

  // --- تقاسيم وموسيقى شرقية ---
  {
    id: 'radio_oriental_instrumental',
    name: 'راديو شرقيات وموسيقى العود والكمان',
    category: 'classic',
    categoryLabel: 'تقاسيم وعزف',
    streamUrl: 'https://oriental-high.rautemusik.fm/?ref=radiobrowser',
    fallbackUrl: 'https://medinatarab.ice.infomaniak.ch/medinatarab-128.mp3',
    description: 'تقاسيم شرقية ساحرة، صولوهات عود، قانون، وكمان شرقي لأجواء راقية وهادئة',
    country: 'موسيقى شرقية',
    countryFlag: '🎶',
    bitrate: '192 kbps',
    color: 'from-rose-600 to-orange-600',
    icon: '🪕'
  }
];
