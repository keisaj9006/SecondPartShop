import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exists=path=>fs.existsSync(path);
const read=path=>fs.readFileSync(path,"utf8");

test("closed support conversations are visibly read-only for the customer",()=>{
 assert.ok(exists("src/app/contact/[requestId]/page.tsx"));
 const page=read("src/app/contact/[requestId]/page.tsx");
 assert.match(page,/closed/i);
 assert.match(page,/read-only|can no longer reply|cannot reply|replies are closed/i);
});

test("resolved support conversations remain replyable so a customer can reopen them",()=>{
 const page=exists("src/app/contact/[requestId]/page.tsx")?read("src/app/contact/[requestId]/page.tsx"):"";
 assert.match(page,/resolved/i);
 assert.match(page,/SupportReplyForm/);
});
