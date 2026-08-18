# Caja Negocio

Aplicación web para llevar el control de caja de un negocio: ingresos,
egresos, múltiples cuentas (efectivo, bancos, billeteras virtuales, cuentas
en otras monedas, las que hagan falta), varios usuarios, saldos por cuenta y
por usuario, y arqueo general. **Todos los datos se guardan en una planilla
de Google Sheets**, en el Google Drive del negocio — no hay una base de
datos aparte que administrar.

## Cómo está pensada

- **La planilla de Google Sheets es la base de datos.** Tiene 4 pestañas:
  `Usuarios`, `Cuentas`, `Movimientos` y `Configuracion`. Se puede abrir y
  mirar en cualquier momento desde Google Drive.
- **Conexión con Google (una sola vez).** El dueño del negocio conecta su
  cuenta de Google desde `/conectar` para autorizar el acceso a Sheets/Drive
  y crear la planilla. A partir de ahí, la app queda conectada mediante un
  "refresh token" guardado en las variables de entorno del servidor — los
  empleados **no** necesitan cuenta de Google ni volver a autorizar nada.
- **Login diario simple.** Cada persona que usa la app (dueño, empleados)
  tiene un usuario interno con nombre + PIN de 4 a 8 dígitos. Así cualquiera
  puede registrar movimientos rápido desde el celular o la PC del taller.
- **Cuentas configurables.** Cada cuenta tiene tipo (efectivo, cuenta
  bancaria, billetera virtual, u "otra" con nombre libre), moneda (ARS, USD,
  EUR, BRL o cualquier otra que se escriba) y, opcionalmente, un usuario
  responsable.
- **Saldos y arqueo.** El saldo de cada cuenta es su saldo inicial más los
  ingresos, menos los egresos, más/menos las transferencias. El arqueo
  general se muestra agrupado por moneda (no se suman ARS y USD entre sí,
  para no mezclar valores), en tarjetas que se pueden reordenar arrastrando
  (el orden se recuerda en el navegador).
- **Rectificación de movimientos.** Nunca se edita ni se borra un movimiento
  ya cargado: se anula (queda visible, con quién y por qué) y, opcionalmente,
  se carga uno nuevo ya corregido, enlazado al original. Un administrador
  puede rectificar cualquier movimiento; un empleado solo los que él mismo
  cargó y que todavía no estén anulados.
- **Nombre y logo personalizables** desde **Configuración** (solo admin).
- **Sin límite práctico de movimientos.** Si la pestaña de Movimientos se
  acerca al límite recomendado de filas, la app crea sola una pestaña de
  continuación y sigue funcionando sin cortes.

## 1. Crear las credenciales de Google

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá
   un proyecto nuevo (o usá uno existente).
2. En **APIs y servicios → Biblioteca**, activá:
   - **Google Sheets API**
   - **Google Drive API**
3. En **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (o Interno si tenés Google Workspace).
   - Cargá nombre de la app, tu email, etc.
   - En "Scopes" no hace falta agregar nada a mano (la app los pide).
   - Agregá tu cuenta de Google como **usuario de prueba** si la app queda
     en modo "Testing" (así evitás el proceso de verificación de Google).
4. En **APIs y servicios → Credenciales → Crear credenciales → ID de cliente
   de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - URI de redirección autorizada:
     - Desarrollo: `http://localhost:3000/api/auth/callback/google`
     - Producción: `https://TU-DOMINIO/api/auth/callback/google`
   - Copiá el **Client ID** y el **Client secret**.

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Completá:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: los del paso anterior.
- `NEXTAUTH_URL`: `http://localhost:3000` en desarrollo, o la URL pública en
  producción.
- `NEXTAUTH_SECRET` y `SESSION_SECRET`: generar cada uno con
  `openssl rand -base64 32`.
- `GOOGLE_SHEET_ID` y `GOOGLE_REFRESH_TOKEN`: se completan en el paso 4, **se
  dejan vacíos por ahora**.

## 3. Instalar y correr

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

## 4. Conectar Google Drive y crear la planilla

Como `GOOGLE_SHEET_ID` todavía no está configurado, la app te va a llevar
directo a `/conectar`:

1. Hacé clic en **"Conectar con Google"** e iniciá sesión con la cuenta de
   Google donde querés guardar la planilla (por ejemplo la cuenta del
   negocio).
2. Hacé clic en **"Crear planilla"**. Se crea una planilla llamada
   *"Caja Carpintería"* con las pestañas necesarias.
3. Copiá los valores `GOOGLE_SHEET_ID` y `GOOGLE_REFRESH_TOKEN` que te
   muestra la pantalla y pegalos en tu `.env`.
4. Reiniciá el servidor (`npm run dev` de nuevo, o reiniciá el hosting en
   producción).

## 5. Crear el primer usuario

Al volver a entrar, como la planilla todavía no tiene usuarios, la app pide
crear el primer usuario (queda como **administrador**). Desde ahí ya se
pueden crear cuentas, cargar movimientos, y agregar más usuarios desde
**Usuarios** (solo visible para administradores).

## Publicar en internet (para que la usen varias personas)

La forma más simple es [Vercel](https://vercel.com):

1. Subí este repositorio a GitHub (ya está hecho si estás leyendo esto desde
   ahí).
2. Importá el repo en Vercel.
3. Cargá las mismas variables de entorno del `.env` en la configuración del
   proyecto en Vercel (con `NEXTAUTH_URL` apuntando a la URL de Vercel).
4. Agregá esa misma URL de callback (`https://tu-app.vercel.app/api/auth/callback/google`)
   como URI de redirección autorizada en las credenciales de Google.
5. Desplegá. Los empleados entran desde el link con su nombre y PIN — no
   necesitan hacer nada con Google.

## Estructura del proyecto

```
src/
  app/
    conectar/       Conexión inicial con Google (solo admin, una vez)
    login/          Login interno (usuario + PIN)
    dashboard/      Arqueo general y saldos
    cuentas/        Alta y baja de cuentas
    movimientos/    Carga de ingresos, egresos, transferencias y rectificaciones
    usuarios/       Gestión de usuarios internos (solo admin)
    configuracion/  Nombre y logo de la app (solo admin)
    api/            Endpoints REST usados por las páginas
  lib/
    googleSheets.ts Cliente de Google Sheets/Drive y creación de la planilla
    repo.ts         Lectura/escritura de Usuarios, Cuentas y Movimientos + cálculo de saldos
    internalSession.ts  Sesión de usuario + PIN (cookie firmada)
    auth.ts         Configuración de NextAuth (login con Google, solo para /conectar)
```

## Limitaciones conocidas / próximos pasos posibles

- Los movimientos no se editan ni se borran nunca (por diseño, para mantener
  un historial confiable): se rectifican (ver "Cómo está pensada" arriba).
- Cada moneda se totaliza por separado en el arqueo (no se convierte
  USD → ARS automáticamente). Se podría sumar un tipo de cambio manual si
  hace falta un total único.
- Google Sheets no maneja bien escrituras muy concurrentes (muchas personas
  cargando al mismo segundo); para el uso normal de una carpintería no
  debería ser un problema.
