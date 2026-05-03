import { useRef, useCallback } from "react";

export function useHorizontalHoverScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startScroll = useCallback(
    (speed: number) => {
      stopScroll();

      const scroll = () => {
        if (!containerRef.current) return;
        containerRef.current.scrollLeft += speed;
        rafRef.current = requestAnimationFrame(scroll);
      };

      rafRef.current = requestAnimationFrame(scroll);
    },
    [stopScroll]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const threshold = 40;
      const speed = 4;

      const x = e.clientX;
      const distanceLeft = x - rect.left;
      const distanceRight = rect.right - x;

      if (distanceLeft < threshold) {
        startScroll(-speed);
      } else if (distanceRight < threshold) {
        startScroll(speed);
      } else {
        stopScroll();
      }
    },
    [startScroll, stopScroll]
  );

  return {
    containerRef,
    events: {
      onPointerMove,
      onPointerLeave: stopScroll,
      onPointerUp: stopScroll,
      onTouchEnd: stopScroll,
      onTouchCancel: stopScroll,
    },
  };
}
