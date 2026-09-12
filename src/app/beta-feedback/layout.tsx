import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Beta feedback","Send private product feedback to SecondPart.");

export default function BetaFeedbackLayout({children}:{children:React.ReactNode}){return children;}
