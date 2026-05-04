"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <AlertDialogContent className="max-w-md p-0">
        <AlertDialogHeader className="gap-0">
          <AlertDialogTitle className="px-6 py-4 text-start text-xl">
            Sessão Expirada
          </AlertDialogTitle>
          <AlertDialogDescription className="border-t border-b p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full">
            <AlertTriangle className="text-primary" size={48} />
            <span>
              <span className="font-semibold text-xl text-foreground block">
                Sua sessão expirou
              </span>
              <span>Por favor, faça login novamente para continuar</span>
            </span>
          </AlertDialogDescription>

          <AlertDialogFooter className="px-6 py-4">
            <Button
              loading={loading}
              size="lg"
              className="px-6"
              onClick={handleClick}
            >
              Login
            </Button>
          </AlertDialogFooter>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
