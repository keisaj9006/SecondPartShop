import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const targetFunctions = [
  "marketplace_catalogue_cursor_page_v1",
  "marketplace_catalogue_distance_page_v2",
];
const rawSource = "public.verified_fit_feedback";
const canonicalSource = "private.valid_verified_fit_feedback";

function replacementTargets(sql) {
  const loops = [...sql.matchAll(/for\s+fn\s+in\b([\s\S]*?)\bloop\b/gi)];
  assert.equal(loops.length, 1, "guard must have exactly one function replacement loop");
  const list = loops[0][1].match(/p\.proname\s+in\s*\(([^)]*)\)/i);
  assert.ok(list, "replacement loop must enumerate its function targets");
  const targets = [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(targets.toSorted(), targetFunctions.toSorted(), "replacement loop must target both catalogue RPCs exactly once");
  return targets;
}

function readMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationsDir, name), "utf8") }));
}

function latestFunctionDefinitions(migrations) {
  const definitions = new Map();

  for (const migration of migrations) {
    for (const functionName of targetFunctions) {
      const startPattern = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`,
        "ig",
      );
      let match;
      while ((match = startPattern.exec(migration.sql)) !== null) {
        const end = migration.sql.indexOf("$$;", match.index);
        assert.notEqual(end, -1, `${migration.name}: unterminated definition for ${functionName}`);
        definitions.set(functionName, migration.sql.slice(match.index, end + 3));
        startPattern.lastIndex = end + 3;
      }
    }

    if (/^\d+_guard_catalogue_verified_fit_evidence\.sql$/.test(migration.name)) {
      for (const functionName of replacementTargets(migration.sql)) {
        const definition = definitions.get(functionName);
        assert.ok(definition, `${migration.name}: missing ${functionName} before guarded replacement`);
        assert.ok(
          definition.includes(rawSource),
          `${migration.name}: ${functionName} does not contain the asserted raw source`,
        );
        definitions.set(functionName, definition.replaceAll(rawSource, canonicalSource));
      }
    }
  }

  return definitions;
}

test("latest catalogue RPC definitions use only transaction-backed Verified Fit evidence", () => {
  const migrations = readMigrations();
  const guardMigrations = migrations.filter(({ name }) =>
    /^\d+_guard_catalogue_verified_fit_evidence\.sql$/.test(name),
  );

  assert.equal(guardMigrations.length, 1, "expected exactly one generated Verified Fit catalogue guard migration");

  const guard = guardMigrations[0].sql;
  replacementTargets(guard);
  for (const functionName of targetFunctions) {
    assert.match(guard, new RegExp(`'${functionName}'`), `guard must enumerate ${functionName}`);
  }
  assert.match(guard, /if\s+function_count\s*<>\s*2\s+or\s+target_count\s*<>\s*2\s+then/i, "guard must require exactly two distinct target functions");
  assert.match(guard, /position\('public\.verified_fit_feedback'\s+in\s+definition\)\s*=\s*0/i, "guard must fail when the raw source assertion is missing");
  assert.match(guard, /execute\s+replace\(\s*definition\s*,\s*'public\.verified_fit_feedback'\s*,\s*'private\.valid_verified_fit_feedback'\s*\)/i, "guard must replace the raw source with the canonical private view");

  const definitions = latestFunctionDefinitions(migrations);
  assert.deepEqual([...definitions.keys()].sort(), [...targetFunctions].sort(), "latest migration history must define both catalogue RPCs");

  for (const functionName of targetFunctions) {
    const definition = definitions.get(functionName);
    assert.ok(definition.includes(canonicalSource), `${functionName} must use ${canonicalSource}`);
    assert.ok(!definition.includes(rawSource), `${functionName} must not use ${rawSource}`);
  }
});

for (const target of targetFunctions) {
  test(`contract rejects an incomplete replacement loop even when the count query still names ${target}`, () => {
    const guard = readMigrations().find(({ name }) => /^\d+_guard_catalogue_verified_fit_evidence\.sql$/.test(name));
    assert.ok(guard, "repair migration must exist");
    const corrupted = guard.sql.replace(/(for\s+fn\s+in\b)([\s\S]*?)(\bloop\b)/i, (_, start, query, end) => start + query.replace(`'${target}'`, "'unrelated_function'") + end);
    assert.ok(corrupted.includes(`'${target}'`), "count query intentionally retains the original name");
    assert.throws(() => replacementTargets(corrupted), /replacement loop must target both catalogue RPCs exactly once/);
  });
}
