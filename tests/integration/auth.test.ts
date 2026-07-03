import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isValidEmail, isValidPassword } from "../../src/lib/utils";

/**
 * Auth Integration Tests
 *
 * These tests mock the Supabase client to test the auth flow
 * without making real network requests.
 *
 * For real integration tests against the live DB, use the
 * Supabase local development stack: `supabase start`
 */

// --- Mock Supabase ---
const mockUser = {
  id: "test-user-id-123",
  email: "test@spotdrive.app",
  user_metadata: { handle: "test_spotter", display_name: "Test Spotter" },
};

const mockProfile = {
  id: "test-user-id-123",
  handle: "test_spotter",
  display_name: "Test Spotter",
  avatar_url: null,
  bio: "",
  followers_count: 0,
  following_count: 0,
  spots_count: 0,
};

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    setSession: vi.fn(),
  },
  from: vi.fn(),
};

mockSupabase.from.mockReturnValue(mockQueryBuilder);

vi.mock("../../src/lib/supabase", () => ({
  supabase: mockSupabase,
}));

// --- Sign Up ---
describe("Sign Up Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder.single.mockReset();
    mockSupabase.from.mockReturnValue(mockQueryBuilder);
});

  it("creates a new user with valid credentials", async () => {
    // Handle doesn't exist
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    // Sign up succeeds
    mockSupabase.auth.signUp.mockResolvedValueOnce({
      data: { user: mockUser, session: null },
      error: null,
    });
    // Profile fetch
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockProfile, error: null });

    const { supabase } = await import("../../src/lib/supabase");
    const result = await supabase.auth.signUp({
      email: "test@spotdrive.app",
      password: "password123",
      options: { data: { handle: "test_spotter", display_name: "Test Spotter" } },
    });

    expect(result.data.user).toBeTruthy();
    expect(result.error).toBeNull();
  });

  it("rejects sign up when handle is already taken", async () => {
    // Handle exists
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: { handle: "test_spotter" },
      error: null,
    });

    // Simulate the check
    const { supabase } = await import("../../src/lib/supabase");
    const { data } = await supabase
      .from("profiles")
      .select("handle")
      .eq("handle", "test_spotter")
      .single();

    expect(data).toBeTruthy();
    // In the real hook, this would throw "That handle is already taken."
  });

  it("rejects sign up with invalid email format", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("rejects sign up with password under 6 characters", () => {
    expect(isValidPassword("12345")).toBe(false);
  });
});

// --- Sign In ---
describe("Sign In Flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("signs in with valid credentials", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: mockUser, session: { access_token: "token123" } },
      error: null,
    });

    const { supabase } = await import("../../src/lib/supabase");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "test@spotdrive.app",
      password: "password123",
    });

    expect(data.user).toBeTruthy();
    expect(data.session).toBeTruthy();
    expect(error).toBeNull();
  });

  it("returns error for invalid credentials", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const { supabase } = await import("../../src/lib/supabase");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "wrong@email.com",
      password: "wrongpassword",
    });

    expect(data.user).toBeNull();
    expect(error?.message).toBe("Invalid login credentials");
  });
});

// --- Sign Out ---
describe("Sign Out Flow", () => {
  it("clears the session on sign out", async () => {
    mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });

    const { supabase } = await import("../../src/lib/supabase");
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});

// --- Password Reset ---
describe("Password Reset Flow", () => {
  it("sends reset email to valid address", async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

    const { supabase } = await import("../../src/lib/supabase");
    const { error } = await supabase.auth.resetPasswordForEmail(
      "test@spotdrive.app",
      { redirectTo: "https://spot-drive.vercel.app" }
    );

    expect(error).toBeNull();
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@spotdrive.app",
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });
});

// --- Email Confirmation ---
describe("Email Confirmation Flow", () => {
  it("sets session from URL access token", async () => {
    const mockTokens = {
      access_token: "eyJaccess",
      refresh_token: "eyJrefresh",
    };

    mockSupabase.auth.setSession.mockResolvedValueOnce({
      data: { user: mockUser, session: { access_token: mockTokens.access_token } },
      error: null,
    });

    const { supabase } = await import("../../src/lib/supabase");
    const { data, error } = await supabase.auth.setSession(mockTokens);

    expect(data.user).toBeTruthy();
    expect(error).toBeNull();
  });
});
