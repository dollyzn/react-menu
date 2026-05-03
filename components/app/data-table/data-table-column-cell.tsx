import { TableCell } from "@/components/ui/table";

interface DataTableColumnHeaderProps extends React.HTMLAttributes<HTMLTableCellElement> {}
export default function DataTableColumnCell(props: DataTableColumnHeaderProps) {
  return <TableCell {...props} />;
}
