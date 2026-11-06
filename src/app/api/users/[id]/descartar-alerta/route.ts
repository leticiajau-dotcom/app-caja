import { NextResponse } from "next/server";
import { manejarError, requerirAdmin } from "@/lib/guards";
import { descartarAlertaIntentosFallidos } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requerirAdmin();
    const usuario = await descartarAlertaIntentosFallidos(params.id);
    const { pinHash, ...resto } = usuario;
    return NextResponse.json({ usuario: resto });
  } catch (err) {
    return manejarError(err);
  }
}
