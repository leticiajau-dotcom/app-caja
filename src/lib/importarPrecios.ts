// Importar una lista de precios de un proveedor (16/10/2026).
//
// Leticia carga los precios de "Emporio del Terciado" y más adelante quiere
// importar la lista que le pase el proveedor. Una lista es un archivo CSV (lo
// que guarda Excel con "Guardar como > CSV"), con un renglón por artículo.
//
// Cada artículo se reconoce por el CÓDIGO del proveedor: si ya está en la
// lista de precios, se le cambia el precio (y sigue con el nombre de LEBRON que
// ya tenía); si no, entra nuevo. Para que LEBRON lo use (placa, tapacanto,
// herraje) el renglón trae además el nombre con que sale de LEBRON; sin ese
// nombre entra como "otro": queda en la lista con su precio, pero no entra solo
// en ningún presupuesto.
//
// Las columnas se buscan por su título, en cualquier orden y sin importar
// mayúsculas ni acentos. Hacen falta el código y el precio.
//
// Todo acá es cálculo puro: lo usa la pantalla de importar, antes de mandar
// nada, para mostrar qué va a cambiar.

import { clavePrecio, type TipoPrecio } from "./presupuesto";
import type { CambioPrecio, Precio } from "./types";

export interface FilaLista {
  /** Renglón del archivo (el del título es el 1), para los avisos. */
  linea: number;
  codigo: string;
  descripcion: string;
  /** Precio de lista de lo que vende el proveedor (la caja entera, si es una caja). */
  precioLista: number;
  contenido: number;
  /** null = no dice: entra como "otro" si no está ya en la lista. */
  tipo: TipoPrecio | null;
  nombre: string;
  proveedor: string;
}

export interface ErrorDeLinea {
  linea: number;
  motivo: string;
}

export interface CambioImportado {
  cambio: CambioPrecio;
  /** El precio como estaba en la lista; null si es nuevo. */
  antes: Precio | null;
}

export interface PlanImportacion {
  cambian: CambioImportado[];
  nuevos: CambioImportado[];
  iguales: number;
  errores: ErrorDeLinea[];
}

const COLUMNAS: Record<keyof Omit<FilaLista, "linea" | "precioLista">, string[]> & { precio: string[] } = {
  codigo: ["codigo", "cod", "codigo proveedor", "codigo del proveedor", "articulo", "sku"],
  descripcion: ["descripcion", "detalle", "producto", "descripcion proveedor", "en la factura"],
  precio: ["precio", "precio lista", "precio de lista", "precio unitario", "p lista", "p unitario"],
  contenido: ["contenido", "unidades", "cantidad por unidad", "viene de a"],
  tipo: ["tipo"],
  nombre: ["nombre lebron", "nombre en lebron", "en lebron", "lebron"],
  proveedor: ["proveedor"],
};

const TIPOS: Record<string, TipoPrecio> = {
  placa: "placa",
  placas: "placa",
  canto: "canto",
  cantos: "canto",
  tapacanto: "canto",
  tapacantos: "canto",
  herraje: "herraje",
  herrajes: "herraje",
  otro: "otro",
  otros: "otro",
};

/** Para comparar títulos: sin acentos, minúsculas, solo letras y números. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "123.824,34", "123824,34", "1430.28" o "$ 2.460,43" -> el número. En
 *  Argentina la coma es la de los decimales; un punto con 3 cifras atrás
 *  ("123.824") es de miles. NaN si no es un precio. */
export function leerNumero(texto: string): number {
  let t = texto.replace(/[$\s]/g, "");
  if (!t) return NaN;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma >= 0) {
    t = t.split(",").length > 2 ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  return Number(t);
}

