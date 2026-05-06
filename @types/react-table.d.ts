import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta {
    name: string;
    isFilterOnly?: boolean;
  }

  interface TableMeta {
    tableId: string;
  }
}
