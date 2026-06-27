"use client";

/**
 * Client-side wrapper around the WhatsApp send proxy route
 * (`POST /app/api/whatsapp/messages`). The proxy resolves the caller's active org
 * server-side, so no org id is needed here. Throws with the provider's error message
 * on failure (including a Meta-rejected send, which the backend surfaces as 502).
 */

export interface SendWhatsAppMessagePayload {
  to: string;
  type: "TEMPLATE" | "TEXT";
  templateName?: string;
  language?: string;
  templateParams?: Record<string, string>;
  body?: string;
  serviceCode?: string;
  driverId?: string;
}

export interface SentWhatsAppMessage {
  id: string;
  conversationId: string;
  status: string;
  metaMessageId: string | null;
  errorMessage: string | null;
}

const SEND_URL = "/app/api/whatsapp/messages";

export async function sendWhatsAppMessage(
  payload: SendWhatsAppMessagePayload,
): Promise<SentWhatsAppMessage> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message: string | undefined;
    try {
      const parsed = (await res.json()) as {
        error?: string;
        message?: string;
        errorMessage?: string;
        details?: string;
      };
      message = parsed.message ?? parsed.error ?? parsed.errorMessage;
      // The proxy adds `details` for upstream transport failures — keep it for context.
      if (parsed.details) {
        message = message ? `${message}: ${parsed.details}` : parsed.details;
      }
    } catch {
      // non-JSON error body — fall back to the status-based message below
    }
    throw new Error(message ?? `WhatsApp send failed (HTTP ${res.status})`);
  }

  return (await res.json()) as SentWhatsAppMessage;
}
