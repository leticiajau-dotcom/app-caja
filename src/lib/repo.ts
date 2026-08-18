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
import type {
  ArqueoMoneda,
  Configuracion,
  Cuenta,
  Movimiento,
  Resumen,
  Rol,
  SaldoCuenta,
  SaldoUsuario,
  TipoCuenta,
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
  };
}

export async function listarUsuarios(): Promise<Usuario[]> {
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
  };
  await agregarFila(TABS.USUARIOS, [
    usuario.id,
    usuario.nombre,
    usuario.pinHash,
    usuario.rol,
    String(usuario.activo),
    usuario.creadoEn,
  ]);
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
  await actualizarFilaPorId(TABS.USUARIOS, id, [
    actualizado.id,
    actualizado.nombre,
    actualizado.pinHash,
    actualizado.rol,
    String(actualizado.activo),
    actualizado.creadoEn,
  ]);
  return actualizado;
}

export async function verificarPin(nombre: string, pin: string) {
  const usuario = await buscarUsuarioPorNombre(nombre);
  if (!usuario || !usuario.activo) return null;
  const ok = bcrypt.compareSync(pin, usuario.pinHash);
  return ok ? usuario : null;
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

function rowToCuenta(r: Record<string, string>): Cuenta {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: (r.tipo as TipoCuenta) || "otra",
    tipoPersonalizado: r.tipoPersonalizado || null,
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
  tipo: TipoCuenta;
  tipoPersonalizado?: string | null;
  moneda: string;
  usuarioResponsablesIds: string[];
  saldoInicial: number;
  /** Quién la está creando: si hay saldo inicial, queda registrado como el
   *  usuario que cargó el movimiento de apertura. */
  usuarioId: string;
}): Promise<Cuenta> {
  const cuenta: Cuenta = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    tipo: datos.tipo,
    tipoPersonalizado:
      datos.tipo === "otra" ? (datos.tipoPersonalizado?.trim() || null) : null,
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    usuarioResponsablesIds: datos.usuarioResponsablesIds,
    saldoInicial: datos.saldoInicial || 0,
    activa: true,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.CUENTAS, [
    cuenta.id,
    cuenta.nombre,
    cuenta.tipo,
    cuenta.tipoPersonalizado ?? "",
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
    Pick<
      Cuenta,
      | "nombre"
      | "tipo"
      | "tipoPersonalizado"
      | "moneda"
      | "usuarioResponsablesIds"
      | "activa"
    >
  >
) {
  const cuentas = await listarCuentas();
  const actual = cuentas.find((c) => c.id === id);
  if (!actual) throw new Error("Cuenta no encontrada.");
  const actualizada: Cuenta = { ...actual, ...cambios };
  await actualizarFilaPorId(TABS.CUENTAS, id, [
    actualizada.id,
    actualizada.nombre,
    actualizada.tipo,
    actualizada.tipoPersonalizado ?? "",
    actualizada.moneda,
    actualizada.usuarioResponsablesIds.join(","),
    actualizada.saldoInicial,
    String(actualizada.activa),
    actualizada.creadoEn,
  ]);
  return actualizada;
}

/** Un admin puede cargar movimientos en cualquier cuenta. Un empleado solo
 *  en las cuentas de las que él es uno de los responsables — ni en las de
 *  otro responsable, ni en las que no tienen ninguno asignado (esas quedan
 *  reservadas para un admin, hasta que se les asigne alguien). */
export async function usuarioPuedeOperarCuenta(
  sesion: { usuarioId: string; rol: Rol },
  cuentaId: string
): Promise<boolean> {
  if (sesion.rol === "admin") return true;
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
    } else if (m.tipo === "egreso") {
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

export function calcularSaldosPorUsuario(
  usuarios: Usuario[],
  saldosPorCuenta: SaldoCuenta[]
): SaldoUsuario[] {
  return usuarios.map((usuario) => {
    const porMoneda: Record<string, number> = {};
    for (const { cuenta, saldo } of saldosPorCuenta) {
      if (cuenta.usuarioResponsablesIds.includes(usuario.id)) {
        porMoneda[cuenta.moneda] = (porMoneda[cuenta.moneda] ?? 0) + saldo;
      }
    }
    return { usuario, porMoneda };
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
  const saldosPorUsuario = calcularSaldosPorUsuario(usuarios, saldosPorCuenta);
  const arqueoPorMoneda = calcularArqueoPorMoneda(saldosPorCuenta);
  return { saldosPorCuenta, saldosPorUsuario, arqueoPorMoneda };
}
