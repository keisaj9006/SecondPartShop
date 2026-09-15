import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const files=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).sort();
const definitions=[];
for(const file of files){
 const sql=fs.readFileSync(`${migrationDir}/${file}`,"utf8");
 for(const match of sql.matchAll(/create\s+or\s+replace\s+function\s+private\.protect_profile_role\(\)[\s\S]*?\$\$;/gi))definitions.push({file,sql:match[0]});
}

const latest=definitions.at(-1);

test("latest profile-role guard derives service-role authority from the current JWT and still allows app admins",()=>{
 assert.ok(latest,"protect_profile_role definition must exist");
 assert.match(latest.sql,/security\s+definer/i);
 assert.match(latest.sql,/auth\.jwt\(\)\s*->>\s*['"]role['"]/i);
 assert.match(latest.sql,/request_role\s*=\s*['"]service_role['"]/i);
 assert.match(latest.sql,/private\.is_admin\(\)/i);
 assert.doesNotMatch(latest.sql,/current_setting\(\s*['"]request\.jwt\.claim\.role['"]/i);
 assert.doesNotMatch(latest.sql,/current_user\s+(?:in|=)[\s\S]{0,80}service_role/i);
});

test("profile-role guard preserves buyer-to-seller self upgrade while blocking ordinary admin promotion",()=>{
 assert.ok(latest,"protect_profile_role definition must exist");
 assert.match(latest.sql,/old\.role\s*=\s*['"]buyer['"]::public\.user_role/i);
 assert.match(latest.sql,/new\.role\s*=\s*['"]seller['"]::public\.user_role/i);
 assert.match(latest.sql,/old\.id\s*=\s*\(select\s+auth\.uid\(\)\)/i);
 assert.match(latest.sql,/raise\s+exception\s+['"]Only administrators can change account roles['"]/i);
});
