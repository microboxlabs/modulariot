"use client";

import { DeleteConfirmModal } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/viewer/modals/delete-confirm-modal";
import PlaceForm from "../geofences/place-form";
import TrayectoForm from "../routes/trayecto-form";
import VersionDialog from "../versioning/version-dialog";
import MapCreateMenu from "./map-create-menu";
import PlaceBadgeMenu from "./place-badge-menu";
import PlaceBadgeTooltip from "./place-badge-tooltip";
import PolygonDrawToolbar from "../geofences/polygon-draw-toolbar";
import { esPoligonoLibre } from "../geofences/geofence-editor";
import {
  actualizarInner,
  innerComoForm,
  innerEnEdicion,
} from "../geofences/inner-geofences";
import {
  cancelarDibujo,
  deshacer,
  puedeDeshacer,
  puedeRehacer,
  puedeTerminar,
  rehacer,
  seguirDibujando,
  terminar,
} from "../geofences/polygon-draw";
import {
  puedeConfirmar,
  puedeDeshacerRecorrido,
  puedeRehacerRecorrido,
  puntosUbicados,
} from "../routes/recorrido";
import type { PlacesWorkspace } from "../hooks/use-places-workspace";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Dispatch, SetStateAction } from "react";
import type { FormLugar } from "../places.types";

function InnerPolygonToolbar({
  form,
  setForm,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}>) {
  const inner = innerEnEdicion(form);
  if (inner?.geom !== "polygon" || !esPoligonoLibre(inner)) return null;
  if (inner.vertices.length === 0 && !puedeDeshacer(innerComoForm(inner))) {
    return null;
  }
  const innerForm = innerComoForm(inner);
  const patch = (fn: (f: FormLugar) => FormLugar) =>
    setForm((f) => actualizarInner(f, inner.id, fn));
  return (
    <PolygonDrawToolbar
      puntos={inner.vertices.length}
      cerrado={inner.cerrado}
      onSeguir={() => patch(seguirDibujando)}
      puedeTerminar={puedeTerminar(innerForm)}
      onTerminar={() => patch(terminar)}
      puedeDeshacer={puedeDeshacer(innerForm)}
      puedeRehacer={puedeRehacer(innerForm)}
      onDeshacer={() => patch(deshacer)}
      onRehacer={() => patch(rehacer)}
      onCancelar={() => patch(cancelarDibujo)}
    />
  );
}

/** Barra del recorrido: deshacer/rehacer, confirmar o volver a editar. */
function TrayectoDrawToolbar({ ws }: Readonly<{ ws: PlacesWorkspace }>) {
  const { tray } = ws;
  const puntos = puntosUbicados(tray).length;
  const deshacer = puedeDeshacerRecorrido(tray);
  const rehacer = puedeRehacerRecorrido(tray);
  if (puntos === 0 && !deshacer && !rehacer) return null;
  return (
    <PolygonDrawToolbar
      variante="trayecto"
      puntos={puntos}
      cerrado={tray.confirmado}
      puedeTerminar={puedeConfirmar(tray)}
      puedeDeshacer={deshacer}
      puedeRehacer={rehacer}
      onTerminar={ws.confirmarTrayecto}
      onSeguir={ws.editarPuntosTrayecto}
      onDeshacer={ws.deshacerTrayecto}
      onRehacer={ws.rehacerTrayecto}
      onCancelar={ws.borrarPuntosTrayecto}
    />
  );
}

/**
 * El formulario abierto ES la barra lateral de Lugares: todo su alto y ancho,
 * sin marco de tarjeta (ni borde, ni redondeo, ni sombra) sobre la barra.
 */
const FORM_EN_PANEL =
  "relative top-auto right-auto flex h-full min-h-0 w-full max-h-none flex-col rounded-none border-0 bg-transparent shadow-none backdrop-blur-none dark:bg-transparent";

function LugarFormCard({
  ws,
  className,
  dict,
}: Readonly<{
  ws: PlacesWorkspace;
  className?: string;
  dict?: I18nRecord;
}>) {
  return (
    <PlaceForm
      className={className}
      dict={dict}
      form={ws.form}
      setForm={ws.setForm}
      cats={ws.cats ?? []}
      guardando={ws.guardando}
      msg={ws.msg}
      token={ws.MAPBOX_TOKEN}
      cerca={ws.centroMapa}
      onUbicar={ws.ubicarEnMapa}
      paso={ws.pasoLugar}
      onContinuar={ws.continuarAInteriores}
      onGuardar={() => void ws.guardarLugar()}
      version={ws.versionDe("lugar", ws.form.place_id)}
      onBack={ws.volverAGeocerca}
      onClose={ws.cerrarForm}
    />
  );
}

