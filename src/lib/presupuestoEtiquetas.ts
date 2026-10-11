import type { EstadoPresupuesto } from "./types";

/** Cómo se muestra el estado de un presupuesto (lista y pantalla del presupuesto). */
export const ETIQUETA_ESTADO: Record<EstadoPresupuesto, { texto: string; clase: string }> = {
  borrador: { texto: "En armado", clase: "bg-amber-100 text-amber-800" },
  aceptado: { texto: "Aceptado", clase: "bg-green-100 text-green-800" },
  descartado: { texto: "Descartado", clase: "bg-madera-100 text-madera-500" },
};
