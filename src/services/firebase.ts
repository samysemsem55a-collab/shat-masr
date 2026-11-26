import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  enableNetwork,
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc, 
  query, 
  orderBy, 
  limit,
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Firestore,
  increment,
  getDocFromServer,
  deleteDoc,
  where,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage
} from 'firebase/storage';
import { realtimeSocket, PinnedRoomMessage } from './realtimeSocket';
export type { PinnedRoomMessage };
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  push, 
  onDisconnect, 
  update,
  get,
  remove,
  Database,
  query as rtdbQuery,
  limitToLast,
  orderByChild,
  endBefore,
  serverTimestamp as rtdbServerTimestamp
} from 'firebase/database';
import { 
  getAuth, 
  onAuthStateChanged, 
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { Message, User, FriendRequest, Friend, ForumPost, ForumComment, ForumLikeUserSummary, SharedRoomMission, UserReport, StoryItem, StoryComment, BackupSnapshot } from '../types/chat';
import { PRIMARY_OWNER_EMAIL } from '../data/seedData';
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  resolveTimestampMs,
  setServerTimeOffsetMs,
  getServerNowMs
} from '../utils/presenceStatus';
import firebaseConfigJson from '../../firebase-applet-config.json';

// 1. Firebase Configuration from provided user credentials & applet config
export const firebaseConfig = {
  apiKey: (firebaseConfigJson as any).apiKey || "AIzaSyCF7ggMssPflJpnvzF22Ol55BHJbRCIZuY",
  authDomain: (firebaseConfigJson as any).authDomain || "shatmasr-c7e60.firebaseapp.com",
  databaseURL: (firebaseConfigJson as any).databaseURL || "https://shatmasr-c7e60-default-rtdb.firebaseio.com",
  projectId: (firebaseConfigJson as any).projectId || "shatmasr-c7e60",
  storageBucket: (firebaseConfigJson as any).storageBucket || "shatmasr-c7e60.firebasestorage.app",
  messagingSenderId: (firebaseConfigJson as any).messagingSenderId || "586338448855",
  appId: (firebaseConfigJson as any).appId || "1:586338448855:web:e359899b2f92d7aae3c792",
  measurementId: (firebaseConfigJson as any).measurementId || "G-JDPKPDB084",
  firestoreDatabaseId: (firebaseConfigJson as any).firestoreDatabaseId || "ai-studio-arabegyptchat-0f30a306-6748-4873-88b8-0dddc4cb5a41"
};

let app: FirebaseApp;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let isFirebaseAvailable = false;
let currentAuthUid: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn('Firestore Error:', JSON.stringify(errInfo));
}

export const PUBLIC_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DM_MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isMsgExpired(msg: { expiresAt?: number; timestamp?: number; createdAt?: number }, defaultTtlMs: number): boolean {
  const now = getServerNowMs();
  if (typeof msg.expiresAt === 'number' && msg.expiresAt > 0) {
    return msg.expiresAt <= now;
  }
  const base = msg.timestamp || msg.createdAt || now;
  return now - base > defaultTtlMs;
}

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const dbId = firebaseConfig.firestoreDatabaseId;
  try {
    db = initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      },
      dbId || undefined
    );
  } catch {
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
  
  try {
    rtdb = getDatabase(app, firebaseConfig.databaseURL);
    if (rtdb) {
      onValue(ref(rtdb, '.info/serverTimeOffset'), (snap) => {
        const offset = snap.val();
        if (typeof offset === 'number' && Number.isFinite(offset)) {
          setServerTimeOffsetMs(offset);
        }
      });
    }
  } catch (err) {
    console.warn("Realtime Database init notice:", err);
  }

  try {
    storage = getStorage(app);
  } catch (err) {
    console.warn("Firebase Storage init notice:", err);
  }
  
  try {
    auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
      currentAuthUid = user ? user.uid : null;
    });
  } catch (err) {
    console.warn("Firebase Auth init notice:", err);
  }
  isFirebaseAvailable = true;
} catch (e) {
  console.warn("Firebase initialization notice:", e);
}

// Global window exposure for debugging and integrations
if (typeof window !== 'undefined') {
  (window as any).firebaseDB = rtdb;
  (window as any).firebaseAuth = auth;
  (window as any).firebaseFirestore = db;
}

export { db, rtdb, auth, storage, isFirebaseAvailable, currentAuthUid };

let isBrowserMarkedOffline =
  typeof navigator !== 'undefined' ? navigator.onLine === false : false;

if (typeof window !== 'undefined' && db) {
  window.addEventListener('offline', () => {
    isBrowserMarkedOffline = true;
  });
  window.addEventListener('online', () => {
    if (isBrowserMarkedOffline && db) {
      isBrowserMarkedOffline = false;
      enableNetwork(db).catch(() => {});
    }
  });
}

export async function getFreshAuthToken(forceRefresh: boolean = false): Promise<string | null> {
  try {
    if (auth?.currentUser) {
      return await auth.currentUser.getIdToken(forceRefresh);
    }
  } catch (err) {
    console.warn('Auth token refresh notice:', err);
  }
  return null;
}

export async function recoverFirebaseNetwork(): Promise<void> {
  await getFreshAuthToken(true).catch(() => null);
  if (db && isBrowserMarkedOffline && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    isBrowserMarkedOffline = false;
    try {
      await enableNetwork(db);
    } catch {}
  }
}

realtimeSocket.setTokenProvider(getFreshAuthToken);
realtimeSocket.setNetworkRecoveryHandler(recoverFirebaseNetwork);

// Validate connection per SKILL instructions (without disrupting active WatchStream targets)
export async function testConnection() {
  if (!db) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}

export async function checkFirestoreHealth(): Promise<{ ok: boolean; latencyMs: number; projectId: string }> {
  const start = Date.now();
  if (!db) return { ok: false, latencyMs: 0, projectId: firebaseConfig.projectId };
  try {
    await getDocFromServer(doc(db, 'stats', 'visitors'));
    return { ok: true, latencyMs: Math.max(1, Date.now() - start), projectId: firebaseConfig.projectId };
  } catch {
    return { ok: false, latencyMs: Date.now() - start, projectId: firebaseConfig.projectId };
  }
}

// Cross-tab broadcast fallback channel for guaranteed zero-latency sync
const liveChatBus = typeof window !== 'undefined' ? new BroadcastChannel('arab_chat_firestore_bus') : null;

// ==========================================
// 1. REALTIME PRESENCE (Realtime Database .info/connected)
// ==========================================
// ==========================================
// 1. REALTIME PRESENCE (Firebase Realtime Database ONLY: presence/{userId})
// ==========================================
const roomPresenceSelfState = new Map<string, string | null>();
const typingThrottleMap = new Map<string, number>();

type RtdbPresenceListener = (presenceMap: Record<string, any>) => void;
const sharedRtdbPresenceListeners = new Set<RtdbPresenceListener>();
let sharedRtdbPresenceCache: Record<string, any> = {};
let sharedRtdbPresenceUnsub: (() => void) | null = null;
let sharedRtdbPresenceInitialized = false;

export function subscribeSharedRtdbPresence(listener: RtdbPresenceListener): () => void {
  sharedRtdbPresenceListeners.add(listener);
  if (sharedRtdbPresenceInitialized) {
    try {
      listener(sharedRtdbPresenceCache);
    } catch {}
  }

  if (!sharedRtdbPresenceUnsub && rtdb) {
    try {
      sharedRtdbPresenceUnsub = onValue(
        ref(rtdb, 'presence'),
        (snap) => {
          const val = snap.val();
          sharedRtdbPresenceCache = val && typeof val === 'object' ? val : {};
          sharedRtdbPresenceInitialized = true;
          sharedRtdbPresenceListeners.forEach((cb) => {
            try {
              cb(sharedRtdbPresenceCache);
            } catch {}
          });
        },
        (err) => {
          console.warn('RTDB presence listener notice:', err);
        }
      );
    } catch (e) {
      console.warn('RTDB presence setup notice:', e);
    }
  }

  return () => {
    sharedRtdbPresenceListeners.delete(listener);
    if (sharedRtdbPresenceListeners.size === 0 && sharedRtdbPresenceUnsub) {
      sharedRtdbPresenceUnsub();
      sharedRtdbPresenceUnsub = null;
      sharedRtdbPresenceInitialized = false;
      sharedRtdbPresenceCache = {};
    }
  };
}

export function subscribeToRoomPresence(
  roomId: string,
  user: User,
  onCountChange: (count: number, activeUsers: User[]) => void
): () => void {
  const presenceKey = `room_presence_${roomId}`;
  const rtdbUsersMap = new Map<string, User>();
  const fsRoomUsersMap = new Map<string, User>();

  const emitRoomUsers = () => {
    const nowTs = getServerNowMs();
    const combined = new Map<string, User>();
    const ingestMap = (source: Map<string, User>) => {
      source.forEach((u, id) => {
        const seen = resolveTimestampMs(u.lastSeen ?? (u as any).lastSeenMs) || 0;
        if (u && u.id && u.isOnline === true && u.status !== 'offline' && seen > 0 && nowTs - seen <= PRESENCE_OFFLINE_TIMEOUT_MS) {
          const prev = combined.get(id);
          combined.set(id, { ...prev, ...u, isOnline: true, lastSeen: Math.max(prev?.lastSeen || 0, seen) });
        }
      });
    };
    ingestMap(fsRoomUsersMap);
    ingestMap(rtdbUsersMap);

    if (user?.id) {
      combined.set(user.id, { ...combined.get(user.id), ...user, currentRoom: roomId, isOnline: true, lastSeen: nowTs });
    }
    const list = Array.from(combined.values());
    try {
      localStorage.setItem(presenceKey, JSON.stringify(list));
    } catch {}
    onCountChange(Math.max(1, list.length), list);
  };

  if (user?.id) {
    roomPresenceSelfState.set(user.id, roomId);
    const nowTs = getServerNowMs();
    const selfPresenceDoc = {
      userId: user.id,
      id: user.id,
      username: user.name || user.username || 'عضو شات مصر',
      name: user.name || user.username || 'عضو شات مصر',
      avatar: user.avatar || '',
      role: user.role || 'member',
      vipBadge: user.vipBadge || '',
      countryFlag: user.countryFlag || '🇪🇬',
      badges: user.badges || [],
      gender: user.gender || 'male',
      frameStyle: user.frameStyle || '',
      status: user.status === 'offline' ? 'online' : (user.status || 'online'),
      currentRoom: roomId,
      isOnline: true,
      isBanned: Boolean(user.isBanned),
      isMuted: Boolean(user.isMuted),
      lastSeenMs: nowTs,
    };

    if (rtdb && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      update(ref(rtdb, `presence/${user.id}`), {
        ...selfPresenceDoc,
        lastSeen: rtdbServerTimestamp(),
      }).catch(() => {});
    }
    if (db) {
      setDoc(
        doc(db, 'rooms', roomId, 'presence', user.id),
        {
          ...selfPresenceDoc,
          lastSeen: nowTs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
      setDoc(
        doc(db, 'presence', user.id),
        {
          ...selfPresenceDoc,
          lastSeen: nowTs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }
  }

  let unsubFirestoreRoomPresence: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestoreRoomPresence = onSnapshot(
        collection(db, 'rooms', roomId, 'presence'),
        (snap) => {
          const nowTs = getServerNowMs();
          fsRoomUsersMap.clear();
          snap.docs.forEach((d) => {
            const u = d.data() as any;
            if (!u || typeof u !== 'object') return;
            const resolvedId = String(u.userId || u.id || d.id);
            if (u.isOnline !== true || u.status === 'offline') return;
            const seen = resolveTimestampMs(u.lastSeen ?? u.lastSeenMs ?? u.updatedAt) || 0;
            if (resolvedId === user.id || (seen > 0 && nowTs - seen <= PRESENCE_OFFLINE_TIMEOUT_MS)) {
              fsRoomUsersMap.set(resolvedId, {
                ...u,
                id: resolvedId,
                name: u.name || u.username || 'عضو',
                username: u.username || u.name || resolvedId,
                avatar: u.avatar || '',
                currentRoom: roomId,
                isOnline: true,
                lastSeen: seen || nowTs,
              } as User);
            }
          });
          emitRoomUsers();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/presence`);
        }
      );
    } catch {}
  }

  const unsubPresence = subscribeSharedRtdbPresence((data) => {
    const nowTs = getServerNowMs();
    rtdbUsersMap.clear();
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([uid, u]: [string, any]) => {
        if (!u || typeof u !== 'object') return;
        const resolvedId = String(u.userId || u.id || uid);
        if (u.isOnline !== true || u.status === 'offline') return;
        if (u.currentRoom !== roomId) return;
        const seen = resolveTimestampMs(u.lastSeen ?? u.lastSeenMs) || 0;
        if (resolvedId === user.id || (seen > 0 && nowTs - seen <= PRESENCE_OFFLINE_TIMEOUT_MS)) {
          rtdbUsersMap.set(resolvedId, {
            ...u,
            id: resolvedId,
            name: u.username || u.name || 'عضو',
            username: u.username || u.name || resolvedId,
            avatar: u.avatar || '',
            isOnline: true,
            lastSeen: seen || nowTs
          } as User);
        }
      });
    }
    emitRoomUsers();
  });

  const roomHeartbeat = setInterval(() => {
    if (!user?.id || !db || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    const nowTs = getServerNowMs();
    setDoc(
      doc(db, 'rooms', roomId, 'presence', user.id),
      { lastSeen: nowTs, lastSeenMs: nowTs, isOnline: true, currentRoom: roomId, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  }, PRESENCE_HEARTBEAT_MS);

  const freshnessInterval = setInterval(emitRoomUsers, 15000);
  emitRoomUsers();

  return () => {
    clearInterval(roomHeartbeat);
    clearInterval(freshnessInterval);
    if (unsubFirestoreRoomPresence) unsubFirestoreRoomPresence();
    unsubPresence();
    if (user?.id && roomPresenceSelfState.get(user.id) === roomId) {
      roomPresenceSelfState.set(user.id, null);
      if (rtdb) {
        update(ref(rtdb, `presence/${user.id}`), {
          currentRoom: null,
          lastSeen: rtdbServerTimestamp(),
          lastSeenMs: getServerNowMs()
        }).catch(() => {});
      }
      if (db) {
        deleteDoc(doc(db, 'rooms', roomId, 'presence', user.id)).catch(() => {});
        setDoc(
          doc(db, 'presence', user.id),
          { currentRoom: null, lastSeen: getServerNowMs(), lastSeenMs: getServerNowMs(), updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
    }
  };
}

// Global Presence Tracker for all online users across the platform (RTDB + dedicated Firestore `presence` onSnapshot)
const activeSelfPresenceUsers = new Map<string, User>();

export function syncSelfPresenceProfile(user: User): void {
  if (!user || !user.id) return;
  activeSelfPresenceUsers.set(user.id, user);
  const nowTs = getServerNowMs();
  const basePayload = {
    userId: user.id,
    id: user.id,
    username: user.name || user.username || user.id,
    name: user.name || user.username || 'عضو شات مصر',
    avatar: user.avatar || '',
    role: user.role || 'member',
    vipBadge: user.vipBadge || '',
    verified: Boolean(user.verified || user.role === 'owner'),
    badges: user.badges || [],
    frameStyle: user.frameStyle || '',
    profileBanner: user.profileBanner || '',
    countryFlag: user.countryFlag || '🇪🇬',
    gender: user.gender || 'male',
    ...(typeof user.age === 'number' ? { age: user.age } : {}),
    status: user.status === 'offline' ? 'offline' : (user.status || 'online'),
    isBanned: !!user.isBanned,
    isMuted: !!user.isMuted,
    coins: Number(user.coins) || 0,
    ratingPoints: Number(user.ratingPoints) || 0,
    isOnline: user.status !== 'offline',
    lastSeenMs: nowTs,
  };
  if (rtdb && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    update(ref(rtdb, `presence/${user.id}`), {
      ...basePayload,
      lastSeen: rtdbServerTimestamp(),
    }).catch(() => {});
  }
  if (db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    setDoc(
      doc(db, 'presence', user.id),
      {
        ...basePayload,
        lastSeen: nowTs,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }
}

export function subscribeToGlobalPresence(
  user: User,
  onGlobalChange: (users: User[]) => void
): () => void {
  const globalKey = 'arab_chat_global_presence';
  const rtdbUsersMap = new Map<string, User>();
  const fsUsersMap = new Map<string, User>();
  let lastPresenceSignature = '';
  if (user && user.id) {
    activeSelfPresenceUsers.set(user.id, user);
  }

  const getLatestSelf = (): User => {
    if (!user?.id) return user;
    return activeSelfPresenceUsers.get(user.id) || user;
  };

  const emitPresence = () => {
    const nowTs = getServerNowMs();
    const selfUser = getLatestSelf();
    const combined = new Map<string, User>();

    const ingestPresenceMap = (source: Map<string, User>) => {
      source.forEach((u, id) => {
        if (!u || !id) return;
        if (u.status === 'offline' || u.isOnline !== true) return;
        const seen = resolveTimestampMs(u.lastSeen ?? (u as any).lastSeenMs);
        if (id !== selfUser?.id && (typeof seen !== 'number' || nowTs - seen > PRESENCE_OFFLINE_TIMEOUT_MS)) {
          return;
        }
        const existing = combined.get(id);
        combined.set(id, {
          ...existing,
          ...u,
          id,
          isOnline: true,
          lastSeen: Math.max(existing?.lastSeen || 0, seen || nowTs)
        });
      });
    };

    ingestPresenceMap(fsUsersMap);
    ingestPresenceMap(rtdbUsersMap);

    if (selfUser && selfUser.id) {
      if (selfUser.status === 'offline') {
        combined.delete(selfUser.id);
      } else {
        const prevSelf = combined.get(selfUser.id);
        combined.set(selfUser.id, {
          ...prevSelf,
          ...selfUser,
          isOnline: true,
          lastSeen: nowTs
        });
      }
    }

    const list = Array.from(combined.values());
    const sig = list
      .map(
        (u) =>
          `${u.id}:${u.name || ''}:${u.avatar || ''}:${u.status || ''}:${u.role || ''}:${u.vipBadge || ''}:${u.currentRoom || ''}:${u.countryFlag || ''}:${u.coins || 0}:${u.isBanned ? 1 : 0}:${u.isMuted ? 1 : 0}:${u.id === selfUser?.id ? 0 : (Number(u.lastSeen) || 0)}`
      )
      .sort()
      .join('|');
    if (sig === lastPresenceSignature) return;
    lastPresenceSignature = sig;
    try {
      localStorage.setItem(globalKey, JSON.stringify(list));
    } catch {}
    onGlobalChange(list);
  };

  if (user && user.id) {
    rtdbUsersMap.set(user.id, { ...user, isOnline: true, lastSeen: getServerNowMs() });
    emitPresence();
  }

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let freshnessInterval: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;
  let focusOnlineHandler: (() => void) | null = null;
  let unsubConnected: (() => void) | null = null;
  let unsubAll: (() => void) | null = null;
  let unsubFirestorePresence: (() => void) | null = null;

  const buildOnlinePayload = (nowTs: number) => {
    const u = getLatestSelf();
    return {
      userId: u.id,
      id: u.id,
      username: u.name || u.username || u.id,
      name: u.name || u.username || 'عضو شات مصر',
      avatar: u.avatar || '',
      role: u.role || 'member',
      vipBadge: u.vipBadge || '',
      verified: Boolean(u.verified || u.role === 'owner'),
      badges: u.badges || [],
      frameStyle: u.frameStyle || '',
      profileBanner: u.profileBanner || '',
      countryFlag: u.countryFlag || '🇪🇬',
      gender: u.gender || 'male',
      ...(typeof u.age === 'number' ? { age: u.age } : {}),
      sessionId: u.sessionId || '',
      isGuest: !!u.isGuest,
      status: u.status === 'offline' ? 'online' : (u.status || 'online'),
      currentRoom: roomPresenceSelfState.get(u.id) ?? u.currentRoom ?? null,
      isBanned: !!u.isBanned,
      isMuted: !!u.isMuted,
      coins: Number(u.coins) || 0,
      ratingPoints: Number(u.ratingPoints) || 0,
      isOnline: true,
      lastSeenMs: nowTs,
    };
  };

  const sendPresenceHeartbeat = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const selfUser = getLatestSelf();
    if (!selfUser?.id || selfUser.status === 'offline') return;
    const nowTs = getServerNowMs();
    const payload = buildOnlinePayload(nowTs);
    rtdbUsersMap.set(selfUser.id, { ...rtdbUsersMap.get(selfUser.id), ...selfUser, isOnline: true, lastSeen: nowTs });
    if (rtdb) {
      update(ref(rtdb, `presence/${selfUser.id}`), {
        ...payload,
        lastSeen: rtdbServerTimestamp(),
      }).catch(() => {});
    }
    if (db) {
      setDoc(
        doc(db, 'presence', selfUser.id),
        {
          ...payload,
          lastSeen: nowTs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  if (db) {
    try {
      unsubFirestorePresence = onSnapshot(
        collection(db, 'presence'),
        (snap) => {
          const nowTs = getServerNowMs();
          const selfUser = getLatestSelf();
          fsUsersMap.clear();
          snap.docs.forEach((d) => {
            const u = d.data() as any;
            if (!u || typeof u !== 'object') return;
            const resolvedId = String(u.userId || u.id || d.id);
            if (u.isOnline !== true || u.status === 'offline') return;
            const seen = resolveTimestampMs(u.lastSeen ?? u.lastSeenMs ?? u.updatedAt) || 0;
            if (resolvedId === selfUser?.id || (seen > 0 && nowTs - seen <= PRESENCE_OFFLINE_TIMEOUT_MS)) {
              fsUsersMap.set(resolvedId, {
                ...u,
                id: resolvedId,
                name: u.name || u.username || 'عضو شات مصر',
                username: u.username || u.name || resolvedId,
                avatar: u.avatar || '',
                isOnline: true,
                lastSeen: seen || nowTs
              } as User);
            }
          });
          emitPresence();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'presence');
        }
      );
    } catch {}
  }

  if (rtdb && user && user.id) {
    const globalStatusRef = ref(rtdb, `presence/${user.id}`);
    const connectedRef = ref(rtdb, '.info/connected');

    try {
      unsubConnected = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          onDisconnect(globalStatusRef).update({
            isOnline: false,
            status: 'offline',
            currentRoom: null,
            lastSeen: rtdbServerTimestamp()
          }).catch(() => {});
          sendPresenceHeartbeat();
        }
      });

      unsubAll = subscribeSharedRtdbPresence((val) => {
        const nowTs = getServerNowMs();
        const selfUser = getLatestSelf();
        rtdbUsersMap.clear();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([uid, u]: [string, any]) => {
            if (!u || typeof u !== 'object') return;
            const resolvedId = String(u.userId || u.id || uid);
            if (u.isOnline !== true || u.status === 'offline') return;
            const seen = resolveTimestampMs(u.lastSeen ?? u.lastSeenMs) || 0;
            if (resolvedId === selfUser.id || (seen > 0 && nowTs - seen <= PRESENCE_OFFLINE_TIMEOUT_MS)) {
              rtdbUsersMap.set(resolvedId, {
                ...u,
                id: resolvedId,
                name: u.name || u.username || 'عضو شات مصر',
                username: u.username || u.name || resolvedId,
                avatar: u.avatar || '',
                isOnline: true,
                lastSeen: seen || nowTs
              } as User);
            }
          });
        }
        emitPresence();
      });
    } catch (e) {
      console.warn('RTDB global presence init notice:', e);
    }
  }

  if (user && user.id) {
    sendPresenceHeartbeat();
    heartbeatTimer = setInterval(sendPresenceHeartbeat, PRESENCE_HEARTBEAT_MS);
    freshnessInterval = setInterval(emitPresence, 15000);

    focusOnlineHandler = () => sendPresenceHeartbeat();
    visibilityHandler = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        sendPresenceHeartbeat();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', focusOnlineHandler);
      window.addEventListener('online', focusOnlineHandler);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityHandler);
    }
  }

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (freshnessInterval) clearInterval(freshnessInterval);
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
    if (focusOnlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('focus', focusOnlineHandler);
      window.removeEventListener('online', focusOnlineHandler);
    }
    if (unsubConnected) unsubConnected();
    if (unsubAll) unsubAll();
    if (unsubFirestorePresence) unsubFirestorePresence();
    if (user && user.id) {
      if (rtdb) {
        update(ref(rtdb, `presence/${user.id}`), {
          isOnline: false,
          status: 'offline',
          currentRoom: null,
          lastSeen: rtdbServerTimestamp(),
          lastSeenMs: getServerNowMs()
        }).catch(() => {});
      }
      if (db) {
        setDoc(
          doc(db, 'presence', user.id),
          {
            isOnline: false,
            status: 'offline',
            currentRoom: null,
            lastSeen: getServerNowMs(),
            lastSeenMs: getServerNowMs(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        ).catch(() => {});
      }
    }
  };
}

// ==========================================
// 2. REALTIME MESSAGES (Firestore ONLY with serverTimestamp, tempId, & startAfter cursor)
// ==========================================
function pickHigherMessageStatus(
  a?: Message['status'],
  b?: Message['status']
): Message['status'] {
  const rank: Record<string, number> = {
    failed: 0,
    pending_offline: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    seen: 3
  };
  const ra = rank[a || 'sent'] ?? 1;
  const rb = rank[b || 'sent'] ?? 1;
  return rb >= ra ? (b || a || 'delivered') : (a || b || 'delivered');
}

function mergeTwoMessages(prev: Message | undefined, next: Message): Message {
  if (!prev) return next;
  const nextHasReactions = next.reactions && Object.keys(next.reactions).length > 0;
  const prevHasReactions = prev.reactions && Object.keys(prev.reactions).length > 0;
  return {
    ...prev,
    ...next,
    status: pickHigherMessageStatus(prev.status, next.status),
    reactions: nextHasReactions ? next.reactions : (prevHasReactions ? prev.reactions : next.reactions || {}),
    userReactions: nextHasReactions ? next.userReactions : (prevHasReactions ? prev.userReactions : next.userReactions || {}),
    reactionUsers: nextHasReactions ? next.reactionUsers : (prevHasReactions ? prev.reactionUsers : next.reactionUsers || {}),
  };
}

function mapFirestoreRoomMessage(
  roomId: string,
  docSnap: QueryDocumentSnapshot<DocumentData>
): Message {
  const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
  const createdMs =
    resolveTimestampMs(data.createdAt) ??
    resolveTimestampMs(data.timestamp) ??
    Date.now();
  const ts = resolveTimestampMs(data.timestamp) ?? createdMs;
  const msgId = String(data.id || docSnap.id);
  return {
    id: msgId,
    roomId,
    tempId: data.tempId || data.clientId || msgId,
    clientId: data.clientId || data.tempId || msgId,
    senderId: data.userId || data.senderId || 'usr_guest',
    senderName: data.userName || data.senderName || 'عضو شات مصر',
    senderAvatar: data.userAvatar || data.senderAvatar || '',
    senderRole: data.userVipTier || data.senderRole || 'member',
    senderVipBadge: data.userVipBadge || data.senderVipBadge || '',
    badges: Array.isArray(data.badges) ? data.badges : [],
    type: data.type || 'text',
    isPrivate: !!data.isPrivate || data.type === 'private',
    recipientId: data.recipientId || undefined,
    content: data.text || data.content || '',
    text: data.text || data.content || '',
    gift: data.gift || undefined,
    replyTo: data.replyTo || undefined,
    audioDuration: data.audioDuration || undefined,
    audioUrl: data.audioUrl || undefined,
    voiceUrl: data.voiceUrl || undefined,
    mediaUrl: data.mediaUrl || undefined,
    mediaType: data.mediaType || undefined,
    stickerId: data.stickerId || undefined,
    stickerEmoji: data.stickerEmoji || undefined,
    stickerLabel: data.stickerLabel || undefined,
    stickerAnimation: data.stickerAnimation || undefined,
    stickerUrl: data.stickerUrl || undefined,
    reactions: data.reactions || {},
    userReactions: data.userReactions || {},
    reactionUsers: data.reactionUsers || {},
    isHighlighted: Boolean(data.isHighlighted),
    highlightColor: data.highlightColor || undefined,
    expiresAt: data.expiresAt || undefined,
    createdAt: createdMs,
    timestamp: ts,
    status: data.status || 'sent'
  };
}

function readDeletedIdsStorage(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function persistDeletedIdStorage(storageKey: string, id: string, cap = 250): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const existing = Array.from(readDeletedIdsStorage(storageKey)).filter((x) => x !== id);
    existing.push(id);
    localStorage.setItem(storageKey, JSON.stringify(existing.slice(-cap)));
  } catch {}
}

export function subscribeToRoomMessages(
  roomId: string,
  onMessages: (messages: Message[], meta?: { fromFirestore: boolean; fromCache: boolean }) => void,
  initialLimit: number = 30
): () => void {
  const localKey = `messages_room_${roomId}`;
  const deletedStorageKey = `shat_masr_deleted_room_msgs_${roomId}`;
  const deletedIds = readDeletedIdsStorage(deletedStorageKey);
  const fsMsgsMap = new Map<string, Message>();
  const localMsgsMap = new Map<string, Message>();
  const tempIdToRealId = new Map<string, string>();
  const seenFsIds = new Set<string>();

  const emitMerged = (meta: { fromFirestore: boolean; fromCache: boolean } = { fromFirestore: false, fromCache: false }) => {
    const combined = new Map<string, Message>();
    localMsgsMap.forEach((m, id) => {
      if (!m || !id || deletedIds.has(id)) return;
      const mappedRealId = m.tempId ? tempIdToRealId.get(m.tempId) : undefined;
      if (mappedRealId && fsMsgsMap.has(mappedRealId)) return;
      combined.set(id, mergeTwoMessages(combined.get(id), m));
    });
    fsMsgsMap.forEach((m, id) => {
      if (!m || !id || deletedIds.has(id)) return;
      if (m.tempId && combined.has(m.tempId) && m.tempId !== id) {
        combined.delete(m.tempId);
      }
      combined.set(id, mergeTwoMessages(combined.get(id), m));
    });

    const list = Array.from(combined.values())
      .sort((a, b) => (a.createdAt || a.timestamp || 0) - (b.createdAt || b.timestamp || 0));

    try {
      localStorage.setItem(localKey, JSON.stringify(list.slice(-60)));
    } catch {}
    onMessages(list, meta);
  };

  try {
    const saved = localStorage.getItem(localKey);
    const parsed: Message[] = saved ? JSON.parse(saved) : [];
    parsed.forEach((m) => {
      if (m && m.id) {
        localMsgsMap.set(m.id, m);
      }
    });
  } catch {}
  emitMerged();

  let firestoreUnsub: (() => void) | null = null;
  if (db) {
    try {
      const messagesRef = collection(db, 'rooms', roomId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(initialLimit));

      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          const nextIds = new Set<string>();
          fsMsgsMap.clear();

          // Reverse descending server docs so chronological oldest -> newest order
          const orderedDocs = [...snapshot.docs].reverse();
          let oldestServerTs = Infinity;

          orderedDocs.forEach((docSnap) => {
            const msgItem = mapFirestoreRoomMessage(roomId, docSnap);
            if (deletedIds.has(msgItem.id)) return;
            nextIds.add(msgItem.id);
            seenFsIds.add(msgItem.id);
            const itemTs = msgItem.createdAt || msgItem.timestamp || 0;
            if (itemTs > 0 && itemTs < oldestServerTs) oldestServerTs = itemTs;
            if (msgItem.tempId) {
              tempIdToRealId.set(msgItem.tempId, msgItem.id);
              localMsgsMap.delete(msgItem.tempId);
            }
            fsMsgsMap.set(msgItem.id, msgItem);
          });

          if (!snapshot.metadata.fromCache) {
            const nowMs = Date.now();
            Array.from(seenFsIds).forEach((prevId) => {
              if (!nextIds.has(prevId) && snapshot.docs.length < initialLimit) {
                seenFsIds.delete(prevId);
                localMsgsMap.delete(prevId);
              }
            });
            Array.from(localMsgsMap.entries()).forEach(([localId, localMsg]) => {
              if (nextIds.has(localId)) return;
              if (localMsg.status === 'pending_offline' || localMsg.status === 'failed') return;
              const localTs = localMsg.createdAt || localMsg.timestamp || 0;
              const isRecentInFlight = localTs > 0 && nowMs - localTs < 12000;
              if (isRecentInFlight) return;
              if (snapshot.docs.length < initialLimit || localTs >= oldestServerTs) {
                localMsgsMap.delete(localId);
              }
            });
          }

          emitMerged({ fromFirestore: true, fromCache: snapshot.metadata.fromCache });
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/messages`);
        }
      );
    } catch (e) {
      console.warn('Firestore room messages listener error:', e);
    }
  }

  const applyDeletedRoomMsg = (targetId: string) => {
    if (!targetId) return;
    deletedIds.add(targetId);
    persistDeletedIdStorage(deletedStorageKey, targetId);
    localMsgsMap.delete(targetId);
    fsMsgsMap.delete(targetId);
    seenFsIds.delete(targetId);
    emitMerged();
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.roomId !== roomId) return;
    if (e.data?.type === 'REALTIME_NEW_MESSAGE' && e.data.message?.id) {
      if (deletedIds.has(e.data.message.id)) return;
      localMsgsMap.set(e.data.message.id, e.data.message);
      emitMerged();
    } else if (e.data?.type === 'ROOM_MESSAGE_DELETED' && e.data.messageId) {
      applyDeletedRoomMsg(String(e.data.messageId));
    } else if (e.data?.type === 'MESSAGE_REACTION_UPDATE' && e.data.updatedMessage?.id) {
      const m = e.data.updatedMessage;
      if (deletedIds.has(m.id)) return;
      localMsgsMap.set(m.id, m);
      if (fsMsgsMap.has(m.id)) fsMsgsMap.set(m.id, mergeTwoMessages(fsMsgsMap.get(m.id), m));
      emitMerged();
    } else if (e.data?.type === 'ROOM_MESSAGES_READ_UPDATE' && Array.isArray(e.data.messageIds)) {
      const idSet = new Set<string>(e.data.messageIds);
      [localMsgsMap, fsMsgsMap].forEach((source) => {
        source.forEach((m, id) => {
          if (idSet.has(id) && m.status !== 'read' && m.status !== 'seen') {
            source.set(id, { ...m, status: 'seen' });
          }
        });
      });
      emitMerged();
    }
  };

  const handleLocalSync = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.type === 'ROOM_MESSAGE_DELETED' && detail?.roomId === roomId && detail?.messageId) {
      applyDeletedRoomMsg(String(detail.messageId));
    }
  };

  liveChatBus?.addEventListener('message', handleBroadcast);
  if (typeof window !== 'undefined') {
    window.addEventListener('shat_masr_sync_event', handleLocalSync);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    liveChatBus?.removeEventListener('message', handleBroadcast);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shat_masr_sync_event', handleLocalSync);
    }
  };
}

