"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFecha, formatMoney } from "@/lib/format";
import MoneyInput from "@/components/MoneyInput";
import RectificarModal from "@/components/RectificarModal";
import type { Cuenta, Movimiento, SesionInterna, TipoMovimiento } from "@/lib/types";

interface UsuarioPublico {
  id: string;
  nombre: string;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function MovimientosPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [sesion, setSesion] = useState<SesionInterna | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [descripcionAbierta, setDescripcionAbierta] = useState<string | null>(null);
  const [rectificando, setRectificando] = useState<Movimiento | null>(null);

  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimiento>("ingreso");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaDestinoId, setCuentaDestinoId] = useState("");
  const [monto, setMonto] = useState(0);
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");

  async function cargar() {
    setCargando(true);
    const [rc, ru, rm, rs] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/users/public"),
      fetch("/api/movements"),
      fetch("/api/session"),
    ]);
    const dc = await rc.json();
    const du = await ru.json();
    const dm = await rm.json();
    const ds = await rs.json();
    const activas = (dc.cuentas ?? []).filter((c: Cuenta) => c.activa);
    const sesionActual: SesionInterna | null = ds.sesion ?? null;
    setCuentas(activas);
    setUsuarios(du.usuarios ?? []);
    setMovimientos(dm.movimientos ?? []);
    setSesion(sesionActual);
    if (!cuentaId && sesionActual) {
      const operables =
        sesionActual.rol === "admin"
          ? activas
          : activas.filter((c: Cuenta) => c.usuarioResponsableId === sesionActual.usuarioId);
      if (operables.length > 0) setCuentaId(operables[0].id);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cuentasPorId = useMemo(() => {
    const m = new Map<string, Cuenta>();
    cuentas.forEach((c) => m.set(c.id, c));
    return m;
  }, [cuentas]);

  const usuariosPorId = useMemo(() => {
    const m = new Map<string, string>();
    usuarios.forEach((u) => m.set(u.id, u.nombre));
    return m;
  }, [usuarios]);

  // Un admin puede cargar movimientos en cualquier cuenta. Un empleado solo
  // en las cuentas de las que él mismo es responsable.
  const cuentasOperables = useMemo(() => {
    if (!sesion) return [];
    if (sesion.rol === "admin") return cuentas;
    return cuentas.filter((c) => c.usuarioResponsableId === sesion.usuarioId);
  }, [cuentas, sesion]);

  // La cuenta destino de una transferencia solo puede ser de la misma
  // moneda que la cuenta de origen (si no, el saldo no tiene sentido).
  const cuentaOrigenSeleccionada = cuentasPorId.get(cuentaId);
  const cuentasDestinoPosibles = cuentas.filter(
    (c) => c.id !== cuentaId && c.moneda === cuentaOrigenSeleccionada?.moneda
  );

  useEffect(() => {
    if (
      tipo === "transferencia" &&
      cuentaDestinoId &&
      !cuentasDestinoPosibles.some((c) => c.id === cuentaDestinoId)
    ) {
      setCuentaDestinoId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId, tipo]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          tipo,
          cuentaId,
          cuentaDestinoId: tipo === "transferencia" ? cuentaDestinoId : null,
          monto,
          categoria,
          descripcion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMonto(0);
      setCategoria("");
      setDescripcion("");
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  function puedeRectificar(m: Movimiento) {
    if (!sesion || m.anulado) return false;
    return sesion.rol === "admin" || m.usuarioId === sesion.usuarioId;
  }

  const textoBusqueda = busqueda.trim().toLowerCase();
  const movimientosFiltrados = textoBusqueda
    ? movimientos.filter((m) => {
        const cuenta = cuentasPorId.get(m.cuentaId);
        const destino = m.cuentaDestinoId ? cuentasPorId.get(m.cuentaDestinoId) : null;
        const campos = [
          cuenta?.nombre,
          destino?.nombre,
          m.categoria,
          m.descripcion,
          m.tipo,
          usuariosPorId.get(m.usuarioId),
        ];
        return campos.some((c) => c?.toLowerCase().includes(textoBusqueda));
      })
    : movimientos;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Movimientos</h1>
        <p className="text-madera-600">
          Registrá ingresos, egresos y transferencias entre cuentas.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Nuevo movimiento</h2>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Fecha</label>
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
              <option value="transferencia">Transferencia entre cuentas</option>
            </select>
          </div>
          <div>
            <label className="label">
              {tipo === "transferencia" ? "Cuenta origen" : "Cuenta"}
            </label>
            <select
              className="input"
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              required
              disabled={cuentasOperables.length === 0}
            >
              <option value="" disabled>
                Elegí una cuenta
              </option>
              {cuentasOperables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </select>
            {!cargando && cuentasOperables.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                No sos responsable de ninguna cuenta todavía. Pedile a un
                administrador que te asigne una en "Cuentas".
              </p>
            )}
          </div>
          {tipo === "transferencia" && (
            <div>
              <label className="label">Cuenta destino</label>
              <select
                className="input"
                value={cuentaDestinoId}
                onChange={(e) => setCuentaDestinoId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Elegí una cuenta
                </option>
                {cuentasDestinoPosibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
              {cuentaOrigenSeleccionada && cuentasDestinoPosibles.length === 0 && (
                <p className="text-xs text-madera-400 mt-1">
                  No hay otra cuenta en {cuentaOrigenSeleccionada.moneda} para
                  transferir.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="label">Monto</label>
            <MoneyInput value={monto} onChange={setMonto} required />
          </div>
          <div>
            <label className="label">Categoría</label>
            <input
              className="input"
              placeholder="Ej: Venta, Materiales, Sueldos..."
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descripción</label>
            <input
              className="input"
              placeholder="Detalle opcional"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button className="btn-primary" disabled={guardando || !cuentaId}>
              {guardando ? "Guardando..." : "Registrar movimiento"}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Últimos movimientos</h2>
          <input
            className="input max-w-xs"
            placeholder="Buscar por cuenta, categoría, descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-madera-500 border-b border-madera-100">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Cuenta</th>
                <th className="py-2 pr-4">Categoría</th>
                <th className="py-2 pr-4">Registrado por</th>
                <th className="py-2 pr-4 text-right">Monto</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((m) => {
                const cuenta = cuentasPorId.get(m.cuentaId);
                const destino = m.cuentaDestinoId
                  ? cuentasPorId.get(m.cuentaDestinoId)
                  : null;
                const signo =
                  m.tipo === "egreso" ? "-" : m.tipo === "ingreso" ? "+" : "";
                const descripcionVisible = descripcionAbierta === m.id;
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-madera-50 last:border-0 align-top ${
                      m.anulado ? "opacity-50" : ""
                    }`}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatFecha(m.fecha)}
                    </td>
                    <td className="py-2 pr-4 capitalize">{m.tipo}</td>
                    <td className="py-2 pr-4">
                      {cuenta?.nombre ?? "—"}
                      {destino && ` → ${destino.nombre}`}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span>{m.categoria || "—"}</span>
                        {m.descripcion && (
                          <button
                            type="button"
                            title="Ver descripción"
                            className="text-madera-400 hover:text-madera-700 shrink-0"
                            onClick={() =>
                              setDescripcionAbierta(
                                descripcionVisible ? null : m.id
                              )
                            }
                          >
                            ⓘ
                          </button>
                        )}
                      </div>
                      {descripcionVisible && (
                        <p className="text-xs text-madera-500 mt-1 max-w-xs">
                          {m.descripcion}
                        </p>
                      )}
                      {m.anulado && (
                        <p className="text-xs text-red-500 mt-1">
                          Anulado{m.notaAnulacion ? `: ${m.notaAnulacion}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {usuariosPorId.get(m.usuarioId) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium whitespace-nowrap">
                      {signo}
                      {formatMoney(m.monto, cuenta?.moneda ?? "ARS")}
                    </td>
                    <td className="py-2 pr-4">
                      {puedeRectificar(m) && (
                        <button
                          className="btn-secondary py-1 px-2 text-xs whitespace-nowrap"
                          onClick={() => setRectificando(m)}
                        >
                          Rectificar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {movimientosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-madera-400">
                    {movimientos.length === 0
                      ? "No hay movimientos todavía."
                      : "No hay resultados para esa búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {rectificando && sesion && (
        <RectificarModal
          movimiento={rectificando}
          cuentas={cuentas}
          cuentasOperables={cuentasOperables}
          onCerrar={() => setRectificando(null)}
          onListo={() => {
            setRectificando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
