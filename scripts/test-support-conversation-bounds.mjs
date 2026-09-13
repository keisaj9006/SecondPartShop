import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");

test("support reply forms bound visible message length to 2000 characters",()=>{
 const user=fs.existsSync("src/components/support-reply-form.tsx")?read("src/components/support-reply-form.tsx"):"";
 const admin=fs.existsSync("src/app/admin/support/[requestId]/page.tsx")?read("src/app/admin/support/[requestId]/page.tsx"):"";
 assert.match(user,/maxLength=\{?2000\}?/);
 assert.match(admin,/maxLength=\{?2000\}?/);
});
