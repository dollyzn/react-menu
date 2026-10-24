"use client";

import { Table } from "@/components/app/data-table/features";

import { BulkDeleteCategoryDialog } from "./bulk-delete-category-dialog";

interface HeaderActionsProps {
  table: Table<Category>;
}

export function HeaderActions({ table }: HeaderActionsProps) {
  return <BulkDeleteCategoryDialog rows={table.getSelectedRowModel().rows} />;
}
