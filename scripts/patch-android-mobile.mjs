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


const gradlePath="android/app/build.gradle";
let gradle=await readFile(gradlePath,"utf8");

if(!gradle.includes("secondPartPreviewSigning")){
 const androidMarker="android {";
 if(!gradle.includes(androidMarker))throw new Error("Could not locate android block in app/build.gradle");
 gradle=gradle.replace(androidMarker,`${androidMarker}
    signingConfigs {
        secondPartPreviewSigning {
            storeFile file(System.getProperty("user.home") + "/.android/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);

 const buildTypesMarker="    buildTypes {";
 if(!gradle.includes(buildTypesMarker))throw new Error("Could not locate buildTypes block in app/build.gradle");
 gradle=gradle.replace(buildTypesMarker,`${buildTypesMarker}
        debug {
            signingConfig signingConfigs.secondPartPreviewSigning
        }`);
 await writeFile(gradlePath,gradle,"utf8");
}
