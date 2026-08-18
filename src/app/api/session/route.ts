import { NextResponse } from "next/server";
import { z } from "zod";
import { crearSesion, obtenerSesion } from "@/lib/internalSession";
import { verificarPin } from "@/lib/repo";
import { manejarError } from "@/lib/guards";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  nombre: z.string().min(1),
  pin: z.string().min(4).max(8),
});

export async function GET() {
  const sesion = await obtenerSesion();
  return NextResponse.json({ sesion });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, pin } = LoginSchema.parse(body);
    const usuario = await verificarPin(nombre, pin);
    if (!usuario) {
      return NextResponse.json(
        { error: "Usuario o PIN incorrecto." },
        { status: 401 }
      );
    }
    await crearSesion({
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });
    return NextResponse.json({
      sesion: { usuarioId: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    });
  } catch (err) {
    return manejarError(err);
  }
}
