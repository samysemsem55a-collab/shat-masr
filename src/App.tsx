import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { toast, TOASTER_ICONS, getToasterOptions } from './utils/appToast';
import { X, Check, RefreshCw, UserPlus, MessageCircle, Sparkles, Download, Swords, DoorOpen, Dices } from 'lucide-react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { RoomsView } from './components/RoomsView';
import { RoomActiveView } from './components/RoomActiveView';
import { GamesView, AcceptedExternalChallenge } from './components/GamesView';
import { LudoGamePanel, ActiveLudoRef } from './components/LudoGamePanel';
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
import { WelcomeScreen } from './components/WelcomeScreen';
import { CallModal } from './components/CallModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SettingsModal } from './components/SettingsModal';
import { ChatWallpapersModal } from './components/ChatWallpapersModal';
import { ConsentRequestModal } from './components/ConsentRequestModal';
import {
  ConsentRequestPayload,
  respondToConsentRequest,
  subscribeToIncomingConsentRequests,
} from './services/consentService';

import { User, Room, Message, GiftItem, VipTier, SpeakerSeat, FriendRequest, DailyMission, UnreadSenderSummary, ForumPost } from './types/chat';
import { INITIAL_ROOMS, getOrCreateUser, isUserAdminOrOwner, hasCompletedMandatoryProfile, PRIMARY_OWNER_EMAIL } from './data/seedData';
import {
  readSavedNotificationBgPresetId,
  saveNotificationBgPresetId,
  getNotificationBgPresetById,
} from './data/wallpapers';
import { sounds } from './utils/soundEffects';
import { preloadAppAssets } from './utils/assetCache';
import { applySmoothAppUpdate } from './utils/appUpdater';
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
  syncSelfPresenceProfile,
  subscribeToFriendRequests,
  subscribeToUserProfile,
  syncUserProfileToFirebase,
  awardBadgeToUser,
  sendRoomJoinRequest,
  subscribeToOwnerRoomJoinRequests,
  resolveRoomJoinRequest,
  sendRoomInvitation,
  subscribeToRoomInvitations,
  respondToRoomInvitation,
  subscribeToIncomingGameChallenges,
  respondToGameChallenge,
  logOutUser,
  sendFriendRequest,
  acceptFriendRequestInDB,
  declineFriendRequestInDB,
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
  subscribeToAllRoomsOnlineCounts,
  subscribeToRegisteredUsersCount,
  createDailyBackupSnapshot,
  grantUserXp,
  sendFirestoreCallSignal,
  subscribeToFirestoreCallSignals,
  deleteFirestoreCallSignal,
  getLocalActiveCall,
  subscribeToUserNotifications,
  subscribeToForumNotifications,
  subscribeToStoryNotifications,
  saveCreatedRoomToFirestore,
  closeRoomInDB,
  subscribeToCreatedRooms,
  OFFICIAL_PUBLIC_ROOM_IDS,
  markUserNotificationsRead,
  deleteUserNotification,
  clearAllUserNotifications,
  subscribeToOwnerPendingItems,
  OwnerPendingSummary,
  RealtimeUserNotification,
  RoomInvitation,
  OwnerRoomJoinRequest,
  GameChallengeInvite,
  LudoInvite,
  subscribeToIncomingLudoInvites,
  respondToLudoInvite,
  AppUpdateNotice
} from './services/firebase';
import { isUserTrulyOnline, getServerNowMs, resolveTimestampMs } from './utils/presenceStatus';
import { formatArabicDateTime, getVipDurationInfo } from './utils/dateFormat';

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

function isUserBannedNow(u?: Partial<User> | null): boolean {
  return Boolean(u?.isBanned || (typeof u?.bannedUntil === 'number' && u.bannedUntil > Date.now()));
}

