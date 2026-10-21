import path from "node:path";
import type { NextConfig } from "next";
import { env } from "./lib/env";

/**
 * Docker builds set NEXT_OUTPUT=standalone: a self-contained server that
 * traces dependencies from the monorepo root. Other deploys keep `next start`.
 */
const standalone =
  process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const, outputFileTracingRoot: path.resolve(process.cwd(), "../..") }
    : {};

const nextConfig: NextConfig = {
  // Bottom-left is where the sidebar keeps the account menu.
  devIndicators: { position: "bottom-right" },
  ...standalone,
  // E2E runs its own `next dev` in a separate build dir so it can coexist
  // with a developer's running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self'; img-src 'self' ${env.NEXT_PUBLIC_API_URL};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
