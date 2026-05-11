import { useState, useRef, useCallback } from 'react';

const PULL_THRESHOLD = 60; // px required to trigger refresh

export function usePullToRefresh(onRefresh: () => void) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate when at the very top of the scroll container
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop ?? window.scrollY;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    // Apply resistance — feels natural
    const distance = Math.min(dy * 0.45, 90);
    setPullDistance(distance);
    setIsPulling(distance >= PULL_THRESHOLD);
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD); // freeze indicator at threshold during refresh
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [pullDistance, onRefresh]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
