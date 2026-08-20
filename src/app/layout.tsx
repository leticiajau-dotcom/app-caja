import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavBar from "@/components/NavBar";
import SwipeNavigator from "@/components/SwipeNavigator";

// Tipografía del rediseño mobile (Resumen y, en menor medida, el resto de
// las pantallas en celular). En desktop se sigue usando la fuente por
// defecto: la variable solo se activa dentro de la vista mobile.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Caja Negocio",
  description: "Control de ingresos, egresos y saldos del negocio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        <Providers>
          <NavBar />
          {/* pb-24: deja lugar al menú inferior fijo en celular. */}
          <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
            <SwipeNavigator>{children}</SwipeNavigator>
          </main>
        </Providers>
      </body>
    </html>
  );
}
