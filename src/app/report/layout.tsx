import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Report listing","Send a private marketplace safety report to SecondPart.");

export default function ReportLayout({children}:{children:React.ReactNode}){return children;}
