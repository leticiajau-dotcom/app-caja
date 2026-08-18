import { NextResponse } from "next/server";
import { obtenerSesion } from "./internalSession";
import type { SesionInterna } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requerirSesion(): Promise<SesionInterna> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new ApiError("No autenticado. Iniciá sesión.", 401);
  }
  return sesion;
}

export async function requerirAdmin(): Promise<SesionInterna> {
  const sesion = await requerirSesion();
  if (sesion.rol !== "admin") {
    throw new ApiError("Necesitás permisos de administrador.", 403);
  }
  return sesion;
}

export function manejarError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Error inesperado.";
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
