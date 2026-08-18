import { NextResponse } from "next/server";
import { manejarError, requerirSesion } from "@/lib/guards";
import { obtenerResumen } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requerirSesion();
    const resumen = await obtenerResumen();
    return NextResponse.json(resumen);
  } catch (err) {
    return manejarError(err);
  }
}
