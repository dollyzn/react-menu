import "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    name: string;
    isFilterOnly?: boolean;
  }

  interface TableMeta<TData extends RowData> {
    tableId: string;
  }
}
