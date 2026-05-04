import { cookies } from "next/headers";
import { ManageShell } from "./components/manage-shell";

interface ManageStoreLayoutProps {
  children: React.ReactNode;
}

export default async function ManageStoreLayout({
  children,
}: ManageStoreLayoutProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return <ManageShell defaultOpen={defaultOpen}>{children}</ManageShell>;
}
