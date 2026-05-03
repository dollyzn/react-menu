import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderUser } from "./header-user";
import HeaderBreadcrumbs from "./header-breadcrumbs";
import { StoreSwitcher } from "./store-switcher";

export default function AppHeader() {
  return (
    <header className="sticky top-0 shadow-md group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear bg-primary z-10">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 text-primary-foreground" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 bg-primary-foreground/60"
        />
        <div className="flex items-center gap-2 shrink-0 max-w-[min(200px,40vw)] sm:max-w-none">
          <StoreSwitcher className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground w-full sm:w-[200px]" />
        </div>
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 bg-primary-foreground/60"
        />
        <h1 className="text-base font-medium min-w-0 flex-1 truncate">
          <HeaderBreadcrumbs />
        </h1>
        <div className="flex items-center justify-end ml-auto shrink-0">
          <nav className="flex items-center gap-2">
            <HeaderUser />
          </nav>
        </div>
      </div>
    </header>
  );
}
