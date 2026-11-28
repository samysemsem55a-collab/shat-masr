import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dices,
  Users,
  Cpu,
  Coins,
  Crown,
  RotateCcw,
  Send,
  CheckCircle2,
  UserPlus,
  Sparkles,
  LogOut,
  Smile,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types/chat';
import {
  LudoColor,
  LudoMatchState,
  LudoReaction,
  LudoSeat,
  createLudoMatch,
  sendLudoInvite,
  sendLudoReaction,
  subscribeToLudoMatch,
  updateLudoMatch
} from '../services/firebase';
import { AvatarWithFrame } from './AvatarWithFrame';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { sounds } from '../utils/soundEffects';
import { toast } from '../utils/appToast';
import { isUserAdminOrOwner } from '../data/seedData';

export interface ActiveLudoRef {
  hostId: string;
  matchId: string;
}

interface LudoGamePanelProps {
  currentUser: User;
  allOnlineUsers: User[];
  onUpdateCoins: (newCoins: number) => void;
  onOpenWallet: () => void;
  externalLudoMatchRef?: ActiveLudoRef | null;
  onConsumeExternalLudoMatchRef?: () => void;
  externalQuickInviteUser?: User | null;
  onConsumeExternalQuickInviteUser?: () => void;
  fullWindow?: boolean;
  onCloseWindow?: () => void;
}

// 52 clockwise main track coordinates [row, col] on a 15x15 Ludo board (0-indexed)
const MAIN_TRACK_COORDS: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

const START_TRACK_INDEX: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const HOME_STRETCH_COORDS: Record<LudoColor, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
const STAR_ONLY_INDICES = new Set<number>([8, 21, 34, 47]);

const YARD_SLOTS: Record<LudoColor, [number, number][]> = {
  red: [[1.6, 1.6], [1.6, 3.4], [3.4, 1.6], [3.4, 3.4]],
  green: [[1.6, 10.6], [1.6, 12.4], [3.4, 10.6], [3.4, 12.4]],
  yellow: [[10.6, 10.6], [10.6, 12.4], [12.4, 10.6], [12.4, 12.4]],
  blue: [[10.6, 1.6], [10.6, 3.4], [12.4, 1.6], [12.4, 3.4]],
};

const GOAL_SLOTS: Record<LudoColor, [number, number]> = {
  red: [7, 6.15],
  green: [6.15, 7],
  yellow: [7, 7.85],
  blue: [7.85, 7],
};

const COLOR_META: Record<
  LudoColor,
  {
    label: string;
    bg: string;
    tokenStyle: string;
    capStyle: string;
    pinOuter: string;
    pinInnerLight: string;
    pinInnerDark: string;
    ring: string;
    softBg: string;
    text: string;
    border: string;
  }
> = {
  red: {
    label: 'الأحمر',
    bg: 'bg-rose-500',
    tokenStyle: 'bg-gradient-to-b from-rose-400 via-red-500 to-red-800 border-rose-200',
    capStyle: 'bg-gradient-to-br from-rose-200 via-rose-400 to-red-600',
    pinOuter: '#b91c1c',
    pinInnerLight: '#fb7185',
    pinInnerDark: '#dc2626',
    ring: 'ring-rose-300',
    softBg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700/70',
  },
  green: {
    label: 'الأخضر',
    bg: 'bg-emerald-500',
    tokenStyle: 'bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-800 border-emerald-200',
    capStyle: 'bg-gradient-to-br from-emerald-200 via-emerald-400 to-green-600',
    pinOuter: '#15803d',
    pinInnerLight: '#4ade80',
    pinInnerDark: '#16a34a',
    ring: 'ring-emerald-300',
    softBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700/70',
  },
  yellow: {
    label: 'الأصفر',
    bg: 'bg-amber-400',
    tokenStyle: 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-700 border-yellow-100',
    capStyle: 'bg-gradient-to-br from-yellow-100 via-amber-300 to-amber-500',
    pinOuter: '#b45309',
    pinInnerLight: '#fde047',
    pinInnerDark: '#eab308',
    ring: 'ring-amber-200',
    softBg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700/70',
  },
  blue: {
    label: 'الأزرق',
    bg: 'bg-sky-500',
    tokenStyle: 'bg-gradient-to-b from-sky-300 via-blue-500 to-blue-800 border-sky-200',
    capStyle: 'bg-gradient-to-br from-sky-200 via-sky-400 to-blue-600',
    pinOuter: '#0369a1',
    pinInnerLight: '#7dd3fc',
    pinInnerDark: '#0284c7',
    ring: 'ring-sky-300',
    softBg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-700/70',
  },
};

const LudoTeardropPin: React.FC<{
  color: LudoColor;
  uid: string;
  highlighted?: boolean;
}> = ({ color, uid, highlighted }) => {
  const meta = COLOR_META[color];
  const shellGradId = `ludoShell_${uid}`;
  const coreGradId = `ludoCore_${uid}`;
  return (
    <svg
      viewBox="0 0 36 46"
      className="w-full h-full overflow-visible select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={shellGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={coreGradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={meta.pinInnerLight} />
          <stop offset="70%" stopColor={meta.pinInnerDark} />
          <stop offset="100%" stopColor={meta.pinOuter} />
        </radialGradient>
      </defs>
      {/* Ground drop shadow beneath pin tip */}
      <ellipse cx="18" cy="43.5" rx="8.5" ry="2.6" fill="rgba(0,0,0,0.42)" />
      {/* 3D Metallic White/Silver Teardrop Pin Body */}
      <path
        d="M18 2C9.7 2 3 8.7 3 17c0 10.2 12.2 21.8 14.3 23.7a1 1 0 0 0 1.4 0C20.8 38.8 33 27.2 33 17 33 8.7 26.3 2 18 2z"
        fill={`url(#${shellGradId})`}
        stroke={highlighted ? '#fef08a' : '#1e293b'}
        strokeWidth={highlighted ? '2.3' : '1.6'}
      />
      {/* Colored 3D Inner Sphere */}
      <circle
        cx="18"
        cy="17"
        r="9.2"
        fill={`url(#${coreGradId})`}
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      {/* Specular Gloss Highlight */}
      <ellipse
        cx="14.8"
        cy="13.8"
        rx="2.9"
        ry="1.9"
        transform="rotate(-24 14.8 13.8)"
        fill="rgba(255,255,255,0.78)"
      />
    </svg>
  );
};

const QUICK_EMOTIONS: Array<{ emoji: string; label: string }> = [
  { emoji: '😂', label: 'ضحك' },
  { emoji: '🔥', label: 'حماس' },
  { emoji: '😎', label: 'رايق' },
  { emoji: '😭', label: 'لااا' },
  { emoji: '👏', label: 'عاش' },
  { emoji: '🤩', label: 'جامد' },
  { emoji: '😡', label: 'هنتقم' },
  { emoji: '🎯', label: 'قناص' },
];

