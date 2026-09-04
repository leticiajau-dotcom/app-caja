import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerClientes } from "@/lib/permisos";
import { crearCliente, listarClientes, listarProyectos } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearClienteSchema = z.object({
  nombre: z.string().min(1),
  proyecto: z.string().min(1),
  moneda: z.string().min(1).default("ARS"),
  precio: z.number().gt(0, "El precio tiene que ser mayor a 0."),
});

export async function GET() {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerClientes(sesion.rol)) {
      throw new ApiError("No tenés acceso a Clientes.", 403);
    }
    const [clientes, proyectos] = await Promise.all([
      listarClientes(),
      listarProyectos(),
    ]);
    return NextResponse.json({ clientes, proyectos });
  } catch (err) {
    return manejarError(err);
  }
}

// Admin y socio pueden dar de alta clientes (con su primer proyecto).
export async function POST(req: Request) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerClientes(sesion.rol)) {
      throw new ApiError("No tenés acceso a Clientes.", 403);
    }
    const body = await req.json();
    const datos = CrearClienteSchema.parse(body);
    const { cliente, proyecto } = await crearCliente(datos);
    return NextResponse.json({ cliente, proyecto });
  } catch (err) {
    return manejarError(err);
  }
}
