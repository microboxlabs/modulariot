"use client";

// Acciones rápidas del header del SuperProfile (doc rector §1): Editar,
// Asignar, Registrar documento, Ver perfil GxC. Header y paneles no se
// conocen entre sí — se comunican por CustomEvent; cada sección escucha
// su acción, se abre y se trae a la vista (scrollIntoView).
import {
  HiOutlinePencilSquare, HiOutlineUserPlus, HiOutlineDocumentPlus, HiOutlineChartBar,
} from "react-icons/hi2";

export type AccionRapida = "sp:editar" | "sp:asignar" | "sp:doc";

export const emitirAccion = (accion: AccionRapida) =>
  window.dispatchEvent(new CustomEvent(accion));

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap";

export function AccionesRapidas({ tipo, gxcId, lang }: {
  tipo: "TRUCK" | "DRIVER"; gxcId: string; lang: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button className={btn} onClick={() => emitirAccion("sp:editar")}>
        <HiOutlinePencilSquare className="w-4 h-4" /> Editar
      </button>
      <button className={btn} onClick={() => emitirAccion("sp:asignar")}>
        <HiOutlineUserPlus className="w-4 h-4" />
        {tipo === "TRUCK" ? "Asignar conductor" : "Asignar camión"}
      </button>
      <button className={btn} onClick={() => emitirAccion("sp:doc")}>
        <HiOutlineDocumentPlus className="w-4 h-4" /> Registrar documento
      </button>
      <a className={btn}
         href={`/app/${lang}/gxc/${tipo === "TRUCK" ? "camion" : "conductor"}/${encodeURIComponent(gxcId)}?dias=28`}>
        <HiOutlineChartBar className="w-4 h-4" /> Perfil GxC
      </a>
    </div>
  );
}
