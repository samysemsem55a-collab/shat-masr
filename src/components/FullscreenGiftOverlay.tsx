import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Sparkles, Crown } from 'lucide-react';
import { GiftItem } from '../types/chat';

interface FullscreenGiftOverlayProps {
  gift: GiftItem | null;
  senderName: string;
  recipientName: string;
  replayKey?: number;
  onDismiss: () => void;
}

const EFFECT_EMOJIS: Record<string, string[]> = {
  roses: ['🌹', '🌸', '🌺', '💐'],
  fireworks: ['🎆', '🎇', '✨', '🌟'],
  gold_rain: ['🪙', '✨', '👑', '💎'],
  hearts: ['💖', '❤️', '💕', '💗'],
};

export const FullscreenGiftOverlay: React.FC<FullscreenGiftOverlayProps> = ({
  gift,
  senderName,
  recipientName,
  replayKey = 0,
  onDismiss,
}) => {
  const isInteractive = gift?.category === 'interactive' || Boolean(gift?.effectType);
  const effectType = gift?.effectType || (isInteractive ? 'fireworks' : undefined);

  const particles = useMemo(() => {
    if (!gift) return [];
    const pool = effectType ? EFFECT_EMOJIS[effectType] || ['✨', '🎉'] : [gift.icon, '✨', '🌟', '🎉'];
    // Lightweight particle count for smooth 60fps on mobile devices
    const count = isInteractive ? 16 : 12;
    return Array.from({ length: count }, (_, idx) => ({
      id: idx,
      emoji: pool[idx % pool.length],
      leftPct: ((idx * 31 + 9) % 88) + 6,
      delay: (idx % 6) * 0.12,
      duration: 2.1 + (idx % 4) * 0.25,
      size: idx % 3 === 0 ? 28 : 22,
      sway: idx % 2 === 0 ? 22 : -22,
    }));
  }, [gift?.id, gift?.icon, effectType, isInteractive]);

  useEffect(() => {
    if (!gift) return;
    const durationMs = 2800;

    let fireworkTimeout: ReturnType<typeof setTimeout> | null = null;

    if (effectType === 'fireworks') {
      const fireBurst = () => {
        confetti({
          particleCount: 45,
          spread: 75,
          startVelocity: 38,
          origin: { x: 0.25 + Math.random() * 0.5, y: 0.3 + Math.random() * 0.3 },
          zIndex: 9999,
          disableForReducedMotion: true,
        });
      };
      fireBurst();
      fireworkTimeout = setTimeout(fireBurst, 750);
    } else if (effectType === 'roses') {
      confetti({
        particleCount: 50,
        spread: 90,
        colors: ['#f43f5e', '#fb7185', '#ec4899', '#fda4af'],
        origin: { y: 0.2 },
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    } else if (effectType === 'gold_rain') {
      confetti({
        particleCount: 55,
        spread: 90,
        colors: ['#f59e0b', '#fde047', '#fbbf24', '#ffffff'],
        origin: { y: 0.2 },
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    } else if (effectType === 'hearts') {
      confetti({
        particleCount: 50,
        spread: 85,
        colors: ['#e11d48', '#f472b6', '#be185d', '#fda4af'],
        origin: { y: 0.6 },
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    } else {
      confetti({
        particleCount: 45,
        spread: 70,
        colors: ['#f59e0b', '#fbbf24', '#f43f5e', '#6366f1'],
        origin: { y: 0.55 },
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      clearTimeout(timer);
      if (fireworkTimeout) clearTimeout(fireworkTimeout);
    };
  }, [gift, replayKey, effectType, onDismiss]);

  if (!gift) return null;

  const isRising = effectType === 'hearts';

  return (
    <div
      dir="rtl"
      key={`${gift.id}_${replayKey}`}
      aria-hidden="true"
      className="fixed inset-0 z-[130] pointer-events-none flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Subtle Non-Blocking Glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.5, 0], scale: [0.7, 1.15, 1.3] }}
        transition={{ duration: 2.6, ease: 'easeOut' }}
        className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-amber-400/35 via-rose-400/25 to-indigo-500/30 blur-2xl pointer-events-none"
      />

      {/* Lightweight GPU-Composited Sparkle & Confetti Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={
              isRising
                ? { y: '98vh', x: 0, opacity: 0, scale: 0.7 }
                : { y: '-8vh', x: 0, opacity: 0, rotate: 0, scale: 0.75 }
            }
            animate={
              isRising
                ? {
                    y: '-10vh',
                    x: [0, p.sway, 0],
                    opacity: [0, 1, 1, 0],
                    scale: [0.75, 1.1, 0.9],
                  }
                : {
                    y: '102vh',
                    x: [0, p.sway, -p.sway],
                    opacity: [0, 1, 1, 0],
                    rotate: [0, 180],
                    scale: [0.8, 1.1, 0.9],
                  }
            }
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              left: `${p.leftPct}%`,
              fontSize: `${p.size}px`,
              willChange: 'transform, opacity',
            }}
            className="select-none"
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>

      {/* Sleek Non-Blocking Highlight Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 18 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.03, 1, 0.96], y: [18, 0, 0, -10] }}
        transition={{ duration: 2.75, times: [0, 0.14, 0.85, 1], ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-sm mx-auto"
      >
        <div className="w-full rounded-3xl bg-slate-950/90 border border-amber-400/80 shadow-[0_14px_40px_rgba(245,158,11,0.35)] px-5 py-4 space-y-2.5 backdrop-blur-md">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 font-black text-[11px] shadow-sm">
            <Crown className="w-3.5 h-3.5" />
            <span>هدية فاخرة: {gift.name}</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <motion.div
            animate={{ scale: [1, 1.14, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 1.2, repeat: 2, ease: 'easeInOut' }}
            className="text-5xl sm:text-6xl select-none py-0.5"
          >
            {gift.icon}
          </motion.div>

          <p className="text-sm font-bold text-white leading-relaxed">
            <span>أهدى </span>
            <span className="text-amber-300 font-black">{senderName}</span>
            <span> </span>
            <span className="text-rose-300 font-black">{gift.name}</span>
            <span> إلى </span>
            <span className="text-emerald-300 font-black">{recipientName}</span>
          </p>

          <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-black text-amber-300 tabular-nums">
            <span>🪙 {gift.cost.toLocaleString()} كوينز</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

