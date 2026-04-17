import { describe, expect, it } from "vitest";
import {
  colleagueNameMatches,
  placementNameMatches,
} from "@/lib/ai/colleagueMatch";

describe("colleagueMatch", () => {
  it("matches placement names with substring and tokens", () => {
    expect(
      placementNameMatches("Psykos slutenvård", "Psykos slutenvård", undefined)
    ).toBe(true);
    expect(
      placementNameMatches("psykos sluten", "Akutmottagning — Psykos slutenvård", undefined)
    ).toBe(true);
    expect(
      placementNameMatches("psykos", "Slutenvård psykos", undefined)
    ).toBe(true);
  });

  it("uses alt name when title differs", () => {
    expect(
      placementNameMatches(
        "Psykos slutenvård",
        "Akuten",
        "Psykos slutenvård"
      )
    ).toBe(true);
  });

  it("matches colleague first names", () => {
    expect(colleagueNameMatches("Cecilia", "Cecilia Svensson")).toBe(true);
    expect(colleagueNameMatches("cecilias", "Cecilia Svensson")).toBe(true);
  });
});
