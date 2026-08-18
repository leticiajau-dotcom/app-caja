"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Configuracion } from "@/lib/types";

interface UsuarioPublico {
  id: string;
  nombre: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const esBootstrap = params.get("bootstrap") === "1";

  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/users/public")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios ?? []))
      .catch(() => setUsuarios([]));
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setConfig(d.config ?? null))
      .catch(() => setConfig(null));
  }, []);

  async function crearPrimerAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pin !== pinConfirm) {
      setError("Los PIN no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, pin, rol: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await ingresar(nombre, pin);
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
      setCargando(false);
    }
  }

  async function ingresar(nombreLogin: string, pinLogin: string) {
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreLogin, pin: pinLogin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    ingresar(nombre, pin);
  }

  if (esBootstrap || usuarios.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="card space-y-4">
          <h1 className="text-xl font-bold text-madera-800">
            Creá el primer usuario (administrador)
          </h1>
          <p className="text-sm text-madera-600">
            Todavía no hay usuarios en la planilla. Este primer usuario va a
            quedar como administrador, con permisos para agregar más
            personas y cuentas.
          </p>
          <form onSubmit={crearPrimerAdmin} className="space-y-3">
            <div>
              <label className="label">Tu nombre</label>
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
              <label className="label">Repetí el PIN</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={cargando}>
              {cargando ? "Creando..." : "Crear usuario y entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold text-madera-800 flex items-center gap-2">
          {config?.logoDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoDataUri}
              alt=""
              className="h-7 w-7 rounded object-contain"
            />
          ) : (
            <span>🪵</span>
          )}
          {config?.nombreApp ?? "Caja Negocio"}
        </h1>
        <form onSubmit={onSubmitLogin} className="space-y-3">
          <div>
            <label className="label">Usuario</label>
            <select
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            >
              <option value="" disabled>
                Elegí tu nombre
              </option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">PIN</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
