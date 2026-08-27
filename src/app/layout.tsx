import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apéro Party",
  description: "Le jeu de plateau de soirée. Trouve les étoiles, distribue les gorgées.",
};

export const viewport: Viewport = {
  themeColor: "#bfe8ff",
  width: "device-width",
  initialScale: 1,
  // Le plateau a son propre zoom : le pinch du navigateur ne ferait que gêner.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
