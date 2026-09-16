import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("src/app/auth/actions.ts","utf8");

test("Preview auth email redirects use the trusted request origin instead of a static localhost/site URL",()=>{
 assert.match(source,/import \{ headers \} from "next\/headers";/);
 assert.match(source,/resolveCheckoutReturnOrigin/);
 assert.match(source,/VERCEL_ENV/);
 assert.match(source,/VERCEL_URL/);
 assert.match(source,/VERCEL_BRANCH_URL/);
 assert.match(source,/await authReturnOrigin\(\)/);
 assert.doesNotMatch(source,/emailRedirectTo:`\$\{siteUrl\(\)\}/);
 assert.doesNotMatch(source,/redirectTo:`\$\{siteUrl\(\)\}/);
});
