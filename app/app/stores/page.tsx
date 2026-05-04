"use client";

import { useSession } from "@/contexts/session-provider";
import { redirect } from "next/navigation";

export default function Stores() {
  const { user } = useSession();
  const stores = user?.stores || [];

  if (!!stores.length) {
    return redirect(`/app/stores/${stores[0].id}`);
  } else {
    return redirect("/");
  }
}
