import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const exists=path=>fs.existsSync(path);

const migrationDir="supabase/migrations";
const migrationSources=()=>fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>read(`${migrationDir}/${name}`)).join("\n");

test("support conversation migration creates an append-only participant thread with RLS",()=>{
 const sql=migrationSources();
 assert.match(sql,/create table(?: if not exists)? public\.support_request_messages/i);
 assert.match(sql,/support_request_id\s+uuid[^\n]*references public\.support_requests/i);
 assert.match(sql,/sender_profile_id\s+uuid/i);
 assert.match(sql,/sender_role[^\n]*(?:user|admin)/i);
 assert.match(sql,/message\s+text/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/support_request_messages/i);
 assert.match(sql,/auth\.uid\(\)/i);
 assert.match(sql,/is_admin/i);
 assert.doesNotMatch(sql,/grant\s+(?:update|delete)[^;]*support_request_messages/i);
});

test("support reply contract reopens resolved requests but keeps closed requests final",()=>{
 const sql=migrationSources();
 assert.match(sql,/resolved/i);
 assert.match(sql,/closed/i);
 assert.match(sql,/status\s*=\s*'open'/i);
 assert.match(sql,/cannot reply|closed support request|support request is closed/i);
});

test("signed-in users can view a conversation and reply from contact",()=>{
 assert.ok(exists("src/app/contact/[requestId]/page.tsx"),"missing support conversation page");
 assert.ok(exists("src/components/support-reply-form.tsx"),"missing support reply form");
 const page=read("src/app/contact/[requestId]/page.tsx");
 const actions=read("src/app/contact/actions.ts");
 assert.match(page,/Conversation|Support conversation/i);
 assert.match(page,/getSupportRequestConversationForUser/);
 assert.match(page,/SupportReplyForm/);
 assert.match(actions,/replyToSupportRequest/);
 assert.match(actions,/revalidatePath\(`\/contact\/\$\{requestId\}`\)/);
});

test("support history links to the conversation and includes resolved status",()=>{
 const page=read("src/app/contact/page.tsx");
 assert.match(page,/resolved:\s*"Resolved"/);
 assert.match(page,/\/contact\/\$\{request\.id\}/);
 assert.match(page,/View conversation|Open conversation/i);
});

test("admin moderation links support requests to a dedicated reply page",()=>{
 assert.ok(exists("src/app/admin/support/[requestId]/page.tsx"),"missing admin support detail page");
 const moderation=read("src/app/admin/moderation/page.tsx");
 const adminPage=read("src/app/admin/support/[requestId]/page.tsx");
 const actions=read("src/app/admin/moderation/actions.ts");
 assert.match(moderation,/\/admin\/support\/\$\{row\.id\}/);
 assert.match(adminPage,/Support conversation/i);
 assert.match(adminPage,/adminReplyToSupportRequest/);
 assert.match(actions,/adminReplyToSupportRequest/);
 assert.match(actions,/"resolved"/);
 assert.match(actions,/"closed"/);
});

test("support data loader scopes the ticket to its owner and loads bounded messages",()=>{
 const source=read("src/lib/data/support.ts");
 assert.match(source,/getSupportRequestConversationForUser/);
 assert.match(source,/eq\("profile_id",userId\)/);
 assert.match(source,/from\("support_request_messages"\)/);
 assert.match(source,/order\("created_at",\{ascending:true\}\)/);
 assert.match(source,/limit\(/);
});
