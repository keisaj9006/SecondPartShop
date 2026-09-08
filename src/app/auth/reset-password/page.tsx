import { Header } from "@/components/header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const mobileReturn=first(query.mobile)==="1";
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><ResetPasswordForm mobileReturn={mobileReturn}/></main></>;
}
