import { NextResponse } from "next/server";
import { listarUsuarios } from "@/lib/repo";
import { manejarError } from "@/lib/guards";

export const dynamic = "force-dynamic";

/** Lista mínima (nombre y rol) para el selector de la pantalla de login y
 *  para elegir responsables/usuarios de retiro en otras pantallas. */
export async function GET() {
  try {
    const usuarios = await listarUsuarios();
    return NextResponse.json({
      usuarios: usuarios
        .filter((u) => u.activo)
        .map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol })),
    });
  } catch (err) {
    return manejarError(err);
  }
}
