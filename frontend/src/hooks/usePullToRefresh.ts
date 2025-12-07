import { useEffect, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80, disabled = false }: UsePullToRefreshOptions) => {
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      
      touchCurrentY.current = e.touches[0].clientY;
      const pullDistance = touchCurrentY.current - touchStartY.current;

      if (pullDistance > 0 && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (touchStartY.current === null || touchCurrentY.current === null) {
        touchStartY.current = null;
        touchCurrentY.current = null;
        return;
      }

      const pullDistance = touchCurrentY.current - touchStartY.current;

      if (pullDistance > threshold && window.scrollY === 0 && !isRefreshing.current) {
        isRefreshing.current = true;
        try {
          await onRefresh();
        } finally {
          isRefreshing.current = false;
        }
      }

      touchStartY.current = null;
      touchCurrentY.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, disabled]);

  return { isRefreshing: isRefreshing.current };
};

