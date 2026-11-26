import { AsyncLocalStorage } from "node:async_hooks";

/** Snapshot a mutable map for the testing adapters' rollback boundary. */
export function snapshotMap<K, V>(map: Map<K, V>, copy = (value: V) => value) {
  const before = new Map([...map].map(([key, value]) => [key, copy(value)]));
  return () => {
    map.clear();
    for (const [key, value] of before) map.set(key, value);
  };
}

/** One reentrant transaction queue with rollback for the in-memory adapters. */
export function createMemoryTransaction(snapshot: () => () => void) {
  const active = new AsyncLocalStorage<{
    live: boolean;
    undo: (() => void)[];
  }>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    participate(snapshot: (() => () => void) | undefined): void {
      const context = active.getStore();
      if (context?.live && snapshot) context.undo.push(snapshot());
    },
    run<T>(body: () => Promise<T>): Promise<T> {
      if (active.getStore()?.live) return body();
      const execute = async () => {
        const context = { live: true, undo: [snapshot()] };
        try {
          return await active.run(context, body);
        } catch (error) {
          for (const undo of context.undo.reverse()) undo();
          throw error;
        } finally {
          context.live = false;
        }
      };
      const result = queue.then(execute, execute);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
