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
export const cacheGet = (key) => {
    return cache.get(key);
};
export const cacheSet = (key, value, ttlSeconds) => {
    if (ttlSeconds !== undefined) {
        cache.set(key, value, ttlSeconds);
    }
    else {
        cache.set(key, value);
    }
};
export const cacheDel = (...keys) => {
    cache.del(keys);
};
export const cacheDelPrefix = (prefix) => {
    const keys = cache.keys();
    const keysToDelete = keys.filter((k) => k.startsWith(prefix));
    if (keysToDelete.length > 0) {
        cache.del(keysToDelete);
    }
};
export const cacheFlushAll = () => {
    cache.flushAll();
};
// ──────────────────────────────────────────────
// Cache key factory — ensures tenant isolation
// ──────────────────────────────────────────────
export const CacheKeys = {
    branches: (ownerId) => `branches:${ownerId}`,
    plans: (ownerId) => `plans:${ownerId}`,
    dashboardStats: (ownerId, branchId) => `dashboard:${ownerId}:${branchId || 'all'}`,
    membersList: (ownerId, branchId) => `members:${ownerId}:${branchId || 'all'}`,
};
