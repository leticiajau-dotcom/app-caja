"use client";

import { useEffect, useState } from "react";
import Visor3D from "@/components/Visor3D";
import type { Presupuesto } from "@/lib/types";

/** En la pantalla del presupuesto: el link para el cliente (la hoja con el
 *  diseño en 3D, ver /ver/[token]) y el 3D para mirarlo antes de mandarlo. */
export default function TarjetaDiseno3D({
  presupuesto,
  hayCambios,
}: {
  presupuesto: Presupuesto;
  hayCambios: boolean;
}) {
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [verlo, setVerlo] = useState(false);
  const { tokenPublico, modeloId } = presupuesto;

  useEffect(() => {
    setLink(tokenPublico ? `${window.location.origin}/ver/${tokenPublico}` : "");
  }, [tokenPublico]);

  if (!modeloId || !tokenPublico) {
    return (
      <div className="card">
        <h2 className="font-semibold text-lg mb-1">Diseño en 3D para el cliente</h2>
        <p className="text-sm text-madera-500">
          Este presupuesto no tiene diseño en 3D. Se agrega solo cuando lo mandás desde LEBRON con el botón
          Presupuesto.
        </p>
      </div>
    );
  }

  const mensaje = `Te paso el presupuesto "${presupuesto.nombre}", con el diseño en 3D: ${link}`;

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
        <h2 className="font-semibold text-lg mb-1">Diseño en 3D para el cliente</h2>
        <p className="text-sm text-madera-500">
          Con este link el cliente ve el presupuesto (como la hoja para el cliente) con el diseño en 3D: lo gira,
          lo acerca y abre puertas y cajones. No necesita entrar a la app.
        </p>
      </div>
      {presupuesto.estado === "descartado" && (
        <p className="text-sm text-amber-800">Está descartado: el link no se abre hasta que lo recuperes.</p>
      )}
      {hayCambios && (
        <p className="text-sm text-amber-800">Guardá los cambios antes de mandarlo: el cliente ve lo guardado.</p>
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
        <button className="btn-secondary" onClick={() => setVerlo(!verlo)}>
          {verlo ? "Ocultar el 3D" : "Ver el 3D acá"}
        </button>
      </div>
      {verlo && <Visor3D url={`/api/publico/${tokenPublico}/modelo?v=${modeloId}`} className="h-[60vh] min-h-[300px]" />}
    </div>
  );
}
