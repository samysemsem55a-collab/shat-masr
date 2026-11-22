import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

function computeServerBuildVersion(): string {
  try {
    const distHtml = path.resolve(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distHtml)) {
      const stat = fs.statSync(distHtml);
      return `build-${Math.floor(stat.mtimeMs)}`;
    }
  } catch {}
  return `srv-${Date.now()}`;
}
const SERVER_BUILD_VERSION = computeServerBuildVersion();

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// In-Memory Authoritative Real-Time Data Store
interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole: string;
  senderVipBadge: string;
  badges?: string[];
  type: string;
  isPrivate?: boolean;
  recipientId?: string;
  content: string;
  text?: string;
  gift?: any;
  replyTo?: any;
  audioDuration?: number;
  audioUrl?: string;
  voiceUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  stickerId?: string;
  stickerEmoji?: string;
  stickerLabel?: string;
  stickerAnimation?: string;
  reactions?: Record<string, number>;
  userReactions?: Record<string, string>;
  reactionUsers?: Record<string, string[]>;
  expiresAt?: number;
  createdAt: number;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
}

const PUBLIC_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DM_MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isMessageExpired(msg: { expiresAt?: number; timestamp?: number; createdAt?: number }, defaultTtlMs: number): boolean {
  const now = Date.now();
  if (typeof msg.expiresAt === 'number' && msg.expiresAt > 0) {
    return msg.expiresAt <= now;
  }
  const baseTime = msg.timestamp || msg.createdAt || now;
  return now - baseTime > defaultTtlMs;
}

interface RoomOccupant {
  id: string;
  name: string;
  avatar: string;
  role: string;
  vipBadge: string;
  isOnline: boolean;
  isBanned?: boolean;
  isMuted?: boolean;
  joinedAt: number;
  sessionId?: string;
  isGuest?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: string;
  vipBadge: string;
  coins: number;
  earningsEgp: number;
  badges: string[];
  isBanned?: boolean;
  isMuted?: boolean;
  isGuest?: boolean;
  sessionId?: string;
}

interface PinnedRoomMessage {
  id: string;
  senderId?: string;
  senderName: string;
  content: string;
  pinnedBy?: string;
  pinnedAt: number;
}

// Stores
const messagesByRoom: Map<string, ChatMessage[]> = new Map();
const lastMessageByRoom: Map<string, { senderName: string; content: string; type?: string; timestamp: number }> = new Map();
const typingUsersByRoom: Map<string, Map<string, { userId: string; userName: string; updatedAt: number }>> = new Map();
const ROOM_TYPING_TTL_MS = 6000;
const pinnedMessageByRoom: Map<string, PinnedRoomMessage | null> = new Map();
const roomBackgroundByRoom: Map<string, string> = new Map();
const roomLockByRoom: Map<string, boolean> = new Map();
const directMessagesByConv: Map<string, any[]> = new Map();
const roomOccupants: Map<string, Map<string, RoomOccupant>> = new Map();
const usersStore: Map<string, UserProfile> = new Map();
const userReportsStore: any[] = [];
const lastAnnouncedJoinAt: Map<string, number> = new Map();
const GLOBAL_JOIN_COOLDOWN_MS = 4000;
let latestAppUpdateNotice: { version: string; message: string; pushedBy: string; timestamp: number } | null = null;
const socketToUser: Map<WebSocket, { userId: string; sessionId?: string; roomId?: string; lastHeartbeatAt?: number }> = new Map();
// Global map of connected sockets by userId
const connectedUsers: Map<string, { ws: WebSocket; user: UserProfile; lastSeen: number }> = new Map();

function getAllRoomsTypingSnapshot(): Record<string, { userId: string; userName: string }[]> {
  const now = Date.now();
  const snapshot: Record<string, { userId: string; userName: string }[]> = {};
  typingUsersByRoom.forEach((typersMap, rId) => {
    const active: { userId: string; userName: string }[] = [];
    typersMap.forEach((entry, uid) => {
      if (now - entry.updatedAt < ROOM_TYPING_TTL_MS) {
        active.push({ userId: entry.userId, userName: entry.userName });
      } else {
        typersMap.delete(uid);
      }
    });
    if (active.length > 0) {
      snapshot[rId] = active;
    } else if (typersMap.size === 0) {
      typingUsersByRoom.delete(rId);
    }
  });
  return snapshot;
}

function setRoomTypingState(
  roomId: string,
  userId: string,
  userName: string,
  isTyping: boolean,
  excludeWs?: WebSocket
) {
  if (!roomId || !userId) return;
  let roomTypers = typingUsersByRoom.get(roomId);
  if (isTyping) {
    if (!roomTypers) {
      roomTypers = new Map();
      typingUsersByRoom.set(roomId, roomTypers);
    }
    roomTypers.set(userId, {
      userId,
      userName: userName || 'عضو شات مصر',
      updatedAt: Date.now()
    });
  } else if (roomTypers) {
    const hadUser = roomTypers.delete(userId);
    if (roomTypers.size === 0) {
      typingUsersByRoom.delete(roomId);
    }
    if (!hadUser) return;
  } else {
    return;
  }

  broadcastToAll(
    {
      type: 'ROOM_TYPING_UPDATE',
      roomId,
      userId,
      userName: userName || '',
      isTyping: !!isTyping
    },
    excludeWs
  );
}

// 3s Room Typing TTL Sweep (cleans orphaned typers if client drops abruptly)
setInterval(() => {
  if (typingUsersByRoom.size === 0) return;
  const now = Date.now();
  typingUsersByRoom.forEach((typersMap, rId) => {
    typersMap.forEach((entry, uid) => {
      if (now - entry.updatedAt >= ROOM_TYPING_TTL_MS) {
        typersMap.delete(uid);
        broadcastToAll({
          type: 'ROOM_TYPING_UPDATE',
          roomId: rId,
          userId: uid,
          userName: entry.userName,
          isTyping: false
        });
      }
    });
    if (typersMap.size === 0) {
      typingUsersByRoom.delete(rId);
    }
  });
}, 3000);

// 10s WS Heartbeat Keepalive + 30s Stale User Timeout Sweep
setInterval(() => {
  const now = Date.now();
  let presenceChanged = false;

  wss.clients.forEach((client) => {
    const info = socketToUser.get(client);
    if (client.readyState === WebSocket.OPEN) {
      if (info?.lastHeartbeatAt && now - info.lastHeartbeatAt > 35000) {
        // Stale unresponsive client (>35s without heartbeat/pong)
        try {
          client.terminate();
        } catch {}
        return;
      }
      try {
        client.ping();
      } catch {}
    }
  });

  // Remove connectedUsers whose heartbeat/lastSeen exceeded 30s and whose socket is no longer open
  connectedUsers.forEach((entry, uid) => {
    const socketClosed = !entry.ws || entry.ws.readyState !== WebSocket.OPEN;
    if (socketClosed && now - entry.lastSeen > 30000) {
      connectedUsers.delete(uid);
      presenceChanged = true;
    }
  });

  // Clean room occupants whose socket is closed and inactive > 30s
  roomOccupants.forEach((occMap, rId) => {
    let roomChanged = false;
    occMap.forEach((occ, uid) => {
      const conn = connectedUsers.get(uid);
      const hasOpenConn = conn && conn.ws && conn.ws.readyState === WebSocket.OPEN;
      if (!hasOpenConn && now - (occ.joinedAt || 0) > 30000) {
        occMap.delete(uid);
        roomChanged = true;
        presenceChanged = true;
      }
    });
    if (roomChanged) {
      const list = Array.from(occMap.values());
      broadcastToRoom(rId, {
        type: 'PRESENCE_UPDATE',
        roomId: rId,
        count: list.length,
        users: list
      });
    }
  });

  if (presenceChanged) {
    broadcastToAll({
      type: 'GLOBAL_PRESENCE_UPDATE',
      users: getGlobalOnlineUsers(),
      onlineCount: Math.max(1, connectedUsers.size)
    });
  }
}, 10000);

