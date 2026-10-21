"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const categoryAnchor = (id: number) => `categoria-${id}`;

interface CategoryNavProps {
  categories: { id: number; name: string }[];
  className?: string;
}

/** Sticky category chips that follow the scroll (scrollspy). */
export function CategoryNav({ categories, className }: CategoryNavProps) {
  const [active, setActive] = useState<number | null>(categories[0]?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const clickedRef = useRef(false);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(categoryAnchor(category.id)))
      .filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        if (clickedRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(Number(visible.target.getAttribute("data-category")));
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  // Center the active chip by scrolling the chip strip only. scrollIntoView
  // would also scroll the window and fight the user's own scrolling.
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  const goTo = (id: number) => {
    setActive(id);
    clickedRef.current = true;
    document
      .getElementById(categoryAnchor(id))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => (clickedRef.current = false), 700);
  };

  if (categories.length < 2) return null;

  return (
    <nav
      aria-label="Categorias"
      className={cn("sticky top-14 z-20 -mx-4 border-b bg-background/80 backdrop-blur-md", className)}
    >
      <div
        ref={listRef}
        className="relative mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2 scrollbar-none scroll-fade-x scroll-fade-12"
      >
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            data-chip={category.id}
            aria-current={active === category.id ? "true" : undefined}
            onClick={() => goTo(category.id)}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active === category.id
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active === category.id && (
              <motion.span
                layoutId="category-chip"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{category.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
