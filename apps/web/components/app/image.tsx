import NextImage, { type ImageProps } from "next/image";
import { getApiOrigin } from "@/lib/api-base-url";

/**
 * Files uploaded to our API (Drive "fs" disk, /uploads) go straight to the
 * browser: they were sized on upload, and their host (localhost in
 * development, the API container in Docker) is often unreachable for the
 * Next.js optimizer. Everything else (public files, other hosts) is optimized.
 */
export function isApiUpload(src: ImageProps["src"]) {
  return typeof src === "string" && src.startsWith(`${getApiOrigin()}/uploads/`);
}

/** `next/image` that knows about API uploads. Use this instead of next/image. */
export default function Image(props: ImageProps) {
  return <NextImage {...props} unoptimized={props.unoptimized ?? isApiUpload(props.src)} />;
}
