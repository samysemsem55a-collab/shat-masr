import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  MessageCircle, 
  Search, 
  Send, 
  Mic, 
  ArrowRight, 
  ArrowUp,
  CheckCheck, 
  Play, 
  Pause, 
  Lock,
  Phone,
  Video,
  Trash2,
  Copy,
  X,
  Users,
  Radio,
  Clock,
  Sparkles,
  Gift,
  Palette,
  Crown,
  Coins,
  Image as ImageIcon,
  Smile,
  Sticker,
  Loader2,
  Maximize2,
  MoreVertical,
  Flag,
  Reply,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, Message, Friend, GiftItem, UnreadSenderSummary } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { 
  subscribeToDirectMessages, 
  getConversationId,
  sendDirectMessage, 
  deleteDirectMessage,
  subscribeToFriendsList,
  subscribeToUserRecentDirectChats,
  markDirectMessagesAsRead,
  uploadPrivateChatMedia,
  setPrivateTyping,
  subscribeToPrivateTyping,
  submitUserReport,
  recordGiftRecipientStats
} from '../services/firebase';
import { FriendsList } from './FriendsList';
import { LuxuryGiftModal } from './LuxuryGiftModal';
import { CallModal } from './CallModal';
import { CoinsTransferModal } from './CoinsTransferModal';
import { ChatWallpapersModal } from './ChatWallpapersModal';
import { STICKERS_CATALOG, CURATED_EMOJIS } from '../data/stickers';
import { toast } from '../utils/appToast';
import { getWallpaperStyleById } from '../data/wallpapers';
import { AvatarWithFrame } from './AvatarWithFrame';
import { MessageStatusIcon } from './MessageStatusIcon';
import { BlurredChatImage } from './BlurredChatImage';
import { getRankDisplayMeta } from '../utils/userRanks';
import { ANIMATED_INLINE_EMOJIS, InlineRichText } from './InlineRichText';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { compressImageFileToBlob } from '../utils/imageCompression';
import { downloadImageToDevice } from '../utils/downloadImage';
import { offlineQueue } from '../services/offlineQueue';
import { globalRadioPlayer } from '../services/radioPlayer';
import { realtimeSocket } from '../services/realtimeSocket';
import { formatLastSeenArabic, isUserTrulyOnline } from '../utils/presenceStatus';

interface PrivateChatViewProps {
  currentUser: User;
  onOpenWallet: () => void;
  targetUser?: User | null;
  onClearTargetUser?: () => void;
  globalOnlineUsers?: User[];
  allRegisteredUsers?: User[];
  onUpdateUser?: (user: User) => void;
  onChatActiveChange?: (isActive: boolean) => void;
  onPromptRegister?: () => void;
  unreadBySender?: Record<string, number>;
  unreadMessagesBySender?: UnreadSenderSummary[];
  onMarkSenderRead?: (senderId: string) => void;
  onClearAllUnreadMessages?: () => void;
  onOpenUserProfile?: (user: User) => void;
  isDrawer?: boolean;
  onCloseDrawer?: () => void;
  prefilledDraft?: string | null;
  onClearPrefilledDraft?: () => void;
  onCallActiveChange?: (isActive: boolean) => void;
}

interface ChatContact {
  id: string;
  name: string;
  countryFlag: string;
  avatar: string;
  role: string;
  status: 'online' | 'offline';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const PrivateChatView: React.FC<PrivateChatViewProps> = ({
  currentUser,
  targetUser,
  onClearTargetUser,
  globalOnlineUsers = [],
  allRegisteredUsers = [],
  onOpenWallet,
  onUpdateUser,
  onChatActiveChange,
  onPromptRegister,
  unreadBySender = {},
  unreadMessagesBySender = [],
  onMarkSenderRead,
  onClearAllUnreadMessages,
  onOpenUserProfile,
  isDrawer = false,
  onCloseDrawer,
  prefilledDraft = null,
  onClearPrefilledDraft,
  onCallActiveChange
}) => {
  // Navigation tabs when in list view
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'online'>('chats');
  
  // Contacts and recent chats state (strictly from database, zero mock data)
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);

  useEffect(() => {
    onChatActiveChange?.(Boolean(activeContact));
  }, [activeContact, onChatActiveChange]);

