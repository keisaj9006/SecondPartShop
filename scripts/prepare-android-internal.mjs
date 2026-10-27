import {readFile,writeFile} from "node:fs/promises";
import {validateInternalOrigin} from "./android-internal-release-policy.mjs";

const internalOrigin=validateInternalOrigin(process.env.SECOND_PART_INTERNAL_URL);
const capacitorPath="capacitor.config.json";
const config=JSON.parse(await readFile(capacitorPath,"utf8"));

config.appId="com.secondpart.marketplace";
config.appName="SecondPart";
config.loggingBehavior="none";
config.android={...(config.android||{}),backgroundColor:"#173c31",webContentsDebuggingEnabled:false};
config.server={url:internalOrigin,cleartext:false};
config.plugins={...(config.plugins||{}),PushNotifications:{presentationOptions:["badge","sound","alert"]}};

await writeFile(capacitorPath,JSON.stringify(config,null,2)+"\n","utf8");
console.log("Prepared Android Internal QA for "+internalOrigin);
console.log("Internal QA package: "+config.appId);
