import { useEffect, useRef } from 'react';

export function usePullToRefresh(onRefresh) {
  const startY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };
    const handleTouchEnd = (e) => {
      if (!isDragging.current) return;
      const endY = e.changedTouches[0].clientY;
      const pullDistance = endY - startY.current;
      if (pullDistance > 80) {
        onRefresh(); // trigger refetch
      }
      isDragging.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh]);
}
