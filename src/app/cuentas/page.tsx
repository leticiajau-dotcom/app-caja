"use client";

import { useEffect, useState } from "react";
import {
  MONEDAS_SUGERIDAS,
  TIPOS_CUENTA,
  formatMoney,
  tipoCuentaLabel,
} from "@/lib/format";
import MoneyInput from "@/components/MoneyInput";
import type { Cuenta, TipoCuenta } from "@/lib/types";

interface UsuarioPublico {
  id: string;
  nombre: string;
}

const MONEDA_OTRA = "__otra__";

function ResponsablesCheckboxes({
  usuarios,
  seleccionados,
  onChange,
}: {
  usuarios: UsuarioPublico[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
}) {
  function alternar(id: string) {
    onChange(
      seleccionados.includes(id)
        ? seleccionados.filter((x) => x !== id)
        : [...seleccionados, id]
    );
  }
  if (usuarios.length === 0) {
    return <p className="text-xs text-madera-400">No hay usuarios cargados todavía.</p>;
  }
  return (
    <div className="flex flex-wrap gap-3">
      {usuarios.map((u) => (
        <label key={u.id} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={seleccionados.includes(u.id)}
            onChange={() => alternar(u.id)}
          />
          {u.nombre}
        </label>
      ))}
    </div>
  );
}

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("efectivo");
  const [tipoPersonalizado, setTipoPersonalizado] = useState("");
  const [monedaSeleccion, setMonedaSeleccion] = useState("ARS");
  const [monedaLibre, setMonedaLibre] = useState("");
  const [responsables, setResponsables] = useState<string[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [responsablesEdicion, setResponsablesEdicion] = useState<string[]>([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  async function cargar() {
    setCargando(true);
    const [rc, ru, rs] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/users/public"),
      fetch("/api/session"),
    ]);
    const dc = await rc.json();
    const du = await ru.json();
    const ds = await rs.json();
    setCuentas(dc.cuentas ?? []);
    setUsuarios(du.usuarios ?? []);
    setEsAdmin(ds.sesion?.rol === "admin");
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const moneda =
      monedaSeleccion === MONEDA_OTRA ? monedaLibre.trim() : monedaSeleccion;
    try {
      if (!moneda) {
        throw new Error("Ingresá el código de la moneda.");
      }
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo,
          tipoPersonalizado: tipo === "otra" ? tipoPersonalizado : null,
          moneda,
          usuarioResponsablesIds: responsables,
          saldoInicial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      setTipoPersonalizado("");
      setResponsables([]);
      setSaldoInicial(0);
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActiva(cuenta: Cuenta) {
    await fetch(`/api/accounts/${cuenta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !cuenta.activa }),
    });
    await cargar();
  }

  function empezarEdicion(cuenta: Cuenta) {
    setEditandoId(cuenta.id);
    setResponsablesEdicion(cuenta.usuarioResponsablesIds);
  }

  async function guardarResponsables(cuentaId: string) {
    setGuardandoEdicion(true);
    try {
      await fetch(`/api/accounts/${cuentaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioResponsablesIds: responsablesEdicion }),
      });
      setEditandoId(null);
      await cargar();
    } finally {
      setGuardandoEdicion(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Cuentas</h1>
        <p className="text-madera-600">
          {esAdmin
            ? "Efectivo, bancos, billeteras virtuales, cuentas en otras monedas... Creá las que necesites."
            : "Solo un administrador puede crear cuentas o asignar responsables."}
        </p>
      </div>

      {esAdmin && (
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Nueva cuenta</h2>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              placeholder="Ej: Caja chica, Banco Galicia, Mercado Pago..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCuenta)}
            >
              {TIPOS_CUENTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {tipo === "otra" && (
            <div>
              <label className="label">Nombre del tipo</label>
              <input
                className="input"
                placeholder="Ej: Cheque, Inversión, Caja de ahorro..."
                value={tipoPersonalizado}
                onChange={(e) => setTipoPersonalizado(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="label">Moneda</label>
            <select
              className="input"
              value={monedaSeleccion}
              onChange={(e) => setMonedaSeleccion(e.target.value)}
            >
              {MONEDAS_SUGERIDAS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              <option value={MONEDA_OTRA}>Otra...</option>
            </select>
          </div>
          {monedaSeleccion === MONEDA_OTRA && (
            <div>
              <label className="label">Código de moneda</label>
              <input
                className="input"
                placeholder="Ej: CLP, UYU, GBP..."
                value={monedaLibre}
                onChange={(e) => setMonedaLibre(e.target.value.toUpperCase())}
                maxLength={10}
                required
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">
              Responsables (pueden cargarle movimientos a esta cuenta)
            </label>
            <ResponsablesCheckboxes
              usuarios={usuarios}
              seleccionados={responsables}
              onChange={setResponsables}
            />
            <p className="text-xs text-madera-400 mt-1">
              Si no marcás a nadie, nadie va a poder cargarle movimientos
              hasta que le asignes un responsable.
            </p>
          </div>
          <div>
            <label className="label">Saldo inicial</label>
            <MoneyInput value={saldoInicial} onChange={setSaldoInicial} />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-lg mb-4">Todas las cuentas</h2>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-madera-500 border-b border-madera-100">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Moneda</th>
                <th className="py-2 pr-4">Responsables</th>
                <th className="py-2 pr-4 text-right">Saldo inicial</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b border-madera-50 last:border-0 align-top">
                  <td className="py-2 pr-4">{c.nombre}</td>
                  <td className="py-2 pr-4">{tipoCuentaLabel(c)}</td>
                  <td className="py-2 pr-4">{c.moneda}</td>
                  <td className="py-2 pr-4 min-w-[220px]">
                    {editandoId === c.id ? (
                      <div className="space-y-2">
                        <ResponsablesCheckboxes
                          usuarios={usuarios}
                          seleccionados={responsablesEdicion}
                          onChange={setResponsablesEdicion}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary py-1 px-2 text-xs"
                            disabled={guardandoEdicion}
                            onClick={() => guardarResponsables(c.id)}
                          >
                            {guardandoEdicion ? "Guardando..." : "Guardar"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary py-1 px-2 text-xs"
                            onClick={() => setEditandoId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          {c.usuarioResponsablesIds.length === 0
                            ? "— (solo admin)"
                            : c.usuarioResponsablesIds
                                .map(
                                  (id) =>
                                    usuarios.find((u) => u.id === id)?.nombre ?? "?"
                                )
                                .join(", ")}
                        </span>
                        {esAdmin && (
                          <button
                            type="button"
                            className="text-xs text-madera-500 hover:text-madera-700 underline shrink-0"
                            onClick={() => empezarEdicion(c)}
                          >
                            editar
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    {formatMoney(c.saldoInicial, c.moneda)}
                  </td>
                  <td className="py-2 pr-4">
                    {c.activa ? (
                      <span className="text-green-700">Activa</span>
                    ) : (
                      <span className="text-madera-400">Inactiva</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {esAdmin && (
                      <button
                        className="btn-secondary py-1 px-2 text-xs whitespace-nowrap"
                        onClick={() => alternarActiva(c)}
                      >
                        {c.activa ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {cuentas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-madera-400">
                    No hay cuentas todavía.
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
