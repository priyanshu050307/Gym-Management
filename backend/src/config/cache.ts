import NodeCache from 'node-cache';

// stdTTL: default TTL in seconds
// checkperiod: how often (in seconds) to check for expired keys
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 30,
  useClones: false,
});

export default cache;

// ──────────────────────────────────────────────
// Typed cache helpers
// ──────────────────────────────────────────────

export const cacheGet = <T>(key: string): T | undefined => {
  return cache.get<T>(key);
};

export const cacheSet = <T>(key: string, value: T, ttlSeconds?: number): void => {
  if (ttlSeconds !== undefined) {
    cache.set(key, value, ttlSeconds);
  } else {
    cache.set(key, value);
  }
};

export const cacheDel = (...keys: string[]): void => {
  cache.del(keys);
};

export const cacheDelPrefix = (prefix: string): void => {
  const keys = cache.keys();
  const keysToDelete = keys.filter((k) => k.startsWith(prefix));
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }
};

export const cacheFlushAll = (): void => {
  cache.flushAll();
};

// ──────────────────────────────────────────────
// Cache key factory — ensures tenant isolation
// ──────────────────────────────────────────────

export const CacheKeys = {
  branches: (ownerId: string) => `branches:${ownerId}`,
  plans: (ownerId: string) => `plans:${ownerId}`,
  dashboardStats: (ownerId: string, branchId?: string | null) =>
    `dashboard:${ownerId}:${branchId || 'all'}`,
  membersList: (ownerId: string, branchId?: string | null) =>
    `members:${ownerId}:${branchId || 'all'}`,
};