// Send Real Message to Firestore (`rooms/{roomId}/messages`) with serverTimestamp & tempId
export async function sendFirestoreMessage(
  roomId: string,
  message: Partial<Message>
): Promise<Message> {
  const uid = message.senderId || currentAuthUid || 'usr_guest';
  const isPrivateMsg = !!message.isPrivate || message.type === 'private';
  const deviceNow = Date.now();
  const tempId = message.tempId || message.clientId || message.id || `msg_${deviceNow}_${Math.random().toString(36).substring(2, 8)}`;
  const msgId = message.id || tempId;
  const newMsg: Message = {
    id: msgId,
    tempId,
    clientId: tempId,
    roomId,
    senderId: uid,
    senderName: message.senderName || 'عضو شات مصر',
    senderAvatar: message.senderAvatar || '',
    senderRole: message.senderRole || 'member',
    senderVipBadge: message.senderVipBadge || '',
    badges: message.badges || [],
    type: message.type || 'text',
    isPrivate: isPrivateMsg,
    recipientId: message.recipientId,
    content: message.content || message.text || '',
    text: message.content || message.text || '',
    gift: message.gift,
    replyTo: message.replyTo,
    audioDuration: message.audioDuration,
    audioUrl: message.audioUrl,
    voiceUrl: message.voiceUrl,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    stickerId: message.stickerId,
    stickerEmoji: message.stickerEmoji,
    stickerLabel: message.stickerLabel,
    stickerAnimation: message.stickerAnimation,
    reactions: message.reactions || {},
    userReactions: message.userReactions || {},
    reactionUsers: message.reactionUsers || {},
    isHighlighted: message.isHighlighted ? true : undefined,
    highlightColor: message.highlightColor,
    expiresAt: deviceNow + PUBLIC_MESSAGE_TTL_MS,
    createdAt: deviceNow,
    timestamp: deviceNow,
    status: message.status || 'sent'
  };

  // 1. Save to local storage for 0ms optimistic UI
  const localKey = `messages_room_${roomId}`;
  try {
    const saved = localStorage.getItem(localKey);
    const list: Message[] = saved ? JSON.parse(saved) : [];
    if (!list.some((m) => m.id === newMsg.id || (m.tempId && m.tempId === tempId))) {
      list.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(list.slice(-60)));
    }
  } catch {}

  // 2. Broadcast across tabs
  liveChatBus?.postMessage({
    type: 'REALTIME_NEW_MESSAGE',
    roomId,
    message: newMsg
  });

  // 3. Save exclusively to Firestore `rooms/{roomId}/messages/{msgId}`
  if (db) {
    const msgDocRef = doc(db, 'rooms', roomId, 'messages', msgId);
    try {
      await setDoc(
        msgDocRef,
        {
          id: msgId,
          roomId,
          tempId,
          clientId: tempId,
          text: newMsg.content,
          content: newMsg.content,
          userId: uid,
          senderId: uid,
          userName: newMsg.senderName,
          senderName: newMsg.senderName,
          userAvatar: newMsg.senderAvatar,
          senderAvatar: newMsg.senderAvatar,
          userVipTier: newMsg.senderRole,
          senderRole: newMsg.senderRole,
          userVipBadge: newMsg.senderVipBadge,
          senderVipBadge: newMsg.senderVipBadge,
          badges: newMsg.badges || [],
          type: newMsg.type,
          isPrivate: isPrivateMsg,
          recipientId: newMsg.recipientId || null,
          gift: newMsg.gift || null,
          replyTo: newMsg.replyTo || null,
          audioDuration: newMsg.audioDuration || null,
          audioUrl: newMsg.audioUrl || null,
          voiceUrl: newMsg.voiceUrl || null,
          mediaUrl: newMsg.mediaUrl || null,
          mediaType: newMsg.mediaType || null,
          stickerId: newMsg.stickerId || null,
          stickerEmoji: newMsg.stickerEmoji || null,
          stickerLabel: newMsg.stickerLabel || null,
          stickerAnimation: newMsg.stickerAnimation || null,
          stickerUrl: newMsg.stickerUrl || null,
          reactions: newMsg.reactions || {},
          userReactions: newMsg.userReactions || {},
          reactionUsers: newMsg.reactionUsers || {},
          isHighlighted: Boolean(newMsg.isHighlighted),
          highlightColor: newMsg.highlightColor || null,
          expiresAt: newMsg.expiresAt,
          status: 'sent',
          timestamp: newMsg.timestamp,
          createdAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/messages/${msgId}`);
      throw err;
    }

    if (newMsg.type !== 'system_welcome' && newMsg.type !== 'join' && !isPrivateMsg) {
      const previewContent =
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
          : newMsg.content || newMsg.text || '';
      if (previewContent) {
        const lastSummary = {
          senderName: newMsg.senderName || 'عضو شات مصر',
          content: previewContent.slice(0, 120),
          type: newMsg.type,
          timestamp: newMsg.timestamp
        };
        liveChatBus?.postMessage({
          type: 'ROOM_LAST_MESSAGE_UPDATED',
          roomId,
          lastMessage: lastSummary
        });
        setDoc(
          doc(db, 'rooms', roomId),
          {
            roomId,
            lastMessage: lastSummary,
            updatedAt: Date.now()
          },
          { merge: true }
        ).catch(() => {});
      }
    }
  }

  return { ...newMsg, status: 'sent' };
}

// ==========================================
// 3. USER PROFILE & ADMIN MEMBER SYNCHRONIZATION (Firestore ONLY + RTDB presence join)
// ==========================================

export function subscribeToUserProfile(
  userId: string,
  onUpdate: (user: Partial<User>) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;
  if (db && userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      unsubFirestore = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
            onUpdate({
              ...data,
              id: docSnap.id,
              lastSeen: resolveTimestampMs(data.lastSeenMs ?? data.lastSeen),
            } as Partial<User>);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${userId}`);
        }
      );
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'USER_PROFILE_SYNC' && e.data.userId === userId) {
      onUpdate(e.data.user);
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// Sync/Save User Profile in Firestore `users/{user.id}` and RTDB `presence/{user.id}` metadata
export async function syncUserProfileToFirebase(user: User): Promise<void> {
  const nowTs = getServerNowMs();
  const profilePayload = {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    country: user.country,
    countryFlag: user.countryFlag,
    gender: user.gender || 'male',
    ...(typeof user.age === 'number' ? { age: user.age } : {}),
    role: user.role,
    vipBadge: user.vipBadge,
    verified: Boolean(user.verified || user.role === 'owner'),
    zodiacSign: user.zodiacSign || '',
    profileVisitsCount: Number(user.profileVisitsCount) || 0,
    xp: Number(user.xp) || 0,
    level: Number(user.level) || 1,
    dataSaverMode: Boolean(user.dataSaverMode),
    muteJoinNotices: Boolean(user.muteJoinNotices),
    coins: user.coins,
    earningsEgp: user.earningsEgp,
    earningsUsd: user.earningsUsd,
    badges: user.badges || [],
    ratingPoints: user.ratingPoints || 0,
    isBanned: Boolean(user.isBanned),
    bannedUntil: user.bannedUntil ?? null,
    banReason: user.banReason || '',
    isMuted: Boolean(user.isMuted),
    frameStyle: user.frameStyle || '',
    profileBanner: user.profileBanner || '',
    favoriteMusicUrl: user.favoriteMusicUrl || '',
    status: user.status || 'online',
    sessionId: user.sessionId || '',
    isGuest: !!user.isGuest,
    updatedAt: nowTs
  };

  try {
    localStorage.setItem('arab_chat_user', JSON.stringify(user));
  } catch {}
  liveChatBus?.postMessage({
    type: 'USER_PROFILE_SYNC',
    userId: user.id,
    user: profilePayload
  });

  if (rtdb && user.id) {
    update(ref(rtdb, `presence/${user.id}`), {
      userId: user.id,
      username: profilePayload.name || profilePayload.username,
      name: profilePayload.name,
      avatar: profilePayload.avatar,
      role: profilePayload.role,
      vipBadge: profilePayload.vipBadge,
      countryFlag: profilePayload.countryFlag,
      status: profilePayload.status === 'offline' ? 'online' : profilePayload.status,
      gender: profilePayload.gender,
      isOnline: profilePayload.status !== 'offline',
      isBanned: profilePayload.isBanned,
      isMuted: profilePayload.isMuted,
      coins: profilePayload.coins,
      lastSeen: rtdbServerTimestamp(),
      lastSeenMs: nowTs
    }).catch(() => {});
  }

  if (db && user.id) {
    try {
      await setDoc(doc(db, 'users', user.id), profilePayload, { merge: true });
    } catch (e) {
      console.warn('Firestore user profile sync error:', e);
    }
  }
}

export async function updateUserActivityStatus(
  userId: string,
  status: User['status']
): Promise<boolean> {
  if (!userId) return false;
  const normalizedStatus: User['status'] = status || 'online';

  try {
    const raw = localStorage.getItem('arab_chat_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.id || parsed.id === userId) {
        parsed.status = normalizedStatus;
        localStorage.setItem('arab_chat_user', JSON.stringify(parsed));
      }
    }
  } catch {}

  realtimeSocket.updateProfile({ id: userId, status: normalizedStatus });
  liveChatBus?.postMessage({
    type: 'USER_PROFILE_SYNC',
    userId,
    user: { status: normalizedStatus }
  });

  if (db) {
    setDoc(
      doc(db, 'users', userId),
      {
        status: normalizedStatus,
        updatedAt: getServerNowMs()
      },
      { merge: true }
    ).catch(() => {});
  }

  if (rtdb) {
    const nowTs = getServerNowMs();
    update(ref(rtdb, `presence/${userId}`), {
      status: normalizedStatus,
      isOnline: normalizedStatus !== 'offline',
      lastSeen: rtdbServerTimestamp(),
      lastSeenMs: nowTs
    }).catch(() => {});
  }

  return true;
}

// Shared Firestore `users` + RTDB `presence` multiplexer so multiple views share 1 live Watch target
type UsersSnapshotListener = (usersMap: Map<string, User>) => void;
const sharedFsUsersListeners = new Set<UsersSnapshotListener>();
const sharedFsUsersCache = new Map<string, User>();
let sharedFsUsersUnsub: (() => void) | null = null;
let sharedFsUsersHasInitial = false;

function subscribeSharedFirestoreUsers(listener: UsersSnapshotListener): () => void {
  sharedFsUsersListeners.add(listener);
  if (sharedFsUsersHasInitial) {
    try {
      listener(new Map(sharedFsUsersCache));
    } catch {}
  }
  if (!sharedFsUsersUnsub && db) {
    try {
      sharedFsUsersUnsub = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          sharedFsUsersHasInitial = true;
          sharedFsUsersCache.clear();
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
            const lastSeen =
              resolveTimestampMs(data.updatedAt) ??
              resolveTimestampMs(data.lastSeenMs ?? data.lastSeen);
            sharedFsUsersCache.set(docSnap.id, {
              id: docSnap.id,
              name: data.name || 'عضو شات مصر',
              username: data.username || 'user',
              avatar: data.avatar || '',
              countryFlag: data.countryFlag || '🇪🇬',
              country: data.country || 'مصر',
              gender: data.gender || 'male',
              ...(typeof data.age === 'number' ? { age: data.age } : {}),
              role: data.role || 'member',
              vipBadge: data.vipBadge || '',
              coins: Number(data.coins) || 0,
              earningsEgp: Number(data.earningsEgp) || 0,
              badges: Array.isArray(data.badges) ? data.badges : [],
              ratingPoints: Number(data.ratingPoints) || 0,
              giftsReceivedCount: Number(data.giftsReceivedCount) || 0,
              level: Number(data.level) || 1,
              xp: Number(data.xp) || 0,
              verified: Boolean(data.verified || data.role === 'owner'),
              zodiacSign: data.zodiacSign || '',
              profileVisitsCount: Number(data.profileVisitsCount) || 0,
              isBanned: Boolean(data.isBanned),
              bannedUntil: typeof data.bannedUntil === 'number' ? data.bannedUntil : null,
              banReason: data.banReason || '',
              isMuted: Boolean(data.isMuted),
              isGuest: Boolean(data.isGuest),
              frameStyle: data.frameStyle || '',
              profileBanner: data.profileBanner || '',
              favoriteMusicUrl: data.favoriteMusicUrl || '',
              bio: data.bio || '',
              lastSeen,
              status: data.status || 'offline',
              isOnline: false
            } as User);
          });
          sharedFsUsersListeners.forEach((cb) => {
            try {
              cb(new Map(sharedFsUsersCache));
            } catch {}
          });
        },
        (e) => {
          handleFirestoreError(e, OperationType.LIST, 'users');
        }
      );
    } catch {}
  }

  return () => {
    sharedFsUsersListeners.delete(listener);
    if (sharedFsUsersListeners.size === 0 && sharedFsUsersUnsub) {
      sharedFsUsersUnsub();
      sharedFsUsersUnsub = null;
      sharedFsUsersHasInitial = false;
      sharedFsUsersCache.clear();
    }
  };
}

// Subscribe to ALL registered users in real time via shared Firestore `onSnapshot` + RTDB `presence` online join
export function subscribeToAllUsers(
  onUsers: (users: User[]) => void
): () => void {
  let fsUsersMap = new Map<string, User>();
  const rtdbPresenceMap = new Map<string, { isOnline: boolean; lastSeen: number; status?: User['status']; currentRoom?: string | null }>();

  const emit = () => {
    const now = getServerNowMs();
    const result = Array.from(fsUsersMap.values()).map((u) => {
      const p = rtdbPresenceMap.get(u.id);
      const isOnline = Boolean(p && p.isOnline === true && now - p.lastSeen <= PRESENCE_OFFLINE_TIMEOUT_MS);
      return {
        ...u,
        isOnline,
        lastSeen: p?.lastSeen ?? u.lastSeen,
        currentRoom: p?.currentRoom ?? u.currentRoom ?? null,
        status: isOnline ? (p?.status || u.status || 'online') : 'offline'
      } as User;
    });
    onUsers(result);
  };

  const unsubFirestore = subscribeSharedFirestoreUsers((nextMap) => {
    fsUsersMap = nextMap;
    emit();
  });

  const unsubRtdbPresence = subscribeSharedRtdbPresence((val) => {
    const now = getServerNowMs();
    rtdbPresenceMap.clear();
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([uid, entry]: [string, any]) => {
        if (!entry || typeof entry !== 'object') return;
        const resolvedId = String(entry.userId || entry.id || uid);
        const seen = resolveTimestampMs(entry.lastSeen ?? entry.lastSeenMs) || 0;
        if (entry.isOnline === true && entry.status !== 'offline' && seen > 0 && now - seen <= PRESENCE_OFFLINE_TIMEOUT_MS) {
          rtdbPresenceMap.set(resolvedId, {
            isOnline: true,
            lastSeen: seen,
            status: entry.status || 'online',
            currentRoom: entry.currentRoom ?? null
          });
        }
      });
    }
    emit();
  });

  return () => {
    unsubFirestore();
    unsubRtdbPresence();
  };
}

// ==========================================
// 4. ADMIN CONTROL PANEL ACTIONS (Firestore Users + Coins + Role + Ban)
// ==========================================

export async function adminUpdateUser(
  targetUserId: string,
  updates: Partial<User>
): Promise<void> {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );
  const payloadWithTime = {
    ...cleanUpdates,
    updatedAt: getServerNowMs()
  };

  if (db) {
    try {
      await setDoc(doc(db, 'users', targetUserId), payloadWithTime, { merge: true });
    } catch (e) {
      console.warn('Admin update Firestore notice:', e);
    }
  }

  if (rtdb) {
    const rtdbPresencePatch: Record<string, any> = {};
    if (updates.name !== undefined) {
      rtdbPresencePatch.name = updates.name;
      rtdbPresencePatch.username = updates.name;
    }
    if (updates.avatar !== undefined) rtdbPresencePatch.avatar = updates.avatar;
    if (updates.role !== undefined) rtdbPresencePatch.role = updates.role;
    if (updates.vipBadge !== undefined) rtdbPresencePatch.vipBadge = updates.vipBadge;
    if (updates.isBanned !== undefined) rtdbPresencePatch.isBanned = updates.isBanned;
    if (updates.bannedUntil !== undefined) rtdbPresencePatch.bannedUntil = updates.bannedUntil;
    if (updates.banReason !== undefined) rtdbPresencePatch.banReason = updates.banReason;
    if (updates.isMuted !== undefined) rtdbPresencePatch.isMuted = updates.isMuted;
    if (updates.coins !== undefined) rtdbPresencePatch.coins = updates.coins;
    if (updates.countryFlag !== undefined) rtdbPresencePatch.countryFlag = updates.countryFlag;
    if (Object.keys(rtdbPresencePatch).length > 0) {
      update(ref(rtdb, `presence/${targetUserId}`), rtdbPresencePatch).catch(() => {});
    }
  }

  realtimeSocket.sendAdminAction(targetUserId, cleanUpdates);
  liveChatBus?.postMessage({
    type: 'ADMIN_USER_UPDATED',
    userId: targetUserId,
    updates: cleanUpdates
  });
}

export async function adminAdjustUserCoins(
  targetUserId: string,
  amount: number,
  mode: 'add' | 'deduct' | 'set',
  adminName: string = 'الإدارة',
  note: string = ''
): Promise<{ success: boolean; newCoins: number; delta: number }> {
  if (!targetUserId || !Number.isFinite(amount) || amount < 0) {
    return { success: false, newCoins: 0, delta: 0 };
  }
  const cleanAmount = Math.floor(amount);
  let previousCoins = 0;
  let newCoins = 0;

  if (db) {
    const userDocRef = doc(db, 'users', targetUserId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userDocRef);
      previousCoins = snap.exists() ? Number(snap.data()?.coins || 0) : 0;
      if (mode === 'add') {
        newCoins = previousCoins + cleanAmount;
      } else if (mode === 'deduct') {
        newCoins = Math.max(0, previousCoins - cleanAmount);
      } else {
        newCoins = Math.max(0, cleanAmount);
      }
      tx.set(userDocRef, { coins: newCoins, updatedAt: getServerNowMs() }, { merge: true });
    });

    const delta = newCoins - previousCoins;
    const txId = `adm_coins_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const txRecord = {
      id: txId,
      userId: targetUserId,
      type: delta >= 0 ? 'admin_grant' : 'admin_deduct',
      itemName: note || (mode === 'add' ? 'إضافة كوينز من الإدارة' : mode === 'deduct' ? 'خصم كوينز من الإدارة' : 'تعديل رصيد الكوينز من الإدارة'),
      coinsAmount: delta,
      previousBalance: previousCoins,
      newBalance: newCoins,
      amountEgp: 0,
      status: 'approved',
      adminName,
      createdAt: getServerNowMs()
    };
    setDoc(doc(db, 'users', targetUserId, 'transactions', txId), txRecord).catch(() => {});
    setDoc(doc(db, 'transactions', txId), txRecord).catch(() => {});
  }

  if (rtdb) {
    update(ref(rtdb, `presence/${targetUserId}`), { coins: newCoins }).catch(() => {});
  }

  realtimeSocket.sendAdminAction(targetUserId, { coins: newCoins });
  liveChatBus?.postMessage({
    type: 'ADMIN_USER_UPDATED',
    userId: targetUserId,
    updates: { coins: newCoins }
  });

  return { success: true, newCoins, delta: newCoins - previousCoins };
}

// ==========================================
// 5. INSTAPAY & MANUAL PAYMENTS INTEGRATION
// ==========================================

export interface InstaPayPaymentOrder {
  orderId: string;
  referenceId: string;
  amountEgp: number;
  coins: number;
  paymentMethod: 'instapay' | 'vodafone_cash' | 'meeza' | 'card';
  mobileNumber?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: number;
}

export type PaymobPaymentOrder = InstaPayPaymentOrder;

export async function executeInstaPayPayment(
  userId: string,
  currentCoins: number,
  coinsToAdd: number,
  priceEgp: number,
  method: 'instapay' | 'vodafone_cash' | 'meeza' | 'card' = 'instapay',
  mobileNumber?: string
): Promise<{ success: boolean; newCoins: number; order: InstaPayPaymentOrder }> {
  const newCoins = currentCoins + coinsToAdd;
  const orderId = `IPA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const referenceId = `REF-${Math.floor(100000 + Math.random() * 900000)}`;

  const order: InstaPayPaymentOrder = {
    orderId,
    referenceId,
    amountEgp: priceEgp,
    coins: coinsToAdd,
    paymentMethod: method,
    mobileNumber: mobileNumber || 'samyelsayed9@instapay',
    status: 'SUCCESS',
    createdAt: Date.now()
  };

  if (rtdb) {
    try {
      const userCoinsRef = ref(rtdb, `users/${userId}`);
      await update(userCoinsRef, { coins: newCoins });

      // Transaction saved under user's UID path
      const txRef = ref(rtdb, `users/${userId}/transactions/${orderId}`);
      await set(txRef, order);
    } catch (e) {
      console.warn("RTDB write error:", e);
    }
  }

  if (db) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        coins: increment(coinsToAdd)
      });
      const txDocRef = doc(db, 'users', userId, 'transactions', orderId);
      await setDoc(txDocRef, order);
    } catch (e) {
      console.warn("Firestore write error:", e);
    }
  }

  liveChatBus?.postMessage({
    type: 'INSTAPAY_PAYMENT_SUCCESS',
    userId,
    newCoins,
    order
  });

  return { success: true, newCoins, order };
}

export const executePaymobPayment = executeInstaPayPayment;

export interface PendingPaymentOrder {
  id: string;
  userId: string;
  userName?: string;
  senderName?: string;
  amount: number;
  amountEgp?: number;
  note: string;
  type?: 'coins' | 'vip';
  itemName?: string;
  coins?: number;
  vipTierId?: string;
  paymentMethod?: 'instapay' | 'vodafone_cash' | 'orange_cash' | 'etisalat_cash' | 'we_pay' | 'e_wallet' | 'fawry';
  senderAccountOrPhone?: string;
  transactionRef?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export async function submitPaymentRequest(order: {
  userId: string;
  userName: string;
  senderName?: string;
  type: 'coins' | 'vip';
  itemName: string;
  amountEgp: number;
  coinsAmount?: number;
  vipTierId?: string;
  paymentMethod: 'instapay' | 'vodafone_cash' | 'orange_cash' | 'etisalat_cash' | 'we_pay' | 'e_wallet' | 'fawry';
  senderAccountOrPhone: string;
  transactionRef?: string;
  note?: string;
}): Promise<{ success: boolean; orderId: string; duplicate?: boolean }> {
  const normalizedRef = (order.transactionRef || order.senderAccountOrPhone || '').trim();
  if (normalizedRef) {
    // Idempotency guard: block duplicate transaction references
    try {
      const localSaved = localStorage.getItem('arab_chat_payment_orders');
      if (localSaved) {
        const list: PendingPaymentOrder[] = JSON.parse(localSaved);
        if (list.some((o) => o.transactionRef === normalizedRef && o.status !== 'rejected')) {
          return { success: false, orderId: '', duplicate: true };
        }
      }
    } catch {}
    if (db) {
      try {
        const dupSnap = await getDocs(
          query(collection(db, 'payment_requests'), where('transactionRef', '==', normalizedRef), limit(5))
        );
        if (dupSnap.docs.some((d) => d.data()?.status !== 'rejected')) {
          return { success: false, orderId: '', duplicate: true };
        }
      } catch {}
    }
  }

  const orderId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = Date.now();

  const payload: PendingPaymentOrder = {
    id: orderId,
    userId: order.userId,
    userName: order.userName,
    senderName: order.senderName || order.userName,
    amount: order.amountEgp,
    amountEgp: order.amountEgp,
    type: order.type,
    itemName: order.itemName,
    ...(typeof order.coinsAmount === 'number' ? { coins: order.coinsAmount } : {}),
    ...(order.vipTierId ? { vipTierId: order.vipTierId } : {}),
    paymentMethod: order.paymentMethod as any,
    senderAccountOrPhone: order.senderAccountOrPhone,
    transactionRef: normalizedRef || orderId,
    note: order.note || `${order.type === 'coins' ? 'شحن كوينز' : 'ترقية VIP'}: ${order.itemName} بمبلغ ${order.amountEgp} ج.م عبر ${order.paymentMethod}`,
    status: 'pending',
    timestamp: now
  };

  // 1. RTDB pending payments collection
  if (rtdb) {
    try {
      const pendingRef = ref(rtdb, `payments_pending/${orderId}`);
      await set(pendingRef, payload);
    } catch (e) {
      console.warn("RTDB submitPaymentRequest notice:", e);
    }
  }

  // 2. Firestore pending payment requests collection
  if (db) {
    try {
      const orderDocRef = doc(db, 'payment_requests', orderId);
      await setDoc(orderDocRef, {
        ...payload,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Firestore submitPaymentRequest notice:", e);
    }
  }

  // 3. Local cache for user requests
  try {
    const localSaved = localStorage.getItem('arab_chat_payment_orders');
    const list: PendingPaymentOrder[] = localSaved ? JSON.parse(localSaved) : [];
    list.unshift(payload);
    localStorage.setItem('arab_chat_payment_orders', JSON.stringify(list.slice(0, 30)));
  } catch {}

  // 4. Notify admin in real time
  liveChatBus?.postMessage({
    type: 'NEW_PAYMENT_REQUEST',
    order: payload
  });

  return { success: true, orderId };
}

export function openPayment(
  amount: number, 
  note: string, 
  customUserId?: string
): Promise<{ success: boolean; url: string; orderId?: string }> {
  const paymentAddress = "samyelsayed9@instapay";
  const userId = customUserId || (auth?.currentUser?.uid) || ("USR_" + Math.floor(Math.random() * 100000));
  const paymentUrl = `instapay://pay?pa=${paymentAddress}&am=${amount}&cu=EGP&tn=${encodeURIComponent(note)}`;

  if (rtdb) {
    const pendingRef = ref(rtdb, 'payments_pending');
    return push(pendingRef, {
      userId: userId,
      amount: amount,
      note: note,
      status: "pending",
      timestamp: Date.now()
    }).then((pushed) => {
      return { success: true, url: paymentUrl, orderId: pushed.key || undefined };
    }).catch(() => {
      return { success: true, url: paymentUrl };
    });
  } else {
    return Promise.resolve({ success: true, url: paymentUrl });
  }
}

export function subscribeToPendingPayments(
  callback: (orders: PendingPaymentOrder[]) => void
): () => void {
  const ordersMap = new Map<string, PendingPaymentOrder>();

  const emitSorted = () => {
    const list = Array.from(ordersMap.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    callback(list);
  };

  try {
    const raw = localStorage.getItem('arab_chat_payment_orders');
    if (raw) {
      const parsed: PendingPaymentOrder[] = JSON.parse(raw);
      parsed.forEach((o) => {
        if (o && o.id) ordersMap.set(o.id, o);
      });
      if (ordersMap.size > 0) emitSorted();
    }
  } catch {}

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const payCol = collection(db, 'payment_requests');
      unsubFirestore = onSnapshot(
        payCol,
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            ordersMap.set(d.id, {
              id: d.id,
              userId: data.userId || '',
              userName: data.userName || data.senderName || 'عضو شات مصر',
              senderName: data.senderName || data.userName || '',
              amount: Number(data.amount ?? data.amountEgp) || 0,
              amountEgp: Number(data.amountEgp ?? data.amount) || 0,
              note: data.note || '',
              type: data.type,
              itemName: data.itemName,
              coins: typeof data.coins === 'number' ? data.coins : undefined,
              vipTierId: data.vipTierId,
              paymentMethod: data.paymentMethod,
              senderAccountOrPhone: data.senderAccountOrPhone || '',
              transactionRef: data.transactionRef || '',
              status: data.status || 'pending',
              timestamp:
                Number(data.timestamp) ||
                (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now())
            });
          });
          emitSorted();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'payment_requests');
        }
      );
    } catch {}
  }

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const pendingRef = ref(rtdb, 'payments_pending');
      unsubRtdb = onValue(pendingRef, (snap) => {
        const val = snap.val();
        if (val) {
          Object.entries(val).forEach(([key, data]: [string, any]) => {
            const existing = ordersMap.get(key);
            ordersMap.set(key, {
              ...existing,
              id: key,
              ...data
            });
          });
          emitSorted();
        }
      });
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'NEW_PAYMENT_REQUEST' && e.data.order?.id) {
      ordersMap.set(e.data.order.id, e.data.order);
      emitSorted();
    } else if (e.data?.type === 'PAYMENT_APPROVED' && e.data.paymentId) {
      const prev = ordersMap.get(e.data.paymentId);
      if (prev) {
        ordersMap.set(e.data.paymentId, { ...prev, status: 'approved' });
        emitSorted();
      }
    } else if (e.data?.type === 'PAYMENT_REJECTED' && e.data.paymentId) {
      const prev = ordersMap.get(e.data.paymentId);
      if (prev) {
        ordersMap.set(e.data.paymentId, { ...prev, status: 'rejected' });
        emitSorted();
      }
    }
  };
  liveChatBus?.addEventListener('message', handleBus);

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
    liveChatBus?.removeEventListener('message', handleBus);
  };
}

function getVipBadgeForTierId(vipTierId?: string): string {
  if (vipTierId === 'vip_diamond') return 'VIP ماسي 💎';
  if (vipTierId === 'vip_gold') return 'VIP ذهبي 👑';
  if (vipTierId === 'vip_silver') return 'VIP فضي 🥈';
  if (vipTierId === 'vip_bronze') return 'VIP برونزي 🥉';
  return 'VIP';
}

