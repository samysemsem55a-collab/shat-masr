import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Sparkles, Crown } from 'lucide-react';
import { GiftItem } from '../types/chat';

interface FullscreenGiftOverlayProps {
  gift: GiftItem | null;
  senderName: string;
  recipientName: string;
  onDismiss: () => void;
}

const EFFECT_EMOJIS: Record<string, string[]> = {
  roses: ['🌹', '🌸', '🌺', '💐', '🌷'],
  fireworks: ['🎆', '🎇', '✨', '🌟', '💥'],
  gold_rain: ['🪙', '✨', '👑', '💎', '⭐'],
  hearts: ['💖', '❤️', '💕', '💘', '💗'],
};

export const FullscreenGiftOverlay: React.FC<FullscreenGiftOverlayProps> = ({
  gift,
  senderName,
  recipientName,
  onDismiss,
}) => {
  const isInteractive = gift?.category === 'interactive' || Boolean(gift?.effectType);
  const effectType = gift?.effectType || (isInteractive ? 'fireworks' : undefined);

  const particles = useMemo(() => {
    if (!gift) return [];
    const pool = effectType ? EFFECT_EMOJIS[effectType] || ['✨'] : [gift.icon, '✨', '👑'];
    const count = isInteractive ? 34 : 14;
    return Array.from({ length: count }, (_, idx) => ({
      id: idx,
      emoji: pool[idx % pool.length],
      leftPct: (idx * 29 + 7) % 94 + 3,
      delay: (idx % 9) * 0.18,
      duration: 2.6 + (idx % 5) * 0.45,
      size: isInteractive ? (idx % 3 === 0 ? 34 : 24) : 22,
      sway: idx % 2 === 0 ? 32 : -32,
    }));
  }, [gift?.id, effectType, isInteractive]);

  useEffect(() => {
    if (!gift) return;
    const durationMs = isInteractive ? 5200 : 4200;

    let fireworkInterval: ReturnType<typeof setInterval> | null = null;

    if (effectType === 'fireworks') {
      const fireBurst = () => {
        confetti({
          particleCount: 65,
          spread: 85,
          startVelocity: 42,
          origin: { x: 0.2 + Math.random() * 0.6, y: 0.25 + Math.random() * 0.35 },
          zIndex: 9999,
        });
      };
      fireBurst();
      fireworkInterval = setInterval(fireBurst, 850);
    } else if (effectType === 'roses') {
      confetti({
        particleCount: 70,
        spread: 110,
        colors: ['#f43f5e', '#fb7185', '#ec4899', '#fda4af'],
        origin: { y: 0.1 },
        zIndex: 9999,
      });
    } else if (effectType === 'gold_rain') {
      confetti({
        particleCount: 90,
        spread: 100,
        colors: ['#f59e0b', '#fde047', '#fbbf24', '#ffffff'],
        origin: { y: 0.15 },
        zIndex: 9999,
      });
    } else if (effectType === 'hearts') {
      confetti({
        particleCount: 70,
        spread: 95,
        colors: ['#e11d48', '#f472b6', '#be185d', '#fda4af'],
        origin: { y: 0.65 },
        zIndex: 9999,
      });
    } else {
      confetti({
        particleCount: 55,
        spread: 75,
        origin: { y: 0.55 },
        zIndex: 9999,
      });
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      clearTimeout(timer);
      if (fireworkInterval) clearInterval(fireworkInterval);
    };
  }, [gift, isInteractive, effectType, onDismiss]);

  if (!gift) return null;

  const isRising = effectType === 'hearts';

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-[130] pointer-events-auto flex flex-col items-center justify-center bg-slate-950/55 backdrop-blur-[2px] overflow-hidden"
    >
      {/* Fullscreen Animated Particles Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={
              isRising
                ? { y: '105vh', x: 0, opacity: 0, scale: 0.6 }
                : { y: '-12vh', x: 0, opacity: 0, rotate: 0, scale: 0.7 }
            }
            animate={
              isRising
                ? {
                    y: '-15vh',
                    x: [0, p.sway, -p.sway, 0],
                    opacity: [0, 1, 1, 0],
                    scale: [0.7, 1.15, 1, 0.85],
                  }
                : {
                    y: '108vh',
                    x: [0, p.sway, -p.sway, p.sway / 2],
                    opacity: [0, 1, 1, 0],
                    rotate: [0, 180, 360],
                    scale: [0.8, 1.15, 1],
                  }
            }
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              left: `${p.leftPct}%`,
              fontSize: `${p.size}px`,
              willChange: 'transform, opacity',
            }}
            className="select-none drop-shadow-md"
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>

      {/* Glowing Backdrop Aura */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-r from-amber-500/25 via-pink-500/25 to-purple-600/35 blur-3xl animate-pulse pointer-events-none" />

      {/* Main Center Stage */}
      <motion.div
        initial={{ opacity: 0, scale: 0.84, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 flex flex-col items-center text-center p-6 space-y-4 max-w-md mx-auto"
      >
        <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_0_24px_rgba(245,158,11,0.65)]">
          <Crown className="w-4 h-4 fill-slate-950" />
          <span>
            {isInteractive
              ? 'هدية تفاعلية تملأ سماء الغرفة 🎆'
              : 'إهداء ملكي فاخر في سماء شات العرب'}
          </span>
          <Sparkles className="w-4 h-4 fill-slate-950" />
        </div>

        <motion.div
          animate={{ scale: [1, 1.14, 1], rotate: [0, 4, -4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl sm:text-9xl filter drop-shadow-[0_12px_25px_rgba(245,158,11,0.6)] select-none"
        >
          {gift.icon}
        </motion.div>

        <div className="bg-[#0c1222]/95 border-2 border-amber-400/75 rounded-3xl p-5 shadow-[0_0_35px_rgba(245,158,11,0.38)] backdrop-blur-md space-y-2 max-w-sm w-full">
          <h2 className="text-xl sm:text-2xl font-black text-amber-300">
            {gift.name}
          </h2>

          <p className="text-sm sm:text-base text-white font-bold">
            <span className="text-amber-400">{senderName}</span>
            <span className="text-slate-300 mx-1">أهدى</span>
            <span className="text-pink-400">{recipientName}</span>
          </p>

          <p className="text-xs text-slate-300/95 font-medium italic">
            « {gift.bannerText} »
          </p>

          <div className="pt-1.5 flex items-center justify-center gap-1 text-xs font-black text-amber-400">
            <span>🪙 {gift.cost.toLocaleString()} كوينز</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-300/80 animate-pulse">
          (انقر في أي مكان للإغلاق)
        </p>
      </motion.div>
    </div>
  );
};
