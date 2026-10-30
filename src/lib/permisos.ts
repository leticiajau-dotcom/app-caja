// Reglas de qué puede ver/hacer cada rol, centralizadas acá para no
// repetir la misma condición en el menú de arriba, el menú inferior
// mobile, el swipe y cada pantalla.
import type { Rol } from "./types";

/** Admin y socio ven la pantalla "Cuentas" (aunque solo el admin puede
 *  crear/editar). El empleado (rol acotado) no la ve. */
export function puedeVerCuentas(rol: Rol): boolean {
  return rol !== "empleado";
}

/** Solo el admin gestiona usuarios. */
export function puedeVerUsuarios(rol: Rol): boolean {
  return rol === "admin";
}

/** Admin y socio ven y gestionan "Clientes" (proyectos e importes). El
 *  empleado (rol acotado) no la ve. */
export function puedeVerClientes(rol: Rol): boolean {
  return rol !== "empleado";
}

/** El empleado (rol acotado) solo ve, en "Resumen", el/los grupo(s) donde
 *  él mismo es responsable — nunca el resumen general de la caja. */
export function puedeVerResumenGeneral(rol: Rol): boolean {
  return rol !== "empleado";
}

/** El empleado (rol acotado) solo ve, en "Movimientos", los que él mismo
 *  cargó. Admin y socio siguen viendo todos. */
export function soloVeSusPropiosMovimientos(rol: Rol): boolean {
  return rol === "empleado";
}

/** El empleado (rol acotado) solo puede registrar egresos (ni ingresos ni
 *  transferencias). Admin y socio no tienen esta restricción. */
export function soloPuedeRegistrarEgresos(rol: Rol): boolean {
  return rol === "empleado";
}

/** Solo admin y socio pueden registrar (y figurar como) retiros. */
export function puedeRegistrarRetiros(rol: Rol): boolean {
  return rol === "admin" || rol === "socio";
}

/** Presupuestos y lista de precios: admin y socio (Leticia, 11/10/2026). El
 *  empleado no los ve. */
export function puedeVerPresupuestos(rol: Rol): boolean {
  return rol === "admin" || rol === "socio";
}

/** Empleados (sueldos): admin y socio, igual que Clientes. El empleado no
 *  ve esta pantalla ni puede imputar egresos como sueldo. */
export function puedeVerEmpleados(rol: Rol): boolean {
  return rol !== "empleado";
}
