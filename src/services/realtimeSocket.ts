import { Message, User, FriendRequest } from '../types/chat';

type MessageCallback = (msg: Message) => void;
type HistoryCallback = (messages: Message[]) => void;
type PresenceCallback = (count: number, users: User[]) => void;
type GlobalPresenceCallback = (users: User[]) => void;
type ProfileCallback = (user: Partial<User>) => void;
type AdminEventCallback = (targetUserId: string, updates: Partial<User>) => void;
type FriendReqCallback = (req: FriendRequest) => void;
export type PrivateTypingCallback = (isTyping: boolean, senderName: string) => void;
export type RoomTypingCallback = (userId: string, userName: string, isTyping: boolean) => void;
type DirectMessageCallback = (msg: Message, convId: string) => void;
type ReactionCallback = (data: {
  messageId: string;
  reactions: Record<string, number>;
  userReactions: Record<string, string>;
  reactionUsers: Record<string, string[]>;
}) => void;
type ReadReceiptCallback = (messageIds: string[], readerId: string) => void;
export interface PinnedRoomMessage {
  id: string;
  senderId?: string;
  senderName: string;
  content: string;
  pinnedBy?: string;
  pinnedAt?: number;
}
type PinnedMessageCallback = (pinnedMessage: PinnedRoomMessage | null) => void;

class RealtimeSocketManager {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isConnecting = false;
  private currentRoomId: string | null = null;
  private currentUser: User | null = null;

  // Listeners
  private messageListeners: Map<string, Set<MessageCallback>> = new Map();
  private historyListeners: Map<string, Set<HistoryCallback>> = new Map();
  private presenceListeners: Map<string, Set<PresenceCallback>> = new Map();
  private globalPresenceListeners: Set<GlobalPresenceCallback> = new Set();
  private profileListeners: Map<string, Set<ProfileCallback>> = new Map();
  private adminEventListeners: Set<AdminEventCallback> = new Set();
  private friendReqListeners: Set<FriendReqCallback> = new Set();
  private directMessageListeners: Map<string, Set<DirectMessageCallback>> = new Map();
  private globalDirectMessageListeners: Set<DirectMessageCallback> = new Set();
  private privateTypingListeners: Map<string, Set<PrivateTypingCallback>> = new Map();
  private roomTypingListeners: Map<string, Set<RoomTypingCallback>> = new Map();
  private reactionListeners: Map<string, Set<ReactionCallback>> = new Map();
  private roomReadListeners: Map<string, Set<ReadReceiptCallback>> = new Map();
  private directReadListeners: Map<string, Set<ReadReceiptCallback>> = new Map();
  private pinnedMessageListeners: Map<string, Set<PinnedMessageCallback>> = new Map();
  private roomBackgroundListeners: Map<string, Set<(backgroundTheme: string) => void>> = new Map();
  private allRoomBackgroundListeners: Set<(backgrounds: Record<string, string>) => void> = new Set();
  private latestRoomBackgrounds: Record<string, string> = {};
  private roomLockListeners: Map<string, Set<(isLocked: boolean) => void>> = new Map();
  private allRoomLockListeners: Set<(locks: Record<string, boolean>) => void> = new Set();
  private latestRoomLocks: Record<string, boolean> = {};
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private connectionStateListeners: Set<(state: 'connected' | 'reconnecting' | 'disconnected') => void> = new Set();
  private reconnectSuccessListeners: Set<() => void> = new Set();
  private cumulativeVisitorsListeners: Set<(count: number) => void> = new Set();
  private adminReportListeners: Set<(report: any) => void> = new Set();
  private callSignalListeners: Set<(signal: any) => void> = new Set();
  private consentSignalListeners: Set<(signal: { kind: 'request' | 'response' | 'cancel'; payload: any }) => void> = new Set();
  private luxuryGiftListeners: Map<string, Set<(giftData: any) => void>> = new Map();
  private roomPurgedListeners: Map<string, Set<() => void>> = new Map();
  private globalJoinListeners: Set<(user: { id: string; name: string; avatar?: string; role?: string; vipBadge?: string }) => void> = new Set();
  private allRoomLastMessageListeners: Set<(lastMessages: Record<string, { senderName: string; content: string; type?: string; timestamp: number }>) => void> = new Set();
  private latestRoomLastMessages: Record<string, { senderName: string; content: string; type?: string; timestamp: number }> = {};
  private appUpdateNoticeListeners: Set<(notice: { version: string; message: string; pushedBy: string; timestamp: number }) => void> = new Set();
  private latestAppUpdateNotice: { version: string; message: string; pushedBy: string; timestamp: number } | null = null;
  private ticTacToeSignalListeners: Set<(signal: any) => void> = new Set();
  private liveAudioStageListeners: Map<string, Set<(raisedHandUserIds: string[]) => void>> = new Map();
  private isConnectedState = false;
  private connectionState: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  private reconnectAttempts = 0;
  private consecutiveFailures = 0;
  private wasDisconnected = false;
  private heartbeatTimer: any = null;
  private tokenProvider: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;
  private networkRecoveryHandler: (() => Promise<void>) | null = null;
  private visibilityBound = false;
  private latestCumulativeVisitorsCount = 15480;

