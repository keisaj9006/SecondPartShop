import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildHostedLedgerInventory,
  ledgerIdentitySha256,
  prepareTaskOnlyMigrationDirectory,
  splitSqlStatements,
  verifyMigrationIdentity,
} from "./rc05-migration-identity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
const matrix = readFileSync(path.join(root, "docs/test-runs/2026-10-14-rc02-migration-matrix.csv"), "utf8");
const baseline = buildHostedLedgerInventory(matrix);
const candidateIdentity = { version: "20261014202700", name: "review_ready_notifications_forward" };
const ledger = {
  version: "20261014202700",
  name: "review_ready_notifications_forward",
  statementCount: 6,
  statementsSha256: "87d416c7b7b56686f9c0c799cbf6012c2dc0a6041f770b18d84359c10388b2fe",
  statements: splitSqlStatements(source),
  rowCount: 1,
  delta: {
    beforeCount: 207,
    afterCount: 208,
    beforeIdentitySha256: ledgerIdentitySha256(baseline),
    afterIdentitySha256: ledgerIdentitySha256([...baseline, candidateIdentity]),
    added: [candidateIdentity],
    removed: [],
    pendingBefore: [candidateIdentity],
    appliedByMigrationUp: [candidateIdentity],
    pendingAfter: [],
  },
};

test("accepts the approved source and disposable CLI ledger identity", () => {
  assert.deepEqual(verifyMigrationIdentity({ source, ledger, baseline }), {
    version: ledger.version,
    name: ledger.name,
    sourceSha256: "e6dd184f94748c5a7f6ec6ba9012ab534599d2f69099c23af12f2e542f1246aa",
    statementCount: 6,
    statementsSha256: ledger.statementsSha256,
  });
});

test("generates 207 hosted placeholders and holds the exact candidate outside startup migrations", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "secondpart-ledger-generator-"));
  try {
    const result = prepareTaskOnlyMigrationDirectory({ directory, baseline, candidateSource: source });
    const files = readdirSync(result.migrationsDirectory).sort();
    assert.equal(files.length, 207);
    assert.equal(files.filter((file) => file === "20261014202700_review_ready_notifications_forward.sql").length, 0);
    assert.equal(readFileSync(result.candidatePath, "utf8"), source);
    assert.equal(result.baselineIdentitySha256, "e87fa8b35d0836b7b99d5a090010dc01a84da6a1ebed38c638eee5d072c1f3ae");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fails closed when SQL changes under an already applied version", () => {
  assert.throws(
    () => verifyMigrationIdentity({ source: `${source}\n-- drift`, ledger }),
    /source SHA-256 mismatch/,
  );
});

test("fails closed when the ledger version, name, or parsed statements differ", () => {
  for (const mutation of [
    { version: "20261014202701" },
    { name: "different_name" },
    { statementCount: 5 },
    { statementsSha256: "0".repeat(64) },
  ]) {
    assert.throws(
      () => verifyMigrationIdentity({ source, ledger: { ...ledger, ...mutation }, baseline }),
      /migration identity mismatch/,
    );
  }
});

test("fails closed when raw statements or the full 207 to 208 ledger delta are not proven", () => {
  for (const mutation of [
    { statements: [...ledger.statements.slice(0, -1), "select 1"] },
    { rowCount: 2 },
    { delta: { ...ledger.delta, beforeCount: 206 } },
    { delta: { ...ledger.delta, beforeIdentitySha256: "0".repeat(64) } },
    { delta: { ...ledger.delta, added: [] } },
    { delta: { ...ledger.delta, pendingAfter: [candidateIdentity] } },
  ]) {
    assert.throws(
      () => verifyMigrationIdentity({ source, ledger: { ...ledger, ...mutation }, baseline }),
      /migration identity|ledger delta|raw statements|row count/,
    );
  }
});
