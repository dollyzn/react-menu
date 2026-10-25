"use client";

import { useRef } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from "motion/react";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 140;
const FLICK_VELOCITY = 600;

interface SwipeCardProps {
  /** Swipe right: the main action ("Fiz todos"). */
  onSwipeRight: () => Promise<unknown>;
  rightLabel: string;
  /** Swipe left: the small action ("Fiz 1"). */
  onSwipeLeft: () => Promise<unknown>;
  leftLabel: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Tinder-style card: drag right or left past the threshold (or flick) and
 * it flies off and runs the action; otherwise it springs back. The colored
 * panel and icon behind it grow with the drag, and the phone ticks when the
 * action arms. Vertical scrolling keeps working (touch-action: pan-y).
 */
export function SwipeCard({
  onSwipeRight,
  rightLabel,
  onSwipeLeft,
  leftLabel,
  disabled,
  className,
  children,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-6, 0, 6]);
  const rightOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const leftOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);
  const rightScale = useTransform(x, [0, THRESHOLD], [0.6, 1.15]);
  const leftScale = useTransform(x, [-THRESHOLD, 0], [1.15, 0.6]);
  const armed = useRef<"left" | "right" | null>(null);

  useMotionValueEvent(x, "change", (value) => {
    const next = value > THRESHOLD ? "right" : value < -THRESHOLD ? "left" : null;
    if (next && next !== armed.current) navigator.vibrate?.(20);
    armed.current = next;
  });

  const run = async (direction: 1 | -1) => {
    const width = window.innerWidth;
    await animate(x, direction * width, { duration: 0.22, ease: "easeIn" });
    try {
      await (direction === 1 ? onSwipeRight() : onSwipeLeft());
    } finally {
      // Same batch still on screen (e.g. "Fiz 1" of 3, or an error): slide back in.
      x.set(-direction * width * 0.6);
      void animate(x, 0, { type: "spring", stiffness: 260, damping: 28 });
    }
  };

  const onDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.x > THRESHOLD || info.velocity.x > FLICK_VELOCITY) void run(1);
    else if (info.offset.x < -THRESHOLD || info.velocity.x < -FLICK_VELOCITY) void run(-1);
    else void animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
  };

  return (
    <div className={cn("relative", className)}>
      {/* What happens on each side, revealed by the drag. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
        <motion.div
          style={{ opacity: rightOpacity }}
          className="absolute inset-0 flex items-center justify-start bg-success pl-8 text-success-foreground"
        >
          <motion.span style={{ scale: rightScale }} className="flex flex-col items-center gap-2 text-2xl font-bold">
            <CheckCheck className="size-14" /> {rightLabel}
          </motion.span>
        </motion.div>
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-0 flex items-center justify-end bg-warning pr-8 text-warning-foreground"
        >
          <motion.span style={{ scale: leftScale }} className="flex flex-col items-center gap-2 text-2xl font-bold">
            <Check className="size-14" /> {leftLabel}
          </motion.span>
        </motion.div>
      </div>

      <motion.div
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragElastic={0.7}
        dragConstraints={{ left: 0, right: 0 }}
        dragSnapToOrigin={false}
        onDragEnd={onDragEnd}
        style={{ x, rotate, touchAction: "pan-y" }}
        className="relative h-full cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
