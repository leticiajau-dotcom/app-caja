import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import {
  TABS,
  agregarFila,
  agregarFilas,
  actualizarCeldasPorId,
  actualizarFilaPorId,
  actualizarFilasPorId,
  asegurarPestaña,
  guardarArchivoDrive,
  leerFilas,
  leerConfigValor,
  escribirConfigValor,
  listarPestañasMovimientos,
  obtenerPestañaMovimientosParaEscribir,
} from "./googleSheets";
import { ApiError } from "./guards";
import type {
  ArqueoMoneda,
  Cliente,
  Configuracion,
  Cuenta,
  DefaultsPresupuesto,
  EstadoPresupuesto,
  Modificacion,
  Movimiento,
  CambioPrecio,
  Pago,
  Precio,
  Presupuesto,
  Proyecto,
  Resumen,
  ResumenProyecto,
  Rol,
  SaldoCuenta,
  SaldoGrupoResponsables,
  TipoMovimiento,
  Usuario,
} from "./types";
import {
  EXTRAS_INICIALES,
  calcularPresupuesto,
  clavePrecio,
  preciosParaArchivo,
  type ArchivoLebron,
  type ArticuloAgregado,
  type CambioMaterial,
  type CambioMueble,
  type DatosPresupuesto,
  type Extra,
  type TipoPrecio,
} from "./presupuesto";

const toBool = (v: string) => v === "true" || v === "TRUE" || v === "1";
// Un número que alguien escribió a mano en la planilla puede venir con coma
// decimal ("1234,5"): también se entiende.
const toNum = (v: string) => {
  if (v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? Number(v.replace(/\./g, "").replace(",", ".")) : n;
};

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

function rowToUsuario(r: Record<string, string>): Usuario {
  return {
    id: r.id,
    nombre: r.nombre,
    pinHash: r.pinHash,
    rol: (r.rol as Rol) || "empleado",
    activo: toBool(r.activo),
    creadoEn: r.creadoEn,
    intentosFallidos: toNum(r.intentosFallidos),
    bloqueadoHasta: r.bloqueadoHasta || null,
  };
}

// Cantidad de intentos de PIN incorrectos permitidos antes de bloquear al
// usuario, y minutos que dura el bloqueo una vez alcanzado ese límite.
const MAX_INTENTOS_FALLIDOS = 3;
const MINUTOS_BLOQUEO = 15;

function filaUsuario(u: Usuario): string[] {
  return [
    u.id,
    u.nombre,
    u.pinHash,
    u.rol,
    String(u.activo),
    u.creadoEn,
    String(u.intentosFallidos),
    u.bloqueadoHasta ?? "",
  ];
}

const CLAVE_MIGRACION_ROL_SOCIO = "migracionRolSocioHecha";

/** Antes de este cambio, "empleado" era el único rol no-admin y tenía
 *  permisos amplios (operar sus cuentas, ver todos los movimientos, ver
 *  el resumen general de la caja). Ahora ese rol pasa a llamarse "socio",
 *  y "empleado" es un rol nuevo mucho más acotado. Para que nadie pierda
 *  acceso de golpe, la primera vez que se lee la lista de usuarios tras
 *  este cambio migramos automáticamente cualquier fila que todavía diga
 *  "empleado" a "socio" — una sola vez, marcado en Configuracion. */
async function migrarRolEmpleadoASocioSiHaceFalta() {
  const yaHecha = await leerConfigValor(CLAVE_MIGRACION_ROL_SOCIO);
  if (yaHecha === "true") return;

  const rows = await leerFilas<Record<string, string>>(TABS.USUARIOS);
  for (const r of rows) {
    if (r.rol === "empleado") {
      await actualizarFilaPorId(TABS.USUARIOS, r.id, [
        r.id,
        r.nombre,
        r.pinHash,
        "socio",
        r.activo,
        r.creadoEn,
        r.intentosFallidos || "0",
        r.bloqueadoHasta || "",
      ]);
    }
  }
  await escribirConfigValor(CLAVE_MIGRACION_ROL_SOCIO, "true");
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await migrarRolEmpleadoASocioSiHaceFalta();
  const rows = await leerFilas<Record<string, string>>(TABS.USUARIOS);
  return rows.map(rowToUsuario);
}

export async function buscarUsuarioPorNombre(nombre: string) {
  const usuarios = await listarUsuarios();
  return usuarios.find(
    (u) => u.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
  );
}

export async function crearUsuario(datos: {
  nombre: string;
  pin: string;
  rol: Rol;
}): Promise<Usuario> {
  const existentes = await listarUsuarios();
  if (
    existentes.some(
      (u) => u.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase()
    )
  ) {
    throw new Error("Ya existe un usuario con ese nombre.");
  }
  const usuario: Usuario = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    pinHash: bcrypt.hashSync(datos.pin, 10),
    rol: datos.rol,
    activo: true,
    creadoEn: new Date().toISOString(),
    intentosFallidos: 0,
    bloqueadoHasta: null,
  };
  await agregarFila(TABS.USUARIOS, filaUsuario(usuario));
  return usuario;
}

export async function actualizarUsuario(
  id: string,
  cambios: Partial<Pick<Usuario, "nombre" | "rol" | "activo">> & {
    pin?: string;
  }
) {
  const usuarios = await listarUsuarios();
  const actual = usuarios.find((u) => u.id === id);
  if (!actual) throw new Error("Usuario no encontrado.");
  const actualizado: Usuario = {
    ...actual,
    nombre: cambios.nombre ?? actual.nombre,
    rol: cambios.rol ?? actual.rol,
    activo: cambios.activo ?? actual.activo,
    pinHash: cambios.pin ? bcrypt.hashSync(cambios.pin, 10) : actual.pinHash,
  };
  await actualizarFilaPorId(TABS.USUARIOS, id, filaUsuario(actualizado));
  return actualizado;
}

