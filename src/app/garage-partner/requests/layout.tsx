import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Garage partner requests","Manage private fitting requests for your garage partner account.");

export default function GaragePartnerRequestsLayout({children}:{children:React.ReactNode}){return children;}
