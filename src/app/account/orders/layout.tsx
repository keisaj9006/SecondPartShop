import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Purchases","Track orders and delivery progress in your SecondPart account.");

export default function PurchasesLayout({children}:{children:React.ReactNode}){return children;}
