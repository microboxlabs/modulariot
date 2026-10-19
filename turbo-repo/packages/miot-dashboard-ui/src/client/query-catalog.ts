import { z } from "zod";
const identifier = z.string().min(1).max(128).refine((value) => !!value.trim());
const label = z.string().min(1).max(256).refine((value) => !!value.trim());
const operation = z.object({ id: identifier, label, schema: z.array(identifier).max(100).optional() });
const uniqueIds = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
const connection = z.object({ id: identifier, label, operations: z.array(operation).max(100).refine(uniqueIds) });
/** Only display metadata survives parsing; no execution settings or credentials. */
export const queryCatalogSchema = z.object({ connections: z.array(connection).max(100).refine(uniqueIds) }).refine((value) => new TextEncoder().encode(JSON.stringify(value.connections)).byteLength <= 262144);
export type QueryCatalogConnection = z.infer<typeof connection>;
export type QueryCatalogOperation = z.infer<typeof operation>;
