import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const checks=[];
const expect=(condition,message)=>{checks.push({condition,message});};

const action=read("src/app/beta-feedback/actions.ts");
const form=read("src/components/beta-feedback-form.tsx");
const page=read("src/app/beta-feedback/page.tsx");
const admin=read("src/app/admin/beta-feedback/page.tsx");
const moderationActions=read("src/app/admin/moderation/actions.ts");
const contact=read("src/app/contact/page.tsx");

expect(action.includes('requireUser("/beta-feedback")'),"beta reports require an authenticated tester");
expect(action.includes('BETA_PREFIX="[BETA_FEEDBACK v1]"'),"beta reports use a stable versioned prefix");
expect(action.includes('topic:"other"'),"beta feedback reuses the deployed support topic instead of requiring a DB migration");
expect(action.includes("VERCEL_GIT_COMMIT_SHA")&&action.includes("GITHUB_SHA"),"beta reports include a server-side build identifier");
expect(action.includes('revalidatePath("/admin/beta-feedback")'),"submitting feedback refreshes the beta admin queue");
expect(form.includes('name="severity"')&&form.includes('value="blocker"'),"tester form captures severity including blockers");
expect(form.includes('name="steps"')&&form.includes('name="actual"'),"tester form captures reproduction steps and actual result");
expect(page.includes("<BetaFeedbackForm/>"),"closed beta page renders the structured report form");
expect(admin.includes('.eq("topic","other")')&&admin.includes('.like("message",BETA_PREFIX+"%")'),"admin queue isolates only versioned beta reports");
expect(admin.includes('.in("status",["open","in_progress"])'),"admin queue only shows actionable beta reports");
expect(moderationActions.includes('revalidatePath("/admin/beta-feedback")'),"support triage refreshes the dedicated beta queue");
expect(contact.includes('href="/beta-feedback"'),"signed-in support UI exposes the beta feedback entry point");

const failed=checks.filter(check=>!check.condition);
if(failed.length){
 console.error("Closed Beta feedback validation failed:");
 for(const check of failed)console.error(`- ${check.message}`);
 process.exit(1);
}

console.log(`Closed Beta feedback validation passed (${checks.length} invariants).`);
