import { createManagedLogger } from "@/lib/logger";

export const entraTokenLogger = createManagedLogger(
  "auth.providers.microsoft.token",
  "Microsoft Entra Token",
  undefined,
  "auth.providers"
);

export function logTokenPreviews(
  context: string,
  data: { accessToken?: string; refreshToken?: string; idToken?: string }
) {
  const isDev = process.env.NODE_ENV !== "production";
  entraTokenLogger.debug(
    {
      accessTokenPreview: data.accessToken?.slice(0, 16),
      refreshTokenPreview: data.refreshToken?.slice(0, 16),
      idTokenPreview: data.idToken?.slice(0, 16),
      accessToken: isDev ? data.accessToken : undefined,
      refreshToken: isDev ? data.refreshToken : undefined,
    },
    context
  );
}
