import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { PwaRegister } from "@/components/pwa-register";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { NativeAppMode } from "@/components/native-app-mode";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SecondPart — The right part. First time.",
  description: "Find verified used automotive parts from trusted UK garages.",
  applicationName: "SecondPart",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    title: "SecondPart",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <PwaRegister />
        <NativeAppMode />
        <div className="flex min-h-screen flex-col">
          <div className="flex-1 pb-24 md:pb-0">{children}</div>
          <div className="hidden md:block"><Footer /></div>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
