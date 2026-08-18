import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { crearPlanillaSiNoExiste, planillaUrl } from "@/lib/googleSheets";
import { manejarError } from "@/lib/guards";

export const dynamic = "force-dynamic";

/**
 * Paso único de configuración: usa la sesión de Google (NextAuth) recién
 * autorizada por el dueño del negocio para crear la planilla en su Drive.
 * Devuelve el spreadsheetId y el refresh token para que los guarde como
 * variables de entorno (GOOGLE_SHEET_ID y GOOGLE_REFRESH_TOKEN). A partir de
 * ahí, la app ya no depende de esta sesión de Google: usa esas variables.
 */
export async function POST() {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session) {
      return NextResponse.json(
        { error: "Iniciá sesión con Google primero desde /conectar." },
        { status: 401 }
      );
    }

    const refreshToken: string | undefined =
      session.refreshToken ?? process.env.GOOGLE_REFRESH_TOKEN;

    if (!refreshToken) {
      return NextResponse.json(
        {
          error:
            "Google no devolvió un refresh token (esto pasa si ya habías autorizado antes). " +
            "Volvé a intentar: cerrá sesión de Google para esta app en https://myaccount.google.com/permissions y conectá de nuevo.",
        },
        { status: 400 }
      );
    }

    const spreadsheetId = await crearPlanillaSiNoExiste(
      "Caja Carpintería",
      refreshToken
    );

    return NextResponse.json({
      spreadsheetId,
      refreshToken,
      url:
        planillaUrl() ??
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (err) {
    return manejarError(err);
  }
}
