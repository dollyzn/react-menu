"use client";

import { Table } from "@tanstack/react-table";

import { BulkDeleteAddonDialog } from "./bulk-delete-addon-dialog";

interface HeaderActionsProps<Addon> {
  table: Table<Addon>;
}

export function HeaderActions({ table }: HeaderActionsProps<Addon>) {
  return <BulkDeleteAddonDialog rows={table.getSelectedRowModel().rows} />;
}
