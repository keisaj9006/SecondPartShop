import Link from "next/link";
import { Header } from "@/components/header";
import { DonorVehicleForm } from "@/components/donor-vehicle-form";
import { requireSeller } from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function NewDonorVehiclePage(){
 await requireSeller("/dashboard/donors/new");
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard/donors" className="text-sm font-bold underline">Back to donor vehicles</Link><h1 className="mt-5 text-4xl font-black tracking-[-.045em]">Add donor vehicle</h1><p className="mt-2 max-w-2xl text-[#63706a]">Capture the donor once. Parts you list later can reference this vehicle without re-entering the same data.</p><DonorVehicleForm/></main></>;
}
