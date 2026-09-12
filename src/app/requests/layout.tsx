import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Part requests","Manage part requests from your SecondPart account.");

export default function RequestsLayout({children}:{children:React.ReactNode}){return children;}
