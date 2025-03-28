type Success<T> = {
  data: T;
  error: null;
};

type Failure<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

export async function retry<T, E = Error>(
  promise: Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<Result<T, E>> {
  let lastError: E | null = null;
  const attempts = Array.from({ length: maxAttempts }, (_, i) => i + 1);

  for (const attempt of attempts) {
    const result = await tryCatch<T, E>(promise);

    if (result.data !== null) {
      return result;
    }

    lastError = result.error;

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { data: null, error: lastError as E };
}
