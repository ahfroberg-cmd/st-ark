import { describe, expect, it } from "vitest";
import { mergeAgentUserFollowupInstruction } from "@/lib/chat/mergeAgentUserFollowup";

describe("mergeAgentUserFollowupInstruction", () => {
  it("slår ihop från YYYY med föregående instruktion", () => {
    expect(
      mergeAgentUserFollowupInstruction(
        "Lägg till handledarsamtal första tisdagen varje månad",
        "från 2021"
      )
    ).toBe("Lägg till handledarsamtal första tisdagen varje månad. från 2021");
  });

  it("behåller lång fristående text", () => {
    const long = "a".repeat(200);
    expect(mergeAgentUserFollowupInstruction("tidigare", long)).toBe(long);
  });

  it("slår ihop och-svar", () => {
    expect(mergeAgentUserFollowupInstruction("Välj kurs X", "och sedan spara")).toBe(
      "Välj kurs X. och sedan spara"
    );
  });
});
