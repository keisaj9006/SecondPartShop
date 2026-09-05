import { Header } from "@/components/header";
import { ResendVerificationForm } from "@/components/resend-verification-form";

export const dynamic="force-dynamic";

export default function VerifyEmailPage(){
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><ResendVerificationForm/></main></>;
}
