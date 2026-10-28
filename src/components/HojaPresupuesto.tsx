import { formatMoney } from "@/lib/format";
import type { HojaCliente } from "@/lib/hojaCliente";

/** La hoja del presupuesto que ve el cliente (impresa o en el link /ver/...).
 *  `children` va entre los datos del cliente y la lista de muebles (el diseño
 *  en 3D, en el link). `linkVisor`: el link del 3D, para la hoja impresa. */
export default function HojaPresupuesto({
  hoja,
  children,
  linkVisor,
}: {
  hoja: HojaCliente;
  children?: React.ReactNode;
  linkVisor?: string;
}) {
  const moneda = hoja.moneda;
  const fecha = new Date(hoja.fecha).toLocaleDateString("es-AR");

  return (
    <div className="bg-white rounded-xl border border-madera-100 p-5 sm:p-8 print:border-0 print:p-0 print:rounded-none text-madera-900">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-madera-200 pb-4 mb-6">
        <div className="flex items-center gap-3">
          {hoja.logoDataUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hoja.logoDataUri} alt="" className="h-14 w-14 object-contain" />
          )}
          {hoja.nombreComercial && <p className="text-xl font-bold">{hoja.nombreComercial}</p>}
        </div>
        <div className="text-right text-sm ml-auto">
          <p className="text-xl sm:text-2xl font-bold tracking-wide">PRESUPUESTO</p>
          <p className="text-madera-600">Fecha: {fecha}</p>
        </div>
      </div>

      <div className="mb-6 text-sm space-y-0.5">
        <p>
          <span className="text-madera-500">Cliente:</span> <span className="font-semibold">{hoja.cliente}</span>
        </p>
        <p>
          <span className="text-madera-500">Trabajo:</span> {hoja.trabajo}
        </p>
      </div>

      {children}

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-madera-300 text-left">
            <th className="py-2">Mueble</th>
            <th className="py-2 text-right w-16">Cant.</th>
            {hoja.porModulo && <th className="py-2 text-right w-36">Precio unitario</th>}
            {hoja.porModulo && <th className="py-2 text-right w-36">Subtotal</th>}
          </tr>
        </thead>
        <tbody>
          {hoja.items.map((it, i) => (
            <tr key={i} className="border-b border-madera-100 align-top">
              <td className="py-2">
                <p className="font-medium">{it.nombre}</p>
                {it.medidas && <p className="text-xs text-madera-500">{it.medidas}</p>}
              </td>
              <td className="py-2 text-right">{it.cantidad}</td>
              {hoja.porModulo && <td className="py-2 text-right">{formatMoney(it.precioUnitario, moneda)}</td>}
              {hoja.porModulo && <td className="py-2 text-right">{formatMoney(it.subtotal, moneda)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs text-sm space-y-1.5 mb-8">
        <div className="flex justify-between gap-4">
          <span>Muebles</span>
          <span>{formatMoney(hoja.muebles, moneda)}</span>
        </div>
        {hoja.separados.map((e, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span>{e.concepto}</span>
            <span>{formatMoney(e.monto, moneda)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t-2 border-madera-300 pt-2 text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(hoja.total, moneda)}</span>
        </div>
      </div>

      <div className="text-xs text-madera-600 space-y-2 border-t border-madera-200 pt-4">
        <p>Presupuesto válido por {hoja.validezDias} días desde la fecha.</p>
        {hoja.notaPie && <p className="whitespace-pre-line">{hoja.notaPie}</p>}
        {linkVisor && (
          <p>
            Mirá el diseño en 3D: <span className="font-medium break-all">{linkVisor}</span>
          </p>
        )}
      </div>
    </div>
  );
}
