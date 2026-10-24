"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAppSelector } from "@/redux/hooks";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { useStoreRole } from "@/hooks/use-store-role";
import { homeForRole } from "@/lib/menu-itens";

/** Labels of the store sections (URL segment after /app/stores/[id]). */
const SECTIONS: Record<string, string> = {
  orders: "Pedidos",
  pos: "Novo pedido",
  kitchen: "Cozinha",
  categories: "Categorias",
  items: "Itens",
  addons: "Adicionais",
  "option-groups": "Grupos de escolha",
  inventory: "Estoque",
  reports: "Relatórios",
  overview: "Visão geral",
  members: "Equipe",
};

type Crumb = { label: string; href?: string };

/**
 * Where you are, from the route: Loja › Seção (› Histórico). Links use the
 * Next router (no full reload); the last crumb is the current page.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { store: storeId } = useParams<{ store?: string }>();
  const stores = useAppSelector((state) => state.auth.user?.stores ?? []);
  const member = stores.find((s) => s.id === storeId);
  const { data: fetched } = useGetStoreByIdQuery(storeId ?? "", { skip: !storeId || Boolean(member) });
  const role = useStoreRole(storeId ?? "");

  const crumbs: Crumb[] = [];
  if (pathname.startsWith("/app/settings")) {
    crumbs.push({ label: "Configurações" });
  } else if (storeId) {
    const base = `/app/stores/${storeId}`;
    crumbs.push({ label: member?.name ?? fetched?.name ?? "Loja", href: homeForRole(storeId, role) });
    const section = pathname.slice(base.length).split("/").filter(Boolean)[0];
    if (section && SECTIONS[section]) {
      crumbs.push({ label: SECTIONS[section], href: `${base}/${section}` });
      if (section === "orders" && searchParams.get("view") === "historico") crumbs.push({ label: "Histórico" });
    } else if (!section) {
      crumbs.push({ label: "Loja" });
    }
  }

  if (crumbs.length === 0) return null;
  const last = crumbs.length - 1;

  return (
    <Breadcrumb className="min-w-0">
      {/* On the brand-colored header: light text, current page in full white. */}
      <BreadcrumbList className="flex-nowrap text-primary-foreground/75">
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator className={index < last ? "max-sm:hidden" : undefined} />}
            {/* Phones: only the current page and its parent. */}
            <BreadcrumbItem className={index < last - 1 ? "max-sm:hidden" : "min-w-0"}>
              {index === last || !crumb.href ? (
                <BreadcrumbPage className="truncate font-medium text-primary-foreground">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={crumb.href} />} className="truncate hover:text-primary-foreground">
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
