"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  manage: "Gerenciar",
  overview: "Visão Geral",
  categories: "Categorias",
  items: "Itens",
  addons: "Adicionais",
};

function labelForSegment(segment: string, index: number, parts: string[]) {
  if (segment === "manage") return null;
  if (index === 2 && parts[0] === "manage") {
    return "Loja";
  }
  return SEGMENT_LABELS[segment] ?? segment;
}

export default function HeaderBreadcrumbs() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return null;

  const crumbs: { href: string; label: string | null }[] = [];
  let acc = "";
  parts.forEach((segment, i) => {
    acc += `/${segment}`;
    const label = labelForSegment(segment, i, parts);
    if (label) crumbs.push({ href: acc, label });
  });

  const last = crumbs[crumbs.length - 1];

  if (isMobile && last) {
    return (
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbPage className="min-w-20 text-primary-foreground/90 capitalize">
              {last.label}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={c.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="text-primary-foreground capitalize">
                    {c.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={c.href}
                      className={cn(
                        "text-primary-foreground/80 hover:text-primary-foreground capitalize"
                      )}
                    >
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="text-primary-foreground/80" />
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
