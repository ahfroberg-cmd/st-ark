import { describe, expect, it } from "vitest";
import { selectItemsByCursorRule } from "@/lib/ai/agent/collectionExecutor";

describe("collectionExecutor", () => {
  const items = [
    { id: "a", title: "A", startDate: "2026-01-01" },
    { id: "b", title: "Beroendelära", startDate: "2026-02-01" },
    { id: "c", title: "C", startDate: "2026-03-01" },
    { id: "d", title: "D", startDate: "2026-04-01" },
    { id: "e", title: "E", startDate: "2026-05-01" },
  ];

  it("selects every second item from start", () => {
    const r = selectItemsByCursorRule(items, { everyN: 2, startAt: 0 });
    expect(r.selected.map((x) => x.id)).toEqual(["a", "c", "e"]);
  });

  it("selects every second item after anchor", () => {
    const r = selectItemsByCursorRule(items, {
      everyN: 2,
      startAt: 0,
      afterTitle: "Beroendelära",
    });
    expect(r.selected.map((x) => x.id)).toEqual(["c", "e"]);
  });
});
