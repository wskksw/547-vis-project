import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAG Diagnostics Dashboard",
  description:
    "Interactive visualization system for analyzing retrieval-augmented generation course chatbots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 antialiased`}
      >
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                547 · Instructor Tools
              </p>
              <p className="text-lg font-semibold text-zinc-900">
                RAG Diagnostics Dashboard
              </p>
            </div>
          </header>
          <main className="flex-1 bg-zinc-50">{children}</main>
        </div>
      </body>
    </html>
  );
}