export async function verificarPin(nombre: string, pin: string) {
  const usuario = await buscarUsuarioPorNombre(nombre);
  if (!usuario || !usuario.activo) return null;

  if (usuario.bloqueadoHasta) {
    const bloqueadoHastaMs = new Date(usuario.bloqueadoHasta).getTime();
    if (bloqueadoHastaMs > Date.now()) {
      const minutosRestantes = Math.ceil(
        (bloqueadoHastaMs - Date.now()) / 60000
      );
      throw new ApiError(
        `Usuario bloqueado por intentos fallidos. Probá de nuevo en ${minutosRestantes} minuto${
          minutosRestantes === 1 ? "" : "s"
        }.`,
        429
      );
    }
  }

  const ok = bcrypt.compareSync(pin, usuario.pinHash);

  if (ok) {
    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      const actualizado: Usuario = {
        ...usuario,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      };
      await actualizarFilaPorId(TABS.USUARIOS, usuario.id, filaUsuario(actualizado));
      return actualizado;
    }
    return usuario;
  }

  const intentosFallidos = usuario.intentosFallidos + 1;
  const seBloquea = intentosFallidos >= MAX_INTENTOS_FALLIDOS;
  const actualizado: Usuario = {
    ...usuario,
    intentosFallidos: seBloquea ? 0 : intentosFallidos,
    bloqueadoHasta: seBloquea
      ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000).toISOString()
      : null,
  };
  await actualizarFilaPorId(TABS.USUARIOS, usuario.id, filaUsuario(actualizado));

  if (seBloquea) {
    throw new ApiError(
      `Demasiados intentos fallidos. Usuario bloqueado por ${MINUTOS_BLOQUEO} minutos.`,
      429
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

function rowToCuenta(r: Record<string, string>): Cuenta {
  return {
    id: r.id,
    nombre: r.nombre,
    moneda: r.moneda || "ARS",
    usuarioResponsablesIds: (r.usuarioResponsablesIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    saldoInicial: toNum(r.saldoInicial),
    activa: toBool(r.activa),
    creadoEn: r.creadoEn,
  };
}

export async function listarCuentas(soloActivas = false): Promise<Cuenta[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.CUENTAS);
  const cuentas = rows.map(rowToCuenta);
  return soloActivas ? cuentas.filter((c) => c.activa) : cuentas;
}

/** Fecha de "hoy" en horario de Argentina (UTC-3, sin horario de verano),
 *  para movimientos que se registran con la fecha del momento (ej. la
 *  apertura de saldo al crear una cuenta). El servidor corre en UTC, así
 *  que no alcanza con los componentes locales de un Date común. */
function hoyArgentinaISO(): string {
  const horaArgentina = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return horaArgentina.toISOString().slice(0, 10);
}

export async function crearCuenta(datos: {
  nombre: string;
  moneda: string;
  usuarioResponsablesIds: string[];
  saldoInicial: number;
  /** Quién la está creando: si hay saldo inicial, queda registrado como el
   *  usuario que cargó el movimiento de apertura. */
  usuarioId: string;
}): Promise<Cuenta> {
  if (datos.usuarioResponsablesIds.length === 0) {
    throw new Error("La cuenta necesita al menos un responsable.");
  }
  const cuenta: Cuenta = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    usuarioResponsablesIds: datos.usuarioResponsablesIds,
    saldoInicial: datos.saldoInicial || 0,
    activa: true,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.CUENTAS, [
    cuenta.id,
    cuenta.nombre,
    "", // tipo: ya no se usa, se deja vacío para no correr las columnas siguientes
    "", // tipoPersonalizado: ídem
    cuenta.moneda,
    cuenta.usuarioResponsablesIds.join(","),
    cuenta.saldoInicial,
    String(cuenta.activa),
    cuenta.creadoEn,
  ]);

  // Dejamos registrado el saldo inicial como movimiento, para que quede en
  // el historial (no afecta el saldo: ver esAperturaSaldo en el cálculo).
  if (cuenta.saldoInicial !== 0) {
    await crearMovimiento({
      fecha: hoyArgentinaISO(),
      tipo: cuenta.saldoInicial > 0 ? "ingreso" : "egreso",
      cuentaId: cuenta.id,
      monto: Math.abs(cuenta.saldoInicial),
      categoria: "Saldo inicial",
      descripcion: "Apertura de la cuenta",
      usuarioId: datos.usuarioId,
      esAperturaSaldo: true,
    });
  }

  return cuenta;
}

export async function actualizarCuenta(
  id: string,
  cambios: Partial<
    Pick<Cuenta, "nombre" | "moneda" | "usuarioResponsablesIds" | "activa">
  >
) {
  const cuentas = await listarCuentas();
  const actual = cuentas.find((c) => c.id === id);
  if (!actual) throw new Error("Cuenta no encontrada.");
  if (
    cambios.usuarioResponsablesIds !== undefined &&
    cambios.usuarioResponsablesIds.length === 0
  ) {
    throw new Error("La cuenta necesita al menos un responsable.");
  }
  const actualizada: Cuenta = { ...actual, ...cambios };
  await actualizarFilaPorId(TABS.CUENTAS, id, [
    actualizada.id,
    actualizada.nombre,
    "", // tipo: ya no se usa
    "", // tipoPersonalizado: ídem
    actualizada.moneda,
    actualizada.usuarioResponsablesIds.join(","),
    actualizada.saldoInicial,
    String(actualizada.activa),
    actualizada.creadoEn,
  ]);
  return actualizada;
}

/** El admin gestiona las cuentas (las crea y determina quiénes son
 *  responsables), pero para CARGAR un movimiento hay que ser uno de los
 *  responsables de esa cuenta puntual — sin excepción para el admin. Una
 *  cuenta sin responsables asignados no la puede operar nadie hasta que el
 *  admin le asigne alguien. */
export async function usuarioPuedeOperarCuenta(
  sesion: { usuarioId: string; rol: Rol },
  cuentaId: string
): Promise<boolean> {
  const cuentas = await listarCuentas();
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  return Boolean(cuenta?.usuarioResponsablesIds.includes(sesion.usuarioId));
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

function rowToMovimiento(r: Record<string, string>): Movimiento {
  return {
    id: r.id,
    fecha: r.fecha,
    tipo: (r.tipo as TipoMovimiento) || "ingreso",
    cuentaId: r.cuentaId,
    cuentaDestinoId: r.cuentaDestinoId || null,
    monto: toNum(r.monto),
    categoria: r.categoria || "",
    descripcion: r.descripcion || "",
    usuarioId: r.usuarioId,
    creadoEn: r.creadoEn,
    anulado: toBool(r.anulado),
    anuladoPorId: r.anuladoPorId || null,
    anuladoEn: r.anuladoEn || null,
    notaAnulacion: r.notaAnulacion || null,
    movimientoOrigenId: r.movimientoOrigenId || null,
    esAperturaSaldo: toBool(r.esAperturaSaldo),
    usuarioRetiroId: r.usuarioRetiroId || null,
  };
}

function movimientoAFila(m: Movimiento): (string | number)[] {
  return [
    m.id,
    m.fecha,
    m.tipo,
    m.cuentaId,
    m.cuentaDestinoId ?? "",
    m.monto,
    m.categoria,
    m.descripcion,
    m.usuarioId,
    m.creadoEn,
    String(m.anulado),
    m.anuladoPorId ?? "",
    m.anuladoEn ?? "",
    m.notaAnulacion ?? "",
    m.movimientoOrigenId ?? "",
    String(m.esAperturaSaldo),
    m.usuarioRetiroId ?? "",
  ];
}

/** Lee los movimientos de TODAS las pestañas de movimientos (la principal y
 *  las de continuación, si las hay por rotación automática). */
export async function listarMovimientos(): Promise<Movimiento[]> {
  const pestañas = await listarPestañasMovimientos();
  const listas = await Promise.all(
    pestañas.map((tab) => leerFilas<Record<string, string>>(tab))
  );
  return listas
    .flat()
    .map(rowToMovimiento)
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
}

export async function buscarMovimientoPorId(
  id: string
): Promise<{ movimiento: Movimiento; tab: string } | null> {
  const pestañas = await listarPestañasMovimientos();
  for (const tab of pestañas) {
    const filas = await leerFilas<Record<string, string>>(tab);
    const fila = filas.find((f) => f.id === id);
    if (fila) return { movimiento: rowToMovimiento(fila), tab };
  }
  return null;
}

export async function crearMovimiento(datos: {
  fecha: string;
  tipo: TipoMovimiento;
  cuentaId: string;
  cuentaDestinoId?: string | null;
  monto: number;
  categoria: string;
  descripcion: string;
  usuarioId: string;
  movimientoOrigenId?: string | null;
  esAperturaSaldo?: boolean;
  /** Solo para tipo "retiro": el usuario que retiró este importe puntual. */
  usuarioRetiroId?: string | null;
}): Promise<Movimiento> {
  if (datos.monto <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }
  if (datos.tipo === "transferencia") {
    if (!datos.cuentaDestinoId) {
      throw new Error("Una transferencia necesita cuenta destino.");
    }
    if (datos.cuentaDestinoId === datos.cuentaId) {
      throw new Error("La cuenta destino debe ser distinta de la de origen.");
    }
    const cuentas = await listarCuentas();
    const origen = cuentas.find((c) => c.id === datos.cuentaId);
    const destino = cuentas.find((c) => c.id === datos.cuentaDestinoId);
    if (!origen || !destino) {
      throw new Error("Cuenta de origen o destino inválida.");
    }
    if (origen.moneda !== destino.moneda) {
      throw new Error(
        "Una transferencia solo puede ser entre cuentas de la misma moneda."
      );
    }
  }
  const movimiento: Movimiento = {
    id: randomUUID(),
    fecha: datos.fecha,
    tipo: datos.tipo,
    cuentaId: datos.cuentaId,
    cuentaDestinoId: datos.tipo === "transferencia" ? datos.cuentaDestinoId! : null,
    monto: datos.monto,
    categoria: datos.categoria.trim(),
    descripcion: datos.descripcion.trim(),
    usuarioId: datos.usuarioId,
    creadoEn: new Date().toISOString(),
    anulado: false,
    anuladoPorId: null,
    anuladoEn: null,
    notaAnulacion: null,
    movimientoOrigenId: datos.movimientoOrigenId ?? null,
    esAperturaSaldo: datos.esAperturaSaldo ?? false,
    usuarioRetiroId: datos.usuarioRetiroId ?? null,
  };
  const tabDestino = await obtenerPestañaMovimientosParaEscribir();
  await agregarFila(tabDestino, movimientoAFila(movimiento));
  return movimiento;
}

/** Anula un movimiento (no lo borra: queda visible y auditado). No vuelve a
 *  contarse en los saldos ni en el arqueo a partir de este momento. El
 *  control de permisos (quién puede anular qué) se hace en la capa de API. */
export async function anularMovimiento(
  id: string,
  datos: { anuladoPorId: string; nota: string }
): Promise<Movimiento> {
  const encontrado = await buscarMovimientoPorId(id);
  if (!encontrado) throw new Error("Movimiento no encontrado.");
  if (encontrado.movimiento.anulado) {
    throw new Error("Este movimiento ya estaba anulado.");
  }
  const actualizado: Movimiento = {
    ...encontrado.movimiento,
    anulado: true,
    anuladoPorId: datos.anuladoPorId,
    anuladoEn: new Date().toISOString(),
    notaAnulacion: datos.nota.trim(),
  };
  await actualizarFilaPorId(encontrado.tab, id, movimientoAFila(actualizado));
  return actualizado;
}

// ---------------------------------------------------------------------------
// Configuración de la app (nombre, logo)
// ---------------------------------------------------------------------------

const CLAVE_NOMBRE_APP = "nombreApp";
const CLAVE_LOGO = "logoDataUri";
const NOMBRE_APP_POR_DEFECTO = "Caja Negocio";

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const [nombreApp, logoDataUri] = await Promise.all([
    leerConfigValor(CLAVE_NOMBRE_APP),
    leerConfigValor(CLAVE_LOGO),
  ]);
  return {
    nombreApp: nombreApp || NOMBRE_APP_POR_DEFECTO,
    logoDataUri: logoDataUri || "",
  };
}

export async function actualizarConfiguracion(
  cambios: Partial<Configuracion>
) {
  if (cambios.nombreApp !== undefined) {
    await escribirConfigValor(CLAVE_NOMBRE_APP, cambios.nombreApp.trim());
  }
  if (cambios.logoDataUri !== undefined) {
    await escribirConfigValor(CLAVE_LOGO, cambios.logoDataUri);
  }
  return obtenerConfiguracion();
}

// ---------------------------------------------------------------------------
// Saldos y arqueo
// ---------------------------------------------------------------------------

/** Calcula el saldo de cada cuenta a partir del saldo inicial + movimientos.
 *  Los movimientos anulados no se cuentan: es como si nunca hubieran pasado. */
export function calcularSaldosPorCuenta(
  cuentas: Cuenta[],
  movimientos: Movimiento[]
): SaldoCuenta[] {
  const saldos = new Map<string, number>();
  for (const c of cuentas) saldos.set(c.id, c.saldoInicial);

  for (const m of movimientos) {
    // El de apertura es solo un registro visible en el historial: el
    // importe ya está contado en el saldo inicial de la cuenta.
    if (m.anulado || m.esAperturaSaldo) continue;
    if (m.tipo === "ingreso") {
      saldos.set(m.cuentaId, (saldos.get(m.cuentaId) ?? 0) + m.monto);
    } else if (m.tipo === "egreso" || m.tipo === "retiro") {
      // Un retiro se comporta como un egreso a efectos del saldo.
      saldos.set(m.cuentaId, (saldos.get(m.cuentaId) ?? 0) - m.monto);
    } else if (m.tipo === "transferencia" && m.cuentaDestinoId) {
      saldos.set(m.cuentaId, (saldos.get(m.cuentaId) ?? 0) - m.monto);
      saldos.set(
        m.cuentaDestinoId,
        (saldos.get(m.cuentaDestinoId) ?? 0) + m.monto
      );
    }
  }

  return cuentas.map((cuenta) => ({
    cuenta,
    saldo: saldos.get(cuenta.id) ?? 0,
  }));
}

/** Saldo de la cuenta de cada movimiento, calculado justo después de que ese
 *  movimiento se aplicó (recorriendo TODO el historial en orden
 *  cronológico, sin importar quién lo cargó). Sirve para que un empleado
 *  -que en "Movimientos" solo ve los que él mismo cargó- pueda igual
 *  controlar el saldo real de la cuenta de la que es responsable, sin que
 *  se le muestren los movimientos de otros usuarios: acá se calcula sobre
 *  el historial completo, y después cada llamador filtra qué movimientos
 *  le puede mostrar a quién (ver /api/movements). */
export function calcularSaldoCuentaPorMovimiento(
  cuentas: Cuenta[],
  movimientos: Movimiento[]
): Map<string, number> {
  const saldoPorCuenta = new Map<string, number>();
  for (const c of cuentas) saldoPorCuenta.set(c.id, c.saldoInicial);

  const cronologico = [...movimientos].sort((a, b) =>
    a.creadoEn < b.creadoEn ? -1 : 1
  );
  const resultado = new Map<string, number>();
  for (const m of cronologico) {
    if (!m.anulado && !m.esAperturaSaldo) {
      if (m.tipo === "ingreso") {
        saldoPorCuenta.set(m.cuentaId, (saldoPorCuenta.get(m.cuentaId) ?? 0) + m.monto);
      } else if (m.tipo === "egreso" || m.tipo === "retiro") {
        saldoPorCuenta.set(m.cuentaId, (saldoPorCuenta.get(m.cuentaId) ?? 0) - m.monto);
      } else if (m.tipo === "transferencia" && m.cuentaDestinoId) {
        saldoPorCuenta.set(m.cuentaId, (saldoPorCuenta.get(m.cuentaId) ?? 0) - m.monto);
        saldoPorCuenta.set(
          m.cuentaDestinoId,
          (saldoPorCuenta.get(m.cuentaDestinoId) ?? 0) + m.monto
        );
      }
    }
    resultado.set(m.id, saldoPorCuenta.get(m.cuentaId) ?? 0);
  }
  return resultado;
}

const ETIQUETA_SIN_RESPONSABLE = "Sin responsable asignado";
const CLAVE_SIN_RESPONSABLE = "__sin_responsable__";

/** Agrupa el saldo por la combinación exacta de responsables de cada
 *  cuenta: una cuenta con un solo responsable suma al grupo de esa persona
 *  sola; una cuenta con varios responsables arma su propio grupo (ej.
 *  "Leticia - Pablo") en vez de sumarse a los saldos individuales de cada
 *  uno. Las cuentas sin responsable asignado se agrupan aparte, bajo "Sin
 *  responsable asignado". Solo se consideran las cuentas activas (es el
 *  resumen general de la caja, no un archivo histórico). */
export function calcularSaldosPorGrupoResponsable(
  usuarios: Usuario[],
  saldosPorCuenta: SaldoCuenta[]
): SaldoGrupoResponsables[] {
  const nombrePorId = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const grupos = new Map<string, SaldoGrupoResponsables>();

  for (const item of saldosPorCuenta) {
    const { cuenta, saldo } = item;
    if (!cuenta.activa) continue;

    let clave: string;
    let usuarioIds: string[];
    let etiqueta: string;
    if (cuenta.usuarioResponsablesIds.length === 0) {
      clave = CLAVE_SIN_RESPONSABLE;
      usuarioIds = [];
      etiqueta = ETIQUETA_SIN_RESPONSABLE;
    } else {
      usuarioIds = [...cuenta.usuarioResponsablesIds].sort((a, b) =>
        (nombrePorId.get(a) ?? "").localeCompare(nombrePorId.get(b) ?? "")
      );
      clave = usuarioIds.join("|");
      etiqueta = usuarioIds.map((id) => nombrePorId.get(id) ?? "?").join(" - ");
    }

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        usuarioIds,
        etiqueta,
        porMoneda: {},
        cuentasPorMoneda: {},
      });
    }
    const grupo = grupos.get(clave)!;
    grupo.porMoneda[cuenta.moneda] = (grupo.porMoneda[cuenta.moneda] ?? 0) + saldo;
    if (!grupo.cuentasPorMoneda[cuenta.moneda]) {
      grupo.cuentasPorMoneda[cuenta.moneda] = [];
    }
    grupo.cuentasPorMoneda[cuenta.moneda].push(item);
  }

  return Array.from(grupos.values()).sort((a, b) => {
    // El grupo "sin responsable" siempre va al final.
    if (a.etiqueta === ETIQUETA_SIN_RESPONSABLE) return 1;
    if (b.etiqueta === ETIQUETA_SIN_RESPONSABLE) return -1;
    return a.etiqueta.localeCompare(b.etiqueta);
  });
}

