import * as React from "react";
import { Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AlertDialogDestructiveProps {
  children?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** After the open/close animation: where to clear the state the dialog shows. */
  onOpenChangeComplete?: (open: boolean) => void;
  loading?: boolean;
  onConfirm: () => void;
  /** Action button text (default "Excluir"). */
  confirmLabel?: string;
  /** The header icon (default a trash can). */
  icon?: React.ReactNode;
}

export function AlertDialogDestructive({
  confirmLabel = "Excluir",
  children,
  title,
  description,
  open,
  onOpenChange,
  onOpenChangeComplete,
  loading,
  onConfirm,
  icon = <Trash2Icon />,
}: AlertDialogDestructiveProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      {React.isValidElement(children) ? (
        <AlertDialogTrigger render={children} />
      ) : null}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            {icon}
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="outline" disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            loading={loading}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
