import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  client: {
    NEXT_PUBLIC_NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    NEXT_PUBLIC_BUILD_VERSION: z.string().min(1),

    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_API_TIMEOUT: z.string().min(1).transform(Number),

    NEXT_PUBLIC_AUTH_COOKIE_NAME: z.string().min(1),

    NEXT_PUBLIC_STORAGE_BASE_NAME: z.string().min(1),
    NEXT_PUBLIC_PAGE_SIZES: z
      .string()
      .transform((val) => JSON.parse(val))
      .pipe(z.array(z.number())),

    // Firebase Cloud Messaging (optional; enables web push)
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_NODE_ENV: process.env.NEXT_PUBLIC_NODE_ENV,
    NEXT_PUBLIC_BUILD_VERSION: process.env.NEXT_PUBLIC_BUILD_VERSION,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT,
    NEXT_PUBLIC_AUTH_COOKIE_NAME: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME,
    NEXT_PUBLIC_STORAGE_BASE_NAME: process.env.NEXT_PUBLIC_STORAGE_BASE_NAME,
    NEXT_PUBLIC_PAGE_SIZES: process.env.NEXT_PUBLIC_PAGE_SIZES,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  },
});
