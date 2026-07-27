export async function withRetries<T>(operation: (attempt: number) => Promise<T>, retries: number, shouldStop: () => boolean = () => false): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (shouldStop()) throw new DOMException("Cancelled", "AbortError");
    try { return await operation(attempt); }
    catch (error) { lastError = error; if (shouldStop()) throw error; }
  }
  throw lastError;
}
