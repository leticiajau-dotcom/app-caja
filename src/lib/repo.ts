import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  TABS,
  agregarFila,
  actualizarFilaPorId,
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
  Movimiento,
  Proyecto,
  Resumen,
  Rol,
  SaldoCuenta,
  SaldoGrupoResponsables,
  TipoMovimiento,
  Usuario,
} from "./types";

const toBool = (v: string) => v === "true" || v === "TRUE" || v === "1";
const toNum = (v: string) => (v === "" ? 0 : Number(v));

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
      fecha: cuenta.creadoEn.slice(0, 10),
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
    moneda: r.moneda || "ARS",
    precio: toNum(r.precio),
    creadoEn: r.creadoEn,
  };
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
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    precio: datos.precio || 0,
    creadoEn: cliente.creadoEn,
  };
  await agregarFila(TABS.PROYECTOS, [
    proyecto.id,
    proyecto.clienteId,
    proyecto.nombre,
    proyecto.moneda,
    proyecto.precio,
    proyecto.creadoEn,
  ]);

  return { cliente, proyecto };
}

/** Agrega un proyecto nuevo a un cliente ya existente. */
export async function agregarProyecto(
  clienteId: string,
  datos: { nombre: string; moneda: string; precio: number }
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
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    precio: datos.precio || 0,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.PROYECTOS, [
    proyecto.id,
    proyecto.clienteId,
    proyecto.nombre,
    proyecto.moneda,
    proyecto.precio,
    proyecto.creadoEn,
  ]);
  return proyecto;
}
