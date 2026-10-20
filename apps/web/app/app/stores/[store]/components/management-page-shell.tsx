"use client";

import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ManagementPageShellProps {
  storeId: string;
  pageLabel: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function ManagementPageShell({
  storeId,
  pageLabel,
  action,
  children,
}: ManagementPageShellProps) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/app/stores/${storeId}`}>Loja</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {action}
      </div>
      {children}
    </div>
  );
}
