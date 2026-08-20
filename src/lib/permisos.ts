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
