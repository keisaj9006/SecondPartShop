import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("src/app/auth/actions.ts","utf8");

test("Preview auth email redirects use the dedicated stable branch origin resolver instead of a static localhost/site URL",()=>{
 assert.match(source,/resolveAuthEmailOrigin/);
 assert.match(source,/vercelEnv:process\.env\.VERCEL_ENV/);
 assert.match(source,/vercelBranchUrl:process\.env\.VERCEL_BRANCH_URL/);
 assert.match(source,/const returnOrigin=authReturnOrigin\(\)/);
 assert.doesNotMatch(source,/emailRedirectTo:`\$\{siteUrl\(\)\}/);
 assert.doesNotMatch(source,/redirectTo:`\$\{siteUrl\(\)\}/);
 assert.doesNotMatch(source,/from "next\/headers"/);
 assert.doesNotMatch(source,/resolveCheckoutReturnOrigin/);
});
