// Integraciones reales de la plataforma (trust bar demo-led).
// Mintral va primero: es cliente real (antes vivía solo, en la sección
// "Trusted by", ahora consolidada acá). El resto son los 28 proveedores GPS
// del snapshot de operación real + Samtech y Targa (piloto GAMA). Logos
// oficiales descargados y verificados; los que no tienen asset van como
// wordmark. `invert`: logo blanco → se invierte sobre fondo claro.

// `tall`: el logo trae varios elementos apilados (escudo + wordmark +
// tagline) y a la altura compartida del carrusel se lee chico aunque ya
// esté recortado al contenido — se le da un poco más de alto solo a él.
import type { PartnerLogo } from "./partners-data.types";

export const GPS_PARTNERS: readonly PartnerLogo[] = [
  {
    name: "Mintral",
    href: "https://www.mintral.cl/",
    img: "/clients/mintral-logo.png",
  },
  {
    name: "Onway · Entel Digital",
    href: "https://enteldigital.cl/onway",
    img: "/partners/onway.svg",
  },
  { name: "BlackGPS", href: "https://blackgps.cl" },
  {
    name: "Samtech",
    href: "https://samtech.cl",
    img: "/partners/samtech.png",
    invert: true,
  },
  {
    name: "Rastreosat by Redd",
    href: "https://rastreosat.cl",
    img: "/partners/rastreosat.png",
  },
  {
    name: "Targa Telematics",
    href: "https://targatelematics.com",
    img: "/partners/targa.png",
  },
  {
    name: "Wisetrack",
    href: "https://wisetrack.cl",
    img: "/partners/wisetrack.png",
  },
  {
    name: "Sitrack",
    href: "https://www.sitrack.cl",
    img: "/partners/sitrack.svg",
    invert: true,
  },
  {
    name: "GPS Chile",
    href: "https://www.gpschile.com",
    img: "/partners/gpschile.png",
  },
  {
    name: "Michelin Connected Fleet",
    href: "https://connectedfleet.michelin.com",
    img: "/partners/michelin.png",
  },
  {
    name: "Webfleet",
    href: "https://www.webfleet.com",
    img: "/partners/webfleet.svg",
  },
  {
    name: "CoPiloto · Kaufmann",
    href: "https://copiloto.cloud",
    img: "/partners/copiloto.png",
  },
  {
    name: "Bermann GPS",
    href: "https://www.bermanngps.cl",
    img: "/partners/bermann.png",
  },
  {
    name: "Isanto Group",
    href: "https://www.isanto.cl",
    img: "/partners/isanto.png",
    invert: true,
  },
  {
    name: "Kausana",
    href: "https://www.kausana.cl",
    img: "/partners/kausana.svg",
    invert: true,
  },
  { name: "LAXGPS", href: "https://laxgps.cl", img: "/partners/laxgps.webp" },
  {
    name: "Rolbox GPS",
    href: "https://www.rolboxgps.com",
    img: "/partners/rolbox.png",
    invert: true,
  },
  {
    name: "Sicom Chile",
    href: "https://sicomchile.cl",
    img: "/partners/sicom.png",
  },
  {
    name: "TrackTec",
    href: "https://tracktec.cl",
    img: "/partners/tracktec.png",
    tall: true,
  },
  {
    name: "VisionID",
    href: "https://www.visionid.cl",
    img: "/partners/visionid.png",
    invert: true,
  },
  {
    name: "Geoaustral",
    href: "https://geoaustralchile.cl",
    img: "/partners/geoaustral.png",
  },
  {
    name: "GoTrack GPS",
    href: "https://gotrackgps.com",
    img: "/partners/gotrack.png",
  },
  { name: "Epol", href: "https://www.epol.cl", img: "/partners/epol.png" },
  {
    name: "Control Position",
    href: "https://www.controlposition.cl",
    img: "/partners/controlposition.svg",
  },
  {
    name: "Position",
    href: "https://position.cl",
    img: "/partners/position.png",
  },
  {
    name: "OneLogis",
    href: "https://onelogis.com",
    img: "/partners/onelogis.png",
  },
  {
    name: "Galileo GPS",
    href: "https://galileochile.cl",
    img: "/partners/galileo.svg",
  },
  {
    name: "GPS Global",
    href: "https://w3.gpsglobal.cl",
    img: "/partners/gpsglobal.png",
  },
  {
    name: "Digiplus",
    href: "https://www.digiplus.cl",
    img: "/partners/digiplus.png",
    invert: true,
  },
  {
    name: "Waypoint GO",
    href: "https://www.waypoint-go.com",
    img: "/partners/waypoint.png",
    invert: true,
  },
  { name: "Fleet2Track" },
];
