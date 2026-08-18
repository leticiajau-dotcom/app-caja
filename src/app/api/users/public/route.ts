import { NextResponse } from "next/server";
import { listarUsuarios } from "@/lib/repo";
import { manejarError } from "@/lib/guards";

export const dynamic = "force-dynamic";

/** Lista mínima (solo nombres) para el selector de la pantalla de login. */
export async function GET() {
  try {
    const usuarios = await listarUsuarios();
    return NextResponse.json({
      usuarios: usuarios
        .filter((u) => u.activo)
        .map((u) => ({ id: u.id, nombre: u.nombre })),
    });
  } catch (err) {
    return manejarError(err);
  }
}
