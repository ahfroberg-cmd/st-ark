const CACHE_TTL_MS = 5000;

type CacheEntry = {
  expiresAt: number;
  data: any;
};

const repoCache = new Map<string, CacheEntry>();

export function getCacheKey(table: string, userId: string): string {
  return `${table}:${userId}`;
}

export function readCache(key: string): any | null {
  const hit = repoCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    repoCache.delete(key);
    return null;
  }
  return hit.data;
}

export function writeCache(key: string, data: any) {
  repoCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCache(table: string, userId: string) {
  repoCache.delete(getCacheKey(table, userId));
}
