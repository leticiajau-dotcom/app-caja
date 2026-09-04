export const metadata = {
  title: "Política de Privacidad",
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-2xl mx-auto mt-10 mb-16 space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-madera-800">
          Política de Privacidad
        </h1>
        <p className="text-madera-500 text-sm mt-1">
          Última actualización: {new Date().toLocaleDateString("es-AR")}
        </p>
      </div>

      <div className="card space-y-4 text-sm text-madera-700 leading-relaxed">
        <p>
          Esta aplicación ("Caja Negocio") es una herramienta de uso interno
          para la gestión de caja de un negocio: registro de ingresos,
          egresos, cuentas, clientes y usuarios autorizados. No es un
          producto público ni está destinada a usuarios externos al negocio.
        </p>

        <div>
          <h2 className="font-semibold text-madera-800 mb-1">
            Qué información se guarda
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Datos de los usuarios autorizados de la app: nombre y un PIN de
              acceso (el PIN se guarda siempre cifrado, nunca en texto
              plano).
            </li>
            <li>
              Datos operativos cargados por el negocio: cuentas, movimientos
              de caja, clientes y proyectos.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-madera-800 mb-1">
            Dónde se guarda
          </h2>
          <p>
            Toda la información se guarda en una planilla de Google Sheets
            que es propiedad del negocio, dentro de su propia cuenta de
            Google Drive. La aplicación no usa ninguna base de datos externa
            ni almacena copias de la información en otro lugar.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-madera-800 mb-1">
            Acceso a Google
          </h2>
          <p>
            La app se conecta a Google (mediante OAuth) únicamente para leer
            y escribir en esa planilla, en nombre del negocio. Esta conexión
            la autoriza el administrador del negocio una única vez; el resto
            de las personas que usan la app lo hacen con un usuario y PIN
            propios de la aplicación, sin iniciar sesión con Google.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-madera-800 mb-1">
            Con quién se comparte
          </h2>
          <p>
            La información no se comparte, vende ni cede a terceros. Solo
            acceden a ella las personas autorizadas por el administrador del
            negocio dentro de la propia aplicación.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-madera-800 mb-1">Contacto</h2>
          <p>
            Ante cualquier consulta sobre esta política o sobre los datos
            guardados, podés escribir a{" "}
            <a
              href="mailto:leticiajau@gmail.com"
              className="text-madera-700 underline"
            >
              leticiajau@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
