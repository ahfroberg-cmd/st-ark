type RoundToAnchorsDeps = {
  isValidISO: (iso: string) => boolean;
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  sundayBeforeAnchor: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function roundToAnchorsWithDeps(
  iso: string,
  which: "start" | "end",
  deps: RoundToAnchorsDeps
) {
  const { isValidISO, mondayNearestTo, sundayBeforeAnchor, dateToISO } = deps;
  if (!isValidISO(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  const originalYear = d.getFullYear();
  let y = d.getFullYear();
  let m0 = d.getMonth();
  const day = d.getDate();

  let anchorDay = 1;
  if (day <= 7) anchorDay = 1;
  else if (day <= 22) anchorDay = 15;
  else {
    m0 += 1;
    if (m0 >= 12) {
      m0 = 0;
      y += 1;
    }
    anchorDay = 1;
  }

  if (which === "start") {
    const md = mondayNearestTo(y, m0, anchorDay);
    if (md.getFullYear() < originalYear) return iso;
    return dateToISO(md);
  }

  const sd = sundayBeforeAnchor(y, m0, anchorDay);
  if (sd.getFullYear() < originalYear) return iso;
  return dateToISO(sd);
}
