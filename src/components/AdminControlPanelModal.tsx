import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  BadgeCheck,
  HardDrive,
  RotateCcw,
  UserCog,
  Clock,
  Edit3,
  Plus,
  Minus,
  Upload,
  Users,
} from 'lucide-react';
import { User, UserRole, UserReport, Message, BackupSnapshot } from '../types/chat';
import {
  adminUpdateUser,
  adminAdjustUserCoins,
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
  subscribeToRealtimeFirestoreHealth,
  SecretDirectChatThread,
  pushAppUpdateNotice,
  subscribeToRemoteAppVersion,
  setRemoteUpdateNotificationsEnabled,
  createDailyBackupSnapshot,
  subscribeToBackups,
  restoreDailyBackupSnapshot,
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { isUserAdminOrOwner, PRIMARY_OWNER_EMAIL, VIP_TIERS } from '../data/seedData';
import { getRankDisplayMeta } from '../utils/userRanks';
import { compressImageFile } from '../utils/imageCompression';
import { isUserTrulyOnline, getServerNowMs } from '../utils/presenceStatus';
import { AvatarWithFrame } from './AvatarWithFrame';
import { AdminBadWordsManager } from './AdminBadWordsManager';
import { ActivityReport } from './ActivityReport';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { maskPhone, maskTransactionId } from '../utils/maskData';

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; badge: string }> = [
  { value: 'member', label: 'عضو عادي', badge: '' },
  { value: 'vip_bronze', label: 'VIP برونزي 🥉', badge: 'VIP برونزي 🥉' },
  { value: 'vip_silver', label: 'VIP فضي 🥈', badge: 'VIP فضي 🥈' },
  { value: 'vip_gold', label: 'VIP ذهبي 👑', badge: 'VIP ذهبي 👑' },
  { value: 'vip_diamond', label: 'VIP ماسي 💎', badge: 'VIP ماسي 💎' },
  { value: 'admin', label: 'مشرف عام 🛡️', badge: 'مشرف عام 🛡️' },
  { value: 'super_admin', label: 'مراقب سوبر ⚡', badge: 'مراقب سوبر ⚡' },
];

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
  const isAdminOrOwner = isUserAdminOrOwner(currentUser);
  const isPrimaryOwner =
    currentUser.role === 'owner' ||
    currentUser.email?.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase();

  const [activeTab, setActiveTab] = useState<
    'users' | 'user_reports' | 'payments' | 'bad_words' | 'reports' | 'secret_pms' | 'backups'
  >('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'privileged' | 'restricted'>('all');
  const [broadcastText, setBroadcastText] = useState('');
  const [appUpdateMsg, setAppUpdateMsg] = useState('');
  const [remoteNotifsEnabled, setRemoteNotifsEnabled] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<User[]>(allUsers);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentOrder[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);

  // Selected Member Full-Control Modal State
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCountryFlag, setEditCountryFlag] = useState('🇪🇬');
  const [editStatus, setEditStatus] = useState<User['status']>('online');
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editVipBadge, setEditVipBadge] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [coinsAmountInput, setCoinsAmountInput] = useState('500');
  const [coinsNoteInput, setCoinsNoteInput] = useState('');
  const [isSavingMemberEdit, setIsSavingMemberEdit] = useState(false);

  // Live Health Status
  const [healthChecking, setHealthChecking] = useState(false);
  const [serverHealth, setServerHealth] = useState<{ ok: boolean; latencyMs: number }>({ ok: true, latencyMs: 12 });
  const [dbHealth, setDbHealth] = useState<{ ok: boolean; latencyMs: number; projectId: string }>({
    ok: true,
    latencyMs: 18,
    projectId: 'shat-masr-live',
  });

  // Secret PM Inspector (Primary Owner Only)
  const [secretThreads, setSecretThreads] = useState<SecretDirectChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<SecretDirectChatThread | null>(null);
  const [secretMessages, setSecretMessages] = useState<Message[]>([]);
  const [loadingSecretMsgs, setLoadingSecretMsgs] = useState(false);

  // Backups & Restore (Primary Owner Only)
  const [backupsList, setBackupsList] = useState<BackupSnapshot[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [confirmRestoreSnapshot, setConfirmRestoreSnapshot] = useState<BackupSnapshot | null>(null);

  const runHealthChecks = useCallback(async () => {
    setHealthChecking(true);
    try {
      const t0 = performance.now();
      const [apiRes, fsRes] = await Promise.all([
        fetch('/api/health')
          .then((r) => ({ ok: r.ok, latencyMs: Math.max(1, Math.round(performance.now() - t0)) }))
          .catch(() => ({ ok: false, latencyMs: 0 })),
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
    if (!isOpen || !isAdminOrOwner) return;
    runHealthChecks();

    const unsubHealth = subscribeToRealtimeFirestoreHealth((health) => {
      setDbHealth({
        ok: health.ok,
        latencyMs: health.latencyMs,
        projectId: health.projectId,
      });
    });

    const unsubUsers = subscribeToAllUsers((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        const deduped = new Map<string, User>();
        liveUsers.forEach((u) => {
          if (u?.id) deduped.set(u.id, u);
        });
        setUsersList(Array.from(deduped.values()));
      }
    });

    const unsubPay = subscribeToPendingPayments((orders) => {
      setPendingPayments(orders);
    });

    const unsubReports = subscribeToUserReports((reports) => {
      setUserReports(reports);
    });

    let unsubSecret = () => {};
    let unsubBackups = () => {};
    if (isPrimaryOwner) {
      unsubSecret = subscribeAllDirectChatsForOwner(currentUser.email || true, (threads) => {
        setSecretThreads(threads);
      });
      unsubBackups = subscribeToBackups((items) => {
        setBackupsList(items || []);
      });
    }

    const unsubRemoteVer = subscribeToRemoteAppVersion((cfg) => {
      setRemoteNotifsEnabled(cfg.notificationsEnabled);
    });

    return () => {
      unsubHealth();
      unsubUsers();
      unsubPay();
      unsubReports();
      unsubSecret();
      unsubBackups();
      unsubRemoteVer();
    };
  }, [isOpen, isAdminOrOwner, isPrimaryOwner, currentUser.email, runHealthChecks]);

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
      const msgs = await fetchDirectMessagesSilentForOwner(thread.chatId, currentUser.email || true);
      setSecretMessages(msgs);
    } finally {
      setLoadingSecretMsgs(false);
    }
  };

  // Approve Pending Payment (Coins or VIP)
  const handleApprovePayment = async (order: PendingPaymentOrder) => {
    const vipBonus = order.vipTierId
      ? VIP_TIERS.find((t) => t.id === order.vipTierId)?.coinsBonus || 0
      : 0;
    const coinsToAdd =
      order.type === 'vip'
        ? (typeof order.coins === 'number' ? order.coins : vipBonus)
        : (order.coins ||
          (order.amount === 50
            ? 1000
            : order.amount === 200
            ? 5000
            : order.amount === 350
            ? 10000
            : order.amount === 800
            ? 25000
            : Math.round(order.amount * 25)));

    await approvePendingPayment(order.id, order.userId, coinsToAdd, order.vipTierId);
    setPendingPayments((prev) =>
      prev.map((p) => (p.id === order.id ? { ...p, status: 'approved' } : p))
    );
    showNotification(
      order.vipTierId
        ? `تمت الموافقة وتفعيل ترقية ${order.itemName || order.vipTierId}${coinsToAdd > 0 ? ` + ${coinsToAdd.toLocaleString()} كوينز` : ''} بنجاح! 👑`
        : `تمت الموافقة وإيداع +${coinsToAdd.toLocaleString()} كوينز في حساب العضو بنجاح! 🪙`
    );
  };

  const handleRejectPayment = async (orderId: string) => {
    await rejectPendingPayment(orderId);
    setPendingPayments((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, status: 'rejected' } : p))
    );
    showNotification('تم رفض طلب الشحن.');
  };

  // Upgrade User VIP / Admin Tier
  const handleSetRole = async (targetUser: User, newRole: UserRole, badgeName: string) => {
    const frameStyle =
      newRole === 'owner'
        ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.85)]'
        : newRole === 'super_admin'
        ? 'border-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.75)]'
        : newRole === 'admin'
        ? 'border-indigo-400 shadow-[0_0_18px_rgba(99,102,241,0.7)]'
        : newRole === 'vip_diamond'
        ? 'border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.8)]'
        : newRole === 'vip_gold'
        ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
        : newRole === 'vip_silver'
        ? 'border-slate-300 shadow-[0_0_12px_rgba(148,163,184,0.6)]'
        : newRole === 'vip_bronze'
        ? 'border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.5)]'
        : '';

    const updates: Partial<User> = {
      role: newRole,
      vipBadge: badgeName,
      frameStyle,
    };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      newRole === 'member'
        ? `تم تعيين ${targetUser.name} كعضو عادي`
        : `تمت ترقية ${targetUser.name} إلى ${badgeName} بنجاح! ⭐`
    );
  };

  const isMemberBannedNow = (u: User): boolean =>
    Boolean(u.isBanned || (typeof u.bannedUntil === 'number' && u.bannedUntil > Date.now()));

  // Permanent Ban / Unban
  const handleToggleBan = async (targetUser: User, reason?: string) => {
    const currentlyBanned = isMemberBannedNow(targetUser);
    const updates: Partial<User> = currentlyBanned
      ? { isBanned: false, bannedUntil: null, banReason: '' }
      : { isBanned: true, bannedUntil: null, banReason: reason?.trim() || 'مخالفة قوانين المنصة' };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      !currentlyBanned
        ? `تم حظر ${targetUser.name} من المنصة فورياً 🚫`
        : `تم فك حظر ${targetUser.name} بنجاح ✅`
    );
  };

  // Temporary Ban (1h / 24h / 7d)
  const handleTempBan = async (targetUser: User, durationMs: number, label: string, reason?: string) => {
    const bannedUntil = Date.now() + durationMs;
    const updates: Partial<User> = {
      isBanned: false,
      bannedUntil,
      banReason: reason?.trim() || `حظر مؤقت (${label})`,
    };
    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(`تم حظر ${targetUser.name} مؤقتاً لمدة ${label} ⏳`);
  };

  // Open Full Member Editor Modal
  const openMemberControlModal = (member: User) => {
    setSelectedMemberId(member.id);
    setEditName(member.name || '');
    setEditAvatar(member.avatar || '');
    setEditBio(member.bio || '');
    setEditCountryFlag(member.countryFlag || '🇪🇬');
    setEditStatus(member.status || 'online');
    setEditRole(member.role || 'member');
    setEditVipBadge(member.vipBadge || '');
    setBanReasonInput(member.banReason || '');
    setCoinsAmountInput('500');
    setCoinsNoteInput('');
  };

  const handleUploadMemberAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, {
        maxWidth: 400,
        maxHeight: 400,
        maxBytes: 120 * 1024,
        initialQuality: 0.8,
      });
      setEditAvatar(compressedDataUrl);
      showNotification('تم ضغط الصورة وتجهيزها — اضغط حفظ لتطبيق التعديل 📸');
    } catch {
      showNotification('تعذر قراءة الصورة المختارة');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveMemberProfileEdits = async (member: User) => {
    if (!editName.trim() || isSavingMemberEdit) return;
    setIsSavingMemberEdit(true);
    try {
      const updates: Partial<User> = {
        name: editName.trim(),
        avatar: editAvatar.trim(),
        bio: editBio.trim(),
        countryFlag: editCountryFlag.trim() || '🇪🇬',
        status: editStatus,
      };
      await adminUpdateUser(member.id, updates);
      setUsersList((prev) => prev.map((u) => (u.id === member.id ? { ...u, ...updates } : u)));
      if (onUserModified) onUserModified({ id: member.id, ...updates });
      showNotification(`تم حفظ بيانات العضو "${updates.name}" لحظياً ✅`);
    } finally {
      setIsSavingMemberEdit(false);
    }
  };

  // Mute / Unmute
  const handleToggleMute = async (targetUser: User) => {
    const isNowMuted = !targetUser.isMuted;
    const updates = { isMuted: isNowMuted };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      isNowMuted ? `تم كتم صوت ورسائل ${targetUser.name} 🔇` : `تم إلغاء كتم ${targetUser.name} 🔊`
    );
  };

  // Toggle Verified Account Blue Check (Primary Owner Only)
  const handleToggleVerified = async (targetUser: User) => {
    if (!isPrimaryOwner) return;
    const isNowVerified = !targetUser.verified;
    const updates = { verified: isNowVerified };

    await adminUpdateUser(targetUser.id, updates);
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      isNowVerified ? `تم توثيق حساب ${targetUser.name} بشارة الزرقاء ✓` : `تم إلغاء توثيق حساب ${targetUser.name}`
    );
  };

  // Backup Create / Restore Handlers (Primary Owner Only)
  const handleCreateBackupNow = async () => {
    if (!isPrimaryOwner || isCreatingBackup) return;
    setIsCreatingBackup(true);
    try {
      const snap = await createDailyBackupSnapshot(currentUser.id, usersList);
      if (snap) {
        showNotification(`تم إنشاء النسخة الاحتياطية بنجاح (${snap.usersCount} عضو • ${snap.roomsCount} غرفة) 💾`);
      } else {
        showNotification('تعذر إنشاء النسخة الاحتياطية حالياً.');
      }
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleConfirmRestoreBackup = async () => {
    if (!isPrimaryOwner || !confirmRestoreSnapshot || isRestoringBackup) return;
    setIsRestoringBackup(true);
    try {
      const ok = await restoreDailyBackupSnapshot(confirmRestoreSnapshot);
      if (ok) {
        showNotification(`تمت استعادة النسخة الاحتياطية (${confirmRestoreSnapshot.id}) بنجاح ✅`);
      } else {
        showNotification('حدث خطأ أثناء استعادة النسخة الاحتياطية.');
      }
    } finally {
      setIsRestoringBackup(false);
      setConfirmRestoreSnapshot(null);
    }
  };

  // Adjust Coins (Add / Deduct / Set via Atomic Firestore Transaction + Log)
  const handleAdjustCoins = async (
    targetUser: User,
    amount: number,
    mode: 'add' | 'deduct' | 'set',
    note: string = ''
  ) => {
    if (!Number.isFinite(amount) || amount < 0) return;
    const res = await adminAdjustUserCoins(targetUser.id, amount, mode, currentUser.name, note);
    const nextCoins = res.success
      ? res.newCoins
      : mode === 'add'
      ? (targetUser.coins || 0) + amount
      : mode === 'deduct'
      ? Math.max(0, (targetUser.coins || 0) - amount)
      : Math.max(0, amount);
    const updates = { coins: nextCoins };
    setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u)));
    if (onUserModified) onUserModified({ id: targetUser.id, ...updates });
    showNotification(
      mode === 'add'
        ? `تمت إضافة +${amount.toLocaleString()} كوينز إلى حساب ${targetUser.name} 🪙`
        : mode === 'deduct'
        ? `تم خصم -${amount.toLocaleString()} كوينز من حساب ${targetUser.name} 🪙`
        : `تم تعديل رصيد ${targetUser.name} إلى ${nextCoins.toLocaleString()} كوينز 🪙`
    );
  };

  const handleAddCoins = async (targetUser: User, amount: number) => {
    await handleAdjustCoins(targetUser, amount, 'add', 'منحة إدارية سريعة');
  };

  // Award Badge
  const handleAddBadge = async (targetUser: User, badgeTitle: string) => {
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
    await purgeRoomMessages(roomId);
    showNotification(`تم تفريغ وتنظيف جميع رسائل "${label}" بنجاح 🧹`);
  };

  // Handle User Report Actions
  const handleReportBan = async (r: UserReport) => {
    await adminUpdateUser(r.reportedUserId, { isBanned: true });
    await resolveUserReportStatus(r.id, 'reviewed');
    setUsersList((prev) =>
      prev.map((u) => (u.id === r.reportedUserId ? { ...u, isBanned: true } : u))
    );
    if (onUserModified) onUserModified({ id: r.reportedUserId, isBanned: true });
    showNotification(`تم حظر "${r.reportedUserName}" واعتماد البلاغ ✅`);
  };

  const handleReportMute = async (r: UserReport) => {
    await adminUpdateUser(r.reportedUserId, { isMuted: true });
    await resolveUserReportStatus(r.id, 'reviewed');
    setUsersList((prev) =>
      prev.map((u) => (u.id === r.reportedUserId ? { ...u, isMuted: true } : u))
    );
    if (onUserModified) onUserModified({ id: r.reportedUserId, isMuted: true });
    showNotification(`تم كتم "${r.reportedUserName}" ومراجعة البلاغ 🔇`);
  };

  const handleResolveReport = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    await resolveUserReportStatus(reportId, status);
    showNotification(status === 'reviewed' ? 'تم تحديد البلاغ كمُراجع ✅' : 'تم تجاهل البلاغ');
  };

  const pendingReportsCount = userReports.filter((r) => r.status === 'pending').length;
  const pendingPaymentsCount = pendingPayments.filter((p) => p.status === 'pending').length;
  const nowServerMs = getServerNowMs();

  const onlineMembersCount = usersList.filter((u) => isUserTrulyOnline(u, nowServerMs)).length;
  const privilegedMembersCount = usersList.filter((u) => u.role && u.role !== 'member').length;
  const restrictedMembersCount = usersList.filter(
    (u) => isMemberBannedNow(u) || Boolean(u.isMuted)
  ).length;

  const filteredUsers = usersList
    .filter((u) => {
      if (userFilter === 'online' && !isUserTrulyOnline(u, nowServerMs)) return false;
      if (userFilter === 'privileged' && (!u.role || u.role === 'member')) return false;
      if (userFilter === 'restricted' && !isMemberBannedNow(u) && !u.isMuted) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.vipBadge?.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aOnline = isUserTrulyOnline(a, nowServerMs) ? 1 : 0;
      const bOnline = isUserTrulyOnline(b, nowServerMs) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return (b.coins || 0) - (a.coins || 0);
    });

  const selectedMember = selectedMemberId
    ? usersList.find((u) => u.id === selectedMemberId) || null
    : null;

  // Strict Security Gate (placed after all hooks to preserve React hook call order)
  return (
    <AnimatePresence>
      {isOpen && isAdminOrOwner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-900"
          >
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
                حالة النظام الحية (Real-time):
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                  serverHealth.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <Server className="w-3 h-3" />
                <span>
                  API: {serverHealth.ok ? `متصل (${serverHealth.latencyMs}ms)` : 'جاري إعادة الاتصال...'}
                </span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                  dbHealth.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>
                  Firestore:{' '}
                  {dbHealth.ok
                    ? `متصل مباشر • ${dbHealth.projectId} (${dbHealth.latencyMs}ms)`
                    : `مزامنة نشطة (${dbHealth.projectId})`}
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
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-indigo-700 font-black shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>كل الأعضاء ({usersList.length})</span>
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
            <>
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

              <button
                onClick={() => setActiveTab('backups')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'backups'
                    ? 'bg-emerald-700 text-white font-black shadow-sm'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 shrink-0" />
                <span>النسخ الاحتياطي ({backupsList.length})</span>
              </button>
            </>
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
                    const vipBonus = order.vipTierId
                      ? VIP_TIERS.find((t) => t.id === order.vipTierId)?.coinsBonus || 0
                      : 0;
                    const coinsCalculated =
                      order.type === 'vip'
                        ? (typeof order.coins === 'number' ? order.coins : vipBonus)
                        : (order.coins ||
                          (order.amount === 50
                            ? 1000
                            : order.amount === 200
                            ? 5000
                            : order.amount === 350
                            ? 10000
                            : order.amount === 800
                            ? 25000
                            : Math.round(order.amount * 25)));

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
                              {order.type === 'vip' ? (
                                <span className="text-xs font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                  👑 ترقية {order.itemName || order.vipTierId}
                                </span>
                              ) : (
                                <span className="text-xs font-black text-slate-900">
                                  🪙 +{coinsCalculated.toLocaleString()} كوينز
                                </span>
                              )}
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
                                  ? '✅ تم الاعتماد والتنفيذ'
                                  : '❌ مرفوض'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700">
                              <span className="text-slate-500">العضو: </span>
                              <span className="font-bold text-slate-900">
                                {order.userName || targetUser?.name || order.userId}
                              </span>
                              <span className="text-slate-400 mr-2 font-mono text-[10px]">({order.userId})</span>
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                              {order.senderAccountOrPhone && (
                                <span className="font-bold text-slate-800">
                                  📱 المحفظة/الحساب: <span className="font-mono text-indigo-700">{maskPhone(order.senderAccountOrPhone)}</span>
                                </span>
                              )}
                              {order.senderName && (
                                <span className="font-bold text-slate-800">
                                  • 👤 اسم المحوّل: <span className="text-slate-900">{order.senderName}</span>
                                </span>
                              )}
                              {order.transactionRef && (
                                <span className="font-bold text-emerald-800">
                                  • 🔖 الرقم المرجعي: <span className="font-mono">{maskTransactionId(order.transactionRef)}</span>
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-600 font-medium">
                              <span className="text-slate-500">التفاصيل: </span>
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
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow active:scale-95 transition-all cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{order.type === 'vip' ? 'اعتماد الترقية 👑' : 'موافقة وإيداع الكوينز'}</span>
                              </button>

                              <button
                                onClick={() => handleRejectPayment(order.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
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
                    secretThreads.map((t) => {
                      const participantNames = (t.participants || []).map((pid) => {
                        const found = usersList.find((u) => u.id === pid);
                        return found?.name || pid;
                      });
                      const titleLabel = participantNames.length > 0 ? participantNames.join(' ↔ ') : t.chatId;
                      return (
                      <button
                        key={t.chatId}
                        type="button"
                        onClick={() => handleSelectSecretThread(t)}
                        className={`w-full p-3 text-right hover:bg-slate-50 transition-colors flex flex-col gap-1 cursor-pointer ${
                          selectedThread?.chatId === t.chatId ? 'bg-amber-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {titleLabel}
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
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane: Silent Message Stream */}
              <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <span className="font-black text-slate-900">
                    {selectedThread
                      ? `مراقبة صامتة: ${
                          (selectedThread.participants || [])
                            .map((pid) => usersList.find((u) => u.id === pid)?.name || pid)
                            .join(' ↔ ') || selectedThread.chatId
                        }`
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
          ) : activeTab === 'backups' && isPrimaryOwner ? (
            <div className="space-y-3">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>نظام النسخ الاحتياطي التلقائي واليدوي</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    يتم حفظ لقطة يومية كاملة لحسابات الأعضاء والغرف وإعدادات المنصة في Firestore والملقم
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreateBackupNow}
                  disabled={isCreatingBackup}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingBackup ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>إنشاء نسخة احتياطية الآن 💾</span>
                    </>
                  )}
                </button>
              </div>

              {backupsList.length === 0 ? (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <HardDrive className="w-9 h-9 mx-auto text-slate-300" />
                  <p className="text-xs font-black text-slate-700">لا توجد نسخ احتياطية مسجلة بعد</p>
                  <p className="text-[11px] text-slate-500">اضغط على "إنشاء نسخة احتياطية الآن" لأخذ أول لقطة أمان</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backupsList.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 font-mono">{snap.id}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                            متاح للاستعادة
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                          <span>📅 {new Date(snap.createdAt).toLocaleString('ar-EG')}</span>
                          <span>👥 {snap.usersCount} عضو</span>
                          <span>🏛️ {snap.roomsCount} غرفة</span>
                          <span>📝 {snap.postsCount} منشور</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmRestoreSnapshot(snap)}
                        className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-rose-700">
                        أدوات التنظيف الفوري للمالك (God Mode Purge):
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePurgeRoom('room_egypt', 'غرفة مصر 1')}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>تفريغ غرفة مصر 1 🧹</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePurgeRoom('room_egypt2', 'غرفة مصر 2')}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>تفريغ غرفة مصر 2 🧹</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={appUpdateMsg}
                        onChange={(e) => setAppUpdateMsg(e.target.value)}
                        placeholder="رسالة تحديث اختيارية (مثال: يتوفر تحديث جديد الآن مع ميزات رائعة)..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await pushAppUpdateNotice(currentUser.name, appUpdateMsg);
                          setAppUpdateMsg('');
                          showNotification('تم إرسال إشعار تحديث التطبيق لجميع المتواجدين الآن! 🚀');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إرسال إشعار تحديث للتطبيق 🚀</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const next = !remoteNotifsEnabled;
                          setRemoteNotifsEnabled(next);
                          await setRemoteUpdateNotificationsEnabled(next);
                          showNotification(
                            next
                              ? 'تم تفعيل شريط إشعارات التحديث للأعضاء 🔔'
                              : 'تم إيقاف شريط إشعارات التحديث للأعضاء 🔕'
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 shrink-0 cursor-pointer transition ${
                          remoteNotifsEnabled
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <span>{remoteNotifsEnabled ? 'إيقاف إشعار التحديث 🔕' : 'تفعيل إشعار التحديث 🔔'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Search Bar + Filter Pills */}
              <div className="space-y-2">
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

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUserFilter('all')}
                    className={`px-3 py-1 rounded-xl border transition cursor-pointer ${
                      userFilter === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    الكل ({usersList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilter('online')}
                    className={`px-3 py-1 rounded-xl border transition cursor-pointer ${
                      userFilter === 'online'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    🟢 متصلون الآن ({onlineMembersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilter('privileged')}
                    className={`px-3 py-1 rounded-xl border transition cursor-pointer ${
                      userFilter === 'privileged'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    👑 الإدارة و VIP ({privilegedMembersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilter('restricted')}
                    className={`px-3 py-1 rounded-xl border transition cursor-pointer ${
                      userFilter === 'restricted'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    🚫 محظورون / مكتومون ({restrictedMembersCount})
                  </button>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                  <span>كل الأعضاء المسجلين ({filteredUsers.length}):</span>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    تحديث لحظي مباشر عبر Firestore onSnapshot + RTDB
                  </span>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
                    لا توجد نتائج مطابقة لبحثك
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const rankMeta = getRankDisplayMeta(user.role, user.vipBadge);
                    const userBannedNow = isMemberBannedNow(user);
                    const isTempBanned =
                      !user.isBanned &&
                      typeof user.bannedUntil === 'number' &&
                      user.bannedUntil > nowServerMs;
                    return (
                    <div
                      key={user.id}
                      className={`p-3.5 rounded-2xl border bg-white transition-all shadow-2xs ${
                        userBannedNow
                          ? 'border-rose-300 bg-rose-50/40'
                          : user.isMuted
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* User Info */}
                        <div className="flex items-center gap-3">
                          <AvatarWithFrame user={user} size="md" showOnlineDot />

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className={`text-sm ${rankMeta.nameColorClass}`}>{user.name}</h4>
                              <VerifiedBadge verified={user.verified} size="xs" />
                              <span className="text-xs">{user.countryFlag || '🇪🇬'}</span>

                              {rankMeta.isPrivileged ? (
                                <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] border ${rankMeta.badgeClass}`}>
                                  {rankMeta.label}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] border border-slate-200">
                                  {rankMeta.label}
                                </span>
                              )}

                              {user.isBanned && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px]">
                                  حظر دائم 🚫
                                </span>
                              )}

                              {isTempBanned && user.bannedUntil && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px]">
                                  حظر مؤقت حتى {new Date(user.bannedUntil).toLocaleString('ar-EG')} ⏳
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

                        {/* Admin Action Buttons + Direct Role Dropdown + Full Control Drawer */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openMemberControlModal(user)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            <span>تحكم وتعديل</span>
                          </button>

                          <select
                            aria-label={`تغيير رتبة ${user.name}`}
                            value={user.role || 'member'}
                            disabled={user.role === 'owner' && !isPrimaryOwner}
                            onChange={(e) => {
                              const selectedRole = e.target.value as UserRole;
                              const opt = ROLE_OPTIONS.find((r) => r.value === selectedRole);
                              handleSetRole(user, selectedRole, opt?.badge || '');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-[11px] font-black cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            {user.role === 'owner' && (
                              <option value="owner">المالك 👑</option>
                            )}
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleAddCoins(user, 1000)}
                            title="إضافة 1,000 كوينز للحساب"
                            className="px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <span>+1,000</span>
                            <span>🪙</span>
                          </button>

                          {isPrimaryOwner && (
                            <button
                              onClick={() => handleToggleVerified(user)}
                              title={user.verified ? 'إزالة شارة التوثيق' : 'توثيق الحساب بالشارة الزرقاء'}
                              className={`px-2 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                                user.verified
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                              }`}
                            >
                              <BadgeCheck className="w-3.5 h-3.5" />
                              <span>{user.verified ? 'موثق ✓' : 'توثيق'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleMute(user)}
                            title={user.isMuted ? 'إلغاء الكتم' : 'كتم العضو'}
                            className={`p-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
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
                            title={userBannedNow ? 'فك الحظر' : 'حظر العضو'}
                            className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                              userBannedNow
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{userBannedNow ? 'فك الحظر' : 'حظر'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })
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

        {/* Full Member Control Modal (Edit Profile + Roles + Temp/Perm Ban + Coins) */}
        {selectedMember && (
          <div
            onClick={() => setSelectedMemberId(null)}
            className="fixed inset-0 z-[215] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4"
            dir="rtl"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-4 py-3 bg-gradient-to-l from-indigo-50 via-white to-amber-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarWithFrame user={selectedMember} size="sm" showOnlineDot />
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate flex items-center gap-1.5">
                      <span>تحكم إداري كامل: {selectedMember.name}</span>
                      <VerifiedBadge verified={selectedMember.verified} size="xs" />
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      ID: {selectedMember.id} • الرصيد: {(selectedMember.coins || 0).toLocaleString()} 🪙
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 text-right">
                {/* 1. Edit Profile & Settings */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>تعديل البيانات والإعدادات</span>
                    </span>
                    {isPrimaryOwner && (
                      <button
                        type="button"
                        onClick={() => handleToggleVerified(selectedMember)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1 cursor-pointer ${
                          selectedMember.verified
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        <BadgeCheck className="w-3 h-3" />
                        <span>{selectedMember.verified ? 'حساب موثق ✓' : 'منح التوثيق'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">الاسم المعروض</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">الحالة وعلم الدولة</label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={editStatus || 'online'}
                          onChange={(e) => setEditStatus(e.target.value as User['status'])}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                        >
                          <option value="online">متصل 🟢</option>
                          <option value="away">بالخارج 🌙</option>
                          <option value="busy">مشغول ⛔</option>
                          <option value="offline">غير متصل ⚪</option>
                        </select>
                        <input
                          type="text"
                          value={editCountryFlag}
                          onChange={(e) => setEditCountryFlag(e.target.value)}
                          placeholder="🇪🇬"
                          className="w-14 text-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">الصورة الشخصية (رابط أو رفع مضغوط)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value)}
                        placeholder="https://..."
                        dir="ltr"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                      />
                      <label className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة</span>
                        <input type="file" accept="image/*" onChange={handleUploadMemberAvatar} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">النبذة التعريفية (Bio)</label>
                    <input
                      type="text"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="نبذة عن العضو..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSavingMemberEdit || !editName.trim()}
                    onClick={() => handleSaveMemberProfileEdits(selectedMember)}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingMemberEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>حفظ تعديلات البيانات فوراً</span>
                  </button>
                </div>

                {/* 2. Role & VIP Permissions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>الترقية وتغيير الرتبة والصلاحيات</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={editRole}
                      disabled={selectedMember.role === 'owner' && !isPrimaryOwner}
                      onChange={(e) => {
                        const r = e.target.value as UserRole;
                        setEditRole(r);
                        const opt = ROLE_OPTIONS.find((o) => o.value === r);
                        setEditVipBadge(opt?.badge || (r === 'owner' ? 'المالك 👑' : ''));
                      }}
                      className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-black text-indigo-900"
                    >
                      {isPrimaryOwner && <option value="owner">المالك 👑</option>}
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editVipBadge}
                      onChange={(e) => setEditVipBadge(e.target.value)}
                      placeholder="مسمى الشارة / اللقب (اختياري)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetRole(selectedMember, editRole, editVipBadge)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تطبيق الرتبة واللقب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBadge(selectedMember, 'أكثر الهدايا')}
                      className="px-2.5 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-[11px] font-bold cursor-pointer"
                    >
                      + شارة 🎁 أكثر الهدايا
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBadge(selectedMember, 'صوت ماسي')}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-bold cursor-pointer"
                    >
                      + شارة 🎙️ صوت ماسي
                    </button>
                  </div>
                </div>

                {/* 3. Ban (Temp / Permanent) & Unban & Mute */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      <span>الحظر وفك الحظر والكتم</span>
                    </span>
                    {isMemberBannedNow(selectedMember) ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                        {selectedMember.isBanned
                          ? '🚫 محظور دائماً'
                          : `⏳ محظور مؤقتاً حتى ${new Date(selectedMember.bannedUntil || 0).toLocaleString('ar-EG')}`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                        ✅ حساب نشط غير محظور
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={banReasonInput}
                    onChange={(e) => setBanReasonInput(e.target.value)}
                    placeholder="سبب الحظر (اختياري)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTempBan(selectedMember, 60 * 60 * 1000, 'ساعة واحدة', banReasonInput)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>حظر 1 ساعة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTempBan(selectedMember, 24 * 60 * 60 * 1000, '24 ساعة', banReasonInput)}
                      className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>حظر 24 ساعة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTempBan(selectedMember, 7 * 24 * 60 * 60 * 1000, '7 أيام', banReasonInput)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>حظر 7 أيام</span>
                    </button>

                    {!selectedMember.isBanned && (
                      <button
                        type="button"
                        onClick={async () => {
                          const updates: Partial<User> = {
                            isBanned: true,
                            bannedUntil: null,
                            banReason: banReasonInput.trim() || 'حظر دائم من الإدارة',
                          };
                          await adminUpdateUser(selectedMember.id, updates);
                          setUsersList((prev) => prev.map((u) => (u.id === selectedMember.id ? { ...u, ...updates } : u)));
                          if (onUserModified) onUserModified({ id: selectedMember.id, ...updates });
                          showNotification(`تم حظر ${selectedMember.name} دائماً 🚫`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3 h-3" />
                        <span>حظر دائم 🚫</span>
                      </button>
                    )}

                    {isMemberBannedNow(selectedMember) && (
                      <button
                        type="button"
                        onClick={() => handleToggleBan(selectedMember)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>فك الحظر الآن ✅</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleMute(selectedMember)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                        selectedMember.isMuted
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {selectedMember.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{selectedMember.isMuted ? 'إلغاء الكتم' : 'كتم العضو'}</span>
                    </button>
                  </div>
                </div>

                {/* 4. Coins Management */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span>إدارة الكوينز والرصيد (سجل فوري)</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
                      {(selectedMember.coins || 0).toLocaleString()} 🪙
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={coinsAmountInput}
                      onChange={(e) => setCoinsAmountInput(e.target.value)}
                      placeholder="المبلغ بالكوينز..."
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                    />
                    <input
                      type="text"
                      value={coinsNoteInput}
                      onChange={(e) => setCoinsNoteInput(e.target.value)}
                      placeholder="ملاحظة العملية (اختياري)..."
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[100, 500, 1000, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCoinsAmountInput(String(preset))}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                      >
                        {preset.toLocaleString()} 🪙
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Math.max(0, Math.floor(Number(coinsAmountInput) || 0));
                        if (amt > 0) handleAdjustCoins(selectedMember, amt, 'add', coinsNoteInput.trim());
                      }}
                      className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Math.max(0, Math.floor(Number(coinsAmountInput) || 0));
                        if (amt > 0) handleAdjustCoins(selectedMember, amt, 'deduct', coinsNoteInput.trim());
                      }}
                      className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>خصم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Math.max(0, Math.floor(Number(coinsAmountInput) || 0));
                        handleAdjustCoins(selectedMember, amt, 'set', coinsNoteInput.trim());
                      }}
                      className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>تعيين (=)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backup Restore Confirmation Dialog */}
        {confirmRestoreSnapshot && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white border border-amber-300 rounded-3xl p-5 shadow-2xl space-y-4 text-right">
              <div className="flex items-center gap-2 text-amber-700">
                <RotateCcw className="w-5 h-5" />
                <h4 className="text-sm font-black text-slate-900">تأكيد استعادة النسخة الاحتياطية</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                هل أنت متأكد من استعادة بيانات اللقطة{' '}
                <span className="font-mono font-black text-slate-900">{confirmRestoreSnapshot.id}</span>؟
                سيتم تحديث بيانات الأعضاء والغرف بما يتطابق مع هذه النسخة ({confirmRestoreSnapshot.usersCount} عضو، {confirmRestoreSnapshot.roomsCount} غرفة).
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRestoringBackup}
                  onClick={handleConfirmRestoreBackup}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isRestoringBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isRestoringBackup ? 'جاري الاستعادة...' : 'تأكيد الاستعادة الآن'}</span>
                </button>
                <button
                  type="button"
                  disabled={isRestoringBackup}
                  onClick={() => setConfirmRestoreSnapshot(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
