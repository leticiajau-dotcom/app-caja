import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerEmpleados } from "@/lib/permisos";
import {
  calcularSueldosPorEmpleado,
  crearEmpleado,
  listarCuentas,
  listarEmpleados,
  listarMovimientos,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearEmpleadoSchema = z.object({
  nombre: z.string().min(1),
});

export async function GET() {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerEmpleados(sesion.rol)) {
      throw new ApiError("No tenés acceso a Empleados.", 403);
    }
    const [empleados, movimientos, cuentas] = await Promise.all([
      listarEmpleados(),
      listarMovimientos(),
      listarCuentas(),
    ]);
    const resumenSueldos = calcularSueldosPorEmpleado(empleados, movimientos, cuentas);
    return NextResponse.json({ empleados, resumenSueldos });
  } catch (err) {
    return manejarError(err);
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await requerirSesion();
    if (!puedeVerEmpleados(sesion.rol)) {
      throw new ApiError("No tenés acceso a Empleados.", 403);
    }
    const body = await req.json();
    const datos = CrearEmpleadoSchema.parse(body);
    const empleado = await crearEmpleado(datos.nombre);
    return NextResponse.json({ empleado });
  } catch (err) {
    return manejarError(err);
  }
}
