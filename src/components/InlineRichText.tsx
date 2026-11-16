import React from 'react';

export interface AnimatedInlineEmoji {
  id: string;
  token: string;
  emoji: string;
  label: string;
  animClass: string;
}

export const ANIMATED_INLINE_EMOJIS: AnimatedInlineEmoji[] = [
  { id: 'heart_beat', token: '❤️', emoji: '❤️', label: 'قلب', animClass: 'inline-emoji-beat' },
  { id: 'fire', token: '🔥', emoji: '🔥', label: 'نار', animClass: 'inline-emoji-pulse' },
  { id: 'laugh', token: '😂', emoji: '😂', label: 'ضحك', animClass: 'inline-emoji-wiggle' },
  { id: 'heart_eyes', token: '😍', emoji: '😍', label: 'حب', animClass: 'inline-emoji-beat' },
  { id: 'crown', token: '👑', emoji: '👑', label: 'تاج', animClass: 'inline-emoji-float' },
  { id: 'rose', token: '🌹', emoji: '🌹', label: 'وردة', animClass: 'inline-emoji-wiggle' },
  { id: 'sparkle', token: '✨', emoji: '✨', label: 'بريق', animClass: 'inline-emoji-pulse' },
  { id: 'clap', token: '👏', emoji: '👏', label: 'تصفيق', animClass: 'inline-emoji-wiggle' },
  { id: 'party', token: '🥳', emoji: '🥳', label: 'احتفال', animClass: 'inline-emoji-bounce' },
  { id: 'gem', token: '💎', emoji: '💎', label: 'ماسة', animClass: 'inline-emoji-pulse' },
  { id: 'kiss', token: '😘', emoji: '😘', label: 'قبلة', animClass: 'inline-emoji-beat' },
  { id: 'star', token: '🤩', emoji: '🤩', label: 'انبهار', animClass: 'inline-emoji-bounce' },
  { id: 'hundred', token: '💯', emoji: '💯', label: 'مية مية', animClass: 'inline-emoji-pulse' },
  { id: 'hug', token: '🤗', emoji: '🤗', label: 'عناق', animClass: 'inline-emoji-wiggle' },
  { id: 'cool', token: '😎', emoji: '😎', label: 'رائع', animClass: 'inline-emoji-float' },
  { id: 'thumbs', token: '👍', emoji: '👍', label: 'تمام', animClass: 'inline-emoji-bounce' },
];

const ANIMATED_EMOJI_MAP = new Map<string, AnimatedInlineEmoji>(
  ANIMATED_INLINE_EMOJIS.map((item) => [item.emoji, item])
);

const TOKEN_LOOKUP = new Map<string, AnimatedInlineEmoji>(
  ANIMATED_INLINE_EMOJIS.map((item) => [`[[anim:${item.id}]]`, item])
);

const COMBINED_PATTERN = /(\[\[anim:[a-z_]+\]\]|❤️|🔥|😂|😍|👑|🌹|✨|👏|🥳|💎|😘|🤩|💯|🤗|😎|👍)/g;

/**
 * Renders chat text with animated emojis strictly at 1em (exact line height / font size)
 * so animated icons blend seamlessly inline inside messages without giant boxes.
 */
export const InlineRichText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  if (!text) return null;
  const parts = text.split(COMBINED_PATTERN);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        const tokenItem = TOKEN_LOOKUP.get(part) || ANIMATED_EMOJI_MAP.get(part);
        if (tokenItem) {
          return (
            <span
              key={index}
              title={tokenItem.label}
              className={`inline-flex items-center justify-center align-middle text-[1em] leading-none mx-[0.5px] select-none ${tokenItem.animClass}`}
            >
              {tokenItem.emoji}
            </span>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};
