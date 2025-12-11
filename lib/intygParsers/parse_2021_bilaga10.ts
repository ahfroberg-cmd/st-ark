// lib/intygParsers/parse_2021_bilaga10.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";

export type ParsedKurs2021 = ExtractedCommon & {
  type: "KURS";
  courseTitle?: string; description?: string;
};
export function parse_2021_bilaga10(text: string, words?: OcrWord[]): ParsedKurs2021 {
  const base = extractCommon(text);
  const title = (text.match(/Kursens ämne.*?:\s*(.+)/i)||[])[1]?.trim();
  const desc  = (text.match(/Beskrivning av kursen\s*(.+)$/i)||[])[1]?.trim();
  return { ...base, type: "KURS", courseTitle: title, description: desc };
}
