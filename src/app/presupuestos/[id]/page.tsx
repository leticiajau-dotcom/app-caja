"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import TarjetaDiseno3D from "@/components/TarjetaDiseno3D";
import { formatMoney, sinAcentos } from "@/lib/format";
import { puedeVerPresupuestos } from "@/lib/permisos";
import {
  PALABRAS_TIPO,
  calcularPresupuesto,
  clavePrecio,
  comoLoVeElCliente,
  type ArticuloAgregado,
  type CambioMaterial,
  type CambioMueble,
  type Extra,
  type LineaMaterial,
  type TipoPrecio,
} from "@/lib/presupuesto";
import { ETIQUETA_ESTADO } from "@/lib/presupuestoEtiquetas";
import type { Cliente, Precio, Presupuesto } from "@/lib/types";

const GRUPOS: { tipo: TipoPrecio; titulo: string; precioDe: string }[] = [
  { tipo: "placa", titulo: "Placas", precioDe: "Precio por placa" },
  { tipo: "canto", titulo: "Tapacantos", precioDe: "Precio por metro" },
  { tipo: "herraje", titulo: "Herrajes", precioDe: "Precio por unidad" },
  { tipo: "otro", titulo: "Otros artículos", precioDe: "Precio por unidad" },
];

const NOMBRE_TIPO: Record<TipoPrecio, string> = {
  placa: "Placa",
  canto: "Tapacanto",
  herraje: "Herraje",
  otro: "Otro",
};

/** "2,5" o "2.5" -> 2.5 (NaN si no es un número). */
function leerDecimal(texto: string) {
  return Number(texto.replace(",", "."));
}

function textoCoef(v: number) {
  return String(v).replace(".", ",");
}

