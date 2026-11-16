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
  arrayRemove
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
  runTransaction,
  Database,
  query as rtdbQuery,
  limitToLast
} from 'firebase/database';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { Message, User, FriendRequest, Friend, ForumPost, ForumComment, SharedRoomMission, UserReport } from '../types/chat';
import { PRIMARY_OWNER_EMAIL } from '../data/seedData';
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
  const now = Date.now();
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
      if (user) {
        currentAuthUid = user.uid;
      }
    });
    signInAnonymously(auth).then((cred) => {
      if (cred && cred.user) {
        currentAuthUid = cred.user.uid;
      }
    }).catch((authErr) => {
      console.warn("Firebase Auth anonymous login notice:", authErr);
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

if (typeof window !== 'undefined' && db) {
  window.addEventListener('online', () => {
    if (db) {
      enableNetwork(db).catch(() => {});
    }
  });
}

// Validate connection per SKILL instructions
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
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection();
  }, 1500);
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
export function subscribeToRoomPresence(
  roomId: string,
  user: User,
  onCountChange: (count: number, activeUsers: User[]) => void
): () => void {
  const presenceKey = `room_presence_${roomId}`;
  const mergedMap = new Map<string, User>();
  if (user?.id) {
    mergedMap.set(user.id, { ...user, isOnline: true });
  }

  const emitMerged = () => {
    const list = Array.from(mergedMap.values());
    try {
      localStorage.setItem(presenceKey, JSON.stringify(list));
    } catch {}
    onCountChange(Math.max(1, list.length), list);
  };

  let fsCleanup: (() => void) | null = null;
  let fsHeartbeat: ReturnType<typeof setInterval> | null = null;
  if (db && user?.id) {
    try {
      const presenceDocRef = doc(db, 'rooms', roomId, 'presence', user.id);
      const presencePayload = {
        id: user.id,
        name: user.name,
        avatar: user.avatar || '',
        role: user.role || 'member',
        vipBadge: user.vipBadge || '',
        countryFlag: user.countryFlag || '🇪🇬',
        badges: user.badges || [],
        status: user.status || 'online',
        isOnline: true,
        isBanned: !!user.isBanned,
        isMuted: !!user.isMuted,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp(),
      };

      setDoc(presenceDocRef, presencePayload, { merge: true }).catch(() => {});
      fsHeartbeat = setInterval(() => {
        setDoc(presenceDocRef, { ...presencePayload, lastSeen: Date.now(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }, 40000);

      const presenceCol = collection(db, 'rooms', roomId, 'presence');
      const unsubFs = onSnapshot(
        presenceCol,
        (snap) => {
          const now = Date.now();
          const activeDocIds = new Set<string>();
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const lastSeen = typeof data.lastSeen === 'number'
              ? data.lastSeen
              : data.updatedAt?.toMillis
              ? data.updatedAt.toMillis()
              : now;
            if (now - lastSeen < 180000) {
              activeDocIds.add(docSnap.id);
              mergedMap.set(docSnap.id, {
                id: docSnap.id,
                name: data.name || 'عضو',
                avatar: data.avatar || '',
                role: data.role || 'member',
                vipBadge: data.vipBadge || '',
                countryFlag: data.countryFlag || '🇪🇬',
                badges: Array.isArray(data.badges) ? data.badges : [],
                status: data.status || 'online',
                isOnline: true,
                isBanned: !!data.isBanned,
                isMuted: !!data.isMuted,
              } as User);
            } else {
              mergedMap.delete(docSnap.id);
            }
          });
          Array.from(mergedMap.keys()).forEach((id) => {
            if (id !== user.id && !activeDocIds.has(id)) {
              mergedMap.delete(id);
            }
          });
          emitMerged();
        },
        (err) => {
          console.warn(`Firestore rooms/${roomId}/presence onSnapshot notice:`, err);
        }
      );

      fsCleanup = () => {
        unsubFs();
        if (fsHeartbeat) clearInterval(fsHeartbeat);
        deleteDoc(presenceDocRef).catch(() => {});
      };
    } catch (e) {
      console.warn('Firestore room presence setup error:', e);
    }
  }

  let rtdbCleanup: (() => void) | null = null;
  if (rtdb && user.id) {
    try {
      const connectedRef = ref(rtdb, '.info/connected');
      const roomsUserStatusRef = ref(rtdb, `rooms_presence/${roomId}/${user.id}`);
      const occupantsRef = ref(rtdb, `rooms_presence/${roomId}`);
      
      const unsubConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
          const userPayload = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            vipBadge: user.vipBadge,
            isOnline: true,
            isBanned: user.isBanned || false,
            isMuted: user.isMuted || false,
            joinedAt: Date.now()
          };
          onDisconnect(roomsUserStatusRef).remove();
          set(roomsUserStatusRef, userPayload);
        }
      });

      const unsubOccupants = onValue(occupantsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const usersList = Object.values(data) as User[];
          usersList.forEach((u) => {
            if (u && u.id) mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u, isOnline: true });
          });
          emitMerged();
        }
      });

      rtdbCleanup = () => {
        unsubConnected();
        unsubOccupants();
        try {
          set(roomsUserStatusRef, null);
        } catch {}
      };
    } catch (e) {
      console.warn("RTDB presence setup fallback:", e);
    }
  }

  emitMerged();
  liveChatBus?.postMessage({
    type: 'PRESENCE_UPDATE',
    roomId,
    users: Array.from(mergedMap.values())
  });

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'PRESENCE_UPDATE' && event.data.roomId === roomId) {
      const users: User[] = event.data.users || [];
      users.forEach((u) => {
        if (u && u.id) mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u, isOnline: true });
      });
      emitMerged();
    }
  };
  liveChatBus?.addEventListener('message', handleMessage);

  return () => {
    mergedMap.delete(user.id);
    liveChatBus?.postMessage({
      type: 'PRESENCE_UPDATE',
      roomId,
      users: Array.from(mergedMap.values())
    });
    liveChatBus?.removeEventListener('message', handleMessage);
    if (fsCleanup) fsCleanup();
    if (rtdbCleanup) rtdbCleanup();
  };
}

// Global Presence Tracker for all online users across the platform
export function subscribeToGlobalPresence(
  user: User,
  onGlobalChange: (users: User[]) => void
): () => void {
  const globalKey = 'arab_chat_global_presence';
  const liveUsersMap = new Map<string, User>();
  const firestoreTrackedIds = new Set<string>();
  let lastPresenceSignature = '';

  // Helper to emit merged live presence only when visible user list/fields actually change
  const emitPresence = () => {
    if (user && user.id && !liveUsersMap.has(user.id)) {
      liveUsersMap.set(user.id, { ...user, isOnline: true });
    }
    const list = Array.from(liveUsersMap.values());
    const sig = list
      .map(
        (u) =>
          `${u.id}:${u.name || ''}:${u.avatar || ''}:${u.status || ''}:${u.role || ''}:${u.vipBadge || ''}:${u.profileBanner || ''}:${u.isBanned ? 1 : 0}:${u.isMuted ? 1 : 0}`
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

  // Add initial self
  if (user && user.id) {
    liveUsersMap.set(user.id, { ...user, isOnline: true });
    emitPresence();
  }

  // 1. Firestore Heartbeat & onSnapshot listener on collection('online_users')
  let unsubFirestore: (() => void) | null = null;
  let heartbeatTimer: any = null;

  if (db && user && user.id) {
    try {
      const userOnlineDoc = doc(db, 'online_users', user.id);
      const onlinePayload = {
        id: user.id,
        name: user.name,
        avatar: user.avatar || '',
        role: user.role || 'member',
        vipBadge: user.vipBadge || '',
        badges: user.badges || [],
        frameStyle: user.frameStyle || '',
        profileBanner: user.profileBanner || '',
        favoriteMusicUrl: user.favoriteMusicUrl || '',
        countryFlag: user.countryFlag || '🇪🇬',
        sessionId: user.sessionId || '',
        isGuest: !!user.isGuest,
        status: user.status || 'online',
        isBanned: !!user.isBanned,
        isMuted: !!user.isMuted,
        coins: Number(user.coins) || 0,
        ratingPoints: Number(user.ratingPoints) || 0,
        isOnline: true,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      };

      // Write heartbeat immediately
      setDoc(userOnlineDoc, onlinePayload, { merge: true }).catch(() => {});

      // Keep heartbeat alive every 35 seconds
      heartbeatTimer = setInterval(() => {
        setDoc(userOnlineDoc, {
          ...onlinePayload,
          lastSeen: Date.now(),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }, 35000);

      // Listen to all online users in Firestore in real time (zero empty-snap block)
      const onlineCol = collection(db, 'online_users');
      unsubFirestore = onSnapshot(onlineCol, (snap) => {
        const now = Date.now();
        const currentFsIds = new Set<string>();
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const lastSeen = typeof data.lastSeen === 'number'
            ? data.lastSeen
            : data.updatedAt?.toMillis
            ? data.updatedAt.toMillis()
            : now;
          // Consider active within 3 minutes
          if (now - lastSeen < 180000) {
            currentFsIds.add(docSnap.id);
            firestoreTrackedIds.add(docSnap.id);
            liveUsersMap.set(docSnap.id, {
              ...liveUsersMap.get(docSnap.id),
              id: docSnap.id,
              name: data.name || 'مستخدم',
              avatar: data.avatar || '',
              role: data.role || 'member',
              vipBadge: data.vipBadge || '',
              badges: Array.isArray(data.badges) ? data.badges : [],
              frameStyle: data.frameStyle || '',
              profileBanner: data.profileBanner || '',
              favoriteMusicUrl: data.favoriteMusicUrl || '',
              countryFlag: data.countryFlag || '🇪🇬',
              sessionId: data.sessionId || undefined,
              isGuest: !!data.isGuest,
              status: data.status || 'online',
              isBanned: !!data.isBanned,
              isMuted: !!data.isMuted,
              coins: Number(data.coins) || 0,
              ratingPoints: Number(data.ratingPoints) || 0,
              isOnline: true
            } as User);
          } else {
            firestoreTrackedIds.delete(docSnap.id);
            if (docSnap.id !== user.id) {
              liveUsersMap.delete(docSnap.id);
            }
          }
        });

        // Remove any previously Firestore-tracked doc that left online_users
        Array.from(firestoreTrackedIds).forEach((trackedId) => {
          if (!currentFsIds.has(trackedId)) {
            firestoreTrackedIds.delete(trackedId);
            if (trackedId !== user.id) {
              liveUsersMap.delete(trackedId);
            }
          }
        });

        emitPresence();
      }, (err) => {
        console.warn('Firestore online_users onSnapshot notice:', err);
      });
    } catch (e) {
      console.warn('Firestore online_users setup error:', e);
    }
  }

  // 2. Realtime Socket listener
  const unsubSocket = realtimeSocket.subscribeToGlobalPresence((liveUsers) => {
    if (liveUsers && liveUsers.length > 0) {
      liveUsers.forEach(u => {
        if (u && u.id) liveUsersMap.set(u.id, { ...u, isOnline: true });
      });
      emitPresence();
    }
  });

  // 3. RTDB Presence fallback
  let rtdbCleanup: (() => void) | null = null;
  if (rtdb && user.id) {
    try {
      const globalStatusRef = ref(rtdb, `global_presence/${user.id}`);
      const allGlobalRef = ref(rtdb, 'global_presence');
      const connectedRef = ref(rtdb, '.info/connected');

      const unsubConnected = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          onDisconnect(globalStatusRef).remove();
          set(globalStatusRef, {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            vipBadge: user.vipBadge,
            status: user.status || 'online',
            isOnline: true,
            lastSeen: Date.now()
          });
        }
      });

      const unsubAll = onValue(allGlobalRef, (snap) => {
        const val = snap.val();
        if (val) {
          const list = Object.values(val) as User[];
          list.forEach(u => {
            if (u && u.id) liveUsersMap.set(u.id, { ...u, isOnline: true });
          });
          emitPresence();
        }
      });

      rtdbCleanup = () => {
        unsubConnected();
        unsubAll();
        try {
          set(globalStatusRef, null);
        } catch {}
      };
    } catch {}
  }

  const handleMsg = (e: MessageEvent) => {
    if (e.data?.type === 'GLOBAL_PRESENCE_UPDATE' && Array.isArray(e.data.users)) {
      e.data.users.forEach((u: User) => {
        if (u && u.id) liveUsersMap.set(u.id, { ...u, isOnline: true });
      });
      emitPresence();
    }
  };
  liveChatBus?.addEventListener('message', handleMsg);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (unsubFirestore) unsubFirestore();
    if (unsubSocket) unsubSocket();
    if (rtdbCleanup) rtdbCleanup();
    liveChatBus?.removeEventListener('message', handleMsg);
    if (db && user && user.id) {
      deleteDoc(doc(db, 'online_users', user.id)).catch(() => {});
    }
  };
}