/** Separa un renglón de CSV, con campos entre comillas ("6x5/8"" (4x16)"). */
function separarRenglon(renglon: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < renglon.length; i++) {
    const c = renglon[i];
    if (entreComillas) {
      if (c === '"' && renglon[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual.trim());
  return campos;
}

/** Lee el texto del archivo. `proveedor`: el que se usa si el archivo no tiene
 *  esa columna (o la deja vacía). */
export function leerLista(texto: string, proveedor: string): { filas: FilaLista[]; errores: ErrorDeLinea[] } {
  const renglones = texto.replace(/^﻿/, "").split(/\r?\n/);
  const titulo = renglones[0] ?? "";
  // El separador es el que más aparece en el título: Excel en castellano guarda
  // con punto y coma; otros programas, con coma o tabulación.
  const separador = [";", ",", "\t"].reduce((a, b) =>
    titulo.split(b).length > titulo.split(a).length ? b : a
  );
  const titulos = separarRenglon(titulo, separador).map(normalizar);
  const columna = (campo: keyof typeof COLUMNAS) =>
    titulos.findIndex((t) => COLUMNAS[campo].includes(t));
  const col = {
    codigo: columna("codigo"),
    descripcion: columna("descripcion"),
    precio: columna("precio"),
    contenido: columna("contenido"),
    tipo: columna("tipo"),
    nombre: columna("nombre"),
    proveedor: columna("proveedor"),
  };
  if (col.codigo < 0 || col.precio < 0) {
    return {
      filas: [],
      errores: [
        {
          linea: 1,
          motivo:
            'El primer renglón tiene que tener los títulos de las columnas, con al menos "Código" y "Precio".',
        },
      ],
    };
  }

  const filas: FilaLista[] = [];
  const errores: ErrorDeLinea[] = [];
  renglones.slice(1).forEach((renglon, i) => {
    const linea = i + 2;
    if (!renglon.trim()) return;
    const campos = separarRenglon(renglon, separador);
    const valor = (indice: number) => (indice >= 0 ? campos[indice] ?? "" : "");
    const codigo = valor(col.codigo);
    if (!codigo) {
      errores.push({ linea, motivo: "No tiene código." });
      return;
    }
    const precioLista = leerNumero(valor(col.precio));
    if (!(precioLista > 0)) {
      errores.push({ linea, motivo: `${codigo}: el precio "${valor(col.precio)}" no es un número.` });
      return;
    }
    const contenidoTexto = valor(col.contenido);
    const contenido = contenidoTexto ? leerNumero(contenidoTexto) : 1;
    if (!(contenido > 0)) {
      errores.push({ linea, motivo: `${codigo}: el contenido "${contenidoTexto}" no es un número.` });
      return;
    }
    const tipoTexto = normalizar(valor(col.tipo));
    const tipo = tipoTexto ? TIPOS[tipoTexto] ?? null : null;
    if (tipoTexto && !tipo) {
      errores.push({
        linea,
        motivo: `${codigo}: el tipo "${valor(col.tipo)}" no es placa, canto, herraje ni otro.`,
      });
      return;
    }
    filas.push({
      linea,
      codigo,
      descripcion: valor(col.descripcion),
      precioLista,
      contenido,
      tipo,
      nombre: valor(col.nombre),
      proveedor: valor(col.proveedor) || proveedor.trim(),
    });
  });
  return { filas, errores };
}

const claveCodigo = (proveedor: string, codigo: string) =>
  `${normalizar(proveedor)}|${codigo.trim().toLowerCase()}`;

/** Qué va a pasar con la lista de precios si se importan estas filas. */
export function planDeImportacion(filas: FilaLista[], lista: Precio[]): PlanImportacion {
  const porCodigo = new Map(
    lista.filter((p) => p.codigo).map((p) => [claveCodigo(p.proveedor, p.codigo), p])
  );
  const porNombre = new Map(lista.map((p) => [clavePrecio(p.tipo, p.nombre), p]));
  // Si el archivo repite un artículo, vale el último renglón.
  const resultado = new Map<string, CambioImportado>();

  for (const f of filas) {
    let antes = porCodigo.get(claveCodigo(f.proveedor, f.codigo)) ?? null;
    let tipo: TipoPrecio;
    let nombre: string;
    if (antes) {
      // Ya relacionado con LEBRON: sigue con su nombre.
      tipo = antes.tipo;
      nombre = antes.nombre;
    } else if (f.tipo && f.tipo !== "otro" && f.nombre) {
      tipo = f.tipo;
      nombre = f.nombre;
      antes = porNombre.get(clavePrecio(tipo, nombre)) ?? null;
    } else {
      tipo = "otro";
      nombre = f.descripcion || f.codigo;
      antes = porNombre.get(clavePrecio(tipo, nombre)) ?? null;
    }
    const cambio: CambioPrecio = {
      tipo,
      nombre,
      // El precio de la lista va por unidad de LEBRON: una caja de 200
      // tornillos a $4.645,89 es $23,23 cada tornillo.
      precio: Math.round((f.precioLista / f.contenido) * 100) / 100,
      codigo: f.codigo,
      proveedor: f.proveedor,
      descripcion: f.descripcion,
      contenido: f.contenido,
    };
    resultado.set(clavePrecio(tipo, nombre), { cambio, antes });
  }

  const plan: PlanImportacion = { cambian: [], nuevos: [], iguales: 0, errores: [] };
  resultado.forEach((r) => {
    const { cambio, antes } = r;
    if (!antes) {
      plan.nuevos.push(r);
    } else if (
      antes.precio === cambio.precio &&
      antes.codigo === cambio.codigo &&
      antes.proveedor === cambio.proveedor &&
      antes.descripcion === cambio.descripcion &&
      antes.contenido === cambio.contenido
    ) {
      plan.iguales++;
    } else {
      plan.cambian.push(r);
    }
  });
  // Como en la pantalla de Precios: placas, tapacantos, herrajes y otros.
  const ORDEN: TipoPrecio[] = ["placa", "canto", "herraje", "otro"];
  const porNombreDeLebron = (a: CambioImportado, b: CambioImportado) =>
    ORDEN.indexOf(a.cambio.tipo) - ORDEN.indexOf(b.cambio.tipo) || a.cambio.nombre.localeCompare(b.cambio.nombre);
  plan.cambian.sort(porNombreDeLebron);
  plan.nuevos.sort(porNombreDeLebron);
  return plan;
}

/** El texto de un archivo subido: UTF-8, o el de Windows (Excel en castellano
 *  guarda los CSV así, y "Coñac" llegaría como "Co�ac"). */
export function textoDeArchivo(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}
