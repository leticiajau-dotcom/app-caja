import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerEmpleados } from "@/lib/permisos";
import { actualizarEmpleado } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarEmpleadoSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerEmpleados(sesion.rol)) {
      throw new ApiError("No tenés acceso a Empleados.", 403);
    }
    const body = await req.json();
    const datos = ActualizarEmpleadoSchema.parse(body);
    const empleado = await actualizarEmpleado(params.id, datos);
    return NextResponse.json({ empleado });
  } catch (err) {
    return manejarError(err);
  }
}
