const isDev = process.env.NODE_ENV !== "production";

type PerfMeta = Record<string, unknown>;

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

export function perfMark(name: string): number {
  if (!isDev) return 0;
  return now();
}

export function perfMeasure(name: string, start: number, meta?: PerfMeta): number {
  if (!isDev || !start) return 0;
  const duration = now() - start;
  const payload = { name, durationMs: duration, ...(meta || {}) };
  if (typeof console !== "undefined") {
    console.info(`[perf] ${name}: ${formatMs(duration)}`, payload);
  }
  if (typeof window !== "undefined") {
    const w = window as unknown as { __starkPerfLog?: Array<Record<string, unknown>> };
    w.__starkPerfLog = w.__starkPerfLog || [];
    w.__starkPerfLog.push(payload);
  }
  return duration;
}

export async function perfMeasureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: PerfMeta
): Promise<T> {
  const start = perfMark(name);
  try {
    return await fn();
  } finally {
    perfMeasure(name, start, meta);
  }
}
