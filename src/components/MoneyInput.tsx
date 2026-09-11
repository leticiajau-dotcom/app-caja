"use client";

import { useState, useEffect, useRef } from "react";
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
  // Último valor que nosotros mismos emitimos por onChange. Sirve para
  // distinguir "el value cambió porque el usuario escribió" (no hay que
  // tocar el texto, para no pisar algo como "0," a medio escribir) de
  // "el value cambió desde afuera" (ej. el formulario se resetea después
  // de guardar) — ahí sí hay que reflejarlo, incluso si es 0.
  const ultimoValorEmitido = useRef(value);

  useEffect(() => {
    if (value === ultimoValorEmitido.current) return;
    ultimoValorEmitido.current = value;
    setTexto(value ? formatearMilesEnVivo(String(value).replace(".", ",")) : "");
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
        const nuevoValor = desformatearMiles(formateado);
        ultimoValorEmitido.current = nuevoValor;
        onChange(nuevoValor);
      }}
    />
  );
}
