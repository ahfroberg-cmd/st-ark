// lib/intygParsers/types.ts
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
};
