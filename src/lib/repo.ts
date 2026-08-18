import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  TABS,
  agregarFila,
  actualizarFilaPorId,
  leerFilas,
} from "./googleSheets";
import type {
  ArqueoMoneda,
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
    moneda: r.moneda || "ARS",
    usuarioResponsableId: r.usuarioResponsableId || null,
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
  moneda: string;
  usuarioResponsableId: string | null;
  saldoInicial: number;
}): Promise<Cuenta> {
  const cuenta: Cuenta = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    tipo: datos.tipo,
    moneda: datos.moneda.trim().toUpperCase() || "ARS",
    usuarioResponsableId: datos.usuarioResponsableId,
    saldoInicial: datos.saldoInicial || 0,
    activa: true,
    creadoEn: new Date().toISOString(),
  };
  await agregarFila(TABS.CUENTAS, [
    cuenta.id,
    cuenta.nombre,
    cuenta.tipo,
    cuenta.moneda,
    cuenta.usuarioResponsableId ?? "",
    cuenta.saldoInicial,
    String(cuenta.activa),
    cuenta.creadoEn,
  ]);
  return cuenta;
}

export async function actualizarCuenta(
  id: string,
  cambios: Partial<
    Pick<
      Cuenta,
      "nombre" | "tipo" | "moneda" | "usuarioResponsableId" | "activa"
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
    actualizada.moneda,
    actualizada.usuarioResponsableId ?? "",
    actualizada.saldoInicial,
    String(actualizada.activa),
    actualizada.creadoEn,
  ]);
  return actualizada;
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
  };
}

export async function listarMovimientos(): Promise<Movimiento[]> {
  const rows = await leerFilas<Record<string, string>>(TABS.MOVIMIENTOS);
  return rows
    .map(rowToMovimiento)
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
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
  };
  await agregarFila(TABS.MOVIMIENTOS, [
    movimiento.id,
    movimiento.fecha,
    movimiento.tipo,
    movimiento.cuentaId,
    movimiento.cuentaDestinoId ?? "",
    movimiento.monto,
    movimiento.categoria,
    movimiento.descripcion,
    movimiento.usuarioId,
    movimiento.creadoEn,
  ]);
  return movimiento;
}

// ---------------------------------------------------------------------------
// Saldos y arqueo
// ---------------------------------------------------------------------------

/** Calcula el saldo de cada cuenta a partir del saldo inicial + movimientos. */
export function calcularSaldosPorCuenta(
  cuentas: Cuenta[],
  movimientos: Movimiento[]
): SaldoCuenta[] {
  const saldos = new Map<string, number>();
  for (const c of cuentas) saldos.set(c.id, c.saldoInicial);

  for (const m of movimientos) {
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
      if (cuenta.usuarioResponsableId === usuario.id) {
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
