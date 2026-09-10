import type { Instrumentation } from "next";
import { reportOperationalError } from "@/lib/ops-monitoring";

export const onRequestError:Instrumentation.onRequestError=async(error,request,context)=>{
 await reportOperationalError({
  severity:"critical",
  component:"next_server",
  event:"uncaught_request_error",
  error,
  route:context.routePath||request.path,
  context:{
   method:request.method,
   routeType:context.routeType,
   routerKind:context.routerKind,
   renderSource:context.renderSource,
   revalidateReason:context.revalidateReason
  }
 });
};
