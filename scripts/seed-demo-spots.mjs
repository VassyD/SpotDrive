// One-time script: seeds real demo spots into the database, replacing the
// client-side MOCK_SPOTS fallback with actual rows so every feature
// (report, like, save, comment) works correctly against them.
//
// Run once against production:
//   node scripts/seed-demo-spots.mjs
//
// Requires env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role, bypasses RLS)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_USERS = [
  { handle: "apex_hunter", display_name: "Apex Hunter", email: "demo.apex_hunter@spotdrive.app" },
  { handle: "euro_spotter", display_name: "Euro Spotter", email: "demo.euro_spotter@spotdrive.app" },
  { handle: "jdm_tokyo", display_name: "JDM Tokyo", email: "demo.jdm_tokyo@spotdrive.app" },
];

const DEMO_SPOTS = [
  {
    handle: "apex_hunter",
    make: "Lamborghini",
    model: "Huracán STO",
    year: 2023,
    rarity: "Exotic",
    color: "Verde Mantis",
    location_name: "Rodeo Drive, Beverly Hills",
    image_url: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=75&fm=webp",
    description: "Caught this STO parked outside Gucci. Verde Mantis in person is something else.",
    likes_count: 2841,
    comments_count: 94,
    saves_count: 312,
  },
  {
    handle: "euro_spotter",
    make: "Ferrari",
    model: "SF90 Stradale",
    year: 2022,
    rarity: "Hypercar",
    color: "Rosso Corsa",
    location_name: "Monaco, Monte Carlo",
    image_url: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&q=75&fm=webp",
    description: "SF90 rolling out of Casino Square. Rosso Corsa with Assetto Fiorano pack.",
    likes_count: 5102,
    comments_count: 218,
    saves_count: 891,
  },
  {
    handle: "jdm_tokyo",
    make: "Bugatti",
    model: "Chiron Super Sport",
    year: 2023,
    rarity: "Hypercar",
    color: "Atlantic Blue",
    location_name: "Shibuya, Tokyo",
    image_url: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=600&q=75&fm=webp",
    description: "Never thought I'd see a Chiron SS in Shibuya. The W16 sound was insane.",
    likes_count: 9441,
    comments_count: 507,
    saves_count: 2103,
  },
];

async function main() {
  const userIdByHandle = {};

  for (const u of DEMO_USERS) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("handle", u.handle)
      .maybeSingle();

    if (existingProfile) {
      console.log(`✓ Demo user "${u.handle}" already exists, reusing.`);
      userIdByHandle[u.handle] = existingProfile.id;
      continue;
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        handle: u.handle,
        display_name: u.display_name,
      },
    });
    if (createErr || !created.user) {
      console.error(`Failed to create demo user ${u.handle}:`, createErr?.message);
      process.exit(1);
    }

    // A database trigger (handle_new_user) automatically creates the
    // matching profiles row from the metadata above — no separate insert needed.

    console.log(`✓ Created demo user "${u.handle}"`);
    userIdByHandle[u.handle] = created.user.id;
  }

  for (const spot of DEMO_SPOTS) {
    const { handle, ...spotData } = spot;
    const user_id = userIdByHandle[handle];

    const { data: existing } = await admin
      .from("spots")
      .select("id")
      .eq("user_id", user_id)
      .eq("make", spotData.make)
      .eq("model", spotData.model)
      .maybeSingle();

    if (existing) {
      console.log(`✓ Demo spot "${spotData.make} ${spotData.model}" already exists, skipping.`);
      continue;
    }

    const { error } = await admin.from("spots").insert({
      ...spotData,
      user_id,
      status: "live",
    });
    if (error) {
      console.error(`Failed to insert spot ${spotData.make} ${spotData.model}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ Seeded spot: ${spotData.make} ${spotData.model}`);
  }

  console.log("\nDone. Real demo spots are now live in the database.");
}

main();