// Periodic purge of expired public (24h) and direct (7d) messages
setInterval(() => {
  messagesByRoom.forEach((msgs, rId) => {
    const filtered = msgs.filter(m => !isMessageExpired(m, PUBLIC_MESSAGE_TTL_MS));
    if (filtered.length !== msgs.length) {
      messagesByRoom.set(rId, filtered);
    }
  });
  directMessagesByConv.forEach((msgs, convId) => {
    const filtered = msgs.filter(m => !isMessageExpired(m, DM_MESSAGE_TTL_MS));
    if (filtered.length !== msgs.length) {
      directMessagesByConv.set(convId, filtered);
    }
  });
}, 5 * 60 * 1000);

// Initialize default rooms: Only Egypt 1 and Egypt 2
const DEFAULT_ROOMS = ['room_egypt', 'room_egypt2'];
DEFAULT_ROOMS.forEach(roomId => {
  messagesByRoom.set(roomId, []);
  roomOccupants.set(roomId, new Map());
});

// Persist custom room background themes across restarts
const ROOM_BACKGROUNDS_FILE = path.resolve(__dirname, '.room-backgrounds.json');
try {
  if (fs.existsSync(ROOM_BACKGROUNDS_FILE)) {
    const rawBg = fs.readFileSync(ROOM_BACKGROUNDS_FILE, 'utf-8');
    const parsedBg = JSON.parse(rawBg);
    if (parsedBg && typeof parsedBg === 'object') {
      Object.entries(parsedBg).forEach(([rId, theme]) => {
        if (typeof theme === 'string' && theme && theme !== 'default') {
          roomBackgroundByRoom.set(rId, theme);
        }
      });
    }
  }
} catch {}

function persistRoomBackgrounds() {
  try {
    fs.writeFileSync(
      ROOM_BACKGROUNDS_FILE,
      JSON.stringify(Object.fromEntries(roomBackgroundByRoom), null, 2),
      'utf-8'
    );
  } catch {}
}

// Persist room lock states across restarts
const ROOM_LOCKS_FILE = path.resolve(__dirname, '.room-locks.json');
try {
  if (fs.existsSync(ROOM_LOCKS_FILE)) {
    const rawLocks = fs.readFileSync(ROOM_LOCKS_FILE, 'utf-8');
    const parsedLocks = JSON.parse(rawLocks);
    if (parsedLocks && typeof parsedLocks === 'object') {
      Object.entries(parsedLocks).forEach(([rId, locked]) => {
        if (locked === true) {
          roomLockByRoom.set(rId, true);
        }
      });
    }
  }
} catch {}

function persistRoomLocks() {
  try {
    fs.writeFileSync(
      ROOM_LOCKS_FILE,
      JSON.stringify(Object.fromEntries(roomLockByRoom), null, 2),
      'utf-8'
    );
  } catch {}
}

// Authoritative Monotonic Cumulative Visitors Counter (never decreases)
const VISITORS_STATS_FILE = path.resolve(__dirname, '.cumulative-visitors.json');
const BASE_VISITORS_COUNT = 15480;
let cumulativeVisitorsCount = BASE_VISITORS_COUNT;
const recordedVisitTokens: Set<string> = new Set();

try {
  if (fs.existsSync(VISITORS_STATS_FILE)) {
    const raw = fs.readFileSync(VISITORS_STATS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.count === 'number' && !isNaN(parsed.count)) {
      cumulativeVisitorsCount = Math.max(BASE_VISITORS_COUNT, parsed.count);
    }
  }
} catch {}

function persistCumulativeVisitorsCount() {
  try {
    fs.writeFileSync(
      VISITORS_STATS_FILE,
      JSON.stringify({ count: cumulativeVisitorsCount, updatedAt: Date.now() }),
      'utf-8'
    );
  } catch {}
}

function raiseCumulativeVisitorsMonotonic(candidateCount: number, incrementBy: number = 0): boolean {
  const safeCandidate = Number.isFinite(candidateCount) ? Math.floor(candidateCount) : BASE_VISITORS_COUNT;
  const next = Math.max(cumulativeVisitorsCount, safeCandidate, BASE_VISITORS_COUNT) + Math.max(0, incrementBy);
  if (next > cumulativeVisitorsCount) {
    cumulativeVisitorsCount = next;
    persistCumulativeVisitorsCount();
    return true;
  }
  return false;
}

// WebSocket Server (explicit /ws upgrade handling so it never interferes with other routes)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Leave other upgrade paths (such as /vite-hmr) for Vite's WebSocket listener
  } catch {
    socket.destroy();
  }
});

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      const info = socketToUser.get(client);
      if (info && info.roomId === roomId) {
        client.send(data);
      }
    }
  });
}

function broadcastToAll(message: any, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendToUser(targetUserId: string, message: any): boolean {
  const data = JSON.stringify(message);
  let sent = false;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const info = socketToUser.get(client);
      if (info && (info.userId === targetUserId || (info.sessionId && info.sessionId === targetUserId))) {
        client.send(data);
        sent = true;
      }
    }
  });
  return sent;
}

function getRoomOccupantsList(roomId: string): RoomOccupant[] {
  const occMap = roomOccupants.get(roomId);
  return occMap ? Array.from(occMap.values()) : [];
}

