import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Play, 
  Pause, 
  X, 
  VolumeX, 
  Volume2,
  BookOpen, 
  Reply, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  Music,
  ChevronDown,
  Eye,
  Filter,
  Lock,
  Flag,
  Share2,
  Sticker,
  Unlock,
  Settings,
  Search,
  Hand,
  Ban,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MoreVertical,
  Palette,
  Crown,
  Trash2,
  Copy,
  MessageCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from '../utils/appToast';
import { Room, Message, User, SpeakerSeat } from '../types/chat';
import { isUserAdminOrOwner, LUXURY_GIFTS } from '../data/seedData';
import { STICKERS_CATALOG } from '../data/stickers';
import { JoinRequestsManagerModal } from './JoinRequestsManagerModal';
import { ArabicMusicPlayerModal } from './ArabicMusicPlayerModal';
import { ChatWallpapersModal } from './ChatWallpapersModal';
import { AvatarWithFrame } from './AvatarWithFrame';
import { MessageStatusIcon } from './MessageStatusIcon';
import { BlurredChatImage } from './BlurredChatImage';
import { getRankDisplayMeta } from '../utils/userRanks';
import { ANIMATED_INLINE_EMOJIS, InlineRichText } from './InlineRichText';
import { offlineQueue } from '../services/offlineQueue';
import { buildSmartAssistantReply } from '../utils/translateMessage';
import { compressImageFileToBlob } from '../utils/imageCompression';
import { 
  getWallpaperStyleById, 
  ROOM_BACKGROUND_THEMES, 
  getRoomBackgroundThemeById 
} from '../data/wallpapers';
import { 
  subscribeToRoomJoinRequests, 
  resolveRoomJoinRequest, 
  RoomJoinRequest,
  setRoomTyping,
  subscribeToRoomTyping,
  toggleMessageReaction,
  deleteRoomMessage,
  markRoomPrivateMessagesAsRead,
  setRoomPinnedMessage,
  subscribeToRoomPinnedMessage,
  PinnedRoomMessage,
  subscribeToRoomBackgroundTheme,
  setRoomLockState,
  subscribeToRoomLockState,
  contributeToSharedRoomMission,
  purgeRoomMessages,
  submitUserReport,
  adminUpdateUser,
  sendFriendRequest,
  uploadPrivateChatMedia
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
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
  onUpdateRoomBackground?: (backgroundTheme: string) => void;
  onUpdateRoomLock?: (isLocked: boolean) => void;
  onOpenUserProfile: (user: User) => void;
  onOpenPrivateChatWith?: (user: User) => void;
  onOpenMessagesDrawer?: () => void;
  unreadPrivateCount?: number;
  onSendGiftToUser?: (user: User) => void;
  onOpenOnlineUsers: () => void;
  onUpdateUser?: (user: User) => void;
  onOpenWallet?: () => void;
  onLoadOlderMessages?: () => Promise<number>;
  hasMoreOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
}

const PUBLIC_REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥'] as const;

type HighlightPaletteKey = 'sky' | 'amber' | 'rose' | 'emerald';

const HIGHLIGHT_OPTIONS: Array<{
  key: HighlightPaletteKey;
  label: string;
  dotClass: string;
  lightBoxClass: string;
  darkBoxClass: string;
}> = [
  {
    key: 'sky',
    label: 'سماوي',
    dotClass: 'bg-sky-500',
    lightBoxClass: 'bg-sky-50/85 border border-sky-200/90',
    darkBoxClass: 'bg-sky-900/35 border border-sky-400/35',
  },
  {
    key: 'amber',
    label: 'ذهبي',
    dotClass: 'bg-amber-500',
    lightBoxClass: 'bg-amber-50/85 border border-amber-200/90',
    darkBoxClass: 'bg-amber-900/35 border border-amber-400/35',
  },
  {
    key: 'rose',
    label: 'وردي',
    dotClass: 'bg-rose-500',
    lightBoxClass: 'bg-rose-50/85 border border-rose-200/90',
    darkBoxClass: 'bg-rose-900/35 border border-rose-400/35',
  },
  {
    key: 'emerald',
    label: 'زمردي',
    dotClass: 'bg-emerald-500',
    lightBoxClass: 'bg-emerald-50/85 border border-emerald-200/90',
    darkBoxClass: 'bg-emerald-900/35 border border-emerald-400/35',
  },
];

const EMOJI_CATEGORIES = {
  faces: ['😊', '😂', '😍', '❤️', '🔥', '✨', '🌹', '👍', '👏', '🎉', '🥰', '😎', '🤲', '🤍', '👑', '💯', '🙌', '😘', '🤩', '🌸', '☕', '💎', '🕊️', '🌿'],
  flags: ['🇪🇬', '🇸🇦', '🇦🇪', '🇲🇦', '🇮🇶', '🇰🇼', '🇩🇿', '🇸🇾', '🇯🇴', '🇵🇸', '🇱🇧', '🇹🇳', '🇴🇲', '🇧🇭', '🇶🇦', '🇾🇪', '🇸🇩', '🇱🇾', '🕌', '🕋', '📿', '🧿', '🦁', '🦅'],
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

export const getRoomContainerStyle = (
  roomId: string,
  userWallpaperId?: string,
  roomBackgroundTheme?: string
): React.CSSProperties => {
  // 1. Prioritize custom room background chosen by room manager
  if (roomBackgroundTheme && roomBackgroundTheme !== 'default') {
    const themeObj = getRoomBackgroundThemeById(roomBackgroundTheme);
    if (themeObj && Object.keys(themeObj.style).length > 0) {
      return themeObj.style;
    }
    if (roomBackgroundTheme.startsWith('#') || roomBackgroundTheme.startsWith('linear-gradient') || roomBackgroundTheme.startsWith('radial-gradient')) {
      return { background: roomBackgroundTheme };
    }
  }

  // 2. If user selected or purchased a personal wallpaper, use it
  if (userWallpaperId) {
    const customStyle = getWallpaperStyleById(userWallpaperId);
    if (customStyle && Object.keys(customStyle).length > 0) {
      return customStyle;
    }
  }

  // 3. Egypt Room 1 & 2: Clean luminous white-veil over Egyptian wallpaper for crisp inline chat legibility
  if (roomId === 'room_egypt' || roomId === 'room_egypt2') {
    return {
      backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.91)), url('/assets/wallpapers/egypt_chat_bg.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  }
  // Other Arab Rooms: Clean bright white-veil over subtle doodle pattern
  return {
    backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.88), rgba(248, 250, 252, 0.94)), url('/assets/wallpapers/doodle_chat_bg.jpg')",
    backgroundSize: '340px',
    backgroundRepeat: 'repeat',
  };
};

const DARK_PERSONAL_WALLPAPERS = new Set([
  'wp_nature_nile_sunset',
  'wp_nature_starry_oasis',
  'wp_doodle_custom',
  'wp_egypt_gold',
  'wp_egypt_sunset',
  'wp_doodle_arab',
  'wp_cairo_night',
  'wp_royal_palace',
  'wp_alex_turquoise',
  'wp_desert_stars',
  'wp_fatimid_heritage',
  'wp_minimal_dark',
]);

const SENDER_STYLE_PALETTE = [
  { name: 'text-rose-700 chat-text-outline-strong' },
  { name: 'text-sky-800 chat-text-outline-strong' },
  { name: 'text-fuchsia-800 chat-text-outline-strong' },
  { name: 'text-teal-800 chat-text-outline-strong' },
  { name: 'text-indigo-800 chat-text-outline-strong' },
  { name: 'text-amber-800 chat-text-outline-strong' },
  { name: 'text-emerald-800 chat-text-outline-strong' },
  { name: 'text-purple-800 chat-text-outline-strong' },
];

const SENDER_STYLE_PALETTE_DARK = [
  { name: 'text-rose-300 chat-text-outline-strong-dark' },
  { name: 'text-sky-300 chat-text-outline-strong-dark' },
  { name: 'text-fuchsia-300 chat-text-outline-strong-dark' },
  { name: 'text-teal-300 chat-text-outline-strong-dark' },
  { name: 'text-indigo-300 chat-text-outline-strong-dark' },
  { name: 'text-amber-300 chat-text-outline-strong-dark' },
  { name: 'text-emerald-300 chat-text-outline-strong-dark' },
  { name: 'text-purple-300 chat-text-outline-strong-dark' },
];

function getSenderChatStyle(
  senderId: string,
  senderRole?: string,
  senderVipBadge?: string,
  isDark: boolean = false
) {
  const rankMeta = getRankDisplayMeta(senderRole, senderVipBadge);
  if (rankMeta.isPrivileged) {
    return {
      isPrivileged: true,
      name: isDark ? rankMeta.nameColorDarkClass : rankMeta.nameColorClass,
      rowBg: isDark ? rankMeta.msgBgDarkClass : rankMeta.msgBgClass,
      badge: rankMeta.shortIcon,
      rankMeta,
    };
  }
  let hash = 0;
  for (let i = 0; i < (senderId || 'u').length; i++) {
    hash = (hash * 31 + senderId.charCodeAt(i)) >>> 0;
  }
  const palette = isDark ? SENDER_STYLE_PALETTE_DARK : SENDER_STYLE_PALETTE;
  const picked = palette[hash % palette.length];
  return {
    isPrivileged: false,
    name: picked.name,
    rowBg: '',
    badge: '',
    rankMeta,
  };
}

interface RoomPublicMessageRowProps {
  msg: Message;
  isMe: boolean;
  isPrivateMsg: boolean;
  isDarkRoomBg: boolean;
  isHighlightedTarget: boolean;
  isPinnedMsg: boolean;
  isModerator: boolean;
  currentUserId: string;
  currentUserName: string;
  roomId: string;
  playingVoiceId: string | null;
  onRegisterRef: (msgId: string, el: HTMLDivElement | null) => void;
  onOpenUserProfile: (msg: Message, e?: React.MouseEvent | React.KeyboardEvent) => void;
  onDoubleTap: (msg: Message, e: React.MouseEvent | React.TouchEvent) => void;
  onOpenContextMenu: (msg: Message, x: number, y: number) => void;
  onReplyTo: (msg: Message) => void;
  onScrollToMessage: (msgId?: string) => void;
  onOpenLightbox: (url: string) => void;
  onTogglePlayVoice: (msgId: string, audioUrl?: string, duration?: number) => void;
  onTogglePin: (msg: Message) => void;
  onOpenReactionUsers: (emoji: string, users: string[]) => void;
}

