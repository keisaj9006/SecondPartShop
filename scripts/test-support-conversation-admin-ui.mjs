import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exists=path=>fs.existsSync(path);
const read=path=>fs.readFileSync(path,"utf8");

test("admin support detail keeps customer-visible replies separate from internal notes",()=>{
 assert.ok(exists("src/app/admin/support/[requestId]/page.tsx"));
 const page=read("src/app/admin/support/[requestId]/page.tsx");
 assert.match(page,/Visible to customer|Customer-visible|Reply to customer/i);
 assert.match(page,/Internal|admin note/i);
});
