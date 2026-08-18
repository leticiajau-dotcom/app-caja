"use client";

import { signIn, useSession } from "next-auth/react";
import { useState } from "react";

export default function ConectarPage() {
  const { data: session, status } = useSession();
  const [resultado, setResultado] = useState<{
    spreadsheetId: string;
    refreshToken: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function crearPlanilla() {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultado(data);
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-madera-800">
          🪵 Caja Carpintería
        </h1>
        <p className="text-madera-600 mt-1">
          Paso único de configuración: conectá el Google Drive donde va a
          vivir la planilla con todos los datos del negocio.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-lg">1. Conectar con Google</h2>
        <p className="text-sm text-madera-600">
          Iniciá sesión con la cuenta de Google donde querés guardar la
          planilla (por ejemplo, la cuenta de Google del negocio). Solo hace
          falta hacer esto una vez.
        </p>
        {status !== "authenticated" ? (
          <button className="btn-primary" onClick={() => signIn("google")}>
            Conectar con Google
          </button>
        ) : (
          <p className="text-sm text-green-700">
            Conectado como {session?.user?.email}. Ahora creá la planilla ⬇️
          </p>
        )}
      </div>

      {status === "authenticated" && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">2. Crear la planilla</h2>
          <p className="text-sm text-madera-600">
            Se va a crear una planilla llamada "Caja Carpintería" en tu
            Google Drive, con las pestañas de Usuarios, Cuentas y
            Movimientos.
          </p>
          <button
            className="btn-primary"
            disabled={cargando || Boolean(resultado)}
            onClick={crearPlanilla}
          >
            {cargando ? "Creando..." : "Crear planilla"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {resultado && (
        <div className="card space-y-4 border-madera-300">
          <h2 className="font-semibold text-lg">
            3. Guardá estas variables de entorno
          </h2>
          <p className="text-sm text-madera-600">
            Copiá estos dos valores en la configuración del servidor (archivo{" "}
            <code>.env</code> local, o las variables de entorno del hosting
            donde despliegues la app) y reiniciá la aplicación. Después de
            eso la app va a leer y escribir directamente en tu planilla, sin
            depender de esta pantalla.
          </p>
          <div className="space-y-2 text-sm font-mono bg-madera-50 rounded-lg p-3 overflow-x-auto">
            <div>GOOGLE_SHEET_ID={resultado.spreadsheetId}</div>
            <div>GOOGLE_REFRESH_TOKEN={resultado.refreshToken}</div>
          </div>
          <a
            href={resultado.url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary inline-block"
          >
            Abrir la planilla en Google Sheets ↗
          </a>
          <p className="text-sm text-madera-600">
            Cuando termines, reiniciá el servidor y entrá de nuevo — la app
            te va a llevar a crear el primer usuario administrador.
          </p>
        </div>
      )}
    </div>
  );
}
