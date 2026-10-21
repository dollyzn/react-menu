"use client";

import { Table } from "@tanstack/react-table";
import { BulkDeleteItemDialog } from "./bulk-delete-item-dialog";

interface HeaderActionsProps<Item> {
  table: Table<Item>;
}

export function HeaderActions({ table }: HeaderActionsProps<Item>) {
  return <BulkDeleteItemDialog rows={table.getSelectedRowModel().rows} />;
}
