import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu } from "./_lib/fetch-menu";
import { MenuView } from "./_components/menu-view";
import { storeSeoMetadata } from "./_lib/store-seo";
import { StoreJsonLd } from "./_components/store-json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const menu = await fetchMenu();
  return menu ? storeSeoMetadata(menu, "/manifest.webmanifest") : {};
}

/** The default store's menu lives at the site root. */
export default async function DefaultMenuPage() {
  const menu = await fetchMenu();
  if (!menu) notFound();

  return (
    <>
      <StoreJsonLd menu={menu} />
      <MenuView menu={menu} />
    </>
  );
}
