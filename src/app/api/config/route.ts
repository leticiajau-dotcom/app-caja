import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirAdmin } from "@/lib/guards";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarConfigSchema = z.object({
  nombreApp: z.string().min(1).max(60).optional(),
  // Data URI de imagen; limitamos el tamaño para no inflar la planilla.
  logoDataUri: z
    .string()
    .max(300_000, "El logo es demasiado pesado, usá una imagen más chica.")
    .optional(),
});

// Sin requerir sesión a propósito: el nombre/logo de la app se muestran
// también en la pantalla de login, antes de que haya una sesión activa. No
// es información sensible.
export async function GET() {
  try {
    const config = await obtenerConfiguracion();
    return NextResponse.json({ config });
  } catch (err) {
    return manejarError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requerirAdmin();
    const body = await req.json();
    const datos = ActualizarConfigSchema.parse(body);
    const config = await actualizarConfiguracion(datos);
    return NextResponse.json({ config });
  } catch (err) {
    return manejarError(err);
  }
}
