// Escrituras de Lugares en el modulith, desde el navegador. null = el servidor
// no respondió (red caída, 5xx): el llamador cae al respaldo local. Un 4xx
// (forma inválida, código repetido, sin permiso) es { ok: false, error }.
import { z } from "zod";
import { URL_LUGARES_GUARDADOS, type PlaceRequest } from "./saved-places";

export type Escritura = { ok: true; id: string } | { ok: false; error: string };

const errorSchema = z.object({ error: z.string() });
const creadoSchema = z.object({ id: z.string() });

async function errorDe(r: Response): Promise<string> {
  const parsed = errorSchema.safeParse(await r.json().catch(() => null));
  return parsed.success ? parsed.data.error : `HTTP ${r.status}`;
}

async function enviar(
  url: string,
  init: RequestInit
): Promise<Response | null> {
  try {
    const r = await fetch(url, init);
    return r.status >= 500 ? null : r;
  } catch {
    return null;
  }
}

/** Crea (sin `id`) o reemplaza un lugar o trayecto guardado. */
export async function guardarPlace(
  id: string | null,
  body: PlaceRequest
): Promise<Escritura | null> {
  const url = id
    ? `${URL_LUGARES_GUARDADOS}/${encodeURIComponent(id)}`
    : URL_LUGARES_GUARDADOS;
  const r = await enviar(url, {
    method: id ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r) return null;
  if (!r.ok) return { ok: false, error: await errorDe(r) };
  const creado = creadoSchema.safeParse(await r.json().catch(() => null));
  if (creado.success) return { ok: true, id: creado.data.id };
  return id ? { ok: true, id } : null;
}

/**
 * Elimina el lugar guardado con ese External ID (una geocerca se lleva sus
 * interiores). Sin código no hay a quién borrar en el servidor.
 */
export async function borrarPlace(
  codigo: string | null
): Promise<Escritura | null> {
  if (!codigo) return { ok: false, error: "Sin External ID guardado" };
  const r = await enviar(
    `${URL_LUGARES_GUARDADOS}?code=${encodeURIComponent(codigo)}`,
    { method: "DELETE" }
  );
  if (!r) return null;
  // ya no estaba (p. ej. borrada junto a su geocerca): el fin es el mismo
  if (r.ok || r.status === 404) return { ok: true, id: codigo };
  return { ok: false, error: await errorDe(r) };
}
