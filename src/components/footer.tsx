import Link from "next/link";

export function Footer(){
 return <footer className="border-t border-black/10 bg-[#f8f7f2]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 py-8 text-sm sm:flex-row sm:px-6"><div><Link href="/" className="font-black">SecondPart</Link><p className="mt-1 text-xs text-[#63706a]">The right part. First time.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold"><Link href="/help">Help</Link><Link href="/contact">Contact</Link><Link href="/buyer-protection">Buyer protection</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></div></footer>;
}
