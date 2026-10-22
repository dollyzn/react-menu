"use client";

import { Table } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { BulkEditDialog } from "@/components/app/bulk-edit-dialog";
import { useBulkUpdateAddonsByStoreIdMutation } from "@/redux/features/addon/addonApi";
import { BulkDeleteAddonDialog } from "./bulk-delete-addon-dialog";

interface HeaderActionsProps<Addon> {
  table: Table<Addon>;
}

export function HeaderActions({ table }: HeaderActionsProps<Addon>) {
  const { store } = useParams();
  const [bulkUpdate] = useBulkUpdateAddonsByStoreIdMutation();
  const rows = table.getSelectedRowModel().rows;

  return (
    <div className="flex items-center">
      <BulkEditDialog
        rows={rows.map((row) => row.original)}
        noun={{ singular: "adicional", plural: "adicionais" }}
        onApply={(changes) => bulkUpdate({ storeId: store as string, changes }).unwrap()}
        onDone={() => table.resetRowSelection()}
      />
      <BulkDeleteAddonDialog rows={rows} />
    </div>
  );
}
