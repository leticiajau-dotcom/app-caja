import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { agregarProyecto } from "@/lib/repo";

export const dynamic = "force-dynamic";

const AgregarProyectoSchema = z.object({
  nombre: z.string().min(1),
  moneda: z.string().min(1).default("ARS"),
  precio: z.number().gt(0, "El precio tiene que ser mayor a 0."),
});

// Admin y socio pueden agregarle un proyecto nuevo a un cliente existente.
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
    const datos = AgregarProyectoSchema.parse(body);
    const proyecto = await agregarProyecto(params.id, datos);
    return NextResponse.json({ proyecto });
  } catch (err) {
    return manejarError(err);
  }
}
