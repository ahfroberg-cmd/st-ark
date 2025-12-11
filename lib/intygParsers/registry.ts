// lib/intygParsers/registry.ts
import type { IntygKind } from "@/lib/intygDetect";
import type { ParserFn } from "./types";

// Importera bef. parser-funktioner (de som redan finns hos dig)
import { parse_2015_bilaga3 }  from "@/lib/intygParsers/parse_2015_bilaga3";
import { parse_2015_bilaga4 }  from "@/lib/intygParsers/parse_2015_bilaga4";
import { parse_2015_bilaga5 }  from "@/lib/intygParsers/parse_2015_bilaga5";
import { parse_2015_bilaga6 }  from "@/lib/intygParsers/parse_2015_bilaga6";
import { parse_2015_bilaga7 }  from "@/lib/intygParsers/parse_2015_bilaga7";
import { parse_2021_bilaga8 }  from "@/lib/intygParsers/parse_2021_bilaga8";
import { parse_2021_bilaga9 }  from "@/lib/intygParsers/parse_2021_bilaga9";
import { parse_2021_bilaga10 } from "@/lib/intygParsers/parse_2021_bilaga10";
import { parse_2021_bilaga11 } from "@/lib/intygParsers/parse_2021_bilaga11";
import { parse_2021_bilaga12 } from "@/lib/intygParsers/parse_2021_bilaga12";
import { parse_2021_bilaga13 } from "@/lib/intygParsers/parse_2021_bilaga13";

const registry: Partial<Record<IntygKind, ParserFn>> = {
  // 2015
  "2015-B3-AUSK":       parse_2015_bilaga3,
  "2015-B4-KLIN":       parse_2015_bilaga4,     // ← din stabila
  "2015-B5-KURS":       parse_2015_bilaga5,
  "2015-B6-UTV":        parse_2015_bilaga6,
  "2015-B7-SKRIFTLIGT": parse_2015_bilaga7,

  // 2021
  "2021-B8-AUSK":        parse_2021_bilaga8,
  "2021-B9-KLIN":        parse_2021_bilaga9,
  "2021-B10-KURS":       parse_2021_bilaga10,
  "2021-B11-UTV":        parse_2021_bilaga11,
  "2021-B12-STa3":       parse_2021_bilaga12,
  "2021-B13-TREDJELAND": parse_2021_bilaga13,

  // Adminblanketter (ingen aktivitet)
  "2021-B5-ANS":  undefined,
  "2021-B6-FULLST": undefined,
  "2021-B7-UPPN": undefined,
};

export function getParser(kind: IntygKind | null | undefined): ParserFn | undefined {
  if (!kind) return undefined;
  return registry[kind];
}

// UI-etiketter/rubriker per blankett
export function labelsFor(kind: IntygKind | null | undefined) {
  const base = {
    title: "",
    clinicLabel: "Tjänstgöringsställe",
    descriptionLabel: "Beskrivning av den kliniska tjänstgöringen",
  };

  switch (kind) {
case "2015-B7-SKRIFTLIGT":
  return {
    ...base,
    title: "Självständigt skriftligt arbete",
    clinicLabel: "Ämne (rubrik)",
    descriptionLabel: "Beskrivning av det självständiga skriftliga arbetet",
  };

    case "2015-B6-UTV":
    case "2021-B11-UTV":
      return {
        ...base,
        title: "Intyg för kvalitets- och utvecklingsarbete",
        descriptionLabel: "Beskrivning av kvalitets- och utvecklingsarbete",
      };
    case "2015-B4-KLIN":
    case "2021-B9-KLIN":
      return {
        ...base,
        title: "Intyg för klinisk tjänstgöring",
      };
    case "2021-B10-KURS":
      return {
        ...base,
        title: "Intyg för kurs",
      };
    case "2015-B3-AUSK":
    case "2021-B8-AUSK":
      return {
        ...base,
        title: "Intyg för auskultation",
      };
    default:
      return base;
  }
}

// Om blanketten har datumfält i intyget
export function kindHasDates(kind: IntygKind | null | undefined) {
  if (!kind) return true;
  // Självständigt skriftligt arbete & kvalitets-/utvecklingsarbete saknar datum på blanketten
  if (kind === "2015-B7-SKRIFTLIGT") return false;
  if (kind === "2015-B6-UTV" || kind === "2021-B11-UTV") return false;
  return true;
}
