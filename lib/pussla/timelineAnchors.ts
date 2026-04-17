export function mondayOnOrAfter(year: number, month0: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month0) || !Number.isFinite(day)) {
    return new Date();
  }
  const d = new Date(year, month0, day);
  let iterations = 0;
  while (d.getMonth() === month0 && d.getDay() !== 1 && iterations < 10) {
    d.setDate(d.getDate() + 1);
    iterations++;
  }
  if (d.getMonth() !== month0) return new Date(year, month0, 1);
  return d;
}

export function mondayNearestTo(year: number, month0: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month0) || !Number.isFinite(day)) {
    return new Date();
  }
  const target = new Date(year, month0, day);
  const w = target.getDay();
  const back = -((w - 1 + 7) % 7);
  const forward = (1 - w + 7) % 7;
  const use = Math.abs(back) <= Math.abs(forward) ? back : forward;
  const res = new Date(target);
  res.setDate(res.getDate() + use);
  return res;
}

export function sundayBeforeAnchor(year: number, month0: number, day: number) {
  const nextStart = mondayNearestTo(year, month0, day);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return end;
}

export function sundayNearestTo(year: number, month0: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month0) || !Number.isFinite(day)) {
    return new Date();
  }
  const target = new Date(year, month0, day);
  const w = target.getDay();
  const back = -w;
  const forward = (7 - w) % 7;
  const use = Math.abs(back) <= Math.abs(forward) ? back : forward;
  const res = new Date(target);
  res.setDate(res.getDate() + use);
  return res;
}

export function sundayOnOrBefore(year: number, month0: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month0) || !Number.isFinite(day)) {
    return new Date();
  }
  const target = new Date(year, month0, day);
  const after = new Date(target);
  let iterA = 0;
  while (after.getMonth() === month0 && after.getDay() !== 0 && iterA < 10) {
    after.setDate(after.getDate() + 1);
    iterA++;
  }
  const candA = after.getMonth() === month0 && after.getDay() === 0 ? new Date(after) : null;

  const before = new Date(target);
  let iterB = 0;
  while (before.getMonth() === month0 && before.getDay() !== 0 && iterB < 10) {
    before.setDate(before.getDate() - 1);
    iterB++;
  }
  const candB = before.getMonth() === month0 && before.getDay() === 0 ? new Date(before) : null;

  if (candA && candB) {
    return Math.abs(+candA - +target) <= Math.abs(+candB - +target) ? candA : candB;
  }
  return candA || candB || new Date(year, month0 + 1, 0);
}
