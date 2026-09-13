import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");

test("support conversation loader exposes original request and customer-visible thread without admin notes",()=>{
 const source=read("src/lib/data/support.ts");
 assert.match(source,/support_request_messages/);
 assert.match(source,/sender_role/);
 assert.match(source,/message/);
 assert.doesNotMatch(source,/admin_notes/);
});
