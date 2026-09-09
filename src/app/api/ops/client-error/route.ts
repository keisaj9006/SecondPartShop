import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { reportOperationalError,sanitizeMonitoringText } from "@/lib/ops-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const allowedKinds=new Set(["window_error","unhandled_rejection","react_error_boundary"]);

const sameOrigin=(request:Request)=>{
 const origin=request.headers.get("origin");
 const host=request.headers.get("host");
 if(!origin||!host)return true;
 try{return new URL(origin).host===host;}catch{return false;}
};

export async function POST(request:Request){
 if(!sameOrigin(request))return new NextResponse(null,{status:403});

 const contentLength=Number(request.headers.get("content-length")??0);
 if(Number.isFinite(contentLength)&&contentLength>8192)return new NextResponse(null,{status:413});

 let payload:unknown;
 try{payload=await request.json();}catch{return new NextResponse(null,{status:400});}
 if(!payload||typeof payload!=="object")return new NextResponse(null,{status:400});
 const input=payload as Record<string,unknown>;

 const kind=String(input.kind??"");
 if(!allowedKinds.has(kind))return new NextResponse(null,{status:400});

 const salt=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!salt)return new NextResponse(null,{status:204});

 const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
 const userAgent=request.headers.get("user-agent")?.slice(0,240)??"unknown";
 const keyHash=createHash("sha256").update(`${salt.slice(-48)}|${forwarded}|${userAgent}`).digest("hex");

 try{
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("consume_ops_client_error_rate_limit",{
   p_key_hash:keyHash,
   p_limit:12,
   p_window_seconds:600
  });
  if(error||!data?.[0]?.allowed)return new NextResponse(null,{status:204});

  const browserError=new Error(sanitizeMonitoringText(input.message,700));
  browserError.name=sanitizeMonitoringText(input.name||"ClientError",80);
  if(typeof input.stack==="string")browserError.stack=sanitizeMonitoringText(input.stack,1800);

  await reportOperationalError({
   component:"client",
   event:kind,
   error:browserError,
   route:typeof input.path==="string"?input.path:"/"
  });
 }catch{
  // Monitoring must never become a user-facing application failure.
 }

 return new NextResponse(null,{status:204});
}
