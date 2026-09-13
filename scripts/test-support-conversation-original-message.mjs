import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");

test("existing support request message remains the original conversation entry",()=>{
 const page=fs.existsSync("src/app/contact/[requestId]/page.tsx")?read("src/app/contact/[requestId]/page.tsx"):"";
 assert.match(page,/request\.message/);
 assert.doesNotMatch(page,/copy|migrate[^\n]*support_requests\.message/i);
});
