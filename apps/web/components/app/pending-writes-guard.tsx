"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getPendingWrites, subscribePendingWrites, usePendingWrites } from "@/lib/pending-writes";

/** Same-app link the click would follow, if any (modifier clicks and new tabs pass). */
function internalTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  // Other sites are covered by beforeunload; same page (hash) is harmless.
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Holds navigation while a write is in flight (a save on a slow beach
 * connection): the browser asks before reload/close, and in-app links wait
 * here and continue by themselves once the save finishes.
 */
export function PendingWritesGuard() {
  const router = useRouter();
  const pending = usePendingWrites() > 0;
  const [target, setTarget] = useState<string | null>(null);

  // Reload, close the tab, external links: the browser's own prompt.
  useEffect(() => {
    if (!pending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pending]);

  // In-app links: capture phase, before Next's <Link> handles the click.
  useEffect(() => {
    if (!pending) return;
    const onClick = (event: MouseEvent) => {
      const href = internalTarget(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pending]);

  // Saved: go where the user wanted to go.
  useEffect(() => {
    if (!target) return;
    const go = () => {
      setTarget(null);
      router.push(target);
    };
    if (getPendingWrites() === 0) {
      queueMicrotask(go);
      return;
    }
    return subscribePendingWrites((count) => {
      if (count === 0) go();
    });
  }, [target, router]);

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" /> Salvando suas alterações…
          </AlertDialogTitle>
          <AlertDialogDescription>
            Assim que terminar, seguimos para a página que você abriu. Sair agora pode deixar a última
            ação sem confirmação.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ficar aqui</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              const href = target;
              setTarget(null);
              if (href) router.push(href);
            }}
          >
            Sair mesmo assim
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
