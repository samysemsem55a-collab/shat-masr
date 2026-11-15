import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { Play, Pause, SkipForward, Radio, Volume2, VolumeX, X } from 'lucide-react';
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
import { FriendRequestsModal } from './components/FriendRequestsModal';
import { AdminControlPanelModal } from './components/AdminControlPanelModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { PrivateRoomPromptModal } from './components/PrivateRoomPromptModal';
import { PhoneAuthModal } from './components/PhoneAuthModal';
import { WelcomeAuthModal } from './components/WelcomeAuthModal';
import { CallModal } from './components/CallModal';

import { User, Room, Message, GiftItem, VipTier, SpeakerSeat, FriendRequest, DailyMission, UnreadSenderSummary } from './types/chat';
import { INITIAL_ROOMS, getOrCreateUser, isUserAdminOrOwner } from './data/seedData';
import { sounds } from './utils/soundEffects';
import { realtimeSocket } from './services/realtimeSocket';
import { globalRadioPlayer, RadioPlayerSnapshot } from './services/radioPlayer';
import {
  initExternalPushNotifications,
  requestPushNotificationPermission,
  triggerExternalBrowserNotification,
} from './services/pushNotifications';
import { 
  subscribeToRoomMessages, 
  sendFirestoreMessage, 
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
  contributeToSharedRoomMission
} from './services/firebase';

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

  const [targetChatUser, setTargetChatUser] = useState<User | null>(null);
  const [isInsidePrivateChat, setIsInsidePrivateChat] = useState<boolean>(false);

  // Per-sender unread incoming message tracking (persisted per user)
  const [unreadSendersMap, setUnreadSendersMap] = useState<Record<string, UnreadSenderSummary>>(() => {
    try {
      const saved = localStorage.getItem(`shat_masr_unread_senders_${currentUser.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const processedUnreadDmIdsRef = useRef<Set<string>>(new Set());

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
    setUnreadSendersMap((prev) => {
      if (!prev[senderId]) return prev;
      const next = { ...prev };
      delete next[senderId];
      return next;
    });
  }, []);

  const clearAllUnreadMessages = useCallback(() => {
    setUnreadSendersMap({});
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
  const [currentTab, setCurrentTab] = useState<NavTab>('rooms');

  // Real-time Presence
  const [roomActiveUsers, setRoomActiveUsers] = useState<User[]>([]);
  const [roomActiveCount, setRoomActiveCount] = useState<number>(1);
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState<User[]>([currentUser]);

  // Friend Requests State
  const [pendingFriendRequests, setPendingFriendRequests] = useState<FriendRequest[]>([]);
  const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState(false);

  // Modals State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [createRoomType, setCreateRoomType] = useState<'voice' | 'text_only'>('voice');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isOnlineUsersOpen, setIsOnlineUsersOpen] = useState(false);
  const [isPrivateChatDrawerOpen, setIsPrivateChatDrawerOpen] = useState(false);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const [isWelcomeAuthOpen, setIsWelcomeAuthOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasEntered = localStorage.getItem('shat_masr_has_entered') || localStorage.getItem('arab_chat_has_entered');
    const authEmail = localStorage.getItem('arab_chat_auth_email');
    return !hasEntered && !authEmail;
  });

  // Global Persistent FM Radio & Music Player State
  const [radioSnap, setRadioSnap] = useState<RadioPlayerSnapshot>(() => globalRadioPlayer.getSnapshot());
  const [miniRadioDismissed, setMiniRadioDismissed] = useState(false);

  // Incoming Call State (WebRTC)
  const [incomingCall, setIncomingCall] = useState<{
    peer: User;
    callType: 'audio' | 'video';
    signal: any;
  } | null>(null);

  useEffect(() => {
    const unsub = globalRadioPlayer.subscribe((snap) => setRadioSnap(snap));
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

  // Persist User Changes & Sync to Firebase
  useEffect(() => {
    localStorage.setItem('arab_chat_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Subscribe to real-time User Profile updates from Firebase Realtime Database
  useEffect(() => {
    const unsub = subscribeToUserProfile(currentUser.id, (profileUpdate) => {
      setCurrentUser(prev => ({
        ...prev,
        ...profileUpdate
      }));
    });
    return () => unsub();
  }, [currentUser.id]);

  // 1. Initialize Real-Time WebSocket Connection across all devices
  useEffect(() => {
    realtimeSocket.connect(currentUser);

    // Listen to global presence updates (real connected users via WebSocket)
    const unsubGlobal = realtimeSocket.subscribeToGlobalPresence((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        const map = new Map<string, User>();
        map.set(currentUser.id, currentUser);
        liveUsers.forEach(u => {
          if (u && u.id) map.set(u.id, u);
        });
        setGlobalOnlineUsers(Array.from(map.values()));
      }
    });

    // Also listen to Firestore global presence (multi-session across browser instances)
    const unsubFirestorePresence = subscribeToGlobalPresence(currentUser, (liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        setGlobalOnlineUsers(prev => {
          const map = new Map<string, User>();
          prev.forEach(u => map.set(u.id, u));
          liveUsers.forEach(u => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
    });

    // Listen to admin actions (instant VIP, ban, mute, coins)
    const unsubAdmin = realtimeSocket.subscribeToAdminEvents((targetUserId, updates) => {
      if (targetUserId === currentUser.id) {
        setCurrentUser(prev => ({ ...prev, ...updates }));
      }
      setGlobalOnlineUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, ...updates } : u));
    });

    // Listen to friend requests in real-time (strictly pending & deduplicated)
    const unsubFriend = realtimeSocket.subscribeToFriendRequests((req) => {
      if (req.receiverId === currentUser.id && req.status === 'pending') {
        setPendingFriendRequests(prev => {
          if (prev.some(r => r.id === req.id || (r.senderId === req.senderId && r.status === 'pending'))) {
            return prev;
          }
          sounds.playMessageReceived();
          toast.info(`طلب صداقة جديد من ${req.senderName} 🤝`, {
            id: `friend_req_${req.id}`,
            description: 'اضغط على عرض الطلب للقبول أو الرفض',
            duration: 6500,
            action: {
              label: 'عرض وقبول',
              onClick: () => setIsFriendRequestsOpen(true)
            }
          });
          return [req, ...prev];
        });
      }
    });

    // Listen to room background theme updates across all rooms
    const unsubRoomBgs = realtimeSocket.subscribeToAllRoomBackgrounds((backgrounds) => {
      setRooms(prev =>
        prev.map(r => {
          const serverTheme = backgrounds[r.id];
          const normalized = serverTheme && serverTheme !== 'default' ? serverTheme : undefined;
          return r.backgroundTheme === normalized ? r : { ...r, backgroundTheme: normalized };
        })
      );
      setActiveRoom(prev => {
        if (!prev) return prev;
        const serverTheme = backgrounds[prev.id];
        const normalized = serverTheme && serverTheme !== 'default' ? serverTheme : undefined;
        return prev.backgroundTheme === normalized ? prev : { ...prev, backgroundTheme: normalized };
      });
    });

    // Listen to room lock status across all rooms
    const unsubRoomLocks = subscribeToAllRoomLocks((locks) => {
      setRooms(prev =>
        prev.map(r => {
          const nextLocked = Boolean(locks[r.id]);
          return Boolean(r.isLocked) === nextLocked ? r : { ...r, isLocked: nextLocked };
        })
      );
      setActiveRoom(prev => {
        if (!prev) return prev;
        const nextLocked = Boolean(locks[prev.id]);
        return Boolean(prev.isLocked) === nextLocked ? prev : { ...prev, isLocked: nextLocked };
      });
    });

    // Listen to incoming WebRTC calls targeting current user
    const unsubCalls = realtimeSocket.subscribeToCallSignals((signal) => {
      if (!signal || signal.type !== 'call_offer') return;
      if (signal.targetUserId && signal.targetUserId !== currentUser.id) return;
      if (!signal.fromUserId || signal.fromUserId === currentUser.id) return;

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
      unsubRoomBgs();
      unsubRoomLocks();
      unsubCalls();
    };
  }, [currentUser.id, currentUser.sessionId, currentUser.name]);

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
            return {
              ...prev,
              [rawMsg.senderId]: {
                senderId: rawMsg.senderId,
                senderName: rawMsg.senderName || existing?.senderName || 'مستخدم',
                senderAvatar: rawMsg.senderAvatar || existing?.senderAvatar || '',
                count: (existing?.count || 0) + 1,
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
              peerName: rawMsg.senderName || 'مستخدم',
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
          senderName: rawMsg.senderName || 'مستخدم',
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
          sounds.playMessageReceived();
          toast(`💬 رسالة خاصة من ${toastPayload.senderName}`, {
            id: `dm_${rawMsg.id}`,
            description: rawMsg.content || rawMsg.text || 'أرسل لك رسالة خاصة جديدة',
            duration: 6000,
            action: {
              label: 'رد فوراً ✉️',
              onClick: () => handleOpenIncomingChat(toastPayload)
            }
          });
          if (typeof document !== 'undefined' && document.hidden) {
            triggerExternalBrowserNotification(
              `💬 رسالة جديدة من ${toastPayload.senderName}`,
              rawMsg.content || rawMsg.text || 'أرسل لك رسالة خاصة جديدة',
              { senderId: rawMsg.senderId },
              () => handleOpenIncomingChat(toastPayload)
            );
          }
        }
      }
    };

    // 1. WebSocket direct message listener
    const unsubDm = realtimeSocket.subscribeToGlobalDirectMessages(handleIncomingDm);

    // 2. Multi-tab BroadcastChannel listener
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
      bus?.close();
    };
  }, [currentUser.id, currentUser.sessionId, currentUser.notificationPrefs?.directMessages, currentUser.notificationPrefs?.gifts, currentTab, isPrivateChatDrawerOpen, isInsidePrivateChat, targetChatUser?.id]);

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
            senderName: found?.name || 'مستخدم',
            senderAvatar: found?.avatar || '',
          });
        }
      }
    );
  }, []);

  const handleOpenIncomingChat = (toastItem: { senderId: string; senderName: string; senderAvatar: string }) => {
    clearUnreadForSender(toastItem.senderId);
    const existing = globalOnlineUsers.find(u => u.id === toastItem.senderId);
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
  };

  // Persist Rooms Changes
  useEffect(() => {
    localStorage.setItem('arab_chat_rooms', JSON.stringify(rooms));
  }, [rooms]);

  // Subscribe to real friend requests
  useEffect(() => {
    const unsub = subscribeToFriendRequests(currentUser.id, (reqs) => {
      setPendingFriendRequests(reqs.filter(r => r.status === 'pending'));
    });
    return () => unsub();
  }, [currentUser.id]);

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
      setRoomActiveCount(count);
      setRoomActiveUsers(occupants);
      setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, activeUsers: count } : r));
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
        content: `انضم ${currentUser.name} إلى شات مصر / نورت الغرفة! 🌸`,
        text: `انضم ${currentUser.name} إلى شات مصر / نورت الغرفة! 🌸`,
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
            const welcomeText = 'أهلاً بك معنا في شات مصر! نورت المجلس 🌸 - شاركنا بتواجدك الراقي';
            const botMsg: Message = {
              id: `bot_welcome_${activeRoom.id}_${currentUser.id}`,
              roomId: activeRoom.id,
              senderId: 'system_bot',
              senderName: 'بوت شات مصر',
              senderAvatar: '',
              senderRole: 'super_admin',
              senderVipBadge: 'بوت النظام 🤖',
              badges: ['بوت الترحيب الرسمي'],
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
            sounds.playMessageReceived();
          }, 550);
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
      if (welcomeBotTimer) clearTimeout(welcomeBotTimer);
      realtimeSocket.leaveRoom(activeRoom.id, currentUser.id);
      unsubPresence();
      unsubMessages();
      unsubReactions();
      unsubRead();
      unsubFirebase();
      unsubPurged();
    };
  }, [activeRoom?.id, currentUser.id]);

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

      // 1. Broadcast via WebSocket directly to ALL other connected devices in real time
      realtimeSocket.sendMessage(activeRoom.id, newMsg);

      // 2. Also send to Firebase Realtime Database & Firestore
      sendFirestoreMessage(activeRoom.id, newMsg).catch(err => {
        console.warn("Realtime DB message write notice:", err);
      });

      // 3. Track Daily Mission & Shared Room Daily Mission
      updateMissionProgress('send_5_messages', 1);
      contributeToSharedRoomMission('messages', currentUser.id, 1).catch(() => {});

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

  // Send Luxury Gift Handler (Admin/Owner bypass: Requirement 2)
  const handleSendGift = async (gift: GiftItem, recipientName: string) => {
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

    // Broadcast across tabs/users
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
      content: `أرسل هدية ${gift.name} بقيمة ${gift.cost} كوينز!`,
      gift: {
        giftId: gift.id,
        name: gift.name,
        icon: gift.icon,
        cost: gift.cost,
        recipientName,
      }
    });
  };

  // Enter Room Handler with Room Lock & Private Room Protection
  const handleSelectRoom = (room: Room) => {
    const canManageRoom =
      isUserAdminOrOwner(currentUser) ||
      room.ownerId === currentUser.id ||
      room.hostId === currentUser.id ||
      (room.moderators || []).includes(currentUser.id);

    if (room.isLocked && !canManageRoom) {
      sounds.playMicToggle(false);
      toast.error('🔒 هذه الغرفة مقفلة حالياً', {
        description: `قام مديرو "${room.title}" بقفل الغرفة مؤقتاً، ولا يمكن دخول أعضاء جدد الآن.`,
      });
      return;
    }

    if (room.isPrivate) {
      const isAllowed = 
        room.ownerId === currentUser.id ||
        room.hostId === currentUser.id ||
        (room.allowedUserIds || []).includes(currentUser.id) ||
        isUserAdminOrOwner(currentUser);

      if (!isAllowed) {
        setPrivatePromptRoom(room);
        setIsPrivatePromptOpen(true);
        return;
      }
    }

    setActiveRoom(room);
    sounds.playMessageReceived();

    // Track Daily Mission: "دخول مجلس صوتي"
    if (room.type === 'voice' || room.roomType === 'voice' || room.isVoiceActive) {
      updateMissionProgress('join_voice_room', 1);
    }
  };

  // Direct Avatar Photo Upload Callback with immediate Firebase & WebSocket sync
  const handleAvatarChanged = (newAvatarUrl: string) => {
    const updated: User = {
      ...currentUser,
      avatar: newAvatarUrl
    };
    setCurrentUser(updated);
    sounds.playCoinsReward();
    realtimeSocket.updateAvatar(currentUser.id, newAvatarUrl);
    syncUserProfileToFirebase(updated);
    toast.success('تم تحديث صورتك الشخصية بنجاح 📸');

    // Track Daily Mission: "تحديث الصورة والملف الشخصي"
    updateMissionProgress('update_profile', 1);
  };

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
  const handleOpenPrivateChatWith = (user: User) => {
    clearUnreadForSender(user.id);
    setSelectedProfileUser(null);
    setIsOnlineUsersOpen(false);
    setTargetChatUser(user);
    setIsInsidePrivateChat(true);
    setIsPrivateChatDrawerOpen(true);
  };

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
    setActiveRoom(null);
  };

  // Logout Confirmation Modal & Safe State Purge
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    try {
      await logOutUser();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
    localStorage.removeItem('arab_chat_userId');
    localStorage.removeItem('arab_chat_user');
    localStorage.removeItem('arab_chat_guest_id');
    localStorage.removeItem('arab_chat_auth_email');
    localStorage.removeItem('arab_chat_auth_phone');
    sounds.playMessageSent();
    const guestUser = getOrCreateUser();
    setCurrentUser(guestUser);
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

      // 3. Return to 'rooms' tab
      if (currentTab !== 'rooms') {
        setCurrentTab('rooms');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isAdminOpen, isWalletOpen, isVipOpen, isGiftModalOpen, isCreateRoomOpen,
    isNotificationsOpen, isOnlineUsersOpen, isPrivateChatDrawerOpen, isRadioModalOpen, selectedProfileUser,
    isPhoneAuthOpen, isPrivatePromptOpen, isDailyMissionsOpen,
    isFriendRequestsOpen, isInsidePrivateChat, activeRoom, currentTab
  ]);

  // Friend Request Accept / Decline
  const handleAcceptFriendRequest = async (req: FriendRequest) => {
    sounds.playCoinsReward();
    setPendingFriendRequests(prev => prev.filter(r => r.id !== req.id));
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

  return (
    <div className={`min-h-screen original-app-bg text-slate-900 ${fontClass}`}>
      
      {/* Sonner Professional Toast Notifications */}
      <Toaster
        position="top-center"
        dir="rtl"
        richColors
        closeButton
        expand={false}
        toastOptions={{
          style: {
            fontFamily: 'Cairo, Tajawal, sans-serif',
            borderRadius: '1rem',
            boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.18)'
          }
        }}
      />

      {/* 1. Top Header Bar: Unified compact mobile-responsive header - ONLY shown on main screen, hidden inside active room */}
      {!activeRoom && (
        <Header
          currentUser={currentUser}
          onOpenWallet={() => setIsWalletOpen(true)}
          onOpenVip={() => setIsVipOpen(true)}
          onOpenProfile={() => setCurrentTab('profile')}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenOnlineUsers={() => setIsOnlineUsersOpen(true)}
          onOpenFriendRequests={() => setIsFriendRequestsOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          pendingFriendRequestsCount={pendingFriendRequests.length}
          onlineUsersCount={globalOnlineUsers.length}
          onOpenRadio={() => setIsRadioModalOpen(true)}
          isRadioPlaying={radioSnap.isPlaying}
          onAvatarChanged={handleAvatarChanged}
          onLogout={handleLogout}
          unreadMessagesBySender={unreadMessagesBySender}
          totalUnreadMessagesCount={totalUnreadMessagesCount}
          onOpenSenderChat={handleOpenIncomingChat}
          onClearAllUnreadMessages={clearAllUnreadMessages}
          onOpenMessagesTab={() => {
            setIsOnlineUsersOpen(false);
            setIsInsidePrivateChat(false);
            setTargetChatUser(null);
            setIsPrivateChatDrawerOpen(true);
          }}
        />
      )}

      {/* Banned Alert Banner */}
      {currentUser.isBanned && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-center text-xs font-black flex flex-wrap items-center justify-center gap-2 shadow-lg sticky top-0 z-50 animate-in slide-in-from-top">
          <span>🚫 حسابك محظور حالياً من قِبل إدارة شات مصر والعرب.</span>
          <button
            onClick={() => setIsAdminOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold border border-white/30 transition-all"
          >
            فتح لوحة الإدارة لفك الحظر
          </button>
        </div>
      )}

      {/* Muted Alert Banner */}
      {currentUser.isMuted && !currentUser.isBanned && (
        <div className="bg-amber-400 text-slate-950 px-4 py-1.5 text-center text-xs font-black flex items-center justify-center gap-2 shadow sticky top-0 z-50">
          <span>🔇 أنت مكتوم حالياً بواسطة الإدارة، يمكنك الاستماع فقط ولا يمكنك إرسال الرسائل.</span>
          <button
            onClick={() => setIsAdminOpen(true)}
            className="px-2 py-0.5 rounded bg-black/15 hover:bg-black/25 text-slate-950 text-[10px] underline font-bold"
          >
            إلغاء الكتم من الإدارة
          </button>
        </div>
      )}

      {/* 2. Main View Routing */}
      <main className={activeRoom ? "w-full h-screen overflow-hidden" : "max-w-7xl mx-auto min-h-[calc(100vh-56px)]"}>
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
            onOpenGiftModal={() => setIsGiftModalOpen(true)}
            onUpdateSpeakers={handleUpdateSpeakers}
            onUpdateRoomBackground={(theme) => handleUpdateRoomBackground(activeRoom.id, theme)}
            onUpdateRoomLock={(locked) => handleUpdateRoomLock(activeRoom.id, locked)}
            onOpenUserProfile={(u) => setSelectedProfileUser(u)}
            onOpenOnlineUsers={() => setIsOnlineUsersOpen(true)}
            onUpdateUser={(updated) => {
              setCurrentUser((prev) => ({ ...prev, ...updated }));
              syncUserProfileToFirebase({ ...currentUser, ...updated });
            }}
            onOpenWallet={() => {
              setIsGiftModalOpen(false);
              setIsWalletOpen(true);
            }}
          />
        ) : (
          <>
            {currentTab === 'rooms' && (
              <RoomsView
                rooms={rooms}
                currentUser={currentUser}
                onlineUsers={globalOnlineUsers}
                onSelectRoom={handleSelectRoom}
                onOpenPrivateChatWith={handleOpenPrivateChatWith}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenVip={() => setIsVipOpen(true)}
                onOpenMissions={() => setIsDailyMissionsOpen(true)}
                totalActiveUsersCount={globalOnlineUsers.length}
                cumulativeVisitorsCount={cumulativeVisitorsCount}
                onOpenOnlineUsers={() => setIsOnlineUsersOpen(true)}
                onClaimSharedRewardCoins={(coins, label) => {
                  const updated = { ...currentUser, coins: currentUser.coins + coins };
                  setCurrentUser(updated);
                  syncUserProfileToFirebase(updated);
                  toast.success(`مبروك! تم استلام +${coins} كوينز من ${label} 🎉`);
                }}
              />
            )}

            {currentTab === 'chat' && (
              <PrivateChatView
                currentUser={currentUser}
                onOpenWallet={() => setIsWalletOpen(true)}
                targetUser={targetChatUser}
                onClearTargetUser={() => {
                  setTargetChatUser(null);
                  setIsInsidePrivateChat(false);
                }}
                globalOnlineUsers={globalOnlineUsers}
                onChatActiveChange={setIsInsidePrivateChat}
                onUpdateUser={(updated) => {
                  setCurrentUser((prev) => ({ ...prev, ...updated }));
                  syncUserProfileToFirebase({ ...currentUser, ...updated });
                }}
                onPromptRegister={() => setIsWelcomeAuthOpen(true)}
                unreadBySender={unreadCountsBySenderId}
                onMarkSenderRead={clearUnreadForSender}
              />
            )}

            {currentTab === 'games' && (
              <GamesView
                currentUser={currentUser}
                onUpdateCoins={(coins) => handleUpdateUserBalance(coins, currentUser.earningsEgp)}
                onOpenWallet={() => setIsWalletOpen(true)}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                onUpdateUser={(updated) => setCurrentUser((prev) => ({ ...prev, ...updated }))}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenVip={() => setIsVipOpen(true)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* 3. Bottom Navigation Bar - Hidden inside active room OR active 1-on-1 private chat */}
      {!activeRoom && !isPrivateChatDrawerOpen && (!isInsidePrivateChat || currentTab !== 'chat') && (
        <BottomNav
          currentTab={isPrivateChatDrawerOpen ? 'chat' : currentTab}
          onTabChange={(tab) => {
            if (tab === 'chat') {
              setIsOnlineUsersOpen(false);
              setIsInsidePrivateChat(false);
              setTargetChatUser(null);
              setIsPrivateChatDrawerOpen(true);
              return;
            }
            setIsPrivateChatDrawerOpen(false);
            setIsInsidePrivateChat(false);
            setTargetChatUser(null);
            setCurrentTab(tab);
          }}
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
        onClose={() => setIsGiftModalOpen(false)}
        currentUser={currentUser}
        speakers={activeRoom?.speakers || []}
        onSendGift={handleSendGift}
        onOpenWallet={() => {
          setIsGiftModalOpen(false);
          setIsWalletOpen(true);
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
          setIsWalletOpen(true);
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
        onOpenWallet={() => setIsWalletOpen(true)}
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
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full sm:max-w-[420px] bg-white sm:border-r border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-drawer-in-left"
          >
            <PrivateChatView
              isDrawer
              onCloseDrawer={() => setIsPrivateChatDrawerOpen(false)}
              currentUser={currentUser}
              onOpenWallet={() => setIsWalletOpen(true)}
              targetUser={targetChatUser}
              onClearTargetUser={() => {
                setTargetChatUser(null);
                setIsInsidePrivateChat(false);
              }}
              globalOnlineUsers={globalOnlineUsers}
              onChatActiveChange={setIsInsidePrivateChat}
              onUpdateUser={(updated) => {
                setCurrentUser((prev) => ({ ...prev, ...updated }));
                syncUserProfileToFirebase({ ...currentUser, ...updated });
              }}
              onPromptRegister={() => {
                setIsPrivateChatDrawerOpen(false);
                setIsWelcomeAuthOpen(true);
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
        onSendGiftToUser={(u) => {
          setSelectedProfileUser(null);
          setIsGiftModalOpen(true);
        }}
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

      {/* Persistent Global Mini FM Radio Bar */}
      {!miniRadioDismissed && !isRadioModalOpen && (radioSnap.isPlaying || radioSnap.autoplayBlocked) && (
        <div
          dir="rtl"
          className={`fixed z-40 left-3 sm:left-5 ${
            activeRoom ? 'bottom-20' : 'bottom-16 sm:bottom-20'
          } max-w-[92vw] sm:max-w-xs bg-white/95 backdrop-blur-md border border-indigo-200 rounded-2xl px-3 py-1.5 shadow-xl flex items-center gap-2`}
        >
          <button
            type="button"
            onClick={() => setIsRadioModalOpen(true)}
            className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0"
            title="فتح مكتبة الأغاني وراديو FM"
          >
            <Radio className={`w-3.5 h-3.5 ${radioSnap.isPlaying ? 'animate-pulse' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsRadioModalOpen(true)}
            className="flex-1 min-w-0 text-right"
          >
            <p className="text-[11px] font-black text-slate-900 truncate">
              {radioSnap.activeTab === 'radio'
                ? radioSnap.activeStation?.name || 'راديو شات مصر FM'
                : radioSnap.activeSong?.title || 'مكتبة الأغاني'}
            </p>
            <p className="text-[9.5px] font-bold text-indigo-600 truncate">
              {radioSnap.isPlaying
                ? 'يبث الآن مباشرة 🎵'
                : 'اضغط لتشغيل راديو FM المباشر ▶️'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => globalRadioPlayer.togglePlay()}
            className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shrink-0"
            title={radioSnap.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          >
            {radioSnap.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => globalRadioPlayer.next()}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 shrink-0"
            title="التالي"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => globalRadioPlayer.toggleMute()}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 shrink-0 cursor-pointer"
            title={radioSnap.isMuted ? 'إلغاء الكتم' : 'كتم'}
          >
            {radioSnap.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setMiniRadioDismissed(true)}
            className="animate-radio-close-glow p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300/90 active:scale-95 shrink-0 cursor-pointer transition-colors"
            title="إغلاق وإخفاء شريط الراديو"
            aria-label="إغلاق وإخفاء شريط الراديو"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            setIsWelcomeAuthOpen(true);
          }}
        />
      )}

      {/* Welcome & Authentication Modal for Google and Guest mode on first entrance */}
      <WelcomeAuthModal
        isOpen={isWelcomeAuthOpen}
        onClose={() => {
          localStorage.setItem('shat_masr_has_entered', 'true');
          setIsWelcomeAuthOpen(false);
          globalRadioPlayer.tryAutoPlayFM();
          requestPushNotificationPermission().catch(() => {});
        }}
        currentUser={currentUser}
        onUserAuthenticated={(u) => {
          localStorage.setItem('shat_masr_has_entered', 'true');
          handleSwitchUser(u);
          setIsWelcomeAuthOpen(false);
          globalRadioPlayer.tryAutoPlayFM();
          requestPushNotificationPermission().catch(() => {});
        }}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" dir="rtl">
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
