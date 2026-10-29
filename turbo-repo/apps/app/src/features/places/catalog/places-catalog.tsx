"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button, ButtonGroup } from "flowbite-react";
import { MdOutlineFileUpload } from "react-icons/md";
import { twMerge } from "tailwind-merge";
import {
  SIN_CATEGORIA,
  categoriasDeLugares,
  filtrarLugares,
  filtrarPorCategoria,
  filtrarTrayectos,
} from "./catalog-search";
import { ListCard } from "./list-card";
import PlaceList from "./place-list";
import { TrayectoList } from "./route-lists";
import ExternalGeofencesList, {
  filtrarExternas,
} from "./external-geofences-list";
import { SelectionBar, useSeleccionLista } from "./list-selection";
import { inputCls } from "../ui/form-ui";
import { ACCEPT_IMPORT, esArchivoImport } from "../import-export/import-places";
import AddButton from "./add-button";
import ExportButton from "./export-button";
import {
  ImportLoteTable,
  ImportSelectionBar,
  type AccionesImport,
} from "../import-export/import-conflict-table";
import type { PlacesWorkspace } from "../hooks/use-places-workspace";
import type { GeocercaExterna } from "../places.types";

export function PlacesImportCard({
  ws,
  className,
}: Readonly<{
  ws: PlacesWorkspace;
  className?: string;
}>) {
  const {
    imp,
    setImp,
    cats,
    fileRef,
    onArchivos,
    confirmarImport,
    guardando,
    abrirImport,
  } = ws;
  const [arrastrando, setArrastrando] = useState(false);
  const profundidadArrastre = useRef(0);
  const lotes = imp.lotes ?? [];
  const hayLotes = lotes.length > 0;
  const acciones: AccionesImport = {
    conflictos: ws.conflictosImp,
    decisiones: imp.decisiones,
    seleccion: imp.seleccion,
    hoverUid: ws.hoverImportUid,
    onDecidir: ws.decidirImport,
    onSeleccionar: ws.alternarSeleccionImport,
    onMarcarFilas: ws.marcarFilasImport,
    onQuitarFilas: ws.quitarFilasImport,
    onHover: ws.hoverFilaImport,
    onHoverConflicto: ws.hoverConflictoImport,
  };

  const tomarArchivos = (lista: FileList | File[] | undefined) => {
    if (!lista || lista.length === 0) return;
    const files = [...lista].filter(esArchivoImport);
    if (!files.length) return;
    void onArchivos(files);
  };

  const alElegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    tomarArchivos(e.target.files ?? undefined);
    e.target.value = "";
  };

  const alEntrar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    profundidadArrastre.current += 1;
    setArrastrando(true);
  };

  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(true);
  };

  const alSalir = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    profundidadArrastre.current = Math.max(0, profundidadArrastre.current - 1);
    if (profundidadArrastre.current === 0) setArrastrando(false);
  };

  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    profundidadArrastre.current = 0;
    setArrastrando(false);
    tomarArchivos(e.dataTransfer.files);
  };

  const cancelar = () => abrirImport();
  const importar = () => void confirmarImport();

  return (
    <div
      data-places-form
      className={twMerge("flex min-h-0 flex-1 flex-col gap-3", className)}
    >
      <div
        data-places-import-drop
        onDragEnter={alEntrar}
        onDragOver={alArrastrar}
        onDragLeave={alSalir}
        onDrop={alSoltar}
        className={twMerge(
          "flex min-h-0 flex-1 flex-col rounded-lg border-2 border-dashed transition-all duration-200",
          hayLotes ? "gap-2 p-2" : "p-6",
          arrastrando
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600"
        )}
      >
        {hayLotes ? (
          <>
            <label
              htmlFor="places-import-file"
              className="block w-full shrink-0 cursor-pointer"
            >
              <span className="flex w-full flex-row items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800">
                <MdOutlineFileUpload className="h-4 w-4" />
                Importar otro archivo
              </span>
            </label>
            <ImportSelectionBar
              filas={ws.filasImp}
              acciones={acciones}
              onSeleccionarTodo={ws.seleccionarTodoImport}
            />
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {lotes.map((lote) => (
                <ImportLoteTable
                  key={lote.filename}
                  lote={lote}
                  acciones={acciones}
                />
              ))}
            </div>
            <select
              aria-label="Categoría"
              className={inputCls}
              value={imp.catDef}
              onChange={(e) => setImp({ ...imp, catDef: e.target.value })}
            >
              <option value="">Sin categoría</option>
              {(cats ?? []).map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <label
            htmlFor="places-import-file"
            aria-label="Arrastra o elige un archivo"
            className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="rounded-full bg-gray-200 p-3 dark:bg-gray-600">
                <MdOutlineFileUpload className="h-6 w-6 text-gray-500 dark:text-gray-300" />
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Arrastra CSV, KML o GeoJSON aquí
              </p>
              <span className="flex flex-row items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
                <MdOutlineFileUpload className="h-4 w-4" />
                Seleccionar archivo
              </span>
            </div>
          </label>
        )}
        <input
          id="places-import-file"
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT_IMPORT}
          className="hidden"
          aria-label="Seleccionar archivo"
          onChange={alElegirArchivo}
        />
      </div>
      {imp.resultado && (
        <div className="text-xs text-gray-700 dark:text-gray-300">
          {imp.resultado}
        </div>
      )}
      <ButtonGroup className="flex w-full shrink-0">
        <Button
          type="button"
          color="alternative"
          disabled={guardando}
          className="min-w-0 flex-1 py-2.5 text-sm"
          onClick={cancelar}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          color="blue"
          disabled={guardando || !hayLotes}
          className="min-w-0 flex-1 py-2.5 text-sm"
          onClick={importar}
        >
          {guardando ? "Importando…" : "Importar"}
        </Button>
      </ButtonGroup>
    </div>
  );
}

