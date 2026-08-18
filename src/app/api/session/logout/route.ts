import { NextResponse } from "next/server";
import { cerrarSesion } from "@/lib/internalSession";

export const dynamic = "force-dynamic";

export async function POST() {
  cerrarSesion();
  return NextResponse.json({ ok: true });
}
