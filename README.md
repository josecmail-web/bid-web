# BID · Build Invest Direct — web app

Implementación del handoff de diseño (`BID WEBAPP/design_handoff_bid_webapp`): partidas de obra a puja ciega entre promotoras e industriales verificados.

**Stack:** Next.js 16 (App Router, Server Components + Server Actions) · TypeScript · Drizzle ORM sobre Postgres (PGlite embebido en local) · CSS plano sobre los tokens del design system Industry (`src/styles/industry.css`) · SheetJS (en servidor) · Lucide.

## Arrancar

```bash
cp .env.example .env.local   # ya existe en este equipo
npm install
npm run dev                  # http://localhost:3000
```

Sin `DATABASE_URL` se usa **PGlite** (Postgres en WASM) en `BID_DATA_DIR/pglite`: no hay que instalar nada. Las migraciones de `drizzle/` se aplican al arrancar y, con `BID_DEMO=1`, la BD vacía se siembra con datos de ejemplo.

> El proyecto vive en `~/Proyectos/bid-web` (fuera de iCloud: en `~/Documents` el disco era tan lento que Next no llegaba a arrancar). `.env.local` guarda los datos en `~/.bid-data`. No lo vuelvas a poner dentro de Documents/Escritorio si están sincronizados con iCloud.

Cuentas de demo (contraseña `bid-demo-2026`): `compras@grupolevante.es` (promotora), `obras@hidroturia.es` (industrial), `equipo@bid.es` (admin). En modo demo hay selector de rol en la cabecera, "Entrar como administrador" y "Restablecer datos de demo" en el acceso.

| Script | |
| --- | --- |
| `npm run db:generate` | genera una migración SQL en `drizzle/` tras cambiar `src/server/db/schema.ts` |
| `BID_DEMO=1 npm run db:seed` | vacía y vuelve a sembrar la BD de demo (con el servidor parado si usas PGlite; sin BID_DEMO=1 se niega) |

### Variables de entorno

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres de producción (Neon, Supabase, RDS…). Si falta, PGlite local. |
| `BID_DATA_DIR` | carpeta para PGlite y ficheros subidos (por defecto `.data`) |
| `RESEND_API_KEY` | clave de Resend. Sin ella, los emails se escriben en la consola del servidor |
| `EMAIL_FROM` | remitente (`BID <avisos@tudominio.es>`, dominio verificado en Resend; sin dominio: `onboarding@resend.dev`) |
| `EMAIL_REDIRECT_TO` | desvía todos los emails a una dirección (desarrollo/demo). Sin ella, nunca se envía a `@*.bid-demo.es` |
| `APP_URL` | URL pública para los enlaces de los emails (si falta, se usa el host de la petición) |
| `BID_DEMO` | `1` = siembra automática + atajos de demo. **Quitar en producción.** |

## Despliegue (Railway)

Servidor Node (`npm run build` + `npm start`, ver `railway.json`) con Postgres gestionado y un volumen para los ficheros subidos. Las migraciones se aplican al arrancar; `/api/health` es la comprobación de salud.

1. Proyecto nuevo en Railway → **Deploy from GitHub repo** (este repositorio). Región: Europa.
2. **+ New → Database → PostgreSQL** en el mismo proyecto.
3. En el servicio de la app, **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia a la base de datos)
   - `BID_DATA_DIR` = `/data`
   - `BID_DEMO` = `1` (instancia de demo para entrevistas: siembra datos y muestra los atajos)
   - `SITE_PASSWORD` = contraseña para ver la demo (acceso HTTP básico; cualquier usuario)
   - `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REDIRECT_TO` (ver *Variables de entorno*)
   - `APP_URL` = la URL pública (p. ej. `https://bid-demo.up.railway.app`)
4. **Settings → Volumes**: añadir un volumen montado en `/data`.
5. **Settings → Networking → Generate Domain** (o dominio propio).

