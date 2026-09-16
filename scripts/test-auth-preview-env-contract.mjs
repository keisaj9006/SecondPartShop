import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=relativePath=>fs.readFileSync(path.join(root,relativePath),"utf8");

test("auth actions pass both stable branch and exact deployment URLs into the Preview email-origin resolver",()=>{
 const source=read("src/app/auth/actions.ts");
 assert.match(source,/vercelBranchUrl:\s*process\.env\.VERCEL_BRANCH_URL/);
 assert.match(source,/vercelUrl:\s*process\.env\.VERCEL_URL/);
});