const RoomPublicMessageRow = React.memo<RoomPublicMessageRowProps>(({
  msg,
  isMe,
  isPrivateMsg,
  isDarkRoomBg,
  isHighlightedTarget,
  isPinnedMsg,
  isModerator,
  currentUserId,
  currentUserName,
  roomId,
  playingVoiceId,
  onRegisterRef,
  onOpenUserProfile,
  onDoubleTap,
  onOpenContextMenu,
  onReplyTo,
  onScrollToMessage,
  onOpenLightbox,
  onTogglePlayVoice,
  onTogglePin,
  onOpenReactionUsers,
}) => {
  const localLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTouchStartXRef = useRef<number>(0);
  const localLastTapRef = useRef<number>(0);

  const senderStyle = getSenderChatStyle(msg.senderId, msg.senderRole, msg.senderVipBadge, isDarkRoomBg);
  const isVipSender = senderStyle.isPrivileged;
  const msgTextOutlineClass = isDarkRoomBg ? 'chat-text-outline-strong-dark' : 'chat-text-outline-strong';
  const nameHighlightClass = isVipSender
    ? isDarkRoomBg
      ? senderStyle.rankMeta.namePillDarkClass
      : senderStyle.rankMeta.namePillClass
    : '';

  const highlightOpt = msg.isHighlighted
    ? HIGHLIGHT_OPTIONS.find((h) => h.key === (msg.highlightColor || 'sky')) || HIGHLIGHT_OPTIONS[0]
    : null;
  const messageAccentClass = highlightOpt
    ? isDarkRoomBg
      ? highlightOpt.darkBoxClass
      : highlightOpt.lightBoxClass
    : '';

  return (
    <div
      data-preserve-light={!isDarkRoomBg ? 'true' : undefined}
      className={`chat-msg-row flex items-start gap-2 justify-start group rounded-xl transition-colors py-1 px-1.5 ${msgTextOutlineClass} ${messageAccentClass} ${
        isHighlightedTarget
          ? isDarkRoomBg
            ? 'bg-sky-400/20 ring-1 ring-sky-400'
            : 'bg-sky-100/70 ring-1 ring-sky-400'
          : isPrivateMsg
          ? 'border-r-2 border-amber-500 pr-2'
          : ''
      }`}
    >
      <AvatarWithFrame
        user={{
          id: msg.senderId,
          name: msg.senderName,
          avatar: msg.senderAvatar,
          role: msg.senderRole,
          vipBadge: msg.senderVipBadge,
        }}
        size="sm"
        onClick={(e) => onOpenUserProfile(msg, e)}
        title="خيارات التفاعل مع العضو"
        className="mt-0.5 hover:scale-105 active:scale-95 transition-transform"
      />

      <div
        ref={(el) => onRegisterRef(msg.id, el)}
        onDoubleClick={(e) => onDoubleTap(msg, e)}
        onMouseDown={(e) => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
          localLongPressRef.current = setTimeout(() => {
            onOpenContextMenu(msg, e.clientX, e.clientY);
          }, 550);
        }}
        onMouseUp={() => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
        }}
        onMouseLeave={() => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          localTouchStartXRef.current = touch.clientX;
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
          localLongPressRef.current = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            onOpenContextMenu(msg, touch.clientX, touch.clientY);
          }, 550);
        }}
        onTouchMove={() => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
        }}
        onTouchCancel={() => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
        }}
        onTouchEnd={(e) => {
          if (localLongPressRef.current) clearTimeout(localLongPressRef.current);
          const diff = localTouchStartXRef.current - e.changedTouches[0].clientX;
          if (diff > 55) {
            sounds.playMessageSent();
            onReplyTo(msg);
            return;
          }
          const now = Date.now();
          if (now - localLastTapRef.current < 300) {
            onDoubleTap(msg, e);
          }
          localLastTapRef.current = now;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenContextMenu(msg, e.clientX, e.clientY);
        }}
        className="flex-1 min-w-0 text-right cursor-pointer select-text"
        title="اضغط مطولاً أو انقر على العلم للتفاعل أو التثبيت أو الحذف | انقر مرتين لإعجاب ❤️"
      >
        {msg.replyTo && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onScrollToMessage(msg.replyTo?.id);
            }}
            className={`mb-1 pr-2 border-r-2 border-sky-500 text-[11px] font-bold cursor-pointer truncate ${
              isDarkRoomBg
                ? 'text-white/95 hover:text-white chat-text-outline-dark'
                : 'text-slate-900 hover:text-slate-950 chat-text-outline-light'
            }`}
            title="اضغط للانتقال إلى الرسالة الأصلية"
          >
            <span className={`font-black ${isDarkRoomBg ? 'text-sky-300' : 'text-sky-700'}`}>رد على {msg.replyTo.senderName}: </span>
            <span>{filterInappropriateText(msg.replyTo.content)}</span>
          </div>
        )}

        {msg.type === 'image' && (msg.mediaUrl || msg.imageUrl) ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[13px] font-black">
              {isVipSender && senderStyle.badge && (
                <span className="ml-0.5 text-xs align-middle select-none">{senderStyle.badge}</span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUserProfile(msg, e);
                }}
                className={`font-black cursor-pointer hover:underline rounded inline ${senderStyle.name} ${nameHighlightClass}`}
              >
                {msg.senderName}
              </button>
              <span className={`font-black mx-0.5 ${isDarkRoomBg ? 'text-slate-100 chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'}`}>:</span>
              <span className={`text-xs font-bold ${isDarkRoomBg ? 'text-white/90' : 'text-slate-700'}`}>أرسل صورة 🖼️</span>
            </div>
            <div className="relative max-w-[240px] sm:max-w-[280px] rounded-xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
              <BlurredChatImage
                src={msg.mediaUrl || msg.imageUrl || ''}
                alt="صورة مرسلة في الغرفة"
                autoReveal={false}
                onOpenFull={(url) => onOpenLightbox(url)}
                className="max-h-56 w-full object-cover rounded-xl"
              />
            </div>
          </div>
        ) : msg.type === 'sticker' ? (
          <p className={`text-[13.5px] sm:text-sm leading-relaxed font-bold whitespace-pre-wrap break-words ${
            isDarkRoomBg ? 'text-white chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'
          }`}>
            {isVipSender && senderStyle.badge && (
              <span className="ml-0.5 text-xs align-middle select-none">{senderStyle.badge}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(msg, e);
              }}
              className={`font-black cursor-pointer hover:underline rounded inline ${senderStyle.name} ${nameHighlightClass}`}
            >
              {msg.senderName}
            </button>
            <span className={`font-black mx-1 ${isDarkRoomBg ? 'text-slate-100 chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'}`}>:</span>
            <InlineRichText text={`${msg.stickerEmoji || msg.content || '✨'}${msg.stickerLabel ? ` ${msg.stickerLabel}` : ''}`} />
          </p>
        ) : msg.type === 'voice' ? (
          <div className="flex items-center flex-wrap gap-1.5 py-0.5">
            {isVipSender && senderStyle.badge && (
              <span className="ml-0.5 text-xs align-middle select-none">{senderStyle.badge}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(msg, e);
              }}
              className={`text-[13px] sm:text-sm font-black cursor-pointer hover:underline rounded ${senderStyle.name} ${nameHighlightClass}`}
            >
              {msg.senderName}
            </button>
            <span className={`font-black ${isDarkRoomBg ? 'text-slate-100 chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'}`}>:</span>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/95 border border-sky-200/80 shadow-2xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePlayVoice(msg.id, msg.audioUrl || msg.voiceUrl, msg.audioDuration);
                }}
                className="p-1 rounded-full bg-[#1E96E8] text-white transition-transform active:scale-95"
              >
                {playingVoiceId === msg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>

              <div className="flex items-center gap-0.5">
                <span className={`w-0.5 h-2 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-1 bg-[#1E96E8]' : 'bg-slate-400'}`}></span>
                <span className={`w-0.5 h-3.5 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-2 bg-[#1E96E8]' : 'bg-slate-400'}`}></span>
                <span className={`w-0.5 h-2 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-3 bg-[#1E96E8]' : 'bg-slate-400'}`}></span>
                <span className={`w-0.5 h-3 rounded-full ${playingVoiceId === msg.id ? 'animate-soundwave-4 bg-[#1E96E8]' : 'bg-slate-400'}`}></span>
              </div>

              <span className="text-[10px] font-mono text-slate-700 font-bold [text-shadow:none]">
                {msg.audioDuration ? `0:${msg.audioDuration < 10 ? '0' : ''}${msg.audioDuration}` : '0:05'}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContextMenu(msg, e.clientX, e.clientY);
              }}
              className={`p-0.5 transition-colors ${isDarkRoomBg ? 'text-slate-200/80 hover:text-rose-400' : 'text-slate-600 hover:text-rose-600'}`}
              title="خيارات الرسالة"
            >
              <Flag className="w-3 h-3 fill-current" />
            </button>
          </div>
        ) : (
          <p className={`text-[13.5px] sm:text-sm leading-relaxed font-bold whitespace-pre-wrap break-words ${
            isDarkRoomBg ? 'text-white chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'
          }`}>
            {isVipSender && senderStyle.badge && (
              <span className="ml-0.5 text-xs align-middle select-none">{senderStyle.badge}</span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(msg, e);
              }}
              className={`font-black cursor-pointer hover:underline rounded inline ${senderStyle.name} ${nameHighlightClass}`}
            >
              {msg.senderName}
            </button>

            <span className={`font-black mx-1 ${isDarkRoomBg ? 'text-slate-100 chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'}`}>:</span>

            {isPrivateMsg && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 ml-1 rounded bg-amber-100/95 text-amber-900 text-[10px] font-black align-middle border border-amber-300/80 [text-shadow:none]">
                همس خاص 🔒
              </span>
            )}

            <span className={`font-bold ${isDarkRoomBg ? 'text-white chat-text-outline-dark' : 'text-slate-950 chat-text-outline-light'}`}>
              <InlineRichText text={filterInappropriateText(msg.content)} />
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContextMenu(msg, e.clientX, e.clientY);
              }}
              className={`inline-flex items-center justify-center mr-1.5 align-middle transition-colors ${isDarkRoomBg ? 'text-slate-200/80 hover:text-rose-400' : 'text-slate-600 hover:text-rose-600'}`}
              title="خيارات الرسالة / إبلاغ / تثبيت"
            >
              <Flag className="w-3 h-3 fill-current" />
            </button>
          </p>
        )}

        {/* Calm Reactions Strip (Strictly 4 reactions) + Timestamp & Single Status Icon */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {msg.reactions && Object.entries(msg.reactions).map(([emoji, count]) => {
            if (count <= 0) return null;
            const userReacted = msg.userReactions && msg.userReactions[currentUserId] === emoji;
            const usersList = msg.reactionUsers?.[emoji] || [];
            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMessageReaction(roomId, msg.id, emoji, currentUserId, currentUserName, msg);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (usersList.length > 0) onOpenReactionUsers(emoji, usersList);
                }}
                title={`تفاعل: ${usersList.join('، ') || emoji}`}
                className={`px-0.5 py-0 text-[10px] font-black flex items-center gap-0.5 bg-transparent border-0 transition-transform active:scale-90 hover:scale-110 cursor-pointer ${
                  userReacted
                    ? isDarkRoomBg
                      ? 'text-sky-300 chat-text-outline-dark scale-105'
                      : 'text-[#1E96E8] chat-text-outline-light scale-105'
                    : isDarkRoomBg
                    ? 'text-slate-100 chat-text-outline-dark'
                    : 'text-slate-900 chat-text-outline-light'
                }`}
              >
                <span className="text-[11px] leading-none">{emoji}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}

          <div className="inline-flex items-center gap-1.5 bg-transparent px-0 py-0">
            {PUBLIC_REACTION_EMOJIS.map((em) => {
              const isPicked = msg.userReactions && msg.userReactions[currentUserId] === em;
              return (
                <button
                  key={em}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMessageReaction(roomId, msg.id, em, currentUserId, currentUserName, msg);
                    if (em === '❤️') {
                      contributeToSharedRoomMission('likes', currentUserId, 1).catch(() => {});
                    }
                  }}
                  className={`hover:scale-125 active:scale-90 text-[11px] leading-none transition-transform p-0 bg-transparent border-0 cursor-pointer ${
                    isPicked ? 'scale-115 opacity-100' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={`تفاعل ${em}`}
                >
                  {em}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] opacity-90 sm:opacity-85 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <span className={`font-bold tabular-nums ${
              isDarkRoomBg
                ? 'text-slate-100 chat-text-outline-dark'
                : 'text-slate-800 chat-text-outline-light'
            }`}>
              {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>

            {isMe && (
              <MessageStatusIcon
                status={msg.status}
                variant={isDarkRoomBg ? 'room-dark' : 'room-light'}
              />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplyTo(msg);
              }}
              className={`font-black flex items-center gap-0.5 ${
                isDarkRoomBg
                  ? 'text-slate-100 hover:text-sky-300 chat-text-outline-dark'
                  : 'text-slate-900 hover:text-[#1E96E8] chat-text-outline-light'
              }`}
              title="رد على الرسالة"
            >
              <Reply className="w-2.5 h-2.5" />
              <span>رد</span>
            </button>

            {isModerator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(msg);
                }}
                className={`font-black flex items-center gap-0.5 ${
                  isPinnedMsg
                    ? isDarkRoomBg ? 'text-amber-300 chat-text-outline-dark' : 'text-amber-800 chat-text-outline-light'
                    : isDarkRoomBg ? 'text-slate-100 hover:text-amber-300 chat-text-outline-dark' : 'text-slate-900 hover:text-amber-800 chat-text-outline-light'
                }`}
                title={isPinnedMsg ? 'إلغاء تثبيت هذه الرسالة' : 'تثبيت الرسالة في أعلى الغرفة'}
              >
                <Pin className="w-2.5 h-2.5" />
                <span>{isPinnedMsg ? 'مثبتة' : 'تثبيت'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export const RoomActiveView: React.FC<RoomActiveViewProps> = ({
  room,
  currentUser,
  messages,
  onBack,
  onSendMessage,
  onOpenGiftModal,
  onUpdateSpeakers,
  onUpdateRoomBackground,
  onUpdateRoomLock,
  onOpenUserProfile,
  onOpenPrivateChatWith,
  onOpenMessagesDrawer,
  unreadPrivateCount = 0,
  onSendGiftToUser,
  onOpenOnlineUsers,
  onUpdateUser,
  onOpenWallet,
  onLoadOlderMessages,
  hasMoreOlderMessages = false,
  isLoadingOlderMessages = false,
}) => {
  // Chat Wallpapers Modal State (Select & Purchase) + Image Upload & Lightbox
  const [isWallpapersModalOpen, setIsWallpapersModalOpen] = useState(false);
  const [isHeaderToolsOpen, setIsHeaderToolsOpen] = useState(false);
  const headerToolsRef = useRef<HTMLDivElement>(null);
  const roomImageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingRoomImage, setIsUploadingRoomImage] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isHeaderToolsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (headerToolsRef.current && !headerToolsRef.current.contains(e.target as Node)) {
        setIsHeaderToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isHeaderToolsOpen]);

  // Top Message Type Filter State & Message Search & Join Mute & Live Audio Stage & Optional Highlight
  const [messageFilter, setMessageFilter] = useState<'all' | 'messages' | 'images' | 'gifts'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightColor, setHighlightColor] = useState<HighlightPaletteKey | null>(null);
  const [muteJoinNotices, setMuteJoinNotices] = useState<boolean>(Boolean(currentUser.muteJoinNotices));
  const [showCompactWelcomeBanner, setShowCompactWelcomeBanner] = useState<boolean>(true);
  const [raisedHandUserIds, setRaisedHandUserIds] = useState<string[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const isLiveAudioRoom = room.roomType === 'live_audio' || room.category === 'live_audio';
  const lastSentSpamRef = useRef<{ text: string; ts: number }>({ text: '', ts: 0 });

  useEffect(() => {
    setMuteJoinNotices(Boolean(currentUser.muteJoinNotices));
  }, [currentUser.muteJoinNotices]);

  // Subscribe to Live Audio Stage raised hands
  useEffect(() => {
    if (!isLiveAudioRoom) return;
    const unsub = realtimeSocket.subscribeToLiveAudioStage(room.id, (ids) => {
      setRaisedHandUserIds(ids || []);
      setIsHandRaised((ids || []).includes(currentUser.id));
    });
    return () => unsub();
  }, [room.id, isLiveAudioRoom, currentUser.id]);

  // Cleanup active voice playback & recorder streams on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  // Auto-hide the room conduct warning banner after 5 seconds (5000ms)
  useEffect(() => {
    setShowCompactWelcomeBanner(true);
    const hideBannerTimer = setTimeout(() => {
      setShowCompactWelcomeBanner(false);
    }, 5000);
    return () => clearTimeout(hideBannerTimer);
  }, [room.id]);

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

  const updateReplyingTo = useCallback((msg: Message | null) => {
    setReplyingTo(msg);
    if (typeof window !== 'undefined') {
      if (msg) {
        localStorage.setItem(replyStorageKey, JSON.stringify(msg));
      } else {
        localStorage.removeItem(replyStorageKey);
      }
    }
  }, [replyStorageKey]);

  // Realtime Typing Indicator State (strictly for other users in the room)
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  useEffect(() => {
    setTypingUsers([]);
    const unsub = subscribeToRoomTyping(room.id, currentUser.id, (users) => {
      setTypingUsers((users || []).filter((u) => u.id && u.id !== currentUser.id));
    });
    return () => {
      unsub();
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      lastTypingEmitRef.current = 0;
      setRoomTyping(room.id, currentUser, false);
    };
  }, [room.id, currentUser.id]);

  const isUserBannedNow = Boolean(
    currentUser.isBanned ||
    (typeof currentUser.bannedUntil === 'number' && currentUser.bannedUntil > Date.now())
  );

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem(draftStorageKey, val);
      } else {
        localStorage.removeItem(draftStorageKey);
      }
    }

    if (isUserBannedNow || currentUser.isMuted) return;

    // Trigger typing state (throttled >= 2000ms + 3s stop-typing debounce)
    if (val.trim().length > 0) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current >= 2000) {
        lastTypingEmitRef.current = now;
        setRoomTyping(room.id, currentUser, true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        lastTypingEmitRef.current = 0;
        setRoomTyping(room.id, currentUser, false);
      }, 3000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      lastTypingEmitRef.current = 0;
      setRoomTyping(room.id, currentUser, false);
    }
  };

  // Double-tap heart floating animations
  const [floatingHearts, setFloatingHearts] = useState<{ id: string; x: number; y: number }[]>([]);

  const handleMessageDoubleTap = useCallback((msg: Message, e: React.MouseEvent | React.TouchEvent) => {
    sounds.playCoinsReward();
    toggleMessageReaction(room.id, msg.id, '❤️', currentUser.id, currentUser.name, msg);
    contributeToSharedRoomMission('likes', currentUser.id, 1).catch(() => {});

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
  }, [room.id, currentUser.id, currentUser.name]);

  // Invite & Share Room Link
  const [inviteToastOpen, setInviteToastOpen] = useState(false);
  const handleInviteMembers = () => {
    sounds.playCoinsReward();
    navigator.clipboard?.writeText(window.location.origin + '?room=' + room.id);
    setInviteToastOpen(true);
    setTimeout(() => setInviteToastOpen(false), 3000);
  };

  const handleShareRoom = async () => {
    sounds.playCoinsReward();
    const shareUrl = `${window.location.origin}?room=${room.id}`;
    const shareData = {
      title: `شات مصر — ${room.title}`,
      text: `انضم إلينا الآن في ${room.title} على شات مصر 🌸`,
      url: shareUrl,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard if user cancels or platform rejects
      }
    }
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setInviteToastOpen(true);
      setTimeout(() => setInviteToastOpen(false), 3000);
    } catch {
      toast.info(`رابط الغرفة: ${shareUrl}`);
    }
  };

  // Reaction Users Details Modal
  const [reactionUsersModal, setReactionUsersModal] = useState<{ emoji: string; users: string[] } | null>(null);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [tasbeehCount, setTasbeehCount] = useState(0);
  const [showTasbeeh, setShowTasbeeh] = useState(false);

  // Emoji & Stickers Picker State
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'faces' | 'flags' | 'fun' | 'stickers'>('faces');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Arabic Music Library Modal State (100 Songs & Live FM)
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

  // Message Context Menu & Long-Press Deletion
  const [activeContextMenu, setActiveContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const messageRefs = useRef<{ [msgId: string]: HTMLDivElement | null }>({});
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const handleDeleteMessage = async (msgId: string) => {
    sounds.playMessageSent();
    setActiveContextMenu(null);
    await deleteRoomMessage(room.id, msgId);
  };

  const scrollToMessage = useCallback((msgId?: string) => {
    if (!msgId) return;
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  }, []);

  // Private Room Join Requests State
  const [isJoinRequestsOpen, setIsJoinRequestsOpen] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<RoomJoinRequest[]>([]);

  // Real Audio MediaRecorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Moderator, Pin & Custom Room Background state
  const isModerator = room.ownerId === currentUser.id || room.moderators?.includes(currentUser.id) || currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const [isModeratorPanelOpen, setIsModeratorPanelOpen] = useState(false);
  const [liveRoomBackgroundTheme, setLiveRoomBackgroundTheme] = useState<string>(room.backgroundTheme || 'default');
  const [liveIsLocked, setLiveIsLocked] = useState<boolean>(Boolean(room.isLocked));
  const [newPinText, setNewPinText] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState<PinnedRoomMessage | null>(
    room.pinnedMessage || (room.pinnedAnnouncement ? { id: 'ann_1', senderName: 'المشرف', content: room.pinnedAnnouncement } : null)
  );
  const [bannedUserIds, setBannedUserIds] = useState<string[]>(room.bannedUserIds || []);
  const [dismissedSystemMsgIds, setDismissedSystemMsgIds] = useState<string[]>([]);
  const scheduledSystemDismissRef = useRef<Set<string>>(new Set());

  // Automatically dismiss system_welcome / bot banners 5 seconds after appearing
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    messages.forEach((m) => {
      if (m.type === 'system_welcome' && m.id && !scheduledSystemDismissRef.current.has(m.id)) {
        scheduledSystemDismissRef.current.add(m.id);
        const ageMs = typeof m.createdAt === 'number' ? Date.now() - m.createdAt : 0;
        if (ageMs >= 5000) {
          setDismissedSystemMsgIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
        } else {
          const delay = Math.max(200, 5000 - Math.max(0, ageMs));
          const t = setTimeout(() => {
            setDismissedSystemMsgIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
          }, delay);
          timers.push(t);
        }
      }
    });
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [messages]);

  // Subscribe to real-time pinned message, lock status & custom background updates for ALL occupants in this room
  useEffect(() => {
    setPinnedMessage(
      room.pinnedMessage || (room.pinnedAnnouncement ? { id: 'ann_1', senderName: 'المشرف', content: room.pinnedAnnouncement } : null)
    );
    const unsubPinned = subscribeToRoomPinnedMessage(room.id, (remotePin) => {
      setPinnedMessage(remotePin);
    });

    setLiveRoomBackgroundTheme(room.backgroundTheme || 'default');
    const unsubBg = subscribeToRoomBackgroundTheme(room.id, (remoteTheme) => {
      setLiveRoomBackgroundTheme(remoteTheme || 'default');
    });

    setLiveIsLocked(Boolean(room.isLocked));
    const unsubLock = subscribeToRoomLockState(room.id, (remoteLocked) => {
      setLiveIsLocked(Boolean(remoteLocked));
    });

    return () => {
      unsubPinned();
      unsubBg();
      unsubLock();
    };
  }, [room.id]);

  useEffect(() => {
    if (room.backgroundTheme && room.backgroundTheme !== liveRoomBackgroundTheme) {
      setLiveRoomBackgroundTheme(room.backgroundTheme);
    }
  }, [room.backgroundTheme]);

  useEffect(() => {
    if (typeof room.isLocked === 'boolean' && room.isLocked !== liveIsLocked) {
      setLiveIsLocked(room.isLocked);
    }
  }, [room.isLocked]);

  // Scroll container & smart auto-scroll refs
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const hasInitialScrolledRef = useRef<boolean>(false);
  const loadingOlderGuardRef = useRef<boolean>(false);
  const [showScrollDownBtn, setShowScrollDownBtn] = useState<boolean>(false);

  useEffect(() => {
    hasInitialScrolledRef.current = false;
    isNearBottomRef.current = true;
    setShowScrollDownBtn(false);
  }, [room.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
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
  }, [room.id]);

  // Sequential 1-by-1 Room Join System Notice (5 seconds per user, clickable for 3 quick actions)
  const [activeJoinNotice, setActiveJoinNotice] = useState<{ id: string; userId: string; name: string; avatar: string } | null>(null);
  const [isJoinActionMenuOpen, setIsJoinActionMenuOpen] = useState(false);
  const joinNoticeQueueRef = useRef<{ id: string; userId: string; name: string; avatar: string }[]>([]);
  const processedJoinIdsRef = useRef<Set<string>>(new Set());
  const joinNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceJoinQueue = () => {
    if (joinNoticeTimerRef.current) {
      clearTimeout(joinNoticeTimerRef.current);
      joinNoticeTimerRef.current = null;
    }
    setIsJoinActionMenuOpen(false);
    const next = joinNoticeQueueRef.current.shift() || null;
    setActiveJoinNotice(next);
    if (next) {
      joinNoticeTimerRef.current = setTimeout(() => {
        advanceJoinQueue();
      }, 5000);
    }
  };

  useEffect(() => {
    joinNoticeQueueRef.current = [];
    setActiveJoinNotice(null);
    setIsJoinActionMenuOpen(false);
    if (joinNoticeTimerRef.current) {
      clearTimeout(joinNoticeTimerRef.current);
      joinNoticeTimerRef.current = null;
    }
    return () => {
      if (joinNoticeTimerRef.current) {
        clearTimeout(joinNoticeTimerRef.current);
        joinNoticeTimerRef.current = null;
      }
    };
  }, [room.id]);

  // Clear queue if user mutes join notices
  useEffect(() => {
    if (muteJoinNotices) {
      joinNoticeQueueRef.current = [];
      setActiveJoinNotice(null);
      if (joinNoticeTimerRef.current) {
        clearTimeout(joinNoticeTimerRef.current);
        joinNoticeTimerRef.current = null;
      }
    }
  }, [muteJoinNotices]);

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

  // Enqueue sequential silent join notices when another member enters the room
  useEffect(() => {
    if (messages.length === 0 || muteJoinNotices) return;
    for (const msg of messages) {
      if (
        msg.type === 'system_welcome' &&
        msg.senderName &&
        msg.senderId &&
        msg.senderId !== currentUser.id &&
        msg.senderId !== 'system_bot' &&
        !processedJoinIdsRef.current.has(msg.id)
      ) {
        processedJoinIdsRef.current.add(msg.id);
        const ageMs = Date.now() - (msg.timestamp || Date.now());
        if (ageMs < 15000 && msg.content?.includes('انضم')) {
          joinNoticeQueueRef.current.push({
            id: msg.id,
            userId: msg.senderId,
            name: msg.senderName,
            avatar: msg.senderAvatar || '',
          });
        }
      }
    }
    if (!joinNoticeTimerRef.current && joinNoticeQueueRef.current.length > 0 && !activeJoinNotice) {
      advanceJoinQueue();
    }
  }, [messages, muteJoinNotices, currentUser.id, activeJoinNotice]);

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

  // Filter messages by type (All, Text only, Images only, Gifts only) + Search query
  const displayedMessages = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return uniqueMessages.filter((msg) => {
      if (messageFilter === 'messages' && !(msg.type === 'text' || (!msg.type && !msg.imageUrl && !msg.gift))) {
        return false;
      }
      if (messageFilter === 'images' && !(!!msg.imageUrl || msg.type === 'image')) {
        return false;
      }
      if (messageFilter === 'gifts' && !(msg.type === 'gift' || !!msg.gift)) {
        return false;
      }
      if (q) {
        const hay = `${msg.content || ''} ${msg.text || ''} ${msg.senderName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [uniqueMessages, messageFilter, searchQuery]);

  const triggerLoadOlderMessages = useCallback(async () => {
    if (!onLoadOlderMessages || loadingOlderGuardRef.current || isLoadingOlderMessages || !hasMoreOlderMessages) return;
    const container = messagesScrollRef.current;
    const prevHeight = container?.scrollHeight || 0;
    const prevTop = container?.scrollTop || 0;
    loadingOlderGuardRef.current = true;
    try {
      const added = await onLoadOlderMessages();
      if (added > 0 && container) {
        requestAnimationFrame(() => {
          const el = messagesScrollRef.current;
          if (!el) return;
          const diff = el.scrollHeight - prevHeight;
          if (diff > 0) {
            el.scrollTop = prevTop + diff;
          }
        });
      }
    } finally {
      loadingOlderGuardRef.current = false;
    }
  }, [onLoadOlderMessages, isLoadingOlderMessages, hasMoreOlderMessages]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollDownBtn(!nearBottom);
    if (el.scrollTop < 48 && hasMoreOlderMessages && !isLoadingOlderMessages && onLoadOlderMessages) {
      triggerLoadOlderMessages();
    }
  }, [hasMoreOlderMessages, isLoadingOlderMessages, onLoadOlderMessages, triggerLoadOlderMessages]);

  // Smart auto-scroll to bottom & sound + vibration notification on new incoming messages + mark incoming private messages as read
  const prevMessagesCountRef = useRef(0);
  const prevLastMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const countIncreased = uniqueMessages.length > prevMessagesCountRef.current;
    const latestMsg = uniqueMessages[uniqueMessages.length - 1];
    const latestId = latestMsg?.id || null;
    const isNewTailMessage = Boolean(latestId && latestId !== prevLastMsgIdRef.current);

    if (countIncreased && isNewTailMessage && latestMsg) {
      const isFreshMessage =
        prevMessagesCountRef.current > 0 ||
        (typeof latestMsg.timestamp === 'number' && Date.now() - latestMsg.timestamp < 15000);

      if (latestMsg.senderId !== currentUser.id && isFreshMessage) {
        setTypingUsers((prev) =>
          prev.some((u) => u.id === latestMsg.senderId)
            ? prev.filter((u) => u.id !== latestMsg.senderId)
            : prev
        );
        if (latestMsg.type !== 'system_welcome' && latestMsg.senderId !== 'system_bot') {
          sounds.playMessageReceived();
        }
        const isIncomingPrivate = latestMsg.type === 'private' || Boolean(latestMsg.isPrivate);
        const isIncomingGift =
          latestMsg.type === 'gift' ||
          Boolean(latestMsg.gift) ||
          (typeof latestMsg.content === 'string' &&
            (latestMsg.content.includes('🎁') || latestMsg.content.includes('هدية')));

        if (
          (isIncomingPrivate || isIncomingGift) &&
          typeof navigator !== 'undefined' &&
          typeof navigator.vibrate === 'function'
        ) {
          try {
            navigator.vibrate(isIncomingGift ? [100, 50, 100] : [80, 40, 80]);
          } catch {}
        }
      }
    }

    if (!hasInitialScrolledRef.current && uniqueMessages.length > 0) {
      hasInitialScrolledRef.current = true;
      isNearBottomRef.current = true;
      requestAnimationFrame(() => {
        const el = messagesScrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    } else if (isNewTailMessage && (isNearBottomRef.current || latestMsg?.senderId === currentUser.id)) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    prevMessagesCountRef.current = uniqueMessages.length;
    prevLastMsgIdRef.current = latestId;

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

  // Voice recording timer (auto-stops at 60 seconds)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRecordingVoice) {
      timer = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= 60) {
            toast.info('وصل التسجيل للحد الأقصى (60 ثانية) وتم إيقافه');
            handleStopVoiceRecordAndSend();
          }
          return next;
        });
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  // Send Text Message (2s anti-spam throttle + offline queue + smart @مساعد reply)
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isUserBannedNow) {
      toast.error('حسابك محظور ولا يمكنك إرسال رسائل 🚫');
      return;
    }
    if (currentUser.isMuted) {
      toast.warning('أنت مكتوم حالياً بواسطة الإدارة 🔇');
      return;
    }
    const text = inputText.trim();
    if (!text) return;

    const now = Date.now();
    if (lastSentSpamRef.current.text === text && now - lastSentSpamRef.current.ts < 2000) {
      toast.warning('يرجى الانتظار ثانيتين قبل تكرار نفس الرسالة ⏳');
      return;
    }
    lastSentSpamRef.current = { text, ts: now };

    const tempId = `room_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const msgPayload: Partial<Message> = {
      id: tempId,
      tempId,
      clientId: tempId,
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
      isHighlighted: highlightColor ? true : undefined,
      highlightColor: highlightColor || undefined,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        content: replyingTo.content || replyingTo.text || '',
        type: replyingTo.type
      } : undefined,
      createdAt: now,
      timestamp: now,
      status: navigator.onLine === false ? 'pending_offline' : 'sent'
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      offlineQueue.enqueue({
        id: tempId,
        targetType: 'room',
        targetId: room.id,
        message: { ...(msgPayload as Message), id: tempId, tempId, roomId: room.id, status: 'pending_offline' },
        queuedAt: now,
      });
      toast.info('انقطع الاتصال — تم حفظ الرسالة وسيتم إرسالها تلقائياً عند العودة ⏳');
    } else {
      onSendMessage(msgPayload);
      const assistantReply = buildSmartAssistantReply(text, currentUser.name);
      if (assistantReply) {
        setTimeout(() => {
          onSendMessage({
            roomId: room.id,
            senderId: 'system_bot',
            senderName: 'المساعد الذكي 🤖',
            senderAvatar: currentUser.avatar,
            senderRole: 'admin',
            senderVipBadge: 'مساعد الغرفة',
            type: 'text',
            content: assistantReply,
            text: assistantReply,
            timestamp: Date.now(),
            status: 'delivered',
          });
        }, 350);
      }
    }

    setInputText('');
    setHighlightColor(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftStorageKey);
    }
    updateReplyingTo(null);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    lastTypingEmitRef.current = 0;
    setRoomTyping(room.id, currentUser, false);
    setIsEmojiPickerOpen(false);
  };

  // Unrestricted Room Image Upload Handler (compressed <= 800px & < 300KB)
  const handleRoomImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (isUserBannedNow || currentUser.isMuted) {
      toast.warning('غير مسموح بإرسال صور أثناء الكتم أو الحظر');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 15 ميجابايت)');
      return;
    }

    setIsUploadingRoomImage(true);
    try {
      const { blob } = await compressImageFileToBlob(file, {
        maxWidth: 800,
        maxBytes: 295 * 1024,
      });
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'room_photo';
      const uploadFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
      const { url } = await uploadPrivateChatMedia(uploadFile, `room_${room.id}`);
      sounds.playMessageSent();
      const now = Date.now();
      const tempId = `room_img_${now}_${Math.random().toString(36).slice(2, 7)}`;
      onSendMessage({
        id: tempId,
        tempId,
        clientId: tempId,
        roomId: room.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        senderVipBadge: currentUser.vipBadge,
        badges: currentUser.badges || ['عضو نشط'],
        type: 'image',
        mediaUrl: url,
        imageUrl: url,
        mediaType: 'image',
        content: '🖼️ صورة مرفقة',
        text: '🖼️ صورة مرفقة',
        replyTo: replyingTo ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          content: replyingTo.content || replyingTo.text || '',
          type: replyingTo.type
        } : undefined,
        createdAt: now,
        timestamp: now,
        status: navigator.onLine === false ? 'pending_offline' : 'sent',
      });
      updateReplyingTo(null);
      toast.success('تم إرسال الصورة في الغرفة بنجاح 🖼️');
    } catch (err: any) {
      toast.error(err?.message || 'تعذر رفع الصورة، حاول مرة أخرى');
    } finally {
      setIsUploadingRoomImage(false);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextVal = inputText.slice(0, start) + emoji + inputText.slice(end);
      handleInputChange(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      handleInputChange(inputText + emoji);
      inputRef.current?.focus();
    }
  };

  // Instant Welcoming Phrase Sender (الجمل الترحيبية)
  const handleSendWelcomePhrase = (phrase: string) => {
    if (isUserBannedNow || currentUser.isMuted) return;
    sounds.playMessageSent();
    const now = Date.now();
    const tempId = `room_phr_${now}_${Math.random().toString(36).slice(2, 7)}`;
    onSendMessage({
      id: tempId,
      tempId,
      clientId: tempId,
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
      createdAt: now,
      timestamp: now,
      status: navigator.onLine === false ? 'pending_offline' : 'sent'
    });
    updateReplyingTo(null);
    setRoomTyping(room.id, currentUser, false);
  };

  // Toggle audio play
  const togglePlayVoice = useCallback((msgId: string, audioUrl?: string, duration?: number) => {
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
  }, [playingVoiceId]);

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
        status: navigator.onLine === false ? 'pending_offline' : 'sent'
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

      if (audioBlob.size > 2 * 1024 * 1024) {
        toast.error('حجم التسجيل الصوتي يتجاوز الحد الأقصى (2 ميجابايت)');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        sounds.playMessageSent();
        const cappedDuration = Math.min(60, duration);
        onSendMessage({
          roomId: room.id,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderRole: currentUser.role,
          senderVipBadge: currentUser.vipBadge,
          badges: currentUser.badges || ['عضو نشط'],
          type: 'voice',
          content: `🎤 رسالة صوتية (0:${cappedDuration < 10 ? '0' : ''}${cappedDuration})`,
          audioUrl: base64Audio,
          audioDuration: cappedDuration,
          timestamp: Date.now(),
          status: navigator.onLine === false ? 'pending_offline' : 'sent'
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

  const handlePinExistingMessage = async (msg: Message) => {
    if (!isModerator) return;
    sounds.playMessageSent();
    const previewText =
      (msg.content || '').trim() ||
      (msg.type === 'voice'
        ? 'رسالة صوتية 🎤'
        : msg.type === 'gift'
        ? `هدية ${msg.gift?.name || 'فاخرة'} 🎁`
        : msg.type === 'image'
        ? 'صورة 📷'
        : 'رسالة');

    const pin: PinnedRoomMessage = {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName || 'عضو',
      content: previewText,
      pinnedBy: currentUser.name,
      pinnedAt: Date.now()
    };
    setPinnedMessage(pin);
    setActiveContextMenu(null);
    await setRoomPinnedMessage(room.id, pin);
    toast.success('تم تثبيت الرسالة في أعلى الغرفة للجميع 📌');
    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: 'المشرف',
      senderAvatar: currentUser.avatar,
      senderRole: 'admin',
      senderVipBadge: 'مشرف الغرفة',
      type: 'system_welcome',
      content: `📌 قام المشرف [${currentUser.name}] بتثبيت رسالة [${msg.senderName}]: "${previewText.slice(0, 90)}${previewText.length > 90 ? '...' : ''}"`,
      timestamp: Date.now(),
      status: 'read'
    });
  };

  const handlePinCustomMessage = async () => {
    if (!isModerator || !newPinText.trim()) return;
    sounds.playMessageSent();
    const pin: PinnedRoomMessage = {
      id: `pin_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: newPinText.trim(),
      pinnedBy: currentUser.name,
      pinnedAt: Date.now()
    };
    setPinnedMessage(pin);
    setNewPinText('');
    setIsModeratorPanelOpen(false);
    await setRoomPinnedMessage(room.id, pin);
    toast.success('تم تثبيت الإعلان في أعلى الغرفة للجميع 📌');
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

  const handleUnpin = async () => {
    if (!isModerator) return;
    sounds.playMicToggle(false);
    setPinnedMessage(null);
    setActiveContextMenu(null);
    await setRoomPinnedMessage(room.id, null);
    toast.info('تم إلغاء تثبيت الرسالة');
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
    setTasbeehCount(prev => prev + 1);
  };

  const buildUserFromMsg = useCallback((msg: Message): User => {
    const isFromMe = msg.senderId === currentUser.id;
    return {
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
    };
  }, [currentUser]);

  const openUserQuickMenu = useCallback((msg: Message, _e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!msg.senderId || msg.senderId === 'system_bot') return;
    onOpenUserProfile(buildUserFromMsg(msg));
  }, [buildUserFromMsg, onOpenUserProfile]);

  const registerMsgRef = useCallback((msgId: string, el: HTMLDivElement | null) => {
    messageRefs.current[msgId] = el;
  }, []);

  const handleOpenContextMenu = useCallback((msg: Message, x: number, y: number) => {
    setActiveContextMenu({ msg, x, y });
  }, []);

  const handleTogglePinRow = useCallback((msg: Message) => {
    if (pinnedMessage?.id === msg.id) {
      handleUnpin();
    } else {
      handlePinExistingMessage(msg);
    }
  }, [pinnedMessage?.id]);

  const handleOpenReactionUsers = useCallback((emoji: string, users: string[]) => {
    setReactionUsersModal({ emoji, users });
  }, []);

  const handleSelectRoomBackground = (themeId: string) => {
    if (!isModerator) return;
    const normalized = themeId && themeId !== 'default' ? themeId : 'default';
    setLiveRoomBackgroundTheme(normalized);
    if (onUpdateRoomBackground) {
      onUpdateRoomBackground(normalized);
    }
    const picked = getRoomBackgroundThemeById(normalized);
    if (picked) {
      toast.success(`تم تطبيق خلفية "${picked.name}" للغرفة 🎨`);
    } else {
      toast.info('تمت إعادة خلفية الغرفة إلى الوضع الافتراضي');
    }
  };

  const handleToggleRoomLock = async () => {
    if (!isModerator) return;
    const nextLocked = !liveIsLocked;
    setLiveIsLocked(nextLocked);

    if (onUpdateRoomLock) {
      onUpdateRoomLock(nextLocked);
    } else {
      await setRoomLockState(room.id, nextLocked, currentUser.id);
    }

    if (nextLocked) {
      toast.warning('🔒 تم قفل الغرفة — لن يتمكن أي عضو جديد من الدخول');
    } else {
      toast.success('🔓 تم فتح الغرفة — يمكن للأعضاء الجدد الدخول الآن');
    }

    onSendMessage({
      roomId: room.id,
      senderId: currentUser.id,
      senderName: 'إدارة الغرفة',
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      senderVipBadge: 'إعدادات الغرفة',
      type: 'system_welcome',
      content: nextLocked
        ? `🔒 قام [${currentUser.name}] بقفل الغرفة — تم إيقاف دخول الأعضاء الجدد مؤقتاً.`
        : `🔓 قام [${currentUser.name}] بفتح الغرفة — مرحباً بدخول الجميع!`,
      timestamp: Date.now(),
      status: 'read'
    });
  };

  // Strictly text-only room unless created explicitly as voice room with active voice
  const isTextOnly = room.type === 'text' || room.roomType === 'text_only' || !room.isVoiceActive;
  const effectiveRoomBackground = liveRoomBackgroundTheme !== 'default'
    ? liveRoomBackgroundTheme
    : (room.backgroundTheme || 'default');
  const activeRoomBgThemeObj = getRoomBackgroundThemeById(effectiveRoomBackground);
  const isDarkRoomBg =
    Boolean(activeRoomBgThemeObj?.isDark) ||
    (effectiveRoomBackground === 'default' && Boolean(currentUser.chatWallpaper && DARK_PERSONAL_WALLPAPERS.has(currentUser.chatWallpaper)));

  return (
    <div style={getRoomContainerStyle(room.id, currentUser.chatWallpaper, effectiveRoomBackground)} className={`relative flex flex-col h-full w-full bg-[#f6f8fc] overflow-hidden overscroll-none select-none transition-all duration-500 ${isDarkRoomBg ? 'text-white' : 'text-slate-900'}`}>
      
      {/* 1. CALM LIGHT SKY-BLUE PINNED ROOM HEADER */}
      <header className="relative backdrop-blur-md border-b px-2 sm:px-3 py-1.5 pt-[calc(env(safe-area-inset-top,0px)+0.35rem)] flex items-center justify-between gap-2 shrink-0 shadow-xs z-30 bg-[#EAF5FD]/95 dark:bg-slate-900/95 border-sky-200/80 dark:border-slate-800">
        {/* Right (RTL): Back + Room Avatar + Full Title + Compact Online Pill */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-white/80 hover:bg-white text-slate-700 active:scale-95 transition-all shrink-0 flex items-center justify-center cursor-pointer"
            title="الرجوع للغرف"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${
            room.id === 'room_egypt'
              ? 'from-amber-500 via-orange-600 to-rose-700'
              : room.id === 'room_egypt2'
              ? 'from-sky-500 via-blue-600 to-teal-600'
              : room.iconBg || 'from-emerald-600 to-teal-700'
          } border-2 border-white shadow-sm flex items-center justify-center text-sm sm:text-base shrink-0`}>
            {room.icon}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <h2 className="text-[12.5px] sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate leading-tight">
                {room.title}
              </h2>
              {liveIsLocked ? (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-700 text-[9px] font-black shrink-0"
                  title="الغرفة مقفلة — يمنع دخول أعضاء جدد"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">مقفلة</span>
                </span>
              ) : room.isPrivate ? (
                <Lock className="w-3 h-3 text-[#1E96E8] shrink-0" />
              ) : null}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={onOpenOnlineUsers}
                className="px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-black flex items-center gap-1 active:scale-95 shrink-0 tabular-nums cursor-pointer"
                title="المتصلون الآن"
              >
                <Users className="w-2.5 h-2.5 text-emerald-600" />
                <span>{Math.max(1, room.activeUsers || 1)} متصل</span>
              </button>

              <span
                className="hidden sm:inline-flex px-1.5 py-0.2 rounded bg-white/80 border border-sky-200 text-sky-900 text-[9px] font-black items-center gap-0.5 shrink-0 tabular-nums"
                title="زوار المنصة"
              >
                <Eye className="w-2.5 h-2.5 text-[#1E96E8]" />
                <span>{room.visitorsCount || '1'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Left (RTL): Compact Toolbar with Prominent Share Link on All Viewports */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap">
          {/* Desktop Inline Secondary Controls */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(prev => !prev);
                setSearchQuery('');
              }}
              className={`h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 shrink-0 transition cursor-pointer ${
                isSearchOpen
                  ? 'bg-[#1E96E8] text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-sky-100/80'
              }`}
              title="بحث في رسائل الغرفة"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMuted = !muteJoinNotices;
                setMuteJoinNotices(nextMuted);
                if (onUpdateUser) {
                  onUpdateUser({ ...currentUser, muteJoinNotices: nextMuted });
                }
                toast.info(nextMuted ? 'تم كتم إشعارات دخول الأعضاء 🔕' : 'تم تفعيل إشعارات دخول الأعضاء 🔔');
              }}
              className={`h-8 w-8 rounded-xl flex items-center justify-center active:scale-95 shrink-0 transition cursor-pointer ${
                muteJoinNotices
                  ? 'text-rose-600'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-sky-100/80'
              }`}
              title={muteJoinNotices ? 'تفعيل إشعارات الدخول' : 'كتم إشعارات الدخول'}
            >
              {muteJoinNotices ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsWallpapersModalOpen(true)}
              className="h-8 px-2 rounded-xl text-amber-700 hover:bg-sky-100/70 text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
              title="الخلفيات والألوان"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>خلفيات</span>
            </button>

            {isModerator && room.isPrivate && (
              <button
                type="button"
                onClick={() => setIsJoinRequestsOpen(true)}
                className="h-8 px-2 rounded-xl bg-sky-100/90 text-[#1E96E8] text-[10.5px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                title="طلبات الانضمام"
              >
                <span>طلبات ({pendingJoinRequests.length})</span>
              </button>
            )}

            {isModerator && (
              <button
                type="button"
                onClick={() => setIsModeratorPanelOpen(true)}
                className={`relative h-8 px-2 rounded-xl text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer ${
                  liveIsLocked
                    ? 'text-rose-700 hover:bg-rose-50'
                    : 'text-amber-800 hover:bg-sky-100/70'
                }`}
                title="إعدادات الغرفة ولوحة المشرف"
              >
                <Settings className={`w-3.5 h-3.5 ${liveIsLocked ? 'text-rose-600' : 'text-amber-600'}`} />
                <span className="hidden lg:inline">الإعدادات</span>
              </button>
            )}

            {room.category === 'religious' && (
              <button
                type="button"
                onClick={() => setShowTasbeeh(!showTasbeeh)}
                className="h-8 px-2 rounded-xl text-emerald-700 hover:bg-sky-100/70 text-[10.5px] font-bold flex items-center gap-1 shrink-0 tabular-nums cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>({tasbeehCount})</span>
              </button>
            )}
          </div>

          {/* Visible Private Chats & Friends Button on ALL Viewports */}
          {onOpenMessagesDrawer && (
            <button
              type="button"
              onClick={onOpenMessagesDrawer}
              className="relative h-7.5 w-7.5 sm:h-8 sm:w-auto sm:px-2 rounded-xl bg-[#E1F1FD] hover:bg-[#D0E9FC] border border-sky-300 text-[#1565C0] text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
              title="الرسائل الخاصة والأصدقاء"
              aria-label="الرسائل الخاصة والأصدقاء"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">الخاص</span>
              {unreadPrivateCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#1E96E8] text-white text-[9px] font-black flex items-center justify-center border border-white tabular-nums">
                  {unreadPrivateCount > 99 ? '99+' : unreadPrivateCount}
                </span>
              )}
            </button>
          )}

          {/* Visible Share Room Link Button on ALL Viewports */}
          <button
            type="button"
            onClick={handleShareRoom}
            className="h-7.5 px-2 sm:h-8 sm:px-2.5 rounded-xl bg-[#1E96E8]/12 hover:bg-[#1E96E8]/20 text-[#1E96E8] text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
            title="مشاركة رابط الغرفة"
            aria-label="مشاركة رابط الغرفة"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">مشاركة رابط الغرفة</span>
          </button>

          {/* Primary Quick Buttons (Visible on All Viewports — Short & Clean) */}
          <button
            type="button"
            onClick={onOpenOnlineUsers}
            className="h-7.5 w-7.5 sm:h-8 sm:w-auto sm:px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
            title="المتصلون والدعوة"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">المتصلون</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMusicModalOpen(true)}
            className="h-7.5 w-7.5 sm:h-8 sm:w-auto sm:px-2 rounded-xl text-purple-700 hover:bg-sky-100/70 text-[10.5px] font-black flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
            title="راديو FM ومكتبة الأغاني"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden md:inline">FM</span>
          </button>

          <button
            type="button"
            onClick={handleOpenGiftWithReminder}
            className="hidden sm:flex h-8 px-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-[10.5px] items-center gap-1 shadow-xs active:scale-95 shrink-0 cursor-pointer"
            title="إرسال هدية فاخرة"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>هدية</span>
          </button>

          {/* Compact Mobile Tools Menu */}
          <div className="relative md:hidden" ref={headerToolsRef}>
            <button
              type="button"
              onClick={() => setIsHeaderToolsOpen(prev => !prev)}
              className={`relative h-7.5 w-7.5 rounded-xl flex items-center justify-center active:scale-95 shrink-0 transition cursor-pointer ${
                isHeaderToolsOpen
                  ? 'bg-[#1E96E8] text-white'
                  : 'text-slate-700 hover:bg-sky-100/80'
              }`}
              title="أدوات الغرفة"
            >
              <MoreVertical className="w-4 h-4" />
              {(liveIsLocked || pendingJoinRequests.length > 0 || isSearchOpen) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-white" />
              )}
            </button>

            <AnimatePresence>
              {isHeaderToolsOpen && (
                <motion.div
                  dir="rtl"
                  initial={{ opacity: 0, y: -8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  className="origin-top-left absolute left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5 space-y-1 z-[120] text-right"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderToolsOpen(false);
                      setIsWallpapersModalOpen(true);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-amber-50 text-slate-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-600" />
                      <span>الخلفيات والألوان</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderToolsOpen(false);
                      setIsSearchOpen(prev => !prev);
                      setSearchQuery('');
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-indigo-50 text-slate-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-indigo-600" />
                      <span>{isSearchOpen ? 'إغلاق البحث' : 'بحث في الرسائل'}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextMuted = !muteJoinNotices;
                      setMuteJoinNotices(nextMuted);
                      if (onUpdateUser) {
                        onUpdateUser({ ...currentUser, muteJoinNotices: nextMuted });
                      }
                      setIsHeaderToolsOpen(false);
                      toast.info(nextMuted ? 'تم كتم إشعارات دخول الأعضاء 🔕' : 'تم تفعيل إشعارات دخول الأعضاء 🔔');
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {muteJoinNotices ? (
                        <VolumeX className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span>{muteJoinNotices ? 'تفعيل إشعارات الدخول' : 'كتم إشعارات الدخول'}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderToolsOpen(false);
                      handleShareRoom();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-sky-50 text-slate-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-sky-600" />
                      <span>مشاركة رابط الغرفة</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderToolsOpen(false);
                      handleOpenGiftWithReminder();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-rose-500" />
                      <span>إرسال هدية فاخرة</span>
                    </span>
                  </button>

                  {room.category === 'religious' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderToolsOpen(false);
                        setShowTasbeeh(!showTasbeeh);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                        <span>المسبحة ({tasbeehCount})</span>
                      </span>
                    </button>
                  )}

                  {isModerator && room.isPrivate && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderToolsOpen(false);
                        setIsJoinRequestsOpen(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>طلبات الانضمام</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">
                        {pendingJoinRequests.length}
                      </span>
                    </button>
                  )}

                  {isModerator && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderToolsOpen(false);
                        setIsModeratorPanelOpen(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-black flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className={`w-4 h-4 ${liveIsLocked ? 'text-rose-600' : 'text-amber-600'}`} />
                        <span>إعدادات الغرفة</span>
                      </span>
                      {liveIsLocked && (
                        <span className="text-[10px] text-rose-600 font-black">مقفلة</span>
                      )}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* 3. Pinned Message Banner (Synced live for all room occupants) */}
      {pinnedMessage && (
        <div
          onClick={() => scrollToMessage(pinnedMessage.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') scrollToMessage(pinnedMessage.id);
          }}
          title="اضغط للانتقال إلى الرسالة المثبتة"
          className="bg-gradient-to-r from-amber-50 via-white to-indigo-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between gap-2 text-xs shadow-xs shrink-0 cursor-pointer hover:from-amber-100/70 hover:to-indigo-100/60 transition-colors"
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <Pin className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                رسالة مثبتة
              </span>
              {pinnedMessage.senderName && (
                <span className="text-[10.5px] font-black text-indigo-700 shrink-0">
                  {pinnedMessage.senderName}:
                </span>
              )}
              <span className="text-[11px] text-slate-800 font-bold truncate">
                {filterInappropriateText(pinnedMessage.content)}
              </span>
            </div>
          </div>
          {isModerator && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleUnpin();
              }}
              className="text-[10px] font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0 transition-colors"
              title="إلغاء تثبيت الرسالة"
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

      {/* 4.1. Slim Single-Row Horizontally Scrollable Filter Bar */}
      <div className="bg-[#F3F9FE]/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800 px-2.5 py-1 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="hidden sm:flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-slate-300 font-bold shrink-0">
          <Filter className="w-3 h-3 text-[#1E96E8]" />
          <span>تصفية العرض:</span>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto py-0.5">
          <button
            type="button"
            onClick={() => setMessageFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] leading-tight font-black transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
              messageFilter === 'all'
                ? 'bg-[#1E96E8] text-white shadow-2xs'
                : 'bg-white/90 hover:bg-sky-50 text-slate-700 border border-sky-200/70'
            }`}
          >
            عرض الكل
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('messages')}
            className={`px-2.5 py-1 rounded-full text-[11px] leading-tight font-black transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
              messageFilter === 'messages'
                ? 'bg-[#1E96E8] text-white shadow-2xs'
                : 'bg-white/90 hover:bg-sky-50 text-slate-700 border border-sky-200/70'
            }`}
          >
            الرسائل فقط
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('images')}
            className={`px-2.5 py-1 rounded-full text-[11px] leading-tight font-black transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
              messageFilter === 'images'
                ? 'bg-[#1E96E8] text-white shadow-2xs'
                : 'bg-white/90 hover:bg-sky-50 text-slate-700 border border-sky-200/70'
            }`}
          >
            الصور فقط
          </button>
          <button
            type="button"
            onClick={() => setMessageFilter('gifts')}
            className={`px-2.5 py-1 rounded-full text-[11px] leading-tight font-black transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
              messageFilter === 'gifts'
                ? 'bg-[#1E96E8] text-white shadow-2xs'
                : 'bg-white/90 hover:bg-sky-50 text-slate-700 border border-sky-200/70'
            }`}
          >
            الهدايا 🎁
          </button>
        </div>
      </div>

      {/* Search Bar Strip inside Room */}
      {isSearchOpen && (
        <div className="bg-white/95 border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 shrink-0 z-20 animate-in slide-in-from-top-1">
          <Search className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالكلمة المفتاحية أو اسم العضو..."
            autoFocus
            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Audio Stage (Only for 'live_audio' Voice & Interactive Rooms) */}
      {isLiveAudioRoom && (
        <div className="bg-gradient-to-l from-indigo-950 via-slate-900 to-purple-950 text-white border-b border-indigo-500/40 px-3 py-2 shrink-0 z-10 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>LIVE 🎙️</span>
              </span>
              <span className="text-xs font-black truncate">منصة الصوت التفاعلية</span>
              {raisedHandUserIds.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold shrink-0">
                  ✋ {raisedHandUserIds.length} يطلب المايك
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !isHandRaised;
                setIsHandRaised(next);
                realtimeSocket.sendLiveAudioRaiseHand(room.id, currentUser.id, next);
                toast.info(next ? 'تم رفع يدك لطلب التحدث ✋' : 'تم إنزال يدك');
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition cursor-pointer shrink-0 ${
                isHandRaised
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{isHandRaised ? 'تم رفع اليد' : 'رفع اليد'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {(room.speakers || []).slice(0, 6).map((seat) => (
              <div
                key={seat.seatId}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/10 border border-white/15 shrink-0"
              >
                {seat.user ? (
                  <>
                    <AvatarWithFrame user={seat.user} size="xs" />
                    <span className="text-[10.5px] font-bold max-w-[75px] truncate">{seat.user.name}</span>
                    {isModerator && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (room.speakers || []).map((s) =>
                            s.seatId === seat.seatId ? { ...s, isMuted: !s.isMuted } : s
                          );
                          onUpdateSpeakers(updated);
                        }}
                        className="p-0.5 rounded bg-white/15 hover:bg-white/25 cursor-pointer"
                        title={seat.isMuted ? 'إلغاء كتم المتحدث' : 'كتم المتحدث'}
                      >
                        {seat.isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Mic className="w-3 h-3 text-indigo-300" />
                    <span>مقعد #{seat.seatId}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sequential 1-by-1 Clickable Join System Notice (Quick actions: DM / Friend Request / Profile) */}
      {activeJoinNotice && !muteJoinNotices && (
        <div className="relative flex flex-col items-center py-1 px-3 shrink-0 z-20 animate-in fade-in">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !isJoinActionMenuOpen;
              setIsJoinActionMenuOpen(nextOpen);
              if (nextOpen && joinNoticeTimerRef.current) {
                clearTimeout(joinNoticeTimerRef.current);
                joinNoticeTimerRef.current = null;
              } else if (!nextOpen) {
                joinNoticeTimerRef.current = setTimeout(() => {
                  advanceJoinQueue();
                }, 4000);
              }
            }}
            className="pointer-events-auto cursor-pointer px-3 py-1 rounded-full bg-slate-200/90 hover:bg-indigo-100/95 backdrop-blur-sm border border-slate-300/80 hover:border-indigo-300 text-slate-800 text-[11px] font-bold shadow-xs truncate max-w-[90vw] transition"
            title="اضغط للتفاعل مع العضو"
          >
            ✨ {activeJoinNotice.name} انضم للغرفة
          </button>

          {isJoinActionMenuOpen && (
            <div
              dir="rtl"
              className="mt-1.5 w-full max-w-xs p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-200 shadow-xl flex flex-col gap-1.5 text-right z-30"
            >
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-black text-slate-900 truncate">
                  {activeJoinNotice.name}
                </span>
                <button
                  type="button"
                  onClick={() => advanceJoinQueue()}
                  className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const targetPeer: User = {
                      id: activeJoinNotice.userId,
                      name: activeJoinNotice.name,
                      username: activeJoinNotice.name.replace(/\s+/g, '_').toLowerCase(),
                      avatar: activeJoinNotice.avatar || '',
                      bio: 'عضو في شات مصر',
                      country: 'مصر',
                      countryFlag: '🇪🇬',
                      role: 'member',
                      coins: 0,
                      earningsEgp: 0,
                      earningsUsd: 0,
                      vipBadge: '',
                      frameStyle: 'border-amber-400',
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
                    advanceJoinQueue();
                    onOpenPrivateChatWith?.(targetPeer);
                  }}
                  className="flex-1 py-1.5 px-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-black text-center cursor-pointer"
                >
                  💬 رسالة خاصة
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetId = activeJoinNotice.userId;
                    const targetName = activeJoinNotice.name;
                    const ok = await sendFriendRequest(currentUser, targetId);
                    if (ok) {
                      toast.success(`تم إرسال طلب صداقة إلى ${targetName} 🤝`);
                    } else {
                      toast.error('تعذر إرسال طلب الصداقة حالياً');
                    }
                    advanceJoinQueue();
                  }}
                  className="flex-1 py-1.5 px-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-black text-center cursor-pointer"
                >
                  🤝 طلب صداقة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetPeer: User = {
                      id: activeJoinNotice.userId,
                      name: activeJoinNotice.name,
                      username: activeJoinNotice.name.replace(/\s+/g, '_').toLowerCase(),
                      avatar: activeJoinNotice.avatar || '',
                      bio: 'عضو في شات مصر',
                      country: 'مصر',
                      countryFlag: '🇪🇬',
                      role: 'member',
                      coins: 0,
                      earningsEgp: 0,
                      earningsUsd: 0,
                      vipBadge: '',
                      frameStyle: 'border-amber-400',
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
                    advanceJoinQueue();
                    onOpenUserProfile(targetPeer);
                  }}
                  className="flex-1 py-1.5 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10.5px] font-black text-center cursor-pointer"
                >
                  👤 الملف الشخصي
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Chat Wallpaper & Feed Scroll Area (Locked Inner Scrolling) */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Temporary Calm Conduct Warning Banner (Auto-hides after 5 seconds) */}
        {showCompactWelcomeBanner && (
          <div className="bg-amber-50/95 border-b border-amber-200/90 px-3 py-1.5 flex items-center justify-between gap-2 text-amber-950 shrink-0 z-10 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-white border border-amber-300 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
              </span>
              <p className="text-[11px] sm:text-xs font-bold text-amber-950 leading-snug line-clamp-2">
                أهلاً بك يا {currentUser.name} في {room.title} — نرجو الالتزام بقواعد الآداب العامة واحترام جميع الأعضاء ✨
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCompactWelcomeBanner(false)}
              className="p-1 rounded-full text-amber-700 hover:text-amber-950 hover:bg-amber-200/60 transition-colors shrink-0 cursor-pointer"
              title="إخفاء التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Messages Feed */}
        <div
          ref={messagesScrollRef}
          onScroll={handleMessagesScroll}
          className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 sm:px-3.5 py-2 space-y-1 text-right"
        >
        {hasMoreOlderMessages && onLoadOlderMessages && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={triggerLoadOlderMessages}
              disabled={isLoadingOlderMessages}
              className="px-3 py-1 rounded-full bg-white/90 hover:bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-60"
            >
              {isLoadingOlderMessages ? (
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
        <AnimatePresence initial={false}>
        {displayedMessages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.id;
          const isPrivateMsg = msg.type === 'private' || msg.isPrivate;
          const uniqueKey = msg.id || `msg_${idx}_${msg.senderId || 'u'}_${msg.timestamp || 0}`;

          // Automated System Conduct Notice Banner (Auto-hides after 5 seconds)
          if (msg.type === 'system_welcome' && msg.senderId === 'system_bot') {
            if (dismissedSystemMsgIds.includes(msg.id)) return null;
            return (
              <motion.div
                key={uniqueKey}
                initial={{ opacity: 0, y: 10, scale: 0.94 }}
                animate={{ opacity: [0, 1, 1], y: [10, -1, 0], scale: [0.94, 1.025, 1] }}
                exit={{ opacity: 0, y: -6, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ duration: 0.38, times: [0, 0.55, 1], ease: 'easeOut' }}
                className="px-3 py-1.5 my-1 rounded-2xl bg-amber-50/95 border border-amber-200 text-amber-950 flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-[11px] sm:text-xs font-bold text-amber-950 line-clamp-2">
                    {filterInappropriateText(msg.content)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedSystemMsgIds(prev => [...prev, msg.id])}
                  className="p-0.5 rounded-md text-amber-700 hover:text-amber-950 hover:bg-amber-200/60 transition-colors shrink-0 cursor-pointer"
                  title="إخفاء التنبيه"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          }

          // System Welcome / Join Pills
          if (msg.type === 'system_welcome') {
            if (msg.content?.includes('انضم') && msg.senderId !== 'system_bot' && muteJoinNotices) {
              return null;
            }
            if (dismissedSystemMsgIds.includes(msg.id)) return null;
            return (
              <motion.div 
                key={uniqueKey} 
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: [0, 1, 1], y: [12, -1, 0], scale: [0.92, 1.035, 1] }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                transition={{ duration: 0.4, times: [0, 0.55, 1], ease: 'easeOut' }}
                className="flex justify-center my-1"
              >
                <div className="max-w-[90%] px-3 py-1 rounded-full bg-slate-200/85 border border-slate-300/80 text-slate-700 text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 shadow-xs backdrop-blur-sm truncate">
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
                initial={{ opacity: 0, scale: 0.88, y: 16 }}
                animate={{ opacity: [0, 1, 1], scale: [0.88, 1.04, 1], y: [16, -2, 0] }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
                transition={{ duration: 0.46, times: [0, 0.55, 1], ease: 'easeOut' }}
                className="flex justify-center my-3 px-1"
              >
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-50 via-white to-rose-50 border-2 border-amber-300 p-3 sm:p-4 max-w-[94%] sm:max-w-md w-full shadow-lg animate-subtle-gift-pulse">
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

          return (
            <RoomPublicMessageRow
              key={uniqueKey}
              msg={msg}
              isMe={isMe}
              isPrivateMsg={Boolean(isPrivateMsg)}
              isDarkRoomBg={isDarkRoomBg}
              isHighlightedTarget={highlightedMsgId === msg.id}
              isPinnedMsg={pinnedMessage?.id === msg.id}
              isModerator={isModerator}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              roomId={room.id}
              playingVoiceId={playingVoiceId}
              onRegisterRef={registerMsgRef}
              onOpenUserProfile={openUserQuickMenu}
              onDoubleTap={handleMessageDoubleTap}
              onOpenContextMenu={handleOpenContextMenu}
              onReplyTo={updateReplyingTo}
              onScrollToMessage={scrollToMessage}
              onOpenLightbox={setLightboxImageUrl}
              onTogglePlayVoice={togglePlayVoice}
              onTogglePin={handleTogglePinRow}
              onOpenReactionUsers={handleOpenReactionUsers}
            />
          );
        })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        </div>

        {/* Smart Scroll-to-Bottom Pill when reading older messages */}
        {showScrollDownBtn && (
          <button
            type="button"
            onClick={() => {
              isNearBottomRef.current = true;
              setShowScrollDownBtn(false);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute bottom-3 left-3 z-20 px-2.5 py-1.5 rounded-full bg-[#1E96E8] hover:bg-[#1982CC] text-white text-[11px] font-black shadow-lg flex items-center gap-1 active:scale-95 transition cursor-pointer"
            title="الانتقال إلى أحدث الرسائل"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>الأحدث</span>
          </button>
        )}

        {/* 6.5. Realtime Typing Indicator ("جاري الكتابة...") directly beneath the messages feed */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              aria-live="polite"
              className="relative z-20 bg-white/95 backdrop-blur-md border-t border-indigo-200/80 px-3 py-1.5 flex items-center justify-start gap-2 text-indigo-700 shadow-[0_-2px_10px_rgba(79,70,229,0.06)] shrink-0"
            >
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200/90 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="font-bold text-[11px] sm:text-xs text-slate-700 truncate">
                {typingUsers.length === 1
                  ? `${typingUsers[0].name} جاري الكتابة...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0].name} و ${typingUsers[1].name} جاري الكتابة...`
                  : `${typingUsers[0].name} و ${typingUsers.length - 1} آخرين جاري الكتابة...`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* 8. Voice Recording Live Banner (60s Cap + Soundwave) */}
      {isRecordingVoice && (
        <div className="bg-red-50 border-t border-red-200 px-3 py-1.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-red-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <div className="flex items-center gap-0.5 h-3.5">
              <span className="w-0.5 h-2 rounded-full bg-red-500 animate-soundwave-1" />
              <span className="w-0.5 h-3.5 rounded-full bg-red-500 animate-soundwave-2" />
              <span className="w-0.5 h-2 rounded-full bg-red-500 animate-soundwave-3" />
              <span className="w-0.5 h-3 rounded-full bg-red-500 animate-soundwave-4" />
            </div>
            <span>جاري التسجيل الصوتي... 0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds} / 01:00</span>
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

      {/* 8.5. Single Compact Combined Quick-Phrases & Ready-Replies Bar */}
      <div className={`backdrop-blur-md border-t px-2 py-1 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0 z-20 ${
        isDarkRoomBg
          ? 'bg-slate-900/78 border-white/15'
          : 'bg-gradient-to-l from-sky-50/85 via-white/85 to-amber-50/85 border-sky-200/65'
      }`}>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-[9.5px] font-black shrink-0 whitespace-nowrap shadow-2xs">
          <span>⚡</span>
          <span>عبارات سريعة:</span>
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
            key={`quick_${idx}`}
            type="button"
            disabled={currentUser.isBanned || currentUser.isMuted}
            onClick={() => handleSendWelcomePhrase(phrase)}
            title="إرسال فوري بضغطة واحدة"
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-40 border ${
              isDarkRoomBg
                ? 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/30 text-sky-100'
                : 'bg-sky-50/95 hover:bg-sky-100 border-sky-200/85 text-slate-900 hover:text-indigo-800'
            }`}
          >
            {phrase}
          </button>
        ))}

        {WELCOME_PHRASES.map((phrase, idx) => (
          <button
            key={`welcome_${idx}`}
            type="button"
            disabled={currentUser.isBanned || currentUser.isMuted}
            onClick={() => handleSendWelcomePhrase(phrase)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border ${
              isDarkRoomBg
                ? 'bg-white/15 hover:bg-white/25 border-white/20 text-white hover:text-amber-200'
                : 'bg-amber-50/95 hover:bg-amber-100 border-amber-200/85 text-amber-950 hover:text-rose-900'
            }`}
            title="اضغط لإرسال الترحيب فوراً"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* 9. BOTTOM INPUT BAR (Pinned, Comfortable Composer + Dynamic Mic/Send) */}
      <div className="relative bg-white/95 dark:bg-slate-900/95 border-t border-sky-200/75 dark:border-slate-800 p-1.5 sm:p-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)] flex items-center gap-1.5 sm:gap-2 shrink-0 z-20">
        <input
          ref={roomImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleRoomImageSelected}
          className="hidden"
        />

        {/* Luxury Gift Button Shortcut */}
        <button
          type="button"
          onClick={handleOpenGiftWithReminder}
          className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white hover:scale-105 active:scale-95 transition-transform shrink-0 shadow-sm min-h-[42px] min-w-[40px] flex items-center justify-center"
          title="إرسال هدية فاخرة"
        >
          <Gift className="w-4 h-4" />
        </button>

        {/* Unrestricted Room Image Upload Button */}
        <button
          type="button"
          onClick={() => roomImageInputRef.current?.click()}
          disabled={isUploadingRoomImage || isUserBannedNow || currentUser.isMuted}
          className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#1E96E8] active:scale-95 transition-all shrink-0 min-h-[42px] min-w-[40px] flex items-center justify-center disabled:opacity-45 cursor-pointer"
          title="رفع وإرسال صورة"
        >
          {isUploadingRoomImage ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </button>

        {/* Text Composer (Comfortable & balanced width without extra AI/stars icon) */}
        <div className="flex-1 min-w-0 flex items-center">
          <textarea
            ref={inputRef}
            rows={1}
            name="room_composer_text"
            id="room_composer_text"
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
            disabled={isUserBannedNow || currentUser.isMuted}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (isNearBottomRef.current) {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                }, 140);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder={
              isUserBannedNow
                ? "عفواً، حسابك محظور من الإدارة 🚫"
                : currentUser.isMuted
                ? "أنت مكتوم حالياً بواسطة الإدارة 🔇"
                : "اكتب رسالتك في المجلس..."
            }
            className={`w-full min-w-0 bg-slate-100 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-[#1E96E8] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-[42px] max-h-24 leading-[1.45] resize-none overflow-y-auto transition-colors shadow-inner ${
              isUserBannedNow || currentUser.isMuted ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''
            }`}
          />
        </div>

        {/* Inline Emoji Picker Button */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            disabled={isUserBannedNow || currentUser.isMuted}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-amber-600 active:scale-95 transition-all shrink-0 min-h-[42px] min-w-[40px] flex items-center justify-center"
            title="إيموجيات وتعبيرات"
          >
            <span className="text-sm sm:text-base">😊</span>
          </button>

          {/* Compact Popup Emoji & Stickers Picker Modal */}
          {isEmojiPickerOpen && (
            <div className="absolute bottom-12 left-0 sm:left-auto sm:right-0 z-[100] w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-in slide-in-from-bottom-2">
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-[10.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('faces')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'faces' ? 'bg-[#1E96E8] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  وجوه 😊
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('flags')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'flags' ? 'bg-[#1E96E8] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أعلام 🇪🇬
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('fun')}
                  className={`py-1 rounded-lg transition-all ${
                    activeEmojiTab === 'fun' ? 'bg-[#1E96E8] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تفاعل 🔥
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmojiTab('stickers')}
                  className={`py-1 rounded-lg transition-all flex items-center justify-center gap-0.5 ${
                    activeEmojiTab === 'stickers' ? 'bg-pink-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sticker className="w-3 h-3" />
                  <span>ملصقات</span>
                </button>
              </div>

              {activeEmojiTab === 'stickers' ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 scrollbar-none">
                  <span className="text-[10px] font-black text-slate-500 block">
                    اضغط لإدراج إيموجي متحرك داخل رسالتك بنفس حجم النص:
                  </span>
                  <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                    {ANIMATED_INLINE_EMOJIS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleInsertEmoji(item.emoji)}
                        title={item.label}
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-50 border border-slate-200/80 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                      >
                        <span className={`inline-block leading-none ${item.animClass}`}>{item.emoji}</span>
                      </button>
                    ))}
                    {STICKERS_CATALOG.map((stk) => (
                      <button
                        key={stk.id}
                        type="button"
                        onClick={() => handleInsertEmoji(stk.emoji)}
                        title={stk.label}
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-sky-50 border border-slate-200/80 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                      >
                        <span className={`inline-block leading-none ${stk.animationClass || ''}`}>{stk.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 scrollbar-none">
                  {EMOJI_CATEGORIES[activeEmojiTab].map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleInsertEmoji(emoji)}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-base hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Mic <-> Send Toggle Button */}
        {inputText.trim() ? (
          <button
            type="button"
            onClick={() => handleSendText()}
            disabled={currentUser.isBanned || currentUser.isMuted}
            className="p-2 rounded-xl bg-[#1E96E8] hover:bg-[#1982CC] text-white shadow-sm active:scale-95 transition-transform shrink-0 disabled:opacity-40 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
            title="إرسال"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={isRecordingVoice ? handleStopVoiceRecordAndSend : handleStartVoiceRecord}
            disabled={currentUser.isBanned || currentUser.isMuted}
            className={`p-2 rounded-xl transition-all shrink-0 disabled:opacity-40 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer ${
              isRecordingVoice 
                ? 'bg-red-600 text-white animate-pulse' 
                : 'bg-slate-100 text-slate-700 hover:text-[#1E96E8] hover:bg-sky-50 border border-slate-200'
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

      {/* Room Settings & Moderator Control Modal (Light Theme with Framer Motion) */}
      <AnimatePresence>
        {isModeratorPanelOpen && isModerator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
            onClick={() => setIsModeratorPanelOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-sm bg-white border border-amber-300 rounded-2xl shadow-2xl p-4 space-y-3 text-slate-900 max-h-[88vh] overflow-y-auto"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">إعدادات الغرفة والمشرفين</h3>
                  <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{room.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModeratorPanelOpen(false)}
                className="text-slate-400 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Room Lock Setting (Managers Only) */}
            <div className={`p-3 rounded-xl border transition-colors space-y-2 ${
              liveIsLocked
                ? 'bg-rose-50/90 border-rose-200'
                : 'bg-emerald-50/60 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    liveIsLocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {liveIsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900">قفل الغرفة</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                        liveIsLocked
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {liveIsLocked ? 'مقفلة' : 'مفتوحة'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 leading-snug mt-0.5">
                      {liveIsLocked
                        ? 'الغرفة مقفلة حالياً — يمنع دخول أي عضو جديد.'
                        : 'الغرفة مفتوحة — يمكن للأعضاء الجدد الدخول الآن.'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleRoomLock}
                className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
                  liveIsLocked
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {liveIsLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>فتح الغرفة للأعضاء</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>قفل الغرفة ومنع الدخول</span>
                  </>
                )}
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

            {/* Mute Speakers (Voice rooms) */}
            {!isTextOnly && (
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
            )}

            {/* Room Background Theme Customization (Room Managers) */}
            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-indigo-800 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>خلفية الغرفة المخصصة:</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsModeratorPanelOpen(false);
                    setIsWallpapersModalOpen(true);
                  }}
                  className="text-[10.5px] font-black text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs"
                >
                  عرض الكل 🎨
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ROOM_BACKGROUND_THEMES.slice(0, 7).map((theme) => {
                  const isSelected = effectiveRoomBackground === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectRoomBackground(theme.id)}
                      title={theme.name}
                      style={
                        theme.id === 'default'
                          ? { background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }
                          : theme.style
                      }
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-300 scale-110'
                          : 'border-white shadow-xs hover:scale-105'
                      }`}
                    >
                      {isSelected && (
                        <Check className={`w-3.5 h-3.5 ${theme.isDark ? 'text-white' : 'text-indigo-700'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kick user */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-red-700 flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                <span>طرد مستخدم من الغرفة:</span>
              </label>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {Array.from(
                  uniqueMessages
                    .filter(
                      (m) =>
                        m.senderId &&
                        m.senderId !== currentUser.id &&
                        m.senderId !== 'system_bot' &&
                        !bannedUserIds.includes(m.senderId)
                    )
                    .reduce((acc, m) => {
                      if (!acc.has(m.senderId)) acc.set(m.senderId, m);
                      return acc;
                    }, new Map<string, Message>())
                    .values()
                )
                  .slice(0, 5)
                  .map((m) => (
                    <div key={`kick_${m.senderId}`} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs">
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

            {/* Purge Room Messages (God Mode / Moderator Clear) */}
            <button
              type="button"
              onClick={async () => {
                sounds.playMicToggle(false);
                await purgeRoomMessages(room.id);
                setIsModeratorPanelOpen(false);
                toast.success('تم تفريغ جميع رسائل الغرفة بنجاح 🧹');
              }}
              className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ رسائل الغرفة 🧹</span>
            </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified ChatWallpapersModal handles both personal wallpapers & room backgrounds */}

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
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>تم نسخ رابط دعوة الغرفة! شاركه مع أصدقائك 👥</span>
        </div>
      )}

      {/* Reaction Users Details Modal (Light Theme) */}
      {reactionUsersModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-fade-in" dir="rtl">
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

            {/* Quick Reactions (Strictly 4 options) */}
            <div className="flex items-center justify-around py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {PUBLIC_REACTION_EMOJIS.map((em) => (
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

            {/* Pin / Unpin Message Option (Room Moderators only) */}
            {isModerator && (
              <button
                type="button"
                onClick={() => {
                  if (pinnedMessage?.id === activeContextMenu.msg.id) {
                    handleUnpin();
                  } else {
                    handlePinExistingMessage(activeContextMenu.msg);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2 transition"
              >
                <Pin className="w-4 h-4 text-amber-600" />
                <span>
                  {pinnedMessage?.id === activeContextMenu.msg.id
                    ? 'إلغاء تثبيت الرسالة 📌'
                    : 'تثبيت الرسالة في أعلى الغرفة 📌'}
                </span>
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

            {/* Quick Report Button */}
            {activeContextMenu.msg.senderId !== currentUser.id && activeContextMenu.msg.senderId !== 'system_bot' && (
              <button
                type="button"
                onClick={async () => {
                  const target = activeContextMenu.msg;
                  setActiveContextMenu(null);
                  const res = await submitUserReport({
                    reporterId: currentUser.id,
                    reporterName: currentUser.name,
                    reportedUserId: target.senderId,
                    reportedUserName: target.senderName,
                    reason: 'مخالفة في الغرفة العامة',
                    details: (target.content || target.text || '').slice(0, 120),
                    contextType: 'room',
                    contextId: room.id,
                    timestamp: Date.now(),
                  });
                  toast.success(
                    res.autoMuted
                      ? 'تم إرسال البلاغ وتطبيق الكتم الوقائي تلقائياً 🛡️'
                      : 'تم إرسال البلاغ للإدارة بنجاح 🚩'
                  );
                }}
                className="w-full px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Flag className="w-4 h-4 text-rose-600" />
                <span>إبلاغ عن الرسالة / العضو 🚩</span>
              </button>
            )}

            {/* Quick Moderator Actions: Mute / Kick / Ban */}
            {isModerator && activeContextMenu.msg.senderId !== currentUser.id && activeContextMenu.msg.senderId !== 'system_bot' && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const target = activeContextMenu.msg;
                    setActiveContextMenu(null);
                    await adminUpdateUser(target.senderId, { isMuted: true });
                    toast.warning(`تم كتم ${target.senderName} 🔇`);
                  }}
                  className="py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <VolumeX className="w-3 h-3" />
                  <span>كتم</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = activeContextMenu.msg;
                    setActiveContextMenu(null);
                    handleKickUser(target.senderId, target.senderName);
                  }}
                  className="py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>طرد</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = activeContextMenu.msg;
                    setActiveContextMenu(null);
                    await adminUpdateUser(target.senderId, { isBanned: true });
                    handleKickUser(target.senderId, target.senderName);
                    toast.security(`تم حظر ${target.senderName} نهائياً 🚫`);
                  }}
                  className="py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Ban className="w-3 h-3" />
                  <span>حظر</span>
                </button>
              </div>
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

      {/* Unified UserProfileModal handles all member quick interactions via App */}

      {/* Room Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-[220] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
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

      {/* Unified Chat Wallpaper & Room Background Modal */}
      <ChatWallpapersModal
        isOpen={isWallpapersModalOpen}
        onClose={() => setIsWallpapersModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={onUpdateUser}
        onOpenWallet={onOpenWallet}
        isModerator={isModerator}
        roomTitle={room.title}
        activeRoomBackground={effectiveRoomBackground}
        onSelectRoomBackground={handleSelectRoomBackground}
      />

    </div>
  );
};
