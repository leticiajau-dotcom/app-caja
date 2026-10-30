"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFecha, formatMoney } from "@/lib/format";
import type { Empleado } from "@/lib/types";

interface PagoSueldo {
  movimientoId: string;
  fecha: string;
  monto: number;
  moneda: string;
  categoria: string;
  descripcion: string;
  usuarioId: string;
}

interface ResumenSueldosEmpleado {
  empleadoId: string;
  totalPorMoneda: Record<string, number>;
  porMes: { mes: string; totalPorMoneda: Record<string, number>; pagos: PagoSueldo[] }[];
}

interface UsuarioPublico {
  id: string;
  nombre: string;
}

function etiquetaMes(mes: string) {
  const [anio, m] = mes.split("-").map(Number);
  const d = new Date(anio, (m || 1) - 1, 1);
  const texto = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function totalesTexto(porMoneda: Record<string, number>) {
  const entradas = Object.entries(porMoneda);
  if (entradas.length === 0) return null;
  return entradas.map(([moneda, monto]) => formatMoney(monto, moneda)).join(" + ");
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [resumenes, setResumenes] = useState<ResumenSueldosEmpleado[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);

  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  async function cargar() {
    setCargando(true);
    const [re, ru] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/users/public"),
    ]);
    if (re.status === 403) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }
    const de = await re.json();
    const du = await ru.json();
    setEmpleados(de.empleados ?? []);
    setResumenes(de.resumenSueldos ?? []);
    setUsuarios(du.usuarios ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const usuariosPorId = useMemo(() => {
    const m = new Map<string, string>();
    usuarios.forEach((u) => m.set(u.id, u.nombre));
    return m;
  }, [usuarios]);

  const resumenPorEmpleadoId = useMemo(() => {
    const m = new Map<string, ResumenSueldosEmpleado>();
    resumenes.forEach((r) => m.set(r.empleadoId, r));
    return m;
  }, [resumenes]);

  const empleadosOrdenados = useMemo(
    () => [...empleados].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [empleados]
  );

  function alternarExpandido(id: string) {
    setExpandidos((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(empleado: Empleado) {
    await fetch(`/api/employees/${empleado.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !empleado.activo }),
    });
    await cargar();
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">
          No tenés acceso a Empleados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Empleados</h1>
        <p className="text-madera-600">
          Para imputar egresos como pago de sueldo y llevar la cuenta de lo
          pagado a cada uno, mes a mes. No hace falta que el empleado use la
          app.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Nuevo empleado</h2>
        <form onSubmit={crear} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Nombre</label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Agregar empleado"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-lg">Todos los empleados</h2>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : empleadosOrdenados.length === 0 ? (
          <p className="text-madera-400 text-sm">No hay empleados todavía.</p>
        ) : (
          <div className="space-y-3">
            {empleadosOrdenados.map((empleado) => {
              const resumen = resumenPorEmpleadoId.get(empleado.id);
              const total = resumen ? totalesTexto(resumen.totalPorMoneda) : null;
              const expandido = expandidos.has(empleado.id);
              return (
                <div
                  key={empleado.id}
                  className={`border border-madera-100 rounded-xl p-3.5 ${
                    empleado.activo ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-madera-800">
                        {empleado.nombre}
                      </p>
                      <p className="text-xs text-madera-500">
                        {empleado.activo ? (
                          <span className="text-green-700">Activo</span>
                        ) : (
                          <span className="text-madera-400">Inactivo</span>
                        )}
                        {total && <> · Pagado en total: {total}</>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {resumen && resumen.porMes.length > 0 && (
                        <button
                          type="button"
                          className="btn-secondary py-1 px-2 text-xs"
                          onClick={() => alternarExpandido(empleado.id)}
                        >
                          {expandido ? "Ocultar pagos" : "Ver pagos"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2 text-xs"
                        onClick={() => alternarActivo(empleado)}
                      >
                        {empleado.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>

                  {expandido && resumen && (
                    <div className="mt-3 space-y-3 border-t border-madera-100 pt-3">
                      {resumen.porMes.map((mes) => (
                        <div key={mes.mes}>
                          <p className="text-xs font-semibold text-madera-600 uppercase mb-1">
                            {etiquetaMes(mes.mes)} — {totalesTexto(mes.totalPorMoneda)}
                          </p>
                          <ul className="space-y-1">
                            {mes.pagos.map((pago) => (
                              <li
                                key={pago.movimientoId}
                                className="text-xs flex justify-between gap-2 text-madera-700"
                              >
                                <span>
                                  <span className="text-madera-400">
                                    {formatFecha(pago.fecha)}
                                  </span>{" "}
                                  — {usuariosPorId.get(pago.usuarioId) ?? "—"}
                                  {pago.descripcion ? ` (${pago.descripcion})` : ""}
                                </span>
                                <span className="shrink-0 font-medium">
                                  {formatMoney(pago.monto, pago.moneda)}
                                </span>
                              </li>
                            ))}
                          </ul>
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
    </div>
  );
}
