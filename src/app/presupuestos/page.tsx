"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import { formatDiaYHora, formatMoney } from "@/lib/format";
import { puedeVerPresupuestos } from "@/lib/permisos";
import { leerArchivoLebron, type ArchivoLebron, type LineaManual } from "@/lib/presupuesto";
import { ETIQUETA_ESTADO } from "@/lib/presupuestoEtiquetas";
import type { Cliente, Presupuesto } from "@/lib/types";

type FilaPresupuesto = Omit<Presupuesto, "datos" | "lineasManuales"> & { muebles: number };

const LINEA_MANUAL_VACIA: LineaManual = { descripcion: "", cantidad: 1, precioUnitario: 0 };

const CLIENTE_NUEVO = "__nuevo__";

function hoy() {
  return new Date().toLocaleDateString("es-AR");
}

export default function PresupuestosPage() {
  const router = useRouter();
  const [presupuestos, setPresupuestos] = useState<FilaPresupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [verDescartados, setVerDescartados] = useState(false);

  // --- Nuevo presupuesto ---
  const [archivo, setArchivo] = useState<ArchivoLebron | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [errorArchivo, setErrorArchivo] = useState("");
  const [clienteSeleccion, setClienteSeleccion] = useState(CLIENTE_NUEVO);
  const [clienteNuevo, setClienteNuevo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [mostrarSubir, setMostrarSubir] = useState(false);
  const [error, setError] = useState("");

  // --- Nuevo presupuesto manual (productos y servicios fuera de SketchUp) ---
  const [mostrarManual, setMostrarManual] = useState(false);
  const [clienteSeleccionManual, setClienteSeleccionManual] = useState(CLIENTE_NUEVO);
  const [clienteNuevoManual, setClienteNuevoManual] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [lineasManual, setLineasManual] = useState<LineaManual[]>([{ ...LINEA_MANUAL_VACIA }]);
  const [creandoManual, setCreandoManual] = useState(false);
  const [errorManual, setErrorManual] = useState("");

  async function cargar() {
    setCargando(true);
    const [rp, rs] = await Promise.all([fetch("/api/presupuestos"), fetch("/api/session")]);
    const ds = await rs.json();
    if (ds.sesion && !puedeVerPresupuestos(ds.sesion.rol)) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }
    const dp = await rp.json();
    setPresupuestos(dp.presupuestos ?? []);
    setClientes(dp.clientes ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const clientesPorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [clientes]
  );
  const visibles = useMemo(
    () =>
      presupuestos
        .filter((p) => verDescartados || p.estado !== "descartado")
        .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)),
    [presupuestos, verDescartados]
  );

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorArchivo("");
    setArchivo(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setNombreArchivo(f.name);
    try {
      const leido = leerArchivoLebron(await f.text());
      setArchivo(leido);
      // El cliente que se escribió en LEBRON: si ya existe, queda elegido.
      const existente = clientes.find(
        (c) => c.nombre.trim().toLowerCase() === leido.cliente.trim().toLowerCase()
      );
      if (existente) {
        setClienteSeleccion(existente.id);
      } else {
        setClienteSeleccion(CLIENTE_NUEVO);
        setClienteNuevo(leido.cliente);
      }
      setNombre(`Presupuesto del ${hoy()}`);
    } catch (err: any) {
      setErrorArchivo(err.message ?? "No se pudo leer el archivo.");
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    setError("");
    setCreando(true);
    try {
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "lebron",
          clienteId: clienteSeleccion === CLIENTE_NUEVO ? undefined : clienteSeleccion,
          clienteNuevo: clienteSeleccion === CLIENTE_NUEVO ? clienteNuevo : undefined,
          nombre,
          moneda: "ARS",
          archivo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/presupuestos/${data.presupuesto.id}`);
    } catch (err: any) {
      setError(err.message ?? "Error inesperado.");
      setCreando(false);
    }
  }

  function cambiarLineaManual(i: number, cambio: Partial<LineaManual>) {
    setLineasManual((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  function agregarLineaManual() {
    setLineasManual((ls) => [...ls, { ...LINEA_MANUAL_VACIA }]);
  }

  function quitarLineaManual(i: number) {
    setLineasManual((ls) => ls.filter((_, j) => j !== i));
  }

  async function crearManual(e: React.FormEvent) {
    e.preventDefault();
    setErrorManual("");
    const lineas = lineasManual.filter((l) => l.descripcion.trim());
    if (lineas.length === 0) {
      setErrorManual("Agregá al menos un ítem con descripción.");
      return;
    }
    setCreandoManual(true);
    try {
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "manual",
          clienteId: clienteSeleccionManual === CLIENTE_NUEVO ? undefined : clienteSeleccionManual,
          clienteNuevo: clienteSeleccionManual === CLIENTE_NUEVO ? clienteNuevoManual : undefined,
          nombre: nombreManual,
          moneda: "ARS",
          lineas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/presupuestos/${data.presupuesto.id}`);
    } catch (err: any) {
      setErrorManual(err.message ?? "Error inesperado.");
      setCreandoManual(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">No tenés acceso a Presupuestos.</p>
      </div>
    );
  }

  const muebles = archivo ? archivo.items.reduce((a, it) => a + it.cantidad, 0) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-madera-800">Presupuestos</h1>
          <p className="text-madera-600">
            Llegan desde LEBRON con el botón &quot;Presupuesto&quot;. Costo de materiales × coeficiente, más mano de
            obra, colocación y flete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setMostrarManual((v) => !v)}
          >
            {mostrarManual ? "Cancelar" : "+ Nuevo presupuesto"}
          </button>
          <Link href="/precios" className="btn-secondary">
            Lista de precios
          </Link>
        </div>
      </div>

      {mostrarManual && (
        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="font-semibold text-lg">Nuevo presupuesto</h2>
          </div>
          <p className="text-xs text-madera-500 mb-4">
            Para productos y servicios hechos fuera de SketchUp: un renglón por ítem, con texto, cantidad e
            importe cargados a mano.
          </p>
          <form onSubmit={crearManual} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Cliente</label>
                <select
                  className="input"
                  value={clienteSeleccionManual}
                  onChange={(e) => setClienteSeleccionManual(e.target.value)}
                >
                  <option value={CLIENTE_NUEVO}>Cliente nuevo...</option>
                  {clientesOrdenados.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {clienteSeleccionManual === CLIENTE_NUEVO && (
                  <input
                    className="input mt-2"
                    placeholder="Nombre del cliente"
                    value={clienteNuevoManual}
                    onChange={(e) => setClienteNuevoManual(e.target.value)}
                    required
                  />
                )}
              </div>
              <div>
                <label className="label">Nombre del presupuesto</label>
                <input
                  className="input"
                  value={nombreManual}
                  onChange={(e) => setNombreManual(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-madera-500 px-1 mb-1">
                <span className="col-span-6">Descripción</span>
                <span className="col-span-2 text-right">Cantidad</span>
                <span className="col-span-2 text-right">Precio unit.</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              <div className="space-y-2">
                {lineasManual.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <textarea
                      className="input col-span-12 sm:col-span-6 resize-y"
                      rows={1}
                      placeholder="Ej: Instalación eléctrica"
                      value={l.descripcion}
                      onChange={(e) => cambiarLineaManual(i, { descripcion: e.target.value })}
                    />
                    <input
                      className="input col-span-4 sm:col-span-2 text-right"
                      type="number"
                      min={0}
                      step="any"
                      value={l.cantidad}
                      onChange={(e) => cambiarLineaManual(i, { cantidad: Number(e.target.value) || 0 })}
                    />
                    <MoneyInput
                      className="input col-span-5 sm:col-span-2"
                      value={l.precioUnitario}
                      onChange={(v) => cambiarLineaManual(i, { precioUnitario: v })}
                    />
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                      <span className="text-sm">
                        {formatMoney(l.cantidad * l.precioUnitario, "ARS")}
                      </span>
                      {lineasManual.length > 1 && (
                        <button
                          type="button"
                          className="text-madera-400 hover:text-red-600 shrink-0"
                          title="Quitar"
                          onClick={() => quitarLineaManual(i)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-secondary text-sm py-1 mt-3" onClick={agregarLineaManual}>
                + Agregar ítem
              </button>
            </div>

            <div>
              {errorManual && <p className="text-sm text-red-600 mb-2">{errorManual}</p>}
              <button className="btn-primary" disabled={creandoManual}>
                {creandoManual ? "Creando..." : "Crear presupuesto"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Todos los presupuestos</h2>
          <label className="text-sm text-madera-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={verDescartados}
              onChange={(e) => setVerDescartados(e.target.checked)}
            />
            Ver los descartados
          </label>
        </div>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : visibles.length === 0 ? (
          <p className="text-madera-400 text-sm text-center py-4">No hay presupuestos todavía.</p>
        ) : (
          <div className="divide-y divide-madera-100">
            {visibles.map((p) => {
              const estado = ETIQUETA_ESTADO[p.estado];
              return (
                <Link
                  key={p.id}
                  href={`/presupuestos/${p.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-madera-50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {clientesPorId.get(p.clienteId)?.nombre ?? "Cliente borrado"} — {p.nombre}
                    </p>
                    <p className="text-xs text-madera-500">
                      {new Date(p.creadoEn).toLocaleDateString("es-AR")} · {p.muebles}{" "}
                      {p.tipo === "manual" ? (p.muebles === 1 ? "ítem" : "ítems") : p.muebles === 1 ? "mueble" : "muebles"}
                      {p.tipo === "manual" && <> · manual</>}
                      {p.vistoUltimo && <> · el cliente lo vio el {formatDiaYHora(p.vistoUltimo)}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatMoney(p.total, p.moneda)}</p>
                    <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {/* Plan B (12/10/2026): los presupuestos llegan desde LEBRON con el botón
          "Presupuesto". Subir el archivo a mano queda para cuando no se pudo mandar
          (sin internet, por ejemplo), y solo en la PC: en el celular no hay archivo. */}
      <div className="hidden md:block">
        {!mostrarSubir ? (
          <button
            type="button"
            className="text-sm text-madera-500 hover:text-madera-700 underline"
            onClick={() => setMostrarSubir(true)}
          >
            ¿No se pudo mandar desde LEBRON? Subí el archivo
          </button>
        ) : (
          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-semibold text-lg">Subir el archivo de LEBRON</h2>
              <button
                type="button"
                className="text-sm text-madera-400 hover:text-madera-700"
                onClick={() => setMostrarSubir(false)}
              >
                Cerrar
              </button>
            </div>
            <p className="text-xs text-madera-500 mb-4">
              Cada vez que tocás Presupuesto en LEBRON queda una copia en Documentos {">"} Lebron {">"} reportes.
              Elegila acá.
            </p>
            <div className="mb-4">
              <label className="btn-secondary cursor-pointer">
                {archivo ? "Elegir otro archivo" : "Elegir el archivo de LEBRON"}
                <input type="file" accept=".json,application/json" className="hidden" onChange={elegirArchivo} />
              </label>
              {nombreArchivo && <span className="ml-3 text-sm text-madera-600">{nombreArchivo}</span>}
              {errorArchivo && <p className="text-sm text-red-600 mt-2">{errorArchivo}</p>}
            </div>

            {archivo && (
              <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-lg bg-madera-50 p-3 text-sm text-madera-700">
                  {muebles} {muebles === 1 ? "mueble" : "muebles"} · {archivo.placas.length}{" "}
                  {archivo.placas.length === 1 ? "material de placa" : "materiales de placa"} ·{" "}
                  {archivo.herrajes.length} herrajes distintos
                  {archivo.generado && <span className="text-madera-400"> · exportado el {archivo.generado}</span>}
                  {archivo.avisos.length > 0 && (
                    <ul className="mt-2 space-y-1 text-amber-800">
                      {archivo.avisos.map((a, i) => (
                        <li key={i} className="whitespace-pre-line">
                          ⚠ {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="label">Cliente</label>
                  <select
                    className="input"
                    value={clienteSeleccion}
                    onChange={(e) => setClienteSeleccion(e.target.value)}
                  >
                    <option value={CLIENTE_NUEVO}>Cliente nuevo...</option>
                    {clientesOrdenados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {clienteSeleccion === CLIENTE_NUEVO && (
                    <input
                      className="input mt-2"
                      placeholder="Nombre del cliente"
                      value={clienteNuevo}
                      onChange={(e) => setClienteNuevo(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="label">Nombre del presupuesto</label>
                  <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                  <p className="text-xs text-madera-400 mt-1">
                    Si el cliente lo acepta, es el nombre del proyecto (ej: &quot;Cocina&quot;).
                  </p>
                </div>
                <div className="sm:col-span-2">
                  {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                  <button className="btn-primary" disabled={creando}>
                    {creando ? "Creando..." : "Crear presupuesto"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