  setTokenProvider(provider: (forceRefresh?: boolean) => Promise<string | null>) {
    this.tokenProvider = provider;
  }

  setNetworkRecoveryHandler(handler: () => Promise<void>) {
    this.networkRecoveryHandler = handler;
  }

  async getValidToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.tokenProvider) return null;
    try {
      return await Promise.race([
        this.tokenProvider(forceRefresh),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
    } catch {
      return null;
    }
  }

  async refreshTokenIfNeeded(forceRefresh: boolean = true): Promise<string | null> {
    const token = await this.getValidToken(forceRefresh);
    if (token && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send('TOKEN_REFRESH', { token, userId: this.currentUser?.id });
    }
    return token;
  }

  async apiFetchWithRefresh(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const buildHeaders = (token: string | null) => {
      const headers = new Headers(init.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    };

    const initialToken = await this.getValidToken(false);
    let response = await fetch(input, { ...init, headers: buildHeaders(initialToken) });
    if (response.status === 401) {
      const freshToken = await this.getValidToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('Authorization', `Bearer ${freshToken}`);
        response = await fetch(input, { ...init, headers: retryHeaders });
      }
    }
    return response;
  }

  isConnected(): boolean {
    return this.isConnectedState && this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  getConnectionState(): 'connected' | 'reconnecting' | 'disconnected' {
    return this.connectionState;
  }

  subscribeToConnectionState(
    callback: (state: 'connected' | 'reconnecting' | 'disconnected') => void
  ): () => void {
    callback(this.connectionState);
    this.connectionStateListeners.add(callback);
    return () => {
      this.connectionStateListeners.delete(callback);
    };
  }

  subscribeToConnectionStatus(callback: (connected: boolean) => void): () => void {
    callback(this.isConnected());
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  subscribeToReconnectSuccess(callback: () => void): () => void {
    this.reconnectSuccessListeners.add(callback);
    return () => {
      this.reconnectSuccessListeners.delete(callback);
    };
  }

  private notifyStatusListeners(status: boolean) {
    this.connectionState = status ? 'connected' : (this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected');
    this.connectionStateListeners.forEach((cb) => {
      try {
        cb(this.connectionState);
      } catch {}
    });
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.warn('[RealtimeSocket] Status listener error:', err);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send('HEARTBEAT', { userId: this.currentUser?.id, timestamp: Date.now() });
        this.send('PING', { timestamp: Date.now() });
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private bindVisibilityReconnect() {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.send('HEARTBEAT', { userId: this.currentUser?.id, timestamp: Date.now() });
        } else if (this.currentUser) {
          this.connect(this.currentUser);
        }
      }
    });
    window.addEventListener('online', () => {
      if (this.currentUser && (!this.socket || this.socket.readyState !== WebSocket.OPEN)) {
        this.connect(this.currentUser);
      }
    });
  }

  async connect(user?: User) {
    const prevUser = this.currentUser;
    if (user) this.currentUser = user;
    if (typeof window === 'undefined') return;
    this.bindVisibilityReconnect();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (
        user &&
        (!prevUser ||
          prevUser.id !== user.id ||
          prevUser.name !== user.name ||
          prevUser.avatar !== user.avatar ||
          prevUser.isGuest !== user.isGuest ||
          prevUser.sessionId !== user.sessionId)
      ) {
        this.send('USER_REGISTER', { user });
      }
      return;
    }
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }
    if (this.isConnecting) return;

    this.isConnecting = true;

    // Refresh Firebase ID token automatically before every connection attempt
    const freshToken = await this.getValidToken(this.consecutiveFailures > 0);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('[RealtimeSocket] Connecting to', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[RealtimeSocket] Connected to real-time server 🚀');
        const reconnected = this.wasDisconnected;
        this.isConnecting = false;
        this.isConnectedState = true;
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        this.wasDisconnected = false;
        this.notifyStatusListeners(true);
        this.startHeartbeat();

        if (freshToken) {
          this.send('TOKEN_REFRESH', { token: freshToken, userId: this.currentUser?.id });
        }

        // Register user
        if (this.currentUser) {
          this.send('USER_REGISTER', { user: this.currentUser });
        }

        // Rejoin room if was in one
        if (this.currentRoomId && this.currentUser) {
          this.send('JOIN_ROOM', { roomId: this.currentRoomId, user: this.currentUser });
        }

        if (reconnected) {
          this.reconnectSuccessListeners.forEach((cb) => {
            try {
              cb();
            } catch {}
          });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const action = JSON.parse(event.data);
          this.handleIncoming(action);
        } catch (e) {
          console.warn('[RealtimeSocket] Parse error:', e);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.isConnecting = false;
        this.isConnectedState = false;
        this.wasDisconnected = true;
        this.stopHeartbeat();
        this.reconnectAttempts += 1;
        this.consecutiveFailures += 1;
        this.notifyStatusListeners(false);

        if (this.consecutiveFailures >= 3 && this.networkRecoveryHandler) {
          this.networkRecoveryHandler().catch(() => {});
        }

        // Fixed 5-second Auto-Reconnect timer (never stays stuck offline)
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 5000);
      };

      this.socket.onerror = (err) => {
        console.warn('[RealtimeSocket] Socket notice:', err);
        this.isConnectedState = false;
        this.notifyStatusListeners(false);
      };
    } catch (e) {
      console.warn('[RealtimeSocket] Failed to create socket:', e);
      this.isConnecting = false;
      this.isConnectedState = false;
      this.wasDisconnected = true;
      this.consecutiveFailures += 1;
      this.notifyStatusListeners(false);
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  private send(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    } else {
      // Auto connect if not connected
      this.connect();
    }
  }

  private handleIncoming(action: { type: string; [key: string]: any }) {
    const { type } = action;

    switch (type) {
      case 'PONG':
      case 'HEARTBEAT_ACK':
      case 'TOKEN_REFRESH_ACK': {
        this.consecutiveFailures = 0;
        break;
      }

      case 'AUTH_EXPIRED': {
        this.refreshTokenIfNeeded(true).catch(() => {});
        break;
      }
      case 'ROOM_HISTORY': {
        const { roomId, messages } = action;
        const listeners = this.historyListeners.get(roomId);
        if (listeners) {
          listeners.forEach(cb => cb(messages));
        }
        break;
      }

      case 'NEW_MESSAGE': {
        const { roomId, message } = action;
        const listeners = this.messageListeners.get(roomId);
        if (listeners) {
          listeners.forEach(cb => cb(message));
        }
        break;
      }

      case 'PRESENCE_UPDATE': {
        const { roomId, count, users } = action;
        const listeners = this.presenceListeners.get(roomId);
        if (listeners) {
          listeners.forEach(cb => cb(count, users));
        }
        break;
      }

      case 'GLOBAL_PRESENCE_UPDATE': {
        const { users } = action;
        this.globalPresenceListeners.forEach(cb => cb(users));
        break;
      }

      case 'USER_PROFILE_UPDATED': {
        const { userId, user } = action;
        const listeners = this.profileListeners.get(userId);
        if (listeners) {
          listeners.forEach(cb => cb(user));
        }
        break;
      }

      case 'AVATAR_CHANGED': {
        const { userId, avatar } = action;
        const listeners = this.profileListeners.get(userId);
        if (listeners) {
          listeners.forEach(cb => cb({ avatar }));
        }
        break;
      }

      case 'ADMIN_EVENT': {
        const { targetUserId, updates } = action;
        this.adminEventListeners.forEach(cb => cb(targetUserId, updates));
        // Also fire profile listener for target user
        const profListeners = this.profileListeners.get(targetUserId);
        if (profListeners) {
          profListeners.forEach(cb => cb(updates));
        }
        break;
      }

      case 'NEW_DIRECT_MESSAGE': {
        const { convId, message } = action;
        if (convId && message) {
          const listeners = this.directMessageListeners.get(convId);
          if (listeners) {
            listeners.forEach(cb => cb(message, convId));
          }
          this.globalDirectMessageListeners.forEach(cb => cb(message, convId));
        }
        break;
      }

      case 'DIRECT_CHATS_UPDATED': {
        const { convId, message } = action;
        if (convId && message) {
          this.globalDirectMessageListeners.forEach(cb => cb(message, convId));
        }
        break;
      }

      case 'NEW_FRIEND_REQUEST': {
        const { request } = action;
        this.friendReqListeners.forEach(cb => cb(request));
        break;
      }

      case 'PRIVATE_TYPING_UPDATE': {
        const { senderId, senderName, targetUserId, isTyping } = action;
        if (
          targetUserId &&
          this.currentUser &&
          targetUserId !== this.currentUser.id &&
          targetUserId !== this.currentUser.sessionId
        ) {
          break;
        }
        const listeners = this.privateTypingListeners.get(senderId);
        if (listeners) {
          listeners.forEach(cb => cb(!!isTyping, senderName || ''));
        }
        break;
      }

      case 'ROOM_TYPING_UPDATE': {
        const { roomId, userId, userName, isTyping } = action;
        const listeners = this.roomTypingListeners.get(roomId);
        if (listeners) {
          listeners.forEach(cb => cb(userId, userName || '', !!isTyping));
        }
        break;
      }

      case 'MESSAGE_REACTION_UPDATED': {
        const { roomId, messageId, reactions, userReactions, reactionUsers } = action;
        const listeners = this.reactionListeners.get(roomId);
        if (listeners) {
          listeners.forEach(cb =>
            cb({
              messageId,
              reactions: reactions || {},
              userReactions: userReactions || {},
              reactionUsers: reactionUsers || {}
            })
          );
        }
        break;
      }

      case 'ROOM_MESSAGES_READ_UPDATE': {
        const { roomId, readerId, messageIds } = action;
        const listeners = this.roomReadListeners.get(roomId);
        if (listeners && Array.isArray(messageIds)) {
          listeners.forEach(cb => cb(messageIds, readerId || ''));
        }
        break;
      }

      case 'DIRECT_MESSAGE_READ_UPDATE': {
        const { convId, readerId, messageIds } = action;
        const listeners = this.directReadListeners.get(convId);
        if (listeners && Array.isArray(messageIds)) {
          listeners.forEach(cb => cb(messageIds, readerId || ''));
        }
        break;
      }

      case 'ROOM_PINNED_MESSAGE': {
        const { roomId, pinnedMessage } = action;
        if (roomId) {
          const listeners = this.pinnedMessageListeners.get(roomId);
          if (listeners) {
            listeners.forEach(cb => cb(pinnedMessage || null));
          }
        }
        break;
      }

      case 'ALL_ROOM_BACKGROUNDS': {
        const backgrounds = (action.backgrounds && typeof action.backgrounds === 'object')
          ? (action.backgrounds as Record<string, string>)
          : {};
        this.latestRoomBackgrounds = { ...backgrounds };
        this.allRoomBackgroundListeners.forEach(cb => cb(this.latestRoomBackgrounds));
        Object.entries(backgrounds).forEach(([rId, theme]) => {
          const listeners = this.roomBackgroundListeners.get(rId);
          if (listeners) {
            listeners.forEach(cb => cb(theme || 'default'));
          }
        });
        break;
      }

      case 'ROOM_BACKGROUND_UPDATED': {
        const { roomId, backgroundTheme } = action;
        if (roomId) {
          const normalized = typeof backgroundTheme === 'string' && backgroundTheme ? backgroundTheme : 'default';
          if (normalized === 'default') {
            delete this.latestRoomBackgrounds[roomId];
          } else {
            this.latestRoomBackgrounds[roomId] = normalized;
          }
          this.allRoomBackgroundListeners.forEach(cb => cb({ ...this.latestRoomBackgrounds }));
          const listeners = this.roomBackgroundListeners.get(roomId);
          if (listeners) {
            listeners.forEach(cb => cb(normalized));
          }
        }
        break;
      }

      case 'ALL_ROOM_LOCKS': {
        const locks = (action.locks && typeof action.locks === 'object')
          ? (action.locks as Record<string, boolean>)
          : {};
        this.latestRoomLocks = { ...locks };
        this.allRoomLockListeners.forEach(cb => cb(this.latestRoomLocks));
        Object.entries(locks).forEach(([rId, locked]) => {
          const listeners = this.roomLockListeners.get(rId);
          if (listeners) {
            listeners.forEach(cb => cb(Boolean(locked)));
          }
        });
        break;
      }

      case 'ROOM_LOCK_UPDATED': {
        const { roomId, isLocked } = action;
        if (roomId) {
          const nextLocked = Boolean(isLocked);
          if (nextLocked) {
            this.latestRoomLocks[roomId] = true;
          } else {
            delete this.latestRoomLocks[roomId];
          }
          this.allRoomLockListeners.forEach(cb => cb({ ...this.latestRoomLocks }));
          const listeners = this.roomLockListeners.get(roomId);
          if (listeners) {
            listeners.forEach(cb => cb(nextLocked));
          }
        }
        break;
      }

      case 'CUMULATIVE_VISITORS_UPDATE': {
        const count = Number(action.count);
        if (!isNaN(count) && count >= 15480) {
          this.latestCumulativeVisitorsCount = Math.max(this.latestCumulativeVisitorsCount, count);
          this.cumulativeVisitorsListeners.forEach(cb => cb(this.latestCumulativeVisitorsCount));
        }
        break;
      }

      case 'ADMIN_REPORT_RECEIVED': {
        if (action.report) {
          this.adminReportListeners.forEach(cb => cb(action.report));
        }
        break;
      }

      case 'CALL_SIGNAL': {
        if (action.signal) {
          this.callSignalListeners.forEach(cb => cb(action.signal));
        }
        break;
      }

      case 'CONSENT_SIGNAL': {
        if (action.kind && action.payload) {
          this.consentSignalListeners.forEach(cb => cb({ kind: action.kind, payload: action.payload }));
        }
        break;
      }

      case 'LUXURY_GIFT_BROADCAST': {
        if (action.roomId && action.giftData) {
          this.luxuryGiftListeners.get(action.roomId)?.forEach(cb => cb(action.giftData));
        }
        break;
      }

      case 'ROOM_PURGED': {
        if (action.roomId) {
          this.roomPurgedListeners.get(action.roomId)?.forEach(cb => cb());
        }
        break;
      }

      case 'GLOBAL_USER_JOINED': {
        if (action.user && action.user.name) {
          this.globalJoinListeners.forEach(cb => cb(action.user));
        }
        break;
      }

      case 'ALL_ROOM_LAST_MESSAGES': {
        const lastMessages = (action.lastMessages && typeof action.lastMessages === 'object')
          ? (action.lastMessages as Record<string, { senderName: string; content: string; type?: string; timestamp: number }>)
          : {};
        this.latestRoomLastMessages = { ...lastMessages };
        this.allRoomLastMessageListeners.forEach(cb => cb({ ...this.latestRoomLastMessages }));
        break;
      }

      case 'ROOM_LAST_MESSAGE_UPDATED': {
        if (action.roomId && action.lastMessage) {
          this.latestRoomLastMessages = {
            ...this.latestRoomLastMessages,
            [action.roomId]: action.lastMessage
          };
          this.allRoomLastMessageListeners.forEach(cb => cb({ ...this.latestRoomLastMessages }));
        }
        break;
      }

      case 'APP_UPDATE_NOTICE': {
        if (action.notice) {
          this.latestAppUpdateNotice = action.notice;
          this.appUpdateNoticeListeners.forEach(cb => cb(action.notice));
        }
        break;
      }

      case 'TICTACTOE_SIGNAL': {
        if (action.signal) {
          this.ticTacToeSignalListeners.forEach(cb => cb(action.signal));
        }
        break;
      }

      case 'LIVE_AUDIO_STAGE_UPDATE': {
        if (action.roomId && Array.isArray(action.raisedHandUserIds)) {
          this.liveAudioStageListeners.get(action.roomId)?.forEach((cb) => cb(action.raisedHandUserIds));
        }
        break;
      }

      default:
        break;
    }
  }

  // API Methods
  registerUser(user: User) {
    this.currentUser = user;
    this.send('USER_REGISTER', { user });
  }

  joinRoom(roomId: string, user: User) {
    this.currentRoomId = roomId;
    this.currentUser = user;
    this.send('JOIN_ROOM', { roomId, user });
  }

  leaveRoom(roomId: string, userId: string) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
    this.send('LEAVE_ROOM', { roomId, userId });
  }

  sendMessage(roomId: string, message: Partial<Message>) {
    this.send('SEND_MESSAGE', { roomId, message });
  }

  updateProfile(user: Partial<User> & { id: string }) {
    this.send('UPDATE_PROFILE', { user });
  }

  updateAvatar(userId: string, avatar: string) {
    this.send('UPDATE_AVATAR', { userId, avatar });
  }

  sendAdminAction(targetUserId: string, updates: Partial<User>) {
    this.send('ADMIN_ACTION', { targetUserId, updates });
  }

  sendDirectMessage(convId: string, recipientId: string, message: Partial<Message>, recipientSessionId?: string) {
    this.send('DIRECT_MESSAGE', { convId, recipientId, recipientSessionId, message });
  }

  sendMessageReaction(
    roomId: string,
    messageId: string,
    reactions: Record<string, number>,
    userReactions: Record<string, string>,
    reactionUsers: Record<string, string[]>
  ) {
    this.send('MESSAGE_REACTION', { roomId, messageId, reactions, userReactions, reactionUsers });
  }

  sendRoomMessagesRead(roomId: string, readerId: string, messageIds: string[]) {
    if (!messageIds.length) return;
    this.send('ROOM_MESSAGES_READ', { roomId, readerId, messageIds });
  }

  sendDirectMessagesRead(convId: string, readerId: string, senderId: string, messageIds: string[]) {
    if (!messageIds.length) return;
    this.send('DIRECT_MESSAGE_READ', { convId, readerId, senderId, messageIds });
  }

  sendRoomTyping(roomId: string, userId: string, userName: string, isTyping: boolean) {
    this.send('ROOM_TYPING', { roomId, userId, userName, isTyping });
  }

  setRoomPinnedMessage(roomId: string, pinnedMessage: PinnedRoomMessage | null) {
    this.send('SET_PINNED_MESSAGE', { roomId, pinnedMessage });
  }

  updateRoomBackground(roomId: string, backgroundTheme: string) {
    const normalized = backgroundTheme && backgroundTheme !== 'default' ? backgroundTheme : 'default';
    if (normalized === 'default') {
      delete this.latestRoomBackgrounds[roomId];
    } else {
      this.latestRoomBackgrounds[roomId] = normalized;
    }
    this.send('UPDATE_ROOM_BACKGROUND', { roomId, backgroundTheme: normalized });
  }

  updateRoomLock(roomId: string, isLocked: boolean) {
    const nextLocked = Boolean(isLocked);
    if (nextLocked) {
      this.latestRoomLocks[roomId] = true;
    } else {
      delete this.latestRoomLocks[roomId];
    }
    this.send('UPDATE_ROOM_LOCK', { roomId, isLocked: nextLocked });
  }

  creditInstaPayCoins(userId: string, coinsToAdd: number, order: any) {
    this.send('INSTAPAY_CREDIT_COINS', { userId, coinsToAdd, order });
  }

  creditPaymobCoins(userId: string, coinsToAdd: number, order: any) {
    this.creditInstaPayCoins(userId, coinsToAdd, order);
  }

  sendFriendRequest(request: FriendRequest) {
    this.send('FRIEND_REQUEST', { request });
  }

  sendUserReport(report: {
    reporterId: string;
    reporterName: string;
    reportedUserId: string;
    reportedUserName: string;
    reason: string;
    details?: string;
    timestamp: number;
  }) {
    this.send('USER_REPORT', { report });
  }

  registerVisit(visitToken: string, clientHighestCount?: number) {
    this.send('REGISTER_VISIT', { visitToken, clientHighestCount });
  }

  syncCumulativeVisitorsCount(count: number) {
    if (!isNaN(count) && count > this.latestCumulativeVisitorsCount) {
      this.latestCumulativeVisitorsCount = count;
    }
    this.send('SYNC_VISITORS_COUNT', { count });
  }

  subscribeToCumulativeVisitors(callback: (count: number) => void): () => void {
    this.cumulativeVisitorsListeners.add(callback);
    if (this.latestCumulativeVisitorsCount > 15480) {
      callback(this.latestCumulativeVisitorsCount);
    }
    return () => {
      this.cumulativeVisitorsListeners.delete(callback);
    };
  }

  subscribeToAdminReports(callback: (report: any) => void): () => void {
    this.adminReportListeners.add(callback);
    return () => {
      this.adminReportListeners.delete(callback);
    };
  }

  sendCallSignal(targetUserId: string, signal: any) {
    this.send('CALL_SIGNAL', { targetUserId, signal });
  }

  subscribeToCallSignals(callback: (signal: any) => void): () => void {
    this.callSignalListeners.add(callback);
    return () => {
      this.callSignalListeners.delete(callback);
    };
  }

  sendClearRoomMessages(roomId: string) {
    this.send('CLEAR_ROOM_MESSAGES', { roomId });
  }

  subscribeToRoomPurged(roomId: string, callback: () => void): () => void {
    if (!this.roomPurgedListeners.has(roomId)) {
      this.roomPurgedListeners.set(roomId, new Set());
    }
    this.roomPurgedListeners.get(roomId)!.add(callback);
    return () => {
      this.roomPurgedListeners.get(roomId)?.delete(callback);
    };
  }

  // Subscription helpers
  subscribeToRoom(
    roomId: string,
    onMessage: MessageCallback,
    onHistory?: HistoryCallback
  ): () => void {
    if (!this.messageListeners.has(roomId)) {
      this.messageListeners.set(roomId, new Set());
    }
    this.messageListeners.get(roomId)!.add(onMessage);

    if (onHistory) {
      if (!this.historyListeners.has(roomId)) {
        this.historyListeners.set(roomId, new Set());
      }
      this.historyListeners.get(roomId)!.add(onHistory);
    }

    return () => {
      this.messageListeners.get(roomId)?.delete(onMessage);
      if (onHistory) {
        this.historyListeners.get(roomId)?.delete(onHistory);
      }
    };
  }

  subscribeToPresence(roomId: string, callback: PresenceCallback): () => void {
    if (!this.presenceListeners.has(roomId)) {
      this.presenceListeners.set(roomId, new Set());
    }
    this.presenceListeners.get(roomId)!.add(callback);

    return () => {
      this.presenceListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToGlobalPresence(callback: GlobalPresenceCallback): () => void {
    this.globalPresenceListeners.add(callback);
    return () => {
      this.globalPresenceListeners.delete(callback);
    };
  }

  subscribeToUserProfile(userId: string, callback: ProfileCallback): () => void {
    if (!this.profileListeners.has(userId)) {
      this.profileListeners.set(userId, new Set());
    }
    this.profileListeners.get(userId)!.add(callback);

    return () => {
      this.profileListeners.get(userId)?.delete(callback);
    };
  }

  subscribeToAdminEvents(callback: AdminEventCallback): () => void {
    this.adminEventListeners.add(callback);
    return () => {
      this.adminEventListeners.delete(callback);
    };
  }

  subscribeToDirectMessages(
    convId: string,
    callback: DirectMessageCallback
  ): () => void {
    if (!this.directMessageListeners.has(convId)) {
      this.directMessageListeners.set(convId, new Set());
    }
    this.directMessageListeners.get(convId)!.add(callback);
    return () => {
      this.directMessageListeners.get(convId)?.delete(callback);
    };
  }

  subscribeToGlobalDirectMessages(callback: DirectMessageCallback): () => void {
    this.globalDirectMessageListeners.add(callback);
    return () => {
      this.globalDirectMessageListeners.delete(callback);
    };
  }

  subscribeToFriendRequests(callback: FriendReqCallback): () => void {
    this.friendReqListeners.add(callback);
    return () => {
      this.friendReqListeners.delete(callback);
    };
  }

  // Private Chat Realtime Typing Indicator via WebSocket
  sendPrivateTyping(
    senderId: string,
    senderName: string,
    targetUserId: string,
    isTyping: boolean,
    targetSessionId?: string
  ) {
    this.send('PRIVATE_TYPING', { senderId, senderName, targetUserId, targetSessionId, isTyping });

    // Local BroadcastChannel fallback for multi-tab testing
    if (typeof window !== 'undefined') {
      try {
        const bus = new BroadcastChannel('arab_egypt_chat_bus');
        bus.postMessage({
          type: 'PRIVATE_TYPING_BROADCAST',
          senderId,
          senderName,
          targetUserId,
          isTyping
        });
        bus.close();
      } catch {}
    }
  }

  subscribeToPrivateTyping(targetUserId: string, callback: PrivateTypingCallback): () => void {
    if (!this.privateTypingListeners.has(targetUserId)) {
      this.privateTypingListeners.set(targetUserId, new Set());
    }
    this.privateTypingListeners.get(targetUserId)!.add(callback);

    // Cross-tab broadcast listener
    let bus: BroadcastChannel | null = null;
    if (typeof window !== 'undefined') {
      try {
        bus = new BroadcastChannel('arab_egypt_chat_bus');
        bus.onmessage = (e) => {
          if (e.data?.type === 'PRIVATE_TYPING_BROADCAST' && e.data.senderId === targetUserId) {
            const recipientId = e.data.targetUserId;
            if (
              recipientId &&
              this.currentUser &&
              recipientId !== this.currentUser.id &&
              recipientId !== this.currentUser.sessionId
            ) {
              return;
            }
            callback(!!e.data.isTyping, e.data.senderName || '');
          }
        };
      } catch {}
    }

    return () => {
      this.privateTypingListeners.get(targetUserId)?.delete(callback);
      if (bus) bus.close();
    };
  }

  subscribeToRoomTyping(roomId: string, callback: RoomTypingCallback): () => void {
    if (!this.roomTypingListeners.has(roomId)) {
      this.roomTypingListeners.set(roomId, new Set());
    }
    this.roomTypingListeners.get(roomId)!.add(callback);
    return () => {
      this.roomTypingListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToMessageReactions(roomId: string, callback: ReactionCallback): () => void {
    if (!this.reactionListeners.has(roomId)) {
      this.reactionListeners.set(roomId, new Set());
    }
    this.reactionListeners.get(roomId)!.add(callback);
    return () => {
      this.reactionListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToRoomMessagesRead(roomId: string, callback: ReadReceiptCallback): () => void {
    if (!this.roomReadListeners.has(roomId)) {
      this.roomReadListeners.set(roomId, new Set());
    }
    this.roomReadListeners.get(roomId)!.add(callback);
    return () => {
      this.roomReadListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToDirectMessagesRead(convId: string, callback: ReadReceiptCallback): () => void {
    if (!this.directReadListeners.has(convId)) {
      this.directReadListeners.set(convId, new Set());
    }
    this.directReadListeners.get(convId)!.add(callback);
    return () => {
      this.directReadListeners.get(convId)?.delete(callback);
    };
  }

  subscribeToRoomPinnedMessage(roomId: string, callback: PinnedMessageCallback): () => void {
    if (!this.pinnedMessageListeners.has(roomId)) {
      this.pinnedMessageListeners.set(roomId, new Set());
    }
    this.pinnedMessageListeners.get(roomId)!.add(callback);
    return () => {
      this.pinnedMessageListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToRoomBackground(roomId: string, callback: (backgroundTheme: string) => void): () => void {
    if (!this.roomBackgroundListeners.has(roomId)) {
      this.roomBackgroundListeners.set(roomId, new Set());
    }
    this.roomBackgroundListeners.get(roomId)!.add(callback);
    if (this.latestRoomBackgrounds[roomId]) {
      callback(this.latestRoomBackgrounds[roomId]);
    }
    return () => {
      this.roomBackgroundListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToAllRoomBackgrounds(callback: (backgrounds: Record<string, string>) => void): () => void {
    this.allRoomBackgroundListeners.add(callback);
    if (Object.keys(this.latestRoomBackgrounds).length > 0) {
      callback({ ...this.latestRoomBackgrounds });
    }
    return () => {
      this.allRoomBackgroundListeners.delete(callback);
    };
  }

  subscribeToRoomLock(roomId: string, callback: (isLocked: boolean) => void): () => void {
    if (!this.roomLockListeners.has(roomId)) {
      this.roomLockListeners.set(roomId, new Set());
    }
    this.roomLockListeners.get(roomId)!.add(callback);
    if (Object.prototype.hasOwnProperty.call(this.latestRoomLocks, roomId)) {
      callback(Boolean(this.latestRoomLocks[roomId]));
    }
    return () => {
      this.roomLockListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToAllRoomLocks(callback: (locks: Record<string, boolean>) => void): () => void {
    this.allRoomLockListeners.add(callback);
    if (Object.keys(this.latestRoomLocks).length > 0) {
      callback({ ...this.latestRoomLocks });
    }
    return () => {
      this.allRoomLockListeners.delete(callback);
    };
  }

  sendConsentSignal(data: { kind: 'request' | 'response' | 'cancel'; targetUserId: string; payload: any }) {
    this.send('CONSENT_SIGNAL', data);
  }

  subscribeToConsentSignals(callback: (signal: { kind: 'request' | 'response' | 'cancel'; payload: any }) => void): () => void {
    this.consentSignalListeners.add(callback);
    return () => {
      this.consentSignalListeners.delete(callback);
    };
  }

  sendLiveAudioRaiseHand(roomId: string, userId: string, raised: boolean) {
    this.send('LIVE_AUDIO_RAISE_HAND', { roomId, userId, raised });
  }

  subscribeToLiveAudioStage(roomId: string, callback: (raisedHandUserIds: string[]) => void): () => void {
    if (!this.liveAudioStageListeners.has(roomId)) {
      this.liveAudioStageListeners.set(roomId, new Set());
    }
    this.liveAudioStageListeners.get(roomId)!.add(callback);
    return () => {
      this.liveAudioStageListeners.get(roomId)?.delete(callback);
    };
  }

  sendLuxuryGiftBroadcast(roomId: string, giftData: any) {
    this.send('LUXURY_GIFT_BROADCAST', { roomId, giftData });
  }

  subscribeToLuxuryGiftBroadcasts(roomId: string, callback: (giftData: any) => void): () => void {
    if (!this.luxuryGiftListeners.has(roomId)) {
      this.luxuryGiftListeners.set(roomId, new Set());
    }
    this.luxuryGiftListeners.get(roomId)!.add(callback);
    return () => {
      this.luxuryGiftListeners.get(roomId)?.delete(callback);
    };
  }

  subscribeToGlobalUserJoined(
    callback: (user: { id: string; name: string; avatar?: string; role?: string; vipBadge?: string }) => void
  ): () => void {
    this.globalJoinListeners.add(callback);
    return () => {
      this.globalJoinListeners.delete(callback);
    };
  }

  subscribeToAllRoomLastMessages(
    callback: (lastMessages: Record<string, { senderName: string; content: string; type?: string; timestamp: number }>) => void
  ): () => void {
    this.allRoomLastMessageListeners.add(callback);
    if (Object.keys(this.latestRoomLastMessages).length > 0) {
      callback({ ...this.latestRoomLastMessages });
    }
    return () => {
      this.allRoomLastMessageListeners.delete(callback);
    };
  }

  sendAppUpdateNotice(notice: { version?: string; message?: string; pushedBy?: string }) {
    this.send('APP_UPDATE_NOTICE', notice);
  }

  subscribeToAppUpdateNotices(
    callback: (notice: { version: string; message: string; pushedBy: string; timestamp: number }) => void
  ): () => void {
    this.appUpdateNoticeListeners.add(callback);
    if (this.latestAppUpdateNotice) {
      callback(this.latestAppUpdateNotice);
    }
    return () => {
      this.appUpdateNoticeListeners.delete(callback);
    };
  }

  sendTicTacToeSignal(targetUserId: string, signal: any) {
    this.send('TICTACTOE_SIGNAL', { targetUserId, signal });
  }

  subscribeToTicTacToeSignals(callback: (signal: any) => void): () => void {
    this.ticTacToeSignalListeners.add(callback);
    return () => {
      this.ticTacToeSignalListeners.delete(callback);
    };
  }
}

export const realtimeSocket = new RealtimeSocketManager();
