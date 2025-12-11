// lib/intygParsers/types.ts
import type { OcrWord } from "@/lib/ocr";

export type ParsedIntyg = {
  kind: string;
  fullName?: string;
  lastName?: string;
  firstName?: string;
  personnummer?: string;
  specialtyHeader?: string;
  delmalCodes?: string[];
  subject?: string;
  description?: string;
  clinic?: string;
  period?: { startISO?: string; endISO?: string };
  signer?: {
    role?: "HANDLEDARE" | "KURSLEDARE" | "SPECIALIST" | "CHEF";
    name?: string;
    speciality?: string;
    site?: string;
    personalNumber?: string;
    placeDateRaw?: string;
  };
  // För handledare/supervisor (kompatibilitet med gamla parsers)
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
};

// Parser-funktioner kan nu acceptera optional words-parameter för zonlogik
// eller zones-parameter för OpenCV-baserad zonparsning
// Vissa parsers returnerar olika typer (t.ex. ParsedKlinisk2015, ParsedKurs2021)
export type ParserFn = (text: string, words?: OcrWord[], zones?: Record<string, string>) => any;
