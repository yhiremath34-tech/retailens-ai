import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "RetaiLens AI — Autonomous Retail Operations & Intelligent Checkout Agent",
  description:
    "Autonomous retail operations platform combining computer vision shelf monitoring, POS verification, dynamic expiry pricing, persistent operational memory, and human-in-the-loop approvals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="bg-white text-slate-900 antialiased selection:bg-sky-200 selection:text-slate-950">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

