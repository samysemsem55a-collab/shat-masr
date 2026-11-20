import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  MessageCircle, 
  Search, 
  Send, 
  Mic, 
  ArrowRight, 
  ArrowUp,
  Check, 
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
  Languages,
  WifiOff,
  Reply
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, Message, Friend, GiftItem, UnreadSenderSummary } from '../types/chat';
import { sounds } from '../utils/soundEffects';
import { 
  subscribeToDirectMessages, 
  sendDirectMessage, 
  deleteDirectMessage,
  subscribeToFriendsList,
  subscribeToUserRecentDirectChats,
  markDirectMessagesAsRead,
  uploadPrivateChatMedia,
  setPrivateTyping,
  subscribeToPrivateTyping,
  submitUserReport
} from '../services/firebase';
import { FriendsList } from './FriendsList';
import { LuxuryGiftModal } from './LuxuryGiftModal';
import { CallModal } from './CallModal';
import { CoinsTransferModal } from './CoinsTransferModal';
import { ChatWallpapersModal } from './ChatWallpapersModal';
import { STICKERS_CATALOG, CURATED_EMOJIS } from '../data/stickers';
import { toast } from 'sonner';
import { getWallpaperStyleById } from '../data/wallpapers';
import { AvatarWithFrame } from './AvatarWithFrame';
import { getRankDisplayMeta } from '../utils/userRanks';
import { ANIMATED_INLINE_EMOJIS, InlineRichText } from './InlineRichText';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { compressImageFileToBlob } from '../utils/imageCompression';
import { offlineQueue } from '../services/offlineQueue';
import { translateChatMessage } from '../utils/translateMessage';
import { globalRadioPlayer } from '../services/radioPlayer';
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
  onClearPrefilledDraft
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
  const [translatedMap, setTranslatedMap] = useState<Record<string, { translated: string; targetLang: string; show: boolean }>>({});
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

  // Close actions menu on outside click & reset search/reply when switching contact
  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsMessageSearchOpen(false);
    setMessageSearchQuery('');
    setReplyingTo(null);
    setSwipeState(null);
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
    toast.success(`تم إرسال هدية ${gift.name} إلى ${activeContact.name} بنجاح! ${gift.icon}`);

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
    });
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
  }, [targetUser, currentUser.id, globalOnlineUsers, onMarkSenderRead]);

  // 4. Real-time Messages for Active 1-on-1 Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeContact) {
      setMessages([]);
      return;
    }
    setMessages([]);
    const unsub = subscribeToDirectMessages(currentUser.id, activeContact.id, (loadedMsgs) => {
      setMessages(loadedMsgs || []);
    });
    return () => unsub();
  }, [activeContact?.id, currentUser.id]);

  // Mark incoming messages as read in Firestore + RTDB + WebSocket + app unread counter when opening/viewing conversation
  useEffect(() => {
    if (!activeContact?.id || !currentUser?.id) return;
    if ((unreadBySender[activeContact.id] || 0) > 0) {
      onMarkSenderRead?.(activeContact.id);
    }
    if (messages.length === 0) return;
    const hasUnread = messages.some(m => m.senderId !== currentUser.id && m.status !== 'read');
    if (hasUnread) {
      markDirectMessagesAsRead(currentUser.id, activeContact.id, messages);
    }
  }, [activeContact?.id, currentUser?.id, messages, unreadBySender, onMarkSenderRead]);

  const [inputText, setInputText] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledDraft && activeContact) {
      setInputText(prefilledDraft);
    }
  }, [prefilledDraft, activeContact?.id]);

  // Live Typing Indicator via Database-Backed Firestore + RTDB + Real-time Socket
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrivateTypingEmitRef = useRef<number>(0);
  const peerTypingSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeContact || !currentUser?.id) {
      setIsPeerTyping(false);
      return;
    }
    const unsub = subscribeToPrivateTyping(currentUser.id, activeContact.id, (isTyping) => {
      if (peerTypingSafetyTimerRef.current) {
        clearTimeout(peerTypingSafetyTimerRef.current);
        peerTypingSafetyTimerRef.current = null;
      }
      setIsPeerTyping(isTyping);
      if (isTyping) {
        peerTypingSafetyTimerRef.current = setTimeout(() => {
          setIsPeerTyping(false);
        }, 6000);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    return () => {
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

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!activeContact) return;

    const peerSessionId = getActivePeerSessionId();
    if (val.trim().length > 0) {
      const now = Date.now();
      if (now - lastPrivateTypingEmitRef.current >= 1400) {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact, isPeerTyping]);

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

  // Unrestricted Media file picker & upload handler (<200KB image compression)
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

    const convId = [currentUser.id, activeContact.id].sort().join('_');
    setIsUploadingMedia(true);
    setUploadProgress(5);
    try {
      let uploadFile: File = file;
      if (isImage) {
        const { blob: compressedBlob } = await compressImageFileToBlob(file, {
          maxWidth: 800,
          maxBytes: 195 * 1024,
        });
        const cleanBase = file.name.replace(/\.[^.]+$/, '') || 'photo';
        uploadFile = new File([compressedBlob], `${cleanBase}.jpg`, { type: 'image/jpeg' });
      }
      const { url, mediaType } = await uploadPrivateChatMedia(uploadFile, convId, (pct) => {
        setUploadProgress(pct);
      });
      sounds.playMessageSent();
      const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
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
      setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
      toast.success(mediaType === 'video' ? 'تم إرسال الفيديو بنجاح 🎬' : 'تم إرسال الصورة بنجاح 🖼️');
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء رفع الوسائط.');
    } finally {
      setIsUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
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
      timestamp: Date.now(),
      status: 'sent'
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const pendingId = `offline_dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const convId = [currentUser.id, activeContact.id].sort().join('_');
      const offlineMsg: Message = {
        ...(newMsg as Message),
        id: pendingId,
        roomId: convId,
        status: 'pending_offline',
      };
      setMessages(prev => [...prev, offlineMsg]);
      offlineQueue.enqueue({
        id: pendingId,
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

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => {
        if (prev.some(m => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (err) {
      console.warn("Direct message send fallback:", err);
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
    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
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
      timestamp: Date.now(),
      status: 'sent'
    };

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => {
        if (prev.some(m => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (err) {
      console.warn("Direct voice send error:", err);
    }
  };

  const handleSendVoiceFallback = async () => {
    if (!activeContact) return;
    sounds.playMessageSent();
    const newMsg: Partial<Message> & { recipientName?: string; recipientAvatar?: string; recipientSessionId?: string } = {
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
      audioDuration: 4,
      timestamp: Date.now(),
      status: 'sent'
    };

    try {
      const sent = await sendDirectMessage(currentUser.id, activeContact.id, newMsg);
      setMessages(prev => {
        if (prev.some(m => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (err) {}
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
    <div className={isDrawer ? "h-full w-full max-w-full flex flex-col bg-white overflow-x-hidden overflow-y-hidden" : "w-full sm:px-3 max-w-4xl mx-auto h-[calc(100dvh-54px-50px)] sm:h-[calc(100dvh-56px-52px)] flex flex-col overflow-x-hidden"}>

      {/* If No Contact Selected: Show Inbox & Friends Navigation (Modern Light Theme) */}
      {!activeContact ? (
        <div className={isDrawer ? "flex-1 flex flex-col overflow-hidden" : "space-y-3 flex-1 flex flex-col overflow-hidden pt-2 px-2.5 sm:px-0"}>
          
          {/* Header */}
          {isDrawer ? (
            <div className="p-3.5 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-700 text-white border-b border-indigo-500/40 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white truncate">الرسائل الخاصة والأصدقاء</h2>
                  <p className="text-[10px] text-indigo-100 flex items-center gap-1 truncate">
                    <Lock className="w-2.5 h-2.5 shrink-0" />
                    <span>مشفرة وآمنة بين الطرفين</span>
                  </p>
                </div>
              </div>
              {onCloseDrawer && (
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  className="p-1.5 rounded-full text-white/90 hover:text-white bg-white/15 hover:bg-white/25 transition shrink-0"
                  title="إغلاق القائمة الجانبية"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <h1 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2 min-w-0 truncate">
                <MessageCircle className="w-5 h-5 text-indigo-600 shrink-0" />
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
            <div className="rounded-xl bg-indigo-50/90 border border-indigo-200 p-2 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-black text-indigo-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>رسائل واردة جديدة ({unreadMessagesBySender.reduce((s, item) => s + item.count, 0)})</span>
                </span>
                {onClearAllUnreadMessages && (
                  <button
                    type="button"
                    onClick={onClearAllUnreadMessages}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100/70 border border-indigo-100 flex items-center justify-between gap-2 text-right transition cursor-pointer"
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
                  ? 'bg-indigo-600 text-white shadow-sm'
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
                  ? 'bg-indigo-600 text-white shadow-sm'
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
                  ? 'bg-indigo-600 text-white shadow-sm'
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
            <div className="space-y-2 flex-1 overflow-y-auto pb-4">
              {recentChats.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-white border border-slate-200/90 space-y-3 mt-4 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    💬
                  </div>
                  <h4 className="text-sm font-black text-slate-900">لا توجد محادثات نشطة حالياً</h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                    ابدأ بالتحدث مع أصدقائك أو اختر أي عضو من تبويب <span className="text-indigo-600 font-bold">"الأصدقاء"</span> أو <span className="text-emerald-600 font-bold">"المتصلون الآن"</span> لبدء محادثة خاصة مشفرة!
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('online')}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
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
                          ? 'bg-indigo-50/40 border-indigo-300 hover:border-indigo-400'
                          : 'bg-white border-slate-200/90 hover:border-indigo-400'
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
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold shrink-0">
                              محادثة مباشرة
                            </span>
                          </div>
                          <p className={`text-xs truncate max-w-[190px] sm:max-w-xs mt-0.5 ${unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                            {chat.lastMessage || 'بدء المحادثة...'}
                          </p>
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
                          <span className="text-[10px] text-indigo-600 font-bold">فتح الدردشة ←</span>
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
            <div className="flex-1 overflow-y-auto pb-4">
              <FriendsList
                currentUser={currentUser}
                onStartPrivateChat={handleSelectFriendForChat}
              />
            </div>
          )}

          {/* Tab 3: Online Users Available to Message */}
          {activeTab === 'online' && (
            <div className="space-y-2 flex-1 overflow-y-auto pb-4">
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
                      className="p-3 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 flex items-center justify-between cursor-pointer transition-all hover:shadow-md shadow-xs"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOnlineUserForChat(user);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
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
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              متصل الآن
                            </span>
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
            ? "h-full w-full max-w-full flex flex-col bg-[#fafaf9] overflow-x-hidden overflow-y-hidden"
            : "fixed inset-0 z-[60] w-screen max-w-full h-[100dvh] sm:relative sm:inset-auto sm:z-auto sm:w-full sm:h-full flex flex-col bg-[#fafaf9] border-0 sm:border border-slate-200/80 rounded-none sm:rounded-3xl overflow-x-hidden overflow-y-hidden shadow-2xl"
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

          {/* 1. Simplified 3-Zone Header: Back+User | Audio Call | Actions Dropdown */}
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
              <div className="relative z-20 w-full px-2.5 sm:px-3.5 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:py-2.5 bg-white/95 backdrop-blur-md border-b border-amber-200/70 shadow-xs flex items-center justify-between gap-2 shrink-0">
                {/* Zone 1: Back + Peer Avatar & Status */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveContact(null);
                      if (onClearTargetUser) onClearTargetUser();
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 border border-slate-200/80 transition cursor-pointer"
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
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1 min-w-0 group-hover:text-indigo-700 transition-colors">
                        <span className="truncate">{activeContact.name}</span>
                        <VerifiedBadge verified={resolvedPeerUser.verified} size="xs" />
                        <span className="shrink-0">{activeContact.countryFlag}</span>
                      </h3>
                      {isPeerTyping ? (
                        <span className="text-[10px] sm:text-[11px] text-amber-600 font-bold flex items-center gap-1.5 truncate">
                          <span>يكتب الآن...</span>
                          <span className="flex items-center gap-0.5 shrink-0">
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </span>
                      ) : isPeerTrulyOnline ? (
                        <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-bold flex items-center gap-1 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="truncate">متصل الآن • خاص مشفر</span>
                        </span>
                      ) : (
                        <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium block truncate">
                          {formatLastSeenArabic(effectiveLastSeen)} • خاص مشفر
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Zone 2 & 3: Audio Call + Actions Menu Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0" ref={actionsMenuRef}>
                  <button 
                    type="button"
                    onClick={() => handleRequestCall('audio')}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
                    title="بدء مكالمة صوتية"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsActionsMenuOpen(prev => !prev)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center active:scale-95 transition cursor-pointer"
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
                            handleRequestCall('video');
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-sky-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Video className="w-4 h-4 text-sky-600 shrink-0" />
                          <span>مكالمة فيديو 📹</span>
                        </button>
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
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Palette className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>تخصيص الخلفية 🎨</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsMessageSearchOpen(prev => !prev);
                            setMessageSearchQuery('');
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-800 hover:bg-indigo-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Search className="w-4 h-4 text-indigo-600 shrink-0" />
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
                              contextId: [currentUser.id, activeContact.id].sort().join('_'),
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

                  {isDrawer && onCloseDrawer && (
                    <button
                      type="button"
                      onClick={onCloseDrawer}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
                      title="إغلاق القائمة الجانبية"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Toggleable Message Search Strip */}
          {isMessageSearchOpen && (
            <div className="px-3 py-2 bg-white/95 border-b border-slate-200 flex items-center gap-2 shrink-0 animate-in slide-in-from-top-1">
              <Search className="w-4 h-4 text-indigo-500 shrink-0" />
              <input
                type="text"
                value={messageSearchQuery}
                onChange={(e) => setMessageSearchQuery(e.target.value)}
                placeholder="ابحث داخل هذه المحادثة..."
                autoFocus
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => {
                  setIsMessageSearchOpen(false);
                  setMessageSearchQuery('');
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
                      ? 'bg-white/90 backdrop-blur-md text-slate-900 border border-indigo-200/80 shadow-xs'
                      : isMe
                      ? 'bg-gradient-to-l from-indigo-600 via-blue-600 to-purple-600 text-white border border-indigo-500/40 rounded-tr-none shadow-sm'
                      : 'bg-white/88 backdrop-blur-md text-slate-900 border border-slate-200/85 rounded-tl-none shadow-sm'
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
                            ? 'bg-white/15 border-amber-300 text-white/95 hover:bg-white/25'
                            : 'bg-indigo-50/90 border-indigo-500 text-slate-700 hover:bg-indigo-100'
                        }`}
                        title="اضغط للانتقال إلى الرسالة الأصلية"
                      >
                        <div className={`font-black text-[10px] ${isMe ? 'text-amber-200' : 'text-indigo-700'}`}>
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
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImageUrl(msg.mediaUrl || msg.imageUrl || null);
                          }}
                          className="relative rounded-xl overflow-hidden border border-white/25 bg-black/10 group cursor-zoom-in"
                        >
                          <img
                            src={msg.mediaUrl || msg.imageUrl}
                            alt="صورة مرسلة"
                            className="max-h-60 w-full object-cover rounded-xl"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1.5 left-1.5 p-1 rounded-lg bg-slate-900/60 text-white opacity-80 group-hover:opacity-100">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </span>
                        </div>
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
                          className={`p-1.5 rounded-full ${isMe ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'}`}
                        >
                          {playingVoiceId === msg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                        <span className={`text-[11px] font-bold ${isMe ? 'text-white' : 'text-slate-800'}`}>
                          تسجيل صوتي ({msg.audioDuration ? `0:${msg.audioDuration.toString().padStart(2, '0')}` : '0:05'})
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className={`leading-relaxed whitespace-pre-wrap font-medium ${isMe ? 'text-white' : 'text-slate-900'}`}>
                          <InlineRichText text={msg.content || msg.text || ''} />
                        </p>
                        {translatedMap[msg.id]?.show && (
                          <div className={`text-[11px] rounded-xl px-2.5 py-1.5 border ${
                            isMe
                              ? 'bg-white/15 border-white/25 text-white'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          }`}>
                            <span className="font-black text-[9.5px] opacity-80 block">
                              الترجمة ({translatedMap[msg.id].targetLang}):
                            </span>
                            <span>{translatedMap[msg.id].translated}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`flex items-center justify-between gap-2 text-[10px] ${
                      isMe && msg.type !== 'sticker' ? 'text-white/80' : 'text-slate-500'
                    }`}>
                      {(!msg.type || msg.type === 'private' || msg.type === 'text') && (msg.content || msg.text) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTranslatedMap((prev) => {
                              const current = prev[msg.id];
                              if (current) {
                                return { ...prev, [msg.id]: { ...current, show: !current.show } };
                              }
                              const res = translateChatMessage(msg.content || msg.text || '');
                              return { ...prev, [msg.id]: { ...res, show: true } };
                            });
                          }}
                          className={`inline-flex items-center gap-0.5 font-bold hover:underline cursor-pointer ${
                            isMe ? 'text-white/90' : 'text-indigo-600'
                          }`}
                          title="ترجمة فورية"
                        >
                          <Languages className="w-2.5 h-2.5" />
                          <span>{translatedMap[msg.id]?.show ? 'إخفاء الترجمة' : 'ترجمة 🌐'}</span>
                        </button>
                      ) : <span />}

                      <div className="flex items-center gap-1">
                        <span>{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span className="inline-flex items-center gap-0.5">
                            {msg.status === 'pending_offline' ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-200 text-[9px] font-bold">
                                <WifiOff className="w-3 h-3" />
                                <span>⏳ جاري الإرسال...</span>
                              </span>
                            ) : msg.status === 'read' ? (
                              <>
                                <CheckCheck className={`w-3.5 h-3.5 ${msg.type === 'sticker' ? 'text-indigo-600' : 'text-sky-200'}`} />
                                <span className={`text-[9px] font-bold ${msg.type === 'sticker' ? 'text-indigo-700' : 'text-sky-100'}`}>تم القراءة</span>
                              </>
                            ) : (
                              <Check className={`w-3.5 h-3.5 ${msg.type === 'sticker' ? 'text-slate-400' : 'text-white/75'}`} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            });
            })()}
            
            {/* Live Peer Typing Indicator Bubble (Left / Receiver side in RTL) */}
            {isPeerTyping && (
              <div className="flex items-center gap-2 justify-end animate-in fade-in slide-in-from-bottom-2 my-1.5">
                <div className="bg-white/95 backdrop-blur-md border border-amber-300/80 rounded-2xl rounded-tl-none px-3.5 py-2 flex items-center gap-2 shadow-md">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {activeContact.name} يكتب الآن...
                  </span>
                </div>
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-amber-400 shrink-0 shadow-xs">
                  <img src={activeContact.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Media Upload Progress Strip */}
          {isUploadingMedia && (
            <div className="w-full px-3 py-1.5 bg-indigo-50 border-t border-indigo-200 flex items-center gap-2 text-xs text-indigo-800 font-bold shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
              <span className="shrink-0">جاري رفع الوسائط... {uploadProgress}%</span>
              <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.max(8, uploadProgress)}%` }} />
              </div>
            </div>
          )}

          {/* Reply Preview Bar above Composer */}
          {replyingTo && (
            <div className="w-full px-3 py-1.5 bg-indigo-50/95 border-t border-indigo-200 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 border-r-2 border-indigo-600 pr-2">
                <Reply className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[10.5px] font-black text-indigo-800 truncate">
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
                className="p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-indigo-100 shrink-0 cursor-pointer"
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
                  className="p-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 min-h-[42px] min-w-[40px] flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
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
                      ? 'bg-amber-100 border-amber-400 text-amber-700'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600'
                  }`}
                  title="الرموز التعبيرية والملصقات"
                >
                  <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Quick Voice Note Button */}
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 border border-slate-200 min-h-[42px] min-w-[40px] flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0"
                  title="بدء تسجيل صوتي"
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="اكتب رسالة خاصة هنا..."
                    className="w-full min-w-0 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-amber-400 rounded-2xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none min-h-[42px] max-h-24 leading-[1.45] resize-none overflow-y-auto transition-all shadow-inner"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black shadow-md shadow-amber-500/25 active:scale-95 min-h-[42px] min-w-[42px] flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="إرسال الرسالة"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
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
            toast.success(`تم تحويل ${amount.toLocaleString()} كوينز إلى ${activeContact.name} بنجاح! 🪙`);
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
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
