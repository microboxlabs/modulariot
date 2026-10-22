"use client";

import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  PlacesCatalogLists,
  PlacesImportCard,
  PANEL_LUGARES,
  PlacesStackedFormCards,
  type GeocercaExterna,
  type PlacesWorkspace,
} from "@/features/places";
import { ExpandPanel, GrowPanel } from "./panel-motion";

export default function PlacesFloatingOverlay({
  dict,
  ws,
  show,
  externas,
  className,
}: Readonly<{
  dict: I18nRecord;
  ws: PlacesWorkspace;
  show: boolean;
  /** Otra sección de solo lectura en la lista (p. ej. geocercas del viaje). */
  externas?: { titulo: string; items: GeocercaExterna[] };
  /** Para mapas con capas propias encima (p. ej. un z mayor). */
  className?: string;
}>) {
  const formPantallaCompleta = ws.modo === "lugar" || ws.modo === "trayecto";

  return (
    // barra lateral AL LADO del mapa (no encima), de alto completo: al
    // abrirse el mapa se angosta, así su centro es el centro de lo que se ve.
    // Ella misma es la superficie (blanca), sin tarjetas dentro. Los menús y
    // barras de dibujo van sobre el mapa: ver PlacesEditorOverlays.
    <ExpandPanel
      show={show}
      width={PANEL_LUGARES.ancho}
      className={twMerge(
        "pointer-events-auto relative z-40 h-full shrink-0 border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
        className
      )}
    >
      <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
        <GrowPanel
          show={ws.modo === "lugar" || ws.modo === "trayecto"}
          className={formPantallaCompleta ? "min-h-0 flex-1" : undefined}
        >
          <PlacesStackedFormCards ws={ws} dict={dict} />
        </GrowPanel>
        <GrowPanel
          show={
            !!ws.msg &&
            ws.modo !== "lugar" &&
            ws.modo !== "trayecto" &&
            ws.modo !== "import"
          }
        >
          {/* aviso: una franja de lado a lado, no una tarjeta */}
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            {ws.msg}
          </div>
        </GrowPanel>
        {!formPantallaCompleta && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
            {ws.modo === "import" ? (
              <PlacesImportCard ws={ws} />
            ) : (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {tr("geographic_view.places.title", dict)}
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {ws.puedeEditar === false
                      ? tr("geographic_view.places.hint_read_only", dict)
                      : tr("geographic_view.places.hint", dict)}
                  </p>
                </div>
                <PlacesCatalogLists
                  ws={ws}
                  externas={externas}
                  className="min-h-0 flex-1"
                />
              </>
            )}
          </div>
        )}
      </div>
    </ExpandPanel>
  );
}
