"use client";

import { useEffect, useState } from "react";
import type { ArqueoMoneda } from "@/lib/types";
import { formatMoney, simboloMoneda, temaDeMoneda } from "@/lib/format";

const CLAVE_ORDEN = "caja_orden_arqueo";

function cargarOrden(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ORDEN) ?? "[]");
  } catch {
    return [];
  }
}

function guardarOrden(orden: string[]) {
  localStorage.setItem(CLAVE_ORDEN, JSON.stringify(orden));
}

function ordenar(items: ArqueoMoneda[], orden: string[]) {
  const porMoneda = new Map(items.map((i) => [i.moneda, i]));
  const ordenados: ArqueoMoneda[] = [];
  for (const moneda of orden) {
    const item = porMoneda.get(moneda);
    if (item) {
      ordenados.push(item);
      porMoneda.delete(moneda);
    }
  }
  // Las que no estaban en el orden guardado (monedas nuevas) van al final.
  return [...ordenados, ...porMoneda.values()];
}

function IconoBilletera({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2h-3a3 3 0 0 0 0 6h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16 10a1 1 0 0 0 0 2h2.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H16Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ArqueoCards({ items }: { items: ArqueoMoneda[] }) {
  const [orden, setOrden] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  useEffect(() => {
    const guardado = cargarOrden();
    setOrden(guardado.length ? guardado : items.map((i) => i.moneda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.moneda).join(",")]);

  const ordenados = ordenar(items, orden.length ? orden : items.map((i) => i.moneda));

  function moverA(monedaArrastrada: string, monedaDestino: string) {
    if (monedaArrastrada === monedaDestino) return;
    const actual = ordenados.map((i) => i.moneda);
    const desde = actual.indexOf(monedaArrastrada);
    const hasta = actual.indexOf(monedaDestino);
    if (desde === -1 || hasta === -1) return;
    actual.splice(desde, 1);
    actual.splice(hasta, 0, monedaArrastrada);
    setOrden(actual);
    guardarOrden(actual);
  }

  if (items.length === 0) {
    return (
      <p className="text-madera-500 text-sm">Todavía no hay cuentas cargadas.</p>
    );
  }

  return (
    <div>
      <p className="text-xs text-madera-400 mb-2">
        Arrastrá una tarjeta para cambiar el orden.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((a) => {
          const tema = temaDeMoneda(a.moneda);
          return (
            <div
              key={a.moneda}
              draggable
              onDragStart={() => setArrastrando(a.moneda)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (arrastrando) moverA(arrastrando, a.moneda);
                setArrastrando(null);
              }}
              onDragEnd={() => setArrastrando(null)}
              className={`${tema.cardBg} rounded-2xl p-5 flex items-center justify-between cursor-grab active:cursor-grabbing transition-shadow ${
                arrastrando === a.moneda ? "opacity-50" : "hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`${tema.circuloBg} ${tema.circuloTexto} h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm shrink-0`}
                >
                  {simboloMoneda(a.moneda)}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${tema.textoSuave}`}>
                    {a.moneda}
                  </p>
                  <p className={`text-2xl font-bold ${tema.textoFuerte}`}>
                    {formatMoney(a.total, a.moneda)}
                  </p>
                  <p className={`text-xs ${tema.textoSuave}`}>
                    {a.cuentas.length} cuenta{a.cuentas.length !== 1 && "s"}
                  </p>
                </div>
              </div>
              <div
                className={`${tema.walletBg} ${tema.walletTexto} h-11 w-11 rounded-full flex items-center justify-center shrink-0`}
              >
                <IconoBilletera className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
