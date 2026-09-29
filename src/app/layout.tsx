/**
 * @file Estructura HTML compartida, metadatos y estilos globales. Mantiene el marco común de todas
 * las rutas sin concentrar aquí las reglas de autorización de cada módulo.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Estructura HTML común y estilos globales de todas las páginas.
 */
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
