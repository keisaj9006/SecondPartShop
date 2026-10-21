import {readFile} from "node:fs/promises";
import {validateInternalWorkflow} from "./android-internal-release-policy.mjs";

const workflowPath=".github/workflows/android-internal-aab.yml";
const source=await readFile(workflowPath,"utf8");
const errors=validateInternalWorkflow(source);
if(errors.length){
 for(const error of errors)console.error("FAIL: "+error);
 process.exit(1);
}
console.log("PASS: Android Internal QA workflow policy is fail closed.");
