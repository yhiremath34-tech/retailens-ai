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
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="antialiased selection:bg-blue-500/30 selection:text-cyan-100">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

