// ─── SpotDrive — Shared TypeScript Types ──────────────────────

export type Rarity = "Sports" | "Exotic" | "Hypercar";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  spots_count: number;
  is_private: boolean;
  show_location: boolean;
  allow_tagging: boolean;
  show_leaderboard: boolean;
  allow_messages: boolean;
  data_analytics: boolean;
  push_enabled: boolean;
  created_at: string;
}

export interface Spot {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  rarity: Rarity;
  color: string;
  location_name: string;
  description: string;
  image_url: string | null;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  report_count: number;
  status: "live" | "hidden" | "deleted";
  created_at: string;
  // Joined fields
  profiles?: Pick<Profile, "handle" | "avatar_url">;
}

export interface SpotDisplay extends Spot {
  image: string | null;
  location: string;
  likes: number;
  saves: number;
  comments: number;
  time: string;
  tags: string[];
  liked: boolean;
  saved: boolean;
  user: {
    handle: string;
    avatar_url: string | null;
    initials: string;
    verified?: boolean;
  };
}

export interface Comment {
  id: string;
  spot_id: string;
  user_id: string;
  text: string;
  likes_count: number;
  created_at: string;
  // Display fields
  handle?: string;
  avatar_url?: string | null;
  initials?: string;
  optimistic?: boolean;
}

export interface Story {
  id: string;
  handle: string;
  initials: string;
  avatar_url?: string | null;
  image: string | null;
  make: string;
  model: string;
  rarity: Rarity;
  location: string;
  viewed: boolean;
  expiresAt: number;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: "like" | "follow" | "comment" | "save" | "mention";
  read: boolean;
  created_at: string;
  actor_handle: string;
  actor_initials: string;
  actor_avatar?: string | null;
  text: string;
  spot_make?: string | null;
  spot_model?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  display_name: string;
  spots: number;
  followers: number;
  score: number;
  streak: number;
  badge: string;
  initials: string;
  avatar_url?: string | null;
  city?: string;
  rarity?: Rarity;
}

export interface AuthContextValue {
  user: import("@supabase/supabase-js").User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<import("@supabase/supabase-js").AuthResponse["data"]>;
  signIn: (params: SignInParams) => Promise<import("@supabase/supabase-js").AuthResponse["data"]>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
}

export interface SignUpParams {
  email: string;
  password: string;
  handle: string;
  displayName: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface PrivacySettings {
  privateAccount: boolean;
  showLocation: boolean;
  allowTagging: boolean;
  showOnLeaderboard: boolean;
  allowMessages: boolean;
  dataAnalytics: boolean;
}

export interface NotificationSettings {
  muteAll: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  saves: boolean;
  mentions: boolean;
  weeklyDigest: boolean;
  newSpotNearby: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  muteUntil: string | null;
}

export type NavKey = "feed" | "explore" | "leaderboard" | "profile";

export interface UploadForm {
  make: string;
  model: string;
  year: string;
  rarity: Rarity;
  location: string;
  desc: string;
}
