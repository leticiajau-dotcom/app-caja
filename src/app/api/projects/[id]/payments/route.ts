import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { agregarPago, agregarPagoHistorico, vincularPago } from "@/lib/repo";

export const dynamic = "force-dynamic";

const PagoSchema = z.union([
  z.object({
    modo: z.literal("nuevo"),
    monto: z.number().gt(0, "El monto tiene que ser mayor a 0."),
    cuentaId: z.string().min(1),
    nota: z.string().optional(),
  }),
  z.object({
    modo: z.literal("vincular"),
    movimientoId: z.string().min(1),
    nota: z.string().optional(),
  }),
  z.object({
    modo: z.literal("historico"),
    monto: z.number().gt(0, "El monto tiene que ser mayor a 0."),
    nota: z.string().optional(),
  }),
]);

// Admin y socio pueden registrar un pago del cliente contra un proyecto:
// "nuevo" crea además un ingreso real en la cuenta elegida (ver
// agregarPago); "vincular" asocia un ingreso que ya existía en
// Movimientos, sin crear uno nuevo (para no duplicar pagos cargados antes
// de tener esta pantalla).
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
    const resultado =
      datos.modo === "nuevo"
        ? await agregarPago(params.id, { ...datos, usuarioId: sesion.usuarioId })
        : datos.modo === "vincular"
        ? await vincularPago(params.id, { ...datos, usuarioId: sesion.usuarioId })
        : {
            pago: await agregarPagoHistorico(params.id, {
              ...datos,
              usuarioId: sesion.usuarioId,
            }),
          };
    return NextResponse.json(resultado);
  } catch (err) {
    return manejarError(err);
  }
}
