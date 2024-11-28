"use client";

import { useSession } from "@/providers/session-provider";

export default function Store() {
  const { user } = useSession();

  return <div>Olá, {user?.name}</div>;
}
