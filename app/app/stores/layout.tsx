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
          <main className="@container/main container mx-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <SessionExpiredModal />
    </RequireAuth>
  );
}
