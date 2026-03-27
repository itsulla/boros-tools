const cache = new Map<string, { data: any; expiresAt: number; pending?: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

export async function cachedFetch(key: string, fetchFn: () => Promise<any>): Promise<any> {
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && entry.expiresAt > now && entry.data) return entry.data;
  if (entry?.pending) return entry.pending;

  const promise = fetchFn()
    .then((data) => {
      cache.set(key, { data, expiresAt: now + CACHE_TTL });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { data: null, expiresAt: 0, pending: promise });

  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return promise;
}
