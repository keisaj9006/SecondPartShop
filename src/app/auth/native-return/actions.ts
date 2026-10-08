"use server";
import {detachHostedPushDevice} from "@/lib/push/hosted-device";
import {finishAuthReturn} from "@/lib/auth-return";
import {safeInternalPath} from "@/lib/navigation";
export async function completeNativeAuthReturn(flow:"callback"|"confirm",query:string):Promise<{ok:true;href:string}|{ok:false}>{
 if(!["callback","confirm"].includes(flow)||typeof query!=="string"||query.length>16000)return {ok:false};
 if(!await detachHostedPushDevice())return {ok:false};
 // Called after the client lock: createSupabaseServerClient reads this action's fresh cookies.
 const request=new Request(`https://secondpart.internal/auth/${flow}?${query}`);
 const response=await finishAuthReturn(request,flow);
 const location=response.headers.get("location");
 if(!location)return {ok:false};
 const url=new URL(location);
 if(url.origin!=="https://secondpart.internal")return {ok:false};
 return {ok:true,href:safeInternalPath(url.pathname+url.search+url.hash,"/account")};
}
