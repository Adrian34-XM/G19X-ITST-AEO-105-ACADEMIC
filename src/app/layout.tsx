import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nexo · Gestión de talento",
  description: "Reclutamiento, desarrollo y seguimiento de personas.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