// ==========================================
// 2. REALTIME MESSAGES (Realtime Database & Firestore with UID Path Isolation)
// ==========================================
export function subscribeToRoomMessages(
  roomId: string,
  onMessages: (messages: Message[]) => void
): () => void {
  const localKey = `messages_room_${roomId}`;

  // Priority 1: Realtime Database `messages/${roomId}`
  let rtdbUnsub: (() => void) | null = null;
  if (rtdb) {
    try {
      const messagesRef = rtdbQuery(ref(rtdb, `messages/${roomId}`), limitToLast(120));
      rtdbUnsub = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list: Message[] = Object.keys(data).map((key) => {
            const item = data[key];
            return {
              id: key,
              roomId,
              senderId: item.senderId || item.userId || 'usr_guest',
              senderName: item.senderName || item.userName || 'مستخدم',
              senderAvatar: item.senderAvatar || item.userAvatar || '',
              senderRole: item.senderRole || item.userVipTier || 'member',
              senderVipBadge: item.senderVipBadge || item.userVipBadge || '',
              badges: item.badges || [],
              type: item.type || 'text',
              isPrivate: !!item.isPrivate || item.type === 'private',
              recipientId: item.recipientId,
              content: item.content || item.text || '',
              text: item.text || item.content || '',
              gift: item.gift,
              replyTo: item.replyTo,
              audioDuration: item.audioDuration,
              audioUrl: item.audioUrl,
              voiceUrl: item.voiceUrl,
              mediaUrl: item.mediaUrl,
              mediaType: item.mediaType,
              stickerId: item.stickerId,
              stickerEmoji: item.stickerEmoji,
              stickerLabel: item.stickerLabel,
              stickerAnimation: item.stickerAnimation,
              reactions: item.reactions || {},
              userReactions: item.userReactions || {},
              reactionUsers: item.reactionUsers || {},
              expiresAt: item.expiresAt,
              createdAt: item.createdAt || item.timestamp || Date.now(),
              timestamp: item.timestamp || item.createdAt || Date.now(),
              status: item.status || ((item.isPrivate || item.type === 'private') ? 'sent' : 'read')
            };
          })
          .filter(m => !isMsgExpired(m, PUBLIC_MESSAGE_TTL_MS))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          localStorage.setItem(localKey, JSON.stringify(list));
          onMessages(list);
          return;
        }
      }, (err) => {
        console.warn("RTDB messages read notice:", err);
      });
    } catch (e) {
      console.warn("RTDB attach listener exception:", e);
    }
  }

  // Priority 2: Firestore collection `rooms/{roomId}/messages` (auto-filters & cleans 24h expired messages)
  let firestoreUnsub: (() => void) | null = null;
  if (db) {
    try {
      const messagesRef = collection(db, 'rooms', roomId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      firestoreUnsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: Message[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || data.timestamp || Date.now());
            const msgItem: Message = {
              id: data.id || docSnap.id,
              roomId,
              senderId: data.userId || data.senderId,
              senderName: data.userName || data.senderName,
              senderAvatar: data.userAvatar || data.senderAvatar || '',
              senderRole: data.userVipTier || data.senderRole || 'member',
              senderVipBadge: data.userVipBadge || data.senderVipBadge || '',
              badges: data.badges || [],
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
              reactions: data.reactions || {},
              userReactions: data.userReactions || {},
              reactionUsers: data.reactionUsers || {},
              expiresAt: data.expiresAt || undefined,
              createdAt: createdMs,
              timestamp: data.timestamp || createdMs,
              status: data.status || ((data.isPrivate || data.type === 'private') ? 'sent' : 'read')
            };
            if (isMsgExpired(msgItem, PUBLIC_MESSAGE_TTL_MS)) {
              // Silent background purge of expired Firestore message (>24h)
              deleteDoc(docSnap.ref).catch(() => {});
            } else {
              list.push(msgItem);
            }
          });
          localStorage.setItem(localKey, JSON.stringify(list));
          onMessages(list);
        } else {
          localStorage.setItem(localKey, JSON.stringify([]));
          onMessages([]);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/messages`);
      });
    } catch {}
  }

  // Priority 3: Fallback local reader + BroadcastChannel
  const getLocalMessages = (): Message[] => {
    try {
      const saved = localStorage.getItem(localKey);
      const parsed: Message[] = saved ? JSON.parse(saved) : [];
      return parsed.filter(m => !isMsgExpired(m, PUBLIC_MESSAGE_TTL_MS));
    } catch {
      return [];
    }
  };

  onMessages(getLocalMessages());

  const handleBroadcast = (e: MessageEvent) => {
    if (
      (e.data?.type === 'REALTIME_NEW_MESSAGE' ||
        e.data?.type === 'ROOM_MESSAGE_DELETED' ||
        e.data?.type === 'MESSAGE_REACTION_UPDATE' ||
        e.data?.type === 'ROOM_MESSAGES_READ_UPDATE') &&
      e.data.roomId === roomId
    ) {
      onMessages(getLocalMessages());
    }
  };

  liveChatBus?.addEventListener('message', handleBroadcast);
  return () => {
    if (rtdbUnsub) rtdbUnsub();
    if (firestoreUnsub) firestoreUnsub();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// Send Real Message to Firebase (saved both in room and strictly under user's UID path)
export async function sendFirestoreMessage(
  roomId: string,
  message: Partial<Message>
): Promise<Message> {
  const uid = message.senderId || currentAuthUid || 'usr_guest';
  const isPrivateMsg = !!message.isPrivate || message.type === 'private';
  const newMsg: Message = {
    id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    roomId,
    senderId: uid,
    senderName: message.senderName || 'مستخدم',
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
    expiresAt: Date.now() + PUBLIC_MESSAGE_TTL_MS,
    createdAt: Date.now(),
    timestamp: Date.now(),
    status: message.status || (isPrivateMsg ? 'sent' : 'read')
  };

  // Strip undefined properties before Firebase writes
  const cleanPayload = Object.fromEntries(
    Object.entries(newMsg).filter(([, v]) => v !== undefined)
  );

  // 1. Save to local storage for 0ms instantaneous feedback
  const localKey = `messages_room_${roomId}`;
  try {
    const saved = localStorage.getItem(localKey);
    const list: Message[] = saved ? JSON.parse(saved) : [];
    if (!list.some(m => m.id === newMsg.id)) {
      list.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch {}

  // 2. Broadcast across tabs
  liveChatBus?.postMessage({
    type: 'REALTIME_NEW_MESSAGE',
    roomId,
    message: newMsg
  });

  // 3. Save to Firebase Realtime Database
  if (rtdb) {
    try {
      // Room messages list
      const rtdbMsgRef = ref(rtdb, `messages/${roomId}/${newMsg.id}`);
      await set(rtdbMsgRef, {
        ...cleanPayload,
        userId: uid,
        createdAt: Date.now()
      });

      // User's own message archive under UID path (users/{uid}/messages) for isolation
      if (uid !== 'system_bot') {
        const userMsgRef = ref(rtdb, `users/${uid}/messages/${newMsg.id}`);
        await set(userMsgRef, {
          ...cleanPayload,
          roomId,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.warn("RTDB write notice:", err);
    }
  }

  // 4. Save to Firebase Firestore with deterministic document ID matching newMsg.id
  if (db) {
    try {
      const msgDocRef = doc(db, 'rooms', roomId, 'messages', newMsg.id);
      await setDoc(msgDocRef, {
        id: newMsg.id,
        text: newMsg.content,
        userId: uid,
        userName: newMsg.senderName,
        userAvatar: newMsg.senderAvatar,
        userVipTier: newMsg.senderRole,
        userVipBadge: newMsg.senderVipBadge,
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
        reactions: newMsg.reactions || {},
        userReactions: newMsg.userReactions || {},
        reactionUsers: newMsg.reactionUsers || {},
        expiresAt: newMsg.expiresAt,
        status: newMsg.status,
        timestamp: newMsg.timestamp,
        createdAt: serverTimestamp()
      }, { merge: true });

      // User's personal message log in Firestore under UID path (users/{uid}/user_messages)
      if (uid !== 'system_bot') {
        const userMsgDocRef = doc(db, 'users', uid, 'user_messages', newMsg.id);
        await setDoc(userMsgDocRef, {
          id: newMsg.id,
          roomId,
          text: newMsg.content,
          type: newMsg.type,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.warn("Firestore write notice:", err);
    }
  }

  return newMsg;
}

// ==========================================
// 3. USER PROFILE SYNCHRONIZATION (Realtime Database & Firestore under UID path)
// ==========================================

export function subscribeToUserProfile(
  userId: string,
  onUpdate: (user: Partial<User>) => void
): () => void {
  let unsubRtdb: (() => void) | null = null;
  if (rtdb && userId) {
    try {
      const userRef = ref(rtdb, `users/${userId}`);
      unsubRtdb = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          onUpdate(data);
        }
      });
    } catch {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'USER_PROFILE_SYNC' && e.data.userId === userId) {
      onUpdate(e.data.user);
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    if (unsubRtdb) unsubRtdb();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// Sync/Save User Profile strictly under UID path `users/{user.id}`
export async function syncUserProfileToFirebase(user: User): Promise<void> {
  const profilePayload = {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    country: user.country,
    countryFlag: user.countryFlag,
    role: user.role,
    vipBadge: user.vipBadge,
    coins: user.coins,
    earningsEgp: user.earningsEgp,
    earningsUsd: user.earningsUsd,
    badges: user.badges || [],
    ratingPoints: user.ratingPoints || 0,
    isBanned: user.isBanned || false,
    isMuted: user.isMuted || false,
    frameStyle: user.frameStyle || '',
    profileBanner: user.profileBanner || '',
    favoriteMusicUrl: user.favoriteMusicUrl || '',
    status: user.status || 'online',
    sessionId: user.sessionId || '',
    isGuest: !!user.isGuest,
    updatedAt: Date.now()
  };

  // 1. Local update
  localStorage.setItem('arab_chat_user', JSON.stringify(user));
  liveChatBus?.postMessage({
    type: 'USER_PROFILE_SYNC',
    userId: user.id,
    user: profilePayload
  });

  // 2. Realtime Database: users/{userId} & global_presence/{userId}
  if (rtdb && user.id) {
    try {
      const userRef = ref(rtdb, `users/${user.id}`);
      await update(userRef, profilePayload);
      await update(ref(rtdb, `global_presence/${user.id}`), {
        status: profilePayload.status,
        name: profilePayload.name,
        avatar: profilePayload.avatar,
        role: profilePayload.role,
        vipBadge: profilePayload.vipBadge,
        lastSeen: Date.now()
      }).catch(() => {});
    } catch (e) {
      console.warn("RTDB user profile sync error:", e);
    }
  }

  // 3. Firestore: users/{userId} & online_users/{userId}
  if (db && user.id) {
    try {
      const userDocRef = doc(db, 'users', user.id);
      await setDoc(userDocRef, profilePayload, { merge: true });
      await setDoc(doc(db, 'online_users', user.id), {
        id: user.id,
        name: user.name,
        avatar: user.avatar || '',
        role: profilePayload.role,
        vipBadge: profilePayload.vipBadge,
        badges: profilePayload.badges,
        frameStyle: profilePayload.frameStyle,
        profileBanner: profilePayload.profileBanner,
        favoriteMusicUrl: profilePayload.favoriteMusicUrl,
        isBanned: profilePayload.isBanned,
        isMuted: profilePayload.isMuted,
        coins: profilePayload.coins,
        ratingPoints: profilePayload.ratingPoints,
        status: profilePayload.status,
        isOnline: true,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore user profile sync error:", e);
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
    try {
      await setDoc(doc(db, 'users', userId), {
        status: normalizedStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await setDoc(doc(db, 'online_users', userId), {
        id: userId,
        status: normalizedStatus,
        isOnline: normalizedStatus !== 'offline',
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore activity status update notice:', e);
    }
  }

  if (rtdb) {
    try {
      await update(ref(rtdb, `users/${userId}`), {
        status: normalizedStatus,
        updatedAt: Date.now()
      });
      await update(ref(rtdb, `global_presence/${userId}`), {
        status: normalizedStatus,
        lastSeen: Date.now()
      });
    } catch (e) {
      console.warn('RTDB activity status update notice:', e);
    }
  }

  return true;
}

// Subscribe to all platform users for Admin Panel & Online List
export function subscribeToAllUsers(
  onUsers: (users: User[]) => void
): () => void {
  const usersMap = new Map<string, User>();

  const emit = () => {
    onUsers(Array.from(usersMap.values()));
  };

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const usersCol = collection(db, 'users');
      unsubFirestore = onSnapshot(usersCol, (snap) => {
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          usersMap.set(docSnap.id, {
            id: docSnap.id,
            name: data.name || 'مستخدم',
            username: data.username || 'user',
            avatar: data.avatar || '',
            countryFlag: data.countryFlag || '🇪🇬',
            country: data.country || 'مصر',
            role: data.role || 'member',
            vipBadge: data.vipBadge || '',
            coins: Number(data.coins) || 0,
            earningsEgp: Number(data.earningsEgp) || 0,
            badges: Array.isArray(data.badges) ? data.badges : [],
            ratingPoints: Number(data.ratingPoints) || 0,
            giftsReceivedCount: Number(data.giftsReceivedCount) || 0,
            level: Number(data.level) || 1,
            isBanned: Boolean(data.isBanned),
            isMuted: Boolean(data.isMuted),
            isGuest: Boolean(data.isGuest),
            frameStyle: data.frameStyle || '',
            profileBanner: data.profileBanner || '',
            favoriteMusicUrl: data.favoriteMusicUrl || '',
            bio: data.bio || '',
            status: data.status || 'online',
            isOnline: data.status !== 'offline'
          } as User);
        });
        emit();
      }, (e) => {
        console.warn('Firestore subscribeToAllUsers notice:', e);
      });
    } catch (e) {}
  }

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const usersRef = ref(rtdb, 'users');
      unsubRtdb = onValue(usersRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          Object.values(val).forEach((u: any) => {
            if (u && u.id) usersMap.set(u.id, { ...usersMap.get(u.id), ...u });
          });
          emit();
        }
      });
    } catch {}
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
  };
}

// ==========================================
// 4. ADMIN CONTROL PANEL ACTIONS
// ==========================================

export async function adminUpdateUser(
  targetUserId: string,
  updates: Partial<User>
): Promise<void> {
  if (rtdb) {
    try {
      const targetRef = ref(rtdb, `users/${targetUserId}`);
      await update(targetRef, updates);
    } catch (e) {
      console.warn("Admin update RTDB notice:", e);
    }
  }

  if (db) {
    try {
      const userDoc = doc(db, 'users', targetUserId);
      await setDoc(userDoc, updates, { merge: true });
      await setDoc(doc(db, 'online_users', targetUserId), updates, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Admin update Firestore notice:", e);
    }
  }

  realtimeSocket.sendAdminAction(targetUserId, updates);

  liveChatBus?.postMessage({
    type: 'ADMIN_USER_UPDATED',
    userId: targetUserId,
    updates
  });
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
  amount: number;
  amountEgp?: number;
  note: string;
  type?: 'coins' | 'vip';
  itemName?: string;
  coins?: number;
  vipTierId?: string;
  paymentMethod?: 'instapay' | 'vodafone_cash' | 'orange_cash' | 'etisalat_cash' | 'we_pay' | 'e_wallet';
  senderAccountOrPhone?: string;
  transactionRef?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export async function submitPaymentRequest(order: {
  userId: string;
  userName: string;
  type: 'coins' | 'vip';
  itemName: string;
  amountEgp: number;
  coinsAmount?: number;
  vipTierId?: string;
  paymentMethod: 'instapay' | 'vodafone_cash' | 'orange_cash' | 'etisalat_cash' | 'we_pay' | 'e_wallet';
  senderAccountOrPhone: string;
  transactionRef?: string;
  note?: string;
}): Promise<{ success: boolean; orderId: string }> {
  const orderId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = Date.now();

  const payload: PendingPaymentOrder = {
    id: orderId,
    userId: order.userId,
    userName: order.userName,
    amount: order.amountEgp,
    amountEgp: order.amountEgp,
    type: order.type,
    itemName: order.itemName,
    coins: order.coinsAmount,
    vipTierId: order.vipTierId,
    paymentMethod: order.paymentMethod,
    senderAccountOrPhone: order.senderAccountOrPhone,
    transactionRef: order.transactionRef,
    note: order.note || `${order.type === 'coins' ? 'شحن كوينز' : 'ترقية VIP'}: ${order.itemName} بمبلغ ${order.amountEgp} ج.م عبر ${order.paymentMethod === 'instapay' ? 'InstaPay' : 'المحفظة الإلكترونية'}`,
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
  const userId = customUserId || (auth?.currentUser?.uid) || ("GUEST_" + Math.floor(Math.random() * 100000));
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
  if (rtdb) {
    try {
      const pendingRef = ref(rtdb, 'payments_pending');
      const unsub = onValue(pendingRef, (snap) => {
        const val = snap.val();
        if (val) {
          const list: PendingPaymentOrder[] = Object.entries(val).map(([key, data]: [string, any]) => ({
            id: key,
            ...data
          }));
          callback(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        } else {
          callback([]);
        }
      });
      return unsub;
    } catch {}
  }
  return () => {};
}

export async function approvePendingPayment(
  paymentId: string,
  userId: string,
  coinsToAdd: number,
  vipTierId?: string
): Promise<void> {
  const now = Date.now();
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
        }
        if (vipTierId) {
          const tierBadge = vipTierId === 'vip_diamond' ? 'VIP ألماسي' : vipTierId === 'vip_gold' ? 'VIP ذهبي' : vipTierId === 'vip_silver' ? 'VIP فضي' : 'VIP';
          updates.role = vipTierId;
          updates.vipBadge = tierBadge;
        }
        await update(userRef, updates);
      }
    } catch (e) {
      console.warn("Approve payment RTDB error:", e);
    }
  }

  // 2. Update Firestore
  if (db) {
    try {
      const payDocRef = doc(db, 'payment_requests', paymentId);
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
      if (vipTierId) {
        const tierBadge = vipTierId === 'vip_diamond' ? 'VIP ألماسي' : vipTierId === 'vip_gold' ? 'VIP ذهبي' : vipTierId === 'vip_silver' ? 'VIP فضي' : 'VIP';
        userUpdates.role = vipTierId;
        userUpdates.vipBadge = tierBadge;
      }
      await updateDoc(userDocRef, userUpdates);
    } catch (e) {
      console.warn("Approve payment Firestore error:", e);
    }
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

export async function sendFriendRequest(
  sender: User,
  receiverId: string
): Promise<boolean> {
  const reqId = `freq_${Date.now()}_${sender.id}`;
  const req: FriendRequest = {
    id: reqId,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    receiverId,
    createdAt: Date.now(),
    status: 'pending'
  };

  try {
    const key = `friend_requests_${receiverId}`;
    const stored = localStorage.getItem(key);
    const list: FriendRequest[] = stored ? JSON.parse(stored) : [];
    if (!list.some(r => r.senderId === sender.id && r.status === 'pending')) {
      list.push(req);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}

  // Broadcast via WebSocket and channel
  realtimeSocket.sendFriendRequest(req);
  liveChatBus?.postMessage({
    type: 'NEW_FRIEND_REQUEST',
    request: req
  });

  if (rtdb) {
    try {
      const reqRef = ref(rtdb, `friend_requests/${receiverId}/${req.id}`);
      await set(reqRef, req);
    } catch {}
  }

  if (db) {
    try {
      // 1. Write to target user's incoming subcollection: users/{receiverId}/friend_requests/{reqId}
      await setDoc(doc(db, 'users', receiverId, 'friend_requests', reqId), {
        ...req,
        createdAt: serverTimestamp()
      });

      // 2. Also record in root collection for lookup
      await setDoc(doc(db, 'friendRequests', reqId), {
        ...req,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore friend request write error:', e);
    }
  }

  return true;
}

export function subscribeToFriendRequests(
  userId: string,
  onRequests: (reqs: FriendRequest[]) => void
): () => void {
  const localKey = `friend_requests_${userId}`;
  const reqsMap = new Map<string, FriendRequest>();

  const emit = () => {
    let acceptedFriendIds = new Set<string>();
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

    const list = Array.from(reqsMap.values()).filter(r => 
      r.status === 'pending' && !acceptedFriendIds.has(r.senderId)
    );
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
    onRequests(list);
  };

  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  loadLocal().forEach((r: FriendRequest) => {
    if (r && r.id) reqsMap.set(r.id, r);
  });
  emit();

  // 1. Firestore listener on users/{userId}/friend_requests
  let unsubFirestoreUser: (() => void) | null = null;
  let unsubFirestoreRoot: (() => void) | null = null;

  if (db && userId) {
    try {
      const userReqsCol = collection(db, 'users', userId, 'friend_requests');
      unsubFirestoreUser = onSnapshot(userReqsCol, (snap) => {
        if (!snap.empty) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'pending') {
              reqsMap.set(docSnap.id, {
                id: docSnap.id,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                receiverId: data.receiverId || userId,
                status: 'pending',
                createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
              });
            } else {
              reqsMap.delete(docSnap.id);
            }
          });
          emit();
        }
      }, (e) => {
        console.warn('Firestore user friend requests listener notice:', e);
      });

      // Query root collection where receiverId == userId
      const rootQuery = query(collection(db, 'friendRequests'), where('receiverId', '==', userId));
      unsubFirestoreRoot = onSnapshot(rootQuery, (snap) => {
        if (!snap.empty) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'pending') {
              reqsMap.set(docSnap.id, {
                id: docSnap.id,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                receiverId: data.receiverId || userId,
                status: 'pending',
                createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
              });
            } else {
              reqsMap.delete(docSnap.id);
            }
          });
          emit();
        }
      }, (e) => {
        console.warn('Firestore root friend requests listener notice:', e);
      });
    } catch (e) {}
  }

  // 2. Realtime Socket listener
  const unsubSocket = realtimeSocket.subscribeToFriendRequests((req) => {
    if (req.receiverId === userId) {
      reqsMap.set(req.id, req);
      emit();
    }
  });

  // 3. RTDB listener
  let unsubRtdb: (() => void) | null = null;
  if (rtdb && userId) {
    try {
      const reqsRef = ref(rtdb, `friend_requests/${userId}`);
      unsubRtdb = onValue(reqsRef, (snap) => {
        const val = snap.val();
        if (val) {
          const list: FriendRequest[] = Object.values(val);
          list.forEach(r => {
            if (r && r.id && r.status === 'pending') reqsMap.set(r.id, r);
          });
          emit();
        }
      });
    } catch {}
  }

  const handleMsg = (e: MessageEvent) => {
    if (e.data?.type === 'NEW_FRIEND_REQUEST' && e.data.request.receiverId === userId) {
      reqsMap.set(e.data.request.id, e.data.request);
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleMsg);

  return () => {
    if (unsubFirestoreUser) unsubFirestoreUser();
    if (unsubFirestoreRoot) unsubFirestoreRoot();
    if (unsubSocket) unsubSocket();
    if (unsubRtdb) unsubRtdb();
    liveChatBus?.removeEventListener('message', handleMsg);
  };
}

// ==========================================
// FRIENDS MANAGEMENT (Firestore /users/{uid}/friends & Realtime Database)
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
  const now = Date.now();
  const friendId = friendData.id;

  const currentFriendRecord: Friend = {
    id: friendId,
    friendId: friendId,
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
    name: currentUserData?.name || 'مستخدم',
    avatar: currentUserData?.avatar || '',
    countryFlag: currentUserData?.countryFlag || '🇪🇬',
    role: currentUserData?.role || 'عضو مميز',
    vipBadge: currentUserData?.vipBadge || '',
    bio: currentUserData?.bio || '',
    addedAt: now
  };

  // 1. Local Cache for friends
  try {
    const localKey = `user_friends_${currentUserId}`;
    const raw = localStorage.getItem(localKey);
    const list: Friend[] = raw ? JSON.parse(raw) : [];
    const updated = list.filter(f => (f.friendId || f.id) !== friendId);
    updated.unshift(currentFriendRecord);
    localStorage.setItem(localKey, JSON.stringify(updated));

    // Also remove from local pending friend requests
    const reqKey = `friend_requests_${currentUserId}`;
    const reqRaw = localStorage.getItem(reqKey);
    if (reqRaw) {
      const reqList: FriendRequest[] = JSON.parse(reqRaw);
      const filteredReqs = reqList.filter(r => r.senderId !== friendId && r.id !== requestId);
      localStorage.setItem(reqKey, JSON.stringify(filteredReqs));
    }
  } catch {}

  // 2. Realtime Database (both sides)
  if (rtdb) {
    try {
      await set(ref(rtdb, `users/${currentUserId}/friends/${friendId}`), currentFriendRecord);
      await set(ref(rtdb, `users/${friendId}/friends/${currentUserId}`), peerFriendRecord);
      // Remove all pending requests from this friend in RTDB
      if (requestId) {
        await remove(ref(rtdb, `friend_requests/${currentUserId}/${requestId}`));
      }
      await remove(ref(rtdb, `friend_requests/${currentUserId}/${friendId}`));
    } catch (e) {
      console.warn("RTDB friend accept notice:", e);
    }
  }

  // 3. Firestore: users/{userId}/friends/{friendId} (both sides)
  if (db) {
    try {
      await setDoc(doc(db, 'users', currentUserId, 'friends', friendId), {
        ...currentFriendRecord,
        timestamp: serverTimestamp()
      });
      await setDoc(doc(db, 'users', friendId, 'friends', currentUserId), {
        ...peerFriendRecord,
        timestamp: serverTimestamp()
      });
      
      // Clean up the accepted request from subcollection
      const userReqCol = collection(db, 'users', currentUserId, 'friend_requests');
      const q = query(userReqCol, where('senderId', '==', friendId));
      const snap = await getDocs(q);
      snap.forEach(d => deleteDoc(d.ref));
      if (requestId) {
        try {
          await deleteDoc(doc(db, 'users', currentUserId, 'friend_requests', requestId));
        } catch {}
      }

      // Also clean up from root friendRequests collection
      const rootQ = query(collection(db, 'friendRequests'), where('senderId', '==', friendId), where('receiverId', '==', currentUserId));
      const rootSnap = await getDocs(rootQ);
      rootSnap.forEach(d => deleteDoc(d.ref));
      if (requestId) {
        try {
          await deleteDoc(doc(db, 'friendRequests', requestId));
        } catch {}
      }
    } catch (e) {
      console.warn("Firestore friend accept notice:", e);
    }
  }

  // 4. Tab Broadcast
  liveChatBus?.postMessage({
    type: 'FRIENDS_LIST_UPDATED',
    userId: currentUserId,
    friend: currentFriendRecord
  });
}

export async function declineFriendRequestInDB(
  currentUserId: string,
  requestId: string,
  senderId?: string
): Promise<void> {
  // 1. Remove from local cache
  try {
    const key = `friend_requests_${currentUserId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const list: FriendRequest[] = JSON.parse(raw);
      const filtered = list.filter(r => r.id !== requestId && r.senderId !== senderId);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {}

  // 2. Remove from RTDB
  if (rtdb) {
    try {
      await remove(ref(rtdb, `friend_requests/${currentUserId}/${requestId}`));
      if (senderId) {
        await remove(ref(rtdb, `friend_requests/${currentUserId}/${senderId}`));
      }
    } catch {}
  }

  // 3. Remove from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'friend_requests', requestId));
      await deleteDoc(doc(db, 'friendRequests', requestId));
      if (senderId) {
        const q = query(collection(db, 'friendRequests'), where('senderId', '==', senderId), where('receiverId', '==', currentUserId));
        const snap = await getDocs(q);
        snap.forEach(d => deleteDoc(d.ref));
      }
    } catch (e) {
      console.warn('Firestore decline friend request notice:', e);
    }
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
  const localKey = `user_friends_${currentUserId}`;

  const loadLocal = (): Friend[] => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const currentFriendsMap: { [id: string]: Friend } = {};
  loadLocal().forEach(f => {
    currentFriendsMap[f.friendId || f.id] = f;
  });

  const onlineSet = new Set<string>();
  const onlineStatusMap = new Map<string, User['status']>();

  const emitUpdatedFriends = () => {
    const list = Object.values(currentFriendsMap).map(f => {
      const fId = f.friendId || f.id;
      const isOnline = onlineSet.has(fId);
      return {
        ...f,
        isOnline,
        status: onlineStatusMap.get(fId) || f.status || (isOnline ? 'online' : 'offline')
      };
    });
    onFriends(list);
  };

  emitUpdatedFriends();

  let unsubFirestore: (() => void) | null = null;
  let unsubOnlineFirestore: (() => void) | null = null;
  let unsubRtdb: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;

  // 1. Firestore onSnapshot on users/{currentUserId}/friends
  if (db && currentUserId) {
    try {
      const friendsCol = collection(db, 'users', currentUserId, 'friends');
      unsubFirestore = onSnapshot(friendsCol, (snapshot) => {
        if (!snapshot.empty) {
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const fId = docSnap.id;
            currentFriendsMap[fId] = {
              id: fId,
              friendId: fId,
              name: data.name || 'صديق',
              avatar: data.avatar || '',
              countryFlag: data.countryFlag || '🇪🇬',
              role: data.role || 'عضو مميز',
              vipBadge: data.vipBadge || '',
              bio: data.bio || '',
              status: data.status,
              addedAt: data.addedAt || Date.now()
            };
          });
          try {
            localStorage.setItem(localKey, JSON.stringify(Object.values(currentFriendsMap)));
          } catch {}
          emitUpdatedFriends();
        }
      }, (err) => {
        console.warn("Firestore friends list onSnapshot notice:", err);
      });

      // Real-time activity status listener on online_users
      const onlineCol = collection(db, 'online_users');
      unsubOnlineFirestore = onSnapshot(onlineCol, (snap) => {
        const now = Date.now();
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const lastSeen = data.lastSeen || (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : now);
          if (now - lastSeen < 180000) {
            onlineSet.add(docSnap.id);
            onlineStatusMap.set(docSnap.id, (data.status as User['status']) || 'online');
          } else {
            onlineSet.delete(docSnap.id);
            onlineStatusMap.delete(docSnap.id);
          }
        });
        emitUpdatedFriends();
      }, () => {});
    } catch (e) {
      console.warn("Firestore friends subscribe error:", e);
    }
  }

  // 2. Realtime Database backup listener
  if (rtdb && currentUserId) {
    try {
      const friendsRef = ref(rtdb, `users/${currentUserId}/friends`);
      unsubRtdb = onValue(friendsRef, (snap) => {
        const val = snap.val();
        if (val) {
          Object.values(val).forEach((f: any) => {
            if (f && (f.friendId || f.id)) {
              const id = f.friendId || f.id;
              currentFriendsMap[id] = { ...currentFriendsMap[id], ...f };
            }
          });
          emitUpdatedFriends();
        }
      });
    } catch (e) {}

    // Listen to global presence to know who is online & their live status
    try {
      const globalPresenceRef = ref(rtdb, 'global_presence');
      unsubOnline = onValue(globalPresenceRef, (snap) => {
        const val = snap.val();
        if (val) {
          Object.entries(val).forEach(([uid, uData]: [string, any]) => {
            onlineSet.add(uid);
            if (uData?.status) {
              onlineStatusMap.set(uid, uData.status as User['status']);
            }
          });
        }
        emitUpdatedFriends();
      });
    } catch (e) {}
  }

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'FRIENDS_LIST_UPDATED') {
      const local = loadLocal();
      local.forEach(f => {
        currentFriendsMap[f.friendId || f.id] = f;
      });
      emitUpdatedFriends();
    } else if (e.data?.type === 'USER_PROFILE_SYNC' && e.data.userId && e.data.user?.status) {
      onlineStatusMap.set(e.data.userId, e.data.user.status);
      emitUpdatedFriends();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubOnlineFirestore) unsubOnlineFirestore();
    if (unsubRtdb) unsubRtdb();
    if (unsubOnline) unsubOnline();
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

  if (rtdb) {
    try {
      await set(ref(rtdb, `users/${currentUserId}/friends/${friendId}`), null);
      await set(ref(rtdb, `users/${friendId}/friends/${currentUserId}`), null);
    } catch {}
  }

  if (db) {
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'friends', friendId));
      await deleteDoc(doc(db, 'users', friendId, 'friends', currentUserId));
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