Cada `git push` a `main` despliega de nuevo. Antes de cada entrevista conviene pulsar **Restablecer datos de demo** en el acceso: los paquetes abiertos de la demo cierran a los pocos días.

> Piloto real: otra instancia con `BID_DEMO` sin definir (sin datos de ejemplo ni atajos), dominio propio verificado en Resend y sin `EMAIL_REDIRECT_TO`.

| Variable | |
| --- | --- |
| `SITE_PASSWORD` | si está definida, toda la web pide esa contraseña (HTTP básico). Para demos privadas |

## Arquitectura

```
src/server/db/schema.ts    modelo de datos (empresas, usuarios, sesiones, documentos, certificados,
                           obras, paquetes, partidas, pujas, valoraciones, reportes, notificaciones)
src/server/db/index.ts     conexión (PGlite | Postgres) + migraciones + sembrado demo
src/server/db/seed*.ts     datos de demo (coherentes: valoraciones que promedian lo del diseño, pujadores reales)
src/server/auth.ts         sesiones (token aleatorio, sha256 en BD, cookie httpOnly 30 días), guards por rol
src/server/password.ts     scrypt
src/server/queries.ts      lecturas → DTOs para la UI (aquí se aplica la puja ciega)
src/server/eligibility.ts  quién puede pujar un paquete (oficio + certificados vigentes + valoración mínima)
src/server/actions/*.ts    Server Actions: auth, promotora, industrial, admin
src/server/storage.ts      ficheros (driver local; claves con permiso codificado)
src/server/notify.ts       crea avisos in-app + email (asunto y botón según el tipo)
src/server/mail.ts         envío por Resend (API HTTP, un email por destinatario, HTML + texto) o consola si no hay clave
src/server/notifications.ts  lectura de avisos; campana en components/NotificationBell.tsx (se refresca al navegar y cada minuto)
src/server/excel.ts        Excel en servidor: mediciones, plantilla, hoja de presupuesto (export) y lectura de precios
src/lib/prices.ts          casado de una hoja de precios con las partidas (por código, tolera "1" ≈ "01"; formato español)
src/lib/                   código compartido: tipos/DTOs, catálogo, reglas de validación, importador puro, formato
src/app/                   páginas (Server Components) + componentes cliente por pantalla
```

Las páginas son Server Components que validan la sesión y el rol (`requirePage`) y pasan DTOs a un componente cliente. Las mutaciones son Server Actions que vuelven a validar sesión, rol y reglas (`requireAction`), y refrescan la vista con `refresh()`.

### Reglas que se cumplen en el servidor

- **Puja ciega**: mientras un paquete está abierto, la promotora solo recibe el nº de sobres; ni importes ni identidades salen del servidor. El industrial solo ve su propia oferta (nunca el nº de pujas ni, tras adjudicar, quién ganó ni por cuánto). El paso `abierta → evaluacion` ocurre al pasar `closes_at` (se comprueba en cada lectura/acción).
- **Verificación**: una empresa pendiente puede entrar pero no publicar ni pujar.
- **Certificados y acceso**: un industrial solo puede pujar si trabaja el oficio, tiene todos los certificados exigidos validados y vigentes, y cumple la valoración mínima. Al publicar se notifica solo a esos industriales.
- **Adjudicación**: solo el propietario, solo en evaluación, una única vez; aviso al ganador y "no adjudicada" (sin importes) al resto.
- **Comisión por adjudicación** (`src/lib/pricing.ts`): 1 % del importe adjudicado sin IVA, mínimo 50 € y máximo 1.500 €, a cargo del industrial adjudicatario. Cada adjudicación registra su comisión en `award_fees`. Con `PILOT = true` queda como «exenta · piloto» (cobrado 0 €) y el admin ve en la pestaña Comisiones lo que se habría facturado. El industrial ve la estimación al pujar y el importe en la obra ganada, en el aviso y en el email. Las condiciones de uso (`/condiciones`, borrador pendiente de revisión legal) se aceptan al registrarse o al unirse por invitación, y se guarda la versión y la fecha por usuario.
- **Valoraciones**: solo la promotora dueña de un paquete adjudicado valora al adjudicatario, una vez (restricción única en BD) y sin edición posterior. El industrial puede reportar cada valoración una vez; admin la mantiene u oculta. Las medias se calculan siempre sobre las valoraciones no ocultas.
- **Cuentas**: CIF/NIF/NIE con dígito de control; contraseñas con scrypt, mínimo 8 y sin las más comunes; login limitado (5 fallos por email o 30 por IP en 15 min); recuperar contraseña con enlace de un solo uso que caduca en 1 h y respuesta idéntica exista o no la cuenta; cambiar o restablecer la contraseña cierra las demás sesiones; invitaciones a la empresa válidas 7 días. Los tokens se guardan como sha256.
- **Cabeceras**: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS en producción.
- **Ficheros**: `/api/files/…` exige sesión; logotipos visibles para todos, PDFs solo para la empresa propietaria y admin; SVG servidos con CSP `sandbox`.

