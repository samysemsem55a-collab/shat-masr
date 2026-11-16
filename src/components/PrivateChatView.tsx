import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Maximize2
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
  uploadPrivateChatMedia
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { isGuestUser } from '../data/seedData';
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
import {
  ConsentRequestType,
  formatCooldownRemaining,
  getConsentCooldownRemaining,
  requestUserConsent,
} from '../services/consentService';

interface PrivateChatViewProps {
  currentUser: User;
  onOpenWallet: () => void;
  targetUser?: User | null;
  onClearTargetUser?: () => void;
  globalOnlineUsers?: User[];
  onUpdateUser?: (user: User) => void;
  onChatActiveChange?: (isActive: boolean) => void;
  onPromptRegister?: () => void;
  unreadBySender?: Record<string, number>;
  unreadMessagesBySender?: UnreadSenderSummary[];
  onMarkSenderRead?: (senderId: string) => void;
  onClearAllUnreadMessages?: () => void;
  isDrawer?: boolean;
  onCloseDrawer?: () => void;
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
  onOpenWallet,
  onUpdateUser,
  onChatActiveChange,
  onPromptRegister,
  unreadBySender = {},
  unreadMessagesBySender = [],
  onMarkSenderRead,
  onClearAllUnreadMessages,
  isDrawer = false,
  onCloseDrawer
}) => {
  // Navigation tabs when in list view
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'online'>('chats');
  const isGuest = isGuestUser(currentUser);
  
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

  // Emoji & Animated Emojis Picker + Media Upload + Lightbox + Consent States
  const [isEmojiStickerOpen, setIsEmojiStickerOpen] = useState(false);
  const [emojiStickerTab, setEmojiStickerTab] = useState<'emojis' | 'animated'>('emojis');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [requestingConsentType, setRequestingConsentType] = useState<ConsentRequestType | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const emojiStickerPanelRef = useRef<HTMLDivElement>(null);

  // Real Voice Recording States & Refs
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingSecondsRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

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
  }, [targetUser, currentUser.id, globalOnlineUsers]);

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

  // Live Typing Indicator via Real-time WebSocket
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrivateTypingEmitRef = useRef<number>(0);
  const peerTypingSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeContact) {
      setIsPeerTyping(false);
      return;
    }
    const unsub = realtimeSocket.subscribeToPrivateTyping(activeContact.id, (isTyping) => {
      if (peerTypingSafetyTimerRef.current) {
        clearTimeout(peerTypingSafetyTimerRef.current);
        peerTypingSafetyTimerRef.current = null;
      }
      setIsPeerTyping(isTyping);
      if (isTyping) {
        peerTypingSafetyTimerRef.current = setTimeout(() => {
          setIsPeerTyping(false);
        }, 5000);
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
  }, [activeContact?.id]);

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
        realtimeSocket.sendPrivateTyping(
          currentUser.id,
          currentUser.name,
          activeContact.id,
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
      if (now - lastPrivateTypingEmitRef.current >= 1500) {
        lastPrivateTypingEmitRef.current = now;
        realtimeSocket.sendPrivateTyping(currentUser.id, currentUser.name, activeContact.id, true, peerSessionId);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        lastPrivateTypingEmitRef.current = 0;
        realtimeSocket.sendPrivateTyping(currentUser.id, currentUser.name, activeContact.id, false, peerSessionId);
      }, 3000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      lastPrivateTypingEmitRef.current = 0;
      realtimeSocket.sendPrivateTyping(currentUser.id, currentUser.name, activeContact.id, false, peerSessionId);
    }
  };

  // Message deletion & Context Menu
  const [activeContextMenu, setActiveContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeContact) return;
    sounds.playMessageSent();
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

  // Pre-approved Audio / Video Call Launcher with 5-minute Rejection Cooldown
  const handleRequestCall = async (callType: 'audio' | 'video') => {
    if (!activeContact) return;
    if (isGuest) {
      toast.warning('المكالمات مخصصة للأعضاء المسجلين — يمكنك التسجيل بحساب جوجل أو الهاتف مجاناً!');
      if (onPromptRegister) {
        onPromptRegister();
      } else {
        setCallModalState({ isOpen: true, callType });
      }
      return;
    }
    const consentType: ConsentRequestType = callType === 'video' ? 'video_call' : 'audio_call';
    const remainingMs = getConsentCooldownRemaining(currentUser.id, activeContact.id, consentType);
    if (remainingMs > 0) {
      toast.warning(
        `تم حظر إعادة طلب ${callType === 'video' ? 'مكالمة الفيديو' : 'المكالمة الصوتية'} مؤقتاً — متبقي ${formatCooldownRemaining(remainingMs)} ⏳`
      );
      return;
    }
    if (requestingConsentType) return;

    setRequestingConsentType(consentType);
    const toastId = toast.loading(
      `تم إرسال طلب ${callType === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'} إلى ${activeContact.name}... في انتظار الموافقة ⏳`
    );
    try {
      const res = await requestUserConsent(
        currentUser,
        activeContact.id,
        activeContact.name,
        consentType
      );
      toast.dismiss(toastId);
      if (res.approved) {
        toast.success(`وافق ${activeContact.name} على المكالمة ✅`);
        setCallModalState({ isOpen: true, callType });
      } else if (res.reason === 'rejected') {
        toast.error(
          `رفض ${activeContact.name} طلب المكالمة ❌ (ممنوع إعادة الطلب لمدة 5 دقائق)`
        );
      } else if (res.reason === 'cooldown') {
        toast.warning(
          `يرجى الانتظار ${formatCooldownRemaining(res.remainingMs || 0)} قبل إعادة الطلب`
        );
      } else {
        toast.info(`لم يرد ${activeContact.name} على طلب المكالمة في الوقت المحدد`);
      }
    } finally {
      setRequestingConsentType(null);
    }
  };

  // Media file picker & consent-gated upload handler (Images & Videos)
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

    const cooldownRemaining = getConsentCooldownRemaining(currentUser.id, activeContact.id, 'send_image');
    if (cooldownRemaining > 0) {
      toast.warning(
        `لا يمكنك إرسال صور لـ ${activeContact.name} الآن — متبقي ${formatCooldownRemaining(cooldownRemaining)} ⏳`
      );
      return;
    }

    setRequestingConsentType('send_image');
    const consentToastId = toast.loading(
      `في انتظار موافقة ${activeContact.name} على استقبال ${isVideo ? 'الفيديو' : 'الصورة'}... ⏳`
    );
    try {
      const consentRes = await requestUserConsent(
        currentUser,
        activeContact.id,
        activeContact.name,
        'send_image',
        isVideo ? 'يرغب في إرسال مقطع فيديو إليك' : 'يرغب في إرسال صورة إليك'
      );
      toast.dismiss(consentToastId);
      if (!consentRes.approved) {
        if (consentRes.reason === 'rejected') {
          toast.error(
            `رفض ${activeContact.name} استقبال الصور ❌ (تم تفعيل منع الإزعاج لمدة 5 دقائق)`
          );
        } else if (consentRes.reason === 'cooldown') {
          toast.warning(
            `يرجى الانتظار ${formatCooldownRemaining(consentRes.remainingMs || 0)}`
          );
        } else {
          toast.info(`لم يوافق ${activeContact.name} في الوقت المحدد — لم يتم إرسال الملف`);
        }
        return;
      }
    } finally {
      setRequestingConsentType(null);
    }

    const convId = [currentUser.id, activeContact.id].sort().join('_');
    setIsUploadingMedia(true);
    setUploadProgress(5);
    try {
      const { url, mediaType } = await uploadPrivateChatMedia(file, convId, (pct) => {
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
    realtimeSocket.sendPrivateTyping(currentUser.id, currentUser.name, activeContact.id, false, getActivePeerSessionId());

    sounds.playMessageSent();
    const content = inputText.trim();
    setInputText('');

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
      sounds.playMessageSent();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const totalDuration = recordingSecondsRef.current || 2;
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
                  const peerOnline = globalOnlineUsers.some(u => u.id === chat.peerId);
                  const unreadCount = unreadBySender[chat.peerId] || 0;
                  return (
                    <div
                      key={chat.chatId}
                      onClick={() => {
                        onMarkSenderRead?.(chat.peerId);
                        setActiveContact({
                          id: chat.peerId,
                          name: chat.peerName || 'مستخدم',
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
                            globalOnlineUsers.find(u => u.id === chat.peerId) || {
                              id: chat.peerId,
                              name: chat.peerName || 'مستخدم',
                              avatar: chat.peerAvatar || '',
                              role: (chat.peerRole as any) || 'member',
                              status: peerOnline ? 'online' : 'offline',
                            }
                          }
                          size="md"
                          showOnlineDot={peerOnline}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-900 truncate">{chat.peerName || 'مستخدم'}</h4>
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
              {globalOnlineUsers.filter(u => u.id !== currentUser.id).length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 space-y-2 shadow-xs">
                  <p className="text-xs text-slate-600">لا يوجد متصلون آخرون في هذه اللحظة.</p>
                </div>
              ) : (
                globalOnlineUsers
                  .filter(u => u.id !== currentUser.id)
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
                            <span className="text-sm font-black text-slate-900">{user.name}</span>
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
            : "fixed inset-0 z-50 w-screen max-w-full h-[100dvh] sm:relative sm:inset-auto sm:w-full sm:h-full flex flex-col bg-[#fafaf9] border-0 sm:border border-slate-200/80 rounded-none sm:rounded-3xl overflow-x-hidden overflow-y-hidden shadow-2xl"
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

          {/* 1. Modern Light Glass Header (Full-Width Mobile Safe) */}
          <div className="relative z-10 w-full px-2 sm:px-3 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:py-2.5 bg-white/95 backdrop-blur-md border-b border-amber-200/70 shadow-xs flex items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  setActiveContact(null);
                  if (onClearTargetUser) onClearTargetUser();
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 border border-slate-200/80 transition"
                title="الرجوع إلى القائمة"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              <AvatarWithFrame
                user={
                  globalOnlineUsers.find(u => u.id === activeContact.id) || {
                    id: activeContact.id,
                    name: activeContact.name,
                    avatar: activeContact.avatar,
                    role: (activeContact.role as any) || 'member',
                    status: activeContact.status,
                  }
                }
                size="sm"
                showOnlineDot
              />

              <div className="min-w-0 flex-1 text-right">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1 min-w-0">
                  <span className="truncate">{activeContact.name}</span>
                  <span className="shrink-0">{activeContact.countryFlag}</span>
                </h3>
                {isPeerTyping ? (
                  <span className="text-[10px] sm:text-[11px] text-amber-600 font-bold flex items-center gap-1.5 animate-pulse truncate">
                    <span>جاري الكتابة...</span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </span>
                ) : activeContact.status === 'online' ? (
                  <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-bold flex items-center gap-1 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span className="truncate">متصل الآن • خاص مشفر</span>
                  </span>
                ) : (
                  <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium block truncate">خاص مشفر • غير متصل</span>
                )}
              </div>
            </div>

            {/* Header Left Actions (RTL): Natural Wallpaper, Coins Transfer, Gift, Audio Call */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Custom Natural & Shop Wallpaper Picker Button */}
              <button
                type="button"
                onClick={() => setIsWallpapersModalOpen(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center active:scale-95 transition shadow-xs shrink-0"
                title="تخصيص خلفية الشات والصور الطبيعية"
              >
                <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </button>

              {/* Coins Transfer Button */}
              <button
                type="button"
                onClick={() => setIsCoinsTransferOpen(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300/80 flex items-center justify-center active:scale-95 transition shadow-xs shrink-0"
                title="تحويل كوينز فوري"
              >
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </button>

              {/* Luxury Virtual Gift Button */}
              <button
                type="button"
                onClick={() => setIsGiftModalOpen(true)}
                className="w-8 h-8 sm:w-auto sm:px-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition shrink-0 whitespace-nowrap"
                title="إرسال هدية فاخرة"
              >
                <Gift className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">هدية 🎁</span>
              </button>

              {/* Audio & Video Calls (Pre-approved consent + 5-min cooldown + visible on mobile & desktop) */}
              <button 
                type="button"
                onClick={() => handleRequestCall('audio')}
                disabled={Boolean(requestingConsentType)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
                title="طلب مكالمة صوتية"
              >
                {requestingConsentType === 'audio_call' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
              </button>

              <button 
                type="button"
                onClick={() => handleRequestCall('video')}
                disabled={Boolean(requestingConsentType)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-700 hover:text-indigo-700 border border-sky-200 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
                title="طلب مكالمة فيديو"
              >
                {requestingConsentType === 'video_call' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Video className="w-3.5 h-3.5" />
                )}
              </button>

              {isDrawer && onCloseDrawer && (
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80 flex items-center justify-center transition active:scale-95 shrink-0"
                  title="إغلاق القائمة الجانبية"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2.5">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-amber-300 flex items-center justify-center text-2xl shadow-md">
                  💬
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 bg-white/85 px-3 py-1 rounded-full border border-slate-200">محادثة خاصة جديدة ومشفرة</h4>
                <p className="text-[11px] text-slate-600 max-w-xs leading-relaxed bg-white/85 px-3 py-2 rounded-2xl border border-slate-200/80 shadow-xs">
                  أهلاً بك! محادثتك مع <span className="text-slate-900 font-black">{activeContact.name}</span> مشفرة بالكامل بين الطرفين. أرسل رسالة للبدء! 👋
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
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

                return (
                  <motion.div
                    key={`${msg.id || 'pm'}_${idx}`}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                  >
                  <div 
                    onMouseDown={(e) => {
                      longPressTimerRef.current = setTimeout(() => {
                        setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                      }, 750);
                    }}
                    onMouseUp={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    onMouseLeave={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      longPressTimerRef.current = setTimeout(() => {
                        if (navigator.vibrate) navigator.vibrate(50);
                        setActiveContextMenu({ msg, x: touch.clientX, y: touch.clientY });
                      }, 750);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    onTouchMove={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                    }}
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm space-y-1 shadow-md cursor-pointer select-text transition-transform active:scale-[0.99] ${
                    msg.type === 'sticker'
                      ? 'bg-white/95 text-slate-900 border-2 border-indigo-200/80 shadow-md'
                      : isMe
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-tr-none shadow-indigo-900/30'
                      : 'bg-white/95 text-slate-900 border-2 border-amber-300/80 rounded-tl-none shadow-amber-900/10'
                  }`}
                    title="اضغط مطولاً لخيارات الرسالة (حذف / نسخ)"
                  >
                    {msg.type === 'sticker' ? (
                      <p className={`leading-relaxed whitespace-pre-wrap font-medium ${isMe ? 'text-white' : 'text-slate-900'}`}>
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
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-900 font-bold text-xs">
                        <span className="text-2xl shrink-0">💰</span>
                        <div className="text-right">
                          <div className="text-amber-800 font-black text-xs">تحويل كوينز ناجح 🪙</div>
                          <div className="text-[11px] text-amber-700 leading-snug">{msg.content || msg.text}</div>
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
                              sounds.playMessageReceived();
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
                          className={`p-1.5 rounded-full ${isMe ? 'bg-white text-indigo-700' : 'bg-amber-600 text-white'}`}
                        >
                          {playingVoiceId === msg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                        <span className={`text-[11px] font-bold ${isMe ? 'text-white' : 'text-slate-800'}`}>
                          تسجيل صوتي ({msg.audioDuration ? `0:${msg.audioDuration.toString().padStart(2, '0')}` : '0:05'})
                        </span>
                      </div>
                    ) : (
                      <p className={`leading-relaxed whitespace-pre-wrap font-medium ${isMe ? 'text-white' : 'text-slate-900'}`}>
                        <InlineRichText text={msg.content || msg.text || ''} />
                      </p>
                    )}

                    <div className={`flex items-center justify-end gap-1 text-[10px] ${msg.type === 'sticker' ? 'text-slate-500' : isMe ? 'text-white/85' : 'text-slate-500'}`}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <span className="inline-flex items-center gap-0.5">
                          {msg.status === 'read' ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                              <span className="text-[9px] font-bold text-cyan-100">تم القراءة</span>
                            </>
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-200" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }))}
            
            {/* Live Peer Typing Indicator Bubble */}
            {isPeerTyping && (
              <div className="flex items-center gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 my-1.5">
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-amber-400 shrink-0 shadow-xs">
                  <img src={activeContact.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                </div>
                <div className="bg-white border border-amber-300/80 rounded-2xl rounded-tl-none px-3.5 py-2 flex items-center gap-2 shadow-md">
                  <span className="text-xs font-bold text-slate-800">
                    {activeContact.name} جاري الكتابة...
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
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

          {/* Bottom Chat Bar: Full-Width Mobile + Emoji/Sticker Drawer + Media Picker */}
          <div ref={emojiStickerPanelRef} className="relative w-full p-2 sm:p-3 bg-white/98 backdrop-blur-md border-t border-slate-200/90 flex items-center gap-1 sm:gap-2 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] sm:pb-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {/* Compact Circular Telegram/WhatsApp-Style Emoji & Animated Emoji Picker */}
            {isEmojiStickerOpen && (
              <div className="absolute bottom-full left-2 right-2 sm:left-auto sm:right-3 mb-2 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 z-40 space-y-2 animate-in slide-in-from-bottom-2">
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
                  <span className="text-xs font-bold text-red-700">جاري تسجيل الصوت:</span>
                  <span className="text-xs font-black text-red-800 font-mono">
                    00:{recordingSeconds.toString().padStart(2, '0')}
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
                {/* Media Sharing Button (Image / Video) — Kept in exact slot, gated by consent */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeContact) return;
                    const cd = getConsentCooldownRemaining(currentUser.id, activeContact.id, 'send_image');
                    if (cd > 0) {
                      toast.warning(
                        `لا يمكنك إرسال صور لـ ${activeContact.name} الآن — متبقي ${formatCooldownRemaining(cd)} ⏳`
                      );
                      return;
                    }
                    mediaFileInputRef.current?.click();
                  }}
                  disabled={isUploadingMedia || requestingConsentType === 'send_image'}
                  className="p-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 min-h-[42px] min-w-[40px] flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
                  title="إرسال صورة أو فيديو (يتطلب موافقة الطرف الثاني)"
                >
                  {requestingConsentType === 'send_image' ? (
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

                {/* Message Input Field */}
                <form onSubmit={handleSendMessage} className="flex-1 min-w-0 flex items-center">
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="اكتب رسالة خاصة هنا..."
                    className="w-full min-w-0 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-amber-400 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none min-h-[42px] transition-all shadow-inner"
                  />
                </form>

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
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in"
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

                {/* Copy Text Option */}
                {activeContextMenu.msg.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeContextMenu.msg.content);
                      sounds.playMessageReceived();
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
          className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition"
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
