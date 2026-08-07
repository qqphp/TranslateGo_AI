import { describe, expect, it } from "vitest";
import { MODEL_PROVIDERS, providerForBaseUrl } from "./providers";

describe("MODEL_PROVIDERS", () => {
  it("includes the major Chinese OpenAI-compatible model services", () => {
    const ids = MODEL_PROVIDERS.map((provider) => provider.id);
    expect(ids).toEqual(expect.arrayContaining(["deepseek", "qwen", "zhipu", "moonshot", "minimax", "iflytek-spark", "baichuan", "01ai", "stepfun", "sensenova", "baidu", "tencent-tokenhub", "siliconflow", "volcengine"]));
  });

  it("recognizes a preset URL and preserves custom endpoints", () => {
    expect(providerForBaseUrl("https://api.stepfun.com/v1")).toBe("stepfun");
    expect(providerForBaseUrl("https://proxy.example.com/v1")).toBe("custom");
  });

  it("exposes Kimi as a clearly named provider", () => {
    expect(MODEL_PROVIDERS.find((provider) => provider.id === "moonshot")).toMatchObject({ name: expect.stringMatching(/^Kimi/), baseUrl: "https://api.moonshot.cn/v1" });
  });
});
