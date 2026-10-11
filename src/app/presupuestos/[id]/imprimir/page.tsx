"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { calcularPresupuesto } from "@/lib/presupuesto";
import type { Cliente, Configuracion, DefaultsPresupuesto, Presupuesto } from "@/lib/types";

/** La hoja que se le da al cliente: se imprime o se guarda en PDF desde el
 *  navegador. Muestra los muebles y el total (o el precio de cada módulo, si
 *  el presupuesto lo pide), nunca los costos ni los coeficientes. */
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

  const resultado = useMemo(
    () =>
      presupuesto
        ? calcularPresupuesto(presupuesto.datos, presupuesto.coefPlacas, presupuesto.coefHerrajes)
        : null,
    [presupuesto]
  );

  if (error) return <p className="text-red-600">{error}</p>;
  if (!presupuesto || !resultado || !defaults) return <p className="text-madera-500 text-sm">Cargando...</p>;

  const moneda = presupuesto.moneda;
  const fecha = new Date(presupuesto.creadoEn).toLocaleDateString("es-AR");
  const separados = presupuesto.datos.extras.filter((e) => e.separado && e.monto > 0);
  const nombreComercial = defaults.nombreComercial || config?.nombreApp || "";

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

      <div className="bg-white rounded-xl border border-madera-100 p-8 print:border-0 print:p-0 print:rounded-none text-madera-900">
        <div className="flex items-start justify-between gap-6 border-b border-madera-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            {config?.logoDataUri && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoDataUri} alt="" className="h-14 w-14 object-contain" />
            )}
            {nombreComercial && <p className="text-xl font-bold">{nombreComercial}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="text-2xl font-bold tracking-wide">PRESUPUESTO</p>
            <p className="text-madera-600">Fecha: {fecha}</p>
          </div>
        </div>

        <div className="mb-6 text-sm space-y-0.5">
          <p>
            <span className="text-madera-500">Cliente:</span>{" "}
            <span className="font-semibold">{cliente?.nombre ?? ""}</span>
          </p>
          <p>
            <span className="text-madera-500">Trabajo:</span> {presupuesto.nombre}
          </p>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-madera-300 text-left">
              <th className="py-2">Mueble</th>
              <th className="py-2 text-right w-16">Cant.</th>
              {presupuesto.porModulo && <th className="py-2 text-right w-36">Precio unitario</th>}
              {presupuesto.porModulo && <th className="py-2 text-right w-36">Subtotal</th>}
            </tr>
          </thead>
          <tbody>
            {resultado.items.map((it, i) => (
              <tr key={i} className="border-b border-madera-100 align-top">
                <td className="py-2">
                  <p className="font-medium">{it.nombre}</p>
                  {it.medidas && <p className="text-xs text-madera-500">{it.medidas}</p>}
                </td>
                <td className="py-2 text-right">{it.cantidad}</td>
                {presupuesto.porModulo && (
                  <td className="py-2 text-right">{formatMoney(it.precioUnitario, moneda)}</td>
                )}
                {presupuesto.porModulo && <td className="py-2 text-right">{formatMoney(it.subtotal, moneda)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs text-sm space-y-1.5 mb-8">
          <div className="flex justify-between gap-4">
            <span>Muebles</span>
            <span>{formatMoney(resultado.muebles, moneda)}</span>
          </div>
          {separados.map((e, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span>{e.concepto}</span>
              <span>{formatMoney(e.monto, moneda)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t-2 border-madera-300 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(resultado.total, moneda)}</span>
          </div>
        </div>

        <div className="text-xs text-madera-600 space-y-2 border-t border-madera-200 pt-4">
          <p>Presupuesto válido por {defaults.validezDias} días desde la fecha.</p>
          {defaults.notaPie && <p className="whitespace-pre-line">{defaults.notaPie}</p>}
        </div>
      </div>
    </div>
  );
}
