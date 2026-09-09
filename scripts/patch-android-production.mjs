import {readFile,writeFile} from "node:fs/promises";

const versionCode=String(process.env.SECOND_PART_VERSION_CODE||"").trim();
const versionName=String(process.env.SECOND_PART_VERSION_NAME||"").trim();
if(!/^\d+$/.test(versionCode)||Number(versionCode)<1)throw new Error("SECOND_PART_VERSION_CODE must be a positive integer.");
if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName))throw new Error("SECOND_PART_VERSION_NAME must look like 1.0.0.");

const manifestPath="android/app/src/main/AndroidManifest.xml";
let manifest=await readFile(manifestPath,"utf8");
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
 manifest=next;
 await writeFile(manifestPath,manifest,"utf8");
}

const variablesPath="android/variables.gradle";
let variables=await readFile(variablesPath,"utf8");
variables=variables
 .replace(/compileSdkVersion\s*=\s*\d+/,"compileSdkVersion = 36")
 .replace(/targetSdkVersion\s*=\s*\d+/,"targetSdkVersion = 36");
if(!/compileSdkVersion\s*=\s*36/.test(variables)||!/targetSdkVersion\s*=\s*36/.test(variables)){
 throw new Error("Could not enforce Android API 36 in variables.gradle");
}
await writeFile(variablesPath,variables,"utf8");

const gradlePath="android/app/build.gradle";
let gradle=await readFile(gradlePath,"utf8");
gradle=gradle
 .replace(/versionCode\s+\d+/,`versionCode ${versionCode}`)
 .replace(/versionName\s+"[^"]+"/,`versionName "${versionName}"`);

if(!gradle.includes("secondPartReleaseSigning")){
 const androidMarker="android {";
 if(!gradle.includes(androidMarker))throw new Error("Could not locate android block in app/build.gradle");
 gradle=gradle.replace(androidMarker,`${androidMarker}
    signingConfigs {
        secondPartReleaseSigning {
            def keystorePath = System.getenv("SECOND_PART_RELEASE_KEYSTORE")
            def storePass = System.getenv("ANDROID_RELEASE_STORE_PASSWORD")
            def keyAliasValue = System.getenv("ANDROID_RELEASE_KEY_ALIAS")
            def keyPass = System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
            if (!keystorePath || !storePass || !keyAliasValue || !keyPass) {
                throw new GradleException("Production signing environment is incomplete.")
            }
            storeFile file(keystorePath)
            storePassword storePass
            keyAlias keyAliasValue
            keyPassword keyPass
        }
    }`);

 const releaseMarker="        release {";
 if(!gradle.includes(releaseMarker))throw new Error("Could not locate release build type in app/build.gradle");
 gradle=gradle.replace(releaseMarker,`${releaseMarker}
            signingConfig signingConfigs.secondPartReleaseSigning`);
}

if(!gradle.includes(`versionCode ${versionCode}`)||!gradle.includes(`versionName "${versionName}"`)){
 throw new Error("Could not set Android production version.");
}
await writeFile(gradlePath,gradle,"utf8");
console.log(`Patched Android Production v${versionName} (${versionCode}) for API 36.`);
