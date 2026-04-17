export function triggerTimedFlag(
  setFlag: (value: boolean) => void,
  durationMs = 1500
): void {
  setFlag(true);
  setTimeout(() => setFlag(false), durationMs);
}
