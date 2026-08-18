import { NextResponse } from "next/server";
import { z } from "zod";
import { manejarError, requerirSesion } from "@/lib/guards";
import { crearCuenta, listarCuentas } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearCuentaSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(["efectivo", "banco", "billetera_virtual", "otra"]),
  tipoPersonalizado: z.string().nullable().optional(),
  moneda: z.string().min(1).default("ARS"),
  usuarioResponsableId: z.string().nullable().optional(),
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

export async function POST(req: Request) {
  try {
    await requerirSesion();
    const body = await req.json();
    const datos = CrearCuentaSchema.parse(body);
    const cuenta = await crearCuenta({
      ...datos,
      usuarioResponsableId: datos.usuarioResponsableId ?? null,
    });
    return NextResponse.json({ cuenta });
  } catch (err) {
    return manejarError(err);
  }
}
