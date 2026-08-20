"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Configuracion, SesionInterna } from "@/lib/types";
import ConfiguracionModal from "./ConfiguracionModal";
import MobileBottomNav from "./MobileBottomNav";

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
  const [toastMobile, setToastMobile] = useState<string | null>(null);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setToastMobile("Cerrando sesión…");
    clearTimeout(toastRef.current ?? undefined);
    toastRef.current = setTimeout(() => setToastMobile(null), 1600);
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

  const marca = (
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
  );

  return (
    <>
      <header className="border-b border-madera-100 bg-white hidden md:block">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            {marca}
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

      {/* Header mobile: logo + nombre de la app + usuario a la izquierda,
       *  botón de salir a la derecha. La navegación entre pantallas se
       *  hace desde el menú inferior (MobileBottomNav), no desde acá. */}
      <header
        className="md:hidden sticky top-0 z-40 font-manrope"
        style={{ backgroundColor: "#f4efe4" }}
      >
        <div className="px-5 pt-[18px] pb-3.5 flex items-center justify-between gap-3">
          <div
            className={`flex items-center gap-2.5 select-none rounded-xl transition-colors ${
              sesion.rol === "admin" ? "cursor-pointer" : ""
            }`}
            style={presionando ? { backgroundColor: "rgba(0,0,0,0.05)" } : undefined}
            onPointerDown={empezarPresion}
            onPointerUp={cancelarPresion}
            onPointerLeave={cancelarPresion}
            onPointerCancel={cancelarPresion}
            onContextMenu={(e) => {
              if (sesion.rol === "admin") e.preventDefault();
            }}
          >
            <div
              className="flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: config?.logoDataUri ? "transparent" : "oklch(55% 0.135 175)",
              }}
            >
              {config?.logoDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logoDataUri}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-extrabold text-white text-base">
                  {(config?.nombreApp ?? "Caja Negocio").trim().charAt(0).toUpperCase() || "C"}
                </span>
              )}
            </div>
            <div>
              <div
                className="font-extrabold text-[16px] leading-tight"
                style={{ color: "oklch(24% 0.03 250)" }}
              >
                {config?.nombreApp ?? "Caja Negocio"}
              </div>
              <div
                className="text-[12px] font-semibold"
                style={{ color: "oklch(52% 0.03 250)" }}
              >
                {sesion.nombre.toLowerCase()}
                {sesion.rol === "admin" && " · admin"}
              </div>
            </div>
          </div>
          <button
            onClick={salir}
            aria-label="Salir"
            className="flex items-center justify-center shrink-0 bg-white"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                border: "2px solid oklch(52% 0.03 250)",
                borderRight: "none",
                borderRadius: "4px 0 0 4px",
              }}
            />
          </button>
        </div>
      </header>

      {sesion && <MobileBottomNav sesion={sesion} pathname={pathname} />}

      {toastMobile && (
        <div
          className="md:hidden fixed left-5 right-5 z-50 font-manrope"
          style={{ bottom: 96 }}
        >
          <div
            className="text-center text-white text-[13px] font-bold py-3 px-4"
            style={{
              backgroundColor: "oklch(24% 0.03 250)",
              borderRadius: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
          >
            {toastMobile}
          </div>
        </div>
      )}

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
    </>
  );
}
