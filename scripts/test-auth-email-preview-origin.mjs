import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("src/lib/auth-email-origin.ts","utf8");

test("Preview auth emails prefer the stable branch URL over per-deployment URLs",()=>{
 assert.match(source,/VERCEL_BRANCH_URL/);
 assert.match(source,/preview/i);
 assert.match(source,/branch/i);
 assert.doesNotMatch(source,/requestOrigin/);
});

test("auth actions use the dedicated auth email origin resolver",()=>{
 const actions=fs.readFileSync("src/app/auth/actions.ts","utf8");
 assert.match(actions,/auth-email-origin/);
 assert.match(actions,/resolveAuthEmailOrigin/);
});
