import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Seller dashboard","Manage your private SecondPart seller workspace.");

export default function DashboardLayout({children}:{children:React.ReactNode}){return children;}
