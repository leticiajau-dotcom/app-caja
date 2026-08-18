import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/internalSession";
import { obtenerResumen } from "@/lib/repo";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const resumen = await obtenerResumen();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">Resumen</h1>
        <p className="text-madera-600">
          Arqueo general y saldos de todas las cuentas, actualizados con cada
          movimiento cargado.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-madera-800 mb-3">
          Arqueo total
        </h2>
        {resumen.arqueoPorMoneda.length === 0 ? (
          <p className="text-madera-500 text-sm">
            Todavía no hay cuentas cargadas.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumen.arqueoPorMoneda.map((a) => (
              <div key={a.moneda} className="card">
                <p className="text-sm text-madera-500">{a.moneda}</p>
                <p className="text-2xl font-bold text-madera-800">
                  {formatMoney(a.total, a.moneda)}
                </p>
                <p className="text-xs text-madera-400 mt-1">
                  {a.cuentas.length} cuenta{a.cuentas.length !== 1 && "s"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-madera-800 mb-3">
          Saldo por cuenta
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-madera-500 border-b border-madera-100">
                <th className="py-2 pr-4">Cuenta</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Moneda</th>
                <th className="py-2 pr-4 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {resumen.saldosPorCuenta.map(({ cuenta, saldo }) => (
                <tr key={cuenta.id} className="border-b border-madera-50 last:border-0">
                  <td className="py-2 pr-4">{cuenta.nombre}</td>
                  <td className="py-2 pr-4 capitalize">
                    {cuenta.tipo.replace("_", " ")}
                  </td>
                  <td className="py-2 pr-4">{cuenta.moneda}</td>
                  <td className="py-2 pr-4 text-right font-medium">
                    {formatMoney(saldo, cuenta.moneda)}
                  </td>
                </tr>
              ))}
              {resumen.saldosPorCuenta.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-madera-400">
                    No hay cuentas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-madera-800 mb-3">
          Saldo por usuario responsable
        </h2>
        <p className="text-sm text-madera-500 mb-3">
          Suma de las cuentas de las que cada usuario es responsable.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {resumen.saldosPorUsuario.map(({ usuario, porMoneda }) => (
            <div key={usuario.id} className="card">
              <p className="font-semibold text-madera-800">
                {usuario.nombre}
              </p>
              {Object.keys(porMoneda).length === 0 ? (
                <p className="text-sm text-madera-400 mt-1">
                  Sin cuentas asignadas.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(porMoneda).map(([moneda, saldo]) => (
                    <li key={moneda} className="flex justify-between">
                      <span className="text-madera-500">{moneda}</span>
                      <span className="font-medium">
                        {formatMoney(saldo, moneda)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
