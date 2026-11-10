"use client";

import { useEffect } from "react";
import { useSession } from "@/contexts/session-provider";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { redirectToLogin } from "@/utils/navigation";

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { user, verify } = useSession();
  const rehydrated = useRehydrated();

  useEffect(() => {
    // Before rehydration the persisted user isn't loaded yet.
    if (!rehydrated || user) return;
    // Ask the API first: a valid cookie loads the user here, and a refused
    // one is cleared by verify(), so the login page isn't bounced back.
    let active = true;
    void verify().then((current) => {
      if (active && !current) redirectToLogin();
    });
    return () => {
      active = false;
    };
  }, [rehydrated, user, verify]);

  if (!rehydrated || !user) return null;

  return children;
}
