import type { Metadata } from "next";

// El link del presupuesto para el cliente: que no aparezca en buscadores.
export const metadata: Metadata = {
  title: "Presupuesto",
  robots: { index: false, follow: false },
};

export default function VerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
