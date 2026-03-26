import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/common/Providers";

export const metadata: Metadata = {
  title: "BN Paper Trader | Bank Nifty F&O Simulator",
  description: "Real-time paper trading simulator for Bank Nifty Futures & Options with live market data and TradingView indicator support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
