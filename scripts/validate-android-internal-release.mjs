import {readFile} from "node:fs/promises";
import {validateInternalWorkflow,validateRegisteredReleaseWorkflow} from "./android-internal-release-policy.mjs";

const internalSource=await readFile(".github/workflows/android-internal-aab.yml","utf8");
const registeredSource=await readFile(".github/workflows/android-release-check.yml","utf8");
const errors=[
 ...validateInternalWorkflow(internalSource),
 ...validateRegisteredReleaseWorkflow(registeredSource)
];
if(errors.length){
 for(const error of errors)console.error("FAIL: "+error);
 process.exit(1);
}
console.log("PASS: Android Internal QA workflow policy is fail closed.");
