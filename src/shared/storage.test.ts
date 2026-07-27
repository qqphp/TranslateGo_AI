import { describe, expect, it } from "vitest";
import { validateBaseUrl } from "./storage";

describe("validateBaseUrl", () => {
  it("accepts HTTPS and local development endpoints", () => {
    expect(validateBaseUrl("https://api.example.com/v1")).toBeNull();
    expect(validateBaseUrl("http://localhost:3000/v1")).toBeNull();
  });
  it("rejects public HTTP and malformed URLs", () => {
    expect(validateBaseUrl("http://api.example.com")).toMatch(/HTTPS/);
    expect(validateBaseUrl("not a url")).toMatch(/valid/);
  });
  it("rejects embedded credentials, query strings, and fragments", () => {
    expect(validateBaseUrl("https://user:pass@example.com/v1")).toMatch(/credentials/);
    expect(validateBaseUrl("https://example.com/v1?key=value")).toMatch(/query string/);
    expect(validateBaseUrl("https://example.com/v1#section")).toMatch(/query string/);
  });
});
