import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const branchPreview="https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app";
const legacyPreview="https://second-part-shop-preview.vercel.app";

const prepare=fs.readFileSync(path.join(root,"scripts/prepare-android-preview.mjs"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/android-preview-apk.yml"),"utf8");

test("Android Preview defaults to the moving rebuild-nextjs branch alias",()=>{
 assert.match(prepare,new RegExp(branchPreview.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
 assert.doesNotMatch(prepare,new RegExp(legacyPreview.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("Android Preview workflow builds and verifies against the rebuild-nextjs branch alias",()=>{
 assert.match(workflow,new RegExp(`SECOND_PART_PREVIEW_URL: ${branchPreview.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`));
 assert.match(workflow,new RegExp(`config\\.server\\?\\.url!==\\"${branchPreview.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\"`));
 assert.doesNotMatch(workflow,new RegExp(legacyPreview.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("Android SDK setup explicitly avoids the removed legacy tools package",()=>{
 const setupBlock=workflow.match(/- name: Set up Android SDK[\s\S]*?(?=\n\s*- name:)/)?.[0]??"";
 assert.match(setupBlock,/uses:\s*android-actions\/setup-android@v[34]/);
 assert.match(setupBlock,/with:\s*\n\s*packages:\s*platform-tools\s*$/m);
 assert.doesNotMatch(setupBlock,/packages:\s*tools(?:\s|$)/);
});
