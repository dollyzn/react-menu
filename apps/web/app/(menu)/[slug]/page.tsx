import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu } from "../_lib/fetch-menu";
import { MenuView } from "../_components/menu-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const menu = await fetchMenu((await params).slug);
  return menu
    ? { title: `${menu.store.name} · Cardápio`, description: menu.store.description ?? undefined }
    : {};
}

export default async function StoreMenuPage({ params }: Props) {
  const menu = await fetchMenu((await params).slug);
  if (!menu) notFound();

  return <MenuView menu={menu} />;
}
