// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "ST-intyg",
  description: "PWA för ST-intyg – placeringar, delmål och kurser.",
  applicationName: "ST-intyg",
  manifest: "/manifest.webmanifest", // byt till .webmanifest
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png" }
    ]
  },
  themeColor: "#0ea5e9",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
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
        {children}
      </body>
    </html>
  );
}