export function calcularArqueoPorMoneda(
  saldosPorCuenta: SaldoCuenta[]
): ArqueoMoneda[] {
  const porMoneda = new Map<string, SaldoCuenta[]>();
  for (const sc of saldosPorCuenta) {
    if (!sc.cuenta.activa) continue;
    const lista = porMoneda.get(sc.cuenta.moneda) ?? [];
    lista.push(sc);
    porMoneda.set(sc.cuenta.moneda, lista);
  }
  return Array.from(porMoneda.entries())
    .map(([moneda, cuentas]) => ({
      moneda,
      total: cuentas.reduce((acc, c) => acc + c.saldo, 0),
      cuentas,
    }))
    .sort((a, b) => a.moneda.localeCompare(b.moneda));
}

export async function obtenerResumen(): Promise<Resumen> {
  const [cuentas, movimientos, usuarios] = await Promise.all([
    listarCuentas(),
    listarMovimientos(),
    listarUsuarios(),
  ]);
  const saldosPorCuenta = calcularSaldosPorCuenta(cuentas, movimientos);
  const saldosPorGrupoResponsable = calcularSaldosPorGrupoResponsable(
    usuarios,
    saldosPorCuenta
  );
  const arqueoPorMoneda = calcularArqueoPorMoneda(saldosPorCuenta);
  return { saldosPorCuenta, saldosPorGrupoResponsable, arqueoPorMoneda };
}

