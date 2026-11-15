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

app.use(express.json());

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
const pinnedMessageByRoom: Map<string, PinnedRoomMessage | null> = new Map();
const roomBackgroundByRoom: Map<string, string> = new Map();
const roomLockByRoom: Map<string, boolean> = new Map();
const directMessagesByConv: Map<string, any[]> = new Map();
const roomOccupants: Map<string, Map<string, RoomOccupant>> = new Map();
const usersStore: Map<string, UserProfile> = new Map();
const userReportsStore: any[] = [];
const socketToUser: Map<WebSocket, { userId: string; sessionId?: string; roomId?: string }> = new Map();
// Global map of connected sockets by userId
const connectedUsers: Map<string, { ws: WebSocket; user: UserProfile; lastSeen: number }> = new Map();

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
  
  // 1. First add all currently registered connected sockets
  connectedUsers.forEach(({ user, lastSeen }, id) => {
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

  // 2. Also ensure any room occupant is present
  roomOccupants.forEach((occupants) => {
    occupants.forEach((user, id) => {
      allUsersMap.set(id, user);
    });
  });

  return Array.from(allUsersMap.values());
}

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected. Total clients:', wss.clients.size);
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

  ws.on('message', (raw) => {
    try {
      const action = JSON.parse(raw.toString());
      const { type, payload } = action;

      switch (type) {
        case 'USER_REGISTER': {
          const user: UserProfile = payload.user;
          if (user && user.id) {
            const existing = usersStore.get(user.id);
            const merged = { ...existing, ...user };
            usersStore.set(user.id, merged);
            const prevInfo = socketToUser.get(ws);
            socketToUser.set(ws, { userId: user.id, sessionId: user.sessionId, roomId: prevInfo?.roomId });
            connectedUsers.set(user.id, { ws, user: merged, lastSeen: Date.now() });

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

          let occMap = roomOccupants.get(roomId);
          if (!occMap) {
            occMap = new Map();
            roomOccupants.set(roomId, occMap);
          }

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
            joinedAt: Date.now(),
            sessionId: user.sessionId
          };
          occMap.set(user.id, occupant);

          socketToUser.set(ws, { userId: user.id, sessionId: user.sessionId, roomId });

          // Send existing non-expired room history (24h TTL) to newly joined client
          const rawHistory = messagesByRoom.get(roomId) || [];
          const history = rawHistory.filter(m => !isMessageExpired(m, PUBLIC_MESSAGE_TTL_MS));
          if (history.length !== rawHistory.length) messagesByRoom.set(roomId, history);
          ws.send(JSON.stringify({
            type: 'ROOM_HISTORY',
            roomId,
            messages: history
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
            users: getGlobalOnlineUsers()
          });

          console.log(`[Join] User ${user.name} (${user.id}) joined ${roomId}. Room count: ${occupantsList.length}`);
          break;
        }

        case 'LEAVE_ROOM': {
          const { roomId, userId } = payload;
          if (roomId && userId) {
            const occMap = roomOccupants.get(roomId);
            if (occMap && occMap.has(userId)) {
              const departingUser = occMap.get(userId);
              occMap.delete(userId);
              const list = Array.from(occMap.values());
              broadcastToRoom(roomId, {
                type: 'ROOM_TYPING_UPDATE',
                roomId,
                userId,
                userName: departingUser?.name || '',
                isTyping: false
              }, ws);
              broadcastToRoom(roomId, {
                type: 'PRESENCE_UPDATE',
                roomId,
                count: list.length,
                users: list
              });
              broadcastToAll({
                type: 'GLOBAL_PRESENCE_UPDATE',
                users: getGlobalOnlineUsers()
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
            broadcastToRoom(roomId, {
              type: 'ROOM_TYPING_UPDATE',
              roomId,
              userId: completeMsg.senderId,
              userName: completeMsg.senderName || '',
              isTyping: false
            }, ws);
          }

          // Broadcast to everyone in that room (including sender for confirmation)
          broadcastToRoom(roomId, {
            type: 'NEW_MESSAGE',
            roomId,
            message: completeMsg
          });

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
          const { roomId, userId, userName, isTyping } = payload;
          if (roomId && userId) {
            broadcastToRoom(roomId, {
              type: 'ROOM_TYPING_UPDATE',
              roomId,
              userId,
              userName,
              isTyping: !!isTyping
            }, ws);
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
            }
            if (recipientSessionId) {
              sendToUser(recipientSessionId, {
                type: 'NEW_DIRECT_MESSAGE',
                convId,
                message
              });
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

        case 'PRIVATE_TYPING': {
          const { senderId, senderName, targetUserId, isTyping } = payload;
          if (senderId && targetUserId) {
            broadcastToAll({
              type: 'PRIVATE_TYPING_UPDATE',
              senderId,
              senderName,
              targetUserId,
              isTyping: !!isTyping
            });
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
      if (roomId && userId) {
        const occMap = roomOccupants.get(roomId);
        if (occMap && occMap.has(userId)) {
          const departingUser = occMap.get(userId);
          occMap.delete(userId);
          const list = Array.from(occMap.values());
          broadcastToRoom(roomId, {
            type: 'ROOM_TYPING_UPDATE',
            roomId,
            userId,
            userName: departingUser?.name || '',
            isTyping: false
          }, ws);
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
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
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

app.get('/api/messages/:roomId', (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  const rawHistory = messagesByRoom.get(roomId) || [];
  const history = rawHistory.filter(m => !isMessageExpired(m, PUBLIC_MESSAGE_TTL_MS));
  if (history.length !== rawHistory.length) messagesByRoom.set(roomId, history);
  res.json({ roomId, messages: history });
});

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
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
