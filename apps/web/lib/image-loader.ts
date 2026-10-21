"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Files uploaded to the API (Drive "fs" disk, served at /uploads) go straight
 * to the browser: they were sized on upload, and their host (localhost in
 * development, the API container in Docker) is often unreachable for the
 * Next.js optimizer. Everything else uses the built-in optimizer.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps) {
  if (src.includes("/uploads/")) {
    // The width parameter is ignored by the file server; Next requires it.
    return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
