"use client";

import { useState } from "react";
import MoneyInput from "./MoneyInput";
import { soloPuedeRegistrarEgresos } from "@/lib/permisos";
import type { Cuenta, Movimiento, Rol, TipoMovimiento } from "@/lib/types";

interface Props {
  movimiento: Movimiento;
  /** Todas las cuentas activas (para elegir la cuenta destino de una
   *  transferencia, igual que en el formulario principal). */
  cuentas: Cuenta[];
  /** Cuentas en las que el usuario actual puede cargar movimientos. */
  cuentasOperables: Cuenta[];
  rol: Rol;
  onCerrar: () => void;
  onListo: () => void;
}

/** Modal para rectificar un movimiento: siempre se anula el original (queda
 *  visible con la nota) y, opcionalmente, se carga uno nuevo ya corregido. */
export default function RectificarModal({
  movimiento,
  cuentas,
  cuentasOperables,
  rol,
  onCerrar,
  onListo,
}: Props) {
  const [nota, setNota] = useState("");
  const [cargarCorreccion, setCargarCorreccion] = useState(true);
  const [fecha, setFecha] = useState(movimiento.fecha);
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento.tipo);
  const [cuentaId, setCuentaId] = useState(movimiento.cuentaId);
  const [cuentaDestinoId, setCuentaDestinoId] = useState(
    movimiento.cuentaDestinoId ?? ""
  );
  const [monto, setMonto] = useState(movimiento.monto);
  const [categoria, setCategoria] = useState(movimiento.categoria);
  const [descripcion, setDescripcion] = useState(movimiento.descripcion);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Si el rol solo puede registrar egresos, el tipo efectivo del
  // reemplazo es siempre "egreso", más allá de qué diga el estado (que
  // puede haber arrancado en otro valor si el movimiento original —
  // cargado antes de esta restricción— era de otro tipo).
  const tipoEfectivo: TipoMovimiento = soloPuedeRegistrarEgresos(rol) ? "egreso" : tipo;

  const cuentaOrigen = cuentas.find((c) => c.id === cuentaId);
  const cuentasDestinoPosibles = cuentas.filter(
    (c) => c.id !== cuentaId && c.moneda === cuentaOrigen?.moneda
  );

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/movements/${movimiento.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nota,
          reemplazo: cargarCorreccion
            ? {
                fecha,
                tipo: tipoEfectivo,
                cuentaId,
                cuentaDestinoId:
                  tipoEfectivo === "transferencia" ? cuentaDestinoId : null,
                monto,
                categoria,
                descripcion,
              }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onListo();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-lg text-madera-800">
            Rectificar movimiento
          </h2>
          <p className="text-sm text-madera-500">
            El movimiento original queda anulado (nunca se borra), con tu
            nombre y el motivo. Podés cargar directamente el movimiento
            corregido acá mismo.
          </p>
        </div>

        <form onSubmit={confirmar} className="space-y-4">
          <div>
            <label className="label">Motivo de la corrección</label>
            <textarea
              className="input"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: se cargó el monto equivocado"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-madera-700">
            <input
              type="checkbox"
              checked={cargarCorreccion}
              onChange={(e) => setCargarCorreccion(e.target.checked)}
            />
            Cargar el movimiento ya corregido
          </label>

          {cargarCorreccion && (
            <div className="grid gap-3 sm:grid-cols-2 border-t border-madera-100 pt-4">
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
                {soloPuedeRegistrarEgresos(rol) ? (
                  <select className="input" value="egreso" disabled>
                    <option value="egreso">Egreso</option>
                  </select>
                ) : (
                  <select
                    className="input"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                    <option value="transferencia">Transferencia entre cuentas</option>
                  </select>
                )}
              </div>
              <div>
                <label className="label">
                  {tipoEfectivo === "transferencia" ? "Cuenta origen" : "Cuenta"}
                </label>
                <select
                  className="input"
                  value={cuentaId}
                  onChange={(e) => setCuentaId(e.target.value)}
                  required
                >
                  {cuentasOperables.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda})
                    </option>
                  ))}
                </select>
              </div>
              {tipoEfectivo === "transferencia" && (
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
                </div>
              )}
              <div>
                <label className="label">Monto</label>
                <MoneyInput value={monto} onChange={setMonto} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <input
                  className="input"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Descripción</label>
                <input
                  className="input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Confirmar rectificación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
