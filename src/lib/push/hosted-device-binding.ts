import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
const signatureFor=(payload:string)=>{
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)throw new Error("Push device binding unavailable.");
 const key=createHmac("sha256",secret).update("secondpart:hosted-push-device-cookie:v1").digest();
 return createHmac("sha256",key).update(payload).digest("base64url");
};
export function signHostedPushBinding(deviceId:string,version:number){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(deviceId)||!Number.isSafeInteger(version))throw new Error("Invalid push device binding.");
 const payload=`v1.${deviceId}.${version}`;
 return `${payload}.${signatureFor(payload)}`;
}
export function verifyHostedPushBinding(value:string){
 const match=/^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(value);
 if(!match)return null;
 try{
  const expected=Buffer.from(signatureFor(`v1.${match[1]}.${match[2]}`));
  const supplied=Buffer.from(match[3]);
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected)?{id:match[1],version:Number(match[2])}:null;
 }catch{return null;}
}
