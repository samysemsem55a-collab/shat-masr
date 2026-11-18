import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast, type ToasterProps } from 'sonner';
import { X, Check, RefreshCw, UserPlus, MessageCircle, Sparkles, Download } from 'lucide-react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { RoomsView } from './components/RoomsView';
import { RoomActiveView } from './components/RoomActiveView';
import { GamesView } from './components/GamesView';
import { PrivateChatView } from './components/PrivateChatView';
import { ProfileView } from './components/ProfileView';
import { LuxuryGiftModal } from './components/LuxuryGiftModal';
import { FullscreenGiftOverlay } from './components/FullscreenGiftOverlay';
import { WalletModal } from './components/WalletModal';
import { VipUpgradeModal } from './components/VipUpgradeModal';
import { CreateRoomModal } from './components/CreateRoomModal';
import { NotificationsModal } from './components/NotificationsModal';
import { OnlineUsersModal } from './components/OnlineUsersModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MusicRadioModal } from './components/MusicRadioModal';
import { FloatingMiniRadioBar } from './components/FloatingMiniRadioBar';
import { FriendRequestsModal } from './components/FriendRequestsModal';
import { AdminControlPanelModal } from './components/AdminControlPanelModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { PrivateRoomPromptModal } from './components/PrivateRoomPromptModal';
import { PhoneAuthModal } from './components/PhoneAuthModal';
import { WelcomeAuthModal } from './components/WelcomeAuthModal';
import { CallModal } from './components/CallModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ConsentRequestModal } from './components/ConsentRequestModal';
import {
  ConsentRequestPayload,
  respondToConsentRequest,
  subscribeToIncomingConsentRequests,
} from './services/consentService';

import { User, Room, Message, GiftItem, VipTier, SpeakerSeat, FriendRequest, DailyMission, UnreadSenderSummary } from './types/chat';
import { INITIAL_ROOMS, getOrCreateUser, isUserAdminOrOwner, hasCompletedMandatoryProfile } from './data/seedData';
import { sounds } from './utils/soundEffects';
import { preloadAppAssets } from './utils/assetCache';
import { realtimeSocket } from './services/realtimeSocket';
import { offlineQueue } from './services/offlineQueue';
import { globalRadioPlayer } from './services/radioPlayer';
import {
  initExternalPushNotifications,
  requestPushNotificationPermission,
  triggerExternalBrowserNotification,
} from './services/pushNotifications';
import { 
  CLIENT_APP_VERSION,
  subscribeToRoomMessages, 
  sendFirestoreMessage, 
  sendDirectMessage,
  subscribeToRoomPresence, 
  subscribeToGlobalPresence,
  subscribeToFriendRequests,
  subscribeToUserProfile,
  syncUserProfileToFirebase,
  awardBadgeToUser,
  sendRoomJoinRequest,
  logOutUser,
  acceptFriendRequestInDB,
  declineFriendRequestInDB,
  checkAndMarkFirstPublicRoomEntry,
  syncCumulativeVisitorsRealtime,
  setRoomBackgroundTheme,
  setRoomLockState,
  subscribeToAllRoomLocks,
  contributeToSharedRoomMission,
  subscribeToAllRoomLastMessages,
  recordGiftRecipientStats,
  propagateUserIdentityAcrossApp,
  subscribeToAppUpdateNotices,
  subscribeToRemoteAppVersion,
  subscribeToUnreadMessagesCount,
  resetDirectChatUnreadInDB,
  resetAllDirectChatsUnreadInDB,
  loadUserThemeSettings,
  updatePresenceCurrentRoom,
  markUserPresenceOffline,
  createDailyBackupSnapshot,
  grantUserXp,
  AppUpdateNotice
} from './services/firebase';

