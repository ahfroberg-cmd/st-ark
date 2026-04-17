const EMAIL_RX =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** ISO-datum (YYYY-MM-DD) får inte tolkas som telefon — samma mönster träffades av PHONE_RX. */
const ISO_DATE_ONLY_RX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RX =
  /(?<!\d)(?:\+?\d[\d\s\-()]{6,}\d)(?!\d)/g;
const SWEDISH_PNR_RX =
  /\b(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-+]?\d{4}\b/g;
const ADDRESS_HINT_RX =
  /\b(?:gatan|vägen|vagen|gränd|grand|allé|alle|road|street)\b/i;

export type RedactOptions = {
  redactAddressLikeLines?: boolean;
};

export function redactContactInfoText(
  input: string,
  options?: RedactOptions
): string {
  const raw = String(input ?? "");
  if (!raw) return raw;

  let out = raw
    .replace(EMAIL_RX, "[kontaktuppgift-redigerad]")
    .replace(PHONE_RX, (m) => {
      const compact = m.replace(/\s/g, "");
      if (ISO_DATE_ONLY_RX.test(compact)) return m;
      const digits = m.replace(/\D/g, "");
      if (digits.length < 7) return m;
      return "[kontaktuppgift-redigerad]";
    })
    .replace(SWEDISH_PNR_RX, "[kontaktuppgift-redigerad]");

  if (options?.redactAddressLikeLines) {
    out = out
      .split("\n")
      .map((line) => {
        const lower = line.toLowerCase();
        const keyHit =
          lower.includes("adress") ||
          lower.includes("postnummer") ||
          lower.includes("postnr") ||
          lower.includes("city") ||
          lower.includes("stad");
        if (!keyHit && !ADDRESS_HINT_RX.test(lower)) return line;
        return line.replace(/:.*/, ": [kontaktuppgift-redigerad]");
      })
      .join("\n");
  }

  return out;
}

