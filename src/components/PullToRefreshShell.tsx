import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';

interface PullToRefreshShellProps {
  enabled: boolean;
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing';

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 104;
const REFRESH_HOLD_HEIGHT = 54;

function hasScrolledAncestor(target: EventTarget | null, boundary: HTMLElement | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== boundary && node !== document.body) {
    if (node.scrollTop > 1) {
      const style = window.getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isInteractiveInput(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export const PullToRefreshShell: React.FC<PullToRefreshShellProps> = React.memo(({
  enabled,
  onRefresh,
  children,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<PullStatus>('idle');

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const statusRef = useRef<PullStatus>(status);
  statusRef.current = status;

  const pullDistanceRef = useRef(pullDistance);
  pullDistanceRef.current = pullDistance;

  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const isPullGestureRef = useRef(false);
  const isCancelledGestureRef = useRef(false);

  const resetPull = useCallback(() => {
    touchStartYRef.current = null;
    touchStartXRef.current = null;
    isPullGestureRef.current = false;
    isCancelledGestureRef.current = false;
    setPullDistance(0);
    setStatus('idle');
  }, []);

  // Reset immediately if disabled mid-gesture (e.g. entering a room or opening a modal)
  useEffect(() => {
    if (!enabled && statusRef.current !== 'idle' && statusRef.current !== 'refreshing') {
      resetPull();
    }
  }, [enabled, resetPull]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || statusRef.current === 'refreshing') return;
      if (e.touches.length !== 1) return;
      if (getScrollTop() > 2) return;
      if (isInteractiveInput(e.target) || hasScrolledAncestor(e.target, el)) return;

      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      isPullGestureRef.current = false;
      isCancelledGestureRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!enabledRef.current || statusRef.current === 'refreshing') return;
      if (touchStartYRef.current === null || touchStartXRef.current === null) return;
      if (isCancelledGestureRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const dy = touch.clientY - touchStartYRef.current;
      const dx = touch.clientX - touchStartXRef.current;

      if (!isPullGestureRef.current) {
        // Cancel gesture tracking if scrolling up or swiping horizontally
        if (dy < -4 || getScrollTop() > 2 || Math.abs(dx) > Math.abs(dy) * 1.15) {
          if (Math.abs(dy) > 6 || Math.abs(dx) > 6) {
            isCancelledGestureRef.current = true;
          }
          return;
        }
        if (dy > 8 && getScrollTop() <= 2) {
          isPullGestureRef.current = true;
        } else {
          return;
        }
      }

      if (dy <= 0) {
        setPullDistance(0);
        setStatus('idle');
        return;
      }

      // Prevent native scroll bounce while actively pulling at top
      if (e.cancelable) {
        e.preventDefault();
      }

      const damped = Math.min(MAX_PULL_DISTANCE, Math.round(dy * 0.46));
      pullDistanceRef.current = damped;
      setPullDistance(damped);
      setStatus(damped >= PULL_THRESHOLD ? 'ready' : 'pulling');
    };

    const handleTouchEnd = async () => {
      if (!isPullGestureRef.current) {
        touchStartYRef.current = null;
        touchStartXRef.current = null;
        isCancelledGestureRef.current = false;
        return;
      }

      const finalPull = pullDistanceRef.current;
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      isPullGestureRef.current = false;
      isCancelledGestureRef.current = false;

      if (finalPull >= PULL_THRESHOLD && enabledRef.current && statusRef.current !== 'refreshing') {
        setStatus('refreshing');
        setPullDistance(REFRESH_HOLD_HEIGHT);
        try {
          await onRefreshRef.current();
        } finally {
          setPullDistance(0);
          setStatus('idle');
        }
      } else {
        setPullDistance(0);
        setStatus('idle');
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isVisible = status !== 'idle' || pullDistance > 0;
  const indicatorHeight = status === 'refreshing' ? REFRESH_HOLD_HEIGHT : pullDistance;

  const statusLabel =
    status === 'refreshing'
      ? 'جاري تحديث البيانات...'
      : status === 'ready'
      ? 'اترك للتحديث الآن'
      : 'اسحب للأسفل للتحديث';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tactile Pull-to-Refresh Header Indicator (completely hidden when idle) */}
      <div
        aria-live="polite"
        aria-hidden={!isVisible}
        className={`overflow-hidden flex items-center justify-center pointer-events-none select-none ${
          isPullGestureRef.current ? '' : 'transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none'
        }`}
        style={{
          height: `${indicatorHeight}px`,
          opacity: isVisible ? Math.max(0.25, Math.min(1, progress * 1.15)) : 0
        }}
      >
        <div
          dir="rtl"
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm text-slate-800"
        >
          <span
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors duration-150 ${
              status === 'refreshing'
                ? 'bg-emerald-600 text-white'
                : status === 'ready'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {status === 'refreshing' ? (
              <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <ArrowDown
                className="w-4 h-4 transition-transform duration-150 motion-reduce:transition-none"
                style={{
                  transform: `rotate(${status === 'ready' ? 180 : Math.round(progress * 150)}deg)`
                }}
              />
            )}
          </span>
          <span className="text-xs font-bold tracking-tight text-slate-800 whitespace-nowrap">
            {statusLabel}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
});

PullToRefreshShell.displayName = 'PullToRefreshShell';
