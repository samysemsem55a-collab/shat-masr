import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Gamepad2,
  Trophy,
  Sparkles,
  CheckCircle2,
  XCircle,
  Coins,
  ChevronRight,
  Cpu,
  Users,
  Swords,
  RotateCcw,
  Crown,
  Dices
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from '../utils/appToast';
import { User } from '../types/chat';
import { TRIVIA_QUESTIONS, isUserAdminOrOwner } from '../data/seedData';
import {
  subscribeToLeaderboardUsers,
  sendGameChallengeInvite,
  respondToGameChallenge,
  subscribeToGameMatch,
  updateGameMatchState,
} from '../services/firebase';
import { realtimeSocket } from '../services/realtimeSocket';
import { getRankDisplayMeta } from '../utils/userRanks';
import { AvatarWithFrame } from './AvatarWithFrame';
import { sounds } from '../utils/soundEffects';
import { VerifiedBadge } from '../utils/verifiedBadge';
import { LudoGamePanel, ActiveLudoRef } from './LudoGamePanel';

export interface AcceptedExternalChallenge {
  matchId: string;
  opponentId: string;
  opponentName: string;
  opponentAvatar?: string;
  wager: number;
}

interface GamesViewProps {
  currentUser: User;
  allOnlineUsers?: User[];
  onUpdateCoins: (newCoins: number) => void;
  onOpenWallet: () => void;
  externalAcceptedChallenge?: AcceptedExternalChallenge | null;
  onConsumeExternalChallenge?: () => void;
  externalLudoMatchRef?: ActiveLudoRef | null;
  onConsumeExternalLudoMatchRef?: () => void;
  externalQuickInviteUser?: User | null;
  onConsumeExternalQuickInviteUser?: () => void;
  onOpenLudoFullWindow?: () => void;
}

type CellValue = 'X' | 'O' | null;

