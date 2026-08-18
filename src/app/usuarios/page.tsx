"use client";

import { useEffect, useState } from "react";
import type { Rol } from "@/lib/types";

interface UsuarioSinPin {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioSinPin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [sinPermiso, setSinPermiso] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [rol, setRol] = useState<Rol>("empleado");

  async function cargar() {
    setCargando(true);
    const res = await fetch("/api/users");
    if (res.status === 403) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }
    const data = await res.json();
    setUsuarios(data.usuarios ?? []);
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
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, pin, rol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombre("");
      setPin("");
      setRol("empleado");
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(u: UsuarioSinPin) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    await cargar();
  }

  async function cambiarRol(u: UsuarioSinPin, nuevoRol: Rol) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: nuevoRol }),
    });
    await cargar();
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">
          Solo un administrador puede gestionar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Usuarios</h1>
        <p className="text-madera-600">
          Personas que pueden usar la app (dueños, empleados). Cada una
          ingresa con su nombre y un PIN propio.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Nuevo usuario</h2>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">PIN (4 a 8 dígitos)</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Rol</label>
            <select
              className="input"
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-lg mb-4">Todos los usuarios</h2>
        {cargando ? (
          <p className="text-madera-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-madera-500 border-b border-madera-100">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-madera-50 last:border-0">
                  <td className="py-2 pr-4">{u.nombre}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="input py-1"
                      value={u.rol}
                      onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                    >
                      <option value="empleado">Empleado</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    {u.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-madera-400">Inactivo</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      className="btn-secondary py-1 px-2 text-xs"
                      onClick={() => alternarActivo(u)}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-madera-400">
                    No hay usuarios todavía.
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
