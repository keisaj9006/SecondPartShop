import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/data/marketplace";

export const dynamic="force-dynamic";

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const query=(searchParams.get("q")??"").trim().slice(0,120);
 if(query.length<2)return NextResponse.json({categories:[],listings:[],numbers:[],brands:[]},{headers:{"cache-control":"no-store"}});
 try{
  const result=await getSearchSuggestions(query);
  return NextResponse.json(result,{headers:{"cache-control":"private, max-age=30"}});
 }catch{
  return NextResponse.json({categories:[],listings:[],numbers:[],brands:[]},{status:200,headers:{"cache-control":"no-store"}});
 }
}
