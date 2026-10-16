// Presupuestos a partir del archivo que exporta LEBRON (el plugin de SketchUp):
// el botón Presupuesto del panel lo manda directo a esta app.
//
// Cómo presupuesta Leticia: COSTO DE MATERIALES × COEFICIENTE. Hay dos
// coeficientes, uno para placas y tapacantos y otro para herrajes (de entrada
// valen lo mismo). La mano de obra, la colocación y el flete van aparte, sin
// coeficiente.
//
// Los precios de la lista son los de LISTA del proveedor (con IVA). El descuento
// que hace el proveedor cambia en cada compra, así que se carga en cada
// presupuesto (arranca en 0%) y se descuenta del costo antes del coeficiente
// (Leticia, 16/10/2026).
//
// El archivo trae las cantidades de toda la obra (las placas ya vienen del
// optimizador de LEBRON, el canto redondeado como se compra) y, por cada
// módulo, la superficie de placa que usa de cada material, su canto y sus
// herrajes. Con eso se arma el "precio por módulo": el costo REAL de la obra
// se reparte entre los módulos según lo que usa cada uno, así la suma de los
// módulos da exactamente el total (sin porcentaje agregado).
//
// Todo acá es cálculo puro (sin Google Sheets): lo usan el servidor, la
// pantalla y las pruebas.

import { z } from "zod";

export const FORMATO_ARCHIVO_LEBRON = "lebron-presupuesto";

const NumeroPorNombre = z.record(z.string(), z.number());

const ArchivoLebronSchema = z.object({
  formato: z.literal(FORMATO_ARCHIVO_LEBRON),
  version: z.number(),
  cliente: z.string().default(""),
  generado: z.string().default(""),
  version_plugin: z.string().optional(),
  placas_optimizadas: z.boolean().default(true),
  placas: z.array(z.object({ material: z.string(), placas: z.number() })),
  canto: z.array(z.object({ material: z.string(), metros: z.number(), mm: z.number().optional() })),
  herrajes: z.array(z.object({ nombre: z.string(), cantidad: z.number() })),
  items: z
    .array(
      z.object({
        nombre: z.string(),
        detalle: z.string().default(""),
        medidas: z.string().default(""),
        cantidad: z.number().int().positive(),
        placas_mm2: NumeroPorNombre.default({}),
        canto_mm: NumeroPorNombre.default({}),
        herrajes: NumeroPorNombre.default({}),
      })
    )
    .min(1),
  avisos: z.array(z.string()).default([]),
});

export type ArchivoLebron = z.infer<typeof ArchivoLebronSchema>;
export type ItemLebron = ArchivoLebron["items"][number];

/** Lee el texto del archivo .json que exporta LEBRON. Si no es un archivo de
 *  presupuesto de LEBRON, el error lo dice con palabras. */
export function leerArchivoLebron(texto: string): ArchivoLebron {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no se pudo leer: no es un archivo de LEBRON.");
  }
  const formato = (crudo as { formato?: unknown } | null)?.formato;
  if (formato !== FORMATO_ARCHIVO_LEBRON) {
    throw new Error(
      "Ese no es el archivo para presupuestar. En LEBRON se arma con el botón Presupuesto del panel."
    );
  }
  const r = ArchivoLebronSchema.safeParse(crudo);
  if (!r.success) {
    throw new Error("El archivo de LEBRON está incompleto o es de una versión que esta app no conoce.");
  }
  return r.data;
}

/** "otro": un artículo del proveedor que LEBRON no cuenta (el corte, un
 *  revestimiento, el pegamento...). Queda en la lista con su código, para tener
 *  el precio a mano, pero nunca entra solo en un presupuesto. */
export type TipoPrecio = "placa" | "canto" | "herraje" | "otro";

/** Clave de un precio: el tipo y el nombre tal como sale de LEBRON. */
export function clavePrecio(tipo: TipoPrecio, nombre: string) {
  return `${tipo}|${nombre.trim().toLowerCase()}`;
}

/** Mano de obra, colocación, flete...: van aparte, sin coeficiente.
 *  `separado`: en la hoja del cliente sale como un renglón propio; si no, va
 *  sumado dentro del precio de los muebles (y por módulo, repartido según el
 *  precio de cada uno). */
export interface Extra {
  concepto: string;
  monto: number;
  separado: boolean;
}

