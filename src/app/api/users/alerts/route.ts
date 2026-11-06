import { NextResponse } from "next/server";
import { manejarError, requerirAdmin } from "@/lib/guards";
import { listarAlertasIntentosFallidos } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Usuarios con 10 (o más, de a 10) intentos de PIN fallidos seguidos: para
// mostrarle un aviso de seguridad al admin en cualquier pantalla.
export async function GET() {
  try {
    await requerirAdmin();
    const alertas = await listarAlertasIntentosFallidos();
    return NextResponse.json({ alertas });
  } catch (err) {
    return manejarError(err);
  }
}
