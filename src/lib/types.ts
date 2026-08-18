// Tipos de dominio para la app de control de caja.

export type Rol = "admin" | "empleado";

export interface Usuario {
  id: string;
  nombre: string;
  pinHash: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

/** Tipo de cuenta. El usuario puede crear las que necesite; estas son sugerencias iniciales. */
export type TipoCuenta =
  | "efectivo"
  | "banco"
  | "billetera_virtual"
  | "dolares"
  | "otra";

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: string; // ej: ARS, USD, EUR
  usuarioResponsableId: string | null; // quién "tiene" la cuenta / es responsable
  saldoInicial: number;
  activa: boolean;
  creadoEn: string;
}

export type TipoMovimiento = "ingreso" | "egreso" | "transferencia";

export interface Movimiento {
  id: string;
  fecha: string; // ISO date (yyyy-mm-dd)
  tipo: TipoMovimiento;
  cuentaId: string;
  // Para transferencias: cuenta que recibe los fondos.
  cuentaDestinoId: string | null;
  monto: number; // siempre positivo, el signo lo da "tipo"
  categoria: string;
  descripcion: string;
  usuarioId: string; // quién registró el movimiento
  creadoEn: string;
}

export interface SaldoCuenta {
  cuenta: Cuenta;
  saldo: number;
}

export interface SaldoUsuario {
  usuario: Usuario;
  // saldo de las cuentas de las que ese usuario es responsable, agrupado por moneda
  porMoneda: Record<string, number>;
}

export interface ArqueoMoneda {
  moneda: string;
  total: number;
  cuentas: SaldoCuenta[];
}

export interface Resumen {
  saldosPorCuenta: SaldoCuenta[];
  saldosPorUsuario: SaldoUsuario[];
  arqueoPorMoneda: ArqueoMoneda[];
}

export interface SesionInterna {
  usuarioId: string;
  nombre: string;
  rol: Rol;
}
