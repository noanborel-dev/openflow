import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenFlow — Speak naturally. Send without editing.",
  description:
    "Voice to clean, context-aware text — anywhere you can type. Bring your own keys, keep your audio private.",
  openGraph: {
    title: "OpenFlow",
    description:
      "Voice to clean text — anywhere you can type. Bring your own keys, keep your audio private.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenFlow",
    description:
      "Voice to clean text — anywhere you can type. Bring your own keys, keep your audio private.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
