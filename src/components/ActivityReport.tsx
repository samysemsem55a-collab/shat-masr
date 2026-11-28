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
import { getDefaultAvatarForGender } from '../data/seedData';

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
    { name: 'نور الشام 🌸', role: 'Super VIP', badge: 'أكثر الأعضاء نشاطاً 🔥', messagesCount: 1420, avatar: getDefaultAvatarForGender('female', 'nour_sham') },
    { name: 'الشيخ عبد الرحمن 🕌', role: 'مشرف أزهري', badge: 'أفضل مذيع 🎙️', messagesCount: 1180, avatar: getDefaultAvatarForGender('male', 'abdulrahman_azhar') },
    { name: 'فارس الحجاز 🐎', role: 'VIP ذهبي', badge: 'المحترف 🏆', messagesCount: 960, avatar: getDefaultAvatarForGender('male', 'fares_hijaz') },
    { name: 'أمير الرافدين 👑', role: 'عضو نشط', badge: 'أكثر الأعضاء نشاطاً 🔥', messagesCount: 840, avatar: getDefaultAvatarForGender('male', 'amir_rafidain') }
  ];

  const totalWeeklyMessages = weeklyData.reduce((acc, curr) => acc + curr.messages, 0);
  const totalVoiceHours = Math.round(weeklyData.reduce((acc, curr) => acc + curr.voiceMinutes, 0) / 60);
  const totalNewUsers = weeklyData.reduce((acc, curr) => acc + curr.newUsers, 0);
  const totalUsersCount = Math.max(allUsers.length, 120);

  return (
    <div className="space-y-4 text-right text-slate-900" dir="rtl">
      
      {/* Top Header & Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-purple-50 border border-indigo-200 shadow-sm">
        <div>
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>تقرير النشاط الأسبوعي للمنصة (Activity Report)</span>
          </h4>
          <p className="text-xs text-slate-600 mt-0.5">
            تحليل بياني مباشر لعدد الرسائل، تفاعل المجالس الصوتية، ومعدل نمو الأعضاء الجدد
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              timeRange === 'week'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              timeRange === 'month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الشهر الحالي
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Messages Card */}
        <div className="p-3 rounded-2xl bg-white border border-cyan-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-700">إجمالي الرسائل</span>
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {totalWeeklyMessages.toLocaleString('ar-EG')}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
            <span>↑ 18.4% نمو هذا الأسبوع</span>
          </div>
        </div>

        {/* Voice Hours Card */}
        <div className="p-3 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700">ساعات المايك الصوتي</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Mic className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {totalVoiceHours} ساعة بث
          </div>
          <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
            <span>↑ 24.1% استماع وتفاعل</span>
          </div>
        </div>

        {/* New Users Card */}
        <div className="p-3 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">أعضاء جدد موثقين</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            +{totalNewUsers} عضو
          </div>
          <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
            <span>عبر Google و الهاتف</span>
          </div>
        </div>

        {/* Total Database Users */}
        <div className="p-3 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">إجمالي الحسابات</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {totalUsersCount} حساب
          </div>
          <div className="text-[10px] text-amber-600 font-bold">
            قاعدة بيانات Firestore
          </div>
        </div>
      </div>

      {/* Chart 1: Messages & Voice Activity Area Chart */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>حجم الرسائل اليومية المرسلة</span>
          </h5>
          <span className="text-[10px] text-slate-500">بيانات الأيام الـ 7 الماضية</span>
        </div>

        <div className="w-full h-52 sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', textAlign: 'right', color: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }} 
                labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="messages" 
                name="الرسائل" 
                stroke="#4f46e5" 
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
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-purple-600" />
              <span>دقائق البث في الغرف الصوتية</span>
            </h5>
          </div>

          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', textAlign: 'right', color: '#0f172a' }} 
                />
                <Bar dataKey="voiceMinutes" name="دقائق المايك" fill="#9333ea" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Users Growth */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>نمو الأعضاء الجدد يومياً</span>
            </h5>
          </div>

          <div className="w-full h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', textAlign: 'right', color: '#0f172a' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="newUsers" 
                  name="مستخدم جديد" 
                  stroke="#059669" 
                  strokeWidth={3}
                  dot={{ fill: '#059669', r: 4 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3 & 4: Most Active Rooms & Most Engaged Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Most Active Rooms Horizontal Bar */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>الغرف والمجالس الأكثر نشاطاً</span>
            </h5>
            <span className="text-[10px] text-slate-500">إجمالي الرسائل</span>
          </div>

          <div className="w-full h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={mostActiveRoomsData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', textAlign: 'right', color: '#0f172a' }} />
                <Bar dataKey="messages" name="الرسائل" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Engaged Members List with Badges */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>الأعضاء الأكثر تفاعلاً وأصحاب الأوسمة</span>
            </h5>
            <span className="text-[10px] text-amber-600 font-bold">هذا الأسبوع</span>
          </div>

          <div className="space-y-2">
            {topActiveMembers.map((member, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 font-black text-amber-700 text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <img src={member.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-white" />
                  <div>
                    <h6 className="text-xs font-bold text-slate-900">{member.name}</h6>
                    <span className="text-[9.5px] text-amber-700 font-semibold">{member.badge}</span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-xs font-mono font-bold text-indigo-600 block">{member.messagesCount}</span>
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
