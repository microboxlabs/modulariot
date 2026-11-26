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
  const active = new AsyncLocalStorage<true>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    run<T>(body: () => Promise<T>): Promise<T> {
      if (active.getStore()) return body();
      const execute = async () => {
        const restore = snapshot();
        try {
          return await active.run(true, body);
        } catch (error) {
          restore();
          throw error;
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
