import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { verifyMigrationIdentity } from "./rc05-migration-identity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
const ledger = {
  version: "20261014202700",
  name: "review_ready_notifications_forward",
  statementCount: 6,
  statementsSha256: "87d416c7b7b56686f9c0c799cbf6012c2dc0a6041f770b18d84359c10388b2fe",
};

test("accepts the approved source and disposable CLI ledger identity", () => {
  assert.deepEqual(verifyMigrationIdentity({ source, ledger }), {
    version: ledger.version,
    name: ledger.name,
    sourceSha256: "e6dd184f94748c5a7f6ec6ba9012ab534599d2f69099c23af12f2e542f1246aa",
    statementCount: 6,
    statementsSha256: ledger.statementsSha256,
  });
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
      () => verifyMigrationIdentity({ source, ledger: { ...ledger, ...mutation } }),
      /migration identity mismatch/,
    );
  }
});
