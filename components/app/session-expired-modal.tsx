"use client";

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
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";
import { redirectToLogout } from "@/utils/navigation";

export default function SessionExpiredModal() {
  const isSessionExpired = useSelector(
    (state: RootState) => state.auth.isSessionExpired
  );
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    redirectToLogout(router);
    setLoading(false);
  };

  return (
    <AlertDialog open={isSessionExpired} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary size-19 mb-0">
            <AlertTriangle className="size-11" strokeWidth={1.5} />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-lg font-medium">
            Sua sessão expirou
          </AlertDialogTitle>
          <AlertDialogDescription>
            Por favor, faça login novamente para continuar
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction loading={loading} onClick={handleClick}>
            Login
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
