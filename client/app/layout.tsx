import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserAuthenticationProvider } from "./UserAuthentication";
import Sidebar from "./sidebar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dreams come chuu",
  description: "Maid cafe management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <UserAuthenticationProvider>
          <Sidebar />
          {/* Desktop: offset by sidebar width; Mobile: offset by top bar height */}
          <main className="md:ml-64 pt-14 md:pt-0 min-h-screen">
            {children}
          </main>
          <Toaster />
        </UserAuthenticationProvider>
      </body>
    </html>
  );
}
