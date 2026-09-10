import "server-only";

export type OpsSeverity="warning"|"error"|"critical";
export type OpsComponent=
 |"next_server"
 |"client"
 |"checkout"
 |"stripe_webhook"
 |"commerce_maintenance"
 |"payout"
 |"push"
 |"account_deletion"
 |"reconciliation";

type OpsContextValue=string|number|boolean|null|undefined;
type OpsContext=Record<string,OpsContextValue>;

export type CriticalAlertDeliveryResult={
 delivered:boolean;
 reason:"delivered"|"not_configured"|"invalid_url"|"http_error"|"network_error";
 status?:number;
};

const MAX_MESSAGE=700;
const MAX_STACK=1800;
const MAX_CONTEXT_VALUE=240;

export function sanitizeMonitoringText(value:unknown,max=MAX_MESSAGE){
 const raw=String(value??"").slice(0,Math.max(1,max*2));
 return raw
  .replace(/https?:\/\/[^\s]+/gi,match=>{
   try{
    const url=new URL(match);
    return url.origin+url.pathname;
   }catch{return "[redacted-url]";}
  })
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[redacted-email]")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,"[redacted-id]")
  .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_-]+\b/g,"[redacted-token]")
  .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,"Bearer [redacted-token]")
  .slice(0,max);
}

const errorDetails=(error:unknown)=>{
 if(error instanceof Error){
  const digest="digest" in error&&typeof (error as Error&{digest?:unknown}).digest==="string"
   ?sanitizeMonitoringText((error as Error&{digest:string}).digest,120)
   :undefined;
  return {
   errorName:sanitizeMonitoringText(error.name||"Error",80),
   message:sanitizeMonitoringText(error.message||"Unknown error"),
   stack:error.stack?sanitizeMonitoringText(error.stack,MAX_STACK):undefined,
   digest
  };
 }
 return {
  errorName:"NonError",
  message:sanitizeMonitoringText(error)
 };
};

const cleanContext=(context:OpsContext|undefined)=>{
 const result:Record<string,string|number|boolean|null>={};
 for(const [key,value] of Object.entries(context??{})){
  if(value===undefined)continue;
  if(typeof value==="string")result[key.slice(0,60)]=sanitizeMonitoringText(value,MAX_CONTEXT_VALUE);
  else if(typeof value==="number"||typeof value==="boolean"||value===null)result[key.slice(0,60)]=value;
 }
 return result;
};

const webhookPayload=(record:Record<string,unknown>)=>{
 const kind=process.env.OPS_ALERT_WEBHOOK_KIND?.trim().toLowerCase();
 const summary=`[SecondPart] ${String(record.severity).toUpperCase()} · ${String(record.component)}/${String(record.event)} · ${String(record.message)}`;
 if(kind==="slack")return {text:summary};
 if(kind==="discord")return {content:summary.slice(0,1900)};
 return record;
};

async function sendCriticalAlert(record:Record<string,unknown>):Promise<CriticalAlertDeliveryResult>{
 const rawUrl=process.env.OPS_ALERT_WEBHOOK_URL?.trim();
 if(!rawUrl)return {delivered:false,reason:"not_configured"};
 let url:URL;
 try{url=new URL(rawUrl);}catch{return {delivered:false,reason:"invalid_url"};}
 if(url.protocol!=="https:")return {delivered:false,reason:"invalid_url"};

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1500);
 try{
  const headers=new Headers({"content-type":"application/json"});
  const token=process.env.OPS_ALERT_WEBHOOK_TOKEN?.trim();
  if(token)headers.set("authorization",`Bearer ${token}`);
  const response=await fetch(url,{method:"POST",headers,body:JSON.stringify(webhookPayload(record)),signal:controller.signal,cache:"no-store"});
  if(!response.ok){
   console.warn("SECOND_PART_ALERT_DELIVERY_FAILED",`HTTP ${response.status}`);
   return {delivered:false,reason:"http_error",status:response.status};
  }
  return {delivered:true,reason:"delivered",status:response.status};
 }catch(error){
  console.warn("SECOND_PART_ALERT_DELIVERY_FAILED",sanitizeMonitoringText(error,240));
  return {delivered:false,reason:"network_error"};
 }finally{
  clearTimeout(timer);
 }
}

const baseRecord=(input:{severity:OpsSeverity;component:OpsComponent;event:string;message:string;route?:string;context?:OpsContext})=>({
 type:"secondpart_ops",
 severity:input.severity,
 component:input.component,
 event:sanitizeMonitoringText(input.event,100),
 message:sanitizeMonitoringText(input.message),
 route:input.route?sanitizeMonitoringText(input.route.split("?")[0],240):undefined,
 context:cleanContext(input.context),
 environment:process.env.VERCEL_ENV??process.env.NODE_ENV??"unknown",
 release:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)??null,
 timestamp:new Date().toISOString()
});

export async function reportOperationalError(input:{
 severity?:"error"|"critical";
 component:OpsComponent;
 event:string;
 error:unknown;
 route?:string;
 context?:OpsContext;
}){
 const details=errorDetails(input.error);
 const record={
  ...baseRecord({
   severity:input.severity??"error",
   component:input.component,
   event:input.event,
   message:details.message,
   route:input.route,
   context:input.context
  }),
  errorName:details.errorName,
  stack:details.stack,
  digest:details.digest
 };
 console.error("SECOND_PART_OPS",JSON.stringify(record));
 if(record.severity==="critical")await sendCriticalAlert(record);
 return record;
}

export function reportOperationalWarning(input:{
 component:OpsComponent;
 event:string;
 message:string;
 route?:string;
 context?:OpsContext;
}){
 const record=baseRecord({
  severity:"warning",
  component:input.component,
  event:input.event,
  message:input.message,
  route:input.route,
  context:input.context
 });
 console.warn("SECOND_PART_OPS",JSON.stringify(record));
 return record;
}

export async function sendCriticalAlertSmokeTest():Promise<CriticalAlertDeliveryResult>{
 const record=baseRecord({
  severity:"critical",
  component:"commerce_maintenance",
  event:"manual_alert_smoke_test",
  message:"SecondPart production critical-alert smoke test.",
  route:"/admin/system/alerts",
  context:{kind:"manual_smoke_test"}
 });
 console.error("SECOND_PART_OPS",JSON.stringify(record));
 return sendCriticalAlert(record);
}