// ---------------------------------------------------------------------------
// Clientes y Proyectos
// ---------------------------------------------------------------------------
// Cada cliente puede tener uno o más proyectos, cada uno con su importe
// acordado. Pensado para más adelante poder registrar contra cada proyecto
// los adelantos/pagos que van entrando a la caja (y, más adelante, sus
// costos), pero por ahora es solo el alta de clientes y proyectos.

function rowToCliente(r: Record<string, string>): Cliente {
  return {
    id: r.id,
    nombre: r.nombre,
    creadoEn: r.creadoEn,
  };
}

function rowToProyecto(r: Record<string, string>): Proyecto {
  return {
    id: r.id,
    clienteId: r.clienteId,
    nombre: r.nombre,
    descripcion: r.descripcion || "",
    moneda: r.moneda || "ARS",
    precio: toNum(r.precio),
    creadoEn: r.creadoEn,
  };
}

function filaProyecto(p: Proyecto): (string | number)[] {
  return [p.id, p.clienteId, p.nombre, p.moneda, p.precio, p.creadoEn, p.descripcion];
}

export async function listarClientes(): Promise<Cliente[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.CLIENTES);
  return rows.map(rowToCliente);
}

export async function listarProyectos(): Promise<Proyecto[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.PROYECTOS);
  return rows.map(rowToProyecto);
}

/** Da de alta un cliente nuevo junto con su primer proyecto (la pantalla de
 *  "Nuevo cliente" carga los dos datos juntos). */
export async function crearCliente(datos: {
  nombre: string;
  proyecto: string;
  descripcion?: string;
  moneda: string;
  precio: number;
}): Promise<{ cliente: Cliente; proyecto: Proyecto }> {
  const nombreCliente = datos.nombre.trim();
  const nombreProyecto = datos.proyecto.trim();
  if (!nombreCliente) throw new Error("Ingresá el nombre del cliente.");
  if (!nombreProyecto) throw new Error("Ingresá el nombre del proyecto.");

  const clientes = await listarClientes();
  if (
    clientes.some(
      (c) => c.nombre.trim().toLowerCase() === nombreCliente.toLowerCase()
    )
  ) {
    throw new Error("Ya existe un cliente con ese nombre.");
  }

  const cliente: Cliente = {
    id: randomUUID(),
    nombre: nombreCliente,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.CLIENTES, [cliente.id, cliente.nombre, cliente.creadoEn]);

  const proyecto: Proyecto = {
    id: randomUUID(),
    clienteId: cliente.id,
    nombre: nombreProyecto,
    descripcion: (datos.descripcion ?? "").trim(),
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    precio: datos.precio || 0,
    creadoEn: cliente.creadoEn,
  };
  await agregarFila(TABS.PROYECTOS, filaProyecto(proyecto));

  return { cliente, proyecto };
}

/** Agrega un proyecto nuevo a un cliente ya existente. */
export async function agregarProyecto(
  clienteId: string,
  datos: { nombre: string; descripcion?: string; moneda: string; precio: number }
): Promise<Proyecto> {
  const nombreProyecto = datos.nombre.trim();
  if (!nombreProyecto) throw new Error("Ingresá el nombre del proyecto.");

  const [clientes, proyectos] = await Promise.all([
    listarClientes(),
    listarProyectos(),
  ]);
  const cliente = clientes.find((c) => c.id === clienteId);
  if (!cliente) throw new Error("Cliente no encontrado.");

  const yaExiste = proyectos.some(
    (p) =>
      p.clienteId === clienteId &&
      p.nombre.trim().toLowerCase() === nombreProyecto.toLowerCase()
  );
  if (yaExiste) {
    throw new Error("Ese cliente ya tiene un proyecto con ese nombre.");
  }

  const proyecto: Proyecto = {
    id: randomUUID(),
    clienteId,
    nombre: nombreProyecto,
    descripcion: (datos.descripcion ?? "").trim(),
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    precio: datos.precio || 0,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.PROYECTOS, filaProyecto(proyecto));
  return proyecto;
}

// ---------------------------------------------------------------------------
// Modificaciones y Pagos (por proyecto)
// ---------------------------------------------------------------------------
// El precio de un proyecto puede ir cambiando (el cliente pide agregar o
// sacar algo): cada cambio queda registrado como una Modificación, con una
// nota y el ajuste en el importe (puede ser 0 si es solo un comentario). El
// importe final de un proyecto es su precio base más la suma de esos
// ajustes — ver calcularResumenProyectos.
//
// Los Pagos que hace el cliente generan, además, un ingreso real en
// Movimientos (en la cuenta que se elija) para que ese dinero quede
// reflejado en la caja como cualquier otro ingreso; acá solo se guarda la
// referencia a ese movimiento.

