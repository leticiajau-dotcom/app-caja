import type { Cuenta, TipoCuenta } from "./types";

export function formatMoney(valor: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda,
      currencyDisplay: moneda === "ARS" ? "symbol" : "code",
    }).format(valor);
  } catch {
    // Moneda no reconocida por Intl (ej. billeteras propias): mostramos el
    // código a mano.
    return `${moneda} ${valor.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function formatFecha(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR");
}

export const TIPOS_CUENTA: { value: TipoCuenta; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Cuenta bancaria" },
  { value: "billetera_virtual", label: "Billetera virtual" },
  { value: "otra", label: "Otra" },
];

/** Nombre a mostrar para el tipo de una cuenta, respetando el nombre libre
 *  cuando el tipo es "otra", y con un texto razonable para cuentas viejas
 *  que hayan quedado con el tipo "dolares" (ya no se puede elegir, pero
 *  puede existir en datos cargados antes de este cambio). */
export function tipoCuentaLabel(cuenta: Pick<Cuenta, "tipo" | "tipoPersonalizado">) {
  if (cuenta.tipo === "otra") {
    return cuenta.tipoPersonalizado?.trim() || "Otra";
  }
  if ((cuenta.tipo as string) === "dolares") {
    return "Cuenta en dólares";
  }
  return TIPOS_CUENTA.find((t) => t.value === cuenta.tipo)?.label ?? cuenta.tipo;
}

export const MONEDAS_SUGERIDAS = [
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
];

const SIMBOLOS_MONEDA: Record<string, string> = {
  ARS: "$",
  USD: "U$D",
  EUR: "€",
  BRL: "R$",
};

export function simboloMoneda(moneda: string) {
  return SIMBOLOS_MONEDA[moneda] ?? moneda;
}

/** Formatea un número a texto con separador de miles (punto) mientras se
 *  escribe, sin forzar decimales todavía (para no pelear con el cursor). */
export function formatearMilesEnVivo(valorCrudo: string) {
  const limpio = valorCrudo.replace(/[^\d,]/g, "");
  const [entero, decimales] = limpio.split(",");
  const enteroFormateado = (entero || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales !== undefined
    ? `${enteroFormateado},${decimales.slice(0, 2)}`
    : enteroFormateado;
}

/** Convierte el texto formateado ("1.234,50") de vuelta a número (1234.5). */
export function desformatearMiles(valorFormateado: string): number {
  const normalizado = valorFormateado.replace(/\./g, "").replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/** Paleta visual por moneda para las tarjetas de arqueo del resumen.
 *  Clases de Tailwind escritas literalmente (no armadas dinámicamente) para
 *  que el compilador de Tailwind las detecte siempre. */
export interface TemaMoneda {
  cardBg: string;
  textoFuerte: string;
  textoSuave: string;
  circuloBg: string;
  circuloTexto: string;
  walletBg: string;
  walletTexto: string;
}

const TEMAS_CONOCIDOS: Record<string, TemaMoneda> = {
  ARS: {
    cardBg: "bg-gradient-to-br from-violet-50 to-purple-100",
    textoFuerte: "text-purple-950",
    textoSuave: "text-purple-700",
    circuloBg: "bg-white",
    circuloTexto: "text-purple-600",
    walletBg: "bg-purple-200",
    walletTexto: "text-purple-700",
  },
  USD: {
    cardBg: "bg-gradient-to-br from-sky-50 to-blue-100",
    textoFuerte: "text-blue-950",
    textoSuave: "text-blue-700",
    circuloBg: "bg-white",
    circuloTexto: "text-blue-600",
    walletBg: "bg-blue-200",
    walletTexto: "text-blue-700",
  },
  EUR: {
    cardBg: "bg-gradient-to-br from-emerald-50 to-green-100",
    textoFuerte: "text-green-950",
    textoSuave: "text-green-700",
    circuloBg: "bg-white",
    circuloTexto: "text-green-600",
    walletBg: "bg-green-200",
    walletTexto: "text-green-700",
  },
  BRL: {
    cardBg: "bg-gradient-to-br from-amber-50 to-orange-100",
    textoFuerte: "text-orange-950",
    textoSuave: "text-orange-700",
    circuloBg: "bg-white",
    circuloTexto: "text-orange-600",
    walletBg: "bg-orange-200",
    walletTexto: "text-orange-700",
  },
};

const TEMAS_ALTERNATIVOS: TemaMoneda[] = [
  {
    cardBg: "bg-gradient-to-br from-rose-50 to-pink-100",
    textoFuerte: "text-pink-950",
    textoSuave: "text-pink-700",
    circuloBg: "bg-white",
    circuloTexto: "text-pink-600",
    walletBg: "bg-pink-200",
    walletTexto: "text-pink-700",
  },
  {
    cardBg: "bg-gradient-to-br from-teal-50 to-cyan-100",
    textoFuerte: "text-teal-950",
    textoSuave: "text-teal-700",
    circuloBg: "bg-white",
    circuloTexto: "text-teal-600",
    walletBg: "bg-teal-200",
    walletTexto: "text-teal-700",
  },
];

export function temaDeMoneda(moneda: string): TemaMoneda {
  if (TEMAS_CONOCIDOS[moneda]) return TEMAS_CONOCIDOS[moneda];
  let hash = 0;
  for (let i = 0; i < moneda.length; i++) hash = (hash * 31 + moneda.charCodeAt(i)) >>> 0;
  return TEMAS_ALTERNATIVOS[hash % TEMAS_ALTERNATIVOS.length];
}