export async function sendRoomJoinRequest(roomId: string, user: User): Promise<boolean> {
  const reqPayload: RoomJoinRequest = {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    requestedAt: Date.now(),
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
  status: 'accepted' | 'rejected'
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
    if (error?.code === 'auth/popup-closed-by-user') {
      msg = 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    } else if (error?.code === 'auth/popup-blocked') {
      msg = 'قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.';
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
// 14. DIRECT MESSAGING (Alphabetical Conversation Channel ID)
// ==========================================
export function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

export function subscribeToDirectMessages(
  userId1: string,
  userId2: string,
  onMessages: (messages: Message[]) => void
): () => void {
  // Alphabetical sort to guarantee identical conversation channel for both participants
  const convId = getConversationId(userId1, userId2);
  const localKey = `direct_messages_${convId}`;
  const msgsMap = new Map<string, Message>();

  const emit = () => {
    const list = Array.from(msgsMap.values())
      .filter(m => !isMsgExpired(m, DM_MESSAGE_TTL_MS))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
    onMessages(list);
  };

  const loadLocal = (): Message[] => {
    try {
      const data = localStorage.getItem(localKey);
      const parsed: Message[] = data ? JSON.parse(data) : [];
      return parsed.filter(m => !isMsgExpired(m, DM_MESSAGE_TTL_MS));
    } catch {
      return [];
    }
  };

  // Populate cache
  loadLocal().forEach(m => {
    if (m && m.id) msgsMap.set(m.id, m);
  });
  emit();

  // 1. Real-time WebSocket listener (instant across sockets)
  const unsubSocket = realtimeSocket.subscribeToDirectMessages(convId, (msg) => {
    if (!isMsgExpired(msg, DM_MESSAGE_TTL_MS)) {
      msgsMap.set(msg.id, msg);
      emit();
    }
  });

  // 1.1 WebSocket direct read-receipt listener
  const unsubReadSocket = realtimeSocket.subscribeToDirectMessagesRead(convId, (messageIds) => {
    let changed = false;
    messageIds.forEach(id => {
      const existing = msgsMap.get(id);
      if (existing && existing.status !== 'read') {
        msgsMap.set(id, { ...existing, status: 'read' });
        changed = true;
      }
    });
    if (changed) emit();
  });

  // 2. Real-time Firestore onSnapshot Listener (auto-cleans 7-day expired DMs)
  let firestoreUnsub: (() => void) | null = null;
  if (db) {
    try {
      const msgsCol = collection(db, 'direct_chats', convId, 'messages');
      firestoreUnsub = onSnapshot(msgsCol, (snapshot) => {
        if (!snapshot.empty) {
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const msgItem = {
              id: docSnap.id,
              ...data,
              timestamp: data.timestamp || (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now())
            } as Message;
            if (isMsgExpired(msgItem, DM_MESSAGE_TTL_MS)) {
              msgsMap.delete(docSnap.id);
              deleteDoc(docSnap.ref).catch(() => {});
            } else {
              msgsMap.set(docSnap.id, msgItem);
            }
          });
          emit();
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `direct_chats/${convId}/messages`);
      });
    } catch (e) {
      console.warn("Firestore onSnapshot init notice:", e);
    }
  }

  // 3. Realtime Database Real-time Listener (Supplementary fast-sync)
  let rtdbUnsub: (() => void) | null = null;
  if (rtdb) {
    try {
      const msgRef = rtdbQuery(ref(rtdb, `direct_messages/${convId}`), limitToLast(100));
      rtdbUnsub = onValue(msgRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          Object.keys(val).forEach((k) => {
            const item = val[k];
            if (item && item.id) msgsMap.set(item.id, item);
          });
          emit();
        }
      });
    } catch (e) {
      console.warn("Direct messages RTDB listener error:", e);
    }
  }

  // 4. Tab broadcast
  const handleBroadcast = (e: MessageEvent) => {
    if (
      (e.data?.type === 'DIRECT_MESSAGE_UPDATE' ||
        e.data?.type === 'DIRECT_MESSAGE_DELETED' ||
        e.data?.type === 'DIRECT_MESSAGE_READ_UPDATE') &&
      e.data.convId === convId
    ) {
      if (e.data.message) {
        msgsMap.set(e.data.message.id, e.data.message);
      } else if (e.data.type === 'DIRECT_MESSAGE_READ_UPDATE' && Array.isArray(e.data.messageIds)) {
        e.data.messageIds.forEach((id: string) => {
          const existing = msgsMap.get(id);
          if (existing) msgsMap.set(id, { ...existing, status: 'read' });
        });
      }
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    unsubSocket();
    unsubReadSocket();
    if (firestoreUnsub) firestoreUnsub();
    if (rtdbUnsub) rtdbUnsub();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

export async function markDirectMessagesAsRead(
  currentUserId: string,
  peerId: string,
  messages: Message[]
): Promise<void> {
  if (!currentUserId || !peerId || !messages.length) return;
  const unread = messages.filter(m => m.senderId !== currentUserId && m.status !== 'read');
  if (unread.length === 0) return;

  const unreadIds = unread.map(m => m.id);
  const convId = getConversationId(currentUserId, peerId);
  const localKey = `direct_messages_${convId}`;

  // 1. Update local cache
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const updated = list.map(m => (unreadIds.includes(m.id) ? { ...m, status: 'read' as const } : m));
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
  } catch {}

  // 2. Real-time WebSocket & BroadcastChannel
  realtimeSocket.sendDirectMessagesRead(convId, currentUserId, peerId, unreadIds);
  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_READ_UPDATE',
    convId,
    messageIds: unreadIds
  });

  // 3. Persist to RTDB & Firestore
  for (const id of unreadIds) {
    if (rtdb) {
      try {
        await update(ref(rtdb, `direct_messages/${convId}/${id}`), { status: 'read' });
      } catch {}
    }
    if (db) {
      try {
        await setDoc(doc(db, 'direct_chats', convId, 'messages', id), { status: 'read' }, { merge: true });
      } catch {}
    }
  }
}

