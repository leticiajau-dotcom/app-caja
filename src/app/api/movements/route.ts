import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirSesion } from "@/lib/guards";
import { crearMovimiento, listarMovimientos } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearMovimientoSchema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(["ingreso", "egreso", "transferencia"]),
  cuentaId: z.string().min(1),
  cuentaDestinoId: z.string().nullable().optional(),
  monto: z.number().positive(),
  categoria: z.string().default(""),
  descripcion: z.string().default(""),
});

export async function GET() {
  try {
    await requerirSesion();
    const movimientos = await listarMovimientos();
    return NextResponse.json({ movimientos });
  } catch (err) {
    return manejarError(err);
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await requerirSesion();
    const body = await req.json();
    const datos = CrearMovimientoSchema.parse(body);
    const movimiento = await crearMovimiento({
      ...datos,
      usuarioId: sesion.usuarioId,
    });
    return NextResponse.json({ movimiento });
  } catch (err) {
    return manejarError(err);
  }
}