  // Modals: Calls, Coins Transfer, Wallpapers & Luxury Virtual Gifts
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isWallpapersModalOpen, setIsWallpapersModalOpen] = useState(false);
  const [callModalState, setCallModalState] = useState<{ isOpen: boolean; callType: 'audio' | 'video' }>({
    isOpen: false,
    callType: 'audio'
  });

  useEffect(() => {
    onCallActiveChange?.(callModalState.isOpen);
    return () => {
      onCallActiveChange?.(false);
    };
  }, [callModalState.isOpen, onCallActiveChange]);
  const [isCoinsTransferOpen, setIsCoinsTransferOpen] = useState(false);

  // Emoji & Animated Emojis Picker + Media Upload + Lightbox + Swipe-to-Reply States
  const [isEmojiStickerOpen, setIsEmojiStickerOpen] = useState(false);
  const [emojiStickerTab, setEmojiStickerTab] = useState<'emojis' | 'animated'>('emojis');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [swipeState, setSwipeState] = useState<{ msgId: string; offsetX: number } | null>(null);
  const swipeStartRef = useRef<{ msgId: string; startX: number; startY: number } | null>(null);
  const swipeMovedRef = useRef(false);
  const messageRefs = useRef<{ [msgId: string]: HTMLDivElement | null }>({});
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiStickerPanelRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const hasInitialScrolledRef = useRef<boolean>(false);
  const prevLastDmIdRef = useRef<string | null>(null);

  const scrollToMessage = (msgId?: string) => {
    if (!msgId) return;
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2200);
    }
  };

  const triggerReplyTo = (msg: Message) => {
    sounds.playMessageSent();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch {}
    setReplyingTo(msg);
    requestAnimationFrame(() => chatInputRef.current?.focus());
  };

  // Real Voice Recording States & Refs
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingSecondsRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Close actions menu on outside click & reset search/reply/scroll tracking when switching contact
  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsMessageSearchOpen(false);
    setMessageSearchQuery('');
    setReplyingTo(null);
    setSwipeState(null);
    isNearBottomRef.current = true;
    hasInitialScrolledRef.current = false;
    prevLastDmIdRef.current = null;
  }, [activeContact?.id]);

  useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isActionsMenuOpen]);

  // Memory safety on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, []);

  const getActivePeerSessionId = () => {
    if (!activeContact) return undefined;
    return globalOnlineUsers.find(u => u.id === activeContact.id)?.sessionId;
  };

  // Send Direct Virtual Gift Handler
  const handleSendDirectGift = (gift: GiftItem) => {
    if (!activeContact) return;
    const isOwner = currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'super_admin';
    if (!isOwner && currentUser.coins < gift.cost) {
      toast.warning(`عفواً، رصيد الكوينز غير كافٍ! تحتاج إلى ${gift.cost} كوينز لإرسال هذه الهدية.`);
      onOpenWallet();
      return;
    }

    const newCoins = isOwner ? currentUser.coins : Math.max(0, currentUser.coins - gift.cost);
    const updatedUser: User = {
      ...currentUser,
      coins: newCoins,
      totalGiftsSent: (currentUser.totalGiftsSent || 0) + 1,
    };
    if (onUpdateUser) onUpdateUser(updatedUser);

    sounds.playGiftFanfare();
    confetti({
      particleCount: 85,
      spread: 70,
      origin: { y: 0.6 }
    });
    toast.gift(`تم إرسال هدية ${gift.name} إلى ${activeContact.name} بنجاح! ${gift.icon}`, {
      description: `خصم ${isOwner ? 0 : gift.cost} كوينز من رصيدك`
    });

    sendDirectMessage(currentUser.id, activeContact.id, {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientName: activeContact.name,
      recipientAvatar: activeContact.avatar,
      recipientSessionId: getActivePeerSessionId(),
      type: 'gift',
      content: `أرسل هدية ${gift.name} بقيمة ${gift.cost} كوينز!`,
      gift: {
        giftId: gift.id,
        name: gift.name,
        icon: gift.icon,
        cost: gift.cost,
        recipientName: activeContact.name,
      }
    }).catch((err) => {
      console.warn('Direct gift send error:', err);
      toast.error('تعذر إرسال الهدية في المحادثة الخاصة');
    });

    recordGiftRecipientStats(activeContact.id, gift.cost).catch(() => {});
  };

  // 1. Subscribe to Real-Time Recent Chats from DB
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToUserRecentDirectChats(currentUser.id, (loaded) => {
      setRecentChats(loaded || []);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // 2. Subscribe to Real-Time Friends from Firestore /users/{uid}/friends
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToFriendsList(currentUser.id, (loaded) => {
      setFriendsList(loaded || []);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // 3. Handle External Navigation from UserProfileModal or OnlineUsersModal
  useEffect(() => {
    if (targetUser && targetUser.id !== currentUser.id) {
      onMarkSenderRead?.(targetUser.id);
      const isOnline = globalOnlineUsers.some(u => u.id === targetUser.id) || targetUser.isOnline;
      const targetContact: ChatContact = {
        id: targetUser.id,
        name: targetUser.name,
        countryFlag: targetUser.countryFlag || '🌍',
        avatar: targetUser.avatar || '',
        role: targetUser.vipBadge || targetUser.role || 'عضو',
        status: isOnline ? 'online' : 'offline',
        lastMessage: 'محادثة خاصة جديدة...',
        lastMessageTime: 'الآن',
        unreadCount: 0
      };
      setActiveContact(targetContact);
    }
  }, [targetUser?.id, currentUser.id]);

  // 4. Real-time Messages for Active 1-on-1 Chat (pure onSnapshot, expanding limit for older history without getDocs)
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [dmLimit, setDmLimit] = useState<number>(30);
  const [hasMoreOlderDm, setHasMoreOlderDm] = useState<boolean>(false);
  const [isLoadingOlderDm, setIsLoadingOlderDm] = useState<boolean>(false);
  const loadingOlderDmGuardRef = useRef<boolean>(false);
  const noMoreOlderDmRef = useRef<boolean>(false);
  const prevDmConvKeyRef = useRef<string | null>(null);
  const pendingScrollRestoreRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeContact?.id || !currentUser?.id) {
      prevDmConvKeyRef.current = null;
      pendingScrollRestoreRef.current = null;
      loadingOlderDmGuardRef.current = false;
      noMoreOlderDmRef.current = false;
      setLiveMessages([]);
      setDmLimit(30);
      setHasMoreOlderDm(false);
      setIsLoadingOlderDm(false);
      return;
    }

    const convId = getConversationId(currentUser.id, activeContact.id);
    const isNewConv = prevDmConvKeyRef.current !== convId;
    if (isNewConv) {
      prevDmConvKeyRef.current = convId;
      pendingScrollRestoreRef.current = null;
      loadingOlderDmGuardRef.current = false;
      noMoreOlderDmRef.current = false;
      setLiveMessages([]);
      setHasMoreOlderDm(false);
      setIsLoadingOlderDm(false);
      if (dmLimit !== 30) {
        setDmLimit(30);
        return;
      }
    }

    const activeLimit = dmLimit;
    const unsub = subscribeToDirectMessages(
      currentUser.id,
      activeContact.id,
      (loadedMsgs, meta) => {
        const next = loadedMsgs || [];
        setLiveMessages(next);

        if (meta?.fromFirestore && !meta.fromCache) {
          if (next.length < activeLimit) {
            noMoreOlderDmRef.current = true;
            setHasMoreOlderDm(false);
          } else if (!noMoreOlderDmRef.current) {
            setHasMoreOlderDm(true);
          }

          if (pendingScrollRestoreRef.current) {
            const { prevHeight, prevTop } = pendingScrollRestoreRef.current;
            pendingScrollRestoreRef.current = null;
            requestAnimationFrame(() => {
              const el = messagesScrollRef.current;
              if (!el) return;
              const diff = el.scrollHeight - prevHeight;
              if (diff > 0) el.scrollTop = prevTop + diff;
            });
          }
          setIsLoadingOlderDm(false);
          loadingOlderDmGuardRef.current = false;
        }
      },
      activeLimit
    );
    return () => unsub();
  }, [activeContact?.id, currentUser.id, dmLimit]);

  const setMessages: React.Dispatch<React.SetStateAction<Message[]>> = setLiveMessages;
  const messages = liveMessages;

  const triggerLoadOlderDm = () => {
    if (!activeContact?.id || loadingOlderDmGuardRef.current || isLoadingOlderDm || !hasMoreOlderDm) return;
    const container = messagesScrollRef.current;
    pendingScrollRestoreRef.current = {
      prevHeight: container?.scrollHeight || 0,
      prevTop: container?.scrollTop || 0,
    };
    loadingOlderDmGuardRef.current = true;
    setIsLoadingOlderDm(true);
    setDmLimit((prev) => prev + 30);
  };

  // Mark incoming messages as 'seen' in Firestore + WebSocket when viewing conversation
  const activeUnreadCount = activeContact?.id ? (unreadBySender[activeContact.id] || 0) : 0;
  useEffect(() => {
    if (!activeContact?.id || !currentUser?.id) return;
    if (activeUnreadCount > 0) {
      onMarkSenderRead?.(activeContact.id);
    }
    if (messages.length === 0) return;
    const hasUnread = messages.some(
      (m) => m.senderId !== currentUser.id && m.status !== 'seen' && m.status !== 'read'
    );
    if (hasUnread) {
      markDirectMessagesAsRead(currentUser.id, activeContact.id, messages);
    }
  }, [activeContact?.id, currentUser?.id, messages, activeUnreadCount, onMarkSenderRead]);

  const [inputText, setInputText] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledDraft && activeContact) {
      setInputText(prefilledDraft);
    }
  }, [prefilledDraft, activeContact?.id]);

  // Live Typing Indicator via WebSocket + Database-Backed Firestore + RTDB
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [typingPeersMap, setTypingPeersMap] = useState<Record<string, number>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrivateTypingEmitRef = useRef<number>(0);
  const peerTypingSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global WebSocket typing listener for Contacts & Online lists
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubAll = realtimeSocket.subscribeToAllPrivateTyping((senderId, _senderName, isTyping) => {
      if (!senderId || senderId === currentUser.id) return;
      setTypingPeersMap(prev => {
        if (isTyping) {
          return { ...prev, [senderId]: Date.now() };
        }
        if (!(senderId in prev)) return prev;
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    });

    const pruneInterval = setInterval(() => {
      const now = Date.now();
      setTypingPeersMap(prev => {
        const keys = Object.keys(prev);
        if (keys.length === 0) return prev;
        let changed = false;
        const next: Record<string, number> = {};
        for (const k of keys) {
          if (now - prev[k] < 6000) {
            next[k] = prev[k];
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      unsubAll();
      clearInterval(pruneInterval);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeContact || !currentUser?.id) {
      setIsPeerTyping(false);
      return;
    }

    const handleTypingSignal = (isTyping: boolean) => {
      if (peerTypingSafetyTimerRef.current) {
        clearTimeout(peerTypingSafetyTimerRef.current);
        peerTypingSafetyTimerRef.current = null;
      }
      setIsPeerTyping(isTyping);
      if (isTyping) {
        peerTypingSafetyTimerRef.current = setTimeout(() => {
          setIsPeerTyping(false);
        }, 6000);
        if (isNearBottomRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    const unsubSocketDirect = realtimeSocket.subscribeToPrivateTyping(activeContact.id, (isTyping) => {
      handleTypingSignal(isTyping);
    });
    const unsub = subscribeToPrivateTyping(currentUser.id, activeContact.id, (isTyping) => {
      handleTypingSignal(isTyping);
    });

    return () => {
      unsubSocketDirect();
      unsub();
      if (peerTypingSafetyTimerRef.current) {
        clearTimeout(peerTypingSafetyTimerRef.current);
        peerTypingSafetyTimerRef.current = null;
      }
      setIsPeerTyping(false);
    };
  }, [activeContact?.id, currentUser?.id]);

  // Clear peer typing immediately when a fresh message from the active peer arrives
  useEffect(() => {
    if (!activeContact || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.senderId === activeContact.id && Date.now() - (latest.timestamp || 0) < 10000) {
      if (peerTypingSafetyTimerRef.current) {
        clearTimeout(peerTypingSafetyTimerRef.current);
        peerTypingSafetyTimerRef.current = null;
      }
      setIsPeerTyping(false);
      setTypingPeersMap(prev => {
        if (!(activeContact.id in prev)) return prev;
        const next = { ...prev };
        delete next[activeContact.id];
        return next;
      });
    }
  }, [messages, activeContact?.id]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      lastPrivateTypingEmitRef.current = 0;
      if (activeContact) {
        setPrivateTyping(
          currentUser.id,
          activeContact.id,
          currentUser.name,
          false,
          getActivePeerSessionId()
        );
      }
    };
  }, [activeContact?.id, currentUser.id]);

  const stopPrivateTypingNow = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (lastPrivateTypingEmitRef.current !== 0 && activeContact) {
      lastPrivateTypingEmitRef.current = 0;
      setPrivateTyping(
        currentUser.id,
        activeContact.id,
        currentUser.name,
        false,
        getActivePeerSessionId()
      );
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!activeContact) return;

    const peerSessionId = getActivePeerSessionId();
    if (val.trim().length > 0) {
      const now = Date.now();
      if (now - lastPrivateTypingEmitRef.current >= 2000) {
        lastPrivateTypingEmitRef.current = now;
        setPrivateTyping(currentUser.id, activeContact.id, currentUser.name, true, peerSessionId);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        lastPrivateTypingEmitRef.current = 0;
        setPrivateTyping(currentUser.id, activeContact.id, currentUser.name, false, peerSessionId);
      }, 3000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      lastPrivateTypingEmitRef.current = 0;
      setPrivateTyping(currentUser.id, activeContact.id, currentUser.name, false, peerSessionId);
    }
  };

  // Message deletion & Context Menu
  const [activeContextMenu, setActiveContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeContact) return;
    setActiveContextMenu(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await deleteDirectMessage(currentUser.id, activeContact.id, msgId);
  };

  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 100;
    if (el.scrollTop < 48 && hasMoreOlderDm && !isLoadingOlderDm) {
      triggerLoadOlderDm();
    }
  };

  useEffect(() => {
    if (!activeContact || typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        });
      }
    };
    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [activeContact?.id]);

  useEffect(() => {
    if (!activeContact || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg?.id || null;
    const isOwnLastMsg = lastMsg?.senderId === currentUser.id;
    if (!hasInitialScrolledRef.current) {
      hasInitialScrolledRef.current = true;
      prevLastDmIdRef.current = lastId;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
      return;
    }
    if (lastId && lastId !== prevLastDmIdRef.current) {
      prevLastDmIdRef.current = lastId;
      if (isNearBottomRef.current || isOwnLastMsg) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, activeContact?.id, currentUser.id]);

  // Close Emoji/Sticker drawer when clicking outside
  useEffect(() => {
    if (!isEmojiStickerOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (emojiStickerPanelRef.current && !emojiStickerPanelRef.current.contains(e.target as Node)) {
        setIsEmojiStickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isEmojiStickerOpen]);

  // Cursor-aware Emoji Insertion
  const handleInsertEmojiAtCursor = (emoji: string) => {
    const input = chatInputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputText.length;
      const end = input.selectionEnd ?? inputText.length;
      const updated = inputText.slice(0, start) + emoji + inputText.slice(end);
      handleInputChange(updated);
      requestAnimationFrame(() => {
        input.focus();
        const nextPos = start + emoji.length;
        try {
          input.setSelectionRange(nextPos, nextPos);
        } catch {}
      });
    } else {
      handleInputChange(inputText + emoji);
    }
  };

  // Direct Audio / Video Call Launcher for all entered users
  const handleRequestCall = (callType: 'audio' | 'video') => {
    if (!activeContact) return;
    globalRadioPlayer.pauseForCall();
    setCallModalState({ isOpen: true, callType });
  };

  // WhatsApp-style Media file picker: 0ms blob preview + fast client compression + live progress
  const handleMediaFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeContact) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      toast.error('يرجى اختيار صورة أو مقطع فيديو صالح.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً! الحد الأقصى المسموح هو 15 ميجابايت.');
      return;
    }

    const convId = getConversationId(currentUser.id, activeContact.id);
    setIsUploadingMedia(true);
    setUploadProgress(5);
    const tempId = `dm_media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rawPreviewUrl = URL.createObjectURL(file);
    const optimisticType: 'image' | 'video' = isVideo ? 'video' : 'image';
    const now = Date.now();

    const optimisticMsg: Message = {
      id: tempId,
      tempId,
      clientId: tempId,
      roomId: convId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientId: activeContact.id,
      type: optimisticType,
      mediaUrl: rawPreviewUrl,
      mediaType: optimisticType,
      imageUrl: optimisticType === 'image' ? rawPreviewUrl : undefined,
      content: optimisticType === 'video' ? '🎥 مقطع فيديو' : '🖼️ صورة مرفقة',
      text: optimisticType === 'video' ? '🎥 مقطع فيديو' : '🖼️ صورة مرفقة',
      uploadProgress: 5,
      createdAt: now,
      timestamp: now,
      status: 'sent'
    };
    isNearBottomRef.current = true;
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      let uploadFile: File = file;
      if (isImage) {
        const { blob: compressedBlob } = await compressImageFileToBlob(file, {
          maxWidth: 1080,
          maxHeight: 1080,
          maxBytes: 220 * 1024,
          initialQuality: 0.8,
        });
        const cleanBase = file.name.replace(/\.[^.]+$/, '') || 'photo';
        uploadFile = new File([compressedBlob], `${cleanBase}.jpg`, { type: 'image/jpeg' });
        setUploadProgress(20);
        setMessages(prev => prev.map(m => (m.id === tempId || m.tempId === tempId) ? { ...m, uploadProgress: 20 } : m));
      }

      const { url, mediaType } = await uploadPrivateChatMedia(uploadFile, convId, (pct) => {
        const scaled = isImage
          ? Math.min(98, Math.max(20, 20 + Math.round(pct * 0.78)))
          : Math.min(98, Math.max(5, pct));
        setUploadProgress(scaled);
        setMessages(prev => prev.map(m => (m.id === tempId || m.tempId === tempId) ? { ...m, uploadProgress: scaled } : m));
      });
      sounds.playMessageSent();
      const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
        id: tempId,
        tempId,
        clientId: tempId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        senderVipBadge: currentUser.vipBadge,
        recipientId: activeContact.id,
        recipientName: activeContact.name,
        recipientAvatar: activeContact.avatar,
        recipientSessionId: getActivePeerSessionId(),
        type: mediaType,
        mediaUrl: url,
        mediaType,
        imageUrl: mediaType === 'image' ? url : undefined,
        content: mediaType === 'video' ? '🎥 مقطع فيديو' : '🖼️ صورة مرفقة',
        text: mediaType === 'video' ? '🎥 مقطع فيديو' : '🖼️ صورة مرفقة',
        timestamp: Date.now(),
        status: 'sent'
      };
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => prev.map(m => {
        if (m.id === tempId || m.tempId === tempId) {
          const rank: Record<string, number> = { failed: 0, pending_offline: 1, sent: 2, delivered: 3, seen: 4, read: 5 };
          const keepStatus = (rank[m.status || 'sent'] || 0) > (rank[sent.status || 'sent'] || 0);
          return keepStatus ? { ...sent, status: m.status, uploadProgress: undefined } : { ...sent, uploadProgress: undefined };
        }
        return m;
      }));
      setTimeout(() => {
        try { URL.revokeObjectURL(rawPreviewUrl); } catch {}
      }, 1500);
      toast.success(mediaType === 'video' ? 'تم إرسال الفيديو بنجاح 🎬' : 'تم إرسال الصورة بنجاح 🖼️');
    } catch (err: any) {
      setMessages(prev => prev.map(m => (m.id === tempId || m.tempId === tempId) ? { ...m, status: 'failed', uploadProgress: undefined } : m));
      toast.error(err?.message || 'حدث خطأ أثناء رفع الوسائط.');
    } finally {
      setIsUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const handleRetryFailedMessage = async (failedMsg: Message) => {
    if (!activeContact) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.warning('لا يزال الاتصال منقطعاً — سيتم الإرسال عند توفر الإنترنت');
      return;
    }
    const retryTempId = failedMsg.tempId || failedMsg.id;
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sent' } : m))
    );
    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, {
        ...failedMsg,
        id: retryTempId,
        tempId: retryTempId,
        clientId: retryTempId,
        recipientName: activeContact.name,
        recipientAvatar: activeContact.avatar,
        recipientSessionId: getActivePeerSessionId(),
        status: 'sent'
      });
      setMessages((prev) => prev.map((m) => {
        if (m.id === failedMsg.id || m.id === retryTempId || m.tempId === retryTempId) {
          const rank: Record<string, number> = { failed: 0, pending_offline: 1, sent: 2, delivered: 3, seen: 4, read: 5 };
          const keepStatus = (rank[m.status || 'sent'] || 0) > (rank[sent.status || 'sent'] || 0);
          return keepStatus ? { ...sent, status: m.status } : sent;
        }
        return m;
      }));
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
      );
      toast.error('تعذر إعادة الإرسال، تأكد من الاتصال');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentUser.isBanned || (typeof currentUser.bannedUntil === 'number' && currentUser.bannedUntil > Date.now())) {
      toast.error('تم حظر حسابك من إرسال الرسائل 🚫');
      return;
    }
    if (!inputText.trim() || !activeContact) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    lastPrivateTypingEmitRef.current = 0;
    setPrivateTyping(currentUser.id, activeContact.id, currentUser.name, false, getActivePeerSessionId());

    const activeReply = replyingTo
      ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          content: replyingTo.content || replyingTo.text || (replyingTo.type === 'image' ? '🖼️ صورة' : 'رسالة'),
          type: replyingTo.type,
        }
      : undefined;

    sounds.playMessageSent();
    const content = inputText.trim();
    setInputText('');
    setReplyingTo(null);
    if (prefilledDraft) {
      onClearPrefilledDraft?.();
    }

    const tempId = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
      id: tempId,
      tempId,
      clientId: tempId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientId: activeContact.id,
      recipientName: activeContact.name,
      recipientAvatar: activeContact.avatar,
      recipientSessionId: getActivePeerSessionId(),
      type: 'private',
      content: content,
      text: content,
      replyTo: activeReply,
      createdAt: Date.now(),
      timestamp: Date.now(),
      status: 'sent'
    };

    const convId = getConversationId(currentUser.id, activeContact.id);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineMsg: Message = {
        ...(newMsg as Message),
        id: tempId,
        tempId,
        roomId: convId,
        status: 'pending_offline',
      };
      setMessages(prev => [...prev, offlineMsg]);
      offlineQueue.enqueue({
        id: tempId,
        targetType: 'dm',
        targetId: convId,
        recipientId: activeContact.id,
        recipientSessionId: getActivePeerSessionId(),
        message: offlineMsg,
        queuedAt: Date.now(),
      });
      toast.info('انقطع الاتصال — تم حفظ الرسالة وسيتم إرسالها تلقائياً عند العودة ⏳');
      return;
    }

    const optimisticMsg: Message = {
      ...(newMsg as Message),
      id: tempId,
      tempId,
      roomId: convId,
      status: 'sent',
    };
    isNearBottomRef.current = true;
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => prev.map(m => {
        if (m.id === tempId || m.tempId === tempId) {
          const rank: Record<string, number> = { failed: 0, pending_offline: 1, sent: 2, delivered: 3, seen: 4, read: 5 };
          const keepStatus = (rank[m.status || 'sent'] || 0) > (rank[sent.status || 'sent'] || 0);
          return keepStatus ? { ...sent, status: m.status } : sent;
        }
        return m;
      }));
    } catch (err) {
      console.warn('Direct message send failed:', err);
      toast.error('تعذر إرسال الرسالة — اضغط على 🌍❌ لإعادة المحاولة');
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const startVoiceRecording = async () => {
    if (!activeContact) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('المتصفح لا يدعم تسجيل الصوت المباشر');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      setIsRecordingVoice(true);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const totalDuration = Math.min(60, recordingSecondsRef.current || 2);
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size > 2 * 1024 * 1024) {
            toast.error('حجم التسجيل الصوتي يتجاوز الحد الأقصى (2 ميجابايت)');
            setIsRecordingVoice(false);
            setRecordingSeconds(0);
            recordingSecondsRef.current = 0;
            return;
          }
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await sendVoiceMessagePayload(base64Audio, totalDuration);
          };
          reader.readAsDataURL(audioBlob);
        }
        setIsRecordingVoice(false);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
      };

      mediaRecorder.start();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          if (next >= 60) {
            toast.info('وصل التسجيل للحد الأقصى (60 ثانية) وتم الإيقاف تلقائياً');
            stopVoiceRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.warn("Media recorder fallback:", err);
      handleSendVoiceFallback();
    }
  };

  const stopVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
  };

  const sendVoiceMessagePayload = async (audioDataUrl: string, durationSec: number) => {
    if (!activeContact) return;
    sounds.playMessageSent();
    const convId = getConversationId(currentUser.id, activeContact.id);
    const tempId = `dm_voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
      id: tempId,
      tempId,
      clientId: tempId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientId: activeContact.id,
      recipientName: activeContact.name,
      recipientAvatar: activeContact.avatar,
      recipientSessionId: getActivePeerSessionId(),
      type: 'voice',
      voiceUrl: audioDataUrl,
      audioDuration: durationSec,
      content: `تسجيل صوتي (${durationSec} ثانية) 🎙️`,
      text: `تسجيل صوتي (${durationSec} ثانية) 🎙️`,
      createdAt: now,
      timestamp: now,
      status: 'sent'
    };

    const optimisticMsg: Message = {
      ...(newMsg as Message),
      id: tempId,
      tempId,
      roomId: convId,
      status: 'sent'
    };
    isNearBottomRef.current = true;
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => prev.map(m => ((m.id === tempId || m.tempId === tempId) ? sent : m)));
    } catch (err) {
      console.warn("Direct voice send error:", err);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleSendVoiceFallback = async () => {
    if (!activeContact) return;
    sounds.playMessageSent();
    const convId = getConversationId(currentUser.id, activeContact.id);
    const tempId = `dm_vfb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
      id: tempId,
      tempId,
      clientId: tempId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      recipientId: activeContact.id,
      recipientName: activeContact.name,
      recipientAvatar: activeContact.avatar,
      recipientSessionId: getActivePeerSessionId(),
      type: 'voice',
      content: 'رسالة صوتية خاصة 🎙️',
      text: 'رسالة صوتية خاصة 🎙️',
      audioDuration: 4,
      createdAt: now,
      timestamp: now,
      status: 'sent'
    };

    const optimisticMsg: Message = {
      ...(newMsg as Message),
      id: tempId,
      tempId,
      roomId: convId,
      status: 'sent'
    };
    isNearBottomRef.current = true;
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => prev.map(m => ((m.id === tempId || m.tempId === tempId) ? sent : m)));
    } catch {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleSelectFriendForChat = (friend: Friend) => {
    const fId = friend.friendId || friend.id;
    onMarkSenderRead?.(fId);
    if (prefilledDraft) {
      setInputText(prefilledDraft);
    }
    setActiveContact({
      id: fId,
      name: friend.name,
      countryFlag: friend.countryFlag || '🇪🇬',
      avatar: friend.avatar || '',
      role: friend.vipBadge || friend.role || 'صديق',
      status: friend.isOnline ? 'online' : 'offline',
      lastMessage: 'محادثة خاصة مع الصديق...',
      lastMessageTime: 'الآن',
      unreadCount: 0
    });
  };

  const handleSelectOnlineUserForChat = (user: User) => {
    onMarkSenderRead?.(user.id);
    if (prefilledDraft) {
      setInputText(prefilledDraft);
    }
    setActiveContact({
      id: user.id,
      name: user.name,
      countryFlag: user.countryFlag || '🌍',
      avatar: user.avatar || '',
      role: user.vipBadge || user.role || 'عضو',
      status: 'online',
      lastMessage: 'محادثة خاصة...',
      lastMessageTime: 'الآن',
      unreadCount: 0
    });
  };

  return (
    <div className={isDrawer ? "h-full w-full max-w-full flex flex-col bg-white overflow-x-hidden overflow-y-hidden overscroll-none" : "w-full sm:px-3 max-w-4xl mx-auto h-full flex flex-col overflow-hidden overscroll-none"}>

      {/* If No Contact Selected: Show Inbox & Friends Navigation (Calm Sky-Blue Theme) */}
      {!activeContact ? (
        <div className={isDrawer ? "flex-1 flex flex-col overflow-hidden" : "space-y-3 flex-1 flex flex-col overflow-hidden pt-2 px-2.5 sm:px-0"}>
          
          {/* Header */}
          {isDrawer ? (
            <div className="p-3.5 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] bg-[#EAF5FD]/95 text-slate-900 border-b border-sky-200/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 text-[#1E96E8] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-slate-900 truncate">الرسائل الخاصة والأصدقاء</h2>
                  <p className="text-[10px] text-slate-600 flex items-center gap-1 truncate">
                    <Lock className="w-2.5 h-2.5 text-[#1E96E8] shrink-0" />
                    <span>مشفرة وآمنة بين الطرفين</span>
                  </p>
                </div>
              </div>
              {onCloseDrawer && (
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  className="p-1.5 rounded-full text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white transition shrink-0"
                  title="إغلاق القائمة الجانبية"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0 px-2.5 py-2 rounded-2xl bg-[#EAF5FD]/90 border border-sky-200/70">
              <h1 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2 min-w-0 truncate">
                <MessageCircle className="w-5 h-5 text-[#1E96E8] shrink-0" />
                <span className="truncate">الرسائل الخاصة والأصدقاء</span>
              </h1>
              <span className="text-[10.5px] sm:text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
                <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>مشفرة وآمنة</span>
              </span>
            </div>
          )}

          <div className={isDrawer ? "flex-1 flex flex-col overflow-hidden p-2.5 space-y-2.5" : "flex-1 flex flex-col overflow-hidden space-y-3"}>
          {/* Prefilled Forum Share Draft Banner */}
          {prefilledDraft && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-black text-amber-900 truncate">
                  📌 رسالة مشاركة المنشور جاهزة — اختر صديقاً أو عضواً لإرسالها
                </p>
              </div>
              {onClearPrefilledDraft && (
                <button
                  type="button"
                  onClick={onClearPrefilledDraft}
                  className="p-1 rounded-full text-amber-700 hover:bg-amber-200/60 shrink-0 cursor-pointer"
                  title="إلغاء المشاركة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Incoming Unread Messages Per-Sender Highlight Strip */}
          {unreadMessagesBySender.length > 0 && (
            <div className="rounded-xl bg-[#EAF5FD]/95 border border-sky-200 p-2 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-black text-[#1565C0] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>رسائل واردة جديدة ({unreadMessagesBySender.reduce((s, item) => s + item.count, 0)})</span>
                </span>
                {onClearAllUnreadMessages && (
                  <button
                    type="button"
                    onClick={onClearAllUnreadMessages}
                    className="text-[10px] font-bold text-[#1E96E8] hover:text-[#1565C0] flex items-center gap-0.5 cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>قراءة الكل</span>
                  </button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {unreadMessagesBySender.map((sender) => (
                  <button
                    key={sender.senderId}
                    type="button"
                    onClick={() => {
                      onMarkSenderRead?.(sender.senderId);
                      const peerOnline = globalOnlineUsers.some(u => u.id === sender.senderId);
                      setActiveContact({
                        id: sender.senderId,
                        name: sender.senderName,
                        countryFlag: '🇪🇬',
                        avatar: sender.senderAvatar,
                        role: 'عضو',
                        status: peerOnline ? 'online' : 'offline',
                        lastMessage: sender.lastMessage,
                        lastMessageTime: new Date(sender.lastTimestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                        unreadCount: 0
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 border border-sky-100 flex items-center justify-between gap-2 text-right transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <AvatarWithFrame
                        user={{ id: sender.senderId, name: sender.senderName, avatar: sender.senderAvatar }}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-black text-slate-900 truncate">{sender.senderName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{sender.lastMessage}</div>
                      </div>
                    </div>
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums">
                      {sender.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Tabs: Recent Chats / Friends List / Online Users */}
          <div className="grid grid-cols-3 p-1 bg-slate-100 border border-slate-200 rounded-2xl text-[11px] sm:text-xs font-bold shrink-0 shadow-xs gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('chats')}
              className={`py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'chats'
                  ? 'bg-[#1E96E8] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>المحادثات ({recentChats.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('friends')}
              className={`py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'friends'
                  ? 'bg-[#1E96E8] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>الأصدقاء ({friendsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('online')}
              className={`py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'online'
                  ? 'bg-[#1E96E8] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="sm:hidden">المتصلون ({globalOnlineUsers.filter(u => u.id !== currentUser.id).length})</span>
              <span className="hidden sm:inline">المتصلون الآن ({globalOnlineUsers.filter(u => u.id !== currentUser.id).length})</span>
            </button>
          </div>

          {/* Tab 1: Recent Active Direct Chats */}
          {activeTab === 'chats' && (
            <div className={`space-y-2 flex-1 overflow-y-auto overscroll-contain ${isDrawer ? 'pb-4' : 'pb-[calc(64px+env(safe-area-inset-bottom,0px))]'}`}>
              {recentChats.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-white border border-slate-200/90 space-y-3 mt-4 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-sky-50 border border-sky-200 text-[#1E96E8] flex items-center justify-center mx-auto text-2xl shadow-inner">
                    💬
                  </div>
                  <h4 className="text-sm font-black text-slate-900">لا توجد محادثات نشطة حالياً</h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                    ابدأ بالتحدث مع أصدقائك أو اختر أي عضو من تبويب <span className="text-[#1E96E8] font-bold">"الأصدقاء"</span> أو <span className="text-emerald-600 font-bold">"المتصلون الآن"</span> لبدء محادثة خاصة مشفرة!
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('online')}
                      className="px-4 py-2 rounded-xl bg-[#1E96E8] hover:bg-[#1982CC] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>تصفح المتصلين الآن</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('friends')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>قائمة الأصدقاء</span>
                    </button>
                  </div>
                </div>
              ) : (
                recentChats.map((chat) => {
                  const livePeer = globalOnlineUsers.find(u => u.id === chat.peerId);
                  const regPeer = allRegisteredUsers.find(u => u.id === chat.peerId);
                  const peerOnline = Boolean(livePeer && isUserTrulyOnline(livePeer));
                  const dbUnread = chat.lastSenderId !== currentUser.id ? (Number(chat.unreadCount) || 0) : 0;
                  const unreadCount = Math.max(unreadBySender[chat.peerId] || 0, dbUnread);
                  return (
                    <div
                      key={chat.chatId}
                      onClick={() => {
                        onMarkSenderRead?.(chat.peerId);
                        if (prefilledDraft) {
                          setInputText(prefilledDraft);
                        }
                        setActiveContact({
                          id: chat.peerId,
                          name: chat.peerName || 'عضو شات مصر',
                          countryFlag: chat.peerCountryFlag || '🌍',
                          avatar: chat.peerAvatar || '',
                          role: chat.peerRole || 'عضو',
                          status: peerOnline ? 'online' : 'offline',
                          lastMessage: chat.lastMessage || '',
                          lastMessageTime: chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'مؤخراً',
                          unreadCount: 0
                        });
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all hover:shadow-md shadow-xs ${
                        unreadCount > 0
                          ? 'bg-[#EAF5FD]/80 border-sky-300 hover:border-[#1E96E8]'
                          : 'bg-white border-slate-200/90 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarWithFrame
                          user={
                            livePeer || regPeer || {
                              id: chat.peerId,
                              name: chat.peerName || 'عضو شات مصر',
                              avatar: chat.peerAvatar || '',
                              role: (chat.peerRole as any) || 'member',
                              isOnline: peerOnline,
                              status: peerOnline ? 'online' : 'offline',
                            }
                          }
                          size="md"
                          showOnlineDot={peerOnline}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-900 truncate flex items-center gap-1">
                              <span className="truncate">{chat.peerName || 'عضو شات مصر'}</span>
                              <VerifiedBadge verified={globalOnlineUsers.find(u => u.id === chat.peerId)?.verified} size="xs" />
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[#1565C0] font-bold shrink-0">
                              محادثة مباشرة
                            </span>
                          </div>
                          {typingPeersMap[chat.peerId] ? (
                            <p className="text-xs truncate max-w-[190px] sm:max-w-xs mt-0.5 text-[#1E96E8] font-bold flex items-center gap-1.5">
                              <span>جاري الكتابة...</span>
                              <span className="inline-flex items-center gap-0.5 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </span>
                            </p>
                          ) : (
                            <p className={`text-xs truncate max-w-[190px] sm:max-w-xs mt-0.5 ${unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                              {chat.lastMessage || 'بدء المحادثة...'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left text-xs space-y-1 flex flex-col items-end shrink-0">
                        <span className="text-[10px] text-slate-500 block">
                          {chat.lastTimestamp ? new Date(chat.lastTimestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs tabular-nums">
                              {unreadCount}
                            </span>
                          )}
                          <span className="text-[10px] text-[#1E96E8] font-bold">فتح الدردشة ←</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Friends List (Connected to Firestore /users/{uid}/friends with onSnapshot) */}
          {activeTab === 'friends' && (
            <div className={`flex-1 overflow-y-auto overscroll-contain ${isDrawer ? 'pb-4' : 'pb-[calc(64px+env(safe-area-inset-bottom,0px))]'}`}>
              <FriendsList
                currentUser={currentUser}
                onStartPrivateChat={handleSelectFriendForChat}
              />
            </div>
          )}

          {/* Tab 3: Online Users Available to Message */}
          {activeTab === 'online' && (
            <div className={`space-y-2 flex-1 overflow-y-auto overscroll-contain ${isDrawer ? 'pb-4' : 'pb-[calc(64px+env(safe-area-inset-bottom,0px))]'}`}>
              {globalOnlineUsers.filter(u => u.id !== currentUser.id && isUserTrulyOnline(u)).length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                  <p className="text-xs text-slate-600">لا يوجد متصلون آخرون في هذه اللحظة.</p>
                </div>
              ) : (
                globalOnlineUsers
                  .filter(u => u.id !== currentUser.id && isUserTrulyOnline(u))
                  .map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectOnlineUserForChat(user)}
                      className="p-3 rounded-2xl bg-white border border-slate-200/90 hover:border-sky-300 flex items-center justify-between cursor-pointer transition-all hover:shadow-md shadow-xs"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOnlineUserForChat(user);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#1E96E8] hover:bg-[#1982CC] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>محادثة</span>
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-sm font-black text-slate-900 flex items-center gap-1">
                              <span>{user.name}</span>
                              <VerifiedBadge verified={user.verified} size="xs" />
                            </span>
                            <span>{user.countryFlag || '🌍'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-500">
                            {(() => {
                              const rMeta = getRankDisplayMeta(user.role, user.vipBadge);
                              return rMeta.isPrivileged ? (
                                <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black ${rMeta.badgeClass}`}>
                                  {rMeta.label}
                                </span>
                              ) : null;
                            })()}
                            {typingPeersMap[user.id] ? (
                              <span className="text-amber-600 font-bold flex items-center gap-1">
                                <span>جاري الكتابة...</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                متصل الآن
                              </span>
                            )}
                          </div>
                        </div>

                        <AvatarWithFrame user={user} size="md" showOnlineDot />
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          </div>
        </div>
      ) : (
        /* If Contact Selected: Full-bleed edge-to-edge 1-on-1 Chat on Mobile + Natural/Custom Wallpaper Support */
        <div 
          style={getWallpaperStyleById(currentUser.chatWallpaper || 'wp_white_gold_doodle')}
          className={isDrawer
            ? "h-full w-full max-w-full flex flex-col bg-[#F3F9FE] overflow-x-hidden overflow-y-hidden overscroll-none"
            : "fixed inset-x-0 top-0 z-[60] w-screen max-w-full h-[var(--app-height,100dvh)] sm:relative sm:inset-auto sm:z-auto sm:w-full sm:h-full flex flex-col bg-[#F3F9FE] border-0 sm:border border-sky-200/80 rounded-none sm:rounded-3xl overflow-x-hidden overflow-y-hidden overscroll-none shadow-2xl"
          }
        >
          {/* Hidden Media File Input (Images & Videos) */}
          <input
            ref={mediaFileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaFileSelected}
            className="hidden"
          />

          {/* 1. Simplified 3-Zone Header: Back+User | Audio & Video Call | Actions Dropdown */}
          {(() => {
            const liveOnlinePeer = globalOnlineUsers.find(u => u.id === activeContact.id);
            const registeredPeer = allRegisteredUsers.find(u => u.id === activeContact.id);
            const isPeerTrulyOnline = Boolean(liveOnlinePeer && isUserTrulyOnline(liveOnlinePeer));
            const effectiveLastSeen = liveOnlinePeer?.lastSeen ?? registeredPeer?.lastSeen;
            const resolvedPeerUser: User = liveOnlinePeer
              ? { ...liveOnlinePeer, isOnline: isPeerTrulyOnline, lastSeen: effectiveLastSeen }
              : registeredPeer
              ? { ...registeredPeer, isOnline: false, status: 'offline', lastSeen: effectiveLastSeen }
              : {
                  id: activeContact.id,
                  name: activeContact.name,
                  username: activeContact.name.toLowerCase().replace(/\s+/g, '_'),
                  avatar: activeContact.avatar,
                  bio: 'عضو في شات مصر',
                  country: 'مصر',
                  countryFlag: activeContact.countryFlag || '🇪🇬',
                  role: 'member',
                  coins: 0,
                  earningsEgp: 0,
                  earningsUsd: 0,
                  vipBadge: '',
                  frameStyle: 'border-slate-300',
                  profileWallpaper: '',
                  fontPreference: 'cairo',
                  isOnline: false,
                  status: 'offline',
                  lastSeen: effectiveLastSeen,
                  joinedAt: '',
                  gender: 'male',
                  level: 1,
                  likesReceived: 0,
                  giftsReceivedCount: 0,
                };

            return (
              <div className="relative z-20 w-full px-2.5 sm:px-3.5 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:py-2.5 bg-[#EAF5FD]/95 backdrop-blur-md border-b border-sky-200/80 shadow-xs flex items-center justify-between gap-2 shrink-0">
                {/* Zone 1: Back + Peer Avatar & Status */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveContact(null);
                      if (onClearTargetUser) onClearTargetUser();
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center shrink-0 active:scale-95 border border-sky-200/80 transition cursor-pointer"
                    title="الرجوع إلى القائمة"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenUserProfile?.(resolvedPeerUser)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer group"
                    title="عرض الملف الشخصي"
                  >
                    <AvatarWithFrame
                      user={resolvedPeerUser}
                      size="sm"
                      showOnlineDot={isPeerTrulyOnline}
                    />

                    <div className="min-w-0 flex-1 text-right">
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1 min-w-0 group-hover:text-[#1E96E8] transition-colors">
                        <span className="truncate">{activeContact.name}</span>
                        <VerifiedBadge verified={resolvedPeerUser.verified} size="xs" />
                        <span className="shrink-0">{activeContact.countryFlag}</span>
                      </h3>
                      {isPeerTyping ? (
                        <span className="text-[10px] sm:text-[11px] text-[#1E96E8] font-bold flex items-center gap-1.5 truncate">
                          <span>جاري الكتابة...</span>
                          <span className="flex items-center gap-0.5 shrink-0">
                            <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </span>
                      ) : isPeerTrulyOnline ? (
                        <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-bold flex items-center gap-1 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="truncate">متصل الآن • خاص مشفر</span>
                        </span>
                      ) : (
                        <span className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium block truncate">
                          {formatLastSeenArabic(effectiveLastSeen)} • خاص مشفر
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Zone 2 & 3: Audio Call + Direct Video Call + Actions Menu Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0" ref={actionsMenuRef}>
                  <button 
                    type="button"
                    onClick={() => handleRequestCall('audio')}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/85 hover:bg-white text-[#1E96E8] border border-sky-200/80 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
                    title="بدء مكالمة صوتية"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleRequestCall('video')}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E96E8] hover:bg-[#1982CC] text-white border border-[#1E96E8] flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer shadow-xs"
                    title="بدء مكالمة فيديو"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsActionsMenuOpen(prev => !prev)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/85 hover:bg-white text-slate-700 border border-sky-200/80 flex items-center justify-center active:scale-95 transition cursor-pointer"
                      title="المزيد من الخيارات"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {isActionsMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          className="origin-top-left absolute left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 z-[100] text-right"
                        >
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsGiftModalOpen(true);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Gift className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>إرسال هدية فاخرة 🎁</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsCoinsTransferOpen(true);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-amber-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>تحويل كوينز 🪙</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsWallpapersModalOpen(true);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-sky-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Palette className="w-4 h-4 text-[#1E96E8] shrink-0" />
                          <span>تخصيص الخلفية 🎨</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsMessageSearchOpen(prev => !prev);
                            setMessageSearchQuery('');
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-sky-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Search className="w-4 h-4 text-[#1E96E8] shrink-0" />
                          <span>بحث في الرسائل 🔍</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onOpenUserProfile?.(resolvedPeerUser);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-slate-600 shrink-0" />
                          <span>عرض الملف الشخصي 👤</span>
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={async () => {
                            setIsActionsMenuOpen(false);
                            const res = await submitUserReport({
                              reporterId: currentUser.id,
                              reporterName: currentUser.name,
                              reportedUserId: activeContact.id,
                              reportedUserName: activeContact.name,
                              reason: 'إبلاغ من المحادثة الخاصة',
                              contextType: 'dm',
                              contextId: getConversationId(currentUser.id, activeContact.id),
                              timestamp: Date.now(),
                              createdAt: Date.now(),
                            });
                            toast.success(
                              res.autoMuted
                                ? 'تم إرسال البلاغ وتطبيق إجراء الكتم الوقائي تلقائياً 🛡️'
                                : 'تم إرسال البلاغ للإدارة للمراجعة الفورية ✅'
                            );
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Flag className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>إبلاغ عن إساءة 🚩</span>
                        </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Toggleable Message Search Strip */}
          {isMessageSearchOpen && (
            <div className="px-3 py-2 bg-[#EAF5FD]/95 border-b border-sky-200 flex items-center gap-2 shrink-0 animate-in slide-in-from-top-1">
              <Search className="w-4 h-4 text-[#1E96E8] shrink-0" />
              <input
                type="text"
                value={messageSearchQuery}
                onChange={(e) => setMessageSearchQuery(e.target.value)}
                placeholder="ابحث داخل هذه المحادثة..."
                autoFocus
                className="flex-1 bg-white border border-sky-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1E96E8]"
              />
              <button
                type="button"
                onClick={() => {
                  setIsMessageSearchOpen(false);
                  setMessageSearchQuery('');
                }}
                className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 space-y-2.5"
          >
            {hasMoreOlderDm && (
              <div className="flex justify-center py-1">
                <button
                  type="button"
                  onClick={triggerLoadOlderDm}
                  disabled={isLoadingOlderDm}
                  className="px-3 py-1 rounded-full bg-white/90 hover:bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-60"
                >
                  {isLoadingOlderDm ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري تحميل رسائل أقدم...</span>
                    </>
                  ) : (
                    <span>تحميل رسائل أقدم ↑</span>
                  )}
                </button>
              </div>
            )}
            {(() => {
              const filteredMessages = messageSearchQuery.trim()
                ? messages.filter(m =>
                    (m.content || m.text || '').toLowerCase().includes(messageSearchQuery.trim().toLowerCase()) ||
                    (m.senderName || '').toLowerCase().includes(messageSearchQuery.trim().toLowerCase())
                  )
                : messages;

              if (filteredMessages.length === 0) {
                return (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2.5">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-amber-300 flex items-center justify-center text-2xl shadow-md">
                  💬
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 bg-white/85 px-3 py-1 rounded-full border border-slate-200">
                  {messageSearchQuery.trim() ? 'لا توجد رسائل مطابقة للبحث' : 'محادثة خاصة جديدة ومشفرة'}
                </h4>
                <p className="text-[11px] text-slate-600 max-w-xs leading-relaxed bg-white/85 px-3 py-2 rounded-2xl border border-slate-200/80 shadow-xs">
                  {messageSearchQuery.trim()
                    ? 'جرّب كلمة مفتاحية أخرى.'
                    : (<>أهلاً بك! محادثتك مع <span className="text-slate-900 font-black">{activeContact.name}</span> مشفرة بالكامل بين الطرفين. أرسل رسالة للبدء! 👋</>)}
                </p>
              </div>
                );
              }

              return filteredMessages.map((msg, idx) => {
                const isMe = msg.senderId === currentUser.id;

                // Virtual Gift Message Rendering in Private Chat (Modern Light Card)
                if (msg.type === 'gift' && msg.gift) {
                  return (
                    <div key={`${msg.id || 'pm_gift'}_${idx}`} className="flex justify-center my-2">
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-white to-rose-50 border-2 border-amber-300 p-3 max-w-[90%] sm:max-w-sm w-full shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-3xl shadow-inner shrink-0 animate-bounce">
                            {msg.gift.icon}
                          </div>
                          <div className="flex-1 text-right min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  sounds.playGiftFanfare();
                                  confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
                                }}
                                className="px-1.5 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-[9.5px] font-black flex items-center gap-1 active:scale-95"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                <span>مؤثرات ✨</span>
                              </button>
                              <span className="text-[10px] font-black text-amber-700 flex items-center gap-1 truncate">
                                <span>هدية فاخرة: {msg.gift.name}</span>
                                <Crown className="w-3 h-3 text-amber-500" />
                              </span>
                            </div>
                            <p className="text-xs text-slate-900 font-bold leading-tight">
                              <span className="text-indigo-700">{isMe ? 'أنت' : msg.senderName}</span>
                              <span className="text-slate-600 mx-1">أهديت</span>
                              <span className="text-rose-600">{msg.gift.name}</span>
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-amber-700 font-bold">
                              <span>🪙 {msg.gift.cost.toLocaleString()} كوينز</span>
                              <span>•</span>
                              <span className="text-slate-500 font-normal">
                                {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isSwipingThis = swipeState?.msgId === msg.id;
                const dragOffset = isSwipingThis ? swipeState.offsetX : 0;

                return (
                  <motion.div
                    key={`${msg.id || 'pm'}_${idx}`}
                    ref={(el) => {
                      if (msg.id) messageRefs.current[msg.id] = el;
                    }}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`relative flex items-center ${isMe ? 'justify-start' : 'justify-end'} ${
                      highlightedMsgId === msg.id ? 'bg-amber-200/45 rounded-2xl ring-2 ring-amber-400 p-1 transition-all' : ''
                    }`}
                  >
                    {dragOffset > 12 && (
                      <div
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md pointer-events-none z-10 transition-transform"
                        style={{
                          opacity: Math.min(1, dragOffset / 44),
                          transform: `translateY(-50%) scale(${Math.min(1.08, 0.7 + dragOffset / 90)})`,
                        }}
                      >
                        <Reply className="w-4 h-4" />
                      </div>
                    )}

                  <div 
                    style={
                      dragOffset > 0
                        ? { transform: `translateX(${dragOffset}px)`, transition: 'none' }
                        : { transform: 'translateX(0px)', transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)' }
                    }
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      swipeStartRef.current = { msgId: msg.id, startX: e.clientX, startY: e.clientY };
                      swipeMovedRef.current = false;
                      longPressTimerRef.current = setTimeout(() => {
                        if (!swipeMovedRef.current) {
                          setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                        }
                      }, 700);
                    }}
                    onMouseMove={(e) => {
                      const st = swipeStartRef.current;
                      if (!st || st.msgId !== msg.id) return;
                      const dx = e.clientX - st.startX;
                      const dy = Math.abs(e.clientY - st.startY);
                      if (Math.abs(dx) > 10 || dy > 10) {
                        swipeMovedRef.current = true;
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      }
                      if (dx > 8 && Math.abs(dx) > dy) {
                        setSwipeState({ msgId: msg.id, offsetX: Math.min(72, dx) });
                      }
                    }}
                    onMouseUp={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      if (swipeStartRef.current?.msgId === msg.id) {
                        if (swipeState?.msgId === msg.id && swipeState.offsetX >= 48) {
                          triggerReplyTo(msg);
                        }
                        swipeStartRef.current = null;
                        setSwipeState(null);
                      }
                    }}
                    onMouseLeave={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      if (swipeStartRef.current?.msgId === msg.id) {
                        swipeStartRef.current = null;
                        setSwipeState(null);
                      }
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      swipeStartRef.current = { msgId: msg.id, startX: touch.clientX, startY: touch.clientY };
                      swipeMovedRef.current = false;
                      longPressTimerRef.current = setTimeout(() => {
                        if (!swipeMovedRef.current) {
                          if (navigator.vibrate) navigator.vibrate(50);
                          setActiveContextMenu({ msg, x: touch.clientX, y: touch.clientY });
                        }
                      }, 700);
                    }}
                    onTouchMove={(e) => {
                      const st = swipeStartRef.current;
                      if (!st || st.msgId !== msg.id) return;
                      const touch = e.touches[0];
                      const dx = touch.clientX - st.startX;
                      const dy = Math.abs(touch.clientY - st.startY);
                      if (Math.abs(dx) > 8 || dy > 8) {
                        swipeMovedRef.current = true;
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      }
                      if (dx > 6 && Math.abs(dx) > dy) {
                        setSwipeState({ msgId: msg.id, offsetX: Math.min(72, dx) });
                      } else if (swipeState?.msgId === msg.id && dx <= 0) {
                        setSwipeState(null);
                      }
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      if (swipeState?.msgId === msg.id && swipeState.offsetX >= 48) {
                        triggerReplyTo(msg);
                      }
                      swipeStartRef.current = null;
                      setSwipeState(null);
                    }}
                    onTouchCancel={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      swipeStartRef.current = null;
                      setSwipeState(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                    }}
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm space-y-1 cursor-pointer select-text transition-transform active:scale-[0.99] ${
                    msg.type === 'sticker'
                      ? 'bg-white/95 backdrop-blur-md text-slate-900 border border-sky-200/80 shadow-xs'
                      : isMe
                      ? 'bg-gradient-to-l from-[#1E96E8] to-[#2196F3] text-white border border-sky-400/30 rounded-tr-none shadow-sm'
                      : 'bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-900 dark:text-slate-100 border border-sky-100 dark:border-slate-700 rounded-tl-none shadow-xs'
                  }`}
                    title="اسحب يميناً للرد السريع أو اضغط مطولاً للخيارات"
                  >
                    {msg.replyTo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToMessage(msg.replyTo?.id);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border-r-2 text-[11px] cursor-pointer mb-1 ${
                          isMe
                            ? 'bg-white/15 border-white/80 text-white/95 hover:bg-white/25'
                            : 'bg-[#EAF5FD]/90 border-[#1E96E8] text-slate-700 hover:bg-sky-100/70'
                        }`}
                        title="اضغط للانتقال إلى الرسالة الأصلية"
                      >
                        <div className={`font-black text-[10px] ${isMe ? 'text-sky-100' : 'text-[#1565C0]'}`}>
                          رد على {msg.replyTo.senderName}
                        </div>
                        <div className="truncate opacity-90">{msg.replyTo.content || msg.replyTo.text}</div>
                      </div>
                    )}
                    {msg.type === 'sticker' ? (
                      <p className="leading-relaxed whitespace-pre-wrap font-medium text-slate-900">
                        <InlineRichText text={msg.stickerEmoji || msg.content || '✨'} />
                        {msg.stickerLabel ? ` ${msg.stickerLabel}` : ''}
                      </p>
                    ) : msg.type === 'image' && (msg.mediaUrl || msg.imageUrl) ? (
                      <div className="space-y-1.5">
                        <BlurredChatImage
                          src={msg.mediaUrl || msg.imageUrl || ''}
                          alt="صورة مرسلة"
                          autoReveal={false}
                          uploadProgress={msg.uploadProgress}
                          downloadFilename={`dm_${msg.id || Date.now()}.jpg`}
                          onOpenFull={(url) => setLightboxImageUrl(url)}
                          className="max-h-60 w-full object-cover rounded-xl border border-white/25"
                        />
                      </div>
                    ) : msg.type === 'video' && msg.mediaUrl ? (
                      <div className="space-y-1">
                        <video
                          src={msg.mediaUrl}
                          controls
                          playsInline
                          className="max-h-64 w-full rounded-xl bg-black border border-white/20"
                        />
                      </div>
                    ) : msg.type === 'coins_transfer' ? (
                      <div className={`flex items-center gap-2.5 p-2 rounded-xl border font-bold text-xs ${
                        isMe
                          ? 'bg-white/15 border-white/25 text-white'
                          : 'bg-amber-500/15 border-amber-400/50 text-amber-900'
                      }`}>
                        <span className="text-2xl shrink-0">💰</span>
                        <div className="text-right">
                          <div className={`font-black text-xs ${isMe ? 'text-amber-200' : 'text-amber-800'}`}>تحويل كوينز ناجح 🪙</div>
                          <div className={`text-[11px] leading-snug ${isMe ? 'text-white/90' : 'text-amber-700'}`}>{msg.content || msg.text}</div>
                        </div>
                      </div>
                    ) : msg.type === 'voice' ? (
                      <div className="flex items-center gap-2 py-0.5">
                        <button
                          onClick={() => {
                            if (playingVoiceId === msg.id) {
                              if (activeAudioRef.current) {
                                activeAudioRef.current.pause();
                                activeAudioRef.current = null;
                              }
                              setPlayingVoiceId(null);
                            } else {
                              if (activeAudioRef.current) {
                                activeAudioRef.current.pause();
                              }
                              setPlayingVoiceId(msg.id);
                              if (msg.voiceUrl) {
                                try {
                                  const audio = new Audio(msg.voiceUrl);
                                  activeAudioRef.current = audio;
                                  audio.onended = () => setPlayingVoiceId(null);
                                  audio.play().catch(() => {
                                    setTimeout(() => setPlayingVoiceId(null), (msg.audioDuration || 4) * 1000);
                                  });
                                } catch {
                                  setTimeout(() => setPlayingVoiceId(null), (msg.audioDuration || 4) * 1000);
                                }
                              } else {
                                setTimeout(() => setPlayingVoiceId(null), (msg.audioDuration || 4) * 1000);
                              }
                            }
                          }}
                          className={`p-1.5 rounded-full ${isMe ? 'bg-white text-[#1E96E8]' : 'bg-[#1E96E8] text-white'}`}
                        >
                          {playingVoiceId === msg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                        <span className={`text-[11px] font-bold ${isMe ? 'text-white' : 'text-slate-800'}`}>
                          تسجيل صوتي ({msg.audioDuration ? `0:${msg.audioDuration.toString().padStart(2, '0')}` : '0:05'})
                        </span>
                      </div>
                    ) : (
                      <p className={`leading-relaxed whitespace-pre-wrap font-medium ${isMe ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                        <InlineRichText text={msg.content || msg.text || ''} />
                      </p>
                    )}

                    <div className={`flex items-center justify-end gap-1 text-[10px] ${
                      isMe && msg.type !== 'sticker' ? 'text-white/85' : 'text-slate-500'
                    }`}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <MessageStatusIcon
                          status={msg.status}
                          variant={msg.type === 'sticker' ? 'dm-sticker' : 'dm-sent'}
                          onRetry={
                            (msg.status === 'failed' || msg.status === 'pending_offline')
                              ? () => handleRetryFailedMessage(msg)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            });
            })()}
            
            {/* Live Peer Typing Indicator Bubble (Left / Receiver side in RTL) */}
            <AnimatePresence>
              {isPeerTyping && (
                <motion.div
                  key="private-peer-typing-bubble"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex items-center gap-2 justify-end my-1.5"
                >
                  <div className="bg-white/95 backdrop-blur-md border border-sky-200 rounded-2xl rounded-tl-none px-3.5 py-2 flex items-center gap-2 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E96E8] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {activeContact.name}: جاري الكتابة...
                    </span>
                  </div>
                  <div className="relative w-7 h-7 rounded-full overflow-hidden border border-[#1E96E8]/50 shrink-0 shadow-xs">
                    <img src={activeContact.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#1E96E8] animate-ping"></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Media Upload Progress Strip */}
          {isUploadingMedia && (
            <div className="w-full px-3 py-1.5 bg-[#EAF5FD] border-t border-sky-200 flex items-center gap-2 text-xs text-[#1565C0] font-bold shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E96E8] shrink-0" />
              <span className="shrink-0">جاري رفع الوسائط... {uploadProgress}%</span>
              <div className="flex-1 h-1.5 bg-sky-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1E96E8] transition-all" style={{ width: `${Math.max(8, uploadProgress)}%` }} />
              </div>
            </div>
          )}

          {/* Reply Preview Bar above Composer */}
          {replyingTo && (
            <div className="w-full px-3 py-1.5 bg-[#EAF5FD]/95 border-t border-sky-200 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 border-r-2 border-[#1E96E8] pr-2">
                <Reply className="w-3.5 h-3.5 text-[#1E96E8] shrink-0" />
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[10.5px] font-black text-[#1565C0] truncate">
                    الرد على {replyingTo.senderName}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {replyingTo.content || replyingTo.text || (replyingTo.type === 'image' ? '🖼️ صورة مرفقة' : 'رسالة')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-sky-100 shrink-0 cursor-pointer"
                title="إلغاء الرد"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom Chat Bar: Full-Width Mobile + Emoji/Sticker Drawer + Media Picker */}
          <div ref={emojiStickerPanelRef} className="relative w-full p-2 sm:p-3 bg-white/98 backdrop-blur-md border-t border-slate-200/90 flex items-center gap-1 sm:gap-2 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] sm:pb-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {/* Compact Circular Telegram/WhatsApp-Style Emoji & Animated Emoji Picker */}
            {isEmojiStickerOpen && (
              <div className="absolute bottom-full left-2 right-2 sm:left-auto sm:right-3 mb-2 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 z-[100] space-y-2 animate-in slide-in-from-bottom-2">
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-black">
                  <button
                    type="button"
                    onClick={() => setEmojiStickerTab('emojis')}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                      emojiStickerTab === 'emojis' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>إيموجي 😊</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmojiStickerTab('animated')}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                      emojiStickerTab === 'animated' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sticker className="w-3.5 h-3.5" />
                    <span>إيموجي متحركة ✨</span>
                  </button>
                </div>

                {emojiStickerTab === 'emojis' ? (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-0.5">
                    {CURATED_EMOJIS.map((group) => (
                      <div key={group.label} className="space-y-1">
                        <span className="text-[10px] font-black text-slate-500 block">{group.label}</span>
                        <div className="grid grid-cols-8 gap-1">
                          {group.emojis.map((em, i) => (
                            <button
                              key={`${group.label}_${i}`}
                              type="button"
                              onClick={() => handleInsertEmojiAtCursor(em)}
                              className="w-8 h-8 rounded-full hover:bg-indigo-50 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-0.5">
                    <span className="text-[10px] font-black text-slate-500 block">
                      اضغط لإدراج إيموجي متحرك داخل رسالتك بنفس حجم النص:
                    </span>
                    <div className="grid grid-cols-8 gap-1.5">
                      {ANIMATED_INLINE_EMOJIS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleInsertEmojiAtCursor(item.emoji)}
                          title={item.label}
                          className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-50 border border-slate-200/80 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                        >
                          <span className={`inline-block leading-none ${item.animClass}`}>
                            {item.emoji}
                          </span>
                        </button>
                      ))}
                      {STICKERS_CATALOG.map((stk) => (
                        <button
                          key={stk.id}
                          type="button"
                          onClick={() => handleInsertEmojiAtCursor(stk.emoji)}
                          title={stk.label}
                          className="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                        >
                          <span className={`inline-block leading-none ${stk.animationClass || ''}`}>
                            {stk.emoji}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isRecordingVoice ? (
              <div className="flex-1 flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-2xl px-3 py-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                  <div className="flex items-center gap-0.5 h-4">
                    <span className="w-0.5 h-2 rounded-full bg-red-500 animate-soundwave-1" />
                    <span className="w-0.5 h-4 rounded-full bg-red-500 animate-soundwave-2" />
                    <span className="w-0.5 h-2.5 rounded-full bg-red-500 animate-soundwave-3" />
                    <span className="w-0.5 h-3.5 rounded-full bg-red-500 animate-soundwave-4" />
                  </div>
                  <span className="text-xs font-bold text-red-700">تسجيل صوتي:</span>
                  <span className="text-xs font-black text-red-800 font-mono">
                    00:{recordingSeconds.toString().padStart(2, '0')} / 01:00
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Cancel Recording */}
                  <button
                    type="button"
                    onClick={cancelVoiceRecording}
                    className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition"
                    title="إلغاء التسجيل"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Stop & Send Recording */}
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1 shadow-md transition"
                    title="إيقاف وإرسال التسجيل"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Media Sharing Button (Unrestricted Image / Video) */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeContact) return;
                    mediaFileInputRef.current?.click();
                  }}
                  disabled={isUploadingMedia}
                  className="p-2 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#1E96E8] min-h-[42px] min-w-[40px] flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
                  title="إرسال صورة أو فيديو"
                >
                  {isUploadingMedia ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>

                {/* Emoji & Stickers Picker Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEmojiStickerOpen(prev => !prev)}
                  className={`p-2 rounded-2xl border min-h-[42px] min-w-[40px] flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0 ${
                    isEmojiStickerOpen
                      ? 'bg-sky-100 border-[#1E96E8] text-[#1565C0]'
                      : 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-600 hover:text-[#1E96E8]'
                  }`}
                  title="الرموز التعبيرية والملصقات"
                >
                  <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Message Composer (No <form>/<input> so Android Chrome hides the black autofill bar) */}
                <div className="flex-1 min-w-0 flex items-center">
                  <textarea
                    ref={chatInputRef}
                    rows={1}
                    name="dm_composer_text"
                    id="dm_composer_text"
                    inputMode="text"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-autocomplete="none"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => {
                      if (isNearBottomRef.current) {
                        setTimeout(() => {
                          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                        }, 140);
                      }
                    }}
                    onBlur={stopPrivateTypingNow}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="اكتب رسالة خاصة هنا..."
                    className="w-full min-w-0 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-[#1E96E8] rounded-2xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none min-h-[42px] max-h-24 leading-[1.45] resize-none overflow-y-auto transition-all shadow-inner"
                  />
                </div>

                {/* Single Dynamic Mic ↔ Send Button */}
                {inputText.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-[#1E96E8] to-[#2196F3] hover:brightness-105 text-white font-black shadow-md shadow-sky-500/25 active:scale-95 min-h-[42px] min-w-[42px] flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title="إرسال الرسالة"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-[#1E96E8] border border-sky-200 active:scale-95 min-h-[42px] min-w-[42px] flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
                    title="بدء تسجيل صوتي"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Floating Message Action Context Menu (Modern Light Theme) */}
          {activeContextMenu && (
            <div 
              className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in"
              onClick={() => setActiveContextMenu(null)}
            >
              <div 
                className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xl space-y-2 text-right animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-black text-slate-800">خيارات الرسالة</span>
                  <button onClick={() => setActiveContextMenu(null)} className="text-slate-400 hover:text-slate-800 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Reply Option */}
                <button
                  type="button"
                  onClick={() => {
                    const targetMsg = activeContextMenu.msg;
                    setActiveContextMenu(null);
                    triggerReplyTo(targetMsg);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-2 transition min-h-[40px]"
                >
                  <Reply className="w-4 h-4 text-indigo-600" />
                  <span>رد على هذه الرسالة</span>
                </button>

                {/* Copy Text Option */}
                {activeContextMenu.msg.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeContextMenu.msg.content);
                      setActiveContextMenu(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition min-h-[40px]"
                  >
                    <Copy className="w-4 h-4 text-indigo-600" />
                    <span>نسخ نص الرسالة</span>
                  </button>
                )}

                {/* Delete Message Option */}
                {(activeContextMenu.msg.senderId === currentUser.id) && (
                  <button
                    onClick={() => handleDeleteMessage(activeContextMenu.msg.id)}
                    className="w-full px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 transition min-h-[40px]"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>حذف الرسالة نهائياً (للطرفين) 🗑️</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveContextMenu(null)}
                  className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Luxury Gift Modal for Direct Chat Contact */}
          <LuxuryGiftModal
            isOpen={isGiftModalOpen}
            onClose={() => setIsGiftModalOpen(false)}
            currentUser={currentUser}
            speakers={[
              {
                seatId: 1,
                user: {
                  id: activeContact.id,
                  name: activeContact.name,
                  avatar: activeContact.avatar,
                  role: 'member',
                  coins: 0,
                  earningsEgp: 0,
                  earningsUsd: 0,
                  vipBadge: '',
                  frameStyle: '',
                  profileWallpaper: '',
                  fontPreference: 'cairo',
                  isOnline: activeContact.status === 'online',
                  status: activeContact.status,
                  joinedAt: '',
                  gender: 'male',
                  level: 1,
                  likesReceived: 0,
                  giftsReceivedCount: 0,
                  username: activeContact.id,
                  bio: '',
                  country: '',
                  countryFlag: activeContact.countryFlag
                },
                isMuted: false,
                isTalking: false,
                isVideo: false
              }
            ]}
            onSendGift={handleSendDirectGift}
            onOpenWallet={onOpenWallet}
          />

        </div>
      )}

      {/* Live Audio and Video Call Modal (Strictly registered users only) */}
      {activeContact && (
        <CallModal
          isOpen={callModalState.isOpen}
          onClose={() => setCallModalState({ isOpen: false, callType: 'audio' })}
          currentUser={currentUser}
          peerUser={{
            id: activeContact.id,
            name: activeContact.name,
            avatar: activeContact.avatar,
            countryFlag: activeContact.countryFlag,
            role: activeContact.role
          }}
          callType={callModalState.callType}
          onPromptRegister={onPromptRegister}
        />
      )}

      {/* Coins Transfer Modal */}
      {activeContact && (
        <CoinsTransferModal
          isOpen={isCoinsTransferOpen}
          onClose={() => setIsCoinsTransferOpen(false)}
          currentUser={currentUser}
          recipientUser={{
            id: activeContact.id,
            name: activeContact.name,
            avatar: activeContact.avatar,
            countryFlag: activeContact.countryFlag
          }}
          onSuccess={(amount, newBalance) => {
            if (onUpdateUser) {
              onUpdateUser({ ...currentUser, coins: newBalance });
            }
            toast.coins(`تم تحويل ${amount.toLocaleString()} كوينز إلى ${activeContact.name} بنجاح! 🪙`);
            sendDirectMessage(currentUser.id, activeContact.id, {
              senderId: currentUser.id,
              senderName: currentUser.name,
              senderAvatar: currentUser.avatar,
              senderRole: currentUser.role,
              senderVipBadge: currentUser.vipBadge,
              recipientId: activeContact.id,
              recipientName: activeContact.name,
              recipientAvatar: activeContact.avatar,
              recipientSessionId: getActivePeerSessionId(),
              type: 'coins_transfer',
              content: `تم تحويل ${amount.toLocaleString()} كوينز من ${currentUser.name} إلى ${activeContact.name} بنجاح! 🪙`,
              timestamp: Date.now(),
              status: 'sent'
            });
          }}
        />
      )}

      {/* Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await downloadImageToDevice(lightboxImageUrl, `chat_photo_${Date.now()}.jpg`);
                  toast.success('تم حفظ الصورة على جهازك 📥');
                } catch {
                  toast.error('تعذر تحميل الصورة');
                }
              }}
              aria-label="تحميل الصورة"
              title="حفظ الصورة على الجهاز"
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              aria-label="إغلاق"
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImageUrl}
            alt="معاينة الصورة"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

      {/* Direct Call & Media modals ready */}

      {/* Natural & Custom Chat Wallpapers Modal */}
      <ChatWallpapersModal
        isOpen={isWallpapersModalOpen}
        onClose={() => setIsWallpapersModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={onUpdateUser}
        onOpenWallet={onOpenWallet}
      />

    </div>
  );
};
