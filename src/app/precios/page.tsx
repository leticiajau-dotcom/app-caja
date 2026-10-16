"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import { formatMoney } from "@/lib/format";
import { puedeVerPresupuestos } from "@/lib/permisos";
import { clavePrecio, type TipoPrecio } from "@/lib/presupuesto";
import type { CambioPrecio, DefaultsPresupuesto, Precio } from "@/lib/types";

const SECCIONES: { tipo: TipoPrecio; titulo: string; unidad: string; ejemplo: string }[] = [
  { tipo: "placa", titulo: "Placas", unidad: "por placa entera", ejemplo: "Ej: Canela EGGER" },
  { tipo: "canto", titulo: "Tapacantos", unidad: "por metro", ejemplo: "Ej: Canela EGGER" },
  { tipo: "herraje", titulo: "Herrajes", unidad: "por unidad", ejemplo: "Ej: Bisagra Comun (Hafele)" },
  { tipo: "otro", titulo: "Otros (LEBRON no los usa)", unidad: "por unidad", ejemplo: "Ej: Corte (tiempo Gabbiani)" },
];

/** "Cód. 280130 · Emporio del Terciado · viene de a 200 · actualizado el 16/10/2026"
 *  (el código primero: en el celular es lo que se busca). */
function detalleDePrecio(p: Precio) {
  const partes = [
    p.codigo && `cód. ${p.codigo}`,
    p.proveedor,
    p.contenido > 1 && `viene de a ${p.contenido.toLocaleString("es-AR")}`,
    `actualizado el ${new Date(p.actualizadoEn).toLocaleDateString("es-AR")}`,
  ].filter(Boolean);
  const texto = partes.join(" · ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2,5" o "2.5" -> 2.5 (NaN si no es un número). */
function leerDecimal(texto: string) {
  return Number(texto.replace(",", "."));
}

export default function PreciosPage() {
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [defaults, setDefaults] = useState<DefaultsPresupuesto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  // Precios cambiados y todavía sin guardar: clave -> nuevo precio.
  const [cambios, setCambios] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // Nuevo precio
  const [nuevoTipo, setNuevoTipo] = useState<TipoPrecio>("placa");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState(0);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoProveedor, setNuevoProveedor] = useState("");

  // Valores de entrada de un presupuesto nuevo
  const [coefPlacas, setCoefPlacas] = useState("");
  const [coefHerrajes, setCoefHerrajes] = useState("");
  const [validez, setValidez] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [notaPie, setNotaPie] = useState("");
  const [guardandoDefaults, setGuardandoDefaults] = useState(false);
  const [errorDefaults, setErrorDefaults] = useState("");
  const [avisoDefaults, setAvisoDefaults] = useState("");

  function aplicarDefaults(d: DefaultsPresupuesto) {
    setDefaults(d);
    setCoefPlacas(String(d.coefPlacas).replace(".", ","));
    setCoefHerrajes(String(d.coefHerrajes).replace(".", ","));
    setValidez(String(d.validezDias));
    setNombreComercial(d.nombreComercial);
    setNotaPie(d.notaPie);
  }

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
    setPrecios(dp.precios ?? []);
    if (dp.defaults) aplicarDefaults(dp.defaults);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const porTipo = useMemo(() => {
    const m = new Map<TipoPrecio, Precio[]>();
    for (const s of SECCIONES) m.set(s.tipo, []);
    for (const p of precios) m.get(p.tipo)?.push(p);
    m.forEach((lista) => lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return m;
  }, [precios]);

  async function guardar(lista: CambioPrecio[]) {
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      const res = await fetch("/api/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precios: lista }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrecios(data.precios ?? []);
      setCambios({});
      setAviso("Precios guardados.");
      return true;
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCambios() {
    const lista = precios
      .filter((p) => cambios[p.id] !== undefined)
      .map((p) => ({ tipo: p.tipo, nombre: p.nombre, precio: cambios[p.id] }));
    if (lista.length > 0) await guardar(lista);
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim() || !(nuevoPrecio > 0)) {
      setError("Escribí el nombre y un precio mayor a 0.");
      return;
    }
    const yaEsta = precios.some(
      (p) => clavePrecio(p.tipo, p.nombre) === clavePrecio(nuevoTipo, nuevoNombre)
    );
    if (yaEsta && !confirm("Ya hay un precio con ese nombre. ¿Lo reemplazo?")) return;
    const delProveedor = nuevoCodigo.trim() ? { codigo: nuevoCodigo, proveedor: nuevoProveedor } : {};
    if (await guardar([{ tipo: nuevoTipo, nombre: nuevoNombre, precio: nuevoPrecio, ...delProveedor }])) {
      setNuevoNombre("");
      setNuevoPrecio(0);
      setNuevoCodigo("");
    }
  }

  async function guardarDefaults(e: React.FormEvent) {
    e.preventDefault();
    setErrorDefaults("");
    setAvisoDefaults("");
    const d = {
      coefPlacas: leerDecimal(coefPlacas),
      coefHerrajes: leerDecimal(coefHerrajes),
      validezDias: Number(validez),
      nombreComercial,
      notaPie,
    };
    if (!(d.coefPlacas > 0) || !(d.coefHerrajes > 0)) {
      setErrorDefaults("Los coeficientes tienen que ser números mayores a 0 (por ejemplo 2,5).");
      return;
    }
    if (!(d.validezDias > 0)) {
      setErrorDefaults("La validez tiene que ser de al menos 1 día.");
      return;
    }
    setGuardandoDefaults(true);
    try {
      const res = await fetch("/api/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: d }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.defaults) aplicarDefaults(data.defaults);
      setAvisoDefaults("Guardado. Vale para los presupuestos nuevos.");
    } catch (e: any) {
      setErrorDefaults(e.message ?? "Error inesperado.");
    } finally {
      setGuardandoDefaults(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">No tenés acceso a la lista de precios.</p>
      </div>
    );
  }

  const hayCambios = Object.keys(cambios).length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-madera-800">Precios</h1>
          <p className="text-madera-600">
            Lo que cuesta cada placa, tapacanto y herraje, con el mismo nombre con que sale de LEBRON. Son precios
            de lista, con IVA: el descuento del proveedor se pone en cada presupuesto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/precios/importar" className="btn-secondary">
            Importar lista
          </Link>
          <Link href="/presupuestos" className="btn-secondary">
            Ir a Presupuestos
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-1">Agregar un precio</h2>
        <p className="text-xs text-madera-500 mb-4">
          Lo más cómodo es cargarlos desde un presupuesto: ahí aparecen todos los que usa el diseño, con su
          nombre exacto. Lo que cargás ahí queda también en esta lista.
        </p>
        <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={nuevoTipo}
              onChange={(e) => setNuevoTipo(e.target.value as TipoPrecio)}
            >
              {SECCIONES.map((s) => (
                <option key={s.tipo} value={s.tipo}>
                  {s.titulo} ({s.unidad})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nombre</label>
            <input
              className="input"
              placeholder={SECCIONES.find((s) => s.tipo === nuevoTipo)?.ejemplo}
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Precio</label>
            <MoneyInput value={nuevoPrecio} onChange={setNuevoPrecio} />
          </div>
          <div>
            <label className="label">Código del proveedor (opcional)</label>
            <input className="input" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Proveedor</label>
            <input
              className="input"
              placeholder="Ej: Emporio del Terciado"
              value={nuevoProveedor}
              onChange={(e) => setNuevoProveedor(e.target.value)}
            />
          </div>
          <div className="sm:col-span-4">
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Lista de precios</h2>
          {hayCambios && (
            <button className="btn-primary" disabled={guardando} onClick={guardarCambios}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {aviso && !hayCambios && <p className="text-sm text-green-700 mb-3">{aviso}</p>}
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : (
          <div className="space-y-6">
            {SECCIONES.map((s) => {
              const lista = porTipo.get(s.tipo) ?? [];
              return (
                <div key={s.tipo}>
                  <h3 className="text-sm font-semibold text-madera-700 mb-2">
                    {s.titulo} <span className="font-normal text-madera-400">({s.unidad})</span>
                  </h3>
                  {lista.length === 0 ? (
                    <p className="text-xs text-madera-400">Todavía no hay precios.</p>
                  ) : (
                    <div className="divide-y divide-madera-100">
                      {lista.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm break-words">{p.nombre}</p>
                            <p className="text-xs text-madera-400 break-words" title={p.descripcion || undefined}>
                              {detalleDePrecio(p)}
                            </p>
                          </div>
                          <div className="w-40 shrink-0">
                            <MoneyInput
                              value={cambios[p.id] ?? p.precio}
                              onChange={(v) => setCambios((c) => ({ ...c, [p.id]: v }))}
                            />
                          </div>
                          <div className="w-28 text-right text-xs text-madera-500 shrink-0 hidden sm:block">
                            {formatMoney(cambios[p.id] ?? p.precio, "ARS")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-1">Valores de entrada de un presupuesto nuevo</h2>
        <p className="text-xs text-madera-500 mb-4">
          Cada presupuesto los puede cambiar después. Los coeficientes multiplican el costo de los materiales.
        </p>
        <form onSubmit={guardarDefaults} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Coeficiente de placas y tapacantos</label>
            <input
              className="input"
              inputMode="decimal"
              value={coefPlacas}
              onChange={(e) => setCoefPlacas(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Coeficiente de herrajes</label>
            <input
              className="input"
              inputMode="decimal"
              value={coefHerrajes}
              onChange={(e) => setCoefHerrajes(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Validez del presupuesto (días)</label>
            <input
              className="input"
              inputMode="numeric"
              value={validez}
              onChange={(e) => setValidez(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Nombre en la hoja del cliente</label>
            <input
              className="input"
              placeholder="Ej: Lebron Amoblamientos"
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Texto al pie de la hoja del cliente</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Ej: Forma de pago: 50% de seña y 50% contra entrega. Contacto: ..."
              value={notaPie}
              onChange={(e) => setNotaPie(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="sm:col-span-3">
            {errorDefaults && <p className="text-sm text-red-600 mb-2">{errorDefaults}</p>}
            {avisoDefaults && <p className="text-sm text-green-700 mb-2">{avisoDefaults}</p>}
            <button className="btn-primary" disabled={guardandoDefaults || !defaults}>
              {guardandoDefaults ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
