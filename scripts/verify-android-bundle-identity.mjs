import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const attribute=(source,name)=>source.match(new RegExp(`\\b${name}=["']([^"']+)["']`))?.[1]??null;

export function verifyBundleIdentity(manifest,expected){
 const actual={
  packageName:attribute(manifest,"package"),
  versionCode:attribute(manifest,"android:versionCode"),
  versionName:attribute(manifest,"android:versionName")
 };
 if(actual.packageName!==expected.packageName||actual.versionCode!==expected.versionCode||actual.versionName!==expected.versionName){
  throw new Error(`Final AAB identity mismatch: expected ${expected.packageName} ${expected.versionName} (${expected.versionCode}), received ${actual.packageName??"missing"} ${actual.versionName??"missing"} (${actual.versionCode??"missing"}).`);
 }
 return true;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [manifestPath,packageName,versionCode,versionName]=process.argv.slice(2);
 if(!manifestPath||!packageName||!versionCode||!versionName)throw new Error("Usage: verify-android-bundle-identity.mjs <manifest.xml> <package> <versionCode> <versionName>");
 verifyBundleIdentity(readFileSync(manifestPath,"utf8"),{packageName,versionCode,versionName});
 console.log(`Verified final AAB identity: ${packageName} ${versionName} (${versionCode}).`);
}
