import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu } from "../_lib/fetch-menu";
import { storeSeoMetadata } from "../_lib/store-seo";
import { StoreJsonLd } from "../_components/store-json-ld";
import { MenuView } from "../_components/menu-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const menu = await fetchMenu((await params).slug);
  return menu ? storeSeoMetadata(menu, `/${menu.store.slug}/manifest.webmanifest`) : {};
}

export default async function StoreMenuPage({ params }: Props) {
  const menu = await fetchMenu((await params).slug);
  if (!menu) notFound();

  return (
    <>
      <StoreJsonLd menu={menu} />
      <MenuView menu={menu} />
    </>
  );
}
