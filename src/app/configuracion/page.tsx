"use client";

import { useEffect, useRef, useState } from "react";
import type { Configuracion } from "@/lib/types";

const TAMANO_MAX_BYTES = 200 * 1024; // 200 KB, de sobra para un ícono/logo chico

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [nombreApp, setNombreApp] = useState("");
  const [logoDataUri, setLogoDataUri] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setNombreApp(d.config?.nombreApp ?? "");
        setLogoDataUri(d.config?.logoDataUri ?? "");
      })
      .finally(() => setCargando(false));
  }, []);

  function onElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    if (archivo.size > TAMANO_MAX_BYTES) {
      setError("La imagen es muy pesada. Usá un logo chico (menos de 200 KB).");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => setLogoDataUri(String(lector.result));
    lector.readAsDataURL(archivo);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    setGuardando(true);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreApp, logoDataUri }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setSinPermiso(true);
        return;
      }
      if (!res.ok) throw new Error(data.error);
      setConfig(data.config);
      setOk(true);
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">
          Solo un administrador puede cambiar la configuración.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <p className="text-madera-500 text-sm">Cargando...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Configuración</h1>
        <p className="text-madera-600">
          Personalizá el nombre y el logo que se muestran arriba de todas las
          pantallas.
        </p>
      </div>

      <form onSubmit={guardar} className="card space-y-4">
        <div>
          <label className="label">Nombre de la app</label>
          <input
            className="input"
            value={nombreApp}
            onChange={(e) => setNombreApp(e.target.value)}
            maxLength={60}
            required
          />
        </div>

        <div>
          <label className="label">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-madera-100 bg-madera-50 flex items-center justify-center overflow-hidden">
              {logoDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUri} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl">🪵</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/*"
                onChange={onElegirArchivo}
                className="text-sm"
              />
              {logoDataUri && (
                <button
                  type="button"
                  className="btn-secondary py-1 px-2 text-xs block"
                  onClick={() => {
                    setLogoDataUri("");
                    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                  }}
                >
                  Quitar logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-madera-400 mt-1">
            Imagen chica (ideal: cuadrada, menos de 200 KB). Se guarda dentro
            de tu propia planilla, no se sube a ningún otro lado.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-700">Guardado.</p>}

        <button className="btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
