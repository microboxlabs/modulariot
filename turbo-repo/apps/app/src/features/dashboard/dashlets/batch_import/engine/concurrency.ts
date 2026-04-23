/**
 * Run `work` for each input with at most `limit` in flight. Order-independent:
 * results are reported via `onResult(index, result)` as soon as each task
 * settles. Errors are surfaced through the work function's own contract — this
 * runner does not catch them, so callers should already wrap per-task errors
 * into a result object (the batch importer does this).
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
  onResult?: (index: number, result: R) => void,
): Promise<R[]> {
  const total = items.length;
  const results = new Array<R>(total);
  if (total === 0) return results;
  const safeLimit = Math.max(1, Math.min(limit, total));

  let next = 0;
  const runOne = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= total) return;
      const r = await work(items[i], i);
      results[i] = r;
      onResult?.(i, r);
    }
  };
  const workers: Promise<void>[] = [];
  for (let i = 0; i < safeLimit; i++) workers.push(runOne());
  await Promise.all(workers);
  return results;
}
