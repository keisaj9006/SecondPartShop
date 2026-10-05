import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const directory=new URL('../supabase/migrations/',import.meta.url);
const migration=fs.readdirSync(directory).find(name=>name.endsWith('_garage_vehicle_identity.sql'));
const sql=migration?fs.readFileSync(new URL(migration,directory),'utf8'):'';
test('Garage migration permits identity-only rows while retaining catalogue FK and bounded snapshots',()=>{
 assert.match(sql,/alter column catalogue_variant_id drop not null/i);
 assert.match(sql,/identity_make[\s\S]*char_length[\s\S]*80/i);
 assert.match(sql,/identity_model[\s\S]*char_length[\s\S]*120/i);
 assert.match(sql,/catalogue_variant_id is not null or/i);
 assert.match(sql,/registration[\s\S]*identity_make[\s\S]*identity_model/i);
 assert.doesNotMatch(sql,/drop\s+(?:constraint\s+\w*foreign|table)|disable row level security|set not null|delete from|truncate/i);
});
test('owner-normalized registration uniqueness fails on collisions and preserves all rows',()=>{
 assert.match(sql,/having count\(\*\)>1/i);
 assert.match(sql,/raise exception[\s\S]*corrective/i);
 assert.match(sql,/create unique index[\s\S]*profile_id[\s\S]*regexp_replace[\s\S]*where registration is not null/i);
 assert.match(sql,/forward[\s\S]*corrective/i);
});
