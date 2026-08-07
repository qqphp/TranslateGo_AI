import { describe, expect, it } from "vitest";
import { planTranslationBatches } from "./batching";

describe("planTranslationBatches", () => {
  it("uses a small first batch, then packs 400 short segments into larger throughput batches", () => {
    const nodes = Array.from({ length: 400 }, (_, index) => ({ id: String(index), text: `Segment ${index}` }));
    const plan = planTranslationBatches(nodes);
    expect(plan.batches).toHaveLength(17);
    expect(plan.batches[0]).toHaveLength(10);
    expect(plan.batches[1]).toHaveLength(25);
    expect(plan.accepted).toHaveLength(400);
    expect(plan.overflow).toHaveLength(0);
  });

  it("also splits batches by character budget", () => {
    const nodes = [
      { id: "a", text: "a".repeat(4_000) },
      { id: "b", text: "b".repeat(4_000) },
      { id: "c", text: "short" }
    ];
    expect(planTranslationBatches(nodes).batches.map((batch) => batch.map((node) => node.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("reports overflow instead of silently exceeding the request cap", () => {
    const nodes = Array.from({ length: 36 }, (_, index) => ({ id: String(index), text: `Segment ${index}` }));
    const plan = planTranslationBatches(nodes, 2);
    expect(plan.accepted).toHaveLength(35);
    expect(plan.overflow).toHaveLength(1);
  });
});
