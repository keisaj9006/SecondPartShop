import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Inbox","Read your private SecondPart marketplace conversations.");

export default function InboxLayout({children}:{children:React.ReactNode}){return children;}
