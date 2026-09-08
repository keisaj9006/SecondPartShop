import {timingSafeEqual} from "node:crypto";
import {dispatchPushOutbox} from "@/lib/push/dispatch";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const authorized=(request:Request)=>{
 const secret=String(process.env.PUSH_DISPATCH_SECRET??process.env.CRON_SECRET??"").trim();
 if(!secret)return false;
 const header=String(request.headers.get("authorization")??"");
 const provided=header.toLowerCase().startsWith("bearer ")?header.slice(7).trim():"";
 if(!provided||provided.length!==secret.length)return false;
 return timingSafeEqual(Buffer.from(provided),Buffer.from(secret));
};

async function dispatch(request:Request){
 if(!String(process.env.PUSH_DISPATCH_SECRET??process.env.CRON_SECRET??"").trim()){
  return Response.json({ok:false,error:"push_dispatch_not_configured"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
 if(!authorized(request))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{
  const result=await dispatchPushOutbox(20);
  if(result.skipped)return Response.json({ok:false,error:"firebase_push_not_configured"},{status:503,headers:{"Cache-Control":"no-store"}});
  return Response.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const code=error instanceof Error?error.message:"push_dispatch_failed";
  return Response.json({ok:false,error:code},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}

export async function GET(request:Request){return dispatch(request);}
export async function POST(request:Request){return dispatch(request);}
