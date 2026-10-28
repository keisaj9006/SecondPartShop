import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = Object.freeze({
  version: "20261014202700",
  name: "review_ready_notifications_forward",
  sourceSha256: "e6dd184f94748c5a7f6ec6ba9012ab534599d2f69099c23af12f2e542f1246aa",
  statementCount: 6,
  statementsSha256: "87d416c7b7b56686f9c0c799cbf6012c2dc0a6041f770b18d84359c10388b2fe",
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function verifyMigrationIdentity({ source, ledger }) {
  const sourceSha256 = sha256(source.replaceAll("\r\n", "\n"));
  if (sourceSha256 !== expected.sourceSha256) {
    throw new Error(`RC-05 source SHA-256 mismatch: expected ${expected.sourceSha256}, received ${sourceSha256}`);
  }
  const actual = {
    version: ledger?.version,
    name: ledger?.name,
    statementCount: Number(ledger?.statementCount),
    statementsSha256: ledger?.statementsSha256,
  };
  for (const key of ["version", "name", "statementCount", "statementsSha256"]) {
    if (actual[key] !== expected[key]) {
      throw new Error(`RC-05 migration identity mismatch for ${key}: expected ${expected[key]}, received ${actual[key]}`);
    }
  }
  return { ...actual, sourceSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
  const evidence = JSON.parse(readFileSync(path.join(root, "docs/test-runs/2026-10-28-rc05-migration-identity.json"), "utf8"));
  console.log(JSON.stringify({ status: "PASS", ...verifyMigrationIdentity({ source, ledger: evidence.ledger }) }, null, 2));
}
