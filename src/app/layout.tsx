import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/common/Providers";
import { StatusBar } from "@/components/common/StatusBar";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAHAAI Paper Trading",
  description: "Real-time paper trading simulator for Bank Nifty Futures & Options with live market data",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SAHAAI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#745b00",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('wu-theme');
                if (t && t !== 'light') document.documentElement.dataset.theme = t;
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={plusJakartaSans.className}>
        <Providers>
          {children}
          <StatusBar />
        </Providers>
      </body>
    </html>
  );
}
