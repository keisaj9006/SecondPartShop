import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("src/lib/auth-email-origin.ts","utf8");

test("Preview auth emails prefer branch URL, then exact deployment URL, over the configured fallback",()=>{
 assert.match(source,/vercelBranchUrl/);
 assert.match(source,/vercelUrl/);
 assert.match(source,/input\.vercelEnv!=="preview"/);
 assert.match(source,/normalizeOrigin\(input\.vercelBranchUrl\)\?\?normalizeOrigin\(input\.vercelUrl\)\?\?configured/);
 assert.doesNotMatch(source,/requestOrigin/);
});

test("auth actions pass both Vercel branch and deployment URLs into the dedicated auth email origin resolver",()=>{
 const actions=fs.readFileSync("src/app/auth/actions.ts","utf8");
 assert.match(actions,/auth-email-origin/);
 assert.match(actions,/resolveAuthEmailOrigin/);
 assert.match(actions,/vercelEnv:process\.env\.VERCEL_ENV/);
 assert.match(actions,/vercelBranchUrl:process\.env\.VERCEL_BRANCH_URL/);
 assert.match(actions,/vercelUrl:process\.env\.VERCEL_URL/);
});