export async function sendDirectMessage(
  userId1: string,
  userId2: string,
  message: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string }
): Promise<Message> {
  const convId = getConversationId(userId1, userId2);
  const localKey = `direct_messages_${convId}`;

  const messageId = message.id || `dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  const newMsg: Message = {
    id: messageId,
    senderId: message.senderId || userId1,
    senderName: message.senderName || 'مستخدم',
    senderAvatar: message.senderAvatar || '',
    senderRole: message.senderRole || 'member',
    senderVipBadge: message.senderVipBadge || '',
    badges: message.badges || [],
    type: message.type || 'private',
    isPrivate: true,
    recipientId: userId2,
    content: message.content || message.text || '',
    text: message.content || message.text || '',
    audioDuration: message.audioDuration,
    audioUrl: message.audioUrl,
    voiceUrl: message.voiceUrl,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    stickerId: message.stickerId,
    stickerEmoji: message.stickerEmoji,
    stickerLabel: message.stickerLabel,
    stickerAnimation: message.stickerAnimation,
    gift: message.gift,
    expiresAt: now + DM_MESSAGE_TTL_MS,
    createdAt: now,
    timestamp: now,
    status: 'sent'
  };

  // Clean object without undefined values for Firestore / RTDB
  const cleanMsgPayload = Object.fromEntries(
    Object.entries(newMsg).filter(([, v]) => v !== undefined)
  );

  // 1. Instant local storage for zero-lag UI
  try {
    const saved = localStorage.getItem(localKey);
    const list: Message[] = saved ? JSON.parse(saved) : [];
    if (!list.some(m => m.id === newMsg.id)) {
      list.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch {}

  // 2. Dispatch via WebSocket to server to deliver immediately to recipient socket (by ID & active sessionId)
  realtimeSocket.sendDirectMessage(convId, userId2, cleanMsgPayload as Partial<Message>, message.recipientSessionId);

  // 3. Update recent chat index locally for both users
  const updateLocalRecentChat = (uId: string, peerId: string, peerName: string, peerAvatar: string) => {
    try {
      const recentKey = `recent_direct_chats_${uId}`;
      const raw = localStorage.getItem(recentKey);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter((c: any) => c.chatId !== convId);
      updated.unshift({
        chatId: convId,
        peerId,
        peerName: peerName || 'مستخدم',
        peerAvatar: peerAvatar || '',
        lastMessage: newMsg.content || 'رسالة خاصة',
        lastSenderId: userId1,
        lastTimestamp: now
      });
      localStorage.setItem(recentKey, JSON.stringify(updated.slice(0, 50)));
    } catch {}
  };
  updateLocalRecentChat(userId1, userId2, message.recipientName || '', message.recipientAvatar || '');
  updateLocalRecentChat(userId2, userId1, newMsg.senderName, newMsg.senderAvatar);

  // 4. Broadcast across tabs
  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_UPDATE',
    convId,
    message: newMsg
  });
  liveChatBus?.postMessage({
    type: 'DIRECT_CHATS_UPDATED'
  });

  // 5. RTDB send
  if (rtdb) {
    try {
      const msgRef = ref(rtdb, `direct_messages/${convId}/${newMsg.id}`);
      await set(msgRef, cleanMsgPayload);

      // Store in user direct chat index
      await set(ref(rtdb, `user_direct_chats/${userId1}/${convId}`), {
        chatId: convId,
        peerId: userId2,
        peerName: message.recipientName || 'مستخدم',
        peerAvatar: message.recipientAvatar || '',
        lastMessage: newMsg.content || 'رسالة خاصة',
        lastSenderId: userId1,
        lastTimestamp: now
      });

      await set(ref(rtdb, `user_direct_chats/${userId2}/${convId}`), {
        chatId: convId,
        peerId: userId1,
        peerName: newMsg.senderName,
        peerAvatar: newMsg.senderAvatar,
        lastMessage: newMsg.content || 'رسالة خاصة',
        lastSenderId: userId1,
        lastTimestamp: now
      });
    } catch (e) {
      console.warn("RTDB direct message send notice:", e);
    }
  }

  // 6. Firestore send: write message document and update recent_chats subcollections
  if (db) {
    try {
      const parentDocRef = doc(db, 'direct_chats', convId);
      await setDoc(parentDocRef, {
        chatId: convId,
        participants: [userId1, userId2].sort(),
        lastMessage: newMsg.content,
        lastSenderId: userId1,
        lastSenderName: newMsg.senderName,
        lastTimestamp: now,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const msgDocRef = doc(db, 'direct_chats', convId, 'messages', newMsg.id);
      await setDoc(msgDocRef, {
        ...cleanMsgPayload,
        createdAt: serverTimestamp()
      });

      // Write to sender recent_chats subcollection in Firestore
      await setDoc(doc(db, 'users', userId1, 'recent_chats', convId), {
        chatId: convId,
        peerId: userId2,
        peerName: message.recipientName || 'مستخدم',
        peerAvatar: message.recipientAvatar || '',
        lastMessage: newMsg.content || 'رسالة خاصة',
        lastSenderId: userId1,
        lastTimestamp: now,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Write to recipient recent_chats subcollection in Firestore
      await setDoc(doc(db, 'users', userId2, 'recent_chats', convId), {
        chatId: convId,
        peerId: userId1,
        peerName: newMsg.senderName,
        peerAvatar: newMsg.senderAvatar,
        lastMessage: newMsg.content || 'رسالة خاصة',
        lastSenderId: userId1,
        lastTimestamp: now,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore direct message notice:", e);
    }
  }

  return newMsg;
}

export function subscribeToUserRecentDirectChats(
  currentUserId: string,
  onChats: (chats: any[]) => void
): () => void {
  const localKey = `recent_direct_chats_${currentUserId}`;
  const chatsMap = new Map<string, any>();

  const emit = () => {
    const list = Array.from(chatsMap.values()).sort(
      (a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0)
    );
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
    onChats(list);
  };

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  loadLocal().forEach((c: any) => {
    if (c && c.chatId) chatsMap.set(c.chatId, c);
  });
  emit();

  // 1. Firestore listener on users/{currentUserId}/recent_chats
  let unsubFirestore: (() => void) | null = null;
  if (db && currentUserId) {
    try {
      const recentCol = collection(db, 'users', currentUserId, 'recent_chats');
      unsubFirestore = onSnapshot(recentCol, (snap) => {
        if (!snap.empty) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            chatsMap.set(docSnap.id, {
              chatId: docSnap.id,
              ...data,
              lastTimestamp: data.lastTimestamp || (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now())
            });
          });
          emit();
        }
      }, (e) => {
        console.warn('Firestore recent_chats notice:', e);
      });
    } catch (e) {}
  }

  // 2. Realtime Database listener
  let unsubRtdb: (() => void) | null = null;
  if (rtdb && currentUserId) {
    try {
      const userChatsRef = ref(rtdb, `user_direct_chats/${currentUserId}`);
      unsubRtdb = onValue(userChatsRef, (snap) => {
        const val = snap.val();
        if (val) {
          Object.values(val).forEach((c: any) => {
            if (c && c.chatId) chatsMap.set(c.chatId, c);
          });
          emit();
        }
      });
    } catch {}
  }

  // 3. Socket incoming direct messages to update recent list in real-time
  const unsubSocket = realtimeSocket.subscribeToGlobalDirectMessages((msg, convId) => {
    const isPeer = msg.senderId !== currentUserId;
    chatsMap.set(convId, {
      chatId: convId,
      peerId: isPeer ? msg.senderId : msg.recipientId,
      peerName: isPeer ? msg.senderName : (msg as any).recipientName || 'مستخدم',
      peerAvatar: isPeer ? msg.senderAvatar : (msg as any).recipientAvatar || '',
      lastMessage: msg.content || 'رسالة خاصة',
      lastSenderId: msg.senderId,
      lastTimestamp: msg.timestamp || Date.now()
    });
    emit();
  });

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'DIRECT_MESSAGE_UPDATE' || e.data?.type === 'DIRECT_CHATS_UPDATED') {
      if (e.data.message && e.data.convId) {
        const msg = e.data.message;
        const convId = e.data.convId;
        const isPeer = msg.senderId !== currentUserId;
        chatsMap.set(convId, {
          chatId: convId,
          peerId: isPeer ? msg.senderId : msg.recipientId,
          peerName: isPeer ? msg.senderName : msg.recipientName || 'مستخدم',
          peerAvatar: isPeer ? msg.senderAvatar : msg.recipientAvatar || '',
          lastMessage: msg.content || 'رسالة خاصة',
          lastSenderId: msg.senderId,
          lastTimestamp: msg.timestamp || Date.now()
        });
      }
      emit();
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
    unsubSocket();
    liveChatBus?.removeEventListener('message', handleBroadcast);
  };
}

// ==========================================
// 15. TYPING INDICATOR (WebSocket + Realtime Database & Broadcast)
// ==========================================
export async function setRoomTyping(
  roomId: string,
  user: User,
  isTyping: boolean
): Promise<void> {
  if (user?.id) {
    realtimeSocket.sendRoomTyping(roomId, user.id, user.name, isTyping);
  }

  if (rtdb && user.id) {
    try {
      const typingRef = ref(rtdb, `typing/${roomId}/${user.id}`);
      if (isTyping) {
        await set(typingRef, {
          id: user.id,
          name: user.name,
          timestamp: Date.now()
        });
        onDisconnect(typingRef).remove();
      } else {
        await set(typingRef, null);
      }
    } catch {}
  }

  liveChatBus?.postMessage({
    type: 'ROOM_TYPING_UPDATE',
    roomId,
    user: { id: user.id, name: user.name },
    isTyping
  });
}

export function subscribeToRoomTyping(
  roomId: string,
  currentUserId: string,
  onTypingUsers: (users: { id: string; name: string }[]) => void
): () => void {
  const typingMap = new Map<string, { id: string; name: string; timestamp: number; source: 'rtdb' | 'realtime' }>();

  const emitTyping = () => {
    const now = Date.now();
    const list: { id: string; name: string }[] = [];
    typingMap.forEach((u, id) => {
      if (id !== currentUserId && now - u.timestamp < 5500) {
        list.push({ id: u.id, name: u.name });
      } else if (now - u.timestamp >= 5500) {
        typingMap.delete(id);
      }
    });
    onTypingUsers(list);
  };

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const typingRef = ref(rtdb, `typing/${roomId}`);
      unsubRtdb = onValue(typingRef, (snapshot) => {
        const val = snapshot.val();
        const activeRtdbIds = new Set<string>();
        if (val) {
          const active = Object.values(val) as { id: string; name: string; timestamp: number }[];
          active.forEach(u => {
            if (u && u.id && u.id !== currentUserId) {
              activeRtdbIds.add(u.id);
              typingMap.set(u.id, {
                id: u.id,
                name: u.name,
                timestamp: u.timestamp || Date.now(),
                source: 'rtdb'
              });
            }
          });
        }
        // Clear any RTDB-sourced entries that have stopped typing
        typingMap.forEach((entry, id) => {
          if (entry.source === 'rtdb' && !activeRtdbIds.has(id)) {
            typingMap.delete(id);
          }
        });
        emitTyping();
      });
    } catch {}
  }

  // Real-time WebSocket typing presence
  const unsubSocketTyping = realtimeSocket.subscribeToRoomTyping(roomId, (uid, uName, isTyping) => {
    if (uid && uid !== currentUserId) {
      if (isTyping) {
        typingMap.set(uid, { id: uid, name: uName || 'مستخدم', timestamp: Date.now(), source: 'realtime' });
      } else {
        typingMap.delete(uid);
      }
      emitTyping();
    }
  });

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ROOM_TYPING_UPDATE' && e.data.roomId === roomId) {
      const u = e.data.user;
      if (u && u.id !== currentUserId) {
        if (e.data.isTyping) {
          typingMap.set(u.id, { id: u.id, name: u.name, timestamp: Date.now(), source: 'realtime' });
        } else {
          typingMap.delete(u.id);
        }
        emitTyping();
      }
    }
  };
  liveChatBus?.addEventListener('message', handleBroadcast);

  const sweepInterval = setInterval(emitTyping, 2500);

  return () => {
    clearInterval(sweepInterval);
    if (unsubRtdb) unsubRtdb();
    unsubSocketTyping();
    liveChatBus?.removeEventListener('message', handleBroadcast);
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
    if (rtdb) {
      try {
        await update(ref(rtdb, `messages/${roomId}/${id}`), { status: 'read' });
      } catch {}
    }
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

  // RTDB update
  if (rtdb) {
    try {
      const msgRef = ref(rtdb, `messages/${roomId}/${messageId}`);
      await update(msgRef, {
        reactions: updatedMsg.reactions || {},
        userReactions: updatedMsg.userReactions || {},
        reactionUsers: updatedMsg.reactionUsers || {}
      });
    } catch (e) {
      console.warn("RTDB reaction update notice:", e);
    }
  }
}

// ==========================================
// 17. MESSAGE DELETION (Rooms & Direct Chats)
// ==========================================
export async function deleteRoomMessage(roomId: string, messageId: string): Promise<boolean> {
  const localKey = `messages_room_${roomId}`;
  
  // 1. Immediate local storage purge
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const filtered = list.filter(m => m.id !== messageId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  // 2. Broadcast immediately to open tabs
  liveChatBus?.postMessage({
    type: 'ROOM_MESSAGE_DELETED',
    roomId,
    messageId
  });

  // 3. Remove from Realtime Database
  if (rtdb) {
    try {
      const msgRef = ref(rtdb, `messages/${roomId}/${messageId}`);
      await remove(msgRef);
    } catch (e) {
      console.warn("RTDB message removal notice:", e);
    }
  }

  // 4. Delete document from Firestore
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

  // 1. Immediate local storage purge
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: Message[] = JSON.parse(raw);
      const filtered = list.filter(m => m.id !== messageId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  // 2. Broadcast immediately to open tabs
  liveChatBus?.postMessage({
    type: 'DIRECT_MESSAGE_DELETED',
    convId,
    messageId
  });

  // 3. Remove from Realtime Database
  if (rtdb) {
    try {
      const msgRef = ref(rtdb, `direct_messages/${convId}/${messageId}`);
      await remove(msgRef);
    } catch (e) {
      console.warn("RTDB direct message removal notice:", e);
    }
  }

  // 4. Delete document from Firestore
  if (db) {
    try {
      const docRef = doc(db, 'direct_chats', convId, 'messages', messageId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn("Firestore direct message delete notice:", e);
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

  // 4. Firebase RTDB atomic runTransaction + real-time onValue listener
  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    try {
      const visitorsRef = ref(rtdb, 'platform_stats/cumulative_visitors');
      unsubRtdb = onValue(visitorsRef, (snapshot) => {
        const remoteVal = snapshot.val();
        if (typeof remoteVal === 'number' && !isNaN(remoteVal)) {
          reportHighest(remoteVal);
          realtimeSocket.syncCumulativeVisitorsCount(Math.max(currentMax, remoteVal));
        }
      });

      runTransaction(visitorsRef, (existingVal) => {
        const existingNum =
          typeof existingVal === 'number' && !isNaN(existingVal) ? existingVal : BASE;
        const floor = Math.max(existingNum, currentMax, BASE);
        return shouldIncrementThisSession ? floor + 1 : floor;
      })
        .then((result) => {
          const committedVal = result?.snapshot?.val();
          if (typeof committedVal === 'number' && !isNaN(committedVal)) {
            reportHighest(committedVal);
            realtimeSocket.syncCumulativeVisitorsCount(committedVal);
          }
        })
        .catch(() => {});
    } catch {}
  }

  return () => {
    unsubSocket();
    if (unsubFirestore) unsubFirestore();
    if (unsubRtdb) unsubRtdb();
  };
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

export async function uploadPrivateChatMedia(
  file: File,
  convId: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; mediaType: 'image' | 'video' }> {
  const isVideo = file.type.startsWith('video/');
  const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Try Firebase Storage first
  if (storage) {
    try {
      const fileRef = storageRef(storage, `private_media/${convId}/${safeName}`);
      const url = await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, file);
        const timeoutId = setTimeout(() => {
          reject(new Error('Storage upload timeout'));
        }, 12000);
        task.on(
          'state_changed',
          (snapshot) => {
            if (onProgress && snapshot.totalBytes > 0) {
              onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            }
          },
          (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
          async () => {
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

  // Fallback for images when Storage CORS/rules block
  if (!isVideo) {
    const compressedUrl = await compressImageToDataUrl(file);
    if (onProgress) onProgress(100);
    return { url: compressedUrl, mediaType: 'image' };
  }

  throw new Error('تعذر رفع الفيديو: يرجى التأكد من حجم الملف (< 15 ميجا) واتصال الإنترنت.');
}

// ==========================================
// 23. SOCIAL DATING FORUM (`forum_posts` + `comments`)
// ==========================================
const LOCAL_FORUM_KEY = 'shat_masr_forum_posts_v1';

export function subscribeToForumPosts(
  onUpdate: (posts: ForumPost[]) => void
): () => void {
  const readLocal = (): ForumPost[] => {
    try {
      const raw = localStorage.getItem(LOCAL_FORUM_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const writeLocal = (list: ForumPost[]) => {
    try {
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(list.slice(0, 80)));
    } catch {}
  };

  onUpdate(readLocal());

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      const q = query(collection(db, 'forum_posts'), orderBy('createdAt', 'desc'), limit(60));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: ForumPost[] = snapshot.docs.map((d) => {
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
              text: data.text || '',
              imageUrl: data.imageUrl || undefined,
              isPinned: Boolean(data.isPinned),
              pinnedAt: typeof data.pinnedAt === 'number' ? data.pinnedAt : undefined,
              pinnedBy: data.pinnedBy || undefined,
              likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
              likesCount: Number(data.likesCount) || (Array.isArray(data.likedBy) ? data.likedBy.length : 0),
              commentsCount: Number(data.commentsCount) || 0,
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
            };
          });
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

export async function createForumPost(user: User, text: string, imageUrl?: string): Promise<ForumPost> {
  const id = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const post: ForumPost = {
    id,
    authorId: user.id,
    authorName: user.name,
    authorAvatar: user.avatar || '',
    authorGender: user.gender || 'male',
    authorCountryFlag: user.countryFlag || '🇪🇬',
    authorVipBadge: user.vipBadge || '',
    authorRole: user.role || 'member',
    text: text.trim(),
    ...(imageUrl ? { imageUrl } : {}),
    isPinned: false,
    likedBy: [],
    likesCount: 0,
    commentsCount: 0,
    createdAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    const list: ForumPost[] = raw ? JSON.parse(raw) : [];
    list.unshift(post);
    localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });

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

export async function toggleForumPostLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      const updated = list.map((p) => {
        if (p.id !== postId) return p;
        const setIds = new Set(p.likedBy || []);
        if (currentlyLiked) setIds.delete(userId);
        else setIds.add(userId);
        const likedBy = Array.from(setIds);
        return { ...p, likedBy, likesCount: likedBy.length };
      });
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(updated));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });

  if (db) {
    try {
      await updateDoc(doc(db, 'forum_posts', postId), {
        likedBy: currentlyLiked ? arrayRemove(userId) : arrayUnion(userId),
        likesCount: increment(currentlyLiked ? -1 : 1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `forum_posts/${postId}`);
    }
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

export async function addForumComment(postId: string, user: User, text: string): Promise<ForumComment> {
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

  const localKey = `shat_masr_forum_comments_${postId}`;
  try {
    const raw = localStorage.getItem(localKey);
    const list: ForumComment[] = raw ? JSON.parse(raw) : [];
    list.push(comment);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  if (db) {
    try {
      await setDoc(doc(db, 'forum_posts', postId, 'comments', id), comment);
      await updateDoc(doc(db, 'forum_posts', postId), {
        commentsCount: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forum_posts/${postId}/comments/${id}`);
    }
  }
  return comment;
}

