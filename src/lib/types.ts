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

/** Tipo de cuenta. "otra" permite un nombre libre en tipoPersonalizado. */
export type TipoCuenta = "efectivo" | "banco" | "billetera_virtual" | "otra";

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  /** Solo tiene sentido cuando tipo === "otra": nombre libre elegido por el usuario. */
  tipoPersonalizado: string | null;
  moneda: string; // ej: ARS, USD, EUR
  /** Quiénes son responsables de la cuenta (pueden cargarle movimientos).
   *  Vacío = sin responsables asignados (solo un admin puede operarla). */
  usuarioResponsablesIds: string[];
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

  // --- Rectificaciones / auditoría ---
  /** Si es true, este movimiento NO se cuenta en los saldos: fue anulado por un error de carga. */
  anulado: boolean;
  anuladoPorId: string | null;
  anuladoEn: string | null;
  notaAnulacion: string | null;
  /** Si este movimiento es la corrección de otro, acá va el id del movimiento anulado que reemplaza. */
  movimientoOrigenId: string | null;
  /** Registro del saldo inicial cargado al crear la cuenta: queda visible en
   *  el historial para trazabilidad, pero no se vuelve a sumar al saldo
   *  (ese importe ya se cuenta a través de Cuenta.saldoInicial). */
  esAperturaSaldo: boolean;
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

export interface Configuracion {
  nombreApp: string;
  /** Data URI (base64) de un logo chico, o cadena vacía si no hay logo cargado. */
  logoDataUri: string;
}
