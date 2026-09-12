import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Order messages","Read private messages about a SecondPart order.");

export default function MessagesLayout({children}:{children:React.ReactNode}){return children;}
