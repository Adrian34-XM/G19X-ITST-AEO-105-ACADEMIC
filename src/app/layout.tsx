/**
 * @file Estructura HTML compartida, metadatos y estilos globales. Mantiene el marco común de todas
 * las rutas sin concentrar aquí las reglas de autorización de cada módulo.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Estructura HTML común y estilos globales de todas las páginas.
 */
import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="es" suppressHydrationWarning>
      <Script
        id="nexo-theme"
        strategy="beforeInteractive"
      >{`try { var theme = localStorage.getItem('nexo-theme'); document.documentElement.dataset.theme = theme === 'dark' || theme === 'light' ? theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { document.documentElement.dataset.theme = 'light'; }`}</Script>
      <body>{children}</body>
    </html>
  );
}