export async function approvePendingPayment(
  paymentId: string,
  userId: string,
  coinsToAdd: number,
  vipTierId?: string
): Promise<void> {
  const now = Date.now();
  const tierBadge = vipTierId ? getVipBadgeForTierId(vipTierId) : undefined;
  let updatedCoinsForSocket: number | undefined = undefined;

  // 1. Update RTDB
  if (rtdb) {
    try {
      const payRef = ref(rtdb, `payments_pending/${paymentId}`);
      await update(payRef, {
        status: 'approved',
        coinsGranted: coinsToAdd,
        vipTierGranted: vipTierId || null,
        approvedAt: now
      });

      const userRef = ref(rtdb, `users/${userId}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const currentData = userSnap.val();
        const currentCoins = currentData.coins || 0;
        const updates: any = {};
        if (coinsToAdd > 0) {
          updates.coins = currentCoins + coinsToAdd;
          updatedCoinsForSocket = updates.coins;
        }
        if (vipTierId && tierBadge) {
          updates.role = vipTierId;
          updates.vipBadge = tierBadge;
        }
        await update(userRef, updates);
      }
    } catch (e) {
      console.warn("Approve payment RTDB error:", e);
    }
  }

  // 2. Update Firestore (Idempotent check before crediting coins)
  if (db) {
    try {
      const payDocRef = doc(db, 'payment_requests', paymentId);
      const existingPaySnap = await getDoc(payDocRef);
      if (existingPaySnap.exists() && existingPaySnap.data()?.status === 'approved') {
        return; // Already processed — prevent double crediting
      }
      await setDoc(payDocRef, {
        status: 'approved',
        coinsGranted: coinsToAdd,
        vipTierGranted: vipTierId || null,
        approvedAt: serverTimestamp()
      }, { merge: true });

      const userDocRef = doc(db, 'users', userId);
      const userUpdates: any = {
        updatedAt: serverTimestamp()
      };
      if (coinsToAdd > 0) {
        userUpdates.coins = increment(coinsToAdd);
      }
      if (vipTierId && tierBadge) {
        userUpdates.role = vipTierId;
        userUpdates.vipBadge = tierBadge;
      }
      await setDoc(userDocRef, userUpdates, { merge: true });
    } catch (e) {
      console.warn("Approve payment Firestore error:", e);
    }
  }

  try {
    const raw = localStorage.getItem('arab_chat_payment_orders');
    if (raw) {
      const parsed: PendingPaymentOrder[] = JSON.parse(raw);
      localStorage.setItem(
        'arab_chat_payment_orders',
        JSON.stringify(parsed.map((o) => (o.id === paymentId ? { ...o, status: 'approved' } : o)))
      );
    }
  } catch {}

  const adminSocketUpdates: Partial<User> = {};
  if (typeof updatedCoinsForSocket === 'number') adminSocketUpdates.coins = updatedCoinsForSocket;
  if (vipTierId && tierBadge) {
    adminSocketUpdates.role = vipTierId as User['role'];
    adminSocketUpdates.vipBadge = tierBadge;
  }
  if (Object.keys(adminSocketUpdates).length > 0) {
    realtimeSocket.sendAdminAction(userId, adminSocketUpdates);
  }

  liveChatBus?.postMessage({
    type: 'PAYMENT_APPROVED',
    userId,
    coinsToAdd,
    vipTierId,
    paymentId
  });
}

export async function rejectPendingPayment(paymentId: string, reason?: string): Promise<void> {
  const now = Date.now();
  if (rtdb) {
    try {
      const payRef = ref(rtdb, `payments_pending/${paymentId}`);
      await update(payRef, {
        status: 'rejected',
        rejectReason: reason || 'لم يتم تأكيد وصول الحوالة',
        rejectedAt: now
      });
    } catch (e) {
      console.warn("Reject payment error:", e);
    }
  }

  if (db) {
    try {
      const payDocRef = doc(db, 'payment_requests', paymentId);
      await setDoc(payDocRef, {
        status: 'rejected',
        rejectReason: reason || 'لم يتم تأكيد وصول الحوالة',
        rejectedAt: serverTimestamp()
      }, { merge: true });
    } catch {}
  }

  liveChatBus?.postMessage({
    type: 'PAYMENT_REJECTED',
    paymentId
  });
}

if (typeof window !== 'undefined') {
  (window as any).openPayment = openPayment;
}

// ==========================================
// 6. FRIEND REQUESTS & BADGES & RATINGS
// ==========================================

const activePendingReqIdsByPair = new Map<string, Set<string>>();

function trackPendingRequestId(senderId: string, receiverId: string, reqId: string) {
  if (!senderId || !receiverId || !reqId) return;
  const pairKey = `${senderId}_${receiverId}`;
  const setForPair = activePendingReqIdsByPair.get(pairKey) || new Set<string>();
  setForPair.add(reqId);
  activePendingReqIdsByPair.set(pairKey, setForPair);
}

export async function sendFriendRequest(
  sender: User,
  receiverId: string
): Promise<boolean> {
  if (!sender?.id || !receiverId || sender.id === receiverId) return false;
  const now = getServerNowMs();
  const reqId = `freq_${sender.id}_${receiverId}`;
  const req: FriendRequest = {
    id: reqId,
    fromId: sender.id,
    fromName: sender.name,
    fromAvatar: sender.avatar,
    toId: receiverId,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    receiverId,
    createdAt: now,
    status: 'pending'
  };

  trackPendingRequestId(sender.id, receiverId, reqId);

  try {
    const key = `friend_requests_${receiverId}`;
    const stored = localStorage.getItem(key);
    const list: FriendRequest[] = stored ? JSON.parse(stored) : [];
    const filtered = list.filter(r => r.senderId !== sender.id && r.fromId !== sender.id && r.id !== reqId);
    filtered.unshift(req);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {}

  realtimeSocket.sendFriendRequest(req);
  liveChatBus?.postMessage({
    type: 'NEW_FRIEND_REQUEST',
    request: req
  });

  if (db) {
    try {
      await setDoc(doc(db, 'friendRequests', reqId), {
        id: reqId,
        fromId: sender.id,
        fromName: sender.name,
        fromAvatar: sender.avatar || '',
        toId: receiverId,
        senderId: sender.id,
        senderName: sender.name,
        senderAvatar: sender.avatar || '',
        receiverId,
        status: 'pending',
        timestamp: now,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `friendRequests/${reqId}`);
      return false;
    }
  }

  return true;
}

export function subscribeToFriendRequests(
  userId: string,
  onRequests: (reqs: FriendRequest[]) => void
): () => void {
  if (!userId) {
    onRequests([]);
    return () => {};
  }
  const localKey = `friend_requests_${userId}`;
  const toIdMap = new Map<string, FriendRequest>();
  const socketMap = new Map<string, FriendRequest>();
  const localSeedMap = new Map<string, FriendRequest>();
  const resolvedIds = new Set<string>();
  let hasServerSnapshot = false;

  const emit = () => {
    const acceptedFriendIds = new Set<string>();
    try {
      const friendsRaw = localStorage.getItem(`user_friends_${userId}`);
      if (friendsRaw) {
        const parsedFriends: Friend[] = JSON.parse(friendsRaw);
        parsedFriends.forEach(f => {
          if (f.id) acceptedFriendIds.add(f.id);
          if (f.friendId) acceptedFriendIds.add(f.friendId);
        });
      }
    } catch {}

    const combinedById = new Map<string, FriendRequest>();
    const sources = hasServerSnapshot
      ? [socketMap, toIdMap]
      : [localSeedMap, socketMap, toIdMap];
    sources.forEach((source) => {
      source.forEach((req, id) => {
        if (resolvedIds.has(id)) return;
        const sId = req?.fromId || req?.senderId;
        if (req && req.status === 'pending' && sId && sId !== userId && !acceptedFriendIds.has(sId)) {
          combinedById.set(id, req);
        }
      });
    });

    const bySender = new Map<string, FriendRequest>();
    combinedById.forEach((req) => {
      const sId = req.fromId || req.senderId;
      const existing = bySender.get(sId);
      if (!existing || (req.createdAt || 0) >= (existing.createdAt || 0)) {
        bySender.set(sId, req);
      }
    });

    const list = Array.from(bySender.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
    onRequests(list);
  };

  try {
    const stored = localStorage.getItem(localKey);
    const parsed: FriendRequest[] = stored ? JSON.parse(stored) : [];
    parsed.forEach((r) => {
      if (r && r.id && r.status === 'pending') localSeedMap.set(r.id, r);
    });
  } catch {}
  emit();

  // Single unified Firestore listener on `friendRequests` where `toId == userId`
  let unsubToId: (() => void) | null = null;

  if (db) {
    try {
      unsubToId = onSnapshot(
        query(collection(db, 'friendRequests'), where('toId', '==', userId)),
        (snap) => {
          hasServerSnapshot = true;
          toIdMap.clear();
          snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
            const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
            const sId = String(data.fromId || data.senderId || '');
            const rId = String(data.toId || data.receiverId || userId);
            if (!sId || sId === userId) return;
            if (data.status === 'pending') {
              resolvedIds.delete(docSnap.id);
              trackPendingRequestId(sId, rId, docSnap.id);
              const createdMs = resolveTimestampMs(data.createdAt ?? data.timestamp) ?? Date.now();
              const sName = data.fromName || data.senderName || 'عضو شات مصر';
              const sAvatar = data.fromAvatar || data.senderAvatar || '';
              toIdMap.set(docSnap.id, {
                id: docSnap.id,
                fromId: sId,
                fromName: sName,
                fromAvatar: sAvatar,
                toId: rId,
                senderId: sId,
                senderName: sName,
                senderAvatar: sAvatar,
                receiverId: rId,
                status: 'pending',
                createdAt: createdMs
              });
            } else {
              resolvedIds.add(docSnap.id);
              socketMap.delete(docSnap.id);
              localSeedMap.delete(docSnap.id);
              toIdMap.delete(docSnap.id);
            }
          });
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
      );
    } catch {}
  }

  // Real-time Socket listener (instant UI feedback)
  const unsubSocket = realtimeSocket.subscribeToFriendRequests((req) => {
    const targetId = req?.toId || req?.receiverId;
    const sId = req?.fromId || req?.senderId;
    if (req && targetId === userId && req.status === 'pending' && sId && sId !== userId) {
      resolvedIds.delete(req.id);
      trackPendingRequestId(sId, targetId, req.id);
      socketMap.set(req.id, {
        ...req,
        fromId: sId,
        toId: targetId,
        senderId: sId,
        receiverId: targetId
      });
      emit();
    }
  });

  const handleMsg = (e: MessageEvent) => {
    const req = e.data?.request;
    const targetId = req?.toId || req?.receiverId;
    if (e.data?.type === 'NEW_FRIEND_REQUEST' && targetId === userId && req?.status === 'pending') {
      resolvedIds.delete(req.id);
      socketMap.set(req.id, req);
      emit();
    } else if (e.data?.type === 'FRIEND_REQUEST_RESOLVED') {
      const reqId = e.data.requestId;
      const resolvedSenderId = e.data.senderId;
      if (reqId) {
        resolvedIds.add(reqId);
        toIdMap.delete(reqId);
        socketMap.delete(reqId);
        localSeedMap.delete(reqId);
      }
      if (resolvedSenderId) {
        [toIdMap, socketMap, localSeedMap].forEach((m) => {
          Array.from(m.entries()).forEach(([key, val]) => {
            if (val.fromId === resolvedSenderId || val.senderId === resolvedSenderId) {
              resolvedIds.add(key);
              m.delete(key);
            }
          });
        });
      }
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleMsg);

  return () => {
    if (unsubToId) unsubToId();
    unsubSocket();
    liveChatBus?.removeEventListener('message', handleMsg);
  };
}

// ==========================================
// FRIENDS MANAGEMENT (Firestore ONLY)
// ==========================================

export async function acceptFriendRequestInDB(
  currentUserId: string,
  friendData: {
    id: string;
    name: string;
    avatar?: string;
    countryFlag?: string;
    role?: string;
    vipBadge?: string;
    bio?: string;
  },
  currentUserData?: Partial<User>,
  requestId?: string
): Promise<void> {
  const now = getServerNowMs();
  const friendId = friendData.id;

  const currentFriendRecord: Friend = {
    id: friendId,
    friendId,
    name: friendData.name,
    avatar: friendData.avatar || '',
    countryFlag: friendData.countryFlag || '🇪🇬',
    role: friendData.role || 'عضو مميز',
    vipBadge: friendData.vipBadge || '',
    bio: friendData.bio || '',
    addedAt: now
  };

  const peerFriendRecord: Friend = {
    id: currentUserId,
    friendId: currentUserId,
    name: currentUserData?.name || 'عضو شات مصر',
    avatar: currentUserData?.avatar || '',
    countryFlag: currentUserData?.countryFlag || '🇪🇬',
    role: currentUserData?.role || 'عضو مميز',
    vipBadge: currentUserData?.vipBadge || '',
    bio: currentUserData?.bio || '',
    addedAt: now
  };

  // 1. Local cache update for zero-lag UI
  try {
    const localKey = `user_friends_${currentUserId}`;
    const raw = localStorage.getItem(localKey);
    const list: Friend[] = raw ? JSON.parse(raw) : [];
    const updated = list.filter(f => (f.friendId || f.id) !== friendId);
    updated.unshift(currentFriendRecord);
    localStorage.setItem(localKey, JSON.stringify(updated));

    const reqKey = `friend_requests_${currentUserId}`;
    const reqRaw = localStorage.getItem(reqKey);
    if (reqRaw) {
      const reqList: FriendRequest[] = JSON.parse(reqRaw);
      const filteredReqs = reqList.filter(
        r => r.senderId !== friendId && r.fromId !== friendId && r.id !== requestId
      );
      localStorage.setItem(reqKey, JSON.stringify(filteredReqs));
    }
  } catch {}

  // 2. Atomic Firestore writeBatch
  if (db) {
    try {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'users', currentUserId, 'friends', friendId),
        { ...currentFriendRecord, timestamp: serverTimestamp() },
        { merge: true }
      );
      batch.set(
        doc(db, 'users', friendId, 'friends', currentUserId),
        { ...peerFriendRecord, timestamp: serverTimestamp() },
        { merge: true }
      );

      const candidateReqIds = new Set<string>([`freq_${friendId}_${currentUserId}`]);
      if (requestId) candidateReqIds.add(requestId);
      const trackedIds = activePendingReqIdsByPair.get(`${friendId}_${currentUserId}`);
      if (trackedIds) trackedIds.forEach((id) => candidateReqIds.add(id));

      candidateReqIds.forEach((id) => {
        batch.set(
          doc(db!, 'friendRequests', id),
          {
            id,
            fromId: friendId,
            toId: currentUserId,
            senderId: friendId,
            receiverId: currentUserId,
            status: 'accepted',
            respondedAt: serverTimestamp()
          },
          { merge: true }
        );
      });

      await batch.commit();
      activePendingReqIdsByPair.delete(`${friendId}_${currentUserId}`);
    } catch (e) {
      console.warn('Firestore friend accept notice:', e);
    }
  }

  liveChatBus?.postMessage({
    type: 'FRIENDS_LIST_UPDATED',
    userId: currentUserId,
    friend: currentFriendRecord
  });
  liveChatBus?.postMessage({
    type: 'FRIEND_REQUEST_RESOLVED',
    requestId: requestId || `freq_${friendId}_${currentUserId}`,
    senderId: friendId
  });
}

export async function declineFriendRequestInDB(
  currentUserId: string,
  requestId: string,
  senderId?: string
): Promise<void> {
  try {
    const key = `friend_requests_${currentUserId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const list: FriendRequest[] = JSON.parse(raw);
      const filtered = list.filter(
        r => r.id !== requestId && r.senderId !== senderId && r.fromId !== senderId
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {}

  if (db) {
    try {
      const batch = writeBatch(db);
      const candidateReqIds = new Set<string>();
      if (requestId) candidateReqIds.add(requestId);
      if (senderId) {
        candidateReqIds.add(`freq_${senderId}_${currentUserId}`);
        const trackedIds = activePendingReqIdsByPair.get(`${senderId}_${currentUserId}`);
        if (trackedIds) trackedIds.forEach((id) => candidateReqIds.add(id));
      }

      candidateReqIds.forEach((id) => {
        batch.set(
          doc(db!, 'friendRequests', id),
          {
            status: 'declined',
            respondedAt: serverTimestamp()
          },
          { merge: true }
        );
      });
      await batch.commit();
      if (senderId) {
        activePendingReqIdsByPair.delete(`${senderId}_${currentUserId}`);
      }
    } catch (e) {
      console.warn('Firestore decline friend request notice:', e);
    }
  }

  if (requestId || senderId) {
    liveChatBus?.postMessage({
      type: 'FRIEND_REQUEST_RESOLVED',
      requestId: requestId || (senderId ? `freq_${senderId}_${currentUserId}` : undefined),
      senderId
    });
  }
}

// ==========================================
// 6.5. COIN TRANSFERS & NOTIFICATION PREFERENCES
// ==========================================

export async function transferCoinsInDB(
  senderId: string,
  recipientId: string,
  amount: number,
  senderName: string,
  recipientName: string
): Promise<{ success: boolean; newSenderBalance?: number; error?: string }> {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { success: false, error: 'يرجى إدخال مبلغ كوينز صحيح أكبر من الصفر.' };
  }
  if (senderId === recipientId) {
    return { success: false, error: 'لا يمكن تحويل الكوينز إلى نفس الحساب.' };
  }

  // Check sender balance from localStorage ('arab_chat_user' first, fallback 'arab_egypt_chat_user')
  let senderBalance = 0;
  try {
    const rawPrimary = localStorage.getItem('arab_chat_user');
    const rawFallback = localStorage.getItem('arab_egypt_chat_user');
    const parsedPrimary = rawPrimary ? JSON.parse(rawPrimary) : null;
    const parsedFallback = rawFallback ? JSON.parse(rawFallback) : null;
    if (parsedPrimary && (!parsedPrimary.id || parsedPrimary.id === senderId)) {
      senderBalance = Number(parsedPrimary.coins || 0);
    } else if (parsedFallback) {
      senderBalance = Number(parsedFallback.coins || 0);
    }
  } catch {}

  if (senderBalance < amount && db) {
    try {
      const snap = await getDoc(doc(db, 'users', senderId));
      if (snap.exists()) {
        const dbCoins = Number(snap.data()?.coins || 0);
        if (dbCoins > senderBalance) senderBalance = dbCoins;
      }
    } catch {}
  }

  if (senderBalance < amount) {
    return { 
      success: false, 
      error: `رصيدك الحالي (${senderBalance.toLocaleString()} كوينز) غير كافٍ لتحويل (${amount.toLocaleString()} كوينز).` 
    };
  }

  const newSenderBalance = senderBalance - amount;

  // 1. Update localStorage on primary key 'arab_chat_user'
  try {
    const raw = localStorage.getItem('arab_chat_user');
    if (raw) {
      const u = JSON.parse(raw);
      u.coins = newSenderBalance;
      localStorage.setItem('arab_chat_user', JSON.stringify(u));
    }
    const rawLegacy = localStorage.getItem('arab_egypt_chat_user');
    if (rawLegacy) {
      const u2 = JSON.parse(rawLegacy);
      u2.coins = newSenderBalance;
      localStorage.setItem('arab_egypt_chat_user', JSON.stringify(u2));
    }
  } catch {}

  // 2. Update Firestore (safe merge in case user doc didn't exist yet)
  if (db) {
    try {
      await setDoc(doc(db, 'users', senderId), {
        id: senderId,
        name: senderName,
        coins: newSenderBalance,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await setDoc(doc(db, 'users', recipientId), {
        id: recipientId,
        name: recipientName,
        coins: increment(amount),
        updatedAt: serverTimestamp()
      }, { merge: true });
      await addDoc(collection(db, 'coin_transfers'), {
        senderId,
        senderName,
        recipientId,
        recipientName,
        amount,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore coin transfer notice:', e);
    }
  }

  // 3. Update RTDB
  if (rtdb) {
    try {
      const senderRef = ref(rtdb, `users/${senderId}/coins`);
      const recipientRef = ref(rtdb, `users/${recipientId}/coins`);
      const snapRecip = await get(recipientRef);
      const curRecipCoins = Number(snapRecip.val() || 0);
      await set(senderRef, newSenderBalance);
      await set(recipientRef, curRecipCoins + amount);

      const transferPush = push(ref(rtdb, 'coin_transfers'));
      await set(transferPush, {
        senderId,
        senderName,
        recipientId,
        recipientName,
        amount,
        createdAt: Date.now()
      });
    } catch (e) {
      console.warn('RTDB coin transfer notice:', e);
    }
  }

  // 4. Socket + Tab Broadcast
  realtimeSocket.updateProfile({ id: senderId, coins: newSenderBalance });
  liveChatBus?.postMessage({
    type: 'USER_PROFILE_SYNC',
    userId: senderId,
    user: { coins: newSenderBalance }
  });
  liveChatBus?.postMessage({
    type: 'COINS_TRANSFERRED',
    senderId,
    recipientId,
    amount,
    senderName,
    recipientName
  });

  return { success: true, newSenderBalance };
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: { directMessages: boolean; gifts: boolean }
): Promise<boolean> {
  try {
    localStorage.setItem(`user_notification_prefs_${userId}`, JSON.stringify(prefs));
  } catch {}

  if (db && userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        notificationPrefs: prefs,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore notification prefs update notice:', e);
    }
  }

  if (rtdb && userId) {
    try {
      await set(ref(rtdb, `users/${userId}/notificationPrefs`), prefs);
    } catch (e) {
      console.warn('RTDB notification prefs update notice:', e);
    }
  }

  return true;
}

export function subscribeToFriendsList(
  currentUserId: string,
  onFriends: (friends: Friend[]) => void
): () => void {
  if (!currentUserId) {
    onFriends([]);
    return () => {};
  }
  const localKey = `user_friends_${currentUserId}`;

  const loadLocal = (): Friend[] => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  let currentFriendsMap: { [id: string]: Friend } = {};
  loadLocal().forEach((f) => {
    const id = f.friendId || f.id;
    if (id) currentFriendsMap[id] = f;
  });

  const rtdbOnlineSet = new Set<string>();
  const onlineStatusMap = new Map<string, User['status']>();
  const lastSeenMap = new Map<string, number>();

  const emitUpdatedFriends = () => {
    const now = getServerNowMs();
    const list = Object.values(currentFriendsMap).map((f) => {
      const fId = f.friendId || f.id;
      const seen = lastSeenMap.get(fId) ?? (f as any).lastSeen ?? 0;
      const isOnline = rtdbOnlineSet.has(fId) && seen > 0 && (now - seen <= PRESENCE_OFFLINE_TIMEOUT_MS);
      return {
        ...f,
        isOnline,
        ...(seen ? { lastSeen: seen } : {}),
        status: isOnline ? (onlineStatusMap.get(fId) || f.status || 'online') : 'offline'
      };
    });
    onFriends(list);
  };

  emitUpdatedFriends();

  let unsubFirestore: (() => void) | null = null;
  let unsubRtdbPresence: (() => void) | null = null;

  // 1. Firestore onSnapshot on users/{currentUserId}/friends (authoritative friend list)
  if (db) {
    try {
      const friendsCol = collection(db, 'users', currentUserId, 'friends');
      unsubFirestore = onSnapshot(
        friendsCol,
        (snapshot) => {
          const nextMap: { [id: string]: Friend } = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const fId = docSnap.id;
            nextMap[fId] = {
              id: fId,
              friendId: fId,
              name: data.name || 'صديق',
              avatar: data.avatar || '',
              countryFlag: data.countryFlag || '🇪🇬',
              role: data.role || 'عضو مميز',
              vipBadge: data.vipBadge || '',
              bio: data.bio || '',
              status: data.status,
              addedAt: data.addedAt || getServerNowMs()
            };
          });
          currentFriendsMap = nextMap;
          try {
            localStorage.setItem(localKey, JSON.stringify(Object.values(currentFriendsMap)));
          } catch {}
          emitUpdatedFriends();
        },
        (err) => {
          console.warn('Firestore friends list onSnapshot notice:', err);
        }
      );
    } catch {}
  }

  // 2. RTDB ONLY presence join via shared listener (60s freshness rule)
  unsubRtdbPresence = subscribeSharedRtdbPresence((val) => {
    const now = getServerNowMs();
    rtdbOnlineSet.clear();
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([uid, uData]: [string, any]) => {
        if (!uData || typeof uData !== 'object') return;
        const seen = resolveTimestampMs(uData.lastSeen ?? uData.lastSeenMs) || 0;
        if (seen) lastSeenMap.set(uid, seen);
        if (uData.isOnline === true && uData.status !== 'offline' && seen > 0 && now - seen <= PRESENCE_OFFLINE_TIMEOUT_MS) {
          rtdbOnlineSet.add(uid);
          onlineStatusMap.set(uid, (uData.status as User['status']) || 'online');
        } else {
          onlineStatusMap.delete(uid);
        }
      });
    }
    emitUpdatedFriends();
  });

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'FRIENDS_LIST_UPDATED') {
      const local = loadLocal();
      const nextMap: { [id: string]: Friend } = {};
      local.forEach((f) => {
        const id = f.friendId || f.id;
        if (id) nextMap[id] = f;
      });
      currentFriendsMap = nextMap;
      emitUpdatedFriends();
    } else if (e.data?.type === 'USER_PROFILE_SYNC' && e.data.userId && e.data.user?.status) {
      onlineStatusMap.set(e.data.userId, e.data.user.status);
      emitUpdatedFriends();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdbPresence) unsubRtdbPresence();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

export async function removeFriendInDB(currentUserId: string, friendId: string): Promise<void> {
  const localKey = `user_friends_${currentUserId}`;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Friend[] = JSON.parse(raw);
      const filtered = list.filter(f => (f.friendId || f.id) !== friendId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  if (db) {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', currentUserId, 'friends', friendId));
      batch.delete(doc(db, 'users', friendId, 'friends', currentUserId));
      await batch.commit();
    } catch {}
  }

  liveChatBus?.postMessage({
    type: 'FRIENDS_LIST_UPDATED',
    userId: currentUserId
  });
}

export async function submitUserRating(
  fromUserId: string,
  toUserId: string,
  points: number
): Promise<number> {
  const userRatingsKey = `user_ratings_${toUserId}`;
  let newTotal = points;
  try {
    const current = Number(localStorage.getItem(userRatingsKey) || '0');
    newTotal = current + points;
    localStorage.setItem(userRatingsKey, newTotal.toString());
  } catch {}

  if (rtdb) {
    try {
      const userRatingRef = ref(rtdb, `users/${toUserId}/ratingPoints`);
      await set(userRatingRef, newTotal);
    } catch {}
  }

  if (db) {
    try {
      const userRef = doc(db, 'users', toUserId);
      await updateDoc(userRef, {
        ratingPoints: increment(points)
      });
    } catch {}
  }

  liveChatBus?.postMessage({
    type: 'USER_RATED',
    toUserId,
    ratingPoints: newTotal
  });

  return newTotal;
}

export async function awardBadgeToUser(
  userId: string,
  badgeTitle: string
): Promise<string[]> {
  const badgesKey = `user_badges_${userId}`;
  let updatedBadges: string[] = [];
  try {
    const existing = localStorage.getItem(badgesKey);
    const list: string[] = existing ? JSON.parse(existing) : [];
    if (!list.includes(badgeTitle)) {
      list.push(badgeTitle);
    }
    updatedBadges = list;
    localStorage.setItem(badgesKey, JSON.stringify(list));
  } catch {}

  if (rtdb) {
    try {
      const userBadgesRef = ref(rtdb, `users/${userId}/badges`);
      await set(userBadgesRef, updatedBadges);
    } catch {}
  }

  if (db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { badges: updatedBadges }, { merge: true });
    } catch {}
  }

  return updatedBadges;
}

// ==========================================
// 7. PRIVATE ROOM JOIN REQUESTS & ACCESS
// ==========================================

export interface RoomJoinRequest {
  userId: string;
  userName: string;
  userAvatar?: string;
  requestedAt: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface OwnerRoomJoinRequest extends RoomJoinRequest {
  id: string;
  roomId: string;
  roomTitle?: string;
  ownerId?: string;
}

export async function sendRoomJoinRequest(
  roomId: string,
  user: User,
  roomMeta?: { roomTitle?: string; ownerId?: string }
): Promise<boolean> {
  const now = Date.now();
  const reqPayload: RoomJoinRequest = {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    requestedAt: now,
    status: 'pending'
  };

  if (rtdb) {
    try {
      const reqRef = ref(rtdb, `room_join_requests/${roomId}/${user.id}`);
      await set(reqRef, reqPayload);
    } catch (e) {
      console.warn("RTDB join request write notice:", e);
    }
  }

  if (db) {
    try {
      let resolvedOwnerId = roomMeta?.ownerId || '';
      let resolvedRoomTitle = roomMeta?.roomTitle || '';
      if (!resolvedOwnerId) {
        const roomSnap = await getDoc(doc(db, 'rooms', roomId)).catch(() => null);
        if (roomSnap?.exists()) {
          const rData = roomSnap.data() as any;
          resolvedOwnerId = String(rData?.ownerId || rData?.hostId || '');
          if (!resolvedRoomTitle && rData?.title) resolvedRoomTitle = String(rData.title);
        }
      }
      if (resolvedOwnerId && resolvedOwnerId !== user.id) {
        const fsReqId = `${roomId}_${user.id}`;
        await setDoc(
          doc(db, 'users', resolvedOwnerId, 'room_join_requests', fsReqId),
          {
            id: fsReqId,
            roomId,
            roomTitle: resolvedRoomTitle || 'غرفتك',
            ownerId: resolvedOwnerId,
            userId: user.id,
            userName: user.name || 'عضو شات مصر',
            userAvatar: user.avatar || '',
            requestedAt: now,
            status: 'pending',
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `room_join_requests/${roomId}`);
    }
  }

  liveChatBus?.postMessage({
    type: 'ROOM_JOIN_REQUEST',
    roomId,
    request: reqPayload
  });

  return true;
}

export function subscribeToRoomJoinRequests(
  roomId: string,
  onRequests: (reqs: RoomJoinRequest[]) => void
): () => void {
  if (rtdb) {
    try {
      const requestsRef = ref(rtdb, `room_join_requests/${roomId}`);
      const unsub = onValue(requestsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list: RoomJoinRequest[] = Object.values(val);
          onRequests(list.filter(r => r.status === 'pending'));
        } else {
          onRequests([]);
        }
      });
      return unsub;
    } catch {}
  }
  return () => {};
}

export async function resolveRoomJoinRequest(
  roomId: string,
  userId: string,
  status: 'accepted' | 'rejected',
  meta?: { ownerId?: string; roomTitle?: string; approverUser?: User }
): Promise<void> {
  if (rtdb) {
    try {
      const reqRef = ref(rtdb, `room_join_requests/${roomId}/${userId}`);
      if (status === 'accepted') {
        await update(reqRef, { status: 'accepted' });
        const allowedRef = ref(rtdb, `rooms_allowed/${roomId}/${userId}`);
        await set(allowedRef, true);
      } else {
        await set(reqRef, null);
      }
    } catch (e) {
      console.warn("RTDB resolve request notice:", e);
    }
  }

  if (db) {
    try {
      if (meta?.ownerId) {
        const fsReqId = `${roomId}_${userId}`;
        await setDoc(
          doc(db, 'users', meta.ownerId, 'room_join_requests', fsReqId),
          { status, resolvedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }
      if (status === 'accepted') {
        await setDoc(
          doc(db, 'rooms', roomId),
          { allowedUserIds: arrayUnion(userId) },
          { merge: true }
        ).catch(() => {});
        if (meta?.approverUser?.id) {
          await sendRoomInvitation({
            roomId,
            roomTitle: meta.roomTitle || 'الغرفة',
            isPrivate: true,
            fromUser: meta.approverUser,
            targetUserId: userId,
          }).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resolve_room_join_request/${roomId}/${userId}`);
    }
  }

  liveChatBus?.postMessage({
    type: 'ROOM_JOIN_RESOLVED',
    roomId,
    userId,
    status
  });
}

// ==========================================
// 8. FIREBASE PHONE AUTHENTICATION & OTP
// ==========================================

let phoneRecaptchaVerifier: RecaptchaVerifier | null = null;
let activeConfirmationResult: ConfirmationResult | null = null;

export function setupPhoneRecaptcha(containerId: string = 'recaptcha-container'): RecaptchaVerifier | null {
  if (!auth || typeof window === 'undefined') return null;
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`reCAPTCHA container #${containerId} not found in DOM`);
      return null;
    }
    
    // Clear any previous verifier
    if (phoneRecaptchaVerifier) {
      try {
        phoneRecaptchaVerifier.clear();
      } catch (e) {
        // ignore
      }
      phoneRecaptchaVerifier = null;
    }

    phoneRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA expired');
      }
    });

    return phoneRecaptchaVerifier;
  } catch (err) {
    console.warn('Error setting up RecaptchaVerifier:', err);
    return null;
  }
}

export async function sendFirebasePhoneOtp(
  phoneNumber: string, 
  containerId: string = 'recaptcha-container'
): Promise<{ success: boolean; error?: string }> {
  if (!auth) {
    return { success: false, error: 'خدمة Firebase Auth غير متاحة حالياً.' };
  }

  try {
    let verifier = phoneRecaptchaVerifier;
    if (!verifier) {
      verifier = setupPhoneRecaptcha(containerId);
    }
    if (!verifier) {
      return { success: false, error: 'تعذر تهيئة اختبار الأمان reCAPTCHA في المتصفح.' };
    }

    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    activeConfirmationResult = confirmationResult;
    return { success: true };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    // Reset recaptcha on error so user can retry
    if (phoneRecaptchaVerifier) {
      try {
        phoneRecaptchaVerifier.clear();
      } catch (e) {}
      phoneRecaptchaVerifier = null;
    }
    let msg = 'فشل إرسال رمز التحقق. تأكد من تفعيل مزود Phone في Firebase Console وصحة رقم الهاتف بالصيغة الدولية.';
    if (error?.code === 'auth/invalid-phone-number') {
      msg = 'رقم الهاتف غير صالح. يرجى كتابة الرقم بالصيغة الدولية مع رمز الدولة (مثال: 201012345678+).';
    } else if (error?.code === 'auth/quota-exceeded' || error?.code === 'auth/too-many-requests') {
      msg = 'تم تجاوز الحد الأقصى لرسائل SMS اليومية. يمكنك استخدام أرقام الاختبار في Firebase Console أو المحاولة لاحقاً.';
    } else if (error?.code === 'auth/operation-not-allowed') {
      msg = 'تسجيل الدخول بالهاتف غير مفعّل في Firebase Console. يرجى تفعيله من Authentication > Sign-in method > Phone.';
    } else if (error?.message) {
      msg = error.message;
    }
    return { success: false, error: msg };
  }
}

export async function verifyFirebasePhoneOtp(
  otpCode: string,
  currentUser: User
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!activeConfirmationResult) {
    return { success: false, error: 'لا يوجد طلب تحقق نشط حالياً. يرجى إرسال الرمز أولاً.' };
  }

  try {
    const userCredential = await activeConfirmationResult.confirm(otpCode);
    const firebaseUser = userCredential.user;
    const phone = firebaseUser.phoneNumber || currentUser.phoneNumber || '';
    const newUid = firebaseUser.uid;

    const cleanedBadges = (currentUser.badges || []).filter((b) => !b.includes('زائر'));
    const nextRole = currentUser.role === 'guest' ? 'member' : currentUser.role;
    const nextVipBadge =
      currentUser.vipBadge && currentUser.vipBadge.includes('زائر')
        ? 'عضو موثق 📱'
        : currentUser.vipBadge;

    const updatedUser: User = {
      ...currentUser,
      id: newUid,
      phoneNumber: phone,
      isPhoneVerified: true,
      isGuest: false,
      role: nextRole,
      vipBadge: nextVipBadge,
      badges: Array.from(new Set([...cleanedBadges, 'حساب موثق 📱']))
    };

    // Sync to Firestore & Realtime DB
    await syncUserProfileToFirebase(updatedUser);

    // Save locally for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('arab_chat_userId', newUid);
      localStorage.setItem('arab_chat_user', JSON.stringify(updatedUser));
    }

    return { success: true, user: updatedUser };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    let msg = 'رمز التحقق (OTP) غير صحيح أو انتهت صلاحيته.';
    if (error?.code === 'auth/invalid-verification-code') {
      msg = 'رمز التحقق الذي أدخلته غير صحيح. تأكد من الأرقام الستة وحاول مجدداً.';
    } else if (error?.code === 'auth/code-expired') {
      msg = 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.';
    }
    return { success: false, error: msg };
  }
}

// 12. Google Authentication via Firebase Auth
export async function signInWithGoogle(
  currentUser: User
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!auth) {
    return { success: false, error: 'خدمة Firebase Auth غير متاحة حالياً.' };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;
    const email = (firebaseUser.email || '').toLowerCase().trim();
    const newUid = firebaseUser.uid;
    const isOwner = email === 'samielsayed555@gmail.com';
    const cleanedBadges = (currentUser.badges || []).filter((b) => !b.includes('زائر'));
    const nextRole = isOwner
      ? 'owner'
      : currentUser.role === 'owner' || currentUser.role === 'guest'
      ? 'member'
      : currentUser.role;
    const nextVipBadge = isOwner
      ? 'مالك المنصة والإدارة العليا 👑'
      : currentUser.vipBadge && currentUser.vipBadge.includes('زائر')
      ? 'عضو مسجل 🌐'
      : currentUser.vipBadge;

    const updatedUser: User = {
      ...currentUser,
      id: newUid,
      email: email,
      name: firebaseUser.displayName || currentUser.name,
      avatar: firebaseUser.photoURL || currentUser.avatar,
      isEmailVerified: firebaseUser.emailVerified || true,
      isGuest: false,
      role: nextRole,
      vipBadge: nextVipBadge,
      badges: Array.from(new Set([...cleanedBadges, 'حساب Google موثق 🌐', ...(isOwner ? ['الإدارة العليا ⭐'] : [])]))
    };

    if (isOwner) {
      localStorage.setItem('arab_chat_auth_email', email);
    }
    localStorage.setItem('arab_chat_userId', newUid);
    localStorage.setItem('arab_chat_user', JSON.stringify(updatedUser));

    await syncUserProfileToFirebase(updatedUser);

    return { success: true, user: updatedUser };
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    let msg = 'تعذر تسجيل الدخول بحساب Google.';
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      msg = 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    } else if (error?.code === 'auth/popup-blocked') {
      msg = 'قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.';
    } else if (error?.code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      msg = `نطاق الموقع الحالي (${host}) غير مصرح به في إعدادات Firebase Authentication.`;
    } else if (error?.code === 'auth/operation-not-allowed') {
      msg = 'تسجيل الدخول بحساب Google غير مفعل حالياً في إعدادات Firebase.';
    } else if (error?.code === 'auth/network-request-failed') {
      msg = 'تعذر الاتصال بخوادم Google. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
    } else if (error?.message) {
      msg = error.message;
    }
    return { success: false, error: msg };
  }
}

