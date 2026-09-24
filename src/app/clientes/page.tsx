"use client";

import { useEffect, useMemo, useState } from "react";
import { MONEDAS_SUGERIDAS, formatFecha, formatMoney } from "@/lib/format";
import MoneyInput from "@/components/MoneyInput";
import { puedeVerClientes } from "@/lib/permisos";
import type {
  Cliente,
  Cuenta,
  Modificacion,
  Movimiento,
  Pago,
  Proyecto,
  ResumenProyecto,
} from "@/lib/types";

const MONEDA_OTRA = "__otra__";

/** El pago que devuelve /api/clients viene con un extra "anulado" calculado
 *  en el servidor (si el ingreso real en Movimientos se llegó a anular). */
type PagoConEstado = Pago & { anulado: boolean };

function fechaCorta(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR");
}

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
  const [modificaciones, setModificaciones] = useState<Modificacion[]>([]);
  const [pagos, setPagos] = useState<PagoConEstado[]>([]);
  const [resumenPorProyecto, setResumenPorProyecto] = useState<
    Record<string, ResumenProyecto>
  >({});
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  // --- Nuevo cliente ---
  const [nombre, setNombre] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monedaSeleccion, setMonedaSeleccion] = useState("ARS");
  const [monedaLibre, setMonedaLibre] = useState("");
  const [precio, setPrecio] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // --- Agregar proyecto a un cliente existente ---
  const [clienteAgregandoId, setClienteAgregandoId] = useState<string | null>(
    null
  );
  const [nombreNuevoProyecto, setNombreNuevoProyecto] = useState("");
  const [descripcionNuevoProyecto, setDescripcionNuevoProyecto] = useState("");
  const [monedaNuevoProyecto, setMonedaNuevoProyecto] = useState("ARS");
  const [monedaLibreNuevoProyecto, setMonedaLibreNuevoProyecto] = useState("");
  const [precioNuevoProyecto, setPrecioNuevoProyecto] = useState(0);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [errorProyecto, setErrorProyecto] = useState("");

  // --- Proyectos expandidos (ver modificaciones/pagos) ---
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // --- Nueva modificación ---
  const [proyectoModificandoId, setProyectoModificandoId] = useState<
    string | null
  >(null);
  const [notaModificacion, setNotaModificacion] = useState("");
  const [tipoAjuste, setTipoAjuste] = useState<"sin_cambio" | "aumenta" | "disminuye">(
    "sin_cambio"
  );
  const [montoAjuste, setMontoAjuste] = useState(0);
  const [guardandoModificacion, setGuardandoModificacion] = useState(false);
  const [errorModificacion, setErrorModificacion] = useState("");

  // --- Nuevo pago ---
  const [proyectoPagandoId, setProyectoPagandoId] = useState<string | null>(
    null
  );
  const [modoPago, setModoPago] = useState<"nuevo" | "vincular" | "historico">(
    "nuevo"
  );
  const [montoPago, setMontoPago] = useState(0);
  const [cuentaPagoId, setCuentaPagoId] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [busquedaVincular, setBusquedaVincular] = useState("");
  const [movimientoVinculadoId, setMovimientoVinculadoId] = useState<
    string | null
  >(null);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  async function cargar() {
    setCargando(true);
    const [rc, rs, ra, rm] = await Promise.all([
      fetch("/api/clients"),
      fetch("/api/session"),
      fetch("/api/accounts"),
      fetch("/api/movements"),
    ]);
    const dc = await rc.json();
    const ds = await rs.json();
    const da = await ra.json();
    const dm = await rm.json();
    setClientes(dc.clientes ?? []);
    setProyectos(dc.proyectos ?? []);
    setModificaciones(dc.modificaciones ?? []);
    setPagos(dc.pagos ?? []);
    setResumenPorProyecto(dc.resumenPorProyecto ?? {});
    setCuentas(da.cuentas ?? []);
    setMovimientos(dm.movimientos ?? []);
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

  const modificacionesPorProyecto = useMemo(() => {
    const m = new Map<string, Modificacion[]>();
    for (const mo of modificaciones) {
      if (!m.has(mo.proyectoId)) m.set(mo.proyectoId, []);
      m.get(mo.proyectoId)!.push(mo);
    }
    return m;
  }, [modificaciones]);

  const pagosPorProyecto = useMemo(() => {
    const m = new Map<string, PagoConEstado[]>();
    for (const pg of pagos) {
      if (!m.has(pg.proyectoId)) m.set(pg.proyectoId, []);
      m.get(pg.proyectoId)!.push(pg);
    }
    return m;
  }, [pagos]);

  const cuentasPorId = useMemo(() => {
    const m = new Map<string, Cuenta>();
    cuentas.forEach((c) => m.set(c.id, c));
    return m;
  }, [cuentas]);

  const movimientosPorId = useMemo(() => {
    const m = new Map<string, Movimiento>();
    movimientos.forEach((mv) => m.set(mv.id, mv));
    return m;
  }, [movimientos]);

  const movimientosIdsVinculados = useMemo(
    () => new Set(pagos.map((p) => p.movimientoId)),
    [pagos]
  );

  /** Ingresos que todavía no están vinculados a ningún pago — candidatos
   *  para "vincular uno existente" (evitar duplicar un pago ya cargado). */
  const ingresosVinculables = useMemo(
    () =>
      movimientos
        .filter(
          (m) =>
            m.tipo === "ingreso" &&
            !m.anulado &&
            !movimientosIdsVinculados.has(m.id)
        )
        .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)),
    [movimientos, movimientosIdsVinculados]
  );

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [clientes]
  );

  function alternarExpandido(proyectoId: string) {
    setExpandidos((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(proyectoId)) nuevo.delete(proyectoId);
      else nuevo.add(proyectoId);
      return nuevo;
    });
  }

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
        body: JSON.stringify({ nombre, proyecto, descripcion, moneda, precio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      setProyecto("");
      setDescripcion("");
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
    setDescripcionNuevoProyecto("");
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
          descripcion: descripcionNuevoProyecto,
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

  function empezarModificacion(proyectoId: string) {
    setProyectoModificandoId(proyectoId);
    setNotaModificacion("");
    setTipoAjuste("sin_cambio");
    setMontoAjuste(0);
    setErrorModificacion("");
  }

  async function guardarModificacion(proyectoId: string) {
    setErrorModificacion("");
    const ajuste =
      tipoAjuste === "disminuye"
        ? -Math.abs(montoAjuste)
        : tipoAjuste === "aumenta"
        ? Math.abs(montoAjuste)
        : 0;
    setGuardandoModificacion(true);
    try {
      const res = await fetch(`/api/projects/${proyectoId}/modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nota: notaModificacion,
          ajuste,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProyectoModificandoId(null);
      await cargar();
    } catch (e: any) {
      setErrorModificacion(e.message ?? "Error inesperado.");
    } finally {
      setGuardandoModificacion(false);
    }
  }

  function empezarPago(proyectoId: string, monedaProyecto: string) {
    setProyectoPagandoId(proyectoId);
    setModoPago("nuevo");
    setMontoPago(0);
    setNotaPago("");
    const primeraCuentaValida = cuentas.find(
      (c) => c.moneda === monedaProyecto && c.activa
    );
    setCuentaPagoId(primeraCuentaValida?.id ?? "");
    setBusquedaVincular("");
    setMovimientoVinculadoId(null);
    setErrorPago("");
  }

  async function guardarPago(proyectoId: string) {
    setErrorPago("");
    if (modoPago === "nuevo" && !cuentaPagoId) {
      setErrorPago("Elegí en qué cuenta entró el pago.");
      return;
    }
    if (modoPago === "vincular" && !movimientoVinculadoId) {
      setErrorPago("Elegí cuál de tus movimientos ya cargados corresponde a este pago.");
      return;
    }
    setGuardandoPago(true);
    try {
      const body =
        modoPago === "nuevo"
          ? { modo: "nuevo", monto: montoPago, cuentaId: cuentaPagoId, nota: notaPago }
          : modoPago === "vincular"
          ? { modo: "vincular", movimientoId: movimientoVinculadoId, nota: notaPago }
          : { modo: "historico", monto: montoPago, nota: notaPago };
      const res = await fetch(`/api/projects/${proyectoId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProyectoPagandoId(null);
      await cargar();
    } catch (e: any) {
      setErrorPago(e.message ?? "Error inesperado.");
    } finally {
      setGuardandoPago(false);
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
          Clientes y sus proyectos: importe, modificaciones y pagos.
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
          <div className="sm:col-span-2">
            <label className="label">Descripción (opcional)</label>
            <input
              className="input"
              placeholder="Detalle del proyecto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
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

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Todos los clientes</h2>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : clientesOrdenados.length === 0 ? (
          <p className="text-madera-400 text-sm text-center py-4">
            No hay clientes todavía.
          </p>
        ) : (
          <div className="space-y-6">
            {clientesOrdenados.map((c) => {
              const susProyectos = proyectosPorCliente.get(c.id) ?? [];
              return (
                <div
                  key={c.id}
                  className="border-b border-madera-100 pb-6 last:border-0 last:pb-0"
                >
                  <h3 className="font-semibold text-madera-800 mb-3">
                    {c.nombre}
                  </h3>

                  {susProyectos.length === 0 && (
                    <p className="text-xs text-madera-400 mb-2">
                      Sin proyectos todavía.
                    </p>
                  )}

                  <div className="space-y-2">
                    {susProyectos.map((p) => {
                      const resumen = resumenPorProyecto[p.id];
                      const expandido = expandidos.has(p.id);
                      const susMods = modificacionesPorProyecto.get(p.id) ?? [];
                      const susPagos = pagosPorProyecto.get(p.id) ?? [];
                      const cuentasValidas = cuentas.filter(
                        (cu) => cu.moneda === p.moneda && cu.activa
                      );

                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-madera-100 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => alternarExpandido(p.id)}
                            className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-madera-50"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{p.nombre}</p>
                              {p.descripcion && (
                                <p className="text-xs text-madera-500 truncate">
                                  {p.descripcion}
                                </p>
                              )}
                            </div>
                            <div className="text-right text-xs shrink-0 space-y-0.5">
                              <div className="text-madera-600">
                                Importe:{" "}
                                <span className="font-medium">
                                  {formatMoney(resumen?.importe ?? p.precio, p.moneda)}
                                </span>
                              </div>
                              <div className="text-green-700">
                                Pagado: {formatMoney(resumen?.pagado ?? 0, p.moneda)}
                              </div>
                              <div
                                className={
                                  (resumen?.saldo ?? p.precio) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-madera-400"
                                }
                              >
                                Saldo: {formatMoney(resumen?.saldo ?? p.precio, p.moneda)}
                              </div>
                            </div>
                          </button>

                          {expandido && (
                            <div className="border-t border-madera-100 p-3 space-y-4 bg-madera-50/50">
                              {/* Modificaciones */}
                              <div>
                                <h4 className="text-xs font-semibold text-madera-600 uppercase mb-1.5">
                                  Modificaciones
                                </h4>
                                {susMods.length > 0 && (
                                  <ul className="space-y-1 mb-2">
                                    {susMods.map((m) => (
                                      <li
                                        key={m.id}
                                        className="text-xs text-madera-700 flex justify-between gap-2"
                                      >
                                        <span>
                                          <span className="text-madera-400">
                                            {fechaCorta(m.creadoEn)}
                                          </span>{" "}
                                          — {m.nota}
                                        </span>
                                        {m.ajuste !== 0 && (
                                          <span
                                            className={`shrink-0 font-medium ${
                                              m.ajuste > 0
                                                ? "text-green-700"
                                                : "text-red-600"
                                            }`}
                                          >
                                            {m.ajuste > 0 ? "+" : ""}
                                            {formatMoney(m.ajuste, p.moneda)}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {proyectoModificandoId === p.id ? (
                                  <div className="grid gap-2 sm:grid-cols-3 items-start bg-white rounded-lg p-2.5">
                                    <input
                                      className="input sm:col-span-3"
                                      placeholder="Qué cambió"
                                      value={notaModificacion}
                                      onChange={(e) =>
                                        setNotaModificacion(e.target.value)
                                      }
                                    />
                                    <select
                                      className="input"
                                      value={tipoAjuste}
                                      onChange={(e) =>
                                        setTipoAjuste(e.target.value as typeof tipoAjuste)
                                      }
                                    >
                                      <option value="sin_cambio">Sin cambio de precio</option>
                                      <option value="aumenta">Aumenta el precio</option>
                                      <option value="disminuye">Disminuye el precio</option>
                                    </select>
                                    {tipoAjuste !== "sin_cambio" && (
                                      <MoneyInput
                                        className="input sm:col-span-2"
                                        value={montoAjuste}
                                        onChange={setMontoAjuste}
                                        placeholder="Monto del ajuste"
                                      />
                                    )}
                                    <div className="flex gap-2 sm:col-span-3">
                                      <button
                                        type="button"
                                        className="btn-primary py-1 px-3 text-xs"
                                        disabled={guardandoModificacion}
                                        onClick={() => guardarModificacion(p.id)}
                                      >
                                        {guardandoModificacion
                                          ? "Guardando..."
                                          : "Guardar"}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-secondary py-1 px-3 text-xs"
                                        onClick={() => setProyectoModificandoId(null)}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                    {errorModificacion && (
                                      <p className="text-xs text-red-600 sm:col-span-3">
                                        {errorModificacion}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs text-madera-500 hover:text-madera-700 underline"
                                    onClick={() => empezarModificacion(p.id)}
                                  >
                                    + Agregar modificación
                                  </button>
                                )}
                              </div>

                              {/* Pagos */}
                              <div>
                                <h4 className="text-xs font-semibold text-madera-600 uppercase mb-1.5">
                                  Pagos
                                </h4>
                                {susPagos.length > 0 && (
                                  <ul className="space-y-1 mb-2">
                                    {susPagos.map((pg) => (
                                      <li
                                        key={pg.id}
                                        className={`text-xs flex justify-between gap-2 ${
                                          pg.anulado
                                            ? "text-madera-400 line-through"
                                            : "text-madera-700"
                                        }`}
                                      >
                                        <span>
                                          <span className="text-madera-400">
                                            {formatFecha(
                                              (pg.movimientoId &&
                                                movimientosPorId.get(pg.movimientoId)
                                                  ?.fecha) ||
                                                pg.creadoEn.slice(0, 10)
                                            )}
                                          </span>{" "}
                                          —{" "}
                                          {pg.cuentaId
                                            ? cuentasPorId.get(pg.cuentaId)?.nombre ??
                                              "?"
                                            : "Pago histórico"}
                                          {pg.nota ? ` (${pg.nota})` : ""}
                                          {pg.anulado ? " · anulado" : ""}
                                        </span>
                                        <span
                                          className={`shrink-0 font-medium ${
                                            pg.anulado ? "" : "text-green-700"
                                          }`}
                                        >
                                          {formatMoney(pg.monto, p.moneda)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {proyectoPagandoId === p.id ? (
                                  <div className="bg-white rounded-lg p-2.5 space-y-2">
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        className={`py-1 px-2.5 text-xs rounded-md border ${
                                          modoPago === "nuevo"
                                            ? "bg-madera-700 text-white border-madera-700"
                                            : "border-madera-200 text-madera-600"
                                        }`}
                                        onClick={() => setModoPago("nuevo")}
                                      >
                                        Pago nuevo
                                      </button>
                                      <button
                                        type="button"
                                        className={`py-1 px-2.5 text-xs rounded-md border ${
                                          modoPago === "vincular"
                                            ? "bg-madera-700 text-white border-madera-700"
                                            : "border-madera-200 text-madera-600"
                                        }`}
                                        onClick={() => setModoPago("vincular")}
                                      >
                                        Vincular uno que ya cargué
                                      </button>
                                      <button
                                        type="button"
                                        className={`py-1 px-2.5 text-xs rounded-md border ${
                                          modoPago === "historico"
                                            ? "bg-madera-700 text-white border-madera-700"
                                            : "border-madera-200 text-madera-600"
                                        }`}
                                        onClick={() => setModoPago("historico")}
                                      >
                                        Pago histórico
                                      </button>
                                    </div>

                                    {modoPago === "nuevo" ? (
                                      <div className="grid gap-2 sm:grid-cols-3 items-start">
                                        <MoneyInput
                                          value={montoPago}
                                          onChange={setMontoPago}
                                          placeholder="Monto"
                                        />
                                        <select
                                          className="input"
                                          value={cuentaPagoId}
                                          onChange={(e) => setCuentaPagoId(e.target.value)}
                                        >
                                          <option value="" disabled>
                                            Cuenta que lo recibe
                                          </option>
                                          {cuentasValidas.map((cu) => (
                                            <option key={cu.id} value={cu.id}>
                                              {cu.nombre} ({cu.moneda})
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          className="input"
                                          placeholder="Nota (opcional)"
                                          value={notaPago}
                                          onChange={(e) => setNotaPago(e.target.value)}
                                        />
                                        {cuentasValidas.length === 0 && (
                                          <p className="text-xs text-amber-700 sm:col-span-3">
                                            No hay cuentas activas en {p.moneda}. Creá
                                            una en "Cuentas" para poder registrar el
                                            pago.
                                          </p>
                                        )}
                                      </div>
                                    ) : modoPago === "vincular" ? (
                                      (() => {
                                        const candidatos = ingresosVinculables
                                          .filter(
                                            (m) =>
                                              cuentasPorId.get(m.cuentaId)?.moneda ===
                                              p.moneda
                                          )
                                          .filter((m) => {
                                            const texto = busquedaVincular
                                              .trim()
                                              .toLowerCase();
                                            if (!texto) return true;
                                            const cuentaNombre =
                                              cuentasPorId.get(m.cuentaId)?.nombre ?? "";
                                            return `${m.categoria} ${m.descripcion} ${cuentaNombre}`
                                              .toLowerCase()
                                              .includes(texto);
                                          })
                                          .slice(0, 15);
                                        return (
                                          <div className="space-y-2">
                                            <input
                                              className="input"
                                              placeholder="Buscar por cuenta, categoría, descripción..."
                                              value={busquedaVincular}
                                              onChange={(e) => {
                                                setBusquedaVincular(e.target.value);
                                                setMovimientoVinculadoId(null);
                                              }}
                                            />
                                            <div className="max-h-48 overflow-y-auto border border-madera-100 rounded-lg divide-y divide-madera-50">
                                              {candidatos.length === 0 && (
                                                <p className="text-xs text-madera-400 p-2">
                                                  No hay ingresos en {p.moneda} sin
                                                  vincular que coincidan.
                                                </p>
                                              )}
                                              {candidatos.map((m) => (
                                                <button
                                                  type="button"
                                                  key={m.id}
                                                  onClick={() => setMovimientoVinculadoId(m.id)}
                                                  className={`w-full text-left px-2 py-1.5 text-xs flex justify-between gap-2 hover:bg-madera-50 ${
                                                    movimientoVinculadoId === m.id
                                                      ? "bg-madera-100"
                                                      : ""
                                                  }`}
                                                >
                                                  <span className="min-w-0 truncate">
                                                    {formatFecha(m.fecha)} —{" "}
                                                    {cuentasPorId.get(m.cuentaId)?.nombre}
                                                    {m.categoria ? ` · ${m.categoria}` : ""}
                                                    {m.descripcion ? ` · ${m.descripcion}` : ""}
                                                  </span>
                                                  <span className="shrink-0 font-medium">
                                                    {formatMoney(m.monto, p.moneda)}
                                                  </span>
                                                </button>
                                              ))}
                                            </div>
                                            <input
                                              className="input"
                                              placeholder="Nota (opcional)"
                                              value={notaPago}
                                              onChange={(e) => setNotaPago(e.target.value)}
                                            />
                                          </div>
                                        );
                                      })()
                                    ) : null}

                                    {modoPago === "historico" && (
                                      <div className="space-y-2">
                                        <div className="grid gap-2 sm:grid-cols-2 items-start">
                                          <MoneyInput
                                            value={montoPago}
                                            onChange={setMontoPago}
                                            placeholder="Monto"
                                          />
                                          <input
                                            className="input"
                                            placeholder="Nota (opcional)"
                                            value={notaPago}
                                            onChange={(e) => setNotaPago(e.target.value)}
                                          />
                                        </div>
                                        <p className="text-xs text-madera-500">
                                          Para adelantos que el cliente ya te pagó
                                          antes de empezar a usar la app. No crea
                                          ningún movimiento en la caja: solo
                                          actualiza el saldo por cobrar de este
                                          proyecto.
                                        </p>
                                      </div>
                                    )}

                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="btn-primary py-1 px-3 text-xs"
                                        disabled={
                                          guardandoPago ||
                                          (modoPago === "nuevo" && cuentasValidas.length === 0)
                                        }
                                        onClick={() => guardarPago(p.id)}
                                      >
                                        {guardandoPago ? "Guardando..." : "Guardar"}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-secondary py-1 px-3 text-xs"
                                        onClick={() => setProyectoPagandoId(null)}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                    {errorPago && (
                                      <p className="text-xs text-red-600">{errorPago}</p>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs text-madera-500 hover:text-madera-700 underline"
                                    onClick={() => empezarPago(p.id, p.moneda)}
                                  >
                                    + Registrar pago
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2">
                    {clienteAgregandoId === c.id ? (
                      <div className="grid gap-2 sm:grid-cols-4 items-start bg-madera-50 rounded-lg p-3">
                        <input
                          className="input"
                          placeholder="Nombre del proyecto"
                          value={nombreNuevoProyecto}
                          onChange={(e) => setNombreNuevoProyecto(e.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="Descripción (opcional)"
                          value={descripcionNuevoProyecto}
                          onChange={(e) =>
                            setDescripcionNuevoProyecto(e.target.value)
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
