import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirAdmin } from "@/lib/guards";
import { actualizarUsuario } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["admin", "socio", "empleado"]).optional(),
  activo: z.boolean().optional(),
  pin: z.string().min(4).max(8).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requerirAdmin();
    const body = await req.json();
    const datos = ActualizarUsuarioSchema.parse(body);
    const usuario = await actualizarUsuario(params.id, datos);
    const { pinHash, ...resto } = usuario;
    return NextResponse.json({ usuario: resto });
  } catch (err) {
    return manejarError(err);
  }
}
