import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

function parseCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...records] = rows;
  return records.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

export function buildHostedLedgerInventory(matrixSource) {
  const identities = parseCsv(matrixSource)
    .filter((row) => row.hosted_version && row.hosted_name)
    .map((row) => ({ version: row.hosted_version, name: row.hosted_name }));
  const unique = [...new Map(identities.map((identity) => [`${identity.version}:${identity.name}`, identity])).values()];
  if (unique.length !== 207 || new Set(unique.map(({ version }) => version)).size !== 207) {
    throw new Error(`Expected 207 unique hosted migration identities; received ${unique.length}`);
  }
  return unique;
}

export function ledgerIdentitySha256(identities) {
  const canonical = [...identities].sort((left, right) => left.version.localeCompare(right.version) || left.name.localeCompare(right.name));
  return sha256(JSON.stringify(canonical));
}

export function splitSqlStatements(source) {
  const normalized = source.replaceAll("\r\n", "\n");
  const statements = [];
  let start = 0;
  let dollarQuoted = false;
  for (let index = 0; index < normalized.length; index++) {
    if (normalized.slice(index, index + 2) === "$$") {
      dollarQuoted = !dollarQuoted;
      index++;
      continue;
    }
    if (normalized[index] === ";" && !dollarQuoted) {
      statements.push(normalized.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (normalized.slice(start).trim()) statements.push(normalized.slice(start).trim());
  return statements;
}

export function prepareTaskOnlyMigrationDirectory({ directory, baseline, candidateSource }) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemp = path.resolve(tmpdir());
  if (!resolvedDirectory.startsWith(`${resolvedTemp}${path.sep}`) || !path.basename(resolvedDirectory).startsWith("secondpart-")) {
    throw new Error("RC-05 rehearsal output must be a dedicated secondpart-* directory under the task TEMP root");
  }
  const migrationsDirectory = path.join(resolvedDirectory, "supabase", "migrations");
  rmSync(migrationsDirectory, { recursive: true, force: true });
  mkdirSync(migrationsDirectory, { recursive: true });
  for (const identity of baseline) {
    if (!/^\d{14}$/.test(identity.version) || !/^[a-z0-9_]+$/.test(identity.name)) {
      throw new Error(`Unsafe hosted migration identity: ${identity.version}_${identity.name}`);
    }
    writeFileSync(path.join(migrationsDirectory, `${identity.version}_${identity.name}.sql`), "-- Exact hosted-ledger placeholder. Already applied; must never execute.\n");
  }
  const candidatePath = path.join(resolvedDirectory, `${expected.version}_${expected.name}.sql`);
  writeFileSync(candidatePath, candidateSource);
  return { migrationsDirectory, candidatePath, baselineIdentitySha256: ledgerIdentitySha256(baseline) };
}

export function verifyMigrationIdentity({ source, ledger, baseline }) {
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
  const statements = splitSqlStatements(source);
  const statementsSha256 = sha256(JSON.stringify(statements));
  if (JSON.stringify(ledger?.statements) !== JSON.stringify(statements) || statementsSha256 !== expected.statementsSha256) {
    throw new Error("RC-05 raw statements do not match the approved source");
  }
  if (ledger?.rowCount !== 1) throw new Error(`RC-05 candidate row count must be 1; received ${ledger?.rowCount}`);
  const candidate = { version: expected.version, name: expected.name };
  const expectedDelta = {
    beforeCount: 207,
    afterCount: 208,
    beforeIdentitySha256: ledgerIdentitySha256(baseline),
    afterIdentitySha256: ledgerIdentitySha256([...baseline, candidate]),
    added: [candidate],
    removed: [],
    pendingBefore: [candidate],
    appliedByMigrationUp: [candidate],
    pendingAfter: [],
  };
  if (JSON.stringify(ledger?.delta) !== JSON.stringify(expectedDelta)) {
    throw new Error("RC-05 full ledger delta does not prove an exact 207 to 208 transition");
  }
  return { ...actual, sourceSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
  const evidence = JSON.parse(readFileSync(path.join(root, "docs/test-runs/2026-10-28-rc05-migration-identity.json"), "utf8"));
  const matrix = readFileSync(path.join(root, "docs/test-runs/2026-10-14-rc02-migration-matrix.csv"), "utf8");
  console.log(JSON.stringify({ status: "PASS", ...verifyMigrationIdentity({ source, ledger: evidence.ledger, baseline: buildHostedLedgerInventory(matrix) }) }, null, 2));
}
