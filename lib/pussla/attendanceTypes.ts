export function isLeaveType(type: string): boolean {
  return (
    type === "Tjänstledighet" ||
    type === "Föräldraledighet" ||
    type === "Annan ledighet" ||
    type === "Sjukskriven"
  );
}

export function isZeroAttendanceType(type: string): boolean {
  return type === "Forskning" || isLeaveType(type);
}

export function isPlacementZeroAttendance(placement: any): boolean {
  const t = String(placement?.type || "");
  return isZeroAttendanceType(t);
}
