import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OilTex Price Dashboard",
  description: "WTI Crude Oil Pricing Dashboard for New Mexico Purchases",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
