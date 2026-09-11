"use client";

import { signIn, signOut, useSession } from "next-auth/react";
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
  const [desconectando, setDesconectando] = useState(false);
  const [mostrarToken, setMostrarToken] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function desconectar() {
    setDesconectando(true);
    setResultado(null);
    setError("");
    await signOut({ redirect: false });
    setDesconectando(false);
  }

  async function copiarToken() {
    try {
      await navigator.clipboard.writeText(resultado!.refreshToken);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Si el navegador no permite copiar solo, no pasa nada: el valor
      // sigue disponible para copiar a mano.
    }
  }

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
          🪵 Caja Negocio
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
          <div className="space-y-2">
            <p className="text-sm text-green-700">
              Conectado como {session?.user?.email}. Ahora creá la planilla ⬇️
            </p>
            <p className="text-xs text-madera-500">
              ¿No es la cuenta correcta, o necesitás generar una conexión
              nueva (por ejemplo, porque la anterior dejó de funcionar)?{" "}
              <button
                type="button"
                className="underline hover:text-madera-700 disabled:opacity-50"
                onClick={desconectar}
                disabled={desconectando}
              >
                {desconectando ? "Desconectando..." : "Desconectate acá"}
              </button>{" "}
              y volvé a conectar — así Google te va a pedir el permiso de
              nuevo y se genera una conexión realmente nueva.
            </p>
          </div>
        )}
      </div>

      {status === "authenticated" && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">2. Crear la planilla</h2>
          <p className="text-sm text-madera-600">
            Se va a crear una planilla llamada "Caja Negocio" en tu
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
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
            ⚠️ Son datos sensibles: pegalos solo en la configuración de tu
            hosting (ej. Vercel). Nunca los compartas por chat, email ni con
            nadie que no necesite administrar la app.
          </p>
          <div className="space-y-2 text-sm font-mono bg-madera-50 rounded-lg p-3 overflow-x-auto">
            <div>GOOGLE_SHEET_ID={resultado.spreadsheetId}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                GOOGLE_REFRESH_TOKEN=
                {mostrarToken
                  ? resultado.refreshToken
                  : "•".repeat(24)}
              </span>
              <button
                type="button"
                className="btn-secondary py-0.5 px-2 text-xs font-sans shrink-0"
                onClick={() => setMostrarToken((v) => !v)}
              >
                {mostrarToken ? "Ocultar" : "Mostrar"}
              </button>
              <button
                type="button"
                className="btn-secondary py-0.5 px-2 text-xs font-sans shrink-0"
                onClick={copiarToken}
              >
                {copiado ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
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
