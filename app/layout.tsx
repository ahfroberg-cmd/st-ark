// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "./sw-register";
import { TitleOverride } from "./TitleOverride";

export const metadata: Metadata = {
  title: {
    default: "ST-ARK",
    template: "%s | ST-ARK",
  },
  description: "PWA för ST-ARK – placeringar, delmål och kurser.",
  applicationName: "ST-ARK",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>
        <SWRegister />
        <TitleOverride />
        {children}
      </body>
    </html>
  );
}
