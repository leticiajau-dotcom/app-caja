import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerPresupuestos } from "@/lib/permisos";
import {
  actualizarPresupuesto,
  listarClientes,
  obtenerDefaultsPresupuesto,
  obtenerPresupuesto,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

const ActualizarSchema = z.object({
  nombre: z.string().optional(),
  coefPlacas: z.number().gt(0).optional(),
  coefHerrajes: z.number().gt(0).optional(),
  porModulo: z.boolean().optional(),
  precios: z
    .array(
      z.object({
        tipo: z.enum(["placa", "canto", "herraje"]),
        nombre: z.string().min(1),
        precio: z.number().min(0),
      })
    )
    .optional(),
  tomarPreciosDeLaLista: z.boolean().optional(),
  extras: z
    .array(z.object({ concepto: z.string(), monto: z.number().min(0), separado: z.boolean() }))
    .optional(),
  descuento: z.number().min(0).lt(100).optional(),
  estado: z.enum(["borrador", "descartado"]).optional(),
});

async function sesionConPermiso() {
  const sesion = await requerirSesion();
  if (!puedeVerPresupuestos(sesion.rol)) {
    throw new ApiError("No tenés acceso a Presupuestos.", 403);
  }
  return sesion;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await sesionConPermiso();
    const [presupuesto, clientes, defaults] = await Promise.all([
      obtenerPresupuesto(params.id),
      listarClientes(),
      obtenerDefaultsPresupuesto(),
    ]);
    const cliente = clientes.find((c) => c.id === presupuesto.clienteId) ?? null;
    return NextResponse.json({ presupuesto, cliente, defaults });
  } catch (err) {
    return manejarError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await sesionConPermiso();
    const cambios = ActualizarSchema.parse(await req.json());
    const presupuesto = await actualizarPresupuesto(params.id, cambios, sesion.usuarioId);
    return NextResponse.json({ presupuesto });
  } catch (err) {
    return manejarError(err);
  }
}