// sin el permiso las listas no ofrecen editar, eliminar ni marcar
function accionesEditables(
  editable: boolean,
  ws: PlacesWorkspace,
  sel: ReturnType<typeof useSeleccionLista>
) {
  if (!editable) return { accionesLugar: {}, accionesTrayecto: {} };
  return {
    accionesLugar: {
      onEditar: ws.editarLugar,
      onEliminar: ws.borrarLugar,
      marcas: sel.marcasLugares,
    },
    accionesTrayecto: {
      onEditar: ws.editarTrayecto,
      onEliminar: ws.borrarTrayecto,
      marcas: sel.marcasTrayectos,
    },
  };
}

const nombreCategoria = (c: string) =>
  c === SIN_CATEGORIA ? "Sin categoría" : c;

/** Elige una categoría de geocercas; solo si hay más de una. */
function CategoryFilter({
  categorias,
  valor,
  onCambiar,
}: Readonly<{
  categorias: { categoria: string; total: number }[];
  valor: string;
  onCambiar: (categoria: string) => void;
}>) {
  if (categorias.length < 2) return null;
  return (
    <select
      aria-label="Filtrar por categoría"
      className={twMerge(inputCls, "shrink-0")}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
    >
      <option value="">Todas las categorías</option>
      {categorias.map(({ categoria, total }) => (
        <option key={categoria} value={categoria}>
          {`${nombreCategoria(categoria)} (${total})`}
        </option>
      ))}
    </select>
  );
}

function textoSinResultados(busca: string, categoria: string): string {
  const q = busca.trim();
  if (!categoria) return `Sin resultados para «${q}».`;
  const cat = `en «${nombreCategoria(categoria)}»`;
  return q ? `Sin resultados para «${q}» ${cat}.` : `Sin lugares ${cat}.`;
}

