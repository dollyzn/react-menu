"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Below this many pixels a press is a click, not a drag. */
const DRAG_THRESHOLD = 5;

/**
 * A strip that scrolls sideways with a mouse too: the wheel scrolls it
 * (vertical wheels included), a press-and-drag moves it (the click after a
 * drag is swallowed, so a pill isn't picked by accident), and `start` /
 * `end` say whether there is more on each side (edge fades, arrows). Touch
 * and trackpads keep their own scrolling.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const start = element.scrollLeft > 1;
    const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    for (const child of Array.from(element.children)) resize.observe(child);

    // A vertical wheel scrolls the strip (not passive: it replaces the page's scroll).
    const onWheel = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const atStart = element.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };

    // Press and drag with a mouse (touch already scrolls natively).
    let drag: { x: number; left: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      drag = { x: event.clientX, left: element.scrollLeft, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return;
      const distance = event.clientX - drag.x;
      if (!drag.moved && Math.abs(distance) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        element.setPointerCapture(event.pointerId);
        element.dataset.dragging = "";
      }
      element.scrollLeft = drag.left - distance;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag) return;
      if (drag.moved) {
        element.releasePointerCapture(event.pointerId);
        // The click that ends a drag doesn't pick anything.
        const swallow = (click: MouseEvent) => {
          click.preventDefault();
          click.stopPropagation();
        };
        element.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => element.removeEventListener("click", swallow, { capture: true }), 0);
      }
      delete element.dataset.dragging;
      drag = null;
    };

    element.addEventListener("scroll", measure, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    return () => {
      resize.disconnect();
      element.removeEventListener("scroll", measure);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
    };
  }, [measure]);

  /** Moves by most of the visible width (the arrows). */
  const scrollBy = useCallback((direction: 1 | -1) => {
    const element = ref.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  return { ref, ...edges, measure, scrollBy };
}
