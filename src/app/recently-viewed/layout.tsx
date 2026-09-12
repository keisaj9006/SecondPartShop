import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Recently viewed","View parts recently opened from your SecondPart account.");

export default function RecentlyViewedLayout({children}:{children:React.ReactNode}){return children;}
