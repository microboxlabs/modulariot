"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  PlacesCatalogLists,
  PlacesImportCard,
} from "@/features/settings-admin/places/places-catalog";
import {
  PlacesEditorOverlays,
  PlacesStackedFormCards,
} from "@/features/settings-admin/places/places-editor-overlays";
import type { PlacesWorkspace } from "@/features/settings-admin/places/use-places-workspace";
import { GrowPanel, SlidePanel } from "./panel-motion";

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
      {show && <PlacesEditorOverlays ws={ws} stacked />}
      <SlidePanel
        show={show}
        className="pointer-events-none absolute top-4 right-20 bottom-4 z-40 flex w-[420px] flex-col"
      >
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-3">
          <GrowPanel
            show={ws.modo === "lugar" || ws.modo === "trayecto"}
            className={formPantallaCompleta ? "min-h-0 flex-1" : undefined}
          >
            <PlacesStackedFormCards ws={ws} />
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
                  <PlacesCatalogLists
                    ws={ws}
                    searchAndImport
                    className="min-h-0 flex-1"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </SlidePanel>
    </>
  );
}
