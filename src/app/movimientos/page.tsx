"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFecha, formatMoney } from "@/lib/format";
import type { Cuenta, Movimiento, TipoMovimiento } from "@/lib/types";

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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimiento>("ingreso");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaDestinoId, setCuentaDestinoId] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");

  async function cargar() {
    setCargando(true);
    const [rc, ru, rm] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/users/public"),
      fetch("/api/movements"),
    ]);
    const dc = await rc.json();
    const du = await ru.json();
    const dm = await rm.json();
    const activas = (dc.cuentas ?? []).filter((c: Cuenta) => c.activa);
    setCuentas(activas);
    setUsuarios(du.usuarios ?? []);
    setMovimientos(dm.movimientos ?? []);
    if (activas.length > 0 && !cuentaId) setCuentaId(activas[0].id);
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
          monto: Number(monto),
          categoria,
          descripcion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMonto("");
      setCategoria("");
      setDescripcion("");
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

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
            >
              <option value="" disabled>
                Elegí una cuenta
              </option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </select>
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
                {cuentas
                  .filter((c) => c.id !== cuentaId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda})
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Monto</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
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
        <h2 className="font-semibold text-lg mb-4">Últimos movimientos</h2>
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
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const cuenta = cuentasPorId.get(m.cuentaId);
                const destino = m.cuentaDestinoId
                  ? cuentasPorId.get(m.cuentaDestinoId)
                  : null;
                const signo =
                  m.tipo === "egreso"
                    ? "-"
                    : m.tipo === "ingreso"
                      ? "+"
                      : "";
                return (
                  <tr key={m.id} className="border-b border-madera-50 last:border-0">
                    <td className="py-2 pr-4">{formatFecha(m.fecha)}</td>
                    <td className="py-2 pr-4 capitalize">{m.tipo}</td>
                    <td className="py-2 pr-4">
                      {cuenta?.nombre ?? "—"}
                      {destino && ` → ${destino.nombre}`}
                    </td>
                    <td className="py-2 pr-4">{m.categoria || "—"}</td>
                    <td className="py-2 pr-4">
                      {usuariosPorId.get(m.usuarioId) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium">
                      {signo}
                      {formatMoney(m.monto, cuenta?.moneda ?? "ARS")}
                    </td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-madera-400">
                    No hay movimientos todavía.
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
