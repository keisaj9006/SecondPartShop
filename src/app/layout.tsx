import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { PwaRegister } from "@/components/pwa-register";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { NativeAppMode } from "@/components/native-app-mode";
import { NativeTopBar } from "@/components/native-top-bar";
import { buildRootMetadata } from "@/lib/metadata";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = buildRootMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <PwaRegister />
        <NativeAppMode />
        <div className="flex min-h-screen flex-col">
          <NativeTopBar />
          <div className="flex-1 pb-24 md:pb-0">{children}</div>
          <div className="hidden md:block"><Footer /></div>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
