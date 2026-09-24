import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { agregarModificacion } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ModificacionSchema = z.object({
  nota: z.string().min(1),
  ajuste: z.number().default(0),
});

// Admin y socio pueden registrar cambios que pidió el cliente sobre un
// proyecto (con o sin ajuste de importe).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerClientes(sesion.rol)) {
      throw new ApiError("No tenés acceso a Clientes.", 403);
    }
    const body = await req.json();
    const datos = ModificacionSchema.parse(body);
    const modificacion = await agregarModificacion(params.id, {
      ...datos,
      usuarioId: sesion.usuarioId,
    });
    return NextResponse.json({ modificacion });
  } catch (err) {
    return manejarError(err);
  }
}
