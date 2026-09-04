"use client";

import Link from "next/link";
import type { Rol, SesionInterna } from "@/lib/types";
import { puedeVerClientes, puedeVerCuentas, puedeVerUsuarios } from "@/lib/permisos";

interface Tab {
  href: string;
  label: string;
  visible: (rol: Rol) => boolean;
  // Border-radius del ícono: una forma distinta por pestaña, como en el
  // diseño de referencia (cuadrado redondeado / círculo / cuadrado chico /
  // "gota").
  forma: string;
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "Resumen", visible: () => true, forma: "8px" },
  { href: "/movimientos", label: "Movimientos", visible: () => true, forma: "50%" },
  { href: "/cuentas", label: "Cuentas", visible: puedeVerCuentas, forma: "4px" },
  {
    href: "/clientes",
    label: "Clientes",
    visible: puedeVerClientes,
    forma: "0 50% 50% 50%",
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    visible: puedeVerUsuarios,
    forma: "50% 50% 50% 0",
  },
];

export default function MobileBottomNav({
  sesion,
  pathname,
}: {
  sesion: SesionInterna;
  pathname: string;
}) {
  const tabs = TABS.filter((t) => t.visible(sesion.rol));

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
