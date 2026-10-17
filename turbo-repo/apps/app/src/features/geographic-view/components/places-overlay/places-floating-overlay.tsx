"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  PlacesCatalogLists,
  PlacesEditorOverlays,
  PlacesImportCard,
  PANEL_LUGARES,
  PlacesStackedFormCards,
  type PlacesWorkspace,
} from "@/features/places";
import { ExpandPanel, GrowPanel } from "./panel-motion";

export default function PlacesFloatingOverlay({
  dict,
  ws,
  show,
}: {
  dict: I18nRecord;
  ws: PlacesWorkspace;
  show: boolean;
}) {
  const formPantallaCompleta = ws.modo === "lugar" || ws.modo === "trayecto";

  return (
    <>
      {show && <PlacesEditorOverlays ws={ws} dict={dict} />}
      {/* barra lateral pegada al borde derecho del mapa, de alto completo
          (como la que tenía esta vista); se despliega a lo ancho */}
      <ExpandPanel
        show={show}
        width={PANEL_LUGARES.ancho}
        className="pointer-events-auto absolute top-0 right-0 bottom-0 z-40 border-l border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        innerClassName="p-3"
      >
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-3">
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
            <div className="rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-300">
              {ws.msg}
            </div>
          </GrowPanel>
          {!formPantallaCompleta && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
              {ws.modo === "import" ? (
                <PlacesImportCard ws={ws} />
              ) : (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {tr("geographic_view.places.title", dict)}
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {tr("geographic_view.places.hint", dict)}
                    </p>
                  </div>
                  <PlacesCatalogLists ws={ws} className="min-h-0 flex-1" />
                </>
              )}
            </div>
          )}
        </div>
      </ExpandPanel>
    </>
  );
}
