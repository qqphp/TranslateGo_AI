import { describe, expect, it, vi } from "vitest";
import { fetchModels, ModelListError } from "./models";

describe("fetchModels", () => {
  it("requests the standard models endpoint and returns sorted unique IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchModels("https://api.example.com/v1", "secret")).resolves.toEqual(["a-model", "z-model"]);
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://api.example.com/v1/models"), expect.objectContaining({ headers: { Authorization: "Bearer secret" } }));
  });

  it("rejects unsupported model-list responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    await expect(fetchModels("https://api.example.com/v1", "secret")).rejects.toBeInstanceOf(ModelListError);
  });
});
