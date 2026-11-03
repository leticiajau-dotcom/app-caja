"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import { formatMoney } from "@/lib/format";
import { totalLineasManuales, type LineaManual } from "@/lib/presupuesto";
import { ETIQUETA_ESTADO } from "@/lib/presupuestoEtiquetas";
import type { Cliente, Presupuesto } from "@/lib/types";

const LINEA_VACIA: LineaManual = { descripcion: "", cantidad: 1, precioUnitario: 0 };

/** El link para el cliente (/ver/<token>): copiar, mandar por WhatsApp o
 *  verlo. Un presupuesto manual tiene el token desde que se crea (a
 *  diferencia de uno de LEBRON, que lo recibe recién con el diseño en 3D). */
function LinkParaElCliente({ presupuesto }: { presupuesto: Presupuesto }) {
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setLink(presupuesto.tokenPublico ? `${window.location.origin}/ver/${presupuesto.tokenPublico}` : "");
  }, [presupuesto.tokenPublico]);

  if (!link) return null;

  const mensaje = `Te paso el presupuesto "${presupuesto.nombre}": ${link}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso para el portapapeles: queda el link a la vista para copiarlo a mano.
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold text-lg mb-1">Link para el cliente</h2>
        <p className="text-sm text-madera-500">
          Con este link el cliente ve el presupuesto (como la hoja para imprimir). No necesita entrar a la app.
        </p>
      </div>
      <p className="text-sm text-madera-700">
        {presupuesto.vistoPrimero ? (
          <>
            👁 El cliente lo abrió el {new Date(presupuesto.vistoPrimero).toLocaleString("es-AR")}
            {presupuesto.vistas > 1 && presupuesto.vistoUltimo && (
              <> ({presupuesto.vistas} veces; la última, el {new Date(presupuesto.vistoUltimo).toLocaleString("es-AR")})</>
            )}
            .
          </>
        ) : (
          "El cliente todavía no abrió el link."
        )}
      </p>
      {presupuesto.estado === "descartado" && (
        <p className="text-sm text-amber-800">Está descartado: el link no se abre hasta que lo recuperes.</p>
      )}
      <input className="input text-sm" readOnly value={link} onFocus={(e) => e.target.select()} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={copiar}>
          {copiado ? "¡Copiado!" : "Copiar link"}
        </button>
        <a
          className="btn-secondary"
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mandar por WhatsApp
        </a>
        <a className="btn-secondary" href={link} target="_blank" rel="noopener noreferrer">
          Verlo como el cliente
        </a>
      </div>
    </div>
  );
}

export default function PresupuestoManualDetalle({
  presupuesto,
  cliente,
  onActualizado,
}: {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  onActualizado: (p: Presupuesto) => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(presupuesto.nombre);
  const [lineas, setLineas] = useState<LineaManual[]>(
    presupuesto.lineasManuales.length > 0 ? presupuesto.lineasManuales : [{ ...LINEA_VACIA }]
  );
  const [hayCambios, setHayCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const editable = presupuesto.estado === "borrador";
  const moneda = presupuesto.moneda;
  const estado = ETIQUETA_ESTADO[presupuesto.estado];
  const total = totalLineasManuales(lineas.filter((l) => l.descripcion.trim()));

  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);

  function cambiarLinea(i: number, cambio: Partial<LineaManual>) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
    setHayCambios(true);
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { ...LINEA_VACIA }]);
    setHayCambios(true);
  }

  function quitarLinea(i: number) {
    setLineas((ls) => ls.filter((_, j) => j !== i));
    setHayCambios(true);
  }

  async function enviar(cuerpo: Record<string, unknown>) {
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onActualizado(data.presupuesto);
      setHayCambios(false);
      return data.presupuesto as Presupuesto;
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
      return null;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar() {
    const conDescripcion = lineas.filter((l) => l.descripcion.trim());
    if (conDescripcion.length === 0) {
      setError("Agregá al menos un ítem con descripción.");
      return false;
    }
    const resultado = await enviar({ nombre, lineas: conDescripcion });
    if (resultado) {
      setLineas(resultado.lineasManuales.length > 0 ? resultado.lineasManuales : [{ ...LINEA_VACIA }]);
      setAviso("Guardado.");
    }
    return Boolean(resultado);
  }

  async function abrirHojaCliente() {
    if (hayCambios && !(await guardar())) return;
    router.push(`/presupuestos/${presupuesto.id}/imprimir`);
  }

  async function cambiarEstado(estado: "borrador" | "descartado") {
    if (
      estado === "descartado" &&
      !confirm("¿Descartar este presupuesto? No se borra: queda en la lista de descartados.")
    )
      return;
    await enviar({ estado });
  }

  async function aceptar() {
    if (hayCambios && !(await guardar())) return;
    if (
      !confirm(
        `¿El cliente aceptó? Se crea el proyecto "${nombre}" para ${cliente?.nombre ?? "el cliente"} con un precio de ${formatMoney(
          total,
          moneda
        )}.`
      )
    )
      return;
    setError("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}/aceptar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onActualizado(data.presupuesto);
      setAviso("Listo: ya es un proyecto en Clientes. Los pagos se cargan ahí.");
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/presupuestos" className="text-sm text-madera-500 hover:text-madera-700">
          ← Presupuestos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
          <div className="min-w-0">
            <p className="text-sm text-madera-500">
              {cliente?.nombre ?? "Cliente borrado"} · {new Date(presupuesto.creadoEn).toLocaleDateString("es-AR")}{" "}
              <span className={`inline-block text-xs rounded-full px-2 py-0.5 ml-1 ${estado.clase}`}>
                {estado.texto}
              </span>
              <span className="inline-block text-xs rounded-full px-2 py-0.5 ml-1 bg-madera-100 text-madera-600">
                Manual
              </span>
            </p>
            {editable ? (
              <input
                className="input text-xl font-bold mt-1"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setHayCambios(true);
                }}
              />
            ) : (
              <h1 className="text-2xl font-bold text-madera-800">{presupuesto.nombre}</h1>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <button className="btn-primary" disabled={guardando || !hayCambios} onClick={guardar}>
                {guardando ? "Guardando..." : hayCambios ? "Guardar cambios" : "Guardado"}
              </button>
            )}
            <button className="btn-secondary" disabled={guardando} onClick={abrirHojaCliente}>
              Hoja para el cliente
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {aviso && !hayCambios && <p className="text-sm text-green-700 mt-2">{aviso}</p>}
      </div>

      {presupuesto.estado === "aceptado" && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          El cliente lo aceptó: es el proyecto &quot;{presupuesto.nombre}&quot; de {cliente?.nombre}. Los pagos y los
          cambios que pida se cargan en{" "}
          <Link href="/clientes" className="underline">
            Clientes
          </Link>
          .
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Productos y servicios</h2>
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-madera-500 px-1">
            <span className="col-span-6">Descripción</span>
            <span className="col-span-2 text-right">Cantidad</span>
            <span className="col-span-2 text-right">Precio unit.</span>
            <span className="col-span-2 text-right">Subtotal</span>
          </div>
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="input col-span-12 sm:col-span-6"
                placeholder="Ej: Instalación eléctrica"
                value={l.descripcion}
                disabled={!editable}
                onChange={(e) => cambiarLinea(i, { descripcion: e.target.value })}
              />
              <input
                className="input col-span-4 sm:col-span-2 text-right"
                type="number"
                min={0}
                step="any"
                disabled={!editable}
                value={l.cantidad}
                onChange={(e) => cambiarLinea(i, { cantidad: Number(e.target.value) || 0 })}
              />
              <MoneyInput
                className="input col-span-5 sm:col-span-2"
                value={l.precioUnitario}
                onChange={(v) => cambiarLinea(i, { precioUnitario: v })}
              />
              <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                <span className="text-sm">{formatMoney(l.cantidad * l.precioUnitario, moneda)}</span>
                {editable && lineas.length > 1 && (
                  <button
                    type="button"
                    className="text-madera-400 hover:text-red-600 shrink-0"
                    title="Quitar"
                    onClick={() => quitarLinea(i)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {editable && (
          <button type="button" className="btn-secondary text-sm py-1 mt-4" onClick={agregarLinea}>
            + Agregar ítem
          </button>
        )}
        <p className="text-right text-lg font-bold mt-4 border-t border-madera-200 pt-3">
          Total: {formatMoney(total, moneda)}
        </p>
      </div>

      <LinkParaElCliente presupuesto={presupuesto} />

      <div className="flex flex-wrap gap-2 justify-end">
        {presupuesto.estado === "borrador" && (
          <>
            <button className="btn-secondary" disabled={guardando} onClick={() => cambiarEstado("descartado")}>
              Descartar
            </button>
            <button className="btn-primary" disabled={guardando || total <= 0} onClick={aceptar}>
              El cliente aceptó: pasar a proyecto
            </button>
          </>
        )}
        {presupuesto.estado === "descartado" && (
          <button className="btn-secondary" disabled={guardando} onClick={() => cambiarEstado("borrador")}>
            Recuperar este presupuesto
          </button>
        )}
      </div>
    </div>
  );
}
