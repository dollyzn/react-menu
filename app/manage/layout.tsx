"use client";

import { SiteHeader } from "./components/site-header";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div data-wrapper="" className="border-border/40 dark:border-border">
      <div className="mx-auto w-full border-border/40 dark:border-border min-[1800px]:max-w-[1536px] min-[1800px]:border">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
