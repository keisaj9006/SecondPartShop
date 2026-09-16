const normalizeOrigin=(value:string|null|undefined)=>{
 const raw=value?.trim();
 if(!raw)return null;
 const withProtocol=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
 try{return new URL(withProtocol).origin;}catch{return null;}
};

export function resolveAuthEmailOrigin(input:{
 configuredOrigin:string;
 vercelEnv?:string|null;
 vercelBranchUrl?:string|null;
}){
 const configured=normalizeOrigin(input.configuredOrigin)??"http://localhost:3000";
 if(input.vercelEnv!=="preview")return configured;
 return normalizeOrigin(input.vercelBranchUrl)??configured;
}
