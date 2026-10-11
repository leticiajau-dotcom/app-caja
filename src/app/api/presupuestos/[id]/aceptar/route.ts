import { NextResponse } from "next/server";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerPresupuestos } from "@/lib/permisos";
import { aceptarPresupuesto } from "@/lib/repo";

export const dynamic = "force-dynamic";

// El cliente aceptó: pasa a ser un Proyecto con el total como precio.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerPresupuestos(sesion.rol)) {
      throw new ApiError("No tenés acceso a Presupuestos.", 403);
    }
    const resultado = await aceptarPresupuesto(params.id);
    return NextResponse.json(resultado);
  } catch (err) {
    return manejarError(err);
  }
}