export async function deleteForumPost(postId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_FORUM_KEY);
    if (raw) {
      const list: ForumPost[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_FORUM_KEY, JSON.stringify(list.filter(p => p.id !== postId)));
    }
  } catch {}
  liveChatBus?.postMessage({ type: 'FORUM_POSTS_CHANGED' });
  if (db) {
    try {
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaults = getDefaultSharedMissions();
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
            const defaults = getDefaultSharedMissions();
            for (const m of defaults) {
              setDoc(doc(db!, 'room_daily_missions', m.id), m, { merge: true }).catch(() => {});
            }
            onUpdate(defaults);
            return;
          }
          const list: SharedRoomMission[] = snap.docs.map(d => d.data() as SharedRoomMission);
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
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const list: SharedRoomMission[] = JSON.parse(raw);
      const updated = list.map(m =>
        m.id === missionId
          ? { ...m, claimedBy: Array.from(new Set([...(m.claimedBy || []), userId])) }
          : m
      );
      localStorage.setItem(localKey, JSON.stringify(updated));
      liveChatBus?.postMessage({ type: 'SHARED_MISSIONS_CHANGED' });
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

export async function submitUserReport(report: Omit<UserReport, 'id' | 'status'>): Promise<UserReport> {
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const full: UserReport = {
    ...report,
    id,
    status: 'pending'
  };

  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    const list: UserReport[] = raw ? JSON.parse(raw) : [];
    list.unshift(full);
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(list.slice(0, 150)));
  } catch {}

  realtimeSocket.sendUserReport(full);
  liveChatBus?.postMessage({ type: 'USER_REPORTS_CHANGED' });

  if (db) {
    try {
      await setDoc(doc(db, 'user_reports', id), full);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `user_reports/${id}`);
    }
  }
  return full;
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

  if (rtdb) {
    try {
      await remove(ref(rtdb, `messages/${roomId}`));
    } catch {}
  }
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

