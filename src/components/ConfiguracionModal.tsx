"use client";

import { useRef, useState } from "react";
import type { Configuracion } from "@/lib/types";

const TAMANO_MAX_BYTES = 200 * 1024; // 200 KB, de sobra para un ícono/logo chico

export default function ConfiguracionModal({
  config,
  onCerrar,
  onGuardado,
}: {
  config: Configuracion;
  onCerrar: () => void;
  onGuardado: (config: Configuracion) => void;
}) {
  const [nombreApp, setNombreApp] = useState(config.nombreApp);
  const [logoDataUri, setLogoDataUri] = useState(config.logoDataUri);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const inputArchivoRef = useRef<HTMLInputElement>(null);

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
    setGuardando(true);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreApp, logoDataUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onGuardado(data.config);
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onCerrar}
    >
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-gray-900">
            Nombre y logo
          </h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Se muestran arriba de todas las pantallas, incluida la de login.
        </p>

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
            <div className="h-16 w-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {logoDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoDataUri}
                  alt=""
                  className="h-full w-full object-contain"
                />
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
          <p className="text-xs text-gray-400 mt-1">
            Imagen chica (ideal: cuadrada, menos de 200 KB). Se guarda dentro
            de tu propia planilla, no se sube a ningún otro lado.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button className="btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