function rowToModificacion(r: Record<string, string>): Modificacion {
  return {
    id: r.id,
    proyectoId: r.proyectoId,
    nota: r.nota,
    ajuste: toNum(r.ajuste),
    usuarioId: r.usuarioId,
    creadoEn: r.creadoEn,
  };
}

function rowToPago(r: Record<string, string>): Pago {
  return {
    id: r.id,
    proyectoId: r.proyectoId,
    monto: toNum(r.monto),
    cuentaId: r.cuentaId || null,
    movimientoId: r.movimientoId || null,
    nota: r.nota || "",
    usuarioId: r.usuarioId,
    creadoEn: r.creadoEn,
  };
}

export async function listarModificaciones(): Promise<Modificacion[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.MODIFICACIONES);
  return rows.map(rowToModificacion);
}

export async function listarPagos(): Promise<Pago[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.PAGOS);
  return rows.map(rowToPago);
}

/** Calcula, para cada proyecto, el importe final (precio + ajustes), lo
 *  pagado (sin contar pagos cuyo ingreso haya sido anulado en Movimientos)
 *  y el saldo por cobrar. */
export function calcularResumenProyectos(
  proyectos: Proyecto[],
  modificaciones: Modificacion[],
  pagos: Pago[],
  movimientos: Movimiento[]
): Record<string, ResumenProyecto> {
  const anuladoPorMovimientoId = new Map(
    movimientos.map((m) => [m.id, m.anulado])
  );
  const resumen: Record<string, ResumenProyecto> = {};
  for (const p of proyectos) {
    const ajustes = modificaciones
      .filter((m) => m.proyectoId === p.id)
      .reduce((acc, m) => acc + m.ajuste, 0);
    const pagado = pagos
      .filter(
        (pago) =>
          pago.proyectoId === p.id &&
          !(pago.movimientoId && anuladoPorMovimientoId.get(pago.movimientoId))
      )
      .reduce((acc, pago) => acc + pago.monto, 0);
    const importe = p.precio + ajustes;
    resumen[p.id] = { proyectoId: p.id, importe, pagado, saldo: importe - pagado };
  }
  return resumen;
}

/** Agrega una modificación (cambio pedido por el cliente) a un proyecto. */
export async function agregarModificacion(
  proyectoId: string,
  datos: { nota: string; ajuste: number; usuarioId: string }
): Promise<Modificacion> {
  const nota = datos.nota.trim();
  if (!nota) throw new Error("Contá qué cambió.");

  const proyectos = await listarProyectos();
  if (!proyectos.some((p) => p.id === proyectoId)) {
    throw new Error("Proyecto no encontrado.");
  }

  const modificacion: Modificacion = {
    id: randomUUID(),
    proyectoId,
    nota,
    ajuste: datos.ajuste || 0,
    usuarioId: datos.usuarioId,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.MODIFICACIONES, [
    modificacion.id,
    modificacion.proyectoId,
    modificacion.nota,
    modificacion.ajuste,
    modificacion.usuarioId,
    modificacion.creadoEn,
  ]);
  return modificacion;
}

function filaPago(p: Pago): (string | number)[] {
  return [
    p.id,
    p.proyectoId,
    p.monto,
    p.cuentaId ?? "",
    p.movimientoId ?? "",
    p.nota,
    p.usuarioId,
    p.creadoEn,
  ];
}

/** Registra un pago del cliente contra un proyecto: crea el ingreso real
 *  en Movimientos (en la cuenta elegida) y el registro de Pago que
 *  referencia a ese movimiento. La cuenta tiene que ser de la misma
 *  moneda que el proyecto, para que el saldo por cobrar no mezcle
 *  monedas. */
export async function agregarPago(
  proyectoId: string,
  datos: { monto: number; cuentaId: string; nota?: string; usuarioId: string }
): Promise<{ pago: Pago; movimiento: Movimiento }> {
  if (datos.monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  const [proyectos, clientes, cuentas] = await Promise.all([
    listarProyectos(),
    listarClientes(),
    listarCuentas(),
  ]);
  const proyecto = proyectos.find((p) => p.id === proyectoId);
  if (!proyecto) throw new Error("Proyecto no encontrado.");
  const cliente = clientes.find((c) => c.id === proyecto.clienteId);
  const cuenta = cuentas.find((c) => c.id === datos.cuentaId);
  if (!cuenta) throw new Error("Cuenta no encontrada.");
  if (cuenta.moneda !== proyecto.moneda) {
    throw new Error(
      `Este proyecto es en ${proyecto.moneda}: elegí una cuenta en la misma moneda.`
    );
  }

  const nota = (datos.nota ?? "").trim();
  const descripcion = [cliente?.nombre, proyecto.nombre, nota]
    .filter(Boolean)
    .join(" — ");

  const movimiento = await crearMovimiento({
    fecha: hoyArgentinaISO(),
    tipo: "ingreso",
    cuentaId: datos.cuentaId,
    monto: datos.monto,
    categoria: "Pago de cliente",
    descripcion,
    usuarioId: datos.usuarioId,
  });

  const pago: Pago = {
    id: randomUUID(),
    proyectoId,
    monto: datos.monto,
    cuentaId: datos.cuentaId,
    movimientoId: movimiento.id,
    nota,
    usuarioId: datos.usuarioId,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.PAGOS, filaPago(pago));

  return { pago, movimiento };
}

/** Vincula un pago a un ingreso que YA existe en Movimientos (en vez de
 *  crear uno nuevo) — para no duplicar en la caja un adelanto/pago que ya
 *  se había cargado antes de tener esta pantalla de Clientes. */
export async function vincularPago(
  proyectoId: string,
  datos: { movimientoId: string; nota?: string; usuarioId: string }
): Promise<{ pago: Pago; movimiento: Movimiento }> {
  const [proyectos, cuentas, pagosExistentes, encontrado] = await Promise.all([
    listarProyectos(),
    listarCuentas(),
    listarPagos(),
    buscarMovimientoPorId(datos.movimientoId),
  ]);
  const proyecto = proyectos.find((p) => p.id === proyectoId);
  if (!proyecto) throw new Error("Proyecto no encontrado.");
  if (!encontrado) throw new Error("Ese movimiento no existe.");
  const { movimiento } = encontrado;
  if (movimiento.tipo !== "ingreso") {
    throw new Error("Solo se puede vincular un movimiento de tipo ingreso.");
  }
  if (movimiento.anulado) {
    throw new Error("Ese movimiento está anulado, no se puede vincular.");
  }
  if (pagosExistentes.some((p) => p.movimientoId === movimiento.id)) {
    throw new Error("Ese movimiento ya está vinculado a otro pago.");
  }
  const cuenta = cuentas.find((c) => c.id === movimiento.cuentaId);
  if (cuenta && cuenta.moneda !== proyecto.moneda) {
    throw new Error(
      `Este proyecto es en ${proyecto.moneda}, y ese movimiento es en ${cuenta.moneda}.`
    );
  }

  const pago: Pago = {
    id: randomUUID(),
    proyectoId,
    monto: movimiento.monto,
    cuentaId: movimiento.cuentaId,
    movimientoId: movimiento.id,
    nota: (datos.nota ?? "").trim(),
    usuarioId: datos.usuarioId,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.PAGOS, filaPago(pago));

  return { pago, movimiento };
}

/** Registra un pago "histórico": un adelanto que el cliente ya había
 *  pagado ANTES de empezar a usar la app, y por lo tanto nunca se cargó
 *  como ingreso en Movimientos. A propósito no toca ninguna cuenta ni crea
 *  ningún movimiento — solo sirve para que el saldo por cobrar del
 *  proyecto arranque reflejando lo que ya se cobró. Pensado como recurso
 *  transitorio para la carga inicial de proyectos viejos. */
export async function agregarPagoHistorico(
  proyectoId: string,
  datos: { monto: number; nota?: string; usuarioId: string }
): Promise<Pago> {
  if (datos.monto <= 0) throw new Error("El monto debe ser mayor a 0.");

  const proyectos = await listarProyectos();
  if (!proyectos.some((p) => p.id === proyectoId)) {
    throw new Error("Proyecto no encontrado.");
  }

  const pago: Pago = {
    id: randomUUID(),
    proyectoId,
    monto: datos.monto,
    cuentaId: null,
    movimientoId: null,
    nota: (datos.nota ?? "").trim(),
    usuarioId: datos.usuarioId,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.PAGOS, filaPago(pago));

  return pago;
}

// ---------------------------------------------------------------------------
// Presupuestos (a partir del archivo que exporta LEBRON) y lista de precios
// ---------------------------------------------------------------------------
// La cuenta vive en lib/presupuesto.ts (sin Google Sheets, para poder
// probarla sola); acá solo se lee y se guarda. Un presupuesto guarda los
// precios unitarios que usó: si después cambia la lista, un presupuesto ya
// hecho no cambia solo (se puede volver a tomar la lista desde la pantalla).

const TIPOS_PRECIO: TipoPrecio[] = ["placa", "canto", "herraje", "otro"];

function rowToPrecio(r: Record<string, string>): Precio {
  return {
    id: r.id,
    tipo: (TIPOS_PRECIO.includes(r.tipo as TipoPrecio) ? r.tipo : "herraje") as TipoPrecio,
    nombre: r.nombre,
    precio: toNum(r.precio),
    actualizadoEn: r.actualizadoEn,
    usuarioId: r.usuarioId,
    codigo: r.codigo ?? "",
    proveedor: r.proveedor ?? "",
    descripcion: r.descripcion ?? "",
    contenido: toNum(r.contenido ?? "") || 1,
  };
}

function filaPrecio(p: Precio): (string | number)[] {
  return [
    p.id, p.tipo, p.nombre, p.precio, p.actualizadoEn, p.usuarioId,
    p.codigo, p.proveedor, p.descripcion, p.contenido,
  ];
}

const mismoPrecio = (a: Precio, b: Precio) =>
  a.precio === b.precio && a.codigo === b.codigo && a.proveedor === b.proveedor &&
  a.descripcion === b.descripcion && a.contenido === b.contenido;

export async function listarPrecios(): Promise<Precio[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.PRECIOS);
  return rows.map(rowToPrecio);
}

