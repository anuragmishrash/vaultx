import { useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 75;  // px needed to trigger action
const MAX_SWIPE = 100;       // max px the card can slide

export default function SwipeableCard({ onDelete, onRepeat, children, disabled }) {
  const cardRef     = useRef(null);
  const startXRef   = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    startXRef.current   = e.touches[0].clientX;
    currentXRef.current = 0;
    isSwipingRef.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e) => {
    if (disabled) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(e.touches[0].clientY - (e.touches[0].clientY)); // rough check

    // Only handle horizontal swipes
    if (!isSwipingRef.current && absDx > 8) {
      isSwipingRef.current = true;
    }
    if (!isSwipingRef.current) return;

    // Clamp the translation
    const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
    currentXRef.current = clamped;

    // ← KEY: Direct DOM transform, zero React state, zero re-render
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${clamped}px)`;
      cardRef.current.style.transition = 'none'; // no transition during drag
    }
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isSwipingRef.current) return;

    const dx = currentXRef.current;

    if (cardRef.current) {
      if (dx < -SWIPE_THRESHOLD) {
        // Swipe left past threshold → delete
        // Animate off screen, then call onDelete
        cardRef.current.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        cardRef.current.style.transform  = 'translateX(-110%)';
        cardRef.current.style.opacity    = '0';
        setTimeout(() => onDelete?.(), 200);
      } else if (dx > SWIPE_THRESHOLD) {
        // Swipe right past threshold → repeat
        cardRef.current.style.transition = 'transform 0.2s ease';
        cardRef.current.style.transform  = 'translateX(0)';
        onRepeat?.();
      } else {
        // Not enough — snap back
        cardRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
        cardRef.current.style.transform  = 'translateX(0)';
      }
    }

    isSwipingRef.current = false;
    currentXRef.current  = 0;
  }, [disabled, onDelete, onRepeat]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', marginBottom: '10px' }}>

      {/* Background actions — visible when card is swiped */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: '#9B8AFB', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600,
        }}>
          <span style={{ fontSize: '16px' }}>↺</span> Repeat
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: '#FF5C5C', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600,
        }}>
          Delete <span style={{ fontSize: '14px' }}>✕</span>
        </div>
      </div>

      {/* Card — direct ref, no React state during drag */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative', zIndex: 1,
          // GPU acceleration — eliminates janky transform
          willChange: 'transform',
          transform: 'translateX(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}>
        {children}
      </div>
    </div>
  );
}