export function subscribeAllDirectChatsForOwner(
  ownerEmail: string | undefined,
  onUpdate: (threads: SecretDirectChatThread[]) => void
): () => void {
  if (!ownerEmail || ownerEmail.toLowerCase() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
    onUpdate([]);
    return () => {};
  }
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'direct_chats'), orderBy('lastTimestamp', 'desc'), limit(60));
    return onSnapshot(
      q,
      (snap) => {
        const list: SecretDirectChatThread[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            chatId: data.chatId || d.id,
            participants: Array.isArray(data.participants) ? data.participants : [],
            lastMessage: data.lastMessage || '',
            lastSenderId: data.lastSenderId,
            lastSenderName: data.lastSenderName,
            lastTimestamp: Number(data.lastTimestamp) || Date.now()
          };
        });
        onUpdate(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'direct_chats');
      }
    );
  } catch {
    return () => {};
  }
}

export async function fetchDirectMessagesSilentForOwner(
  chatId: string,
  ownerEmail: string | undefined
): Promise<Message[]> {
  if (!ownerEmail || ownerEmail.toLowerCase() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
    return [];
  }
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'direct_chats', chatId, 'messages'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          timestamp: data.timestamp || (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now())
        } as Message;
      })
      .filter(m => !isMsgExpired(m, DM_MESSAGE_TTL_MS))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `direct_chats/${chatId}/messages`);
    return [];
  }
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

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, 'rooms'),
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data();
            if (typeof data?.isLocked === 'boolean') {
              if (data.isLocked) {
                merged[d.id] = true;
                try { localStorage.setItem(`room_lock_${d.id}`, 'true'); } catch {}
              } else {
                delete merged[d.id];
                try { localStorage.removeItem(`room_lock_${d.id}`); } catch {}
              }
            }
          });
          emit();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'rooms');
        }
      );
    } catch {}
  }

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
  const emitSorted = () => {
    const list = Array.from(userMap.values())
      .filter((u) => u && u.id && !u.isBanned && u.id !== 'system_bot')
      .sort((a, b) => scoreFor(b) - scoreFor(a))
      .slice(0, 15);
    onLeaderboard(list);
  };

  let unsubUsers: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;

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
              isOnline: d.status !== 'offline',
            } as User);
          });
          emitSorted();
        },
        (err) => {
          console.warn('Firestore leaderboard users onSnapshot notice:', err);
        }
      );

      unsubOnline = onSnapshot(
        collection(db, 'online_users'),
        (snap) => {
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            const prev = userMap.get(docSnap.id);
            userMap.set(docSnap.id, {
              ...prev,
              id: docSnap.id,
              name: d.name || prev?.name || 'عضو',
              avatar: d.avatar || prev?.avatar || '',
              role: d.role || prev?.role || 'member',
              vipBadge: d.vipBadge || prev?.vipBadge || '',
              countryFlag: d.countryFlag || prev?.countryFlag || '🇪🇬',
              coins: Number(d.coins ?? prev?.coins) || 0,
              ratingPoints: Number(d.ratingPoints ?? prev?.ratingPoints) || 0,
              status: d.status || prev?.status || 'online',
              isOnline: true,
            } as User);
          });
          emitSorted();
        },
        (err) => {
          console.warn('Firestore leaderboard online_users onSnapshot notice:', err);
        }
      );
    } catch (e) {
      console.warn('Leaderboard subscription setup notice:', e);
    }
  }

  return () => {
    if (unsubUsers) unsubUsers();
    if (unsubOnline) unsubOnline();
  };
}
