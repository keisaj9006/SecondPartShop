import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(path.join(root, "docs/test-runs", name), "utf8"));
const local = read("2026-10-14-rc04-replay-log.json");
const hosted = read("2026-10-14-rc04-hosted-catalog.json");
const supplement = read("2026-10-14-rc04-hosted-catalog-supplement.json");
const definitions = read("2026-10-14-rc04-hosted-function-drift-definitions.json");
const hostedAll = read("2026-10-14-rc04-hosted-function-inventory.json");
const hostedGrants = read("2026-10-14-rc04-hosted-critical-grants.json");
const hostedObjects = read("2026-10-14-rc04-hosted-triggers-policies.json");

function tokens(sql) {
  return (sql.replace(/\r\n/g, "\n").match(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9$]*|[0-9]+|[^\s]/g) ?? [])
    .filter((token) => !token.startsWith("--") && !token.startsWith("/*"));
}

test("RC-04 disposable and hosted critical catalog signatures, privileges and SQL tokens agree", () => {
  assert.equal(local.status, "PASS_WITH_SHIMS");
  assert.equal(local.entries.filter((entry) => entry.status === "PASS").length, 207);
  assert.equal(local.catalog.length, 188);
  assert.equal(local.triggers.length, 50);
  assert.equal(local.policies.length, 135);
  assert.deepEqual(local.categories, { n: 191, fingerprint: "8a4a27634039c7c731ced8210859d008" });
  assert.equal(local.candidateSha256, "de915d37becb9bbecfcc99edf9c6ca220284c85673bb5c6ff3b6bf3d61f5ab94");
  assert.deepEqual(local.candidateReadback, { function_count: 1, trigger_count: 1, dedupe_index_count: 1 });
  assert.deepEqual(local.rollbackReadback, { function_count: 0, trigger_count: 0 });
  const localMap = new Map(local.catalog.map((item) => [`${item.nspname}.${item.proname}(${item.args})`, item]));
  const hostFunctions = [...hosted.queries.functions, ...supplement.functions];
  assert.equal(hostFunctions.length, 30);
  for (const entry of hostFunctions) {
    const other = localMap.get(entry.signature);
    assert.ok(other, `Missing ${entry.signature}`);
    assert.equal(other.prosecdef, entry.prosecdef, `SECURITY DEFINER drift: ${entry.signature}`);
    assert.deepEqual(other.proconfig, entry.proconfig, `search_path drift: ${entry.signature}`);
    for (const permission of ["anon_exec", "authenticated_exec", "service_exec"])
      assert.equal(other[permission], entry[permission], `${permission} drift: ${entry.signature}`);
  }
  const hostSignatures = new Set(hostedAll.functions.map((entry) => entry.signature));
  assert.deepEqual(new Set(localMap.keys()), hostSignatures);
  const localBodies = new Map(local.drift_definitions.map((entry) => [entry.signature, entry.definition]));
  const hostHashes = new Map(hostedAll.functions.map((entry) => [entry.signature, entry.definition_md5]));
  assert.equal(localBodies.size, hostedAll.functions.filter((entry) => localMap.get(entry.signature).definition_md5 !== entry.definition_md5).length);
  const tokenDrift = [];
  for (const entry of definitions.functions) {
    if (localMap.get(entry.signature).definition_md5 === hostHashes.get(entry.signature)) continue;
    const localTokens = tokens(localBodies.get(entry.signature));
    let hostedTokens = tokens(entry.definition);
    if (entry.signature === "public.seller_import_batch_readiness(p_batch_id uuid)") {
      // Hosted SQL's five SELECT output aliases duplicate the declared RETURNS TABLE names.
      const aliases = ["total_drafts", "ready_drafts", "needs_photos", "needs_compatibility", "needs_technical"];
      for (const alias of aliases) assert.equal(hostedTokens.filter((token, i) => token === "as" && hostedTokens[i + 1] === alias).length, 1);
      hostedTokens = hostedTokens.filter((token, i) => !aliases.some((alias) => (token === "as" && hostedTokens[i + 1] === alias) || (token === alias && hostedTokens[i - 1] === "as")));
    }
    if (localTokens.length !== hostedTokens.length || localTokens.some((token, i) => token !== hostedTokens[i])) tokenDrift.push(entry.signature);
  }
  assert.deepEqual(tokenDrift, [], `SQL token drift in ${tokenDrift.length} functions`);
  assert.deepEqual(local.critical_grants, hostedGrants.tables);
  const policies = new Map(local.policies.map((entry) => [`${entry.schemaname}.${entry.tablename}.${entry.policyname}`, entry]));
  assert.equal(hostedObjects.policies.length, 135);
  for (const entry of hostedObjects.policies) {
    const other = policies.get(`${entry.schemaname}.${entry.tablename}.${entry.policyname}`);
    assert.ok(other, `Missing policy: ${entry.tablename}.${entry.policyname}`);
    for (const field of ["roles", "cmd", "qual", "with_check"]) {
      const actual = field === "roles" ? `{${other.roles.join(",")}}` : other[field];
      assert.deepEqual(actual, entry[field], `Policy ${field} drift: ${entry.tablename}.${entry.policyname}`);
    }
  }
  const triggers = new Map(local.triggers.map((entry) => [`${entry.nspname}.${entry.relname}.${entry.tgname}`, entry.definition_md5]));
  assert.equal(hostedObjects.triggers.length, 50);
  for (const entry of hostedObjects.triggers) {
    const hash = createHash("md5").update(entry.definition).digest("hex");
    assert.equal(triggers.get(entry.object), hash, `Trigger drift: ${entry.object}`);
  }
});