// 13. Sign out user session
export async function logOutUser(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
}

// ==========================================
// 14. DIRECT MESSAGING (Unified `privateChats/{chatId}/messages`)
// ==========================================
export function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

function mapFirestoreDirectMessage(
  docSnap: QueryDocumentSnapshot<DocumentData>
): Message {
  const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
  const createdMs =
    resolveTimestampMs(data.createdAt) ??
    resolveTimestampMs(data.timestamp) ??
    Date.now();
  const ts = resolveTimestampMs(data.timestamp) ?? createdMs;
  const msgId = String(data.id || docSnap.id);
  return {
    id: msgId,
    tempId: data.tempId || data.clientId || msgId,
    clientId: data.clientId || data.tempId || msgId,
    senderId: data.senderId || data.userId || '',
    senderName: data.senderName || data.userName || 'عضو شات مصر',
    senderAvatar: data.senderAvatar || data.userAvatar || '',
    senderRole: data.senderRole || 'member',
    senderVipBadge: data.senderVipBadge || '',
    badges: Array.isArray(data.badges) ? data.badges : [],
    type: data.type || 'private',
    isPrivate: true,
    recipientId: data.recipientId || undefined,
    content: data.text || data.content || '',
    text: data.text || data.content || '',
    audioDuration: data.audioDuration || undefined,
    audioUrl: data.audioUrl || undefined,
    voiceUrl: data.voiceUrl || undefined,
    mediaUrl: data.mediaUrl || undefined,
    mediaType: data.mediaType || undefined,
    stickerId: data.stickerId || undefined,
    stickerEmoji: data.stickerEmoji || undefined,
    stickerLabel: data.stickerLabel || undefined,
    stickerAnimation: data.stickerAnimation || undefined,
    stickerUrl: data.stickerUrl || undefined,
    gift: data.gift || undefined,
    replyTo: data.replyTo || undefined,
    reactions: data.reactions || {},
    userReactions: data.userReactions || {},
    reactionUsers: data.reactionUsers || {},
    expiresAt: data.expiresAt || undefined,
    createdAt: createdMs,
    timestamp: ts,
    status: data.status || 'sent'
  };
}

export function subscribeToDirectMessages(
  userId1: string,
  userId2: string,
  onMessages: (messages: Message[], meta?: { fromFirestore: boolean; fromCache: boolean }) => void,
  initialLimit: number = 30
): () => void {
  if (!userId1 || !userId2) {
    onMessages([], { fromFirestore: false, fromCache: false });
    return () => {};
  }
  const convId = getConversationId(userId1, userId2);
  const localKey = `direct_messages_${convId}`;
  const deletedStorageKey = `shat_masr_deleted_dm_msgs_${convId}`;
  const localMsgsMap = new Map<string, Message>();
  const wsMsgsMap = new Map<string, Message>();
  const fsMsgsMap = new Map<string, Message>();
  const tempIdToRealId = new Map<string, string>();
  const deletedIds = readDeletedIdsStorage(deletedStorageKey);
  let seenFsIds = new Set<string>();

  const emit = (meta: { fromFirestore: boolean; fromCache: boolean } = { fromFirestore: false, fromCache: false }) => {
    const merged = new Map<string, Message>();
    [localMsgsMap, wsMsgsMap].forEach((sourceMap) => {
      sourceMap.forEach((m, id) => {
        if (!m || !id || deletedIds.has(id)) return;
        const mappedRealId = m.tempId ? tempIdToRealId.get(m.tempId) : undefined;
        if (mappedRealId && fsMsgsMap.has(mappedRealId)) return;
        merged.set(id, mergeTwoMessages(merged.get(id), m));
      });
    });
    fsMsgsMap.forEach((m, id) => {
      if (!m || !id || deletedIds.has(id)) return;
      if (m.tempId && merged.has(m.tempId) && m.tempId !== id) {
        merged.delete(m.tempId);
      }
      merged.set(id, mergeTwoMessages(merged.get(id), m));
    });

    const list = Array.from(merged.values()).sort(
      (a, b) => (a.createdAt || a.timestamp || 0) - (b.createdAt || b.timestamp || 0)
    );
    try {
      localStorage.setItem(localKey, JSON.stringify(list.slice(-60)));
    } catch {}
    onMessages(list, meta);
  };

  try {
    const data = localStorage.getItem(localKey);
    const parsed: Message[] = data ? JSON.parse(data) : [];
    parsed.forEach((m) => {
      if (m && m.id) localMsgsMap.set(m.id, m);
    });
  } catch {}
  emit();

  // Single real-time Firestore onSnapshot on `privateChats/{convId}/messages`
  let firestoreUnsub: (() => void) | null = null;
  if (db) {
    try {
      const msgsCol = collection(db, 'privateChats', convId, 'messages');
      const dmQuery = query(msgsCol, orderBy('createdAt', 'desc'), limit(initialLimit));
      firestoreUnsub = onSnapshot(
        dmQuery,
        (snapshot) => {
          const nextFsIds = new Set<string>();
          fsMsgsMap.clear();

          const orderedDocs = [...snapshot.docs].reverse();
          let oldestServerTs = Infinity;

          orderedDocs.forEach((docSnap) => {
            const msgItem = mapFirestoreDirectMessage(docSnap);
            if (deletedIds.has(msgItem.id)) return;
            nextFsIds.add(msgItem.id);
            const itemTs = msgItem.createdAt || msgItem.timestamp || 0;
            if (itemTs > 0 && itemTs < oldestServerTs) oldestServerTs = itemTs;
            if (msgItem.tempId) {
              tempIdToRealId.set(msgItem.tempId, msgItem.id);
              localMsgsMap.delete(msgItem.tempId);
              wsMsgsMap.delete(msgItem.tempId);
            }
            if (msgItem.senderId !== userId1 && msgItem.status === 'sent') {
              acknowledgePrivateMessageDelivered(convId, msgItem.id).catch(() => {});
            }
            fsMsgsMap.set(msgItem.id, msgItem);
          });

          if (!snapshot.metadata.fromCache) {
            const nowMs = Date.now();
            seenFsIds.forEach((oldId) => {
              if (!nextFsIds.has(oldId) && snapshot.docs.length < initialLimit) {
                localMsgsMap.delete(oldId);
                wsMsgsMap.delete(oldId);
              }
            });
            Array.from(localMsgsMap.entries()).forEach(([localId, localMsg]) => {
              if (nextFsIds.has(localId)) return;
              if (localMsg.status === 'pending_offline' || localMsg.status === 'failed') return;
              const localTs = localMsg.createdAt || localMsg.timestamp || 0;
              if (localTs > 0 && nowMs - localTs < 12000) return;
              if (snapshot.docs.length < initialLimit || localTs >= oldestServerTs) {
                localMsgsMap.delete(localId);
                wsMsgsMap.delete(localId);
              }
            });
            seenFsIds = nextFsIds;
          }
          emit({ fromFirestore: true, fromCache: snapshot.metadata.fromCache });
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, `privateChats/${convId}/messages`);
        }
      );
    } catch (e) {
      console.warn('Firestore DM onSnapshot init notice:', e);
    }
  }

  // 2. WebSocket instant incoming DM sync (covers open chat immediately)
  const ingestSocketDm = (incoming: Message, msgConvId?: string) => {
    if (!incoming || !incoming.id || deletedIds.has(incoming.id)) return;
    const isDirectPairMatch =
      msgConvId === convId ||
      (incoming.senderId === userId2 && (incoming.recipientId === userId1 || !incoming.recipientId)) ||
      (incoming.senderId === userId1 && incoming.recipientId === userId2);
    if (!isDirectPairMatch) return;
    const normalized: Message = {
      ...incoming,
      isPrivate: true,
      content: incoming.content || incoming.text || '',
      text: incoming.text || incoming.content || '',
      createdAt: incoming.createdAt || incoming.timestamp || Date.now(),
      timestamp: incoming.timestamp || incoming.createdAt || Date.now(),
      status: incoming.status || 'delivered'
    };
    wsMsgsMap.set(normalized.id, mergeTwoMessages(wsMsgsMap.get(normalized.id), normalized));
    emit();
  };

  const unsubConvSocket = realtimeSocket.subscribeToDirectMessages(convId, (msg, cId) => {
    ingestSocketDm(msg, cId);
  });
  const unsubGlobalDmSocket = realtimeSocket.subscribeToGlobalDirectMessages((msg, cId) => {
    ingestSocketDm(msg, cId);
  });

  // 3. WebSocket instant DM read receipt sync
  const unsubReadSocket = realtimeSocket.subscribeToDirectMessagesRead(convId, (messageIds) => {
    let changed = false;
    messageIds.forEach((id) => {
      [localMsgsMap, wsMsgsMap, fsMsgsMap].forEach((map) => {
        const existing = map.get(id);
        if (existing && existing.status !== 'seen' && existing.status !== 'read') {
          map.set(id, { ...existing, status: 'seen' });
          changed = true;
        }
      });
    });
    if (changed) emit();
  });

  // 4. Cross-tab & Same-tab broadcast
  const applyDeletedDm = (targetId: string) => {
    if (!targetId) return;
    deletedIds.add(targetId);
    persistDeletedIdStorage(deletedStorageKey, targetId);
    localMsgsMap.delete(targetId);
    wsMsgsMap.delete(targetId);
    fsMsgsMap.delete(targetId);
    emit();
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (
      (e.data?.type === 'DIRECT_MESSAGE_UPDATE' ||
        e.data?.type === 'DIRECT_MESSAGE_DELETED' ||
        e.data?.type === 'DIRECT_MESSAGE_READ_UPDATE') &&
      e.data.convId === convId
    ) {
      if (e.data?.type === 'DIRECT_MESSAGE_DELETED' && e.data.messageId) {
        applyDeletedDm(String(e.data.messageId));
        return;
      } else if (e.data.message?.id) {
        if (deletedIds.has(e.data.message.id)) return;
        localMsgsMap.set(e.data.message.id, e.data.message);
      } else if (e.data.type === 'DIRECT_MESSAGE_READ_UPDATE' && Array.isArray(e.data.messageIds)) {
        e.data.messageIds.forEach((id: string) => {
          [localMsgsMap, wsMsgsMap, fsMsgsMap].forEach((map) => {
            const existing = map.get(id);
            if (existing) map.set(id, { ...existing, status: 'seen' });
          });
        });
      }
      emit();
    }
  };
  const handleLocalSync = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.type === 'DIRECT_MESSAGE_DELETED' && detail?.convId === convId && detail?.messageId) {
      applyDeletedDm(String(detail.messageId));
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);
  if (typeof window !== 'undefined') {
    window.addEventListener('shat_masr_sync_event', handleLocalSync);
  }

  return () => {
    unsubConvSocket();
    unsubGlobalDmSocket();
    unsubReadSocket();
    if (firestoreUnsub) firestoreUnsub();
    liveChatBus?.removeEventListener('message', handleBroadcast);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shat_masr_sync_event', handleLocalSync);
    }
  };
}

export async function resetDirectChatUnreadInDB(
  currentUserId: string,
  peerId: string
): Promise<void> {
  if (!currentUserId || !peerId) return;
  const convId = getConversationId(currentUserId, peerId);

  try {
    const recentKey = `recent_direct_chats_${currentUserId}`;
    const raw = localStorage.getItem(recentKey);
    if (raw) {
      const list: any[] = JSON.parse(raw);
      const updated = list.map((c) => (c.chatId === convId || c.peerId === peerId ? { ...c, unreadCount: 0 } : c));
      localStorage.setItem(recentKey, JSON.stringify(updated));
    }
  } catch {}

  if (db) {
    updateDoc(doc(db, 'privateChats', convId), { [`unread_${currentUserId}`]: 0 }).catch(() => {});
  }

  liveChatBus?.postMessage({
    type: 'DIRECT_CHATS_UPDATED',
    convId
  });
}

export async function resetAllDirectChatsUnreadInDB(
  currentUserId: string,
  knownChatIds?: string[]
): Promise<void> {
  if (!currentUserId) return;
  const chatIdsToReset = new Set<string>(knownChatIds || []);

  try {
    const recentKey = `recent_direct_chats_${currentUserId}`;
    const raw = localStorage.getItem(recentKey);
    if (raw) {
      const list: any[] = JSON.parse(raw);
      list.forEach((c) => {
        if (c?.chatId) chatIdsToReset.add(String(c.chatId));
      });
      localStorage.setItem(recentKey, JSON.stringify(list.map((c) => ({ ...c, unreadCount: 0 }))));
    }
  } catch {}

  if (db && chatIdsToReset.size > 0) {
    chatIdsToReset.forEach((chatId) => {
      updateDoc(doc(db!, 'privateChats', chatId), { [`unread_${currentUserId}`]: 0 }).catch(() => {});
    });
  }
}

const acknowledgedDeliveredDmIds = new Set<string>();
const markedReadDmIds = new Set<string>();

export async function acknowledgePrivateMessageDelivered(
  convId: string,
  messageId: string
): Promise<void> {
  if (!db || !convId || !messageId) return;
  const dedupKey = `${convId}::${messageId}`;
  if (acknowledgedDeliveredDmIds.has(dedupKey)) return;
  acknowledgedDeliveredDmIds.add(dedupKey);
  if (acknowledgedDeliveredDmIds.size > 500) {
    const first = acknowledgedDeliveredDmIds.values().next().value;
    if (first) acknowledgedDeliveredDmIds.delete(first);
  }
  updateDoc(doc(db, 'privateChats', convId, 'messages', messageId), { status: 'delivered' }).catch(() => {});
  updateDoc(doc(db, 'privateChats', convId), { lastMessageStatus: 'delivered' }).catch(() => {});
}

export async function markDirectMessagesAsRead(
  currentUserId: string,
  peerId: string,
  messages: Message[]
): Promise<void> {
  if (!currentUserId || !peerId) return;
  const convId = getConversationId(currentUserId, peerId);
  const localKey = `direct_messages_${convId}`;

  resetDirectChatUnreadInDB(currentUserId, peerId).catch(() => {});

  const unread = (messages || []).filter(
    (m) =>
      m.senderId !== currentUserId &&
      m.status !== 'seen' &&
      m.status !== 'read' &&
      !markedReadDmIds.has(`${convId}::${m.id}`)
  );
  if (unread.length === 0) return;

  const unreadIds = unread.map((m) => m.id);
  unreadIds.forEach((id) => {
    markedReadDmIds.add(`${convId}::${id}`);
    if (markedReadDmIds.size > 500) {
      const first = markedReadDmIds.values().next().value;
      if (first) markedReadDmIds.delete(first);
    }
  });

  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const updated = list.map((m) => (unreadIds.includes(m.id) ? { ...m, status: 'seen' as const } : m));
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
  } catch {}

  realtimeSocket.sendDirectMessagesRead(convId, currentUserId, peerId, unreadIds);
  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_READ_UPDATE',
    convId,
    messageIds: unreadIds
  });

  if (db) {
    unreadIds.forEach((id) => {
      updateDoc(doc(db!, 'privateChats', convId, 'messages', id), { status: 'seen' }).catch(() => {});
    });
    updateDoc(doc(db, 'privateChats', convId), {
      [`unread_${currentUserId}`]: 0,
      lastMessageStatus: 'seen'
    }).catch(() => {});
  }
}

