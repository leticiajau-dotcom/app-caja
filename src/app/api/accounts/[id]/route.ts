import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirAdmin } from "@/lib/guards";
import { actualizarCuenta } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarCuentaSchema = z.object({
  nombre: z.string().min(1).optional(),
  tipo: z.enum(["efectivo", "banco", "billetera_virtual", "otra"]).optional(),
  tipoPersonalizado: z.string().nullable().optional(),
  moneda: z.string().min(1).optional(),
  usuarioResponsablesIds: z.array(z.string()).optional(),
  activa: z.boolean().optional(),
});

// Solo un admin gestiona la configuración de las cuentas (quién es
// responsable de cada una, activarlas/desactivarlas, etc.).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requerirAdmin();
    const body = await req.json();
    const datos = ActualizarCuentaSchema.parse(body);
    const cuenta = await actualizarCuenta(params.id, datos);
    return NextResponse.json({ cuenta });
  } catch (err) {
    return manejarError(err);
  }
}
