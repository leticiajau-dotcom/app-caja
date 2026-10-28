"use client";

import { useEffect, useState } from "react";
import HojaPresupuesto from "@/components/HojaPresupuesto";
import Visor3D from "@/components/Visor3D";
import type { HojaCliente } from "@/lib/hojaCliente";

/** El presupuesto que se le manda al cliente por WhatsApp: la hoja de siempre
 *  con el diseño en 3D arriba de los muebles. No pide entrar a la app (ver
 *  /api/publico/[token]). */
export default function VerPresupuestoPage({ params }: { params: { token: string } }) {
  const [hoja, setHoja] = useState<HojaCliente | null>(null);
  const [modeloUrl, setModeloUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/publico/${params.token}`);
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "No se pudo abrir el presupuesto.");
          return;
        }
        setHoja(d.hoja);
        setModeloUrl(d.modeloUrl);
      } catch {
        setError("No se pudo abrir el presupuesto. Revisá la conexión y probá de nuevo.");
      }
    })();
  }, [params.token]);

  if (error) return <p className="text-madera-700 text-center mt-10">{error}</p>;
  if (!hoja) return <p className="text-madera-500 text-sm text-center mt-10">Cargando...</p>;

  return (
    <HojaPresupuesto hoja={hoja}>
      {modeloUrl && <Visor3D url={modeloUrl} className="h-[62vh] min-h-[320px] mb-6 -mx-2 sm:mx-0" />}
    </HojaPresupuesto>
  );
}