export async function sendDirectMessage(
  userId1: string,
  userId2: string,
  message: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string }
): Promise<Message> {
  if (!userId1 || !userId2) {
    throw new Error('INVALID_RECIPIENT');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('OFFLINE');
  }

  const convId = getConversationId(userId1, userId2);
  const localKey = `direct_messages_${convId}`;
  const now = getServerNowMs();
  const tempId = message.tempId || message.clientId || message.id || `dm_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const messageId = message.id || tempId;

  const previewText =
    message.type === 'gift' && message.gift?.name
      ? `🎁 أرسل ${message.gift.name}`
      : message.type === 'voice'
      ? '🎤 رسالة صوتية'
      : message.type === 'image'
      ? '📷 صورة'
      : message.type === 'video'
      ? '🎬 فيديو'
      : message.type === 'sticker'
      ? `${message.stickerEmoji || ''} ${message.stickerLabel || 'ملصق'}`.trim()
      : (message.content || message.text || 'رسالة خاصة');

  const newMsg: Message = {
    id: messageId,
    tempId,
    clientId: tempId,
    senderId: message.senderId || userId1,
    senderName: message.senderName || 'عضو شات مصر',
    senderAvatar: message.senderAvatar || '',
    senderRole: message.senderRole || 'member',
    senderVipBadge: message.senderVipBadge || '',
    badges: message.badges || [],
    type: message.type || 'private',
    isPrivate: true,
    recipientId: userId2,
    content: message.content || message.text || previewText,
    text: message.content || message.text || previewText,
    audioDuration: message.audioDuration,
    audioUrl: message.audioUrl,
    voiceUrl: message.voiceUrl,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    stickerId: message.stickerId,
    stickerEmoji: message.stickerEmoji,
    stickerLabel: message.stickerLabel,
    stickerAnimation: message.stickerAnimation,
    stickerUrl: message.stickerUrl,
    gift: message.gift,
    replyTo: message.replyTo,
    expiresAt: now + DM_MESSAGE_TTL_MS,
    createdAt: now,
    timestamp: now,
    status: 'sent'
  };

  const cleanMsgPayload = Object.fromEntries(
    Object.entries(newMsg).filter(([, v]) => v !== undefined)
  );

  // 1. Immediate optimistic cache + real-time WebSocket + cross-tab broadcast (0ms)
  try {
    const saved = localStorage.getItem(localKey);
    const list: Message[] = saved ? JSON.parse(saved) : [];
    if (!list.some((m) => m.id === newMsg.id || (m.tempId && m.tempId === tempId))) {
      list.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(list.slice(-60)));
    }
  } catch {}

  realtimeSocket.sendDirectMessage(convId, userId2, cleanMsgPayload as Partial<Message>, message.recipientSessionId);

  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_UPDATE',
    convId,
    message: newMsg
  });
  liveChatBus?.postMessage({
    type: 'DIRECT_CHATS_UPDATED'
  });

  // 2. Persist to Firestore `privateChats/{convId}/messages/{messageId}` & parent `privateChats/{convId}`
  if (db) {
    try {
      const batch = writeBatch(db);
      const parentDocRef = doc(db, 'privateChats', convId);
      batch.set(
        parentDocRef,
        {
          chatId: convId,
          participants: [userId1, userId2].sort(),
          participantDetails: {
            [userId1]: {
              id: userId1,
              name: newMsg.senderName,
              avatar: newMsg.senderAvatar
            },
            [userId2]: {
              id: userId2,
              name: message.recipientName || 'عضو شات مصر',
              avatar: message.recipientAvatar || ''
            }
          },
          lastMessage: previewText,
          lastMessageId: newMsg.id,
          lastMessageStatus: 'sent',
          lastSenderId: userId1,
          lastSenderName: newMsg.senderName,
          lastTimestamp: now,
          [`unread_${userId1}`]: 0,
          [`unread_${userId2}`]: increment(1),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      const msgDocRef = doc(db, 'privateChats', convId, 'messages', newMsg.id);
      batch.set(msgDocRef, {
        ...cleanMsgPayload,
        chatId: convId,
        createdAt: serverTimestamp()
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `privateChats/${convId}/messages/${newMsg.id}`);
      throw err;
    }
  }

  return newMsg;
}

export interface UnreadMessageRecord {
  senderId: string;
  senderName: string;
  senderAvatar: string;
  count: number;
  lastMessage: string;
  lastMessageId?: string;
  lastSenderId?: string;
  lastTimestamp: number;
}

export function subscribeToUnreadMessagesCount(
  currentUserId: string,
  onUpdate: (records: UnreadMessageRecord[]) => void
): () => void {
  if (!currentUserId || !db) {
    onUpdate([]);
    return () => {};
  }

  let unsubPrivate: (() => void) | null = null;

  try {
    unsubPrivate = onSnapshot(
      query(collection(db, 'privateChats'), where('participants', 'array-contains', currentUserId)),
      (snap) => {
        const bySender = new Map<string, UnreadMessageRecord>();
        snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
          const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
          const participants: string[] = Array.isArray(data.participants) ? data.participants : [];
          const peerId = participants.find((id) => typeof id === 'string' && id.trim() && id !== currentUserId) || '';
          if (!peerId) return;

          if (data.lastSenderId && data.lastSenderId !== currentUserId) {
            if (data.lastMessageStatus === 'sent' && data.lastMessageId) {
              acknowledgePrivateMessageDelivered(docSnap.id, String(data.lastMessageId)).catch(() => {});
            }
          }

          const count = Math.max(0, Number(data[`unread_${currentUserId}`]) || 0);
          if (count <= 0 || data.lastSenderId === currentUserId) return;

          const peerMeta = data.participantDetails?.[peerId] || {};
          const ts =
            resolveTimestampMs(data.updatedAt) ??
            resolveTimestampMs(data.lastTimestamp) ??
            Date.now();
          bySender.set(peerId, {
            senderId: peerId,
            senderName: peerMeta.name || data.lastSenderName || 'عضو شات مصر',
            senderAvatar: peerMeta.avatar || '',
            count,
            lastMessage: data.lastMessage || 'رسالة خاصة',
            lastMessageId: data.lastMessageId,
            lastSenderId: data.lastSenderId,
            lastTimestamp: ts
          });
        });
        const list = Array.from(bySender.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
        onUpdate(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'privateChats')
    );
  } catch {}

  return () => {
    if (unsubPrivate) unsubPrivate();
  };
}

export function subscribeToUserRecentDirectChats(
  currentUserId: string,
  onChats: (chats: any[]) => void
): () => void {
  if (!currentUserId) {
    onChats([]);
    return () => {};
  }
  const localKey = `recent_direct_chats_${currentUserId}`;
  const localMap = new Map<string, any>();
  const socketMap = new Map<string, any>();
  const privateFsMap = new Map<string, any>();

  const emit = () => {
    const merged = new Map<string, any>();
    [localMap, socketMap, privateFsMap].forEach((source) => {
      source.forEach((chat, chatId) => {
        if (!chat || !chat.peerId || chat.peerId === 'null') return;
        const prev = merged.get(chatId);
        if (!prev || (chat.lastTimestamp || 0) >= (prev.lastTimestamp || 0)) {
          merged.set(chatId, {
            ...prev,
            ...chat,
            unreadCount: Math.max(Number(chat.unreadCount) || 0, Number(prev?.unreadCount) || 0)
          });
        }
      });
    });
    const list = Array.from(merged.values()).sort(
      (a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0)
    );
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
    onChats(list);
  };

  try {
    const raw = localStorage.getItem(localKey);
    const parsed = raw ? JSON.parse(raw) : [];
    parsed.forEach((c: any) => {
      if (c && c.chatId && c.peerId && c.peerId !== 'null') localMap.set(c.chatId, c);
    });
  } catch {}
  emit();

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        query(collection(db, 'privateChats'), where('participants', 'array-contains', currentUserId)),
        (snap) => {
          privateFsMap.clear();
          snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
            const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
            const rawParticipants: any[] = Array.isArray(data.participants)
              ? data.participants
              : docSnap.id.split('_');
            const peerId =
              rawParticipants.find((id) => typeof id === 'string' && id.trim() && id !== currentUserId) || '';
            if (!peerId) return;
            const peerMeta = data.participantDetails?.[peerId] || {};
            const ts =
              resolveTimestampMs(data.updatedAt) ??
              resolveTimestampMs(data.lastTimestamp) ??
              Date.now();
            privateFsMap.set(docSnap.id, {
              chatId: docSnap.id,
              peerId,
              peerName: peerMeta.name || (data.lastSenderId === peerId ? data.lastSenderName : '') || 'عضو شات مصر',
              peerAvatar: peerMeta.avatar || '',
              lastMessage: data.lastMessage || 'رسالة خاصة',
              lastMessageId: data.lastMessageId,
              lastSenderId: data.lastSenderId,
              lastSenderName: data.lastSenderName,
              lastTimestamp: ts,
              unreadCount: Math.max(0, Number(data[`unread_${currentUserId}`]) || 0)
            });
          });
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'privateChats')
      );
    } catch {}
  }

  const unsubSocket = realtimeSocket.subscribeToGlobalDirectMessages((msg, convId) => {
    const isPeer = msg.senderId !== currentUserId;
    const peerId = isPeer ? msg.senderId : msg.recipientId;
    if (!peerId) return;
    socketMap.set(convId, {
      chatId: convId,
      peerId,
      peerName: isPeer ? msg.senderName : (msg as any).recipientName || 'عضو شات مصر',
      peerAvatar: isPeer ? msg.senderAvatar : (msg as any).recipientAvatar || '',
      lastMessage: msg.content || 'رسالة خاصة',
      lastSenderId: msg.senderId,
      lastTimestamp: msg.timestamp || Date.now()
    });
    emit();
  });

  return () => {
    if (unsubFirestore) unsubFirestore();
    unsubSocket();
  };
}

// ==========================================
// 15. TYPING INDICATOR (Firebase Realtime Database ONLY, throttled >= 2000ms)
// ==========================================
export async function setPrivateTyping(
  currentUserId: string,
  peerId: string,
  senderName: string,
  isTyping: boolean,
  peerSessionId?: string
): Promise<void> {
  if (!currentUserId || !peerId) return;
  const convId = getConversationId(currentUserId, peerId);
  const now = getServerNowMs();
  const throttleKey = `private:${convId}:${currentUserId}`;

  if (isTyping) {
    const lastSentAt = typingThrottleMap.get(throttleKey) || 0;
    if (now - lastSentAt < 2000) return;
    typingThrottleMap.set(throttleKey, now);
  } else {
    typingThrottleMap.delete(throttleKey);
  }

  realtimeSocket.sendPrivateTyping(currentUserId, senderName, peerId, isTyping, peerSessionId);

  if (rtdb) {
    try {
      const typingRef = ref(rtdb, `typing/private/${convId}/${currentUserId}`);
      if (isTyping) {
        await set(typingRef, { isTyping: true, name: senderName, updatedAt: now });
        try {
          onDisconnect(typingRef).remove();
        } catch {}
      } else {
        await remove(typingRef).catch(() => {});
      }
    } catch {}
  }
}

export function subscribeToPrivateTyping(
  currentUserId: string,
  peerId: string,
  onTypingChange: (isTyping: boolean, senderName?: string) => void
): () => void {
  if (!currentUserId || !peerId) {
    onTypingChange(false);
    return () => {};
  }
  const convId = getConversationId(currentUserId, peerId);
  let lastUpdatedAt = 0;
  let currentTyping = false;
  let currentName = '';

  const applyUpdate = (isTyping: boolean, senderName: string, updatedAt: number) => {
    const fresh = isTyping && getServerNowMs() - updatedAt < 6000;
    if (updatedAt >= lastUpdatedAt || !fresh) {
      lastUpdatedAt = Math.max(lastUpdatedAt, updatedAt);
      currentTyping = fresh;
      if (senderName) currentName = senderName;
      onTypingChange(fresh, currentName);
    }
  };

  const unsubSocket = realtimeSocket.subscribeToPrivateTyping(peerId, (isTyping, senderName) => {
    applyUpdate(isTyping, senderName || '', getServerNowMs());
  });

  // RTDB onValue listener ONLY (`typing/private/{convId}/{peerId}`)
  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      unsubRtdb = onValue(ref(rtdb, `typing/private/${convId}/${peerId}`), (snap) => {
        const val = snap.val();
        if (val && typeof val === 'object') {
          applyUpdate(Boolean(val.isTyping), String(val.name || ''), Number(val.updatedAt) || 0);
        } else {
          applyUpdate(false, currentName, getServerNowMs());
        }
      });
    } catch {}
  }

  const expiryTimer = setInterval(() => {
    if (currentTyping && getServerNowMs() - lastUpdatedAt >= 6000) {
      currentTyping = false;
      onTypingChange(false, currentName);
    }
  }, 2000);

  return () => {
    unsubSocket();
    if (unsubRtdb) unsubRtdb();
    clearInterval(expiryTimer);
  };
}

export async function setRoomTyping(
  roomId: string,
  user: User,
  isTyping: boolean
): Promise<void> {
  if (!roomId || !user?.id) return;
  const now = getServerNowMs();
  const throttleKey = `room:${roomId}:${user.id}`;

  if (isTyping) {
    const lastSentAt = typingThrottleMap.get(throttleKey) || 0;
    if (now - lastSentAt < 2000) return;
    typingThrottleMap.set(throttleKey, now);
  } else {
    typingThrottleMap.delete(throttleKey);
  }

  realtimeSocket.sendRoomTyping(roomId, user.id, user.name, isTyping);

  liveChatBus?.postMessage({
    type: 'ROOM_TYPING_UPDATE',
    roomId,
    user: { id: user.id, name: user.name },
    isTyping
  });

  if (rtdb) {
    try {
      const typingRef = ref(rtdb, `typing/rooms/${roomId}/${user.id}`);
      if (isTyping) {
        await set(typingRef, {
          id: user.id,
          name: user.name || 'عضو شات مصر',
          isTyping: true,
          updatedAt: now
        });
        try {
          onDisconnect(typingRef).remove();
        } catch {}
      } else {
        await remove(typingRef).catch(() => {});
      }
    } catch {}
  }
}

export function subscribeToRoomTyping(
  roomId: string,
  currentUserId: string,
  onTypingUsers: (users: { id: string; name: string }[]) => void
): () => void {
  const wsTypingMap = new Map<string, { id: string; name: string; timestamp: number }>();
  const rtdbTypingMap = new Map<string, { id: string; name: string; timestamp: number }>();

  const emitTyping = () => {
    const now = getServerNowMs();
    const merged = new Map<string, { id: string; name: string }>();

    wsTypingMap.forEach((u, id) => {
      if (id !== currentUserId && now - u.timestamp < 5500) {
        merged.set(id, { id: u.id, name: u.name });
      } else if (now - u.timestamp >= 5500) {
        wsTypingMap.delete(id);
      }
    });

    rtdbTypingMap.forEach((u, id) => {
      if (id !== currentUserId && now - u.timestamp < 6500) {
        merged.set(id, { id: u.id, name: u.name });
      } else if (now - u.timestamp >= 6500) {
        rtdbTypingMap.delete(id);
      }
    });

    onTypingUsers(Array.from(merged.values()));
  };

  const unsubSocketTyping = realtimeSocket.subscribeToRoomTyping(roomId, (uid, uName, isTyping) => {
    if (uid && uid !== currentUserId) {
      if (isTyping) {
        wsTypingMap.set(uid, { id: uid, name: uName || 'عضو شات مصر', timestamp: getServerNowMs() });
      } else {
        wsTypingMap.delete(uid);
      }
      emitTyping();
    }
  });

  // Real-time Firebase RTDB typing listener (`typing/rooms/{roomId}`)
  let unsubRtdbTyping: (() => void) | null = null;
  if (rtdb) {
    try {
      unsubRtdbTyping = onValue(ref(rtdb, `typing/rooms/${roomId}`), (snap) => {
        const val = snap.val();
        const now = getServerNowMs();
        rtdbTypingMap.clear();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([uid, entry]: [string, any]) => {
            if (!entry || uid === currentUserId || !entry.isTyping) return;
            const ts = Number(entry.updatedAt) || now;
            if (now - ts < 6500) {
              rtdbTypingMap.set(uid, {
                id: entry.id || uid,
                name: entry.name || 'عضو شات مصر',
                timestamp: ts
              });
            }
          });
        }
        emitTyping();
      });
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_TYPING_UPDATE' && e.data.roomId === roomId) {
      const u = e.data.user;
      if (u && u.id !== currentUserId) {
        if (e.data.isTyping) {
          wsTypingMap.set(u.id, { id: u.id, name: u.name, timestamp: getServerNowMs() });
        } else {
          wsTypingMap.delete(u.id);
        }
        emitTyping();
      }
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  const sweepInterval = setInterval(emitTyping, 2500);

  return () => {
    clearInterval(sweepInterval);
    unsubSocketTyping();
    if (unsubRtdbTyping) unsubRtdbTyping();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

export function subscribeToAllRoomsTypingFromRTDB(
  onTypingMap: (typingByRoom: Record<string, { id: string; name: string }[]>) => void
): () => void {
  if (!rtdb) {
    onTypingMap({});
    return () => {};
  }
  let latestVal: Record<string, any> | null = null;

  const emit = () => {
    const now = getServerNowMs();
    const next: Record<string, { id: string; name: string }[]> = {};
    if (latestVal && typeof latestVal === 'object') {
      Object.entries(latestVal).forEach(([roomId, usersObj]: [string, any]) => {
        if (!usersObj || typeof usersObj !== 'object') return;
        const active: { id: string; name: string }[] = [];
        Object.entries(usersObj).forEach(([uid, entry]: [string, any]) => {
          if (!entry || !entry.isTyping) return;
          const ts = Number(entry.updatedAt) || 0;
          if (ts > 0 && now - ts < 6500) {
            active.push({
              id: entry.id || uid,
              name: entry.name || 'عضو شات مصر'
            });
          }
        });
        if (active.length > 0) {
          next[roomId] = active;
        }
      });
    }
    onTypingMap(next);
  };

  let unsub: (() => void) | null = null;
  try {
    unsub = onValue(ref(rtdb, 'typing/rooms'), (snap) => {
      latestVal = snap.val();
      emit();
    });
  } catch {}

  const sweepTimer = setInterval(emit, 2500);

  return () => {
    if (unsub) unsub();
    clearInterval(sweepTimer);
  };
}

// ==========================================
// 16. MESSAGE REACTIONS & ROOM READ RECEIPTS
// ==========================================
export async function markRoomPrivateMessagesAsRead(
  roomId: string,
  currentUserId: string,
  messages: Message[]
): Promise<void> {
  if (!roomId || !currentUserId || !messages.length) return;
  const unread = messages.filter(
    m =>
      (m.isPrivate || m.type === 'private') &&
      m.senderId !== currentUserId &&
      (!m.recipientId || m.recipientId === currentUserId) &&
      m.status !== 'read'
  );
  if (unread.length === 0) return;

  const unreadIds = unread.map(m => m.id);
  const localKey = `messages_room_${roomId}`;

  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const updated = list.map(m => (unreadIds.includes(m.id) ? { ...m, status: 'read' as const } : m));
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
  } catch {}

  realtimeSocket.sendRoomMessagesRead(roomId, currentUserId, unreadIds);
  liveChatBus?.postMessage({
    type: 'ROOM_MESSAGES_READ_UPDATE',
    roomId,
    readerId: currentUserId,
    messageIds: unreadIds
  });

  for (const id of unreadIds) {
    if (db) {
      try {
        await setDoc(doc(db, 'rooms', roomId, 'messages', id), { status: 'read' }, { merge: true });
      } catch {}
    }
  }
}

export async function toggleMessageReaction(
  roomId: string,
  messageId: string,
  emoji: string,
  userId: string,
  userName: string,
  fallbackMessage?: Message
): Promise<void> {
  const localKey = `messages_room_${roomId}`;
  let updatedMsg: Message | null = null;

  try {
    const raw = localStorage.getItem(localKey);
    const list: Message[] = raw ? JSON.parse(raw) : [];
    let target = list.find(m => m.id === messageId);
    if (!target && fallbackMessage) {
      target = { ...fallbackMessage };
      list.push(target);
    }

    if (target) {
      const nextReactions: Record<string, number> = { ...(target.reactions || {}) };
      const nextUserReactions: Record<string, string> = { ...(target.userReactions || {}) };
      const nextReactionUsers: Record<string, string[]> = {};
      if (target.reactionUsers) {
        Object.keys(target.reactionUsers).forEach(k => {
          nextReactionUsers[k] = [...target.reactionUsers![k]];
        });
      }

      const existingReaction = nextUserReactions[userId];
      if (existingReaction === emoji) {
        nextReactions[emoji] = Math.max(0, (nextReactions[emoji] || 1) - 1);
        if (nextReactions[emoji] === 0) delete nextReactions[emoji];
        delete nextUserReactions[userId];
        if (nextReactionUsers[emoji]) {
          nextReactionUsers[emoji] = nextReactionUsers[emoji].filter(name => name !== userName);
        }
      } else {
        if (existingReaction && nextReactions[existingReaction]) {
          nextReactions[existingReaction] = Math.max(0, nextReactions[existingReaction] - 1);
          if (nextReactions[existingReaction] === 0) delete nextReactions[existingReaction];
          if (nextReactionUsers[existingReaction]) {
            nextReactionUsers[existingReaction] = nextReactionUsers[existingReaction].filter(name => name !== userName);
          }
        }
        nextReactions[emoji] = (nextReactions[emoji] || 0) + 1;
        nextUserReactions[userId] = emoji;
        if (!nextReactionUsers[emoji]) nextReactionUsers[emoji] = [];
        if (!nextReactionUsers[emoji].includes(userName)) {
          nextReactionUsers[emoji].push(userName);
        }
      }

      target.reactions = nextReactions;
      target.userReactions = nextUserReactions;
      target.reactionUsers = nextReactionUsers;
      updatedMsg = target;
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch {}

  if (!updatedMsg) return;

  // Broadcast across tabs & WebSocket server
  realtimeSocket.sendMessageReaction(
    roomId,
    messageId,
    updatedMsg.reactions || {},
    updatedMsg.userReactions || {},
    updatedMsg.reactionUsers || {}
  );

  liveChatBus?.postMessage({
    type: 'MESSAGE_REACTION_UPDATE',
    roomId,
    messageId,
    updatedMessage: updatedMsg
  });

  // Firestore real-time update
  if (db) {
    try {
      await setDoc(
        doc(db, 'rooms', roomId, 'messages', messageId),
        {
          reactions: updatedMsg.reactions || {},
          userReactions: updatedMsg.userReactions || {},
          reactionUsers: updatedMsg.reactionUsers || {}
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Firestore reaction update notice:", e);
    }
  }
}

// ==========================================
// 17. MESSAGE DELETION (Rooms & Direct Chats)
// ==========================================
export async function deleteRoomMessage(roomId: string, messageId: string): Promise<boolean> {
  const localKey = `messages_room_${roomId}`;
  const deletedStorageKey = `shat_masr_deleted_room_msgs_${roomId}`;
  persistDeletedIdStorage(deletedStorageKey, messageId);

  // 1. Immediate local storage purge
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const filtered = list.filter(m => m.id !== messageId && m.tempId !== messageId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  // 2. Broadcast immediately to WebSocket peers, open tabs & same tab
  realtimeSocket.sendRoomMessageDeleted(roomId, messageId);
  liveChatBus?.postMessage({
    type: 'ROOM_MESSAGE_DELETED',
    roomId,
    messageId
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shat_masr_sync_event', {
      detail: { type: 'ROOM_MESSAGE_DELETED', roomId, messageId }
    }));
  }

  // 3. Delete document from Firestore
  if (db) {
    try {
      const docRef = doc(db, 'rooms', roomId, 'messages', messageId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn("Firestore message delete notice:", e);
    }
  }

  return true;
}

export async function deleteDirectMessage(
  userId1: string,
  userId2: string,
  messageId: string
): Promise<boolean> {
  const convId = getConversationId(userId1, userId2);
  const localKey = `direct_messages_${convId}`;
  const deletedStorageKey = `shat_masr_deleted_dm_msgs_${convId}`;
  persistDeletedIdStorage(deletedStorageKey, messageId);

  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const filtered = list.filter(m => m.id !== messageId && m.tempId !== messageId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_DELETED',
    convId,
    messageId
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shat_masr_sync_event', {
      detail: { type: 'DIRECT_MESSAGE_DELETED', convId, messageId }
    }));
  }

  if (db) {
    try {
      await deleteDoc(doc(db, 'privateChats', convId, 'messages', messageId));
    } catch (e) {
      console.warn('Firestore direct message delete notice:', e);
    }
  }

  return true;
}

/**
 * Checks whether this is the user's first entry into a public chat room.
 * Persists across sessions in localStorage + Firestore (users/{userId}.welcomedRooms) + RTDB.
 */
export async function checkAndMarkFirstPublicRoomEntry(
  userId: string,
  roomId: string
): Promise<boolean> {
  if (!userId || !roomId) return false;
  const storageKey = `shat_masr_welcomed_rooms_${userId}`;

  let localRooms: string[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localRooms = parsed;
    }
  } catch {}

  if (localRooms.includes(roomId)) {
    return false;
  }

  // Verify against Firestore in case the user is logging in on a fresh device/browser
  if (db) {
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const remoteRooms: string[] = Array.isArray(data?.welcomedRooms) ? data.welcomedRooms : [];
        if (remoteRooms.includes(roomId)) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set([...localRooms, ...remoteRooms]))));
          } catch {}
          return false;
        }
      }
    } catch (err) {
      console.warn('Firestore welcomedRooms check notice:', err);
    }
  }

  // Mark as welcomed immediately across localStorage, RTDB, and Firestore
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set([...localRooms, roomId]))));
  } catch {}

  if (rtdb) {
    try {
      await set(ref(rtdb, `users/${userId}/welcomedRooms/${roomId}`), true);
    } catch {}
  }

  if (db) {
    try {
      await setDoc(
        doc(db, 'users', userId),
        { welcomedRooms: arrayUnion(roomId) },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore welcomedRooms update notice:', err);
    }
  }

  return true;
}

/**
 * Atomic, strictly monotonic cumulative visitors counter (never decreases).
 * Combines Firestore (`stats/visitors` with `increment(1)` & `onSnapshot`), RTDB `runTransaction`, WebSocket & REST API.
 */
export function syncCumulativeVisitorsRealtime(
  visitToken: string,
  shouldIncrementThisSession: boolean,
  localBaseline: number,
  onCountUpdate: (highestCount: number) => void
): () => void {
  const BASE = 15480;
  let currentMax = Math.max(BASE, localBaseline || BASE);
  let lastEmittedMax = 0;

  const reportHighest = (candidate: number) => {
    if (typeof candidate !== 'number' || isNaN(candidate)) return;
    const next = Math.max(currentMax, Math.floor(candidate), BASE);
    if (next > currentMax) {
      currentMax = next;
    }
    if (currentMax === lastEmittedMax) return;
    lastEmittedMax = currentMax;
    try {
      localStorage.setItem('shat_masr_cumulative_visitors', String(currentMax));
    } catch {}
    onCountUpdate(currentMax);
  };

  // 1. Subscribe to WebSocket authoritative counter & register visit
  const unsubSocket = realtimeSocket.subscribeToCumulativeVisitors((wsCount) => {
    reportHighest(wsCount);
  });
  if (shouldIncrementThisSession) {
    realtimeSocket.registerVisit(visitToken, currentMax);
  } else {
    realtimeSocket.syncCumulativeVisitorsCount(currentMax);
  }

  // 2. REST API authoritative sync (ensures instant hydration before/even without WS)
  if (typeof fetch === 'function') {
    const endpoint = shouldIncrementThisSession ? '/api/stats/visitors/visit' : '/api/stats/visitors';
    const init: RequestInit = shouldIncrementThisSession
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitToken, clientHighestCount: currentMax })
        }
      : { method: 'GET' };

    fetch(endpoint, init)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.count === 'number') {
          reportHighest(data.count);
        }
      })
      .catch(() => {});
  }

  // 3. Firebase Firestore permanent counter `stats/visitors` (`totalVisitors` + atomic `increment(1)`)
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const visitorsDocRef = doc(db, 'stats', 'visitors');
      unsubFirestore = onSnapshot(
        visitorsDocRef,
        (snap) => {
          if (snap.exists()) {
            const val = Number(snap.data()?.totalVisitors);
            if (!isNaN(val) && val > 0) {
              reportHighest(val);
              realtimeSocket.syncCumulativeVisitorsCount(Math.max(currentMax, val));
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'stats/visitors');
        }
      );

      // Perform session increment atomically using Firestore increment(1)
      if (shouldIncrementThisSession) {
        getDoc(visitorsDocRef)
          .then(async (snap) => {
            if (!snap.exists() || Number(snap.data()?.totalVisitors || 0) < BASE) {
              const seedVal = Math.max(currentMax, BASE);
              await setDoc(
                visitorsDocRef,
                { totalVisitors: seedVal + 1, updatedAt: serverTimestamp() },
                { merge: true }
              );
              reportHighest(seedVal + 1);
            } else {
              await setDoc(
                visitorsDocRef,
                { totalVisitors: increment(1), updatedAt: serverTimestamp() },
                { merge: true }
              );
            }
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, 'stats/visitors');
          });
      }
    } catch {}
  }

  // 4. Firebase RTDB real-time read listener (authoritative increment happens via Firestore + REST/WS)
  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const visitorsRef = ref(rtdb, 'platform_stats/cumulative_visitors');
      unsubRtdb = onValue(
        visitorsRef,
        (snapshot) => {
          const remoteVal = snapshot.val();
          if (typeof remoteVal === 'number' && !isNaN(remoteVal)) {
            reportHighest(remoteVal);
            realtimeSocket.syncCumulativeVisitorsCount(Math.max(currentMax, remoteVal));
          }
        },
        () => {}
      );
    } catch {}
  }

  return () => {
    unsubSocket();
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
  };
}

// ==========================================
// 28. PRESENCE ROOM TRACKER, THEME SETTINGS, APP VERSION CHECK, STORIES, XP & DAILY BACKUPS
// ==========================================

export const CLIENT_APP_VERSION = '2.4.0';

export async function updatePresenceCurrentRoom(uid: string, roomId: string | null): Promise<void> {
  if (!uid) return;
  const nowTs = getServerNowMs();
  if (rtdb) {
    try {
      await update(ref(rtdb, `presence/${uid}`), {
        userId: uid,
        currentRoom: roomId || null,
        isOnline: true,
        lastSeen: rtdbServerTimestamp(),
        lastSeenMs: nowTs
      }).catch(() => {});
    } catch {}
  }
  if (db) {
    try {
      await setDoc(
        doc(db, 'presence', uid),
        {
          userId: uid,
          id: uid,
          currentRoom: roomId || null,
          isOnline: true,
          lastSeen: nowTs,
          lastSeenMs: nowTs,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  }
}

export async function markUserPresenceOffline(uid: string, roomId?: string | null): Promise<void> {
  if (!uid) return;
  const nowTs = getServerNowMs();
  if (typeof navigator !== 'undefined') {
    const payload = JSON.stringify({ userId: uid, roomId: roomId || undefined });
    try {
      const sent = typeof navigator.sendBeacon === 'function'
        ? navigator.sendBeacon('/api/presence/offline', new Blob([payload], { type: 'application/json' }))
        : false;
      if (!sent && typeof fetch === 'function') {
        fetch('/api/presence/offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }
  if (rtdb) {
    try {
      await update(ref(rtdb, `presence/${uid}`), {
        isOnline: false,
        currentRoom: null,
        lastSeen: rtdbServerTimestamp(),
        lastSeenMs: nowTs
      }).catch(() => {});
    } catch {}
  }
  if (db) {
    try {
      await setDoc(
        doc(db, 'presence', uid),
        {
          isOnline: false,
          status: 'offline',
          currentRoom: null,
          lastSeen: nowTs,
          lastSeenMs: nowTs,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {});
      if (roomId) {
        await deleteDoc(doc(db, 'rooms', roomId, 'presence', uid)).catch(() => {});
      }
    } catch {}
  }
}

export function subscribeToAllRoomsOnlineCounts(
  currentUserId: string,
  onCountsChange: (counts: Record<string, number>) => void
): () => void {
  const cacheKey = 'shat_masr_room_online_counts';
  let latestPresenceVal: Record<string, any> | null = null;
  let latestFsPresenceVal: Record<string, any> | null = null;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        onCountsChange(parsed);
      }
    }
  } catch {}

  const recomputeAndEmit = () => {
    const now = getServerNowMs();
    const roomUsers = new Map<string, Set<string>>();
    const ingestPresenceSource = (source: Record<string, any> | null) => {
      if (!source || typeof source !== 'object') return;
      Object.entries(source).forEach(([uid, uData]: [string, any]) => {
        if (!uData || typeof uData !== 'object') return;
        if (uData.isOnline !== true || uData.status === 'offline') return;
        const roomId = typeof uData.currentRoom === 'string' ? uData.currentRoom.trim() : '';
        if (!roomId) return;
        const seen = resolveTimestampMs(uData.lastSeen ?? uData.lastSeenMs ?? uData.updatedAt) || 0;
        if (uid === currentUserId || (seen > 0 && now - seen <= PRESENCE_OFFLINE_TIMEOUT_MS)) {
          if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
          roomUsers.get(roomId)!.add(uid);
        }
      });
    };
    ingestPresenceSource(latestFsPresenceVal);
    ingestPresenceSource(latestPresenceVal);

    const counts: Record<string, number> = {};
    roomUsers.forEach((uidSet, roomId) => {
      counts[roomId] = uidSet.size;
    });

    try {
      localStorage.setItem(cacheKey, JSON.stringify(counts));
    } catch {}
    onCountsChange(counts);
  };

  let unsubFsCounts: (() => void) | null = null;
  if (db) {
    try {
      unsubFsCounts = onSnapshot(
        collection(db, 'presence'),
        (snap) => {
          const nextFs: Record<string, any> = {};
          snap.docs.forEach((d) => {
            nextFs[d.id] = d.data();
          });
          latestFsPresenceVal = nextFs;
          recomputeAndEmit();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'presence_room_counts');
        }
      );
    } catch {}
  }

  const unsubRtdb = subscribeSharedRtdbPresence((val) => {
    latestPresenceVal = val;
    recomputeAndEmit();
  });

  const sweepTimer = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    recomputeAndEmit();
  }, 10000);

  return () => {
    if (unsubFsCounts) unsubFsCounts();
    unsubRtdb();
    clearInterval(sweepTimer);
  };
}

export function subscribeToRegisteredUsersCount(
  onUpdate: (count: number, users: User[]) => void
): () => void {
  const cacheKey = 'shat_masr_registered_users_count';
  let lastCount = 0;
  try {
    const saved = Number(localStorage.getItem(cacheKey) || '0');
    if (saved > 0) {
      lastCount = saved;
      onUpdate(lastCount, []);
    }
  } catch {}

  return subscribeToAllUsers((users) => {
    const isApiConnected =
      realtimeSocket.getConnectionState() === 'connected' &&
      (typeof navigator === 'undefined' || navigator.onLine !== false);
    if (!isApiConnected && users.length <= 1 && lastCount > 1) {
      return;
    }
    const nextCount = Math.max(users.length, 1);
    lastCount = nextCount;
    try {
      localStorage.setItem(cacheKey, String(nextCount));
    } catch {}
    onUpdate(nextCount, users);
  });
}

export interface UserThemeSettings {
  isDarkMode: boolean;
  chatWallpaper?: string;
  fontPreference?: 'cairo' | 'tajawal' | 'amiri';
  muteJoinNotices?: boolean;
  dataSaverMode?: boolean;
  notificationBgPreset?: string;
}

export async function saveUserThemeSettings(uid: string, settings: UserThemeSettings): Promise<void> {
  if (!uid) return;
  try {
    localStorage.setItem(`shat_masr_theme_settings_${uid}`, JSON.stringify(settings));
  } catch {}
  if (db) {
    try {
      await setDoc(
        doc(db, 'users', uid, 'settings', 'theme'),
        {
          ...settings,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch {}
  }
}

export async function loadUserThemeSettings(uid: string): Promise<UserThemeSettings | null> {
  if (!uid) return null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'settings', 'theme'));
      if (snap.exists()) {
        return snap.data() as UserThemeSettings;
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem(`shat_masr_theme_settings_${uid}`);
    return raw ? (JSON.parse(raw) as UserThemeSettings) : null;
  } catch {
    return null;
  }
}

export interface RemoteVersionConfig {
  app_version?: string;
  version?: string;
  force_update?: boolean;
  notifications_enabled?: boolean;
  message?: string;
}

export function subscribeToRemoteAppVersion(
  onVersion: (cfg: { latestVersion: string; forceUpdate: boolean; notificationsEnabled: boolean; message: string }) => void
): () => void {
  if (!db) return () => {};
  let unsubConfig: (() => void) | null = null;
  try {
    unsubConfig = onSnapshot(
      doc(db, 'config', 'app_version'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as RemoteVersionConfig;
          const latestVersion = String(data.app_version || data.version || CLIENT_APP_VERSION);
          onVersion({
            latestVersion,
            forceUpdate: Boolean(data.force_update),
            notificationsEnabled: data.notifications_enabled !== false,
            message: data.message || 'يوجد تحديث جديد - اضغط للتحديث'
          });
        }
      },
      () => {}
    );
  } catch {}
  return () => {
    if (unsubConfig) unsubConfig();
  };
}

export async function setRemoteUpdateNotificationsEnabled(enabled: boolean): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'config', 'app_version'),
      { notifications_enabled: enabled, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/app_version');
  }
}

// 29. STORIES BAR (24-HOUR TTL)
const LOCAL_STORIES_KEY = 'shat_masr_stories_v1';
const DELETED_STORIES_KEY = 'shat_masr_deleted_stories_v1';

export function subscribeToActiveStories(onUpdate: (stories: StoryItem[]) => void): () => void {
  const filterValid = (list: StoryItem[]) => {
    const now = Date.now();
    const deleted = readDeletedIdsStorage(DELETED_STORIES_KEY);
    return list
      .filter((s) => s?.id && !deleted.has(s.id) && typeof s.expiresAt === 'number' && s.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  const readLocal = (): StoryItem[] => {
    try {
      const raw = localStorage.getItem(LOCAL_STORIES_KEY);
      return raw ? filterValid(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  };

  onUpdate(readLocal());

  let unsubFs: (() => void) | null = null;

  if (db) {
    try {
      const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(40));
      unsubFs = onSnapshot(
        q,
        (snap) => {
          const items: StoryItem[] = snap.docs.map((d) => {
            const data = d.data() as any;
            const createdAt = resolveTimestampMs(data.createdAt) ?? Date.now();
            const expiresAt = resolveTimestampMs(data.expiresAt) ?? (createdAt + 86400000);
            return {
              id: d.id,
              ...data,
              createdAt,
              expiresAt,
            };
          });
          const valid = filterValid(items);
          try {
            localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(valid));
          } catch {}
          onUpdate(valid);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'stories');
          const cached = readLocal();
          if (cached.length > 0) onUpdate(cached);
        }
      );
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'STORIES_CHANGED') {
      onUpdate(readLocal());
    }
  };
  const handleLocalSync = (e: Event) => {
    if ((e as CustomEvent)?.detail?.type === 'STORIES_CHANGED') {
      onUpdate(readLocal());
    }
  };
  liveChatBus?.addEventListener('message', handleBus);
  if (typeof window !== 'undefined') {
    window.addEventListener('shat_masr_sync_event', handleLocalSync);
  }

  return () => {
    if (unsubFs) unsubFs();
    liveChatBus?.removeEventListener('message', handleBus);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shat_masr_sync_event', handleLocalSync);
    }
  };
}

export async function createStory(
  user: User,
  payload: { mediaType: 'image' | 'text'; imageUrl?: string; caption: string; bgGradient?: string }
): Promise<StoryItem> {
  const now = Date.now();
  const id = `story_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const story: StoryItem = {
    id,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar || '',
    userRole: user.role,
    userVerified: Boolean(user.verified || user.role === 'owner'),
    mediaType: payload.mediaType,
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    caption: payload.caption.trim(),
    bgGradient: payload.bgGradient || 'from-indigo-600 via-purple-600 to-fuchsia-600',
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    likedBy: [],
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    viewers: {}
  };

  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    const list: StoryItem[] = raw ? JSON.parse(raw) : [];
    list.unshift(story);
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {}
  liveChatBus?.postMessage({ type: 'STORIES_CHANGED' });

  if (db) {
    try {
      await setDoc(doc(db, 'stories', id), story);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `stories/${id}`);
    }
  }
  return story;
}

export async function markStoryViewed(storyId: string, viewer: User): Promise<void> {
  if (!storyId || !viewer?.id) return;
  const viewerEntry = {
    id: viewer.id,
    userId: viewer.id,
    name: viewer.name || 'عضو شات مصر',
    avatar: viewer.avatar || '',
    viewedAt: Date.now()
  };

  let shouldSkipRemote = false;
  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    if (raw) {
      const list: StoryItem[] = JSON.parse(raw);
      const updated = list.map((s) => {
        if (s.id !== storyId) return s;
        if (s.userId === viewer.id) {
          shouldSkipRemote = true;
          return s;
        }
        const prevViewers = s.viewers || {};
        if (prevViewers[viewer.id]) {
          shouldSkipRemote = true;
          return s;
        }
        const nextViewers = { ...prevViewers, [viewer.id]: viewerEntry };
        return {
          ...s,
          viewers: nextViewers,
          viewsCount: Math.max((s.viewsCount || 0) + 1, Object.keys(nextViewers).length)
        };
      });
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(updated));
    }
  } catch {}

  if (shouldSkipRemote) return;

  if (db) {
    try {
      const storyRef = doc(db, 'stories', storyId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(storyRef);
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data.userId === viewer.id) return;
        const currentViewers = (data.viewers && typeof data.viewers === 'object' ? data.viewers : {}) as Record<string, any>;
        if (currentViewers[viewer.id]) return;
        const nextCount = Math.max(Number(data.viewsCount) || 0, Object.keys(currentViewers).length) + 1;
        tx.update(storyRef, {
          [`viewers.${viewer.id}`]: viewerEntry,
          viewsCount: nextCount
        });
      });
    } catch {}
  }
}

export async function toggleStoryLike(
  storyId: string,
  user: User,
  storyOwnerId?: string,
  wasLikedHint?: boolean
): Promise<void> {
  if (!storyId || !user?.id) return;
  let currentlyLiked = Boolean(wasLikedHint);
  let resolvedOwnerId = storyOwnerId || '';

  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    if (raw) {
      const list: StoryItem[] = JSON.parse(raw);
      const updated = list.map((s) => {
        if (s.id !== storyId) return s;
        if (!resolvedOwnerId && s.userId) resolvedOwnerId = s.userId;
        const likedSet = new Set(s.likedBy || []);
        currentlyLiked = likedSet.has(user.id);
        if (currentlyLiked) {
          likedSet.delete(user.id);
        } else {
          likedSet.add(user.id);
        }
        const likedBy = Array.from(likedSet);
        return { ...s, likedBy, likesCount: likedBy.length };
      });
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(updated));
      liveChatBus?.postMessage({ type: 'STORIES_CHANGED' });
    }
  } catch {}

  let addedLike = !currentlyLiked;
  if (db) {
    try {
      const storyRef = doc(db, 'stories', storyId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(storyRef);
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data.userId) resolvedOwnerId = String(data.userId);
        const prevLiked: string[] = Array.isArray(data.likedBy) ? data.likedBy : [];
        const hasLiked = prevLiked.includes(user.id);
        addedLike = !hasLiked;
        const nextLiked = hasLiked
          ? prevLiked.filter((id) => id !== user.id)
          : [...prevLiked, user.id];
        tx.update(storyRef, {
          likedBy: nextLiked,
          likesCount: nextLiked.length
        });
      });
    } catch {}
  }

  if (addedLike && resolvedOwnerId && resolvedOwnerId !== user.id) {
    sendUserRealtimeNotification({
      targetUserId: resolvedOwnerId,
      actorId: user.id,
      actorName: user.name || 'عضو شات مصر',
      actorAvatar: user.avatar || '',
      kind: 'story_like',
      message: `أعجب ${user.name || 'عضو شات مصر'} بقصتك`,
      refId: storyId
    }).catch(() => {});
  }
}