export const EXTRAS_INICIALES: Extra[] = [
  { concepto: "Mano de obra", monto: 0, separado: false },
  { concepto: "Colocación", monto: 0, separado: true },
  { concepto: "Flete", monto: 0, separado: true },
];

/** Lo que se guarda de un presupuesto, además de sus datos sueltos (nombre,
 *  coeficientes, etc.): el archivo de LEBRON, los precios unitarios que se
 *  usaron (quedan fijos aunque después cambie la lista) y los extras. */
export interface DatosPresupuesto {
  archivo: ArchivoLebron;
  /** clavePrecio(tipo, nombre) -> precio unitario (placa entera, metro, unidad). */
  precios: Record<string, number>;
  extras: Extra[];
  /** Descuento del proveedor, en %, sobre placas, tapacantos y herrajes. Los
   *  presupuestos de antes del 16/10/2026 no lo tienen: 0. */
  descuento?: number;
}

export interface LineaMaterial {
  tipo: TipoPrecio;
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  sinPrecio: boolean;
}

export interface PrecioDeItem {
  nombre: string;
  detalle: string;
  medidas: string;
  cantidad: number;
  /** Costo de materiales de la línea entera (todas las unidades), sin coeficiente. */
  costoPlacasCanto: number;
  costoHerrajes: number;
  /** Precio de la línea entera: materiales × coeficientes + su parte de los
   *  extras que van dentro de los muebles. Redondeado a pesos enteros. */
  subtotal: number;
  precioUnitario: number;
}

export interface ResultadoPresupuesto {
  lineas: LineaMaterial[];
  /** El % de descuento del proveedor que se usó, y cuánta plata es. */
  descuento: number;
  descuentoMonto: number;
  /** Costo de los materiales ya con el descuento del proveedor. */
  costoPlacasCanto: number;
  costoHerrajes: number;
  /** Materiales con sus coeficientes. */
  materiales: number;
  /** Extras sumados dentro de los muebles / en renglón propio. */
  extrasIncluidos: number;
  extrasSeparados: number;
  /** Lo que se le muestra al cliente como "muebles": materiales + extras incluidos. */
  muebles: number;
  total: number;
  faltanPrecios: number;
  items: PrecioDeItem[];
}

const redondear = (v: number) => Math.round(v);

/** Reparte `monto` según los pesos (enteros o no). Sin ningún peso positivo,
 *  según `respaldo`. Devuelve la parte de cada uno, en el mismo orden. */
function repartir(monto: number, pesos: number[], respaldo: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma > 0) return pesos.map((p) => (monto * p) / suma);
  const sumaRespaldo = respaldo.reduce((a, b) => a + b, 0);
  if (sumaRespaldo > 0) return respaldo.map((p) => (monto * p) / sumaRespaldo);
  return pesos.map(() => monto / Math.max(pesos.length, 1));
}

/** Redondea cada parte a pesos enteros sin que la suma cambie: la diferencia
 *  del redondeo la absorbe la parte más grande. */
function redondearSinPerder(partes: number[], totalRedondeado: number): number[] {
  const redondeadas = partes.map(redondear);
  const diferencia = totalRedondeado - redondeadas.reduce((a, b) => a + b, 0);
  if (diferencia !== 0 && redondeadas.length > 0) {
    let mayor = 0;
    redondeadas.forEach((v, i) => {
      if (v > redondeadas[mayor]) mayor = i;
    });
    redondeadas[mayor] += diferencia;
  }
  return redondeadas;
}

