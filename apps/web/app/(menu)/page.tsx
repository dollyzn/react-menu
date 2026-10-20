import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu } from "./_lib/fetch-menu";
import { MenuView } from "./_components/menu-view";

export async function generateMetadata(): Promise<Metadata> {
  const menu = await fetchMenu();
  return menu
    ? { title: `${menu.store.name} · Cardápio`, description: menu.store.description ?? undefined }
    : {};
}

/** The default store's menu lives at the site root. */
export default async function DefaultMenuPage() {
  const menu = await fetchMenu();
  if (!menu) notFound();

  return <MenuView menu={menu} />;
}
