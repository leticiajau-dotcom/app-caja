"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { MONEDAS_SUGERIDAS, formatMoney } from "@/lib/format";
import MoneyInput from "@/components/MoneyInput";
import { puedeVerClientes } from "@/lib/permisos";
import type { Cliente, Proyecto } from "@/lib/types";

const MONEDA_OTRA = "__otra__";

function SelectorMoneda({
  seleccion,
  onSeleccion,
  libre,
  onLibre,
}: {
  seleccion: string;
  onSeleccion: (v: string) => void;
  libre: string;
  onLibre: (v: string) => void;
}) {
  return (
    <>
      <select
        className="input"
        value={seleccion}
        onChange={(e) => onSeleccion(e.target.value)}
      >
        {MONEDAS_SUGERIDAS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
        <option value={MONEDA_OTRA}>Otra...</option>
      </select>
      {seleccion === MONEDA_OTRA && (
        <input
          className="input mt-2"
          placeholder="Ej: CLP, UYU, GBP..."
          value={libre}
          onChange={(e) => onLibre(e.target.value.toUpperCase())}
          maxLength={10}
          required
        />
      )}
    </>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  const [nombre, setNombre] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [monedaSeleccion, setMonedaSeleccion] = useState("ARS");
  const [monedaLibre, setMonedaLibre] = useState("");
  const [precio, setPrecio] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [clienteAgregandoId, setClienteAgregandoId] = useState<string | null>(
    null
  );
  const [nombreNuevoProyecto, setNombreNuevoProyecto] = useState("");
  const [monedaNuevoProyecto, setMonedaNuevoProyecto] = useState("ARS");
  const [monedaLibreNuevoProyecto, setMonedaLibreNuevoProyecto] = useState("");
  const [precioNuevoProyecto, setPrecioNuevoProyecto] = useState(0);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [errorProyecto, setErrorProyecto] = useState("");

  async function cargar() {
    setCargando(true);
    const [rc, rs] = await Promise.all([
      fetch("/api/clients"),
      fetch("/api/session"),
    ]);
    const dc = await rc.json();
    const ds = await rs.json();
    setClientes(dc.clientes ?? []);
    setProyectos(dc.proyectos ?? []);
    setSinPermiso(ds.sesion ? !puedeVerClientes(ds.sesion.rol) : false);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const proyectosPorCliente = useMemo(() => {
    const m = new Map<string, Proyecto[]>();
    for (const p of proyectos) {
      if (!m.has(p.clienteId)) m.set(p.clienteId, []);
      m.get(p.clienteId)!.push(p);
    }
    return m;
  }, [proyectos]);

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [clientes]
  );

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const moneda =
      monedaSeleccion === MONEDA_OTRA ? monedaLibre.trim() : monedaSeleccion;
    try {
      if (!moneda) throw new Error("Ingresá el código de la moneda.");
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, proyecto, moneda, precio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      setProyecto("");
      setPrecio(0);
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  function empezarAgregarProyecto(clienteId: string) {
    setClienteAgregandoId(clienteId);
    setNombreNuevoProyecto("");
    setMonedaNuevoProyecto("ARS");
    setMonedaLibreNuevoProyecto("");
    setPrecioNuevoProyecto(0);
    setErrorProyecto("");
  }

  async function guardarNuevoProyecto(clienteId: string) {
    setErrorProyecto("");
    const moneda =
      monedaNuevoProyecto === MONEDA_OTRA
        ? monedaLibreNuevoProyecto.trim()
        : monedaNuevoProyecto;
    if (!moneda) {
      setErrorProyecto("Ingresá el código de la moneda.");
      return;
    }
    setGuardandoProyecto(true);
    try {
      const res = await fetch(`/api/clients/${clienteId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreNuevoProyecto,
          moneda,
          precio: precioNuevoProyecto,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClienteAgregandoId(null);
      await cargar();
    } catch (e: any) {
      setErrorProyecto(e.message ?? "Error inesperado.");
    } finally {
      setGuardandoProyecto(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">
          No tenés acceso a la pantalla de Clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Clientes</h1>
        <p className="text-madera-600">
          Clientes y sus proyectos, con el importe acordado de cada uno.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Nuevo cliente</h2>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre del cliente</label>
            <input
              className="input"
              placeholder="Ej: Constructora Del Sur"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Proyecto</label>
            <input
              className="input"
              placeholder="Ej: Reforma oficina"
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Moneda</label>
            <SelectorMoneda
              seleccion={monedaSeleccion}
              onSeleccion={setMonedaSeleccion}
              libre={monedaLibre}
              onLibre={setMonedaLibre}
            />
          </div>
          <div>
            <label className="label">Precio del proyecto</label>
            <MoneyInput value={precio} onChange={setPrecio} required />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-lg mb-4">Todos los clientes</h2>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-madera-500 border-b border-madera-100">
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Proyecto</th>
                <th className="py-2 pr-4 text-right">Importe</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {clientesOrdenados.map((c) => {
                const susProyectos = proyectosPorCliente.get(c.id) ?? [];
                return (
                  <Fragment key={c.id}>
                    {susProyectos.length === 0 && (
                      <tr key={c.id} className="border-b border-madera-50 last:border-0">
                        <td className="py-2 pr-4 font-medium">{c.nombre}</td>
                        <td className="py-2 pr-4 text-madera-400" colSpan={2}>
                          Sin proyectos todavía
                        </td>
                        <td className="py-2 pr-4"></td>
                      </tr>
                    )}
                    {susProyectos.map((p, i) => (
                      <tr
                        key={p.id}
                        className="border-b border-madera-50 last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {i === 0 ? c.nombre : ""}
                        </td>
                        <td className="py-2 pr-4">{p.nombre}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">
                          {formatMoney(p.precio, p.moneda)}
                        </td>
                        <td className="py-2 pr-4"></td>
                      </tr>
                    ))}
                    <tr key={`${c.id}-agregar`} className="border-b border-madera-50 last:border-0">
                      <td></td>
                      <td className="py-1.5 pr-4" colSpan={3}>
                        {clienteAgregandoId === c.id ? (
                          <div className="grid gap-2 sm:grid-cols-4 items-start bg-madera-50 rounded-lg p-3">
                            <input
                              className="input"
                              placeholder="Nombre del proyecto"
                              value={nombreNuevoProyecto}
                              onChange={(e) =>
                                setNombreNuevoProyecto(e.target.value)
                              }
                            />
                            <SelectorMoneda
                              seleccion={monedaNuevoProyecto}
                              onSeleccion={setMonedaNuevoProyecto}
                              libre={monedaLibreNuevoProyecto}
                              onLibre={setMonedaLibreNuevoProyecto}
                            />
                            <MoneyInput
                              value={precioNuevoProyecto}
                              onChange={setPrecioNuevoProyecto}
                              placeholder="Precio"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-primary py-1.5 px-3 text-xs"
                                disabled={guardandoProyecto}
                                onClick={() => guardarNuevoProyecto(c.id)}
                              >
                                {guardandoProyecto ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary py-1.5 px-3 text-xs"
                                onClick={() => setClienteAgregandoId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                            {errorProyecto && (
                              <p className="text-xs text-red-600 sm:col-span-4">
                                {errorProyecto}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-madera-500 hover:text-madera-700 underline"
                            onClick={() => empezarAgregarProyecto(c.id)}
                          >
                            + Agregar proyecto a {c.nombre}
                          </button>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {clientesOrdenados.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-madera-400">
                    No hay clientes todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
