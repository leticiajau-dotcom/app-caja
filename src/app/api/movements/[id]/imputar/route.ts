import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { imputarMovimiento } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ImputarSchema = z.object({
  // null para quitar la imputación.
  proyectoId: z.string().min(1).nullable(),
});

// Imputar un egreso a un proyecto de Clientes: mismo permiso que ver
// Clientes (admin y socio), ya que hay que poder elegir uno de esos
// proyectos.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerClientes(sesion.rol)) {
      throw new ApiError("No tenés acceso a esta función.", 403);
    }
    const body = await req.json();
    const datos = ImputarSchema.parse(body);
    const movimiento = await imputarMovimiento(params.id, datos.proyectoId);
    return NextResponse.json({ movimiento });
  } catch (err) {
    return manejarError(err);
  }
}
