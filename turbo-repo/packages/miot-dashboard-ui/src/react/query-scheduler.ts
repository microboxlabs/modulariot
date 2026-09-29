/** Retains occupied slots until transports settle, including cancelled generations. */
export class QueryScheduler {
  private active = 0;
  private readonly waiting = new Set<() => void>();

  async run<T>(
    task: () => Promise<T>,
    signal: AbortSignal,
  ): Promise<T | undefined> {
    if (!(await this.acquire(signal))) return undefined;
    try {
      if (signal.aborted) return undefined;
      return await task();
    } finally {
      this.active--;
      this.waiting.values().next().value?.();
    }
  }

  private acquire(signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const grant = () => {
        this.waiting.delete(grant);
        signal.removeEventListener("abort", cancel);
        this.active++;
        resolve(true);
      };
      const cancel = () => {
        this.waiting.delete(grant);
        signal.removeEventListener("abort", cancel);
        resolve(false);
      };
      if (signal.aborted) resolve(false);
      else if (this.active < 4) grant();
      else {
        this.waiting.add(grant);
        signal.addEventListener("abort", cancel, { once: true });
      }
    });
  }
}
