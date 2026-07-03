import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { AuthContextValue, Profile, SignUpParams, SignInParams } from "../types";

// ─── Context ──────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("fetchProfile error:", error.message);
      return null;
    }
    setProfile(data as Profile);
    return data as Profile;
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async ({ email, password, handle, displayName }: SignUpParams) => {
    // Check handle uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("handle")
      .eq("handle", handle.toLowerCase())
      .single();

    if (existing) throw new Error("That handle is already taken.");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          handle:       handle.toLowerCase(),
          display_name: displayName,
        },
      },
    });

    if (error) throw error;

    // Profile created by DB trigger — wait briefly then fetch
    if (data.user) {
      await new Promise(r => setTimeout(r, 1500));
      await fetchProfile(data.user.id);
    }

    return data;
  }, [fetchProfile]);

  const signIn = useCallback(async ({ email, password }: SignInParams) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut, resetPassword, fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
