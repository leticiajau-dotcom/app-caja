import { google } from "googleapis";

/**
 * Cliente de Google Sheets/Drive.
 *
 * La app NO usa una base de datos propia: toda la información se guarda en
 * una planilla de Google Sheets que vive en el Google Drive del dueño del
 * negocio. El acceso se hace con un OAuth2 client de "aplicación" que usa
 * un refresh token de larga duración (obtenido una única vez desde
 * /conectar) en vez de depender de que cada usuario esté logueado con
 * Google: los empleados usan usuario + PIN (ver internalSession.ts) y el
 * servidor es quien habla con Google en nombre del negocio.
 */

const REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

function assertEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      throw new Error(
        `Falta la variable de entorno ${key}. Revisá el archivo .env (ver README.md).`
      );
    }
  }
}

export function getOAuth2Client(refreshTokenOverride?: string) {
  assertEnv();
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      : undefined
  );

  const refreshToken = refreshTokenOverride ?? process.env.GOOGLE_REFRESH_TOKEN;
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }
  return client;
}

export function isGoogleConnected() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_SHEET_ID
  );
}

export function getSheetsClient(refreshTokenOverride?: string) {
  const auth = getOAuth2Client(refreshTokenOverride);
  return google.sheets({ version: "v4", auth });
}

export function getDriveClient(refreshTokenOverride?: string) {
  const auth = getOAuth2Client(refreshTokenOverride);
  return google.drive({ version: "v3", auth });
}

export const TABS = {
  USUARIOS: "Usuarios",
  CUENTAS: "Cuentas",
  MOVIMIENTOS: "Movimientos",
} as const;

export const HEADERS = {
  [TABS.USUARIOS]: ["id", "nombre", "pinHash", "rol", "activo", "creadoEn"],
  [TABS.CUENTAS]: [
    "id",
    "nombre",
    "tipo",
    "moneda",
    "usuarioResponsableId",
    "saldoInicial",
    "activa",
    "creadoEn",
  ],
  [TABS.MOVIMIENTOS]: [
    "id",
    "fecha",
    "tipo",
    "cuentaId",
    "cuentaDestinoId",
    "monto",
    "categoria",
    "descripcion",
    "usuarioId",
    "creadoEn",
  ],
} as const;

/** Crea (si no existe) la planilla con las pestañas y encabezados necesarios.
 *  Devuelve el spreadsheetId. Este id hay que guardarlo en la variable de
 *  entorno GOOGLE_SHEET_ID. */
export async function crearPlanillaSiNoExiste(
  nombre = "Caja Carpintería",
  refreshTokenOverride?: string
) {
  const sheets = getSheetsClient(refreshTokenOverride);
  const drive = getDriveClient(refreshTokenOverride);

  const existingId = process.env.GOOGLE_SHEET_ID;
  if (existingId) {
    return existingId;
  }

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: nombre },
      sheets: Object.values(TABS).map((title) => ({
        properties: { title },
      })),
    },
  });

  const spreadsheetId = created.data.spreadsheetId!;

  // Encabezados de cada pestaña.
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: Object.entries(HEADERS).map(([tab, headers]) => ({
        range: `${tab}!A1`,
        values: [headers as unknown as string[]],
      })),
    },
  });

  // La planilla queda en el Drive de la cuenta conectada; nos aseguramos de
  // que quede accesible como "cualquiera con el link puede ver" es
  // intencionalmente NO configurado (queda privada, solo la cuenta dueña y
  // quien invite manualmente desde Drive).
  await drive.files.update({
    fileId: spreadsheetId,
    requestBody: { name: nombre },
  });

  return spreadsheetId;
}

export function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error(
      "Falta GOOGLE_SHEET_ID. Conectá la cuenta de Google desde /conectar primero."
    );
  }
  return id;
}

export function planillaUrl() {
  const id = process.env.GOOGLE_SHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/** Lee todas las filas de una pestaña como objetos, usando la fila 1 como encabezado. */
export async function leerFilas<T extends Record<string, string>>(
  tab: string
): Promise<T[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A2:Z`,
  });
  const rows = res.data.values ?? [];
  const headers = HEADERS[tab as keyof typeof HEADERS] as unknown as string[];
  return rows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      return obj as T;
    });
}

/** Agrega una fila nueva al final de la pestaña. */
export async function agregarFila(tab: string, valores: (string | number)[]) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [valores] },
  });
}

/** Sobrescribe una fila existente (por id, en la primera columna) con nuevos valores. */
export async function actualizarFilaPorId(
  tab: string,
  id: string,
  valores: (string | number)[]
) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => r[0]);
  const idx = ids.indexOf(id);
  if (idx === -1) {
    throw new Error(`No se encontró la fila con id ${id} en ${tab}`);
  }
  const rowNumber = idx + 2; // +2: la fila 1 es encabezado y las filas son 1-indexed
  const headers = HEADERS[tab as keyof typeof HEADERS] as unknown as string[];
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [valores] },
  });
}
