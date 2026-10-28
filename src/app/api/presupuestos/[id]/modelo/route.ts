import { NextResponse } from "next/server";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerPresupuestos } from "@/lib/permisos";
import { guardarModeloPresupuesto } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel acepta hasta 4,5 MB por pedido; LEBRON achica las texturas para
// mandar menos de 4 MB.
const LIMITE_BYTES = 4_400_000;

// El diseño en 3D (.glb) que manda LEBRON después de crear el presupuesto.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerPresupuestos(sesion.rol)) {
      throw new ApiError("No tenés acceso a Presupuestos.", 403);
    }
    const datos = Buffer.from(await req.arrayBuffer());
    if (datos.length < 20 || datos.toString("ascii", 0, 4) !== "glTF") {
      throw new ApiError("Eso no es un diseño en 3D de LEBRON (.glb).");
    }
    if (datos.length > LIMITE_BYTES) {
      throw new ApiError("El diseño en 3D pesa demasiado.");
    }
    const presupuesto = await guardarModeloPresupuesto(params.id, datos);
    return NextResponse.json({ presupuesto, link: `/ver/${presupuesto.tokenPublico}` });
  } catch (err) {
    return manejarError(err);
  }
}
