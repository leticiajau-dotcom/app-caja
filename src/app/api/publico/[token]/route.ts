import { NextResponse } from "next/server";
import { manejarError } from "@/lib/guards";
import { armarHojaCliente } from "@/lib/hojaCliente";
import { obtenerSesion } from "@/lib/internalSession";
import {
  listarClientes,
  obtenerConfiguracion,
  obtenerDefaultsPresupuesto,
  obtenerPresupuestoPorToken,
  registrarVistaPresupuesto,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

// SIN sesión a propósito: es el link que se le manda al cliente (/ver/<token>).
// El token es largo y al azar, y solo devuelve lo de la hoja del cliente: nada
// de costos, coeficientes ni precios de materiales (ver armarHojaCliente).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const p = await obtenerPresupuestoPorToken(params.token);
    const [clientes, defaults, config] = await Promise.all([
      listarClientes(),
      obtenerDefaultsPresupuesto(),
      obtenerConfiguracion(),
    ]);
    const cliente = clientes.find((c) => c.id === p.clienteId) ?? null;
    // Se anota que el cliente lo abrió. Si lo abre alguien con sesión en la app
    // ("Verlo como el cliente"), no cuenta. Si no se puede anotar, igual se muestra.
    if (!(await obtenerSesion())) {
      await registrarVistaPresupuesto(p).catch((e) => console.error("No se pudo anotar la vista:", e));
    }
    return NextResponse.json({
      hoja: armarHojaCliente(p, cliente, defaults, config),
      modeloUrl: p.modeloId ? `/api/publico/${params.token}/modelo?v=${p.modeloId}` : null,
    });
  } catch (err) {
    return manejarError(err);
  }
}
