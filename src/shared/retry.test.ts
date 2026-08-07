import { describe, expect, it, vi } from "vitest";
import { withRetries } from "./retry";

describe("withRetries", () => {
  it("retries three times after the initial failure", async () => {
    const operation = vi.fn(async () => { throw new Error("temporary"); });
    await expect(withRetries(operation, 3)).rejects.toThrow("temporary");
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("returns immediately after a retry succeeds", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce("ok");
    await expect(withRetries(operation, 3)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent error", async () => {
    const operation = vi.fn(async () => { throw new Error("permanent"); });
    await expect(withRetries(operation, 3, () => false, { shouldRetry: () => false })).rejects.toThrow("permanent");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("waits before retrying a recoverable error", async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce("ok");
    const result = withRetries(operation, 3, () => false, { delayMs: () => 100 });
    await vi.advanceTimersByTimeAsync(99);
    expect(operation).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("ok");
    vi.useRealTimers();
  });
});
