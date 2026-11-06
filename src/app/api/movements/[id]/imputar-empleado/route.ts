import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerEmpleados } from "@/lib/permisos";
import { imputarMovimientoEmpleado } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ImputarSchema = z.object({
  // null para quitar la marca.
  empleadoId: z.string().min(1).nullable(),
});

// Marcar un egreso ya cargado como pago de sueldo a un empleado: mismo
// permiso que ver Empleados (admin y socio). Pensado para los pagos
// cargados antes de que existiera la opción "Es un pago de sueldo" en
// Nuevo movimiento.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerEmpleados(sesion.rol)) {
      throw new ApiError("No tenés acceso a esta función.", 403);
    }
    const body = await req.json();
    const datos = ImputarSchema.parse(body);
    const movimiento = await imputarMovimientoEmpleado(params.id, datos.empleadoId);
    return NextResponse.json({ movimiento });
  } catch (err) {
    return manejarError(err);
  }
}
