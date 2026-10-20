"use client";

import { Table } from "@tanstack/react-table";

import { BulkDeleteCategoryDialog } from "./bulk-delete-category-dialog";

interface HeaderActionsProps<Category> {
  table: Table<Category>;
}

export function HeaderActions({ table }: HeaderActionsProps<Category>) {
  return <BulkDeleteCategoryDialog rows={table.getSelectedRowModel().rows} />;
}
