"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatFecha, formatMoney } from "@/lib/format";
import { puedeVerCuentas } from "@/lib/permisos";
import type { Cuenta, Movimiento } from "@/lib/types";

interface UsuarioPublico {
  id: string;
  nombre: string;
}

export default function RetirosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const [rm, rc, ru, rs] = await Promise.all([
        fetch("/api/movements"),
        fetch("/api/accounts"),
        fetch("/api/users/public"),
        fetch("/api/session"),
      ]);
      const dm = await rm.json();
      const dc = await rc.json();
      const du = await ru.json();
      const ds = await rs.json();
      setMovimientos(dm.movimientos ?? []);
      setCuentas(dc.cuentas ?? []);
      setUsuarios(du.usuarios ?? []);
      setSinPermiso(ds.sesion ? !puedeVerCuentas(ds.sesion.rol) : false);
      setCargando(false);
    }
    cargar();
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

  const retiros = useMemo(
    () =>
      movimientos
        .filter((m) => m.tipo === "retiro")
        .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)),
    [movimientos]
  );

  // Totales por usuario y moneda (los anulados no cuentan: es como si el
  // retiro nunca hubiera pasado, igual que en los saldos de las cuentas).
  const totalesPorUsuario = useMemo(() => {
    const totales = new Map<string, Map<string, number>>();
    for (const m of retiros) {
      if (m.anulado || !m.usuarioRetiroId) continue;
      const cuenta = cuentasPorId.get(m.cuentaId);
      const moneda = cuenta?.moneda ?? "?";
      if (!totales.has(m.usuarioRetiroId)) totales.set(m.usuarioRetiroId, new Map());
      const porMoneda = totales.get(m.usuarioRetiroId)!;
      porMoneda.set(moneda, (porMoneda.get(moneda) ?? 0) + m.monto);
    }
    return Array.from(totales.entries())
      .map(([usuarioId, porMoneda]) => ({
        usuarioId,
        nombre: usuariosPorId.get(usuarioId) ?? "?",
        porMoneda: Array.from(porMoneda.entries()).sort(([a], [b]) =>
          a.localeCompare(b)
        ),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [retiros, cuentasPorId, usuariosPorId]);

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">No tenés acceso a la pantalla de Retiros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/cuentas"
          className="text-sm text-madera-500 hover:text-madera-700"
        >
          ← Volver a Cuentas
        </Link>
        <h1 className="text-2xl font-bold text-madera-800 mt-1">Retiros</h1>
        <p className="text-madera-600">
          Retiros registrados a nombre de administradores y socios, con el
          total retirado por cada uno.
        </p>
      </div>

      {cargando ? (
        <p className="text-madera-500 text-sm">Cargando...</p>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-lg mb-4">Retiros registrados</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-madera-500 border-b border-madera-100">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4">Cuenta</th>
                  <th className="py-2 pr-4 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {retiros.map((m) => {
                  const cuenta = cuentasPorId.get(m.cuentaId);
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-madera-50 last:border-0 ${
                        m.anulado ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatFecha(m.fecha)}
                      </td>
                      <td className="py-2 pr-4">
                        {m.usuarioRetiroId
                          ? (usuariosPorId.get(m.usuarioRetiroId) ?? "—")
                          : "—"}
                        {m.anulado && (
                          <p className="text-xs text-red-500">
                            Anulado{m.notaAnulacion ? `: ${m.notaAnulacion}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-4">{cuenta?.nombre ?? "—"}</td>
                      <td className="py-2 pr-4 text-right font-medium whitespace-nowrap">
                        {formatMoney(m.monto, cuenta?.moneda ?? "ARS")}
                      </td>
                    </tr>
                  );
                })}
                {retiros.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-madera-400">
                      Todavía no se registraron retiros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Total por usuario</h2>
            {totalesPorUsuario.length === 0 ? (
              <p className="text-madera-400 text-sm">
                Todavía no hay retiros para totalizar.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {totalesPorUsuario.map((t) => (
                  <div key={t.usuarioId} className="card">
                    <p className="font-semibold text-madera-800">{t.nombre}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {t.porMoneda.map(([moneda, total]) => (
                        <li key={moneda} className="flex justify-between">
                          <span className="text-madera-500">{moneda}</span>
                          <span className="font-medium">
                            {formatMoney(total, moneda)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
