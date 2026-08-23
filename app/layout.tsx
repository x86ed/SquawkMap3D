import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Matches adsb.win's dashboard font (Inter) — used for the airport popup
// card, which is styled to match that site's aircraft cards (see
// `.airport-popup` in globals.css and components/map/airportPopup.ts).
// `preload: false`: the popup only renders after a map click, so eagerly
// preloading it on every page load just triggers the browser's "preloaded
// but not used within a few seconds" warning.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "SquawkMap3D",
  description: "an adsb map",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
