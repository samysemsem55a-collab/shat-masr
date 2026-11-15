import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  Crown,
  Ban,
  VolumeX,
  Volume2,
  Coins,
  Search,
  Check,
  Megaphone,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  Flag,
  Trash2,
  EyeOff,
  Activity,
  Server,
  Database,
  MessageSquareLock,
  Loader2,
} from 'lucide-react';
import { User, UserRole, UserReport, Message } from '../types/chat';
import {
  adminUpdateUser,
  subscribeToAllUsers,
  sendFirestoreMessage,
  subscribeToPendingPayments,
  approvePendingPayment,
  rejectPendingPayment,
  PendingPaymentOrder,
  subscribeToUserReports,
  resolveUserReportStatus,
  purgeRoomMessages,
  subscribeAllDirectChatsForOwner,
  fetchDirectMessagesSilentForOwner,
  checkFirestoreHealth,
  SecretDirectChatThread,
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { sounds } from '../utils/soundEffects';
import { isUserAdminOrOwner, PRIMARY_OWNER_EMAIL } from '../data/seedData';
import { AdminBadWordsManager } from './AdminBadWordsManager';
import { ActivityReport } from './ActivityReport';

interface AdminControlPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  onUserModified?: (updatedUser: Partial<User> & { id: string }) => void;
}

