import {readFile,writeFile} from "node:fs/promises";

const path="android/app/build.gradle";
let gradle=await readFile(path,"utf8");
const buildTypes="    buildTypes {";
const release="        release {";
if(!gradle.includes(buildTypes)||!gradle.includes(release))throw new Error("Could not locate Android release build type.");

gradle=gradle.replace(
 release,
 release+"\n            signingConfig signingConfigs.release"
);

const signingConfig=[
 "    signingConfigs {",
 "        release {",
 "            def keyPath = System.getenv(\"SECOND_PART_KEYSTORE_PATH\")",
 "            if (keyPath == null || keyPath.isEmpty()) throw new GradleException(\"SECOND_PART_KEYSTORE_PATH is missing\")",
 "            storeFile file(keyPath)",
 "            storePassword System.getenv(\"ANDROID_KEYSTORE_PASSWORD\")",
 "            keyAlias System.getenv(\"ANDROID_KEY_ALIAS\")",
 "            keyPassword System.getenv(\"ANDROID_KEY_PASSWORD\")",
 "        }",
 "    }",
 ""
].join("\n");

gradle=gradle.replace(buildTypes,signingConfig+buildTypes);
await writeFile(path,gradle,"utf8");
console.log("Configured Android release signing from environment secrets.");
