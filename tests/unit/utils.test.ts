import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fmt, timeAgo, imgUrl, isValidHandle, isValidEmail, isValidPassword, cachedFetch, invalidateCache } from "../../src/lib/utils";

// ─── fmt ──────────────────────────────────────────────────────
describe("fmt", () => {
  it("formats numbers under 1000 as-is", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(42)).toBe("42");
    expect(fmt(999)).toBe("999");
  });

  it("formats 1000+ as k with 1 decimal", () => {
    expect(fmt(1000)).toBe("1.0k");
    expect(fmt(1500)).toBe("1.5k");
    expect(fmt(9441)).toBe("9.4k");
    expect(fmt(10000)).toBe("10.0k");
  });

  it("handles non-numbers gracefully", () => {
    expect(fmt(NaN)).toBe("0");
  });
});

// ─── timeAgo ──────────────────────────────────────────────────
describe("timeAgo", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns "just now" for < 1 minute', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago for < 1 hour", () => {
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000));
    const ts = new Date(Date.now() - 5 * 60_000).toISOString();
    vi.useRealTimers();
    const result = timeAgo(new Date(Date.now() - 5 * 60_000).toISOString());
    expect(result).toMatch(/m ago/);
  });

  it("returns hours ago for < 1 day", () => {
    const ts = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(timeAgo(ts)).toBe("2h ago");
  });

  it("returns days ago for >= 1 day", () => {
    const ts = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(timeAgo(ts)).toBe("3d ago");
  });

  it("returns empty string for null/undefined", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
  });
});

// ─── imgUrl ───────────────────────────────────────────────────
describe("imgUrl", () => {
  it("adds WebP params to Unsplash URLs", () => {
    const url = "https://images.unsplash.com/photo-123";
    const result = imgUrl(url, 600);
    expect(result).toBe("https://images.unsplash.com/photo-123?w=600&q=75&fm=webp&fit=crop");
  });

  it("strips existing query params from Unsplash URLs", () => {
    const url = "https://images.unsplash.com/photo-123?w=900&q=85";
    const result = imgUrl(url, 400);
    expect(result).toContain("w=400");
    expect(result).not.toContain("w=900");
  });

  it("returns Supabase Storage URLs unchanged", () => {
    const url = "https://lhahofbryglxdxffxjbr.supabase.co/storage/v1/object/public/spot-photos/img.jpg";
    expect(imgUrl(url)).toBe(url);
  });

  it("returns null for null/undefined input", () => {
    expect(imgUrl(null)).toBeNull();
    expect(imgUrl(undefined)).toBeNull();
  });

  it("uses 600px as default width", () => {
    const url = "https://images.unsplash.com/photo-123";
    expect(imgUrl(url)).toContain("w=600");
  });
});

// ─── Validation ───────────────────────────────────────────────
describe("isValidHandle", () => {
  it("accepts valid handles", () => {
    expect(isValidHandle("apex_hunter")).toBe(true);
    expect(isValidHandle("JDM123")).toBe(true);
    expect(isValidHandle("abc")).toBe(true);
  });

  it("rejects handles with special chars", () => {
    expect(isValidHandle("apex.hunter")).toBe(false);
    expect(isValidHandle("apex-hunter")).toBe(false);
    expect(isValidHandle("apex hunter")).toBe(false);
    expect(isValidHandle("apex@hunter")).toBe(false);
  });

  it("rejects handles that are too short", () => {
    expect(isValidHandle("ab")).toBe(false);
  });

  it("rejects handles that are too long", () => {
    expect(isValidHandle("a".repeat(21))).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user+tag@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts passwords 6+ chars", () => {
    expect(isValidPassword("123456")).toBe(true);
    expect(isValidPassword("securepass123")).toBe(true);
  });

  it("rejects passwords under 6 chars", () => {
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("")).toBe(false);
  });
});

// ─── Cache ────────────────────────────────────────────────────
describe("cachedFetch", () => {
  afterEach(() => invalidateCache("test-key"));

  it("calls fetcher on first call", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
    const result = await cachedFetch("test-key", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: "fresh" });
  });

  it("returns cached result on second call", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
    await cachedFetch("test-key", fetcher);
    await cachedFetch("test-key", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after cache invalidation", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
    await cachedFetch("test-key", fetcher);
    invalidateCache("test-key");
    await cachedFetch("test-key", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
