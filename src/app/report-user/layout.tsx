import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Report user","Send a private user safety report to SecondPart.");

export default function ReportUserLayout({children}:{children:React.ReactNode}){return children;}
