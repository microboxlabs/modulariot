import type { Logger } from "@/lib/logger";

export function logTokenPreviews(
  context: string,
  data: { accessToken?: string; refreshToken?: string; idToken?: string },
  logger?: Logger
) {
  const isDev = process.env.NODE_ENV !== "production";
  logger?.debug(
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
