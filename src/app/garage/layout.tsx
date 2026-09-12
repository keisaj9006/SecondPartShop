import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Garage","Manage the vehicles saved to your SecondPart account.");

export default function GarageLayout({children}:{children:React.ReactNode}){return children;}
