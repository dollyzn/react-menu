"use client";

import type { UrlObject } from "url";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import Link from "next/link";

type WrapperProps =
  | (React.ComponentProps<"a"> & { to?: string | UrlObject })
  | (React.ComponentProps<"div"> & { to?: string | UrlObject });

export function NavLinkWrapper({
  to,
  className,
  children,
  ...props
}: WrapperProps) {
  const { toggleSidebar, isMobile } = useSidebar();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) toggleSidebar();
  };

  if (to) {
    return (
      <Link
        href={to}
        onClick={handleClick}
        className={cn("inline cursor-pointer", className)}
        {...(props as React.ComponentProps<"a">)}
      >
        {children}
      </Link>
    );
  }

  return (
    <div
      {...(props as React.ComponentProps<"div">)}
      className={cn("inline", className)}
    >
      {children}
    </div>
  );
}
