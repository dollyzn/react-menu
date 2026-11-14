import type { Metadata } from "next";

/** Staff pages link the staff manifest (separate installable app, scope /app/). */
export const metadata: Metadata = {
  manifest: "/app/manifest.webmanifest",
  // The panel is private: keep it (and its login) out of search results.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Painel", statusBarStyle: "default" },
  // The staff work in Portuguese. A browser that translates the panel by
  // itself (a phone set to translate pages) garbles its words and rewrites
  // the text React manages, which can break a screen mid-service.
  other: { google: "notranslate" },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  // `translate="no"` for browsers that skip Google's meta tag (Safari, Edge).
  return (
    <div translate="no" className="contents">
      {children}
    </div>
  );
}
