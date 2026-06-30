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
