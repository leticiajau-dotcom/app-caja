import { calcularPresupuesto } from "./presupuesto";
import type { Cliente, Configuracion, DefaultsPresupuesto, Presupuesto } from "./types";

/** Lo que ve el cliente de un presupuesto (la hoja para imprimir y el link
 *  /ver/...): los muebles y el total, o el precio de cada módulo si el
 *  presupuesto lo pide. Nunca los costos, los coeficientes ni los precios de
 *  los materiales. */
export interface HojaCliente {
  nombreComercial: string;
  logoDataUri: string;
  fecha: string;
  cliente: string;
  trabajo: string;
  moneda: string;
  porModulo: boolean;
  items: { nombre: string; medidas: string; cantidad: number; precioUnitario: number; subtotal: number }[];
  muebles: number;
  separados: { concepto: string; monto: number }[];
  total: number;
  validezDias: number;
  notaPie: string;
}

export function armarHojaCliente(
  p: Presupuesto,
  cliente: Cliente | null,
  defaults: DefaultsPresupuesto,
  config: Configuracion | null
): HojaCliente {
  const r = calcularPresupuesto(p.datos, p.coefPlacas, p.coefHerrajes);
  return {
    nombreComercial: defaults.nombreComercial || config?.nombreApp || "",
    logoDataUri: config?.logoDataUri ?? "",
    fecha: p.creadoEn,
    cliente: cliente?.nombre ?? "",
    trabajo: p.nombre,
    moneda: p.moneda,
    porModulo: p.porModulo,
    items: r.items.map((it) => ({
      nombre: it.nombre,
      medidas: it.medidas,
      cantidad: it.cantidad,
      precioUnitario: p.porModulo ? it.precioUnitario : 0,
      subtotal: p.porModulo ? it.subtotal : 0,
    })),
    muebles: r.muebles,
    separados: p.datos.extras
      .filter((e) => e.separado && e.monto > 0)
      .map((e) => ({ concepto: e.concepto, monto: e.monto })),
    total: r.total,
    validezDias: defaults.validezDias,
    notaPie: defaults.notaPie,
  };
}
