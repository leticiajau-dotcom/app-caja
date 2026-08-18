"use client";

import { useState, useEffect } from "react";
import { formatearMilesEnVivo, desformatearMiles } from "@/lib/format";

interface Props {
  value: number;
  onChange: (valor: number) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/** Input de monto que muestra separador de miles ("1.234,50") a medida que
 *  se escribe, y siempre entrega un número limpio hacia afuera. */
export default function MoneyInput({
  value,
  onChange,
  required,
  placeholder,
  className,
}: Props) {
  const [texto, setTexto] = useState(value ? String(value).replace(".", ",") : "");

  // Si el valor cambia desde afuera (ej. se resetea el formulario), lo reflejamos.
  useEffect(() => {
    if (value === 0 && texto !== "") return; // no pisar mientras el usuario escribe un 0,xx
    const actual = desformatearMiles(texto);
    if (actual !== value) {
      setTexto(value ? formatearMilesEnVivo(String(value).replace(".", ",")) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      className={className ?? "input"}
      inputMode="decimal"
      placeholder={placeholder}
      required={required}
      value={texto}
      onChange={(e) => {
        const formateado = formatearMilesEnVivo(e.target.value);
        setTexto(formateado);
        onChange(desformatearMiles(formateado));
      }}
    />
  );
}
