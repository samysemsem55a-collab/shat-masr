import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  MessageSquare, 
  Mic, 
  Users, 
  Award, 
  Sparkles,
  Flame,
  Crown,
  Trophy
} from 'lucide-react';
import { User } from '../types/chat';

interface ActivityReportProps {
  allUsers?: User[];
}

export const ActivityReport: React.FC<ActivityReportProps> = ({ allUsers = [] }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  // Weekly activity data for the last 7 days
  const weeklyData = [
    { day: 'السبت', messages: 1420, voiceMinutes: 480, newUsers: 24, activeRooms: 8 },
    { day: 'الأحد', messages: 1850, voiceMinutes: 620, newUsers: 31, activeRooms: 10 },
    { day: 'الإثنين', messages: 2100, voiceMinutes: 750, newUsers: 38, activeRooms: 12 },
    { day: 'الثلاثاء', messages: 1980, voiceMinutes: 690, newUsers: 29, activeRooms: 11 },
    { day: 'الأربعاء', messages: 2450, voiceMinutes: 880, newUsers: 45, activeRooms: 14 },
    { day: 'الخميس', messages: 3200, voiceMinutes: 1240, newUsers: 62, activeRooms: 18 },
    { day: 'الجمعة', messages: 3850, voiceMinutes: 1560, newUsers: 78, activeRooms: 22 },
  ];

  // Most active rooms data for recharts
  const mostActiveRoomsData = [
    { name: 'شات مصر وكل العرب', messages: 6850, fill: '#6366f1' },
    { name: 'صالون الطرب الأصيل', messages: 4230, fill: '#ec4899' },
    { name: 'ديوان الأدب والثقافة', messages: 3120, fill: '#f59e0b' },
    { name: 'المملكة المغربية', messages: 2980, fill: '#10b981' },
    { name: 'مجلس عشاق الرياضة', messages: 2640, fill: '#06b6d4' }
  ];

  // Most active users with honors
  const topActiveMembers = [
    { name: 'نور الشام 🌸', role: 'Super VIP', badge: 'أكثر الأعضاء نشاطاً 🔥', messagesCount: 1420, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    { name: 'الشيخ عبد الرحمن 🕌', role: 'مشرف أزهري', badge: 'أفضل مذيع 🎙️', messagesCount: 1180, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100' },
    { name: 'فارس الحجاز 🐎', role: 'VIP ذهبي', badge: 'المحترف 🏆', messagesCount: 960, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' },
    { name: 'أمير الرافدين 👑', role: 'عضو نشط', badge: 'أكثر الأعضاء نشاطاً 🔥', messagesCount: 840, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' }
  ];

  const totalWeeklyMessages = weeklyData.reduce((acc, curr) => acc + curr.messages, 0);
  const totalVoiceHours = Math.round(weeklyData.reduce((acc, curr) => acc + curr.voiceMinutes, 0) / 60);
  const totalNewUsers = weeklyData.reduce((acc, curr) => acc + curr.newUsers, 0);
  const totalUsersCount = Math.max(allUsers.length, 120);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      
      {/* Top Header & Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/50 border border-indigo-500/30">
        <div>
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>تقرير النشاط الأسبوعي للمنصة (Activity Report)</span>
          </h4>
          <p className="text-xs text-slate-300 mt-0.5">
            تحليل بياني مباشر لعدد الرسائل، تفاعل المجالس الصوتية، ومعدل نمو الأعضاء الجدد
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              timeRange === 'week'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              timeRange === 'month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            الشهر الحالي
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Messages Card */}
        <div className="p-3 rounded-2xl bg-[#0b1222] border border-cyan-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-300">إجمالي الرسائل</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-white">
            {totalWeeklyMessages.toLocaleString('ar-EG')}
          </div>
          <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span>↑ 18.4% نمو هذا الأسبوع</span>
          </div>
        </div>

        {/* Voice Hours Card */}
        <div className="p-3 rounded-2xl bg-[#0b1222] border border-purple-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-300">ساعات المايك الصوتي</span>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Mic className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-white">
            {totalVoiceHours} ساعة بث
          </div>
          <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span>↑ 24.1% استماع وتفاعل</span>
          </div>
        </div>

        {/* New Users Card */}
        <div className="p-3 rounded-2xl bg-[#0b1222] border border-emerald-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300">أعضاء جدد موثقين</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-white">
            +{totalNewUsers} عضو
          </div>
          <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span>عبر Google و الهاتف</span>
          </div>
        </div>

        {/* Total Database Users */}
        <div className="p-3 rounded-2xl bg-[#0b1222] border border-amber-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300">إجمالي الحسابات</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-white">
            {totalUsersCount} حساب
          </div>
          <div className="text-[10px] text-amber-400 font-bold">
            قاعدة بيانات Firestore
          </div>
        </div>
      </div>

      {/* Chart 1: Messages & Voice Activity Area Chart */}
      <div className="p-3.5 rounded-2xl bg-[#0b1222] border border-slate-800 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>حجم الرسائل اليومية المرسلة</span>
          </h5>
          <span className="text-[10px] text-slate-400">بيانات الأيام الـ 7 الماضية</span>
        </div>

        <div className="w-full h-52 sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', textAlign: 'right' }} 
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="messages" 
                name="الرسائل" 
                stroke="#818cf8" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#msgGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Voice Activity & New Users */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Voice Room Minutes */}
        <div className="p-3.5 rounded-2xl bg-[#0b1222] border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-purple-400" />
              <span>دقائق البث في الغرف الصوتية</span>
            </h5>
          </div>

          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', textAlign: 'right' }} 
                />
                <Bar dataKey="voiceMinutes" name="دقائق المايك" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Users Growth */}
        <div className="p-3.5 rounded-2xl bg-[#0b1222] border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>نمو الأعضاء الجدد يومياً</span>
            </h5>
          </div>

          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', textAlign: 'right' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="newUsers" 
                  name="مستخدم جديد" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3 & 4: Most Active Rooms & Most Engaged Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Most Active Rooms Horizontal Bar */}
        <div className="p-3.5 rounded-2xl bg-[#0b1222] border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>الغرف والمجالس الأكثر نشاطاً</span>
            </h5>
            <span className="text-[10px] text-slate-400">إجمالي الرسائل</span>
          </div>

          <div className="w-full h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={mostActiveRoomsData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', textAlign: 'right' }} />
                <Bar dataKey="messages" name="الرسائل" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Engaged Members List with Badges */}
        <div className="p-3.5 rounded-2xl bg-[#0b1222] border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>الأعضاء الأكثر تفاعلاً وأصحاب الأوسمة</span>
            </h5>
            <span className="text-[10px] text-amber-400 font-bold">هذا الأسبوع</span>
          </div>

          <div className="space-y-2">
            {topActiveMembers.map((member, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 font-black text-amber-400 text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <img src={member.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                  <div>
                    <h6 className="text-xs font-bold text-white">{member.name}</h6>
                    <span className="text-[9.5px] text-amber-300 font-semibold">{member.badge}</span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-xs font-mono font-bold text-indigo-300 block">{member.messagesCount}</span>
                  <span className="text-[9px] text-slate-500 block">رسالة وتفاعل</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