/** Carga o cambia precios de la lista (por tipo + nombre, sin distinguir
 *  mayúsculas). Un precio en 0 no se guarda: es "todavía sin precio". El
 *  código, el proveedor, etc. que no vengan quedan como estaban: guardar un
 *  precio desde un presupuesto no le borra el código. */
export async function guardarPrecios(cambios: CambioPrecio[], usuarioId: string): Promise<Precio[]> {
  // Una lista importada trae columnas que una planilla de antes no tiene en su
  // encabezado: se lo completa, para que se lea al abrir la planilla.
  if (cambios.some((c) => c.codigo)) await asegurarPestaña(TABS.PRECIOS);
  const lista = await listarPrecios();
  const porClave = new Map(lista.map((p) => [clavePrecio(p.tipo, p.nombre), p]));
  const ahora = new Date().toISOString();
  const nuevas = new Map<string, Precio>();
  const actualizadas = new Map<string, Precio>();
  for (const c of cambios) {
    const nombre = c.nombre.trim();
    if (!nombre || !(c.precio > 0)) continue;
    const clave = clavePrecio(c.tipo, nombre);
    const existente = porClave.get(clave);
    const delProveedor: Partial<Precio> = {
      ...(c.codigo !== undefined && { codigo: c.codigo.trim() }),
      ...(c.proveedor !== undefined && { proveedor: c.proveedor.trim() }),
      ...(c.descripcion !== undefined && { descripcion: c.descripcion.trim() }),
      ...(c.contenido !== undefined && c.contenido > 0 && { contenido: c.contenido }),
    };
    if (existente && mismoPrecio(existente, { ...existente, ...delProveedor, precio: c.precio })) continue;
    if (existente) {
      const act: Precio = { ...existente, ...delProveedor, precio: c.precio, actualizadoEn: ahora, usuarioId };
      porClave.set(clave, act);
      if (nuevas.has(clave)) nuevas.set(clave, act);
      else actualizadas.set(clave, act);
    } else {
      const nuevo: Precio = {
        id: randomUUID(), tipo: c.tipo, nombre, precio: c.precio, actualizadoEn: ahora, usuarioId,
        codigo: "", proveedor: "", descripcion: "", contenido: 1, ...delProveedor,
      };
      porClave.set(clave, nuevo);
      nuevas.set(clave, nuevo);
    }
  }
  await actualizarFilasPorId(
    TABS.PRECIOS,
    [...actualizadas.values()].map((p) => ({ id: p.id, valores: filaPrecio(p) }))
  );
  await agregarFilas(TABS.PRECIOS, [...nuevas.values()].map(filaPrecio));
  return [...porClave.values()];
}

// Una celda de Google Sheets admite hasta 50.000 caracteres.
const LIMITE_DATOS_PRESUPUESTO = 45_000;

function serializarDatosPresupuesto(datos: DatosPresupuesto): string {
  const texto = JSON.stringify(datos);
  if (texto.length > LIMITE_DATOS_PRESUPUESTO) {
    throw new Error(
      "El diseño tiene demasiados módulos distintos para guardarlo en la planilla. Probá exportar de LEBRON por partes."
    );
  }
  return texto;
}

function rowToPresupuesto(r: Record<string, string>): Presupuesto {
  let datos: DatosPresupuesto;
  try {
    datos = JSON.parse(r.datos);
  } catch {
    throw new Error(`El presupuesto ${r.id} tiene los datos dañados en la planilla.`);
  }
  return {
    id: r.id,
    clienteId: r.clienteId,
    nombre: r.nombre,
    estado: (["borrador", "aceptado", "descartado"].includes(r.estado) ? r.estado : "borrador") as EstadoPresupuesto,
    moneda: r.moneda || "ARS",
    coefPlacas: toNum(r.coefPlacas) || 1,
    coefHerrajes: toNum(r.coefHerrajes) || 1,
    porModulo: toBool(r.porModulo),
    datos,
    total: toNum(r.total),
    proyectoId: r.proyectoId || null,
    usuarioId: r.usuarioId,
    creadoEn: r.creadoEn,
    actualizadoEn: r.actualizadoEn,
    tokenPublico: r.tokenPublico || null,
    modeloId: r.modeloId || null,
    vistoPrimero: r.vistoPrimero || null,
    vistoUltimo: r.vistoUltimo || null,
    vistas: toNum(r.vistas),
  };
}

function filaPresupuesto(p: Presupuesto): (string | number)[] {
  return [
    p.id,
    p.clienteId,
    p.nombre,
    p.estado,
    p.moneda,
    p.coefPlacas,
    p.coefHerrajes,
    p.porModulo ? "true" : "false",
    serializarDatosPresupuesto(p.datos),
    p.total,
    p.proyectoId ?? "",
    p.usuarioId,
    p.creadoEn,
    p.actualizadoEn,
    p.tokenPublico ?? "",
    p.modeloId ?? "",
    p.vistoPrimero ?? "",
    p.vistoUltimo ?? "",
    p.vistas,
  ];
}

