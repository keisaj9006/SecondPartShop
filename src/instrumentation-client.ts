import { reportClientError } from "@/lib/client-monitoring";

if(process.env.NODE_ENV==="production"){
 window.addEventListener("error",event=>{
  reportClientError(event.error??event.message,"window_error");
 });

 window.addEventListener("unhandledrejection",event=>{
  reportClientError(event.reason,"unhandled_rejection");
 });
}
