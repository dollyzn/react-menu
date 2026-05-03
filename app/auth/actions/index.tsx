"use server";

import { env } from "@/lib/env";
import { cookies } from "next/headers";

export async function clearCookie() {
  (await cookies()).delete(env.NEXT_PUBLIC_AUTH_COOKIE_NAME);
}