export function subscribeToStoryComments(
  storyId: string,
  onUpdate: (comments: StoryComment[]) => void
): () => void {
  if (!storyId) return () => {};
  const localKey = `shat_masr_story_comments_${storyId}`;
  const readLocal = (): StoryComment[] => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const initial = readLocal();
  if (initial.length > 0) onUpdate(initial);

  let unsubFs: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'stories', storyId, 'comments'), orderBy('createdAt', 'asc'), limit(60));
      unsubFs = onSnapshot(
        q,
        (snap) => {
          const list: StoryComment[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              ...data,
              createdAt: resolveTimestampMs(data.createdAt) ?? Date.now()
            };
          });
          try {
            localStorage.setItem(localKey, JSON.stringify(list));
          } catch {}
          onUpdate(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `stories/${storyId}/comments`);
        }
      );
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'STORY_COMMENTS_CHANGED' && e.data?.storyId === storyId) {
      onUpdate(readLocal());
    }
  };
  liveChatBus?.addEventListener('message', handleBus);

  return () => {
    if (unsubFs) unsubFs();
    liveChatBus?.removeEventListener('message', handleBus);
  };
}

export async function addStoryComment(
  storyId: string,
  user: User,
  text: string,
  storyOwnerId?: string
): Promise<StoryComment | null> {
  const cleanText = (text || '').trim();
  if (!storyId || !user?.id || !cleanText) return null;
  let resolvedOwnerId = storyOwnerId || '';
  const id = `scmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const comment: StoryComment = {
    id,
    storyId,
    authorId: user.id,
    authorName: user.name || 'عضو شات مصر',
    authorAvatar: user.avatar || '',
    authorVerified: Boolean(user.verified || user.role === 'owner'),
    text: cleanText,
    createdAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    if (raw) {
      const list: StoryItem[] = JSON.parse(raw);
      const updated = list.map((s) => {
        if (s.id !== storyId) return s;
        if (s.userId && !resolvedOwnerId) resolvedOwnerId = s.userId;
        return { ...s, commentsCount: (s.commentsCount || 0) + 1 };
      });
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(updated));
      liveChatBus?.postMessage({ type: 'STORIES_CHANGED' });
    }
  } catch {}

  const localKey = `shat_masr_story_comments_${storyId}`;
  try {
    const rawComments = localStorage.getItem(localKey);
    const list: StoryComment[] = rawComments ? JSON.parse(rawComments) : [];
    list.push(comment);
    localStorage.setItem(localKey, JSON.stringify(list));
    liveChatBus?.postMessage({ type: 'STORY_COMMENTS_CHANGED', storyId });
  } catch {}

  if (db) {
    try {
      if (!resolvedOwnerId) {
        const storySnap = await getDoc(doc(db, 'stories', storyId)).catch(() => null);
        if (storySnap?.exists()) {
          const data = storySnap.data() as any;
          if (data?.userId) resolvedOwnerId = String(data.userId);
        }
      }
      await setDoc(doc(db, 'stories', storyId, 'comments', id), comment);
      await updateDoc(doc(db, 'stories', storyId), {
        commentsCount: increment(1)
      });
    } catch {}
  }

  if (resolvedOwnerId && resolvedOwnerId !== user.id) {
    sendUserRealtimeNotification({
      targetUserId: resolvedOwnerId,
      actorId: user.id,
      actorName: user.name || 'عضو شات مصر',
      actorAvatar: user.avatar || '',
      kind: 'story_comment',
      message: `علق ${user.name || 'عضو شات مصر'} على قصتك`,
      refId: storyId
    }).catch(() => {});
  }

  return comment;
}

export async function deleteStory(storyId: string): Promise<void> {
  if (!storyId) return;
  persistDeletedIdStorage(DELETED_STORIES_KEY, storyId);
  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    if (raw) {
      const list: StoryItem[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(list.filter((s) => s.id !== storyId)));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'STORIES_CHANGED' });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shat_masr_sync_event', { detail: { type: 'STORIES_CHANGED' } }));
  }

  if (db) {
    try {
      const viewersSnap = await getDocs(collection(db, 'stories', storyId, 'viewers')).catch(() => null);
      if (viewersSnap && !viewersSnap.empty) {
        await Promise.all(viewersSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      }
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `stories/${storyId}`);
    }
  }
}

export interface ProfileVisitorItem {
  id: string;
  visitorId: string;
  visitorName: string;
  visitorAvatar: string;
  visitorRole?: string;
  visitedAt: number;
}

const LOCAL_VISITORS_PREFIX = 'shat_masr_profile_visitors_';

export async function recordProfileVisit(
  targetUserId: string,
  visitorOrId: User | string
): Promise<void> {
  const visitorObj = typeof visitorOrId === 'string' ? null : visitorOrId;
  const visitorId = typeof visitorOrId === 'string' ? visitorOrId : visitorOrId?.id;
  if (!targetUserId || !visitorId || targetUserId === visitorId) return;

  const entry: ProfileVisitorItem = {
    id: visitorId,
    visitorId,
    visitorName: visitorObj?.name || 'عضو شات مصر',
    visitorAvatar: visitorObj?.avatar || '',
    visitorRole: visitorObj?.role || 'member',
    visitedAt: Date.now(),
  };

  try {
    const localKey = `${LOCAL_VISITORS_PREFIX}${targetUserId}`;
    const raw = localStorage.getItem(localKey);
    const list: ProfileVisitorItem[] = raw ? JSON.parse(raw) : [];
    const next = [entry, ...list.filter((v) => v.visitorId !== visitorId)].slice(0, 40);
    localStorage.setItem(localKey, JSON.stringify(next));
  } catch {}

  const sessionKey = `shatmasr_visited_profile_${visitorId}_${targetUserId}`;
  let alreadyCountedThisSession = false;
  try {
    if (sessionStorage.getItem(sessionKey) === '1') {
      alreadyCountedThisSession = true;
    } else {
      sessionStorage.setItem(sessionKey, '1');
    }
  } catch {}

  if (db) {
    try {
      await setDoc(
        doc(db, 'users', targetUserId, 'profile_visitors', visitorId),
        entry,
        { merge: true }
      );
      if (!alreadyCountedThisSession) {
        await setDoc(
          doc(db, 'users', targetUserId),
          { profileVisitsCount: increment(1) },
          { merge: true }
        );
      }
    } catch {}
  }
}

export function subscribeToProfileVisitors(
  userId: string,
  onUpdate: (visitors: ProfileVisitorItem[]) => void
): () => void {
  if (!userId) return () => {};
  const localKey = `${LOCAL_VISITORS_PREFIX}${userId}`;
  const readLocal = (): ProfileVisitorItem[] => {
    try {
      const raw = localStorage.getItem(localKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.sort((a: ProfileVisitorItem, b: ProfileVisitorItem) => (b.visitedAt || 0) - (a.visitedAt || 0))
        : [];
    } catch {
      return [];
    }
  };
  onUpdate(readLocal());

  let unsubFs: (() => void) | null = null;
  if (db) {
    try {
      const q = query(
        collection(db, 'users', userId, 'profile_visitors'),
        orderBy('visitedAt', 'desc'),
        limit(40)
      );
      unsubFs = onSnapshot(
        q,
        (snap) => {
          const list: ProfileVisitorItem[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              visitorId: data.visitorId || d.id,
              visitorName: data.visitorName || 'عضو شات مصر',
              visitorAvatar: data.visitorAvatar || '',
              visitorRole: data.visitorRole || 'member',
              visitedAt: resolveTimestampMs(data.visitedAt) ?? Date.now(),
            };
          });
          try {
            localStorage.setItem(localKey, JSON.stringify(list));
          } catch {}
          onUpdate(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/profile_visitors`);
        }
      );
    } catch {}
  }

  return () => {
    if (unsubFs) unsubFs();
  };
}

export function subscribeToProfileVisitsCount(
  userId: string,
  onCount: (count: number) => void
): () => void {
  if (!userId || !db) return () => {};
  try {
    return onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const cnt = Number(data?.profileVisitsCount);
          if (Number.isFinite(cnt) && cnt >= 0) {
            onCount(cnt);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${userId}/profileVisitsCount`);
      }
    );
  } catch {
    return () => {};
  }
}

export async function grantUserXp(
  userId: string,
  xpDelta: number,
  currentXp: number = 0
): Promise<{ nextXp: number; nextLevel: number; leveledUp: boolean }> {
  const prevLevel = Math.max(1, Math.floor((currentXp || 0) / 100) + 1);
  const nextXp = (currentXp || 0) + xpDelta;
  const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
  const leveledUp = nextLevel > prevLevel;

  if (db && userId) {
    setDoc(
      doc(db, 'users', userId),
      { xp: nextXp, level: nextLevel, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  }
  return { nextXp, nextLevel, leveledUp };
}

// 30. AUTOMATED DAILY BACKUPS (`backups/{dateKey}` + `/api/backups`)
export async function createDailyBackupSnapshot(
  createdBy: string,
  usersList: User[],
  roomsCount: number = 10,
  postsCount: number = 0,
  notes?: string
): Promise<BackupSnapshot> {
  const dateKey = getTodayKey();
  const sanitizedUsers = usersList.slice(0, 120).map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    vipBadge: u.vipBadge,
    verified: Boolean(u.verified),
    coins: u.coins || 0,
    level: u.level || 1,
    badges: u.badges || []
  }));
  const snapshot: BackupSnapshot = {
    id: `bak_${dateKey}`,
    dateKey,
    createdAt: Date.now(),
    createdBy,
    usersCount: usersList.length,
    roomsCount,
    postsCount,
    usersData: sanitizedUsers,
    notes: notes || 'نسخة احتياطية يومية تلقائية للبيانات والرتب والأرصدة'
  };

  try {
    await fetch('/api/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    }).catch(() => {});
  } catch {}

  if (db) {
    try {
      await setDoc(doc(db, 'backups', dateKey), snapshot, { merge: true });
    } catch {}
  }
  return snapshot;
}

export function subscribeToBackups(onUpdate: (list: BackupSnapshot[]) => void): () => void {
  const map = new Map<string, BackupSnapshot>();
  const emit = () => {
    const sorted = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    onUpdate(sorted);
  };

  fetch('/api/backups')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (Array.isArray(d?.backups)) {
        d.backups.forEach((b: BackupSnapshot) => {
          if (b?.dateKey) map.set(b.dateKey, b);
        });
        emit();
      }
    })
    .catch(() => {});

  let unsubFs: (() => void) | null = null;
  if (db) {
    try {
      unsubFs = onSnapshot(
        query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(14)),
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data() as BackupSnapshot;
            map.set(data.dateKey || d.id, { ...data, id: data.id || d.id });
          });
          emit();
        },
        () => {}
      );
    } catch {}
  }

  return () => {
    if (unsubFs) unsubFs();
  };
}

export async function restoreDailyBackupSnapshot(snapshot: BackupSnapshot): Promise<number> {
  if (!snapshot?.usersData || !Array.isArray(snapshot.usersData)) return 0;
  let restoredCount = 0;
  for (const u of snapshot.usersData) {
    if (!u?.id) continue;
    await adminUpdateUser(u.id, {
      role: u.role,
      vipBadge: u.vipBadge,
      verified: Boolean(u.verified),
      coins: Number(u.coins) || 0,
      level: Number(u.level) || 1,
      badges: Array.isArray(u.badges) ? u.badges : []
    }).catch(() => {});
    restoredCount += 1;
  }
  return restoredCount;
}


// ==========================================
// 20. ROOM PINNED MESSAGE (WebSocket + RTDB + BroadcastChannel)
// ==========================================
export async function setRoomPinnedMessage(
  roomId: string,
  pinnedMessage: PinnedRoomMessage | null
): Promise<void> {
  if (!roomId) return;
  const localKey = `room_pinned_${roomId}`;

  const normalized: PinnedRoomMessage | null =
    pinnedMessage && pinnedMessage.content
      ? {
          id: pinnedMessage.id || `pin_${Date.now()}`,
          senderId: pinnedMessage.senderId,
          senderName: pinnedMessage.senderName || 'المشرف',
          content: pinnedMessage.content,
          pinnedBy: pinnedMessage.pinnedBy || 'المشرف',
          pinnedAt: pinnedMessage.pinnedAt || Date.now()
        }
      : null;

  try {
    if (normalized) {
      localStorage.setItem(localKey, JSON.stringify(normalized));
    } else {
      localStorage.removeItem(localKey);
    }
  } catch {}

  realtimeSocket.setRoomPinnedMessage(roomId, normalized);

  liveChatBus?.postMessage({
    type: 'ROOM_PINNED_MESSAGE_UPDATE',
    roomId,
    pinnedMessage: normalized
  });

  if (rtdb) {
    try {
      const pinRef = ref(rtdb, `rooms_pinned/${roomId}`);
      if (normalized) {
        await set(pinRef, normalized);
      } else {
        await remove(pinRef);
      }
    } catch {}
  }
}

export function subscribeToRoomPinnedMessage(
  roomId: string,
  onUpdate: (pinnedMessage: PinnedRoomMessage | null) => void
): () => void {
  if (!roomId) return () => {};
  const localKey = `room_pinned_${roomId}`;
  let hasRemoteAuthoritativeUpdate = false;

  const saveLocal = (pin: PinnedRoomMessage | null) => {
    try {
      if (pin) {
        localStorage.setItem(localKey, JSON.stringify(pin));
      } else {
        localStorage.removeItem(localKey);
      }
    } catch {}
  };

  // Initial local cache hydration before remote listeners emit
  try {
    const cached = localStorage.getItem(localKey);
    if (cached && !hasRemoteAuthoritativeUpdate) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.content) {
        onUpdate(parsed);
      }
    }
  } catch {}

  const unsubSocket = realtimeSocket.subscribeToRoomPinnedMessage(roomId, (pin) => {
    hasRemoteAuthoritativeUpdate = true;
    saveLocal(pin);
    onUpdate(pin);
  });

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const pinRef = ref(rtdb, `rooms_pinned/${roomId}`);
      unsubRtdb = onValue(pinRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && val.content) {
          hasRemoteAuthoritativeUpdate = true;
          const pin = val as PinnedRoomMessage;
          saveLocal(pin);
          onUpdate(pin);
        } else if (hasRemoteAuthoritativeUpdate) {
          // Only clear if RTDB explicitly updates to empty after initial load
          saveLocal(null);
          onUpdate(null);
        }
      });
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_PINNED_MESSAGE_UPDATE' && e.data.roomId === roomId) {
      hasRemoteAuthoritativeUpdate = true;
      const pin = (e.data.pinnedMessage as PinnedRoomMessage | null) || null;
      saveLocal(pin);
      onUpdate(pin);
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    if (unsubRtdb) unsubRtdb();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// ==========================================
// 21. ROOM BACKGROUND THEME (WebSocket + RTDB + BroadcastChannel + localStorage)
// ==========================================
export async function setRoomBackgroundTheme(
  roomId: string,
  backgroundTheme: string
): Promise<void> {
  if (!roomId) return;
  const localKey = `room_bg_theme_${roomId}`;
  const normalized =
    typeof backgroundTheme === 'string' && backgroundTheme.trim() && backgroundTheme !== 'default'
      ? backgroundTheme.trim()
      : 'default';

  try {
    if (normalized === 'default') {
      localStorage.removeItem(localKey);
    } else {
      localStorage.setItem(localKey, normalized);
    }
  } catch {}

  realtimeSocket.updateRoomBackground(roomId, normalized);

  liveChatBus?.postMessage({
    type: 'ROOM_BACKGROUND_UPDATE',
    roomId,
    backgroundTheme: normalized
  });

  if (rtdb) {
    try {
      const bgRef = ref(rtdb, `rooms_background/${roomId}`);
      if (normalized === 'default') {
        await remove(bgRef);
      } else {
        await set(bgRef, {
          backgroundTheme: normalized,
          updatedAt: Date.now()
        });
      }
    } catch {}
  }
}

export function subscribeToRoomBackgroundTheme(
  roomId: string,
  onUpdate: (backgroundTheme: string) => void
): () => void {
  if (!roomId) return () => {};
  const localKey = `room_bg_theme_${roomId}`;
  let hasRemoteAuthoritativeUpdate = false;

  const saveLocal = (theme: string) => {
    try {
      if (!theme || theme === 'default') {
        localStorage.removeItem(localKey);
      } else {
        localStorage.setItem(localKey, theme);
      }
    } catch {}
  };

  try {
    const cached = localStorage.getItem(localKey);
    if (cached && !hasRemoteAuthoritativeUpdate) {
      onUpdate(cached);
    }
  } catch {}

  const unsubSocket = realtimeSocket.subscribeToRoomBackground(roomId, (theme) => {
    hasRemoteAuthoritativeUpdate = true;
    const normalized = theme || 'default';
    saveLocal(normalized);
    onUpdate(normalized);
  });

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const bgRef = ref(rtdb, `rooms_background/${roomId}`);
      unsubRtdb = onValue(bgRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && typeof val.backgroundTheme === 'string') {
          hasRemoteAuthoritativeUpdate = true;
          const theme = val.backgroundTheme || 'default';
          saveLocal(theme);
          onUpdate(theme);
        } else if (hasRemoteAuthoritativeUpdate) {
          saveLocal('default');
          onUpdate('default');
        }
      });
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_BACKGROUND_UPDATE' && e.data.roomId === roomId) {
      hasRemoteAuthoritativeUpdate = true;
      const theme = typeof e.data.backgroundTheme === 'string' ? e.data.backgroundTheme : 'default';
      saveLocal(theme);
      onUpdate(theme);
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    if (unsubRtdb) unsubRtdb();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// ==========================================
// 22. PRIVATE MEDIA SHARING (Firebase Storage + Compressed Image Fallback)
// ==========================================
async function compressImageToDataUrl(file: File, maxDim = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas unsupported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

function fileBlobToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPrivateChatMedia(
  file: File,
  convId: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; mediaType: 'image' | 'video' }> {
  const isVideo = file.type.startsWith('video/');
  const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Try Firebase Storage first with cache metadata & resumable progress
  if (storage) {
    try {
      const fileRef = storageRef(storage, `private_media/${convId}/${safeName}`);
      const url = await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, file, {
          contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          cacheControl: 'public, max-age=31536000',
        });
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            task.cancel();
          } catch {}
          reject(new Error('Storage upload timeout'));
        }, isVideo ? 20000 : 8000);
        task.on(
          'state_changed',
          (snapshot) => {
            if (onProgress && snapshot.totalBytes > 0) {
              onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            }
          },
          (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            reject(err);
          },
          async () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            try {
              const dl = await getDownloadURL(task.snapshot.ref);
              resolve(dl);
            } catch (e) {
              reject(e);
            }
          }
        );
      });
      return { url, mediaType };
    } catch (storageErr) {
      console.warn('Firebase Storage fallback notice:', storageErr);
    }
  }

  // Fast fallback for images when Storage CORS/rules block: reuse already-compressed Blob directly
  if (!isVideo) {
    const compressedUrl =
      file.size <= 350 * 1024 ? await fileBlobToDataUrl(file) : await compressImageToDataUrl(file);
    if (onProgress) onProgress(100);
    return { url: compressedUrl, mediaType: 'image' };
  }

  throw new Error('تعذر رفع الفيديو: يرجى التأكد من حجم الملف (< 15 ميجا) واتصال الإنترنت.');
}

// ==========================================
// 23. SOCIAL DATING FORUM (`forum_posts` + `comments`)
// ==========================================
const LOCAL_FORUM_KEY = 'shat_masr_forum_posts_v1';
const DELETED_FORUM_KEY = 'shat_masr_deleted_forum_posts_v1';

export function subscribeToForumPosts(
  onUpdate: (posts: ForumPost[]) => void,
  pageLimit: number = 20
): () => void {
  const filterDeleted = (list: ForumPost[]) => {
    const deleted = readDeletedIdsStorage(DELETED_FORUM_KEY);
    return list.filter((p) => p?.id && !deleted.has(p.id));
  };

  const readLocal = (): ForumPost[] => {
    try {
      const raw = localStorage.getItem(LOCAL_FORUM_KEY);
      const parsed: ForumPost[] = raw ? JSON.parse(raw) : [];
      return filterDeleted(parsed).slice(0, pageLimit);
    } catch {
      return [];
    }
  };
  const writeLocal = (list: ForumPost[]) => {
    try {
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(filterDeleted(list).slice(0, 80)));
    } catch {}
  };

  onUpdate(readLocal());

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'forum_posts'), orderBy('createdAt', 'desc'), limit(pageLimit));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const deleted = readDeletedIdsStorage(DELETED_FORUM_KEY);
          const list: ForumPost[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: data.id || d.id,
                authorId: data.authorId || '',
                authorName: data.authorName || 'عضو',
                authorAvatar: data.authorAvatar || '',
                authorGender: data.authorGender || 'male',
                authorCountryFlag: data.authorCountryFlag || '🇪🇬',
                authorVipBadge: data.authorVipBadge || '',
                authorRole: data.authorRole || 'member',
                authorVerified: Boolean(data.authorVerified || data.authorRole === 'owner'),
                text: data.text || '',
                imageUrl: data.imageUrl || undefined,
                isPinned: Boolean(data.isPinned),
                pinnedAt: typeof data.pinnedAt === 'number' ? data.pinnedAt : undefined,
                pinnedBy: data.pinnedBy || undefined,
                likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
                likedUsers: data.likedUsers && typeof data.likedUsers === 'object' ? data.likedUsers : {},
                likesCount: Number(data.likesCount) || (Array.isArray(data.likedBy) ? data.likedBy.length : 0),
                commentsCount: Number(data.commentsCount) || 0,
                viewsCount: Math.max(
                  Number(data.viewsCount) || 0,
                  data.viewers && typeof data.viewers === 'object' ? Object.keys(data.viewers).length : 0,
                  Array.isArray(data.viewedBy) ? data.viewedBy.length : 0
                ),
                viewedBy: Array.isArray(data.viewedBy) ? data.viewedBy : [],
                viewers: data.viewers && typeof data.viewers === 'object' ? data.viewers : {},
                mentions: Array.isArray(data.mentions) ? data.mentions : [],
                createdAt: resolveTimestampMs(data.createdAt) ?? Date.now()
              };
            })
            .filter((p) => !deleted.has(p.id));
          writeLocal(list);
          onUpdate(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'forum_posts');
        }
      );
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'FORUM_POSTS_CHANGED') {
      onUpdate(readLocal());
    }
  };
  const handleLocalSync = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.type === 'FORUM_POSTS_CHANGED') {
      onUpdate(readLocal());
    }
  };
  liveChatBus?.addEventListener('message', handleBus);
  if (typeof window !== 'undefined') {
    window.addEventListener('shat_masr_sync_event', handleLocalSync);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBus);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shat_masr_sync_event', handleLocalSync);
    }
  };
}

export async function recordForumPostView(postId: string, viewer: User | string): Promise<void> {
  const viewerId = typeof viewer === 'string' ? viewer : viewer?.id;
  if (!postId || !viewerId) return;

  const viewerName = typeof viewer === 'string' ? 'عضو شات مصر' : (viewer.name || 'عضو شات مصر');
  const viewerAvatar = typeof viewer === 'string' ? '' : (viewer.avatar || '');
  const viewerEntry = {
    id: viewerId,
    userId: viewerId,
    name: viewerName,
    avatar: viewerAvatar,
    viewedAt: Date.now()
  };

  let alreadyCountedOrOwner = false;
  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      const updated = list.map((p) => {
        if (p.id !== postId) return p;
        if (p.authorId === viewerId) {
          alreadyCountedOrOwner = true;
          return p;
        }
        const prevViewers = p.viewers || {};
        const viewedSet = new Set(p.viewedBy || []);
        if (prevViewers[viewerId] || viewedSet.has(viewerId)) {
          alreadyCountedOrOwner = true;
          return p;
        }
        viewedSet.add(viewerId);
        const nextViewers = { ...prevViewers, [viewerId]: viewerEntry };
        return {
          ...p,
          viewedBy: Array.from(viewedSet),
          viewers: nextViewers,
          viewsCount: Math.max((p.viewsCount || 0) + 1, Object.keys(nextViewers).length, viewedSet.size)
        };
      });
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(updated));
    }
  } catch {}

  if (alreadyCountedOrOwner) return;

  if (db) {
    try {
      const postRef = doc(db, 'forum_posts', postId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(postRef);
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data.authorId === viewerId) return;
        const existingViewers = (data.viewers && typeof data.viewers === 'object' ? data.viewers : {}) as Record<string, any>;
        const existingViewedBy: string[] = Array.isArray(data.viewedBy) ? data.viewedBy : [];
        if (existingViewers[viewerId] || existingViewedBy.includes(viewerId)) return;
        const nextCount =
          Math.max(Number(data.viewsCount) || 0, Object.keys(existingViewers).length, existingViewedBy.length) + 1;
        tx.update(postRef, {
          [`viewers.${viewerId}`]: viewerEntry,
          viewedBy: arrayUnion(viewerId),
          viewsCount: nextCount
        });
      });
    } catch {}
  }
}

export async function createForumPost(user: User, text: string, imageUrl?: string): Promise<ForumPost> {
  const id = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const mentionMatches = Array.from(text.matchAll(/@([^\s،.!؟]+)/g)).map((m) => m[1].trim()).filter(Boolean);
  const post: ForumPost = {
    id,
    authorId: user.id,
    authorName: user.name,
    authorAvatar: user.avatar || '',
    authorGender: user.gender || 'male',
    authorCountryFlag: user.countryFlag || '🇪🇬',
    authorVipBadge: user.vipBadge || '',
    authorRole: user.role || 'member',
    authorVerified: Boolean(user.verified || user.role === 'owner'),
    text: text.trim(),
    ...(imageUrl ? { imageUrl } : {}),
    isPinned: false,
    likedBy: [],
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    viewedBy: [],
    viewers: {},
    mentions: mentionMatches,
    createdAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    const list: ForumPost[] = raw ? JSON.parse(raw) : [];
    list.unshift(post);
    localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });
  if (mentionMatches.length > 0) {
    liveChatBus?.postMessage({
      type: 'FORUM_MENTION_ALERT',
      authorId: user.id,
      authorName: user.name,
      mentions: mentionMatches,
      postId: id
    });
  }

  if (db) {
    try {
      await setDoc(doc(db, 'forum_posts', id), post);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forum_posts/${id}`);
    }
  }
  return post;
}

export async function toggleForumPostPin(
  postId: string,
  isPinned: boolean,
  pinnedBy?: string
): Promise<void> {
  const nextPinState = Boolean(isPinned);
  const pinnedAt = nextPinState ? Date.now() : 0;

  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      const updated = list.map((p) =>
        p.id === postId
          ? {
              ...p,
              isPinned: nextPinState,
              pinnedAt: nextPinState ? pinnedAt : undefined,
              pinnedBy: nextPinState ? pinnedBy || 'الإدارة' : undefined,
            }
          : p
      );
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(updated));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });

  if (db) {
    try {
      await setDoc(
        doc(db, 'forum_posts', postId),
        {
          isPinned: nextPinState,
          pinnedAt: nextPinState ? pinnedAt : null,
          pinnedBy: nextPinState ? pinnedBy || 'الإدارة' : null,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `forum_posts/${postId}`);
    }
  }
}

export async function toggleForumPostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean,
  likerUser?: User,
  postAuthorId?: string
): Promise<void> {
  let resolvedAuthorId = postAuthorId || '';
  const likerSummary: ForumLikeUserSummary | null = likerUser
    ? {
        id: likerUser.id,
        name: likerUser.name || 'عضو شات مصر',
        avatar: likerUser.avatar || '',
        countryFlag: likerUser.countryFlag || '🇪🇬',
        role: likerUser.role || 'member',
        vipBadge: likerUser.vipBadge || '',
        gender: likerUser.gender || 'male'
      }
    : null;

  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      const updated = list.map((p) => {
        if (p.id !== postId) return p;
        if (!resolvedAuthorId && p.authorId) resolvedAuthorId = p.authorId;
        const setIds = new Set(p.likedBy || []);
        const nextLikedUsers = { ...(p.likedUsers || {}) };
        if (currentlyLiked) {
          setIds.delete(userId);
          delete nextLikedUsers[userId];
        } else {
          setIds.add(userId);
          if (likerSummary) {
            nextLikedUsers[userId] = likerSummary;
          }
        }
        const likedBy = Array.from(setIds);
        return { ...p, likedBy, likedUsers: nextLikedUsers, likesCount: likedBy.length };
      });
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(updated));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });

  if (db) {
    try {
      if (!resolvedAuthorId) {
        const postSnap = await getDoc(doc(db, 'forum_posts', postId)).catch(() => null);
        if (postSnap?.exists()) {
          const pData = postSnap.data() as any;
          if (pData?.authorId) resolvedAuthorId = String(pData.authorId);
        }
      }
      const updatePayload: Record<string, any> = {
        likedBy: currentlyLiked ? arrayRemove(userId) : arrayUnion(userId),
        likesCount: increment(currentlyLiked ? -1 : 1)
      };
      if (currentlyLiked) {
        updatePayload[`likedUsers.${userId}`] = deleteField();
      } else if (likerSummary) {
        updatePayload[`likedUsers.${userId}`] = likerSummary;
      }
      await updateDoc(doc(db, 'forum_posts', postId), updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `forum_posts/${postId}`);
    }
  }

  if (!currentlyLiked && resolvedAuthorId && resolvedAuthorId !== userId) {
    const actorName = likerUser?.name || 'عضو شات مصر';
    sendUserRealtimeNotification({
      targetUserId: resolvedAuthorId,
      actorId: userId,
      actorName,
      actorAvatar: likerUser?.avatar || '',
      kind: 'forum_like',
      message: `أعجب ${actorName} بمنشورك في المنتدى`,
      refId: postId
    }).catch(() => {});
  }
}

export function subscribeToForumComments(
  postId: string,
  onUpdate: (comments: ForumComment[]) => void
): () => void {
  const localKey = `shat_masr_forum_comments_${postId}`;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) onUpdate(JSON.parse(raw));
  } catch {}

  if (!db) return () => {};
  try {
    const q = query(collection(db, 'forum_posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list: ForumComment[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        }));
        try {
          localStorage.setItem(localKey, JSON.stringify(list));
        } catch {}
        onUpdate(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `forum_posts/${postId}/comments`);
      }
    );
  } catch {
    return () => {};
  }
}

