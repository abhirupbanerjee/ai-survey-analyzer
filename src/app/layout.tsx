import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next"; // Add this import


export const metadata: Metadata = {
  title: "Caribbean AI Survey Assistant",
  description: "AI-powered survey analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Analytics /> {/* Add this component */}
      </body>
    </html>
  );
}