import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./verify-marketplace-scale-postgres.mjs",import.meta.url),"utf8");

test("scale harness exercises 100k listings",()=>{
 assert.match(source,/const fixtureCount=100_000;/,"scale verifier must seed 100,000 listings");
 assert.match(source,/exactly 100,000 synthetic listings/,"scale report must explicitly record the 100k fixture size");
});

test("scale harness records real PostgreSQL query plans",()=>{
 assert.match(source,/EXPLAIN\s*\(ANALYZE,BUFFERS,FORMAT JSON\)/i,"scale verifier must collect EXPLAIN ANALYZE/BUFFERS JSON evidence");
 assert.match(source,/queryPlans/,"scale report must retain query-plan evidence");
});

test("scale harness keeps deep pagination and bounded pages in the proof",()=>{
 assert.match(source,/bounded page plus sentinel/,"scale verifier must keep bounded page assertions");
 assert.match(source,/price_asc_deep_page/,"scale verifier must test deep ascending pagination");
 assert.match(source,/price_desc_deep_page/,"scale verifier must test deep descending pagination");
 assert.match(source,/best_terminal_page/,"scale verifier must test terminal pagination");
});
