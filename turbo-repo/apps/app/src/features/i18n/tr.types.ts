import type esDictionary from "@/lang/es.json";

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

// Decrement table for the recursion budget. The canonical dictionary nests 7
// levels deep; a budget of 12 leaves margin while keeping the type *bounded* so
// generic instantiations `LeafPaths<D>` provably terminate and never trip TS's
// "Type instantiation is excessively deep and possibly infinite" guard.
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * All dot-paths whose value is a leaf string in the given dictionary shape.
 * Object nodes are traversed; only string leaves yield a key. Recursion is
 * depth-bounded by `Depth` (see {@link Prev}).
 */
export type LeafPaths<T, Depth extends number = 12> = [Depth] extends [never]
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends object
          ? Join<K, LeafPaths<T[K], Prev[Depth]>>
          : never;
    }[keyof T & string];

/**
 * The set of valid translation keys, derived from the canonical (es) dictionary.
 * Derived from the *default import* (`typeof esDictionary`) rather than the module
 * namespace, so synthesized `default`/named JSON exports don't pollute the union.
 */
export type TrKey = LeafPaths<typeof esDictionary>;
