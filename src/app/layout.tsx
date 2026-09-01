import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Panel wyników XTB",
  description:
    "Import historii transakcji XTB, wykres wpłat i zysku oraz łączna i roczna stopa zwrotu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-100 font-sans text-stone-900">{children}</body>
    </html>
  );
}
