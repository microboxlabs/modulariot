# Dashboard de facturación embebido

[English](README.md)

Ejemplo ejecutable sin React en el host, Next.js, Alfresco ni Java. Consulta el
servidor de dashboards y muestra widgets de texto, porcentaje y estadística
circular, selección de servicio y actualización. El resumen, la tabla y la búsqueda
son código del host; no equivalen al catálogo completo de tablas o al editor portátil.

## Ejecutar

Requiere Node 22+, un servidor con la consulta guardada de facturación y el paquete
UI compilado o extraído de su tarball candidato. Estas API aún son candidatas;
el ejemplo no implica que ya exista una versión publicada en npm.

1. Compila `@microboxlabs/miot-dashboard-ui` o extrae su tarball en una carpeta privada.
2. Desde esta carpeta ejecuta `UI_PACKAGE_DIR=../../packages/miot-dashboard-ui npm run prepare:ui`.
3. Copia `.env.example` a `.env`. Configura servidor, tenant, ámbito, dashboard,
   consulta y rutas privadas. La clave de firma debe ser reconocida por el servidor;
   la identidad debe tener rol **Consumer** y acceso a la consulta configurada.
4. Genera un código de acceso y un secreto de sesión diferentes fuera del repositorio:
   `openssl rand -base64 32 > /ruta/privada/access-password` y
   `openssl rand -base64 48 > /ruta/privada/session-secret`. Usa permisos 0600.
5. Inicia con `node --env-file=.env server.mjs`. Abre
   `http://127.0.0.1:14004/dashboard-demo/` e ingresa el código de acceso.

La consulta debe declarar la variable `costs` y devolver `service` y `net_cost`.
Las etiquetas suponen los últimos 30 días en USD: configura la operación del servidor
con ese período o adapta las etiquetas. El proxy usa una consulta fija con filtros
vacíos. La selección, las sumas y la búsqueda se aplican a los resultados autorizados.
No se permite SQL arbitrario ni acceso a otras rutas del servidor.

## Integración y despliegue

`public/demo.js` utiliza `mountDashboard` y las fábricas del mismo runtime del
navegador. Otro framework puede suministrar esas mismas opciones. `update` cambia
la selección y `destroy` libera la instancia. La identidad de consulta es de solo lectura.

El proxy Node mantiene la firma JWT en el servidor. El navegador nunca recibe la
clave de firma ni credenciales de BigQuery. Configura `PUBLIC_ORIGIN` con el origen
HTTPS externo exacto y `BASE_PATH` con el prefijo de la ruta. Mantén el servidor de
dashboards privado y monta los secretos en modo de solo lectura. La ruta de salud
es `/healthz`.

Este acceso por código privado no sustituye SSO de producción. Usa cookies
HttpOnly/SameSite con vencimiento, Secure cuando el origen es HTTPS. El compilador
Handlebars requiere actualmente `unsafe-eval` en CSP. No se expone edición de
dashboards ni administración de permisos. No publiques `.env`, claves ni códigos.

### Ingress y validación

Para acceso directo deje `TRUSTED_PROXY_IPS` vacío: se ignoran los encabezados reenviados.
Detrás de un ingress, configure las IP exactas de los proxies inmediatos, separadas
por comas, y haga que esos proxies sobrescriban `X-Real-IP` con la dirección real
del cliente. No confíe por defecto en encabezados del cliente ni en redes completas.
Actualice la lista cuando cambien los pods del proxy. Un encabezado ausente o inválido
usa la dirección del socket, que puede compartir un contador; configure el ingress
antes de exponer la demo. El limitador mantiene como máximo 2.048 identidades,
vence los intentos fallidos tras diez minutos y funciona por réplica. Use un
limitador compartido o del ingress si despliega varias réplicas.

Ejecute `npm test` para probar autenticación HTTP, origen, cookies, rutas,
confianza del proxy, límites de almacenamiento y agregación de servicios duplicados.
Las pruebas generan claves temporales y usan un upstream local simulado; la
integración de facturación requiere un servidor real configurado. Las filas se
agrupan por servicio antes de calcular totales, cantidades y participaciones.