function textoCantidad(v: number) {
  return v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function cantidadConUnidad(l: LineaMaterial) {
  return `${textoCantidad(l.cantidad)} ${l.unidad}`;
}

/** Una cantidad escrita a mano (con coma o punto). Vacío cuenta como 0. */
function CantidadInput({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const aTexto = (v: number) => String(v).replace(".", ",");
  const [texto, setTexto] = useState(aTexto(valor));
  useEffect(() => {
    // Si la cantidad cambió desde afuera (al guardar, por ejemplo), mostrar la nueva.
    if ((texto.trim() === "" ? 0 : leerDecimal(texto)) !== valor) setTexto(aTexto(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <input
      className="input py-1 px-2 text-right min-w-0"
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const v = e.target.value.trim() === "" ? 0 : leerDecimal(e.target.value);
        if (v >= 0) onChange(v);
      }}
    />
  );
}

/** Buscar en la lista de precios algo que LEBRON no cuenta (el corte, una
 *  mesada, un vidrio...) y sumarlo al presupuesto. */
function AgregarArticulo({
  yaEstan,
  onAgregar,
}: {
  yaEstan: Set<string>;
  onAgregar: (p: Precio) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Precio[] | null>(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!abierto || lista) return;
    fetch("/api/precios")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setLista(d.precios);
      })
      .catch((e) => setError(e.message || "No se pudo leer la lista de precios."));
  }, [abierto, lista]);

  const palabras = sinAcentos(busqueda).split(/\s+/).filter(Boolean);
  const encontrados = (lista ?? [])
    .filter((p) => {
      const texto = sinAcentos([p.nombre, p.codigo, p.descripcion, p.proveedor, PALABRAS_TIPO[p.tipo]].join(" "));
      return palabras.every((w) => texto.includes(w));
    })
    .slice(0, 30);

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary text-sm py-1 mt-4" onClick={() => setAbierto(true)}>
        + Agregar un artículo de la lista
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-madera-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Agregar algo que LEBRON no cuenta</p>
        <button
          type="button"
          className="text-sm text-madera-400 hover:text-madera-700"
          onClick={() => setAbierto(false)}
        >
          Cerrar
        </button>
      </div>
      <input
        className="input"
        autoFocus
        placeholder="Buscá en la lista de precios: corte, mesada, vidrio..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!lista && !error && <p className="text-sm text-madera-500">Cargando la lista...</p>}
      {lista && encontrados.length === 0 && (
        <p className="text-sm text-madera-500">
          No está en la lista. Cargalo primero en{" "}
          <Link href="/precios" className="underline">
            Precios
          </Link>{" "}
          y después agregalo acá.
        </p>
      )}
      <div className="divide-y divide-madera-100 max-h-72 overflow-y-auto">
        {encontrados.map((p) => {
          const esta = yaEstan.has(clavePrecio(p.tipo, p.nombre));
          return (
            <button
              key={p.id}
              type="button"
              disabled={esta}
              onClick={() => onAgregar(p)}
              className="w-full text-left flex items-center justify-between gap-3 py-2 px-1 text-sm hover:bg-madera-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="min-w-0">
                <span className="block truncate">{p.nombre}</span>
                <span className="block text-xs text-madera-500 truncate">
                  {NOMBRE_TIPO[p.tipo]}
                  {p.codigo && ` · ${p.codigo}`}
                  {esta && " · ya está en el presupuesto"}
                </span>
              </span>
              <span className="shrink-0">{formatMoney(p.precio, "ARS")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PresupuestoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [sinPermiso, setSinPermiso] = useState(false);

  // Lo que se está editando (se guarda todo junto con "Guardar cambios").
  const [nombre, setNombre] = useState("");
  const [coefPlacasTexto, setCoefPlacasTexto] = useState("1");
  const [coefHerrajesTexto, setCoefHerrajesTexto] = useState("1");
  const [dosCoef, setDosCoef] = useState(false);
  const [porModulo, setPorModulo] = useState(false);
  const [descuentoTexto, setDescuentoTexto] = useState("0");
  const [precios, setPrecios] = useState<Record<string, number>>({});
  const [preciosCambiados, setPreciosCambiados] = useState<
    Record<string, { tipo: TipoPrecio; nombre: string; precio: number }>
  >({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [materiales, setMateriales] = useState<Record<string, CambioMaterial>>({});
  const [agregados, setAgregados] = useState<ArticuloAgregado[]>([]);
  // Nombre y medidas de cada mueble tal como los va a ver el cliente.
  const [muebles, setMuebles] = useState<{ nombre: string; medidas: string }[]>([]);
  const [hayCambios, setHayCambios] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function tomar(p: Presupuesto) {
    setPresupuesto(p);
    setNombre(p.nombre);
    setCoefPlacasTexto(textoCoef(p.coefPlacas));
    setCoefHerrajesTexto(textoCoef(p.coefHerrajes));
    setDosCoef(p.coefPlacas !== p.coefHerrajes);
    setPorModulo(p.porModulo);
    setDescuentoTexto(textoCoef(p.datos.descuento ?? 0));
    setPrecios({ ...p.datos.precios });
    setPreciosCambiados({});
    setExtras(p.datos.extras.map((e) => ({ ...e })));
    setMateriales({ ...(p.datos.materiales ?? {}) });
    setAgregados((p.datos.agregados ?? []).map((a) => ({ ...a })));
    setMuebles(p.datos.archivo.items.map((it, i) => comoLoVeElCliente(it, p.datos.muebles?.[i])));
    setHayCambios(false);
  }

  async function cargar() {
    setCargando(true);
    setErrorCarga("");
    const [rp, rs] = await Promise.all([fetch(`/api/presupuestos/${params.id}`), fetch("/api/session")]);
    const ds = await rs.json();
    if (ds.sesion && !puedeVerPresupuestos(ds.sesion.rol)) {
      setSinPermiso(true);
      setCargando(false);
      return;
    }
    const dp = await rp.json();
    if (!rp.ok) {
      setErrorCarga(dp.error ?? "No se pudo cargar el presupuesto.");
    } else {
      tomar(dp.presupuesto);
      setCliente(dp.cliente);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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

  const coefPlacas = leerDecimal(coefPlacasTexto);
  const coefHerrajes = dosCoef ? leerDecimal(coefHerrajesTexto) : coefPlacas;
  const coefValidos = coefPlacas > 0 && coefHerrajes > 0;
  // Vacío cuenta como 0, así se puede borrar el número para escribir otro.
  const descuento = descuentoTexto.trim() === "" ? 0 : leerDecimal(descuentoTexto);
  const descuentoValido = descuento >= 0 && descuento < 100;

  const cambiosMuebles = useMemo(
    () => Object.fromEntries(muebles.map((m, i) => [String(i), m])) as Record<string, CambioMueble>,
    [muebles]
  );

  const resultado = useMemo(() => {
    if (!presupuesto) return null;
    return calcularPresupuesto(
      {
        archivo: presupuesto.datos.archivo,
        precios,
        extras,
        descuento: descuentoValido ? descuento : 0,
        materiales,
        agregados,
        muebles: cambiosMuebles,
      },
      coefValidos ? coefPlacas : 1,
      coefValidos ? coefHerrajes : 1
    );
  }, [
    presupuesto,
    precios,
    extras,
    materiales,
    agregados,
    cambiosMuebles,
    coefPlacas,
    coefHerrajes,
    coefValidos,
    descuento,
    descuentoValido,
  ]);

  const editable = presupuesto?.estado === "borrador";

  function cambiarPrecio(l: LineaMaterial, valor: number) {
    const clave = clavePrecio(l.tipo, l.nombre);
    setPrecios((p) => ({ ...p, [clave]: valor }));
    setPreciosCambiados((c) => ({ ...c, [clave]: { tipo: l.tipo, nombre: l.nombre, precio: valor } }));
    setHayCambios(true);
  }

  /** Tildar/destildar un material o cambiarle la cantidad. Lo que vuelve a
   *  quedar como vino de LEBRON no se guarda como cambio. */
  function cambiarMaterial(l: LineaMaterial, cambio: CambioMaterial) {
    const clave = clavePrecio(l.tipo, l.nombre);
    if (l.agregada && cambio.cantidad !== undefined) {
      const cantidad = cambio.cantidad;
      setAgregados((lista) => lista.map((a) => (clavePrecio(a.tipo, a.nombre) === clave ? { ...a, cantidad } : a)));
    } else {
      setMateriales((m) => {
        const actual: CambioMaterial = { ...m[clave], ...cambio };
        if (actual.activo !== false) delete actual.activo;
        if (actual.cantidad === undefined || actual.cantidad === l.cantidadLebron) delete actual.cantidad;
        const nuevo = { ...m };
        if (Object.keys(actual).length > 0) nuevo[clave] = actual;
        else delete nuevo[clave];
        return nuevo;
      });
    }
    setHayCambios(true);
  }

  function agregarArticulo(p: Precio) {
    const clave = clavePrecio(p.tipo, p.nombre);
    setAgregados((lista) => [...lista, { tipo: p.tipo, nombre: p.nombre, cantidad: 1 }]);
    setPrecios((actuales) => ({ ...actuales, [clave]: p.precio }));
    setHayCambios(true);
  }

  function quitarArticulo(l: LineaMaterial) {
    const clave = clavePrecio(l.tipo, l.nombre);
    setAgregados((lista) => lista.filter((a) => clavePrecio(a.tipo, a.nombre) !== clave));
    setMateriales((m) => {
      const nuevo = { ...m };
      delete nuevo[clave];
      return nuevo;
    });
    setHayCambios(true);
  }

  function cambiarMueble(i: number, cambio: Partial<{ nombre: string; medidas: string }>) {
    setMuebles((lista) => lista.map((m, j) => (j === i ? { ...m, ...cambio } : m)));
    setHayCambios(true);
  }

  function cambiarExtra(i: number, cambio: Partial<Extra>) {
    setExtras((lista) => lista.map((e, j) => (j === i ? { ...e, ...cambio } : e)));
    setHayCambios(true);
  }

  async function enviar(cuerpo: Record<string, unknown>) {
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/presupuestos/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      tomar(data.presupuesto);
      return true;
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar() {
    if (!coefValidos) {
      setError("Los coeficientes tienen que ser números mayores a 0 (por ejemplo 2,5).");
      return false;
    }
    if (!descuentoValido) {
      setError("El descuento del proveedor tiene que ser un número entre 0 y 99.");
      return false;
    }
    const ok = await enviar({
      nombre,
      coefPlacas,
      coefHerrajes,
      porModulo,
      descuento,
      precios: Object.values(preciosCambiados),
      extras,
      materiales,
      agregados,
      muebles: cambiosMuebles,
    });
    if (ok) {
      setAviso(
        Object.keys(preciosCambiados).length > 0
          ? "Guardado. Los precios que cargaste quedaron también en la lista de precios."
          : "Guardado."
      );
    }
    return ok;
  }

  async function abrirHojaCliente() {
    if (hayCambios && !(await guardar())) return;
    router.push(`/presupuestos/${params.id}/imprimir`);
  }

  async function tomarPreciosDeLaLista() {
    if (hayCambios && !confirm("Tenés cambios sin guardar: se pierden. ¿Sigo?")) return;
    if (await enviar({ tomarPreciosDeLaLista: true })) setAviso("Se tomaron los precios de la lista.");
  }

  async function cambiarEstado(estado: "borrador" | "descartado") {
    if (estado === "descartado" && !confirm("¿Descartar este presupuesto? No se borra: queda en la lista de descartados.")) return;
    await enviar({ estado });
  }

  async function aceptar() {
    if (!resultado) return;
    if (hayCambios && !(await guardar())) return;
    const faltan = resultado.faltanPrecios > 0 ? `\n\nOJO: hay ${resultado.faltanPrecios} cosas sin precio.` : "";
    if (
      !confirm(
        `¿El cliente aceptó? Se crea el proyecto "${nombre}" para ${cliente?.nombre ?? "el cliente"} con un precio de ${formatMoney(
          resultado.total,
          presupuesto!.moneda
        )}.${faltan}`
      )
    )
      return;
    setError("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/presupuestos/${params.id}/aceptar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      tomar(data.presupuesto);
      setAviso("Listo: ya es un proyecto en Clientes. Los pagos se cargan ahí.");
    } catch (e: any) {
      setError(e.message ?? "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (sinPermiso) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center">
        <p className="text-madera-700">No tenés acceso a Presupuestos.</p>
      </div>
    );
  }
  if (cargando) return <p className="text-madera-500 text-sm">Cargando...</p>;
  if (errorCarga || !presupuesto || !resultado) {
    return (
      <div className="card max-w-md mx-auto mt-10 text-center space-y-3">
        <p className="text-red-600">{errorCarga || "No se encontró el presupuesto."}</p>
        <Link href="/presupuestos" className="btn-secondary">
          Volver a Presupuestos
        </Link>
      </div>
    );
  }

  const moneda = presupuesto.moneda;
  const estado = ETIQUETA_ESTADO[presupuesto.estado];
  const archivo = presupuesto.datos.archivo;

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

      {(archivo.avisos.length > 0 || resultado.faltanPrecios > 0) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
          {resultado.faltanPrecios > 0 && (
            <p className="font-medium">
              Faltan {resultado.faltanPrecios} {resultado.faltanPrecios === 1 ? "precio" : "precios"} (marcados en
              rojo abajo): sin ellos el total queda corto.
            </p>
          )}
          {archivo.avisos.map((a, i) => (
            <p key={i} className="whitespace-pre-line">
              ⚠ {a}
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Coeficiente y descuento</h2>
        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <div>
            <label className="label">{dosCoef ? "Placas y tapacantos" : "Todos los materiales"}</label>
            <input
              className="input"
              inputMode="decimal"
              disabled={!editable}
              value={coefPlacasTexto}
              onChange={(e) => {
                setCoefPlacasTexto(e.target.value);
                setHayCambios(true);
              }}
            />
          </div>
          {dosCoef && (
            <div>
              <label className="label">Herrajes</label>
              <input
                className="input"
                inputMode="decimal"
                disabled={!editable}
                value={coefHerrajesTexto}
                onChange={(e) => {
                  setCoefHerrajesTexto(e.target.value);
                  setHayCambios(true);
                }}
              />
            </div>
          )}
          <label className="text-sm text-madera-700 flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              disabled={!editable}
              checked={dosCoef}
              onChange={(e) => {
                setDosCoef(e.target.checked);
                if (e.target.checked) setCoefHerrajesTexto(coefPlacasTexto);
                setHayCambios(true);
              }}
            />
            Otro coeficiente para los herrajes
          </label>
        </div>
        {!coefValidos && (
          <p className="text-sm text-red-600 mt-2">El coeficiente tiene que ser un número mayor a 0 (ej: 2,5).</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3 items-end mt-4">
          <div>
            <label className="label">Descuento del proveedor (%)</label>
            <input
              className="input"
              inputMode="decimal"
              disabled={!editable}
              value={descuentoTexto}
              onChange={(e) => {
                setDescuentoTexto(e.target.value);
                setHayCambios(true);
              }}
            />
          </div>
          <p className="text-xs text-madera-500 sm:col-span-2 pb-2">
            Los precios de la lista son de lista, con IVA. Lo que te descuenta el proveedor se resta del costo de
            placas, tapacantos y herrajes, antes del coeficiente.
          </p>
        </div>
        {!descuentoValido && (
          <p className="text-sm text-red-600 mt-2">El descuento tiene que ser un número entre 0 y 99.</p>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-lg">Materiales</h2>
          {editable && (
            <button className="btn-secondary text-sm py-1" disabled={guardando} onClick={tomarPreciosDeLaLista}>
              Tomar los precios de la lista
            </button>
          )}
        </div>
        <p className="text-xs text-madera-500 mb-4">
          Las cantidades vienen de LEBRON: las placas son las que hay que comprar (las del optimizador) y el
          tapacanto, redondeado como se compra. Podés cambiarlas, y lo que destildás no se cobra (por ejemplo, si
          el cliente compra los herrajes).
          {!archivo.placas_optimizadas && " OJO: este diseño trae las placas estimadas por superficie."}
        </p>
        <div className="space-y-6">
          {GRUPOS.map((g) => {
            const lineas = resultado.lineas.filter((l) => l.tipo === g.tipo);
            if (lineas.length === 0) return null;
            const subtotal = lineas.filter((l) => l.activa).reduce((a, l) => a + l.subtotal, 0);
            return (
              <div key={g.tipo}>
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-madera-500 uppercase mb-1">
                  <span className="col-span-12 sm:col-span-5">{g.titulo}</span>
                  <span className="hidden sm:block sm:col-span-2 text-right">Cantidad</span>
                  <span className="hidden sm:block sm:col-span-3">{g.precioDe}</span>
                  <span className="hidden sm:block sm:col-span-2 text-right">Subtotal</span>
                </div>
                <div className="divide-y divide-madera-100">
                  {lineas.map((l) => (
                    <div
                      key={l.nombre}
                      className={`grid grid-cols-12 gap-2 items-center py-1.5 text-sm ${
                        l.sinPrecio ? "bg-red-50 -mx-2 px-2 rounded" : ""
                      }`}
                    >
                      <span className="col-span-12 sm:col-span-5 min-w-0 flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="shrink-0"
                          disabled={!editable}
                          checked={l.activa}
                          title={l.activa ? "Se cobra. Destildalo para no cobrarlo." : "No se cobra."}
                          onChange={(e) => cambiarMaterial(l, { activo: e.target.checked })}
                        />
                        <span
                          className={`min-w-0 truncate ${l.activa ? "" : "line-through text-madera-400"}`}
                          title={l.nombre}
                        >
                          {l.nombre}
                          {l.sinPrecio && <span className="text-xs text-red-600"> · sin precio</span>}
                          {!l.activa && <span className="text-xs inline-block ml-1">· no se cobra</span>}
                        </span>
                        {l.agregada && editable && (
                          <button
                            type="button"
                            className="shrink-0 text-madera-400 hover:text-red-600 text-xs"
                            title="Quitar del presupuesto"
                            onClick={() => quitarArticulo(l)}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                      <span className="col-span-4 sm:col-span-2 text-right text-madera-600">
                        {editable ? (
                          <span className="flex items-center gap-1">
                            <CantidadInput valor={l.cantidad} onChange={(v) => cambiarMaterial(l, { cantidad: v })} />
                            <span className="text-xs sm:w-9 text-left shrink-0">{l.unidad}</span>
                          </span>
                        ) : (
                          cantidadConUnidad(l)
                        )}
                        {l.cantidadLebron !== null && l.cantidad !== l.cantidadLebron && (
                          <span className="block text-xs text-madera-400">
                            LEBRON: {textoCantidad(l.cantidadLebron)}
                          </span>
                        )}
                        {l.agregada && <span className="block text-xs text-madera-400">agregado</span>}
                      </span>
                      <span className="col-span-4 sm:col-span-3">
                        {editable ? (
                          <MoneyInput
                            className="input py-1"
                            value={precios[clavePrecio(l.tipo, l.nombre)] ?? 0}
                            onChange={(v) => cambiarPrecio(l, v)}
                          />
                        ) : (
                          formatMoney(l.precioUnitario, moneda)
                        )}
                      </span>
                      <span
                        className={`col-span-4 sm:col-span-2 text-right text-xs sm:text-sm whitespace-nowrap ${
                          l.activa ? "" : "line-through text-madera-400"
                        }`}
                      >
                        {formatMoney(l.subtotal, moneda)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-right text-sm text-madera-600 mt-1">
                  {g.titulo}: <span className="font-medium">{formatMoney(subtotal, moneda)}</span>
                </p>
              </div>
            );
          })}
        </div>
        {editable && (
          <AgregarArticulo
            yaEstan={new Set(resultado.lineas.map((l) => clavePrecio(l.tipo, l.nombre)))}
            onAgregar={agregarArticulo}
          />
        )}
        {resultado.descuento > 0 && (
          <p className="text-right text-sm text-madera-600 mt-3">
            Descuento del proveedor ({textoCoef(resultado.descuento)}%):{" "}
            <span className="font-medium">−{formatMoney(resultado.descuentoMonto, moneda)}</span>
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-1">Mano de obra, colocación y flete</h2>
        <p className="text-xs text-madera-500 mb-4">
          Van aparte, sin coeficiente. Los tildados salen en la hoja del cliente en un renglón propio; los otros
          van sumados dentro del precio de los muebles.
        </p>
        <div className="space-y-2">
          {extras.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="input col-span-12 sm:col-span-5"
                disabled={!editable}
                value={e.concepto}
                onChange={(ev) => cambiarExtra(i, { concepto: ev.target.value })}
              />
              <div className="col-span-6 sm:col-span-3">
                {editable ? (
                  <MoneyInput value={e.monto} onChange={(v) => cambiarExtra(i, { monto: v })} />
                ) : (
                  <span className="text-sm">{formatMoney(e.monto, moneda)}</span>
                )}
              </div>
              <label className="col-span-4 sm:col-span-3 text-xs text-madera-700 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={e.separado}
                  onChange={(ev) => cambiarExtra(i, { separado: ev.target.checked })}
                />
                Aparte en la hoja del cliente
              </label>
              {editable && (
                <button
                  type="button"
                  className="col-span-2 sm:col-span-1 text-madera-400 hover:text-red-600 text-sm"
                  title="Quitar"
                  onClick={() => {
                    setExtras((lista) => lista.filter((_, j) => j !== i));
                    setHayCambios(true);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button
              type="button"
              className="btn-secondary text-sm py-1"
              onClick={() => {
                setExtras((lista) => [...lista, { concepto: "", monto: 0, separado: true }]);
                setHayCambios(true);
              }}
            >
              + Agregar renglón
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Total</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-madera-600">
              {resultado.lineas.some((l) => l.activa && l.tipo === "otro")
                ? "Placas, tapacantos y otros"
                : "Placas y tapacantos"}
              : {formatMoney(resultado.costoPlacasCanto, moneda)} × {textoCoef(coefPlacas)}
            </span>
            <span>{formatMoney(resultado.costoPlacasCanto * coefPlacas, moneda)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-madera-600">
              Herrajes: {formatMoney(resultado.costoHerrajes, moneda)} × {textoCoef(coefHerrajes)}
            </span>
            <span>{formatMoney(resultado.costoHerrajes * coefHerrajes, moneda)}</span>
          </div>
          {resultado.extrasIncluidos > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-madera-600">Dentro de los muebles (mano de obra, etc.)</span>
              <span>{formatMoney(resultado.extrasIncluidos, moneda)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-madera-100 pt-1.5 font-medium">
            <span>Muebles</span>
            <span>{formatMoney(resultado.muebles, moneda)}</span>
          </div>
          {extras
            .filter((e) => e.separado && e.monto > 0)
            .map((e, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-madera-600">{e.concepto}</span>
                <span>{formatMoney(e.monto, moneda)}</span>
              </div>
            ))}
          <div className="flex justify-between gap-3 border-t border-madera-200 pt-2 text-lg font-bold text-madera-800">
            <span>Total</span>
            <span>{formatMoney(resultado.total, moneda)}</span>
          </div>
          <p className="text-xs text-madera-400">
            Costo de materiales sin coeficiente:{" "}
            {formatMoney(resultado.costoPlacasCanto + resultado.costoHerrajes, moneda)}
            {resultado.descuento > 0 && ` (ya con el ${textoCoef(resultado.descuento)}% de descuento del proveedor)`}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold text-lg">Muebles y precio por módulo</h2>
          <label className="text-sm text-madera-700 flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!editable}
              checked={porModulo}
              onChange={(e) => {
                setPorModulo(e.target.checked);
                setHayCambios(true);
              }}
            />
            Mostrar el precio de cada uno en la hoja del cliente
          </label>
        </div>
        <p className="text-xs text-madera-500 mb-4">
          El nombre y el renglón de abajo son los que ve el cliente (en la hoja y en el link): cambialos como
          quieras, no tocan SketchUp. El precio es el costo real de la obra repartido entre los módulos: cada uno
          paga las placas según la superficie que usa, más su tapacanto y sus herrajes. La suma da exactamente el
          precio de los muebles.
        </p>
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-madera-500 uppercase mb-1">
          <span className="col-span-12 sm:col-span-6">Mueble</span>
          <span className="hidden sm:block sm:col-span-1 text-right">Cant.</span>
          <span className="hidden sm:block sm:col-span-2 text-right">Unitario</span>
          <span className="hidden sm:block sm:col-span-3 text-right">Subtotal</span>
        </div>
        <div className="divide-y divide-madera-100">
          {resultado.items.map((it, i) => {
            const lebron = archivo.items[i];
            const cambiado = it.nombre !== lebron.nombre || it.medidas !== lebron.medidas;
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-start py-2 text-sm">
                <div className="col-span-12 sm:col-span-6 min-w-0 space-y-1">
                  {editable && muebles[i] ? (
                    <>
                      <input
                        className="input py-1 font-medium"
                        value={muebles[i].nombre}
                        placeholder={lebron.nombre}
                        onChange={(e) => cambiarMueble(i, { nombre: e.target.value })}
                      />
                      <input
                        className="input py-1 text-xs"
                        value={muebles[i].medidas}
                        placeholder="Medidas o detalle (si lo dejás vacío, no sale)"
                        onChange={(e) => cambiarMueble(i, { medidas: e.target.value })}
                      />
                    </>
                  ) : (
                    <>
                      <span className="block truncate font-medium">{it.nombre}</span>
                      {it.medidas && <span className="block text-xs text-madera-500 truncate">{it.medidas}</span>}
                    </>
                  )}
                  <p className="text-xs text-madera-400 truncate" title={lebron.detalle}>
                    {cambiado ? `En LEBRON: ${lebron.nombre}` : lebron.detalle}
                    {cambiado && editable && (
                      <button
                        type="button"
                        className="underline ml-2 hover:text-madera-700"
                        onClick={() => cambiarMueble(i, comoLoVeElCliente(lebron, undefined))}
                      >
                        volver al de LEBRON
                      </button>
                    )}
                  </p>
                </div>
                <span className="col-span-2 sm:col-span-1 text-right sm:pt-1.5">{it.cantidad}</span>
                <span className="col-span-5 sm:col-span-2 text-right sm:pt-1.5">
                  {formatMoney(it.precioUnitario, moneda)}
                </span>
                <span className="col-span-5 sm:col-span-3 text-right sm:pt-1.5">{formatMoney(it.subtotal, moneda)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-right text-sm font-medium mt-2">Muebles: {formatMoney(resultado.muebles, moneda)}</p>
      </div>

      <TarjetaDiseno3D presupuesto={presupuesto} hayCambios={hayCambios} />

      <div className="flex flex-wrap gap-2 justify-end">
        {presupuesto.estado === "borrador" && (
          <>
            <button className="btn-secondary" disabled={guardando} onClick={() => cambiarEstado("descartado")}>
              Descartar
            </button>
            <button className="btn-primary" disabled={guardando} onClick={aceptar}>
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
