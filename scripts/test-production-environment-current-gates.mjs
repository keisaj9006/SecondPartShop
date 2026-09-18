import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const validator=fs.readFileSync("scripts/validate-production-environment.mjs","utf8");
const matrix=fs.readFileSync("docs/production-environment-matrix.md","utf8");

test("production environment gate tracks the current Supabase release blockers",()=>{
  assert.equal(
    matrix.includes("pending payout-transfer recovery migration"),
    false,
    "Production matrix still treats the historical payout-recovery migration as pending."
  );
  assert.equal(
    validator.includes("pending payout-transfer recovery migration"),
    false,
    "Production environment validator still requires the historical payout-recovery blocker."
  );

  assert.match(
    matrix,
    /20260916144500_restrict_seller_checkout_ready_anon\.sql/,
    "Production matrix must track the staged seller_checkout_ready anonymous EXECUTE revoke."
  );
  assert.match(
    validator,
    /20260916144500_restrict_seller_checkout_ready_anon\.sql/,
    "Production validator must require the staged seller_checkout_ready grant gate."
  );

  assert.match(
    matrix,
    /TokenHash/,
    "Production matrix must track the controlled Supabase Auth TokenHash template gate."
  );
  assert.match(
    validator,
    /TokenHash/,
    "Production validator must require the TokenHash template gate."
  );

  assert.match(
    matrix,
    /leaked-password protection/i,
    "Production matrix must track leaked-password protection as a plan/configuration gate."
  );
  assert.match(
    validator,
    /leaked-password protection/i,
    "Production validator must require leaked-password protection to stay explicit."
  );
});