function areUserListsEqual(a: User[], b: User[], selfId?: string): boolean {
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
      (u1.coins || 0) !== (u2.coins || 0) ||
      (u1.bannedUntil || 0) !== (u2.bannedUntil || 0) ||
      Boolean(u1.isOnline) !== Boolean(u2.isOnline) ||
      Boolean(u1.isBanned) !== Boolean(u2.isBanned) ||
      Boolean(u1.isMuted) !== Boolean(u2.isMuted) ||
      (u1.id !== selfId && Math.abs((Number(u1.lastSeen) || 0) - (Number(u2.lastSeen) || 0)) >= 15000)
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

const isMatchingRoomMessage = (existing: Message, incoming: Message): boolean => {
  if (existing.id === incoming.id) return true;
  if (existing.tempId && incoming.tempId && existing.tempId === incoming.tempId) return true;
  if (existing.clientId && incoming.clientId && existing.clientId === incoming.clientId) return true;
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

function mergeRoomMessageList(prev: Message[], incomingList: Message[]): Message[] {
  const merged = [...prev];
  for (const incoming of incomingList) {
    const idx = merged.findIndex(e => isMatchingRoomMessage(e, incoming));
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

  const unreadSendersMapRef = useRef<Record<string, UnreadSenderSummary>>(unreadSendersMap);
  unreadSendersMapRef.current = unreadSendersMap;

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
    const myId = currentUserRef.current.id;
    const knownChatIds = Object.keys(unreadSendersMapRef.current).map((peerId) =>
      [myId, peerId].sort().join('_')
    );
    setUnreadSendersMap({});
    resetAllDirectChatsUnreadInDB(myId, knownChatIds).catch(() => {});
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaultMap = new Map(INITIAL_ROOMS.map((r) => [r.id, r]));
          const nonPrivate = parsed.filter((r) => r && r.id && !r.isPrivate && !r.isClosed);
          for (const def of INITIAL_ROOMS) {
            if (!nonPrivate.some((r) => r.id === def.id)) {
              nonPrivate.unshift(def);
            }
          }
          const merged = nonPrivate.map((r) =>
            defaultMap.has(r.id) ? { ...defaultMap.get(r.id)!, ...r } : r
          );
          return hydrateRoomBg(merged);
        }
      }
    } catch {}
    return hydrateRoomBg(INITIAL_ROOMS);
  });

  // Real-time messages for active room from Firestore (30 initial + pure onSnapshot upward pagination)
  const [activeRoomMessages, setActiveRoomMessages] = useState<Message[]>([]);
  const [roomMsgLimit, setRoomMsgLimit] = useState<number>(30);
  const [hasMoreRoomMessages, setHasMoreRoomMessages] = useState<boolean>(false);
  const [isLoadingOlderRoomMsgs, setIsLoadingOlderRoomMsgs] = useState<boolean>(false);
  const noMoreOlderRoomMsgsRef = useRef<boolean>(false);
  const prevRoomIdForLimitRef = useRef<string | null>(null);
  const pendingRoomOlderResolveRef = useRef<((added: number) => void) | null>(null);
  const prevRoomMsgCountBeforeExpandRef = useRef<number>(0);
  const activeRoomMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    activeRoomMessagesRef.current = activeRoomMessages;
  }, [activeRoomMessages]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Real-time Presence
  const [roomActiveUsers, setRoomActiveUsers] = useState<User[]>([]);
  const [roomActiveCount, setRoomActiveCount] = useState<number>(1);
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState<User[]>(() => {
    const now = Date.now();
    const map = new Map<string, User>();
    map.set(currentUser.id, { ...currentUser, isOnline: currentUser.status !== 'offline', lastSeen: now });
    try {
      const saved = localStorage.getItem('arab_chat_global_presence');
      if (saved) {
        const parsed = JSON.parse(saved);
        const items: User[] = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        items.forEach((u) => {
          if (u && u.id && u.id !== currentUser.id && isUserTrulyOnline(u, now)) {
            map.set(u.id, u);
          }
        });
      }
    } catch {}
    return Array.from(map.values());
  });
  const [presenceClock, setPresenceClock] = useState<number>(() => getServerNowMs());
  useEffect(() => {
    const id = setInterval(() => setPresenceClock(getServerNowMs()), 10000);
    return () => clearInterval(id);
  }, []);
  const [registeredUsersCount, setRegisteredUsersCount] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('shat_masr_registered_users_count') || '0');
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<User[]>([]);

  const trulyOnlineUsers = useMemo(() => {
    const now = getServerNowMs();
    return globalOnlineUsers.filter((u) => {
      if (!u || !u.id) return false;
      if (u.id === currentUser.id) return currentUser.status !== 'offline';
      return isUserTrulyOnline(u, now);
    });
  }, [globalOnlineUsers, currentUser.id, currentUser.status, presenceClock]);

  // Friend Requests State
  const [pendingFriendRequests, setPendingFriendRequests] = useState<FriendRequest[]>([]);
  const [seenFriendRequestIds, setSeenFriendRequestIds] = useState<Set<string>>(() => new Set());
  const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState(false);

  const unreadFriendRequestsCount = useMemo(
    () => pendingFriendRequests.filter((r) => !seenFriendRequestIds.has(r.id)).length,
    [pendingFriendRequests, seenFriendRequestIds]
  );

  // Real-time Top Floating Banners (Global Join, DM Notice, Friend Request, Room Invites, Owner Join Requests, Game Challenges, App Update)
  const [globalJoinBanner, setGlobalJoinBanner] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [isGlobalJoinMenuOpen, setIsGlobalJoinMenuOpen] = useState(false);
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

  const [bellNotifBanner, setBellNotifBanner] = useState<RealtimeUserNotification | null>(null);
  const bellNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [incomingRoomInvite, setIncomingRoomInvite] = useState<RoomInvitation | null>(null);
  const dismissedRoomInviteIdsRef = useRef<Set<string>>(new Set());

  const [ownerRoomJoinRequest, setOwnerRoomJoinRequest] = useState<OwnerRoomJoinRequest | null>(null);
  const dismissedOwnerJoinReqIdsRef = useRef<Set<string>>(new Set());

  const [incomingGameChallenge, setIncomingGameChallenge] = useState<GameChallengeInvite | null>(null);
  const dismissedGameChallengeIdsRef = useRef<Set<string>>(new Set());
  const [acceptedGameChallenge, setAcceptedGameChallenge] = useState<AcceptedExternalChallenge | null>(null);

  const [incomingLudoInvite, setIncomingLudoInvite] = useState<LudoInvite | null>(null);
  const dismissedLudoInviteIdsRef = useRef<Set<string>>(new Set());
  const [acceptedLudoMatchRef, setAcceptedLudoMatchRef] = useState<ActiveLudoRef | null>(null);
  const [quickLudoInviteUser, setQuickLudoInviteUser] = useState<User | null>(null);
  const [isLudoFullWindowOpen, setIsLudoFullWindowOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (bellNotifTimerRef.current) clearTimeout(bellNotifTimerRef.current);
    };
  }, []);

  const [appUpdateNotice, setAppUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [remoteVersionInfo, setRemoteVersionInfo] = useState<{ version: string; forceUpdate: boolean; notificationsEnabled: boolean; message?: string } | null>(null);
  const [isRemoteBannerDismissed, setIsRemoteBannerDismissed] = useState(false);
  const [privateChatDraft, setPrivateChatDraft] = useState<string | null>(null);
  const [openSupportRequested, setOpenSupportRequested] = useState(false);

  // Modals State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'users' | 'user_reports' | 'payments' | 'bad_words' | 'reports' | 'secret_pms' | 'backups'
  >('users');
  const [ownerPendingSummary, setOwnerPendingSummary] = useState<OwnerPendingSummary>({
    pendingPaymentsCount: 0,
    pendingReportsCount: 0,
    totalPendingCount: 0,
    latestPendingPayment: null,
    latestPendingReport: null,
  });
  const [adminTopBanner, setAdminTopBanner] = useState<{
    id: string;
    tab: 'payments' | 'user_reports';
    title: string;
    subtitle: string;
    count: number;
  } | null>(null);
  const adminTopBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOwnerPendingRef = useRef<{
    payments: number;
    reports: number;
    latestPayId: string | null;
    latestRepId: string | null;
  }>({ payments: -1, reports: -1, latestPayId: null, latestRepId: null });
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipientUser, setGiftRecipientUser] = useState<User | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [createRoomType, setCreateRoomType] = useState<'voice' | 'text_only' | 'live_audio'>('text_only');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [recentlyViewedUnreadIds, setRecentlyViewedUnreadIds] = useState<string[]>([]);
  const [isOnlineUsersOpen, setIsOnlineUsersOpen] = useState(false);
  const [isPrivateChatDrawerOpen, setIsPrivateChatDrawerOpen] = useState(false);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'general' | 'support'>('general');
  const [isWallpapersModalOpen, setIsWallpapersModalOpen] = useState(false);
  const [incomingConsentRequest, setIncomingConsentRequest] = useState<ConsentRequestPayload | null>(null);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const isProfileReady = hasCompletedMandatoryProfile(currentUser);
  const [isWelcomeAuthOpen, setIsWelcomeAuthOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'onboarding' | 'exclusive_auth'>('exclusive_auth');

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

  // Fullscreen Celebratory Gift Overlay
  const [activeFullscreenGift, setActiveFullscreenGift] = useState<{
    gift: GiftItem;
    senderName: string;
    recipientName: string;
    replayKey: number;
  } | null>(null);

  const triggerGiftCelebration = useCallback((gift: GiftItem, senderName: string, recipientName: string) => {
    setActiveFullscreenGift({
      gift,
      senderName,
      recipientName,
      replayKey: Date.now() + Math.random(),
    });
  }, []);

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
      toast.coins(`تم استلام مكافأة المهمة (+${target.rewardCoins} كوينز) 🪙`);

      return updated;
    });
  };

  const roomsRef = useRef<Room[]>(rooms);
  roomsRef.current = rooms;

  const allRegisteredUsersRef = useRef<User[]>(allRegisteredUsers);
  allRegisteredUsersRef.current = allRegisteredUsers;

  const resolveRoomOwnerId = useCallback((room?: Room | null): string => {
    if (!room) return '';
    if (room.ownerId) return room.ownerId;
    if (room.hostId) return room.hostId;
    const ownerUser =
      allRegisteredUsersRef.current.find(
        (u) => u.email?.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase() || u.role === 'owner'
      ) ||
      globalOnlineUsersRef.current.find(
        (u) => u.email?.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase() || u.role === 'owner'
      );
    return ownerUser?.id || '';
  }, []);

  const handleRequestJoinPrivateRoom = async (roomId: string): Promise<boolean> => {
    const target = roomsRef.current.find((r) => r.id === roomId);
    const ownerId = resolveRoomOwnerId(target);
    await sendRoomJoinRequest(roomId, currentUserRef.current, {
      roomTitle: target?.title,
      ownerId,
    });
    return true;
  };

  const handleRequestJoinRoomFromCard = useCallback(
    async (room: Room) => {
      const me = currentUserRef.current;
      const ownerId = resolveRoomOwnerId(room);
      if (ownerId && ownerId === me.id) {
        handleSelectRoom(room);
        return;
      }
      await sendRoomJoinRequest(room.id, me, {
        roomTitle: room.title,
        ownerId,
      });
      toast.success(`تم إرسال طلب الانضمام إلى مالك غرفة "${room.title}" 📩`);
    },
    [resolveRoomOwnerId]
  );

  const currentUserRef = useRef<User>(currentUser);
  currentUserRef.current = currentUser;

  const globalOnlineUsersRef = useRef<User[]>(globalOnlineUsers);
  globalOnlineUsersRef.current = globalOnlineUsers;

  const activeRoomRef = useRef<Room | null>(activeRoom);
  activeRoomRef.current = activeRoom;

  // Dynamic Visual Viewport height sync (--app-height) + document scroll lock to eliminate mobile keyboard white gaps
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncViewportHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      if (vh > 0) {
        document.documentElement.style.setProperty('--app-height', `${Math.round(vh)}px`);
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    syncViewportHeight();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncViewportHeight);
    vv?.addEventListener('scroll', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);
    return () => {
      vv?.removeEventListener('resize', syncViewportHeight);
      vv?.removeEventListener('scroll', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('orientationchange', syncViewportHeight);
    };
  }, []);

  // Persist User Changes & Sync to Firebase only after mandatory onboarding completes
  useEffect(() => {
    if (hasCompletedMandatoryProfile(currentUser)) {
      localStorage.setItem('arab_chat_user', JSON.stringify(currentUser));
      if (isProfileReady) {
        syncSelfPresenceProfile(currentUser);
      }
    }
  }, [currentUser, isProfileReady]);

  // Subscribe to real-time User Profile updates from Firestore (silent equality check + instant ban & VIP expiry enforcement)
  useEffect(() => {
    if (!isProfileReady) return;
    const unsub = subscribeToUserProfile(currentUser.id, (profileUpdate) => {
      const wasBanned = isUserBannedNow(currentUserRef.current);
      const mergedCheck = { ...currentUserRef.current, ...profileUpdate };
      const nowBanned = isUserBannedNow(mergedCheck);
      if (!wasBanned && nowBanned) {
        if (activeRoomRef.current) {
          setActiveRoom(null);
        }
        toast.error('تم حظر حسابك بواسطة الإدارة ولا يمكنك دخول الغرف أو الإرسال 🚫');
      }
      const vipInfo = getVipDurationInfo(mergedCheck);
      const normalizedUpdate: Partial<User> = vipInfo.isExpired
        ? {
            ...profileUpdate,
            role: 'member',
            vipBadge: '',
            vipStartedAt: undefined,
            vipExpiresAt: undefined,
            vipDurationDays: undefined,
          }
        : profileUpdate;
      if (vipInfo.isExpired && currentUserRef.current.role !== 'member') {
        syncUserProfileToFirebase({
          ...mergedCheck,
          role: 'member',
          vipBadge: '',
          vipStartedAt: undefined,
          vipExpiresAt: undefined,
          vipDurationDays: undefined,
        }).catch(() => {});
        toast.info('انتهت مدة اشتراك VIP الخاصة بك وعادت عضويتك إلى عضو عادي');
      }
      setCurrentUser(prev => {
        if (!hasUserVisibleChange(prev, normalizedUpdate)) return prev;
        return { ...prev, ...normalizedUpdate };
      });
    });
    return () => unsub();
  }, [currentUser.id, isProfileReady]);

  // Hydrate persisted Theme & Wallpaper settings + preload static assets + remote version check + offline queue handler
  useEffect(() => {
    const unsubRemoteVersion = subscribeToRemoteAppVersion((cfg) => {
      if (cfg && isNewerVersion(cfg.latestVersion, CLIENT_APP_VERSION)) {
        let alreadySeen = false;
        try {
          alreadySeen = localStorage.getItem(`seen_update_for_version_${cfg.latestVersion}`) === 'true';
        } catch {}
        setIsRemoteBannerDismissed(alreadySeen);
        setRemoteVersionInfo({
          version: cfg.latestVersion,
          forceUpdate: Boolean(cfg.forceUpdate),
          notificationsEnabled: cfg.notificationsEnabled !== false,
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
      const localWallpaper = (() => {
        try {
          return localStorage.getItem('arab_chat_active_wallpaper') || '';
        } catch {
          return '';
        }
      })();
      if (savedTheme && typeof savedTheme.isDarkMode === 'boolean') {
        setIsDarkMode(savedTheme.isDarkMode);
      }
      if (savedTheme?.notificationBgPreset) {
        saveNotificationBgPresetId(currentUser.id, savedTheme.notificationBgPreset);
      }
      const nextWallpaper = savedTheme?.chatWallpaper || localWallpaper;
      if (nextWallpaper || savedTheme?.notificationBgPreset) {
        setCurrentUser((prev) => {
          const nextPreset = savedTheme?.notificationBgPreset ?? prev.notificationBgPreset;
          const resolvedWallpaper = nextWallpaper || prev.chatWallpaper;
          if (
            prev.chatWallpaper === resolvedWallpaper &&
            prev.notificationBgPreset === nextPreset
          ) {
            return prev;
          }
          return {
            ...prev,
            ...(resolvedWallpaper ? { chatWallpaper: resolvedWallpaper } : {}),
            ...(nextPreset ? { notificationBgPreset: nextPreset } : {}),
          };
        });
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
      markUserPresenceOffline(currentUser.id, activeRoomRef.current?.id).catch(() => {});
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

    let dbGlobalUsers: User[] = [];
    let wsGlobalUsers: User[] = [];

    const syncMergedGlobalPresence = () => {
      const nowTs = getServerNowMs();
      const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      setGlobalOnlineUsers(prev => {
        if (!isBrowserOnline && dbGlobalUsers.length <= 1 && wsGlobalUsers.length <= 1 && prev.length > 1) {
          return prev;
        }
        const self = currentUserRef.current;
        const map = new Map<string, User>();
        map.set(self.id, { ...self, isOnline: self.status !== 'offline', lastSeen: nowTs });

        wsGlobalUsers.forEach(u => {
          if (!u || !u.id || u.id === self.id || u.status === 'offline' || u.isOnline === false) return;
          const seenMs = resolveTimestampMs(u.lastSeen ?? (u as any).lastSeenMs ?? (u as any).joinedAt) || nowTs;
          const candidate: User = { ...u, isOnline: true, lastSeen: seenMs };
          if (isUserTrulyOnline(candidate, nowTs)) {
            map.set(u.id, { ...map.get(u.id), ...candidate });
          }
        });

        dbGlobalUsers.forEach(u => {
          if (u && u.id && u.id !== self.id && isUserTrulyOnline(u, nowTs)) {
            map.set(u.id, { ...map.get(u.id), ...u, isOnline: true });
          }
        });

        const nextList = Array.from(map.values());
        return areUserListsEqual(prev, nextList, self.id) ? prev : nextList;
      });
    };

    // Listen to both RTDB global presence and WebSocket live global presence
    const unsubFirestorePresence = subscribeToGlobalPresence(activeUser, (liveUsers) => {
      dbGlobalUsers = Array.isArray(liveUsers) ? liveUsers : [];
      syncMergedGlobalPresence();
    });
    const unsubWsGlobalPresence = realtimeSocket.subscribeToGlobalPresence((wsUsers) => {
      wsGlobalUsers = Array.isArray(wsUsers) ? wsUsers : [];
      syncMergedGlobalPresence();
    });

    // Automatically re-register user, room, and Firestore/RTDB presence on socket reconnect
    const unsubReconnect = realtimeSocket.subscribeToReconnectSuccess(() => {
      const me = currentUserRef.current;
      realtimeSocket.registerUser(me);
      syncSelfPresenceProfile(me);
      const currentRoom = activeRoomRef.current;
      updatePresenceCurrentRoom(me.id, currentRoom?.id || null);
      if (currentRoom) {
        realtimeSocket.joinRoom(currentRoom.id, me);
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

    // Do NOT trigger join notifications upon app login — only inside active rooms
    const unsubGlobalJoin = realtimeSocket.subscribeToGlobalUserJoined(() => {});

    // Real-time App Update Notice Banner (once per version)
    const unsubAppUpdate = subscribeToAppUpdateNotices((notice) => {
      try {
        if (localStorage.getItem(`seen_update_for_version_${notice.version}`) === 'true') {
          return;
        }
      } catch {}
      setAppUpdateNotice(notice);
    });

    // Live Last Message Preview across all rooms (deferred slightly so initial shell paints first)
    let isEffectDisposed = false;
    let unsubRoomLastMsgs: (() => void) | null = null;
    let unsubRegisteredUsers: (() => void) | null = null;
    const deferredStartupTimer = setTimeout(() => {
      if (isEffectDisposed) return;
      unsubRoomLastMsgs = subscribeToAllRoomLastMessages((lastMsgMap) => {
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

      unsubRegisteredUsers = subscribeToRegisteredUsersCount((count, users) => {
        setRegisteredUsersCount((prev) => (count >= 1 && prev !== count ? count : prev));
        if (users && users.length > 0) {
          setAllRegisteredUsers(users);
        }
      });
    }, 80);

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

    // Listen to incoming WebRTC calls targeting current user (WebSocket + Firestore/RTDB relay)
    const processedCallSignals = new Set<string>();
    const processedOfferCallIds = new Set<string>();
    const endedCallIds = new Set<string>();
    const earlyIceByCallId = new Map<string, any[]>();
    const handleIncomingCallSignal = (signal: any) => {
      const me = currentUserRef.current;
      if (!signal) return;
      if (signal.targetUserId && signal.targetUserId !== me.id) return;
      if (signal.signalId) {
        if (processedCallSignals.has(signal.signalId)) return;
        processedCallSignals.add(signal.signalId);
        if (processedCallSignals.size > 200) {
          const oldest = processedCallSignals.values().next().value;
          if (oldest) processedCallSignals.delete(oldest);
        }
      }

      if (signal.type === 'ice_candidate' && signal.candidate && signal.callId) {
        const cId = String(signal.callId);
        if (!endedCallIds.has(cId)) {
          const buf = earlyIceByCallId.get(cId) || [];
          if (buf.length < 50) {
            buf.push(signal.candidate);
            earlyIceByCallId.set(cId, buf);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('shatmasr:call_early_ice', {
                detail: { callId: cId, candidate: signal.candidate, signalId: signal.signalId },
              })
            );
          }
        }
        return;
      }

      if (signal.type === 'call_end' || signal.type === 'call_reject') {
        if (signal.callId) {
          endedCallIds.add(String(signal.callId));
          earlyIceByCallId.delete(String(signal.callId));
        }
        setIncomingCall((prev) => {
          // If CallModal is already mounted for this call (incoming or outgoing), let CallModal handle & delete cleanly
          if (prev || getLocalActiveCall()) return prev;
          if (signal.signalId) {
            deleteFirestoreCallSignal(me.id, signal.signalId);
          }
          return null;
        });
        return;
      }

      if (signal.type !== 'call_offer') return;
      if (!signal.fromUserId || signal.fromUserId === me.id) return;

      // Consume the offer signal from Firestore/RTDB so refreshes don't replay stale calls
      if (signal.signalId) {
        deleteFirestoreCallSignal(me.id, signal.signalId);
      }

      // Ignore stale or already-ended call offers
      const offerTs = Number(signal.createdAt ?? signal.createdAtMs ?? 0);
      if (offerTs > 0 && getServerNowMs() - offerTs > 45000) {
        return;
      }
      const incomingCallId = signal.callId ? String(signal.callId) : `${signal.fromUserId}_${signal.signalId || Date.now()}`;
      if (endedCallIds.has(incomingCallId)) return;
      if (processedOfferCallIds.has(incomingCallId)) return;
      processedOfferCallIds.add(incomingCallId);
      if (processedOfferCallIds.size > 100) {
        const oldestOffer = processedOfferCallIds.values().next().value;
        if (oldestOffer) processedOfferCallIds.delete(oldestOffer);
      }

      const bufferedEarlyIce = earlyIceByCallId.get(incomingCallId) || [];
      earlyIceByCallId.delete(incomingCallId);

      // Prevent overlapping calls if user is already in an active outgoing or incoming call
      const activeLocalCall = getLocalActiveCall();
      if (activeLocalCall && activeLocalCall.callId !== incomingCallId) {
        console.log('[Call] Busy - rejecting overlapping incoming call', {
          incomingCallId,
          activeCallId: activeLocalCall.callId,
        });
        const busyPayload = {
          type: 'call_busy',
          fromUserId: me.id,
          targetUserId: signal.fromUserId,
          callId: signal.callId,
          signalId: `sig_busy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        };
        realtimeSocket.sendCallSignal(signal.fromUserId, busyPayload);
        sendFirestoreCallSignal(signal.fromUserId, busyPayload).catch(() => {});
        return;
      }

      setIncomingCall((prev) => {
        if (prev && prev.peer.id !== signal.fromUserId) {
          // Already handling another caller's call: reply busy
          console.log('[Call] Busy - rejecting overlapping incoming call', {
            incomingCallId,
            activePeerId: prev.peer.id,
          });
          const busyPayload = {
            type: 'call_busy',
            fromUserId: me.id,
            targetUserId: signal.fromUserId,
            callId: signal.callId,
            signalId: `sig_busy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          };
          realtimeSocket.sendCallSignal(signal.fromUserId, busyPayload);
          sendFirestoreCallSignal(signal.fromUserId, busyPayload).catch(() => {});
          return prev;
        }
        sounds.playNotificationChime();
        return {
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
          signal: bufferedEarlyIce.length > 0 ? { ...signal, _earlyIce: bufferedEarlyIce } : signal,
        };
      });
    };

    const unsubCalls = realtimeSocket.subscribeToCallSignals(handleIncomingCallSignal);
    const unsubFirestoreCalls = subscribeToFirestoreCallSignals(activeUser.id, handleIncomingCallSignal);

    // Real-time per-room online users counts across ALL rooms (from presence/{uid}.currentRoom)
    const unsubRoomOnlineCounts = subscribeToAllRoomsOnlineCounts(activeUser.id, (countsMap) => {
      setRooms((prev) => {
        let changed = false;
        const next = prev.map((r) => {
          const nextCount = Math.max(0, Number(countsMap[r.id]) || 0);
          if (r.activeUsers !== nextCount) {
            changed = true;
            return { ...r, activeUsers: nextCount };
          }
          return r;
        });
        return changed ? next : prev;
      });
    });

    // Real-time created & closed rooms sync across all devices
    const unsubCreatedRooms = subscribeToCreatedRooms((createdRooms, closedIds) => {
      setRooms((prev) => {
        const defaultMap = new Map(INITIAL_ROOMS.map((r) => [r.id, r]));
        const mergedMap = new Map<string, Room>();
        for (const r of prev) {
          if (!r?.id || closedIds.has(r.id)) continue;
          mergedMap.set(r.id, r);
        }
        for (const cr of createdRooms) {
          if (!cr?.id || closedIds.has(cr.id) || cr.isClosed) continue;
          const existing = mergedMap.get(cr.id);
          mergedMap.set(cr.id, {
            ...cr,
            activeUsers: existing?.activeUsers ?? cr.activeUsers ?? 0,
            lastMessage: existing?.lastMessage ?? cr.lastMessage,
            backgroundTheme: existing?.backgroundTheme ?? cr.backgroundTheme,
            isLocked: typeof existing?.isLocked === 'boolean' ? existing.isLocked : cr.isLocked,
          });
        }
        for (const def of INITIAL_ROOMS) {
          if (!mergedMap.has(def.id)) {
            mergedMap.set(def.id, defaultMap.get(def.id)!);
          }
        }
        const nextList = Array.from(mergedMap.values()).sort((a, b) => {
          const aOff = OFFICIAL_PUBLIC_ROOM_IDS.has(a.id) ? 1 : 0;
          const bOff = OFFICIAL_PUBLIC_ROOM_IDS.has(b.id) ? 1 : 0;
          if (aOff !== bOff) return bOff - aOff;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        return nextList;
      });

      const currentActive = activeRoomRef.current;
      if (currentActive && closedIds.has(currentActive.id)) {
        setActiveRoom(null);
        toast.info(`تم إغلاق غرفة "${currentActive.title}"`);
      }
    });

    // Immediate WebSocket room-closed kick & list cleanup
    const unsubRoomClosed = realtimeSocket.subscribeToRoomClosed(({ roomId }) => {
      if (!roomId || OFFICIAL_PUBLIC_ROOM_IDS.has(roomId)) return;
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomRef.current?.id === roomId) {
        const closedTitle = activeRoomRef.current.title;
        setActiveRoom(null);
        toast.info(`تم إغلاق غرفة "${closedTitle}"`);
      }
    });

    return () => {
      isEffectDisposed = true;
      clearTimeout(deferredStartupTimer);
      unsubFirestorePresence();
      unsubWsGlobalPresence();
      if (unsubRegisteredUsers) unsubRegisteredUsers();
      unsubRoomOnlineCounts();
      unsubCreatedRooms();
      unsubRoomClosed();
      unsubReconnect();
      unsubAdmin();
      unsubGlobalJoin();
      unsubAppUpdate();
      if (unsubRoomLastMsgs) unsubRoomLastMsgs();
      unsubRoomBgs();
      unsubRoomLocks();
      unsubCalls();
      unsubFirestoreCalls();
    };
  }, [currentUser.id, currentUser.sessionId, isProfileReady]);

  // Auto-close empty custom rooms (excluding official Egypt 1 & Egypt 2) with safe grace & debounce
  const emptyRoomTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    if (!isProfileReady) return;
    const now = Date.now();
    const candidateIds = new Set<string>();

    rooms.forEach((room) => {
      if (!room?.id || OFFICIAL_PUBLIC_ROOM_IDS.has(room.id)) return;
      if (activeRoom?.id === room.id) return;
      const ageMs = now - (room.createdAt || 0);
      if (ageMs < 15000) return;
      if ((room.activeUsers || 0) === 0) {
        candidateIds.add(room.id);
        if (!emptyRoomTimersRef.current.has(room.id)) {
          const timer = setTimeout(() => {
            emptyRoomTimersRef.current.delete(room.id);
            closeRoomInDB(room.id, 'auto_empty').catch(() => {});
            realtimeSocket.sendRoomClosed(room.id, 'auto_empty');
            setRooms((prev) => prev.filter((r) => r.id !== room.id));
          }, 5500);
          emptyRoomTimersRef.current.set(room.id, timer);
        }
      }
    });

    emptyRoomTimersRef.current.forEach((timer, rId) => {
      if (!candidateIds.has(rId)) {
        clearTimeout(timer);
        emptyRoomTimersRef.current.delete(rId);
      }
    });
  }, [rooms, activeRoom?.id, isProfileReady]);

  useEffect(() => {
    return () => {
      emptyRoomTimersRef.current.forEach((t) => clearTimeout(t));
      emptyRoomTimersRef.current.clear();
    };
  }, []);

  // Track Cumulative Visitor on each visit/session and sync atomically in real time (never decreases)
  useEffect(() => {
    const sessionKey = `shat_masr_visit_counted_${deviceId}`;
    const alreadyCountedInSession = sessionStorage.getItem(sessionKey);
    const shouldIncrement = !alreadyCountedInSession;
    if (shouldIncrement) {
      sessionStorage.setItem(sessionKey, 'true');
    }

    const visitToken = `${deviceId}_${sessionStorage.getItem('shat_masr_session_id') || 's'}`;
    let unsubVisitors: (() => void) | null = null;
    let disposed = false;
    const timer = setTimeout(() => {
      if (disposed) return;
      unsubVisitors = syncCumulativeVisitorsRealtime(
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
    }, 100);

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (unsubVisitors) unsubVisitors();
    };
  }, [deviceId]);

  // Lightweight Owner/Admin real-time pending decision listener (Payments/VIP upgrades + User Reports)
  const isCurrentAdminOrOwner = isUserAdminOrOwner(currentUser);
  useEffect(() => {
    if (!isProfileReady || !isCurrentAdminOrOwner) {
      setOwnerPendingSummary({
        pendingPaymentsCount: 0,
        pendingReportsCount: 0,
        totalPendingCount: 0,
        latestPendingPayment: null,
        latestPendingReport: null,
      });
      return;
    }

    const unsubPending = subscribeToOwnerPendingItems((summary) => {
      setOwnerPendingSummary(summary);
      const prev = prevOwnerPendingRef.current;
      const latestPayId = summary.latestPendingPayment?.id || null;
      const latestRepId = summary.latestPendingReport?.id || null;

      const isFirstLoad = prev.payments === -1;
      const hasNewPayment =
        (isFirstLoad && summary.pendingPaymentsCount > 0) ||
        (!isFirstLoad &&
          (summary.pendingPaymentsCount > prev.payments ||
            (latestPayId && latestPayId !== prev.latestPayId && summary.pendingPaymentsCount > 0)));
      const hasNewReport =
        (isFirstLoad && summary.pendingReportsCount > 0) ||
        (!isFirstLoad &&
          (summary.pendingReportsCount > prev.reports ||
            (latestRepId && latestRepId !== prev.latestRepId && summary.pendingReportsCount > 0)));

      prevOwnerPendingRef.current = {
        payments: summary.pendingPaymentsCount,
        reports: summary.pendingReportsCount,
        latestPayId,
        latestRepId,
      };

      if (hasNewPayment || hasNewReport) {
        sounds.playNotificationChime();
      }
    });

    return () => {
      unsubPending();
      if (adminTopBannerTimerRef.current) clearTimeout(adminTopBannerTimerRef.current);
    };
  }, [isProfileReady, isCurrentAdminOrOwner]);

  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const isPrivateChatDrawerOpenRef = useRef(isPrivateChatDrawerOpen);
  isPrivateChatDrawerOpenRef.current = isPrivateChatDrawerOpen;
  const isInsidePrivateChatRef = useRef(isInsidePrivateChat);
  isInsidePrivateChatRef.current = isInsidePrivateChat;
  const targetChatUserRef = useRef(targetChatUser);
  targetChatUserRef.current = targetChatUser;

  // Listen for real-time incoming direct messages across the entire app (supports registered users & online guests via ID/sessionId)
  useEffect(() => {
    const getConvId = (u1: string, u2: string) => [u1, u2].sort().join('_');

    const handleIncomingDm = (rawMsg: any) => {
      if (!rawMsg) return;
      const me = currentUserRef.current;
      const isForMe =
        rawMsg.recipientId === me.id ||
        (!!me.sessionId && rawMsg.recipientId === me.sessionId);

      if (rawMsg.senderId !== me.id && isForMe) {
        const isViewingThisSender =
          (isPrivateChatDrawerOpenRef.current || currentTabRef.current === 'chat') &&
          isInsidePrivateChatRef.current &&
          targetChatUserRef.current?.id === rawMsg.senderId;

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
              chatId: convId,
              peerId: rawMsg.senderId,
              peerName: rawMsg.senderName || 'عضو شات مصر',
              peerAvatar: rawMsg.senderAvatar || '',
              lastMessage: rawMsg.content || rawMsg.text || 'رسالة جديدة',
              lastTimestamp: rawMsg.timestamp || Date.now(),
              unreadCount: isViewingThisSender ? 0 : 1,
              isOnline: true
            },
            ...recents.filter((c) => c.chatId !== convId && c.peerId !== rawMsg.senderId)
          ];
          localStorage.setItem(recentKey, JSON.stringify(nextRecent));
        } catch {}

        // Check user notification preferences for DMs & Gifts
        let dmNotifsEnabled = me.notificationPrefs?.directMessages !== false;
        let giftNotifsEnabled = me.notificationPrefs?.gifts !== false;
        try {
          const prefsRaw = localStorage.getItem(`user_notification_prefs_${me.id}`);
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
            toast.gift(`🎁 استلمت هدية جديدة من ${toastPayload.senderName}!`, {
              id: `dm_gift_${rawMsg.id}`,
              description: `${rawMsg.gift.icon || '🎁'} ${rawMsg.gift.name} (${rawMsg.gift.cost} كوينز)`,
              action: {
                label: 'عرض الهدية',
                onClick: () => handleOpenIncomingChat(toastPayload)
              }
            });
          }
        } else if (rawMsg.type === 'coins_transfer') {
          sounds.playCoinsReward();
          toast.coins(`🪙 تحويل كوينز من ${toastPayload.senderName}`, {
            id: `dm_coins_${rawMsg.id}`,
            description: rawMsg.content || 'تم تحويل كوينز إلى رصيدك',
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
            sounds.playNotificationChime();
            const previewText = rawMsg.content || rawMsg.text || 'رسالة جديدة';
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
                (isPrivateChatDrawerOpenRef.current || currentTabRef.current === 'chat') &&
                isInsidePrivateChatRef.current &&
                targetChatUserRef.current?.id === rec.senderId;
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

              // Sound cue when a brand-new message arrives via Firestore sync
              if (
                rec.lastMessageId &&
                !processedUnreadDmIdsRef.current.has(rec.lastMessageId) &&
                !processedBannerDmIdsRef.current.has(rec.lastMessageId) &&
                now - (rec.lastTimestamp || 0) < 30000
              ) {
                processedUnreadDmIdsRef.current.add(rec.lastMessageId);
                processedBannerDmIdsRef.current.add(rec.lastMessageId);
                const dmNotifsEnabled = currentUserRef.current.notificationPrefs?.directMessages !== false;
                if (dmNotifsEnabled) {
                  sounds.playNotificationChime();
                }
              }
            });

            // Keep any live WS-only unread entries created recently while Firestore sync catches up
            Object.entries(prev).forEach(([peerId, entry]) => {
              if (!dbIds.has(peerId) && now - (entry.lastTimestamp || 0) < 30000) {
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
  }, [currentUser.id, currentUser.sessionId, isProfileReady]);

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

  // Dedicated onSnapshot listener: Real-time Room Invitations (works inside active room & anywhere)
  useEffect(() => {
    if (!isProfileReady || !currentUser.id) return;
    const unsub = subscribeToRoomInvitations(currentUser.id, (invites) => {
      const next = invites.find(
        (inv) => inv.status === 'pending' && !dismissedRoomInviteIdsRef.current.has(inv.id)
      );
        if (next) {
          setIncomingRoomInvite((prev) => {
            if (prev?.id !== next.id) {
              sounds.playNotificationChime();
            }
            return next;
          });
        } else {
          setIncomingRoomInvite(null);
        }
      });
      return () => unsub();
    }, [currentUser.id, isProfileReady]);

    // Dedicated onSnapshot listener: Owner Room Join Requests (from room cards / private rooms)
    useEffect(() => {
      if (!isProfileReady || !currentUser.id) return;
      const unsub = subscribeToOwnerRoomJoinRequests(currentUser.id, (reqs) => {
        const next = reqs.find(
          (req) => req.status === 'pending' && !dismissedOwnerJoinReqIdsRef.current.has(req.id)
        );
        if (next) {
          setOwnerRoomJoinRequest((prev) => {
            if (prev?.id !== next.id) {
              sounds.playNotificationChime();
            }
            return next;
          });
        } else {
          setOwnerRoomJoinRequest(null);
        }
      });
      return () => unsub();
    }, [currentUser.id, isProfileReady]);

    // Dedicated onSnapshot listener: Incoming XO Game Challenges across all tabs & inside rooms
    useEffect(() => {
      if (!isProfileReady || !currentUser.id) return;
      const unsub = subscribeToIncomingGameChallenges(currentUser.id, (challenges) => {
        const next = challenges.find(
          (ch) => ch.status === 'pending' && !dismissedGameChallengeIdsRef.current.has(ch.matchId)
        );
        if (next) {
          setIncomingGameChallenge((prev) => {
            if (prev?.matchId !== next.matchId) {
              sounds.playNotificationChime();
            }
            return next;
          });
        } else {
          setIncomingGameChallenge(null);
        }
      });
      return () => unsub();
    }, [currentUser.id, isProfileReady]);

    // Dedicated isolated onSnapshot listener: Incoming Ludo Invites
    useEffect(() => {
      if (!isProfileReady || !currentUser.id) return;
      const unsub = subscribeToIncomingLudoInvites(currentUser.id, (invites) => {
        const next = invites.find(
          (inv) => inv.status === 'pending' && !dismissedLudoInviteIdsRef.current.has(inv.matchId)
        );
        if (next) {
          setIncomingLudoInvite((prev) => {
            if (prev?.matchId !== next.matchId) {
              sounds.playNotificationChime();
            }
            return next;
          });
        } else {
          setIncomingLudoInvite(null);
        }
      });
      return () => unsub();
    }, [currentUser.id, isProfileReady]);

    // Real-time social notifications (3 isolated listeners: general, forum likes/comments, story likes/comments)
    const [generalNotifications, setGeneralNotifications] = useState<RealtimeUserNotification[]>([]);
    const [forumNotifications, setForumNotifications] = useState<RealtimeUserNotification[]>([]);
    const [storyNotifications, setStoryNotifications] = useState<RealtimeUserNotification[]>([]);
    const [isAppUpdateNotifRead, setIsAppUpdateNotifRead] = useState(false);
    const seenNotifIdsRef = useRef<Set<string>>(new Set());

    const realtimeNotifications = React.useMemo<RealtimeUserNotification[]>(() => {
      const byId = new Map<string, RealtimeUserNotification>();
      [...generalNotifications, ...forumNotifications, ...storyNotifications].forEach((n) => {
        if (!n?.id) return;
        const existing = byId.get(n.id);
        if (!existing) {
          byId.set(n.id, n);
        } else {
          byId.set(n.id, {
            ...existing,
            ...n,
            isRead: Boolean(existing.isRead || n.isRead),
          });
        }
      });
      return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [generalNotifications, forumNotifications, storyNotifications]);

    const realtimeNotificationsRef = useRef<RealtimeUserNotification[]>([]);
    realtimeNotificationsRef.current = realtimeNotifications;

    useEffect(() => {
      setIsAppUpdateNotifRead(false);
    }, [appUpdateNotice?.version]);

    useEffect(() => {
      if (!isProfileReady || !currentUser.id) return;
      const mountThresholdMs = getServerNowMs() - 8000;

      const handleNewRealtimeNotifs = (list: RealtimeUserNotification[]) => {
        for (const item of list) {
          if (!item.id || seenNotifIdsRef.current.has(item.id)) continue;
          seenNotifIdsRef.current.add(item.id);
          if (!item.isRead && (item.createdAt || 0) >= mountThresholdMs && item.message) {
            sounds.playNotificationChime();
            if (typeof document !== 'undefined' && document.hidden) {
              triggerExternalBrowserNotification(
                item.kind === 'story_like' || item.kind === 'story_comment'
                  ? 'إشعار جديد على قصتك'
                  : 'إشعار جديد في المنتدى',
                item.message,
                { openForum: item.kind === 'forum_like' || item.kind === 'forum_comment' }
              );
            }
          }
        }
      };

    const unsubGeneral = subscribeToUserNotifications(currentUser.id, (list) => {
      setGeneralNotifications(list);
      handleNewRealtimeNotifs(list);
    });
    const unsubForum = subscribeToForumNotifications(currentUser.id, (list) => {
      setForumNotifications(list);
      handleNewRealtimeNotifs(list);
    });
    const unsubStory = subscribeToStoryNotifications(currentUser.id, (list) => {
      setStoryNotifications(list);
      handleNewRealtimeNotifs(list);
    });

    return () => {
      unsubGeneral();
      unsubForum();
      unsubStory();
    };
  }, [currentUser.id, isProfileReady]);

  const bellNotifications = React.useMemo<RealtimeUserNotification[]>(() => {
    const list = [...realtimeNotifications];
    if (appUpdateNotice) {
      list.unshift({
        id: `app_update_${appUpdateNotice.version || appUpdateNotice.timestamp}`,
        targetUserId: currentUser.id,
        actorId: 'system_update',
        actorName: appUpdateNotice.pushedBy || 'الإدارة',
        kind: 'app_update',
        message: appUpdateNotice.message,
        isRead: isAppUpdateNotifRead,
        createdAt: appUpdateNotice.timestamp || Date.now(),
      });
    }
    return list;
  }, [realtimeNotifications, appUpdateNotice, currentUser.id, isAppUpdateNotifRead]);

  const unreadNotificationsCount = React.useMemo(
    () => bellNotifications.filter((n) => !n.isRead).length,
    [bellNotifications]
  );

  const unreadForumNotificationsCount = React.useMemo(
    () => bellNotifications.filter((n) => !n.isRead && (n.kind === 'forum_like' || n.kind === 'forum_comment')).length,
    [bellNotifications]
  );

  const unreadStoryNotificationsCount = React.useMemo(
    () => bellNotifications.filter((n) => !n.isRead && (n.kind === 'story_like' || n.kind === 'story_comment')).length,
    [bellNotifications]
  );

  // Load older room messages upward (30 per page via pure onSnapshot limit expansion)
  const handleLoadOlderRoomMessages = useCallback(async (): Promise<number> => {
    if (!activeRoom?.id || isLoadingOlderRoomMsgs || noMoreOlderRoomMsgsRef.current) return 0;
    prevRoomMsgCountBeforeExpandRef.current = activeRoomMessagesRef.current.length;
    setIsLoadingOlderRoomMsgs(true);
    return new Promise<number>((resolve) => {
      const wrappedResolve = (added: number) => {
        clearTimeout(timeout);
        resolve(added);
      };
      const timeout = setTimeout(() => {
        if (pendingRoomOlderResolveRef.current === wrappedResolve) {
          pendingRoomOlderResolveRef.current = null;
          setIsLoadingOlderRoomMsgs(false);
          resolve(0);
        }
      }, 6000);
      pendingRoomOlderResolveRef.current = wrappedResolve;
      setRoomMsgLimit((prev) => prev + 30);
    });
  }, [activeRoom?.id, isLoadingOlderRoomMsgs]);

  // Dedicated real-time Firestore onSnapshot listener for active room messages (orderBy createdAt desc, limit(30+), reverse())
  useEffect(() => {
    if (!activeRoom?.id) {
      prevRoomIdForLimitRef.current = null;
      noMoreOlderRoomMsgsRef.current = false;
      if (pendingRoomOlderResolveRef.current) {
        pendingRoomOlderResolveRef.current(0);
        pendingRoomOlderResolveRef.current = null;
      }
      setActiveRoomMessages([]);
      setRoomMsgLimit(30);
      setHasMoreRoomMessages(false);
      setIsLoadingOlderRoomMsgs(false);
      return;
    }

    const roomId = activeRoom.id;
    if (prevRoomIdForLimitRef.current !== roomId) {
      prevRoomIdForLimitRef.current = roomId;
      noMoreOlderRoomMsgsRef.current = false;
      if (pendingRoomOlderResolveRef.current) {
        pendingRoomOlderResolveRef.current(0);
        pendingRoomOlderResolveRef.current = null;
      }
      setActiveRoomMessages([]);
      setHasMoreRoomMessages(false);
      setIsLoadingOlderRoomMsgs(false);
      if (roomMsgLimit !== 30) {
        setRoomMsgLimit(30);
        return;
      }
    }

    const activeLimit = roomMsgLimit;
    let prevFirebaseMsgs = new Map<string, number>();

    const unsubFirebase = subscribeToRoomMessages(
      roomId,
      (msgs, meta) => {
        const incomingList = Array.isArray(msgs) ? msgs : [];
        if (meta?.fromFirestore && !meta.fromCache) {
          if (incomingList.length < activeLimit) {
            noMoreOlderRoomMsgsRef.current = true;
            setHasMoreRoomMessages(false);
          } else if (!noMoreOlderRoomMsgsRef.current) {
            setHasMoreRoomMessages(true);
          }
        } else if (incomingList.length >= activeLimit && !noMoreOlderRoomMsgsRef.current) {
          setHasMoreRoomMessages(true);
        }

        const nextFirebaseMsgs = new Map<string, number>();
        let minIncomingTs = Infinity;
        incomingList.forEach((m) => {
          const ts = typeof m.timestamp === 'number' ? m.timestamp : 0;
          nextFirebaseMsgs.set(m.id, ts);
          if (ts > 0 && ts < minIncomingTs) minIncomingTs = ts;
        });
        const deletedFromFirebase = new Set<string>();
        prevFirebaseMsgs.forEach((oldTs, oldId) => {
          if (!nextFirebaseMsgs.has(oldId)) {
            if (incomingList.length < activeLimit || oldTs >= minIncomingTs) {
              deletedFromFirebase.add(oldId);
            }
          }
        });
        prevFirebaseMsgs = nextFirebaseMsgs;

        setActiveRoomMessages((prev) => {
          const filteredPrev =
            deletedFromFirebase.size > 0
              ? prev.filter((m) => !deletedFromFirebase.has(m.id))
              : prev;
          return mergeRoomMessageList(filteredPrev, incomingList);
        });

        if (meta?.fromFirestore && !meta.fromCache && pendingRoomOlderResolveRef.current) {
          const resolvePending = pendingRoomOlderResolveRef.current;
          pendingRoomOlderResolveRef.current = null;
          setIsLoadingOlderRoomMsgs(false);
          const added = Math.max(0, incomingList.length - prevRoomMsgCountBeforeExpandRef.current);
          resolvePending(added);
        }
      },
      activeLimit
    );

    return () => {
      unsubFirebase();
    };
  }, [activeRoom?.id, roomMsgLimit]);

  // Send one public join notification through the real-time message flow when entering a room
  const lastAnnouncedJoinedRoomRef = useRef<string | null>(null);
  useEffect(() => {
    const roomId = activeRoom?.id;
    if (!roomId) {
      lastAnnouncedJoinedRoomRef.current = null;
      return;
    }
    if (!isProfileReady || !currentUserRef.current?.id) return;
    if (lastAnnouncedJoinedRoomRef.current === roomId) return;
    lastAnnouncedJoinedRoomRef.current = roomId;

    const joinName = (currentUserRef.current.name || 'عضو').trim();
    if (!joinName) return;

    void handleSendMessage({
      type: 'join',
      content: `انضم ${joinName} إلى الشات`,
      text: `انضم ${joinName} إلى الشات`,
    });
  }, [activeRoom?.id, isProfileReady]);

  // Real-Time Room WebSocket & RTDB presence synchronization for active room
  useEffect(() => {
    if (!activeRoom) {
      return;
    }

    // Join room on real-time server
    realtimeSocket.joinRoom(activeRoom.id, currentUser, Boolean(activeRoom.isPrivate));

    let fsRoomOccupants: User[] = [];
    let wsRoomOccupants: User[] = [];

    const syncRoomPresence = () => {
      const me = currentUserRef.current;
      const nowTs = getServerNowMs();
      const mergedMap = new Map<string, User>();
      if (me?.id) {
        mergedMap.set(me.id, { ...me, currentRoom: activeRoom.id, isOnline: true, lastSeen: nowTs });
      }
      wsRoomOccupants.forEach((u) => {
        if (u && u.id && u.isOnline !== false) {
          const seenMs = resolveTimestampMs(u.lastSeen ?? (u as any).joinedAt) || nowTs;
          mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u, isOnline: true, lastSeen: seenMs });
        }
      });
      fsRoomOccupants.forEach((u) => {
        if (u && u.id) {
          mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u, isOnline: true });
        }
      });
      const merged = Array.from(mergedMap.values());
      const count = Math.max(1, merged.length);
      setRoomActiveUsers((prev) => (areUserListsEqual(prev, merged) ? prev : merged));
      setRoomActiveCount((prev) => (prev === count ? prev : count));
      setRooms((prev) => {
        let changed = false;
        const next = prev.map((r) => {
          if (r.id === activeRoom.id && r.activeUsers !== count) {
            changed = true;
            return { ...r, activeUsers: count };
          }
          return r;
        });
        return changed ? next : prev;
      });
    };

    // Subscribe to both RTDB room presence and WebSocket room presence
    const unsubRoomFirestorePresence = subscribeToRoomPresence(activeRoom.id, currentUser, (_fsCount, fsOccupants) => {
      fsRoomOccupants = Array.isArray(fsOccupants) ? fsOccupants : [];
      syncRoomPresence();
    });
    const unsubRoomWsPresence = realtimeSocket.subscribeToPresence(activeRoom.id, (_wsCount, wsUsers) => {
      wsRoomOccupants = Array.isArray(wsUsers) ? (wsUsers as unknown as User[]) : [];
      syncRoomPresence();
    });

    // Subscribe to server-side messages & history
    const unsubMessages = realtimeSocket.subscribeToRoom(
      activeRoom.id,
      (newMsg) => {
        setActiveRoomMessages(prev => mergeRoomMessageList(prev, [newMsg]));
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
            toast.gift(`${newMsg.gift.icon || '🎁'} هدية فاخرة في الغرفة!`, {
              id: `room_gift_${newMsg.id}`,
              description: `أهدى ${newMsg.senderName} ${newMsg.gift.name} إلى ${newMsg.gift.recipientName}`
            });
          }
        }
      },
      (history) => {
        if (history && history.length > 0) {
          setActiveRoomMessages(prev => mergeRoomMessageList(prev, history));
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

    // Listen to instant WebSocket message deletions & room purge events
    const unsubDeleted = realtimeSocket.subscribeToRoomMessageDeleted(activeRoom.id, (deletedMessageId) => {
      setActiveRoomMessages(prev => prev.filter(m => m.id !== deletedMessageId));
    });

    const unsubPurged = realtimeSocket.subscribeToRoomPurged(activeRoom.id, () => {
      setActiveRoomMessages([]);
    });

    return () => {
      realtimeSocket.leaveRoom(activeRoom.id, currentUser.id);
      unsubRoomFirestorePresence();
      unsubRoomWsPresence();
      unsubMessages();
      unsubReactions();
      unsubRead();
      unsubDeleted();
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
        replayKey: Date.now() + Math.random(),
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
        setActiveFullscreenGift({ gift, senderName, recipientName, replayKey: Date.now() + Math.random() });
        sounds.playGiftFanfare();
        let giftNotifsEnabled = currentUser.notificationPrefs?.gifts !== false;
        try {
          const prefsRaw = localStorage.getItem(`user_notification_prefs_${currentUser.id}`);
          if (prefsRaw) giftNotifsEnabled = JSON.parse(prefsRaw).gifts !== false;
        } catch {}
        if (giftNotifsEnabled && gift) {
          toast.gift(`${gift.icon || '🎁'} هدية فاخرة: ${gift.name}`, {
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

    if (isUserBannedNow(currentUser)) {
      const reasonText = currentUser.banReason ? ` (${currentUser.banReason})` : '';
      showAppNotice(`عفواً، حسابك محظور من قِبل الإدارة ولا يمكنك إرسال الرسائل${reasonText} 🚫`, 'error');
      return;
    }

    if (msgData.type !== 'join' && currentUser.isMuted) {
      showAppNotice('عفواً، تم كتمك بواسطة الإدارة ولا يمكنك المشاركة بالكتابة حالياً 🔇', 'warn');
      return;
    }

    const content = (msgData.content || msgData.text || '').trim();
    if (!content && !msgData.audioUrl && !msgData.gift && !msgData.mediaUrl && !msgData.imageUrl && msgData.type !== 'sticker') return;

    try {
      if (msgData.type !== 'join') {
        sounds.playMessageSent();
      }
      const generatedId = msgData.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const tempId = msgData.tempId || msgData.clientId || generatedId;
      const newMsg: Message = {
        id: generatedId,
        tempId,
        clientId: tempId,
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
        mediaUrl: msgData.mediaUrl || msgData.imageUrl,
        imageUrl: msgData.imageUrl || msgData.mediaUrl,
        mediaType: msgData.mediaType,
        stickerId: msgData.stickerId,
        stickerEmoji: msgData.stickerEmoji,
        stickerLabel: msgData.stickerLabel,
        stickerAnimation: msgData.stickerAnimation,
        stickerUrl: msgData.stickerUrl,
        isHighlighted: msgData.isHighlighted ? true : undefined,
        highlightColor: msgData.isHighlighted ? msgData.highlightColor : undefined,
        reactions: {},
        userReactions: {},
        reactionUsers: {},
        createdAt: Date.now(),
        timestamp: Date.now(),
        status: msgData.status || (typeof navigator !== 'undefined' && navigator.onLine === false ? 'pending_offline' : 'sent')
      };

      // Optimistically add to active messages so sender immediately sees their message
      setActiveRoomMessages(prev => {
        if (prev.some(m => m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId))) return prev;
        return [...prev, newMsg];
      });

      // Optimistically update room card lastMessage preview on Home screen
      if (newMsg.type !== 'system_welcome' && newMsg.type !== 'join' && !newMsg.isPrivate) {
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

      // 2. Also send to Firebase Firestore and keep accurate sent/failed state
      sendFirestoreMessage(activeRoom.id, newMsg)
        .then(() => {
          setActiveRoomMessages(prev =>
            prev.map(m => (m.id === newMsg.id && m.status === 'pending_offline' ? { ...m, status: 'sent' } : m))
          );
        })
        .catch(err => {
          console.warn("Firestore room message write notice:", err);
          setActiveRoomMessages(prev =>
            prev.map(m => (m.id === newMsg.id ? { ...m, status: 'failed' } : m))
          );
        });

      // 3. Track Daily Mission, Shared Room Daily Mission, and XP progress
      if (newMsg.type !== 'join') {
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
      replayKey: Date.now() + Math.random(),
    });
    sounds.playGiftFanfare();
    toast.gift(`تم إرسال هدية ${gift.name} إلى ${recipientName} بنجاح! ${gift.icon}`, {
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
    setIsSettingsOpen(false);
    setIsWallpapersModalOpen(false);
    setIsLogoutModalOpen(false);
    setIsLudoFullWindowOpen(false);
  }, []);

  // Enter Room Handler with Ban Check, Room Lock & Private Room Protection
  const handleSelectRoom = useCallback((room: Room) => {
    const me = currentUserRef.current;
    if (isUserBannedNow(me)) {
      toast.error('🚫 حسابك محظور حالياً', {
        description: me.banReason || 'لا يمكنك دخول الغرف العامة أثناء سريان الحظر.',
      });
      return;
    }
    const canManageRoom =
      isUserAdminOrOwner(me) ||
      room.ownerId === me.id ||
      room.hostId === me.id ||
      (room.moderators || []).includes(me.id);

    if (room.isLocked && !canManageRoom) {
      toast.security('🔒 هذه الغرفة مقفلة حالياً', {
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
    realtimeSocket.updateAvatar(me.id, newAvatarUrl);
    propagateUserIdentityAcrossApp(updated).catch(() => {});
    toast.success('تم تحديث صورتك الشخصية بنجاح 📸');

    // Track Daily Mission: "تحديث الصورة والملف الشخصي"
    updateMissionProgress('update_profile', 1);
  }, []);

  // Create Room Handler
  const handleOpenCreateVoiceRoom = () => {
    setCreateRoomType('live_audio');
    setIsCreateRoomOpen(true);
  };

  const handleOpenCreateTextRoom = () => {
    setCreateRoomType('text_only');
    setIsCreateRoomOpen(true);
  };

  const handleCreateRoom = (newRoom: Room, cost: number) => {
    const isOwnerAccount = isUserAdminOrOwner(currentUserRef.current);
    if (cost > 0 && !isOwnerAccount) {
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
      hostId: currentUser.id,
      createdAt: Date.now(),
      isClosed: false,
    };
    setRooms((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
    saveCreatedRoomToFirestore(created).catch(() => {});
    toast.success(`تم إنشاء غرفة "${created.title}" بنجاح ✨`);
    handleSelectRoom(created);
  };

  const handleCloseRoom = useCallback(async (roomId: string) => {
    if (!roomId || OFFICIAL_PUBLIC_ROOM_IDS.has(roomId)) return;
    const me = currentUserRef.current;
    await closeRoomInDB(roomId, me.id).catch(() => {});
    realtimeSocket.sendRoomClosed(roomId, me.id);
    setRooms((prev) => {
      const next = prev.filter((r) => r.id !== roomId);
      try {
        localStorage.setItem('arab_chat_rooms', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (activeRoomRef.current?.id === roomId) {
      closeAllModals();
      setActiveRoom(null);
    }
    toast.success('تم إغلاق الغرفة وحذفها بنجاح');
  }, [closeAllModals]);

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
    toast.vip(`تهانينا! تم تفعيل عضوية ${tier.name} بنجاح 👑`);
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

  // Room Invitation from Online Users Modal (works inside active room)
  const handleInviteUserToMic = (user: User) => {
    if (activeRoom) {
      sendRoomInvitation({
        roomId: activeRoom.id,
        roomTitle: activeRoom.title,
        isPrivate: activeRoom.isPrivate,
        fromUser: currentUserRef.current,
        targetUserId: user.id,
      }).catch(() => {});
      showAppNotice(`تم إرسال دعوة الانضمام إلى الغرفة إلى ${user.name} بنجاح! 🚪`, 'info');
    } else {
      showAppNotice(`يرجى دخول أي غرفة أولاً لدعوة ${user.name} للانضمام.`, 'warn');
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
  const markNotificationRead = useCallback((notificationId: string) => {
    if (!notificationId) return;
    if (notificationId.startsWith('app_update_')) {
      setIsAppUpdateNotifRead(true);
      return;
    }
    if (currentUserRef.current?.id) {
      markUserNotificationsRead(currentUserRef.current.id, [notificationId]).catch(() => {});
    }
    const markList = (prev: RealtimeUserNotification[]) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, read: true } : n));
    setGeneralNotifications(markList);
    setForumNotifications(markList);
    setStoryNotifications(markList);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setIsAppUpdateNotifRead(true);
    const unreadIds = realtimeNotificationsRef.current.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0 && currentUserRef.current?.id) {
      markUserNotificationsRead(currentUserRef.current.id, unreadIds).catch(() => {});
      const markAllList = (prev: RealtimeUserNotification[]) =>
        prev.map((n) => (n.isRead ? n : { ...n, isRead: true, read: true }));
      setGeneralNotifications(markAllList);
      setForumNotifications(markAllList);
      setStoryNotifications(markAllList);
    }
  }, []);

  const openNotifications = useCallback(() => {
    const currentUnreadIds = bellNotifications
      .filter((n) => !n.isRead)
      .map((n) => n.id);
    setRecentlyViewedUnreadIds(currentUnreadIds);
    setIsNotificationsOpen(true);
    if (currentUnreadIds.length > 0) {
      markAllNotificationsRead();
    }
  }, [bellNotifications, markAllNotificationsRead]);

  const closeNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
    setRecentlyViewedUnreadIds([]);
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);
  const openOnlineUsers = useCallback(() => setIsOnlineUsersOpen(true), []);
  const openFriendRequests = useCallback(() => {
    setSeenFriendRequestIds((prev) => {
      const next = new Set(prev);
      pendingFriendRequests.forEach((r) => next.add(r.id));
      return next;
    });
    setIsFriendRequestsOpen(true);
  }, [pendingFriendRequests]);
  const openAdminAt = useCallback((tab: 'users' | 'user_reports' | 'payments' = 'users') => {
    setAdminInitialTab(tab);
    setIsAdminOpen(true);
  }, []);

  const openAdmin = useCallback(() => {
    const defaultTab =
      ownerPendingSummary.pendingPaymentsCount > 0
        ? 'payments'
        : ownerPendingSummary.pendingReportsCount > 0
        ? 'user_reports'
        : 'users';
    setAdminInitialTab(defaultTab);
    setIsAdminOpen(true);
  }, [ownerPendingSummary.pendingPaymentsCount, ownerPendingSummary.pendingReportsCount]);
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
    toast.coins(`مبروك! تم استلام +${coins} كوينز من ${label} 🎉`);
  }, []);
  const handleShareForumPostToPrivateChat = useCallback((post: ForumPost) => {
    const excerpt = (post.text || '').trim().split('\n')[0].slice(0, 80) || 'منشور في منتدى شات مصر';
    const postLink = `${window.location.origin}/?post=${encodeURIComponent(post.id)}#forum-post-${encodeURIComponent(post.id)}`;
    const draft = `📌 مشاركة منشور من "${post.authorName}":\n${excerpt}\n\n🔗 رابط المنشور: ${postLink}`;
    closeAllModals();
    setPrivateChatDraft(draft);
    setTargetChatUser(null);
    setIsInsidePrivateChat(false);
    setIsPrivateChatDrawerOpen(true);
    toast.info('اختر الصديق أو العضو لإرسال المنشور له في الخاص 📩');
  }, [closeAllModals]);

  const handleDeleteNotification = useCallback((notificationId: string) => {
    if (!notificationId) return;
    if (notificationId.startsWith('app_update_')) {
      setIsAppUpdateNotifRead(true);
      setAppUpdateNotice(null);
      return;
    }
    if (currentUserRef.current?.id) {
      deleteUserNotification(currentUserRef.current.id, notificationId).catch(() => {});
    }
    const filterFn = (prev: RealtimeUserNotification[]) => prev.filter((n) => n.id !== notificationId);
    setGeneralNotifications(filterFn);
    setForumNotifications(filterFn);
    setStoryNotifications(filterFn);
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setIsAppUpdateNotifRead(true);
    setAppUpdateNotice(null);
    if (currentUserRef.current?.id) {
      clearAllUserNotifications(currentUserRef.current.id).catch(() => {});
    }
    setGeneralNotifications([]);
    setForumNotifications([]);
    setStoryNotifications([]);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsSection('general');
    setIsSettingsOpen(true);
  }, []);

  const openSupportFromHeader = useCallback(() => {
    closeAllModals();
    setSettingsSection('support');
    setIsSettingsOpen(true);
  }, [closeAllModals]);

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
    }
  }, [closeAllModals]);

  const openLeaderboard = useCallback(() => setIsLeaderboardOpen(true), []);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    closeAllModals();
    globalRadioPlayer.stop();
    sounds.stopCallRing();
    setIncomingCall(null);
    setActiveRoom(null);
    setTargetChatUser(null);
    setIsInsidePrivateChat(false);
    setIsPrivateChatDrawerOpen(false);
    setCurrentTab('home');

    try {
      await Promise.race([
        Promise.allSettled([
          markUserPresenceOffline(currentUser.id, activeRoomRef.current?.id),
          logOutUser(),
        ]),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
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
    setAuthModalMode('exclusive_auth');
    setIsWelcomeAuthOpen(false);
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
      if (isNotificationsOpen) { closeNotifications(); return; }
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
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      if (isWallpapersModalOpen) { setIsWallpapersModalOpen(false); return; }

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

      // 2.5 Exit full-window Ludo back to Games/Home
      if (isLudoFullWindowOpen) {
        setIsLudoFullWindowOpen(false);
        return;
      }

      // 3. Return to 'home' tab
      if (currentTab !== 'home') {
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
    isDailyMissionsOpen, isFriendRequestsOpen, isSettingsOpen, isWallpapersModalOpen,
    isInsidePrivateChat, activeRoom, isLudoFullWindowOpen, currentTab
  ]);

  // Friend Request Accept / Decline (Optimistic UI with safe rollback)
  const handleAcceptFriendRequest = async (req: FriendRequest) => {
    const senderId = req.senderId || req.fromId || '';
    const senderName = req.senderName || req.fromName || 'عضو شات مصر';
    const senderAvatar = req.senderAvatar || req.fromAvatar || '';
    if (!senderId) return;
    const prevPending = pendingFriendRequests;
    const prevBanner = friendReqBanner;
    setPendingFriendRequests(prev => prev.filter(r => r.id !== req.id));
    setFriendReqBanner(curr => (curr?.id === req.id ? null : curr));
    toast.success(`تم قبول طلب صداقة ${senderName} بنجاح! 🤝`, {
      description: 'تمت إضافته فوراً إلى قائمة أصدقائك'
    });
    try {
      await acceptFriendRequestInDB(
        currentUser.id,
        {
          id: senderId,
          name: senderName,
          avatar: senderAvatar
        },
        currentUser,
        req.id
      );
    } catch {
      setPendingFriendRequests(prevPending);
      setFriendReqBanner(prevBanner);
      toast.error('تعذر قبول طلب الصداقة، يرجى المحاولة مجدداً');
    }
  };

  const handleDeclineFriendRequest = async (reqId: string, senderId?: string) => {
    const prevPending = pendingFriendRequests;
    const prevBanner = friendReqBanner;
    setPendingFriendRequests(prev => prev.filter(r => r.id !== reqId));
    setFriendReqBanner(curr => (curr?.id === reqId ? null : curr));
    toast.info('تم رفض طلب الصداقة');
    try {
      await declineFriendRequestInDB(currentUser.id, reqId, senderId);
    } catch {
      setPendingFriendRequests(prevPending);
      setFriendReqBanner(prevBanner);
      toast.error('تعذر رفض طلب الصداقة، يرجى المحاولة مجدداً');
    }
  };

  // Switch active user account (for multi-device / multi-tab testing)
  const handleSwitchUser = (newUser: User) => {
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

  const toasterOptions = useMemo(() => getToasterOptions(isDarkMode), [isDarkMode]);

  // Initial Full-Screen Arabic RTL Welcome Screen until user taps "دخول فوري بدون تسجيل" or logs in
  if (!isProfileReady) {
    return (
      <div className={`h-[var(--app-height,100dvh)] overflow-y-auto overscroll-contain text-slate-900 dark:text-slate-100 transition-colors duration-300 ${fontClass}`}>
        <Toaster
          position="top-center"
          dir="rtl"
          richColors
          closeButton
          expand={false}
          theme={isDarkMode ? 'dark' : 'light'}
          style={{ zIndex: 300 }}
          icons={TOASTER_ICONS}
          toastOptions={toasterOptions}
        />
        <WelcomeScreen
          currentUser={currentUser}
          onEnterApp={(u) => {
            localStorage.setItem('shat_masr_has_entered', 'true');
            handleSwitchUser(u);
            setIsWelcomeAuthOpen(false);
            requestPushNotificationPermission().catch(() => {});
          }}
        />
      </div>
    );
  }

  return (
    <div className={`app-viewport-shell w-full flex flex-col overflow-hidden overscroll-none original-app-bg text-slate-900 dark:text-slate-100 transition-colors duration-300 ${fontClass}`}>
      
      {/* Sonner Professional Toast Notifications (z-index 300) */}
      <Toaster
        position="top-center"
        dir="rtl"
        richColors
        closeButton
        expand={false}
        theme={isDarkMode ? 'dark' : 'light'}
        style={{ zIndex: 300 }}
        icons={TOASTER_ICONS}
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
              onClick={() => applySmoothAppUpdate(remoteVersionInfo.version)}
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
          {/* Silent Firestore App Version Update Banner (non-blocking unless forceUpdate; once per version) */}
          {remoteVersionInfo && remoteVersionInfo.notificationsEnabled && !remoteVersionInfo.forceUpdate && !isRemoteBannerDismissed && (
            <motion.div
              key={`remote-ver-${remoteVersionInfo.version}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                try {
                  localStorage.setItem(`seen_update_for_version_${remoteVersionInfo.version}`, 'true');
                } catch {}
                applySmoothAppUpdate(remoteVersionInfo.version);
              }}
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
                  try {
                    localStorage.setItem(`seen_update_for_version_${remoteVersionInfo.version}`, 'true');
                  } catch {}
                  setIsRemoteBannerDismissed(true);
                }}
                aria-label="إغلاق"
                className="p-1 rounded-full hover:bg-white/20 text-white/90 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
          {/* App Update Push Banner (once per version) */}
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
                  onClick={() => {
                    try {
                      localStorage.setItem(`seen_update_for_version_${appUpdateNotice.version}`, 'true');
                    } catch {}
                    applySmoothAppUpdate(appUpdateNotice.version);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white text-indigo-700 hover:bg-amber-50 text-[11px] font-black flex items-center gap-1 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(`seen_update_for_version_${appUpdateNotice.version}`, 'true');
                    } catch {}
                    setAppUpdateNotice(null);
                  }}
                  aria-label="إغلاق"
                  className="p-1 rounded-full hover:bg-white/20 text-white/90 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Incoming Room Invitation Top Banner (Works on Home & Inside Rooms) */}
          {incomingRoomInvite && (
            <motion.div
              key={`rinv-${incomingRoomInvite.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-l from-rose-700 to-pink-600 text-white border border-rose-400/50 shadow-xl"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {incomingRoomInvite.fromUserAvatar ? (
                    <img src={incomingRoomInvite.fromUserAvatar} alt={incomingRoomInvite.fromUserName} className="w-full h-full object-cover" />
                  ) : (
                    <DoorOpen className="w-4 h-4" />
                  )}
                </div>
                <p className="text-xs font-black leading-snug break-words">
                  يدعوك {incomingRoomInvite.fromUserName} للانضمام إلى {incomingRoomInvite.roomTitle}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const inv = incomingRoomInvite;
                    dismissedRoomInviteIdsRef.current.add(inv.id);
                    setIncomingRoomInvite(null);
                    await respondToRoomInvitation(currentUser.id, inv.id, 'accepted', inv.roomId);
                    const existingRoom = roomsRef.current.find((r) => r.id === inv.roomId);
                    if (existingRoom) {
                      const granted: Room = {
                        ...existingRoom,
                        allowedUserIds: Array.from(new Set([...(existingRoom.allowedUserIds || []), currentUser.id])),
                      };
                      setRooms((prev) => prev.map((r) => (r.id === granted.id ? granted : r)));
                      handleSelectRoom(granted);
                    } else {
                      const fallbackRoom: Room = {
                        id: inv.roomId,
                        title: inv.roomTitle || 'غرفة الدردشة',
                        description: 'تمت دعوتك للانضمام إلى الغرفة',
                        subtext: `دعوة من ${inv.fromUserName}`,
                        category: inv.isPrivate ? 'member_rooms' : 'general',
                        type: 'text',
                        roomType: 'text_only',
                        icon: '💬',
                        iconBg: 'bg-rose-500',
                        activeUsers: 1,
                        visitorsCount: '1',
                        isLive: false,
                        isVoiceActive: false,
                        accentGradient: 'from-rose-600 to-pink-700',
                        isPrivate: Boolean(inv.isPrivate),
                        ownerId: inv.fromUserId,
                        allowedUserIds: [currentUser.id],
                        speakers: [],
                        moderators: [],
                      };
                      setRooms((prev) => [fallbackRoom, ...prev]);
                      handleSelectRoom(fallbackRoom);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-black shadow-xs active:scale-95 transition cursor-pointer"
                >
                  انضمام للغرفة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissedRoomInviteIdsRef.current.add(incomingRoomInvite.id);
                    respondToRoomInvitation(currentUser.id, incomingRoomInvite.id, 'declined', incomingRoomInvite.roomId).catch(() => {});
                    setIncomingRoomInvite(null);
                  }}
                  className="px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-black cursor-pointer"
                >
                  تجاهل
                </button>
              </div>
            </motion.div>
          )}

          {/* Owner Room Join Request Top Banner (Approve / Reject instantly) */}
          {ownerRoomJoinRequest && (
            <motion.div
              key={`rjoin-${ownerRoomJoinRequest.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-rose-300 dark:border-rose-700/70 shadow-xl text-slate-900 dark:text-slate-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-700 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0 overflow-hidden">
                  {ownerRoomJoinRequest.userAvatar ? (
                    <img src={ownerRoomJoinRequest.userAvatar} alt={ownerRoomJoinRequest.userName} className="w-full h-full object-cover" />
                  ) : (
                    <DoorOpen className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black leading-snug break-words">
                    يريد {ownerRoomJoinRequest.userName} الانضمام إلى غرفتك
                  </p>
                  {ownerRoomJoinRequest.roomTitle && (
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{ownerRoomJoinRequest.roomTitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const req = ownerRoomJoinRequest;
                    dismissedOwnerJoinReqIdsRef.current.add(req.id);
                    setOwnerRoomJoinRequest(null);
                    await resolveRoomJoinRequest(req.roomId, req.userId, 'accepted', {
                      ownerId: currentUser.id,
                      roomTitle: req.roomTitle,
                      approverUser: currentUser,
                    });
                    setRooms((prev) =>
                      prev.map((r) =>
                        r.id === req.roomId
                          ? { ...r, allowedUserIds: Array.from(new Set([...(r.allowedUserIds || []), req.userId])) }
                          : r
                      )
                    );
                    toast.success(`تم قبول انضمام ${req.userName} إلى الغرفة ✅`);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shadow-xs active:scale-95 transition cursor-pointer"
                >
                  قبول
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const req = ownerRoomJoinRequest;
                    dismissedOwnerJoinReqIdsRef.current.add(req.id);
                    setOwnerRoomJoinRequest(null);
                    await resolveRoomJoinRequest(req.roomId, req.userId, 'rejected', {
                      ownerId: currentUser.id,
                      roomTitle: req.roomTitle,
                    });
                    toast.info(`تم رفض طلب ${req.userName}`);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/50 dark:hover:bg-rose-800/60 text-rose-700 dark:text-rose-200 text-[11px] font-black active:scale-95 transition cursor-pointer"
                >
                  رفض
                </button>
              </div>
            </motion.div>
          )}

          {/* Incoming Game Challenge Top Banner (Accept jumps straight into live XO game) */}
          {incomingGameChallenge && (
            <motion.div
              key={`gchal-${incomingGameChallenge.matchId}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 text-white border border-indigo-400/50 shadow-xl"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {incomingGameChallenge.fromAvatar ? (
                    <img src={incomingGameChallenge.fromAvatar} alt={incomingGameChallenge.fromName} className="w-full h-full object-cover" />
                  ) : (
                    <Swords className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black leading-snug break-words">
                    يتحداك {incomingGameChallenge.fromName} في لعبة إكس أو
                  </p>
                  {incomingGameChallenge.wager > 0 && (
                    <p className="text-[10.5px] text-amber-200 font-bold">
                      رهان التحدي: {incomingGameChallenge.wager} كوينز 🪙
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const ch = incomingGameChallenge;
                    dismissedGameChallengeIdsRef.current.add(ch.matchId);
                    setIncomingGameChallenge(null);
                    await respondToGameChallenge({
                      userId: currentUser.id,
                      matchId: ch.matchId,
                      acceptorUser: currentUser,
                      status: 'accepted',
                    });
                    setAcceptedGameChallenge({
                      matchId: ch.matchId,
                      opponentId: ch.fromId,
                      opponentName: ch.fromName,
                      opponentAvatar: ch.fromAvatar,
                      wager: ch.wager,
                    });
                    closeAllModals();
                    setActiveRoom(null);
                    setCurrentTab('games');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-[11px] font-black shadow-xs active:scale-95 transition cursor-pointer"
                >
                  قبول واللعب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ch = incomingGameChallenge;
                    dismissedGameChallengeIdsRef.current.add(ch.matchId);
                    setIncomingGameChallenge(null);
                    respondToGameChallenge({
                      userId: currentUser.id,
                      matchId: ch.matchId,
                      acceptorUser: currentUser,
                      status: 'declined',
                    }).catch(() => {});
                  }}
                  className="px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-black cursor-pointer"
                >
                  رفض
                </button>
              </div>
            </motion.div>
          )}

          {/* Incoming Ludo Match Invite Top Banner */}
          {incomingLudoInvite && (
            <motion.div
              key={`ludo-inv-${incomingLudoInvite.matchId}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-l from-rose-600 via-pink-600 to-amber-500 text-white border border-amber-300/60 shadow-xl"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {incomingLudoInvite.hostAvatar ? (
                    <img src={incomingLudoInvite.hostAvatar} alt={incomingLudoInvite.hostName} className="w-full h-full object-cover" />
                  ) : (
                    <Dices className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black leading-snug break-words">
                    يدعوك {incomingLudoInvite.hostName} لطاولة اللودو ({incomingLudoInvite.playerCount} لاعبين) 🎲
                  </p>
                  {incomingLudoInvite.wager > 0 && (
                    <p className="text-[10.5px] text-amber-100 font-bold">
                      رهان الطاولة: {incomingLudoInvite.wager} كوينز 🪙
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const inv = incomingLudoInvite;
                    dismissedLudoInviteIdsRef.current.add(inv.matchId);
                    setIncomingLudoInvite(null);
                    await respondToLudoInvite({
                      userId: currentUser.id,
                      hostId: inv.hostId,
                      matchId: inv.matchId,
                      acceptorUser: currentUser,
                      status: 'accepted',
                    });
                    setAcceptedLudoMatchRef({ hostId: inv.hostId, matchId: inv.matchId });
                    closeAllModals();
                    setActiveRoom(null);
                    setCurrentTab('games');
                    setIsLudoFullWindowOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-black shadow-xs active:scale-95 transition cursor-pointer"
                >
                  انضمام واللعب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const inv = incomingLudoInvite;
                    dismissedLudoInviteIdsRef.current.add(inv.matchId);
                    setIncomingLudoInvite(null);
                    respondToLudoInvite({
                      userId: currentUser.id,
                      hostId: inv.hostId,
                      matchId: inv.matchId,
                      acceptorUser: currentUser,
                      status: 'declined',
                    }).catch(() => {});
                  }}
                  className="px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-black cursor-pointer"
                >
                  رفض
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
          pendingFriendRequestsCount={unreadFriendRequestsCount}
          onlineUsersCount={Math.max(1, trulyOnlineUsers.length)}
          onOpenRadio={openRadio}
          isRadioPlaying={isRadioPlaying}
          onLogout={handleLogout}
          unreadMessagesBySender={unreadMessagesBySender}
          totalUnreadMessagesCount={totalUnreadMessagesCount}
          onOpenSenderChat={handleOpenIncomingChat}
          onClearAllUnreadMessages={clearAllUnreadMessages}
          onOpenMessagesTab={openMessagesDrawer}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenSupport={openSupportFromHeader}
          onOpenSettings={openSettings}
          unreadNotificationsCount={unreadNotificationsCount}
          adminPendingCount={isCurrentAdminOrOwner ? ownerPendingSummary.totalPendingCount : 0}
        />
      )}

      {/* Banned Alert Banner */}
      {isUserBannedNow(currentUser) && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-center text-xs font-black flex flex-wrap items-center justify-center gap-2 shadow-lg sticky top-0 z-[300] animate-in slide-in-from-top">
          <span>
            {!currentUser.isBanned && currentUser.bannedUntil
              ? `🚫 حسابك محظور مؤقتاً حتى ${formatArabicDateTime(currentUser.bannedUntil)}${currentUser.banReason ? ` (${currentUser.banReason})` : ''}`
              : `🚫 حسابك محظور حالياً من قِبل إدارة شات مصر والعرب${currentUser.banReason ? ` (${currentUser.banReason})` : ''}.`}
          </span>
          {isUserAdminOrOwner(currentUser) && (
            <button
              onClick={openAdmin}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold border border-white/30 transition-all"
            >
              فتح لوحة الإدارة لفك الحظر
            </button>
          )}
        </div>
      )}

      {/* Muted Alert Banner */}
      {currentUser.isMuted && !isUserBannedNow(currentUser) && (
        <div className="bg-amber-400 text-slate-950 px-4 py-1.5 text-center text-xs font-black flex items-center justify-center gap-2 shadow sticky top-0 z-[300]">
          <span>🔇 أنت مكتوم حالياً بواسطة الإدارة، يمكنك الاستماع فقط ولا يمكنك إرسال الرسائل.</span>
          {isUserAdminOrOwner(currentUser) && (
            <button
              onClick={openAdmin}
              className="px-2 py-0.5 rounded bg-black/15 hover:bg-black/25 text-slate-950 text-[10px] underline font-bold"
            >
              إلغاء الكتم من الإدارة
            </button>
          )}
        </div>
      )}

      {/* 2. Main View Routing: Locked inside 100dvh viewport flex container so Header stays permanently pinned */}
      <main
        className={
          activeRoom
            ? "flex-1 min-h-0 w-full overflow-hidden overscroll-none"
            : "flex-1 min-h-0 w-full max-w-7xl mx-auto overflow-hidden overscroll-none"
        }
      >
        {/* Frozen Home Page Container (always mounted; hidden via CSS when inside a room, Ludo full-window, or another tab) */}
        <div className={!activeRoom && !isLudoFullWindowOpen && currentTab === 'home' ? 'h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom,0px))]' : 'hidden'}>
          <RoomsView
            rooms={rooms}
            currentUser={currentUser}
            onlineUsers={trulyOnlineUsers}
            onSelectRoom={handleSelectRoom}
            onOpenPrivateChatWith={handleOpenPrivateChatWith}
            onOpenUserProfile={(u) => setSelectedProfileUser(u)}
            onOpenWallet={openWallet}
            onOpenVip={openVip}
            onOpenLeaderboard={openLeaderboard}
            onOpenMissions={openMissions}
            totalActiveUsersCount={trulyOnlineUsers.length}
            registeredUsersCount={allRegisteredUsers.length > 0 ? allRegisteredUsers.length : registeredUsersCount}
            cumulativeVisitorsCount={cumulativeVisitorsCount}
            onOpenOnlineUsers={openOnlineUsers}
            onClaimSharedRewardCoins={handleClaimSharedRewardCoins}
            onShareForumPost={handleShareForumPostToPrivateChat}
            unreadForumNotifsCount={unreadForumNotificationsCount}
            unreadStoryNotifsCount={unreadStoryNotificationsCount}
            onOpenNotifications={openNotifications}
            onOpenCreateTextRoom={handleOpenCreateTextRoom}
            onOpenCreateVoiceRoom={handleOpenCreateVoiceRoom}
            onRequestJoinRoom={handleRequestJoinRoomFromCard}
            onCloseRoom={handleCloseRoom}
            onOpenRadio={openRadio}
            isRadioPlaying={isRadioPlaying}
          />
        </div>

          {activeRoom ? (
            <RoomActiveView
              room={{
                ...activeRoom,
                activeUsers: roomActiveCount,
                visitorsCount: Math.max(cumulativeVisitorsCount, registeredUsersCount, allRegisteredUsers.length).toLocaleString()
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
              onOpenMessagesDrawer={openMessagesDrawer}
              unreadPrivateCount={totalUnreadMessagesCount}
              pendingFriendRequestsCount={unreadFriendRequestsCount}
              unreadNotificationsCount={unreadNotificationsCount}
              onOpenFriendRequests={openFriendRequests}
              onOpenNotifications={openNotifications}
              isDarkMode={isDarkMode}
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
              onTriggerGiftCelebration={triggerGiftCelebration}
              onLoadOlderMessages={handleLoadOlderRoomMessages}
              hasMoreOlderMessages={hasMoreRoomMessages}
              isLoadingOlderMessages={isLoadingOlderRoomMsgs}
              onCloseRoom={handleCloseRoom}
              onlineUsersList={trulyOnlineUsers}
            />
          ) : isLudoFullWindowOpen ? (
            <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50/90 dark:bg-slate-950/95">
              <LudoGamePanel
                fullWindow
                onCloseWindow={() => setIsLudoFullWindowOpen(false)}
                currentUser={currentUser}
                allOnlineUsers={trulyOnlineUsers}
                onUpdateCoins={(coins) => handleUpdateUserBalance(coins, currentUser.earningsEgp)}
                onOpenWallet={openWallet}
                externalLudoMatchRef={acceptedLudoMatchRef}
                onConsumeExternalLudoMatchRef={() => setAcceptedLudoMatchRef(null)}
                externalQuickInviteUser={quickLudoInviteUser}
                onConsumeExternalQuickInviteUser={() => setQuickLudoInviteUser(null)}
              />
            </div>
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
                  globalOnlineUsers={trulyOnlineUsers}
                  allRegisteredUsers={allRegisteredUsers}
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
                  prefilledDraft={privateChatDraft}
                  onClearPrefilledDraft={() => setPrivateChatDraft(null)}
                  onTriggerGiftCelebration={triggerGiftCelebration}
                />
              )}

              {currentTab === 'games' && (
                <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
                  <GamesView
                    currentUser={currentUser}
                    allOnlineUsers={trulyOnlineUsers}
                    onUpdateCoins={(coins) => handleUpdateUserBalance(coins, currentUser.earningsEgp)}
                    onOpenWallet={openWallet}
                    externalAcceptedChallenge={acceptedGameChallenge}
                    onConsumeExternalChallenge={() => setAcceptedGameChallenge(null)}
                    externalLudoMatchRef={acceptedLudoMatchRef}
                    onConsumeExternalLudoMatchRef={() => setAcceptedLudoMatchRef(null)}
                    externalQuickInviteUser={quickLudoInviteUser}
                    onConsumeExternalQuickInviteUser={() => setQuickLudoInviteUser(null)}
                    onOpenLudoFullWindow={() => setIsLudoFullWindowOpen(true)}
                  />
                </div>
              )}

              {currentTab === 'profile' && (
                <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
                  <ProfileView
                    currentUser={currentUser}
                    onUpdateUser={(updated) => {
                      const merged = { ...currentUserRef.current, ...updated };
                      setCurrentUser(merged);
                      propagateUserIdentityAcrossApp(merged).catch(() => {});
                    }}
                    onOpenWallet={openWallet}
                    onOpenVip={openVip}
                    onOpenSettings={openSettings}
                    onLogout={handleLogout}
                    openToSupport={openSupportRequested}
                    onConsumeSupportScroll={() => setOpenSupportRequested(false)}
                  />
                </div>
              )}
            </>
          )}
      </main>

      {/* 3. Bottom Navigation Bar - Hidden inside active room, full-window Ludo, OR active 1-on-1 private chat */}
      {!activeRoom && !isLudoFullWindowOpen && !isPrivateChatDrawerOpen && (!isInsidePrivateChat || currentTab !== 'chat') && (
        <BottomNav
          currentTab={isPrivateChatDrawerOpen ? 'chat' : currentTab}
          onTabChange={handleBottomTabChange}
          unreadChatsCount={totalUnreadMessagesCount + unreadFriendRequestsCount}
        />
      )}

      {/* 4. Fullscreen Luxury Gift Overlay */}
      <FullscreenGiftOverlay
        gift={activeFullscreenGift?.gift || null}
        senderName={activeFullscreenGift?.senderName || ''}
        recipientName={activeFullscreenGift?.recipientName || ''}
        replayKey={activeFullscreenGift?.replayKey || 0}
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
        onClose={closeNotifications}
        onOpenWallet={openWallet}
        realtimeNotifications={bellNotifications}
        onMarkAsRead={markNotificationRead}
        onMarkAllAsRead={markAllNotificationsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        unreadCount={unreadNotificationsCount}
        highlightedUnreadIds={recentlyViewedUnreadIds}
        notificationBgPresetId={readSavedNotificationBgPresetId(currentUser)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => {
          const merged = { ...currentUserRef.current, ...updated };
          setCurrentUser(merged);
          propagateUserIdentityAcrossApp(merged).catch(() => {});
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenWallpapers={() => setIsWallpapersModalOpen(true)}
        onLogout={handleLogout}
        initialSection={settingsSection}
      />

      <ChatWallpapersModal
        isOpen={isWallpapersModalOpen}
        onClose={() => setIsWallpapersModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => {
          const merged = { ...currentUserRef.current, ...updated };
          setCurrentUser(merged);
          propagateUserIdentityAcrossApp(merged).catch(() => {});
        }}
        onOpenWallet={openWallet}
      />

      {/* Online Users List Side Drawer with real presence occupants */}
      <OnlineUsersModal
        isOpen={isOnlineUsersOpen}
        onClose={() => setIsOnlineUsersOpen(false)}
        currentUser={currentUser}
        roomTitle={activeRoom?.title}
        roomUsers={roomActiveUsers}
        allActiveUsers={trulyOnlineUsers}
        allRegisteredUsers={allRegisteredUsers}
        onSelectUserForProfile={(user) => {
          setIsOnlineUsersOpen(false);
          setSelectedProfileUser(user);
        }}
        onInviteToMic={handleInviteUserToMic}
        onOpenPrivateChatWith={handleOpenPrivateChatWith}
        onInviteToLudo={(target) => {
          closeAllModals();
          setActiveRoom(null);
          setQuickLudoInviteUser(target);
          setCurrentTab('games');
          setIsLudoFullWindowOpen(true);
        }}
      />

      {/* Private Messages & Friends Side Drawer (Full Width on Mobile) */}
      <AnimatePresence>
        {isPrivateChatDrawerOpen && (
          <motion.div
            dir="rtl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsPrivateChatDrawerOpen(false)}
            className="fixed inset-0 z-[100] flex justify-end bg-slate-900/45 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.8 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full sm:max-w-[420px] bg-white dark:bg-slate-900 sm:border-r border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
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
                globalOnlineUsers={trulyOnlineUsers}
                allRegisteredUsers={allRegisteredUsers}
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
                prefilledDraft={privateChatDraft}
                onClearPrefilledDraft={() => setPrivateChatDraft(null)}
                onTriggerGiftCelebration={triggerGiftCelebration}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Card Modal with Friend Request & Earned Badges */}
      <UserProfileModal
        user={selectedProfileUser}
        currentUser={currentUser}
        onlineUsers={trulyOnlineUsers}
        allRegisteredUsers={allRegisteredUsers}
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

      {/* Admin Control Panel Modal (Mounted lazily only when opened for fast Owner login) */}
      {isAdminOpen && (
        <AdminControlPanelModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          currentUser={currentUser}
          allUsers={allRegisteredUsers.length > 0 ? allRegisteredUsers : globalOnlineUsers}
          initialTab={adminInitialTab}
          pendingPaymentsCountExternal={ownerPendingSummary.pendingPaymentsCount}
          pendingReportsCountExternal={ownerPendingSummary.pendingReportsCount}
          onUserModified={(updated) => {
            realtimeSocket.sendAdminAction(updated.id, updated);
            if (updated.id === currentUser.id) {
              setCurrentUser(prev => ({ ...prev, ...updated }));
            }
            setGlobalOnlineUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
          }}
        />
      )}

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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto text-2xl text-rose-500">
              🚪
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">هل أنت متأكد من أنك تريد المغادرة؟</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
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
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer"
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
