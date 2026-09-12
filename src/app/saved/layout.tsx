import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Saved parts","View parts saved to your SecondPart account.");

export default function SavedLayout({children}:{children:React.ReactNode}){return children;}
