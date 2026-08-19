import { Fragment } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/internalSession";
import { obtenerResumen } from "@/lib/repo";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const resumen = await obtenerResumen();
  const hayCuentas = resumen.saldosPorGrupoResponsable.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Resumen</h1>
        <p className="text-madera-600">
          Cuentas agrupadas por responsable, con subtotales por responsable y
          moneda, y los totales generales de la caja al final.
        </p>
      </div>

      <div className="card overflow-x-auto">
        {!hayCuentas ? (
          <p className="text-madera-500 text-sm">
            Todavía no hay cuentas activas cargadas.
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
                const monedas = Object.keys(grupo.cuentasPorMoneda).sort((a, b) =>
                  a.localeCompare(b)
                );
                return (
                  <Fragment key={grupo.usuarioIds.join("|") || "sin-responsable"}>
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
                        {grupo.cuentasPorMoneda[moneda].map(({ cuenta, saldo }) => (
                          <tr
                            key={cuenta.id}
                            className="border-b border-madera-50 last:border-0"
                          >
                            <td className="py-2 pr-4 pl-6">{cuenta.nombre}</td>
                            <td className="py-2 pr-4">{moneda}</td>
                            <td className="py-2 pr-4 text-right">
                              {formatMoney(saldo, moneda)}
                            </td>
                          </tr>
                        ))}
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
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-4 pb-1 pr-4">
                  <div className="border-t-2 border-madera-200" />
                </td>
              </tr>
              {resumen.arqueoPorMoneda.map((a) => (
                <tr key={a.moneda}>
                  <td colSpan={2} className="py-1 pr-4 text-right font-bold text-madera-800">
                    Total {a.moneda}
                  </td>
                  <td className="py-1 pr-4 text-right font-bold text-madera-800">
                    {formatMoney(a.total, a.moneda)}
                  </td>
                </tr>
              ))}
              {resumen.arqueoPorMoneda.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-1 pr-4 text-center text-madera-400">
                    Sin totales todavía.
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
