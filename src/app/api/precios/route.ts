import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerPresupuestos } from "@/lib/permisos";
import {
  guardarDefaultsPresupuesto,
  guardarPrecios,
  listarPrecios,
  obtenerDefaultsPresupuesto,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

const PreciosSchema = z.object({
  precios: z
    .array(
      z.object({
        tipo: z.enum(["placa", "canto", "herraje"]),
        nombre: z.string().min(1),
        precio: z.number().min(0),
      })
    )
    .optional(),
  defaults: z
    .object({
      coefPlacas: z.number().gt(0),
      coefHerrajes: z.number().gt(0),
      validezDias: z.number().gt(0),
      nombreComercial: z.string().max(80).default(""),
      notaPie: z.string().max(1000).default(""),
    })
    .optional(),
});

async function sesionConPermiso() {
  const sesion = await requerirSesion();
  if (!puedeVerPresupuestos(sesion.rol)) {
    throw new ApiError("No tenés acceso a Presupuestos.", 403);
  }
  return sesion;
}

export async function GET() {
  try {
    await sesionConPermiso();
    const [precios, defaults] = await Promise.all([listarPrecios(), obtenerDefaultsPresupuesto()]);
    return NextResponse.json({ precios, defaults });
  } catch (err) {
    return manejarError(err);
  }
}

// Admin y socio cargan y cambian precios, y los valores de entrada de un
// presupuesto nuevo (coeficientes y validez).
export async function POST(req: Request) {
  try {
    const sesion = await sesionConPermiso();
    const datos = PreciosSchema.parse(await req.json());
    let precios = undefined;
    if (datos.precios) precios = await guardarPrecios(datos.precios, sesion.usuarioId);
    let defaults = undefined;
    if (datos.defaults) defaults = await guardarDefaultsPresupuesto(datos.defaults);
    return NextResponse.json({
      precios: precios ?? (await listarPrecios()),
      defaults: defaults ?? (await obtenerDefaultsPresupuesto()),
    });
  } catch (err) {
    return manejarError(err);
  }
}
