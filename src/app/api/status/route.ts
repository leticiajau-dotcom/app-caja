import { NextResponse } from "next/server";
import { isGoogleConnected } from "@/lib/googleSheets";
import { listarUsuarios } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleConectado = isGoogleConnected();
  let hayUsuarios = false;
  if (googleConectado) {
    try {
      const usuarios = await listarUsuarios();
      hayUsuarios = usuarios.length > 0;
    } catch {
      hayUsuarios = false;
    }
  }
  return NextResponse.json({ googleConectado, hayUsuarios });
}
