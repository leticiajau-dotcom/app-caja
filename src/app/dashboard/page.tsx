import { Fragment } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/internalSession";
import { obtenerResumen } from "@/lib/repo";
import { formatMoney } from "@/lib/format";
import { puedeVerResumenGeneral } from "@/lib/permisos";
import ResumenMobile from "@/components/ResumenMobile";
import type { Resumen } from "@/lib/types";

export const dynamic = "force-dynamic";

/** El rol "empleado" (acotado) solo ve, acá, el/los grupo(s) donde él
 *  mismo es responsable — nunca las cuentas de otros ni los totales
 *  generales de la caja. */
function filtrarResumenParaEmpleado(resumen: Resumen, usuarioId: string): Resumen {
  const gruposPropios = resumen.saldosPorGrupoResponsable.filter((g) =>
    g.usuarioIds.includes(usuarioId)
  );
  const cuentaIdsPropias = new Set(
    gruposPropios.flatMap((g) =>
      Object.values(g.cuentasPorMoneda).flat().map((sc) => sc.cuenta.id)
    )
  );
  return {
    saldosPorCuenta: resumen.saldosPorCuenta.filter((sc) =>
      cuentaIdsPropias.has(sc.cuenta.id)
    ),
    saldosPorGrupoResponsable: gruposPropios,
    arqueoPorMoneda: [],
  };
}

export default async function DashboardPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const resumenCompleto = await obtenerResumen();
  const mostrarResumenGeneral = puedeVerResumenGeneral(sesion.rol);
  const resumen = mostrarResumenGeneral
    ? resumenCompleto
    : filtrarResumenParaEmpleado(resumenCompleto, sesion.usuarioId);
  const hayCuentas = resumen.saldosPorGrupoResponsable.length > 0;

  return (
    <div>
      <ResumenMobile
        resumen={resumen}
        nombreUsuario={sesion.nombre}
        soloPropio={!mostrarResumenGeneral}
      />

      <div className="hidden md:block space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-madera-800">Resumen</h1>
          <p className="text-madera-600">
            {mostrarResumenGeneral
              ? "Cuentas agrupadas por responsable, con subtotales por responsable y moneda, y los totales generales de la caja al final."
              : "El saldo de las cuentas de las que sos responsable."}
          </p>
        </div>

        <div className="card overflow-x-auto">
          {!hayCuentas ? (
            <p className="text-madera-500 text-sm">
              {mostrarResumenGeneral
                ? "Todavía no hay cuentas activas cargadas."
                : "Todavía no sos responsable de ninguna cuenta."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-madera-500 border-b border-madera-100">
                  <th className="py-2 pr-4">Cuenta</th>
                  <th className="py-2 pr-4">Moneda</th>
                  <th className="py-2 pr-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.saldosPorGrupoResponsable.map((grupo) => {
                  const monedas = Object.keys(grupo.cuentasPorMoneda).sort(
                    (a, b) => a.localeCompare(b),
                  );
                  return (
                    <Fragment
                      key={grupo.usuarioIds.join("|") || "sin-responsable"}
                    >
                      <tr className="bg-madera-50">
                        <td
                          colSpan={3}
                          className="py-2 px-2 font-semibold text-madera-800"
                        >
                          {grupo.etiqueta}
                        </td>
                      </tr>
                      {monedas.map((moneda) => (
                        <Fragment key={moneda}>
                          {grupo.cuentasPorMoneda[moneda].map(
                            ({ cuenta, saldo }) => (
                              <tr
                                key={cuenta.id}
                                className="border-b border-madera-50 last:border-0"
                              >
                                <td className="py-2 pr-4 pl-6">
                                  {cuenta.nombre}
                                </td>
                                <td className="py-2 pr-4">{moneda}</td>
                                <td className="py-2 pr-4 text-right">
                                  {formatMoney(saldo, moneda)}
                                </td>
                              </tr>
                            ),
                          )}
                          <tr className="border-b border-madera-100 bg-madera-50/60">
                            <td
                              colSpan={2}
                              className="py-1.5 pr-4 pl-6 text-right text-xs text-madera-500"
                            >
                              Subtotal {grupo.etiqueta} · {moneda}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-semibold text-madera-700">
                              {formatMoney(grupo.porMoneda[moneda], moneda)}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              {mostrarResumenGeneral && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 pb-1 pr-4">
                    <div className="border-t-2 border-madera-200" />
                  </td>
                </tr>
                {resumen.arqueoPorMoneda.map((a) => (
                  <tr key={a.moneda}>
                    <td
                      colSpan={2}
                      className="py-1 pr-4 text-right font-bold text-madera-800"
                    >
                      Total {a.moneda}
                    </td>
                    <td className="py-1 pr-4 text-right font-bold text-madera-800">
                      {formatMoney(a.total, a.moneda)}
                    </td>
                  </tr>
                ))}
                {resumen.arqueoPorMoneda.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-1 pr-4 text-center text-madera-400"
                    >
                      Sin totales todavía.
                    </td>
                  </tr>
                )}
              </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
