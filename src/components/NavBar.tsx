"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Configuracion, SesionInterna } from "@/lib/types";
import ConfiguracionModal from "./ConfiguracionModal";

const LINKS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/usuarios", label: "Usuarios", soloAdmin: true },
];

// Cuánto hay que mantener presionado el nombre/logo para abrir la edición
// (reemplaza al antiguo botón "Configuración" del menú).
const DURACION_PRESION_MS = 550;

export default function NavBar() {
  const [sesion, setSesion] = useState<SesionInterna | null | undefined>(
    undefined
  );
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [presionando, setPresionando] = useState(false);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function empezarPresion() {
    if (sesion?.rol !== "admin") return;
    setPresionando(true);
    temporizadorRef.current = setTimeout(() => {
      setPresionando(false);
      setMostrarConfig(true);
    }, DURACION_PRESION_MS);
  }

  function cancelarPresion() {
    setPresionando(false);
    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
  }

  return (
    <header className="border-b border-madera-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span
            className={`font-semibold text-madera-700 flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5 select-none transition-colors ${
              sesion.rol === "admin" ? "cursor-pointer" : ""
            } ${presionando ? "bg-madera-100" : ""}`}
            title={
              sesion.rol === "admin"
                ? "Mantené presionado para cambiar el nombre y el logo"
                : undefined
            }
            onPointerDown={empezarPresion}
            onPointerUp={cancelarPresion}
            onPointerLeave={cancelarPresion}
            onPointerCancel={cancelarPresion}
            onContextMenu={(e) => {
              if (sesion.rol === "admin") e.preventDefault();
            }}
          >
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

      {mostrarConfig && config && (
        <ConfiguracionModal
          config={config}
          onCerrar={() => setMostrarConfig(false)}
          onGuardado={(nuevo) => {
            setConfig(nuevo);
            setMostrarConfig(false);
          }}
        />
      )}
    </header>
  );
}
