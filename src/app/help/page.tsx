import Link from "next/link";
import { Header } from "@/components/header";

const faqs=[
 ["How do I find the right part?","Start with your registration when official DVSA lookup is configured, or select your vehicle manually. Then search by part name, OE/OEM number, category, brand or keyword."],
 ["What does Compatibility Confidence mean?","Confirmed means SecondPart has explicit fitment evidence for the selected configuration. Family match is useful supporting evidence but is not an exact-fit claim. Unverified means you should confirm with the seller before ordering."],
 ["Can I save my car?","Yes. Signed-in buyers can save exact vehicle configurations in SecondPart Garage and reuse them for future searches."],
 ["What if I cannot find a part?","Create a Part Request. Relevant sellers can see buyer demand without receiving your private account details or registration."],
 ["How do seller verification badges work?","Sellers request verification and an administrator reviews it. Sellers cannot assign the verified badge to themselves."],
 ["Are payments live yet?","No. The current preview does not process payments. The planned buyer-protection model will be implemented only with a regulated marketplace payment provider."]
] as const;

export default function HelpPage(){
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Help centre</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">How can we help?</h1><p className="mt-2 text-[#63706a]">Answers for the current SecondPart pre-launch marketplace.</p><div className="mt-8 grid gap-3">{faqs.map(([question,answer])=><details key={question} className="rounded-2xl border border-black/10 bg-white p-5"><summary className="cursor-pointer font-black">{question}</summary><p className="mt-3 text-sm leading-6 text-[#63706a]">{answer}</p></details>)}</div><div className="mt-8 flex flex-wrap gap-3"><Link href="/contact" className="rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Contact support</Link><Link href="/auth/forgot-password" className="rounded-xl border border-black/15 px-5 py-3 text-sm font-black">Reset password</Link><Link href="/buyer-protection" className="rounded-xl border border-black/15 px-5 py-3 text-sm font-black">Buyer protection plan</Link></div></main></>;
}
