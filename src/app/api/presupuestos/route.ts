import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, requerirSesion } from "@/lib/guards";
import { puedeVerPresupuestos } from "@/lib/permisos";
import { leerArchivoLebron } from "@/lib/presupuesto";
import { crearPresupuesto, listarClientes, listarPresupuestos } from "@/lib/repo";

export const dynamic = "force-dynamic";

const CrearSchema = z.object({
  clienteId: z.string().optional(),
  clienteNuevo: z.string().optional(),
  nombre: z.string().min(1),
  moneda: z.string().min(1).default("ARS"),
  archivo: z.unknown(),
});

async function sesionConPermiso() {
  const sesion = await requerirSesion();
  if (!puedeVerPresupuestos(sesion.rol)) {
    throw new ApiError("No tenés acceso a Presupuestos.", 403);
  }
  return sesion;
}

// La lista va sin el contenido de cada presupuesto (el archivo de LEBRON,
// los precios): solo lo que se muestra en la tabla.
export async function GET() {
  try {
    await sesionConPermiso();
    const [presupuestos, clientes] = await Promise.all([listarPresupuestos(), listarClientes()]);
    return NextResponse.json({
      clientes,
      presupuestos: presupuestos.map(({ datos, ...resto }) => ({
        ...resto,
        muebles: datos.archivo.items.reduce((a, it) => a + it.cantidad, 0),
      })),
    });
  } catch (err) {
    return manejarError(err);
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await sesionConPermiso();
    const datos = CrearSchema.parse(await req.json());
    if (!datos.clienteId && !datos.clienteNuevo?.trim()) {
      throw new ApiError("Elegí un cliente o escribí el nombre de uno nuevo.");
    }
    const archivo = leerArchivoLebron(JSON.stringify(datos.archivo));
    const presupuesto = await crearPresupuesto({
      clienteId: datos.clienteId || undefined,
      clienteNuevo: datos.clienteNuevo,
      nombre: datos.nombre,
      moneda: datos.moneda,
      archivo,
      usuarioId: sesion.usuarioId,
    });
    return NextResponse.json({ presupuesto });
  } catch (err) {
    return manejarError(err);
  }
}
