# ModularIoT — Landing (alpha-2506) · Handoff a fábrica

Landing comercial de ModularIoT. Sitio Next.js multi-idioma (es · en · pt), enfocado a
tomadores de decisión de monitoreo de flota. Tesis: **"De detectar desviaciones a reducirlas"**.

---

## 1. Stack

| Pieza | Versión / nota |
|---|---|
| Next.js | 16 (App Router, Turbopack) |
| React | 19 |
| Tailwind CSS | 4 (config en `app/globals.css` con `@theme`, **no** `tailwind.config`) |
| flowbite-react | plugin (patch en `postinstall`) |
| framer-motion | animaciones de entrada (`Reveal`) |
| i18n | manual, sin librería (`content.ts` / `content.en.ts` / `content.pt.ts`) |

## 2. Cómo correr

```bash
cd app
npm install
npm run dev        # http://localhost:3041 (puerto oficial de apps/web)
npm run build      # build de producción
npm run start      # servir el build (también :3041)
npm run check-types
```
Docker: hay `Dockerfile` listo en `app/`.
Variables de entorno: **ninguna requerida hoy** (el formulario usa `mailto:`).

## 3. Rutas

Todo cuelga de `app/app/alpha-2506/[lang]/` con `[lang]` = `es | en | pt`.

| Ruta | Contenido |
|---|---|
| `/alpha-2506/[lang]` | Home (hero, tesis 3 actos, features, casos, precios teaser, FAQ, CTA) |
| `/precios` | Matriz de precios (síntomas × capacidades) + calculadora "a medida" |
| `/torre` · `/superprofile` · `/canales` · `/proveedores-gps` | 4 módulos en vivo entrelazados (barra `ModuleTabs`) |
| `/contacto` | Formulario segmentado (demo / cotizar / general) |
| `/producto/*` · `/soluciones` · `/recursos` | Páginas de detalle (data-driven, `detail-content*.ts`) |
| `/` (raíz) | Splash "coming soon" (noindex) → enlaza a `/alpha-2506/es` |

## 4. Estructura clave

```
app/
├── app/                      # Next App Router
│   ├── page.tsx              # raíz (coming soon)
│   └── alpha-2506/[lang]/
│       ├── layout.tsx        # + DemoFab (botón demo flotante)
│       ├── page.tsx          # home
│       ├── precios/ contacto/ torre/ superprofile/ canales/ proveedores-gps/
│       ├── producto/[...slug] (catch-all → DetailPage)
│       └── globals.css       # tokens Design System (@theme)
├── components/v2/            # todos los componentes
│   ├── content.ts / .en.ts / .pt.ts        # copy por idioma
│   ├── detail-content*.ts                  # páginas de detalle
│   ├── pricing-boxes.ts                     # costos por caja (fuente de verdad de precios)
│   ├── PricingTiers.tsx / PricingCalculator.tsx
│   ├── TorreDeControl · SuperProfile · Canales · GpsProviders · ModuleTabs
│   ├── torre-data.ts / torre-modules-data.ts  # datos (anonimizados, métricas reales)
│   └── ContactForm · DemoFab · Nav · Sections · ...
└── public/                   # logos, favicon
```

## 5. Design System

Basado en el **ModularIoT/Mintral DS** (ver carpeta `design-system/` del repo). Aplicado
globalmente vía tokens semánticos en `globals.css` (`@theme inline`): `bg-page/surface/
surface-2/surface-3`, `border-hairline(-strong)`, `text-ink-1..4`, `accent(-soft/-strong)`
y los semánticos `signal/symptom/action/urgent`. Claro por defecto, **modo oscuro completo**
vía clase `.dark` (Flowbite `ThemeModeScript` + `DarkThemeToggle`). CTA primaria **en tinta**
(nunca azul: el azul Flowbite `#1C64F2` es acento), titulares Inter semibold con tracking
`-0.025em`, mono para vocabulario operacional. Sin gradientes; íconos SVG (sin emoji).

### Logo "the Lynx"

