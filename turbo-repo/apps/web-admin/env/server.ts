import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    DATABASE_URL: z.string().url(),
    AUTH0_DOMAIN: z.string().min(1),
    AUTH0_CLIENT_ID: z.string().min(1),
    AUTH0_CLIENT_SECRET: z.string().min(1),
    AUTH0_JWT_ALG: z.enum(['HS256', 'RS256']),
    AUTH0_JWT_LIFETIME_IN_SECONDS: z.coerce.number().min(3600).max(2592000),
    INGEST_SERVER_URL: z.string().url(),
    // OPEN_AI_API_KEY: z.string().min(1),
  },
  /*
   * Specify what values should be validated by your schemas above.
   * 
   * If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
   * For Next.js >= 13.4.4, you can use the experimental__runtimeEnv option and
   * only specify client-side variables.
   */
//   runtimeEnv: {
//     DATABASE_URL: process.env.DATABASE_URL,
//     OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
//     NEXT_PUBLIC_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PUBLISHABLE_KEY,
//   },
  experimental__runtimeEnv: process.env
});