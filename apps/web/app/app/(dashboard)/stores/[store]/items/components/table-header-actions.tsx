"use client";

import { Table } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { BulkEditDialog } from "@/components/app/bulk-edit-dialog";
import { useBulkUpdateItemsByStoreIdMutation } from "@/redux/features/item/itemApi";
import { BulkDeleteItemDialog } from "./bulk-delete-item-dialog";

interface HeaderActionsProps<Item> {
  table: Table<Item>;
}

export function HeaderActions({ table }: HeaderActionsProps<Item>) {
  const { store } = useParams();
  const [bulkUpdate] = useBulkUpdateItemsByStoreIdMutation();
  const rows = table.getSelectedRowModel().rows;

  return (
    <div className="flex items-center">
      <BulkEditDialog
        rows={rows.map((row) => row.original)}
        noun={{ singular: "item", plural: "itens" }}
        onApply={(changes) => bulkUpdate({ storeId: store as string, changes }).unwrap()}
        onDone={() => table.resetRowSelection()}
      />
      <BulkDeleteItemDialog rows={rows} />
    </div>
  );
}
