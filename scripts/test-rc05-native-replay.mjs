import assert from "node:assert/strict";
import test from "node:test";

import {
  validateEnvironmentSnapshot,
  validateReplayManifest,
} from "./rc05-native-replay.mjs";

test("rejects an approximate PostgreSQL engine even when Supabase schemas exist", () => {
  assert.throws(
    () => validateEnvironmentSnapshot({
      serverVersion: "18.3",
      schemas: ["auth", "storage", "cron"],
      extensions: ["pg_cron", "pg_trgm", "pgcrypto"],
    }),
    /PostgreSQL 17\.x is required/,
  );
});

test("requires native Auth, Storage, and Cron instead of replay shims", () => {
  assert.throws(
    () => validateEnvironmentSnapshot({
      serverVersion: "17.11",
      schemas: ["auth", "storage", "cron"],
      installedExtensions: ["pg_trgm", "pgcrypto"],
      availableExtensions: ["pg_cron", "pg_trgm", "pgcrypto"],
    }, { phase: "postflight" }),
    /pg_cron/,
  );
});

test("accepts a clean native preflight when canonical migrations still need to install Cron and Trigram", () => {
  assert.deepEqual(validateEnvironmentSnapshot({
    serverVersion: "17.11",
    schemas: ["auth", "storage"],
    installedExtensions: ["pgcrypto"],
    availableExtensions: ["pg_cron", "pg_trgm", "pgcrypto"],
  }, { phase: "preflight" }), {
    postgresMajor: 17,
    nativeAuth: true,
    nativeStorage: true,
    nativeCron: false,
  });
});

test("accepts the exact native RC-05 platform contract", () => {
  assert.deepEqual(validateEnvironmentSnapshot({
    serverVersion: "17.11 (Ubuntu 17.11-1.pgdg24.04+1)",
    schemas: ["auth", "storage", "cron"],
    installedExtensions: ["pg_cron", "pg_trgm", "pgcrypto"],
    availableExtensions: ["pg_cron", "pg_trgm", "pgcrypto"],
  }, { phase: "postflight" }), {
    postgresMajor: 17,
    nativeAuth: true,
    nativeStorage: true,
    nativeCron: true,
  });
});

test("keeps corrective review_ready outside the canonical baseline replay", () => {
  assert.throws(
    () => validateReplayManifest([
      { version: "20261014202700", files: ["supabase/migrations/20261014202700_review_ready_notifications_forward.sql"] },
    ]),
    /corrective review_ready migration must not be part of the baseline/,
  );
});

test("accepts the audited 207-unit baseline manifest", () => {
  const manifest = Array.from({ length: 207 }, (_, index) => ({
    version: String(index).padStart(14, "0"),
    files: [`supabase/migrations/${index}.sql`],
  }));
  assert.equal(validateReplayManifest(manifest).unitCount, 207);
});
