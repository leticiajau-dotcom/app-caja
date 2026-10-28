"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HojaPresupuesto from "@/components/HojaPresupuesto";
import { armarHojaCliente } from "@/lib/hojaCliente";
import type { Cliente, Configuracion, DefaultsPresupuesto, Presupuesto } from "@/lib/types";

/** La hoja que se le da al cliente: se imprime o se guarda en PDF desde el
 *  navegador. Muestra los muebles y el total (o el precio de cada módulo, si
 *  el presupuesto lo pide), nunca los costos ni los coeficientes. Si el
 *  presupuesto tiene diseño en 3D, al pie va el link para verlo. */
export default function HojaClientePage({ params }: { params: { id: string } }) {
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [defaults, setDefaults] = useState<DefaultsPresupuesto | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [rp, rc] = await Promise.all([fetch(`/api/presupuestos/${params.id}`), fetch("/api/config")]);
      const dp = await rp.json();
      const dc = await rc.json();
      if (!rp.ok) {
        setError(dp.error ?? "No se pudo cargar el presupuesto.");
        return;
      }
      setPresupuesto(dp.presupuesto);
      setCliente(dp.cliente);
      setDefaults(dp.defaults);
      setConfig(dc.config ?? null);
    })();
  }, [params.id]);

  const hoja = useMemo(
    () => (presupuesto && defaults ? armarHojaCliente(presupuesto, cliente, defaults, config) : null),
    [presupuesto, cliente, defaults, config]
  );

  if (error) return <p className="text-red-600">{error}</p>;
  if (!presupuesto || !hoja) return <p className="text-madera-500 text-sm">Cargando...</p>;

  const linkVisor =
    presupuesto.modeloId && presupuesto.tokenPublico
      ? `${window.location.origin}/ver/${presupuesto.tokenPublico}`
      : undefined;

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-between mb-4 print:hidden">
        <Link href={`/presupuestos/${params.id}`} className="btn-secondary">
          ← Volver al presupuesto
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          Imprimir o guardar en PDF
        </button>
      </div>

      <HojaPresupuesto hoja={hoja} linkVisor={linkVisor} />
    </div>
  );
}
