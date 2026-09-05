import { NextResponse } from "next/server";
import { getCatalogueEngines,getCatalogueMakes,getCatalogueModels,getCatalogueVariants,getCatalogueVariantsForModelYear,getCatalogueYears,getCatalogueYearsForModel } from "@/lib/data/vehicle-catalogue";

export const dynamic="force-dynamic";
const clean=(value:string|null)=>value?.trim().slice(0,100)??"";
const yearValue=(value:string|null)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=1900&&parsed<=2100?parsed:null;};

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const level=clean(searchParams.get("level"));
 try{
  if(level==="makes")return NextResponse.json({items:await getCatalogueMakes()},{headers:{"cache-control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"}});
  if(level==="models"){const make=clean(searchParams.get("make"));if(!make)return NextResponse.json({message:"Make is required."},{status:400});return NextResponse.json({items:await getCatalogueModels(make)},{headers:{"cache-control":"public, max-age=1800"}});}
  if(level==="years-model"){const make=clean(searchParams.get("make"));const model=clean(searchParams.get("model"));if(!make||!model)return NextResponse.json({message:"Make and model are required."},{status:400});return NextResponse.json({items:await getCatalogueYearsForModel(make,model)},{headers:{"cache-control":"public, max-age=1800"}});}
  if(level==="variants-year"){const make=clean(searchParams.get("make"));const model=clean(searchParams.get("model"));const year=yearValue(searchParams.get("year"));if(!make||!model||!year)return NextResponse.json({message:"Make, model and year are required."},{status:400});return NextResponse.json({items:await getCatalogueVariantsForModelYear(make,model,year)},{headers:{"cache-control":"public, max-age=1800"}});}
  if(level==="variants"){const make=clean(searchParams.get("make"));const model=clean(searchParams.get("model"));if(!make||!model)return NextResponse.json({message:"Make and model are required."},{status:400});return NextResponse.json({items:await getCatalogueVariants(make,model)},{headers:{"cache-control":"public, max-age=1800"}});}
  if(level==="years"){const variantId=clean(searchParams.get("variantId"));if(!variantId)return NextResponse.json({message:"Variant is required."},{status:400});return NextResponse.json({items:await getCatalogueYears(variantId)},{headers:{"cache-control":"public, max-age=1800"}});}
  if(level==="engines"){const variantId=clean(searchParams.get("variantId"));if(!variantId)return NextResponse.json({message:"Variant is required."},{status:400});return NextResponse.json({items:await getCatalogueEngines(variantId)},{headers:{"cache-control":"public, max-age=1800"}});}
  return NextResponse.json({message:"Unknown catalogue level."},{status:400});
 }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Vehicle catalogue unavailable."},{status:500});}
}
