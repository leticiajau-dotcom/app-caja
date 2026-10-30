"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SesionInterna } from "@/lib/types";
import {
  puedeVerCuentas,
  puedeVerEmpleados,
  puedeVerPresupuestos,
  puedeVerUsuarios,
} from "@/lib/permisos";

const ITEMS = [
  {
    href: "/cuentas",
    label: "Cuentas",
    descripcion: "Cajas y bancos, saldos y responsables.",
    visible: puedeVerCuentas,
  },
  {
    href: "/presupuestos",
    label: "Presupuestos",
    descripcion: "Diseños de LEBRON y lista de precios.",
    visible: puedeVerPresupuestos,
  },
  {
    href: "/empleados",
    label: "Empleados",
    descripcion: "Sueldos pagados a cada uno, mes a mes.",
    visible: puedeVerEmpleados,
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    descripcion: "Quién puede entrar a la app y con qué rol.",
    visible: puedeVerUsuarios,
  },
];

export default function MasPage() {
  const [sesion, setSesion] = useState<SesionInterna | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setSesion(d.sesion ?? null))
      .catch(() => setSesion(null));
  }, []);

  if (!sesion) return null;

  const visibles = ITEMS.filter((i) => i.visible(sesion.rol));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Más</h1>
        <p className="text-madera-600">El resto de las pantallas de la app.</p>
      </div>

      <div className="space-y-2.5">
        {visibles.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card flex items-center justify-between gap-3 hover:bg-madera-50 transition-colors"
          >
            <div>
              <p className="font-semibold text-madera-800">{item.label}</p>
              <p className="text-sm text-madera-500">{item.descripcion}</p>
            </div>
            <span className="text-madera-300 text-xl">›</span>
          </Link>
        ))}
        {visibles.length === 0 && (
          <p className="text-madera-400 text-sm">Nada por acá.</p>
        )}
      </div>
    </div>
  );
}
