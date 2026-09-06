import { getCategories } from "@/lib/data/marketplace";

export const dynamic="force-dynamic";

const csv=(value:string)=>'"'+value.replaceAll('"','""')+'"';

export async function GET(){
 const categories=(await getCategories()).filter(category=>category.isSelectable);
 const body=[
  ["slug","name","transmission_related"],
  ...categories.map(category=>[category.slug,category.name,category.isTransmissionRelated?"yes":"no"])
 ].map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
 return new Response(body,{
  headers:{
   "content-type":"text/csv; charset=utf-8",
   "content-disposition":'attachment; filename="secondpart-category-reference.csv"',
   "cache-control":"public, max-age=3600"
  }
 });
}
