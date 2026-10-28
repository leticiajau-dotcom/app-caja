"use client";

import { useEffect, useRef, useState } from "react";
import type { Visor } from "@/lib/visor3d";

/** El diseño en 3D (archivo .glb de LEBRON), con los botones para abrir y
 *  cerrar todo y volver a la vista inicial. three.js se carga recién acá, para
 *  que las demás pantallas de la app no lo descarguen. */
export default function Visor3D({ url, className = "" }: { url: string; className?: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const visor = useRef<Visor | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [avance, setAvance] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [abribles, setAbribles] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setEstado("cargando");
    (async () => {
      try {
        const { crearVisor } = await import("@/lib/visor3d");
        if (cancelado || !contenedor.current) return;
        const v = await crearVisor(contenedor.current, url, setAvance);
        if (cancelado) {
          v.liberar();
          return;
        }
        visor.current = v;
        setAbribles(v.cantidadAbribles);
        setEstado("listo");
      } catch {
        if (!cancelado) setEstado("error");
      }
    })();
    return () => {
      cancelado = true;
      visor.current?.liberar();
      visor.current = null;
    };
  }, [url]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-madera-100 bg-[#f4f2ee] ${className}`}>
      <div ref={contenedor} className="absolute inset-0" />
      {estado === "cargando" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-madera-600">
          <p>Cargando el diseño en 3D…</p>
          <div className="h-1.5 w-40 rounded-full bg-madera-100 overflow-hidden">
            <div className="h-full bg-madera-600 transition-all" style={{ width: `${Math.round(avance * 100)}%` }} />
          </div>
        </div>
      )}
      {estado === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-madera-600">
          No se pudo mostrar el diseño en 3D. Probá recargar la página.
        </div>
      )}
      {estado === "listo" && (
        <>
          <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 justify-end pointer-events-none">
            {abribles > 0 && (
              <button
                className="pointer-events-auto rounded-full bg-white/90 shadow px-3.5 py-1.5 text-sm font-medium text-madera-900"
                onClick={() => {
                  visor.current?.abrirTodo(!abierto);
                  setAbierto(!abierto);
                }}
              >
                {abierto ? "Cerrar todo" : "Abrir todo"}
              </button>
            )}
            <button
              className="pointer-events-auto rounded-full bg-white/90 shadow px-3.5 py-1.5 text-sm font-medium text-madera-900"
              onClick={() => visor.current?.centrar()}
            >
              Centrar
            </button>
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-madera-500 pointer-events-none px-3">
            Girá con el dedo · acercá con dos dedos{abribles > 0 ? " · tocá una puerta o un cajón para abrirlo" : ""}
          </p>
        </>
      )}
    </div>
  );
}
