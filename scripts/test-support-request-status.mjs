import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");

test("support request history loader is bounded and owner-scoped",()=>{
 const source=read("src/lib/data/support.ts");
 assert.match(source,/from\("support_requests"\)/);
 assert.match(source,/select\("id,topic,message,status,created_at,updated_at"\)/);
 assert.match(source,/eq\("profile_id",userId\)/);
 assert.match(source,/order\("created_at",\{ascending:false\}\)/);
 assert.match(source,/limit\(10\)/);
 assert.doesNotMatch(source,/select\("\*"\)/);
});

test("contact page shows signed-in users their recent support statuses",()=>{
 const source=read("src/app/contact/page.tsx");
 assert.match(source,/getSupportRequestsForUser/);
 assert.match(source,/Your support requests/);
 assert.match(source,/Submitted/);
 assert.match(source,/In review/);
 assert.match(source,/Closed/);
 assert.match(source,/request\.topic/);
 assert.match(source,/request\.createdAt/);
});

test("support submission revalidates contact so a new request appears immediately",()=>{
 const source=read("src/app/contact/actions.ts");
 assert.match(source,/revalidatePath\("\/contact"\)/);
});
