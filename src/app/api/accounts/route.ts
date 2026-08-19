import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirAdmin, requerirSesion } from "@/lib/guards";
import { crearCuenta, listarCuentas } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearCuentaSchema = z.object({
  nombre: z.string().min(1),
  moneda: z.string().min(1).default("ARS"),
  usuarioResponsablesIds: z.array(z.string()).default([]),
  saldoInicial: z.number().default(0),
});

export async function GET() {
  try {
    await requerirSesion();
    const cuentas = await listarCuentas();
    return NextResponse.json({ cuentas });
  } catch (err) {
    return manejarError(err);
  }
}

// Solo un admin crea cuentas nuevas.
export async function POST(req: Request) {
  try {
    const sesion = await requerirAdmin();
    const body = await req.json();
    const datos = CrearCuentaSchema.parse(body);
    const cuenta = await crearCuenta({ ...datos, usuarioId: sesion.usuarioId });
    return NextResponse.json({ cuenta });
  } catch (err) {
    return manejarError(err);
  }
}
