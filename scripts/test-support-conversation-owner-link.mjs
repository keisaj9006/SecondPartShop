import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("src/app/contact/page.tsx","utf8");

test("support request summary cards expose a direct conversation link",()=>{
 assert.match(source,/View conversation|Open conversation/i);
});
