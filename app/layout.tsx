// app/layout.tsx
//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "./sw-register";
import { TitleOverride } from "./TitleOverride";
import BetaGuard from "@/components/BetaGuard";
import GlobalEscHandler from "@/components/GlobalEscHandler";

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
        <GlobalEscHandler />
        <SWRegister />
        <TitleOverride />
        <BetaGuard>{children}</BetaGuard>
      </body>
    </html>
  );
}
