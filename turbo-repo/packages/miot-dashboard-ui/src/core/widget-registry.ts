export interface WidgetRegistry<Definition> {
  get(id: string): Definition | undefined;
  all(): Definition[];
}

/** A host-owned catalog. Definitions are immutable; returned lists are independent copies. */
export function createWidgetRegistry<
  Definition extends { meta: { id: string } },
>(definitions: readonly Definition[]): WidgetRegistry<Definition> {
  const entries = new Map<string, Definition>();
  for (const definition of definitions) {
    const id = definition.meta.id;
    if (!id.trim()) throw new Error("Widget identifiers must not be empty");
    if (entries.has(id)) throw new Error(`Duplicate widget identifier: ${id}`);
    entries.set(id, definition);
  }
  return {
    get: (id) => entries.get(id),
    all: () => [...entries.values()],
  };
}
