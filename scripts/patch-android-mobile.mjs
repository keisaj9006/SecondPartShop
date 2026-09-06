import { readFile,writeFile } from "node:fs/promises";

const manifestPath="android/app/src/main/AndroidManifest.xml";
const manifest=await readFile(manifestPath,"utf8");

if(!manifest.includes('android:scheme="secondpart"')){
 const marker="</activity>";
 const intent=[
  "            <intent-filter>",
  '                <action android:name="android.intent.action.VIEW" />',
  '                <category android:name="android.intent.category.DEFAULT" />',
  '                <category android:name="android.intent.category.BROWSABLE" />',
  '                <data android:scheme="secondpart" />',
  "            </intent-filter>",
  "        "
 ].join("\n");
 const next=manifest.replace(marker,intent+marker);
 if(next===manifest)throw new Error("Could not locate MainActivity in AndroidManifest.xml");
 await writeFile(manifestPath,next,"utf8");
}
