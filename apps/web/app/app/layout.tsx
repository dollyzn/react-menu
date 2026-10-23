import type { Metadata } from "next";

/** Staff pages link the staff manifest (separate installable app, scope /app/). */
export const metadata: Metadata = {
  manifest: "/app/manifest.webmanifest",
  // The panel is private: keep it (and its login) out of search results.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Painel", statusBarStyle: "default" },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
