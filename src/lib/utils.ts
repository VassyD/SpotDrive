import { CACHE_TTL } from "./constants";

// ─── Formatting ───────────────────────────────────────────────
export const fmt = (n: number): string => {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
};

export const timeAgo = (ts: string | null | undefined): string => {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

// ─── Image Optimisation ───────────────────────────────────────
/**
 * Adds width + quality + WebP format params to Unsplash URLs.
 * Returns Supabase Storage and other URLs unchanged.
 */
export const imgUrl = (url: string | null | undefined, w = 600): string | null => {
  if (!url) return null;
  if (url.includes("unsplash.com")) {
    const base = url.split("?")[0];
    return `${base}?w=${w}&q=75&fm=webp&fit=crop`;
  }
  return url;
};

// ─── Query Cache ──────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export const cachedFetch = async <T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> => {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const data = await fetcher();
  cache.set(key, { data, ts: Date.now() });
  return data;
};

export const invalidateCache = (key: string): void => {
  cache.delete(key);
};

export const clearCache = (): void => {
  cache.clear();
};

// ─── Validation ───────────────────────────────────────────────
export const isValidHandle = (handle: string): boolean =>
  /^[a-z0-9_]{3,20}$/i.test(handle);

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidPassword = (password: string): boolean =>
  password.length >= 6;