export async function listarPresupuestos(): Promise<Presupuesto[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.PRESUPUESTOS);
  return rows.map(rowToPresupuesto);
}

export async function obtenerPresupuesto(id: string): Promise<Presupuesto> {
  const p = (await listarPresupuestos()).find((x) => x.id === id);
  if (!p) throw new ApiError("Presupuesto no encontrado.", 404);
  return p;
}

/** El presupuesto del link que se le manda al cliente. Uno descartado ya no
 *  se muestra. */
export async function obtenerPresupuestoPorToken(token: string): Promise<Presupuesto> {
  const p = token.length >= 16 ? (await listarPresupuestos()).find((x) => x.tokenPublico === token) : undefined;
  if (!p || p.estado === "descartado") {
    throw new ApiError("Este link no existe o el presupuesto ya no está disponible.", 404);
  }
  return p;
}

/** Guarda el diseño en 3D (.glb) que manda LEBRON en el Drive, y le da al
 *  presupuesto su link para el cliente (uno nuevo solo la primera vez: si se
 *  vuelve a mandar el 3D, el link que ya tiene el cliente sigue andando). */
export async function guardarModeloPresupuesto(id: string, datos: Buffer): Promise<Presupuesto> {
  const p = await obtenerPresupuesto(id);
  await asegurarPestaña(TABS.PRESUPUESTOS);
  p.modeloId = await guardarArchivoDrive(
    `${p.nombre} (${p.id}).glb`,
    datos,
    "model/gltf-binary",
    p.modeloId
  );
  p.tokenPublico = p.tokenPublico || randomBytes(18).toString("base64url");
  p.actualizadoEn = new Date().toISOString();
  await actualizarFilaPorId(TABS.PRESUPUESTOS, p.id, filaPresupuesto(p));
  return p;
}

/** El cliente abrió el link: se anota cuándo. Solo esas columnas de la fila,
 *  así no pisa un cambio del presupuesto que se esté guardando al mismo tiempo. */
export async function registrarVistaPresupuesto(p: Presupuesto): Promise<void> {
  const ahora = new Date().toISOString();
  await asegurarPestaña(TABS.PRESUPUESTOS);
  await actualizarCeldasPorId(TABS.PRESUPUESTOS, p.id, "vistoPrimero", [
    p.vistoPrimero ?? ahora,
    ahora,
    p.vistas + 1,
  ]);
}

const CLAVE_COEF_PLACAS = "presupuestoCoefPlacas";
const CLAVE_COEF_HERRAJES = "presupuestoCoefHerrajes";
const CLAVE_VALIDEZ_DIAS = "presupuestoValidezDias";
const CLAVE_NOMBRE_COMERCIAL = "presupuestoNombreComercial";
const CLAVE_NOTA_PIE = "presupuestoNotaPie";

export async function obtenerDefaultsPresupuesto(): Promise<DefaultsPresupuesto> {
  const [placas, herrajes, validez, nombreComercial, notaPie] = await Promise.all([
    leerConfigValor(CLAVE_COEF_PLACAS),
    leerConfigValor(CLAVE_COEF_HERRAJES),
    leerConfigValor(CLAVE_VALIDEZ_DIAS),
    leerConfigValor(CLAVE_NOMBRE_COMERCIAL),
    leerConfigValor(CLAVE_NOTA_PIE),
  ]);
  const coefPlacas = Number(placas) > 0 ? Number(placas) : 1;
  return {
    coefPlacas,
    coefHerrajes: Number(herrajes) > 0 ? Number(herrajes) : coefPlacas,
    validezDias: Number(validez) > 0 ? Number(validez) : 15,
    nombreComercial: nombreComercial ?? "",
    notaPie: notaPie ?? "",
  };
}

export async function guardarDefaultsPresupuesto(d: Omit<DefaultsPresupuesto, "coefPlacas" | "coefHerrajes">) {
  if (!(d.validezDias > 0)) throw new Error("La validez tiene que ser de al menos 1 día.");
  await escribirConfigValor(CLAVE_VALIDEZ_DIAS, String(Math.round(d.validezDias)));
  await escribirConfigValor(CLAVE_NOMBRE_COMERCIAL, d.nombreComercial.trim());
  await escribirConfigValor(CLAVE_NOTA_PIE, d.notaPie.trim());
  return obtenerDefaultsPresupuesto();
}

/** Los coeficientes con que arranca un presupuesto nuevo: los del último
 *  presupuesto que se hizo (Leticia, 29/10/2026: así no hay que cambiarlos a mano
 *  cada vez, y el que se ajusta en un presupuesto sigue en el próximo). Los
 *  descartados no cuentan. Si todavía no hay ninguno, los de la Configuración. */
async function coeficientesParaPresupuestoNuevo(defaults: DefaultsPresupuesto) {
  const ultimo = (await listarPresupuestos())
    .filter((p) => p.estado !== "descartado")
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  return ultimo
    ? { coefPlacas: ultimo.coefPlacas, coefHerrajes: ultimo.coefHerrajes }
    : { coefPlacas: defaults.coefPlacas, coefHerrajes: defaults.coefHerrajes };
}

/** El cliente con ese nombre (sin distinguir mayúsculas), o uno nuevo sin
 *  proyectos: un presupuesto todavía no es un proyecto. */
async function clientePorNombre(nombre: string): Promise<Cliente> {
  const limpio = nombre.trim();
  if (!limpio) throw new Error("Ingresá el nombre del cliente.");
  const existente = (await listarClientes()).find(
    (c) => c.nombre.trim().toLowerCase() === limpio.toLowerCase()
  );
  if (existente) return existente;
  const cliente: Cliente = { id: randomUUID(), nombre: limpio, creadoEn: new Date().toISOString() };
  await agregarFila(TABS.CLIENTES, [cliente.id, cliente.nombre, cliente.creadoEn]);
  return cliente;
}

export async function crearPresupuesto(datos: {
  clienteId?: string;
  clienteNuevo?: string;
  nombre: string;
  moneda: string;
  archivo: ArchivoLebron;
  usuarioId: string;
}): Promise<Presupuesto> {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("Ingresá un nombre para el presupuesto.");
  let clienteId = datos.clienteId;
  if (clienteId) {
    if (!(await listarClientes()).some((c) => c.id === clienteId)) {
      throw new Error("Cliente no encontrado.");
    }
  } else {
    clienteId = (await clientePorNombre(datos.clienteNuevo ?? "")).id;
  }

  const [lista, defaults] = await Promise.all([listarPrecios(), obtenerDefaultsPresupuesto()]);
  const { coefPlacas, coefHerrajes } = await coeficientesParaPresupuestoNuevo(defaults);
  const contenido: DatosPresupuesto = {
    archivo: datos.archivo,
    precios: preciosParaArchivo(datos.archivo, lista),
    extras: EXTRAS_INICIALES.map((e) => ({ ...e })),
    descuento: 0,
  };
  const ahora = new Date().toISOString();
  const presupuesto: Presupuesto = {
    id: randomUUID(),
    clienteId,
    nombre,
    estado: "borrador",
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    coefPlacas,
    coefHerrajes,
    porModulo: false,
    datos: contenido,
    total: calcularPresupuesto(contenido, coefPlacas, coefHerrajes).total,
    proyectoId: null,
    usuarioId: datos.usuarioId,
    creadoEn: ahora,
    actualizadoEn: ahora,
    tokenPublico: null,
    modeloId: null,
    vistoPrimero: null,
    vistoUltimo: null,
    vistas: 0,
  };
  await agregarFila(TABS.PRESUPUESTOS, filaPresupuesto(presupuesto));
  return presupuesto;
}

