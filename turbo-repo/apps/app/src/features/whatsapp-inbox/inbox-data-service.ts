"use client";

import type { Conversation, Message } from "./conversation.types";

/** The app runs under Next.js basePath "/app", so proxy routes are reached at /app/api/... */
const BASE = "/app/api/whatsapp/conversations";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function fetchConversations(): Promise<Conversation[]> {
  return getJson<Conversation[]>(BASE);
}

export function fetchMessages(conversationId: string): Promise<Message[]> {
  return getJson<Message[]>(`${BASE}/${encodeURIComponent(conversationId)}/messages`);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Mark-read for ${conversationId} failed (${res.status})`);
  }
}

export interface SendTextInput {
  readonly to: string;
  readonly body: string;
  /** Kept so the reply lands on the same service thread (null = the unassigned thread). */
  readonly serviceCode: string | null;
  readonly driverId: string | null;
}

/**
 * Sends a free-text agent reply for the active org (proxied to `POST …/whatsapp/messages`). Surfaces
 * the modulith's error message on failure — e.g. a test-mode allow-list rejection — so the operator
 * sees why. Note the modulith persists a FAILED row on a rejected send, which the thread poll surfaces.
 */
export async function sendTextMessage(input: SendTextInput): Promise<Message> {
  const res = await fetch("/app/api/whatsapp/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: input.to,
      type: "TEXT",
      body: input.body,
      serviceCode: input.serviceCode,
      driverId: input.driverId,
    }),
  });
  if (!res.ok) {
    let message = `Send failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new Error(message);
  }
  return (await res.json()) as Message;
}
