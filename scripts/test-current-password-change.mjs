import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,root),"utf8");

test("signed-in security page exposes a dedicated current-password change form while preserving recovery",()=>{
 const page=read("src/app/account/security/page.tsx");
 assert.match(page,/AccountPasswordForm/);
 assert.match(page,/Reset password/);
 assert.match(page,/\/auth\/forgot-password/);
});

test("password change form collects current password plus confirmed 8-character replacement",()=>{
 const form=read("src/components/account-password-form.tsx");
 assert.match(form,/useActionState\(changeCurrentPassword/);
 assert.match(form,/name="currentPassword"/);
 assert.match(form,/autoComplete="current-password"/);
 assert.match(form,/name="password"/);
 assert.match(form,/name="confirmPassword"/);
 assert.ok((form.match(/minLength=\{8\}/g)??[]).length>=2,"both new-password fields must enforce minimum 8 characters");
 assert.ok((form.match(/autoComplete="new-password"/g)??[]).length>=2,"both replacement fields must use new-password autocomplete");
});

test("server action verifies ownership and forwards the installed Supabase current_password attribute",()=>{
 const actions=read("src/app/account/security/actions.ts");
 assert.match(actions,/export async function changeCurrentPassword/);
 assert.match(actions,/requireUser\("\/account\/security"\)/);
 assert.match(actions,/formData\.get\("currentPassword"\)/);
 assert.match(actions,/formData\.get\("password"\)/);
 assert.match(actions,/formData\.get\("confirmPassword"\)/);
 assert.match(actions,/password\.length<8/);
 assert.match(actions,/password!==confirmPassword/);
 assert.match(actions,/supabase\.auth\.updateUser\(\{\s*password,\s*current_password:currentPassword\s*\}\)/s);
 assert.match(actions,/revalidatePath\("\/account\/security"\)/);
});
