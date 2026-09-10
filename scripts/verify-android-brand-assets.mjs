import {readFile,readdir} from "node:fs/promises";
import {join,relative} from "node:path";

const root="android/app/src/main/res";

async function filesUnder(dir){
 const entries=await readdir(dir,{withFileTypes:true});
 const result=[];
 for(const entry of entries){
  const path=join(dir,entry.name);
  if(entry.isDirectory())result.push(...await filesUnder(path));
  else result.push(path);
 }
 return result;
}

const source=await readFile("assets/android-production/logo.svg","utf8");
if(!source.includes("#d4f44d")||!source.includes("#ffffff")){
 throw new Error("Android brand source is missing the approved SecondPart foreground palette.");
}
if(source.includes("<text")){
 throw new Error("Android brand source must use vector paths, not host-dependent text rendering.");
}

const files=await filesUnder(root);
const normalized=files.map(path=>relative(root,path).replaceAll("\\","/"));
const launcher=normalized.filter(path=>/ic_launcher(?:_round|_foreground|_background)?\.(?:png|webp|xml)$/i.test(path));
const splash=normalized.filter(path=>/(?:^|\/)splash\.(?:png|webp|xml)$/i.test(path));
const adaptive=normalized.filter(path=>path.includes("mipmap-anydpi-v26/")&&/ic_launcher(?:_round)?\.xml$/i.test(path));

if(launcher.length<5){
 throw new Error(`Generated Android branding is incomplete: only ${launcher.length} launcher resource(s) found.`);
}
if(!adaptive.length){
 throw new Error("Generated Android branding is missing API 26+ adaptive launcher XML.");
}
if(!splash.length){
 throw new Error("Generated Android branding is missing splash resources.");
}

for(const path of adaptive){
 const xml=await readFile(join(root,path),"utf8");
 if(!xml.includes("background")||!xml.includes("foreground")){
  throw new Error(`Adaptive icon ${path} does not define foreground/background layers.`);
 }
}

console.log(`Android brand assets verified: ${launcher.length} launcher resource(s), ${adaptive.length} adaptive XML file(s), ${splash.length} splash resource(s).`);
