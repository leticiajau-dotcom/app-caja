"use client";

import { useEffect, useState } from "react";
import { TIPOS_CUENTA, formatMoney } from "@/lib/format";
import type { Cuenta } from "@/lib/types";

interface UsuarioPublico {
  id: string;
  nombre: string;
}

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("efectivo");
  const [moneda, setMoneda] = useState("ARS");
  const [responsable, setResponsable] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    const [rc, ru] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/users/public"),
    ]);
    const dc = await rc.json();
    const du = await ru.json();
    setCuentas(dc.cuentas ?? []);
    setUsuarios(du.usuarios ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo,
          moneda,
          usuarioResponsableId: responsable || null,
          saldoInicial: Number(saldoInicial) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      setSaldoInicial("0");
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Cuentas</h1>
        <p className="text-madera-600">
          Efectivo, bancos, billeteras virtuales, cuentas en dólares... Creá
          las que necesites.
        </p>
      </div>

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
              onChange={(e) => setTipo(e.target.value)}
            >
              {TIPOS_CUENTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Moneda</label>
            <input
              className="input"
              placeholder="ARS, USD..."
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Responsable</label>
            <select
              className="input"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Saldo inicial</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>

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
                <th className="py-2 pr-4">Responsable</th>
                <th className="py-2 pr-4 text-right">Saldo inicial</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b border-madera-50 last:border-0">
                  <td className="py-2 pr-4">{c.nombre}</td>
                  <td className="py-2 pr-4 capitalize">
                    {c.tipo.replace("_", " ")}
                  </td>
                  <td className="py-2 pr-4">{c.moneda}</td>
                  <td className="py-2 pr-4">
                    {usuarios.find((u) => u.id === c.usuarioResponsableId)
                      ?.nombre ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-right">
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
                    <button
                      className="btn-secondary py-1 px-2 text-xs"
                      onClick={() => alternarActiva(c)}
                    >
                      {c.activa ? "Desactivar" : "Activar"}
                    </button>
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
