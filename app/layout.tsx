import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cosmo — Explore the world",
  description: "A multilingual AI assistant for questions across every field.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
