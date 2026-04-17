export function phaseForCourseDatesCore(
  btISO: string | null,
  btEndISO: string | null,
  startISO: string | undefined,
  isValidISO: (iso: string) => boolean
): "BT" | "ST" {
  if (!startISO || !isValidISO(startISO)) return "ST";
  if (!btEndISO || !isValidISO(btEndISO)) return "ST";
  if (!btISO || !isValidISO(btISO)) return "ST";
  return startISO > btEndISO ? "ST" : "BT";
}
