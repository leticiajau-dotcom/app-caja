import { NextResponse } from "next/server";
import { z } from "zod";
import { requerirAdmin } from "@/lib/guards";
import { manejarError } from "@/lib/guards";
import { crearUsuario, listarUsuarios } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  pin: z.string().min(4, "El PIN debe tener al menos 4 dígitos").max(8),
  rol: z.enum(["admin", "socio", "empleado"]).default("socio"),
});

export async function GET() {
  try {
    await requerirAdmin();
    const usuarios = await listarUsuarios();
    return NextResponse.json({
      usuarios: usuarios.map(({ pinHash, ...resto }) => resto),
    });
  } catch (err) {
    return manejarError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const datos = CrearUsuarioSchema.parse(body);

    const usuariosExistentes = await listarUsuarios();
    const esPrimerUsuario = usuariosExistentes.length === 0;

    if (esPrimerUsuario) {
      // Bootstrap: el primer usuario de una planilla nueva se crea sin
      // necesidad de estar logueado, y siempre queda como admin.
      const usuario = await crearUsuario({ ...datos, rol: "admin" });
      const { pinHash, ...resto } = usuario;
      return NextResponse.json({ usuario: resto });
    }

    await requerirAdmin();
    const usuario = await crearUsuario(datos);
    const { pinHash, ...resto } = usuario;
    return NextResponse.json({ usuario: resto });
  } catch (err) {
    return manejarError(err);
  }
}
