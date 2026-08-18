"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Configuracion, SesionInterna } from "@/lib/types";

const LINKS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/usuarios", label: "Usuarios", soloAdmin: true },
  { href: "/configuracion", label: "Configuración", soloAdmin: true },
];

export default function NavBar() {
  const [sesion, setSesion] = useState<SesionInterna | null | undefined>(
    undefined
  );
  const [config, setConfig] = useState<Configuracion | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setSesion(d.sesion))
      .catch(() => setSesion(null));
  }, [pathname]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setConfig(d.config ?? null))
      .catch(() => setConfig(null));
  }, []);

  if (!sesion || pathname === "/login" || pathname === "/conectar") {
    return null;
  }

  async function salir() {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-madera-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-madera-700 flex items-center gap-2">
            {config?.logoDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoDataUri}
                alt=""
                className="h-6 w-6 rounded object-contain"
              />
            ) : (
              <span>🪵</span>
            )}
            {config?.nombreApp ?? "Caja Negocio"}
          </span>
          <nav className="flex gap-4 text-sm">
            {LINKS.filter((l) => !l.soloAdmin || sesion.rol === "admin").map(
              (l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    pathname === l.href
                      ? "text-madera-700 font-semibold"
                      : "text-madera-500 hover:text-madera-700"
                  }
                >
                  {l.label}
                </Link>
              )
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-madera-600">
            {sesion.nombre} {sesion.rol === "admin" && "· admin"}
          </span>
          <button onClick={salir} className="btn-secondary py-1 px-3">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
