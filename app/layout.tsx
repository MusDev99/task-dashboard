import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import MigrationNotice from "./components/MigrationNotice";
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await currentProfile();
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ margin: 0, display: "flex", minHeight: "100vh" }}
      >
        <Sidebar user={profile} />
        <main className="main-content">
          <MigrationNotice />
          {children}
        </main>
      </body>
    </html>
  );
}
