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

export const TIPOS_CUENTA: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Cuenta bancaria" },
  { value: "billetera_virtual", label: "Billetera virtual" },
  { value: "dolares", label: "Cuenta en dólares" },
  { value: "otra", label: "Otra" },
];