function getGlobalOnlineUsers(): RoomOccupant[] {
  const allUsersMap = new Map<string, RoomOccupant>();
  const now = Date.now();
  
  // 1. First add all currently registered connected sockets
  connectedUsers.forEach(({ user, lastSeen }, id) => {
    const isSocketOpen = Boolean(connectedUsers.get(id)?.ws && connectedUsers.get(id)?.ws.readyState === WebSocket.OPEN);
    if (!isSocketOpen && now - lastSeen > 45000) return;
    allUsersMap.set(id, {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      vipBadge: user.vipBadge,
      isOnline: true,
      isBanned: user.isBanned || false,
      isMuted: user.isMuted || false,
      joinedAt: lastSeen,
      sessionId: user.sessionId,
      isGuest: user.isGuest
    });
  });

  // 2. Also ensure any active room occupant is present
  roomOccupants.forEach((occupants) => {
    occupants.forEach((user, id) => {
      const conn = connectedUsers.get(id);
      const hasOpenSocket = Boolean(conn?.ws && conn.ws.readyState === WebSocket.OPEN);
      if (hasOpenSocket || now - (user.joinedAt || 0) <= 45000) {
        allUsersMap.set(id, { ...user, isOnline: true });
      }
    });
  });

  return Array.from(allUsersMap.values());
}

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected. Total clients:', wss.clients.size);
  socketToUser.set(ws, { userId: '', lastHeartbeatAt: Date.now() });

  ws.on('pong', () => {
    const info = socketToUser.get(ws);
    const now = Date.now();
    if (info) {
      info.lastHeartbeatAt = now;
      if (info.userId) {
        const entry = connectedUsers.get(info.userId);
        if (entry) entry.lastSeen = now;
      }
    }
  });

  ws.send(JSON.stringify({
    type: 'CUMULATIVE_VISITORS_UPDATE',
    count: cumulativeVisitorsCount
  }));
  ws.send(JSON.stringify({
    type: 'ALL_ROOM_BACKGROUNDS',
    backgrounds: Object.fromEntries(roomBackgroundByRoom)
  }));
  ws.send(JSON.stringify({
    type: 'ALL_ROOM_LOCKS',
    locks: Object.fromEntries(roomLockByRoom)
  }));
  ws.send(JSON.stringify({
    type: 'ALL_ROOM_LAST_MESSAGES',
    lastMessages: Object.fromEntries(lastMessageByRoom)
  }));
  ws.send(JSON.stringify({
    type: 'ALL_ROOM_TYPING',
    typingByRoom: getAllRoomsTypingSnapshot()
  }));
  if (latestAppUpdateNotice) {
    ws.send(JSON.stringify({
      type: 'APP_UPDATE_NOTICE',
      notice: latestAppUpdateNotice
    }));
  }

  ws.on('message', (raw) => {
    try {
      const action = JSON.parse(raw.toString());
      const { type, payload } = action;
      const msgInfo = socketToUser.get(ws);
      if (msgInfo) {
        msgInfo.lastHeartbeatAt = Date.now();
        if (msgInfo.userId) {
          const entry = connectedUsers.get(msgInfo.userId);
          if (entry) entry.lastSeen = Date.now();
        }
      }

      switch (type) {
        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        case 'HEARTBEAT': {
          const uid = payload?.userId || msgInfo?.userId;
          if (uid) {
            const entry = connectedUsers.get(uid);
            if (entry) entry.lastSeen = Date.now();
            if (msgInfo?.roomId) {
              const occ = roomOccupants.get(msgInfo.roomId)?.get(uid);
              if (occ) occ.joinedAt = Date.now();
            }
          }
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
          break;
        }

        case 'TOKEN_REFRESH': {
          ws.send(JSON.stringify({ type: 'TOKEN_REFRESH_ACK', timestamp: Date.now() }));
          break;
        }

        case 'USER_REGISTER': {
          const user: UserProfile = payload.user;
          if (user && user.id) {
            const existing = usersStore.get(user.id);
            const merged = { ...existing, ...user };
            usersStore.set(user.id, merged);
            const prevInfo = socketToUser.get(ws);
            socketToUser.set(ws, { userId: user.id, sessionId: user.sessionId, roomId: prevInfo?.roomId, lastHeartbeatAt: Date.now() });
            connectedUsers.set(user.id, { ws, user: merged, lastSeen: Date.now() });

            // Broadcast instant Global Join notification for registered non-guest users (with 4s reconnect cooldown)
            const cleanName = typeof merged.name === 'string' ? merged.name.trim() : '';
            const isRegisteredRealUser =
              !merged.isGuest &&
              cleanName.length >= 2 &&
              !cleanName.startsWith('زائر_') &&
              cleanName !== 'ضيف عربي';
            const nowMs = Date.now();
            const lastJoinMs = lastAnnouncedJoinAt.get(merged.id) || 0;
            if (isRegisteredRealUser && nowMs - lastJoinMs > GLOBAL_JOIN_COOLDOWN_MS) {
              lastAnnouncedJoinAt.set(merged.id, nowMs);
              broadcastToAll({
                type: 'GLOBAL_USER_JOINED',
                eventId: `join_${nowMs}_${merged.id}`,
                user: {
                  id: merged.id,
                  name: cleanName,
                  avatar: merged.avatar,
                  role: merged.role,
                  vipBadge: merged.vipBadge
                }
              }, ws);
            }

            // Deliver any non-expired direct messages targeting this user or their active sessionId
            directMessagesByConv.forEach((msgs, convId) => {
              const activeMsgs = msgs.filter(m => !isMessageExpired(m, DM_MESSAGE_TTL_MS));
              if (activeMsgs.length !== msgs.length) directMessagesByConv.set(convId, activeMsgs);
              activeMsgs.forEach((msg) => {
                const isForUser =
                  msg.recipientId === user.id ||
                  (user.sessionId && msg.recipientId === user.sessionId) ||
                  msg.senderId === user.id;
                if (isForUser && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'NEW_DIRECT_MESSAGE',
                    convId,
                    message: msg
                  }));
                }
              });
            });

            // Broadcast real global online users & count to ALL connected clients
            broadcastToAll({
              type: 'GLOBAL_PRESENCE_UPDATE',
              users: getGlobalOnlineUsers(),
              onlineCount: Math.max(1, connectedUsers.size)
            });
          }
          break;
        }

        case 'JOIN_ROOM': {
          const { roomId, user } = payload;
          if (!roomId || !user) return;

          // Clean up prior room membership if this socket switches rooms directly
          const prevSocketInfo = socketToUser.get(ws);
          if (prevSocketInfo?.roomId && prevSocketInfo.roomId !== roomId) {
            const oldOccMap = roomOccupants.get(prevSocketInfo.roomId);
            if (oldOccMap && oldOccMap.has(user.id)) {
              const departing = oldOccMap.get(user.id);
              setRoomTypingState(prevSocketInfo.roomId, user.id, departing?.name || user.name || '', false, ws);
              oldOccMap.delete(user.id);
              const oldList = Array.from(oldOccMap.values());
              broadcastToRoom(prevSocketInfo.roomId, {
                type: 'PRESENCE_UPDATE',
                roomId: prevSocketInfo.roomId,
                count: oldList.length,
                users: oldList
              });
            }
          }

          let occMap = roomOccupants.get(roomId);
          if (!occMap) {
            occMap = new Map();
            roomOccupants.set(roomId, occMap);
          }

          const joinTs = Date.now();
          // Register occupant
          const occupant: RoomOccupant = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            vipBadge: user.vipBadge,
            isOnline: true,
            isBanned: user.isBanned || false,
            isMuted: user.isMuted || false,
            joinedAt: joinTs,
            sessionId: user.sessionId,
            isGuest: user.isGuest
          };
          occMap.set(user.id, occupant);

          const prevStoredUser = usersStore.get(user.id);
          const mergedUser = { ...prevStoredUser, ...user };
          usersStore.set(user.id, mergedUser);
          connectedUsers.set(user.id, { ws, user: mergedUser, lastSeen: joinTs });
          socketToUser.set(ws, { userId: user.id, sessionId: user.sessionId, roomId, lastHeartbeatAt: joinTs });

          // Send existing non-expired room history (24h TTL, latest 30 for fast open)
          const rawHistory = messagesByRoom.get(roomId) || [];
          const history = rawHistory.filter(m => !isMessageExpired(m, PUBLIC_MESSAGE_TTL_MS));
          if (history.length !== rawHistory.length) messagesByRoom.set(roomId, history);
          ws.send(JSON.stringify({
            type: 'ROOM_HISTORY',
            roomId,
            messages: history.slice(-30)
          }));

          // Send active pinned message for this room if any
          const currentPinned = pinnedMessageByRoom.get(roomId) || null;
          ws.send(JSON.stringify({
            type: 'ROOM_PINNED_MESSAGE',
            roomId,
            pinnedMessage: currentPinned
          }));

          // Send custom room background theme if set
          const currentBg = roomBackgroundByRoom.get(roomId) || 'default';
          ws.send(JSON.stringify({
            type: 'ROOM_BACKGROUND_UPDATED',
            roomId,
            backgroundTheme: currentBg
          }));

          // Send current room lock state
          ws.send(JSON.stringify({
            type: 'ROOM_LOCK_UPDATED',
            roomId,
            isLocked: Boolean(roomLockByRoom.get(roomId))
          }));

          // Broadcast updated presence to all clients in room
          const occupantsList = Array.from(occMap.values());
          broadcastToRoom(roomId, {
            type: 'PRESENCE_UPDATE',
            roomId,
            count: occupantsList.length,
            users: occupantsList
          });

          // Broadcast global presence
          broadcastToAll({
            type: 'GLOBAL_PRESENCE_UPDATE',
            users: getGlobalOnlineUsers(),
            onlineCount: Math.max(1, connectedUsers.size)
          });

          // Announce room entry globally if not recently announced (ensures room-level joins are visible everywhere)
          const cleanJoinName = typeof user.name === 'string' ? user.name.trim() : '';
          const isValidRoomJoiner =
            !user.isGuest &&
            cleanJoinName.length >= 2 &&
            !cleanJoinName.startsWith('زائر_') &&
            cleanJoinName !== 'ضيف عربي';
          const joinNow = Date.now();
          const lastRoomJoinAnnounce = lastAnnouncedJoinAt.get(user.id) || 0;
          if (isValidRoomJoiner && joinNow - lastRoomJoinAnnounce > GLOBAL_JOIN_COOLDOWN_MS) {
            lastAnnouncedJoinAt.set(user.id, joinNow);
            broadcastToAll({
              type: 'GLOBAL_USER_JOINED',
              eventId: `join_${joinNow}_${user.id}`,
              user: {
                id: user.id,
                name: cleanJoinName,
                avatar: user.avatar,
                role: user.role,
                vipBadge: user.vipBadge
              }
            }, ws);
          }

          console.log(`[Join] User ${user.name} (${user.id}) joined ${roomId}. Room count: ${occupantsList.length}`);
          break;
        }

        case 'LEAVE_ROOM': {
          const { roomId, userId } = payload;
          const sInfo = socketToUser.get(ws);
          if (sInfo && sInfo.roomId === roomId) {
            sInfo.roomId = undefined;
            sInfo.lastHeartbeatAt = Date.now();
          }
          if (roomId && userId) {
            const occMap = roomOccupants.get(roomId);
            const departingUser = occMap?.get(userId);
            setRoomTypingState(roomId, userId, departingUser?.name || '', false, ws);
            if (occMap && occMap.has(userId)) {
              occMap.delete(userId);
              const list = Array.from(occMap.values());
              broadcastToRoom(roomId, {
                type: 'PRESENCE_UPDATE',
                roomId,
                count: list.length,
                users: list
              });
              broadcastToAll({
                type: 'GLOBAL_PRESENCE_UPDATE',
                users: getGlobalOnlineUsers(),
                onlineCount: Math.max(1, connectedUsers.size)
              });
            }
          }
          break;
        }

        case 'SEND_MESSAGE': {
          const { roomId, message } = payload;
          if (!roomId || !message) return;

          // Check if user is banned or muted in server state
          const existingUser = usersStore.get(message.senderId);
          if (existingUser?.isBanned || existingUser?.isMuted) {
            ws.send(JSON.stringify({
              type: 'MESSAGE_REJECTED',
              reason: existingUser.isBanned ? 'حسابك محظور' : 'أنت مكتوم بواسطة الإدارة'
            }));
            return;
          }

          let roomMsgs = messagesByRoom.get(roomId);
          if (!roomMsgs) {
            roomMsgs = [];
            messagesByRoom.set(roomId, roomMsgs);
          }

          const completeMsg: ChatMessage = {
            id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            roomId,
            senderId: message.senderId,
            senderName: message.senderName,
            senderAvatar: message.senderAvatar,
            senderRole: message.senderRole,
            senderVipBadge: message.senderVipBadge,
            badges: message.badges || [],
            type: message.type || 'text',
            isPrivate: !!message.isPrivate || message.type === 'private',
            recipientId: message.recipientId,
            content: message.content || message.text || '',
            text: message.text || message.content || '',
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
            expiresAt: message.expiresAt || ((message.createdAt || Date.now()) + PUBLIC_MESSAGE_TTL_MS),
            createdAt: message.createdAt || Date.now(),
            timestamp: message.timestamp || Date.now(),
            status: message.status || ((message.isPrivate || message.type === 'private') ? 'sent' : 'read')
          };

          roomMsgs.push(completeMsg);
          if (roomMsgs.length > 200) roomMsgs.shift(); // keep last 200

          // Clear sender's active typing indicator immediately when message is sent
          if (completeMsg.senderId) {
            setRoomTypingState(roomId, completeMsg.senderId, completeMsg.senderName || '', false, ws);
          }

          // Broadcast to everyone in that room (including sender for confirmation)
          broadcastToRoom(roomId, {
            type: 'NEW_MESSAGE',
            roomId,
            message: completeMsg
          });

          // Update & broadcast latest room message summary for lobby room cards
          if (completeMsg.type !== 'system_welcome' && !completeMsg.isPrivate) {
            const previewContent =
              completeMsg.type === 'gift' && completeMsg.gift?.name
                ? `🎁 أرسل ${completeMsg.gift.name}`
                : completeMsg.type === 'voice'
                ? '🎤 رسالة صوتية'
                : completeMsg.type === 'image'
                ? '📷 صورة'
                : completeMsg.type === 'video'
                ? '🎬 فيديو'
                : completeMsg.type === 'sticker'
                ? `${completeMsg.stickerEmoji || ''} ${completeMsg.stickerLabel || 'ملصق'}`.trim()
                : completeMsg.content || completeMsg.text || '';
            if (previewContent) {
              const lastMsgSummary = {
                senderName: completeMsg.senderName || 'عضو',
                content: previewContent.slice(0, 120),
                type: completeMsg.type,
                timestamp: completeMsg.timestamp
              };
              lastMessageByRoom.set(roomId, lastMsgSummary);
              broadcastToAll({
                type: 'ROOM_LAST_MESSAGE_UPDATED',
                roomId,
                lastMessage: lastMsgSummary
              });
            }
          }

          console.log(`[Message] ${completeMsg.senderName} in ${roomId}: ${completeMsg.content.substring(0, 30)}`);
          break;
        }

        case 'MESSAGE_REACTION': {
          const { roomId, messageId, reactions, userReactions, reactionUsers } = payload;
          if (roomId && messageId) {
            const roomMsgs = messagesByRoom.get(roomId);
            if (roomMsgs) {
              const target = roomMsgs.find(m => m.id === messageId);
              if (target) {
                target.reactions = reactions || {};
                target.userReactions = userReactions || {};
                target.reactionUsers = reactionUsers || {};
              }
            }
            broadcastToRoom(roomId, {
              type: 'MESSAGE_REACTION_UPDATED',
              roomId,
              messageId,
              reactions: reactions || {},
              userReactions: userReactions || {},
              reactionUsers: reactionUsers || {}
            });
          }
          break;
        }

        case 'ROOM_MESSAGES_READ': {
          const { roomId, readerId, messageIds } = payload;
          if (roomId && Array.isArray(messageIds) && messageIds.length > 0) {
            const roomMsgs = messagesByRoom.get(roomId);
            if (roomMsgs) {
              roomMsgs.forEach(m => {
                if (messageIds.includes(m.id)) {
                  m.status = 'read';
                }
              });
            }
            broadcastToRoom(roomId, {
              type: 'ROOM_MESSAGES_READ_UPDATE',
              roomId,
              readerId,
              messageIds
            });
          }
          break;
        }

        case 'ROOM_TYPING': {
          const { roomId, userId, userName, isTyping } = payload || {};
          if (roomId && userId) {
            setRoomTypingState(roomId, userId, userName || '', !!isTyping, ws);
          }
          break;
        }

        case 'SET_PINNED_MESSAGE': {
          const { roomId, pinnedMessage } = payload;
          if (!roomId) return;
          if (pinnedMessage && pinnedMessage.content) {
            const normalizedPin: PinnedRoomMessage = {
              id: pinnedMessage.id || `pin_${Date.now()}`,
              senderId: pinnedMessage.senderId,
              senderName: pinnedMessage.senderName || 'المشرف',
              content: String(pinnedMessage.content),
              pinnedBy: pinnedMessage.pinnedBy || 'المشرف',
              pinnedAt: pinnedMessage.pinnedAt || Date.now()
            };
            pinnedMessageByRoom.set(roomId, normalizedPin);
            broadcastToRoom(roomId, {
              type: 'ROOM_PINNED_MESSAGE',
              roomId,
              pinnedMessage: normalizedPin
            });
          } else {
            pinnedMessageByRoom.delete(roomId);
            broadcastToRoom(roomId, {
              type: 'ROOM_PINNED_MESSAGE',
              roomId,
              pinnedMessage: null
            });
          }
          break;
        }

        case 'UPDATE_ROOM_BACKGROUND': {
          const { roomId, backgroundTheme } = payload || {};
          if (!roomId) return;
          const normalized = typeof backgroundTheme === 'string' && backgroundTheme.trim() && backgroundTheme !== 'default'
            ? backgroundTheme.trim()
            : 'default';
          if (normalized === 'default') {
            roomBackgroundByRoom.delete(roomId);
          } else {
            roomBackgroundByRoom.set(roomId, normalized);
          }
          persistRoomBackgrounds();
          broadcastToAll({
            type: 'ROOM_BACKGROUND_UPDATED',
            roomId,
            backgroundTheme: normalized
          });
          break;
        }

        case 'UPDATE_ROOM_LOCK': {
          const { roomId, isLocked } = payload || {};
          if (!roomId) return;
          const nextLocked = Boolean(isLocked);
          if (nextLocked) {
            roomLockByRoom.set(roomId, true);
          } else {
            roomLockByRoom.delete(roomId);
          }
          persistRoomLocks();
          broadcastToAll({
            type: 'ROOM_LOCK_UPDATED',
            roomId,
            isLocked: nextLocked
          });
          break;
        }

        case 'UPDATE_PROFILE': {
          const user: UserProfile = payload.user;
          if (user && user.id) {
            usersStore.set(user.id, {
              ...usersStore.get(user.id),
              ...user
            });

            // Update in room occupants
            roomOccupants.forEach((occupants) => {
              if (occupants.has(user.id)) {
                const prev = occupants.get(user.id)!;
                occupants.set(user.id, {
                  ...prev,
                  name: user.name || prev.name,
                  avatar: user.avatar || prev.avatar,
                  role: user.role || prev.role,
                  vipBadge: user.vipBadge || prev.vipBadge
                });
              }
            });

            broadcastToAll({
              type: 'USER_PROFILE_UPDATED',
              userId: user.id,
              user
            });

            broadcastToAll({
              type: 'GLOBAL_PRESENCE_UPDATE',
              users: getGlobalOnlineUsers()
            });
          }
          break;
        }

        case 'UPDATE_AVATAR': {
          const { userId, avatar } = payload;
          if (userId && avatar) {
            const user = usersStore.get(userId);
            if (user) {
              user.avatar = avatar;
              usersStore.set(userId, user);
            }

            roomOccupants.forEach((occupants, roomId) => {
              if (occupants.has(userId)) {
                const prev = occupants.get(userId)!;
                prev.avatar = avatar;
                broadcastToRoom(roomId, {
                  type: 'PRESENCE_UPDATE',
                  roomId,
                  count: occupants.size,
                  users: Array.from(occupants.values())
                });
              }
            });

            broadcastToAll({
              type: 'AVATAR_CHANGED',
              userId,
              avatar
            });
          }
          break;
        }

        case 'ADMIN_ACTION': {
          const { targetUserId, updates } = payload;
          if (targetUserId && updates) {
            const current = usersStore.get(targetUserId) || {
              id: targetUserId,
              name: 'عضو',
              username: 'guest',
              avatar: '',
              role: 'member',
              vipBadge: '',
              coins: 0,
              earningsEgp: 0,
              badges: []
            };

            const updated = { ...current, ...updates };
            usersStore.set(targetUserId, updated);

            // Update in all rooms
            roomOccupants.forEach((occupants, roomId) => {
              if (occupants.has(targetUserId)) {
                const occ = occupants.get(targetUserId)!;
                Object.assign(occ, updates);
                broadcastToRoom(roomId, {
                  type: 'PRESENCE_UPDATE',
                  roomId,
                  count: occupants.size,
                  users: Array.from(occupants.values())
                });
              }
            });

            // Broadcast admin action event to all clients
            broadcastToAll({
              type: 'ADMIN_EVENT',
              targetUserId,
              updates
            });

            console.log(`[Admin Action] Applied updates to ${targetUserId}:`, updates);
          }
          break;
        }

        case 'PAYMOB_CREDIT_COINS': {
          const { userId, coinsToAdd, order } = payload;
          if (userId && coinsToAdd) {
            const current = usersStore.get(userId) || {
              id: userId,
              name: 'عضو',
              username: 'guest',
              avatar: '',
              role: 'member',
              vipBadge: '',
              coins: 0,
              earningsEgp: 0,
              badges: []
            };
            current.coins = (current.coins || 0) + coinsToAdd;
            usersStore.set(userId, current);

            broadcastToAll({
              type: 'USER_PROFILE_UPDATED',
              userId,
              user: current
            });

            ws.send(JSON.stringify({
              type: 'PAYMOB_SUCCESS_ACK',
              newCoins: current.coins,
              order
            }));
          }
          break;
        }

        case 'FRIEND_REQUEST': {
          broadcastToAll({
            type: 'NEW_FRIEND_REQUEST',
            request: payload.request
          });
          break;
        }

        case 'DIRECT_MESSAGE': {
          const { convId, message, recipientId, recipientSessionId } = payload;
          if (message) {
            const targetId = recipientId || message.recipientId;
            console.log(`[Direct Message] From ${message.senderName} (${message.senderId}) to ${targetId} in conv ${convId}`);

            // Cache recent direct messages with 7-day auto-expiration
            const enrichedDm = {
              ...message,
              expiresAt: message.expiresAt || ((message.timestamp || Date.now()) + DM_MESSAGE_TTL_MS)
            };
            if (convId) {
              const convList = (directMessagesByConv.get(convId) || []).filter(m => !isMessageExpired(m, DM_MESSAGE_TTL_MS));
              if (!convList.some(m => m.id === enrichedDm.id)) {
                convList.push(enrichedDm);
                if (convList.length > 100) convList.shift();
                directMessagesByConv.set(convId, convList);
              }
            }
            
            // 1. Direct delivery to recipient (by userId or active sessionId) and sender sockets
            if (targetId) {
              sendToUser(targetId, {
                type: 'NEW_DIRECT_MESSAGE',
                convId,
                message
              });
              if (message.senderId) {
                sendToUser(targetId, {
                  type: 'PRIVATE_TYPING_UPDATE',
                  senderId: message.senderId,
                  senderName: message.senderName || '',
                  targetUserId: targetId,
                  isTyping: false
                });
              }
            }
            if (recipientSessionId) {
              sendToUser(recipientSessionId, {
                type: 'NEW_DIRECT_MESSAGE',
                convId,
                message
              });
              if (message.senderId) {
                sendToUser(recipientSessionId, {
                  type: 'PRIVATE_TYPING_UPDATE',
                  senderId: message.senderId,
                  senderName: message.senderName || '',
                  targetUserId: recipientSessionId,
                  isTyping: false
                });
              }
            }
            if (message.senderId) {
              sendToUser(message.senderId, {
                type: 'NEW_DIRECT_MESSAGE',
                convId,
                message
              });
            }

            // 2. Guaranteed broadcast to all clients so any open conversation listener receives it immediately
            broadcastToAll({
              type: 'NEW_DIRECT_MESSAGE',
              convId,
              message
            });

            // 3. Also broadcast on recent chats update
            broadcastToAll({
              type: 'DIRECT_CHATS_UPDATED',
              convId,
              message
            });
          }
          break;
        }

        case 'DIRECT_MESSAGE_READ': {
          const { convId, readerId, senderId, messageIds } = payload;
          if (convId && Array.isArray(messageIds) && messageIds.length > 0) {
            const convList = directMessagesByConv.get(convId);
            if (convList) {
              convList.forEach(m => {
                if (messageIds.includes(m.id)) {
                  m.status = 'read';
                }
              });
            }
            if (senderId) {
              sendToUser(senderId, {
                type: 'DIRECT_MESSAGE_READ_UPDATE',
                convId,
                readerId,
                messageIds
              });
            }
            broadcastToAll({
              type: 'DIRECT_MESSAGE_READ_UPDATE',
              convId,
              readerId,
              messageIds
            });
          }
          break;
        }

        case 'USER_REPORT': {
          const { report } = payload;
          if (report) {
            console.log(`[User Report] From ${report.reporterName} against ${report.reportedUserName}: ${report.reason}`);
            const fullReport = {
              ...report,
              id: report.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              status: report.status || 'pending',
              timestamp: report.timestamp || Date.now()
            };
            userReportsStore.unshift(fullReport);
            if (userReportsStore.length > 200) userReportsStore.pop();
            broadcastToAll({
              type: 'ADMIN_REPORT_RECEIVED',
              report: fullReport
            });
            ws.send(JSON.stringify({
              type: 'REPORT_SUBMITTED_SUCCESS',
              message: 'تم استلام البلاغ بنجاح وجارٍ مراجعته من الإدارة'
            }));
          }
          break;
        }

        case 'CALL_SIGNAL': {
          const { targetUserId, signal } = payload || {};
          if (targetUserId && signal) {
            const delivered = sendToUser(targetUserId, {
              type: 'CALL_SIGNAL',
              signal
            });
            if (!delivered) {
              broadcastToAll({ type: 'CALL_SIGNAL', signal }, ws);
            }
          }
          break;
        }

        case 'CONSENT_SIGNAL': {
          const { targetUserId, kind, payload: consentPayload } = payload || {};
          if (targetUserId && kind && consentPayload) {
            const delivered = sendToUser(targetUserId, {
              type: 'CONSENT_SIGNAL',
              kind,
              payload: consentPayload
            });
            if (!delivered) {
              broadcastToAll({ type: 'CONSENT_SIGNAL', kind, payload: consentPayload }, ws);
            }
          }
          break;
        }

        case 'LUXURY_GIFT_BROADCAST': {
          const { roomId, giftData } = payload || {};
          if (roomId && giftData) {
            broadcastToRoom(roomId, {
              type: 'LUXURY_GIFT_BROADCAST',
              roomId,
              giftData
            }, ws);
          }
          break;
        }

        case 'CLEAR_ROOM_MESSAGES': {
          const { roomId } = payload || {};
          if (roomId) {
            messagesByRoom.set(roomId, []);
            broadcastToRoom(roomId, {
              type: 'ROOM_PURGED',
              roomId
            });
          }
          break;
        }

        case 'DELETE_ROOM_MESSAGE': {
          const { roomId, messageId } = payload || {};
          if (roomId && messageId) {
            const roomMsgs = messagesByRoom.get(roomId);
            if (Array.isArray(roomMsgs)) {
              messagesByRoom.set(
                roomId,
                roomMsgs.filter((m: any) => m?.id !== messageId)
              );
            }
            broadcastToRoom(roomId, {
              type: 'ROOM_MESSAGE_DELETED',
              roomId,
              messageId
            });
          }
          break;
        }

        case 'PRIVATE_TYPING': {
          const { senderId, senderName, targetUserId, targetSessionId, isTyping } = payload || {};
          if (senderId && targetUserId) {
            const typingEvent = {
              type: 'PRIVATE_TYPING_UPDATE',
              senderId,
              senderName,
              targetUserId,
              isTyping: !!isTyping
            };
            const deliveredPrimary = sendToUser(targetUserId, typingEvent);
            const deliveredSession = targetSessionId ? sendToUser(targetSessionId, typingEvent) : false;
            if (!deliveredPrimary && !deliveredSession) {
              broadcastToAll(typingEvent, ws);
            }
          }
          break;
        }

        case 'REGISTER_VISIT': {
          const visitKey = String(payload?.visitToken || payload?.deviceId || '').trim();
          const clientHighest = Number(payload?.clientHighestCount) || BASE_VISITORS_COUNT;
          let shouldIncrement = false;
          if (visitKey && !recordedVisitTokens.has(visitKey)) {
            recordedVisitTokens.add(visitKey);
            if (recordedVisitTokens.size > 5000) {
              const first = recordedVisitTokens.values().next().value;
              if (first) recordedVisitTokens.delete(first);
            }
            shouldIncrement = true;
          }
          const changed = raiseCumulativeVisitorsMonotonic(clientHighest, shouldIncrement ? 1 : 0);
          if (changed) {
            broadcastToAll({
              type: 'CUMULATIVE_VISITORS_UPDATE',
              count: cumulativeVisitorsCount
            });
          } else {
            ws.send(JSON.stringify({
              type: 'CUMULATIVE_VISITORS_UPDATE',
              count: cumulativeVisitorsCount
            }));
          }
          break;
        }

        case 'SYNC_VISITORS_COUNT': {
          const incoming = Number(payload?.count) || BASE_VISITORS_COUNT;
          const changed = raiseCumulativeVisitorsMonotonic(incoming, 0);
          if (changed) {
            broadcastToAll({
              type: 'CUMULATIVE_VISITORS_UPDATE',
              count: cumulativeVisitorsCount
            });
          }
          break;
        }

        case 'APP_UPDATE_NOTICE': {
          const { version, message, pushedBy } = payload || {};
          latestAppUpdateNotice = {
            version: String(version || `v${Date.now()}`),
            message: String(message || 'تم إصدار تحديث جديد للتطبيق بمميزات وتحسينات أسرع!'),
            pushedBy: String(pushedBy || 'الإدارة'),
            timestamp: Date.now()
          };
          broadcastToAll({
            type: 'APP_UPDATE_NOTICE',
            notice: latestAppUpdateNotice
          });
          break;
        }

        case 'TICTACTOE_SIGNAL': {
          const { targetUserId, signal } = payload || {};
          if (targetUserId && signal) {
            const delivered = sendToUser(targetUserId, {
              type: 'TICTACTOE_SIGNAL',
              signal
            });
            if (!delivered) {
              broadcastToAll({ type: 'TICTACTOE_SIGNAL', signal }, ws);
            }
          }
          break;
        }

        case 'LIVE_AUDIO_RAISE_HAND': {
          const { roomId, userId, raised } = payload || {};
          if (roomId && userId) {
            const current = (globalThis as any).__liveAudioHands?.get(roomId) || new Set<string>();
            if (!(globalThis as any).__liveAudioHands) {
              (globalThis as any).__liveAudioHands = new Map<string, Set<string>>();
            }
            if (raised) current.add(userId);
            else current.delete(userId);
            (globalThis as any).__liveAudioHands.set(roomId, current);
            broadcastToRoom(roomId, {
              type: 'LIVE_AUDIO_STAGE_UPDATE',
              roomId,
              raisedHandUserIds: Array.from(current)
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.warn('[WebSocket] Error handling client message:', err);
    }
  });

  ws.on('close', () => {
    const info = socketToUser.get(ws);
    if (info) {
      const { userId, roomId } = info;
      if (userId) {
        typingUsersByRoom.forEach((typersMap, rId) => {
          const entry = typersMap.get(userId);
          if (entry) {
            setRoomTypingState(rId, userId, entry.userName, false, ws);
          }
        });
      }
      if (roomId && userId) {
        const occMap = roomOccupants.get(roomId);
        if (occMap && occMap.has(userId)) {
          occMap.delete(userId);
          const list = Array.from(occMap.values());
          broadcastToRoom(roomId, {
            type: 'PRESENCE_UPDATE',
            roomId,
            count: list.length,
            users: list
          });
        }
      }

      if (userId) {
        connectedUsers.delete(userId);
        // Check if user still has another open socket; if not, allow next login to trigger Global Join banner cleanly
        let hasOtherSocket = false;
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            const cInfo = socketToUser.get(client);
            if (cInfo?.userId === userId) hasOtherSocket = true;
          }
        });
        if (!hasOtherSocket) {
          lastAnnouncedJoinAt.delete(userId);
          broadcastToAll({
            type: 'PRIVATE_TYPING_UPDATE',
            senderId: userId,
            senderName: '',
            targetUserId: '',
            isTyping: false,
          });
        }
      }

      broadcastToAll({
        type: 'GLOBAL_PRESENCE_UPDATE',
        users: getGlobalOnlineUsers(),
        onlineCount: Math.max(1, connectedUsers.size)
      });

      socketToUser.delete(ws);
    }
    console.log('[WebSocket] Client disconnected. Total clients:', wss.clients.size);
  });
});

