type ClientErrorKind="window_error"|"unhandled_rejection"|"react_error_boundary";

const seen=new Map<string,number>();

const text=(value:unknown,max:number)=>{
 if(value instanceof Error)return value.message.slice(0,max);
 return String(value??"").slice(0,max);
};

export function reportClientError(error:unknown,kind:ClientErrorKind){
 if(typeof window==="undefined"||process.env.NODE_ENV!=="production")return;

 const name=error instanceof Error?error.name:"ClientError";
 const message=text(error,700);
 const stack=error instanceof Error&&error.stack?error.stack.slice(0,1800):undefined;
 const path=window.location.pathname.slice(0,240);
 const key=`${kind}|${name}|${message}|${path}`;
 const now=Date.now();
 const previous=seen.get(key)??0;
 if(now-previous<15000)return;
 seen.set(key,now);
 if(seen.size>30){
  for(const [item,timestamp] of seen){
   if(now-timestamp>60000)seen.delete(item);
  }
 }

 void fetch("/api/ops/client-error",{
  method:"POST",
  headers:{"content-type":"application/json"},
  credentials:"same-origin",
  keepalive:true,
  body:JSON.stringify({kind,name,message,stack,path})
 }).catch(()=>undefined);
}