function isNewerVersion(remote: string, local: string): boolean {
  const rParts = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = local.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

function areUserListsEqual(a: User[], b: User[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const u1 = a[i];
    const u2 = b[i];
    if (
      u1.id !== u2.id ||
      u1.name !== u2.name ||
      u1.avatar !== u2.avatar ||
      u1.status !== u2.status ||
      u1.role !== u2.role ||
      u1.vipBadge !== u2.vipBadge ||
      Boolean(u1.isBanned) !== Boolean(u2.isBanned) ||
      Boolean(u1.isMuted) !== Boolean(u2.isMuted)
    ) {
      return false;
    }
  }
  return true;
}

const IGNORED_PROFILE_DIFF_KEYS = new Set(['updatedAt', 'lastSeen', 'joinedAt']);

function hasUserVisibleChange(prev: User, patch: Partial<User>): boolean {
  for (const [key, val] of Object.entries(patch)) {
    if (IGNORED_PROFILE_DIFF_KEYS.has(key) || val === undefined) continue;
    const prevVal = (prev as any)[key];
    if (Array.isArray(val) && Array.isArray(prevVal)) {
      if (val.length !== prevVal.length || val.some((v, idx) => v !== prevVal[idx])) {
        return true;
      }
    } else if (prevVal !== val) {
      return true;
    }
  }
  return false;
}

export default function App() {
  // 1. Core User State: Guaranteed Unique Per-Device User + Persistent Tab Session ID
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const u = getOrCreateUser();
    try {
      let sid = sessionStorage.getItem('shat_masr_session_id');
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        sessionStorage.setItem('shat_masr_session_id', sid);
      }
      return { ...u, sessionId: u.sessionId || sid };
    } catch {
      return u;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shat_masr_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    root.classList.toggle('light', !isDarkMode);
    try {
      localStorage.setItem('shat_masr_theme', isDarkMode ? 'dark' : 'light');
    } catch {}
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', isDarkMode ? '#0b1222' : '#4f46e5');
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    sounds.playMessageSent();
    setIsDarkMode((prev) => {
      const next = !prev;
      toast.success(next ? 'تم تفعيل الوضع الليلي المريح للعين 🌙' : 'تم التبديل إلى الوضع النهاري الفاتح ☀️');
      return next;
    });
  }, []);

  const [targetChatUser, setTargetChatUser] = useState<User | null>(null);
  const [isInsidePrivateChat, setIsInsidePrivateChat] = useState<boolean>(false);

  // Per-sender unread incoming message tracking (persisted per user + synced live with Firestore)
  const [unreadSendersMap, setUnreadSendersMap] = useState<Record<string, UnreadSenderSummary>>(() => {
    try {
      const saved = localStorage.getItem(`shat_masr_unread_senders_${currentUser.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const processedUnreadDmIdsRef = useRef<Set<string>>(new Set());
  const processedBannerDmIdsRef = useRef<Set<string>>(new Set());
  const recentlyClearedPeerRef = useRef<Map<string, number>>(new Map());
  const recentlyClearedAllAtRef = useRef<number>(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`shat_masr_unread_senders_${currentUser.id}`);
      setUnreadSendersMap(saved ? JSON.parse(saved) : {});
    } catch {
      setUnreadSendersMap({});
    }
  }, [currentUser.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`shat_masr_unread_senders_${currentUser.id}`, JSON.stringify(unreadSendersMap));
    } catch {}
  }, [unreadSendersMap, currentUser.id]);

  const clearUnreadForSender = useCallback((senderId: string) => {
    if (!senderId) return;
    recentlyClearedPeerRef.current.set(senderId, Date.now());
    setUnreadSendersMap((prev) => {
      if (!prev[senderId]) return prev;
      const next = { ...prev };
      delete next[senderId];
      return next;
    });
    resetDirectChatUnreadInDB(currentUserRef.current.id, senderId).catch(() => {});
  }, []);

  const clearAllUnreadMessages = useCallback(() => {
    recentlyClearedAllAtRef.current = Date.now();
    setUnreadSendersMap({});
    resetAllDirectChatsUnreadInDB(currentUserRef.current.id).catch(() => {});
  }, []);

  const unreadMessagesBySender = useMemo(
    () =>
      Object.values(unreadSendersMap)
        .filter((item) => item.count > 0)
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    [unreadSendersMap]
  );

  const totalUnreadMessagesCount = useMemo(
    () => unreadMessagesBySender.reduce((sum, item) => sum + item.count, 0),
    [unreadMessagesBySender]
  );

  const unreadCountsBySenderId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of unreadMessagesBySender) {
      counts[item.senderId] = item.count;
    }
    return counts;
  }, [unreadMessagesBySender]);

  const showAppNotice = (text: string, tone: 'info' | 'warn' | 'error' = 'info') => {
    if (tone === 'error') {
      toast.error(text);
    } else if (tone === 'warn') {
      toast.warning(text);
    } else {
      toast.info(text);
    }
  };

  // Guaranteed Unique Device Identifier for Cumulative Visitor Counting (Requirement 7 & 9)
  const [deviceId] = useState<string>(() => {
    try {
      let id = localStorage.getItem('shat_masr_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('shat_masr_device_id', id);
      }
      return id;
    } catch {
      return 'dev_' + Date.now();
    }
  });

  // Cumulative Visitors Counter (Increments with each visit/login and never decreases)
  const [cumulativeVisitorsCount, setCumulativeVisitorsCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shat_masr_cumulative_visitors');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 15480) return val;
      }
    } catch {}
    return 15480;
  });

  const [rooms, setRooms] = useState<Room[]>(() => {
    const hydrateRoomBg = (list: Room[]) =>
      list.map(r => {
        let next = r;
        try {
          const cachedBg = localStorage.getItem(`room_bg_theme_${r.id}`);
          if (cachedBg && cachedBg !== 'default') {
            next = { ...next, backgroundTheme: cachedBg };
          }
          if (localStorage.getItem(`room_lock_${r.id}`) === 'true') {
            next = { ...next, isLocked: true };
          }
        } catch {}
        return next;
      });

    try {
      const saved = localStorage.getItem('arab_chat_rooms');
      if (saved) {
        const parsed: Room[] = JSON.parse(saved);
        const valid = parsed.filter(r => r.id === 'room_egypt' || r.id === 'room_egypt2');
        if (valid.length === 2) return hydrateRoomBg(valid);
      }
    } catch {}
    return hydrateRoomBg(INITIAL_ROOMS);
  });

  // Real-time messages for active room from Firestore
  const [activeRoomMessages, setActiveRoomMessages] = useState<Message[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Real-time Presence
  const [roomActiveUsers, setRoomActiveUsers] = useState<User[]>([]);
  const [roomActiveCount, setRoomActiveCount] = useState<number>(1);
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState<User[]>([currentUser]);

  // Friend Requests State
  const [pendingFriendRequests, setPendingFriendRequests] = useState<FriendRequest[]>([]);
  const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState(false);

  // Real-time Top Floating Banners (Global Join, DM Notice, Friend Request, App Update)
  const [globalJoinBanner, setGlobalJoinBanner] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const globalJoinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dmTopBanner, setDmTopBanner] = useState<{
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    preview: string;
  } | null>(null);
  const dmTopBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [friendReqBanner, setFriendReqBanner] = useState<FriendRequest | null>(null);
  const friendReqBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenFriendBannerIdsRef = useRef<Set<string>>(new Set());

  const [appUpdateNotice, setAppUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [remoteVersionInfo, setRemoteVersionInfo] = useState<{ version: string; forceUpdate: boolean; message?: string } | null>(null);
  const [isRemoteBannerDismissed, setIsRemoteBannerDismissed] = useState(false);

  // Modals State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipientUser, setGiftRecipientUser] = useState<User | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [createRoomType, setCreateRoomType] = useState<'voice' | 'text_only'>('voice');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isOnlineUsersOpen, setIsOnlineUsersOpen] = useState(false);
  const [isPrivateChatDrawerOpen, setIsPrivateChatDrawerOpen] = useState(false);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [incomingConsentRequest, setIncomingConsentRequest] = useState<ConsentRequestPayload | null>(null);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const isProfileReady = hasCompletedMandatoryProfile(currentUser);
  const [isWelcomeAuthOpen, setIsWelcomeAuthOpen] = useState<boolean>(() => !hasCompletedMandatoryProfile(currentUser));
  const [authModalMode, setAuthModalMode] = useState<'onboarding' | 'exclusive_auth'>(() =>
    hasCompletedMandatoryProfile(currentUser) ? 'exclusive_auth' : 'onboarding'
  );

  // Global Persistent FM Radio & Music Player Playing Indicator (decoupled from tick/buffer churn)
  const [isRadioPlaying, setIsRadioPlaying] = useState<boolean>(() => globalRadioPlayer.getSnapshot().isPlaying);

  // Incoming Call State (WebRTC)
  const [incomingCall, setIncomingCall] = useState<{
    peer: User;
    callType: 'audio' | 'video';
    signal: any;
  } | null>(null);

  useEffect(() => {
    const unsub = globalRadioPlayer.subscribe((snap) => {
      setIsRadioPlaying((prev) => (prev === snap.isPlaying ? prev : snap.isPlaying));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isWelcomeAuthOpen) {
      globalRadioPlayer.tryAutoPlayFM();
    }
  }, [isWelcomeAuthOpen]);

  // Fullscreen Celebratory Gift Overlay
  const [activeFullscreenGift, setActiveFullscreenGift] = useState<{
    gift: GiftItem;
    senderName: string;
    recipientName: string;
  } | null>(null);

  // Currency & Language
  const [currency, setCurrency] = useState<'EGP' | 'USD' | 'SAR' | 'AED'>('EGP');
  const [language, setLanguage] = useState<'ar' | 'en' | 'fr'>('ar');

  // Private Room Access State (Requirement 7)
  const [isPrivatePromptOpen, setIsPrivatePromptOpen] = useState(false);
  const [privatePromptRoom, setPrivatePromptRoom] = useState<Room | null>(null);

  // Anti-duplicate message tracking (Requirement 3)
  const isSendingMessageRef = useRef<boolean>(false);
  const lastMessagePayloadRef = useRef<{ content: string; time: number }>({ content: '', time: 0 });

  // Daily Missions State
  const [isDailyMissionsOpen, setIsDailyMissionsOpen] = useState(false);
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>(() => {
    const saved = localStorage.getItem('arab_chat_daily_missions');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'send_5_messages',
        title: 'إرسال 5 رسائل في الشات',
        description: 'شارك وتفاعل بالرسائل في أي غرفة أو مجلس',
        icon: '💬',
        rewardCoins: 50,
        currentProgress: 0,
        targetProgress: 5,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'join_voice_room',
        title: 'دخول مجلس صوتي والتفاعل',
        description: 'ادخل أي غرفة صوتية واستمع للمتحدثين أو شارك بالحديث',
        icon: '🎙️',
        rewardCoins: 75,
        currentProgress: 0,
        targetProgress: 1,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'send_gift',
        title: 'إرسال هدية مميزة',
        description: 'أرسل هدية لأحد المتحدثين أو مضيف المجلس لإشعال الأجواء',
        icon: '🎁',
        rewardCoins: 100,
        currentProgress: 0,
        targetProgress: 1,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'update_profile',
        title: 'تحديث الصورة والملف الشخصي',
        description: 'قم بتغيير صورتك الرمزية أو تحديث النبذة التعريفية',
        icon: '✨',
        rewardCoins: 50,
        currentProgress: 0,
        targetProgress: 1,
        isCompleted: false,
        isClaimed: false
      }
    ];
  });

  // Daily Mission progress updater
  const updateMissionProgress = (missionId: string, incrementValue: number = 1) => {
    setDailyMissions(prev => {
      const updated = prev.map(m => {
        if (m.id === missionId && !m.isCompleted) {
          const nextVal = Math.min(m.targetProgress, m.currentProgress + incrementValue);
          return {
            ...m,
            currentProgress: nextVal,
            isCompleted: nextVal >= m.targetProgress
          };
        }
        return m;
      });
      localStorage.setItem('arab_chat_daily_missions', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClaimMissionReward = (missionId: string) => {
    setDailyMissions(prev => {
      const target = prev.find(m => m.id === missionId);
      if (!target || target.isClaimed || !target.isCompleted) return prev;

      const updated = prev.map(m => m.id === missionId ? { ...m, isClaimed: true } : m);
      localStorage.setItem('arab_chat_daily_missions', JSON.stringify(updated));

      const newCoins = currentUser.coins + target.rewardCoins;
      const updatedUser = { ...currentUser, coins: newCoins };
      setCurrentUser(updatedUser);
      syncUserProfileToFirebase(updatedUser);
      toast.success(`تم استلام مكافأة المهمة (+${target.rewardCoins} كوينز) 🪙`);

      return updated;
    });
  };

  const handleRequestJoinPrivateRoom = async (roomId: string): Promise<boolean> => {
    await sendRoomJoinRequest(roomId, currentUser);
    return true;
  };

  const currentUserRef = useRef<User>(currentUser);
  currentUserRef.current = currentUser;

  const globalOnlineUsersRef = useRef<User[]>(globalOnlineUsers);
  globalOnlineUsersRef.current = globalOnlineUsers;

  // Persist User Changes & Sync to Firebase only after mandatory onboarding completes
  useEffect(() => {
    if (hasCompletedMandatoryProfile(currentUser)) {
      localStorage.setItem('arab_chat_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Subscribe to real-time User Profile updates from Firebase Realtime Database (silent equality check)
  useEffect(() => {
    if (!isProfileReady) return;
    const unsub = subscribeToUserProfile(currentUser.id, (profileUpdate) => {
      setCurrentUser(prev => {
        if (!hasUserVisibleChange(prev, profileUpdate)) return prev;
        return { ...prev, ...profileUpdate };
      });
    });
    return () => unsub();
  }, [currentUser.id, isProfileReady]);

  // Hydrate persisted Theme & Wallpaper settings + preload static assets + remote version check + offline queue handler
  useEffect(() => {
    const unsubRemoteVersion = subscribeToRemoteAppVersion((cfg) => {
      if (cfg && isNewerVersion(cfg.latestVersion, CLIENT_APP_VERSION)) {
        setRemoteVersionInfo({
          version: cfg.latestVersion,
          forceUpdate: Boolean(cfg.forceUpdate),
          message: cfg.message,
        });
      } else {
        setRemoteVersionInfo(null);
      }
    });

    offlineQueue.setFlushHandler(async (item) => {
      if (item.targetType === 'room' && item.targetId) {
        const syncedMsg: Message = { ...item.message, status: 'read' };
        realtimeSocket.sendMessage(item.targetId, syncedMsg);
        await sendFirestoreMessage(item.targetId, syncedMsg);
        setActiveRoomMessages((prev) =>
          prev.map((m) => (m.id === item.id ? syncedMsg : m))
        );
        return;
      }
      if (item.targetType === 'dm' && item.recipientId) {
        const syncedMsg: Message = { ...item.message, status: 'sent' };
        realtimeSocket.sendDirectMessage(item.targetId, item.recipientId, syncedMsg, item.recipientSessionId);
        await sendDirectMessage(syncedMsg.senderId || currentUserRef.current.id, item.recipientId, syncedMsg);
      }
    });
    offlineQueue.flushAll();

    return () => {
      unsubRemoteVersion();
    };
  }, []);

  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    loadUserThemeSettings(currentUser.id).then((savedTheme) => {
      if (!savedTheme) return;
      if (typeof savedTheme.isDarkMode === 'boolean') {
        setIsDarkMode(savedTheme.isDarkMode);
      }
      if (savedTheme.chatWallpaper) {
        setCurrentUser((prev) =>
          prev.chatWallpaper === savedTheme.chatWallpaper
            ? prev
            : { ...prev, chatWallpaper: savedTheme.chatWallpaper }
        );
      }
    }).catch(() => {});

    if (!currentUser.dataSaverMode) {
      const urls: string[] = [];
      if (currentUser.avatar) urls.push(currentUser.avatar);
      INITIAL_ROOMS.forEach((r) => {
        if (r.coverImage) urls.push(r.coverImage);
        if (r.imageUrl) urls.push(r.imageUrl);
      });
      preloadAppAssets(urls);
    }
  }, [isProfileReady, currentUser.id, currentUser.dataSaverMode]);

  // Update Firebase presence currentRoom & mark offline on tab close
  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    updatePresenceCurrentRoom(currentUser.id, activeRoom?.id || null).catch(() => {});
  }, [isProfileReady, currentUser.id, activeRoom?.id]);

  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    const handleBeforeUnload = () => {
      markUserPresenceOffline(currentUser.id).catch(() => {});
    };
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProfileReady, currentUser.id]);

  // Daily Auto-Backup Scheduler for Primary Owner (once per day after 3:00 AM)
  useEffect(() => {
    if (!isProfileReady || currentUser.role !== 'owner') return;
    const now = new Date();
    if (now.getHours() < 3) return;
    const todayKey = now.toISOString().slice(0, 10);
    try {
      if (localStorage.getItem('shat_masr_last_auto_backup_day') === todayKey) return;
      localStorage.setItem('shat_masr_last_auto_backup_day', todayKey);
    } catch {}
    createDailyBackupSnapshot(currentUser.id, globalOnlineUsersRef.current, rooms.length).catch(() => {});
  }, [isProfileReady, currentUser.id, currentUser.role, rooms.length]);

  // 1. Initialize Real-Time WebSocket Connection across all devices (gated until mandatory profile complete)
  useEffect(() => {
    if (!isProfileReady) return;
    const activeUser = currentUserRef.current;
    realtimeSocket.connect(activeUser);

    // Listen to global presence updates (real connected users via WebSocket)
    const unsubGlobal = realtimeSocket.subscribeToGlobalPresence((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        const self = currentUserRef.current;
        const map = new Map<string, User>();
        map.set(self.id, self);
        liveUsers.forEach(u => {
          if (u && u.id) map.set(u.id, u);
        });
        const nextList = Array.from(map.values());
        setGlobalOnlineUsers(prev => (areUserListsEqual(prev, nextList) ? prev : nextList));
      }
    });

    // Also listen to Firestore global presence (multi-session across browser instances)
    const unsubFirestorePresence = subscribeToGlobalPresence(activeUser, (liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        setGlobalOnlineUsers(prev => {
          const map = new Map<string, User>();
          prev.forEach(u => map.set(u.id, u));
          liveUsers.forEach(u => map.set(u.id, u));
          const nextList = Array.from(map.values());
          return areUserListsEqual(prev, nextList) ? prev : nextList;
        });
      }
    });

    // Listen to admin actions (instant VIP, ban, mute, coins)
    const unsubAdmin = realtimeSocket.subscribeToAdminEvents((targetUserId, updates) => {
      if (targetUserId === currentUserRef.current.id) {
        setCurrentUser(prev => (hasUserVisibleChange(prev, updates) ? { ...prev, ...updates } : prev));
      }
      setGlobalOnlineUsers(prev => {
        let changed = false;
        const next = prev.map(u => {
          if (u.id === targetUserId && hasUserVisibleChange(u, updates)) {
            changed = true;
            return { ...u, ...updates };
          }
          return u;
        });
        return changed ? next : prev;
      });
    });

    // Listen to incoming friend requests over instant WebSocket (merges cleanly sorted newest-first)
    const unsubFriend = realtimeSocket.subscribeToFriendRequests((req) => {
      const me = currentUserRef.current;
      if (req && req.receiverId === me.id && req.status === 'pending') {
        if (!seenFriendBannerIdsRef.current.has(req.id)) {
          seenFriendBannerIdsRef.current.add(req.id);
          sounds.playMessageReceived();
          setFriendReqBanner(req);
          if (friendReqBannerTimerRef.current) clearTimeout(friendReqBannerTimerRef.current);
          friendReqBannerTimerRef.current = setTimeout(() => {
            setFriendReqBanner((curr) => (curr?.id === req.id ? null : curr));
          }, 10000);
          if (typeof document !== 'undefined' && document.hidden) {
            triggerExternalBrowserNotification(
              `طلب صداقة جديد من ${req.senderName}`,
              'اضغط لقبول أو رفض طلب الصداقة',
              { senderId: req.senderId }
            );
          }
        }
        setPendingFriendRequests(prev => {
          const filtered = prev.filter(r => r.id !== req.id && r.senderId !== req.senderId);
          return [req, ...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        });
      }
    });

    // Do NOT trigger join notifications upon app login — only inside active rooms
    const unsubGlobalJoin = realtimeSocket.subscribeToGlobalUserJoined(() => {});

    // Real-time App Update Notice Banner
    const unsubAppUpdate = subscribeToAppUpdateNotices((notice) => {
      setAppUpdateNotice(notice);
    });

    // Live Last Message Preview across all rooms
    const unsubRoomLastMsgs = subscribeToAllRoomLastMessages((lastMsgMap) => {
      setRooms(prev => {
        let changed = false;
        const next = prev.map(r => {
          const lm = lastMsgMap[r.id];
          if (!lm) return r;
          if (
            r.lastMessage?.timestamp === lm.timestamp &&
            r.lastMessage?.content === lm.content &&
            r.lastMessage?.senderName === lm.senderName
          ) {
            return r;
          }
          changed = true;
          return { ...r, lastMessage: lm };
        });
        return changed ? next : prev;
      });
    });

    // Listen to room background theme updates across all rooms (silent no-op if unchanged)
    const unsubRoomBgs = realtimeSocket.subscribeToAllRoomBackgrounds((backgrounds) => {
      setRooms(prev => {
        let changed = false;
        const next = prev.map(r => {
          const serverTheme = backgrounds[r.id];
          const normalized = serverTheme && serverTheme !== 'default' ? serverTheme : undefined;
          if (r.backgroundTheme === normalized) return r;
          changed = true;
          return { ...r, backgroundTheme: normalized };
        });
        return changed ? next : prev;
      });
      setActiveRoom(prev => {
        if (!prev) return prev;
        const serverTheme = backgrounds[prev.id];
        const normalized = serverTheme && serverTheme !== 'default' ? serverTheme : undefined;
        return prev.backgroundTheme === normalized ? prev : { ...prev, backgroundTheme: normalized };
      });
    });

    // Listen to room lock status across all rooms (silent no-op if unchanged)
    const unsubRoomLocks = subscribeToAllRoomLocks((locks) => {
      setRooms(prev => {
        let changed = false;
        const next = prev.map(r => {
          const nextLocked = Boolean(locks[r.id]);
          if (Boolean(r.isLocked) === nextLocked) return r;
          changed = true;
          return { ...r, isLocked: nextLocked };
        });
        return changed ? next : prev;
      });
      setActiveRoom(prev => {
        if (!prev) return prev;
        const nextLocked = Boolean(locks[prev.id]);
        return Boolean(prev.isLocked) === nextLocked ? prev : { ...prev, isLocked: nextLocked };
      });
    });

    // Listen to incoming WebRTC calls targeting current user (and clear on call_end / call_reject)
    const unsubCalls = realtimeSocket.subscribeToCallSignals((signal) => {
      const me = currentUserRef.current;
      if (!signal) return;
      if (signal.targetUserId && signal.targetUserId !== me.id) return;

      if (signal.type === 'call_end' || signal.type === 'call_reject') {
        setIncomingCall((prev) => {
          if (!prev) return null;
          if (!signal.fromUserId || prev.peer.id === signal.fromUserId || signal.targetUserId === me.id) {
            return null;
          }
          return prev;
        });
        return;
      }

      if (signal.type !== 'call_offer') return;
      if (!signal.fromUserId || signal.fromUserId === me.id) return;

      sounds.playMessageReceived();
      setIncomingCall({
        peer: {
          id: signal.fromUserId,
          name: signal.callerName || 'عضو متصل',
          username: (signal.callerName || 'member').toLowerCase(),
          avatar: signal.callerAvatar || '',
          bio: 'عضو في شات مصر',
          country: 'مصر',
          countryFlag: signal.callerFlag || '🇪🇬',
          role: 'member',
          coins: 0,
          earningsEgp: 0,
          earningsUsd: 0,
          vipBadge: '',
          frameStyle: 'border-slate-300',
          profileWallpaper: '',
          fontPreference: 'cairo',
          isOnline: true,
          status: 'online',
          joinedAt: new Date().toISOString(),
          gender: 'male',
          level: 1,
          likesReceived: 0,
          giftsReceivedCount: 0,
          badges: [],
        },
        callType: signal.callType === 'video' ? 'video' : 'audio',
        signal,
      });
    });

    return () => {
      unsubGlobal();
      unsubFirestorePresence();
      unsubAdmin();
      unsubFriend();
      unsubGlobalJoin();
      unsubAppUpdate();
      unsubRoomLastMsgs();
      unsubRoomBgs();
      unsubRoomLocks();
      unsubCalls();
    };
  }, [currentUser.id, currentUser.sessionId, isProfileReady]);

  // Track Cumulative Visitor on each visit/session and sync atomically in real time (never decreases)
  useEffect(() => {
    const sessionKey = `shat_masr_visit_counted_${deviceId}`;
    const alreadyCountedInSession = sessionStorage.getItem(sessionKey);
    const shouldIncrement = !alreadyCountedInSession;
    if (shouldIncrement) {
      sessionStorage.setItem(sessionKey, 'true');
    }

    const visitToken = `${deviceId}_${sessionStorage.getItem('shat_masr_session_id') || 's'}`;
    const unsub = syncCumulativeVisitorsRealtime(
      visitToken,
      shouldIncrement,
      cumulativeVisitorsCount,
      (highestCount) => {
        setCumulativeVisitorsCount((prev) => {
          const next = Math.max(prev, highestCount, 15480);
          if (next === prev) return prev;
          try {
            localStorage.setItem('shat_masr_cumulative_visitors', String(next));
          } catch {}
          return next;
        });
      }
    );

    return () => unsub();
  }, [deviceId]);

  // Listen for real-time incoming direct messages across the entire app (supports registered users & online guests via ID/sessionId)
  useEffect(() => {
    const getConvId = (u1: string, u2: string) => [u1, u2].sort().join('_');

    const handleIncomingDm = (rawMsg: any) => {
      if (!rawMsg) return;
      const isForMe =
        rawMsg.recipientId === currentUser.id ||
        (!!currentUser.sessionId && rawMsg.recipientId === currentUser.sessionId);

      if (rawMsg.senderId !== currentUser.id && isForMe) {
        const isViewingThisSender =
          (isPrivateChatDrawerOpen || currentTab === 'chat') &&
          isInsidePrivateChat &&
          targetChatUser?.id === rawMsg.senderId;

        // Track per-sender unread incoming message count (deduplicated across WebSocket + BroadcastChannel)
        const dmDedupKey = rawMsg.id || `${rawMsg.senderId}_${rawMsg.timestamp || Date.now()}_${rawMsg.content || ''}`;
        if (!isViewingThisSender && !processedUnreadDmIdsRef.current.has(dmDedupKey)) {
          processedUnreadDmIdsRef.current.add(dmDedupKey);
          if (processedUnreadDmIdsRef.current.size > 500) {
            const firstKey = processedUnreadDmIdsRef.current.values().next().value;
            if (firstKey) processedUnreadDmIdsRef.current.delete(firstKey);
          }

          const msgPreview =
            rawMsg.type === 'gift' && rawMsg.gift
              ? `🎁 هدية: ${rawMsg.gift.name}`
              : rawMsg.type === 'voice'
              ? '🎙️ رسالة صوتية'
              : rawMsg.content || rawMsg.text || 'رسالة جديدة';

          setUnreadSendersMap((prev) => {
            const existing = prev[rawMsg.senderId];
            const nextCount = (existing?.count || 0) + 1;
            const senderDisplayName = rawMsg.senderName || existing?.senderName || 'عضو شات مصر';
            const dmPrefsEnabled = currentUser.notificationPrefs?.directMessages !== false;
            if (dmPrefsEnabled) {
              toast.info(
                nextCount > 1
                  ? `رسائل خاصة جديدة (${nextCount}) من ${senderDisplayName} 💬`
                  : `رسالة خاصة جديدة من ${senderDisplayName} 💬`,
                {
                  id: `grouped_dm_${rawMsg.senderId}`,
                  description: msgPreview,
                  duration: 5000,
                }
              );
            }
            return {
              ...prev,
              [rawMsg.senderId]: {
                senderId: rawMsg.senderId,
                senderName: senderDisplayName,
                senderAvatar: rawMsg.senderAvatar || existing?.senderAvatar || '',
                count: nextCount,
                lastMessage: msgPreview,
                lastTimestamp: rawMsg.timestamp || Date.now()
              }
            };
          });
        }

        // Persist incoming DM locally so visitors/members see it immediately when opening PrivateChatView
        try {
          const convId = getConvId(currentUser.id, rawMsg.senderId);
          const localKey = `direct_messages_${convId}`;
          const saved = localStorage.getItem(localKey);
          const list: any[] = saved ? JSON.parse(saved) : [];
          if (!list.some((m) => m.id === rawMsg.id)) {
            list.push({
              ...rawMsg,
              recipientId: currentUser.id,
              status: rawMsg.status || 'delivered'
            });
            localStorage.setItem(localKey, JSON.stringify(list));
          }
          const recentKey = `recent_direct_chats_${currentUser.id}`;
          const savedRecent = localStorage.getItem(recentKey);
          const recents: any[] = savedRecent ? JSON.parse(savedRecent) : [];
          const nextRecent = [
            {
              peerId: rawMsg.senderId,
              peerName: rawMsg.senderName || 'عضو شات مصر',
              peerAvatar: rawMsg.senderAvatar || '',
              lastMessage: rawMsg.content || rawMsg.text || 'رسالة جديدة',
              lastTimestamp: rawMsg.timestamp || Date.now(),
              isOnline: true
            },
            ...recents.filter((c) => c.peerId !== rawMsg.senderId)
          ];
          localStorage.setItem(recentKey, JSON.stringify(nextRecent));
        } catch {}

        // Check user notification preferences for DMs & Gifts
        let dmNotifsEnabled = currentUser.notificationPrefs?.directMessages !== false;
        let giftNotifsEnabled = currentUser.notificationPrefs?.gifts !== false;
        try {
          const prefsRaw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
          if (prefsRaw) {
            const parsedPrefs = JSON.parse(prefsRaw);
            dmNotifsEnabled = parsedPrefs.directMessages !== false;
            giftNotifsEnabled = parsedPrefs.gifts !== false;
          }
        } catch {}

        const toastPayload = {
          senderId: rawMsg.senderId,
          senderName: rawMsg.senderName || 'عضو شات مصر',
          senderAvatar: rawMsg.senderAvatar || ''
        };

        if (rawMsg.type === 'gift' && rawMsg.gift) {
          if (giftNotifsEnabled) {
            sounds.playGiftFanfare();
            toast.success(`🎁 استلمت هدية جديدة من ${toastPayload.senderName}!`, {
              id: `dm_gift_${rawMsg.id}`,
              description: `${rawMsg.gift.icon || '🎁'} ${rawMsg.gift.name} (${rawMsg.gift.cost} كوينز)`,
              duration: 6000,
              action: {
                label: 'عرض الهدية',
                onClick: () => handleOpenIncomingChat(toastPayload)
              }
            });
          }
        } else if (rawMsg.type === 'coins_transfer') {
          sounds.playCoinsReward();
          toast.success(`🪙 تحويل كوينز من ${toastPayload.senderName}`, {
            id: `dm_coins_${rawMsg.id}`,
            description: rawMsg.content || 'تم تحويل كوينز إلى رصيدك',
            duration: 6000,
            action: {
              label: 'فتح المحادثة',
              onClick: () => handleOpenIncomingChat(toastPayload)
            }
          });
        } else if (dmNotifsEnabled && !isViewingThisSender) {
          const bannerId = rawMsg.id || `dm_${rawMsg.senderId}_${rawMsg.timestamp || Date.now()}`;
          if (!processedBannerDmIdsRef.current.has(bannerId)) {
            processedBannerDmIdsRef.current.add(bannerId);
            if (processedBannerDmIdsRef.current.size > 500) {
              const firstKey = processedBannerDmIdsRef.current.values().next().value;
              if (firstKey) processedBannerDmIdsRef.current.delete(firstKey);
            }
            sounds.playMessageReceived();
            const previewText = rawMsg.content || rawMsg.text || 'رسالة جديدة';
            setDmTopBanner({
              id: bannerId,
              senderId: toastPayload.senderId,
              senderName: toastPayload.senderName,
              senderAvatar: toastPayload.senderAvatar,
              preview: previewText
            });
            if (dmTopBannerTimerRef.current) clearTimeout(dmTopBannerTimerRef.current);
            dmTopBannerTimerRef.current = setTimeout(() => {
              setDmTopBanner((curr) => (curr?.id === bannerId ? null : curr));
            }, 6000);
            if (typeof document !== 'undefined' && document.hidden) {
              triggerExternalBrowserNotification(
                `أرسل إليك ${toastPayload.senderName} رسالة خاصة`,
                previewText,
                { senderId: rawMsg.senderId },
                () => handleOpenIncomingChat(toastPayload)
              );
            }
          }
        }
      }
    };

    // 1. WebSocket direct message listener
    const unsubDm = realtimeSocket.subscribeToGlobalDirectMessages(handleIncomingDm);

    // 2. Real-time Firestore + RTDB Unread Counter listener (users/{uid}/recent_chats)
    const unsubDbUnread = isProfileReady && currentUser.id
      ? subscribeToUnreadMessagesCount(currentUser.id, (records) => {
          const now = Date.now();
          if (now - recentlyClearedAllAtRef.current < 2500) return;

          setUnreadSendersMap((prev) => {
            const next: Record<string, UnreadSenderSummary> = {};
            const dbIds = new Set<string>();

            records.forEach((rec) => {
              const clearedAt = recentlyClearedPeerRef.current.get(rec.senderId) || 0;
              if (now - clearedAt < 2500) return;
              const isViewingPeer =
                (isPrivateChatDrawerOpen || currentTab === 'chat') &&
                isInsidePrivateChat &&
                targetChatUser?.id === rec.senderId;
              if (isViewingPeer) return;

              dbIds.add(rec.senderId);
              const prevEntry = prev[rec.senderId];
              next[rec.senderId] = {
                senderId: rec.senderId,
                senderName: rec.senderName || prevEntry?.senderName || 'عضو شات مصر',
                senderAvatar: rec.senderAvatar || prevEntry?.senderAvatar || '',
                count: Math.max(rec.count, prevEntry?.count || 0),
                lastMessage: rec.lastMessage || prevEntry?.lastMessage || 'رسالة خاصة',
                lastTimestamp: Math.max(rec.lastTimestamp || 0, prevEntry?.lastTimestamp || 0)
              };

              // If Firestore delivered a brand-new message ID before/without WS banner, trigger DM top banner
              if (
                rec.lastMessageId &&
                !processedUnreadDmIdsRef.current.has(rec.lastMessageId) &&
                !processedBannerDmIdsRef.current.has(rec.lastMessageId) &&
                now - (rec.lastTimestamp || 0) < 30000
              ) {
                processedUnreadDmIdsRef.current.add(rec.lastMessageId);
                processedBannerDmIdsRef.current.add(rec.lastMessageId);
                const dmNotifsEnabled = currentUser.notificationPrefs?.directMessages !== false;
                if (dmNotifsEnabled) {
                  sounds.playMessageReceived();
                  setDmTopBanner({
                    id: rec.lastMessageId,
                    senderId: rec.senderId,
                    senderName: rec.senderName,
                    senderAvatar: rec.senderAvatar,
                    preview: rec.lastMessage
                  });
                  if (dmTopBannerTimerRef.current) clearTimeout(dmTopBannerTimerRef.current);
                  dmTopBannerTimerRef.current = setTimeout(() => {
                    setDmTopBanner((curr) => (curr?.id === rec.lastMessageId ? null : curr));
                  }, 6000);
                }
              }
            });

            // Keep any live WS-only unread entries created in the last few seconds not yet flushed to Firestore
            Object.entries(prev).forEach(([peerId, entry]) => {
              if (!dbIds.has(peerId) && now - (entry.lastTimestamp || 0) < 4000) {
                const clearedAt = recentlyClearedPeerRef.current.get(peerId) || 0;
                if (now - clearedAt >= 2500) {
                  next[peerId] = entry;
                }
              }
            });

            return next;
          });
        })
      : () => {};

    // 3. Multi-tab BroadcastChannel listener
    let bus: BroadcastChannel | null = null;
    try {
      bus = new BroadcastChannel('arab_chat_firestore_bus');
      bus.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'DIRECT_MESSAGE_UPDATE' && data.message) {
          handleIncomingDm(data.message);
        }
      };
    } catch {}

    return () => {
      unsubDm();
      unsubDbUnread();
      bus?.close();
    };
  }, [currentUser.id, currentUser.sessionId, currentUser.notificationPrefs?.directMessages, currentUser.notificationPrefs?.gifts, currentTab, isPrivateChatDrawerOpen, isInsidePrivateChat, targetChatUser?.id, isProfileReady]);

  // Initialize External Push Notifications (FCM / Service Worker / Browser Deep-Link)
  useEffect(() => {
    initExternalPushNotifications(
      (payload) => {
        if (payload?.title || payload?.body) {
          toast.info(payload.title || 'إشعار جديد', { description: payload.body });
        }
      },
      (data) => {
        if (data?.senderId) {
          const found = globalOnlineUsers.find(u => u.id === data.senderId);
          handleOpenIncomingChat({
            senderId: data.senderId,
            senderName: found?.name || 'عضو شات مصر',
            senderAvatar: found?.avatar || '',
          });
        }
      }
    );
  }, []);

  const handleOpenIncomingChat = useCallback((toastItem: { senderId: string; senderName: string; senderAvatar: string }) => {
    clearUnreadForSender(toastItem.senderId);
    const existing = globalOnlineUsersRef.current.find(u => u.id === toastItem.senderId);
    const peer: User = existing || {
      id: toastItem.senderId,
      name: toastItem.senderName,
      username: toastItem.senderName.toLowerCase().replace(/\s+/g, '_'),
      avatar: toastItem.senderAvatar,
      bio: 'عضو في شات مصر',
      country: 'مصر',
      countryFlag: '🇪🇬',
      role: 'member',
      coins: 100,
      earningsEgp: 0,
      earningsUsd: 0,
      vipBadge: '',
      frameStyle: 'border-slate-700',
      profileWallpaper: '',
      fontPreference: 'cairo',
      isOnline: true,
      status: 'online',
      joinedAt: new Date().toISOString(),
      gender: 'male',
      level: 1,
      likesReceived: 0,
      giftsReceivedCount: 0,
      badges: []
    };
    setTargetChatUser(peer);
    setIsInsidePrivateChat(true);
    setIsPrivateChatDrawerOpen(true);
    sounds.playMessageReceived();
  }, [clearUnreadForSender]);

  // Persist Rooms Changes
  useEffect(() => {
    localStorage.setItem('arab_chat_rooms', JSON.stringify(rooms));
  }, [rooms]);

  // Subscribe to real friend requests once user profile is ready (sorted newest-first)
  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    const unsub = subscribeToFriendRequests(currentUser.id, (reqs) => {
      const pending = reqs
        .filter(r => r.status === 'pending')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPendingFriendRequests(pending);
      if (pending.length > 0) {
        const unseen = pending.filter(r => !seenFriendBannerIdsRef.current.has(r.id));
        if (unseen.length > 0) {
          unseen.forEach(r => seenFriendBannerIdsRef.current.add(r.id));
          const newest = unseen[0];
          sounds.playMessageReceived();
          setFriendReqBanner(newest);
          toast.info(
            pending.length > 1
              ? `لديك ${pending.length} طلبات صداقة جديدة 🤝`
              : `لديك طلب صداقة جديد من ${newest.senderName} 🤝`,
            {
              id: 'grouped_friend_requests',
              description: pending.length > 1 ? `آخرهم من ${newest.senderName}` : 'اضغط لفتح قائمة الطلبات',
              duration: 6000,
              action: {
                label: 'عرض',
                onClick: () => setIsFriendRequestsOpen(true),
              },
            }
          );
          if (friendReqBannerTimerRef.current) clearTimeout(friendReqBannerTimerRef.current);
          friendReqBannerTimerRef.current = setTimeout(() => {
            setFriendReqBanner((curr) => (curr?.id === newest.id ? null : curr));
          }, 10000);
          if (typeof document !== 'undefined' && document.hidden) {
            triggerExternalBrowserNotification(
              `طلب صداقة جديد من ${newest.senderName}`,
              'اضغط لقبول أو رفض طلب الصداقة',
              { senderId: newest.senderId }
            );
          }
        }
      }
    });
    return () => unsub();
  }, [currentUser.id, isProfileReady]);

  // Track already-processed first-entry welcome checks in current session
  const welcomedPublicRoomKeysRef = useRef<Set<string>>(new Set());

  // Real-Time Room WebSocket & Firebase synchronization for active room
  useEffect(() => {
    if (!activeRoom) {
      setActiveRoomMessages([]);
      return;
    }

    let isCancelled = false;
    let welcomeBotTimer: ReturnType<typeof setTimeout> | null = null;

    // Join room on real-time server
    realtimeSocket.joinRoom(activeRoom.id, currentUser);

    // Subscribe to server-side room presence (real live users)
    const unsubPresence = realtimeSocket.subscribeToPresence(activeRoom.id, (count, occupants) => {
      setRoomActiveCount(prev => (prev === count ? prev : count));
      setRoomActiveUsers(prev => (areUserListsEqual(prev, occupants) ? prev : occupants));
      setRooms(prev => {
        let changed = false;
        const next = prev.map(r => {
          if (r.id === activeRoom.id && r.activeUsers !== count) {
            changed = true;
            return { ...r, activeUsers: count };
          }
          return r;
        });
        return changed ? next : prev;
      });
    });

    const isMatchingMsg = (existing: Message, incoming: Message) => {
      if (existing.id === incoming.id) return true;
      const textA = (existing.content || existing.text || '').trim();
      const textB = (incoming.content || incoming.text || '').trim();
      if (
        existing.senderId === incoming.senderId &&
        textA === textB &&
        textA.length > 0 &&
        Math.abs((existing.timestamp || 0) - (incoming.timestamp || 0)) < 4000
      ) {
        return true;
      }
      return false;
    };

    const mergeMessageList = (prev: Message[], incomingList: Message[]) => {
      const merged = [...prev];
      for (const incoming of incomingList) {
        const idx = merged.findIndex(e => isMatchingMsg(e, incoming));
        if (idx === -1) {
          merged.push(incoming);
        } else {
          const existing = merged[idx];
          merged[idx] = {
            ...existing,
            ...incoming,
            status: incoming.status === 'read' || existing.status === 'read' ? 'read' : (incoming.status || existing.status),
            reactions: incoming.reactions ?? existing.reactions,
            userReactions: incoming.userReactions ?? existing.userReactions,
            reactionUsers: incoming.reactionUsers ?? existing.reactionUsers,
          };
        }
      }
      return merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    // Subscribe to server-side messages & history
    const unsubMessages = realtimeSocket.subscribeToRoom(
      activeRoom.id,
      (newMsg) => {
        setActiveRoomMessages(prev => mergeMessageList(prev, [newMsg]));
        if (
          newMsg.type === 'gift' &&
          newMsg.gift &&
          newMsg.senderId !== currentUser.id
        ) {
          let giftNotifsEnabled = currentUser.notificationPrefs?.gifts !== false;
          try {
            const prefsRaw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
            if (prefsRaw) giftNotifsEnabled = JSON.parse(prefsRaw).gifts !== false;
          } catch {}
          if (giftNotifsEnabled) {
            toast.success(`${newMsg.gift.icon || '🎁'} هدية فاخرة في الغرفة!`, {
              id: `room_gift_${newMsg.id}`,
              description: `أهدى ${newMsg.senderName} ${newMsg.gift.name} إلى ${newMsg.gift.recipientName}`
            });
          }
        }
      },
      (history) => {
        if (history && history.length > 0) {
          setActiveRoomMessages(prev => mergeMessageList(prev, history));
        }
      }
    );

    // Subscribe to real-time WebSocket message reactions & read status updates
    const unsubReactions = realtimeSocket.subscribeToMessageReactions(
      activeRoom.id,
      ({ messageId, reactions, userReactions, reactionUsers }) => {
        setActiveRoomMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? { ...m, reactions, userReactions, reactionUsers }
              : m
          )
        );
      }
    );

    const unsubRead = realtimeSocket.subscribeToRoomMessagesRead(
      activeRoom.id,
      (messageIds) => {
        if (!messageIds || messageIds.length === 0) return;
        const idSet = new Set(messageIds);
        setActiveRoomMessages(prev =>
          prev.map(m => (idSet.has(m.id) ? { ...m, status: 'read' } : m))
        );
      }
    );

    // Also attach Firebase listener
    const unsubFirebase = subscribeToRoomMessages(activeRoom.id, (msgs) => {
      if (msgs && msgs.length > 0) {
        setActiveRoomMessages(prev => mergeMessageList(prev, msgs));
      }
    });

    // Listen to room purge events from Moderator / Owner God Mode
    const unsubPurged = realtimeSocket.subscribeToRoomPurged(activeRoom.id, () => {
      setActiveRoomMessages([]);
    });

    // Automatic System Welcome & Compact Bot Welcome Message on entry into public rooms
    const sessionKey = `${currentUser.id}::${activeRoom.id}`;
    if (!activeRoom.isPrivate && !welcomedPublicRoomKeysRef.current.has(sessionKey)) {
      welcomedPublicRoomKeysRef.current.add(sessionKey);

      // Broadcast concise live join system notice for everyone in the room
      const joinNotice: Message = {
        id: `join_${activeRoom.id}_${currentUser.id}_${Date.now()}`,
        roomId: activeRoom.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        senderVipBadge: currentUser.vipBadge,
        badges: currentUser.badges || [],
        type: 'system_welcome',
        isPrivate: false,
        content: `✨ ${currentUser.name} انضم للغرفة`,
        text: `✨ ${currentUser.name} انضم للغرفة`,
        createdAt: Date.now(),
        timestamp: Date.now(),
        status: 'read',
      };
      setActiveRoomMessages(prev => mergeMessageList(prev, [joinNotice]));
      realtimeSocket.sendMessage(activeRoom.id, joinNotice);

      checkAndMarkFirstPublicRoomEntry(currentUser.id, activeRoom.id)
        .then((isFirstEntry) => {
          if (!isFirstEntry || isCancelled) return;
          welcomeBotTimer = setTimeout(() => {
            if (isCancelled) return;
            const welcomeText = 'تنبيه إداري: نرحب بكم في شات مصر — يُرجى الالتزام بقواعد الآداب العامة واحترام جميع الأعضاء.';
            const botMsg: Message = {
              id: `bot_welcome_${activeRoom.id}_${currentUser.id}`,
              roomId: activeRoom.id,
              senderId: 'system_bot',
              senderName: 'إدارة شات مصر',
              senderAvatar: '',
              senderRole: 'super_admin',
              senderVipBadge: 'تنبيه إداري ⚠️',
              badges: ['تنبيه إداري'],
              type: 'system_welcome',
              isPrivate: false,
              content: welcomeText,
              text: welcomeText,
              reactions: {},
              userReactions: {},
              reactionUsers: {},
              createdAt: Date.now(),
              timestamp: Date.now(),
              status: 'read',
            };

            setActiveRoomMessages(prev => mergeMessageList(prev, [botMsg]));
            realtimeSocket.sendMessage(activeRoom.id, botMsg);
            sendFirestoreMessage(activeRoom.id, botMsg).catch((err) => {
              console.warn('Welcome bot message write notice:', err);
            });
          }, 450);
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
      if (welcomeBotTimer) clearTimeout(welcomeBotTimer);
      welcomedPublicRoomKeysRef.current.delete(sessionKey);
      realtimeSocket.leaveRoom(activeRoom.id, currentUser.id);
      unsubPresence();
      unsubMessages();
      unsubReactions();
      unsubRead();
      unsubFirebase();
      unsubPurged();
    };
  }, [activeRoom?.id, currentUser.id]);

  // Listen for incoming consent requests (Audio Call / Video Call / Send Image)
  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    const unsub = subscribeToIncomingConsentRequests(currentUser.id, (req) => {
      sounds.playMessageReceived();
      setIncomingConsentRequest(req);
    });
    return () => unsub();
  }, [currentUser.id, isProfileReady]);

  // Listen for real-time WebSocket Luxury & Interactive Fullscreen Gift broadcasts in active room
  useEffect(() => {
    if (!activeRoom?.id) return;
    const unsub = realtimeSocket.subscribeToLuxuryGiftBroadcasts(activeRoom.id, (giftData) => {
      if (!giftData?.gift) return;
      if (giftData.senderId === currentUserRef.current.id) return;
      setActiveFullscreenGift({
        gift: giftData.gift,
        senderName: giftData.senderName || 'عضو',
        recipientName: giftData.recipientName || activeRoom.title,
      });
      sounds.playGiftFanfare();
    });
    return () => unsub();
  }, [activeRoom?.id]);

  // Realtime Broadcast Listener (Gifts, Room deletion)
  useEffect(() => {
    const channel = new BroadcastChannel('arab_egypt_chat_bus');
    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'LUXURY_GIFT') {
        const { gift, senderName, recipientName } = payload;
        setActiveFullscreenGift({ gift, senderName, recipientName });
        sounds.playGiftFanfare();
        let giftNotifsEnabled = currentUser.notificationPrefs?.gifts !== false;
        try {
          const prefsRaw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
          if (prefsRaw) giftNotifsEnabled = JSON.parse(prefsRaw).gifts !== false;
        } catch {}
        if (giftNotifsEnabled && gift) {
          toast.success(`${gift.icon || '🎁'} هدية فاخرة: ${gift.name}`, {
            id: `luxury_gift_${gift.id}_${senderName}_${recipientName}`,
            description: `أرسل ${senderName} هذه الهدية إلى ${recipientName}`
          });
        }
      } else if (type === 'PRIVATE_ROOM_DELETED') {
        const delRoomId = payload?.roomId;
        if (delRoomId) {
          setRooms(prev => prev.filter(r => r.id !== delRoomId));
          if (activeRoom?.id === delRoomId) {
            setActiveRoom(null);
          }
        }
      }
    };
    return () => channel.close();
  }, [activeRoom?.id]);

  // Send Message: Allows smooth consecutive messages without button freeze or artificial delays
  const handleSendMessage = async (msgData: Partial<Message>) => {
    if (!activeRoom) return;

    if (currentUser.isBanned) {
      showAppNotice('عفواً، حسابك محظور من قِبل الإدارة ولا يمكنك إرسال الرسائل 🚫', 'error');
      return;
    }

    if (currentUser.isMuted) {
      showAppNotice('عفواً، تم كتمك بواسطة الإدارة ولا يمكنك المشاركة بالكتابة حالياً 🔇', 'warn');
      return;
    }

    const content = (msgData.content || msgData.text || '').trim();
    if (!content && !msgData.audioUrl && !msgData.gift && msgData.type !== 'sticker') return;

    try {
      sounds.playMessageSent();
      const newMsg: Message = {
        id: msgData.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId: activeRoom.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        senderVipBadge: currentUser.vipBadge,
        badges: currentUser.badges || ['عضو نشط'],
        type: msgData.type || 'text',
        isPrivate: !!msgData.isPrivate,
        recipientId: msgData.recipientId,
        content: content,
        text: content,
        gift: msgData.gift,
        replyTo: msgData.replyTo,
        audioDuration: msgData.audioDuration,
        audioUrl: msgData.audioUrl,
        voiceUrl: msgData.voiceUrl,
        stickerId: msgData.stickerId,
        stickerEmoji: msgData.stickerEmoji,
        stickerLabel: msgData.stickerLabel,
        stickerAnimation: msgData.stickerAnimation,
        reactions: {},
        userReactions: {},
        reactionUsers: {},
        createdAt: Date.now(),
        timestamp: Date.now(),
        status: msgData.isPrivate ? 'sent' : 'read'
      };

      // Optimistically add to active messages so sender immediately sees their message
      setActiveRoomMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Optimistically update room card lastMessage preview on Home screen
      if (newMsg.type !== 'system_welcome' && !newMsg.isPrivate) {
        const previewSummary =
          newMsg.type === 'gift' && newMsg.gift?.name
            ? `🎁 أرسل ${newMsg.gift.name}`
            : newMsg.type === 'voice'
            ? '🎤 رسالة صوتية'
            : newMsg.type === 'image'
            ? '📷 صورة'
            : newMsg.type === 'video'
            ? '🎬 فيديو'
            : newMsg.type === 'sticker'
            ? `${newMsg.stickerEmoji || ''} ${newMsg.stickerLabel || 'ملصق'}`.trim()
            : content;
        if (previewSummary) {
          const lastSummary = {
            senderName: currentUser.name,
            content: previewSummary.slice(0, 120),
            type: newMsg.type,
            timestamp: newMsg.timestamp
          };
          setRooms(prev => prev.map(r => (r.id === activeRoom.id ? { ...r, lastMessage: lastSummary } : r)));
        }
      }

      // 1. Broadcast via WebSocket directly to ALL other connected devices in real time
      realtimeSocket.sendMessage(activeRoom.id, newMsg);

      // 2. Also send to Firebase Realtime Database & Firestore
      sendFirestoreMessage(activeRoom.id, newMsg).catch(err => {
        console.warn("Realtime DB message write notice:", err);
      });

      // 3. Track Daily Mission, Shared Room Daily Mission, and XP progress
      updateMissionProgress('send_5_messages', 1);
      contributeToSharedRoomMission('messages', currentUser.id, 1).catch(() => {});
      grantUserXp(currentUser.id, 5).catch(() => {});

      // Award "عضو نشط" badge if not yet granted
      if (!currentUser.badges?.includes('عضو نشط')) {
        const updated = await awardBadgeToUser(currentUser.id, 'عضو نشط');
        const updatedUser = { ...currentUser, badges: updated };
        setCurrentUser(updatedUser);
        realtimeSocket.updateProfile(updatedUser);
        syncUserProfileToFirebase(updatedUser);
      }
    } catch (e) {
      console.warn("Send message error:", e);
    }
  };

  // Send Luxury Gift Handler (Admin/Owner bypass + recipient stats update)
  const handleSendGift = async (gift: GiftItem, recipientName: string, recipientId?: string) => {
    if (!activeRoom) return;

    const isOwner = isUserAdminOrOwner(currentUser);

    // Bypass coin requirement and recharge modal if Owner or Admin
    if (!isOwner && currentUser.coins < gift.cost) {
      showAppNotice(`عفواً، رصيد الكوينز غير كافٍ! تحتاج إلى ${gift.cost} كوينز لإرسال هذه الهدية.`, 'warn');
      setIsGiftModalOpen(false);
      setIsWalletOpen(true);
      return;
    }

    // Deduct coins only if not admin/owner
    const newCoins = isOwner ? currentUser.coins : Math.max(0, currentUser.coins - gift.cost);
    const updatedUser: User = {
      ...currentUser,
      coins: newCoins,
      level: currentUser.level + 1,
      totalGiftsSent: (currentUser.totalGiftsSent || 0) + 1,
      badges: currentUser.badges?.includes('أكثر الهدايا') ? currentUser.badges : [...(currentUser.badges || []), 'أكثر الهدايا']
    };
    setCurrentUser(updatedUser);
    syncUserProfileToFirebase(updatedUser);

    if (recipientId && recipientId !== currentUser.id) {
      recordGiftRecipientStats(recipientId, gift.cost).catch(() => {});
    }

    // Track Daily Mission: "إرسال هدية مميزة"
    updateMissionProgress('send_gift', 1);

    // Save Top Gifter badge
    awardBadgeToUser(currentUser.id, 'أكثر الهدايا');

    // Trigger Fullscreen Animation locally
    setActiveFullscreenGift({
      gift,
      senderName: currentUser.name,
      recipientName,
    });
    sounds.playGiftFanfare();
    toast.success(`تم إرسال هدية ${gift.name} إلى ${recipientName} بنجاح! ${gift.icon}`, {
      description: `خصم ${isOwner ? 0 : gift.cost} كوينز من رصيدك`
    });

    // Broadcast room-wide across all connected WebSocket clients + tabs
    realtimeSocket.sendLuxuryGiftBroadcast(activeRoom.id, {
      gift,
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientName,
      recipientId,
    });
    try {
      const channel = new BroadcastChannel('arab_egypt_chat_bus');
      channel.postMessage({
        type: 'LUXURY_GIFT',
        payload: { gift, senderName: currentUser.name, recipientName },
      });
      channel.close();
    } catch {}

    // Save gift message to Firestore
    await sendFirestoreMessage(activeRoom.id, {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      badges: updatedUser.badges,
      type: 'gift',
      content: `أرسل هدية ${gift.name} إلى ${recipientName} بقيمة ${gift.cost} كوينز!`,
      gift: {
        giftId: gift.id,
        name: gift.name,
        icon: gift.icon,
        cost: gift.cost,
        recipientName,
      }
    });
  };

  // Modal Hygiene: Close all Modals, Overlays, and Radio Player on screen navigation
  const closeAllModals = useCallback(() => {
    setIsAdminOpen(false);
    setIsWalletOpen(false);
    setIsVipOpen(false);
    setIsGiftModalOpen(false);
    setGiftRecipientUser(null);
    setIsCreateRoomOpen(false);
    setIsNotificationsOpen(false);
    setIsOnlineUsersOpen(false);
    setIsPrivateChatDrawerOpen(false);
    setIsRadioModalOpen(false);
    setSelectedProfileUser(null);
    setIsLeaderboardOpen(false);
    setIsPhoneAuthOpen(false);
    setIsPrivatePromptOpen(false);
    setPrivatePromptRoom(null);
    setIsDailyMissionsOpen(false);
    setIsFriendRequestsOpen(false);
    setIsLogoutModalOpen(false);
  }, []);

  // Enter Room Handler with Room Lock & Private Room Protection
  const handleSelectRoom = useCallback((room: Room) => {
    const me = currentUserRef.current;
    const canManageRoom =
      isUserAdminOrOwner(me) ||
      room.ownerId === me.id ||
      room.hostId === me.id ||
      (room.moderators || []).includes(me.id);

    if (room.isLocked && !canManageRoom) {
      sounds.playMicToggle(false);
      toast.error('🔒 هذه الغرفة مقفلة حالياً', {
        description: `قام مديرو "${room.title}" بقفل الغرفة مؤقتاً، ولا يمكن دخول أعضاء جدد الآن.`,
      });
      return;
    }

    if (room.isPrivate) {
      const isAllowed = 
        room.ownerId === me.id ||
        room.hostId === me.id ||
        (room.allowedUserIds || []).includes(me.id) ||
        isUserAdminOrOwner(me);

      if (!isAllowed) {
        setPrivatePromptRoom(room);
        setIsPrivatePromptOpen(true);
        return;
      }
    }

    closeAllModals();
    setActiveRoom(room);

    // Track Daily Mission: "دخول مجلس صوتي"
    if (room.type === 'voice' || room.roomType === 'voice' || room.isVoiceActive) {
      updateMissionProgress('join_voice_room', 1);
    }
  }, [closeAllModals]);

  // Direct Avatar Photo Upload Callback with immediate Firebase & WebSocket propagation across the whole app
  const handleAvatarChanged = useCallback((newAvatarUrl: string) => {
    const me = currentUserRef.current;
    const updated: User = {
      ...me,
      avatar: newAvatarUrl
    };
    setCurrentUser(updated);
    sounds.playCoinsReward();
    realtimeSocket.updateAvatar(me.id, newAvatarUrl);
    propagateUserIdentityAcrossApp(updated).catch(() => {});
    toast.success('تم تحديث صورتك الشخصية بنجاح 📸');

    // Track Daily Mission: "تحديث الصورة والملف الشخصي"
    updateMissionProgress('update_profile', 1);
  }, []);

  // Create Room Handler
  const handleOpenCreateVoiceRoom = () => {
    setCreateRoomType('voice');
    setIsCreateRoomOpen(true);
  };

  const handleOpenCreateTextRoom = () => {
    setCreateRoomType('text_only');
    setIsCreateRoomOpen(true);
  };

  const handleCreateRoom = (newRoom: Room, cost: number) => {
    if (cost > 0) {
      setCurrentUser(prev => ({
        ...prev,
        coins: Math.max(0, prev.coins - cost)
      }));
    }
    const created: Room = {
      ...newRoom,
      activeUsers: 1,
      visitorsCount: '1',
      ownerId: currentUser.id,
      hostId: currentUser.id
    };
    setRooms([created, ...rooms]);
    toast.success(`تم إنشاء غرفة "${created.title}" بنجاح ✨`);
    handleSelectRoom(created);
  };

  // Update Speakers on Stage
  const handleUpdateSpeakers = (updatedSpeakers: SpeakerSeat[]) => {
    if (!activeRoom) return;
    const updated = { ...activeRoom, speakers: updatedSpeakers };
    setActiveRoom(updated);
    setRooms(rooms.map((r) => (r.id === activeRoom.id ? updated : r)));
  };

  // Update Custom Room Background Theme (Room Managers)
  const handleUpdateRoomBackground = (roomId: string, backgroundTheme: string) => {
    const normalized = backgroundTheme && backgroundTheme !== 'default' ? backgroundTheme : undefined;
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, backgroundTheme: normalized } : r))
    );
    setActiveRoom((prev) =>
      prev && prev.id === roomId ? { ...prev, backgroundTheme: normalized } : prev
    );
    setRoomBackgroundTheme(roomId, normalized || 'default');
  };

  // Toggle Room Lock State (Room Managers)
  const handleUpdateRoomLock = (roomId: string, isLocked: boolean) => {
    const nextLocked = Boolean(isLocked);
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, isLocked: nextLocked } : r))
    );
    setActiveRoom((prev) =>
      prev && prev.id === roomId ? { ...prev, isLocked: nextLocked } : prev
    );
    setRoomLockState(roomId, nextLocked, currentUser.id);
  };

  // Upgrade VIP Tier
  const handleUpgradeTier = (tier: VipTier) => {
    setCurrentUser((prev) => ({
      ...prev,
      role: tier.id as any,
      vipBadge: tier.badge,
      coins: prev.coins + tier.coinsBonus,
      frameStyle:
        tier.id === 'vip_diamond'
          ? 'border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.8)]'
          : 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]',
    }));
    toast.success(`تهانينا! تم تفعيل عضوية ${tier.name} بنجاح 👑`);
  };

  // Update Balance
  const handleUpdateUserBalance = (newCoins: number, newEarningsEgp: number) => {
    setCurrentUser((prev) => ({
      ...prev,
      coins: newCoins,
      earningsEgp: newEarningsEgp,
      earningsUsd: Number((newEarningsEgp / 47.5).toFixed(2)),
    }));
  };

  // Host Invite to Mic removed cleanly (text-first experience)

  // Host Invite to Mic
  const handleInviteUserToMic = (user: User) => {
    if (activeRoom) {
      showAppNotice(`تم إرسال دعوة المايك إلى ${user.name} بنجاح! 🎤`, 'info');
    } else {
      showAppNotice(`يرجى دخول أي مجلس أولاً لدعوة ${user.name} إلى المايك.`, 'warn');
    }
  };

  // Open Direct Chat With User (inside Side Drawer without kicking user out of active room)
  const handleOpenPrivateChatWith = useCallback((user: User) => {
    clearUnreadForSender(user.id);
    closeAllModals();
    setTargetChatUser(user);
    setIsInsidePrivateChat(true);
    setIsPrivateChatDrawerOpen(true);
  }, [clearUnreadForSender, closeAllModals]);

  // Leave room: Automatically delete private rooms when creator exits (Requirement 7)
  const handleLeaveRoom = (roomToLeave?: Room | null) => {
    const target = roomToLeave || activeRoom;
    if (target) {
      if (target.isPrivate && (target.ownerId === currentUser.id || target.hostId === currentUser.id)) {
        setRooms(prev => {
          const filtered = prev.filter(r => r.id !== target.id);
          try {
            localStorage.setItem('arab_chat_rooms', JSON.stringify(filtered));
          } catch {}
          return filtered;
        });

        try {
          const channel = new BroadcastChannel('arab_egypt_chat_bus');
          channel.postMessage({ type: 'PRIVATE_ROOM_DELETED', payload: { roomId: target.id } });
          channel.close();
        } catch {}
      }
    }
    closeAllModals();
    setActiveRoom(null);
  };

  // Logout Confirmation Modal & Safe State Purge
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = useCallback(() => {
    setIsLogoutModalOpen(true);
  }, []);

  // Stable UI callbacks for frozen Home Page / Header / BottomNav (Owner excluded from wallet & VIP purchase screens)
  const openWallet = useCallback(() => {
    if (isUserAdminOrOwner(currentUserRef.current)) return;
    setIsWalletOpen(true);
  }, []);
  const openVip = useCallback(() => {
    if (isUserAdminOrOwner(currentUserRef.current)) return;
    setIsVipOpen(true);
  }, []);
  const openProfileTab = useCallback(() => {
    closeAllModals();
    setCurrentTab('profile');
  }, [closeAllModals]);
  const openNotifications = useCallback(() => setIsNotificationsOpen(true), []);
  const openOnlineUsers = useCallback(() => setIsOnlineUsersOpen(true), []);
  const openFriendRequests = useCallback(() => setIsFriendRequestsOpen(true), []);
  const openAdmin = useCallback(() => setIsAdminOpen(true), []);
  const openRadio = useCallback(() => setIsRadioModalOpen(true), []);
  const openMissions = useCallback(() => setIsDailyMissionsOpen(true), []);
  const handleSendGiftToUser = useCallback((user: User) => {
    setSelectedProfileUser(null);
    setGiftRecipientUser(user);
    setIsGiftModalOpen(true);
  }, []);
  const openMessagesDrawer = useCallback(() => {
    closeAllModals();
    setIsInsidePrivateChat(false);
    setTargetChatUser(null);
    setIsPrivateChatDrawerOpen(true);
  }, [closeAllModals]);
  const handleClaimSharedRewardCoins = useCallback((coins: number, label?: string) => {
    const updated = { ...currentUserRef.current, coins: currentUserRef.current.coins + coins };
    setCurrentUser(updated);
    syncUserProfileToFirebase(updated);
    toast.success(`مبروك! تم استلام +${coins} كوينز من ${label} 🎉`);
  }, []);
  const handleBottomTabChange = useCallback((tab: NavTab) => {
    closeAllModals();
    setIsInsidePrivateChat(false);
    setTargetChatUser(null);
    if (tab === 'chat') {
      setIsPrivateChatDrawerOpen(true);
      return;
    }
    setCurrentTab(tab);
    if (tab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'rooms') {
      requestAnimationFrame(() => {
        document.getElementById('home-rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [closeAllModals]);

  const openLeaderboard = useCallback(() => setIsLeaderboardOpen(true), []);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    closeAllModals();
    globalRadioPlayer.stop();
    try {
      await markUserPresenceOffline(currentUser.id);
      await logOutUser();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
    localStorage.removeItem('arab_chat_userId');
    localStorage.removeItem('arab_chat_user');
    localStorage.removeItem('arab_chat_guest_id');
    localStorage.removeItem('arab_chat_auth_email');
    localStorage.removeItem('arab_chat_auth_phone');
    localStorage.removeItem('shat_masr_has_entered');
    localStorage.removeItem('arab_chat_has_entered');
    const nextUser = getOrCreateUser();
    setCurrentUser(nextUser);
    setAuthModalMode('onboarding');
    setIsWelcomeAuthOpen(true);
  };

  // Hardware Back Button & Mobile History Handling (Requirement 6)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.pushState({ app: 'arab_egypt_chat' }, '');

    const handlePopState = () => {
      window.history.pushState({ app: 'arab_egypt_chat' }, '');

      // 1. Close open modals first
      if (isAdminOpen) { setIsAdminOpen(false); return; }
      if (isWalletOpen) { setIsWalletOpen(false); return; }
      if (isVipOpen) { setIsVipOpen(false); return; }
      if (isGiftModalOpen) { setIsGiftModalOpen(false); return; }
      if (isCreateRoomOpen) { setIsCreateRoomOpen(false); return; }
      if (isNotificationsOpen) { setIsNotificationsOpen(false); return; }
      if (isOnlineUsersOpen) { setIsOnlineUsersOpen(false); return; }
      if (isPrivateChatDrawerOpen) {
        if (isInsidePrivateChat) {
          setIsInsidePrivateChat(false);
          setTargetChatUser(null);
        } else {
          setIsPrivateChatDrawerOpen(false);
        }
        return;
      }
      if (isRadioModalOpen) { setIsRadioModalOpen(false); return; }
      if (isLeaderboardOpen) { setIsLeaderboardOpen(false); return; }
      if (selectedProfileUser) { setSelectedProfileUser(null); return; }
      if (isPhoneAuthOpen) { setIsPhoneAuthOpen(false); return; }
      if (isPrivatePromptOpen) { setIsPrivatePromptOpen(false); return; }
      if (isDailyMissionsOpen) { setIsDailyMissionsOpen(false); return; }
      if (isFriendRequestsOpen) { setIsFriendRequestsOpen(false); return; }

      // 1.5. Close active 1-on-1 private chat back to chats list
      if (isInsidePrivateChat) {
        setIsInsidePrivateChat(false);
        setTargetChatUser(null);
        return;
      }

      // 2. Exit active room back to main rooms feed
      if (activeRoom) {
        handleLeaveRoom(activeRoom);
        return;
      }

      // 3. Return to 'home' tab
      if (currentTab !== 'home' && currentTab !== 'rooms') {
        setCurrentTab('home');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isAdminOpen, isWalletOpen, isVipOpen, isGiftModalOpen, isCreateRoomOpen,
    isNotificationsOpen, isOnlineUsersOpen, isPrivateChatDrawerOpen, isRadioModalOpen,
    isLeaderboardOpen, selectedProfileUser, isPhoneAuthOpen, isPrivatePromptOpen,
    isDailyMissionsOpen, isFriendRequestsOpen, isInsidePrivateChat, activeRoom, currentTab
  ]);

  // Friend Request Accept / Decline
  const handleAcceptFriendRequest = async (req: FriendRequest) => {
    sounds.playCoinsReward();
    setPendingFriendRequests(prev => prev.filter(r => r.id !== req.id));
    setFriendReqBanner(curr => (curr?.id === req.id ? null : curr));
    await acceptFriendRequestInDB(
      currentUser.id,
      {
        id: req.senderId,
        name: req.senderName,
        avatar: req.senderAvatar
      },
      currentUser,
      req.id
    );
    toast.success(`تم قبول طلب صداقة ${req.senderName} بنجاح! 🤝`, {
      description: 'تمت إضافته فوراً إلى قائمة أصدقائك'
    });
  };

  const handleDeclineFriendRequest = async (reqId: string, senderId?: string) => {
    setPendingFriendRequests(prev => prev.filter(r => r.id !== reqId));
    setFriendReqBanner(curr => (curr?.id === reqId ? null : curr));
    await declineFriendRequestInDB(currentUser.id, reqId, senderId);
    toast.info('تم رفض طلب الصداقة');
  };

  // Switch active user account (for multi-device / multi-tab testing)
  const handleSwitchUser = (newUser: User) => {
    sounds.playCoinsReward();
    let sid = newUser.sessionId || currentUser.sessionId;
    try {
      if (!sid) {
        sid = sessionStorage.getItem('shat_masr_session_id') || ('sess_' + Math.random().toString(36).substring(2, 9));
        sessionStorage.setItem('shat_masr_session_id', sid);
      }
    } catch {}
    const enriched: User = { ...newUser, sessionId: sid };
    setCurrentUser(enriched);
    syncUserProfileToFirebase(enriched);
    realtimeSocket.connect(enriched);
  };

  const fontClass =
    currentUser.fontPreference === 'amiri'
      ? 'font-["Amiri"]'
      : currentUser.fontPreference === 'tajawal'
      ? 'font-["Tajawal"]'
      : 'font-["Cairo"]';

  const openExclusiveAuthModal = useCallback(() => {
    setAuthModalMode('exclusive_auth');
    setIsWelcomeAuthOpen(true);
  }, []);

  const toasterOptions: ToasterProps['toastOptions'] = useMemo(
    () => ({
      className: 'shat-toast-fade transition-all duration-300 ease-out',
      style: {
        fontFamily: 'Cairo, Tajawal, sans-serif',
        borderRadius: '1rem',
        boxShadow: isDarkMode
          ? '0 14px 32px -8px rgba(2, 6, 23, 0.55)'
          : '0 12px 30px -8px rgba(15, 23, 42, 0.18)',
        transition: 'opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDuration: '300ms'
      }
    }),
    [isDarkMode]
  );

  // Mandatory Registration Gate: prevent seeing chat or online users until Name + Age + Gender (or Google Login) is completed
  if (!isProfileReady) {
    return (
      <div className={`min-h-screen original-app-bg text-slate-900 dark:text-slate-100 transition-colors duration-300 ${fontClass}`}>
        <Toaster
          position="top-center"
          dir="rtl"
          richColors
          closeButton
          expand={false}
          theme={isDarkMode ? 'dark' : 'light'}
          style={{ zIndex: 300 }}
          toastOptions={toasterOptions}
        />
        <WelcomeAuthModal
          isOpen={true}
          allowClose={false}
          onClose={() => {}}
          currentUser={currentUser}
          onUserAuthenticated={(u) => {
            localStorage.setItem('shat_masr_has_entered', 'true');
            handleSwitchUser(u);
            setIsWelcomeAuthOpen(false);
            globalRadioPlayer.tryAutoPlayFM();
            requestPushNotificationPermission().catch(() => {});
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen original-app-bg text-slate-900 dark:text-slate-100 transition-colors duration-300 ${fontClass}`}>
      
      {/* Sonner Professional Toast Notifications (z-index 300) */}
      <Toaster
        position="top-center"
        dir="rtl"
        richColors
        closeButton
        expand={false}
        theme={isDarkMode ? 'dark' : 'light'}
        style={{ zIndex: 300 }}
        toastOptions={toasterOptions}
      />

      {/* Forced Update Blocking Overlay (only when remote config forceUpdate === true) */}
      {remoteVersionInfo?.forceUpdate && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-indigo-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <Download className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              يتوفر تحديث إجباري جديد ({remoteVersionInfo.version})
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {remoteVersionInfo.message || 'يرجى تحديث التطبيق الآن للاستمتاع بأحدث المزايا وتحسينات الأمان والأداء.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg cursor-pointer"
            >
              تحديث الآن 🔄
            </button>
          </div>
        </div>
      )}

      {/* Live Floating Top Notification Banners (Global Join, DM Notice, Friend Request, App Update) */}
      <div
        dir="rtl"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-1.5rem)] max-w-md flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {/* Silent Firestore App Version Update Banner (non-blocking unless forceUpdate) */}
          {remoteVersionInfo && !remoteVersionInfo.forceUpdate && !isRemoteBannerDismissed && (
            <motion.div
              key={`remote-ver-${remoteVersionInfo.version}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => window.location.reload()}
              className="pointer-events-auto cursor-pointer flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-2xl border border-white/25"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Download className="w-4 h-4 text-emerald-200 shrink-0" />
                <p className="text-xs font-black truncate">يوجد تحديث جديد - اضغط للتحديث</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRemoteBannerDismissed(true);
                }}
                aria-label="إغلاق"
                className="p-1 rounded-full hover:bg-white/20 text-white/90 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
          {/* App Update Push Banner */}
          {appUpdateNotice && (
            <motion.div
              key={`update-${appUpdateNotice.timestamp || appUpdateNotice.version}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-l from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-2xl border border-white/25"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                <p className="text-xs font-black truncate">{appUpdateNotice.message}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-2.5 py-1 rounded-xl bg-white text-indigo-700 hover:bg-amber-50 text-[11px] font-black flex items-center gap-1 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppUpdateNotice(null)}
                  aria-label="إغلاق"
                  className="p-1 rounded-full hover:bg-white/20 text-white/90 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Global User Join Banner (Auto-hides in 5s with smooth fade-in/out) */}
          {globalJoinBanner && (
            <motion.div
              key={`join-${globalJoinBanner.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-200 shadow-lg text-slate-900"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="text-xs font-black text-emerald-800 truncate">
                  انضم {globalJoinBanner.name} إلى شات مصر
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalJoinBanner(null)}
                aria-label="إغلاق"
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Incoming Private Message Top Banner (Smooth fade-in/out) */}
          {dmTopBanner && (
            <motion.div
              key={`dm-${dmTopBanner.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                const target = {
                  senderId: dmTopBanner.senderId,
                  senderName: dmTopBanner.senderName,
                  senderAvatar: dmTopBanner.senderAvatar,
                };
                setDmTopBanner(null);
                handleOpenIncomingChat(target);
              }}
              className="pointer-events-auto cursor-pointer flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-200 shadow-xl text-slate-900 hover:bg-indigo-50/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 overflow-hidden">
                  {dmTopBanner.senderAvatar ? (
                    <img src={dmTopBanner.senderAvatar} alt={dmTopBanner.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    أرسل إليك {dmTopBanner.senderName} رسالة خاصة
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{dmTopBanner.preview}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDmTopBanner(null);
                }}
                aria-label="إغلاق"
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Incoming Friend Request Top Banner with Instant Accept / Decline (Smooth fade-in/out) */}
          {friendReqBanner && (
            <motion.div
              key={`fr-${friendReqBanner.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-amber-200 shadow-xl text-slate-900"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 overflow-hidden">
                  {friendReqBanner.senderAvatar ? (
                    <img src={friendReqBanner.senderAvatar} alt={friendReqBanner.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </div>
                <p className="text-xs font-black text-slate-900 truncate">
                  أرسل لك {friendReqBanner.senderName} طلب صداقة
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAcceptFriendRequest(friendReqBanner)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>قبول</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeclineFriendRequest(friendReqBanner.id, friendReqBanner.senderId)}
                  className="px-2.5 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-black active:scale-95 transition cursor-pointer"
                >
                  رفض
                </button>
                <button
                  type="button"
                  onClick={() => setFriendReqBanner(null)}
                  aria-label="إغلاق"
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 1. Top Header Bar: Unified compact mobile-responsive header - ONLY shown on main screen, hidden inside active room */}
      {!activeRoom && (
        <Header
          currentUser={currentUser}
          onOpenWallet={openWallet}
          onOpenVip={openVip}
          onOpenProfile={openProfileTab}
          onOpenNotifications={openNotifications}
          onOpenOnlineUsers={openOnlineUsers}
          onOpenFriendRequests={openFriendRequests}
          onOpenLeaderboard={openLeaderboard}
          onOpenAdmin={openAdmin}
          pendingFriendRequestsCount={pendingFriendRequests.length}
          onlineUsersCount={globalOnlineUsers.length}
          onOpenRadio={openRadio}
          isRadioPlaying={isRadioPlaying}
          onAvatarChanged={handleAvatarChanged}
          onLogout={handleLogout}
          unreadMessagesBySender={unreadMessagesBySender}
          totalUnreadMessagesCount={totalUnreadMessagesCount}
          onOpenSenderChat={handleOpenIncomingChat}
          onClearAllUnreadMessages={clearAllUnreadMessages}
          onOpenMessagesTab={openMessagesDrawer}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}

      {/* Banned Alert Banner */}
      {currentUser.isBanned && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-center text-xs font-black flex flex-wrap items-center justify-center gap-2 shadow-lg sticky top-0 z-[300] animate-in slide-in-from-top">
          <span>🚫 حسابك محظور حالياً من قِبل إدارة شات مصر والعرب.</span>
          <button
            onClick={openAdmin}
            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold border border-white/30 transition-all"
          >
            فتح لوحة الإدارة لفك الحظر
          </button>
        </div>
      )}

      {/* Muted Alert Banner */}
      {currentUser.isMuted && !currentUser.isBanned && (
        <div className="bg-amber-400 text-slate-950 px-4 py-1.5 text-center text-xs font-black flex items-center justify-center gap-2 shadow sticky top-0 z-[300]">
          <span>🔇 أنت مكتوم حالياً بواسطة الإدارة، يمكنك الاستماع فقط ولا يمكنك إرسال الرسائل.</span>
          <button
            onClick={openAdmin}
            className="px-2 py-0.5 rounded bg-black/15 hover:bg-black/25 text-slate-950 text-[10px] underline font-bold"
          >
            إلغاء الكتم من الإدارة
          </button>
        </div>
      )}

      {/* 2. Main View Routing: Home Page (RoomsView) remains persistently mounted & frozen to prevent re-mounts/reloads */}
      <main className={activeRoom ? "w-full h-screen overflow-hidden" : "max-w-7xl mx-auto min-h-[calc(100vh-56px)]"}>
        {/* Frozen Home Page Container (always mounted; hidden via CSS when inside a room or on another tab) */}
        <div className={!activeRoom && (currentTab === 'home' || currentTab === 'rooms') ? '' : 'hidden'}>
          <RoomsView
            rooms={rooms}
            currentUser={currentUser}
            onlineUsers={globalOnlineUsers}
            onSelectRoom={handleSelectRoom}
            onOpenPrivateChatWith={handleOpenPrivateChatWith}
            onOpenUserProfile={(u) => setSelectedProfileUser(u)}
            onOpenWallet={openWallet}
            onOpenVip={openVip}
            onOpenLeaderboard={openLeaderboard}
            onOpenMissions={openMissions}
            totalActiveUsersCount={globalOnlineUsers.length}
            cumulativeVisitorsCount={cumulativeVisitorsCount}
            onOpenOnlineUsers={openOnlineUsers}
            onClaimSharedRewardCoins={handleClaimSharedRewardCoins}
          />
        </div>

          {activeRoom ? (
            <RoomActiveView
              room={{
                ...activeRoom,
                activeUsers: roomActiveCount,
                visitorsCount: cumulativeVisitorsCount.toLocaleString()
              }}
              currentUser={currentUser}
              messages={activeRoomMessages}
              onBack={() => handleLeaveRoom(activeRoom)}
              onSendMessage={handleSendMessage}
              onOpenGiftModal={() => {
                setGiftRecipientUser(null);
                setIsGiftModalOpen(true);
              }}
              onUpdateSpeakers={handleUpdateSpeakers}
              onUpdateRoomBackground={(theme) => handleUpdateRoomBackground(activeRoom.id, theme)}
              onUpdateRoomLock={(locked) => handleUpdateRoomLock(activeRoom.id, locked)}
              onOpenUserProfile={(u) => setSelectedProfileUser(u)}
              onOpenPrivateChatWith={handleOpenPrivateChatWith}
              onSendGiftToUser={handleSendGiftToUser}
              onOpenOnlineUsers={openOnlineUsers}
              onUpdateUser={(updated) => {
                const merged = { ...currentUserRef.current, ...updated };
                setCurrentUser(merged);
                propagateUserIdentityAcrossApp(merged).catch(() => {});
              }}
              onOpenWallet={() => {
                setIsGiftModalOpen(false);
                openWallet();
              }}
            />
          ) : (
            <>
              {currentTab === 'chat' && (
                <PrivateChatView
                  currentUser={currentUser}
                  onOpenWallet={openWallet}
                  targetUser={targetChatUser}
                  onClearTargetUser={() => {
                    setTargetChatUser(null);
                    setIsInsidePrivateChat(false);
                  }}
                  globalOnlineUsers={globalOnlineUsers}
                  onChatActiveChange={setIsInsidePrivateChat}
                  onOpenUserProfile={(u) => setSelectedProfileUser(u)}
                  onUpdateUser={(updated) => {
                    const merged = { ...currentUserRef.current, ...updated };
                    setCurrentUser(merged);
                    propagateUserIdentityAcrossApp(merged).catch(() => {});
                  }}
                  onPromptRegister={openExclusiveAuthModal}
                  unreadBySender={unreadCountsBySenderId}
                  unreadMessagesBySender={unreadMessagesBySender}
                  onMarkSenderRead={clearUnreadForSender}
                  onClearAllUnreadMessages={clearAllUnreadMessages}
                />
              )}

              {currentTab === 'games' && (
                <GamesView
                  currentUser={currentUser}
                  allOnlineUsers={globalOnlineUsers}
                  onUpdateCoins={(coins) => handleUpdateUserBalance(coins, currentUser.earningsEgp)}
                  onOpenWallet={openWallet}
                />
              )}

              {currentTab === 'profile' && (
                <ProfileView
                  currentUser={currentUser}
                  onUpdateUser={(updated) => {
                    const merged = { ...currentUserRef.current, ...updated };
                    setCurrentUser(merged);
                    propagateUserIdentityAcrossApp(merged).catch(() => {});
                  }}
                  onOpenWallet={openWallet}
                  onOpenVip={openVip}
                  onLogout={handleLogout}
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                />
              )}
            </>
          )}
      </main>

      {/* 3. Bottom Navigation Bar - Hidden inside active room OR active 1-on-1 private chat */}
      {!activeRoom && !isPrivateChatDrawerOpen && (!isInsidePrivateChat || currentTab !== 'chat') && (
        <BottomNav
          currentTab={isPrivateChatDrawerOpen ? 'chat' : currentTab}
          onTabChange={handleBottomTabChange}
          unreadChatsCount={totalUnreadMessagesCount + pendingFriendRequests.length}
        />
      )}

      {/* 4. Fullscreen Luxury Gift Overlay */}
      <FullscreenGiftOverlay
        gift={activeFullscreenGift?.gift || null}
        senderName={activeFullscreenGift?.senderName || ''}
        recipientName={activeFullscreenGift?.recipientName || ''}
        onDismiss={() => setActiveFullscreenGift(null)}
      />

      {/* 5. Modals */}
      <LuxuryGiftModal
        isOpen={isGiftModalOpen}
        onClose={() => {
          setIsGiftModalOpen(false);
          setGiftRecipientUser(null);
        }}
        currentUser={currentUser}
        speakers={activeRoom?.speakers || []}
        roomUsers={roomActiveUsers}
        preselectedRecipient={giftRecipientUser}
        onSendGift={handleSendGift}
        onOpenWallet={() => {
          setIsGiftModalOpen(false);
          setGiftRecipientUser(null);
          openWallet();
        }}
      />

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        currentUser={currentUser}
        onUpdateUserBalance={handleUpdateUserBalance}
        currency={currency}
      />

      <VipUpgradeModal
        isOpen={isVipOpen}
        onClose={() => setIsVipOpen(false)}
        currentUser={currentUser}
        onUpgradeTier={handleUpgradeTier}
        onOpenWallet={() => {
          setIsVipOpen(false);
          openWallet();
        }}
      />

      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        currentUser={currentUser}
        onCreateRoom={handleCreateRoom}
        defaultRoomType={createRoomType}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenWallet={openWallet}
      />

      {/* Online Users List Side Drawer with real presence occupants */}
      <OnlineUsersModal
        isOpen={isOnlineUsersOpen}
        onClose={() => setIsOnlineUsersOpen(false)}
        currentUser={currentUser}
        roomTitle={activeRoom?.title}
        roomUsers={roomActiveUsers}
        allActiveUsers={globalOnlineUsers}
        onSelectUserForProfile={(user) => {
          setIsOnlineUsersOpen(false);
          setSelectedProfileUser(user);
        }}
        onInviteToMic={handleInviteUserToMic}
        onOpenPrivateChatWith={handleOpenPrivateChatWith}
      />

      {/* Private Messages & Friends Side Drawer (Full Width on Mobile) */}
      {isPrivateChatDrawerOpen && (
        <div
          dir="rtl"
          onClick={() => setIsPrivateChatDrawerOpen(false)}
          className="fixed inset-0 z-[100] flex justify-end bg-slate-900/45 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full sm:max-w-[420px] bg-white sm:border-r border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-drawer-in-left"
          >
            <PrivateChatView
              isDrawer
              onCloseDrawer={() => setIsPrivateChatDrawerOpen(false)}
              currentUser={currentUser}
              onOpenWallet={openWallet}
              targetUser={targetChatUser}
              onClearTargetUser={() => {
                setTargetChatUser(null);
                setIsInsidePrivateChat(false);
              }}
              globalOnlineUsers={globalOnlineUsers}
              onChatActiveChange={setIsInsidePrivateChat}
              onOpenUserProfile={(u) => {
                setIsPrivateChatDrawerOpen(false);
                setSelectedProfileUser(u);
              }}
              onUpdateUser={(updated) => {
                const merged = { ...currentUserRef.current, ...updated };
                setCurrentUser(merged);
                propagateUserIdentityAcrossApp(merged).catch(() => {});
              }}
              onPromptRegister={() => {
                setIsPrivateChatDrawerOpen(false);
                openExclusiveAuthModal();
              }}
              unreadBySender={unreadCountsBySenderId}
              unreadMessagesBySender={unreadMessagesBySender}
              onMarkSenderRead={clearUnreadForSender}
              onClearAllUnreadMessages={clearAllUnreadMessages}
            />
          </div>
        </div>
      )}

      {/* User Profile Card Modal with Friend Request & Earned Badges */}
      <UserProfileModal
        user={selectedProfileUser}
        currentUser={currentUser}
        onClose={() => setSelectedProfileUser(null)}
        onOpenPrivateChatWith={handleOpenPrivateChatWith}
        onSendGiftToUser={handleSendGiftToUser}
        onAvatarChanged={handleAvatarChanged}
      />

      {/* Friend Requests Modal */}
      <FriendRequestsModal
        isOpen={isFriendRequestsOpen}
        onClose={() => setIsFriendRequestsOpen(false)}
        requests={pendingFriendRequests}
        onAccept={handleAcceptFriendRequest}
        onDecline={handleDeclineFriendRequest}
      />

      {/* Music & Radio Stations Modal */}
      <MusicRadioModal
        isOpen={isRadioModalOpen}
        onClose={() => setIsRadioModalOpen(false)}
      />

      {/* Persistent Global Mini FM Radio Bar (isolated so radio events never re-render App/Home) */}
      <FloatingMiniRadioBar
        isInsideRoom={Boolean(activeRoom)}
        isRadioModalOpen={isRadioModalOpen}
        onOpenRadioModal={openRadio}
      />

      {/* Admin Control Panel Modal */}
      <AdminControlPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={currentUser}
        allUsers={globalOnlineUsers}
        onUserModified={(updated) => {
          realtimeSocket.sendAdminAction(updated.id, updated);
          if (updated.id === currentUser.id) {
            setCurrentUser(prev => ({ ...prev, ...updated }));
          }
          setGlobalOnlineUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
        }}
      />

      {/* Daily Missions Modal */}
      <DailyMissionsModal
        isOpen={isDailyMissionsOpen}
        onClose={() => setIsDailyMissionsOpen(false)}
        missions={dailyMissions}
        onClaimReward={handleClaimMissionReward}
        currentUser={currentUser}
      />

      {/* Private Room Locked Prompt Modal (Requirement 7) */}
      <PrivateRoomPromptModal
        isOpen={isPrivatePromptOpen}
        onClose={() => {
          setIsPrivatePromptOpen(false);
          setPrivatePromptRoom(null);
        }}
        room={privatePromptRoom}
        currentUser={currentUser}
        onRequestJoin={handleRequestJoinPrivateRoom}
      />


      {/* Top 10 Leaderboard (الكبار) Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentUser={currentUser}
        onSelectUser={(u) => setSelectedProfileUser(u)}
      />

      {/* Consent Request Popup (Audio Call / Video Call / Send Image Approval + 5-min Cooldown) */}
      <ConsentRequestModal
        request={incomingConsentRequest}
        onRespond={(approved) => {
          if (incomingConsentRequest) {
            respondToConsentRequest(incomingConsentRequest, currentUser.name, approved);
            setIncomingConsentRequest(null);
          }
        }}
      />

      {/* Incoming WebRTC Call Modal */}
      {incomingCall && (
        <CallModal
          isOpen={Boolean(incomingCall)}
          onClose={() => setIncomingCall(null)}
          currentUser={currentUser}
          peerUser={incomingCall.peer}
          callType={incomingCall.callType}
          incomingMode
          incomingSignal={incomingCall.signal}
          onPromptRegister={() => {
            setIncomingCall(null);
            openExclusiveAuthModal();
          }}
        />
      )}

      {/* Dismissible Exclusive Features Auth Modal (Mandatory X Close Button) */}
      <WelcomeAuthModal
        isOpen={isWelcomeAuthOpen}
        allowClose={authModalMode === 'exclusive_auth'}
        onClose={() => {
          setIsWelcomeAuthOpen(false);
        }}
        currentUser={currentUser}
        onOpenPhoneAuth={() => setIsPhoneAuthOpen(true)}
        onUserAuthenticated={(u) => {
          localStorage.setItem('shat_masr_has_entered', 'true');
          handleSwitchUser(u);
          setIsWelcomeAuthOpen(false);
          globalRadioPlayer.tryAutoPlayFM();
          requestPushNotificationPermission().catch(() => {});
        }}
      />

      {/* Phone OTP Authentication Modal */}
      <PhoneAuthModal
        isOpen={isPhoneAuthOpen}
        onClose={() => setIsPhoneAuthOpen(false)}
        currentUser={currentUser}
        onUserVerified={(verifiedUser) => {
          localStorage.setItem('shat_masr_has_entered', 'true');
          handleSwitchUser(verifiedUser);
        }}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-sm bg-white border border-rose-200 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-2xl text-rose-500">
              🚪
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">هل أنت متأكد من أنك تريد المغادرة؟</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                سيتم إنهاء جلستك الحالية والعودة لشاشة البداية والترحيب.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-500/20 transition active:scale-95 cursor-pointer"
              >
                نعم، تسجيل الخروج
              </button>
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