// REST API Endpoints
app.get('/api/auth/session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const hasToken = authHeader.startsWith('Bearer ') && authHeader.length > 10;
  res.json({
    ok: true,
    hasToken,
    timestamp: Date.now()
  });
});

app.get('/api/app-version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    version: SERVER_BUILD_VERSION,
    timestamp: Date.now()
  });
});

app.post('/api/presence/offline', (req: Request, res: Response) => {
  try {
    let bodyObj: any = req.body;
    if (typeof bodyObj === 'string') {
      try {
        bodyObj = JSON.parse(bodyObj);
      } catch {
        bodyObj = {};
      }
    }
    const uid = typeof bodyObj?.userId === 'string' ? bodyObj.userId.trim() : '';
    const targetRoomId = typeof bodyObj?.roomId === 'string' ? bodyObj.roomId.trim() : '';
    if (uid) {
      let changed = false;
      if (connectedUsers.delete(uid)) changed = true;
      lastAnnouncedJoinAt.delete(uid);

      if (targetRoomId) {
        const occMap = roomOccupants.get(targetRoomId);
        if (occMap && occMap.has(uid)) {
          const occ = occMap.get(uid);
          setRoomTypingState(targetRoomId, uid, occ?.name || '', false);
          occMap.delete(uid);
          const list = Array.from(occMap.values());
          broadcastToRoom(targetRoomId, {
            type: 'PRESENCE_UPDATE',
            roomId: targetRoomId,
            count: list.length,
            users: list
          });
          changed = true;
        }
      } else {
        roomOccupants.forEach((occMap, rId) => {
          if (occMap.has(uid)) {
            const occ = occMap.get(uid);
            setRoomTypingState(rId, uid, occ?.name || '', false);
            occMap.delete(uid);
            const list = Array.from(occMap.values());
            broadcastToRoom(rId, {
              type: 'PRESENCE_UPDATE',
              roomId: rId,
              count: list.length,
              users: list
            });
            changed = true;
          }
        });
      }

      if (changed) {
        broadcastToAll({
          type: 'GLOBAL_PRESENCE_UPDATE',
          users: getGlobalOnlineUsers(),
          onlineCount: Math.max(1, connectedUsers.size)
        });
      }
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: SERVER_BUILD_VERSION,
    connectedClients: wss.clients.size,
    totalUsers: usersStore.size,
    activeRooms: messagesByRoom.size,
    pendingReports: userReportsStore.filter(r => r.status !== 'reviewed').length,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

app.get('/api/admin/reports', (_req: Request, res: Response) => {
  res.json({ reports: userReportsStore });
});

app.get('/api/admin/direct-chats', (_req: Request, res: Response) => {
  const threads: any[] = [];
  directMessagesByConv.forEach((msgs, convId) => {
    const active = msgs.filter(m => !isMessageExpired(m, DM_MESSAGE_TTL_MS));
    if (!active.length) return;
    const latest = active[active.length - 1];
    const participants = Array.from(
      new Set(
        active
          .flatMap((m) => [m.senderId, m.recipientId])
          .filter(Boolean)
      )
    );
    threads.push({
      chatId: convId,
      participants,
      lastMessage: latest.content || latest.text || 'رسالة خاصة',
      lastSenderId: latest.senderId,
      lastSenderName: latest.senderName,
      lastTimestamp: latest.timestamp || latest.createdAt || Date.now(),
      messages: active
    });
  });
  threads.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  res.json({ threads });
});

app.get('/api/admin/direct-chats/:convId', (req: Request, res: Response) => {
  const convId = req.params.convId;
  const msgs = (directMessagesByConv.get(convId) || []).filter(m => !isMessageExpired(m, DM_MESSAGE_TTL_MS));
  res.json({ convId, messages: msgs });
});

const handleGetRoomMessages = (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  const rawHistory = messagesByRoom.get(roomId) || [];
  const history = rawHistory.filter(m => !isMessageExpired(m, PUBLIC_MESSAGE_TTL_MS));
  if (history.length !== rawHistory.length) messagesByRoom.set(roomId, history);
  res.json({ roomId, messages: history });
};
app.get('/api/messages/:roomId', handleGetRoomMessages);
app.get('/api/rooms/:roomId/messages', handleGetRoomMessages);

app.get('/api/presence/:roomId', (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  const occupants = getRoomOccupantsList(roomId);
  res.json({ roomId, count: occupants.length, occupants });
});

app.get('/api/presence', (_req: Request, res: Response) => {
  res.json({ users: getGlobalOnlineUsers() });
});

app.get('/api/stats/visitors', (_req: Request, res: Response) => {
  res.json({ count: cumulativeVisitorsCount });
});

// Automated & Manual Daily Backups API
const BACKUP_FILE_PATH = path.resolve(process.cwd(), '.daily-backups.json');

function readBackupsFile(): any[] {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const raw = fs.readFileSync(BACKUP_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function writeBackupsFile(list: any[]) {
  try {
    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(list.slice(0, 14), null, 2), 'utf8');
  } catch {}
}

app.get('/api/backups', (_req: Request, res: Response) => {
  res.json({ backups: readBackupsFile() });
});

app.post('/api/backups', (req: Request, res: Response) => {
  const dateKey = String(req.body?.dateKey || new Date().toISOString().split('T')[0]);
  const createdBy = String(req.body?.createdBy || 'النظام التلقائي');
  const existing = readBackupsFile();
  const snapshot = {
    id: `bak_${dateKey}_${Date.now()}`,
    dateKey,
    createdAt: Date.now(),
    createdBy,
    usersCount: Number(req.body?.usersCount) || usersStore.size,
    roomsCount: Number(req.body?.roomsCount) || messagesByRoom.size,
    postsCount: Number(req.body?.postsCount) || 0,
    usersData: Array.isArray(req.body?.usersData) ? req.body.usersData : Array.from(usersStore.values()).slice(0, 100),
    notes: String(req.body?.notes || 'نسخة احتياطية يومية تلقائية'),
  };
  const filtered = existing.filter((b: any) => b.dateKey !== dateKey);
  filtered.unshift(snapshot);
  writeBackupsFile(filtered);
  res.json({ ok: true, backup: snapshot });
});

app.post('/api/stats/visitors/visit', (req: Request, res: Response) => {
  const visitKey = String(req.body?.visitToken || req.body?.deviceId || '').trim();
  const clientHighest = Number(req.body?.clientHighestCount) || BASE_VISITORS_COUNT;
  let shouldIncrement = false;
  if (visitKey && !recordedVisitTokens.has(visitKey)) {
    recordedVisitTokens.add(visitKey);
    shouldIncrement = true;
  }
  const changed = raiseCumulativeVisitorsMonotonic(clientHighest, shouldIncrement ? 1 : 0);
  if (changed) {
    broadcastToAll({
      type: 'CUMULATIVE_VISITORS_UPDATE',
      count: cumulativeVisitorsCount
    });
  }
  res.json({ count: cumulativeVisitorsCount });
});

// Server-side HTTPS Radio Stream Health Check (avoids browser CORS false-negatives)
async function probeRadioStreamUrl(url?: string): Promise<boolean> {
  if (!url || !url.startsWith('https://')) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'ShatMasrRadioChecker/1.0'
      }
    });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    try {
      await response.body?.cancel();
    } catch {}
    if (!response.ok) return false;
    if (contentType.includes('text/html')) return false;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/radio/check', async (req: Request, res: Response) => {
  try {
    const stations = Array.isArray(req.body?.stations) ? req.body.stations.slice(0, 40) : [];
    const entries = await Promise.all(
      stations.map(async (st: { id?: string; streamUrl?: string; fallbackUrl?: string }) => {
        const id = String(st?.id || '').trim();
        if (!id) return null;
        const primaryOk = await probeRadioStreamUrl(st.streamUrl);
        if (primaryOk) return [id, true] as const;
        if (st.fallbackUrl) {
          const fallbackOk = await probeRadioStreamUrl(st.fallbackUrl);
          return [id, fallbackOk] as const;
        }
        return [id, false] as const;
      })
    );
    const availability: Record<string, boolean> = {};
    entries.forEach((entry) => {
      if (entry) availability[entry[0]] = entry[1];
    });
    res.json({ availability, checkedAt: Date.now() });
  } catch {
    res.status(500).json({ availability: {}, checkedAt: Date.now() });
  }
});

// Start server with Vite middleware in development
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server,
          path: '/vite-hmr',
        },
        hmr: false,
        watch: null,
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (
          filePath.endsWith('index.html') ||
          filePath.endsWith('sw.js') ||
          filePath.endsWith('registerSW.js') ||
          filePath.endsWith('manifest.webmanifest') ||
          filePath.endsWith('manifest.json')
        ) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
      }
    }));
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Realtime Server listening on http://0.0.0.0:${PORT} (WebSocket at ws://0.0.0.0:${PORT}/ws)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
