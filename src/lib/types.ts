// Tipos de dominio para la app de control de caja.

/** admin: gestiona cuentas/usuarios y opera como cualquier responsable.
 *  socio: mismos permisos que tenía "empleado" antes de este cambio —
 *  opera las cuentas de las que es responsable, ve todos los movimientos
 *  y el resumen general.
 *  empleado: rol acotado — en "Resumen" solo ve sus propias cuentas como
 *  responsable (nada del resto de la caja), en "Movimientos" solo ve los
 *  que él mismo cargó, y no tiene acceso a "Cuentas" ni "Usuarios". */
export type Rol = "admin" | "socio" | "empleado";

export interface Usuario {
  id: string;
  nombre: string;
  pinHash: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export interface Cuenta {
  id: string;
  nombre: string;
  moneda: string; // ej: ARS, USD, EUR
  /** Quiénes son responsables de la cuenta (pueden cargarle movimientos).
   *  Toda cuenta nueva o editada debe tener al menos uno (se valida al
   *  crear/editar). Puede haber cuentas viejas, de antes de esta regla,
   *  que todavía tengan la lista vacía hasta que un admin les asigne uno. */
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

/** Saldo agrupado por la combinación exacta de responsables de una o más
 *  cuentas (ej: cuentas de "Leticia" sola, cuentas de "Pablo" solo, y por
 *  separado las cuentas donde ambos son responsables en conjunto). Las
 *  cuentas activas sin responsable asignado forman su propio grupo
 *  ("Sin responsable asignado") para no perderse del resumen. */
export interface SaldoGrupoResponsables {
  usuarioIds: string[];
  /** Nombres de los responsables unidos, ej: "Leticia - Pablo". */
  etiqueta: string;
  porMoneda: Record<string, number>;
  /** Las cuentas del grupo, agrupadas a su vez por moneda (para poder listar
   *  cada cuenta debajo del subtotal de su grupo + moneda). */
  cuentasPorMoneda: Record<string, SaldoCuenta[]>;
}

export interface ArqueoMoneda {
  moneda: string;
  total: number;
  cuentas: SaldoCuenta[];
}

export interface Resumen {
  saldosPorCuenta: SaldoCuenta[];
  saldosPorGrupoResponsable: SaldoGrupoResponsables[];
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
