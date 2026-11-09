"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type PanInfo,
} from "motion/react";
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
  /**
   * Whether the batch is still on screen after that swipe ("Fiz 1" of 3):
   * the card slides back in from that side. Otherwise it stays gone (a card that came
   * back for an instant before leaving read as a glitch).
   */
  staysAfter: (direction: 1 | -1) => boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Tinder-style card: drag right or left past the threshold (or flick) and
 * it flies off that side and runs the action (a batch still on screen slides
 * back in from that same side); otherwise it springs back. The colored
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
  staysAfter,
}: SwipeCardProps) {
  // Leaving (AnimatePresence exit) or gone: never rise back.
  const isPresent = useIsPresent();
  const present = useRef(isPresent);
  const mounted = useRef(true);
  useEffect(() => {
    present.current = isPresent;
  }, [isPresent]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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

  // Same batch still on screen ("Fiz 1" of 3, or an error): the card slides
  // back in from the side it left by (never across: it would pass the other
  // action's color).
  const slideBack = () => {
    void animate(x, 0, { type: "spring", stiffness: 260, damping: 30 });
  };

  const run = async (direction: 1 | -1) => {
    const width = window.innerWidth;
    await animate(x, direction * width, { duration: 0.22, ease: "easeIn" });
    let done = false;
    try {
      await (direction === 1 ? onSwipeRight() : onSwipeLeft());
      done = true;
    } catch {
      // The request failed (its toast says why): the card comes back.
    }
    if (done && !staysAfter(direction)) {
      // Gone with its batch. Should the screen not move on (a slow refresh),
      // the card comes back rather than leave an empty spot.
      window.setTimeout(() => {
        if (mounted.current && present.current) slideBack();
      }, 1500);
      return;
    }
    slideBack();
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