function TrayectoFormCard({
  ws,
  className,
  dict,
}: Readonly<{
  ws: PlacesWorkspace;
  className?: string;
  dict?: I18nRecord;
}>) {
  return (
    <TrayectoForm
      className={className}
      dict={dict}
      token={ws.MAPBOX_TOKEN}
      cerca={ws.centroMapa}
      geocercas={ws.todosLugares ?? ws.lugares}
      onRecorrido={ws.aplicarRecorrido}
      eligiendoPuntoId={ws.puntoMapaId}
      onElegirEnMapa={ws.elegirPuntoEnMapa}
      resaltadoId={ws.hoverPuntoId}
      onHoverPunto={ws.setHoverPuntoId}
      paso={ws.pasoTrayecto}
      onPaso={ws.cambiarPasoTrayecto}
      onTipo={ws.cambiarTipoTrayecto}
      onTipoPunto={ws.cambiarTipoPuntoTray}
      distanciaM={ws.distanciaTrayectoM}
      tray={ws.tray}
      setTray={ws.setTray}
      guardando={ws.guardando}
      msg={ws.msg}
      onSave={ws.guardarOContinuarTrayecto}
      version={ws.versionDe("trayecto", ws.tray.id)}
      onClose={ws.cerrarForm}
    />
  );
}

/** Este modal no se cierra solo al confirmar: se cierra y luego se borra. */
function confirmarYCerrar(ws: PlacesWorkspace) {
  const accion = ws.confirmacion?.accion;
  ws.setConfirmacion(null);
  accion?.();
}

/**
 * Lo que va sobre el mapa mientras se edita: menús, barras de dibujo y los
 * modales de borrar y de nueva versión. Los formularios van en la barra
 * lateral (PlacesStackedFormCards).
 */
export function PlacesEditorOverlays({
  ws,
  dict,
}: Readonly<{
  ws: PlacesWorkspace;
  dict?: I18nRecord;
}>) {
  return (
    <>
      {ws.menu && (
        <MapCreateMenu
          x={ws.menu.x}
          y={ws.menu.y}
          onCrearLugar={ws.crearLugarAqui}
          onCrearTrayecto={ws.crearTrayectoAqui}
          onClose={ws.cerrarMenu}
        />
      )}
      {/* tooltip del badge bajo el mouse (no con un menú abierto) */}
      {ws.tooltipBadge && !ws.menu && !ws.menuLugar && (
        <PlaceBadgeTooltip
          badge={ws.tooltipBadge.badge}
          x={ws.tooltipBadge.x}
          y={ws.tooltipBadge.y}
        />
      )}
      {ws.menuLugar && (
        <PlaceBadgeMenu
          x={ws.menuLugar.x}
          y={ws.menuLugar.y}
          nombre={ws.menuLugar.lugar.name}
          onConfigurar={ws.configurarDesdeMenu}
          onEliminar={ws.eliminarDesdeMenu}
          onClose={ws.cerrarMenuLugar}
        />
      )}
      {ws.modo === "lugar" &&
        ws.pasoLugar === "interiores" &&
        innerEnEdicion(ws.form) && (
          <InnerPolygonToolbar form={ws.form} setForm={ws.setForm} />
        )}
      {ws.modo === "lugar" &&
        ws.pasoLugar === "geocerca" &&
        esPoligonoLibre(ws.form) &&
        (ws.form.vertices.length > 0 ||
          puedeDeshacer(ws.form) ||
          puedeRehacer(ws.form)) && (
          <PolygonDrawToolbar
            puntos={ws.form.vertices.length}
            cerrado={ws.form.cerrado}
            onSeguir={ws.seguirPoligono}
            puedeTerminar={puedeTerminar(ws.form)}
            onTerminar={ws.terminarPoligono}
            puedeDeshacer={puedeDeshacer(ws.form)}
            puedeRehacer={puedeRehacer(ws.form)}
            onDeshacer={ws.deshacerPunto}
            onRehacer={ws.rehacerPunto}
            onCancelar={ws.cancelarPoligono}
          />
        )}
      {ws.modo === "trayecto" && ws.pasoTrayecto === "recorrido" && (
        <TrayectoDrawToolbar ws={ws} />
      )}
      <DeleteConfirmModal
        show={ws.confirmacion !== null}
        onClose={() => ws.setConfirmacion(null)}
        onConfirm={() => confirmarYCerrar(ws)}
        fileName={ws.confirmacion?.nombre ?? ""}
        title={ws.confirmacion?.titulo}
        description={null}
        dictionary={dict ?? {}}
      />
      {/* guardar una geocerca o trayecto editado: tipo de actualización */}
      <VersionDialog
        pendiente={ws.versionPendiente}
        guardando={ws.guardando}
        onCancelar={ws.cancelarVersion}
        onConfirmar={ws.confirmarVersion}
      />
    </>
  );
}

export function PlacesStackedFormCards({
  ws,
  dict,
}: Readonly<{
  ws: PlacesWorkspace;
  dict?: I18nRecord;
}>) {
  return (
    <>
      {ws.modo === "lugar" && (
        <LugarFormCard ws={ws} className={FORM_EN_PANEL} dict={dict} />
      )}
      {ws.modo === "trayecto" && (
        <TrayectoFormCard ws={ws} className={FORM_EN_PANEL} dict={dict} />
      )}
    </>
  );
}
