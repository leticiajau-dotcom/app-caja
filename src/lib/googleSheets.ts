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
  CONFIGURACION: "Configuracion",
} as const;

export const HEADERS = {
  [TABS.USUARIOS]: ["id", "nombre", "pinHash", "rol", "activo", "creadoEn"],
  [TABS.CUENTAS]: [
    "id",
    "nombre",
    "tipo",
    "tipoPersonalizado",
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
    "anulado",
    "anuladoPorId",
    "anuladoEn",
    "notaAnulacion",
    "movimientoOrigenId",
  ],
  [TABS.CONFIGURACION]: ["clave", "valor"],
} as const;

/** Cuántas filas de datos toleramos en una pestaña de Movimientos antes de
 *  rotar a una nueva ("Movimientos_2", "Movimientos_3", ...) para que la
 *  app siga funcionando sin cortes ni lecturas cada vez más lentas. Google
 *  Sheets soporta hasta ~10 millones de celdas por planilla; con nuestras
 *  15 columnas eso son ~650.000 filas por pestaña, así que este umbral deja
 *  mucho margen y además mantiene las lecturas rápidas. */
const UMBRAL_FILAS_MOVIMIENTOS = 200_000;

function headersDeTab(tab: string): readonly string[] {
  if (tab === TABS.MOVIMIENTOS || tab.startsWith(`${TABS.MOVIMIENTOS}_`)) {
    return HEADERS[TABS.MOVIMIENTOS];
  }
  const headers = HEADERS[tab as keyof typeof HEADERS];
  if (!headers) {
    throw new Error(`No se conocen los encabezados de la pestaña "${tab}".`);
  }
  return headers;
}

/** Crea (si no existe) la planilla con las pestañas y encabezados necesarios.
 *  Devuelve el spreadsheetId. Este id hay que guardarlo en la variable de
 *  entorno GOOGLE_SHEET_ID. */
export async function crearPlanillaSiNoExiste(
  nombre = "Caja Negocio",
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

/** Crea la pestaña si no existe (planillas creadas antes de sumar alguna
 *  funcionalidad, como "Configuracion", no la tienen) y actualiza la fila
 *  de encabezados si quedó más corta que la actual (por columnas nuevas
 *  agregadas después). Se usa como reparación automática ante errores. */
async function asegurarPestaña(tab: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const headers = headersDeTab(tab) as unknown as string[];

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existe = (meta.data.sheets ?? []).some(
    (s) => s.properties?.title === tab
  );

  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    return;
  }

  // La pestaña existe: si el encabezado quedó corto (se agregaron columnas
  // nuevas después de crearla), lo completamos sin tocar los datos.
  const filaActual = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:Z1`,
  });
  const largoActual = (filaActual.data.values?.[0] ?? []).length;
  if (largoActual < headers.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

/** Lee todas las filas de una pestaña como objetos, usando la fila 1 como encabezado. */
export async function leerFilas<T extends Record<string, string>>(
  tab: string
): Promise<T[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A2:Z`,
    });
  } catch {
    // Puede ser una planilla creada antes de que esta pestaña existiera:
    // la creamos (o le completamos el encabezado) y reintentamos una vez.
    await asegurarPestaña(tab);
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A2:Z`,
    });
  }
  const rows = res.data.values ?? [];
  const headers = headersDeTab(tab);
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

/** Cuenta cuántas filas de datos (sin contar el encabezado) tiene una pestaña. */
async function contarFilas(tab: string): Promise<number> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A2:A`,
    });
  } catch {
    await asegurarPestaña(tab);
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A2:A`,
    });
  }
  return (res.data.values ?? []).filter((r) => r[0]).length;
}

/** Agrega una fila nueva al final de la pestaña. */
export async function agregarFila(tab: string, valores: (string | number)[]) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [valores] },
    });
  } catch {
    await asegurarPestaña(tab);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [valores] },
    });
  }
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
  const headers = headersDeTab(tab);
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [valores] },
  });
}

// ---------------------------------------------------------------------------
// Configuración (clave/valor genérico: nombre de la app, logo, etc.)
// ---------------------------------------------------------------------------

export async function leerConfigValor(clave: string): Promise<string | null> {
  const filas = await leerFilas<{ clave: string; valor: string }>(
    TABS.CONFIGURACION
  );
  return filas.find((f) => f.clave === clave)?.valor ?? null;
}

export async function escribirConfigValor(clave: string, valor: string) {
  const filas = await leerFilas<{ clave: string; valor: string }>(
    TABS.CONFIGURACION
  );
  if (filas.some((f) => f.clave === clave)) {
    await actualizarFilaPorId(TABS.CONFIGURACION, clave, [clave, valor]);
  } else {
    await agregarFila(TABS.CONFIGURACION, [clave, valor]);
  }
}

// ---------------------------------------------------------------------------
// Pestañas de Movimientos con rotación automática (ver UMBRAL_FILAS_MOVIMIENTOS)
// ---------------------------------------------------------------------------

const CLAVE_TAB_ACTIVA_MOVIMIENTOS = "movimientosTabActiva";

/** Lista, en orden, todas las pestañas de movimientos que existen ("Movimientos",
 *  "Movimientos_2", "Movimientos_3", ...). Siempre incluye al menos "Movimientos". */
export async function listarPestañasMovimientos(): Promise<string[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titulos = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter(
      (t) => t === TABS.MOVIMIENTOS || t.startsWith(`${TABS.MOVIMIENTOS}_`)
    );
  titulos.sort((a, b) => {
    const na = a === TABS.MOVIMIENTOS ? 1 : Number(a.split("_")[1]);
    const nb = b === TABS.MOVIMIENTOS ? 1 : Number(b.split("_")[1]);
    return na - nb;
  });
  return titulos.length > 0 ? titulos : [TABS.MOVIMIENTOS];
}

async function crearPestañaMovimientos(nombreTab: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: nombreTab } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${nombreTab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS[TABS.MOVIMIENTOS] as unknown as string[]] },
  });
}

/** Devuelve la pestaña de Movimientos donde hay que escribir el próximo
 *  movimiento, rotando automáticamente a una pestaña nueva si la actual ya
 *  está llegando al límite de filas recomendado. */
export async function obtenerPestañaMovimientosParaEscribir(): Promise<string> {
  const pestañas = await listarPestañasMovimientos();
  const activa =
    (await leerConfigValor(CLAVE_TAB_ACTIVA_MOVIMIENTOS)) ??
    pestañas[pestañas.length - 1];

  const filas = await contarFilas(activa);
  if (filas < UMBRAL_FILAS_MOVIMIENTOS) {
    return activa;
  }

  // Rotar: crear la siguiente pestaña y marcarla como la activa.
  const siguienteNumero =
    (activa === TABS.MOVIMIENTOS ? 1 : Number(activa.split("_")[1])) + 1;
  const nueva = `${TABS.MOVIMIENTOS}_${siguienteNumero}`;
  await crearPestañaMovimientos(nueva);
  await escribirConfigValor(CLAVE_TAB_ACTIVA_MOVIMIENTOS, nueva);
  return nueva;
}
