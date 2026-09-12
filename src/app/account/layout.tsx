import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Account","Manage your SecondPart buyer and seller account.");

export default function AccountLayout({children}:{children:React.ReactNode}){return children;}
