import type { Metadata, Viewport } from "next";
import { Quicksand, Inter } from "next/font/google";
import "./globals.css";

const display = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Delícias Manager",
  description: "Gestão de vendas, encomendas e clientes para o seu ateliê de doces.",
};

// Otimizado para uso em celulares Android: viewport travado, sem zoom acidental
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFF9FB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
