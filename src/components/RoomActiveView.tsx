import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Send, 
  Mic, 
  MicOff,
  Gift, 
  Sparkles, 
  Pin, 
  Check, 
  CheckCheck, 
  Play, 
  Pause, 
  X, 
  VolumeX, 
  Volume2,
  BookOpen, 
  Reply, 
  Users, 
  ShieldCheck, 
  Music,
  Smile,
  Heart,
  Flame,
  ThumbsUp,
  MessageSquare,
  Crown,
  Trash2,
  Copy,
  Palette,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  Filter,
  Bot,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { Room, Message, User, SpeakerSeat } from '../types/chat';
import { isUserAdminOrOwner, LUXURY_GIFTS } from '../data/seedData';
import { JoinRequestsManagerModal } from './JoinRequestsManagerModal';
import { ArabicMusicPlayerModal } from './ArabicMusicPlayerModal';
import { ChatWallpapersModal } from './ChatWallpapersModal';
import { getWallpaperStyleById } from '../data/wallpapers';
import { 
  subscribeToRoomJoinRequests, 
  resolveRoomJoinRequest, 
  RoomJoinRequest,
  setRoomTyping,
  subscribeToRoomTyping,
  toggleMessageReaction,
  deleteRoomMessage,
  markRoomPrivateMessagesAsRead
} from '../services/firebase';
import { sounds } from '../utils/soundEffects';
import { filterInappropriateText } from '../services/contentFilter';

interface RoomActiveViewProps {
  room: Room;
  currentUser: User;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (msg: Partial<Message>) => void;
  onOpenGiftModal: () => void;
  onUpdateSpeakers: (speakers: SpeakerSeat[]) => void;
  onOpenUserProfile: (user: User) => void;
  onOpenOnlineUsers: () => void;
  onUpdateUser?: (user: User) => void;
  onOpenWallet?: () => void;
}

const EMOJI_CATEGORIES = {
  faces: ['😊', '😂', '😍', '❤️', '🔥', '✨', '🌹', '👍', '👏', '🎉', '🥰', '😎', '🤲', '🤍', '👑', '💯', '🙌', '😘', '🤩', '🌸', '☕', '💎', '🕊️', '🌿'],
  flags: ['🇪🇬', '🇸🇦', '🇦🇪', '🇲🇦', '🇮🇶', '🇰🇼', '🇩🇿', '🇸🇾', '🇯🇴', '🇵🇸', 'لبي', 'تونس', 'عمان', 'بحرين', 'قطر', 'يمن', 'سودان', 'ليبيا', '🕌', '🕋', '📿', '🧿', '🦁', '🦅'],
  fun: ['😂', '🤣', '😭', '🥺', '😡', '😱', '🥳', '🤔', '👀', '💪', '🤝', '👌', '⚡', '🌟', '💥', '🎶', '🎵', '🎤', '🏆', '🥇', '💫', '🎯', '🚀', '⭐']
};

export const WELCOME_PHRASES = [
  "يا هلا والله، نورت المجلس 🌸",
  "أهلاً وسهلاً بيك يا غالي 🇪🇬",
  "مساء الورد والياسمين والفل 🌹",
  "منور الشات يا ابن الأصول ☕",
  "حيّاك الله وبيّاك يا طيب ✨",
  "يا مرحب بيك وسط أهلك وناسك 👑",
  "سلام عليكم ورحمة الله وبركاته 🕊️",
  "شرفتنا وأسعدتنا بطلتك الحلوة 🌟",
  "أحلى مسا على عيون كل الحبايب 💖",
  "يا صباح ومساء الجمال والروقان 💫"
];

