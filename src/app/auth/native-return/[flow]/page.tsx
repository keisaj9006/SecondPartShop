import {notFound} from "next/navigation";
import {NativeAuthContinuation} from "@/components/native-auth-continuation";
export const dynamic="force-dynamic";
export default async function NativeReturnPage({params,searchParams}:{params:Promise<{flow:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {flow}=await params;
 if(flow!=="callback"&&flow!=="confirm")notFound();
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){
  if(Array.isArray(value))for(const entry of value)query.append(key,entry);
  else if(value!==undefined)query.append(key,value);
 }
 return <main className="mx-auto max-w-xl px-4 py-16"><NativeAuthContinuation flow={flow} query={query.toString()}/></main>;
}