export async function addForumComment(
  postId: string,
  user: User,
  text: string,
  postAuthorId?: string
): Promise<ForumComment> {
  const id = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const comment: ForumComment = {
    id,
    postId,
    authorId: user.id,
    authorName: user.name,
    authorAvatar: user.avatar || '',
    text: text.trim(),
    createdAt: Date.now()
  };

  let resolvedAuthorId = postAuthorId || '';
  if (!resolvedAuthorId) {
    try {
      const rawPosts = localStorage.getItem(LOCAL_FORUM_KEY);
      if (rawPosts) {
        const list: ForumPost[] = JSON.parse(rawPosts);
        const found = list.find((p) => p.id === postId);
        if (found?.authorId) resolvedAuthorId = found.authorId;
      }
    } catch {}
  }

  const localKey = `shat_masr_forum_comments_${postId}`;
  try {
    const raw = localStorage.getItem(localKey);
    const list: ForumComment[] = raw ? JSON.parse(raw) : [];
    list.push(comment);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  if (db) {
    try {
      if (!resolvedAuthorId) {
        const postSnap = await getDoc(doc(db, 'forum_posts', postId)).catch(() => null);
        if (postSnap?.exists()) {
          const pData = postSnap.data() as any;
          if (pData?.authorId) resolvedAuthorId = String(pData.authorId);
        }
      }
      await setDoc(doc(db, 'forum_posts', postId, 'comments', id), comment);
      await updateDoc(doc(db, 'forum_posts', postId), {
        commentsCount: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forum_posts/${postId}/comments/${id}`);
    }
  }

  if (resolvedAuthorId && resolvedAuthorId !== user.id) {
    sendUserRealtimeNotification({
      targetUserId: resolvedAuthorId,
      actorId: user.id,
      actorName: user.name || 'عضو شات مصر',
      actorAvatar: user.avatar || '',
      kind: 'forum_comment',
      message: `علق ${user.name || 'عضو شات مصر'} على منشورك في المنتدى`,
      refId: postId
    }).catch(() => {});
  }

  return comment;
}

export async function deleteForumPost(postId: string): Promise<void> {
  if (!postId) return;
  persistDeletedIdStorage(DELETED_FORUM_KEY, postId);
  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(list.filter(p => p.id !== postId)));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shat_masr_sync_event', { detail: { type: 'FORUM_POSTS_CHANGED' } }));
  }
  if (db) {
    try {
      const commentsSnap = await getDocs(collection(db, 'forum_posts', postId, 'comments')).catch(() => null);
      if (commentsSnap && !commentsSnap.empty) {
        await Promise.all(commentsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      }
      await deleteDoc(doc(db, 'forum_posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `forum_posts/${postId}`);
    }
  }
}

// ==========================================
// 24. SHARED DAILY ROOM MISSIONS (`room_daily_missions`)
// ==========================================
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultSharedMissions(): SharedRoomMission[] {
  const dateKey = getTodayKey();
  return [
    {
      id: `shared_msgs_${dateKey}`,
      dateKey,
      title: 'تحدي المجلس النشيط 💬',
      description: 'تعاونوا معاً لإرسال 30 رسالة ترحيب ومشاركة في الغرف اليوم',
      icon: '💬',
      currentProgress: 6,
      targetProgress: 30,
      rewardCoins: 150,
      rewardVipLabel: 'عضوية VIP مؤقتة 24 ساعة',
      contributors: [],
      claimedBy: [],
      updatedAt: Date.now()
    },
    {
      id: `shared_likes_${dateKey}`,
      dateKey,
      title: 'حملة التفاعل والإعجابات ❤️',
      description: 'اجمعوا 15 تفاعل وقلب مشترك على رسائل الأعضاء والمنتدى',
      icon: '❤️',
      currentProgress: 4,
      targetProgress: 15,
      rewardCoins: 100,
      rewardVipLabel: 'شارة متفاعل ذهبي',
      contributors: [],
      claimedBy: [],
      updatedAt: Date.now()
    },
    {
      id: `shared_forum_${dateKey}`,
      dateKey,
      title: 'روح التعارف والضيافة 🌸',
      description: 'شاركوا في 10 منشورات أو تعليقات تعارف راقية اليوم',
      icon: '🌸',
      currentProgress: 2,
      targetProgress: 10,
      rewardCoins: 200,
      rewardVipLabel: 'VIP فضي ليوم واحد',
      contributors: [],
      claimedBy: [],
      updatedAt: Date.now()
    }
  ];
}

function readLocalClaimedMissionUsersMap(dateKey: string): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`shat_masr_shared_claims_map_${dateKey}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mergeLocalMissionClaims(list: SharedRoomMission[], dateKey: string): SharedRoomMission[] {
  const claimsMap = readLocalClaimedMissionUsersMap(dateKey);
  return list.map((m) => {
    const localClaimers = claimsMap[m.id] || [];
    if (localClaimers.length === 0) return m;
    return {
      ...m,
      claimedBy: Array.from(new Set([...(m.claimedBy || []), ...localClaimers])),
    };
  });
}

export function subscribeToSharedRoomMissions(
  onUpdate: (missions: SharedRoomMission[]) => void
): () => void {
  const dateKey = getTodayKey();
  const localKey = `shat_masr_shared_missions_${dateKey}`;

  const getLocal = (): SharedRoomMission[] => {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeLocalMissionClaims(parsed, dateKey);
        }
      }
    } catch {}
    const defaults = mergeLocalMissionClaims(getDefaultSharedMissions(), dateKey);
    try {
      localStorage.setItem(localKey, JSON.stringify(defaults));
    } catch {}
    return defaults;
  };

  onUpdate(getLocal());

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'room_daily_missions'), where('dateKey', '==', dateKey));
      unsubFirestore = onSnapshot(
        q,
        async (snap) => {
          if (snap.empty) {
            const defaults = mergeLocalMissionClaims(getDefaultSharedMissions(), dateKey);
            for (const m of defaults) {
              setDoc(doc(db!, 'room_daily_missions', m.id), m, { merge: true }).catch(() => {});
            }
            onUpdate(defaults);
            return;
          }
          const rawList: SharedRoomMission[] = snap.docs.map(d => d.data() as SharedRoomMission);
          const list = mergeLocalMissionClaims(rawList, dateKey);
          try {
            localStorage.setItem(localKey, JSON.stringify(list));
          } catch {}
          onUpdate(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'room_daily_missions');
        }
      );
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'SHARED_MISSIONS_CHANGED') {
      onUpdate(getLocal());
    }
  };
  const handleLocalSync = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.type === 'SHARED_MISSIONS_CHANGED') {
      onUpdate(getLocal());
    }
  };
  liveChatBus?.addEventListener('message', handleBus);
  if (typeof window !== 'undefined') {
    window.addEventListener('shat_masr_sync_event', handleLocalSync);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBus);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shat_masr_sync_event', handleLocalSync);
    }
  };
}

export async function contributeToSharedRoomMission(
  missionType: 'messages' | 'likes' | 'forum',
  userId: string,
  amount: number = 1
): Promise<void> {
  const dateKey = getTodayKey();
  const missionId =
    missionType === 'messages'
      ? `shared_msgs_${dateKey}`
      : missionType === 'likes'
      ? `shared_likes_${dateKey}`
      : `shared_forum_${dateKey}`;
  const localKey = `shat_masr_shared_missions_${dateKey}`;

  try {
    const raw = localStorage.getItem(localKey);
    const list: SharedRoomMission[] = raw ? JSON.parse(raw) : getDefaultSharedMissions();
    const updated = list.map((m) => {
      if (m.id !== missionId) return m;
      const contribSet = new Set(m.contributors || []);
      contribSet.add(userId);
      return {
        ...m,
        currentProgress: Math.min(m.targetProgress, (m.currentProgress || 0) + amount),
        contributors: Array.from(contribSet),
        updatedAt: Date.now()
      };
    });
    localStorage.setItem(localKey, JSON.stringify(updated));
    liveChatBus?.postMessage({ type: 'SHARED_MISSIONS_CHANGED' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shat_masr_sync_event', { detail: { type: 'SHARED_MISSIONS_CHANGED' } }));
    }
  } catch {}

  if (db) {
    try {
      const mRef = doc(db, 'room_daily_missions', missionId);
      await setDoc(
        mRef,
        {
          currentProgress: increment(amount),
          contributors: arrayUnion(userId),
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch {}
  }
}

export async function claimSharedMissionReward(missionId: string, userId: string): Promise<void> {
  const dateKey = getTodayKey();
  const localKey = `shat_masr_shared_missions_${dateKey}`;

  try {
    const claimsMap = readLocalClaimedMissionUsersMap(dateKey);
    const prev = Array.isArray(claimsMap[missionId]) ? claimsMap[missionId] : [];
    claimsMap[missionId] = Array.from(new Set([...prev, userId]));
    localStorage.setItem(`shat_masr_shared_claims_map_${dateKey}`, JSON.stringify(claimsMap));
  } catch {}

  try {
    const raw = localStorage.getItem(localKey);
    const list: SharedRoomMission[] = raw ? JSON.parse(raw) : getDefaultSharedMissions();
    const updated = list.map(m =>
      m.id === missionId
        ? { ...m, claimedBy: Array.from(new Set([...(m.claimedBy || []), userId])) }
        : m
    );
    localStorage.setItem(localKey, JSON.stringify(updated));
    liveChatBus?.postMessage({ type: 'SHARED_MISSIONS_CHANGED' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shat_masr_sync_event', { detail: { type: 'SHARED_MISSIONS_CHANGED' } }));
    }
  } catch {}

  if (db) {
    try {
      await setDoc(
        doc(db, 'room_daily_missions', missionId),
        { claimedBy: arrayUnion(userId) },
        { merge: true }
      );
    } catch {}
  }
}

// ==========================================
// 25. USER REPORTS (`user_reports`) & ADMIN TOOLS
// ==========================================
const LOCAL_REPORTS_KEY = 'shat_masr_user_reports_v1';

export async function submitUserReport(report: Omit<UserReport, 'id' | 'status'>): Promise<UserReport & { autoMuted?: boolean }> {
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const full: UserReport = {
    ...report,
    id,
    status: 'pending'
  };

  let localCountForTarget = 0;
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    const list: UserReport[] = raw ? JSON.parse(raw) : [];
    list.unshift(full);
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(list.slice(0, 150)));
    localCountForTarget = list.filter(
      (r) => r.reportedUserId === report.reportedUserId && r.status !== 'dismissed'
    ).length;
  } catch {}

  realtimeSocket.sendUserReport(full);
  liveChatBus?.postMessage({ type: 'USER_REPORTS_CHANGED' });

  let fsCountForTarget = localCountForTarget;
  if (db) {
    try {
      await setDoc(doc(db, 'user_reports', id), full);
      const q = query(
        collection(db, 'user_reports'),
        where('reportedUserId', '==', report.reportedUserId),
        limit(10)
      );
      const snap = await getDocs(q);
      fsCountForTarget = Math.max(
        localCountForTarget,
        snap.docs.filter((d) => d.data()?.status !== 'dismissed').length
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `user_reports/${id}`);
    }
  }

  // Auto-mute on 3+ reports pending moderator review
  let autoMuted = false;
  if (fsCountForTarget >= 3 && report.reportedUserId) {
    autoMuted = true;
    await adminUpdateUser(report.reportedUserId, { isMuted: true }).catch(() => {});
  }

  return { ...full, autoMuted };
}

export function subscribeToUserReports(onUpdate: (reports: UserReport[]) => void): () => void {
  const reportsMap = new Map<string, UserReport>();
  const emit = () => {
    const sorted = Array.from(reportsMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    onUpdate(sorted);
  };

  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (raw) {
      (JSON.parse(raw) as UserReport[]).forEach(r => {
        if (r && r.id) reportsMap.set(r.id, r);
      });
    }
  } catch {}
  emit();

  if (typeof fetch === 'function') {
    fetch('/api/admin/reports')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (Array.isArray(data?.reports)) {
          data.reports.forEach((r: UserReport) => {
            if (r && r.id) reportsMap.set(r.id, r);
          });
          emit();
        }
      })
      .catch(() => {});
  }

  const unsubWs = realtimeSocket.subscribeToAdminReports((r: UserReport) => {
    if (r && r.id) {
      reportsMap.set(r.id, r);
      emit();
    }
  });

  let unsubFs: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'user_reports'), orderBy('timestamp', 'desc'), limit(100));
      unsubFs = onSnapshot(
        q,
        (snap) => {
          snap.docs.forEach(d => {
            const data = d.data() as UserReport;
            reportsMap.set(d.id, { ...data, id: data.id || d.id });
          });
          emit();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'user_reports');
        }
      );
    } catch {}
  }

  return () => {
    unsubWs();
    if (unsubFs) unsubFs();
  };
}

export async function resolveUserReportStatus(reportId: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (raw) {
      const list: UserReport[] = JSON.parse(raw);
      localStorage.setItem(
        LOCAL_REPORTS_KEY,
        JSON.stringify(list.map(r => (r.id === reportId ? { ...r, status } : r)))
      );
    }
  } catch {}

  if (db) {
    try {
      await updateDoc(doc(db, 'user_reports', reportId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `user_reports/${reportId}`);
    }
  }
}

// ==========================================
// 26. GOD MODE & OWNER-ONLY SECRET PM INSPECTOR
// ==========================================
export async function purgeRoomMessages(roomId: string): Promise<void> {
  try {
    localStorage.removeItem(`messages_room_${roomId}`);
  } catch {}
  realtimeSocket.sendClearRoomMessages(roomId);

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'rooms', roomId, 'messages'));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId}/messages`);
    }
  }
}

export interface SecretDirectChatThread {
  chatId: string;
  participants: string[];
  lastMessage: string;
  lastSenderId?: string;
  lastSenderName?: string;
  lastTimestamp: number;
}

function isPrimaryOwnerAuthorized(ownerEmailOrFlag: string | boolean | undefined): boolean {
  if (ownerEmailOrFlag === true) return true;
  if (
    typeof ownerEmailOrFlag === 'string' &&
    ownerEmailOrFlag.toLowerCase().trim() === PRIMARY_OWNER_EMAIL.toLowerCase()
  ) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const savedEmail = (localStorage.getItem('arab_chat_auth_email') || '').toLowerCase().trim();
      if (savedEmail === PRIMARY_OWNER_EMAIL.toLowerCase()) return true;
      const savedRaw = localStorage.getItem('arab_chat_user');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed?.email?.toLowerCase().trim() === PRIMARY_OWNER_EMAIL.toLowerCase()) return true;
        if (parsed?.role === 'owner') return true;
      }
    } catch {}
  }
  return false;
}

export function subscribeAllDirectChatsForOwner(
  ownerEmail: string | boolean | undefined,
  onUpdate: (threads: SecretDirectChatThread[]) => void
): () => void {
  if (!isPrimaryOwnerAuthorized(ownerEmail)) {
    onUpdate([]);
    return () => {};
  }

  const threadsMap = new Map<string, SecretDirectChatThread>();
  const emit = () => {
    const list = Array.from(threadsMap.values()).sort(
      (a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0)
    );
    onUpdate(list);
  };

  if (typeof fetch === 'function') {
    fetch('/api/admin/direct-chats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.threads)) {
          data.threads.forEach((t: any) => {
            if (t?.chatId) {
              threadsMap.set(t.chatId, {
                chatId: t.chatId,
                participants: Array.isArray(t.participants) ? t.participants : [],
                lastMessage: t.lastMessage || '',
                lastSenderId: t.lastSenderId,
                lastSenderName: t.lastSenderName,
                lastTimestamp: Number(t.lastTimestamp) || Date.now()
              });
            }
          });
          emit();
        }
      })
      .catch(() => {});
  }

  const unsubSocket = realtimeSocket.subscribeToGlobalDirectMessages((msg, convId) => {
    if (!convId || !msg) return;
    const prev = threadsMap.get(convId);
    const participants = Array.from(
      new Set([
        ...(prev?.participants || []),
        msg.senderId,
        msg.recipientId
      ].filter(Boolean) as string[])
    );
    threadsMap.set(convId, {
      chatId: convId,
      participants,
      lastMessage: msg.content || msg.text || prev?.lastMessage || 'رسالة خاصة',
      lastSenderId: msg.senderId,
      lastSenderName: msg.senderName,
      lastTimestamp: Number(msg.timestamp) || Date.now()
    });
    emit();
  });

  let unsubFirestore: (() => void) | null = null;

  const ingestOwnerThreads = (snap: any) => {
    snap.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
      const data = d.data({ serverTimestamps: 'estimate' }) || {};
      const fallbackParticipants = d.id.includes('_') ? d.id.split('_').filter(Boolean) : [];
      const participants =
        Array.isArray(data.participants) && data.participants.length > 0
          ? data.participants.filter(Boolean)
          : fallbackParticipants;
      const nextTs =
        resolveTimestampMs(data.updatedAt) ??
        resolveTimestampMs(data.lastTimestamp) ??
        Date.now();
      const prev = threadsMap.get(d.id);
      if (!prev || nextTs >= prev.lastTimestamp) {
        threadsMap.set(d.id, {
          chatId: data.chatId || d.id,
          participants,
          lastMessage: data.lastMessage || '',
          lastSenderId: data.lastSenderId,
          lastSenderName: data.lastSenderName,
          lastTimestamp: nextTs
        });
      }
    });
    emit();
  };

  if (db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, 'privateChats'),
        ingestOwnerThreads,
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'privateChats');
        }
      );
    } catch {}
  }

  return () => {
    unsubSocket();
    if (unsubFirestore) unsubFirestore();
  };
}

export function subscribeDirectMessagesSilentForOwner(
  chatId: string,
  ownerEmail: string | boolean | undefined,
  onMessages: (messages: Message[]) => void
): () => void {
  if (!isPrimaryOwnerAuthorized(ownerEmail) || !chatId || !db) {
    onMessages([]);
    return () => {};
  }

  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      query(collection(db, 'privateChats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        const list = [...snap.docs]
          .reverse()
          .map((d) => mapFirestoreDirectMessage(d))
          .sort((a, b) => (a.createdAt || a.timestamp || 0) - (b.createdAt || b.timestamp || 0));
        onMessages(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `privateChats/${chatId}/messages`);
        onMessages([]);
      }
    );
  } catch {
    onMessages([]);
  }

  return () => {
    if (unsub) unsub();
  };
}

// ==========================================
// 25. ROOM LOCK SETTINGS (Firestore + RTDB + WebSocket + BroadcastChannel + localStorage)
// ==========================================
export async function setRoomLockState(
  roomId: string,
  isLocked: boolean,
  updatedBy?: string
): Promise<void> {
  if (!roomId) return;
  const nextLocked = Boolean(isLocked);
  const localKey = `room_lock_${roomId}`;

  try {
    if (nextLocked) {
      localStorage.setItem(localKey, 'true');
    } else {
      localStorage.removeItem(localKey);
    }
  } catch {}

  realtimeSocket.updateRoomLock(roomId, nextLocked);

  liveChatBus?.postMessage({
    type: 'ROOM_LOCK_UPDATE',
    roomId,
    isLocked: nextLocked
  });

  if (rtdb) {
    try {
      const lockRef = ref(rtdb, `rooms_lock/${roomId}`);
      if (nextLocked) {
        await set(lockRef, {
          isLocked: true,
          updatedBy: updatedBy || 'admin',
          updatedAt: Date.now()
        });
      } else {
        await remove(lockRef);
      }
    } catch {}
  }

  if (db) {
    try {
      await setDoc(
        doc(db, 'rooms', roomId),
        {
          roomId,
          isLocked: nextLocked,
          updatedBy: updatedBy || 'admin',
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}`);
    }
  }
}

export function subscribeToRoomLockState(
  roomId: string,
  onUpdate: (isLocked: boolean) => void
): () => void {
  if (!roomId) return () => {};
  const localKey = `room_lock_${roomId}`;

  const saveLocal = (locked: boolean) => {
    try {
      if (locked) {
        localStorage.setItem(localKey, 'true');
      } else {
        localStorage.removeItem(localKey);
      }
    } catch {}
  };

  try {
    const cached = localStorage.getItem(localKey);
    if (cached === 'true') {
      onUpdate(true);
    }
  } catch {}

  const unsubSocket = realtimeSocket.subscribeToRoomLock(roomId, (locked) => {
    saveLocal(Boolean(locked));
    onUpdate(Boolean(locked));
  });

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const lockRef = ref(rtdb, `rooms_lock/${roomId}`);
      unsubRtdb = onValue(lockRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object' && typeof val.isLocked === 'boolean') {
          saveLocal(val.isLocked);
          onUpdate(val.isLocked);
        } else if (val === null) {
          saveLocal(false);
          onUpdate(false);
        }
      });
    } catch {}
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, 'rooms', roomId),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (typeof data?.isLocked === 'boolean') {
              saveLocal(data.isLocked);
              onUpdate(data.isLocked);
            }
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
        }
      );
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_LOCK_UPDATE' && e.data.roomId === roomId) {
      const nextLocked = Boolean(e.data.isLocked);
      saveLocal(nextLocked);
      onUpdate(nextLocked);
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    if (unsubRtdb) unsubRtdb();
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// Shared Firestore `rooms` collection multiplexer (locks + lastMessages share 1 Watch target)
type RoomsDocMapListener = (docsById: Map<string, Record<string, any>>) => void;
const sharedFsRoomsListeners = new Set<RoomsDocMapListener>();
const sharedFsRoomsCache = new Map<string, Record<string, any>>();
let sharedFsRoomsUnsub: (() => void) | null = null;
let sharedFsRoomsHasInitial = false;

function subscribeSharedFirestoreRooms(listener: RoomsDocMapListener): () => void {
  sharedFsRoomsListeners.add(listener);
  if (sharedFsRoomsHasInitial) {
    try {
      listener(new Map(sharedFsRoomsCache));
    } catch {}
  }
  if (!sharedFsRoomsUnsub && db) {
    try {
      sharedFsRoomsUnsub = onSnapshot(
        collection(db, 'rooms'),
        (snap) => {
          sharedFsRoomsHasInitial = true;
          sharedFsRoomsCache.clear();
          snap.docs.forEach((d) => {
            sharedFsRoomsCache.set(d.id, d.data() || {});
          });
          sharedFsRoomsListeners.forEach((cb) => {
            try {
              cb(new Map(sharedFsRoomsCache));
            } catch {}
          });
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'rooms');
        }
      );
    } catch {}
  }
  return () => {
    sharedFsRoomsListeners.delete(listener);
    if (sharedFsRoomsListeners.size === 0 && sharedFsRoomsUnsub) {
      sharedFsRoomsUnsub();
      sharedFsRoomsUnsub = null;
      sharedFsRoomsHasInitial = false;
      sharedFsRoomsCache.clear();
    }
  };
}

export function subscribeToAllRoomLocks(
  onUpdate: (locks: Record<string, boolean>) => void
): () => void {
  const merged: Record<string, boolean> = {};

  const emit = () => {
    onUpdate({ ...merged });
  };

  try {
    ['room_egypt', 'room_egypt2'].forEach((rId) => {
      if (localStorage.getItem(`room_lock_${rId}`) === 'true') {
        merged[rId] = true;
      }
    });
    if (Object.keys(merged).length > 0) emit();
  } catch {}

  const unsubSocket = realtimeSocket.subscribeToAllRoomLocks((locks) => {
    Object.keys(merged).forEach((k) => {
      if (!locks[k]) delete merged[k];
    });
    Object.entries(locks).forEach(([rId, val]) => {
      if (val) merged[rId] = true;
      else delete merged[rId];
    });
    emit();
  });

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const locksRef = ref(rtdb, 'rooms_lock');
      unsubRtdb = onValue(locksRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([rId, entry]: [string, any]) => {
            if (entry && entry.isLocked === true) {
              merged[rId] = true;
              try { localStorage.setItem(`room_lock_${rId}`, 'true'); } catch {}
            } else {
              delete merged[rId];
              try { localStorage.removeItem(`room_lock_${rId}`); } catch {}
            }
          });
        } else {
          Object.keys(merged).forEach((rId) => {
            delete merged[rId];
            try { localStorage.removeItem(`room_lock_${rId}`); } catch {}
          });
        }
        emit();
      });
    } catch {}
  }

  const unsubFirestore = subscribeSharedFirestoreRooms((docsById) => {
    docsById.forEach((data, roomId) => {
      if (typeof data?.isLocked === 'boolean') {
        if (data.isLocked) {
          merged[roomId] = true;
          try { localStorage.setItem(`room_lock_${roomId}`, 'true'); } catch {}
        } else {
          delete merged[roomId];
          try { localStorage.removeItem(`room_lock_${roomId}`); } catch {}
        }
      }
    });
    emit();
  });

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_LOCK_UPDATE' && e.data.roomId) {
      if (e.data.isLocked) {
        merged[e.data.roomId] = true;
      } else {
        delete merged[e.data.roomId];
      }
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    if (unsubRtdb) unsubRtdb();
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// ==========================================
// 26. REALTIME HEALTH MONITOR & TOP 10 LEADERBOARD
// ==========================================
export function subscribeToRealtimeFirestoreHealth(
  onHealth: (health: { ok: boolean; latencyMs: number; projectId: string; timestamp: number }) => void
): () => void {
  if (!db) {
    onHealth({ ok: false, latencyMs: 0, projectId: firebaseConfig.projectId, timestamp: Date.now() });
    return () => {};
  }

  const start = Date.now();
  const statsDocRef = doc(db, 'stats', 'visitors');
  return onSnapshot(
    statsDocRef,
    { includeMetadataChanges: true },
    (snap) => {
      onHealth({
        ok: true,
        latencyMs: Math.max(1, Date.now() - start),
        projectId: firebaseConfig.projectId,
        timestamp: Date.now(),
      });
    },
    (err) => {
      console.warn('Firestore realtime health listener error:', err);
      onHealth({
        ok: false,
        latencyMs: Math.max(1, Date.now() - start),
        projectId: firebaseConfig.projectId,
        timestamp: Date.now(),
      });
    }
  );
}

export function subscribeToLeaderboardUsers(
  onLeaderboard: (leaders: User[]) => void
): () => void {
  const scoreFor = (u: User) =>
    (Number(u.ratingPoints) || 0) +
    Math.floor((Number(u.coins) || 0) / 25) +
    (Number(u.giftsReceivedCount) || 0) * 15;

  const userMap = new Map<string, User>();
  const rtdbOnlineSet = new Set<string>();
  const emitSorted = () => {
    const list = Array.from(userMap.values())
      .filter((u) => u && u.id && !u.isBanned && u.id !== 'system_bot')
      .map((u) => ({
        ...u,
        isOnline: rtdbOnlineSet.has(u.id),
        status: (rtdbOnlineSet.has(u.id) ? (u.status === 'offline' ? 'online' : u.status) : 'offline') as User['status']
      }))
      .sort((a, b) => scoreFor(b) - scoreFor(a))
      .slice(0, 15);
    onLeaderboard(list);
  };

  let unsubUsers: (() => void) | null = null;

  if (db) {
    try {
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            userMap.set(docSnap.id, {
              ...userMap.get(docSnap.id),
              id: docSnap.id,
              name: d.name || 'عضو',
              username: d.username || 'user',
              avatar: d.avatar || '',
              countryFlag: d.countryFlag || '🇪🇬',
              country: d.country || 'مصر',
              role: d.role || 'member',
              vipBadge: d.vipBadge || '',
              coins: Number(d.coins) || 0,
              ratingPoints: Number(d.ratingPoints) || 0,
              giftsReceivedCount: Number(d.giftsReceivedCount) || 0,
              level: Number(d.level) || 1,
              isBanned: Boolean(d.isBanned),
              status: d.status || 'online',
            } as User);
          });
          emitSorted();
        },
        (err) => {
          console.warn('Firestore leaderboard users onSnapshot notice:', err);
        }
      );
    } catch (e) {
      console.warn('Leaderboard subscription setup notice:', e);
    }
  }

  const unsubPresence = subscribeSharedRtdbPresence((val) => {
    const now = getServerNowMs();
    rtdbOnlineSet.clear();
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([uid, uData]: [string, any]) => {
        if (!uData || typeof uData !== 'object') return;
        const seen = resolveTimestampMs(uData.lastSeen ?? uData.lastSeenMs) || 0;
        if (uData.isOnline === true && uData.status !== 'offline' && seen > 0 && now - seen <= PRESENCE_OFFLINE_TIMEOUT_MS) {
          rtdbOnlineSet.add(uid);
        }
      });
    }
    emitSorted();
  });

  return () => {
    if (unsubUsers) unsubUsers();
    unsubPresence();
  };
}

// ==========================================
// 27. LIVE ROOM LAST MESSAGES, GIFT STATS, PROFILE SYNC PROPAGATION & APP UPDATE NOTICES
// ==========================================

export type RoomLastMessageMap = Record<string, { senderName: string; content: string; type?: string; timestamp: number }>;

export function subscribeToAllRoomLastMessages(
  onUpdate: (lastMessages: RoomLastMessageMap) => void
): () => void {
  const merged: RoomLastMessageMap = {};

  const emit = () => {
    onUpdate({ ...merged });
  };

  const mergeEntry = (
    roomId: string,
    entry?: { senderName: string; content: string; type?: string; timestamp: number } | null
  ) => {
    if (!roomId || !entry || !entry.content) return;
    const prev = merged[roomId];
    if (!prev || (entry.timestamp || 0) >= (prev.timestamp || 0)) {
      merged[roomId] = entry;
    }
  };

  const unsubSocket = realtimeSocket.subscribeToAllRoomLastMessages((wsMap) => {
    Object.entries(wsMap).forEach(([rId, entry]) => mergeEntry(rId, entry));
    emit();
  });

  const unsubFirestore = subscribeSharedFirestoreRooms((docsById) => {
    docsById.forEach((data, roomId) => {
      if (data?.lastMessage) mergeEntry(roomId, data.lastMessage);
    });
    emit();
  });

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_LAST_MESSAGE_UPDATED' && e.data.roomId && e.data.lastMessage) {
      mergeEntry(e.data.roomId, e.data.lastMessage);
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    if (unsubFirestore) unsubFirestore();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

export async function recordGiftRecipientStats(recipientId: string, giftCost: number): Promise<void> {
  if (!recipientId) return;
  const ratingGain = Math.max(10, Math.round((Number(giftCost) || 0) / 2));

  if (db) {
    try {
      await setDoc(
        doc(db, 'users', recipientId),
        {
          giftsReceivedCount: increment(1),
          ratingPoints: increment(ratingGain),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch {}
  }

  if (rtdb) {
    try {
      const userSnap = await get(ref(rtdb, `users/${recipientId}`));
      if (userSnap.exists()) {
        const d = userSnap.val();
        await update(ref(rtdb, `users/${recipientId}`), {
          giftsReceivedCount: (Number(d.giftsReceivedCount) || 0) + 1,
          ratingPoints: (Number(d.ratingPoints) || 0) + ratingGain
        });
      }
    } catch {}
  }
}

export async function propagateUserIdentityAcrossApp(user: User): Promise<void> {
  if (!user?.id) return;
  await syncUserProfileToFirebase(user);
  realtimeSocket.updateProfile(user);

  if (db) {
    try {
      const q = query(collection(db, 'forum_posts'), where('authorId', '==', user.id), limit(25));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((d) =>
          updateDoc(d.ref, {
            authorName: user.name,
            authorAvatar: user.avatar || '',
            authorVipBadge: user.vipBadge || '',
            authorRole: user.role || 'member'
          }).catch(() => {})
        )
      );
    } catch {}
  }
}

export interface AppUpdateNotice {
  version: string;
  message: string;
  pushedBy: string;
  timestamp: number;
}

export async function pushAppUpdateNotice(
  pushedBy: string,
  customMessage?: string
): Promise<AppUpdateNotice> {
  const notice: AppUpdateNotice = {
    version: `v${Date.now()}`,
    message:
      (customMessage || '').trim() ||
      'يتوفر تحديث جديد الآن لتطبيق شات مصر! اضغط تحديث للحصول على أحدث التحسينات.',
    pushedBy: pushedBy || 'الإدارة',
    timestamp: Date.now()
  };

  realtimeSocket.sendAppUpdateNotice(notice);

  if (rtdb) {
    try {
      await set(ref(rtdb, 'app_config/version'), notice);
    } catch {}
  }

  if (db) {
    try {
      await setDoc(doc(db, 'app_config', 'version'), notice, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'app_config/version');
    }
  }

  return notice;
}

export function subscribeToAppUpdateNotices(
  onNotice: (notice: AppUpdateNotice) => void
): () => void {
  const mountTime = Date.now();
  let lastSeenVersion = '';

  const deliver = (notice?: AppUpdateNotice | null) => {
    if (!notice || !notice.version || notice.version === lastSeenVersion) return;
    // Only notify on live updates pushed around or after client load (within 60s grace)
    if ((notice.timestamp || 0) < mountTime - 60_000) return;
    lastSeenVersion = notice.version;
    onNotice(notice);
  };

  const unsubSocket = realtimeSocket.subscribeToAppUpdateNotices((notice) => deliver(notice));

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, 'app_config', 'version'),
        (snap) => {
          if (snap.exists()) {
            deliver(snap.data() as AppUpdateNotice);
          }
        },
        () => {}
      );
    } catch {}
  }

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      unsubRtdb = onValue(ref(rtdb, 'app_config/version'), (snap) => {
        const val = snap.val();
        if (val) deliver(val as AppUpdateNotice);
      });
    } catch {}
  }

  return () => {
    unsubSocket();
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
  };
}

