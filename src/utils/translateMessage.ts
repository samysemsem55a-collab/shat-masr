/**
 * Lightweight Instant Message Translation & Smart Assistant (@مساعد) Engine
 */

const AR_TO_EN_PHRASES: Array<[RegExp, string]> = [
  [/السلام عليكم/gi, 'Peace be upon you'],
  [/وعليكم السلام/gi, 'And upon you be peace'],
  [/صباح الخير/gi, 'Good morning'],
  [/مساء الخير/gi, 'Good evening'],
  [/مساء الورد/gi, 'Lovely evening'],
  [/أهلاً وسهلاً|اهلا وسهلا|اهلاً|اهلا/gi, 'Welcome'],
  [/منور الشات|منورين|منور/gi, 'Glad to have you here'],
  [/شكراً جزيلاً|شكرا جزيلا|شكراً|شكرا|تسلم/gi, 'Thank you very much'],
  [/كيف حالك|عامل ايه|أخبارك ايه|ازيك/gi, 'How are you doing?'],
  [/الحمد لله/gi, 'Thank God, doing well'],
  [/مبروك|الف مبروك/gi, 'Congratulations!'],
  [/ربنا يوفقك|بالتوفيق/gi, 'Good luck!'],
  [/حبيبي|يا غالي|يا طيب/gi, 'My dear friend'],
  [/أحلى|جميل جداً|جميل|روعة/gi, 'Wonderful / Beautiful'],
  [/هدية/gi, 'Gift'],
  [/غرفة/gi, 'Room'],
];

const EN_TO_AR_PHRASES: Array<[RegExp, string]> = [
  [/\bhello\b|\bhi\b|\bhey\b/gi, 'مرحباً'],
  [/\bgood morning\b/gi, 'صباح الخير'],
  [/\bgood evening\b/gi, 'مساء الخير'],
  [/\bhow are you\b/gi, 'كيف حالك؟'],
  [/\bthank you\b|\bthanks\b/gi, 'شكراً لك'],
  [/\bwelcome\b/gi, 'أهلاً وسهلاً'],
  [/\bgood luck\b/gi, 'بالتوفيق'],
  [/\blove\b/gi, 'محبة'],
  [/\bfriend\b/gi, 'صديق'],
  [/\bcongratulations\b|\bcongrats\b/gi, 'ألف مبروك'],
  [/\bgift\b/gi, 'هدية'],
  [/\broom\b/gi, 'غرفة'],
];

export function translateChatMessage(text: string): { translated: string; targetLang: string } {
  const clean = (text || '').trim();
  if (!clean) return { translated: '', targetLang: 'EN' };

  const hasArabic = /[\u0600-\u06FF]/.test(clean);
  if (hasArabic) {
    let result = clean;
    let matchedCount = 0;
    for (const [pattern, replacement] of AR_TO_EN_PHRASES) {
      if (pattern.test(result)) {
        matchedCount += 1;
        result = result.replace(pattern, replacement);
      }
    }
    if (matchedCount === 0) {
      return {
        translated: `[EN Translation] ${clean}`,
        targetLang: 'EN',
      };
    }
    return { translated: result, targetLang: 'EN' };
  }

  let result = clean;
  let matchedCount = 0;
  for (const [pattern, replacement] of EN_TO_AR_PHRASES) {
    if (pattern.test(result)) {
      matchedCount += 1;
      result = result.replace(pattern, replacement);
    }
  }
  if (matchedCount === 0) {
    return {
      translated: `[ترجمة عربية] ${clean}`,
      targetLang: 'AR',
    };
  }
  return { translated: result, targetLang: 'AR' };
}

export function buildSmartAssistantReply(queryText: string, senderName: string): string | null {
  const trimmed = (queryText || '').trim();
  if (!trimmed.includes('@مساعد') && !trimmed.toLowerCase().includes('@assistant')) {
    return null;
  }

  const prompt = trimmed.replace(/@مساعد/g, '').replace(/@assistant/gi, '').trim().toLowerCase();

  if (prompt.includes('قوانين') || prompt.includes('شروط') || prompt.includes('قواعد')) {
    return `🤖 مساعد شات مصر لـ ${senderName}: نلتزم جميعاً بالاحترام المتبادل، منع الإهانات أو الروابط المزعجة، والحفاظ على أجواء راقية للجميع ✨`;
  }
  if (prompt.includes('كوينز') || prompt.includes('شحن') || prompt.includes('محفظة')) {
    return `🤖 مساعد شات مصر لـ ${senderName}: يمكنك جمع الكوينز مجاناً من المهام اليومية والألعاب الثقافية، أو شحن رصيدك عبر المحفظة بالضغط على 🪙`;
  }
  if (prompt.includes('مستوى') || prompt.includes('نقاط') || prompt.includes('رتبة') || prompt.includes('vip')) {
    return `🤖 مساعد شات مصر لـ ${senderName}: كل رسالة وتفاعل وتعليق يمنحك نقاط خبرة XP لترقية مستواك تلقائياً والحصول على شارات التميز ⭐👑`;
  }
  if (prompt.includes('راديو') || prompt.includes('أغاني') || prompt.includes('اغاني')) {
    return `🤖 مساعد شات مصر لـ ${senderName}: افتح أيقونة الراديو 📻 من الشريط العلوي للاستمتاع بمحطات الطرب العربي والقرآن الكريم بجودة عالية.`;
  }
  if (prompt.includes('ساعة') || prompt.includes('وقت') || prompt.includes('تاريخ')) {
    const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `🤖 مساعد شات مصر لـ ${senderName}: التوقيت المحلي الحالي هو ${nowStr} ⏰`;
  }

  return `🤖 أهلاً ${senderName}! أنا @مساعد شات مصر — اسألني عن: "القوانين"، "الكوينز"، "المستوى والـ VIP"، أو "الراديو" وسأجيبك فوراً ✨`;
}
