import type { PartTestingStatus } from "@/lib/types";

export function testingStatusLabel(status:PartTestingStatus){
 switch(status){
  case "tested_working":return "Tested working";
  case "removed_from_running_vehicle":return "Removed from running vehicle";
  case "visually_inspected":return "Visually inspected";
  case "untested":return "Untested";
  default:return "Testing not specified";
 }
}

export function warrantyLabel(days:number){
 if(days<=0)return "No seller warranty stated";
 if(days===30)return "30-day warranty";
 if(days===90)return "90-day warranty";
 if(days===180)return "6-month warranty";
 if(days===365)return "12-month warranty";
 return `${days}-day warranty`;
}