export function PlacesCatalogLists({
  ws,
  externas,
  className,
}: Readonly<{
  ws: PlacesWorkspace;
  /** Otra sección de solo lectura (p. ej. las geocercas del viaje). */
  externas?: { titulo: string; items: GeocercaExterna[] };
  className?: string;
}>) {
  // sin el permiso "Editor de lugares": solo listar, buscar y descargar
  const editable = ws.puedeEditar !== false;
  const todosLugares = ws.todosLugares ?? ws.lugares;
  const categorias = categoriasDeLugares(todosLugares);
  const [categoriaElegida, setCategoria] = useState("");
  // una categoría que ya no está (otros datos) vuelve a todas
  const categoria = categorias.some((c) => c.categoria === categoriaElegida)
    ? categoriaElegida
    : "";
  // con una categoría solo quedan lugares: trayectos y externas no la tienen
  const filtrando = ws.busca.trim().length > 0 || categoria !== "";
  const lugares = filtrarPorCategoria(
    filtrarLugares(todosLugares, ws.busca),
    categoria
  );
  const trayectos = categoria
    ? []
    : filtrarTrayectos(ws.todosTrayectos ?? [], ws.busca);
  const verLugares = !filtrando || lugares.length > 0;
  const verTrayectos = !filtrando || trayectos.length > 0;
  const externasFiltradas = categoria
    ? []
    : filtrarExternas(externas?.items ?? [], ws.busca);
  const verExternas =
    !!externas && (!filtrando || externasFiltradas.length > 0);
  const sinResultados =
    filtrando && !verLugares && !verTrayectos && !verExternas;
  const sel = useSeleccionLista(todosLugares, ws.todosTrayectos ?? []);
  const todosVisibles =
    lugares.length + trayectos.length > 0 &&
    lugares.every((l) => sel.marcasLugares.marcados.has(l.place_id)) &&
    trayectos.every((t) => sel.marcasTrayectos.marcados.has(t.trayecto_id));
  const eliminarSeleccion = () =>
    ws.borrarSeleccion(sel.lugaresSel, sel.trayectosSel, sel.limpiar);
  const { accionesLugar, accionesTrayecto } = accionesEditables(
    editable,
    ws,
    sel
  );

  return (
    <div className={twMerge("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div className="flex shrink-0 gap-1.5">
        <input
          className={inputCls}
          placeholder="Buscar por nombre, dirección o external_id…"
          value={ws.busca}
          onChange={(e) => ws.setBusca(e.target.value)}
        />
        {/* importar crea lugares: solo con el permiso */}
        {editable && (
          <button
            type="button"
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              ws.modo === "import"
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-900 dark:border-gray-600 dark:text-white"
            }`}
            onClick={ws.abrirImport}
          >
            Importar
          </button>
        )}
        <ExportButton
          lugares={ws.todosLugares ?? []}
          trayectos={ws.todosTrayectos ?? []}
        />
      </div>

      <CategoryFilter
        categorias={categorias}
        valor={categoria}
        onCambiar={setCategoria}
      />

      {/* agregar, a todo el ancho bajo la búsqueda: solo con el permiso */}
      {editable && (
        <div className="shrink-0">
          <AddButton onGeocerca={ws.nuevoLugar} onTrayecto={ws.nuevoTrayecto} />
        </div>
      )}

      {editable && sel.total > 0 && (
        <SelectionBar
          total={sel.total}
          todosVisibles={todosVisibles}
          onTodos={() => sel.marcarVisibles(lugares, trayectos)}
          onCancelar={sel.limpiar}
          onEliminar={eliminarSeleccion}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ListCard>
          {sinResultados ? (
            <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
              {textoSinResultados(ws.busca, categoria)}
            </p>
          ) : (
            <>
              {verLugares && (
                <PlaceList
                  lugares={lugares}
                  busqueda={ws.busca}
                  seleccionadoId={ws.editandoLugarId}
                  onIr={ws.irALugar}
                  onHover={ws.setHoveredPlaceId}
                  {...accionesLugar}
                  versionDe={(id) => ws.versionDe("lugar", id)}
                />
              )}
              {verTrayectos && (
                <TrayectoList
                  trayectos={trayectos}
                  busqueda={ws.busca}
                  seleccionadoId={ws.editandoTrayId}
                  onIr={ws.irATrayecto}
                  {...accionesTrayecto}
                  versionDe={(id) => ws.versionDe("trayecto", id)}
                />
              )}
              {verExternas && externas && (
                <ExternalGeofencesList
                  titulo={externas.titulo}
                  items={externasFiltradas}
                  vacio={`Sin ${externas.titulo.toLowerCase()}.`}
                  onIr={(g) => ws.irAPunto(g.ancla)}
                />
              )}
            </>
          )}
        </ListCard>
      </div>
    </div>
  );
}
