import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import MigrationNotice from "./components/MigrationNotice";
import ServiceWorker from "./components/ServiceWorker";
import { currentProfile } from "../lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkForce Management",
  description: "Plan team capacity from the roster and assign tasks by availability.",
  robots: { index: false, follow: false }, // private staff data: never index
  applicationName: "WorkForce",
  appleWebApp: { capable: true, title: "WorkForce", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

// Mobile-first: edge-to-edge on notched phones (safe-area insets are handled in CSS).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0f1a",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await currentProfile();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} app-body`}
      >
        <Sidebar user={profile} />
        <main className="main-content">
          <MigrationNotice />
          {children}
        </main>
        <ServiceWorker />
      </body>
    </html>
  );
}
