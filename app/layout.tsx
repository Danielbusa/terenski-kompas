import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terenski Kompas | SUSS",
  description: "Terenska aplikacija za obilazak, koordinaciju volontera i kontrolu izbornog dana.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn">
      <body className="antialiased">{children}</body>
    </html>
  );
}
