"use client";

import Link from "next/link";
import type { SesionInterna } from "@/lib/types";

interface Tab {
  href: string;
  label: string;
  soloAdmin?: boolean;
  // Border-radius del ícono: una forma distinta por pestaña, como en el
  // diseño de referencia (cuadrado redondeado / círculo / cuadrado chico /
  // "gota").
  forma: string;
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "Resumen", forma: "8px" },
  { href: "/movimientos", label: "Movimientos", forma: "50%" },
  { href: "/cuentas", label: "Cuentas", forma: "4px" },
  { href: "/usuarios", label: "Usuarios", soloAdmin: true, forma: "50% 50% 50% 0" },
];

export default function MobileBottomNav({
  sesion,
  pathname,
}: {
  sesion: SesionInterna;
  pathname: string;
}) {
  const tabs = TABS.filter((t) => !t.soloAdmin || sesion.rol === "admin");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white px-2.5 pt-2 pb-3.5 font-manrope"
      style={{ boxShadow: "0 -2px 12px rgba(30,25,15,0.06)" }}
    >
      {tabs.map((t) => {
        const activo = pathname === t.href;
        const color = activo ? "oklch(55% 0.135 175)" : "oklch(52% 0.03 250)";
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex-1 flex flex-col items-center gap-1 py-1.5"
            style={{ color }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: t.forma,
                backgroundColor: color,
                opacity: activo ? 1 : 0.55,
              }}
            />
            <span className="text-[10.5px] font-bold">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
