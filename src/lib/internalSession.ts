import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SesionInterna } from "./types";

/**
 * Sesión "interna" de usuario + PIN. Es independiente del login con Google:
 * Google solo se usa una vez para autorizar el acceso a la planilla (ver
 * /conectar y lib/googleSheets.ts). El día a día de la carpintería usa esta
 * sesión liviana para saber "quién está usando la app ahora".
 */

const COOKIE_NAME = "caja_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Falta la variable de entorno SESSION_SECRET (ver README.md)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function crearSesion(datos: SesionInterna) {
  const token = await new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function obtenerSesion(): Promise<SesionInterna | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      usuarioId: payload.usuarioId as string,
      nombre: payload.nombre as string,
      rol: payload.rol as SesionInterna["rol"],
    };
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  cookies().delete(COOKIE_NAME);
}
