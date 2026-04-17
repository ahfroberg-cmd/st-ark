import { describe, expect, it } from "vitest";
import { redactContactInfoText } from "@/lib/ai/piiRedaction";

describe("redactContactInfoText", () => {
  it("lämnar ISO-datum orörda i agentmeddelanden (inte telefon-regex)", () => {
    const msg =
      "Lade till 5 handledarsamtal: 2024-03-04, 2025-03-03, 2026-03-02, 2027-03-01, 2028-03-07";
    expect(redactContactInfoText(msg)).toBe(msg);
  });

  it("redigerar fortfarande e-post", () => {
    expect(redactContactInfoText("Kontakta x@example.com")).toBe(
      "Kontakta [kontaktuppgift-redigerad]"
    );
  });
});
