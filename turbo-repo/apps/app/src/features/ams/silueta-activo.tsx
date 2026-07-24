"use client";

// F5 · Representación visual del activo (doc rector §3, versión liviana):
// silueta vectorial de perfil según el tipo de equipo del maestro AMS.
// Sin 3D ni imágenes: vectores propios, color del tema, mismo lugar donde
// hoy vive el icono genérico del header.
import { useAmsRecord, type AmsTruck } from "./ficha-ams";

const VIA = "fill-blue-600 dark:fill-blue-400";

function PathSilueta({ tipo }: { tipo: string }) {
  switch (tipo) {
    case "tolva":
      return (<>
        <path className={VIA} d="M2 20 L6 12 L20 12 L22 20 Z" />
        <path className={VIA} d="M23 20 L23 10 L30 10 L33 14 L33 20 Z" />
        <circle className={VIA} cx="8" cy="21" r="2.4" />
        <circle className={VIA} cx="16" cy="21" r="2.4" />
        <circle className={VIA} cx="28" cy="21" r="2.4" />
      </>);
    case "cama_baja":
      return (<>
        <rect className={VIA} x="2" y="17" width="20" height="2.5" rx="1" />
        <path className={VIA} d="M23 20 L23 10 L30 10 L33 14 L33 20 Z" />
        <circle className={VIA} cx="6" cy="21" r="2" />
        <circle className={VIA} cx="11" cy="21" r="2" />
        <circle className={VIA} cx="16" cy="21" r="2" />
        <circle className={VIA} cx="28" cy="21" r="2.4" />
      </>);
    case "tracto":
      return (<>
        <path className={VIA} d="M12 20 L12 9 L20 9 L24 14 L24 20 Z" />
        <rect className={VIA} x="8" y="16" width="4" height="4" rx="1" />
        <circle className={VIA} cx="15" cy="21" r="2.6" />
        <circle className={VIA} cx="21" cy="21" r="2.6" />
      </>);
    case "sider":
      return (<>
        <rect className={VIA} x="2" y="9" width="20" height="10" rx="1" />
        <path className="fill-white/30 dark:fill-gray-900/30" d="M4 11 h16 v6 h-16 Z" />
        <path className={VIA} d="M23 20 L23 10 L30 10 L33 14 L33 20 Z" />
        <circle className={VIA} cx="7" cy="21" r="2.4" />
        <circle className={VIA} cx="16" cy="21" r="2.4" />
        <circle className={VIA} cx="28" cy="21" r="2.4" />
      </>);
    default: // rampla / otro
      return (<>
        <rect className={VIA} x="2" y="10" width="20" height="9" rx="1" />
        <path className={VIA} d="M23 20 L23 10 L30 10 L33 14 L33 20 Z" />
        <circle className={VIA} cx="7" cy="21" r="2.4" />
        <circle className={VIA} cx="16" cy="21" r="2.4" />
        <circle className={VIA} cx="28" cy="21" r="2.4" />
      </>);
  }
}

/** Silueta del camión según su tipo en el maestro (fallback: rampla). */
export function SiluetaCamion({ plate }: { plate: string }) {
  const { rec } = useAmsRecord("TRUCK", plate);
  const tipo = (rec as AmsTruck | undefined)?.truck_type ?? "rampla";
  return (
    <div className="flex items-center justify-center w-16 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0"
         title={`Tipo de equipo: ${tipo}`}>
      <svg viewBox="0 0 35 24" className="w-12 h-9" aria-hidden>
        <PathSilueta tipo={tipo} />
      </svg>
    </div>
  );
}
