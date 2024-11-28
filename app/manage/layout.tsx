"use client";

import { useSession } from "@/providers/session-provider";
import { SiteHeader } from "./components/site-header";
import { redirectToLogin } from "@/utils/navigation";
import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user } = useSession();

  useLayoutEffect(() => {
    if (!user) redirectToLogin(router);
  }, []);

  return (
    <div data-wrapper="" className="border-border/40 dark:border-border">
      <div className="mx-auto w-full border-border/40 dark:border-border min-[1800px]:max-w-[1536px] min-[1800px]:border">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
