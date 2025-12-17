//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Konstanter för filstorlekar (i bytes)
export const MAX_JSON_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Tillåtna filtyper för OCR
export const ALLOWED_OCR_FILE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const ALLOWED_OCR_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

/**
 * Validerar JSON-fil innan import
 */
export function validateJsonFile(file: File): { valid: boolean; error?: string } {
  // Kontrollera filstorlek
  if (file.size > MAX_JSON_FILE_SIZE) {
    return {
      valid: false,
      error: `Filen är för stor. Maximal storlek är ${MAX_JSON_FILE_SIZE / 1024 / 1024} MB.`,
    };
  }

  // Kontrollera filtyp
  if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
    return {
      valid: false,
      error: "Endast JSON-filer är tillåtna.",
    };
  }

  return { valid: true };
}

/**
 * Validerar JSON-struktur efter parsing
 */
export function validateJsonStructure(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      error: "Ogiltig JSON-struktur. Filen måste innehålla ett JSON-objekt.",
    };
  }

  // Kontrollera att det finns minst en känd nyckel
  const knownKeys = ["profile", "Profile", "prof", "placements", "Placements", "courses", "Courses", "achievements", "Achievements"];
  const hasKnownKey = knownKeys.some((key) => key in data);

  if (!hasKnownKey && Object.keys(data).length > 0) {
    // Varning men inte fel - kan vara en ny struktur
    console.warn("JSON-filen innehåller okända nycklar");
  }

  return { valid: true };
}

/**
 * Säker JSON-parsing med validering
 */
export function safeJsonParse(text: string): { success: boolean; data?: any; error?: string } {
  try {
    // Kontrollera att texten inte är för lång
    if (text.length > MAX_JSON_FILE_SIZE) {
      return {
        success: false,
        error: "JSON-filen är för stor.",
      };
    }

    const data = JSON.parse(text);
    const validation = validateJsonStructure(data);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || "Ogiltig JSON-struktur.",
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kunde inte tolka JSON-filen.",
    };
  }
}

/**
 * Validerar OCR-fil innan uppladdning
 */
export function validateOcrFile(file: File): { valid: boolean; error?: string } {
  // Kontrollera filstorlek
  if (file.size > MAX_OCR_FILE_SIZE) {
    return {
      valid: false,
      error: `Filen är för stor. Maximal storlek är ${MAX_OCR_FILE_SIZE / 1024 / 1024} MB.`,
    };
  }

  // Kontrollera filtyp
  const isValidType = ALLOWED_OCR_FILE_TYPES.includes(file.type);
  const isValidExtension = ALLOWED_OCR_FILE_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!isValidType && !isValidExtension) {
    return {
      valid: false,
      error: `Ogiltig filtyp. Tillåtna format: ${ALLOWED_OCR_FILE_EXTENSIONS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Saniterar sträng för säker lagring (tar bort potentiellt farliga tecken)
 */
export function sanitizeString(input: string | null | undefined, maxLength = 10000): string {
  if (!input) return "";
  const str = String(input);
  // Ta bort null-bytes och begränsa längd
  return str
    .replace(/\0/g, "")
    .slice(0, maxLength)
    .trim();
}

/**
 * Validerar e-postadress
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validerar att ett värde är en array
 */
export function validateArray(value: any): value is any[] {
  return Array.isArray(value);
}
