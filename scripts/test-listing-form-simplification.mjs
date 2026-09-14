import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("src/components/listing-form.tsx","utf8");
const actions=fs.readFileSync("src/app/dashboard/actions.ts","utf8");

test("seller listing form explains required-field markers",()=>{
 assert.match(form,/Required fields are marked/);
 assert.match(form,/const RequiredMark=/);
});

test("seller listing form marks only core required fields visibly",()=>{
 for(const label of ["Listing title","Description","Department","Category","Part type","Condition","Price (£)","Stock quantity"]){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(form,new RegExp(`${escaped}[^<]*(?:<[^>]+>)*<RequiredMark\\s*\\/>`),`${label} should show a visible required marker`);
 }
 assert.doesNotMatch(form,/Testing status<RequiredMark\s*\/>/);
 assert.doesNotMatch(form,/Warranty<RequiredMark\s*\/>/);
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

test("secondary listing details use progressive disclosure instead of cluttering the core form",()=>{
 assert.match(form,/<details[^>]*className=/);
 assert.match(form,/More details \(optional\)/);
 for(const label of ["Testing status","Warranty","Damage / visible wear","OE/OEM number","Manufacturer / brand","Manufacturer / part number","Dispatch time","Local collection available","Delivery price (£)"]){
  assert.match(form,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),`${label} should remain available as an optional detail`);
 }
});

test("duplicate condition-notes field is removed because description already covers condition",()=>{
 assert.doesNotMatch(form,/Condition notes/);
 assert.doesNotMatch(form,/name="conditionNotes"/);
 assert.doesNotMatch(actions,/formData\.get\("conditionNotes"\)/);
});

test("testing and warranty fall back safely when optional controls are left untouched",()=>{
 assert.match(actions,/formData\.get\("testingStatus"\)\?\?"not_specified"/);
 assert.match(actions,/formData\.get\("warrantyDays"\)\?\?0/);
});

test("new seller listings keep condition choices simple while legacy refurbished data remains editable",()=>{
 assert.doesNotMatch(form,/Remanufactured \/ professionally refurbished/);
 assert.match(form,/listing\?\.condition==="reconditioned"&&<option value="reconditioned">Existing refurbished listing<\/option>/);
 assert.match(actions,/\["new","reconditioned","used"\]/);
});