function getSeatColorsForCount(count: 2 | 3 | 4): LudoColor[] {
  if (count === 2) return ['red', 'yellow'];
  if (count === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}

function createInitialTokens(): Record<LudoColor, number[]> {
  return {
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1],
  };
}

function getGlobalTrackIndex(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (START_TRACK_INDEX[color] + progress) % 52;
}

function getTokenBoardCoords(color: LudoColor, progress: number, tokenIdx: number): [number, number] {
  if (progress < 0) return YARD_SLOTS[color][tokenIdx];
  if (progress <= 50) {
    const idx = getGlobalTrackIndex(color, progress)!;
    return MAIN_TRACK_COORDS[idx];
  }
  if (progress <= 55) {
    return HOME_STRETCH_COORDS[color][progress - 51];
  }
  return GOAL_SLOTS[color];
}

function getMovableTokenIndices(tokens: number[], dice: number): number[] {
  const res: number[] = [];
  tokens.forEach((p, idx) => {
    if (p === 56) return;
    if (p === -1) {
      if (dice === 6) res.push(idx);
    } else if (p + dice <= 56) {
      res.push(idx);
    }
  });
  return res;
}

function pickBestBotMove(
  color: LudoColor,
  allTokens: Record<LudoColor, number[]>,
  activeColors: LudoColor[],
  dice: number
): number {
  const movable = getMovableTokenIndices(allTokens[color], dice);
  if (movable.length === 0) return -1;
  if (movable.length === 1) return movable[0];

  let bestIdx = movable[0];
  let bestScore = -999;

  for (const idx of movable) {
    const cur = allTokens[color][idx];
    const next = cur === -1 ? 0 : cur + dice;
    let score = 0;

    if (cur === -1 && dice === 6) score += 65;
    if (next === 56) score += 120;
    if (next >= 51 && cur <= 50) score += 55;

    if (next >= 0 && next <= 50) {
      const targetGlobal = getGlobalTrackIndex(color, next)!;
      if (SAFE_TRACK_INDICES.has(targetGlobal)) score += 32;
      else {
        for (const opp of activeColors) {
          if (opp === color) continue;
          const hasOppHere = (allTokens[opp] || []).some(
            (op) => op >= 0 && op <= 50 && getGlobalTrackIndex(opp, op) === targetGlobal
          );
          if (hasOppHere) score += 110;
        }
      }
    }
    score += Math.max(0, cur) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

const DICE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DICE_FACE_ROTATION: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};

const Dice3D: React.FC<{ value: number; rolling: boolean }> = ({ value, rolling }) => {
  const faces: Array<{ num: number; transform: string }> = [
    { num: 1, transform: 'rotateY(0deg) translateZ(24px)' },
    { num: 2, transform: 'rotateY(90deg) translateZ(24px)' },
    { num: 3, transform: 'rotateX(90deg) translateZ(24px)' },
    { num: 4, transform: 'rotateX(-90deg) translateZ(24px)' },
    { num: 5, transform: 'rotateY(-90deg) translateZ(24px)' },
    { num: 6, transform: 'rotateY(180deg) translateZ(24px)' },
  ];

  return (
    <div className="ludo-dice-scene w-12 h-12 flex items-center justify-center shrink-0">
      <div
        className={`ludo-dice-cube relative w-12 h-12 ${rolling ? 'rolling' : ''}`}
        style={!rolling ? { transform: DICE_FACE_ROTATION[value] || DICE_FACE_ROTATION[6] } : undefined}
      >
        {faces.map((f) => {
          const dots = DICE_DOTS[f.num];
          return (
            <div
              key={f.num}
              style={{ transform: f.transform }}
              className="ludo-dice-face absolute inset-0 rounded-xl bg-gradient-to-br from-white via-slate-50 to-slate-200 border-2 border-amber-400/90 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.2)] p-1.5 grid grid-cols-3 grid-rows-3 gap-0.5"
            >
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  {dots.includes(idx) && (
                    <span
                      className={`w-2 h-2 rounded-full shadow-inner ${
                        f.num === 6 || f.num === 1
                          ? 'bg-gradient-to-b from-rose-500 to-red-700'
                          : 'bg-gradient-to-b from-slate-700 to-slate-950'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LudoGamePanel: React.FC<LudoGamePanelProps> = ({
  currentUser,
  allOnlineUsers,
  onUpdateCoins,
  onOpenWallet,
  externalLudoMatchRef = null,
  onConsumeExternalLudoMatchRef,
  externalQuickInviteUser = null,
  onConsumeExternalQuickInviteUser,
  fullWindow = false,
  onCloseWindow,
}) => {
  const isStrictOwner = isUserAdminOrOwner(currentUser);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [wager, setWager] = useState<number>(0);
  const [matchMode, setMatchMode] = useState<'local' | 'online'>('local');
  const [activeMatch, setActiveMatch] = useState<LudoMatchState | null>(null);
  const [onlineHostRef, setOnlineHostRef] = useState<ActiveLudoRef | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [steppingTokens, setSteppingTokens] = useState<Record<string, number>>({});
  const [invitedTargetIds, setInvitedTargetIds] = useState<Set<string>>(new Set());
  const [visibleReaction, setVisibleReaction] = useState<LudoReaction | null>(null);
  const [showInvitePicker, setShowInvitePicker] = useState(false);

  const coinsRef = useRef(currentUser.coins || 0);
  useEffect(() => {
    coinsRef.current = currentUser.coins || 0;
  }, [currentUser.coins]);

  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReactionIdRef = useRef<string>('');
  const settledMatchIdRef = useRef<string>('');
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevCommittedTokensRef = useRef<Record<LudoColor, number[]> | null>(null);
  const localSteppingKeyRef = useRef<string | null>(null);

  const clearStepTimers = () => {
    stepTimersRef.current.forEach((t) => clearTimeout(t));
    stepTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (noMoveTimerRef.current) clearTimeout(noMoveTimerRef.current);
      clearStepTimers();
    };
  }, []);

  const showFloatingReaction = (reaction: LudoReaction) => {
    if (!reaction?.id || reaction.id === lastReactionIdRef.current) return;
    lastReactionIdRef.current = reaction.id;
    setVisibleReaction(reaction);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setVisibleReaction((curr) => (curr?.id === reaction.id ? null : curr));
    }, 2600);
  };

  // Animate step-by-step square-by-square along the path
  const runSquareBySquareSteps = (
    color: LudoColor,
    tokenIdx: number,
    fromProg: number,
    toProg: number,
    onDone?: () => void
  ) => {
    const key = `${color}_${tokenIdx}`;
    localSteppingKeyRef.current = key;
    clearStepTimers();

    if (fromProg < 0 || toProg <= fromProg) {
      setSteppingTokens({ [key]: toProg });
      setIsStepping(true);
      const t = setTimeout(() => {
        setSteppingTokens({});
        setIsStepping(false);
        localSteppingKeyRef.current = null;
        onDone?.();
      }, 150);
      stepTimersRef.current.push(t);
      return;
    }

    const totalSteps = toProg - fromProg;
    const STEP_MS = 350;
    setIsStepping(true);

    for (let s = 1; s <= totalSteps; s++) {
      const targetStep = fromProg + s;
      const t = setTimeout(() => {
        setSteppingTokens({ [key]: targetStep });
        sounds.playMessageSent();
      }, (s - 1) * STEP_MS);
      stepTimersRef.current.push(t);
    }

    const endT = setTimeout(() => {
      setSteppingTokens({});
      setIsStepping(false);
      localSteppingKeyRef.current = null;
      onDone?.();
    }, totalSteps * STEP_MS + 60);
    stepTimersRef.current.push(endT);
  };

  // Dedicated, isolated Firestore onSnapshot listener for live Ludo match
  useEffect(() => {
    if (!onlineHostRef?.hostId || !onlineHostRef?.matchId) return;
    prevCommittedTokensRef.current = null;
    const unsub = subscribeToLudoMatch(onlineHostRef.hostId, onlineHostRef.matchId, (match) => {
      if (!match) return;

      // Animate remote player moves square-by-square smoothly
      const prev = prevCommittedTokensRef.current;
      if (prev && match.tokens) {
        let remoteMoved: { color: LudoColor; tokenIdx: number; from: number; to: number } | null = null;
        (['red', 'green', 'yellow', 'blue'] as LudoColor[]).forEach((c) => {
          const pArr = prev[c] || [];
          const nArr = match.tokens[c] || [];
          for (let i = 0; i < 4; i++) {
            const fp = pArr[i];
            const tp = nArr[i];
            if (typeof fp === 'number' && typeof tp === 'number' && tp > fp && tp - fp <= 6) {
              const key = `${c}_${i}`;
              if (localSteppingKeyRef.current !== key) {
                remoteMoved = { color: c, tokenIdx: i, from: fp, to: tp };
              }
            }
          }
        });
        if (remoteMoved) {
          const rm = remoteMoved as { color: LudoColor; tokenIdx: number; from: number; to: number };
          runSquareBySquareSteps(rm.color, rm.tokenIdx, rm.from, rm.to);
        }
      }
      prevCommittedTokensRef.current = match.tokens;

      setActiveMatch(match);
      if (match.latestReaction && Date.now() - (match.latestReaction.createdAt || 0) < 12000) {
        showFloatingReaction(match.latestReaction);
      }
    });
    return () => unsub();
  }, [onlineHostRef?.hostId, onlineHostRef?.matchId]);

  // Consume external accepted Ludo invite from App top banner
  useEffect(() => {
    if (!externalLudoMatchRef) return;
    setMatchMode('online');
    setOnlineHostRef(externalLudoMatchRef);
    onConsumeExternalLudoMatchRef?.();
  }, [externalLudoMatchRef, onConsumeExternalLudoMatchRef]);

  // Consume quick invite target triggered from OnlineUsersModal ("المتصلين")
  useEffect(() => {
    if (!externalQuickInviteUser || !externalQuickInviteUser.id) return;
    const target = externalQuickInviteUser;
    onConsumeExternalQuickInviteUser?.();
    startOnlineLobbyAndInvite(target, 2);
  }, [externalQuickInviteUser]);

  // Settle winner coins & confetti once per finished match
  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'finished' || !activeMatch.winnerColor) return;
    const settleKey = `${activeMatch.id}_${activeMatch.winnerColor}`;
    if (settledMatchIdRef.current === settleKey) return;
    settledMatchIdRef.current = settleKey;

    const winningSeat = activeMatch.seats.find((s) => s.color === activeMatch.winnerColor);
    const didCurrentUserWin = winningSeat?.userId === currentUser.id;
    if (didCurrentUserWin) {
      sounds.playGiftFanfare();
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
      const prize = activeMatch.wager > 0 ? activeMatch.wager * activeMatch.seats.length : 40;
      onUpdateCoins(coinsRef.current + prize);
      toast.success(`🏆 مبروك! فزت بلعبة اللودو وحصلت على +${prize.toLocaleString()} كوينز 🎉`);
    } else {
      toast.info(`🏆 فاز ${winningSeat?.name || activeMatch.winnerName || 'اللاعب'} في لعبة اللودو!`);
    }
  }, [activeMatch?.status, activeMatch?.winnerColor, activeMatch?.id, currentUser.id, onUpdateCoins]);

  const startLocalBotGame = (count: 2 | 3 | 4) => {
    if (!isStrictOwner && wager > 0 && coinsRef.current < wager) {
      toast.warning(`رصيدك أقل من رهان ${wager} كوينز`);
      onOpenWallet();
      return;
    }
    if (!isStrictOwner && wager > 0) {
      onUpdateCoins(Math.max(0, coinsRef.current - wager));
    }
    const colors = getSeatColorsForCount(count);
    const botNames = ['بوت ذكي ⚡', 'بطل اللودو 🤖', 'نجم الطاولة 🌟'];
    const seats: LudoSeat[] = colors.map((color, idx) =>
      idx === 0
        ? {
            color,
            playerType: 'human',
            userId: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar || '',
            joined: true,
          }
        : {
            color,
            playerType: 'bot',
            userId: `bot_${color}`,
            name: botNames[idx - 1] || `بوت ${idx}`,
            avatar: '',
            joined: true,
          }
    );
    const match: LudoMatchState = {
      id: `ludo_local_${Date.now()}`,
      hostId: currentUser.id,
      hostName: currentUser.name,
      playerCount: count,
      wager,
      status: 'playing',
      seats,
      tokens: createInitialTokens(),
      turnIndex: 0,
      diceValue: null,
      phase: 'roll',
      consecutiveSixes: 0,
      lastActionText: 'بدأت المباراة! دورك لرمي النرد 🎲',
      winnerColor: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    settledMatchIdRef.current = '';
    setMatchMode('local');
    setOnlineHostRef(null);
    setActiveMatch(match);
    sounds.playCoinsReward();
  };

  const createOnlineLobby = async (count: 2 | 3 | 4): Promise<LudoMatchState | null> => {
    if (!isStrictOwner && wager > 0 && coinsRef.current < wager) {
      toast.warning(`رصيدك أقل من رهان ${wager} كوينز`);
      onOpenWallet();
      return null;
    }
    const colors = getSeatColorsForCount(count);
    const seats: LudoSeat[] = colors.map((color, idx) =>
      idx === 0
        ? {
            color,
            playerType: 'human',
            userId: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar || '',
            joined: true,
          }
        : {
            color,
            playerType: 'empty',
            userId: '',
            name: `في انتظار لاعب ${COLOR_META[color].label}`,
            avatar: '',
            joined: false,
          }
    );
    const matchId = `ludo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const match: LudoMatchState = {
      id: matchId,
      hostId: currentUser.id,
      hostName: currentUser.name,
      playerCount: count,
      wager,
      status: 'lobby',
      seats,
      tokens: createInitialTokens(),
      turnIndex: 0,
      diceValue: null,
      phase: 'roll',
      consecutiveSixes: 0,
      lastActionText: 'طاولة اللودو جاهزة • قم بدعوة اللاعبين المتصلين 🎲',
      winnerColor: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    settledMatchIdRef.current = '';
    setInvitedTargetIds(new Set());
    setMatchMode('online');
    setActiveMatch(match);
    setOnlineHostRef({ hostId: currentUser.id, matchId });
    await createLudoMatch(match);
    return match;
  };

  const startOnlineLobbyAndInvite = async (target: User, count: 2 | 3 | 4 = playerCount) => {
    let lobby =
      activeMatch &&
      matchMode === 'online' &&
      activeMatch.status === 'lobby' &&
      activeMatch.hostId === currentUser.id
        ? activeMatch
        : await createOnlineLobby(count);
    if (!lobby) return;

    const seatIdx = lobby.seats.findIndex((s, i) => i > 0 && !s.joined && !s.userId);
    const chosenSeat = seatIdx >= 0 ? lobby.seats[seatIdx] : lobby.seats[1];
    if (seatIdx >= 0) {
      const updatedSeats = lobby.seats.map((s, idx) =>
        idx === seatIdx
          ? {
              ...s,
              playerType: 'human' as const,
              userId: target.id,
              name: target.name,
              avatar: target.avatar || '',
              joined: false,
            }
          : s
      );
      lobby = { ...lobby, seats: updatedSeats };
      setActiveMatch(lobby);
      await updateLudoMatch(lobby.hostId, lobby.id, { seats: updatedSeats });
    }

    await sendLudoInvite({
      matchId: lobby.id,
      hostUser: currentUser,
      targetUserId: target.id,
      seatColor: chosenSeat?.color || 'yellow',
      playerCount: lobby.playerCount,
      wager: lobby.wager,
    });
    setInvitedTargetIds((prev) => new Set([...prev, target.id]));
    toast.success(`تم إرسال دعوة اللودو إلى ${target.name} 🎲`);
  };

  const fillEmptySeatsWithBotsAndStart = async () => {
    if (!activeMatch) return;
    if (!isStrictOwner && activeMatch.wager > 0 && coinsRef.current < activeMatch.wager) {
      toast.warning(`رصيدك أقل من رهان ${activeMatch.wager} كوينز`);
      onOpenWallet();
      return;
    }
    if (!isStrictOwner && activeMatch.wager > 0) {
      onUpdateCoins(Math.max(0, coinsRef.current - activeMatch.wager));
    }
    const botNames = ['بوت ذكي ⚡', 'بطل اللودو 🤖', 'نجم الطاولة 🌟'];
    let botNum = 0;
    const nextSeats = activeMatch.seats.map((s) => {
      if (s.joined) return s;
      const bName = botNames[botNum++] || `بوت ${botNum}`;
      return {
        ...s,
        playerType: 'bot' as const,
        userId: `bot_${s.color}`,
        name: bName,
        avatar: '',
        joined: true,
      };
    });
    const patch: Partial<LudoMatchState> = {
      seats: nextSeats,
      status: 'playing',
      turnIndex: 0,
      phase: 'roll',
      diceValue: null,
      lastActionText: 'انطلقت المباراة! دور الأحمر لرمي النرد 🎲',
    };
    setActiveMatch({ ...activeMatch, ...patch });
    if (matchMode === 'online' && onlineHostRef) {
      await updateLudoMatch(onlineHostRef.hostId, onlineHostRef.matchId, patch);
    }
    sounds.playCoinsReward();
  };

  const persistMatchPatch = (nextState: LudoMatchState, patch: Partial<LudoMatchState>) => {
    prevCommittedTokensRef.current = nextState.tokens;
    setActiveMatch(nextState);
    if (matchMode === 'online' && onlineHostRef) {
      updateLudoMatch(onlineHostRef.hostId, onlineHostRef.matchId, patch).catch(() => {});
    }
  };

  const currentSeat = activeMatch?.seats[activeMatch.turnIndex] || null;
  const isMyTurn = Boolean(
    activeMatch &&
      activeMatch.status === 'playing' &&
      currentSeat &&
      currentSeat.playerType === 'human' &&
      currentSeat.userId === currentUser.id
  );

  const movableTokenIndices = useMemo(() => {
    if (
      !activeMatch ||
      activeMatch.status !== 'playing' ||
      activeMatch.phase !== 'move' ||
      !activeMatch.diceValue ||
      !currentSeat ||
      isStepping
    ) {
      return [];
    }
    return getMovableTokenIndices(activeMatch.tokens[currentSeat.color] || [-1, -1, -1, -1], activeMatch.diceValue);
  }, [activeMatch, currentSeat, isStepping]);

  const executeTokenMove = (matchSnapshot: LudoMatchState, tokenIdx: number) => {
    if (isStepping) return;
    const seat = matchSnapshot.seats[matchSnapshot.turnIndex];
    const dice = matchSnapshot.diceValue;
    if (!seat || !dice) return;
    const color = seat.color;
    const myTokens = [...(matchSnapshot.tokens[color] || [-1, -1, -1, -1])];
    const curProg = myTokens[tokenIdx];
    const nextProg = curProg === -1 ? 0 : curProg + dice;
    if (nextProg > 56) return;

    runSquareBySquareSteps(color, tokenIdx, curProg, nextProg, () => {
      myTokens[tokenIdx] = nextProg;
      const nextTokens: Record<LudoColor, number[]> = {
        ...matchSnapshot.tokens,
        [color]: myTokens,
      };

      let capturedOpponent = false;
      let captureText = '';
      if (nextProg >= 0 && nextProg <= 50) {
        const targetGlobal = getGlobalTrackIndex(color, nextProg)!;
        if (!SAFE_TRACK_INDICES.has(targetGlobal)) {
          for (const otherSeat of matchSnapshot.seats) {
            if (otherSeat.color === color) continue;
            const oppTokens = [...(nextTokens[otherSeat.color] || [-1, -1, -1, -1])];
            let oppHit = false;
            oppTokens.forEach((op, oi) => {
              if (op >= 0 && op <= 50 && getGlobalTrackIndex(otherSeat.color, op) === targetGlobal) {
                oppTokens[oi] = -1;
                oppHit = true;
              }
            });
            if (oppHit) {
              nextTokens[otherSeat.color] = oppTokens;
              capturedOpponent = true;
              captureText = `🔥 أكل ${seat.name} حجر ${otherSeat.name}!`;
            }
          }
        }
      }

      const didWin = myTokens.every((p) => p === 56);
      if (didWin) {
        const patch: Partial<LudoMatchState> = {
          tokens: nextTokens,
          status: 'finished',
          winnerColor: color,
          winnerName: seat.name,
          diceValue: null,
          phase: 'roll',
          lastActionText: `🏆 فاز ${seat.name} بالمباراة!`,
        };
        persistMatchPatch({ ...matchSnapshot, ...patch }, patch);
        return;
      }

      const reachedGoal = nextProg === 56;
      const bonusTurn = dice === 6 || capturedOpponent || reachedGoal;
      const nextTurnIndex = bonusTurn
        ? matchSnapshot.turnIndex
        : (matchSnapshot.turnIndex + 1) % matchSnapshot.seats.length;
      const nextSeat = matchSnapshot.seats[nextTurnIndex];

      const actionMsg = captureText
        ? `${captureText} (دور إضافي!)`
        : reachedGoal
        ? `🎯 وصل حجر ${seat.name} للبيت! (دور إضافي)`
        : bonusTurn
        ? `🎲 ${seat.name} حصل على 6 ويلعب مرة أخرى!`
        : `حرّك ${seat.name} خطواته • الدور الآن لـ ${nextSeat?.name}`;

      if (capturedOpponent || reachedGoal) {
        sounds.playCoinsReward();
      }

      const patch: Partial<LudoMatchState> = {
        tokens: nextTokens,
        turnIndex: nextTurnIndex,
        phase: 'roll',
        diceValue: null,
        consecutiveSixes: dice === 6 ? matchSnapshot.consecutiveSixes : 0,
        lastActionText: actionMsg,
      };
      persistMatchPatch({ ...matchSnapshot, ...patch }, patch);
    });
  };

  const performDiceRoll = (matchSnapshot: LudoMatchState) => {
    if (isRolling || isStepping || matchSnapshot.status !== 'playing' || matchSnapshot.phase !== 'roll') return;
    const seat = matchSnapshot.seats[matchSnapshot.turnIndex];
    if (!seat) return;

    setIsRolling(true);
    sounds.playMessageSent();
    setTimeout(() => {
      setIsRolling(false);
      const rolled = Math.floor(Math.random() * 6) + 1;
      const nextSixes = rolled === 6 ? (matchSnapshot.consecutiveSixes || 0) + 1 : 0;

      if (nextSixes >= 3) {
        const nextTurn = (matchSnapshot.turnIndex + 1) % matchSnapshot.seats.length;
        const nextSeat = matchSnapshot.seats[nextTurn];
        const patch: Partial<LudoMatchState> = {
          diceValue: 6,
          phase: 'roll',
          consecutiveSixes: 0,
          turnIndex: nextTurn,
          lastActionText: `⚠️ ثلاث ستات متتالية لـ ${seat.name}! انتقل الدور إلى ${nextSeat?.name}`,
        };
        persistMatchPatch({ ...matchSnapshot, ...patch }, patch);
        return;
      }

      const legal = getMovableTokenIndices(matchSnapshot.tokens[seat.color] || [-1, -1, -1, -1], rolled);
      if (legal.length === 0) {
        const rolledState: LudoMatchState = {
          ...matchSnapshot,
          diceValue: rolled,
          phase: 'move',
          consecutiveSixes: nextSixes,
          lastActionText: `🎲 رمى ${seat.name} (${rolled}) — لا توجد حركة متاحة`,
        };
        persistMatchPatch(rolledState, {
          diceValue: rolled,
          phase: 'move',
          consecutiveSixes: nextSixes,
          lastActionText: rolledState.lastActionText,
        });
        if (noMoveTimerRef.current) clearTimeout(noMoveTimerRef.current);
        noMoveTimerRef.current = setTimeout(() => {
          const nextTurn = (matchSnapshot.turnIndex + 1) % matchSnapshot.seats.length;
          const nextSeat = matchSnapshot.seats[nextTurn];
          const passPatch: Partial<LudoMatchState> = {
            turnIndex: nextTurn,
            phase: 'roll',
            diceValue: null,
            consecutiveSixes: 0,
            lastActionText: `انتقل الدور إلى ${nextSeat?.name} 🎲`,
          };
          persistMatchPatch({ ...rolledState, ...passPatch }, passPatch);
        }, 520);
        return;
      }

      const moveState: LudoMatchState = {
        ...matchSnapshot,
        diceValue: rolled,
        phase: 'move',
        consecutiveSixes: nextSixes,
        lastActionText: `🎲 حصل ${seat.name} على ${rolled}! اختر حجراً للتحريك`,
      };
      persistMatchPatch(moveState, {
        diceValue: rolled,
        phase: 'move',
        consecutiveSixes: nextSixes,
        lastActionText: moveState.lastActionText,
      });
    }, 360);
  };

  // Smart Bot turn driver (only Host executes Bot turns)
  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'playing' || isStepping || isRolling) return;
    if (matchMode === 'online' && activeMatch.hostId !== currentUser.id) return;
    const seat = activeMatch.seats[activeMatch.turnIndex];
    if (!seat || seat.playerType !== 'bot') return;

    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    if (activeMatch.phase === 'roll') {
      botTimerRef.current = setTimeout(() => {
        performDiceRoll(activeMatch);
      }, 360);
    } else if (activeMatch.phase === 'move' && activeMatch.diceValue) {
      const legal = getMovableTokenIndices(activeMatch.tokens[seat.color] || [-1, -1, -1, -1], activeMatch.diceValue);
      if (legal.length > 0) {
        botTimerRef.current = setTimeout(() => {
          const activeColors = activeMatch.seats.map((s) => s.color);
          const chosen = pickBestBotMove(seat.color, activeMatch.tokens, activeColors, activeMatch.diceValue!);
          if (chosen >= 0) executeTokenMove(activeMatch, chosen);
        }, 380);
      }
    }
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [activeMatch, matchMode, currentUser.id, isStepping, isRolling]);

  const handleSendEmotion = (emoji: string, label: string) => {
    if (!activeMatch) return;
    const mySeat = activeMatch.seats.find((s) => s.userId === currentUser.id) || activeMatch.seats[0];
    const reaction: LudoReaction = {
      id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      color: mySeat?.color || 'red',
      emoji,
      label,
      createdAt: Date.now(),
    };
    showFloatingReaction(reaction);
    sounds.playMessageSent();
    if (matchMode === 'online' && onlineHostRef) {
      sendLudoReaction(onlineHostRef.hostId, onlineHostRef.matchId, reaction).catch(() => {});
    }
  };

  const handleExitMatch = () => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    if (noMoveTimerRef.current) clearTimeout(noMoveTimerRef.current);
    clearStepTimers();
    setIsStepping(false);
    setSteppingTokens({});
    setActiveMatch(null);
    setOnlineHostRef(null);
    setShowInvitePicker(false);
    setInvitedTargetIds(new Set());
  };

  const availableOnlineUsers = useMemo(
    () => allOnlineUsers.filter((u) => u.id && u.id !== currentUser.id),
    [allOnlineUsers, currentUser.id]
  );

  // Build grouped tokens per visual coordinate so overlapping pieces display cleanly side-by-side
  const positionedTokens = useMemo(() => {
    if (!activeMatch) return [];
    const list: Array<{
      color: LudoColor;
      tokenIdx: number;
      progress: number;
      row: number;
      col: number;
      isMovable: boolean;
      isStepActive: boolean;
      key: string;
    }> = [];

    const activeColors = new Set(activeMatch.seats.map((s) => s.color));
    const currentTurnColor = activeMatch.seats[activeMatch.turnIndex]?.color;

    (['red', 'green', 'yellow', 'blue'] as LudoColor[]).forEach((color) => {
      if (!activeColors.has(color)) return;
      const arr = activeMatch.tokens[color] || [-1, -1, -1, -1];
      arr.forEach((committedProg, tokenIdx) => {
        const key = `${color}_${tokenIdx}`;
        const stepProg = steppingTokens[key];
        const progress = typeof stepProg === 'number' ? stepProg : committedProg;
        const [row, col] = getTokenBoardCoords(color, progress, tokenIdx);
        const isMovable =
          isMyTurn &&
          activeMatch.phase === 'move' &&
          color === currentTurnColor &&
          movableTokenIndices.includes(tokenIdx);
        list.push({
          color,
          tokenIdx,
          progress,
          row,
          col,
          isMovable,
          isStepActive: typeof stepProg === 'number',
          key,
        });
      });
    });

    const coordGroups = new Map<string, typeof list>();
    list.forEach((t) => {
      const k = `${t.row.toFixed(2)}_${t.col.toFixed(2)}`;
      const g = coordGroups.get(k) || [];
      g.push(t);
      coordGroups.set(k, g);
    });

    return list.map((t) => {
      const k = `${t.row.toFixed(2)}_${t.col.toFixed(2)}`;
      const g = coordGroups.get(k) || [t];
      const idxInGroup = g.indexOf(t);
      const count = g.length;
      let offsetX = 0;
      let offsetY = 0;
      if (count > 1) {
        const angle = (idxInGroup / count) * Math.PI * 2;
        offsetX = Math.cos(angle) * 0.16;
        offsetY = Math.sin(angle) * 0.16;
      }
      return { ...t, renderRow: t.row + offsetY, renderCol: t.col + offsetX, stackCount: count };
    });
  }, [activeMatch, steppingTokens, isMyTurn, movableTokenIndices]);

  const getBoardCellMeta = (r: number, c: number) => {
    if (r < 6 && c < 6) return { type: 'yard' as const, color: 'red' as LudoColor };
    if (r < 6 && c > 8) return { type: 'yard' as const, color: 'green' as LudoColor };
    if (r > 8 && c > 8) return { type: 'yard' as const, color: 'yellow' as LudoColor };
    if (r > 8 && c < 6) return { type: 'yard' as const, color: 'blue' as LudoColor };
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { type: 'goal' as const };
    if (r === 7 && c >= 1 && c <= 5) return { type: 'home' as const, color: 'red' as LudoColor };
    if (c === 7 && r >= 1 && r <= 5) return { type: 'home' as const, color: 'green' as LudoColor };
    if (r === 7 && c >= 9 && c <= 13) return { type: 'home' as const, color: 'yellow' as LudoColor };
    if (c === 7 && r >= 9 && r <= 13) return { type: 'home' as const, color: 'blue' as LudoColor };
    const trackIdx = MAIN_TRACK_COORDS.findIndex(([tr, tc]) => tr === r && tc === c);
    let startColor: LudoColor | null = null;
    if (trackIdx === 0) startColor = 'red';
    if (trackIdx === 13) startColor = 'green';
    if (trackIdx === 26) startColor = 'yellow';
    if (trackIdx === 39) startColor = 'blue';
    const isStar = STAR_ONLY_INDICES.has(trackIdx);
    return { type: 'track' as const, startColor, isStar };
  };

  const fullWindowTopBar = fullWindow && (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => {
          if (activeMatch) handleExitMatch();
          onCloseWindow?.();
        }}
        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition active:scale-95"
      >
        <ArrowRight className="w-4 h-4" />
        <span>رجوع</span>
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 via-amber-500 to-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
          <Dices className="w-4 h-4" />
        </span>
        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
          لعبة اللودو الملكية
        </span>
      </div>

      {!isStrictOwner ? (
        <button
          type="button"
          onClick={onOpenWallet}
          className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/60 text-amber-800 dark:text-amber-200 text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Coins className="w-3.5 h-3.5 text-amber-500" />
          <span className="tabular-nums">{currentUser.coins.toLocaleString()} 🪙</span>
        </button>
      ) : (
        <span className="w-10 shrink-0" />
      )}
    </div>
  );

  if (!activeMatch) {
    return (
      <div
        dir="rtl"
        className={fullWindow ? 'w-full max-w-4xl mx-auto px-3 sm:px-5 pt-2.5 pb-10 space-y-3.5' : 'space-y-4'}
      >
        {fullWindowTopBar}

        {/* Setup & Lobby Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-amber-500 to-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <Dices className="w-4.5 h-4.5" />
                </span>
                <span>لعبة اللودو الملكية (2 – 4 لاعبين)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                نرد ثلاثي الأبعاد، حركة خطوة بخطوة على المربعات، تحدي المتصلين أو اللعب ضد البوتات الذكية!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>عدد اللاعبين في الطاولة:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setPlayerCount(cnt)}
                    className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                      playerCount === cnt
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cnt} لاعبين
                  </button>
                ))}
              </div>
            </div>

            {!isStrictOwner && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>رهان الكوينز (اختياري):</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWager(amt)}
                      className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                        wager === amt
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-amber-50'
                      }`}
                    >
                      {amt === 0 ? 'مجاني' : `${amt} 🪙`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => startLocalBotGame(playerCount)}
              className="py-3 px-4 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>ابدأ فوراً ({playerCount} لاعبين مع بوتات ذكية)</span>
            </button>

            <button
              type="button"
              onClick={() => createOnlineLobby(playerCount)}
              className="py-3 px-4 rounded-xl bg-gradient-to-l from-rose-600 via-pink-600 to-indigo-600 hover:brightness-110 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إنشاء طاولة أونلاين ودعوة المتصلين 🎲</span>
            </button>
          </div>
        </div>

        {/* Quick Invite Online Users Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ادعُ لاعباً متصلاً الآن ({availableOnlineUsers.length})</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              طاولة {playerCount} لاعبين
            </span>
          </div>

          {availableOnlineUsers.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
              لا يوجد أعضاء متصلون حالياً — يمكنك بدء مباراة سريعة ضد البوتات الذكية بالأعلى!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-0.5">
              {availableOnlineUsers.slice(0, 16).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarWithFrame user={u} size="xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</span>
                        <VerifiedBadge verified={u.verified} size="xs" />
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">متصل الآن</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startOnlineLobbyAndInvite(u, playerCount)}
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>دعوة لودو</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={fullWindow ? 'w-full max-w-4xl mx-auto px-2.5 sm:px-5 pt-2 pb-10 space-y-2.5' : 'space-y-3'}
    >
      {fullWindowTopBar}

      {/* Top Match Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-amber-500 to-emerald-500 text-white flex items-center justify-center shrink-0">
            <Dices className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <span>طاولة اللودو ({activeMatch.playerCount} لاعبين)</span>
              {matchMode === 'online' && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9.5px] font-black border border-emerald-400/30">
                  مباشر
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
              {activeMatch.lastActionText || 'استعد للعب!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeMatch.status === 'lobby' && activeMatch.hostId === currentUser.id && (
            <>
              <button
                type="button"
                onClick={() => setShowInvitePicker((v) => !v)}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>دعوة</span>
              </button>
              <button
                type="button"
                onClick={fillEmptySeatsWithBotsAndStart}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>بدء اللعب الآن</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleExitMatch}
            className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-black flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج من الطاولة</span>
          </button>
        </div>
      </div>

      {/* Lobby Invite Picker Drawer */}
      {activeMatch.status === 'lobby' && (showInvitePicker || activeMatch.hostId === currentUser.id) && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-800 dark:text-indigo-200">
              {activeMatch.hostId === currentUser.id
                ? 'ادعُ لاعبين آخرين للانضمام أو اضغط "بدء اللعب الآن" لملء المقاعد الفارغة ببوتات ذكية:'
                : 'في انتظار المضيف لبدء المباراة...'}
            </span>
          </div>
          {activeMatch.hostId === currentUser.id && availableOnlineUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {availableOnlineUsers.slice(0, 12).map((u) => {
                const alreadyInvited = invitedTargetIds.has(u.id) || activeMatch.seats.some((s) => s.userId === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={alreadyInvited}
                    onClick={() => startOnlineLobbyAndInvite(u, activeMatch.playerCount)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                      alreadyInvited
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{u.name}</span>
                    {alreadyInvited ? <CheckCircle2 className="w-3 h-3" /> : <Send className="w-3 h-3 text-indigo-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Seats Strip (2-4 Players + Floating Emotion Reaction) */}
      <div className={`grid gap-2 ${activeMatch.seats.length === 2 ? 'grid-cols-2' : activeMatch.seats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {activeMatch.seats.map((seat, idx) => {
          const meta = COLOR_META[seat.color];
          const isTurn = activeMatch.status === 'playing' && activeMatch.turnIndex === idx;
          const finishedCount = (activeMatch.tokens[seat.color] || []).filter((p) => p === 56).length;
          const isReacting = visibleReaction && visibleReaction.color === seat.color;

          return (
            <div
              key={seat.color}
              className={`relative p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                meta.softBg
              } ${
                isTurn ? `${meta.border} ring-2 ${meta.ring} shadow-md` : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {isReacting && (
                <div className="absolute -top-4 left-2 z-20 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-amber-300 shadow-lg flex items-center gap-1 animate-bounce">
                  <span className="text-base leading-none">{visibleReaction.emoji}</span>
                  {visibleReaction.label && (
                    <span className="text-[10px] font-black text-slate-800 dark:text-white">{visibleReaction.label}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-6 shrink-0 flex items-center justify-center">
                  <LudoTeardropPin color={seat.color} uid={`seat_${seat.color}`} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                    {seat.name}
                  </div>
                  <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-300 flex items-center gap-1">
                    <span>{meta.label}</span>
                    <span>•</span>
                    <span>{finishedCount}/4 🏁</span>
                  </div>
                </div>
              </div>

              {isTurn && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black shrink-0 animate-pulse">
                  دوره
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Royal Blue Ludo Arena + 3D Dice Controls + Emotion Reactions */}
      <div className="bg-gradient-to-br from-[#0b2f75] via-[#1448a8] to-[#082154] border-2 border-amber-300/60 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col items-center gap-3 relative">
        {visibleReaction && (
          <div className="px-3 py-1 rounded-full bg-slate-900/95 text-white border border-amber-400/70 shadow-lg flex items-center gap-1.5 text-xs font-black animate-bounce">
            <span className="text-lg leading-none">{visibleReaction.emoji}</span>
            <span>{visibleReaction.senderName}</span>
            {visibleReaction.label && <span className="text-amber-300">({visibleReaction.label})</span>}
          </div>
        )}

        {/* Vibrant Classic 15x15 Ludo Board */}
        <div
          dir="ltr"
          className={`relative w-full ${
            fullWindow ? 'max-w-[440px]' : 'max-w-[390px]'
          } aspect-square rounded-2xl overflow-hidden border-[3px] border-amber-300/80 shadow-[0_14px_32px_rgba(0,0,0,0.45)] bg-white select-none`}
        >
          {/* 15x15 Static Tiles Grid */}
          <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] w-full h-full">
            {Array.from({ length: 225 }).map((_, i) => {
              const r = Math.floor(i / 15);
              const c = i % 15;
              const cell = getBoardCellMeta(r, c);

              if (cell.type === 'yard') {
                const bgMap: Record<LudoColor, string> = {
                  red: 'bg-rose-500',
                  green: 'bg-emerald-500',
                  yellow: 'bg-amber-400',
                  blue: 'bg-sky-500',
                };
                const isInnerWhite =
                  (r >= 1 && r <= 4 && c >= 1 && c <= 4) ||
                  (r >= 1 && r <= 4 && c >= 10 && c <= 13) ||
                  (r >= 10 && r <= 13 && c >= 10 && c <= 13) ||
                  (r >= 10 && r <= 13 && c >= 1 && c <= 4);
                return (
                  <div
                    key={i}
                    className={isInnerWhite ? 'bg-white/95' : bgMap[cell.color]}
                  />
                );
              }

              if (cell.type === 'goal') {
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center ${
                      r === 7 && c === 7
                        ? 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500'
                        : r === 6 && c === 7
                        ? 'bg-emerald-500/85'
                        : r === 8 && c === 7
                        ? 'bg-sky-500/85'
                        : r === 7 && c === 6
                        ? 'bg-rose-500/85'
                        : r === 7 && c === 8
                        ? 'bg-amber-400/90'
                        : 'bg-slate-100'
                    } border-[0.5px] border-slate-300/60`}
                  >
                    {r === 7 && c === 7 && <Crown className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </div>
                );
              }

              if (cell.type === 'home') {
                const homeBg: Record<LudoColor, string> = {
                  red: 'bg-rose-400/90',
                  green: 'bg-emerald-400/90',
                  yellow: 'bg-amber-300/95',
                  blue: 'bg-sky-400/90',
                };
                return (
                  <div
                    key={i}
                    className={`${homeBg[cell.color]} border-[0.5px] border-slate-700/20`}
                  />
                );
              }

              const startBg: Record<LudoColor, string> = {
                red: 'bg-rose-500 text-white',
                green: 'bg-emerald-500 text-white',
                yellow: 'bg-amber-400 text-slate-900',
                blue: 'bg-sky-500 text-white',
              };
              return (
                <div
                  key={i}
                  className={`border-[0.5px] border-slate-300 flex items-center justify-center text-[9px] font-black ${
                    cell.startColor
                      ? startBg[cell.startColor]
                      : cell.isStar
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-white text-slate-400'
                  }`}
                >
                  {cell.startColor ? '★' : cell.isStar ? '☆' : ''}
                </div>
              );
            })}
          </div>

          {/* Yard Base Circles */}
          {(['red', 'green', 'yellow', 'blue'] as LudoColor[]).map((color) =>
            YARD_SLOTS[color].map(([sr, sc], idx) => (
              <div
                key={`slot_${color}_${idx}`}
                style={{
                  top: `${((sr + 0.5) / 15) * 100}%`,
                  left: `${((sc + 0.5) / 15) * 100}%`,
                  width: `${(0.85 / 15) * 100}%`,
                  height: `${(0.85 / 15) * 100}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${COLOR_META[color].border} bg-slate-100/90 shadow-inner pointer-events-none`}
              />
            ))
          )}

          {/* Sculpted 3D Teardrop Pin Tokens Layer with ~350ms Step-by-Step Square Movement */}
          {positionedTokens.map((token) => {
            const meta = COLOR_META[token.color];
            const widthPct = token.stackCount > 1 ? 5.6 : 6.6;
            const heightPct = token.stackCount > 1 ? 7.1 : 8.4;
            return (
              <button
                key={token.key}
                type="button"
                disabled={!token.isMovable}
                onClick={() => {
                  if (token.isMovable && activeMatch) {
                    executeTokenMove(activeMatch, token.tokenIdx);
                  }
                }}
                style={{
                  top: `${((token.renderRow + 0.5) / 15) * 100}%`,
                  left: `${((token.renderCol + 0.5) / 15) * 100}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-[74%] bg-transparent p-0 border-0 transition-all duration-300 ease-out flex items-center justify-center ${
                  token.isStepActive
                    ? 'z-40 scale-125 -translate-y-[95%] drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)]'
                    : token.isMovable
                    ? 'z-30 scale-120 animate-bounce cursor-pointer drop-shadow-[0_0_8px_rgba(250,204,21,0.95)]'
                    : 'z-20 cursor-default'
                }`}
                aria-label={`حجر ${meta.label}`}
              >
                <LudoTeardropPin
                  color={token.color}
                  uid={token.key}
                  highlighted={token.isMovable || token.isStepActive}
                />
              </button>
            );
          })}
        </div>

        {/* 3D Dice Roll & Winner Footer Bar */}
        {activeMatch.status === 'finished' ? (
          <div className="w-full max-w-[440px] p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-200 shrink-0" />
              <span className="text-xs sm:text-sm font-black">
                انتهت الجولة! الفائز: {activeMatch.winnerName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleExitMatch}
              className="px-3 py-1.5 rounded-xl bg-white text-rose-700 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>جولة جديدة</span>
            </button>
          </div>
        ) : activeMatch.status === 'playing' ? (
          <div className="w-full max-w-[440px] flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Dice3D value={activeMatch.diceValue || 6} rolling={isRolling} />
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {isMyTurn
                    ? isStepping
                      ? 'جاري التحريك خطوة بخطوة...'
                      : activeMatch.phase === 'roll'
                      ? 'دورك الآن! ارمِ النرد 🎲'
                      : 'اختر حجراً متوهجاً للتحريك 👆'
                    : `دور ${currentSeat?.name || 'اللاعب'}...`}
                </div>
                <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-300">
                  {activeMatch.diceValue
                    ? `نتيجة النرد: ${activeMatch.diceValue}`
                    : 'احصل على 6 لإخراج حجر أو دور إضافي'}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!isMyTurn || activeMatch.phase !== 'roll' || isRolling || isStepping}
              onClick={() => performDiceRoll(activeMatch)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition shrink-0 ${
                isMyTurn && activeMatch.phase === 'roll' && !isRolling && !isStepping
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white shadow-md cursor-pointer active:scale-95'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span>رمي النرد</span>
            </button>
          </div>
        ) : null}

        {/* Quick Emotion Reactions Bar ("إيموشن") */}
        <div className="w-full max-w-[440px] flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-amber-500" />
              <span>إيموشن سريع في اللودو:</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 overflow-x-auto scrollbar-none">
            {QUICK_EMOTIONS.map((em) => (
              <button
                key={em.emoji}
                type="button"
                onClick={() => handleSendEmotion(em.emoji, em.label)}
                title={em.label}
                className="flex flex-col items-center justify-center min-w-[42px] py-1 px-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 active:scale-90 transition cursor-pointer"
              >
                <span className="text-lg leading-none">{em.emoji}</span>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 mt-0.5">{em.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
