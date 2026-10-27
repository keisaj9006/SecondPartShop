import assert from "node:assert/strict";
import test from "node:test";

import { verifyBundleIdentity } from "./verify-android-bundle-identity.mjs";

const manifest=`<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.secondpart.marketplace" android:versionCode="1" android:versionName="0.1.0"></manifest>`;

test("accepts the exact package and requested version from the final AAB manifest",()=>{
 assert.equal(verifyBundleIdentity(manifest,{packageName:"com.secondpart.marketplace",versionCode:"1",versionName:"0.1.0"}),true);
});

for(const [name,expected] of [
 ["package",{packageName:"com.secondpart.marketplace.preview",versionCode:"1",versionName:"0.1.0"}],
 ["version code",{packageName:"com.secondpart.marketplace",versionCode:"2",versionName:"0.1.0"}],
 ["version name",{packageName:"com.secondpart.marketplace",versionCode:"1",versionName:"0.1.1"}]
]){
 test(`rejects a mismatched final AAB ${name}`,()=>{
  assert.throws(()=>verifyBundleIdentity(manifest,expected),/Final AAB identity mismatch/);
 });
}