export const getRoomContainerStyle = (roomId: string, userWallpaperId?: string): React.CSSProperties => {
  // If user selected or purchased a custom wallpaper, prioritize it!
  if (userWallpaperId) {
    const customStyle = getWallpaperStyleById(userWallpaperId);
    if (customStyle && Object.keys(customStyle).length > 0) {
      return customStyle;
    }
  }

  // Egypt Room 1 & Room 2: Bright luminous daylight Egyptian ambience
  if (roomId === 'room_egypt' || roomId === 'room_egypt2') {
    return {
      backgroundImage: "linear-gradient(to bottom, rgba(248, 250, 252, 0.84), rgba(241, 245, 249, 0.90)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  }
  // Other Arab Rooms: Clean bright modern doodle wallpaper
  return {
    backgroundImage: "linear-gradient(to bottom, rgba(248, 250, 252, 0.90), rgba(241, 245, 249, 0.94)), url('/assets/wallpapers/doodle_chat_bg.jpg')",
    backgroundSize: '340px',
    backgroundRepeat: 'repeat',
  };
};

export const RoomActiveView: React.FC<RoomActiveViewProps> = ({
  room,
  currentUser,
  messages,
  onBack,
  onSendMessage,
  onOpenGiftModal,
  onUpdateSpeakers,
  onOpenUserProfile,
  onOpenOnlineUsers,
  onUpdateUser,
  onOpenWallet,
}) => {
  // Chat Wallpapers Modal State (Select & Purchase)
  const [isWallpapersModalOpen, setIsWallpapersModalOpen] = useState(false);

  // Top Message Type Filter State: 'all' | 'messages' | 'images' | 'gifts'
  const [messageFilter, setMessageFilter] = useState<'all' | 'messages' | 'images' | 'gifts'>('all');

  // Speakers List Layout Mode: 'grid' vs 'list' (Requirement 9)
  const [speakerLayoutMode, setSpeakerLayoutMode] = useState<'grid' | 'list'>('grid');
  const [isSpeakerStageOpen, setIsSpeakerStageOpen] = useState(false);

  // Message Draft Persistence per room (Requirement 4)
  const draftStorageKey = `arab_chat_draft_${room.id}`;
  const [inputText, setInputText] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`arab_chat_draft_${room.id}`) || '';
    }
    return '';
  });

  // Restore draft when switching rooms
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(`arab_chat_draft_${room.id}`) || '';
      setInputText(savedDraft);
    }
  }, [room.id]);

  const replyStorageKey = `arab_chat_reply_${room.id}`;
  const [replyingTo, setReplyingTo] = useState<Message | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`arab_chat_reply_${room.id}`);
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return null;
  });

  const updateReplyingTo = (msg: Message | null) => {
    setReplyingTo(msg);
    if (typeof window !== 'undefined') {
      if (msg) {
        localStorage.setItem(replyStorageKey, JSON.stringify(msg));
      } else {
        localStorage.removeItem(replyStorageKey);
      }
    }
  };

  // Realtime Typing Indicator State
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeToRoomTyping(room.id, currentUser.id, (users) => {
      setTypingUsers(users);
    });
    return () => unsub();
  }, [room.id, currentUser.id]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem(draftStorageKey, val);
      } else {
        localStorage.removeItem(draftStorageKey);
      }
    }

    // Trigger typing state
    if (val.trim().length > 0) {
      setRoomTyping(room.id, currentUser, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setRoomTyping(room.id, currentUser, false);
      }, 3500);
    } else {
      setRoomTyping(room.id, currentUser, false);
    }
  };

  // Double-tap heart floating animations
  const [floatingHearts, setFloatingHearts] = useState<{ id: string; x: number; y: number }[]>([]);
  const lastTapRef = useRef<{ [msgId: string]: number }>({});

  const handleMessageDoubleTap = (msg: Message, e: React.MouseEvent | React.TouchEvent) => {
    sounds.playCoinsReward();
    toggleMessageReaction(room.id, msg.id, '❤️', currentUser.id, currentUser.name, msg);

    // Spawn floating heart
    let clientX = 150;
    let clientY = 300;
    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ('touches' in e && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const heartId = `heart_${Date.now()}_${Math.random()}`;
    setFloatingHearts(prev => [...prev, { id: heartId, x: clientX, y: clientY }]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1000);
  };

  // Invite Members notification toast
  const [inviteToastOpen, setInviteToastOpen] = useState(false);
  const handleInviteMembers = () => {
    sounds.playCoinsReward();
    navigator.clipboard?.writeText(window.location.origin + '?room=' + room.id);
    setInviteToastOpen(true);
    setTimeout(() => setInviteToastOpen(false), 3000);
  };

  // Reaction Users Details Modal
  const [reactionUsersModal, setReactionUsersModal] = useState<{ emoji: string; users: string[] } | null>(null);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [tasbeehCount, setTasbeehCount] = useState(0);
  const [showTasbeeh, setShowTasbeeh] = useState(false);

  // Emoji Picker State
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'faces' | 'flags' | 'fun'>('faces');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Arabic Music Library Modal State (100 Songs)
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

  // Message Context Menu & Long-Press Deletion
  const [activeContextMenu, setActiveContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRefs = useRef<{ [msgId: string]: HTMLDivElement | null }>({});
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const handleDeleteMessage = async (msgId: string) => {
    sounds.playMessageSent();
    setActiveContextMenu(null);
    await deleteRoomMessage(room.id, msgId);
  };

  const scrollToMessage = (msgId?: string) => {
    if (!msgId) return;
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  // Private Room Join Requests State
  const [isJoinRequestsOpen, setIsJoinRequestsOpen] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<RoomJoinRequest[]>([]);

  // Real Audio MediaRecorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Moderator & Pin state
  const isModerator = room.ownerId === currentUser.id || room.moderators?.includes(currentUser.id) || currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const [isModeratorPanelOpen, setIsModeratorPanelOpen] = useState(false);
  const [newPinText, setNewPinText] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; senderName: string; content: string } | null>(
    room.pinnedMessage || (room.pinnedAnnouncement ? { id: 'ann_1', senderName: 'المشرف', content: room.pinnedAnnouncement } : null)
  );
  const [bannedUserIds, setBannedUserIds] = useState<string[]>(room.bannedUserIds || []);

  // Swipe detection ref
  const touchStartXRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 3-Second Auto-Dismiss Welcome Toast State (Fade-in / Slide-up) for ANY user entering
  const [welcomeToast, setWelcomeToast] = useState<{
    user: { name: string; avatar?: string; vipBadge?: string };
    state: 'initial' | 'visible' | 'exiting' | 'hidden';
  }>({
    user: { name: currentUser.name, avatar: currentUser.avatar, vipBadge: currentUser.vipBadge },
    state: 'hidden'
  });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const triggerWelcomeToast = (targetUser: { name: string; avatar?: string; vipBadge?: string }) => {
    // Clear any previous timers
    toastTimeoutRef.current.forEach(t => clearTimeout(t));
    toastTimeoutRef.current = [];

    setWelcomeToast({
      user: targetUser,
      state: 'initial'
    });
    try { sounds.playMessageReceived(); } catch {}

    // 1. Smooth Fade-in & Slide-up animation
    const enterTimer = setTimeout(() => {
      setWelcomeToast(prev => ({ ...prev, state: 'visible' }));
    }, 40);

    // 2. Smooth Slide-up fade-out start before 3s mark
    const exitTimer = setTimeout(() => {
      setWelcomeToast(prev => ({ ...prev, state: 'exiting' }));
    }, 2550);

    // 3. Exactly 3.0 seconds (3000ms) auto-disappearance
    const hideTimer = setTimeout(() => {
      setWelcomeToast(prev => ({ ...prev, state: 'hidden' }));
    }, 3000);

    toastTimeoutRef.current.push(enterTimer, exitTimer, hideTimer);
  };

  // Smart Gift Wallet Reminder Toast (< 50% of gift cost)
  const triggerSmartGiftWalletReminder = (giftCost: number, giftName?: string) => {
    if (isUserAdminOrOwner(currentUser)) return;
    if (currentUser.coins < giftCost / 2) {
      toast.info(
        giftName
          ? `رصيدك (${currentUser.coins.toLocaleString()} 🪙) أقل من نصف تكلفة "${giftName}"`
          : `تذكير لطيف: رصيدك (${currentUser.coins.toLocaleString()} 🪙) أقل من نصف تكلفة الهدية`,
        {
          id: 'smart_gift_wallet_reminder',
          duration: 4500,
          description: 'توجّه إلى المحفظة لشحن الكوينز وإرسال هديتك بكل سهولة!',
          action: onOpenWallet
            ? {
                label: 'شحن الكوينز 🪙',
                onClick: () => onOpenWallet(),
              }
            : undefined,
        }
      );
    }
  };

  const handleOpenGiftWithReminder = () => {
    const minGiftCost = LUXURY_GIFTS[0]?.cost || 50;
    triggerSmartGiftWalletReminder(minGiftCost);
    onOpenGiftModal();
  };

  useEffect(() => {
    const handleGiftAttempt = (e: Event) => {
      const detail = (e as CustomEvent<{ cost?: number; name?: string }>).detail;
      if (detail && typeof detail.cost === 'number') {
        triggerSmartGiftWalletReminder(detail.cost, detail.name);
      }
    };
    window.addEventListener('shatmasr:gift_attempt', handleGiftAttempt);
    return () => window.removeEventListener('shatmasr:gift_attempt', handleGiftAttempt);
  }, [currentUser.coins, currentUser.role, onOpenWallet]);

  // Welcome Toast Lifecycle on room entry for current user (auto-disappears after exactly 3s)
  useEffect(() => {
    triggerWelcomeToast({
      name: currentUser.name,
      avatar: currentUser.avatar,
      vipBadge: currentUser.vipBadge
    });

    return () => {
      toastTimeoutRef.current.forEach(t => clearTimeout(t));
    };
  }, [room.id]);

  // Welcome Toast trigger when ANY other user enters the room via system messages
  const lastProcessedMsgIdRef = useRef<string>('');
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.id !== lastProcessedMsgIdRef.current) {
      lastProcessedMsgIdRef.current = latest.id;
      if (
        latest.type === 'system_welcome' &&
        latest.senderName &&
        latest.senderId !== currentUser.id &&
        latest.senderId !== 'system_bot'
      ) {
        triggerWelcomeToast({
          name: latest.senderName,
          avatar: latest.senderAvatar,
          vipBadge: latest.senderVipBadge || 'عضو جديد'
        });
      }
    }
  }, [messages.length]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    if (isEmojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen]);

  // Deduplicate messages by ID and content fingerprint
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      const key = msg.id || `${msg.senderId}_${msg.content}_${Math.floor((msg.timestamp || 0) / 3000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages]);

  // Filter messages by type (All, Text only, Images only, Gifts only)
  const displayedMessages = React.useMemo(() => {
    return uniqueMessages.filter((msg) => {
      if (messageFilter === 'messages') {
        return msg.type === 'text' || (!msg.type && !msg.imageUrl && !msg.gift);
      }
      if (messageFilter === 'images') {
        return !!msg.imageUrl || msg.type === 'image';
      }
      if (messageFilter === 'gifts') {
        return msg.type === 'gift' || !!msg.gift;
      }
      return true;
    });
  }, [uniqueMessages, messageFilter]);

  // Auto scroll to bottom & sound notification on new incoming messages + mark incoming private messages as read
  const prevMessagesCountRef = useRef(uniqueMessages.length);
  useEffect(() => {
    if (uniqueMessages.length > prevMessagesCountRef.current) {
      const latestMsg = uniqueMessages[uniqueMessages.length - 1];
      if (latestMsg && latestMsg.senderId !== currentUser.id) {
        sounds.playMessageReceived();
        if (latestMsg.type === 'private' || latestMsg.isPrivate) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([120, 60, 120]); } catch {}
          }
        }
      }
    }
    prevMessagesCountRef.current = uniqueMessages.length;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Update Firestore/RTDB status -> 'read' for private messages viewed by the recipient
    const hasUnreadPrivate = uniqueMessages.some(
      m =>
        (m.isPrivate || m.type === 'private') &&
        m.senderId !== currentUser.id &&
        (!m.recipientId || m.recipientId === currentUser.id) &&
        m.status !== 'read'
    );
    if (hasUnreadPrivate) {
      markRoomPrivateMessagesAsRead(room.id, currentUser.id, uniqueMessages);
    }
  }, [uniqueMessages, currentUser.id, room.id]);

  // Subscribe to room join requests if private & host
  useEffect(() => {
    if (!room.isPrivate) return;
    const unsub = subscribeToRoomJoinRequests(room.id, (reqs) => {
      setPendingJoinRequests(reqs);
    });
    return () => unsub();
  }, [room.id, room.isPrivate]);

  // Voice recording timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRecordingVoice) {
      timer = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  // Send Text Message
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      badges: currentUser.badges || ['عضو نشط'],
      type: 'text',
      content: text,
      text: text,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        content: replyingTo.content || replyingTo.text || '',
        type: replyingTo.type
      } : undefined,
      timestamp: Date.now(),
      status: 'read'
    });

    setInputText('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftStorageKey);
    }
    updateReplyingTo(null);
    setRoomTyping(room.id, currentUser, false);
    setIsEmojiPickerOpen(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    const updated = inputText + emoji;
    setInputText(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(draftStorageKey, updated);
    }
    inputRef.current?.focus();
  };

  // Instant Welcoming Phrase Sender (الجمل الترحيبية)
  const handleSendWelcomePhrase = (phrase: string) => {
    if (currentUser.isBanned || currentUser.isMuted) return;
    sounds.playMessageSent();
    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: currentUser.vipBadge,
      badges: currentUser.badges || ['عضو نشط'],
      type: 'text',
      content: phrase,
      text: phrase,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        content: replyingTo.content || replyingTo.text || '',
        type: replyingTo.type
      } : undefined,
      timestamp: Date.now(),
      status: 'read'
    });
    updateReplyingTo(null);
    setRoomTyping(room.id, currentUser, false);
  };

  // Toggle audio play
  const togglePlayVoice = (msgId: string, audioUrl?: string, duration?: number) => {
    if (playingVoiceId === msgId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      setPlayingVoiceId(msgId);
      audio.play().catch(e => {
        console.warn("Audio playback error:", e);
        sounds.playMessageReceived();
      });
      audio.onended = () => {
        setPlayingVoiceId(null);
        audioPlayerRef.current = null;
      };
    } else {
      sounds.playMessageReceived();
      setPlayingVoiceId(msgId);
      setTimeout(() => setPlayingVoiceId(null), (duration || 3) * 1000);
    }
  };

  // Start voice record with cross-browser MIME detection (iOS Safari + Android Chrome)
  const handleStartVoiceRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = options.mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      sounds.playMicToggle(true);
      setIsRecordingVoice(true);
    } catch (err) {
      console.warn("Mic access notice:", err);
      sounds.playMicToggle(true);
      setIsRecordingVoice(true);
    }
  };

  // Stop voice record & send
  const handleStopVoiceRecordAndSend = () => {
    const recorder = mediaRecorderRef.current;
    const duration = recordingSeconds || 3;

    if (!recorder || recorder.state === 'inactive') {
      sounds.playMessageSent();
      onSendMessage({
        roomId: room.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        senderVipBadge: currentUser.vipBadge,
        badges: currentUser.badges || ['عضو نشط'],
        type: 'voice',
        content: `🎤 رسالة صوتية (0:${duration < 10 ? '0' : ''}${duration})`,
        audioDuration: duration,
        timestamp: Date.now(),
        status: 'read'
      });
      setIsRecordingVoice(false);
      setRecordingSeconds(0);
      return;
    }

    recorder.onstop = () => {
      const recordedType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: recordedType });
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        sounds.playMessageSent();
        onSendMessage({
          roomId: room.id,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderRole: currentUser.role,
          senderVipBadge: currentUser.vipBadge,
          badges: currentUser.badges || ['عضو نشط'],
          type: 'voice',
          content: `🎤 رسالة صوتية (0:${duration < 10 ? '0' : ''}${duration})`,
          audioUrl: base64Audio,
          audioDuration: duration,
          timestamp: Date.now(),
          status: 'read'
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    recorder.stop();
    sounds.playMicToggle(false);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const handleCancelVoiceRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    sounds.playMicToggle(false);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // Join request handlers for host
  const handleAcceptJoinRequest = async (targetUserId: string) => {
    await resolveRoomJoinRequest(room.id, targetUserId, 'accepted');
    setPendingJoinRequests(prev => prev.filter(r => r.userId !== targetUserId));
    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: 'المضيف',
      senderAvatar: currentUser.avatar,
      senderRole: 'admin',
      senderVipBadge: 'مضيف الغرفة',
      type: 'system_welcome',
      content: `✅ وافق المضيف على انضمام عضو جديد إلى المجلس الخاص.`,
      timestamp: Date.now(),
      status: 'read'
    });
  };

  const handleRejectJoinRequest = async (targetUserId: string) => {
    await resolveRoomJoinRequest(room.id, targetUserId, 'rejected');
    setPendingJoinRequests(prev => prev.filter(r => r.userId !== targetUserId));
  };

  const handlePinCustomMessage = () => {
    if (!newPinText.trim()) return;
    sounds.playMessageSent();
    const pin = {
      id: `pin_${Date.now()}`,
      senderName: currentUser.name,
      content: newPinText.trim()
    };
    setPinnedMessage(pin);
    setNewPinText('');
    setIsModeratorPanelOpen(false);
    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: 'المشرف',
      senderAvatar: currentUser.avatar,
      senderRole: 'admin',
      senderVipBadge: 'مشرف الغرفة',
      type: 'system_welcome',
      content: `📌 قام المشرف بتثبيت رسالة في أعلى الشات: "${pin.content}"`,
      timestamp: Date.now(),
      status: 'read'
    });
  };

  const handleUnpin = () => {
    sounds.playMicToggle(false);
    setPinnedMessage(null);
  };

  const handleMuteAllSpeakers = () => {
    if (!isModerator) return;
    sounds.playMicToggle(false);
    const updated = (room.speakers || []).map(s => ({ ...s, isMuted: true, isTalking: false }));
    onUpdateSpeakers(updated);
    setIsModeratorPanelOpen(false);
  };

  const handleKickUser = (userId: string, userName: string) => {
    if (!isModerator) return;
    sounds.playMicToggle(false);
    setBannedUserIds(prev => [...prev, userId]);
    const updated = (room.speakers || []).map(s => s.user?.id === userId ? { ...s, user: null, isMuted: true, isTalking: false } : s);
    onUpdateSpeakers(updated);
    setIsModeratorPanelOpen(false);
    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: 'المشرف',
      senderAvatar: currentUser.avatar,
      senderRole: 'admin',
      senderVipBadge: 'مشرف الغرفة',
      type: 'system_welcome',
      content: `🚪 قام المشرف بطرد العضو [${userName}] من الغرفة.`,
      timestamp: Date.now(),
      status: 'read'
    });
  };

  const handleTasbeehClick = () => {
    sounds.playTasbeehClick();
    setTasbeehCount(prev => prev + 1);
  };

  const openProfileFromMsg = (msg: Message) => {
    const isFromMe = msg.senderId === currentUser.id;
    onOpenUserProfile({
      id: msg.senderId,
      name: msg.senderName,
      username: msg.senderName.replace(/\s+/g, '_').toLowerCase(),
      avatar: msg.senderAvatar,
      bio: isFromMe ? currentUser.bio : 'عضو في شات مصر والعرب',
      country: isFromMe ? currentUser.country : 'مصر',
      countryFlag: isFromMe ? currentUser.countryFlag : '🇪🇬',
      role: msg.senderRole,
      coins: isFromMe ? currentUser.coins : 0,
      earningsEgp: 0,
      earningsUsd: 0,
      vipBadge: msg.senderVipBadge || 'عضو مميز',
      badges: msg.badges || ['عضو نشط'],
      ratingPoints: isFromMe ? currentUser.ratingPoints : 0,
      frameStyle: 'border-amber-400',
      profileWallpaper: '',
      fontPreference: 'cairo',
      isOnline: true,
      status: 'online',
      joinedAt: new Date().toISOString().split('T')[0],
      gender: 'male',
      level: isFromMe ? currentUser.level : 1,
      likesReceived: isFromMe ? currentUser.likesReceived : 0,
      giftsReceivedCount: isFromMe ? currentUser.giftsReceivedCount : 0
    });
  };

  // Strictly text-only room unless created explicitly as voice room with active voice
  const isTextOnly = room.type === 'text' || room.roomType === 'text_only' || !room.isVoiceActive;

  return (
    <div style={getRoomContainerStyle(room.id, currentUser.chatWallpaper)} className="relative flex flex-col h-screen w-full bg-[#f6f8fc] text-slate-900 overflow-hidden select-none">
      
      {/* 1. ROOM HEADER: Symmetric, Responsive, Zero-Overflow Modern Light Glass Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-2.5 sm:px-4 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 shrink-0 shadow-xs z-20">
        
        {/* Top / Right Row (RTL): Back Button, Room Icon, Room Title & Live Stats */}
        <div className="flex items-center justify-between gap-2 min-w-0 lg:flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Back Navigation Button */}
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/80 active:scale-95 transition-all shrink-0 flex items-center justify-center"
              title="الرجوع لقائمة الغرف"
            >
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${
              room.id === 'room_egypt'
                ? 'from-rose-500 via-amber-500 to-orange-500'
                : room.id === 'room_egypt2'
                ? 'from-cyan-500 via-blue-600 to-indigo-600'
                : room.iconBg || 'from-indigo-500 to-purple-600'
            } border-2 border-white shadow-sm flex items-center justify-center text-lg sm:text-xl shrink-0`}>
              {room.icon}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-tight">
                  {room.title}
                </h2>
                {room.isPrivate && (
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                    <Lock className="w-2.5 h-2.5" />
                    <span>خاصة</span>
                  </span>
                )}
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                {/* Online Users in Room Badge */}
                <button
                  type="button"
                  onClick={onOpenOnlineUsers}
                  className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-transform cursor-pointer shrink-0 whitespace-nowrap tabular-nums"
                  title="المتصلون الآن في هذه الغرفة"
                >
                  <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{Math.max(1, room.activeUsers || 1)} متصل</span>
                </button>

                {/* Total Active Visitors in Room Badge */}
                <div 
                  className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black flex items-center gap-1 shrink-0 whitespace-nowrap tabular-nums"
                  title="إجمالي زوار الغرفة التراكمي"
                >
                  <Eye className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{room.visitorsCount || '15,482'} زائر</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile & Tablet Primary Gift Button pinned neatly in top row */}
          <button
            type="button"
            onClick={handleOpenGiftWithReminder}
            className="lg:hidden h-9 px-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-[11px] flex items-center gap-1 shadow-sm active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="إرسال هدية فاخرة"
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span>هدية</span>
          </button>
        </div>

        {/* Action Toolbar: Symmetrical Uniform h-9 Sizing & Clean Horizontal Scroll without clipping */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 py-0.5 lg:py-0">
          {/* Invite Button */}
          <button
            type="button"
            onClick={() => {
              sounds.playMessageReceived();
              onOpenOnlineUsers();
            }}
            className="h-9 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="دعوة المتصلين إلى المجلس"
          >
            <Users className="w-3.5 h-3.5 text-white shrink-0" />
            <span>دعوة</span>
          </button>
          
          {/* 100 Arabic Songs Music Library Button */}
          <button
            type="button"
            onClick={() => setIsMusicModalOpen(true)}
            className="h-9 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="مكتبة الـ 100 أغنية طربية عربية"
          >
            <Music className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>100 أغنية</span>
          </button>

          {/* Customizable Chat Wallpaper Store Button */}
          <button
            type="button"
            onClick={() => setIsWallpapersModalOpen(true)}
            className="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="تغيير وشراء خلفيات الدردشة"
          >
            <Palette className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>الخلفيات</span>
          </button>

          {/* Private Room Join Requests Button for Host */}
          {isModerator && room.isPrivate && (
            <button
              type="button"
              onClick={() => setIsJoinRequestsOpen(true)}
              className="h-9 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold flex items-center gap-1.5 active:scale-95 shadow-xs shrink-0 whitespace-nowrap"
              title="طلبات الانضمام المعلقة"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>طلبات</span>
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9.5px] font-black flex items-center justify-center tabular-nums ${
                pendingJoinRequests.length > 0
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-indigo-100 text-indigo-700'
              }`}>
                {pendingJoinRequests.length}
              </span>
            </button>
          )}

          {/* Moderator Control Button - Only for voice/video rooms */}
          {isModerator && !isTextOnly && (
            <button
              type="button"
              onClick={() => setIsModeratorPanelOpen(true)}
              className="h-9 px-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
              title="لوحة تحكم المشرف"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>المشرف</span>
            </button>
          )}

          {/* Tasbeeh Drawer Toggle for Religious Room */}
          {room.category === 'religious' && (
            <button
              type="button"
              onClick={() => setShowTasbeeh(!showTasbeeh)}
              className="h-9 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap tabular-nums"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>مسبحة ({tasbeehCount})</span>
            </button>
          )}

          {/* Desktop Luxury Gift Button */}
          <button
            type="button"
            onClick={handleOpenGiftWithReminder}
            className="hidden lg:flex h-9 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs items-center gap-1 shadow-sm active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="إرسال هدية فاخرة"
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span>هدية 🎁</span>
          </button>
        </div>
      </header>

      {/* 3. Pinned Message Banner (Light Theme) */}
      {pinnedMessage && (
        <div className="bg-gradient-to-r from-amber-50 via-white to-indigo-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between text-xs shadow-xs shrink-0">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                مثبت:
              </span>
              <span className="text-[11px] text-slate-800 font-bold truncate">
                {pinnedMessage.content}
              </span>
            </div>
          </div>
          {isModerator && (
            <button
              onClick={handleUnpin}
              className="text-[10px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0 mr-1.5"
            >
              ✕ إلغاء
            </button>
          )}
        </div>
      )}

      {/* 4. Electronic Tasbeeh Drawer (Light Theme) */}
      {showTasbeeh && (
        <div className="bg-emerald-50 border-b border-emerald-200 p-2 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📿</span>
            <div>
              <p className="text-[11px] font-bold text-emerald-900">سبحان الله وبحمده، سبحان الله العظيم</p>
              <p className="text-[10px] text-emerald-700">عدد التسبيحات: {tasbeehCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTasbeehClick}
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs active:scale-95"
            >
              تسبيح +1
            </button>
            <button
              onClick={() => setTasbeehCount(0)}
              className="p-1 text-emerald-700 hover:text-emerald-900 text-[10px] font-bold"
            >
              تصفير
            </button>
          </div>
        </div>
      )}

      {/* 4.1. Top Message Type Filter Bar (Modern Light Theme) */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-2.5 py-1.5 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 font-bold shrink-0">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden xs:inline">تصفية العرض:</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setMessageFilter('all')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11.5px] font-black transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              messageFilter === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            عرض الكل 🌐
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('messages')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11.5px] font-black transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              messageFilter === 'messages'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            الرسائل فقط 💬
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('images')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11.5px] font-black transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              messageFilter === 'images'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            الصور فقط 🖼️
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('gifts')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11.5px] font-black transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              messageFilter === 'gifts'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            الهدايا فقط 🎁
          </button>
        </div>
      </div>

      {/* 4.5. Voice stage removed per request: الغاء المجلس الصوتي من الغرف */}
      {false && isSpeakerStageOpen && (
        <div className="bg-[#0b1120]/95 border-b border-indigo-900/40 p-2 sm:p-2.5 shrink-0 shadow-md backdrop-blur-md">
          {/* Top Bar: Title & Grid/List Toggle & Take Seat / Mic Button */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-[11px] font-black text-slate-200 flex items-center gap-1">
                منصة المتحدثين الصوتية
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                {((room.speakers || []).filter(s => s.user).length) || (isModerator ? 1 : 0)} متحدث
              </span>
            </div>

            {/* Toggle Switch: Grid vs List (النمط الشبكي / النمط الرأسي) */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sounds.playMicToggle(true);
                  setSpeakerLayoutMode('grid');
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                  speakerLayoutMode === 'grid'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض بنمط شبكة (Grid)"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>شبكة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playMicToggle(false);
                  setSpeakerLayoutMode('list');
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                  speakerLayoutMode === 'list'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض بنمط قائمة رأسية (List)"
              >
                <List className="w-3 h-3" />
                <span>قائمة</span>
              </button>
            </div>
          </div>

          {/* Speakers Display: Grid or Vertical List */}
          {speakerLayoutMode === 'grid' ? (
            /* GRID LAYOUT: 6 visual seats */
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, idx) => {
                const seatId = idx + 1;
                const seat = (room.speakers || []).find(s => s.seatId === seatId) || {
                  seatId,
                  user: (idx === 0 && isModerator) ? currentUser : null,
                  isMuted: false,
                  isTalking: idx === 0 && isModerator,
                  isVideo: false,
                };
                const user = seat.user;
                const isTalking = seat.isTalking && !seat.isMuted;

                return (
                  <div
                    key={seatId}
                    onClick={() => {
                      if (user) {
                        onOpenUserProfile(user);
                      } else {
                        sounds.playMicToggle(true);
                        const updated = [
                          ...(room.speakers || []).filter(s => s.seatId !== seatId && s.user?.id !== currentUser.id),
                          { seatId, user: currentUser, isMuted: false, isTalking: true, isVideo: false }
                        ];
                        onUpdateSpeakers(updated);
                        onSendMessage({
                          roomId: room.id,
                          senderId: currentUser.id,
                          senderName: currentUser.name,
                          senderAvatar: currentUser.avatar,
                          senderRole: currentUser.role,
                          senderVipBadge: currentUser.vipBadge,
                          type: 'system_welcome',
                          content: `🎤 صعد ${currentUser.name} على المايك #${seatId} في منصة الصوت!`
                        });
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-2xl cursor-pointer transition-all active:scale-95 ${
                      user
                        ? 'bg-slate-900/90 border border-slate-700/80 shadow-md hover:border-indigo-500/60'
                        : 'bg-slate-900/30 border border-dashed border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/30'
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 text-[8.5px] font-black text-slate-500">
                      #{seatId}
                    </span>

                    <div className="relative my-0.5">
                      {user ? (
                        <div className="relative">
                          {isTalking && (
                            <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping"></span>
                          )}
                          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 bg-gradient-to-tr from-indigo-700 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md ${
                            isTalking ? 'border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : 'border-slate-700'
                          }`}>
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span>{user.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-[#080c15] text-[9px] ${
                            seat.isMuted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                          }`}>
                            {seat.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400">
                          <Mic className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[7.5px] font-bold">صعود</span>
                        </div>
                      )}
                    </div>

                    <div className="text-center w-full px-0.5 mt-0.5">
                      {user ? (
                        <>
                          <p className="text-[10px] font-bold text-slate-200 truncate">{user.name}</p>
                          <p className="text-[8.5px] text-amber-400 truncate">
                            {user.countryFlag} {seatId === 1 ? 'المضيف' : user.vipBadge || 'متحدث'}
                          </p>
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-500">شاغر</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VERTICAL LIST LAYOUT (Requirement 9) */
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
              {Array.from({ length: 6 }).map((_, idx) => {
                const seatId = idx + 1;
                const seat = (room.speakers || []).find(s => s.seatId === seatId) || {
                  seatId,
                  user: (idx === 0 && isModerator) ? currentUser : null,
                  isMuted: false,
                  isTalking: idx === 0 && isModerator,
                  isVideo: false,
                };
                const user = seat.user;
                const isTalking = seat.isTalking && !seat.isMuted;

                return (
                  <div
                    key={seatId}
                    onClick={() => {
                      if (user) {
                        onOpenUserProfile(user);
                      } else {
                        sounds.playMicToggle(true);
                        const updated = [
                          ...(room.speakers || []).filter(s => s.seatId !== seatId && s.user?.id !== currentUser.id),
                          { seatId, user: currentUser, isMuted: false, isTalking: true, isVideo: false }
                        ];
                        onUpdateSpeakers(updated);
                        onSendMessage({
                          roomId: room.id,
                          senderId: currentUser.id,
                          senderName: currentUser.name,
                          senderAvatar: currentUser.avatar,
                          senderRole: currentUser.role,
                          senderVipBadge: currentUser.vipBadge,
                          type: 'system_welcome',
                          content: `🎤 صعد ${currentUser.name} على المايك #${seatId} في منصة الصوت!`
                        });
                      }
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer active:scale-[0.99] ${
                      user
                        ? 'bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50'
                        : 'bg-slate-900/20 border border-dashed border-slate-800/80 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Left: Mic status & sound indicator */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 w-5">#{seatId}</span>
                      {user && (
                        <div className={`p-1 rounded-lg text-xs ${
                          seat.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {seat.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      {isTalking && (
                        <div className="flex items-center gap-0.5">
                          <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce"></span>
                          <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      )}
                    </div>

                    {/* Right: User info or Empty Seat prompt */}
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        {user ? (
                          <>
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-xs font-black text-white">{user.name}</span>
                              <span className="text-xs">{user.countryFlag}</span>
                            </div>
                            <span className="text-[9.5px] text-amber-400 font-bold block">
                              {seatId === 1 ? 'المضيف الرسمي' : user.vipBadge || 'متحدث على المنصة'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">مقعد شاغر • اضغط للصعود 🎤</span>
                        )}
                      </div>

                      <div className="relative">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white">
                          {user?.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{user ? user.name.charAt(0) : '+'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Animated Welcome Toast (Modern Light Pill Card) */}
      {welcomeToast.state !== 'hidden' && (
        <div 
          className={`fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none transition-all duration-400 ease-out transform ${
            welcomeToast.state === 'visible'
              ? 'opacity-100 translate-y-0 scale-100'
              : welcomeToast.state === 'initial'
              ? 'opacity-0 translate-y-6 scale-90'
              : 'opacity-0 -translate-y-4 scale-95'
          } max-w-[92vw] px-1`}
        >
          <div className="relative overflow-hidden rounded-full p-[1.5px] bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-500 shadow-lg">
            <div className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-xl flex items-center gap-2 text-slate-900 max-w-full">
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-amber-400 shrink-0 shadow-xs">
                {welcomeToast.user.avatar ? (
                  <img src={welcomeToast.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
                    {welcomeToast.user.name.charAt(0)}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white"></span>
              </div>

              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black truncate">
                <span className="text-amber-500 text-xs shrink-0">✨</span>
                <span className="text-slate-700 shrink-0">أهلاً بك</span>
                <span className="text-indigo-700 font-black truncate max-w-[95px] sm:max-w-[130px]">
                  {welcomeToast.user.name}
                </span>
                <span className="text-slate-500 shrink-0">في</span>
                <span className="text-amber-700 font-bold truncate max-w-[85px] sm:max-w-[115px]">{room.title}</span>
                <span className="text-pink-500 text-xs shrink-0">🌸</span>
              </div>

              {welcomeToast.user.vipBadge && (
                <span className="hidden md:inline-flex px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold shrink-0">
                  {welcomeToast.user.vipBadge}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Chat Wallpaper & Feed Scroll Area */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {/* Scrollable Messages Feed */}
        <div className="relative z-10 flex-1 overflow-y-auto p-2.5 sm:p-3.5 space-y-2.5 scroll-smooth text-right">
        {displayedMessages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.id;
          const isPrivateMsg = msg.type === 'private' || msg.isPrivate;
          const uniqueKey = `${msg.id || 'msg'}_${idx}`;

          // System Bot Welcome Card (Warm, multi-line, encouraging participation)
          if (msg.type === 'system_welcome' && msg.senderId === 'system_bot') {
            return (
              <motion.div
                key={uniqueKey}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex justify-center my-2.5 px-1"
              >
                <div className="relative overflow-hidden max-w-[95%] sm:max-w-lg w-full rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-amber-50 border border-indigo-200/90 p-3.5 shadow-md text-right">
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-indigo-900">
                            {msg.senderName || 'بوت شات مصر'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[9.5px] font-black flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                            <span>بوت النظام</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ترحيب آلي ✨
                        </span>
                      </div>

                      <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 font-semibold whitespace-pre-line">
                        {filterInappropriateText(msg.content)}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSendMessage({
                              roomId: room.id,
                              senderId: currentUser.id,
                              senderName: currentUser.name,
                              senderAvatar: currentUser.avatar,
                              senderRole: currentUser.role,
                              senderVipBadge: currentUser.vipBadge,
                              type: 'text',
                              content: 'السلام عليكم جميعاً! 🌟 سعيد جداً بانضمامي إليكم',
                              timestamp: Date.now(),
                              status: 'read',
                            });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold shadow-xs active:scale-95 transition-all"
                        >
                          إلقاء التحية 👋
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputText('أهلاً بكم يا أحلى أصدقاء! 💬✨ ')}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold active:scale-95 transition-all"
                        >
                          ابدأ بمشاركتك ✍️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }

          // Standard system notice banner (Light crisp banner)
          if (msg.type === 'system_welcome') {
            return (
              <motion.div 
                key={uniqueKey} 
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center my-1"
              >
                <div className="max-w-[90%] px-3 py-1 rounded-full bg-white/90 border border-indigo-200 text-indigo-700 text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 shadow-xs backdrop-blur-sm truncate">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="truncate">{filterInappropriateText(msg.content)}</span>
                </div>
              </motion.div>
            );
          }

          // Luxury Virtual Gift Message (Modern Light Pearl/Gold Card)
          if (msg.type === 'gift' && msg.gift) {
            return (
              <motion.div 
                key={uniqueKey} 
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, type: 'spring' }}
                className="flex justify-center my-3 px-1"
              >
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-50 via-white to-rose-50 border-2 border-amber-300 p-3 sm:p-4 max-w-[94%] sm:max-w-md w-full shadow-lg">
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <motion.span
                        aria-hidden="true"
                        initial={{ scale: 0.9, opacity: 0.7 }}
                        animate={{ scale: [1, 1.28, 1], opacity: [0.65, 0, 0.65] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-2xl bg-amber-400/50 pointer-events-none"
                      />
                      <motion.div
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: [1, 1.12, 1], opacity: 1 }}
                        transition={{
                          opacity: { duration: 0.25 },
                          scale: {
                            duration: 1.4,
                            repeat: Infinity,
                            ease: 'easeInOut'
                          }
                        }}
                        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-100/90 border border-amber-300 flex items-center justify-center text-3xl sm:text-4xl shadow-md"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          className="inline-block select-none"
                        >
                          {msg.gift.icon}
                        </motion.span>
                      </motion.div>
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                    </div>

                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playGiftFanfare();
                            confetti({
                              particleCount: 75,
                              spread: 60,
                              origin: { y: 0.6 }
                            });
                          }}
                          className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center gap-1 active:scale-95 transition-transform"
                          title="إعادة تشغيل مؤثرات الاحتفال"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>إعادة الاحتفال ✨</span>
                        </button>

                        <div className="text-[11px] sm:text-xs font-black text-amber-700 flex items-center gap-1 truncate">
                          <span>هدية فاخرة: {msg.gift.name}</span>
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                        <span className="text-indigo-700">{msg.senderName}</span>
                        <span className="text-slate-600 mx-1">أهدى</span>
                        <span className="text-rose-600 font-black">{msg.gift.name}</span>
                        <span className="text-slate-600 mx-1">إلى</span>
                        <span className="text-amber-700 font-black">{msg.gift.recipientName}</span>
                      </p>

                      <div className="flex items-center justify-end gap-1.5 mt-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black">
                          🪙 {msg.gift.cost.toLocaleString()} كوينز
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }

          const isVipSender = Boolean(
            msg.senderVipBadge ||
              (msg as any).isVip ||
              (msg.senderRole &&
                (msg.senderRole.includes('vip') ||
                  msg.senderRole.includes('VIP') ||
                  msg.senderRole === 'owner' ||
                  msg.senderRole === 'super_admin'))
          );

          return (
            <motion.div
              key={uniqueKey}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="flex items-start gap-1.5 sm:gap-2 justify-start group"
            >
              {/* Click Avatar to View User Profile */}
              <div 
                onClick={() => openProfileFromMsg(msg)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-indigo-50 border flex items-center justify-center font-bold text-xs text-indigo-700 shrink-0 mt-0.5 cursor-pointer hover:scale-105 active:scale-95 transition-transform shadow-xs ${
                  isVipSender ? 'border-2 border-amber-400 ring-1 ring-amber-300/60' : 'border-slate-200'
                }`}
                title="عرض الملف الشخصي"
              >
                {msg.senderAvatar ? (
                  <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{msg.senderName.charAt(0)}</span>
                )}
              </div>

              {/* Message Bubble Container */}
              <div className="max-w-[85%] sm:max-w-[78%] space-y-0.5 text-right">
                
                {/* Sender Name & Badges */}
                <div className="flex items-center gap-1 text-[10px] font-bold flex-wrap">
                  <span 
                    onClick={() => openProfileFromMsg(msg)}
                    className="cursor-pointer hover:underline text-slate-800 font-black"
                  >
                    {msg.senderName}
                  </span>
                  {msg.senderVipBadge && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-800 text-[9px] flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5 text-amber-500" />
                      <span>{msg.senderVipBadge}</span>
                    </span>
                  )}
                  
                  {msg.badges?.includes('أكثر الأعضاء نشاطاً') && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[8.5px] font-bold border border-amber-200 flex items-center gap-0.5">
                      🔥 أنشط عضو
                    </span>
                  )}
                  {msg.badges?.includes('أفضل مذيع') && (
                    <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[8.5px] font-bold border border-purple-200 flex items-center gap-0.5">
                      🎙️ أفضل مذيع
                    </span>
                  )}
                  {msg.badges?.includes('المحترف') && (
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[8.5px] font-bold border border-cyan-200 flex items-center gap-0.5">
                      🏆 Pro
                    </span>
                  )}
                  {msg.badges && msg.badges.filter(b => !['أكثر الأعضاء نشاطاً', 'أفضل مذيع', 'المحترف'].includes(b)).map((bName, bIdx) => (
                    <span 
                      key={bIdx}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8.5px] flex items-center gap-0.5"
                    >
                      <span>{bName}</span>
                    </span>
                  ))}
                  
                  {/* Reply Button on Message */}
                  <button
                    onClick={() => updateReplyingTo(msg)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-600 text-[10px] flex items-center gap-0.5 transition-opacity mr-1"
                    title="رد على الرسالة"
                  >
                    <Reply className="w-2.5 h-2.5" />
                    <span>رد</span>
                  </button>
                </div>

                {/* Bubble Body with Double-Click / Long-Press / Swipe-Reply / Context Menu */}
                <div 
                  ref={(el) => { messageRefs.current[msg.id] = el; }}
                  onDoubleClick={(e) => handleMessageDoubleTap(msg, e)}
                  onMouseDown={(e) => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = setTimeout(() => {
                      setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                    }, 550);
                  }}
                  onMouseUp={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onMouseLeave={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    touchStartXRef.current = touch.clientX;
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = setTimeout(() => {
                      if (navigator.vibrate) navigator.vibrate(50);
                      setActiveContextMenu({ msg, x: touch.clientX, y: touch.clientY });
                    }, 550);
                  }}
                  onTouchMove={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onTouchCancel={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  }}
                  onTouchEnd={(e) => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
                    if (diff > 55) {
                      sounds.playMessageSent();
                      updateReplyingTo(msg);
                      return;
                    }
                    const now = Date.now();
                    const lastTap = lastTapRef.current[msg.id] || 0;
                    if (now - lastTap < 300) {
                      handleMessageDoubleTap(msg, e);
                    }
                    lastTapRef.current[msg.id] = now;
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveContextMenu({ msg, x: e.clientX, y: e.clientY });
                  }}
                  className={`relative cursor-pointer rounded-2xl px-3.5 py-2 shadow-sm text-xs sm:text-sm leading-relaxed transition-all active:scale-[0.99] select-text ${
                    highlightedMsgId === msg.id 
                      ? 'ring-2 ring-amber-400 scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.45)]' 
                      : ''
                  } ${
                    isVipSender
                      ? 'border-2 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.55)] ring-1 ring-amber-300/70'
                      : ''
                  } ${
                    isMe 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none shadow-indigo-500/20' 
                      : isVipSender
                      ? 'bg-white text-slate-900 rounded-tl-none'
                      : 'bg-white/95 border border-slate-200 text-slate-900 rounded-tl-none'
                  }`}
                  title="اضغط مطولاً أو انقر باليمين للتفاعل أو الحذف | انقر مرتين لإعجاب ❤️"
                >
                  
                  {/* Quoted Reply Preview */}
                  {msg.replyTo && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToMessage(msg.replyTo?.id);
                      }}
                      className={`mb-1.5 p-1.5 rounded-xl border-r-4 border-amber-400 text-[10px] text-right cursor-pointer transition-colors ${
                        isMe ? 'bg-black/20 hover:bg-black/30' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                      title="اضغط للانتقال إلى الرسالة الأصلية"
                    >
                      <div className={`flex items-center gap-1 font-bold ${isMe ? 'text-amber-200' : 'text-amber-700'}`}>
                        {msg.replyTo.type === 'voice' ? (
                          <Mic className="w-3 h-3 text-cyan-400 shrink-0" />
                        ) : msg.replyTo.type === 'gift' ? (
                          <Gift className="w-3 h-3 text-pink-400 shrink-0" />
                        ) : msg.replyTo.type === 'image' ? (
                          <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                        ) : (
                          <MessageSquare className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                        <span>رد على {msg.replyTo.senderName}:</span>
                      </div>
                      <span className={`truncate block mt-0.5 ${isMe ? 'text-white/85' : 'text-slate-600'}`}>
                        {filterInappropriateText(msg.replyTo.content)}
                      </span>
                    </div>
                  )}

                  {/* Voice Note Player */}
                  {msg.type === 'voice' ? (
                    <div className="flex items-center gap-2 py-0.5 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayVoice(msg.id, msg.audioUrl || msg.voiceUrl, msg.audioDuration);
                        }}
                        className={`p-1.5 rounded-full transition-transform active:scale-95 ${
                          isMe ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {playingVoiceId === msg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>

                      <div className="flex items-center gap-0.5 flex-1">
                        <span className={`w-0.5 h-2.5 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-1 bg-amber-400' : 'bg-slate-400'}`}></span>
                        <span className={`w-0.5 h-4 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-2 bg-amber-400' : 'bg-slate-400'}`}></span>
                        <span className={`w-0.5 h-2 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-3 bg-amber-400' : 'bg-slate-400'}`}></span>
                        <span className={`w-0.5 h-3.5 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-4 bg-amber-400' : 'bg-slate-400'}`}></span>
                      </div>

                      <span className="text-[9px] font-mono opacity-80">
                        {msg.audioDuration ? `0:${msg.audioDuration < 10 ? '0' : ''}${msg.audioDuration}` : '0:05'}
                      </span>
                    </div>
                  ) : (
                    /* Inline filtered message text */
                    <p className="whitespace-pre-wrap leading-relaxed break-words text-xs sm:text-sm font-medium">
                      {filterInappropriateText(msg.content)}
                    </p>
                  )}

                  {/* Timestamp & Read Receipts */}
                  <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${isMe ? 'text-white/85' : 'text-slate-500'}`}>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <span className="inline-flex items-center gap-0.5">
                        {msg.status === 'read' ? (
                          <span title="تم القراءة" className="inline-flex items-center gap-0.5">
                            <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                            {isPrivateMsg && <span className="text-[8.5px] font-bold text-cyan-100">تم القراءة</span>}
                          </span>
                        ) : msg.status === 'sent' ? (
                          <span title="تم الإرسال"><Check className="w-3.5 h-3.5 text-slate-200" /></span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-amber-200 text-[8.5px]" title="جاري الإرسال">
                            <Clock className="w-2.5 h-2.5 animate-spin" />
                            <span>جاري</span>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Reactions Row */}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {msg.reactions && Object.entries(msg.reactions).map(([emoji, count]) => {
                    if (count <= 0) return null;
                    const userReacted = msg.userReactions && msg.userReactions[currentUser.id] === emoji;
                    const usersList = msg.reactionUsers?.[emoji] || [];
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleMessageReaction(room.id, msg.id, emoji, currentUser.id, currentUser.name, msg)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (usersList.length > 0) setReactionUsersModal({ emoji, users: usersList });
                        }}
                        title={`تفاعل: ${usersList.join('، ') || emoji}`}
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-all active:scale-95 ${
                          userReacted
                            ? 'bg-indigo-100 border-indigo-400 text-indigo-800 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </button>
                    );
                  })}

                  {/* Quick Reaction Bar on Bubble Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5 border border-slate-200 shadow-sm">
                    {['❤️', '👍', '😂', '🔥', '👏'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => toggleMessageReaction(room.id, msg.id, em, currentUser.id, currentUser.name, msg)}
                        className="hover:scale-125 active:scale-90 text-[11px] transition-transform p-0.5"
                        title={`تفاعل بـ ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 7. Replying To Banner Preview */}
      {replyingTo && (
        <div className="bg-indigo-50 border-t border-indigo-200 px-3 py-1 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Reply className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-indigo-800">الرد على {replyingTo.senderName}:</span>
            <span className="text-[11px] text-slate-600 truncate max-w-[220px]">{filterInappropriateText(replyingTo.content)}</span>
          </div>
          <button onClick={() => updateReplyingTo(null)} className="p-0.5 text-slate-500 hover:text-slate-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 8. Voice Recording Live Banner */}
      {isRecordingVoice && (
        <div className="bg-red-50 border-t border-red-200 px-3 py-1.5 flex items-center justify-between animate-pulse shrink-0">
          <div className="flex items-center gap-2 text-red-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>جاري التسجيل الصوتي... 0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCancelVoiceRecord}
              className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-bold"
            >
              إلغاء
            </button>
            <button
              onClick={handleStopVoiceRecordAndSend}
              className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>إرسال</span>
            </button>
          </div>
        </div>
      )}

      {/* 8.5. Quick Welcoming Phrases Bar (Modern Light Theme) */}
      <div className="bg-white/95 border-t border-slate-200 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 z-20">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black shrink-0 whitespace-nowrap">
          <span>🌸</span>
          <span>ترحيب:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {WELCOME_PHRASES.map((phrase, idx) => (
            <button
              key={idx}
              type="button"
              disabled={currentUser.isBanned || currentUser.isMuted}
              onClick={() => handleSendWelcomePhrase(phrase)}
              className="px-2.5 py-1 rounded-full bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 hover:text-amber-800 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="اضغط لإرسال الترحيب فوراً"
            >
              <span>{phrase}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 8.7. Realtime Typing Indicator ("جاري الكتابة..." beneath chat feed via realtimeSocket & RTDB) */}
      {typingUsers.length > 0 && (
        <div className="bg-indigo-50/95 border-t border-indigo-200 px-3 py-1 flex items-center gap-2 text-xs text-indigo-700 shrink-0 z-20">
          <div className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="font-bold text-[11px]">
            {typingUsers.map(u => u.name).join(' و ')} جاري الكتابة...
          </span>
        </div>
      )}

      {/* 8.8. 1-Click Instant Ready Response Bar (Modern Light Theme) */}
      <div className="bg-slate-50/95 border-t border-slate-200 px-2 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 z-20">
        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black shrink-0 whitespace-nowrap">
          <span>⚡</span>
          <span>ردود سريعة:</span>
        </div>
        {[
          'وعليكم السلام 🌹',
          'شكراً جزيلاً ✨',
          'منور الشات يا غالي 👋',
          'أهلاً وسهلاً 🌸',
          'تسلم يا ذوق 💫',
          'صح لسانك 👏',
          'جزاك الله خيراً 🤲',
          'مساء/صباح الورد 🌺',
          'بالتوفيق إن شاء الله 🎯'
        ].map((phrase, idx) => (
          <button
            key={idx}
            type="button"
            disabled={currentUser.isBanned || currentUser.isMuted}
            onClick={() => handleSendWelcomePhrase(phrase)}
            title="إرسال فوري بضغطة واحدة"
            className="px-2.5 py-0.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-[10.5px] font-medium whitespace-nowrap active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-40 shadow-2xs"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* 9. BOTTOM INPUT BAR (Modern Light Theme) */}
      <div className="relative bg-white border-t border-slate-200 p-1.5 sm:p-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)] flex items-center gap-1.5 shrink-0 z-20">
        
        {/* Luxury Gift Button Shortcut */}
        <button
          onClick={handleOpenGiftWithReminder}
          className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white hover:scale-105 active:scale-95 transition-transform shrink-0 shadow-sm min-h-[38px] min-w-[38px] flex items-center justify-center"
          title="إرسال هدية فاخرة"
        >
          <Gift className="w-4 h-4" />
        </button>

        {/* Text Input with Form */}
        <form onSubmit={handleSendText} className="flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            disabled={currentUser.isBanned || currentUser.isMuted}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={
              currentUser.isBanned
                ? "عفواً، حسابك محظور من الإدارة 🚫"
                : currentUser.isMuted
                ? "أنت مكتوم حالياً بواسطة الإدارة 🔇"
                : "اكتب رسالتك في المجلس..."
            }
            className={`w-full bg-slate-100 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors ${
              currentUser.isBanned || currentUser.isMuted ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''
            }`}
          />
        </form>

        {/* Inline Emoji Picker Button */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            disabled={currentUser.isBanned || currentUser.isMuted}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-amber-600 active:scale-95 transition-all shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="إيموجيات وتعبيرات"
          >
            <span className="text-sm sm:text-base">😊</span>
          </button>

          {/* Compact Popup Emoji Picker Modal (Light Theme) */}
          {isEmojiPickerOpen && (
            <div className="absolute bottom-12 left-0 sm:left-auto sm:right-0 z-50 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-in slide-in-from-bottom-2">
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('faces')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'faces' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تعبيرات 😊
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('flags')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'flags' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أعلام 🇪🇬
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('fun')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'fun' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تفاعل 🔥
                </button>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 scrollbar-none">
                {EMOJI_CATEGORIES[activeEmojiTab].map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertEmoji(emoji)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-lg hover:scale-125 active:scale-95 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Send Button OR Voice Note Button */}
        {inputText.trim() ? (
          <button
            onClick={() => handleSendText()}
            disabled={currentUser.isBanned || currentUser.isMuted}
            className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-sm active:scale-95 transition-transform shrink-0 disabled:opacity-40 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="إرسال"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={isRecordingVoice ? handleStopVoiceRecordAndSend : handleStartVoiceRecord}
            disabled={currentUser.isBanned || currentUser.isMuted}
            className={`p-2 rounded-xl transition-all shrink-0 disabled:opacity-40 min-h-[38px] min-w-[38px] flex items-center justify-center ${
              isRecordingVoice 
                ? 'bg-red-600 text-white animate-pulse' 
                : 'bg-slate-100 text-slate-700 hover:text-indigo-600 hover:bg-slate-200 border border-slate-200'
            }`}
            title="تسجيل رسالة صوتية"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}

      </div>

      {/* Arabic Music Player Modal */}
      <ArabicMusicPlayerModal
        isOpen={isMusicModalOpen}
        onClose={() => setIsMusicModalOpen(false)}
        roomTitle={room.title}
        isHost={isModerator}
      />

      {/* Moderator Control Modal (Light Theme) */}
      {isModeratorPanelOpen && isModerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white border border-amber-300 rounded-2xl shadow-2xl p-4 space-y-3.5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-900">لوحة تحكم المشرفين</h3>
              </div>
              <button onClick={() => setIsModeratorPanelOpen(false)} className="text-slate-400 hover:text-slate-800 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pinned Message */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" />
                <span>تثبيت رسالة في أعلى الشات:</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newPinText}
                  onChange={(e) => setNewPinText(e.target.value)}
                  placeholder="اكتب الإعلان..."
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handlePinCustomMessage}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  تثبيت
                </button>
              </div>
            </div>

            {/* Mute Speakers */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5" />
                <span>كتم المايكات للمتحدثين:</span>
              </label>
              <button
                onClick={handleMuteAllSpeakers}
                className="w-full py-1.5 px-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 text-xs font-bold flex items-center justify-center gap-1"
              >
                <VolumeX className="w-3 h-3" />
                <span>كتم جميع المايكات</span>
              </button>
            </div>

            {/* Kick user */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-red-700 flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                <span>طرد مستخدم من الغرفة:</span>
              </label>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {uniqueMessages.filter(m => m.senderId !== currentUser.id && !bannedUserIds.includes(m.senderId)).slice(0, 3).map(m => (
                  <div key={m.senderId} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs">
                    <span className="text-slate-900 font-bold truncate max-w-[180px]">{m.senderName}</span>
                    <button
                      onClick={() => handleKickUser(m.senderId, m.senderName)}
                      className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                    >
                      طرد 🚪
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Requests Manager Modal */}
      <JoinRequestsManagerModal
        isOpen={isJoinRequestsOpen}
        onClose={() => setIsJoinRequestsOpen(false)}
        requests={pendingJoinRequests}
        onAccept={handleAcceptJoinRequest}
        onReject={handleRejectJoinRequest}
        roomTitle={room.title}
      />

      {/* Floating Heart Animations on Double-Tap */}
      {floatingHearts.map((h) => (
        <motion.div
          key={h.id}
          initial={{ scale: 0.4, opacity: 1, y: 0 }}
          animate={{ scale: [0.4, 1.8, 1.4], opacity: [1, 1, 0], y: -90 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ left: Math.max(10, h.x - 20), top: Math.max(10, h.y - 40) }}
          className="fixed z-50 pointer-events-none text-4xl select-none filter drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]"
        >
          ❤️
        </motion.div>
      ))}

      {/* Invite Members Copied Toast */}
      {inviteToastOpen && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>تم نسخ رابط دعوة الغرفة! شاركه مع أصدقائك 👥</span>
        </div>
      )}

      {/* Reaction Users Details Modal (Light Theme) */}
      {reactionUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="w-full max-w-xs bg-white border border-slate-200 rounded-3xl p-4 shadow-2xl text-right space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{reactionUsersModal.emoji}</span>
                <h4 className="text-xs font-black text-slate-900">المتفاعلون ({reactionUsersModal.users.length})</h4>
              </div>
              <button onClick={() => setReactionUsersModal(null)} className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {reactionUsersModal.users.map((uname, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900">
                  <span className="text-emerald-500">●</span>
                  <span className="font-bold">{uname}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Message Action Context Menu (Long-press & Right-click - Light Theme) */}
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

            {/* Quick Reactions (stored in Firestore + broadcast real-time) */}
            <div className="flex items-center justify-around py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {['❤️', '👍', '😂', '🔥', '👏', '🌸'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    toggleMessageReaction(
                      room.id,
                      activeContextMenu.msg.id,
                      em,
                      currentUser.id,
                      currentUser.name,
                      activeContextMenu.msg
                    );
                    setActiveContextMenu(null);
                  }}
                  className="text-xl hover:scale-125 active:scale-95 transition-transform p-1"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Reply Option */}
            <button
              onClick={() => {
                updateReplyingTo(activeContextMenu.msg);
                setActiveContextMenu(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition"
            >
              <Reply className="w-4 h-4 text-amber-500" />
              <span>رد على هذه الرسالة</span>
            </button>

            {/* Copy Text Option */}
            {activeContextMenu.msg.content && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeContextMenu.msg.content);
                  sounds.playMessageReceived();
                  setActiveContextMenu(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>نسخ نص الرسالة</span>
              </button>
            )}

            {/* Delete Message Option */}
            {(activeContextMenu.msg.senderId === currentUser.id || isUserAdminOrOwner(currentUser)) && (
              <button
                onClick={() => handleDeleteMessage(activeContextMenu.msg.id)}
                className="w-full px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 transition"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>حذف الرسالة نهائياً (للجميع) 🗑️</span>
              </button>
            )}

            <button
              onClick={() => setActiveContextMenu(null)}
              className="w-full py-1.5 text-center text-[11px] text-slate-500 hover:text-slate-800 font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Chat Wallpaper Customization & Purchasing Modal */}
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
