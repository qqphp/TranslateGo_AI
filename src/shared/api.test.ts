import { describe, expect, it } from "vitest";
import { cleanTranslation, parseBatchOutput } from "./api";

describe("cleanTranslation", () => {
  it("removes common wrappers without changing translated prose", () => {
    expect(cleanTranslation('"Translation: Hello world"')).toBe("Hello world");
    expect(cleanTranslation("```text\n你好\n``` ")).toBe("你好");
  });
});

describe("parseBatchOutput", () => {
  it("keeps translations aligned to their source node IDs", () => {
    const result = parseBatchOutput('[{"id":"a","translation":"你好"},{"id":"b","translation":"世界"}]', [{ id: "a", text: "Hello" }, { id: "b", text: "World" }]);
    expect(result.get("a")).toBe("你好");
    expect(result.get("b")).toBe("世界");
  });
});
