import { ApiError, manejarError } from "@/lib/guards";
import { leerArchivoDrive } from "@/lib/googleSheets";
import { obtenerPresupuestoPorToken } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// El archivo del diseño en 3D, para el visor del link del cliente (sin sesión,
// como /api/publico/[token]). La dirección lleva ?v=<id del archivo>: si el 3D se
// vuelve a mandar cambia, así que el navegador y Vercel lo pueden guardar.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const p = await obtenerPresupuestoPorToken(params.token);
    if (!p.modeloId) throw new ApiError("Este presupuesto no tiene diseño en 3D.", 404);
    const datos = await leerArchivoDrive(p.modeloId);
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(datos.length),
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (err) {
    return manejarError(err);
  }
}
