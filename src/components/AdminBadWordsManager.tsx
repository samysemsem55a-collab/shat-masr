import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Search, 
  RotateCcw, 
  Check, 
  AlertCircle,
  Sparkles,
  Filter
} from 'lucide-react';
import { 
  getBannedWords, 
  addBannedWord, 
  removeBannedWord, 
  resetDefaultBannedWords, 
  subscribeToBannedWords,
  DEFAULT_BANNED_WORDS 
} from '../services/contentFilter';
import { sounds } from '../utils/soundEffects';

export const AdminBadWordsManager: React.FC = () => {
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBannedWords((words) => {
      setBannedWords(words);
    });
    return () => unsub();
  }, []);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newWord.trim();
    if (!clean) return;

    const added = addBannedWord(clean);
    if (added) {
      sounds.playCoinsReward();
      setNewWord('');
      showFeedback(`تمت إضافة "${clean}" إلى قائمة الحظر بنجاح!`);
    } else {
      showFeedback(`الكلمة "${clean}" موجودة بالفعل في قائمة الحظر.`);
    }
  };

  const handleRemoveWord = (word: string) => {
    const removed = removeBannedWord(word);
    if (removed) {
      sounds.playMicToggle(false);
      showFeedback(`تم حذف "${word}" من قائمة الكلمات المحظورة.`);
    }
  };

  const handleResetDefaults = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    resetDefaultBannedWords();
    setConfirmReset(false);
    sounds.playCoinsReward();
    showFeedback('تمت استعادة القائمة الافتراضية بنجاح.');
  };

  const filteredWords = bannedWords.filter(w => 
    w.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-4 text-right">
      {/* Header Info */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-50 via-white to-amber-50 border border-red-200 flex items-center justify-between gap-3 shadow-sm">
        <div>
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>نظام فلترة وحجب الكلمات غير اللائقة</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
              {bannedWords.length} كلمة محظورة
            </span>
          </h4>
          <p className="text-xs text-slate-600 mt-1">
            يتم حجب أي كلمة في هذه القائمة تلقائياً واستبدالها بنجوم (***) فورياً في واجهة الشات لكافة الغرف والمستخدمين.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
            confirmReset
              ? 'bg-red-600 border-red-600 text-white'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
          }`}
          title="استعادة الكلمات الافتراضية"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${confirmReset ? 'text-white' : 'text-amber-500'}`} />
          <span>{confirmReset ? 'تأكيد الاستعادة؟' : 'استعادة الافتراضي'}</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in font-bold">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Add new word form */}
      <form onSubmit={handleAddWord} className="flex items-center gap-2">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="اكتب كلمة أو عبارة غير لائقة لحظرها..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!newWord.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة للحظر</span>
        </button>
      </form>

      {/* Search filter */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في الكلمات المحظورة..."
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-400 outline-none"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* Words Badges Cloud */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 min-h-[160px] max-h-[320px] overflow-y-auto">
        {filteredWords.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {searchQuery ? 'لا توجد كلمات مطابقة لبحثك' : 'لا توجد كلمات محظورة حالياً'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-all group"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveWord(word)}
                  className="p-0.5 rounded-full hover:bg-red-200 text-red-500 hover:text-red-800 transition-colors cursor-pointer"
                  title="حذف من الحظر"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-600 leading-relaxed bg-amber-50 p-2.5 rounded-xl border border-amber-200">
        💡 <strong className="text-amber-700">ملاحظة أمنية:</strong> يتم تطبيق الفلترة تلقائياً في واجهة العرض للرسائل السابقة والحالية دون تعديل النص الأصلي في قاعدة البيانات لأغراض الرقابة الإدارية.
      </div>
    </div>
  );
};
