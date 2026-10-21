"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/layout/page-header";

interface ManagementPageShellProps {
  storeId: string;
  pageLabel: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Catalog pages (categories, items, add-ons): title, action and content. */
export function ManagementPageShell({ pageLabel, description, action, children }: ManagementPageShellProps) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title={pageLabel} description={description} actions={action} />
      {children}
    </div>
  );
}
