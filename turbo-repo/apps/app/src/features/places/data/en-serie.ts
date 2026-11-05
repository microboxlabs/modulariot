/**
 * Corre `fn` sobre cada elemento, uno tras otro (nunca en paralelo: el
 * servidor de lugares recibe las llamadas de a una, en orden), y junta los
 * resultados en el mismo orden. Si una falla, se corta ahí.
 */
export function enSerie<T, R>(
  xs: readonly T[],
  fn: (x: T, i: number) => Promise<R>
): Promise<R[]> {
  return xs.reduce<Promise<R[]>>(
    (previo, x, i) => previo.then(async (acc) => [...acc, await fn(x, i)]),
    Promise.resolve([])
  );
}
