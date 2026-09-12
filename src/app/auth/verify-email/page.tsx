import { Header } from "@/components/header";
import { ResendVerificationForm } from "@/components/resend-verification-form";
import { safeInternalPath } from "@/lib/navigation";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const requestedReturnTo=first((await searchParams).returnTo);
 const returnTo=requestedReturnTo===undefined?undefined:safeInternalPath(requestedReturnTo,"")||undefined;
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><ResendVerificationForm returnTo={returnTo}/></main></>;
}
