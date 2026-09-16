import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../src/lib/ops-monitoring.ts",import.meta.url),"utf8");

test("critical alert delivery allows a realistic HTTPS response window",()=>{
  assert.match(source,/const ALERT_DELIVERY_TIMEOUT_MS=5000;/);
  assert.match(source,/setTimeout\(\(\)=>controller\.abort\(\),ALERT_DELIVERY_TIMEOUT_MS\)/);
});