Assets generados desde geometría (razón áurea) con `node scripts/generate-logo.mjs`:
`public/headlogo.svg` (adaptativo `prefers-color-scheme`), `public/headlogo-dark.svg`,
`public/logo.svg` / `logo-dark.svg` (lockup kerneado, "IoT" en ámbar), `app/icon.svg`
y `components/v2/brand/lynx-geometry.ts` (datos para los componentes React
`LynxMark` / `LynxWordmark` / `LynxLockup` en `components/v2/brand/Logo.tsx`, que siguen
el tema vía `currentColor` + `--brand-amber`: ámbar `#E08A28` claro / `#F5AE55` oscuro,
tinta `#13273D` / `#E8EFF7`).

## 6. Datos

- `torre-data.ts` y `torre-modules-data.ts` contienen **métricas reales** de una operación
  (Mintral, junio 2026) con los **nombres anonimizados** ("Transportista N", "Ruta N",
  "Conductor N", "Proveedor N"). Confidencialidad: **no reponer nombres reales**.
- Generados desde la herramienta `sistema_resolucion_operacional` (fuera de este repo).

## 7. Estado vs revisión comercial (jul 2026)

| Item | Estado |
|---|---|
| Textos (escalamiento; sin "bóveda de evidencia") | ✅ |
| Anonimizar rutas/transportistas/conductores/proveedores | ✅ |
| Colores + logo alineados al DS | ✅ |
| Botón "Solicitar demo" flotante | ✅ |
| Opciones de implementación (SaaS / tu nube / on-premise) | ✅ |
| Nota "datos GPS reales, no simulados" | ✅ |
| Prueba social (testimonios anónimos + banda de métricas) | ✅ |
| Precios: calculadora síntomas×capacidades (Detección·Gestión·Automatización) | ✅ |
| Logo nuevo "the Lynx" (nav/footer/splash/lockup) + favicon | ✅ |
| Reemplazar snippets de código dev por visuales de negocio (hero + home + detalle) | ✅ |
| i18n total de módulos (Torre/SuperProfile/Canales/GPS + PricingTiers) en es·en·pt | ✅ |
| Implementación: de "3 opciones" a "qué incluye" (edge/híbrido → integración vía API) | ✅ |
| Recursos / Blog (teaser "próximamente") | ✅ |
| Íconos de producto | ⏳ (Rodrigo) |
| POC QR (Abastible) | ⏳ track técnico aparte (fuera de la web) |
| `<title>`/metadata de páginas en ES fijo · locale numérico es-CL en módulos | ⬜ pulido menor |

## 8. TODOs para fábrica (backend / integración)

1. **Formulario de contacto** → hoy arma un `mailto:` estructurado (`ContactForm.tsx`).
   Reemplazar por **webhook n8n / CRM** para captura real de leads.
2. **Precios** → montos derivados de `pricing-boxes.ts` (márgenes: base 92.8 %,
   síntomas 95.5 %, `REF_FLOTA=5000`). Definir si se publican o se ocultan tras "cotizar".
3. **i18n de módulos** → ✅ resuelto: datos traducidos en `torre-data.{en,pt}.ts` /
   `torre-modules-data.{en,pt}.ts` (mismos números, solo strings), resueltos por
   `module-i18n.ts` (`getTorre`/`getModules`) y cableados con `useLang` en los 5
   componentes. Pendiente menor: `<title>`/metadata de cada `page.tsx` sigue en ES;
   el formato numérico usa locale `es-CL` en todos los idiomas.
4. **Logo/favicon** → ✅ resuelto: logo "the Lynx" (búho golden-ratio) generado desde
   geometría en `headlogo-dark.svg` (dark), `headlogo.svg` (light), `logo.svg` (lockup),
   `app/icon.svg` + `app/favicon.ico` + `public/apple-icon.png`.
5. **Deploy** → Vercel o Docker. Revisar `metadata` y `canonical` en
   `alpha-2506/[lang]/layout.tsx` antes de producción.
