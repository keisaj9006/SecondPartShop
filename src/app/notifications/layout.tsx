import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/metadata";

export const metadata:Metadata=buildPrivateMetadata("Notifications","View private notifications for your SecondPart account.");

export default function NotificationsLayout({children}:{children:React.ReactNode}){return children;}
