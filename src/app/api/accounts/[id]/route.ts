import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirSesion } from "@/lib/guards";
import { actualizarCuenta } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarCuentaSchema = z.object({
  nombre: z.string().min(1).optional(),
  tipo: z
    .enum(["efectivo", "banco", "billetera_virtual", "dolares", "otra"])
    .optional(),
  moneda: z.string().min(1).optional(),
  usuarioResponsableId: z.string().nullable().optional(),
  activa: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requerirSesion();
    const body = await req.json();
    const datos = ActualizarCuentaSchema.parse(body);
    const cuenta = await actualizarCuenta(params.id, datos);
    return NextResponse.json({ cuenta });
  } catch (err) {
    return manejarError(err);
  }
}
