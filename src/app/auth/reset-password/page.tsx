import { Header } from "@/components/header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic="force-dynamic";

export default function ResetPasswordPage(){
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><ResetPasswordForm/></main></>;
}