const WINNING_LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function evaluateBoard(board: CellValue[]): { winner: 'X' | 'O' | 'draw' | null; line: number[] | null } {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

function chooseSmartAiMove(board: CellValue[]): number {
  const empty = board
    .map((val, idx) => (val === null ? idx : -1))
    .filter((idx) => idx !== -1);
  if (empty.length === 0) return -1;

  // 1. Win immediately if possible
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'O';
    if (evaluateBoard(copy).winner === 'O') return idx;
  }
  // 2. Block player winning move
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'X';
    if (evaluateBoard(copy).winner === 'X') return idx;
  }
  // 3. Smart tactical preference (center / corners) with slight human feel (winnable)
  if (board[4] === null && Math.random() < 0.75) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0 && Math.random() < 0.72) {
    return corners[Math.floor(Math.random() * corners.length)];
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

export const GamesView: React.FC<GamesViewProps> = ({
  currentUser,
  allOnlineUsers = [],
  onUpdateCoins,
  onOpenWallet,
  externalAcceptedChallenge = null,
  onConsumeExternalChallenge,
  externalLudoMatchRef = null,
  onConsumeExternalLudoMatchRef,
  externalQuickInviteUser = null,
  onConsumeExternalQuickInviteUser,
  onOpenLudoFullWindow,
}) => {
  const isStrictOwner = isUserAdminOrOwner(currentUser);
  const [activeSubTab, setActiveSubTab] = useState<'trivia' | 'tictactoe' | 'ludo' | 'leaderboard'>('trivia');

  useEffect(() => {
    if (externalLudoMatchRef || externalQuickInviteUser) {
      setActiveSubTab('ludo');
    }
  }, [externalLudoMatchRef, externalQuickInviteUser]);

  // Keep fresh coins ref for async WS / AI timeouts
  const coinsRef = useRef<number>(currentUser.coins || 0);
  useEffect(() => {
    coinsRef.current = currentUser.coins || 0;
  }, [currentUser.coins]);

  // Trivia State (5-question rounds)
  const TRIVIA_ROUND_SIZE = 5;
  const [roundStartOffset, setRoundStartOffset] = useState(0);
  const [roundQuestionStep, setRoundQuestionStep] = useState(0);
  const [roundCorrectCount, setRoundCorrectCount] = useState(0);
  const [roundCoinsEarned, setRoundCoinsEarned] = useState(0);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [scoreStreak, setScoreStreak] = useState(0);
  const [totalTriviaPoints, setTotalTriviaPoints] = useState(0);

  const currentQuestionIndex = (roundStartOffset + roundQuestionStep) % TRIVIA_QUESTIONS.length;
  const question = TRIVIA_QUESTIONS[currentQuestionIndex];

  // Live Leaderboard State
  const [leaders, setLeaders] = useState<User[]>([]);
  useEffect(() => {
    const unsub = subscribeToLeaderboardUsers((users) => {
      setLeaders(users || []);
    });
    return () => unsub();
  }, []);

  // Question Timer
  useEffect(() => {
    if (activeSubTab !== 'trivia' || hasAnswered || isRoundFinished) return;

    if (timerSeconds <= 0) {
      setHasAnswered(true);
      setScoreStreak(0);
      return;
    }

    const timer = setInterval(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerSeconds, activeSubTab, hasAnswered, isRoundFinished]);

  const handleSelectAnswer = (optionIdx: number) => {
    if (hasAnswered || isRoundFinished) return;
    setSelectedOption(optionIdx);
    setHasAnswered(true);

    const isCorrect = optionIdx === question.correctIndex;
    if (isCorrect) {
      sounds.playCoinsReward();
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
      const reward = question.coinsReward || 10;
      onUpdateCoins(coinsRef.current + reward);
      setScoreStreak((prev) => prev + 1);
      setTotalTriviaPoints((prev) => prev + reward);
      setRoundCorrectCount((prev) => prev + 1);
      setRoundCoinsEarned((prev) => prev + reward);
    } else {
      sounds.playMessageSent();
      setScoreStreak(0);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setHasAnswered(false);
    setTimerSeconds(15);
    if (roundQuestionStep + 1 >= TRIVIA_ROUND_SIZE) {
      setIsRoundFinished(true);
      sounds.playGiftFanfare();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      return;
    }
    setRoundQuestionStep((prev) => prev + 1);
  };

  const handleStartNewTriviaRound = () => {
    setRoundStartOffset((prev) => (prev + TRIVIA_ROUND_SIZE) % TRIVIA_QUESTIONS.length);
    setRoundQuestionStep(0);
    setRoundCorrectCount(0);
    setRoundCoinsEarned(0);
    setIsRoundFinished(false);
    setSelectedOption(null);
    setHasAnswered(false);
    setTimerSeconds(15);
  };

  // =========================================================================
  // TIC-TAC-TOE (إكس أو) - Solo vs Smart AI & Live Online 1v1 Challenge
  // =========================================================================
  const [xoMode, setXoMode] = useState<'ai' | 'online'>('ai');
  const [xoWager, setXoWager] = useState<number>(0);
  const [xoBoard, setXoBoard] = useState<CellValue[]>(Array(9).fill(null));
  const [xoTurn, setXoTurn] = useState<'X' | 'O'>('X');
  const [xoMySymbol, setXoMySymbol] = useState<'X' | 'O'>('X');
  const [xoWagerLocked, setXoWagerLocked] = useState<boolean>(false);
  const [xoAiThinking, setXoAiThinking] = useState<boolean>(false);
  const [xoStats, setXoStats] = useState({ wins: 0, draws: 0, losses: 0 });

  // Online Match State
  const [onlineOpponent, setOnlineOpponent] = useState<User | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [pendingSentInviteTo, setPendingSentInviteTo] = useState<string | null>(null);
  const [pendingSentMatch, setPendingSentMatch] = useState<{
    matchId: string;
    targetUser: User;
    wager: number;
  } | null>(null);
  const rematchSeqRef = useRef<number>(0);
  const [incomingInvite, setIncomingInvite] = useState<{
    matchId: string;
    fromId: string;
    fromName: string;
    fromAvatar?: string;
    wager: number;
  } | null>(null);

  const boardResult = useMemo(() => evaluateBoard(xoBoard), [xoBoard]);
  const settledMatchRef = useRef<string | null>(null);

  const resetLocalAiBoard = () => {
    setXoBoard(Array(9).fill(null));
    setXoTurn('X');
    setXoMySymbol('X');
    setXoWagerLocked(false);
    setXoAiThinking(false);
    settledMatchRef.current = null;
  };

  // Settle AI game outcomes & rewards
  useEffect(() => {
    if (xoMode !== 'ai') return;
    if (!boardResult.winner) return;
    const roundKey = `ai_${xoBoard.join('')}`;
    if (settledMatchRef.current === roundKey) return;
    settledMatchRef.current = roundKey;

    if (boardResult.winner === 'X') {
      sounds.playGiftFanfare();
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
      setXoStats((s) => ({ ...s, wins: s.wins + 1 }));
      const prize = xoWager > 0 ? xoWager * 2 : 15;
      onUpdateCoins(coinsRef.current + prize);
      toast.success(`🎉 مبروك الفوز! حصلت على +${prize.toLocaleString()} كوينز`);
    } else if (boardResult.winner === 'draw') {
      sounds.playMessageSent();
      setXoStats((s) => ({ ...s, draws: s.draws + 1 }));
      if (xoWager > 0 && xoWagerLocked && !isStrictOwner) {
        onUpdateCoins(coinsRef.current + xoWager);
        toast.info(`تعادل! تم استرجاع ${xoWager} كوينز إلى رصيدك 🤝`);
      } else {
        toast.info('تعادل عادل! جرب جولة أخرى 🤝');
      }
    } else {
      sounds.playMessageSent();
      setXoStats((s) => ({ ...s, losses: s.losses + 1 }));
      toast.error('فاز الكمبيوتر هذه المرة! حاول مرة أخرى 🤖');
    }
  }, [boardResult.winner, xoMode, xoBoard, xoWager, xoWagerLocked, isStrictOwner, onUpdateCoins]);

  // AI turn trigger
  useEffect(() => {
    if (xoMode !== 'ai' || xoTurn !== 'O' || boardResult.winner) return;
    setXoAiThinking(true);
    const t = setTimeout(() => {
      setXoBoard((prev) => {
        if (evaluateBoard(prev).winner) return prev;
        const move = chooseSmartAiMove(prev);
        if (move === -1) return prev;
        const next = [...prev];
        next[move] = 'O';
        return next;
      });
      setXoTurn('X');
      setXoAiThinking(false);
    }, 520);
    return () => clearTimeout(t);
  }, [xoMode, xoTurn, boardResult.winner]);

  // Listen for Live Tic-Tac-Toe WebSocket Signals
  useEffect(() => {
    const unsub = realtimeSocket.subscribeToTicTacToeSignals((signal) => {
      if (!signal || signal.fromId === currentUser.id) return;

      if (signal.type === 'invite' && signal.targetId === currentUser.id) {
        sounds.playMessageReceived();
        setIncomingInvite({
          matchId: signal.matchId,
          fromId: signal.fromId,
          fromName: signal.fromName || 'عضو شات مصر',
          fromAvatar: signal.fromAvatar,
          wager: Number(signal.wager) || 0
        });
        toast.info(`⚔️ تحدي إكس أو جديد من ${signal.fromName || 'عضو'}!`, { duration: 6000 });
        return;
      }

      if (signal.type === 'accept' && signal.targetId === currentUser.id) {
        if (signal.wager > 0 && !isStrictOwner) {
          if (coinsRef.current < signal.wager) {
            toast.error('رصيدك غير كافٍ للرهان في هذا التحدي');
            return;
          }
          onUpdateCoins(Math.max(0, coinsRef.current - signal.wager));
        }
        setPendingSentInviteTo(null);
        setXoMode('online');
        setActiveSubTab('tictactoe');
        setActiveMatchId(signal.matchId);
        setXoWager(Number(signal.wager) || 0);
        setXoWagerLocked(Number(signal.wager) > 0);
        setXoMySymbol('X');
        setXoTurn('X');
        setXoBoard(Array(9).fill(null));
        settledMatchRef.current = null;
        setOnlineOpponent({
          id: signal.fromId,
          name: signal.fromName || 'منافس',
          username: signal.fromId,
          avatar: signal.fromAvatar || '',
          bio: '',
          country: 'مصر',
          countryFlag: '🇪🇬',
          role: 'member',
          coins: 0,
          earningsEgp: 0,
          earningsUsd: 0,
          vipBadge: '',
          frameStyle: '',
          profileWallpaper: '',
          fontPreference: 'cairo',
          isOnline: true,
          status: 'online',
          joinedAt: '',
          gender: 'male',
          level: 1,
          likesReceived: 0,
          giftsReceivedCount: 0
        });
        sounds.playCoinsReward();
        toast.success(`بدأ التحدي المباشر ضد ${signal.fromName}! دورك الآن (X) 🎮`);
        return;
      }

      if (signal.type === 'decline' && signal.targetId === currentUser.id) {
        setPendingSentInviteTo(null);
        toast.info(`اعتذر ${signal.fromName || 'العضو'} عن التحدي حالياً`);
        return;
      }

      if (signal.type === 'move' && signal.matchId && signal.matchId === activeMatchId) {
        const idx = Number(signal.index);
        const symbol: 'X' | 'O' = signal.symbol === 'X' ? 'X' : 'O';
        if (idx >= 0 && idx < 9) {
          sounds.playMessageSent();
          setXoBoard((prev) => {
            if (prev[idx] !== null) return prev;
            const next = [...prev];
            next[idx] = symbol;
            return next;
          });
          setXoTurn(symbol === 'X' ? 'O' : 'X');
        }
        return;
      }

      if (signal.type === 'rematch' && signal.matchId && signal.matchId === activeMatchId) {
        setXoBoard(Array(9).fill(null));
        setXoTurn('X');
        settledMatchRef.current = null;
        toast.info('بدأت جولة جديدة! 🎯');
        return;
      }

      if (signal.type === 'forfeit' && signal.matchId && signal.matchId === activeMatchId) {
        if (settledMatchRef.current !== `forfeit_${activeMatchId}`) {
          settledMatchRef.current = `forfeit_${activeMatchId}`;
          const prize = xoWager > 0 ? xoWager * 2 : 20;
          onUpdateCoins(coinsRef.current + prize);
          setXoStats((s) => ({ ...s, wins: s.wins + 1 }));
          sounds.playGiftFanfare();
          toast.success(`انسحب المنافس! فزت بالجولة (+${prize} كوينز) 🏆`);
        }
        setActiveMatchId(null);
        setOnlineOpponent(null);
        setXoWagerLocked(false);
      }
    });
    return () => unsub();
  }, [currentUser.id, activeMatchId, isStrictOwner, xoWager, onUpdateCoins]);

  // Apply challenge accepted from global banner (App.tsx)
  useEffect(() => {
    if (!externalAcceptedChallenge) return;
    setXoMode('online');
    setActiveSubTab('tictactoe');
    setActiveMatchId(externalAcceptedChallenge.matchId);
    setXoWager(externalAcceptedChallenge.wager);
    setXoWagerLocked(externalAcceptedChallenge.wager > 0);
    setXoMySymbol('O');
    setXoTurn('X');
    setXoBoard(Array(9).fill(null));
    settledMatchRef.current = null;
    rematchSeqRef.current = 0;
    setOnlineOpponent({
      id: externalAcceptedChallenge.opponentId,
      name: externalAcceptedChallenge.opponentName,
      username: externalAcceptedChallenge.opponentId,
      avatar: externalAcceptedChallenge.opponentAvatar || '',
      bio: '',
      country: 'مصر',
      countryFlag: '🇪🇬',
      role: 'member',
      coins: 0,
      earningsEgp: 0,
      earningsUsd: 0,
      vipBadge: '',
      frameStyle: '',
      profileWallpaper: '',
      fontPreference: 'cairo',
      isOnline: true,
      status: 'online',
      joinedAt: '',
      gender: 'male',
      level: 1,
      likesReceived: 0,
      giftsReceivedCount: 0,
    });
    onConsumeExternalChallenge?.();
  }, [externalAcceptedChallenge, onConsumeExternalChallenge]);

  // Dedicated Firestore onSnapshot: Challenger waits for opponent acceptance/decline reliably
  useEffect(() => {
    if (!pendingSentMatch?.matchId) return;
    const unsub = subscribeToGameMatch(pendingSentMatch.matchId, (match) => {
      if (!match) return;
      if (match.status === 'active') {
        if (pendingSentMatch.wager > 0 && !isStrictOwner) {
          if (coinsRef.current < pendingSentMatch.wager) {
            toast.error('رصيدك غير كافٍ للرهان في هذا التحدي');
            setPendingSentInviteTo(null);
            setPendingSentMatch(null);
            return;
          }
          onUpdateCoins(Math.max(0, coinsRef.current - pendingSentMatch.wager));
        }
        setPendingSentInviteTo(null);
        setPendingSentMatch(null);
        setXoMode('online');
        setActiveSubTab('tictactoe');
        setActiveMatchId(match.id);
        setXoWager(match.wager);
        setXoWagerLocked(match.wager > 0);
        setXoMySymbol('X');
        setXoTurn(match.turn);
        setXoBoard(match.board);
        settledMatchRef.current = null;
        rematchSeqRef.current = match.rematchSeq || 0;
        setOnlineOpponent(pendingSentMatch.targetUser);
        sounds.playCoinsReward();
        toast.success(`بدأ التحدي المباشر ضد ${match.playerOName || pendingSentMatch.targetUser.name}! دورك الآن (X) 🎮`);
      } else if (match.status === 'declined') {
        setPendingSentInviteTo(null);
        setPendingSentMatch(null);
        toast.info(`اعتذر ${match.playerOName || pendingSentMatch.targetUser.name} عن التحدي حالياً`);
      }
    });
    return () => unsub();
  }, [pendingSentMatch, isStrictOwner, onUpdateCoins]);

  // Dedicated Firestore onSnapshot: Active Live Tic-Tac-Toe Match State Sync
  useEffect(() => {
    if (!activeMatchId) return;
    const unsub = subscribeToGameMatch(activeMatchId, (match) => {
      if (!match) return;
      if (match.status === 'forfeited' && match.forfeitedBy && match.forfeitedBy !== currentUser.id) {
        if (settledMatchRef.current !== `forfeit_${activeMatchId}`) {
          settledMatchRef.current = `forfeit_${activeMatchId}`;
          const prize = xoWager > 0 ? xoWager * 2 : 20;
          onUpdateCoins(coinsRef.current + prize);
          setXoStats((s) => ({ ...s, wins: s.wins + 1 }));
          sounds.playGiftFanfare();
          toast.success(`انسحب المنافس! فزت بالجولة (+${prize} كوينز) 🏆`);
        }
        setActiveMatchId(null);
        setOnlineOpponent(null);
        setXoWagerLocked(false);
        return;
      }
      if (match.rematchSeq > rematchSeqRef.current) {
        rematchSeqRef.current = match.rematchSeq;
        settledMatchRef.current = null;
        setXoBoard(match.board);
        setXoTurn(match.turn);
        toast.info('بدأت جولة جديدة! 🎯');
        return;
      }
      setXoBoard(match.board);
      setXoTurn(match.turn);
    });
    return () => unsub();
  }, [activeMatchId, currentUser.id, xoWager, onUpdateCoins]);

  // Settle Online Challenge Result
  useEffect(() => {
    if (xoMode !== 'online' || !activeMatchId || !boardResult.winner) return;
    const key = `online_${activeMatchId}_${xoBoard.join('')}`;
    if (settledMatchRef.current === key) return;
    settledMatchRef.current = key;

    if (boardResult.winner === xoMySymbol) {
      sounds.playGiftFanfare();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      setXoStats((s) => ({ ...s, wins: s.wins + 1 }));
      const prize = xoWager > 0 ? xoWager * 2 : 25;
      onUpdateCoins(coinsRef.current + prize);
      toast.success(`🏆 مبروك فزت في التحدي المباشر! +${prize.toLocaleString()} كوينز`);
    } else if (boardResult.winner === 'draw') {
      sounds.playMessageSent();
      setXoStats((s) => ({ ...s, draws: s.draws + 1 }));
      if (xoWager > 0 && !isStrictOwner) {
        onUpdateCoins(coinsRef.current + xoWager);
      }
      toast.info('تعادل مشوق بينكما! 🤝');
    } else {
      sounds.playMessageSent();
      setXoStats((s) => ({ ...s, losses: s.losses + 1 }));
      toast.error('فاز منافسك في هذه الجولة! اطلب جولة ثأرية ⚔️');
    }
  }, [boardResult.winner, xoMode, activeMatchId, xoBoard, xoMySymbol, xoWager, isStrictOwner, onUpdateCoins]);

  const handleCellClick = (idx: number) => {
    if (xoBoard[idx] !== null || boardResult.winner) return;

    if (xoMode === 'ai') {
      if (xoTurn !== 'X' || xoAiThinking) return;
      // Lock wager on first move
      if (!xoWagerLocked && xoWager > 0 && !isStrictOwner) {
        if (coinsRef.current < xoWager) {
          toast.warning(`رصيدك أقل من رهان ${xoWager} كوينز!`);
          return;
        }
        onUpdateCoins(Math.max(0, coinsRef.current - xoWager));
        setXoWagerLocked(true);
      }
      sounds.playMessageSent();
      const next = [...xoBoard];
      next[idx] = 'X';
      setXoBoard(next);
      setXoTurn('O');
      return;
    }

    // Online Live Match
    if (!activeMatchId || !onlineOpponent) return;
    if (xoTurn !== xoMySymbol) {
      toast.info('انتظر دور المنافس الآن ⏳');
      return;
    }
    sounds.playMessageSent();
    const next = [...xoBoard];
    next[idx] = xoMySymbol;
    const nextTurn = xoMySymbol === 'X' ? 'O' : 'X';
    setXoBoard(next);
    setXoTurn(nextTurn);
    updateGameMatchState(activeMatchId, {
      board: next,
      turn: nextTurn,
      status: 'active',
    }).catch(() => {});
    realtimeSocket.sendTicTacToeSignal(onlineOpponent.id, {
      type: 'move',
      matchId: activeMatchId,
      fromId: currentUser.id,
      targetId: onlineOpponent.id,
      index: idx,
      symbol: xoMySymbol
    });
  };

  const handleSendOnlineChallenge = (target: User) => {
    if (!isStrictOwner && xoWager > 0 && coinsRef.current < xoWager) {
      toast.warning(`تحتاج إلى ${xoWager} كوينز لبدء التحدي بهذا الرهان`);
      onOpenWallet();
      return;
    }
    const matchId = `xo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setPendingSentInviteTo(target.id);
    setPendingSentMatch({ matchId, targetUser: target, wager: xoWager });
    sendGameChallengeInvite({
      matchId,
      fromUser: currentUser,
      targetUserId: target.id,
      wager: xoWager,
      gameType: 'tictactoe',
    }).catch(() => {});
    realtimeSocket.sendTicTacToeSignal(target.id, {
      type: 'invite',
      matchId,
      fromId: currentUser.id,
      fromName: currentUser.name,
      fromAvatar: currentUser.avatar,
      targetId: target.id,
      wager: xoWager
    });
    toast.success(`تم إرسال دعوة تحدي إكس أو إلى ${target.name} ⚔️`);
  };

  const handleAcceptIncomingInvite = () => {
    if (!incomingInvite) return;
    if (!isStrictOwner && incomingInvite.wager > 0 && coinsRef.current < incomingInvite.wager) {
      toast.warning(`تحتاج إلى ${incomingInvite.wager} كوينز لقبول هذا التحدي!`);
      return;
    }
    if (!isStrictOwner && incomingInvite.wager > 0) {
      onUpdateCoins(Math.max(0, coinsRef.current - incomingInvite.wager));
    }
    respondToGameChallenge({
      userId: currentUser.id,
      matchId: incomingInvite.matchId,
      acceptorUser: currentUser,
      status: 'accepted',
    }).catch(() => {});
    realtimeSocket.sendTicTacToeSignal(incomingInvite.fromId, {
      type: 'accept',
      matchId: incomingInvite.matchId,
      fromId: currentUser.id,
      fromName: currentUser.name,
      fromAvatar: currentUser.avatar,
      targetId: incomingInvite.fromId,
      wager: incomingInvite.wager
    });
    setXoMode('online');
    setActiveSubTab('tictactoe');
    setActiveMatchId(incomingInvite.matchId);
    setXoWager(incomingInvite.wager);
    setXoWagerLocked(incomingInvite.wager > 0);
    setXoMySymbol('O');
    setXoTurn('X');
    setXoBoard(Array(9).fill(null));
    settledMatchRef.current = null;
    rematchSeqRef.current = 0;
    setOnlineOpponent({
      id: incomingInvite.fromId,
      name: incomingInvite.fromName,
      username: incomingInvite.fromId,
      avatar: incomingInvite.fromAvatar || '',
      bio: '',
      country: 'مصر',
      countryFlag: '🇪🇬',
      role: 'member',
      coins: 0,
      earningsEgp: 0,
      earningsUsd: 0,
      vipBadge: '',
      frameStyle: '',
      profileWallpaper: '',
      fontPreference: 'cairo',
      isOnline: true,
      status: 'online',
      joinedAt: '',
      gender: 'male',
      level: 1,
      likesReceived: 0,
      giftsReceivedCount: 0
    });
    setIncomingInvite(null);
    sounds.playCoinsReward();
  };

  const handleDeclineIncomingInvite = () => {
    if (!incomingInvite) return;
    respondToGameChallenge({
      userId: currentUser.id,
      matchId: incomingInvite.matchId,
      acceptorUser: currentUser,
      status: 'declined',
    }).catch(() => {});
    realtimeSocket.sendTicTacToeSignal(incomingInvite.fromId, {
      type: 'decline',
      matchId: incomingInvite.matchId,
      fromId: currentUser.id,
      fromName: currentUser.name,
      targetId: incomingInvite.fromId
    });
    setIncomingInvite(null);
  };

  const handleOnlineRematch = () => {
    if (!onlineOpponent || !activeMatchId) return;
    if (!isStrictOwner && xoWager > 0 && coinsRef.current < xoWager) {
      toast.warning(`رصيدك أقل من رهان ${xoWager} كوينز`);
      return;
    }
    if (!isStrictOwner && xoWager > 0) {
      onUpdateCoins(Math.max(0, coinsRef.current - xoWager));
    }
    const emptyBoard = Array(9).fill(null);
    const nextSeq = rematchSeqRef.current + 1;
    rematchSeqRef.current = nextSeq;
    setXoBoard(emptyBoard);
    setXoTurn('X');
    settledMatchRef.current = null;
    updateGameMatchState(activeMatchId, {
      board: emptyBoard,
      turn: 'X',
      status: 'active',
      rematchSeq: nextSeq,
    }).catch(() => {});
    realtimeSocket.sendTicTacToeSignal(onlineOpponent.id, {
      type: 'rematch',
      matchId: activeMatchId,
      fromId: currentUser.id,
      targetId: onlineOpponent.id
    });
  };

  const handleForfeitOnline = () => {
    if (onlineOpponent && activeMatchId) {
      updateGameMatchState(activeMatchId, {
        status: 'forfeited',
        forfeitedBy: currentUser.id,
      }).catch(() => {});
      realtimeSocket.sendTicTacToeSignal(onlineOpponent.id, {
        type: 'forfeit',
        matchId: activeMatchId,
        fromId: currentUser.id,
        targetId: onlineOpponent.id
      });
    }
    setActiveMatchId(null);
    setOnlineOpponent(null);
    setXoBoard(Array(9).fill(null));
    setXoWagerLocked(false);
    settledMatchRef.current = null;
  };

  const availableOpponents = useMemo(
    () => allOnlineUsers.filter((u) => u.id && u.id !== currentUser.id),
    [allOnlineUsers, currentUser.id]
  );

  return (
    <div className="pb-24 pt-3 px-3 sm:px-4 max-w-4xl mx-auto space-y-3.5" dir="rtl">
      {/* Incoming Online Challenge Notification Banner */}
      {incomingInvite && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">
              ⚔️
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black truncate">
                يتحداك {incomingInvite.fromName} في لعبة إكس أو (XO)!
              </p>
              <p className="text-[11px] text-indigo-100">
                {incomingInvite.wager > 0
                  ? `الرهان: ${incomingInvite.wager} كوينز (الفائز يربح ${incomingInvite.wager * 2} 🪙)`
                  : 'مباراة ودية مجانية بدون رهان'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAcceptIncomingInvite}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black shadow-sm cursor-pointer transition"
            >
              قبول التحدي ⚔️
            </button>
            <button
              type="button"
              onClick={handleDeclineIncomingInvite}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer transition"
            >
              رفض
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
        <div>
          <h1 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <span>الألعاب والمسابقات ولوحة الصدارة</span>
            <Gamepad2 className="w-5 h-5 text-indigo-600" />
          </h1>
          <p className="text-xs text-slate-500">
            مسابقات ثقافية، تحدي إكس أو (ضد الذكاء أو الأونلاين)، وجوائز كوينز فورية
          </p>
        </div>

        {!isStrictOwner && (
          <button
            type="button"
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-black transition cursor-pointer shrink-0"
          >
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span>{currentUser.coins.toLocaleString()} 🪙</span>
          </button>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('trivia')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'trivia'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>المسابقة الثقافية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tictactoe')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'tictactoe'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>لعبة إكس أو (XO)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenLudoFullWindow) {
              onOpenLudoFullWindow();
            } else {
              setActiveSubTab('ludo');
            }
          }}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'ludo'
              ? 'bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Dices className="w-4 h-4" />
          <span>لعبة اللودو</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('leaderboard')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'leaderboard'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>لوحة الصدارة ({leaders.length})</span>
        </button>
      </div>

      {activeSubTab === 'ludo' && (
        <LudoGamePanel
          currentUser={currentUser}
          allOnlineUsers={allOnlineUsers}
          onUpdateCoins={onUpdateCoins}
          onOpenWallet={onOpenWallet}
          externalLudoMatchRef={externalLudoMatchRef}
          onConsumeExternalLudoMatchRef={onConsumeExternalLudoMatchRef}
          externalQuickInviteUser={externalQuickInviteUser}
          onConsumeExternalQuickInviteUser={onConsumeExternalQuickInviteUser}
        />
      )}

      {/* 1. Cultural Trivia Quiz Engine */}
      {activeSubTab === 'trivia' && (
        <div className="space-y-3.5">
          {/* Top Status Card */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">سلسلة الفوز 🔥</span>
              <span className="font-black text-amber-600 text-sm sm:text-base">{scoreStreak} متتالية</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">الوقت المتبقي ⏳</span>
              <span className={`font-black text-sm sm:text-base ${timerSeconds <= 5 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                0:{timerSeconds < 10 ? '0' : ''}{timerSeconds}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-slate-500 block text-[10px]">جائزة اليوم 🪙</span>
              <span className="font-black text-indigo-600 text-sm sm:text-base">+{totalTriviaPoints} كوينز</span>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                  {question.category}
                </span>
                <span className="text-slate-700 font-black text-[11px]">
                  السؤال {roundQuestionStep + 1} من {TRIVIA_ROUND_SIZE}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-indigo-600 to-emerald-500 transition-all duration-300"
                  style={{ width: `${((roundQuestionStep + 1) / TRIVIA_ROUND_SIZE) * 100}%` }}
                />
              </div>
            </div>

            <h2 className="text-sm sm:text-base font-black text-slate-900 leading-relaxed">
              {question.question}
            </h2>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {question.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === question.correctIndex;
                let btnStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer';

                if (hasAnswered) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm font-black';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-50 border-rose-400 text-rose-800 font-black';
                  } else {
                    btnStyle = 'bg-slate-50 border-slate-200 text-slate-500 opacity-75';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={hasAnswered}
                    onClick={() => handleSelectAnswer(idx)}
                    className={`p-3 rounded-2xl border text-right text-xs sm:text-sm font-bold flex items-center justify-between transition-all ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {hasAnswered && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {hasAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Answer feedback & Explanation */}
            {hasAnswered && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-black">
                  {selectedOption === question.correctIndex ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> أحسنت! إجابة صحيحة (+{question.coinsReward} كوينز)
                    </span>
                  ) : (
                    <span className="text-rose-700 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> للأسف إجابة خاطئة! حظ أوفر في السؤال القادم
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700">
                  💡 {question.explanation}
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <span>{roundQuestionStep + 1 >= TRIVIA_ROUND_SIZE ? 'عرض نتيجة الجولة 🏆' : 'السؤال التالي'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5-Question Round Completion Summary Modal */}
          {isRoundFinished && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="w-full max-w-sm bg-white border border-indigo-200 rounded-3xl p-5 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center mx-auto shadow-md text-3xl">
                  🏆
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">اكتملت جولة الـ {TRIVIA_ROUND_SIZE} أسئلة!</h3>
                  <p className="text-xs text-slate-600">
                    أجبت بشكل صحيح على <strong className="text-emerald-700">{roundCorrectCount} من {TRIVIA_ROUND_SIZE}</strong> أسئلة ({Math.round((roundCorrectCount / TRIVIA_ROUND_SIZE) * 100)}%)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 block font-bold">دقة الإجابات</span>
                    <span className="text-base font-black text-emerald-800">{Math.round((roundCorrectCount / TRIVIA_ROUND_SIZE) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-700 block font-bold">مكسب الجولة</span>
                    <span className="text-base font-black text-amber-800">+{roundCoinsEarned} 🪙</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleStartNewTriviaRound}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer"
                  >
                    جولة جديدة (5 أسئلة) 🚀
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoundFinished(false);
                      setActiveSubTab('leaderboard');
                    }}
                    className="w-full py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    عرض لوحة الصدارة
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Tic-Tac-Toe (إكس أو) - Solo vs Smart AI & Live Online Challenge */}
      {activeSubTab === 'tictactoe' && (
        <div className="space-y-3.5">
          {/* Scoreboard + Mode Switch */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    if (activeMatchId) handleForfeitOnline();
                    setXoMode('ai');
                    resetLocalAiBoard();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    xoMode === 'ai' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>ضد الكمبيوتر الذكي</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setXoMode('online');
                    resetLocalAiBoard();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    xoMode === 'online' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>تحدي أونلاين ({availableOpponents.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-black">
                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  فوز: {xoStats.wins}
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  تعادل: {xoStats.draws}
                </span>
                <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  خسارة: {xoStats.losses}
                </span>
              </div>
            </div>

            {/* Coin Wager Selector */}
            {!xoWagerLocked && !activeMatchId && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">قيمة الرهان بالعملات (اختياري):</span>
                <div className="flex items-center gap-1.5">
                  {[0, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setXoWager(amt)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border transition cursor-pointer ${
                        xoWager === amt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {amt === 0 ? 'مجاني ✨' : `${amt} 🪙`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Online Challenge Lobby when no active online match */}
          {xoMode === 'online' && !activeMatchId ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-emerald-600" />
                  <span>اختر عضواً متصلاً لتحديه مباشرة:</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {availableOpponents.length} متاح
                </span>
              </div>

              {availableOpponents.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-2xl">🎮</div>
                  <p className="text-xs font-bold text-slate-700">لا يوجد أعضاء آخرون متصلون في هذه اللحظة.</p>
                  <p className="text-[11px] text-slate-500">يمكنك اللعب الآن في وضع "ضد الكمبيوتر الذكي" والفوز بالكوينز!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                  {availableOpponents.map((peer) => {
                    const isInvited = pendingSentInviteTo === peer.id;
                    return (
                      <div
                        key={peer.id}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarWithFrame user={peer} size="sm" showOnlineDot />
                          <div className="min-w-0 text-right">
                            <p className="text-xs font-black text-slate-900 truncate">{peer.name}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">● متصل الآن</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isInvited}
                          onClick={() => handleSendOnlineChallenge(peer)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition shrink-0 cursor-pointer ${
                            isInvited
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 cursor-default'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          }`}
                        >
                          {isInvited ? 'تم الإرسال ⏳' : 'تحدي ⚔️'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Active Game Board (AI or Online 1v1) */
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
              {/* Match Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="text-xs font-black text-slate-900">
                  {xoMode === 'ai' ? (
                    <span>أنت (❌) vs الكمبيوتر الذكي (⭕)</span>
                  ) : (
                    <span>
                      أنت ({xoMySymbol === 'X' ? '❌' : '⭕'}) vs {onlineOpponent?.name} ({xoMySymbol === 'X' ? '⭕' : '❌'})
                    </span>
                  )}
                </div>
                <div className="text-xs font-black">
                  {boardResult.winner ? (
                    boardResult.winner === 'draw' ? (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">تعادل 🤝</span>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-full ${
                        boardResult.winner === xoMySymbol
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {boardResult.winner === xoMySymbol ? 'أنت الفائز! 🏆' : 'فاز المنافس'}
                      </span>
                    )
                  ) : (
                    <span className={`px-2.5 py-1 rounded-full ${
                      xoTurn === xoMySymbol ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {xoTurn === xoMySymbol
                        ? 'دورك الآن!'
                        : xoMode === 'ai'
                        ? 'جاري تفكير الكمبيوتر...'
                        : `بانتظار حركة ${onlineOpponent?.name || 'المنافس'}...`}
                    </span>
                  )}
                </div>
              </div>

              {/* 3x3 XO Grid */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[290px] mx-auto">
                {xoBoard.map((cell, idx) => {
                  const isWinCell = boardResult.line?.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={Boolean(cell) || Boolean(boardResult.winner)}
                      onClick={() => handleCellClick(idx)}
                      className={`aspect-square rounded-2xl border-2 text-3xl sm:text-4xl font-black flex items-center justify-center transition-all ${
                        isWinCell
                          ? 'bg-emerald-50 border-emerald-500 scale-[1.03] shadow-md'
                          : cell
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 active:scale-95 cursor-pointer shadow-xs'
                      }`}
                    >
                      {cell === 'X' && <span className="text-indigo-600 drop-shadow-2xs">✕</span>}
                      {cell === 'O' && <span className="text-rose-500 drop-shadow-2xs">◯</span>}
                    </button>
                  );
                })}
              </div>

              {/* Round Controls */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {xoMode === 'ai' ? (
                  <button
                    type="button"
                    onClick={resetLocalAiBoard}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{boardResult.winner ? 'لعب جولة جديدة' : 'إعادة اللوحة'}</span>
                  </button>
                ) : (
                  <>
                    {boardResult.winner && (
                      <button
                        type="button"
                        onClick={handleOnlineRematch}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>جولة ثأرية ⚔️</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleForfeitOnline}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer transition"
                    >
                      إنهاء المباراة
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Live Real-Time Global Leaderboard */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-gradient-to-r from-indigo-50 to-amber-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs shadow-sm">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>لوحة الشرف وتصنيف المتصدرين في شات مصر</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10.5px]">
              تحديث لحظي مباشر
            </span>
          </div>

          {leaders.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 space-y-2 shadow-sm">
              <div className="text-3xl">🏆</div>
              <p className="text-xs font-bold text-slate-700">جاري تحميل قائمة المتصدرين من قاعدة البيانات...</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaders.map((user, index) => {
                const rank = index + 1;
                const rankMeta = getRankDisplayMeta(user.role, user.vipBadge);
                const totalScore =
                  (Number(user.ratingPoints) || 0) +
                  Math.floor((Number(user.coins) || 0) / 25) +
                  (Number(user.giftsReceivedCount) || 0) * 15;
                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all shadow-sm ${
                      rank === 1
                        ? 'bg-gradient-to-r from-amber-50 to-white border-amber-300'
                        : rank === 2
                        ? 'bg-gradient-to-r from-slate-50 to-white border-slate-300'
                        : rank === 3
                        ? 'bg-gradient-to-r from-orange-50 to-white border-orange-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-slate-700 shrink-0">
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </div>

                      <AvatarWithFrame user={user} size="sm" showOnlineDot={user.isOnline} />

                      <div className="min-w-0 text-right">
                        <h4 className={`text-xs font-black truncate flex items-center gap-1 ${rankMeta.nameColorClass}`}>
                          <span className="truncate">{user.name}</span>
                          <VerifiedBadge verified={user.verified} size="xs" />
                          <span>{user.countryFlag || '🇪🇬'}</span>
                        </h4>
                        <span className="text-[10px] text-amber-700 font-bold">
                          {rankMeta.isPrivileged ? rankMeta.label : `المستوى ${user.level || 1}`}
                        </span>
                      </div>
                    </div>

                    <div className="text-left text-xs shrink-0">
                      <span className="text-emerald-600 font-black block text-xs tabular-nums">
                        {totalScore.toLocaleString()} نقطة
                      </span>
                      <span className="text-[9.5px] text-slate-500 tabular-nums">
                        {user.giftsReceivedCount || 0} هدية 🎁
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
