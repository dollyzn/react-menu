"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/contexts/session-provider";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { redirectToLogin } from "@/utils/navigation";

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useSession();
  const rehydrated = useRehydrated();
  const router = useRouter();

  useEffect(() => {
    // Before rehydration the persisted user isn't loaded yet.
    if (rehydrated && !user) {
      redirectToLogin(router);
    }
  }, [rehydrated, user, router]);

  if (!rehydrated || !user) return null;

  return children;
}
