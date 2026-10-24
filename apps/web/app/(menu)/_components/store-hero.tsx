"use client";

import Image from "@/components/app/image";
import { motion } from "motion/react";
import { Clock, MapPin, Star } from "lucide-react";
import { Icons } from "@/components/app/icons";
import type { PublicMenu } from "@react-menu/contracts";
import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/opening-hours";
import { StoreHours } from "./store-hours";

export function StoreHero({ store }: { store: PublicMenu["store"] }) {
  return (
    <section className="-mx-4 sm:mx-0" aria-labelledby="store-name">
      <div className="relative h-44 overflow-hidden sm:mt-4 sm:h-56 sm:rounded-2xl">
        {store.bannerUrl ? (
          <Image
            src={store.bannerUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        ) : (
          // No banner yet: a brand-colored backdrop instead of another store's photo.
          <div className="absolute inset-0 bg-linear-to-br from-primary/40 via-primary/15 to-muted" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mx-4 -mt-16 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur sm:mx-6"
      >
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-background">
            {store.photoUrl ? (
              <Image
                src={store.photoUrl}
                alt={`Logo ${store.name}`}
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            ) : (
              <span className="flex size-full items-center justify-center bg-primary/10 text-xl font-black text-primary">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 id="store-name" className="text-xl leading-tight font-bold text-balance">
              {store.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                  store.isOpen
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span className="relative flex size-2">
                  {store.isOpen && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      store.isOpen ? "bg-emerald-500" : "bg-muted-foreground"
                    )}
                  />
                </span>
                {/* Relative times ("amanhã") can differ between server and browser clocks. */}
                <span suppressHydrationWarning>
                  {store.isOpen
                    ? `Aberto agora${store.closesAt ? ` · fecha ${formatWhen(store.closesAt)}` : ""}`
                    : `Fechado${store.opensAt ? ` · abre ${formatWhen(store.opensAt)}` : ""}`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" /> Retirada em ~{store.pickupEtaMinutes} min
              </span>
              <StoreHours store={store} />
              {/* Placeholder until a review system exists (see roadmap). */}
              <span className="inline-flex items-center gap-0.5" aria-label="Avaliação 5 de 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                ))}
              </span>
            </div>
            {store.address && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" /> {store.address}
              </p>
            )}
          </div>
          {store.instagramUrl && (
            <a
              href={store.instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram da loja"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icons.instagram className="size-5" />
            </a>
          )}
        </div>
        {store.description && (
          <p className="mt-3 text-sm text-pretty text-muted-foreground">{store.description}</p>
        )}
      </motion.div>
    </section>
  );
}
