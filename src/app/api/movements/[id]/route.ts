import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import {
  anularMovimiento,
  buscarMovimientoPorId,
  crearMovimiento,
  usuarioPuedeOperarCuenta,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

const RectificarSchema = z.object({
  nota: z.string().min(1, "Contá brevemente por qué se corrige."),
  reemplazo: z
    .object({
      fecha: z.string().min(1),
      tipo: z.enum(["ingreso", "egreso", "transferencia"]),
      cuentaId: z.string().min(1),
      cuentaDestinoId: z.string().nullable().optional(),
      monto: z.number().positive(),
      categoria: z.string().default(""),
      descripcion: z.string().default(""),
    })
    .nullable()
    .optional(),
});

/**
 * Rectificación de un movimiento: nunca se edita ni se borra la fila
 * original (queda como registro auditable), se la marca "anulada" y,
 * opcionalmente, se carga un movimiento nuevo con los datos correctos,
 * enlazado al original.
 *
 * Permisos: un admin puede rectificar cualquier movimiento. Un empleado
 * solo puede rectificar movimientos que él mismo cargó, y solo si todavía
 * no fueron anulados.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sesion = await requerirSesion();
    const encontrado = await buscarMovimientoPorId(params.id);
    if (!encontrado) {
      throw new ApiError("Movimiento no encontrado.", 404);
    }
    if (
      sesion.rol !== "admin" &&
      encontrado.movimiento.usuarioId !== sesion.usuarioId
    ) {
      throw new ApiError(
        "Solo podés rectificar movimientos que vos mismo cargaste.",
        403
      );
    }

    const body = await req.json();
    const datos = RectificarSchema.parse(body);

    if (
      datos.reemplazo &&
      !(await usuarioPuedeOperarCuenta(sesion, datos.reemplazo.cuentaId))
    ) {
      throw new ApiError(
        "No podés cargar el movimiento corregido en una cuenta de la que no sos responsable.",
        403
      );
    }

    const anulado = await anularMovimiento(params.id, {
      anuladoPorId: sesion.usuarioId,
      nota: datos.nota,
    });

    let correccion = null;
    if (datos.reemplazo) {
      correccion = await crearMovimiento({
        ...datos.reemplazo,
        usuarioId: sesion.usuarioId,
        movimientoOrigenId: params.id,
      });
    }

    return NextResponse.json({ movimiento: anulado, correccion });
  } catch (err) {
    return manejarError(err);
  }
}
