import { redirect } from "next/navigation";
import { isGoogleConnected } from "@/lib/googleSheets";
import { obtenerSesion } from "@/lib/internalSession";
import { listarUsuarios } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isGoogleConnected()) {
    redirect("/conectar");
  }

  let hayUsuarios = true;
  try {
    hayUsuarios = (await listarUsuarios()).length > 0;
  } catch {
    redirect("/conectar");
  }
  if (!hayUsuarios) {
    redirect("/login?bootstrap=1");
  }

  const sesion = await obtenerSesion();
  redirect(sesion ? "/dashboard" : "/login");
}
