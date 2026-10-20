"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visually hide the header (it stays available to screen readers). */
  hideHeader?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Bottom drawer on phones, centered dialog on larger screens. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  hideHeader,
  className,
  children,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[92svh]", className)}>
          <DrawerHeader className={cn(hideHeader && "sr-only")}>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn("gap-0 overflow-hidden p-0 sm:max-w-lg", className)}
      >
        <DialogHeader className={cn("p-4 pr-14 pb-2", hideHeader && "sr-only")}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Only the content scrolls; sticky footers inside it stay visible. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        <DialogClose
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-3 right-3 z-10 rounded-full bg-background/80 shadow-sm backdrop-blur"
            />
          }
          aria-label="Fechar"
        >
          <XIcon />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
