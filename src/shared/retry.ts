export interface RetryOptions {
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  delayMs?: (error: unknown, attempt: number) => number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

async function wait(milliseconds: number, shouldStop: () => boolean): Promise<void> {
  let remaining = milliseconds;
  while (remaining > 0) {
    const slice = Math.min(50, remaining);
    await new Promise<void>((resolve) => setTimeout(resolve, slice));
    if (shouldStop()) throw new DOMException("Cancelled", "AbortError");
    remaining -= slice;
  }
}

export async function withRetries<T>(
  operation: (attempt: number) => Promise<T>,
  retries: number,
  shouldStop: () => boolean = () => false,
  options: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (shouldStop()) throw new DOMException("Cancelled", "AbortError");
    try { return await operation(attempt); } catch (error) {
      lastError = error;
      if (shouldStop() || attempt >= retries || options.shouldRetry?.(error, attempt) === false) throw error;
      const delayMs = Math.max(0, options.delayMs?.(error, attempt) ?? 0);
      options.onRetry?.(error, attempt, delayMs);
      if (delayMs) await wait(delayMs, shouldStop);
    }
  }
  throw lastError;
}
