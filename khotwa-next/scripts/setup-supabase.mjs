/**
 * Supabase Setup Script
 *
 * This script initialises the required Supabase resources:
 *   1. `cv_uploads` storage bucket (public, with anonymous-upload policy)
 *   2. `registrations` database table (if it does not already exist)
 *
 * Run once before the first deployment, or in CI via:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/setup-supabase.mjs
 *
 * Required environment variables (can also be placed in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL          – project URL
 *   SUPABASE_SERVICE_ROLE_KEY         – service-role secret key (never expose this client-side)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Load .env.local (best-effort; CI should inject variables directly)
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://teuhmjohpbxjqmenwrzs.supabase.co";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌  SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
      "    Set it in your .env.local file or as an environment variable before running this script."
  );
  process.exit(1);
}

const BUCKET_NAME = "cv-uploads";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// 1. Create storage bucket
// ---------------------------------------------------------------------------
async function ensureBucket() {
  console.log(`\n📦  Ensuring storage bucket "${BUCKET_NAME}" exists…`);

  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("    ❌  Could not list buckets:", listErr.message);
    throw listErr;
  }

  if (existing.some((b) => b.name === BUCKET_NAME)) {
    console.log(`    ✅  Bucket "${BUCKET_NAME}" already exists.`);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    fileSizeLimit: 1024 * 1024 * 10, // 10 MB
  });

  if (createErr) {
    console.error("    ❌  Failed to create bucket:", createErr.message);
    throw createErr;
  }

  console.log(`    ✅  Bucket "${BUCKET_NAME}" created.`);
}

// ---------------------------------------------------------------------------
// 2. Set RLS policy – allow anonymous uploads
// ---------------------------------------------------------------------------
async function ensureStoragePolicy() {
  console.log(`\n🔐  Setting up storage RLS policy for anonymous uploads…`);

  // BUCKET_NAME is a hardcoded constant (not user input), so embedding it
  // directly in the SQL string is safe here.  This setup script is intended
  // to be run by administrators only – never by end-users.
  const sql = `
    DO $$
    BEGIN
      -- Allow anyone to upload to cv_uploads
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'allow_anon_uploads_cv_uploads'
      ) THEN
        CREATE POLICY "allow_anon_uploads_cv_uploads"
          ON storage.objects
          FOR INSERT
          TO anon
          WITH CHECK (bucket_id = 'cv_uploads');
      END IF;

      -- Allow anyone to read from cv_uploads (needed for public URL)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'allow_public_read_cv_uploads'
      ) THEN
        CREATE POLICY "allow_public_read_cv_uploads"
          ON storage.objects
          FOR SELECT
          TO public
          USING (bucket_id = 'cv_uploads');
      END IF;
    END$$;
  `;

  const { error } = await supabase.rpc("exec_sql", { sql }).catch((err) => ({
    error: err,
  }));

  // The exec_sql RPC may not exist; fall back to direct query via REST
  if (error) {
    console.warn(
      "    ⚠️   exec_sql RPC not available – skipping automatic policy creation.\n" +
        "        Please add the following RLS policies manually in the Supabase dashboard:\n\n" +
        `        Table: storage.objects\n` +
        `        Policy 1 (INSERT, anon): bucket_id = '${BUCKET_NAME}'\n` +
        `        Policy 2 (SELECT, public): bucket_id = '${BUCKET_NAME}'\n`
    );
  } else {
    console.log("    ✅  Storage RLS policies are in place.");
  }
}

// ---------------------------------------------------------------------------
// 3. Create registrations table
// ---------------------------------------------------------------------------
async function ensureRegistrationsTable() {
  console.log("\n🗄️   Ensuring `registrations` table exists…");

  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS public.registrations (
        id         BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        name_ar    TEXT        NOT NULL,
        name_en    TEXT        NOT NULL,
        uni_id     TEXT        NOT NULL,
        gender     TEXT        NOT NULL,
        birthdate  DATE        NOT NULL,
        major      TEXT        NOT NULL,
        cv_url     TEXT
      );

      -- Allow anonymous inserts
      ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename  = 'registrations'
            AND policyname = 'allow_anon_insert'
        ) THEN
          CREATE POLICY "allow_anon_insert"
            ON public.registrations
            FOR INSERT
            TO anon
            WITH CHECK (true);
        END IF;
      END$$;
    `,
  }).catch((err) => ({ error: err }));

  if (error) {
    console.warn(
      "    ⚠️   exec_sql RPC not available – skipping automatic table creation.\n" +
        "        Please create the `registrations` table manually (see README for schema)."
    );
  } else {
    console.log("    ✅  `registrations` table is ready.");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log("🚀  Khotwa – Supabase Setup\n");
  console.log(`    Project URL : ${SUPABASE_URL}`);

  try {
    await ensureBucket();
    await ensureStoragePolicy();
    await ensureRegistrationsTable();
    console.log("\n✅  Setup complete!\n");
  } catch (err) {
    console.error("\n❌  Setup failed:", err.message ?? err);
    process.exit(1);
  }
})();
