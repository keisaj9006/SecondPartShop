import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Fitting request","View a private SecondPart fitting request.");

export default function FittingLayout({children}:{children:React.ReactNode}){return children;}
