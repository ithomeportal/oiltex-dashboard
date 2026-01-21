import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OilTex Price Dashboard",
  description: "OilTex Price Dashboard",
  metadataBase: new URL("https://index.oiltex.com"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
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