// ==========================================
// 20. CROSS-DEVICE RELIABLE WEBRTC CALL SIGNALING (Firestore + RTDB Relay)
// ==========================================
export async function sendFirestoreCallSignal(targetUserId: string, signal: any): Promise<void> {
  if (!targetUserId || !signal) return;
  const signalId = signal.signalId || `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = getServerNowMs();
  const rawPayload = {
    ...signal,
    signalId,
    targetUserId,
    createdAt: now,
    createdAtMs: now,
    expiresAt: now + 90_000,
  };
  let sanitizedPayload: Record<string, any> = rawPayload;
  try {
    sanitizedPayload = JSON.parse(JSON.stringify(rawPayload));
  } catch {}

  const tasks: Promise<any>[] = [];
  if (rtdb) {
    tasks.push(
      set(ref(rtdb, `call_signals/${targetUserId}/${signalId}`), sanitizedPayload).catch(() => {})
    );
  }
  if (db) {
    tasks.push(
      setDoc(doc(db, 'users', targetUserId, 'call_signals', signalId), sanitizedPayload).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `users/${targetUserId}/call_signals/${signalId}`);
      })
    );
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export async function deleteFirestoreCallSignal(userId: string, signalId: string): Promise<void> {
  if (!userId || !signalId) return;
  if (db) {
    deleteDoc(doc(db, 'users', userId, 'call_signals', signalId)).catch(() => {});
  }
  if (rtdb) {
    remove(ref(rtdb, `call_signals/${userId}/${signalId}`)).catch(() => {});
  }
}

export interface LocalActiveCallInfo {
  callId: string;
  userId: string;
  peerId: string;
  callType: 'audio' | 'video';
  expiresAt?: number;
}

const CALL_ACTIVE_TTL_MS = 65_000;

let activeLocalCallSession: LocalActiveCallInfo | null = null;

function isActiveCallRecordFresh(val: any, now: number): boolean {
  if (!val || typeof val !== 'object' || !val.isActive || !val.callId) return false;
  const updatedAt = Number(val.updatedAt || 0);
  const expiresAt = Number(val.expiresAt || 0);
  if (expiresAt > 0 && expiresAt <= now) return false;
  if (updatedAt > 0 && now - updatedAt > CALL_ACTIVE_TTL_MS) return false;
  if (!updatedAt && !expiresAt) return false;
  return true;
}

export function getLocalActiveCall(): LocalActiveCallInfo | null {
  if (
    activeLocalCallSession &&
    activeLocalCallSession.expiresAt &&
    activeLocalCallSession.expiresAt <= Date.now()
  ) {
    activeLocalCallSession = null;
  }
  return activeLocalCallSession;
}

export async function registerLocalActiveCall(
  callId: string,
  userId: string,
  peerId: string,
  callType: 'audio' | 'video'
): Promise<void> {
  if (!callId || !userId) return;
  activeLocalCallSession = {
    callId,
    userId,
    peerId,
    callType,
    expiresAt: Date.now() + CALL_ACTIVE_TTL_MS,
  };
  const now = getServerNowMs();
  const payload = {
    callId,
    userId,
    peerId,
    callType,
    isActive: true,
    updatedAt: now,
    expiresAt: now + CALL_ACTIVE_TTL_MS,
  };
  const tasks: Promise<any>[] = [];
  if (rtdb) {
    const activeRef = ref(rtdb, `call_signals/${userId}/_active`);
    try {
      onDisconnect(activeRef).remove().catch(() => {});
    } catch {}
    tasks.push(set(activeRef, payload).catch(() => {}));
  }
  if (db) {
    tasks.push(
      setDoc(doc(db, 'users', userId, 'call_signals', '_active'), payload).catch(() => {})
    );
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export async function refreshLocalActiveCall(callId: string, userId: string): Promise<void> {
  if (!callId || !userId) return;
  if (!activeLocalCallSession || activeLocalCallSession.callId !== callId) return;
  activeLocalCallSession.expiresAt = Date.now() + CALL_ACTIVE_TTL_MS;
  const now = getServerNowMs();
  const payload = {
    callId,
    userId,
    peerId: activeLocalCallSession.peerId,
    callType: activeLocalCallSession.callType,
    isActive: true,
    updatedAt: now,
    expiresAt: now + CALL_ACTIVE_TTL_MS,
  };
  const tasks: Promise<any>[] = [];
  if (rtdb) {
    tasks.push(set(ref(rtdb, `call_signals/${userId}/_active`), payload).catch(() => {}));
  }
  if (db) {
    tasks.push(setDoc(doc(db, 'users', userId, 'call_signals', '_active'), payload).catch(() => {}));
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export async function unregisterLocalActiveCall(callId: string, userId: string): Promise<void> {
  if (activeLocalCallSession && (!callId || activeLocalCallSession.callId === callId)) {
    activeLocalCallSession = null;
  }
  if (!userId) return;
  const tasks: Promise<any>[] = [];
  if (rtdb) {
    const activeRef = ref(rtdb, `call_signals/${userId}/_active`);
    try {
      onDisconnect(activeRef).cancel().catch(() => {});
    } catch {}
    tasks.push(remove(activeRef).catch(() => {}));
  }
  if (db) {
    tasks.push(deleteDoc(doc(db, 'users', userId, 'call_signals', '_active')).catch(() => {}));
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export async function checkTargetUserInCall(
  targetUserId: string,
  callerUserId?: string
): Promise<boolean> {
  if (!targetUserId) return false;
  const now = getServerNowMs();

  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);

  let firestoreChecked = false;
  let firestoreVal: any = null;

  if (db) {
    try {
      const snap = await withTimeout(
        getDoc(doc(db, 'users', targetUserId, 'call_signals', '_active')),
        1800,
        null
      );
      if (snap !== null) {
        firestoreChecked = true;
        firestoreVal = snap.exists() ? snap.data() : null;
      }
    } catch {}
  }

  if (firestoreChecked) {
    if (!firestoreVal) {
      // Firestore has no active call for target; clean up any stale RTDB _active leftover
      if (rtdb) {
        remove(ref(rtdb, `call_signals/${targetUserId}/_active`)).catch(() => {});
      }
      return false;
    }
    if (!isActiveCallRecordFresh(firestoreVal, now)) {
      unregisterLocalActiveCall(String(firestoreVal.callId || ''), targetUserId).catch(() => {});
      return false;
    }
    if (callerUserId && firestoreVal.peerId && String(firestoreVal.peerId) === String(callerUserId)) {
      return false;
    }
    return true;
  }

  // Fallback to RTDB only if Firestore check failed or timed out
  if (rtdb) {
    try {
      const snap = await withTimeout(
        get(ref(rtdb, `call_signals/${targetUserId}/_active`)),
        1800,
        null
      );
      if (snap && snap.exists()) {
        const val = snap.val();
        if (!isActiveCallRecordFresh(val, now)) {
          remove(ref(rtdb, `call_signals/${targetUserId}/_active`)).catch(() => {});
          return false;
        }
        if (callerUserId && val.peerId && String(val.peerId) === String(callerUserId)) {
          return false;
        }
        return true;
      }
    } catch {}
  }

  return false;
}

export async function cleanupCallSignalsForCall(
  userId: string,
  callId: string,
  onlyTypes?: string[]
): Promise<void> {
  if (!userId || !callId) return;
  const typeFilter = onlyTypes && onlyTypes.length > 0 ? new Set(onlyTypes) : null;
  const now = getServerNowMs();
  const tasks: Promise<any>[] = [];

  const rtdbInstance = rtdb;
  if (rtdbInstance) {
    tasks.push(
      (async () => {
        try {
          const snap = await get(ref(rtdbInstance, `call_signals/${userId}`));
          if (!snap.exists()) return;
          const val = snap.val() as Record<string, any>;
          await Promise.allSettled(
            Object.entries(val).map(([key, data]) => {
              if (key === '_active') {
                if (!isActiveCallRecordFresh(data, now) || (!onlyTypes && data?.callId === callId)) {
                  return remove(ref(rtdbInstance, `call_signals/${userId}/_active`)).catch(() => {});
                }
                return Promise.resolve();
              }
              const isExpired = typeof data?.expiresAt === 'number' && data.expiresAt < now;
              if (isExpired) {
                return remove(ref(rtdbInstance, `call_signals/${userId}/${key}`)).catch(() => {});
              }
              if (data?.callId !== callId) return Promise.resolve();
              if (typeFilter && !typeFilter.has(String(data?.type || ''))) return Promise.resolve();
              return remove(ref(rtdbInstance, `call_signals/${userId}/${key}`)).catch(() => {});
            })
          );
        } catch {}
      })()
    );
  }

  const firestore = db;
  if (firestore) {
    tasks.push(
      (async () => {
        try {
          const q = query(
            collection(firestore, 'users', userId, 'call_signals'),
            where('callId', '==', callId)
          );
          const snap = await getDocs(q);
          await Promise.allSettled(
            snap.docs.map((d) => {
              const data = d.data() as any;
              if (d.id === '_active') {
                if (!isActiveCallRecordFresh(data, now) || !onlyTypes) {
                  return deleteDoc(d.ref).catch(() => {});
                }
                return Promise.resolve();
              }
              if (typeFilter && !typeFilter.has(String(data?.type || ''))) return Promise.resolve();
              return deleteDoc(d.ref).catch(() => {});
            })
          );
        } catch {}
      })()
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export function subscribeToFirestoreCallSignals(
  userId: string,
  onSignal: (signal: any) => void
): () => void {
  if (!userId) return () => {};
  const mountTs = getServerNowMs() - 25_000;
  const seenIds = new Set<string>();

  const deliver = (raw: any, fallbackId?: string) => {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.signalId || fallbackId || '');
    if (!id || id === '_active' || seenIds.has(id)) return;
    const now = getServerNowMs();
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : (typeof raw.createdAtMs === 'number' ? raw.createdAtMs : 0);
    if (typeof raw.expiresAt === 'number' && raw.expiresAt < now) {
      deleteFirestoreCallSignal(userId, id);
      return;
    }
    if (createdAt > 0 && createdAt < mountTs) return;
    seenIds.add(id);
    if (seenIds.size > 300) {
      const oldest = seenIds.values().next().value;
      if (oldest) seenIds.delete(oldest);
    }
    onSignal({ ...raw, signalId: id });
  };

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const rtdbRef = ref(rtdb, `call_signals/${userId}`);
      unsubRtdb = onValue(rtdbRef, (snap) => {
        const val = snap.val();
        if (!val || typeof val !== 'object') return;
        Object.entries(val).forEach(([key, data]) => {
          if (key === '_active') return;
          deliver(data, key);
        });
      });
    } catch {}
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const colRef = collection(db, 'users', userId, 'call_signals');
      unsubFirestore = onSnapshot(
        colRef,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.doc.id === '_active') return;
            if (change.type === 'added' || change.type === 'modified') {
              deliver(change.doc.data(), change.doc.id);
            }
          });
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/call_signals`);
        }
      );
    } catch {}
  }

  return () => {
    if (unsubRtdb) unsubRtdb();
    if (unsubFirestore) unsubFirestore();
  };
}

// ==========================================
// 21. REAL-TIME SOCIAL NOTIFICATIONS (`users/{userId}/notifications`)
// ==========================================
export interface RealtimeUserNotification {
  id: string;
  targetUserId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  kind: 'forum_like' | 'forum_comment' | 'story_like' | 'story_comment' | 'app_update' | 'info';
  message: string;
  refId?: string;
  isRead?: boolean;
  createdAt: number;
}

const ALLOWED_BELL_NOTIFICATION_KINDS = new Set<string>([
  'forum_like',
  'forum_comment',
  'story_like',
  'story_comment',
  'app_update',
  'info',
]);

const LOCAL_NOTIFS_PREFIX = 'shat_masr_user_notifications_';

function readLocalUserNotifications(userId: string): RealtimeUserNotification[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIFS_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUserNotifications(userId: string, list: RealtimeUserNotification[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_NOTIFS_PREFIX}${userId}`, JSON.stringify(list.slice(0, 30)));
  } catch {}
}

export async function sendUserRealtimeNotification(params: {
  targetUserId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  kind: RealtimeUserNotification['kind'];
  message: string;
  refId?: string;
}): Promise<void> {
  const { targetUserId, actorId, actorName, actorAvatar = '', kind, message, refId = '' } = params;
  if (!targetUserId || !actorId || targetUserId === actorId || !message.trim()) return;
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowMs = getServerNowMs();

  const item: RealtimeUserNotification = {
    id,
    targetUserId,
    actorId,
    actorName,
    actorAvatar,
    kind,
    message: message.trim(),
    refId,
    isRead: false,
    createdAt: nowMs
  };

  const existingLocal = readLocalUserNotifications(targetUserId).filter((n) => n.id !== id);
  writeLocalUserNotifications(targetUserId, [item, ...existingLocal]);
  realtimeSocket.sendUserNotification(item);
  liveChatBus?.postMessage({ type: 'USER_REALTIME_NOTIFICATION', notification: item });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shatmasr:user_notification', { detail: item }));
  }

  if (db) {
    try {
      await setDoc(doc(db, 'users', targetUserId, 'notifications', id), {
        ...item,
        createdAt: serverTimestamp(),
        createdAtMs: nowMs
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${targetUserId}/notifications/${id}`);
    }
  }
}

export async function markUserNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (!userId || !notificationIds || notificationIds.length === 0) return;
  const idSet = new Set(notificationIds);
  const localList = readLocalUserNotifications(userId);
  if (localList.length > 0) {
    const updated = localList.map((n) => (idSet.has(n.id) ? { ...n, isRead: true } : n));
    writeLocalUserNotifications(userId, updated);
  }
  liveChatBus?.postMessage({
    type: 'USER_NOTIFICATIONS_MARKED_READ',
    userId,
    ids: notificationIds,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shatmasr:user_notifications_marked_read', {
        detail: { userId, ids: notificationIds },
      })
    );
  }

  const firestore = db;
  if (!firestore) return;
  await Promise.allSettled(
    notificationIds.slice(0, 30).map((nid) =>
      setDoc(doc(firestore, 'users', userId, 'notifications', nid), { isRead: true }, { merge: true }).catch(() => {})
    )
  );
}

export async function deleteUserNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return;
  persistDeletedIdStorage(`shat_masr_deleted_notifs_${userId}`, notificationId, 150);
  const nextLocal = readLocalUserNotifications(userId).filter((n) => n.id !== notificationId);
  writeLocalUserNotifications(userId, nextLocal);

  liveChatBus?.postMessage({
    type: 'USER_NOTIFICATION_DELETED',
    userId,
    notificationId,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shatmasr:user_notification_deleted', {
        detail: { userId, notificationId },
      })
    );
  }

  if (db) {
    deleteDoc(doc(db, 'users', userId, 'notifications', notificationId)).catch(() => {});
  }
}

export async function clearAllUserNotifications(userId: string): Promise<void> {
  if (!userId) return;
  const localList = readLocalUserNotifications(userId);
  const delKey = `shat_masr_deleted_notifs_${userId}`;
  localList.forEach((n) => {
    if (n?.id) persistDeletedIdStorage(delKey, n.id, 150);
  });
  writeLocalUserNotifications(userId, []);

  liveChatBus?.postMessage({ type: 'USER_NOTIFICATIONS_CLEARED', userId });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shatmasr:user_notifications_cleared', { detail: { userId } })
    );
  }

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'notifications')).catch(() => null);
      if (snap && !snap.empty) {
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      }
    } catch {}
  }
}

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: RealtimeUserNotification[]) => void
): () => void {
  if (!userId) return () => {};
  const listById = new Map<string, RealtimeUserNotification>();
  const locallyReadIds = new Set<string>();
  const deletedStorageKey = `shat_masr_deleted_notifs_${userId}`;
  const deletedIds = readDeletedIdsStorage(deletedStorageKey);

  const emitSorted = (persistLocal = false) => {
    const sorted = Array.from(listById.values())
      .filter((n) => n?.id && !deletedIds.has(n.id) && ALLOWED_BELL_NOTIFICATION_KINDS.has(n.kind))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 20);
    if (persistLocal) {
      writeLocalUserNotifications(userId, sorted);
    }
    onUpdate(sorted);
  };

  readLocalUserNotifications(userId).forEach((n) => {
    if (n?.id && !deletedIds.has(n.id) && ALLOWED_BELL_NOTIFICATION_KINDS.has(n.kind)) {
      if (n.isRead) locallyReadIds.add(n.id);
      listById.set(n.id, n);
    }
  });
  if (listById.size > 0) {
    emitSorted(false);
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(
        collection(db, 'users', userId, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            const kind = String(data.kind || 'info');
            if (!ALLOWED_BELL_NOTIFICATION_KINDS.has(kind)) return;
            const id = data.id || d.id;
            if (deletedIds.has(id)) return;
            const resolvedTs = resolveTimestampMs(data.createdAt) ?? (Number(data.createdAtMs) || Date.now());
            const existing = listById.get(id);
            const isRead = Boolean(data.isRead || existing?.isRead || locallyReadIds.has(id));
            if (isRead) locallyReadIds.add(id);
            listById.set(id, {
              id,
              targetUserId: data.targetUserId || userId,
              actorId: data.actorId || '',
              actorName: data.actorName || 'عضو شات مصر',
              actorAvatar: data.actorAvatar || '',
              kind: kind as RealtimeUserNotification['kind'],
              message: data.message || '',
              refId: data.refId || '',
              isRead,
              createdAt: resolvedTs
            });
          });
          emitSorted(true);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/notifications`);
        }
      );
    } catch {}
  }

  const ingestNotification = (notif: RealtimeUserNotification | undefined) => {
    if (
      notif &&
      notif.id &&
      !deletedIds.has(notif.id) &&
      notif.targetUserId === userId &&
      ALLOWED_BELL_NOTIFICATION_KINDS.has(notif.kind)
    ) {
      const existing = listById.get(notif.id);
      const isRead = Boolean(notif.isRead || existing?.isRead || locallyReadIds.has(notif.id));
      if (isRead) locallyReadIds.add(notif.id);
      listById.set(notif.id, {
        ...notif,
        isRead,
      });
      emitSorted(true);
    }
  };

  const applyMarkedRead = (targetId: string | undefined, ids: unknown) => {
    if (targetId !== userId || !Array.isArray(ids) || ids.length === 0) return;
    let changed = false;
    ids.forEach((id) => {
      if (typeof id !== 'string' || !id) return;
      locallyReadIds.add(id);
      const existing = listById.get(id);
      if (existing && !existing.isRead) {
        listById.set(id, { ...existing, isRead: true });
        changed = true;
      }
    });
    if (changed) {
      emitSorted(true);
    }
  };

  const applyDeletedNotif = (targetId: string | undefined, notificationId: unknown) => {
    if (targetId !== userId || typeof notificationId !== 'string' || !notificationId) return;
    deletedIds.add(notificationId);
    persistDeletedIdStorage(deletedStorageKey, notificationId, 150);
    if (listById.delete(notificationId)) {
      emitSorted(true);
    }
  };

  const applyClearedNotifs = (targetId: string | undefined) => {
    if (targetId !== userId) return;
    Array.from(listById.keys()).forEach((id) => {
      deletedIds.add(id);
      persistDeletedIdStorage(deletedStorageKey, id, 150);
    });
    listById.clear();
    emitSorted(true);
  };

  const unsubSocket = realtimeSocket.subscribeToUserNotifications((notif) => {
    ingestNotification(notif as RealtimeUserNotification | undefined);
  });

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'USER_REALTIME_NOTIFICATION') {
      ingestNotification(e.data?.notification as RealtimeUserNotification | undefined);
    } else if (e.data?.type === 'USER_NOTIFICATIONS_MARKED_READ') {
      applyMarkedRead(e.data?.userId, e.data?.ids);
    } else if (e.data?.type === 'USER_NOTIFICATION_DELETED') {
      applyDeletedNotif(e.data?.userId, e.data?.notificationId);
    } else if (e.data?.type === 'USER_NOTIFICATIONS_CLEARED') {
      applyClearedNotifs(e.data?.userId);
    }
  };
  const handleWindowEvent = (e: Event) => {
    ingestNotification((e as CustomEvent<RealtimeUserNotification>).detail);
  };
  const handleWindowMarkedRead = (e: Event) => {
    const detail = (e as CustomEvent<{ userId?: string; ids?: string[] }>).detail;
    applyMarkedRead(detail?.userId, detail?.ids);
  };
  const handleWindowDeleted = (e: Event) => {
    const detail = (e as CustomEvent<{ userId?: string; notificationId?: string }>).detail;
    applyDeletedNotif(detail?.userId, detail?.notificationId);
  };
  const handleWindowCleared = (e: Event) => {
    const detail = (e as CustomEvent<{ userId?: string }>).detail;
    applyClearedNotifs(detail?.userId);
  };
  liveChatBus?.addEventListener('message', handleBus);
  if (typeof window !== 'undefined') {
    window.addEventListener('shatmasr:user_notification', handleWindowEvent);
    window.addEventListener('shatmasr:user_notifications_marked_read', handleWindowMarkedRead);
    window.addEventListener('shatmasr:user_notification_deleted', handleWindowDeleted);
    window.addEventListener('shatmasr:user_notifications_cleared', handleWindowCleared);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    unsubSocket();
    liveChatBus?.removeEventListener('message', handleBus);
    if (typeof window !== 'undefined') {
      window.removeEventListener('shatmasr:user_notification', handleWindowEvent);
      window.removeEventListener('shatmasr:user_notifications_marked_read', handleWindowMarkedRead);
      window.removeEventListener('shatmasr:user_notification_deleted', handleWindowDeleted);
      window.removeEventListener('shatmasr:user_notifications_cleared', handleWindowCleared);
    }
  };
}

// ==========================================
// 31. ROOM INVITATIONS & OWNER JOIN REQUESTS (Dedicated onSnapshot listeners)
// ==========================================
export interface RoomInvitation {
  id: string;
  roomId: string;
  roomTitle: string;
  isPrivate?: boolean;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export async function sendRoomInvitation(params: {
  roomId: string;
  roomTitle: string;
  isPrivate?: boolean;
  fromUser: User;
  targetUserId: string;
}): Promise<boolean> {
  const { roomId, roomTitle, isPrivate, fromUser, targetUserId } = params;
  if (!roomId || !fromUser?.id || !targetUserId || fromUser.id === targetUserId) return false;
  const now = getServerNowMs();
  const inviteId = `rinv_${roomId}_${fromUser.id}_${now}`;
  const payload: RoomInvitation = {
    id: inviteId,
    roomId,
    roomTitle: roomTitle || 'غرفة الدردشة',
    isPrivate: Boolean(isPrivate),
    fromUserId: fromUser.id,
    fromUserName: fromUser.name || 'عضو شات مصر',
    fromUserAvatar: fromUser.avatar || '',
    status: 'pending',
    createdAt: now,
  };

  if (db) {
    try {
      await setDoc(doc(db, 'users', targetUserId, 'room_invites', inviteId), {
        ...payload,
        createdAtMs: now,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${targetUserId}/room_invites/${inviteId}`);
    }
  }

  liveChatBus?.postMessage({
    type: 'ROOM_INVITE_SENT',
    targetUserId,
    invite: payload,
  });

  return true;
}

export function subscribeToRoomInvitations(
  userId: string,
  onInvites: (invites: RoomInvitation[]) => void
): () => void {
  if (!userId) return () => {};
  const byId = new Map<string, RoomInvitation>();

  const emitSorted = () => {
    const list = Array.from(byId.values())
      .filter((inv) => inv.status === 'pending')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    onInvites(list);
  };

  let unsubFirestoreRoomInvites: (() => void) | null = null;
  if (db) {
    try {
      const q = query(
        collection(db, 'users', userId, 'room_invites'),
        where('status', '==', 'pending')
      );
      unsubFirestoreRoomInvites = onSnapshot(
        q,
        (snap) => {
          const activeIds = new Set<string>();
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            const id = data.id || d.id;
            activeIds.add(id);
            byId.set(id, {
              id,
              roomId: String(data.roomId || ''),
              roomTitle: String(data.roomTitle || 'غرفة الدردشة'),
              isPrivate: Boolean(data.isPrivate),
              fromUserId: String(data.fromUserId || ''),
              fromUserName: String(data.fromUserName || 'عضو شات مصر'),
              fromUserAvatar: data.fromUserAvatar || '',
              status: (data.status || 'pending') as RoomInvitation['status'],
              createdAt: resolveTimestampMs(data.createdAt) ?? (Number(data.createdAtMs) || Date.now()),
            });
          });
          Array.from(byId.keys()).forEach((k) => {
            if (!activeIds.has(k)) byId.delete(k);
          });
          emitSorted();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/room_invites`);
        }
      );
    } catch {}
  }

  const handleBus = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_INVITE_SENT' && e.data?.targetUserId === userId && e.data?.invite) {
      const inv = e.data.invite as RoomInvitation;
      byId.set(inv.id, inv);
      emitSorted();
    }
  };
  liveChatBus?.addEventListener('message', handleBus);

  return () => {
    if (unsubFirestoreRoomInvites) unsubFirestoreRoomInvites();
    liveChatBus?.removeEventListener('message', handleBus);
  };
}

export async function respondToRoomInvitation(
  userId: string,
  inviteId: string,
  status: 'accepted' | 'declined',
  roomId?: string
): Promise<void> {
  if (!userId || !inviteId) return;
  if (db) {
    try {
      await setDoc(
        doc(db, 'users', userId, 'room_invites', inviteId),
        { status, respondedAt: Date.now() },
        { merge: true }
      );
      if (status === 'accepted' && roomId) {
        await setDoc(
          doc(db, 'rooms', roomId),
          { allowedUserIds: arrayUnion(userId) },
          { merge: true }
        ).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}/room_invites/${inviteId}`);
    }
  }
  if (rtdb && status === 'accepted' && roomId) {
    set(ref(rtdb, `rooms_allowed/${roomId}/${userId}`), true).catch(() => {});
  }
}

export function subscribeToOwnerRoomJoinRequests(
  ownerId: string,
  onRequests: (reqs: OwnerRoomJoinRequest[]) => void
): () => void {
  if (!ownerId || !db) return () => {};
  let unsubFirestoreOwnerJoinReqs: (() => void) | null = null;
  try {
    const q = query(
      collection(db, 'users', ownerId, 'room_join_requests'),
      where('status', '==', 'pending')
    );
    unsubFirestoreOwnerJoinReqs = onSnapshot(
      q,
      (snap) => {
        const list: OwnerRoomJoinRequest[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: data.id || d.id,
              roomId: String(data.roomId || ''),
              roomTitle: String(data.roomTitle || 'غرفتك'),
              ownerId: String(data.ownerId || ownerId),
              userId: String(data.userId || ''),
              userName: String(data.userName || 'عضو شات مصر'),
              userAvatar: data.userAvatar || '',
              requestedAt: resolveTimestampMs(data.createdAt) ?? (Number(data.requestedAt) || Date.now()),
              status: (data.status || 'pending') as OwnerRoomJoinRequest['status'],
            };
          })
          .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
        onRequests(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${ownerId}/room_join_requests`);
      }
    );
  } catch {}
  return () => {
    if (unsubFirestoreOwnerJoinReqs) unsubFirestoreOwnerJoinReqs();
  };
}

// ==========================================
// 32. REAL-TIME GAME CHALLENGES & LIVE TIC-TAC-TOE MATCHES (Dedicated onSnapshot)
// ==========================================
export interface GameChallengeInvite {
  id: string;
  matchId: string;
  gameType: 'tictactoe';
  fromId: string;
  fromName: string;
  fromAvatar?: string;
  targetId: string;
  wager: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface TicTacToeMatchState {
  id: string;
  playerXId: string;
  playerXName: string;
  playerXAvatar?: string;
  playerOId: string;
  playerOName?: string;
  playerOAvatar?: string;
  board: Array<'X' | 'O' | null>;
  turn: 'X' | 'O';
  wager: number;
  status: 'pending' | 'active' | 'declined' | 'forfeited';
  rematchSeq: number;
  forfeitedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export async function sendGameChallengeInvite(params: {
  matchId: string;
  fromUser: User;
  targetUserId: string;
  wager: number;
  gameType?: 'tictactoe';
}): Promise<void> {
  const { matchId, fromUser, targetUserId, wager, gameType = 'tictactoe' } = params;
  if (!matchId || !fromUser?.id || !targetUserId) return;
  const now = getServerNowMs();

  if (db) {
    try {
      await setDoc(doc(db, 'tic_tac_toe_matches', matchId), {
        id: matchId,
        playerXId: fromUser.id,
        playerXName: fromUser.name || 'عضو شات مصر',
        playerXAvatar: fromUser.avatar || '',
        playerOId: targetUserId,
        playerOName: '',
        playerOAvatar: '',
        board: Array(9).fill(null),
        turn: 'X',
        wager: Number(wager) || 0,
        status: 'pending',
        rematchSeq: 0,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', targetUserId, 'game_challenges', matchId), {
        id: matchId,
        matchId,
        gameType,
        fromId: fromUser.id,
        fromName: fromUser.name || 'عضو شات مصر',
        fromAvatar: fromUser.avatar || '',
        targetId: targetUserId,
        wager: Number(wager) || 0,
        status: 'pending',
        createdAtMs: now,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `game_challenges/${matchId}`);
    }
  }
}

export function subscribeToIncomingGameChallenges(
  userId: string,
  onChallenges: (challenges: GameChallengeInvite[]) => void
): () => void {
  if (!userId || !db) return () => {};
  let unsubFirestoreChallenges: (() => void) | null = null;
  try {
    const q = query(
      collection(db, 'users', userId, 'game_challenges'),
      where('status', '==', 'pending')
    );
    unsubFirestoreChallenges = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const list: GameChallengeInvite[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: data.id || d.id,
              matchId: String(data.matchId || d.id),
              gameType: (data.gameType || 'tictactoe') as 'tictactoe',
              fromId: String(data.fromId || ''),
              fromName: String(data.fromName || 'عضو شات مصر'),
              fromAvatar: data.fromAvatar || '',
              targetId: String(data.targetId || userId),
              wager: Number(data.wager) || 0,
              status: (data.status || 'pending') as GameChallengeInvite['status'],
              createdAt: resolveTimestampMs(data.createdAt) ?? (Number(data.createdAtMs) || now),
            };
          })
          // Ignore stale invites older than 10 minutes
          .filter((c) => now - (c.createdAt || now) < 600000)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onChallenges(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${userId}/game_challenges`);
      }
    );
  } catch {}
  return () => {
    if (unsubFirestoreChallenges) unsubFirestoreChallenges();
  };
}

export async function respondToGameChallenge(params: {
  userId: string;
  matchId: string;
  acceptorUser: User;
  status: 'accepted' | 'declined';
}): Promise<void> {
  const { userId, matchId, acceptorUser, status } = params;
  if (!userId || !matchId || !db) return;
  try {
    await setDoc(
      doc(db, 'users', userId, 'game_challenges', matchId),
      { status, updatedAt: Date.now() },
      { merge: true }
    );
    await setDoc(
      doc(db, 'tic_tac_toe_matches', matchId),
      {
        status: status === 'accepted' ? 'active' : 'declined',
        playerOName: acceptorUser.name || 'منافس',
        playerOAvatar: acceptorUser.avatar || '',
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tic_tac_toe_matches/${matchId}`);
  }
}

export function subscribeToGameMatch(
  matchId: string,
  onMatch: (match: TicTacToeMatchState | null) => void
): () => void {
  if (!matchId || !db) return () => {};
  let unsubFirestoreMatch: (() => void) | null = null;
  try {
    unsubFirestoreMatch = onSnapshot(
      doc(db, 'tic_tac_toe_matches', matchId),
      (snap) => {
        if (!snap.exists()) {
          onMatch(null);
          return;
        }
        const data = snap.data() as any;
        onMatch({
          id: snap.id,
          playerXId: String(data.playerXId || ''),
          playerXName: String(data.playerXName || 'منافس'),
          playerXAvatar: data.playerXAvatar || '',
          playerOId: String(data.playerOId || ''),
          playerOName: data.playerOName || '',
          playerOAvatar: data.playerOAvatar || '',
          board: Array.isArray(data.board) && data.board.length === 9 ? data.board : Array(9).fill(null),
          turn: data.turn === 'O' ? 'O' : 'X',
          wager: Number(data.wager) || 0,
          status: (data.status || 'pending') as TicTacToeMatchState['status'],
          rematchSeq: Number(data.rematchSeq) || 0,
          forfeitedBy: data.forfeitedBy || undefined,
          createdAt: resolveTimestampMs(data.createdAt) ?? Date.now(),
          updatedAt: resolveTimestampMs(data.updatedAt) ?? Date.now(),
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `tic_tac_toe_matches/${matchId}`);
      }
    );
  } catch {}
  return () => {
    if (unsubFirestoreMatch) unsubFirestoreMatch();
  };
}

export async function updateGameMatchState(
  matchId: string,
  patch: Partial<TicTacToeMatchState>
): Promise<void> {
  if (!matchId || !db) return;
  try {
    await setDoc(
      doc(db, 'tic_tac_toe_matches', matchId),
      {
        ...patch,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tic_tac_toe_matches/${matchId}`);
  }
}