export async function actualizarPresupuesto(
  id: string,
  cambios: {
    nombre?: string;
    coefPlacas?: number;
    coefHerrajes?: number;
    porModulo?: boolean;
    /** Precios cambiados en este presupuesto: también quedan en la lista. */
    precios?: { tipo: TipoPrecio; nombre: string; precio: number }[];
    /** Tomar otra vez todos los precios de la lista actual. */
    tomarPreciosDeLaLista?: boolean;
    extras?: Extra[];
    /** Descuento del proveedor, en %. */
    descuento?: number;
    /** Materiales destildados o con otra cantidad, por clavePrecio. */
    materiales?: Record<string, CambioMaterial>;
    /** Artículos de la lista sumados a mano (la lista entera, como queda). */
    agregados?: ArticuloAgregado[];
    /** Nombre y medidas de cada mueble para el cliente, por posición. */
    muebles?: Record<string, CambioMueble>;
    estado?: "borrador" | "descartado";
  },
  usuarioId: string
): Promise<Presupuesto> {
  const p = await obtenerPresupuesto(id);
  if (p.estado === "aceptado") {
    throw new Error(
      "Este presupuesto ya es un proyecto. Los cambios se cargan como Modificación, en Clientes."
    );
  }
  if (cambios.nombre !== undefined) {
    if (!cambios.nombre.trim()) throw new Error("El presupuesto necesita un nombre.");
    p.nombre = cambios.nombre.trim();
  }
  if (cambios.coefPlacas !== undefined) {
    if (!(cambios.coefPlacas > 0)) throw new Error("El coeficiente tiene que ser mayor a 0.");
    p.coefPlacas = cambios.coefPlacas;
  }
  if (cambios.coefHerrajes !== undefined) {
    if (!(cambios.coefHerrajes > 0)) throw new Error("El coeficiente tiene que ser mayor a 0.");
    p.coefHerrajes = cambios.coefHerrajes;
  }
  if (cambios.porModulo !== undefined) p.porModulo = cambios.porModulo;
  if (cambios.extras !== undefined) {
    p.datos.extras = cambios.extras
      .map((e) => ({ concepto: e.concepto.trim(), monto: Math.max(0, e.monto || 0), separado: Boolean(e.separado) }))
      .filter((e) => e.concepto);
  }
  if (cambios.descuento !== undefined) {
    if (!(cambios.descuento >= 0 && cambios.descuento < 100)) {
      throw new Error("El descuento tiene que ser un porcentaje entre 0 y 99.");
    }
    p.datos.descuento = cambios.descuento;
  }
  if (cambios.materiales !== undefined) {
    const limpios: Record<string, CambioMaterial> = {};
    for (const [clave, c] of Object.entries(cambios.materiales)) {
      const cambio: CambioMaterial = {};
      if (c.activo === false) cambio.activo = false;
      if (typeof c.cantidad === "number") {
        if (!(c.cantidad >= 0)) throw new Error("Las cantidades no pueden ser negativas.");
        cambio.cantidad = c.cantidad;
      }
      if (Object.keys(cambio).length > 0) limpios[clave] = cambio;
    }
    p.datos.materiales = limpios;
  }
  if (cambios.agregados !== undefined) {
    const { archivo } = p.datos;
    const yaEstan = new Set([
      ...archivo.placas.map((x) => clavePrecio("placa", x.material)),
      ...archivo.canto.map((x) => clavePrecio("canto", x.material)),
      ...archivo.herrajes.map((x) => clavePrecio("herraje", x.nombre)),
    ]);
    const agregados: ArticuloAgregado[] = [];
    for (const a of cambios.agregados) {
      const nombre = a.nombre.trim();
      if (!nombre) continue;
      const clave = clavePrecio(a.tipo, nombre);
      if (yaEstan.has(clave)) {
        throw new Error(`"${nombre}" ya está en el presupuesto: cambiá la cantidad en su renglón.`);
      }
      if (!(a.cantidad >= 0)) throw new Error("Las cantidades no pueden ser negativas.");
      yaEstan.add(clave);
      agregados.push({ tipo: a.tipo, nombre, cantidad: a.cantidad });
    }
    // Lo recién agregado toma el precio de la lista (como lo que trae LEBRON).
    const sinPrecio = agregados.filter((a) => p.datos.precios[clavePrecio(a.tipo, a.nombre)] === undefined);
    if (sinPrecio.length > 0) {
      const deLaLista = preciosParaArchivo({ ...archivo, placas: [], canto: [], herrajes: [] }, await listarPrecios(), sinPrecio);
      Object.assign(p.datos.precios, deLaLista);
    }
    p.datos.agregados = agregados;
  }
  if (cambios.muebles !== undefined) {
    const limpios: Record<string, CambioMueble> = {};
    for (const [i, c] of Object.entries(cambios.muebles)) {
      const it = p.datos.archivo.items[Number(i)];
      if (!it) continue;
      const cambio: CambioMueble = {};
      const nombre = c.nombre?.trim();
      if (nombre && nombre !== it.nombre) cambio.nombre = nombre;
      if (c.medidas !== undefined && c.medidas.trim() !== it.medidas) cambio.medidas = c.medidas.trim();
      if (Object.keys(cambio).length > 0) limpios[i] = cambio;
    }
    p.datos.muebles = limpios;
  }
  if (cambios.tomarPreciosDeLaLista) {
    p.datos.precios = preciosParaArchivo(p.datos.archivo, await listarPrecios(), p.datos.agregados);
  }
  if (cambios.precios && cambios.precios.length > 0) {
    for (const c of cambios.precios) {
      if (!(c.precio >= 0)) throw new Error(`El precio de ${c.nombre} no es válido.`);
      p.datos.precios[clavePrecio(c.tipo, c.nombre)] = c.precio;
    }
    await guardarPrecios(cambios.precios, usuarioId);
  }
  if (cambios.estado !== undefined) p.estado = cambios.estado;

  p.total = calcularPresupuesto(p.datos, p.coefPlacas, p.coefHerrajes).total;
  p.actualizadoEn = new Date().toISOString();
  await actualizarFilaPorId(TABS.PRESUPUESTOS, p.id, filaPresupuesto(p));
  return p;
}

/** El cliente aceptó: el presupuesto pasa a ser un Proyecto de ese cliente,
 *  con el total como precio (de ahí en adelante, pagos y modificaciones
 *  como siempre, en Clientes). */
export async function aceptarPresupuesto(
  id: string
): Promise<{ presupuesto: Presupuesto; proyecto: Proyecto }> {
  const p = await obtenerPresupuesto(id);
  if (p.estado !== "borrador") {
    throw new Error(
      p.estado === "aceptado" ? "Este presupuesto ya fue aceptado." : "Este presupuesto está descartado."
    );
  }
  const total = calcularPresupuesto(p.datos, p.coefPlacas, p.coefHerrajes).total;
  if (!(total > 0)) throw new Error("El total tiene que ser mayor a 0: cargá los precios.");
  const fecha = new Date(p.creadoEn).toLocaleDateString("es-AR");
  const proyecto = await agregarProyecto(p.clienteId, {
    nombre: p.nombre,
    descripcion: `Presupuesto del ${fecha} (diseño de LEBRON)`,
    moneda: p.moneda,
    precio: total,
  });
  p.estado = "aceptado";
  p.proyectoId = proyecto.id;
  p.total = total;
  p.actualizadoEn = new Date().toISOString();
  await actualizarFilaPorId(TABS.PRESUPUESTOS, p.id, filaPresupuesto(p));
  return { presupuesto: p, proyecto };
}
