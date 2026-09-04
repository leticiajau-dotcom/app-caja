"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Rol, SesionInterna } from "@/lib/types";
import { puedeVerClientes, puedeVerCuentas, puedeVerUsuarios } from "@/lib/permisos";

// Mismo orden que el menú inferior (MobileBottomNav): deslizar hacia la
// izquierda avanza a la pestaña siguiente, hacia la derecha vuelve a la
// anterior.
const ORDEN_TABS: { href: string; visible: (rol: Rol) => boolean }[] = [
  { href: "/dashboard", visible: () => true },
  { href: "/movimientos", visible: () => true },
  { href: "/cuentas", visible: puedeVerCuentas },
  { href: "/clientes", visible: puedeVerClientes },
  { href: "/usuarios", visible: puedeVerUsuarios },
];

const UMBRAL_PX = 70; // distancia horizontal mínima para contar como swipe
const MAX_DESVIO_VERTICAL = 60; // si el dedo se movió mucho en vertical, es scroll, no swipe

export default function SwipeNavigator({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sesion, setSesion] = useState<SesionInterna | null>(null);
  const inicioRef = useRef<{ x: number; y: number } | null>(null);
  const bloqueadoRef = useRef(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setSesion(d.sesion ?? null))
      .catch(() => setSesion(null));
  }, [pathname]);

  useEffect(() => {
    // Si el gesto empieza sobre un elemento con scroll horizontal propio
    // (una tabla ancha, por ejemplo), lo dejamos hacer su scroll normal en
    // vez de interpretarlo como un swipe de navegación.
    function esElementoConScrollHorizontal(el: EventTarget | null): boolean {
      let nodo = el as HTMLElement | null;
      let saltos = 0;
      while (nodo && saltos < 8) {
        if (nodo.scrollWidth > nodo.clientWidth + 4) return true;
        nodo = nodo.parentElement;
        saltos++;
      }
      return false;
    }

    function onTouchStart(e: TouchEvent) {
      if (window.innerWidth >= 768) return; // solo en celular
      const t = e.touches[0];
      inicioRef.current = { x: t.clientX, y: t.clientY };
      bloqueadoRef.current = esElementoConScrollHorizontal(e.target);
    }

    function onTouchEnd(e: TouchEvent) {
      const inicio = inicioRef.current;
      inicioRef.current = null;
      if (!inicio || bloqueadoRef.current) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - inicio.x;
      const dy = t.clientY - inicio.y;
      if (Math.abs(dx) < UMBRAL_PX || Math.abs(dy) > MAX_DESVIO_VERTICAL) return;

      const tabs = ORDEN_TABS.filter((tb) => sesion && tb.visible(sesion.rol));
      const idx = tabs.findIndex((tb) => tb.href === pathname);
      if (idx === -1) return;

      if (dx < 0 && idx < tabs.length - 1) {
        router.push(tabs[idx + 1].href);
      } else if (dx > 0 && idx > 0) {
        router.push(tabs[idx - 1].href);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, sesion, router]);

  return <>{children}</>;
}
