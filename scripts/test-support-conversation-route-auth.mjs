import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");

test("customer support conversation page is account-gated",()=>{
 const page=fs.existsSync("src/app/contact/[requestId]/page.tsx")?read("src/app/contact/[requestId]/page.tsx"):"";
 assert.match(page,/requireUser|getCurrentUser/);
});

test("admin support conversation page is admin-gated",()=>{
 const page=fs.existsSync("src/app/admin/support/[requestId]/page.tsx")?read("src/app/admin/support/[requestId]/page.tsx"):"";
 assert.match(page,/requireAdmin/);
});
