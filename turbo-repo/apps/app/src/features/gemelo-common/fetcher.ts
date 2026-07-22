"use client";

// Fetcher del Gemelo Digital: siempre vía la API route autenticada del app
// (allowlist server-side). El navegador nunca habla directo con la fuente.
export const golFetcher = (path: string) =>
  fetch(`/app/api/gemelo${path}`, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

export const golPost = (fn: string, body: unknown) =>
  fetch(`/app/api/gemelo/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.text().then((t) => (t ? JSON.parse(t) : null));
  });
