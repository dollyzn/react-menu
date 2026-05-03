"use client";

import AppHeader from "@/components/layout/app-header";
import AppSidebar from "@/components/layout/app-sidebar";
import RequireAuth from "@/components/auth/require-auth";
import SessionExpiredModal from "@/components/app/session-expired-modal";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface ManageShellProps {
  children: React.ReactNode;
  defaultOpen: boolean;
}

export function ManageShell({ children, defaultOpen }: ManageShellProps) {
  return (
    <RequireAuth>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset className="contain-inline-size">
          <AppHeader />
          <main className="@container/main flex flex-1 flex-col">
            <div
              data-wrapper=""
              className="border-border/40 dark:border-border flex-1"
            >
              <div className="mx-auto w-full border-border/40 dark:border-border min-[1800px]:max-w-[1536px] min-[1800px]:border min-h-full">
                {children}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <SessionExpiredModal />
    </RequireAuth>
  );
}
