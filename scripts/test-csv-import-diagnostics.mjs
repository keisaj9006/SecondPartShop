import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions=fs.readFileSync("src/app/dashboard/import/actions.ts","utf8");

test("CSV reference lookup failure emits a stable privacy-safe diagnostic",()=>{
 assert.match(actions,/reportOperationalWarning/);
 assert.match(actions,/seller_csv_reference_lookup_failed/);
 assert.match(actions,/operation:"reference_lookup"/);
 assert.match(actions,/code:"CSV_REF_LOOKUP_FAILED"/);
 assert.match(actions,/CSV-REF-LOOKUP-01/);
});

test("CSV diagnostic context never includes imported content or identifying file fields",()=>{
 const start=actions.indexOf('event:"seller_csv_reference_lookup_failed"');
 assert.ok(start>=0,"reference lookup diagnostic event must exist");
 const block=actions.slice(start,start+500);
 assert.doesNotMatch(block,/filename|file\.name|registration|seller_reference|sellerReference|csvContent|rows:/i);
});

test("the existing fail-closed user message remains the discriminator",()=>{
 assert.match(actions,/Existing seller references could not be checked\./);
});
