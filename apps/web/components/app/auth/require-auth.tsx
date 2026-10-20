"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/contexts/session-provider";
import { redirectToLogin } from "@/utils/navigation";

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      redirectToLogin(router);
    }
  }, [user, router]);

  if (!user) return null;

  return children;
}