### Rutas

| Ruta | Pantalla |
| --- | --- |
| `/login`, `/registro` | Acceso y alta de empresa (con subida real de PDFs) |
| `/recuperar`, `/restablecer/[token]` | Recuperar contraseña |
| `/invitacion/[token]` | Aceptar una invitación al equipo de una empresa |
| `/cuenta` | Mi cuenta: datos de la empresa, equipo (invitar / quitar) y cambiar contraseña |
| `/partidas`, `/partidas/[id]` | Promotora · listado y detalle (sobres / comparativa / ranking / adjudicación) |
| `/partidas/nueva` (`?borrador=LIC-…`) | Asistente: obra + adjuntos, Excel → partidas por sector, condiciones, publicar |
| `/industrial/paquetes` | Industrial · paquetes abiertos de sus oficios (con acceso / sin acceso y qué le falta) |
| `/industrial/paquetes/[id]` | Detalle + presupuesto por partidas (total en vivo, borrador local, confirmación, editable hasta el cierre; resultado tras el cierre). Excel: descargar partidas para presupuestar / subir precios |
| `/industrial/pujas` | Mis pujas: estado, mi oferta, adjudicadas / no adjudicadas |
| `/industrial/perfil` | Industrial · acceso a oficios y certificados (alta con PDF + logo) |
| `/admin/[tab]` | Verificaciones, certificados, partidas, valoraciones reportadas |
| `/api/files/[...key]`, `/api/plantilla` | Ficheros con control de acceso · plantilla .xlsx de mediciones |
| `/api/paquetes/[id]/excel` | Excel de presupuesto del paquete (industrial con acceso; incluye sus precios si ya pujó) |

## Pendiente

- Al terminar el piloto: `PILOT = false`, avisar con 30 días de antelación (condiciones §4) y facturar/cobrar las comisiones `pending` (Stripe o factura + domiciliación). Si cambian las condiciones, subir `TERMS_VERSION` y pedir la aceptación a los usuarios existentes.

- Pantallas del industrial (paquetes, puja, mis pujas) construidas sin diseño previo, sobre el sistema Industry: revisar con diseño.
- Preferencias de aviso por empresa (hoy se envía email de todos los avisos); dominio propio verificado en Resend.
- Driver **S3** para ficheros; job programado de cierre y de avisos de caducidad de certificados.
- Invitaciones (`scope = invitacion`), radio de trabajo en la elegibilidad, importación desde PDF/BC3.
- CSP estricta (con nonces) y 2FA opcional; comprobar contraseñas contra filtraciones conocidas (Have I Been Pwned).
- Roles dentro de la empresa (hoy todos los miembros pueden todo).
- Validar con el cliente la tabla de requisitos por oficio; logo en SVG.
