// Integraciones reales de la plataforma (trust bar demo-led).
// GPS: los 28 proveedores del snapshot de operación real + Samtech y Targa
// (piloto GAMA). Logos oficiales descargados y verificados; los que no tienen
// asset van como wordmark. `invert`: logo blanco → se invierte sobre fondo claro.
// TECH: plataformas que la propia página declara en su stack.

export type PartnerLogo = { name: string; href?: string; img?: string; invert?: boolean };

export const GPS_PARTNERS: readonly PartnerLogo[] = [
  { name: "Onway · Entel Digital", href: "https://enteldigital.cl/onway", img: "/partners/onway.svg" },
  { name: "BlackGPS", href: "https://blackgps.cl" },
  { name: "Samtech", href: "https://samtech.cl", img: "/partners/samtech.png", invert: true },
  { name: "Rastreosat by Redd", href: "https://rastreosat.cl", img: "/partners/rastreosat.png" },
  { name: "Targa Telematics", href: "https://targatelematics.com", img: "/partners/targa.png" },
  { name: "Wisetrack", href: "https://wisetrack.cl", img: "/partners/wisetrack.png" },
  { name: "Sitrack", href: "https://www.sitrack.cl", img: "/partners/sitrack.svg", invert: true },
  { name: "GPS Chile", href: "https://www.gpschile.com", img: "/partners/gpschile.png" },
  { name: "Michelin Connected Fleet", href: "https://connectedfleet.michelin.com", img: "/partners/michelin.png" },
  { name: "Webfleet", href: "https://www.webfleet.com", img: "/partners/webfleet.svg" },
  { name: "CoPiloto · Kaufmann", href: "https://copiloto.cloud", img: "/partners/copiloto.png" },
  { name: "Bermann GPS", href: "https://www.bermanngps.cl", img: "/partners/bermann.png" },
  { name: "Isanto Group", href: "https://www.isanto.cl", img: "/partners/isanto.png", invert: true },
  { name: "Kausana", href: "https://www.kausana.cl", img: "/partners/kausana.svg", invert: true },
  { name: "LAXGPS", href: "https://laxgps.cl", img: "/partners/laxgps.webp" },
  { name: "Rolbox GPS", href: "https://www.rolboxgps.com", img: "/partners/rolbox.png", invert: true },
  { name: "Sicom Chile", href: "https://sicomchile.cl", img: "/partners/sicom.png" },
  { name: "TrackTec", href: "https://tracktec.cl", img: "/partners/tracktec.png" },
  { name: "VisionID", href: "https://www.visionid.cl", img: "/partners/visionid.png", invert: true },
  { name: "Geoaustral", href: "https://geoaustralchile.cl", img: "/partners/geoaustral.png" },
  { name: "GoTrack GPS", href: "https://gotrackgps.com", img: "/partners/gotrack.png" },
  { name: "Epol", href: "https://www.epol.cl", img: "/partners/epol.png" },
  { name: "Control Position", href: "https://www.controlposition.cl", img: "/partners/controlposition.svg" },
  { name: "Position", href: "https://position.cl", img: "/partners/position.png" },
  { name: "OneLogis", href: "https://onelogis.com", img: "/partners/onelogis.png" },
  { name: "Galileo GPS", href: "https://galileochile.cl", img: "/partners/galileo.svg" },
  { name: "GPS Global", href: "https://w3.gpsglobal.cl", img: "/partners/gpsglobal.png" },
  { name: "Digiplus", href: "https://www.digiplus.cl", img: "/partners/digiplus.png", invert: true },
  { name: "Waypoint GO", href: "https://www.waypoint-go.com", img: "/partners/waypoint.png", invert: true },
  { name: "Fleet2Track" },
];

export const TECH_PARTNERS: readonly PartnerLogo[] = [
  { name: "AWS", href: "https://aws.amazon.com", img: "/partners/aws.svg" },
  { name: "Microsoft Azure", href: "https://azure.microsoft.com", img: "/partners/azure.svg" },
  { name: "Google Cloud", href: "https://cloud.google.com", img: "/partners/gcloud.svg" },
  { name: "PostgreSQL", href: "https://www.postgresql.org", img: "/partners/postgresql.svg" },
  { name: "Apache Pulsar", href: "https://pulsar.apache.org", img: "/partners/pulsar.svg" },
  { name: "n8n", href: "https://n8n.io", img: "/partners/n8n.svg" },
  { name: "WhatsApp", href: "https://www.whatsapp.com", img: "/partners/whatsapp.svg" },
  { name: "Microsoft Teams", href: "https://www.microsoft.com/microsoft-teams", img: "/partners/teams.svg" },
  { name: "Webex", href: "https://www.webex.com", img: "/partners/webex.svg" },
];
