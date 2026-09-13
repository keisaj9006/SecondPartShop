import type { MetadataRoute } from "next";
import { getApprovedProductionOrigin,type MetadataEnvironment } from "@/lib/metadata";

export function buildRobots(environment?:MetadataEnvironment):MetadataRoute.Robots{
 const origin=getApprovedProductionOrigin(environment);
 if(!origin){
  return {rules:{userAgent:"*",disallow:"/"}};
 }
 return {
  rules:{userAgent:"*",allow:"/"},
  sitemap:`${origin}/sitemap.xml`
 };
}
