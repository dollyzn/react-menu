"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Image from "@/components/app/image";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type PhotoFile = { url: string; filename?: string; mediaType?: string };

const FORMATS: Record<string, string> = {
  "image/webp": "WebP",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/gif": "GIF",
};

/** "WebP · 240 KB", from the data URL itself (what goes to the assistant). */
function detailsOf(photo: PhotoFile) {
  const format = (photo.mediaType && FORMATS[photo.mediaType]) ?? "Foto";
  const base64 = photo.url.startsWith("data:") ? photo.url.slice(photo.url.indexOf(",") + 1) : "";
  if (!base64) return format;
  const bytes = (base64.length * 3) / 4;
  const size = bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${format} · ${size}`;
}

/**
 * A photo sent to (or about to go to) the assistant: thumbnail, name and
 * size; a tap opens it whole. `onRemove` adds the ✕ (in the input).
 */
export function PhotoAttachment({
  photo,
  onRemove,
  className,
}: {
  photo: PhotoFile;
  onRemove?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = photo.filename || "Foto";
  return (
    <>
      <Attachment size="sm" className={cn("w-56 max-w-full pr-1", className)}>
        <AttachmentMedia variant="image" className="w-11">
          <Image src={photo.url} alt="" width={44} height={44} unoptimized />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{name}</AttachmentTitle>
          <AttachmentDescription>{detailsOf(photo)}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentTrigger aria-label={`Ver ${name}`} onClick={() => setOpen(true)} />
        {onRemove && (
          <AttachmentActions>
            <AttachmentAction aria-label={`Remover ${name}`} onClick={onRemove}>
              <X />
            </AttachmentAction>
          </AttachmentActions>
        )}
      </Attachment>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{name}</DialogTitle>
            <DialogDescription>{detailsOf(photo)}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 justify-center overflow-hidden rounded-lg bg-muted">
            <Image
              src={photo.url}
              alt={name}
              width={1568}
              height={1568}
              unoptimized
              className="h-auto max-h-[70dvh] w-auto max-w-full"
              style={{ objectFit: "contain" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Where a photo shows while it is being prepared (resized) for sending. */
export function PhotoPreparing() {
  return (
    <Attachment size="sm" state="processing" className="w-56 max-w-full">
      <AttachmentMedia className="w-11">
        <Spinner />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Preparando a foto…</AttachmentTitle>
        <AttachmentDescription>Reduzindo para enviar</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}
