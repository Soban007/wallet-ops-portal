import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet Ops Portal",
  description: "Mini operations wallet portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="topbar__brand">Wallet Ops</span>
          <Nav />
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
