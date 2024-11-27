"use client";

import { useSession } from "@/providers/session-provider";

export default function Dashboard() {
  const { user } = useSession();

  return <div>Hello, {user?.name}</div>;
}
