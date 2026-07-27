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
});
