// Content Filter & Bad Words Moderation Service for Arab Egypt Chat
import { rtdb } from './firebase';
import { ref, onValue, set } from 'firebase/database';

export const DEFAULT_BANNED_WORDS: string[] = [
  // Common abusive Arabic words and insults
  'كلب', 'حمار', 'حيوان', 'قذر', 'وسخ', 'حقير', 'تافه', 'سافل',
  'واطي', 'لعنة', 'يلعن', 'ملعون', 'غبي', 'متخلف', 'زفت',
  'ابن الكلب', 'شحات', 'صعلوك', 'نصاب', 'حرامي', 'كذاب',
  // Severe profanities and slurs
  'شرموط', 'شرموطة', 'عرص', 'ديوث', 'قحبة', 'منيك', 'منيوك',
  'خول', 'كسمك', 'كس اختك', 'طيز', 'زب', 'شاذ', 'عاهرة',
  // Transliterated & English profanities
  'fuck', 'bitch', 'asshole', 'bastard', 'shit', 'dick', 'pussy', 'whore'
];

const STORAGE_KEY = 'arab_chat_banned_words';

let activeBannedWords: string[] = (() => {
  if (typeof window === 'undefined') return DEFAULT_BANNED_WORDS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_BANNED_WORDS;
})();

const listeners: Set<(words: string[]) => void> = new Set();

function notifyListeners() {
  const current = [...activeBannedWords];
  listeners.forEach(fn => fn(current));
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

// Sync with Firebase RTDB if available
if (rtdb) {
  try {
    const wordsRef = ref(rtdb, 'moderation/banned_words');
    onValue(wordsRef, (snapshot) => {
      const val = snapshot.val();
      if (Array.isArray(val) && val.length > 0) {
        activeBannedWords = Array.from(new Set([...DEFAULT_BANNED_WORDS, ...val]));
        notifyListeners();
      }
    });
  } catch (e) {
    console.warn('Firebase banned words sync notice:', e);
  }
}

export function getBannedWords(): string[] {
  return [...activeBannedWords];
}

export function addBannedWord(word: string): boolean {
  const clean = word.trim().toLowerCase();
  if (!clean || activeBannedWords.includes(clean)) return false;

  activeBannedWords = [clean, ...activeBannedWords];
  notifyListeners();

  if (rtdb) {
    try {
      const wordsRef = ref(rtdb, 'moderation/banned_words');
      set(wordsRef, activeBannedWords);
    } catch (e) {
      console.warn('Error saving to Firebase:', e);
    }
  }
  return true;
}

export function removeBannedWord(word: string): boolean {
  const clean = word.trim().toLowerCase();
  if (!activeBannedWords.includes(clean)) return false;

  activeBannedWords = activeBannedWords.filter(w => w !== clean);
  notifyListeners();

  if (rtdb) {
    try {
      const wordsRef = ref(rtdb, 'moderation/banned_words');
      set(wordsRef, activeBannedWords);
    } catch (e) {
      console.warn('Error updating Firebase:', e);
    }
  }
  return true;
}

export function resetDefaultBannedWords(): void {
  activeBannedWords = [...DEFAULT_BANNED_WORDS];
  notifyListeners();
  if (rtdb) {
    try {
      const wordsRef = ref(rtdb, 'moderation/banned_words');
      set(wordsRef, activeBannedWords);
    } catch (e) {}
  }
}

export function subscribeToBannedWords(callback: (words: string[]) => void): () => void {
  listeners.add(callback);
  callback([...activeBannedWords]);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Filters inappropriate content by masking bad words with asterisks (***)
 * Case-insensitive and handles Arabic variations (e.g. alef with/without hamza, taa marbuta/haa)
 */
export function filterInappropriateText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let filtered = text;

  // Normalize helper to match variations of Arabic letters
  for (const badWord of activeBannedWords) {
    if (!badWord || badWord.length < 2) continue;

    // Escape regex special chars
    const escaped = badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create flexible Arabic regex allowing optional diacritics / letter variants
    const regex = new RegExp(`(^|\\s|[^\\w\\u0600-\\u06FF])(${escaped})([^\\w\\u0600-\\u06FF]|\\s|$)`, 'gi');
    
    filtered = filtered.replace(regex, (_match, before, wordMatch, after) => {
      const stars = '*'.repeat(Math.min(5, Math.max(3, wordMatch.length)));
      return `${before}${stars}${after}`;
    });
  }

  return filtered;
}
