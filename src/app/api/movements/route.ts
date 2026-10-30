import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import {
  calcularSaldoCuentaPorMovimiento,
  crearMovimiento,
  listarCuentas,
  listarMovimientos,
  listarUsuarios,
  usuarioPuedeOperarCuenta,
} from "@/lib/repo";
import {
  puedeRegistrarRetiros,
  soloPuedeRegistrarEgresos,
  soloVeSusPropiosMovimientos,
} from "@/lib/permisos";

export const dynamic = "force-dynamic";

const CrearMovimientoSchema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(["ingreso", "egreso", "transferencia", "retiro"]),
  cuentaId: z.string().min(1),
  cuentaDestinoId: z.string().nullable().optional(),
  monto: z.number().positive(),
  categoria: z.string().default(""),
  descripcion: z.string().default(""),
  // Solo para tipo "retiro": a quién(es) se les registra el retiro. Cada
  // usuario seleccionado retira el monto completo (no se reparte entre
  // todos) — se carga un movimiento por cada uno.
  usuarioRetiroIds: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const sesion = await requerirSesion();
    const [movimientos, cuentas] = await Promise.all([
      listarMovimientos(),
      listarCuentas(),
    ]);
    // El rol "empleado" (acotado) solo ve los movimientos que él mismo
    // cargó, nunca los de otros usuarios.
    const visibles = soloVeSusPropiosMovimientos(sesion.rol)
      ? movimientos.filter((m) => m.usuarioId === sesion.usuarioId)
      : movimientos;
    // El saldo de cada movimiento se calcula sobre el historial COMPLETO
    // (no solo lo "visible"), para que un empleado pueda controlar el
    // saldo real de su cuenta aunque no vea los movimientos ajenos que
    // también la afectan.
    const saldoPorMovimiento = calcularSaldoCuentaPorMovimiento(cuentas, movimientos);
    const conSaldo = visibles.map((m) => ({
      ...m,
      saldoCuentaTrasMovimiento: saldoPorMovimiento.get(m.id) ?? 0,
    }));
    return NextResponse.json({ movimientos: conSaldo });
  } catch (err) {
    return manejarError(err);
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await requerirSesion();
    const body = await req.json();
    const datos = CrearMovimientoSchema.parse(body);

    if (soloPuedeRegistrarEgresos(sesion.rol) && datos.tipo !== "egreso") {
      throw new ApiError("Como empleado solo podés registrar egresos.", 403);
    }

    if (!(await usuarioPuedeOperarCuenta(sesion, datos.cuentaId))) {
      throw new ApiError(
        "No podés cargar movimientos en una cuenta de la que no sos responsable.",
        403
      );
    }

    if (datos.tipo === "retiro") {
      if (!puedeRegistrarRetiros(sesion.rol)) {
        throw new ApiError(
          "Los retiros solo los pueden registrar administradores y socios.",
          403
        );
      }
      const usuarioRetiroIds = datos.usuarioRetiroIds ?? [];
      if (usuarioRetiroIds.length === 0) {
        throw new ApiError("Seleccioná al menos un usuario para el retiro.", 400);
      }
      const usuarios = await listarUsuarios();
      const idsValidos = new Set(
        usuarios.filter((u) => puedeRegistrarRetiros(u.rol)).map((u) => u.id)
      );
      if (!usuarioRetiroIds.every((id) => idsValidos.has(id))) {
        throw new ApiError(
          "Los retiros solo se pueden registrar a nombre de administradores o socios.",
          400
        );
      }

      const movimientos = [];
      for (const usuarioRetiroId of usuarioRetiroIds) {
        movimientos.push(
          await crearMovimiento({
            fecha: datos.fecha,
            tipo: "retiro",
            cuentaId: datos.cuentaId,
            monto: datos.monto,
            categoria: "Retiro",
            descripcion: datos.descripcion,
            usuarioId: sesion.usuarioId,
            usuarioRetiroId,
          })
        );
      }
      return NextResponse.json({ movimientos });
    }

    const movimiento = await crearMovimiento({
      ...datos,
      usuarioId: sesion.usuarioId,
    });
    return NextResponse.json({ movimiento });
  } catch (err) {
    return manejarError(err);
  }
}
