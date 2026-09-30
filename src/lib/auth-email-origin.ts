const normalizeOrigin=(value:string|null|undefined)=>{
 const raw=value?.trim();
 if(!raw)return null;
 const withProtocol=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
 try{
  const url=new URL(withProtocol);
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return null;
  return url.origin;
 }catch{return null;}
};

export function resolveAuthEmailOrigin(input:{
 configuredOrigin:string;
 requestOrigin?:string|null;
 vercelEnv?:string|null;
 vercelBranchUrl?:string|null;
 vercelUrl?:string|null;
}){
 const configured=normalizeOrigin(input.configuredOrigin)??"http://localhost:3000";
 const branch=normalizeOrigin(input.vercelBranchUrl);
 const deployment=normalizeOrigin(input.vercelUrl);
 const request=input.requestOrigin?.trim();
 // Origin is untrusted: accept only an exact server-configured origin, never
 // arbitrary *.vercel.app hosts, forwarded hosts, URL paths or credentials.
 const allowed=[configured,branch,deployment].filter((origin):origin is string=>Boolean(origin));
 if(request&&allowed.includes(request)&&(
  request.startsWith("https://")||(!input.vercelEnv&&request===configured)
 ))return request;
 if(input.vercelEnv!=="preview")return configured;
 return branch??deployment??configured;
}
