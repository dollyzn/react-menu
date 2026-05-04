import { cookies } from "next/headers";
import AppHeader from "@/components/app/layout/app-header";
import AppSidebar from "@/components/app/layout/app-sidebar";
import RequireAuth from "@/components/app/auth/require-auth";
import SessionExpiredModal from "@/components/app/session-expired-modal";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

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
