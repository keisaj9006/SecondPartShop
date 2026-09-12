import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Saved searches","Manage searches saved to your SecondPart account.");

export default function SavedSearchesLayout({children}:{children:React.ReactNode}){return children;}
