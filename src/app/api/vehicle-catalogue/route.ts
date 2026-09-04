import { NextResponse } from "next/server";
import { getCatalogueEngines,getCatalogueMakes,getCatalogueModels,getCatalogueVariants,getCatalogueYears } from "@/lib/data/vehicle-catalogue";

export const dynamic="force-dynamic";
const clean=(value:string|null)=>value?.trim().slice(0,80)??"";

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const level=clean(searchParams.get("level"));
 try{
  if(level==="makes")return NextResponse.json({items:await getCatalogueMakes()},{headers:{"cache-control":"public, max-age=300"}});
  if(level==="models"){const make=clean(searchParams.get("make"));if(!make)return NextResponse.json({message:"Make is required."},{status:400});return NextResponse.json({items:await getCatalogueModels(make)},{headers:{"cache-control":"public, max-age=300"}});}
  if(level==="variants"){const make=clean(searchParams.get("make"));const model=clean(searchParams.get("model"));if(!make||!model)return NextResponse.json({message:"Make and model are required."},{status:400});return NextResponse.json({items:await getCatalogueVariants(make,model)},{headers:{"cache-control":"public, max-age=300"}});}
  if(level==="years"){const variantId=clean(searchParams.get("variantId"));if(!variantId)return NextResponse.json({message:"Variant is required."},{status:400});return NextResponse.json({items:await getCatalogueYears(variantId)},{headers:{"cache-control":"public, max-age=300"}});}
  if(level==="engines"){const variantId=clean(searchParams.get("variantId"));if(!variantId)return NextResponse.json({message:"Variant is required."},{status:400});return NextResponse.json({items:await getCatalogueEngines(variantId)},{headers:{"cache-control":"public, max-age=300"}});}
  return NextResponse.json({message:"Unknown catalogue level."},{status:400});
 }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Vehicle catalogue unavailable."},{status:500});}
}