export function calcularPresupuesto(
  datos: DatosPresupuesto,
  coefPlacas: number,
  coefHerrajes: number
): ResultadoPresupuesto {
  const { archivo, precios } = datos;
  const precioDe = (tipo: TipoPrecio, nombre: string) => precios[clavePrecio(tipo, nombre)];

  const lineas: LineaMaterial[] = [];
  const agregar = (tipo: TipoPrecio, nombre: string, cantidad: number, unidad: string) => {
    const precio = precioDe(tipo, nombre);
    const precioUnitario = typeof precio === "number" && precio > 0 ? precio : 0;
    lineas.push({
      tipo,
      nombre,
      cantidad,
      unidad,
      precioUnitario,
      subtotal: cantidad * precioUnitario,
      sinPrecio: precioUnitario === 0,
    });
  };
  archivo.placas.forEach((p) => agregar("placa", p.material, p.placas, p.placas === 1 ? "placa" : "placas"));
  archivo.canto.forEach((c) => agregar("canto", c.material, c.metros, "m"));
  archivo.herrajes.forEach((h) => agregar("herraje", h.nombre, h.cantidad, "u."));

  const sumar = (filtro: (l: LineaMaterial) => boolean) =>
    lineas.filter(filtro).reduce((a, l) => a + l.subtotal, 0);
  const descuento = Math.min(Math.max(datos.descuento ?? 0, 0), 100);
  const neto = 1 - descuento / 100;
  const listaPlacasCanto = sumar((l) => l.tipo !== "herraje");
  const listaHerrajes = sumar((l) => l.tipo === "herraje");
  const costoPlacasCanto = listaPlacasCanto * neto;
  const costoHerrajes = listaHerrajes * neto;
  const materiales = redondear(costoPlacasCanto * coefPlacas + costoHerrajes * coefHerrajes);

  const extras = datos.extras.filter((e) => e.monto > 0);
  const extrasIncluidos = redondear(extras.filter((e) => !e.separado).reduce((a, e) => a + e.monto, 0));
  const extrasSeparados = redondear(extras.filter((e) => e.separado).reduce((a, e) => a + e.monto, 0));
  const muebles = materiales + extrasIncluidos;

  // --- Precio por módulo: el costo real de la obra repartido ---------------
  const items = archivo.items;
  // Superficie total de placa de cada módulo (todas sus unidades): el respaldo
  // cuando algo de la obra no está en ningún módulo.
  const superficie = items.map(
    (it) => Object.values(it.placas_mm2).reduce((a, b) => a + b, 0) * it.cantidad
  );
  const placasCanto = items.map(() => 0);
  const herrajes = items.map(() => 0);
  for (const l of lineas) {
    if (l.subtotal === 0) continue;
    const pesos = items.map((it) => {
      const tabla = l.tipo === "placa" ? it.placas_mm2 : l.tipo === "canto" ? it.canto_mm : it.herrajes;
      return (tabla[l.nombre] ?? 0) * it.cantidad;
    });
    const partes = repartir(l.subtotal * neto, pesos, superficie);
    partes.forEach((parte, i) => {
      if (l.tipo === "herraje") herrajes[i] += parte;
      else placasCanto[i] += parte;
    });
  }
  const conCoef = items.map((_, i) => placasCanto[i] * coefPlacas + herrajes[i] * coefHerrajes);
  const extrasPorItem = repartir(extrasIncluidos, conCoef, superficie);
  const subtotales = redondearSinPerder(
    conCoef.map((v, i) => v + extrasPorItem[i]),
    muebles
  );

  return {
    lineas,
    descuento,
    descuentoMonto: listaPlacasCanto + listaHerrajes - costoPlacasCanto - costoHerrajes,
    costoPlacasCanto,
    costoHerrajes,
    materiales,
    extrasIncluidos,
    extrasSeparados,
    muebles,
    total: muebles + extrasSeparados,
    faltanPrecios: lineas.filter((l) => l.sinPrecio).length,
    items: items.map((it, i) => ({
      nombre: it.nombre,
      detalle: it.detalle,
      medidas: it.medidas,
      cantidad: it.cantidad,
      costoPlacasCanto: placasCanto[i],
      costoHerrajes: herrajes[i],
      subtotal: subtotales[i],
      precioUnitario: subtotales[i] / it.cantidad,
    })),
  };
}

/** Los precios de la lista para todo lo que trae el archivo (lo que no está
 *  en la lista queda sin precio, para cargarlo en el presupuesto). */
export function preciosParaArchivo(
  archivo: ArchivoLebron,
  lista: { tipo: TipoPrecio; nombre: string; precio: number }[]
): Record<string, number> {
  const porClave = new Map(lista.map((p) => [clavePrecio(p.tipo, p.nombre), p.precio]));
  const precios: Record<string, number> = {};
  const tomar = (tipo: TipoPrecio, nombre: string) => {
    const clave = clavePrecio(tipo, nombre);
    precios[clave] = porClave.get(clave) ?? 0;
  };
  archivo.placas.forEach((p) => tomar("placa", p.material));
  archivo.canto.forEach((c) => tomar("canto", c.material));
  archivo.herrajes.forEach((h) => tomar("herraje", h.nombre));
  return precios;
}
