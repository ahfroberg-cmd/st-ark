import { describe, expect, it } from "vitest";
import {
  detectPositionFromEnd,
  hasNoGapIntent,
  hasOrdinalFromEndMention,
  hasUndoIntent,
  parsePositionFromEnd,
  stripUndoPrefix,
} from "@/lib/ai/agent/languageLexicon";

describe("languageLexicon", () => {
  it("detects ordinal aliases from end", () => {
    expect(detectPositionFromEnd("förläng nästsista placeringen")).toBe(2);
    expect(detectPositionFromEnd("förläng näst-sista placeringen")).toBe(2);
    expect(detectPositionFromEnd("förläng andra från slutet")).toBe(2);
    expect(parsePositionFromEnd("förläng tredje från slutet")).toBe(3);
    expect(parsePositionFromEnd("förläng 3:e från slutet")).toBe(3);
    expect(parsePositionFromEnd("förläng 4:e sista")).toBe(4);
    expect(parsePositionFromEnd("förläng nummer 5 från slutet")).toBe(5);
    expect(parsePositionFromEnd("förläng tredjesista")).toBe(3);
    expect(hasOrdinalFromEndMention("förläng senaste placeringen")).toBe(true);
    expect(hasOrdinalFromEndMention("förläng placeringen")).toBe(false);
  });

  it("detects no-gap intent aliases", () => {
    expect(hasNoGapIntent("förläng så att glappet fylls")).toBe(true);
    expect(hasNoGapIntent("förläng så den möter nästa")).toBe(true);
    expect(hasNoGapIntent("förläng till nästa placering börjar")).toBe(true);
  });

  it("detects and strips undo prefix", () => {
    expect(hasUndoIntent("återställ det du gjorde innan och förläng nästsista")).toBe(true);
    expect(stripUndoPrefix("återställ det du gjorde innan och förläng nästsista")).toBe(
      "förläng nästsista"
    );
    expect(stripUndoPrefix("ångra senaste ändringen")).toBe("");
  });
});
