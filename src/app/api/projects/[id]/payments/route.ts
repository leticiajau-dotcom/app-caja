import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { agregarPago } from "@/lib/repo";

export const dynamic = "force-dynamic";

const PagoSchema = z.object({
  monto: z.number().gt(0, "El monto tiene que ser mayor a 0."),
  cuentaId: z.string().min(1),
  nota: z.string().optional(),
});

// Admin y socio pueden registrar un pago del cliente contra un proyecto:
// esto crea además un ingreso real en la cuenta elegida (ver agregarPago).
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
    const datos = PagoSchema.parse(body);
    const { pago, movimiento } = await agregarPago(params.id, {
      ...datos,
      usuarioId: sesion.usuarioId,
    });
    return NextResponse.json({ pago, movimiento });
  } catch (err) {
    return manejarError(err);
  }
}
