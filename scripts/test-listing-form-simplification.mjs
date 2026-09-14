import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("src/components/listing-form.tsx","utf8");
const actions=fs.readFileSync("src/app/dashboard/actions.ts","utf8");

test("seller listing form explains required-field markers",()=>{
 assert.match(form,/Required fields are marked/);
 assert.match(form,/const RequiredMark=/);
});

test("seller listing form marks core required fields visibly",()=>{
 for(const label of ["Listing title","Description","Department","Category","Part type","Condition","Testing status","Warranty","Price (£)","Stock quantity"]){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(form,new RegExp(`${escaped}[^<]*(?:<[^>]+>)*<RequiredMark\\s*\\/>`),`${label} should show a visible required marker`);
 }
});

test("photo requirement is clear without pretending drafts require photos",()=>{
 assert.match(form,/Real product photos/);
 assert.match(form,/required to publish/i);
});

test("publish compatibility requirement is explained as an either-or rule",()=>{
 assert.match(form,/To publish, add at least one compatibility source/i);
 assert.match(form,/donor vehicle/i);
 assert.match(form,/OE\/OEM/i);
 assert.match(form,/manufacturer.*part number/i);
});

test("general marketplace form no longer asks for gearbox-only technical fields",()=>{
 assert.doesNotMatch(form,/Transmission technical details/);
 assert.doesNotMatch(form,/name="gearboxFamily"/);
 assert.doesNotMatch(form,/name="gearboxCode"/);
 assert.doesNotMatch(actions,/Gearbox family and code are required/);
});

test("seller form removes duplicate manual delivery-range fields",()=>{
 assert.doesNotMatch(form,/Delivery min days/);
 assert.doesNotMatch(form,/Delivery max days/);
 assert.doesNotMatch(form,/name="deliveryDaysMin"/);
 assert.doesNotMatch(form,/name="deliveryDaysMax"/);
 assert.doesNotMatch(actions,/formData\.get\("deliveryDaysMin"\)/);
 assert.doesNotMatch(actions,/formData\.get\("deliveryDaysMax"\)/);
});
