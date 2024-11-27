import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { UserNav } from "./user-nav";
import StoreSwitcher from "./store-switcher";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-border">
      <div className="flex gap-4 xl:gap-6 h-14 items-center justify-between min-[576px]:justify-start px-4">
        <MobileNav />
        <StoreSwitcher />
        <MainNav />
        <div className="flex min-[576px]:flex-1 items-center justify-end">
          <nav className="flex items-center gap-1">
            <UserNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
