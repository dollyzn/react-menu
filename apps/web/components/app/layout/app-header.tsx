import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsPopover } from "@/components/app/notifications/notifications-popover";
import { AppBreadcrumbs } from "./app-breadcrumbs";

/**
 * Brand-colored bar: sidebar toggle, where you are and the notifications.
 * Account and theme live in the sidebar.
 */
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center bg-primary text-primary-foreground shadow-sm">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
        <Separator orientation="vertical" className="mr-1 bg-primary-foreground/40 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
        {/* useSearchParams (orders history crumb) needs a Suspense boundary. */}
        <Suspense>
          <AppBreadcrumbs />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <NotificationsPopover />
        </div>
      </div>
    </header>
  );
}
