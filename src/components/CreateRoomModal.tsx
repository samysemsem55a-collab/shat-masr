import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Mic, 
  Lock, 
  Coins, 
  ShieldCheck,
  MessageSquare,
  Radio
} from 'lucide-react';
import { Room, RoomCategory, User } from '../types/chat';
import { sounds } from '../utils/soundEffects';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onCreateRoom: (room: Room, cost: number) => void;
  defaultRoomType?: 'voice' | 'text_only';
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCreateRoom,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🇪🇬');
  const [isPrivate, setIsPrivate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const flagOptions = [
    { flag: '🇪🇬', name: 'مصر' },
    { flag: '🇸🇦', name: 'السعودية' },
    { flag: '🇦🇪', name: 'الإمارات' },
    { flag: '🇲🇦', name: 'المغرب' },
    { flag: '🇩🇿', name: 'الجزائر' },
    { flag: '🇮🇶', name: 'العراق' },
    { flag: '🇰🇼', name: 'الكويت' },
    { flag: '🇸🇾', name: 'سوريا' },
    { flag: '🇯🇴', name: 'الأردن' },
    { flag: '🇵🇸', name: 'فلسطين' },
    { flag: '🇱🇧', name: 'لبنان' },
    { flag: '🇹🇳', name: 'تونس' },
    { flag: '🇾🇪', name: 'اليمن' },
    { flag: '🇸🇩', name: 'السودان' },
    { flag: '🇱🇾', name: 'ليبيا' },
    { flag: '🇴🇲', name: 'عمان' },
    { flag: '🌐', name: 'كل العرب' },
    { flag: '🕌', name: 'إسلامي' },
    { flag: '🎯', name: 'ألعاب' },
    { flag: '🎵', name: 'طرب وموسيقى' },
  ];

  const PRIVATE_ROOM_COST = 50; // Low cost private room fee

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isPrivate && currentUser.coins < PRIVATE_ROOM_COST) {
      setErrorMsg(`رصيدك الحالي ${currentUser.coins} كوينز. لفتح غرفة خاصة مشفرة تحتاج إلى ${PRIVATE_ROOM_COST} كوينز فقط.`);
      return;
    }
    setErrorMsg(null);

    sounds.playMessageSent();
    const newRoom: Room = {
      id: `room_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'غرفة دردشة كتابية وسريعة للأصدقاء',
      subtext: `بإدارة المضيف ${currentUser.name} • رسائل كتابية فقط`,
      category: 'member_rooms',
      type: 'text',
      roomType: 'text_only',
      icon: icon,
      iconBg: 'from-cyan-700 to-blue-800',
      activeUsers: 1,
      visitorsCount: '1',
      isLive: false,
      isLiveBroadcasting: false,
      isVoiceActive: false,
      accentGradient: 'from-cyan-500 via-blue-600 to-indigo-600',
      moderators: [currentUser.id],
      isPrivate: isPrivate,
      ownerId: currentUser.id,
      speakers: []
    };

    onCreateRoom(newRoom, isPrivate ? PRIVATE_ROOM_COST : 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-lg">
              ✨
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                إنشاء غرفة دردشة كتابية جديدة
              </h3>
              <p className="text-[11px] text-slate-500">دردشة سريعة ومريحة بالرسائل النصية بدون مجالس صوتية</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 bg-white border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 space-y-3">
          
          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>غرفة دردشة كتابية حرة بالرسائل النصية، الإيموجيات، والهدايا الفاخرة بدون مايكات أو صوت.</span>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Room Title */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">اسم الغرفة:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: شات الصداقة والمحبة، سوالف ولاد البلد، قهوة مصر..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">نبذة وموضوع المحادثة:</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر لموضوع المجلس..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Icon / Flag selection */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">علم الدولة أو الأيقونة:</label>
            <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {flagOptions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIcon(item.flag)}
                  className={`p-1.5 rounded-lg text-lg border transition-all flex items-center justify-center ${
                    icon === item.flag
                      ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-100'
                  }`}
                  title={item.name}
                >
                  {item.flag}
                </button>
              ))}
            </div>
          </div>

          {/* Options: Low Cost Private Room Option */}
          <div className="space-y-2 pt-1">
            {/* Private Room - Low Cost (50 coins) */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">غرفة خاصة مشفرة</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-black">
                      50 كوينز فقط 🔒
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">دخول الغرفة بدعوة خاصة للمقربين</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Cost Notice */}
          {isPrivate ? (
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between font-bold">
              <span>رسوم الغرفة الخاصة: {PRIVATE_ROOM_COST} كوينز</span>
              <span>رصيدك: {currentUser.coins} 🪙</span>
            </div>
          ) : (
            <div className="text-[10px] text-emerald-600 text-center font-bold">
              ✨ الغرفة العامة مفتوحة ومجانية 100%
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPrivate ? `فتح الغرفة الخاصة (${PRIVATE_ROOM_COST} كوينز)` : 'فتح المجلس العام مجاناً'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
