"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  leerLista,
  planDeImportacion,
  textoDeArchivo,
  type CambioImportado,
  type ErrorDeLinea,
  type FilaLista,
} from "@/lib/importarPrecios";
import { puedeVerPresupuestos } from "@/lib/permisos";
import type { TipoPrecio } from "@/lib/presupuesto";
import type { Precio } from "@/lib/types";

// Importar la lista de precios de un proveedor (ver lib/importarPrecios.ts):
// primero se muestra qué cambia y recién con "Importar" se guarda.

const TIPO: Record<TipoPrecio, string> = {
  placa: "Placa",
  canto: "Tapacanto",
  herraje: "Herraje",
  otro: "Otro",
};

function Renglon({ r }: { r: CambioImportado }) {
  const { cambio, antes } = r;
  return (
    <div className="grid grid-cols-12 gap-2 py-1.5 text-sm">
      <div className="col-span-12 sm:col-span-7 min-w-0">
        <p className="truncate" title={cambio.nombre}>
          {cambio.nombre}
        </p>
        <p className="text-xs text-madera-400 truncate">
          {TIPO[cambio.tipo]} · cód. {cambio.codigo}
          {cambio.descripcion && cambio.descripcion !== cambio.nombre && ` · ${cambio.descripcion}`}
        </p>
      </div>
      <div className="col-span-12 sm:col-span-5 sm:text-right text-madera-700">
        {antes && antes.precio !== cambio.precio && (
          <span className="text-madera-400 line-through mr-2">{formatMoney(antes.precio, "ARS")}</span>
        )}
        {formatMoney(cambio.precio, "ARS")}
        {(cambio.contenido ?? 1) > 1 && <span className="text-xs text-madera-400"> c/u</span>}
      </div>
    </div>
  );
}

export default function ImportarPreciosPage() {
  const [lista, setLista] = useState<Precio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  const [proveedor, setProveedor] = useState("Emporio del Terciado");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [texto, setTexto] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");

  async function cargar() {
    setCargando(true);
    const [rp, rs] = await Promise.all([fetch("/api/precios"), fetch("/api/session")]);
    const ds = await rs.json();
    if (ds.sesion && !puedeVerPresupuestos(ds.sesion.rol)) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }
    const dp = await rp.json();
    setLista(dp.precios ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // para poder elegir el mismo archivo otra vez
    if (!archivo) return;
    setError("");
    setListo("");
    setNombreArchivo(archivo.name);
    setTexto(textoDeArchivo(await archivo.arrayBuffer()));
  }

  const leido = useMemo<{ filas: FilaLista[]; errores: ErrorDeLinea[] } | null>(
    () => (texto ? leerLista(texto, proveedor) : null),
    [texto, proveedor]
  );
  const plan = useMemo(() => (leido ? planDeImportacion(leido.filas, lista) : null), [leido, lista]);
  const aGuardar = plan ? [...plan.cambian, ...plan.nuevos] : [];

  async function importar() {
    if (aGuardar.length === 0) return;
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precios: aGuardar.map((r) => r.cambio) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLista(data.precios ?? []);
      setListo(
        `Listo: ${aGuardar.length} ${aGuardar.length === 1 ? "precio importado" : "precios importados"}.`
      );
      setTexto("");
      setNombreArchivo("");
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">No tenés acceso a la lista de precios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/precios" className="text-sm text-madera-500 hover:text-madera-700">
          ← Precios
        </Link>
        <h1 className="text-2xl font-bold text-madera-800 mt-2">Importar una lista de precios</h1>
        <p className="text-madera-600">
          Un archivo CSV (en Excel: Guardar como &gt; CSV) con un renglón por artículo. Cada artículo se reconoce por
          el código del proveedor: si ya está, se le cambia el precio; si no, entra nuevo. Antes de guardar se ve
          qué cambia.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 items-end">
          <div>
            <label className="label">Proveedor (si el archivo no lo dice)</label>
            <input className="input" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          </div>
          <div>
            <label className="btn-secondary cursor-pointer inline-block">
              {nombreArchivo ? "Elegir otro archivo" : "Elegir el archivo"}
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={elegirArchivo} />
            </label>
            {nombreArchivo && <span className="ml-3 text-sm text-madera-600 break-all">{nombreArchivo}</span>}
          </div>
        </div>
        <p className="text-xs text-madera-500">
          Columnas, con su título en el primer renglón: <b>Código</b> y <b>Precio</b> (de lista, con IVA), y si las
          hay, <b>Descripción</b>, <b>Tipo</b> (placa, canto, herraje u otro), <b>Nombre en LEBRON</b>,{" "}
          <b>Contenido</b> (cuántas unidades trae, por ejemplo 200 en una caja de tornillos) y <b>Proveedor</b>. Sin
          nombre en LEBRON, un artículo nuevo entra como &quot;otro&quot;.
        </p>
        {cargando && <p className="text-sm text-madera-500">Cargando la lista actual...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {listo && (
          <p className="text-sm text-green-700">
            {listo}{" "}
            <Link href="/precios" className="underline">
              Ver la lista de precios
            </Link>
          </p>
        )}
      </div>

      {plan && leido && !cargando && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-madera-700">
                {leido.filas.length} {leido.filas.length === 1 ? "artículo leído" : "artículos leídos"}:{" "}
                <b>{plan.cambian.length}</b> {plan.cambian.length === 1 ? "cambia" : "cambian"}, <b>{plan.nuevos.length}</b>{" "}
                {plan.nuevos.length === 1 ? "nuevo" : "nuevos"}
                {plan.iguales > 0 && `, ${plan.iguales} sin cambios`}.
              </p>
              <button className="btn-primary" disabled={guardando || aGuardar.length === 0} onClick={importar}>
                {guardando
                  ? "Importando..."
                  : aGuardar.length === 0
                  ? "Nada para importar"
                  : `Importar ${aGuardar.length} ${aGuardar.length === 1 ? "precio" : "precios"}`}
              </button>
            </div>
          </div>

          {leido.errores.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
              <p className="font-medium">
                {leido.errores.length === 1 ? "Este renglón no se importa:" : "Estos renglones no se importan:"}
              </p>
              {leido.errores.map((e) => (
                <p key={e.linea}>
                  Renglón {e.linea}: {e.motivo}
                </p>
              ))}
            </div>
          )}

          {plan.cambian.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-2">Cambian</h2>
              <div className="divide-y divide-madera-100">
                {plan.cambian.map((r) => (
                  <Renglon key={`${r.cambio.tipo}|${r.cambio.nombre}`} r={r} />
                ))}
              </div>
            </div>
          )}

          {plan.nuevos.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-2">Nuevos</h2>
              <div className="divide-y divide-madera-100">
                {plan.nuevos.map((r) => (
                  <Renglon key={`${r.cambio.tipo}|${r.cambio.nombre}`} r={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
