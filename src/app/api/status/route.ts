import { NextResponse } from "next/server";
import { isGoogleConnected } from "@/lib/googleSheets";
import { listarUsuarios } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleConectado = isGoogleConnected();
  let hayUsuarios = false;
  let error: string | null = null;
  if (googleConectado) {
    try {
      const usuarios = await listarUsuarios();
      hayUsuarios = usuarios.length > 0;
    } catch (err) {
      hayUsuarios = false;
      // Mensaje de Google (ej. "invalid_grant: Token has been expired or
      // revoked.") para poder diagnosticar sin tener que ir a buscar los
      // logs del servidor. No incluye ningún dato sensible (ni tokens ni
      // claves), solo el motivo del error que devuelve Google.
      const data = (err as any)?.response?.data;
      error =
        (data?.error_description as string | undefined) ??
        (data?.error as string | undefined) ??
        (err instanceof Error ? err.message : "Error desconocido.");
    }
  }
  return NextResponse.json({ googleConectado, hayUsuarios, error });
}
