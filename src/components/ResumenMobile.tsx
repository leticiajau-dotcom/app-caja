"use client";

import { useState } from "react";
import type { Resumen } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const PALETA_AVATAR = [
  "oklch(70% 0.16 35)",
  "oklch(72% 0.14 85)",
  "oklch(55% 0.135 175)",
];
const COLOR_TARJETAS = ["oklch(55% 0.135 175)", "oklch(78% 0.14 75)"];
const TEXTO_TARJETAS = ["#ffffff", "#2b1a08"];

const INK = "oklch(24% 0.03 250)";
const MUTED = "oklch(52% 0.03 250)";
const DIVIDER = "oklch(93% 0.01 250)";
const POSITIVO = "oklch(52% 0.15 155)";
const NEGATIVO = "oklch(56% 0.18 25)";

function claveGrupo(usuarioIds: string[]) {
  return usuarioIds.join("|") || "sin-responsable";
}

export default function ResumenMobile({
  resumen,
  nombreUsuario,
}: {
  resumen: Resumen;
  nombreUsuario: string;
}) {
  const [expandido, setExpandido] = useState<Record<string, boolean>>(
    Object.fromEntries(
      resumen.saldosPorGrupoResponsable.map((g) => [claveGrupo(g.usuarioIds), true])
    )
  );

  function alternar(clave: string) {
    setExpandido((s) => ({ ...s, [clave]: !s[clave] }));
  }

  const primerNombre = nombreUsuario.trim().split(/\s+/)[0] || nombreUsuario;
  const nombreCapitalizado =
    primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1);

  return (
    <div className="md:hidden font-manrope" style={{ color: INK }}>
      <div className="mb-[18px]">
        <div
          className="text-[22px] font-extrabold"
          style={{ letterSpacing: "-0.3px" }}
        >
          Hola, {nombreCapitalizado}
        </div>
        <div className="text-[13px] font-semibold mt-0.5" style={{ color: MUTED }}>
          Resumen general de tu caja
        </div>
      </div>

      {resumen.arqueoPorMoneda.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mb-[22px]">
          {resumen.arqueoPorMoneda.map((a, i) => (
            <div
              key={a.moneda}
              className="rounded-[20px] p-4"
              style={{
                backgroundColor: COLOR_TARJETAS[i % COLOR_TARJETAS.length],
                color: TEXTO_TARJETAS[i % TEXTO_TARJETAS.length],
                boxShadow: `0 8px 20px -8px ${COLOR_TARJETAS[i % COLOR_TARJETAS.length]}`,
              }}
            >
              <div
                className="text-[11px] font-bold uppercase"
                style={{ opacity: i % TEXTO_TARJETAS.length === 1 ? 0.75 : 0.85, letterSpacing: "0.4px" }}
              >
                Total {a.moneda}
              </div>
              <div className="text-[22px] font-extrabold mt-1.5">
                {formatMoney(a.total, a.moneda)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[15px] font-extrabold">Cuentas por responsable</div>
        <div className="text-[12px] font-bold" style={{ color: MUTED }}>
          {resumen.saldosPorGrupoResponsable.length}{" "}
          {resumen.saldosPorGrupoResponsable.length === 1 ? "grupo" : "grupos"}
        </div>
      </div>

      {resumen.saldosPorGrupoResponsable.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>
          Todavía no hay cuentas activas con responsable asignado.
        </p>
      ) : (
        resumen.saldosPorGrupoResponsable.map((grupo, i) => {
          const clave = claveGrupo(grupo.usuarioIds);
          const abierto = expandido[clave] ?? true;
          const monedas = Object.keys(grupo.cuentasPorMoneda).sort((a, b) =>
            a.localeCompare(b)
          );
          const cantidadCuentas = monedas.reduce(
            (acc, m) => acc + grupo.cuentasPorMoneda[m].length,
            0
          );
          const subtotales = Object.entries(grupo.porMoneda).sort(([a], [b]) =>
            a.localeCompare(b)
          );

          return (
            <div
              key={clave}
              className="rounded-[18px] mb-3 overflow-hidden bg-white"
              style={{ boxShadow: "0 2px 10px rgba(30,25,15,0.05)" }}
            >
              <div
                className="flex items-center gap-2.5 px-4 py-3.5 cursor-pointer"
                onClick={() => alternar(clave)}
              >
                <div
                  className="flex items-center justify-center shrink-0 font-extrabold text-white text-sm"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: PALETA_AVATAR[i % PALETA_AVATAR.length],
                  }}
                >
                  {grupo.etiqueta.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] capitalize truncate">
                    {grupo.etiqueta}
                  </div>
                  <div className="text-[12px] font-semibold" style={{ color: MUTED }}>
                    {cantidadCuentas} {cantidadCuentas === 1 ? "cuenta" : "cuentas"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {subtotales.map(([moneda, valor]) => (
                    <div
                      key={moneda}
                      className="text-[12.5px] font-extrabold"
                      style={{ color: valor < 0 ? NEGATIVO : POSITIVO }}
                    >
                      {formatMoney(valor, moneda)}
                    </div>
                  ))}
                </div>
                <div
                  className="ml-0.5 shrink-0"
                  style={{
                    width: 9,
                    height: 9,
                    borderRight: `2px solid ${MUTED}`,
                    borderBottom: `2px solid ${MUTED}`,
                    transform: abierto ? "rotate(45deg)" : "rotate(-45deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </div>

              {abierto && (
                <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
                  {monedas.map((moneda) =>
                    grupo.cuentasPorMoneda[moneda].map(({ cuenta, saldo }) => (
                      <div
                        key={cuenta.id}
                        className="flex items-center justify-between py-[11px] pr-4"
                        style={{ paddingLeft: 54 }}
                      >
                        <div>
                          <div className="text-[13.5px] font-semibold">
                            {cuenta.nombre}
                          </div>
                          <div
                            className="text-[11px] font-bold"
                            style={{ color: MUTED, letterSpacing: "0.3px" }}
                          >
                            {moneda}
                          </div>
                        </div>
                        <div
                          className="text-[13.5px] font-extrabold"
                          style={{ color: saldo < 0 ? NEGATIVO : INK }}
                        >
                          {formatMoney(saldo, moneda)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