export const AdminControlPanelModal: React.FC<AdminControlPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onUserModified,
}) => {
  // Strict Security Gate
  if (!isOpen || !isUserAdminOrOwner(currentUser)) {
    return null;
  }

  const isPrimaryOwner =
    currentUser.email?.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase();

  const [activeTab, setActiveTab] = useState<
    'users' | 'user_reports' | 'payments' | 'bad_words' | 'reports' | 'secret_pms'
  >('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<User[]>(allUsers);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentOrder[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);

  // Live Health Status
  const [healthChecking, setHealthChecking] = useState(false);
  const [serverHealth, setServerHealth] = useState<{ ok: boolean; latencyMs: number } | null>(null);
  const [dbHealth, setDbHealth] = useState<{ ok: boolean; latencyMs: number; projectId: string } | null>(null);

  // Secret PM Inspector (Primary Owner Only)
  const [secretThreads, setSecretThreads] = useState<SecretDirectChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<SecretDirectChatThread | null>(null);
  const [secretMessages, setSecretMessages] = useState<Message[]>([]);
  const [loadingSecretMsgs, setLoadingSecretMsgs] = useState(false);

  const runHealthChecks = useCallback(async () => {
    setHealthChecking(true);
    try {
      const t0 = performance.now();
      const [apiRes, fsRes] = await Promise.all([
        fetch('/api/health')
          .then((r) => ({ ok: r.ok, latencyMs: Math.round(performance.now() - t0) }))
          .catch(() => ({ ok: false, latencyMs: -1 })),
        checkFirestoreHealth(),
      ]);
      setServerHealth(apiRes);
      setDbHealth(fsRes);
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    setUsersList(allUsers);
  }, [allUsers]);

  useEffect(() => {
    if (!isOpen) return;
    runHealthChecks();

    const unsubUsers = subscribeToAllUsers((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        setUsersList((prev) => {
          const map = new Map<string, User>();
          prev.forEach((u) => map.set(u.id, u));
          liveUsers.forEach((u) => map.set(u.id, { ...map.get(u.id), ...u }));
          return Array.from(map.values());
        });
      }
    });

    const unsubPay = subscribeToPendingPayments((orders) => {
      setPendingPayments(orders);
    });

    const unsubReports = subscribeToUserReports((reports) => {
      setUserReports(reports);
    });

    let unsubSecret = () => {};
    if (isPrimaryOwner) {
      unsubSecret = subscribeAllDirectChatsForOwner(currentUser.email, (threads) => {
        setSecretThreads(threads);
      });
    }

    return () => {
      unsubUsers();
      unsubPay();
      unsubReports();
      unsubSecret();
    };
  }, [isOpen, isPrimaryOwner, currentUser.email, runHealthChecks]);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3200);
  };

  // Load Silent Secret Messages when owner selects a thread
  const handleSelectSecretThread = async (thread: SecretDirectChatThread) => {
    if (!isPrimaryOwner) return;
    setSelectedThread(thread);
    setLoadingSecretMsgs(true);
    try {
      const msgs = await fetchDirectMessagesSilentForOwner(thread.chatId, currentUser.email);
      setSecretMessages(msgs);
    } finally {
      setLoadingSecretMsgs(false);
    }
  };

  // Approve Pending Payment
  const handleApprovePayment = async (order: PendingPaymentOrder) => {
    sounds.playCoinsReward();
    const coinsToAdd =
      order.coins ||
      (order.amount === 50
        ? 1000
        : order.amount === 200
        ? 5000
        : order.amount === 350
        ? 10000
        : order.amount === 800
        ? 25000
        : Math.round(order.amount * 25));

    await approvePendingPayment(order.id, order.userId, coinsToAdd);
    setPendingPayments((prev) =>
      prev.map((p) => (p.id === order.id ? { ...p, status: 'approved' } : p))
    );
    showNotification(
      `تمت الموافقة وإيداع +${coinsToAdd.toLocaleString()} كوينز في حساب العضو بنجاح! 🪙`
    );
  };

  const handleRejectPayment = async (orderId: string) => {
    sounds.playMessageReceived();
    await rejectPendingPayment(orderId);
    setPendingPayments((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, status: 'rejected' } : p))
    );
    showNotification('تم رفض طلب الشحن.');
  };

  // Upgrade User VIP Tier
  const handleSetRole = async (targetUser: User, newRole: UserRole, badgeName: string) => {
    sounds.playCoinsReward();
    const updates: Partial<User> = {
      role: newRole,
      vipBadge: badgeName,
      frameStyle:
        newRole === 'vip_diamond'
          ? 'border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.8)]'
          : newRole === 'vip_gold'
          ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
          : 'border-slate-300',
    };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(`تمت ترقية ${targetUser.name} إلى ${badgeName} بنجاح! ⭐`);
  };

  // Ban / Unban
  const handleToggleBan = async (targetUser: User) => {
    const isNowBanned = !targetUser.isBanned;
    sounds.playMessageReceived();
    const updates = { isBanned: isNowBanned };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      isNowBanned
        ? `تم حظر ${targetUser.name} من المنصة فورياً 🚫`
        : `تم فك حظر ${targetUser.name} بنجاح ✅`
    );
  };

  // Mute / Unmute
  const handleToggleMute = async (targetUser: User) => {
    const isNowMuted = !targetUser.isMuted;
    sounds.playMicToggle(false);
    const updates = { isMuted: isNowMuted };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      isNowMuted ? `تم كتم صوت ورسائل ${targetUser.name} 🔇` : `تم إلغاء كتم ${targetUser.name} 🔊`
    );
  };

  // Grant Coins
  const handleAddCoins = async (targetUser: User, amount: number) => {
    sounds.playCoinsReward();
    const newCoins = (targetUser.coins || 0) + amount;
    const updates = { coins: newCoins };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(`تمت إضافة +${amount.toLocaleString()} كوينز إلى حساب ${targetUser.name} 🪙`);
  };

  // Award Badge
  const handleAddBadge = async (targetUser: User, badgeTitle: string) => {
    sounds.playCoinsReward();
    const existing = targetUser.badges || [];
    if (existing.includes(badgeTitle)) {
      showNotification(`العضو يمتلك شارة "${badgeTitle}" بالفعل!`);
      return;
    }
    const updates = { badges: [...existing, badgeTitle] };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(`تم منح شارة "${badgeTitle}" لـ ${targetUser.name} بنجاح! 🎖️`);
  };

  // Broadcast Announcement to BOTH Egypt Room 1 & Egypt Room 2
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = broadcastText.trim();
    if (!txt) return;

    sounds.playMessageSent();
    const targetRooms = ['room_egypt', 'room_egypt2'];
    const basePayload = {
      senderId: currentUser.id,
      senderName: 'إدارة شات مصر والعرب 🛡️',
      senderRole: 'owner' as const,
      senderVipBadge: 'مدير النظام',
      type: 'text' as const,
      content: `📢 [إعلان رسمي من الإدارة]: ${txt}`,
      timestamp: Date.now(),
    };

    await Promise.all(
      targetRooms.map(async (rId) => {
        const msgId = `admin_bcast_${rId}_${Date.now()}`;
        realtimeSocket.sendMessage(rId, { ...basePayload, id: msgId, roomId: rId, text: basePayload.content });
        await sendFirestoreMessage(rId, { ...basePayload, id: msgId, roomId: rId });
      })
    );

    setBroadcastText('');
    showNotification('تم بث الإعلان الإداري لجميع الغرف الرئيسية فوراً! 📢');
  };

  // God Mode Room Purge
  const handlePurgeRoom = async (roomId: string, label: string) => {
    sounds.playMicToggle(false);
    await purgeRoomMessages(roomId);
    showNotification(`تم تفريغ وتنظيف جميع رسائل "${label}" بنجاح 🧹`);
  };

  // Handle User Report Actions
  const handleReportBan = async (r: UserReport) => {
    sounds.playMessageReceived();
    await adminUpdateUser(r.reportedUserId, { isBanned: true });
    await resolveUserReportStatus(r.id, 'reviewed');
    setUsersList((prev) =>
      prev.map((u) => (u.id === r.reportedUserId ? { ...u, isBanned: true } : u))
    );
    if (onUserModified) onUserModified({ id: r.reportedUserId, isBanned: true });
    showNotification(`تم حظر "${r.reportedUserName}" واعتماد البلاغ ✅`);
  };

  const handleReportMute = async (r: UserReport) => {
    sounds.playMicToggle(false);
    await adminUpdateUser(r.reportedUserId, { isMuted: true });
    await resolveUserReportStatus(r.id, 'reviewed');
    setUsersList((prev) =>
      prev.map((u) => (u.id === r.reportedUserId ? { ...u, isMuted: true } : u))
    );
    if (onUserModified) onUserModified({ id: r.reportedUserId, isMuted: true });
    showNotification(`تم كتم "${r.reportedUserName}" ومراجعة البلاغ 🔇`);
  };

  const handleResolveReport = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    sounds.playMessageSent();
    await resolveUserReportStatus(reportId, status);
    showNotification(status === 'reviewed' ? 'تم تحديد البلاغ كمُراجع ✅' : 'تم تجاهل البلاغ');
  };

  const pendingReportsCount = userReports.filter((r) => r.status === 'pending').length;
  const pendingPaymentsCount = pendingPayments.filter((p) => p.status === 'pending').length;

  const filteredUsers = usersList.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in"
      dir="rtl"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-900">
        {/* Header + Live Health Strip */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-l from-amber-50 via-white to-indigo-50 border-b border-slate-200 flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                    لوحة تحكم الإدارة والمالك
                  </h3>
                  {isPrimaryOwner && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black">
                      👑 المالك الحصري (God Mode)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 truncate">
                  إدارة الأعضاء، مراجعة البلاغات الواردة، شحنات InstaPay، ومراقبة صحة النظام
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live Health Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black text-slate-700 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                حالة النظام الحية:
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                  serverHealth?.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <Server className="w-3 h-3" />
                <span>
                  API: {serverHealth?.ok ? `متصل (${serverHealth.latencyMs}ms)` : 'غير متاح'}
                </span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                  dbHealth?.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>
                  Firestore:{' '}
                  {dbHealth?.ok
                    ? `${dbHealth.projectId} (${dbHealth.latencyMs}ms)`
                    : 'وضع محلي/احتياطي'}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={runHealthChecks}
              disabled={healthChecking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] active:scale-95 transition"
            >
              <RefreshCw className={`w-3 h-3 ${healthChecking ? 'animate-spin' : ''}`} />
              <span>فحص الآن</span>
            </button>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-2 text-xs font-black flex items-center justify-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex flex-wrap sm:flex-nowrap overflow-x-auto p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'users'
                ? 'bg-white text-indigo-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>الأعضاء ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('user_reports')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'user_reports'
                ? 'bg-white text-rose-700 font-black shadow-sm border border-rose-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flag className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>البلاغات الواردة</span>
            {pendingReportsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">
                {pendingReportsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'payments'
                ? 'bg-white text-amber-700 font-black shadow-sm border border-amber-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>شحنات InstaPay</span>
            {pendingPaymentsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black animate-pulse">
                {pendingPaymentsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bad_words')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'bad_words'
                ? 'bg-white text-rose-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>فلترة الكلمات</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'reports'
                ? 'bg-white text-cyan-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>تقرير النشاط</span>
          </button>

          {isPrimaryOwner && (
            <button
              onClick={() => setActiveTab('secret_pms')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                activeTab === 'secret_pms'
                  ? 'bg-slate-900 text-amber-300 font-black shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>الفاحص السري للخاص</span>
            </button>
          )}
        </div>

        {/* Main Content Layout */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {activeTab === 'user_reports' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Flag className="w-4 h-4 text-rose-600" />
                    <span>بلاغات المخالفات الواردة من الأعضاء ({userReports.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    متابعة فورية لشكاوى الإساءة وانتحال الشخصية لاتخاذ قرار الحظر أو الكتم
                  </p>
                </div>
              </div>

              {userReports.length === 0 ? (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <ShieldCheck className="w-9 h-9 mx-auto text-emerald-500" />
                  <p className="text-xs font-black text-slate-800">لا توجد بلاغات معلقة حالياً 🎉</p>
                  <p className="text-[11px] text-slate-500">المجتمع يسوده الهدوء والاحترام المتبادل</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {userReports.map((r) => {
                    const isPending = r.status === 'pending';
                    return (
                      <div
                        key={r.id}
                        className={`p-3.5 rounded-2xl border bg-white shadow-xs transition-all ${
                          isPending ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200 opacity-75'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  isPending
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : r.status === 'reviewed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isPending ? '🔴 بلاغ جديد' : r.status === 'reviewed' ? '✅ تمت المعالجة' : 'تم التجاهل'}
                              </span>
                              <span className="text-xs font-black text-slate-900">
                                ضد: <span className="text-rose-700">{r.reportedUserName}</span>
                              </span>
                              <span className="text-[11px] text-slate-500">
                                بواسطة: <strong className="text-slate-700">{r.reporterName}</strong>
                              </span>
                            </div>

                            <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 inline-block px-2.5 py-0.5 rounded-lg">
                              السبب: {r.reason}
                            </p>

                            {r.details && (
                              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                                "{r.details}"
                              </p>
                            )}

                            <p className="text-[10px] text-slate-400 font-mono">
                              {new Date(r.timestamp).toLocaleString('ar-EG')}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleReportBan(r)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] flex items-center gap-1 shadow-sm active:scale-95"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>حظر فوري</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReportMute(r)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-[11px] flex items-center gap-1 shadow-sm active:scale-95"
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>كتم</span>
                            </button>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleResolveReport(r.id, 'reviewed')}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[11px]"
                                >
                                  تمت المراجعة ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveReport(r.id, 'dismissed')}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                                >
                                  تجاهل
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'payments' ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>طلبات تحويلات InstaPay المسجلة (payments_pending)</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                </h4>
                <p className="text-[11px] text-slate-600">
                  مراجعة التحويلات المالية المحولة لعنوان samyelsayed9@instapay واعتماد الكوينز يدوياً
                </p>
              </div>

              {pendingPayments.length === 0 ? (
                <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <Coins className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">لا توجد طلبات شحن مسجلة حالياً</p>
                  <p className="text-[11px] text-slate-500">
                    عند قيام أي عضو بتسجيل تحويل إنستاباي ستظهر بياناته هنا فورياً
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingPayments.map((order) => {
                    const targetUser = usersList.find((u) => u.id === order.userId);
                    const isPending = order.status === 'pending';
                    const coinsCalculated =
                      order.coins ||
                      (order.amount === 50
                        ? 1000
                        : order.amount === 200
                        ? 5000
                        : order.amount === 350
                        ? 10000
                        : order.amount === 800
                        ? 25000
                        : Math.round(order.amount * 25));

                    return (
                      <div
                        key={order.id}
                        className={`p-3.5 rounded-2xl border bg-white transition-all ${
                          isPending
                            ? 'border-amber-300 shadow-sm'
                            : order.status === 'approved'
                            ? 'border-emerald-200 opacity-80'
                            : 'border-rose-200 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                {order.amount} ج.م EGP
                              </span>
                              <span className="text-xs font-black text-slate-900">
                                🪙 +{coinsCalculated.toLocaleString()} كوينز
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isPending
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : order.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isPending
                                  ? '⏳ قيد المراجعة المعلقة'
                                  : order.status === 'approved'
                                  ? '✅ تم الاعتماد والإيداع'
                                  : '❌ مرفوض'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700">
                              <span className="text-slate-500">العضو: </span>
                              <span className="font-bold text-slate-900">
                                {targetUser?.name || order.userId}
                              </span>
                              <span className="text-slate-400 mr-2">({order.userId})</span>
                            </p>

                            <p className="text-[11px] text-slate-600 font-medium">
                              <span className="text-slate-500">بيانات التحويل: </span>
                              {order.note || 'تحويل إنستاباي'}
                            </p>

                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(order.timestamp).toLocaleString('ar-EG')}
                            </div>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                              <button
                                onClick={() => handleApprovePayment(order)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow active:scale-95 transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>موافقة وإيداع الكوينز</span>
                              </button>

                              <button
                                onClick={() => handleRejectPayment(order.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all active:scale-95"
                              >
                                <span>رفض</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'bad_words' ? (
            <AdminBadWordsManager />
          ) : activeTab === 'reports' ? (
            <ActivityReport allUsers={usersList} />
          ) : activeTab === 'secret_pms' && isPrimaryOwner ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 h-[58vh] min-h-[380px]">
              {/* Left Pane: Threads List */}
              <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-900 text-amber-300 flex items-center justify-between text-xs font-black">
                  <span className="flex items-center gap-1.5">
                    <MessageSquareLock className="w-4 h-4" />
                    المحادثات الخاصة ({secretThreads.length})
                  </span>
                  <span className="text-[9px] text-slate-300">قراءة صامتة 🔒</span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {secretThreads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      لا توجد محادثات خاصة مسجلة حالياً
                    </div>
                  ) : (
                    secretThreads.map((t) => (
                      <button
                        key={t.chatId}
                        type="button"
                        onClick={() => handleSelectSecretThread(t)}
                        className={`w-full p-3 text-right hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                          selectedThread?.chatId === t.chatId ? 'bg-amber-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {t.participants?.join(' ↔ ') || t.chatId}
                          </span>
                          {t.lastTimestamp ? (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {new Date(t.lastTimestamp).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {t.lastSenderName ? `${t.lastSenderName}: ` : ''}
                          {t.lastMessage || 'لا توجد رسائل'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Pane: Silent Message Stream */}
              <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <span className="font-black text-slate-900">
                    {selectedThread
                      ? `مراقبة صامتة: ${selectedThread.participants?.join(' ↔ ') || selectedThread.chatId}`
                      : 'اختر محادثة من القائمة لعرض سجلها بصمت'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    بدون تحديث حالة القراءة ✓
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/40">
                  {loadingSecretMsgs ? (
                    <div className="h-full flex items-center justify-center text-slate-500 gap-2 text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحميل...</span>
                    </div>
                  ) : !selectedThread ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                      <EyeOff className="w-8 h-8" />
                      <span>حصري للمالك الأساسي ({PRIMARY_OWNER_EMAIL})</span>
                    </div>
                  ) : secretMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      لا توجد رسائل في هذه المحادثة بعد
                    </div>
                  ) : (
                    secretMessages.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-black text-indigo-700">{m.senderName || m.senderId}</span>
                          <span className="font-mono">
                            {new Date(m.timestamp).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-slate-900 font-medium break-words">
                          {m.content || m.text || `[${m.type}]`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Quick Broadcast & Room Purge God Mode Controls */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl space-y-3 shadow-xs">
                <form onSubmit={handleSendBroadcast} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                    <span>إرسال تعميم إداري فوري لغرفتي مصر 1 ومصر 2:</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      placeholder="اكتب رسالة الإعلان الإداري لتظهر لجميع الأعضاء لحظياً..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-xs rounded-xl shadow active:scale-95 transition-all shrink-0"
                    >
                      بث الآن 📢
                    </button>
                  </div>
                </form>

                {isPrimaryOwner && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-rose-700">
                      أدوات التنظيف الفوري للمالك (God Mode Purge):
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePurgeRoom('room_egypt', 'غرفة مصر 1')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>تفريغ غرفة مصر 1 🧹</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePurgeRoom('room_egypt2', 'غرفة مصر 2')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>تفريغ غرفة مصر 2 🧹</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن عضو بالاسم أو المعرف أو الرتبة..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                />
              </div>

              {/* Users List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                  <span>الأعضاء المسجلون والمتصلون ({filteredUsers.length}):</span>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    التغييرات تنفذ لحظياً في Firestore + WebSocket
                  </span>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
                    لا توجد نتائج مطابقة لبحثك
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`p-3.5 rounded-2xl border bg-white transition-all shadow-2xs ${
                        user.isBanned
                          ? 'border-rose-300 bg-rose-50/40'
                          : user.isMuted
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* User Info */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={
                                user.avatar ||
                                `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(
                                  user.name || user.id
                                )}`
                              }
                              alt={user.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-slate-200 bg-slate-100"
                              referrerPolicy="no-referrer"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                user.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900">{user.name}</h4>
                              <span className="text-xs">{user.countryFlag || '🇪🇬'}</span>

                              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-black text-[10px] border border-amber-200">
                                {user.vipBadge || user.role || 'عضو'}
                              </span>

                              {user.isBanned && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px]">
                                  محظور 🚫
                                </span>
                              )}

                              {user.isMuted && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[9px]">
                                  مكتوم 🔇
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1 text-amber-700 font-bold">
                                <Coins className="w-3 h-3 text-amber-500" />
                                {user.coins?.toLocaleString() || 0} كوينز
                              </span>
                              <span>المعرف: {user.id}</span>
                              {user.badges && user.badges.length > 0 && (
                                <span className="text-indigo-700 font-medium">
                                  الشارات: {user.badges.join(' • ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSetRole(user, 'vip_gold', 'VIP ذهبي 🌟')}
                            title="ترقية إلى VIP ذهبي"
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <Crown className="w-3 h-3 text-amber-500" />
                            <span>VIP ذهبي</span>
                          </button>

                          <button
                            onClick={() => handleSetRole(user, 'vip_diamond', 'VIP ماسي 💎')}
                            title="ترقية إلى VIP ماسي"
                            className="px-2.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <Crown className="w-3 h-3 text-cyan-600" />
                            <span>VIP ماسي</span>
                          </button>

                          <button
                            onClick={() => handleSetRole(user, 'admin', 'مشرف عام 🛡️')}
                            title="ترقية إلى مشرف عام"
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            <span>مشرف</span>
                          </button>

                          <button
                            onClick={() => handleAddCoins(user, 1000)}
                            title="إضافة 1,000 كوينز للحساب"
                            className="px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <span>+1,000</span>
                            <span>🪙</span>
                          </button>

                          <button
                            onClick={() => handleToggleMute(user)}
                            title={user.isMuted ? 'إلغاء الكتم' : 'كتم العضو'}
                            className={`p-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all ${
                              user.isMuted
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200'
                            }`}
                          >
                            {user.isMuted ? (
                              <VolumeX className="w-3.5 h-3.5" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleToggleBan(user)}
                            title={user.isBanned ? 'فك الحظر' : 'حظر العضو'}
                            className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all ${
                              user.isBanned
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{user.isBanned ? 'فك الحظر' : 'حظر'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddBadge(user, 'أكثر الهدايا')}
                              className="px-1.5 py-1 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 text-[9px] font-bold"
                            >
                              🎁 أكثر الهدايا
                            </button>
                            <button
                              onClick={() => handleAddBadge(user, 'صوت ماسي')}
                              className="px-1.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-[9px] font-bold"
                            >
                              🎙️ صوت ماسي
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>نظام الإدارة الفوري لـ شات مصر — تحكم كامل ولحظي</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
