import "server-only";

import { after } from "next/server";
import { dispatchPushOutbox } from "@/lib/push/dispatch";

export function schedulePushDispatch(limit=50){
 const safeLimit=Math.max(1,Math.min(Math.floor(limit),100));
 after(async()=>{
  try{
   await dispatchPushOutbox(safeLimit);
  }catch{
   return;
  }
 });
}
