import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAtomicUnitSql,
  parseDatabaseUrl,
  validateEnvironmentSnapshot,
  validateReplayManifest,
} from "./rc05-native-replay.mjs";
import { buildManifest } from "./rc04-disposable-replay.mjs";

test("normalizes per-file transport transactions into one atomic replay unit", () => {
  const result = buildAtomicUnitSql(["begin;\nselect 1;\ncommit;", "BEGIN;\nselect 2;\nCOMMIT;\n"]);
  assert.equal((result.sql.match(/\bbegin;/gi) ?? []).length, 1);
  assert.equal((result.sql.match(/\bcommit;/gi) ?? []).length, 1);
  assert.match(result.sql, /select 1;[\s\S]*select 2;/);
  assert.deepEqual(result.transportTransactionsRemoved, [0, 1]);
});

test("keeps database passwords out of psql arguments", () => {
  const parsed = parseDatabaseUrl("postgresql://postgres:secret-value@127.0.0.1:54322/postgres?sslmode=disable");
  assert.equal(parsed.args.includes("secret-value"), false);
  assert.equal(parsed.args.some((arg) => arg.includes("postgresql://")), false);
  assert.equal(parsed.env.PGPASSWORD, "secret-value");
  assert.equal(parsed.env.PGSSLMODE, "disable");
});

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

test("rejects an arbitrary 207-unit manifest even when its shape is valid", () => {
  const manifest = Array.from({ length: 207 }, (_, index) => ({
    version: String(index).padStart(14, "0"),
    hosted_version: String(index).padStart(14, "0"),
    files: [`supabase/migrations/${index}.sql`],
  }));
  assert.throws(() => validateReplayManifest(manifest), /manifest SHA-256/);
});

test("accepts only the fully pinned audited 207-unit manifest", () => {
  assert.deepEqual(validateReplayManifest(buildManifest()), {
    unitCount: 207,
    manifestSha256: "d878034e22480b9c2068ff2702a2be719956e5df30eea1a74685ba9e6dccd8db",
  });
});
