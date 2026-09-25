/**
 * The live task a service belongs to, as far as the client name is concerned.
 * `client` is `mintral_clientAbbreviation` — a name — and `clientCode` is
 * `mintral_customerCode` — a code (see `data.service.ts`).
 */
export interface LiveClientSource {
  client?: string;
  clientCode?: string;
}

/**
 * The client name to show for a planned service, given what its live task says
 * and what its booking stored.
 *
 * The two carriers are not interchangeable. A live abbreviation is a name and
 * the freshest one there is, so it wins outright. A customer code is a code:
 * it fills a blank, because a code beats nothing, but it must never overwrite
 * a stored name — doing so would put a code back in the client slot and, since
 * the next planner write persists what it renders, bake it into the booking.
 * That is the same "a code masquerading as a client name" the mapper refuses
 * to invent from the resource id, arriving by another door.
 *
 * Returns undefined when there is nothing to overlay.
 */
export function resolveLiveClient(
  live: LiveClientSource | undefined,
  storedClient: string | undefined
): string | undefined {
  if (live?.client) return live.client;
  if (!storedClient && live?.clientCode) return live.clientCode;
  return undefined;
}
